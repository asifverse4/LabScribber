import { SpectrumData } from '../types';

/**
 * Autosave / crash recovery.
 *
 * Before this, the only persistence in LabScribber was the manual "Save
 * Session" button, which exports a `.lsb` file the user has to remember to
 * click. Everything else — peak picks, fits, batch runs, undo stacks —
 * lived purely in React state. A refresh, an accidental tab close, or a
 * crash caught by <ErrorBoundary /> (whose recovery message already
 * promised "an auto-saved session, if one exists") lost all of it.
 *
 * This module writes a lightweight, debounced snapshot of the current
 * session to localStorage as the user works, and exposes it so the app can
 * offer to restore it on next load. It is deliberately a best-effort safety
 * net, not a replacement for `.lsb` export:
 *   - Never throws — storage can be full, disabled (private browsing), or
 *     simply absent; a failed autosave should never interrupt real work.
 *   - Skips saving sessions too large for typical browser storage quotas
 *     rather than silently truncating data.
 *   - Strips undo/redo history (same trick `.lsb` export already uses) to
 *     keep the snapshot small.
 */

const AUTOSAVE_KEY = 'labscribber-autosave-v1';
const AUTOSAVE_VERSION = '1.0.0';
const MAX_AUTOSAVE_BYTES = 4_500_000; // stay comfortably under the ~5MB/origin localStorage quota most browsers enforce

export interface AutosaveAppState {
  [key: string]: unknown;
}

export interface AutosaveSnapshot {
  version: string;
  savedAt: string;
  appState: AutosaveAppState;
  datasets: SpectrumData[];
  selectedDatasetId: string | null;
}

function stripForAutosave(datasets: SpectrumData[]): SpectrumData[] {
  return datasets.map(d => ({
    ...d,
    undoStack: [d.y_processed],
    redoStack: [],
  }));
}

/**
 * Best-effort save. Returns true if the snapshot was written, false if it
 * was skipped or failed for any reason (never throws).
 */
export function saveAutosaveSnapshot(
  datasets: SpectrumData[],
  appState: AutosaveAppState,
  selectedDatasetId: string | null
): boolean {
  if (!datasets || datasets.length === 0) return false;
  try {
    const snapshot: AutosaveSnapshot = {
      version: AUTOSAVE_VERSION,
      savedAt: new Date().toISOString(),
      appState,
      datasets: stripForAutosave(datasets),
      selectedDatasetId,
    };
    const json = JSON.stringify(snapshot);
    if (json.length > MAX_AUTOSAVE_BYTES) {
      console.warn('LabScribber autosave skipped: session is too large for browser storage. Use "Save Session" to export a .lsb file instead.');
      return false;
    }
    localStorage.setItem(AUTOSAVE_KEY, json);
    return true;
  } catch (e) {
    // QuotaExceededError, storage disabled, etc. — autosave is a safety
    // net, not something that should ever interrupt the user's work.
    console.warn('LabScribber autosave failed:', e);
    return false;
  }
}

/** Reads back the last autosaved snapshot, or null if none exists / it's corrupted. */
export function loadAutosaveSnapshot(): AutosaveSnapshot | null {
  try {
    const raw = localStorage.getItem(AUTOSAVE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.datasets) || parsed.datasets.length === 0) {
      return null;
    }
    return parsed as AutosaveSnapshot;
  } catch {
    return null;
  }
}

/** Clears the stored autosave (e.g. after the user restores or dismisses it). */
export function clearAutosaveSnapshot(): void {
  try {
    localStorage.removeItem(AUTOSAVE_KEY);
  } catch {
    // ignore — nothing meaningful to do if storage is unavailable
  }
}
