// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { generateDatasetMethods, generateMethodsText } from '../src/utils/methodsGenerator';
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

describe('generateDatasetMethods', () => {
  it('produces a baseline intro with no processing steps recorded', () => {
    const sd = makeDataset({ history: [] });
    const text = generateDatasetMethods(sd);
    expect(text).toContain('UV-Vis data for "Cu-QD_pH7"');
    expect(text).toContain('No further processing steps');
  });

  it('describes JCAMP-DX import', () => {
    const sd = makeDataset({ history: ['[10:00:00] Imported JCAMP-DX: "sample.jdx", 512 points.'] });
    const text = generateDatasetMethods(sd);
    expect(text).toContain('imported from a JCAMP-DX file ("sample.jdx", 512 data points)');
  });

  it('describes multi-step processing with smoothing, baseline, and normalization', () => {
    const sd = makeDataset({
      history: [
        '[10:00:01] Applied multi-step processing: (Smoothing: Savitzky-Golay (window=9, poly=2), Baseline: ALS (\u03bb=1.0e+4, p=0.01, iter=8), Norm: min-max [0,1])',
      ],
    });
    const text = generateDatasetMethods(sd);
    expect(text).toContain('Savitzky\u2013Golay filter');
    expect(text).toContain('window=9, poly=2');
    expect(text).toContain('asymmetric least squares (ALS) algorithm');
    expect(text).toContain('normalized (min-max [0,1])');
  });

  it('describes batch processing with source trace', () => {
    const sd = makeDataset({
      history: [
        '[10:00:02] Batch processed: (Smooth: Moving Average (window=5), Baseline: Shirley, Norm: None, BaseSrc: raw_orig)',
      ],
    });
    const text = generateDatasetMethods(sd);
    expect(text).toContain('automated batch pipeline');
    expect(text).toContain('the original raw trace');
    expect(text).toContain('moving-average filter');
    expect(text).toContain('Shirley background subtraction');
  });

  it('describes peak detection and Gaussian fitting with goodness of fit', () => {
    const sd = makeDataset({
      history: [
        '[10:00:03] Auto-detected 3 peaks with prominence >= 0.05.',
        '[10:00:04] Fit 3 Gaussian components. R\u00b2=0.9980, \u03c7\u00b2_r=2.31e-3, RMSE=1.87e-3.',
      ],
    });
    const text = generateDatasetMethods(sd);
    expect(text).toContain('minimum prominence threshold of 0.05, yielding 3 candidate peak(s)');
    expect(text).toContain('3 gaussian line-shape function(s)');
    expect(text).toContain('R\u00b2 = 0.9980');
    expect(text).not.toContain('covariance matrix');
  });

  it('mentions parameter uncertainty when the fit reports it', () => {
    const sd = makeDataset({
      history: [
        '[10:00:04] Fit 1 Gaussian components. R\u00b2=0.9980, \u03c7\u00b2_r=2.31e-3, RMSE=1.87e-3. Param. SE via covariance.',
      ],
    });
    const text = generateDatasetMethods(sd);
    expect(text).toContain('asymptotic covariance matrix');
    expect(text).toContain('delta method');
  });

  it('describes Tauc extrapolation with manual range', () => {
    const sd = makeDataset({
      history: [
        '[10:00:05] Executed semiconductor Tauc Plot (direct) constrained to 300-500 nm. Eg Extrapolation = 2.770 eV.',
      ],
    });
    const text = generateDatasetMethods(sd);
    expect(text).toContain('direct allowed transition');
    expect(text).toContain('constrained to 300-500 nm');
    expect(text).toContain('Eg = 2.770 eV');
  });

  it("describes Job's plot stoichiometry", () => {
    const sd = makeDataset({
      history: [
        "[10:00:06] Calculated Job's Method stoichiometry plot at target coordinate 450 nm. Peak intercept at mole fraction X = 0.502.",
      ],
    });
    const text = generateDatasetMethods(sd);
    expect(text).toContain("Job's method of continuous variation at 450 nm");
    expect(text).toContain('X = 0.502');
  });

  it("describes Welch's t-test", () => {
    const sd = makeDataset({
      history: ["[10:00:07] Welch's t-test (Control vs Treated): t=4.213, df=8.31, p=0.0023 (**)."],
    });
    const text = generateDatasetMethods(sd);
    expect(text).toContain("Welch's unequal-variances t-test");
    expect(text).toContain('p = 0.0023');
    expect(text).toContain('**');
  });

  it('describes replicate statistics', () => {
    const sd = makeDataset({
      history: ['[10:00:08] Replicate statistics computed across 3 datasets (SEM error bars). Mean trace + error bars applied.'],
    });
    const text = generateDatasetMethods(sd);
    expect(text).toContain('n = 3');
    expect(text).toContain('standard error of the mean');
  });

  it('describes CV and EIS simulations', () => {
    const sd = makeDataset({
      history: [
        '[10:00:09] Butler\u2013Volmer CV simulated: E\u00b0=0.05V, \u03bd=0.1V/s, n=1',
        '[10:00:10] Randles EIS: Rs=10\u03a9, Rct=200\u03a9, Cdl=2e-5F',
      ],
    });
    const text = generateDatasetMethods(sd);
    expect(text).toContain('Butler\u2013Volmer formalism');
    expect(text).toContain('Randles equivalent circuit');
    expect(text).toContain('Cdl = 2e-5F');
  });

  it('skips non-methods-relevant UI bookkeeping entries', () => {
    const sd = makeDataset({
      history: [
        '[10:00:11] Process state undone.',
        '[10:00:12] Process state redone.',
        '[10:00:13] Technique recalibrated to FTIR.',
        '[10:00:14] Interactively placed peak mark at coordinate X: 355.120',
      ],
    });
    const text = generateDatasetMethods(sd);
    expect(text).toContain('No further processing steps');
  });

  it('appends integration summary when integrals exist', () => {
    const sd = makeDataset({
      integrals: [{ id: 'i1', xmin: 300, xmax: 400, area: 12.3 }],
    });
    const text = generateDatasetMethods(sd);
    expect(text).toContain('trapezoidal numerical integration over 1 user-defined region');
  });
});

describe('generateMethodsText', () => {
  it('returns empty string for no datasets', () => {
    expect(generateMethodsText([])).toBe('');
  });

  it('returns a single paragraph for one dataset', () => {
    const sd = makeDataset();
    const text = generateMethodsText([sd]);
    expect(text).not.toContain('**');
  });

  it('returns a bolded per-sample breakdown for multiple datasets', () => {
    const sd1 = makeDataset({ id: 'a', name: 'Sample A' });
    const sd2 = makeDataset({ id: 'b', name: 'Sample B' });
    const text = generateMethodsText([sd1, sd2]);
    expect(text).toContain('**Sample A.**');
    expect(text).toContain('**Sample B.**');
  });
});
