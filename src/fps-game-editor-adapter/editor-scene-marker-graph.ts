import {
  SPATIAL_MARKER_GRAPH_SCHEMA_VERSION,
  getEditorSceneGameObjectWorldTransform,
  toEditorSceneLocalTransformForParent,
  type PlayableLocalEditorMarkerGraphCommand,
  type SpatialMarkerGeometry,
  type SpatialMarkerGraph,
  type SpatialMarkerNode,
  type SpatialMarkerTargetRef,
  type SpatialMarkerTypeDefinition,
  type SpatialRelation,
  type SpatialRelationEndpoint,
  type SpatialRelationTypeDefinition,
} from '@fps-games/editor/playable-sdk';
import type {
  EditorSceneDocument,
  EditorSceneGameObject,
  EditorSceneMarkerConfig,
  EditorSceneVec3,
} from './editor-scene-document';
import type { EditorSceneDocumentPatch } from './editor-scene-session';

export const EDITOR_SCENE_MARKER_TYPE_CATALOG: SpatialMarkerTypeDefinition[] = [
  {
    type: 'collection-area',
    label: 'Collection Area',
    kind: 'region',
    description: 'A gameplay region that can own or contain collectible objects.',
  },
  {
    type: 'trade-zone',
    label: 'Trade Zone',
    kind: 'region',
    description: 'A gameplay region used for trading interactions.',
  },
  {
    type: 'entrance',
    label: 'Entrance',
    kind: 'point',
    description: 'A semantic entry marker for a region or object.',
  },
  {
    type: 'exit',
    label: 'Exit',
    kind: 'point',
    description: 'A semantic exit marker for a region or object.',
  },
  {
    type: 'effect-socket',
    label: 'Effect Socket',
    kind: 'anchor',
    description: 'A semantic attachment point for visual effects.',
  },
];

export const EDITOR_SCENE_RELATION_TYPE_CATALOG: SpatialRelationTypeDefinition[] = [
  { type: 'contains', label: 'Contains', directed: true },
  { type: 'belongs-to', label: 'Belongs To', directed: true },
  { type: 'entrance-of', label: 'Entrance Of', directed: true },
  { type: 'exit-of', label: 'Exit Of', directed: true },
  { type: 'attached-to', label: 'Attached To', directed: true },
  { type: 'near', label: 'Near', directed: false },
  { type: 'faces', label: 'Faces', directed: true },
];

export function getEditorSceneMarkerGraph(document: EditorSceneDocument): SpatialMarkerGraph {
  const graph = normalizeEditorSceneMarkerGraph(document.scene.markerGraph);
  const markersById = new Map<string, SpatialMarkerNode>();
  for (const marker of graph.markers) markersById.set(marker.id, marker);
  for (const marker of createSpatialMarkersFromGameObjects(document)) markersById.set(marker.id, marker);
  return {
    ...graph,
    markers: [...markersById.values()],
  };
}

export function isEditorSceneMarkerGameObject(
  gameObject: EditorSceneGameObject | null | undefined,
): gameObject is EditorSceneGameObject & { marker: EditorSceneMarkerConfig } {
  return !!gameObject?.marker;
}

export function getEditorSceneMarkerTypeCatalog(document?: EditorSceneDocument): SpatialMarkerTypeDefinition[] {
  const markerGraph = document?.scene.markerGraph
    ? normalizeEditorSceneMarkerGraph(document.scene.markerGraph)
    : null;
  const definitions = new Map<string, SpatialMarkerTypeDefinition>();
  for (const definition of EDITOR_SCENE_MARKER_TYPE_CATALOG) {
    definitions.set(definition.type, cloneBuiltInMarkerTypeDefinition(definition));
  }
  for (const override of readMarkerTypeOverrides(markerGraph)) {
    const builtIn = definitions.get(override.type) ?? null;
    definitions.set(override.type, mergeMarkerTypeDefinition(builtIn, override));
  }
  return [...definitions.values()];
}

export function getEditorSceneRelationTypeCatalog(): SpatialRelationTypeDefinition[] {
  return EDITOR_SCENE_RELATION_TYPE_CATALOG.map(definition => ({ ...definition }));
}

export function createEditorSceneMarkerGraphPatch(
  document: EditorSceneDocument,
  command: PlayableLocalEditorMarkerGraphCommand,
): { patch: EditorSceneDocumentPatch; label: string; changedId?: string; changedIds?: string[]; selectId?: string | null } | null {
  if (!isEditorSceneMarkerGraphCommandSupported(document, command)) return null;
  return {
    patch: {
      kind: 'scene.marker-graph',
      command: cloneMarkerGraphCommand(command),
    },
    label: createEditorSceneMarkerGraphPatchLabel(command),
    ...getEditorSceneMarkerGraphPatchSelection(command),
  };
}

export function reduceEditorSceneMarkerGraphPatch(
  document: EditorSceneDocument,
  command: PlayableLocalEditorMarkerGraphCommand,
): EditorSceneDocument {
  const markerObjectDocument = reduceEditorSceneMarkerGameObjectCommand(document, command);
  if (markerObjectDocument) return markerObjectDocument;
  const graph = getEditorSceneMarkerGraph(document);
  const nextGraph = reduceEditorSceneMarkerGraph(graph, command);
  return withEditorSceneMarkerGraph(document, nextGraph);
}

export function syncEditorSceneMarkerGraphDocument(document: EditorSceneDocument): EditorSceneDocument {
  const normalizedMarkerObjects = normalizeEditorSceneMarkerGameObjects(document);
  if (normalizedMarkerObjects !== document) return syncEditorSceneMarkerGraphDocument(normalizedMarkerObjects);
  const migrated = migrateEditorSceneMarkerGraphMarkersToGameObjects(document);
  if (migrated !== document) return syncEditorSceneMarkerGraphDocument(migrated);
  if (!document.scene.markerGraph) return document;
  const originalGraph = document.scene.markerGraph;
  const graph = normalizeEditorSceneMarkerGraph(document.scene.markerGraph);
  const nextGraph = syncEditorSceneMarkerGraph(document, graph);
  return areMarkerGraphsEqual(originalGraph, nextGraph)
    ? document
    : withEditorSceneMarkerGraph(document, nextGraph);
}

export function migrateEditorSceneMarkerGraphMarkersToGameObjects(document: EditorSceneDocument): EditorSceneDocument {
  const graph = document.scene.markerGraph ? normalizeEditorSceneMarkerGraph(document.scene.markerGraph) : null;
  if (!graph || graph.markers.length === 0) return document;

  const existingIds = new Set(document.scene.gameObjects.map(gameObject => gameObject.id));
  const markerIdMap = new Map<string, string>();
  const markerGameObjectPlans: Array<{ marker: SpatialMarkerNode; gameObjectId: string }> = [];

  for (const marker of graph.markers) {
    if (document.scene.gameObjects.some(gameObject => gameObject.id === marker.id && isEditorSceneMarkerGameObject(gameObject))) {
      markerIdMap.set(marker.id, marker.id);
      continue;
    }
    const gameObjectId = existingIds.has(marker.id)
      ? createUniqueMarkerGameObjectId(marker.id, existingIds)
      : marker.id;
    existingIds.add(gameObjectId);
    markerIdMap.set(marker.id, gameObjectId);
    markerGameObjectPlans.push({ marker, gameObjectId });
  }
  const markerGameObjects = markerGameObjectPlans.map(plan => (
    createMarkerGameObjectFromSpatialMarker(rewriteSpatialMarkerTargetRefs(plan.marker, markerIdMap), plan.gameObjectId)
  ));

  const nextGraph = normalizeEditorSceneMarkerGraph({
    ...graph,
    markers: [],
    relations: graph.relations.map(relation => rewriteMarkerRelationIds(relation, markerIdMap)),
  });

  return {
    ...document,
    scene: {
      ...document.scene,
      gameObjects: [...document.scene.gameObjects, ...markerGameObjects],
      markerGraph: nextGraph,
    },
  };
}

export function syncEditorSceneMarkerGraph(
  document: EditorSceneDocument,
  graph: SpatialMarkerGraph,
): SpatialMarkerGraph {
  const objectIds = new Set(document.scene.gameObjects.map(gameObject => gameObject.id));
  const markers = graph.markers.filter(marker => isMarkerSceneObjectTargetValid(marker, objectIds));
  const markerIds = new Set([
    ...markers.map(marker => marker.id),
    ...document.scene.gameObjects.filter(isEditorSceneMarkerGameObject).map(gameObject => gameObject.id),
  ]);
  const relations = graph.relations.filter(relation => (
    isRelationEndpointValid(relation.from, objectIds, markerIds)
      && isRelationEndpointValid(relation.to, objectIds, markerIds)
  ));
  return {
    ...graph,
    markers,
    relations,
  };
}

function reduceEditorSceneMarkerGraph(
  graph: SpatialMarkerGraph,
  command: PlayableLocalEditorMarkerGraphCommand,
): SpatialMarkerGraph {
  switch (command.type) {
    case 'marker.create-box':
      return upsertMarker(graph, command.marker);
    case 'marker.update':
      return updateMarker(graph, command.markerId, command.patch);
    case 'marker.delete':
      return deleteMarker(graph, command.markerId);
    case 'relation.create':
      return upsertRelation(graph, command.relation);
    case 'relation.delete':
      return {
        ...graph,
        relations: graph.relations.filter(relation => relation.id !== command.relationId),
      };
    case 'marker.sync-from-scene':
      return graph;
    case 'marker-type.create':
      return createMarkerType(graph, command.definition);
    case 'marker-type.update':
      return updateMarkerType(graph, command.typeId, command.patch);
    case 'marker-type.delete':
      return deleteMarkerType(graph, command.typeId);
  }
}

function reduceEditorSceneMarkerGameObjectCommand(
  document: EditorSceneDocument,
  command: PlayableLocalEditorMarkerGraphCommand,
): EditorSceneDocument | null {
  switch (command.type) {
    case 'marker.update':
      return updateEditorSceneMarkerGameObject(document, command.markerId, command.patch);
    case 'marker.delete':
      return deleteEditorSceneMarkerGameObject(document, command.markerId);
    default:
      return null;
  }
}

function updateEditorSceneMarkerGameObject(
  document: EditorSceneDocument,
  markerId: string,
  patch: Partial<Omit<SpatialMarkerNode, 'id'>>,
): EditorSceneDocument | null {
  const gameObject = document.scene.gameObjects.find(candidate => candidate.id === markerId) ?? null;
  if (!isEditorSceneMarkerGameObject(gameObject)) return null;
  const currentMarker = createSpatialMarkerFromGameObject(document, gameObject);
  const nextMarker = cloneMarker({
    ...currentMarker,
    ...patch,
    id: currentMarker.id,
    geometry: patch.geometry ?? currentMarker.geometry,
  });
  const nextGameObject = patchMarkerGameObjectFromSpatialMarker(document, gameObject, nextMarker);
  return {
    ...document,
    scene: {
      ...document.scene,
      gameObjects: document.scene.gameObjects.map(candidate => (
        candidate.id === markerId ? nextGameObject : candidate
      )),
    },
  };
}

function deleteEditorSceneMarkerGameObject(
  document: EditorSceneDocument,
  markerId: string,
): EditorSceneDocument | null {
  const gameObject = document.scene.gameObjects.find(candidate => candidate.id === markerId) ?? null;
  if (!isEditorSceneMarkerGameObject(gameObject)) return null;
  const deleteIds = collectEditorSceneGameObjectSubtreeIds(document, markerId);
  const graph = normalizeEditorSceneMarkerGraph(document.scene.markerGraph);
  return {
    ...document,
    scene: {
      ...document.scene,
      gameObjects: document.scene.gameObjects.filter(candidate => !deleteIds.has(candidate.id)),
      markerGraph: {
        ...graph,
        markers: [],
        relations: graph.relations.filter(relation => (
          !isDeletedRelationEndpoint(relation.from, deleteIds)
            && !isDeletedRelationEndpoint(relation.to, deleteIds)
        )),
      },
    },
  };
}

function normalizeEditorSceneMarkerGameObjects(document: EditorSceneDocument): EditorSceneDocument {
  let changed = false;
  const gameObjects = document.scene.gameObjects.map((gameObject) => {
    if (!isEditorSceneMarkerGameObject(gameObject)) return gameObject;
    const normalized = normalizeEditorSceneMarkerGameObject(document, gameObject);
    if (normalized !== gameObject) changed = true;
    return normalized;
  });
  return changed
    ? {
        ...document,
        scene: {
          ...document.scene,
          gameObjects,
        },
      }
    : document;
}

function normalizeEditorSceneMarkerGameObject(
  document: EditorSceneDocument,
  gameObject: EditorSceneGameObject & { marker: EditorSceneMarkerConfig },
): EditorSceneGameObject {
  if (gameObject.marker.geometry.kind !== 'box') return gameObject;
  const authoredGeometry = gameObject.marker.geometry as EditorSceneMarkerConfig['geometry'] & {
    coordinateSpace?: unknown;
    center?: unknown;
    size?: unknown;
    rotation?: unknown;
  };
  const hasLegacyBoxFields = 'coordinateSpace' in authoredGeometry
    || 'center' in authoredGeometry
    || 'size' in authoredGeometry
    || 'rotation' in authoredGeometry;
  if (!hasLegacyBoxFields) return gameObject;

  const currentTransform = getEditorSceneGameObjectWorldTransform(document, gameObject.id);
  const currentScale = currentTransform?.scale ?? readMarkerGameObjectScale(gameObject);
  const geometry: SpatialMarkerGeometry = {
    kind: 'box',
    coordinateSpace: 'world',
    center: isVec3Like(authoredGeometry.center)
      ? cloneVec3(authoredGeometry.center)
      : cloneVec3(currentTransform?.position ?? createVec3(0, 0, 0)),
    size: isVec3Like(authoredGeometry.size)
      ? normalizeMarkerBoxSize(authoredGeometry.size)
      : normalizeMarkerBoxSize(currentScale),
    rotation: isVec3Like(authoredGeometry.rotation)
      ? cloneVec3(authoredGeometry.rotation)
      : cloneVec3(currentTransform?.rotation ?? createVec3(0, 0, 0)),
  };
  return {
    ...gameObject,
    marker: {
      ...gameObject.marker,
      geometry: { kind: 'box' },
    },
    components: patchMarkerGameObjectTransformComponents(document, gameObject, gameObject.components, geometry),
  };
}

function normalizeEditorSceneMarkerGraph(graph: SpatialMarkerGraph | null | undefined): SpatialMarkerGraph {
  if (!graph) {
    return {
      schemaVersion: SPATIAL_MARKER_GRAPH_SCHEMA_VERSION,
      markers: [],
      relations: [],
    };
  }
  return {
    schemaVersion: SPATIAL_MARKER_GRAPH_SCHEMA_VERSION,
    markers: graph.markers.map(cloneMarker),
    relations: graph.relations.map(cloneRelation),
    metadata: graph.metadata ? structuredClone(graph.metadata) : undefined,
  };
}

function createMarkerGameObjectFromSpatialMarker(
  marker: SpatialMarkerNode,
  gameObjectId: string,
): EditorSceneGameObject {
  const markerTransform = {
    position: readSpatialMarkerTransformPosition(marker.geometry),
    rotation: readSpatialMarkerTransformRotation(marker.geometry),
    scale: readSpatialMarkerTransformScale(marker.geometry, createVec3(1, 1, 1)),
  };
  return {
    id: gameObjectId,
    name: marker.label || marker.id,
    kind: 'transform',
    active: true,
    marker: createEditorSceneMarkerConfig(marker),
    components: [{ type: 'Transform', ...markerTransform }],
  };
}

function patchMarkerGameObjectFromSpatialMarker(
  document: EditorSceneDocument,
  gameObject: EditorSceneGameObject,
  marker: SpatialMarkerNode,
): EditorSceneGameObject {
  return {
    ...gameObject,
    name: marker.label || gameObject.name || marker.id,
    kind: 'transform',
    marker: createEditorSceneMarkerConfig(marker),
    components: patchMarkerGameObjectTransformComponents(document, gameObject, gameObject.components, marker.geometry),
  };
}

function patchMarkerGameObjectTransformComponents(
  document: EditorSceneDocument,
  gameObject: EditorSceneGameObject,
  components: EditorSceneGameObject['components'],
  geometry: SpatialMarkerGeometry,
): EditorSceneGameObject['components'] {
  const currentScale = readMarkerGameObjectScale(gameObject);
  const worldTransform = {
    position: readSpatialMarkerTransformPosition(geometry),
    rotation: readSpatialMarkerTransformRotation(geometry),
    scale: readSpatialMarkerTransformScale(geometry, currentScale),
  };
  const localTransform = toEditorSceneLocalTransformForParent(document, gameObject.parentId, worldTransform) ?? worldTransform;
  let patched = false;
  const nextComponents = components.map((component) => {
    if (component.type !== 'Transform') return component;
    patched = true;
    return {
      ...component,
      position: localTransform.position,
      rotation: localTransform.rotation,
      scale: localTransform.scale,
    };
  });
  return patched
    ? nextComponents
    : [
        ...nextComponents,
        {
          type: 'Transform',
          position: localTransform.position,
          rotation: localTransform.rotation,
          scale: localTransform.scale,
        },
      ];
}

function readMarkerGameObjectScale(gameObject: EditorSceneGameObject): EditorSceneVec3 {
  for (const component of gameObject.components) {
    if (component.type !== 'Transform') continue;
    const scale = (component as { scale?: unknown }).scale;
    return isVec3Like(scale) ? cloneVec3(scale) : createVec3(1, 1, 1);
  }
  return createVec3(1, 1, 1);
}

function createSpatialMarkersFromGameObjects(document: EditorSceneDocument): SpatialMarkerNode[] {
  return document.scene.gameObjects
    .filter(isEditorSceneMarkerGameObject)
    .map(gameObject => createSpatialMarkerFromGameObject(document, gameObject));
}

function createSpatialMarkerFromGameObject(
  document: EditorSceneDocument,
  gameObject: EditorSceneGameObject,
): SpatialMarkerNode {
  const marker = gameObject.marker!;
  const metadata = marker.metadata ? structuredClone(marker.metadata) : {};
  if (marker.color) metadata.color = { ...marker.color } as any;
  if (marker.note !== undefined) metadata.note = marker.note;
  return {
    id: gameObject.id,
    kind: marker.kind ?? 'region',
    markerType: marker.type,
    label: gameObject.name ?? gameObject.id,
    geometry: createSpatialMarkerGeometryFromGameObject(document, gameObject),
    ...(marker.target ? { target: structuredClone(marker.target) } : {}),
    ...(marker.semanticFrame ? { semanticFrame: structuredClone(marker.semanticFrame) } : {}),
    ...(marker.tags?.length ? { tags: [...marker.tags] } : {}),
    ...(Object.keys(metadata).length > 0 ? { metadata: metadata as any } : {}),
  };
}

function createSpatialMarkerGeometryFromGameObject(
  document: EditorSceneDocument,
  gameObject: EditorSceneGameObject,
): SpatialMarkerGeometry {
  const marker = gameObject.marker!;
  const transform = getEditorSceneGameObjectWorldTransform(document, gameObject.id);
  const position = transform?.position ?? createVec3(0, 0, 0);
  const rotation = transform?.rotation ?? createVec3(0, 0, 0);
  const scale = transform?.scale ?? readMarkerGameObjectScale(gameObject);
  switch (marker.geometry.kind) {
    case 'box':
      return {
        kind: 'box',
        coordinateSpace: 'world',
        center: cloneVec3(position),
        size: normalizeMarkerBoxSize(scale),
        rotation: cloneVec3(rotation),
      };
    case 'point':
      return {
        kind: 'point',
        coordinateSpace: marker.geometry.coordinateSpace ?? 'world',
        position: marker.geometry.position
          ? cloneVec3(marker.geometry.position)
          : marker.geometry.offset
            ? addVec3(position, marker.geometry.offset)
            : cloneVec3(position),
        ...(marker.geometry.target ? { target: structuredClone(marker.geometry.target) } : {}),
      };
    case 'object-bounds':
      return {
        kind: 'object-bounds',
        target: structuredClone(marker.geometry.target),
      };
    case 'polyhedron':
      return {
        kind: 'polyhedron',
        coordinateSpace: marker.geometry.coordinateSpace ?? 'world',
        vertices: marker.geometry.vertices.map(cloneVec3),
        ...(marker.geometry.faces ? { faces: marker.geometry.faces.map(face => [...face]) } : {}),
      };
  }
}

function createEditorSceneMarkerConfig(marker: SpatialMarkerNode): EditorSceneMarkerConfig {
  const metadata = marker.metadata ? structuredClone(marker.metadata) : {};
  const color = readMarkerMetadataColor(metadata.color);
  const hasStringNote = typeof metadata.note === 'string';
  const note = hasStringNote ? metadata.note as string : undefined;
  if (color) delete metadata.color;
  if (hasStringNote) delete metadata.note;
  return {
    schemaVersion: 1,
    type: marker.markerType,
    ...(marker.kind ? { kind: marker.kind } : {}),
    ...(marker.tags?.length ? { tags: [...marker.tags] } : {}),
    ...(note !== undefined ? { note } : {}),
    ...(color ? { color } : {}),
    ...(marker.target ? { target: structuredClone(marker.target) } : {}),
    ...(marker.semanticFrame ? { semanticFrame: structuredClone(marker.semanticFrame) } : {}),
    geometry: createEditorSceneMarkerGeometry(marker.geometry),
    ...(Object.keys(metadata).length > 0 ? { metadata: metadata as any } : {}),
  };
}

function createEditorSceneMarkerGeometry(geometry: SpatialMarkerGeometry): EditorSceneMarkerConfig['geometry'] {
  switch (geometry.kind) {
    case 'box':
      return {
        kind: 'box',
      };
    case 'point':
      return {
        kind: 'point',
        coordinateSpace: geometry.coordinateSpace,
        position: cloneVec3(geometry.position),
        ...(geometry.target ? { target: structuredClone(geometry.target) } : {}),
      };
    case 'object-bounds':
      return {
        kind: 'object-bounds',
        target: structuredClone(geometry.target),
      };
    case 'polyhedron':
      return {
        kind: 'polyhedron',
        coordinateSpace: geometry.coordinateSpace,
        vertices: geometry.vertices.map(cloneVec3),
        ...(geometry.faces ? { faces: geometry.faces.map(face => [...face]) } : {}),
      };
  }
}

function readSpatialMarkerTransformPosition(geometry: SpatialMarkerGeometry): EditorSceneVec3 {
  switch (geometry.kind) {
    case 'box':
      return cloneVec3(geometry.center);
    case 'point':
      return geometry.coordinateSpace === 'world' ? cloneVec3(geometry.position) : createVec3(0, 0, 0);
    case 'polyhedron':
      return createBoundsCenter(geometry.vertices);
    case 'object-bounds':
      return createVec3(0, 0, 0);
  }
}

function readSpatialMarkerTransformRotation(geometry: SpatialMarkerGeometry): EditorSceneVec3 {
  return geometry.kind === 'box' && geometry.rotation
    ? cloneVec3(geometry.rotation)
    : createVec3(0, 0, 0);
}

function readSpatialMarkerTransformScale(
  geometry: SpatialMarkerGeometry,
  fallback: EditorSceneVec3,
): EditorSceneVec3 {
  return geometry.kind === 'box'
    ? normalizeMarkerBoxSize(geometry.size)
    : cloneVec3(fallback);
}

function normalizeMarkerBoxSize(size: EditorSceneVec3): EditorSceneVec3 {
  return {
    x: Math.max(0.000001, Math.abs(size.x)),
    y: Math.max(0.000001, Math.abs(size.y)),
    z: Math.max(0.000001, Math.abs(size.z)),
  };
}

function rewriteMarkerRelationIds(
  relation: SpatialRelation,
  markerIdMap: ReadonlyMap<string, string>,
): SpatialRelation {
  return {
    ...cloneRelation(relation),
    from: rewriteMarkerRelationEndpoint(relation.from, markerIdMap),
    to: rewriteMarkerRelationEndpoint(relation.to, markerIdMap),
  };
}

function rewriteSpatialMarkerTargetRefs(
  marker: SpatialMarkerNode,
  markerIdMap: ReadonlyMap<string, string>,
): SpatialMarkerNode {
  return {
    ...cloneMarker(marker),
    ...(marker.target ? { target: rewriteMarkerTargetRef(marker.target, markerIdMap) } : {}),
    geometry: rewriteSpatialMarkerGeometryTargetRefs(marker.geometry, markerIdMap),
  };
}

function rewriteSpatialMarkerGeometryTargetRefs(
  geometry: SpatialMarkerGeometry,
  markerIdMap: ReadonlyMap<string, string>,
): SpatialMarkerGeometry {
  switch (geometry.kind) {
    case 'point':
      return {
        ...structuredClone(geometry),
        ...(geometry.target ? { target: rewriteMarkerTargetRef(geometry.target, markerIdMap) } : {}),
      };
    case 'object-bounds':
      return {
        ...structuredClone(geometry),
        target: rewriteMarkerTargetRef(geometry.target, markerIdMap),
      };
    case 'box':
    case 'polyhedron':
      return structuredClone(geometry);
  }
}

function rewriteMarkerTargetRef(
  target: SpatialMarkerTargetRef,
  markerIdMap: ReadonlyMap<string, string>,
): SpatialMarkerTargetRef {
  if (target.kind !== 'marker') return structuredClone(target);
  return {
    ...structuredClone(target),
    id: markerIdMap.get(target.id) ?? target.id,
  };
}

function rewriteMarkerRelationEndpoint(
  endpoint: SpatialRelationEndpoint,
  markerIdMap: ReadonlyMap<string, string>,
): SpatialRelationEndpoint {
  if (endpoint.kind !== 'marker') return { ...endpoint };
  return {
    ...endpoint,
    id: markerIdMap.get(endpoint.id) ?? endpoint.id,
  };
}

function collectEditorSceneGameObjectSubtreeIds(
  document: EditorSceneDocument,
  rootId: string,
): Set<string> {
  const deleteIds = new Set<string>([rootId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const gameObject of document.scene.gameObjects) {
      if (!gameObject.parentId || !deleteIds.has(gameObject.parentId) || deleteIds.has(gameObject.id)) continue;
      deleteIds.add(gameObject.id);
      changed = true;
    }
  }
  return deleteIds;
}

function isDeletedRelationEndpoint(endpoint: SpatialRelationEndpoint, deleteIds: ReadonlySet<string>): boolean {
  return (endpoint.kind === 'marker' || endpoint.kind === 'scene-object') && deleteIds.has(endpoint.id);
}

function createUniqueMarkerGameObjectId(baseId: string, existingIds: Set<string>): string {
  const safeBase = sanitizeMarkerGameObjectId(baseId) || 'marker';
  let index = 1;
  let candidate = `${safeBase}-marker`;
  while (existingIds.has(candidate)) {
    index += 1;
    candidate = `${safeBase}-marker-${index}`;
  }
  return candidate;
}

function sanitizeMarkerGameObjectId(value: string): string {
  return value.trim().replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '');
}

function readMarkerMetadataColor(value: unknown): EditorSceneMarkerConfig['color'] | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Record<string, unknown>;
  const r = readColorChannel(candidate.r);
  const g = readColorChannel(candidate.g);
  const b = readColorChannel(candidate.b);
  return r == null || g == null || b == null ? null : { r, g, b };
}

function readColorChannel(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return value >= 0 && value <= 1 ? value : null;
}

function cloneVec3(value: { x: number; y: number; z: number }): EditorSceneVec3 {
  return { x: value.x, y: value.y, z: value.z };
}

function isVec3Like(value: unknown): value is EditorSceneVec3 {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<EditorSceneVec3>;
  return typeof candidate.x === 'number'
    && typeof candidate.y === 'number'
    && typeof candidate.z === 'number';
}

function createVec3(x: number, y: number, z: number): EditorSceneVec3 {
  return { x, y, z };
}

function addVec3(left: EditorSceneVec3, right: EditorSceneVec3): EditorSceneVec3 {
  return {
    x: left.x + right.x,
    y: left.y + right.y,
    z: left.z + right.z,
  };
}

function createBoundsCenter(points: readonly EditorSceneVec3[]): EditorSceneVec3 {
  if (points.length === 0) return createVec3(0, 0, 0);
  const min = {
    x: Math.min(...points.map(point => point.x)),
    y: Math.min(...points.map(point => point.y)),
    z: Math.min(...points.map(point => point.z)),
  };
  const max = {
    x: Math.max(...points.map(point => point.x)),
    y: Math.max(...points.map(point => point.y)),
    z: Math.max(...points.map(point => point.z)),
  };
  return {
    x: (min.x + max.x) / 2,
    y: (min.y + max.y) / 2,
    z: (min.z + max.z) / 2,
  };
}

function withEditorSceneMarkerGraph(
  document: EditorSceneDocument,
  markerGraph: SpatialMarkerGraph,
): EditorSceneDocument {
  return {
    ...document,
    scene: {
      ...document.scene,
      markerGraph,
    },
  };
}

function upsertMarker(graph: SpatialMarkerGraph, marker: SpatialMarkerNode): SpatialMarkerGraph {
  const nextMarker = cloneMarker(marker);
  const replaced = graph.markers.some(candidate => candidate.id === nextMarker.id);
  return {
    ...graph,
    markers: replaced
      ? graph.markers.map(candidate => candidate.id === nextMarker.id ? nextMarker : candidate)
      : [...graph.markers, nextMarker],
  };
}

function updateMarker(
  graph: SpatialMarkerGraph,
  markerId: string,
  patch: Partial<Omit<SpatialMarkerNode, 'id'>>,
): SpatialMarkerGraph {
  let changed = false;
  const markers = graph.markers.map((marker) => {
    if (marker.id !== markerId) return marker;
    changed = true;
    return cloneMarker({
      ...marker,
      ...patch,
      id: marker.id,
    });
  });
  return changed ? { ...graph, markers } : graph;
}

function deleteMarker(graph: SpatialMarkerGraph, markerId: string): SpatialMarkerGraph {
  return {
    ...graph,
    markers: graph.markers.filter(marker => marker.id !== markerId),
    relations: graph.relations.filter(relation => (
      !isMarkerEndpoint(relation.from, markerId)
        && !isMarkerEndpoint(relation.to, markerId)
    )),
  };
}

function upsertRelation(graph: SpatialMarkerGraph, relation: SpatialRelation): SpatialMarkerGraph {
  const nextRelation = cloneRelation(relation);
  const replaced = graph.relations.some(candidate => candidate.id === nextRelation.id);
  return {
    ...graph,
    relations: replaced
      ? graph.relations.map(candidate => candidate.id === nextRelation.id ? nextRelation : candidate)
      : [...graph.relations, nextRelation],
  };
}

function isEditorSceneMarkerGraphCommandSupported(
  document: EditorSceneDocument,
  command: PlayableLocalEditorMarkerGraphCommand,
): boolean {
  switch (command.type) {
    case 'marker.create-box':
      return command.marker.geometry.kind === 'box';
    case 'marker-type.create':
      return isMarkerTypeDefinitionValid(command.definition)
        && !getEditorSceneMarkerTypeCatalog(document).some(definition => definition.type === command.definition.type);
    case 'marker-type.update':
      return !!command.typeId.trim()
        && getEditorSceneMarkerTypeCatalog(document).some(definition => definition.type === command.typeId);
    case 'marker-type.delete': {
      const typeId = command.typeId.trim();
      if (!typeId || isBuiltInMarkerType(typeId)) return false;
      const graph = getEditorSceneMarkerGraph(document);
      return !graph.markers.some(marker => marker.markerType === typeId)
        && readMarkerTypeOverrides(graph).some(definition => definition.type === typeId);
    }
    default:
      return true;
  }
}

function createEditorSceneMarkerGraphPatchLabel(command: PlayableLocalEditorMarkerGraphCommand): string {
  switch (command.type) {
    case 'marker.create-box':
      return `Create marker ${command.marker.label}`;
    case 'marker.update':
      return `Update marker ${command.markerId}`;
    case 'marker.delete':
      return `Delete marker ${command.markerId}`;
    case 'relation.create':
      return `Create relation ${command.relation.type}`;
    case 'relation.delete':
      return `Delete relation ${command.relationId}`;
    case 'marker.sync-from-scene':
      return 'Sync marker graph';
    case 'marker-type.create':
      return `Create marker type ${command.definition.label}`;
    case 'marker-type.update':
      return `Update marker type ${command.typeId}`;
    case 'marker-type.delete':
      return `Delete marker type ${command.typeId}`;
  }
}

function getEditorSceneMarkerGraphPatchSelection(command: PlayableLocalEditorMarkerGraphCommand): {
  changedId?: string;
  changedIds?: string[];
  selectId?: string | null;
} {
  switch (command.type) {
    case 'marker.create-box':
      return { changedId: command.marker.id, changedIds: [command.marker.id], selectId: command.marker.id };
    case 'marker.update':
    case 'marker.delete':
      return { changedId: command.markerId, changedIds: [command.markerId] };
    case 'relation.create':
      return { changedIds: [command.relation.from.id, command.relation.to.id] };
    case 'relation.delete':
    case 'marker.sync-from-scene':
    case 'marker-type.create':
    case 'marker-type.update':
    case 'marker-type.delete':
      return {};
  }
}

function isMarkerSceneObjectTargetValid(marker: SpatialMarkerNode, objectIds: Set<string>): boolean {
  if (!isTargetRefValid(marker.target, objectIds)) return false;
  switch (marker.geometry.kind) {
    case 'object-bounds':
      return isTargetRefValid(marker.geometry.target, objectIds);
    case 'point':
      return isTargetRefValid(marker.geometry.target, objectIds);
    case 'box':
    case 'polyhedron':
      return true;
  }
}

function isTargetRefValid(target: SpatialMarkerTargetRef | undefined, objectIds: Set<string>): boolean {
  return !target || target.kind !== 'scene-object' || objectIds.has(target.id);
}

function isRelationEndpointValid(
  endpoint: SpatialRelationEndpoint,
  objectIds: Set<string>,
  markerIds: Set<string>,
): boolean {
  if (endpoint.kind === 'marker') return markerIds.has(endpoint.id);
  if (endpoint.kind === 'scene-object') return objectIds.has(endpoint.id);
  return true;
}

function isMarkerEndpoint(endpoint: SpatialRelationEndpoint, markerId: string): boolean {
  return endpoint.kind === 'marker' && endpoint.id === markerId;
}

function cloneMarkerGraphCommand(command: PlayableLocalEditorMarkerGraphCommand): PlayableLocalEditorMarkerGraphCommand {
  const nextCommand = structuredClone(command);
  if (nextCommand.type === 'marker.create-box') {
    nextCommand.marker = cloneMarker(nextCommand.marker);
  }
  if (nextCommand.type === 'marker.update') {
    const { spatial: _spatial, ...patch } = nextCommand.patch;
    nextCommand.patch = patch;
  }
  return nextCommand;
}

function cloneMarker(marker: SpatialMarkerNode): SpatialMarkerNode {
  const { spatial: _spatial, ...authoredMarker } = structuredClone(marker);
  return authoredMarker;
}

function cloneRelation(relation: SpatialRelation): SpatialRelation {
  return structuredClone(relation);
}

function cloneMarkerTypeDefinition(definition: SpatialMarkerTypeDefinition): SpatialMarkerTypeDefinition {
  return structuredClone(definition);
}

function cloneBuiltInMarkerTypeDefinition(definition: SpatialMarkerTypeDefinition): SpatialMarkerTypeDefinition {
  return {
    ...cloneMarkerTypeDefinition(definition),
    metadata: {
      ...(definition.metadata ?? {}),
      builtIn: true,
    },
  };
}

function mergeMarkerTypeDefinition(
  builtIn: SpatialMarkerTypeDefinition | null,
  override: SpatialMarkerTypeDefinition,
): SpatialMarkerTypeDefinition {
  const base = builtIn ?? null;
  return {
    ...(base ?? {}),
    ...cloneMarkerTypeDefinition(override),
    type: override.type,
    label: override.label || base?.label || override.type,
    metadata: {
      ...(base?.metadata ?? {}),
      ...(override.metadata ?? {}),
      builtIn: base?.metadata?.builtIn === true,
    },
  };
}

function createMarkerType(
  graph: SpatialMarkerGraph,
  definition: SpatialMarkerTypeDefinition,
): SpatialMarkerGraph {
  if (!isMarkerTypeDefinitionValid(definition)) return graph;
  if (getBuiltInMarkerType(definition.type)) return graph;
  const overrides = readMarkerTypeOverrides(graph);
  if (overrides.some(candidate => candidate.type === definition.type)) return graph;
  return writeMarkerTypeOverrides(graph, [
    ...overrides,
    createAuthoredMarkerTypeDefinition(definition, false),
  ]);
}

function updateMarkerType(
  graph: SpatialMarkerGraph,
  typeId: string,
  patch: Partial<Omit<SpatialMarkerTypeDefinition, 'type'>>,
): SpatialMarkerGraph {
  const normalizedTypeId = typeId.trim();
  if (!normalizedTypeId) return graph;
  const builtIn = getBuiltInMarkerType(normalizedTypeId);
  const overrides = readMarkerTypeOverrides(graph);
  const authored = overrides.find(definition => definition.type === normalizedTypeId) ?? null;
  if (!builtIn && !authored) return graph;
  const base = authored ?? builtIn;
  if (!base) return graph;
  const nextDefinition = createAuthoredMarkerTypeDefinition({
    ...base,
    ...patch,
    type: normalizedTypeId,
    label: typeof patch.label === 'string' && patch.label.trim()
      ? patch.label.trim()
      : base.label || normalizedTypeId,
  }, !!builtIn);
  return writeMarkerTypeOverrides(graph, [
    ...overrides.filter(definition => definition.type !== normalizedTypeId),
    nextDefinition,
  ]);
}

function deleteMarkerType(graph: SpatialMarkerGraph, typeId: string): SpatialMarkerGraph {
  const normalizedTypeId = typeId.trim();
  if (!normalizedTypeId || isBuiltInMarkerType(normalizedTypeId)) return graph;
  if (graph.markers.some(marker => marker.markerType === normalizedTypeId)) return graph;
  const overrides = readMarkerTypeOverrides(graph);
  const nextOverrides = overrides.filter(definition => definition.type !== normalizedTypeId);
  return nextOverrides.length === overrides.length
    ? graph
    : writeMarkerTypeOverrides(graph, nextOverrides);
}

function createAuthoredMarkerTypeDefinition(
  definition: SpatialMarkerTypeDefinition,
  overridesBuiltIn: boolean,
): SpatialMarkerTypeDefinition {
  return {
    type: definition.type.trim(),
    label: definition.label.trim() || definition.type.trim(),
    ...(definition.kind ? { kind: definition.kind } : {}),
    ...(definition.description !== undefined ? { description: definition.description } : {}),
    ...(definition.defaultTags ? { defaultTags: [...definition.defaultTags] } : {}),
    metadata: {
      ...(definition.metadata ?? {}),
      builtIn: false,
      ...(overridesBuiltIn ? { overridesBuiltIn: true } : {}),
    },
  };
}

function readMarkerTypeOverrides(graph: SpatialMarkerGraph | null | undefined): SpatialMarkerTypeDefinition[] {
  const value = graph?.metadata?.markerTypes;
  if (!Array.isArray(value)) return [];
  return value
    .map(readMarkerTypeDefinition)
    .filter((definition): definition is SpatialMarkerTypeDefinition => !!definition);
}

function writeMarkerTypeOverrides(
  graph: SpatialMarkerGraph,
  markerTypes: readonly SpatialMarkerTypeDefinition[],
): SpatialMarkerGraph {
  const metadata = graph.metadata ? structuredClone(graph.metadata) : {};
  if (markerTypes.length === 0) delete metadata.markerTypes;
  else metadata.markerTypes = markerTypes.map(cloneMarkerTypeDefinition) as any;
  return {
    ...graph,
    metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
  };
}

function readMarkerTypeDefinition(value: unknown): SpatialMarkerTypeDefinition | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Partial<SpatialMarkerTypeDefinition>;
  if (typeof candidate.type !== 'string' || !candidate.type.trim()) return null;
  if (typeof candidate.label !== 'string' || !candidate.label.trim()) return null;
  return createAuthoredMarkerTypeDefinition({
    type: candidate.type.trim(),
    label: candidate.label.trim(),
    ...(typeof candidate.kind === 'string' && candidate.kind ? { kind: candidate.kind } : {}),
    ...(typeof candidate.description === 'string' ? { description: candidate.description } : {}),
    ...(Array.isArray(candidate.defaultTags) ? { defaultTags: candidate.defaultTags.filter(tag => typeof tag === 'string') } : {}),
    ...(candidate.metadata && typeof candidate.metadata === 'object' ? { metadata: candidate.metadata } : {}),
  }, candidate.metadata?.overridesBuiltIn === true);
}

function isMarkerTypeDefinitionValid(definition: SpatialMarkerTypeDefinition): boolean {
  return !!definition.type.trim() && !!definition.label.trim();
}

function getBuiltInMarkerType(typeId: string): SpatialMarkerTypeDefinition | null {
  return EDITOR_SCENE_MARKER_TYPE_CATALOG.find(definition => definition.type === typeId) ?? null;
}

function isBuiltInMarkerType(typeId: string): boolean {
  return !!getBuiltInMarkerType(typeId);
}

function areMarkerGraphsEqual(left: SpatialMarkerGraph, right: SpatialMarkerGraph): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}
