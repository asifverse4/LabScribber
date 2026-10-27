import { describe, it, expect, beforeEach } from 'vitest';
import { saveAutosaveSnapshot, loadAutosaveSnapshot, clearAutosaveSnapshot } from '../src/utils/autosave';
import { SpectrumData } from '../src/types';

function makeDataset(overrides: Partial<SpectrumData> = {}): SpectrumData {
  return {
    id: 'ds1',
    name: 'Cu-QD_pH7',
    technique: 'UV-Vis',
    x_orig: [200, 300, 400],
    y_orig: [0.1, 0.5, 0.2],
    x: [200, 300, 400],
    y_processed: [0.1, 0.5, 0.2],
    color: '#000',
    visible: true,
    lineWidth: 1,
    lineStyle: 'solid',
    marker: 'none',
    markerSize: 4,
    peaks: [],
    integrals: [],
    baseline: null,
    fitResult: null,
    fitComponents: null,
    fitResiduals: null,
    yError: null,
    significanceAnnotations: null,
    fitPeakStats: null,
    fitGoodnessOfFit: null,
    isTauc: false,
    taucData: null,
    jobsData: null,
    undoStack: ['stack-entry-1', 'stack-entry-2'] as any,
    redoStack: ['redo-entry'] as any,
    history: ['[00:00:00] Imported JCAMP-DX: "a.jdx", 3 points.'],
    ...overrides,
  };
}

beforeEach(() => {
  localStorage.clear();
});

describe('saveAutosaveSnapshot / loadAutosaveSnapshot', () => {
  it('returns false and saves nothing for an empty dataset list', () => {
    const ok = saveAutosaveSnapshot([], { isDark: true }, null);
    expect(ok).toBe(false);
    expect(loadAutosaveSnapshot()).toBeNull();
  });

  it('round-trips datasets and appState', () => {
    const sd = makeDataset();
    const ok = saveAutosaveSnapshot([sd], { isDark: true, xLabel: 'Wavelength (nm)' }, 'ds1');
    expect(ok).toBe(true);

    const loaded = loadAutosaveSnapshot();
    expect(loaded).not.toBeNull();
    expect(loaded!.datasets).toHaveLength(1);
    expect(loaded!.datasets[0].name).toBe('Cu-QD_pH7');
    expect(loaded!.appState.isDark).toBe(true);
    expect(loaded!.appState.xLabel).toBe('Wavelength (nm)');
    expect(loaded!.selectedDatasetId).toBe('ds1');
  });

  it('strips undo/redo stacks to keep the snapshot small', () => {
    const sd = makeDataset();
    saveAutosaveSnapshot([sd], {}, 'ds1');
    const loaded = loadAutosaveSnapshot();
    expect(loaded!.datasets[0].redoStack).toEqual([]);
    expect(loaded!.datasets[0].undoStack).toHaveLength(1);
  });

  it('preserves the processing history log', () => {
    const sd = makeDataset();
    saveAutosaveSnapshot([sd], {}, 'ds1');
    const loaded = loadAutosaveSnapshot();
    expect(loaded!.datasets[0].history).toEqual(sd.history);
  });

  it('records a valid ISO timestamp', () => {
    const sd = makeDataset();
    saveAutosaveSnapshot([sd], {}, 'ds1');
    const loaded = loadAutosaveSnapshot();
    expect(() => new Date(loaded!.savedAt).toISOString()).not.toThrow();
  });

  it('skips saving a session larger than the size guard', () => {
    // A huge dataset that will blow past the ~4.5MB guard once stringified.
    const huge = makeDataset({
      x_orig: new Array(1_000_000).fill(0).map((_, i) => i),
      y_orig: new Array(1_000_000).fill(0).map(() => Math.random()),
    });
    const ok = saveAutosaveSnapshot([huge], {}, huge.id);
    expect(ok).toBe(false);
    expect(loadAutosaveSnapshot()).toBeNull();
  });
});

describe('loadAutosaveSnapshot', () => {
  it('returns null when nothing has been saved', () => {
    expect(loadAutosaveSnapshot()).toBeNull();
  });

  it('returns null for corrupted JSON rather than throwing', () => {
    localStorage.setItem('labscribber-autosave-v1', '{not valid json');
    expect(() => loadAutosaveSnapshot()).not.toThrow();
    expect(loadAutosaveSnapshot()).toBeNull();
  });

  it('returns null when the stored payload has no datasets', () => {
    localStorage.setItem('labscribber-autosave-v1', JSON.stringify({ version: '1.0.0', datasets: [] }));
    expect(loadAutosaveSnapshot()).toBeNull();
  });
});

describe('clearAutosaveSnapshot', () => {
  it('removes a previously saved snapshot', () => {
    const sd = makeDataset();
    saveAutosaveSnapshot([sd], {}, 'ds1');
    expect(loadAutosaveSnapshot()).not.toBeNull();
    clearAutosaveSnapshot();
    expect(loadAutosaveSnapshot()).toBeNull();
  });

  it('does not throw when nothing was saved', () => {
    expect(() => clearAutosaveSnapshot()).not.toThrow();
  });
});
