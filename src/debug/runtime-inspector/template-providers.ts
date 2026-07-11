import type { Game } from '../../core/Game';
import { registerRuntimeInspectorProviders } from './providers';

type AgentSessionMetadata = Record<string, unknown>;

export function registerTemplateRuntimeInspectorProviders(
  _getGame: () => Game | null,
): () => void {
  return registerRuntimeInspectorProviders({
    buildIdentity: () => {
      const metadata = readAgentSessionMetadata();
      const commit = readString(metadata.projectGitSha);
      const branch = readString(metadata.projectBranch);
      const worktree = readString(metadata.projectRoot) ?? readString(metadata.paTemplateRoot);
      return {
        mode: import.meta.env.MODE,
        commit,
        branch,
        worktree,
        buildId: readString(import.meta.env.VITE_BUILD_ID) ?? commit,
        dirty: readBoolean(metadata.projectDirty),
      };
    },
  });
}

function readAgentSessionMetadata(): AgentSessionMetadata {
  if (
    typeof __FPS_EDITOR_AGENT_SESSION_METADATA__ === 'object'
    && __FPS_EDITOR_AGENT_SESSION_METADATA__ !== null
  ) {
    return __FPS_EDITOR_AGENT_SESSION_METADATA__;
  }
  return {};
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function readBoolean(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null;
}
