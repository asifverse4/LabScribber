import { describe, it, expect } from 'vitest';
import { buildBatchSummaryCSV } from '../src/utils/batchSummary';
import { BatchSummaryRow } from '../src/types';

describe('buildBatchSummaryCSV', () => {
  it('produces a header row followed by one row per dataset with no peaks', () => {
    const rows: BatchSummaryRow[] = [
      { datasetId: 'a', name: 'Sample A', technique: 'UV-Vis', nPoints: 200, peaksDetected: 0, fitApplied: false },
      { datasetId: 'b', name: 'Sample B', technique: 'FTIR', nPoints: 400, peaksDetected: 0, fitApplied: false },
    ];
    const csv = buildBatchSummaryCSV(rows);
    const lines = csv.split('\n');
    expect(lines).toHaveLength(3); // header + 2 rows
    expect(lines[0]).toContain('Dataset');
    expect(lines[0]).toContain('Peak_Index');
    expect(lines[1]).toContain('"Sample A"');
    expect(lines[1]).toContain('UV-Vis');
    expect(lines[2]).toContain('"Sample B"');
  });

  it('expands one row per fitted peak (long format)', () => {
    const rows: BatchSummaryRow[] = [
      {
        datasetId: 'a',
        name: 'Sample A',
        technique: 'UV-Vis',
        nPoints: 200,
        peaksDetected: 2,
        fitApplied: true,
        fitProfile: 'Gaussian',
        goodnessOfFit: { r2: 0.998, chi2: 0.001, rmse: 0.002, dof: 194, uncertaintyAvailable: true },
        peaks: [
          { index: 0, center: 350, amplitude: 1.2, fwhm: 20, area: 30, centerSE: 0.1, amplitudeSE: 0.02, fwhmSE: 0.5, areaSE: 0.8 },
          { index: 1, center: 420, amplitude: 0.8, fwhm: 15, area: 18, centerSE: 0.15, amplitudeSE: 0.01, fwhmSE: 0.4, areaSE: 0.6 },
        ],
      },
    ];
    const csv = buildBatchSummaryCSV(rows);
    const lines = csv.split('\n');
    expect(lines).toHaveLength(3); // header + 2 peak rows
    expect(lines[1]).toContain('"Sample A"');
    expect(lines[1]).toContain('350');
    expect(lines[1]).toContain('0.1'); // centerSE
    expect(lines[2]).toContain('420');
    expect(lines[2]).toContain('true'); // Fit_Applied
  });

  it('includes Voigt eta columns when present', () => {
    const rows: BatchSummaryRow[] = [
      {
        datasetId: 'a',
        name: 'VoigtSample',
        technique: 'Raman',
        nPoints: 100,
        peaksDetected: 1,
        fitApplied: true,
        fitProfile: 'Voigt',
        goodnessOfFit: { r2: 0.99, chi2: 0.01, rmse: 0.01, dof: 96, uncertaintyAvailable: true },
        peaks: [{ index: 0, center: 500, amplitude: 1, fwhm: 10, area: 15, eta: 0.4, etaSE: 0.05 }],
      },
    ];
    const csv = buildBatchSummaryCSV(rows);
    expect(csv).toContain('0.4');
    expect(csv).toContain('0.05');
  });

  it('escapes double quotes in dataset names', () => {
    const rows: BatchSummaryRow[] = [
      { datasetId: 'a', name: 'Sample "X"', technique: 'UV-Vis', nPoints: 10, peaksDetected: 0, fitApplied: false },
    ];
    const csv = buildBatchSummaryCSV(rows);
    expect(csv).toContain('"Sample ""X"""');
  });

  it('returns just the header for an empty row list', () => {
    const csv = buildBatchSummaryCSV([]);
    expect(csv.split('\n')).toHaveLength(1);
    expect(csv).toContain('Dataset');
  });
});
