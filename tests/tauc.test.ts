/**
 * @license
 * SPDX-License-Identifier: MIT
 */

import { describe, it, expect } from 'vitest';
import { extractTaucBandgap } from '../src/utils/math';

describe('extractTaucBandgap — Robust Optical Bandgap Analysis', () => {
  /**
   * Helper to synthesize a direct-bandgap semiconductor absorption spectrum
   * α(E) = A * sqrt(E - Eg) / E  for E >= Eg
   * Convert E (eV) to wavelength λ = 1240 / E (nm)
   */
  function generateSyntheticSemiconductor(
    trueEg_eV: number,
    noiseAmp = 0,
    wlStart = 300,
    wlEnd = 800,
    numPts = 100
  ) {
    const step = (wlEnd - wlStart) / (numPts - 1);
    const wavelength_nm: number[] = [];
    const absorbance: number[] = [];

    for (let i = 0; i < numPts; i++) {
      const wl = wlStart + i * step;
      const E = 1240 / wl; // eV
      let alpha = 0;
      if (E >= trueEg_eV) {
        // Direct allowed transition: (α·E)^2 ∝ (E - Eg) => α·E = C * sqrt(E - Eg)
        alpha = (2.5 * Math.sqrt(E - trueEg_eV)) / E;
      } else {
        // Sub-bandgap Urbach tail: exponential decay below Eg
        alpha = 0.02 * Math.exp((E - trueEg_eV) / 0.08);
      }

      // Add noise
      if (noiseAmp > 0) {
        alpha += (Math.random() - 0.5) * noiseAmp;
      }

      wavelength_nm.push(parseFloat(wl.toFixed(2)));
      absorbance.push(Math.max(alpha, 0.001));
    }

    return { wavelength_nm, absorbance };
  }

  it('accurately recovers the bandgap of an ideal direct semiconductor (Eg = 2.50 eV)', () => {
    const trueEg = 2.50;
    const { wavelength_nm, absorbance } = generateSyntheticSemiconductor(trueEg, 0);

    const result = extractTaucBandgap(wavelength_nm, absorbance, 'direct');

    expect(result.transition).toBe('direct');
    expect(result.eg).toBeGreaterThan(2.40);
    expect(result.eg).toBeLessThan(2.60);
    expect(result.r2).toBeGreaterThan(0.95);
    expect(result.m).toBeGreaterThan(0);
    expect(result.fitX.length).toBeGreaterThanOrEqual(8);
    expect(result.hnu_eV.length).toBe(wavelength_nm.length);
  });

  it('accurately recovers an indirect bandgap semiconductor (Eg = 1.60 eV)', () => {
    const trueEg = 1.60;
    // For indirect transition: (α·E)^0.5 ∝ (E - Eg)
    const wlStart = 400;
    const wlEnd = 900;
    const numPts = 100;
    const step = (wlEnd - wlStart) / (numPts - 1);
    const wavelength_nm: number[] = [];
    const absorbance: number[] = [];

    for (let i = 0; i < numPts; i++) {
      const wl = wlStart + i * step;
      const E = 1240 / wl;
      let alpha = 0.01;
      if (E > trueEg) {
        alpha = Math.pow(1.8 * (E - trueEg), 2) / E;
      }
      wavelength_nm.push(wl);
      absorbance.push(alpha);
    }

    const result = extractTaucBandgap(wavelength_nm, absorbance, 'indirect');

    expect(result.transition).toBe('indirect');
    expect(result.eg).toBeGreaterThan(1.50);
    expect(result.eg).toBeLessThan(1.70);
    expect(result.r2).toBeGreaterThan(0.95);
  });

  it('remains resilient against detector spike artifacts and noise (paper §2.3)', () => {
    const trueEg = 2.80;
    const { wavelength_nm, absorbance } = generateSyntheticSemiconductor(trueEg, 0.02);

    // Inject an isolated large detector glitch / noise spike
    const midIdx = Math.floor(absorbance.length / 2);
    absorbance[midIdx] += 1.5;

    const result = extractTaucBandgap(wavelength_nm, absorbance, 'direct');

    // The robust sliding window with linearity filter should ignore the isolated spike
    expect(result.eg).toBeGreaterThan(2.65);
    expect(result.eg).toBeLessThan(2.95);
    expect(result.r2).toBeGreaterThan(0.90);
  });

  it('respects user-specified manual wavelength range safeguards', () => {
    const trueEg = 3.0; // 1240 / 3.0 = 413 nm absorption edge
    const { wavelength_nm, absorbance } = generateSyntheticSemiconductor(trueEg, 0, 200, 800, 150);

    // Constrain to 350 - 550 nm window around edge
    const result = extractTaucBandgap(wavelength_nm, absorbance, 'direct', {
      manualRangeMin: 350,
      manualRangeMax: 550,
    });

    expect(result.eg).toBeGreaterThan(2.90);
    expect(result.eg).toBeLessThan(3.10);
    expect(result.r2).toBeGreaterThan(0.95);
  });

  it('throws a descriptive error when dataset has fewer than 8 points', () => {
    expect(() => {
      extractTaucBandgap([300, 400, 500], [0.1, 0.5, 0.9]);
    }).toThrow('Tauc analysis requires at least 8 matched wavelength and absorbance data points');
  });
});
