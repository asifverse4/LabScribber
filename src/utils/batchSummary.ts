import { BatchSummaryRow } from '../types';

/**
 * Builds a long-format CSV from a Batch Processor results summary: one row
 * per fitted peak, with dataset-level metadata repeated on each row so the
 * file can be dropped straight into Origin/GraphPad/pandas for downstream
 * stats. Datasets with no peaks (or where fitting wasn't applied) still get
 * a single row with blank peak columns, so row count always covers every
 * dataset that was processed.
 */
export function buildBatchSummaryCSV(rows: BatchSummaryRow[]): string {
  const header = [
    'Dataset', 'Technique', 'N_Points', 'Peaks_Detected', 'Fit_Applied', 'Fit_Profile',
    'R2', 'Chi2_reduced', 'RMSE', 'Peak_Index', 'Center', 'Center_SE',
    'Amplitude', 'Amplitude_SE', 'FWHM', 'FWHM_SE', 'Area', 'Area_SE', 'Eta_Voigt', 'Eta_SE',
  ].join(',');

  const lines: string[] = [header];
  for (const row of rows) {
    const base = [
      `"${row.name.replace(/"/g, '""')}"`,
      row.technique,
      row.nPoints,
      row.peaksDetected,
      row.fitApplied ? 'true' : 'false',
      row.fitProfile ?? '',
      row.goodnessOfFit?.r2 ?? '',
      row.goodnessOfFit?.chi2 ?? '',
      row.goodnessOfFit?.rmse ?? '',
    ];
    if (row.peaks && row.peaks.length > 0) {
      for (const p of row.peaks) {
        lines.push([
          ...base,
          p.index, p.center, p.centerSE ?? '',
          p.amplitude, p.amplitudeSE ?? '',
          p.fwhm, p.fwhmSE ?? '',
          p.area, p.areaSE ?? '',
          p.eta ?? '', p.etaSE ?? '',
        ].join(','));
      }
    } else {
      lines.push([...base, '', '', '', '', '', '', '', '', '', ''].join(','));
    }
  }

  return lines.join('\n');
}
