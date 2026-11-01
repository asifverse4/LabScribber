/**
 * @license
 * SPDX-License-Identifier: MIT
 */

import { describe, it, expect, afterEach } from 'vitest';
import {
  computeFitSpectralPeaksAsync,
  computeAlsBaselineAsync,
  computePCASVDAsync,
  computeTaucAsync,
  terminateMathWorker,
} from '../src/utils/workerBridge';

describe('workerBridge — Background Math Worker & Fallback', () => {
  afterEach(() => {
    terminateMathWorker();
  });

  it('asynchronously computes multi-peak deconvolution with goodness-of-fit metrics', async () => {
    // Generate synthetic Gaussian
    const x: number[] = [];
    const y: number[] = [];
    for (let i = 0; i < 100; i++) {
      const xi = i * 0.1;
      x.push(xi);
      y.push(Math.exp(-0.5 * Math.pow((xi - 5) / 0.8, 2)));
    }

    const initialPeaks = [
      { id: 'p1', x: 5, y: 1, label: 'Peak 1', confidence: 1, dx: 0, dy: 0 },
    ];

    const res = await computeFitSpectralPeaksAsync(x, y, initialPeaks, 'Gaussian', {
      enforce: false,
      centerTol: 1,
      widthMin: 0.1,
      widthMax: 3,
    });

    expect(res.fitResult.length).toBe(x.length);
    expect(res.peakStats.length).toBe(1);
    expect(res.peakStats[0].center).toBeCloseTo(5.0, 1);
    expect(res.goodnessOfFit.r2).toBeGreaterThan(0.99);
    expect(res.goodnessOfFit.aic).toBeDefined();
    expect(res.goodnessOfFit.bic).toBeDefined();
  });

  it('asynchronously computes ALS baseline correction', async () => {
    const y = Array.from({ length: 50 }, (_, i) => 10 + 0.1 * i + (i === 25 ? 5 : 0));
    const baseline = await computeAlsBaselineAsync(y, 0.001, 1000, 5);

    expect(baseline.length).toBe(y.length);
    // Baseline at the peak index should remain close to the baseline level ~12.5, not 17.5
    expect(baseline[25]).toBeLessThan(15);
  });

  it('asynchronously extracts robust Tauc optical bandgap', async () => {
    const wavelength_nm: number[] = [];
    const absorbance: number[] = [];
    for (let i = 0; i < 80; i++) {
      const wl = 300 + i * 5;
      const E = 1240 / wl;
      wavelength_nm.push(wl);
      absorbance.push(E > 2.5 ? (2.0 * Math.sqrt(E - 2.5)) / E : 0.01);
    }

    const tauc = await computeTaucAsync(wavelength_nm, absorbance, 'direct');

    expect(tauc.eg).toBeGreaterThan(2.4);
    expect(tauc.eg).toBeLessThan(2.6);
    expect(tauc.r2).toBeGreaterThan(0.95);
  });

  it('asynchronously runs PCA-SVD decomposition', async () => {
    const refX = [100, 200, 300, 400, 500];
    const matrices = [
      [1, 2, 3, 4, 5],
      [2, 4, 6, 8, 10],
      [1.5, 3, 4.5, 6, 7.5],
    ];

    const pca = await computePCASVDAsync(matrices, refX);

    expect(pca.scores.length).toBe(3);
    expect(pca.explainedVariance.length).toBeGreaterThanOrEqual(1);
    expect(pca.explainedVariance[0]).toBeGreaterThan(0.90); // Collinear data => PC1 > 90% variance fraction
  });
});
