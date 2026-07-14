import { defineFpsGameEditorProject } from '@fps-games/editor/playable-sdk';

export const editor = defineFpsGameEditorProject({
  projectId: 'standard-project',
  projectName: 'Standard Project',
  source: {
    editorScene: 'src/config/editor-scene.json',
    runtimeScene: 'src/config/scene.json',
  },
  assets: {
    importedDir: 'src/assets/imported',
    generatedDir: 'src/assets/generated',
    publicBase: '/assets/imported',
  },
});

export default Object.freeze({ editor, plugins: Object.freeze([]) });
