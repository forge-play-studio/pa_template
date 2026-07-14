import type { VfxDiagnosticsSnapshot, VfxRejectionCode } from './types.ts';

export type VfxDiagnosticsListener = (snapshot: VfxDiagnosticsSnapshot) => void;

export class VfxDiagnostics {
  private readonly listeners = new Set<VfxDiagnosticsListener>();
  private globalPeakActive = 0;
  private globalRejected = 0;
  private lastError: string | undefined;

  subscribe(listener: VfxDiagnosticsListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  hasListeners(): boolean {
    return this.listeners.size > 0;
  }

  recordActive(active: number): void {
    this.globalPeakActive = Math.max(this.globalPeakActive, active);
  }

  recordRejection(_code: VfxRejectionCode): void {
    this.globalRejected += 1;
  }

  recordError(error: unknown): void {
    this.lastError = formatVfxError(error);
  }

  getPeakActive(): number {
    return this.globalPeakActive;
  }

  getRejected(): number {
    return this.globalRejected;
  }

  getLastError(): string | undefined {
    return this.lastError;
  }

  emit(snapshot: VfxDiagnosticsSnapshot): void {
    for (const listener of this.listeners) {
      try {
        listener(snapshot);
      } catch (error) {
        console.warn('[VfxDiagnostics] listener failed', error);
      }
    }
  }
}

export function formatVfxError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
