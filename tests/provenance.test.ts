import { describe, it, expect } from 'vitest';
import {
  generateDatasetProvenance,
  generateProvenanceLog,
  provenanceLogToJSON,
  provenanceLogToCSV,
} from '../src/utils/provenance';
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
    undoStack: [],
    redoStack: [],
    history: [],
    ...overrides,
  };
}

describe('generateDatasetProvenance', () => {
  it('computes a stable checksum for identical raw data', () => {
    const sd1 = makeDataset();
    const sd2 = makeDataset({ id: 'different-id', name: 'different-name' });
    const p1 = generateDatasetProvenance(sd1);
    const p2 = generateDatasetProvenance(sd2);
    expect(p1.dataChecksum).toBe(p2.dataChecksum);
  });

  it('produces a different checksum when the underlying data changes', () => {
    const sd1 = makeDataset();
    const sd2 = makeDataset({ y_orig: [0.1, 0.6, 0.2] });
    const p1 = generateDatasetProvenance(sd1);
    const p2 = generateDatasetProvenance(sd2);
    expect(p1.dataChecksum).not.toBe(p2.dataChecksum);
  });

  it('parses timestamp and text out of history entries', () => {
    const sd = makeDataset({ history: ['[10:15:32] Imported JCAMP-DX: "sample.jdx", 512 points.'] });
    const p = generateDatasetProvenance(sd);
    expect(p.events).toHaveLength(1);
    expect(p.events[0].timestamp).toBe('10:15:32');
    expect(p.events[0].raw).toBe('Imported JCAMP-DX: "sample.jdx", 512 points.');
    expect(p.events[0].category).toBe('ingestion');
  });

  it('categorizes processing, peak-analysis, fitting, and statistics events', () => {
    const sd = makeDataset({
      history: [
        '[00:00:01] Applied multi-step processing: (Smoothing: None, Baseline: None, Norm: None)',
        '[00:00:02] Auto-detected 3 peaks with prominence >= 0.05.',
        '[00:00:03] Fit 3 Gaussian components. R\u00b2=0.99, \u03c7\u00b2_r=1e-3, RMSE=1e-3.',
        "[00:00:04] Welch's t-test: t=1.0, df=5.0, p=0.05 (ns).",
      ],
    });
    const p = generateDatasetProvenance(sd);
    expect(p.events.map(e => e.category)).toEqual(['processing', 'peak-analysis', 'fitting', 'statistics']);
  });

  it('reflects current dataset state (baseline/fit/peaks/integrals)', () => {
    const sd = makeDataset({
      baseline: [0, 0, 0],
      fitResult: [0.1, 0.5, 0.2],
      peaks: [{ id: 'p1', x: 300, y: 0.5, label: '', confidence: 1, dx: 0, dy: 0 }],
      integrals: [{ id: 'i1', xmin: 250, xmax: 350, area: 10 }],
    });
    const p = generateDatasetProvenance(sd);
    expect(p.currentState).toEqual({
      baselineApplied: true,
      fitApplied: true,
      peaksCount: 1,
      integralsCount: 1,
    });
  });

  it('reports the x range correctly', () => {
    const sd = makeDataset({ x: [400, 200, 300] });
    const p = generateDatasetProvenance(sd);
    expect(p.xRange).toEqual([200, 400]);
  });
});

describe('generateProvenanceLog', () => {
  it('wraps multiple datasets with software id and export timestamp', () => {
    const sd1 = makeDataset({ id: 'a', name: 'A' });
    const sd2 = makeDataset({ id: 'b', name: 'B' });
    const log = generateProvenanceLog([sd1, sd2]);
    expect(log.software).toContain('LabScribber');
    expect(log.datasetCount).toBe(2);
    expect(log.datasets.map(d => d.name)).toEqual(['A', 'B']);
    expect(() => new Date(log.exportedAt).toISOString()).not.toThrow();
  });
});

describe('provenanceLogToJSON', () => {
  it('round-trips through JSON.parse without loss', () => {
    const sd = makeDataset({ history: ['[00:00:00] Imported JCAMP-DX: "a.jdx", 10 points.'] });
    const log = generateProvenanceLog([sd]);
    const json = provenanceLogToJSON(log);
    const parsed = JSON.parse(json);
    expect(parsed.datasets[0].name).toBe('Cu-QD_pH7');
    expect(parsed.datasets[0].events[0].category).toBe('ingestion');
  });
});

describe('provenanceLogToCSV', () => {
  it('emits one row per event with dataset metadata repeated', () => {
    const sd = makeDataset({
      history: [
        '[00:00:01] Imported JCAMP-DX: "a.jdx", 10 points.',
        '[00:00:02] Auto-detected 2 peaks with prominence >= 0.05.',
      ],
    });
    const log = generateProvenanceLog([sd]);
    const csv = provenanceLogToCSV(log);
    const lines = csv.split('\n');
    expect(lines).toHaveLength(3); // header + 2 events
    expect(lines[0]).toContain('Data_Checksum');
    expect(lines[1]).toContain('"Cu-QD_pH7"');
    expect(lines[1]).toContain('ingestion');
    expect(lines[2]).toContain('peak-analysis');
  });

  it('emits a single blank-event row for a dataset with no history', () => {
    const sd = makeDataset({ history: [] });
    const log = generateProvenanceLog([sd]);
    const csv = provenanceLogToCSV(log);
    expect(csv.split('\n')).toHaveLength(2); // header + 1 row
  });

  it('escapes double quotes in dataset names and descriptions', () => {
    const sd = makeDataset({ name: 'Sample "X"', history: ['[00:00:01] Note "quoted" text.'] });
    const log = generateProvenanceLog([sd]);
    const csv = provenanceLogToCSV(log);
    expect(csv).toContain('"Sample ""X"""');
    expect(csv).toContain('""quoted""');
  });
});
