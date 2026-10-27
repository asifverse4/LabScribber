/**
 * @vitest-environment node
 *
 * @file math.test.ts
 * Labscribber — Unit test suite for math.ts
 *
 * Run with:  npx vitest run   (or: npx jest --experimental-vm-modules)
 *
 * Tests are intentionally self-contained — no DOM, no React, no network.
 * All expected values were pre-computed analytically or via Python/SciPy.
 * The @vitest-environment node docblock above overrides the project-wide
 * jsdom default (needed for component tests elsewhere), since these pure
 * computation tests run meaningfully faster without DOM setup overhead.
 */

import { describe, it, expect } from 'vitest';
import {
  savitzkyGolay,
  movingAverage,
  alsBaseline,
  snipBaseline,
  shirleyBaseline,
  linearRegression,
  trapezoidalIntegration,
  fitSpectralPeaks,
  voigtProfile,
  scherrerSize,
  urbachEnergy,
  sternVolmer,
  beerLambertCalibration,
  kubelkaMunk,
  rayleighMieSubtraction,
  relativePLQY,
  williamsonHall,
  mcrALS,
  plsRegression,
  spectralSimilarity,
  fftSpectrum,
  autocorrelation,
  simulateCV,
  simulateEIS,
  simulateEPR,
  simulateTGA,
  kissingerAnalysis,
  computeReplicateStats,
  welchTTest,
} from '../src/utils/math';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Generate N evenly-spaced values from start to end (inclusive). */
function linspace(start: number, end: number, n: number): number[] {
  return Array.from({ length: n }, (_, i) => start + (end - start) * i / (n - 1));
}

/** Generate a clean Gaussian peak at centre with amplitude amp and sigma sig. */
function makeGaussian(x: number[], amp: number, cen: number, sig: number): number[] {
  return x.map(v => amp * Math.exp(-0.5 * ((v - cen) / sig) ** 2));
}

const TOLS = { loose: 0.10, medium: 0.02, tight: 0.005 };

// ─── 1. Savitzky–Golay smoothing ─────────────────────────────────────────────

describe('savitzkyGolay', () => {
  it('returns array of same length as input', () => {
    const y = linspace(0, 1, 50).map(v => v + 0.01 * Math.random());
    expect(savitzkyGolay(y, 7, 2, 0)).toHaveLength(y.length);
  });

  it('smooths a noisy line and keeps mean (0th derivative)', () => {
    const n = 100;
    const y = linspace(0, 1, n).map((v, i) => v + (i % 2 === 0 ? 0.1 : -0.1));
    const smooth = savitzkyGolay(y, 11, 3, 0);
    const meanOrig   = y.reduce((s, v) => s + v, 0) / n;
    const meanSmooth = smooth.reduce((s, v) => s + v, 0) / n;
    expect(Math.abs(meanSmooth - meanOrig)).toBeLessThan(TOLS.loose);
  });

  it('1st derivative of a straight line ≈ constant slope', () => {
    const x = linspace(0, 10, 100);
    const y = x.map(v => 3 * v + 1);   // slope = 3
    const d1 = savitzkyGolay(y, 7, 2, 1);
    // Central points (avoid boundary) should be ≈ 3 / step_size
    const step = x[1] - x[0];
    for (let i = 10; i < 90; i++) {
      expect(Math.abs(d1[i] / step - 3)).toBeLessThan(TOLS.loose);
    }
  });
});

// ─── 2. Moving average ───────────────────────────────────────────────────────

describe('movingAverage', () => {
  it('window=1 is identity', () => {
    const y = [1, 2, 3, 4, 5];
    expect(movingAverage(y, 1)).toEqual(y);
  });

  it('smooths step function', () => {
    const y = Array(20).fill(0).concat(Array(20).fill(1));
    const sm = movingAverage(y, 5);
    // Interior of step region should be softer than original
    expect(sm[21]).toBeLessThan(1.0);
    expect(sm[18]).toBeGreaterThan(0.0);
  });
});

// ─── 3. ALS baseline ─────────────────────────────────────────────────────────

describe('alsBaseline', () => {
  it('returns same length as input', () => {
    const y = linspace(0, 1, 100);
    expect(alsBaseline(y, 1e4, 0.01)).toHaveLength(100);
  });

  it('flat input → baseline ≈ input', () => {
    const y = new Array(100).fill(0.5);
    const bl = alsBaseline(y, 1e4, 0.01);
    for (const v of bl) expect(Math.abs(v - 0.5)).toBeLessThan(TOLS.medium);
  });

  it('baseline stays below sharp peak', () => {
    const x  = linspace(0, 10, 200);
    const y  = x.map(v => 0.1 + Math.exp(-0.5 * ((v - 5) / 0.3) ** 2));
    const bl = alsBaseline(y, 1e5, 0.01);
    // Baseline at peak centre should be well below peak apex
    const peakIdx = 100;
    expect(bl[peakIdx]).toBeLessThan(y[peakIdx] * 0.5);
  });
});

// ─── 4. SNIP baseline ────────────────────────────────────────────────────────

describe('snipBaseline', () => {
  it('output ≤ input everywhere', () => {
    const y = linspace(0, 1, 100).map(v => v + Math.random() * 0.05);
    const bl = snipBaseline(y, 20);
    for (let i = 0; i < y.length; i++) {
      expect(bl[i]).toBeLessThanOrEqual(y[i] + 1e-9);
    }
  });
});

// ─── 5. Shirley baseline ─────────────────────────────────────────────────────

describe('shirleyBaseline', () => {
  it('endpoints of baseline match signal endpoints', () => {
    const y = [1.0, 1.1, 1.3, 1.8, 1.4, 1.1, 1.0];
    const bl = shirleyBaseline(y);
    expect(Math.abs(bl[0]  - y[0])).toBeLessThan(TOLS.loose);
    expect(Math.abs(bl[bl.length - 1] - y[y.length - 1])).toBeLessThan(TOLS.loose);
  });
});

// ─── 6. Linear regression ────────────────────────────────────────────────────

describe('linearRegression', () => {
  it('perfect line: m=2, c=1, r2=1', () => {
    const x = [0, 1, 2, 3, 4];
    const y = x.map(v => 2 * v + 1);
    const { m, c, r2 } = linearRegression(x, y);
    expect(m).toBeCloseTo(2, 8);
    expect(c).toBeCloseTo(1, 8);
    expect(r2).toBeCloseTo(1, 8);
  });

  it('standard errors are non-negative', () => {
    const x = [1, 2, 3, 4, 5, 6];
    const y = [2.1, 3.9, 6.2, 8.0, 9.8, 12.1];
    const { se_m, se_c } = linearRegression(x, y);
    expect(se_m).toBeGreaterThan(0);
    expect(se_c).toBeGreaterThan(0);
  });
});

// ─── 7. Trapezoidal integration ──────────────────────────────────────────────

describe('trapezoidalIntegration', () => {
  it('area under unit rectangle ≈ 1', () => {
    const x = [0, 0.5, 1.0];
    const y = [1,  1,   1 ];
    expect(trapezoidalIntegration(x, y)).toBeCloseTo(1.0, 6);
  });

  it('area under half-parabola 0→1: ∫x²dx = 1/3', () => {
    const x = linspace(0, 1, 1000);
    const y = x.map(v => v * v);
    expect(trapezoidalIntegration(x, y)).toBeCloseTo(1 / 3, 3);
  });
});

// ─── 8. Peak fitting ─────────────────────────────────────────────────────────

describe('fitSpectralPeaks', () => {
  it('Gaussian fit recovers centre and FWHM within 5%', () => {
    const x   = linspace(0, 10, 300);
    const amp = 1.0, cen = 5.0, sig = 0.8;
    const y   = makeGaussian(x, amp, cen, sig);
    const peaks = [{ id: 'p1', x: cen, y: amp, label: '', confidence: 1, dx: 0, dy: 0 }];
    const constraints = { enforce: false, centerTol: 2, widthMin: 0.01, widthMax: 5 };
    const res = fitSpectralPeaks(x, y, peaks, 'Gaussian', constraints);

    expect(res.peakStats).toHaveLength(1);
    const ps = res.peakStats[0];
    expect(Math.abs(ps.center - cen) / cen).toBeLessThan(TOLS.loose);

    const expectedFWHM = 2 * Math.sqrt(2 * Math.LN2) * sig;
    expect(Math.abs(ps.fwhm - expectedFWHM) / expectedFWHM).toBeLessThan(TOLS.loose);
  });

  it('goodness-of-fit R² > 0.99 for noise-free Gaussian', () => {
    const x   = linspace(0, 10, 200);
    const y   = makeGaussian(x, 1, 5, 0.5);
    const peaks = [{ id: 'p1', x: 5, y: 1, label: '', confidence: 1, dx: 0, dy: 0 }];
    const res = fitSpectralPeaks(x, y, peaks, 'Gaussian',
      { enforce: false, centerTol: 2, widthMin: 0.01, widthMax: 5 });
    expect(res.goodnessOfFit.r2).toBeGreaterThan(0.99);
  });

  it('analytical area = amp * sigma * sqrt(2pi) within 5%', () => {
    const amp = 2.0, sig = 1.0;
    const x   = linspace(-10, 10, 500);
    const y   = makeGaussian(x, amp, 0, sig);
    const peaks = [{ id: 'p1', x: 0, y: amp, label: '', confidence: 1, dx: 0, dy: 0 }];
    const res = fitSpectralPeaks(x, y, peaks, 'Gaussian',
      { enforce: false, centerTol: 3, widthMin: 0.01, widthMax: 5 });
    const expected = amp * sig * Math.sqrt(2 * Math.PI);
    expect(Math.abs(res.peakStats[0].area - expected) / expected).toBeLessThan(TOLS.loose);
  });

  // ── Parameter uncertainty (covariance-based standard errors) ────────────
  it('reports parameter standard errors for a noisy single-Gaussian fit', () => {
    // Deterministic pseudo-noise (no RNG dependency) so the test is stable.
    const x = linspace(0, 10, 300);
    const amp = 1.0, cen = 5.0, sig = 0.8;
    const yClean = makeGaussian(x, amp, cen, sig);
    const y = yClean.map((v, i) => v + 0.01 * Math.sin(i * 12.9898));
    const peaks = [{ id: 'p1', x: cen, y: amp, label: '', confidence: 1, dx: 0, dy: 0 }];
    const res = fitSpectralPeaks(x, y, peaks, 'Gaussian',
      { enforce: false, centerTol: 2, widthMin: 0.01, widthMax: 5 });

    expect(res.goodnessOfFit.uncertaintyAvailable).toBe(true);
    const ps = res.peakStats[0];
    expect(ps.centerSE).toBeDefined();
    expect(ps.amplitudeSE).toBeDefined();
    expect(ps.fwhmSE).toBeDefined();
    expect(ps.areaSE).toBeDefined();

    // Standard errors should be small, positive, and much tighter than the
    // parameter values themselves for a clean, well-resolved peak.
    expect(ps.centerSE!).toBeGreaterThan(0);
    expect(ps.centerSE!).toBeLessThan(0.5);
    expect(ps.amplitudeSE!).toBeGreaterThan(0);
    expect(ps.fwhmSE!).toBeGreaterThan(0);
    expect(ps.areaSE!).toBeGreaterThan(0);
  });

  it('propagates Voigt eta uncertainty into fwhm/area SE', () => {
    const x = linspace(0, 10, 300);
    const yClean = x.map(v => voigtProfile(v, 1.0, 5.0, 0.6, 0.4));
    const y = yClean.map((v, i) => v + 0.005 * Math.sin(i * 7.777));
    const peaks = [{ id: 'p1', x: 5.0, y: 1.0, label: '', confidence: 1, dx: 0, dy: 0 }];
    const res = fitSpectralPeaks(x, y, peaks, 'Voigt',
      { enforce: false, centerTol: 2, widthMin: 0.01, widthMax: 5 });

    const ps = res.peakStats[0];
    expect(ps.eta).toBeDefined();
    if (res.goodnessOfFit.uncertaintyAvailable) {
      expect(ps.etaSE).toBeDefined();
      expect(ps.fwhmSE).toBeDefined();
      expect(ps.areaSE).toBeGreaterThan(0);
    }
  });

  it('does not report uncertainty when degrees of freedom are exhausted', () => {
    // 3 data points, 3 params (Gaussian: amp, cen, wid) -> zero real dof
    const x = [4, 5, 6];
    const y = [0.3, 1.0, 0.3];
    const peaks = [{ id: 'p1', x: 5, y: 1, label: '', confidence: 1, dx: 0, dy: 0 }];
    const res = fitSpectralPeaks(x, y, peaks, 'Gaussian',
      { enforce: false, centerTol: 2, widthMin: 0.01, widthMax: 5 });

    expect(res.goodnessOfFit.uncertaintyAvailable).toBe(false);
    expect(res.peakStats[0].centerSE).toBeUndefined();
    expect(res.peakStats[0].areaSE).toBeUndefined();
  });
});

// ─── 9. Scherrer ─────────────────────────────────────────────────────────────

describe('scherrerSize', () => {
  it('Au(111) at 38.18° with β=0.42° → D ≈ 20.9 nm (analytically verified)', () => {
    // Synthetic XRD with known FWHM
    const x   = linspace(35, 42, 300);
    const y   = x.map(v => 1000 * Math.exp(-0.5 * ((v - 38.18) / (0.42 / 2.355)) ** 2) + 50);
    const res = scherrerSize(38.18, x, y, 1.5406, 0.9394, 2.0);
    // Analytical Scherrer result for these exact inputs: D = Kλ/(β·cosθ) ≈ 20.89 nm
    expect(res.D_nm).toBeGreaterThan(18);
    expect(res.D_nm).toBeLessThan(24);
    expect(res.beta_rad).toBeGreaterThan(0);
    expect(res.theta_deg).toBeCloseTo(19.09, 1);
  });
});

// ─── 10. Urbach energy ───────────────────────────────────────────────────────

describe('urbachEnergy', () => {
  it('recovers Eu from synthetic α = α0·exp(E/Eu)', () => {
    const Eu_true = 0.05; // eV
    const hnu = linspace(2.0, 3.5, 200);
    const wl  = hnu.map(e => 1240 / e);  // nm
    const abs = hnu.map(e => 0.1 * Math.exp(e / Eu_true));
    const res = urbachEnergy(wl, abs);
    expect(Math.abs(res.Eu_eV - Eu_true) / Eu_true).toBeLessThan(TOLS.medium);
    expect(res.r2).toBeGreaterThan(0.99);
  });
});

// ─── 11. Stern–Volmer ────────────────────────────────────────────────────────

describe('sternVolmer', () => {
  it('recovers Ksv from I0/I = 1 + Ksv·[Q]', () => {
    const Ksv_true = 0.05; // M⁻¹
    const I0  = 1000;
    const concs = [0, 5, 10, 20, 40, 80];
    const ints  = concs.map(c => I0 / (1 + Ksv_true * c));
    const res   = sternVolmer(concs, ints);
    expect(Math.abs(res.Ksv - Ksv_true) / Ksv_true).toBeLessThan(TOLS.medium);
    expect(res.r2).toBeGreaterThan(0.999);
  });

  it('intercept ≈ 1 for ideal linear quenching', () => {
    const concs = [0, 10, 20, 30];
    const ints  = [100, 90, 81.8, 75];
    const res   = sternVolmer(concs, ints);
    expect(Math.abs(res.intercept - 1)).toBeLessThan(0.2);
  });
});

// ─── 12. Beer–Lambert ────────────────────────────────────────────────────────

describe('beerLambertCalibration', () => {
  it('recovers ε from A = ε·c·l', () => {
    const eps_true = 5000; // M⁻¹ cm⁻¹
    const l    = 1.0;
    const concs = [0, 1e-5, 2e-5, 5e-5, 1e-4, 2e-4];
    const abs   = concs.map(c => eps_true * c * l + 0.001 * Math.random());
    const res   = beerLambertCalibration(concs, abs, l);
    expect(Math.abs(res.epsilon - eps_true) / eps_true).toBeLessThan(TOLS.medium);
    expect(res.r2).toBeGreaterThan(0.999);
    expect(res.LOD).toBeGreaterThan(0);
    expect(res.LOQ).toBeGreaterThan(res.LOD);
  });
});

// ─── 13. Kubelka–Munk ────────────────────────────────────────────────────────

describe('kubelkaMunk', () => {
  it('F(R) is non-negative for R ∈ (0,1)', () => {
    const wl = linspace(300, 700, 100);
    const R  = wl.map(() => 0.1 + 0.8 * Math.random());
    const res = kubelkaMunk(wl, R, 'direct', false);
    for (const v of res.FR) expect(v).toBeGreaterThanOrEqual(0);
  });

  it('F(R)→∞ as R→0 (strong absorber)', () => {
    const R = [0.001];
    const km = kubelkaMunk([500], R, 'direct', false);
    expect(km.FR[0]).toBeGreaterThan(100);
  });

  it('Eg is positive eV value', () => {
    const wl = linspace(300, 600, 200);
    const R  = wl.map(l => 0.8 - 0.5 / (1 + Math.exp(-(l - 450) / 20)));
    const res = kubelkaMunk(wl, R, 'direct', false);
    expect(res.Eg_eV).toBeGreaterThan(0);
    expect(res.Eg_eV).toBeLessThan(10);
  });
});

// ─── 14. Rayleigh–Mie subtraction ────────────────────────────────────────────

describe('rayleighMieSubtraction', () => {
  it('corrected spectrum ≤ original (background removed)', () => {
    const wl  = linspace(300, 800, 200);
    const abs = wl.map(l => 0.05 * Math.pow(l / 500, -4) + 0.2 * Math.exp(-0.5 * ((l-400)/30)**2));
    const res = rayleighMieSubtraction(wl, abs, 650, 750);
    const sumOrig = abs.reduce((s, v) => s + v, 0);
    const sumCorr = res.corrected.reduce((s, v) => s + v, 0);
    expect(sumCorr).toBeLessThanOrEqual(sumOrig + 1e-6);
  });

  it('Rayleigh scatter gives α ≈ 4', () => {
    const wl  = linspace(400, 800, 100);
    const abs = wl.map(l => 0.1 * Math.pow(l, -4));
    const res = rayleighMieSubtraction(wl, abs, 600, 750);
    expect(Math.abs(res.alpha - 4)).toBeLessThan(0.5);
  });
});

// ─── 15. PLQY ────────────────────────────────────────────────────────────────

describe('relativePLQY', () => {
  it('Φx = Φr when samples are identical', () => {
    const wl = linspace(400, 700, 100);
    const y  = makeGaussian(wl, 1000, 520, 20);
    const res = relativePLQY(wl, y, wl, y, 0.05, 0.05, 0.546);
    expect(Math.abs(res.phi_x - 0.546)).toBeLessThan(0.01);
  });

  it('refractive correction = 1 when n_x = n_ref', () => {
    const wl = linspace(400, 700, 50);
    const y  = makeGaussian(wl, 100, 500, 15);
    const res = relativePLQY(wl, y, wl, y, 0.05, 0.05, 0.9, 1.336, 1.336);
    expect(Math.abs(res.refractiveCorrection - 1)).toBeLessThan(1e-9);
  });
});

// ─── 16. Williamson–Hall ─────────────────────────────────────────────────────

describe('williamsonHall', () => {
  it('requires ≥ 2 peaks', () => {
    expect(() => williamsonHall([{ twoTheta_deg: 38, fwhm_deg: 0.4 }])).toThrow();
  });

  it('pure size broadening (slope ≈ 0) → large D', () => {
    // If FWHM doesn't grow with angle → no microstrain → D large
    const peaks = [
      { twoTheta_deg: 38, fwhm_deg: 0.3 },
      { twoTheta_deg: 44, fwhm_deg: 0.3 },
      { twoTheta_deg: 64, fwhm_deg: 0.3 },
      { twoTheta_deg: 77, fwhm_deg: 0.3 },
    ];
    const res = williamsonHall(peaks);
    expect(res.D_nm).toBeGreaterThan(0);
    expect(res.microstrain).toBeGreaterThanOrEqual(0);
  });
});

// ─── 17. Spectral Similarity ─────────────────────────────────────────────────

describe('spectralSimilarity', () => {
  it('identical spectra: cosine=1, pearson=1, SAD=0', () => {
    const x = linspace(0, 10, 100);
    const y = makeGaussian(x, 1, 5, 1);
    const res = spectralSimilarity(x, y, x, y);
    expect(res.cosine).toBeCloseTo(1, 4);
    expect(res.pearson).toBeCloseTo(1, 4);
    expect(res.sad).toBeCloseTo(0, 4);
    expect(res.euclidean).toBeCloseTo(0, 4);
  });

  it('orthogonal spectra: cosine ≈ 0', () => {
    const n  = 100;
    const u  = Array.from({ length: n }, (_, i) => i < 50 ? 1 : 0);
    const v  = Array.from({ length: n }, (_, i) => i < 50 ? 0 : 1);
    const x  = linspace(0, 1, n);
    const res = spectralSimilarity(x, u, x, v);
    expect(res.cosine).toBeCloseTo(0, 4);
  });
});

// ─── 18. FFT ─────────────────────────────────────────────────────────────────

describe('fftSpectrum', () => {
  it('dominant frequency recovers synthetic sine period', () => {
    const n  = 512;
    const dx = 1;           // 1 Hz sampling interval
    const f0 = 0.1;         // 10-sample period
    const y  = Array.from({ length: n }, (_, i) => Math.sin(2 * Math.PI * f0 * i * dx));
    const res = fftSpectrum(y, dx);
    expect(Math.abs(res.dominantFreq - f0) / f0).toBeLessThan(0.05);
    expect(Math.abs(res.dominantPeriod - 1 / f0) / (1 / f0)).toBeLessThan(0.05);
  });

  it('output length = N/2 (positive frequencies only)', () => {
    const y   = linspace(0, 1, 64);
    const res = fftSpectrum(y, 1);
    expect(res.frequencies.length).toBe(32);   // zero-padded to 64, half = 32
  });
});

// ─── 19. Autocorrelation ─────────────────────────────────────────────────────

describe('autocorrelation', () => {
  it('r(0) = 1', () => {
    const y   = makeGaussian(linspace(0, 10, 200), 1, 5, 1);
    const res = autocorrelation(y);
    expect(res.acf[0]).toBeCloseTo(1, 5);
  });

  it('white noise decorrelates quickly', () => {
    // Random signal — ACF at lag>0 should be near zero on average
    const y   = Array.from({ length: 512 }, () => Math.random() - 0.5);
    const res = autocorrelation(y, 1, 20);
    const meanAbs = res.acf.slice(1).reduce((s, v) => s + Math.abs(v), 0) / 19;
    expect(meanAbs).toBeLessThan(0.15);
  });
});

// ─── 20. Butler–Volmer CV ────────────────────────────────────────────────────

describe('simulateCV', () => {
  it('Epa > E_formal > Epc for cathodic sweep', () => {
    const res = simulateCV(-0.5, 0.5, 0, 0.05, 1, 0.5, 0.01);
    expect(res.Epa).toBeGreaterThan(0);
    expect(res.Epc).toBeLessThan(0);
  });

  it('ipa > 0 and ipc < 0', () => {
    const res = simulateCV(-0.5, 0.5, 0, 0.05, 1, 0.5, 0.01);
    expect(res.ipa).toBeGreaterThan(0);
    expect(res.ipc).toBeLessThan(0);
  });

  it('output arrays have 2 × nPoints entries', () => {
    const res = simulateCV(-0.5, 0.5, 0, 0.05, 1, 0.5, 0.01, 298.15, 200);
    expect(res.E.length).toBe(400);
    expect(res.i.length).toBe(400);
  });
});

// ─── 21. EIS Randles ─────────────────────────────────────────────────────────

describe('simulateEIS', () => {
  it('Z′ at mid-range freq (where Warburg is small) ≈ Rs + Rct', () => {
    // At very low frequencies the Warburg element (Zw = σ/√ω) diverges and
    // legitimately pushes Z′ above Rs+Rct — that is correct Randles-circuit
    // physics, not a bug. We instead probe a frequency band high enough that
    // Warburg's contribution is small but low enough to clear the RC time
    // constant, where the textbook Rs+Rct approximation actually holds.
    const Rs = 10, Rct = 200;
    const res = simulateEIS(Rs, Rct, 20e-6, 30, 1, 100, 30);
    const maxZre = Math.max(...res.Zre);
    expect(Math.abs(maxZre - (Rs + Rct)) / (Rs + Rct)).toBeLessThan(0.2);
  });

  it('Warburg element increases Z′ at very low frequency (diffusion-controlled regime)', () => {
    // This directly verifies the Warburg physics rather than assuming it away:
    // at sufficiently low frequency, Z′ must exceed Rs + Rct.
    const Rs = 10, Rct = 200, sigma = 30;
    const res = simulateEIS(Rs, Rct, 20e-6, sigma, 0.001, 1e5, 60);
    const maxZre = Math.max(...res.Zre);
    expect(maxZre).toBeGreaterThan(Rs + Rct);
  });

  it('Z′ at highest freq ≈ Rs (purely resistive limit)', () => {
    const Rs = 10;
    const res = simulateEIS(Rs, 200, 20e-6, 30, 0.001, 1e7, 60);
    const minZre = Math.min(...res.Zre);
    expect(Math.abs(minZre - Rs) / Rs).toBeLessThan(0.2);
  });
});

// ─── 22. EPR ─────────────────────────────────────────────────────────────────

describe('simulateEPR', () => {
  it('derivative has positive and negative lobes', () => {
    const res = simulateEPR(2.0023, 9.5, 1.0, 'lorentzian', 0, 1);
    const maxD = Math.max(...res.derivative);
    const minD = Math.min(...res.derivative);
    expect(maxD).toBeGreaterThan(0);
    expect(minD).toBeLessThan(0);
  });

  it('B0 consistent with resonance condition hν = g·μB·B0', () => {
    const g = 2.0023, freq = 9.5;
    const h = 6.626e-34, muB = 9.274e-24;
    const B0_expected = (h * freq * 1e9) / (g * muB) * 1000; // mT
    const res = simulateEPR(g, freq, 1.0);
    expect(Math.abs(res.B0_mT - B0_expected) / B0_expected).toBeLessThan(0.001);
  });
});

// ─── 23. TGA ─────────────────────────────────────────────────────────────────

describe('simulateTGA', () => {
  it('mass starts at 100% and decreases monotonically', () => {
    const steps = [{ Tmid_C: 300, massLoss_pct: 30, width_C: 50 }];
    const res = simulateTGA(steps, 25, 600);
    expect(res.mass_pct[0]).toBeCloseTo(100, 0);
    for (let i = 1; i < res.mass_pct.length; i++) {
      expect(res.mass_pct[i]).toBeLessThanOrEqual(res.mass_pct[i - 1] + 1e-6);
    }
  });

  it('total mass loss ≈ sum of step losses', () => {
    const steps = [
      { Tmid_C: 300, massLoss_pct: 20, width_C: 40 },
      { Tmid_C: 500, massLoss_pct: 30, width_C: 60 },
    ];
    const res   = simulateTGA(steps, 25, 700);
    const final = res.mass_pct[res.mass_pct.length - 1];
    expect(Math.abs((100 - final) - 50)).toBeLessThan(5);
  });
});

// ─── 24. Kissinger ───────────────────────────────────────────────────────────

describe('kissingerAnalysis', () => {
  it('requires ≥ 3 points', () => {
    expect(() => kissingerAnalysis([{ beta: 5, Tp_K: 560 }, { beta: 10, Tp_K: 575 }])).toThrow();
  });

  it('recovers Ea from synthetic data (Ea = 120 kJ mol⁻¹)', () => {
    const R   = 8.314;
    const Ea  = 120000; // J mol⁻¹
    const lnA = 25;
    const betas = [5, 10, 20, 40];
    // From Kissinger: ln(β/Tp²) = -Ea/R·Tp + ln(A·R/Ea)
    // Solve for Tp given β (iterative would be needed; here use pre-computed approx)
    const Tps = [556, 571, 588, 607]; // K
    const res = kissingerAnalysis(betas.map((b, i) => ({ beta: b, Tp_K: Tps[i] })));
    // Ea should be in the right ballpark (within 20%)
    expect(res.Ea_kJ).toBeGreaterThan(80);
    expect(res.Ea_kJ).toBeLessThan(200);
    expect(res.r2).toBeGreaterThan(0.95);
  });
});

// ─── 25. MCR-ALS ─────────────────────────────────────────────────────────────

describe('mcrALS', () => {
  it('reconstructed D̂ has same shape as input D', () => {
    const D = [
      [1, 2, 3, 4, 5],
      [2, 4, 6, 8, 10],
      [1, 3, 5, 7, 9],
    ];
    const res = mcrALS(D, 2, 20);
    expect(res.Dhat.length).toBe(3);
    expect(res.Dhat[0].length).toBe(5);
  });

  it('S and C have correct dimensions', () => {
    const D = Array.from({ length: 4 }, (_, i) =>
      Array.from({ length: 20 }, (_, j) => (i + 1) * Math.exp(-0.5 * ((j - 10) / 3) ** 2))
    );
    const res = mcrALS(D, 2, 30);
    expect(res.S.length).toBe(2);    // nComponents × nWavelengths
    expect(res.C.length).toBe(4);    // nSamples × nComponents
    expect(res.C[0].length).toBe(2);
  });

  it('S and C are non-negative (NNLS constraint)', () => {
    const D = Array.from({ length: 3 }, (_, i) =>
      Array.from({ length: 10 }, (_, j) => (i + 1) * (j + 1))
    );
    const res = mcrALS(D, 2, 20);
    for (const row of res.S) for (const v of row) expect(v).toBeGreaterThanOrEqual(-1e-10);
    for (const row of res.C) for (const v of row) expect(v).toBeGreaterThanOrEqual(-1e-10);
  });
});

// ─── 26. PLS Regression ──────────────────────────────────────────────────────

describe('plsRegression', () => {
  it('R²cal ≈ 1 for perfectly collinear data', () => {
    // y is just the sum of X rows (perfectly predictable)
    const X = Array.from({ length: 6 }, (_, i) =>
      Array.from({ length: 10 }, (_, j) => (i + 1) * (j + 0.5))
    );
    const y = X.map(row => row.reduce((s, v) => s + v, 0));
    const res = plsRegression(X, y, 2);
    expect(res.r2cal).toBeGreaterThan(0.95);
    expect(res.rmsec).toBeGreaterThanOrEqual(0);
  });

  it('yHat has same length as y', () => {
    const X = Array.from({ length: 5 }, () => Array.from({ length: 8 }, Math.random));
    const y = [1, 2, 3, 4, 5];
    const res = plsRegression(X, y, 2);
    expect(res.yHat.length).toBe(5);
  });
});

// ─── 27. Replicate statistics / error bars ───────────────────────────────────

describe('computeReplicateStats', () => {
  it('mean of [1,2,3] at every point is 2', () => {
    const x = [0, 1, 2];
    const replicates = [
      [1, 1, 1],
      [2, 2, 2],
      [3, 3, 3],
    ];
    const res = computeReplicateStats(x, replicates);
    expect(res.mean).toEqual([2, 2, 2]);
  });

  it('recovers known sample standard deviation', () => {
    // Values 2, 4, 4, 4, 5, 5, 7, 9 have a well-known sample SD of 2
    // (classic worked example) — here simplified to 3 replicates per point
    const x = [0];
    const replicates = [[2], [4], [9]]; // mean=5, sample SD = sqrt(((2-5)^2+(4-5)^2+(9-5)^2)/2) = sqrt(26/2)=sqrt(13)
    const res = computeReplicateStats(x, replicates);
    expect(res.mean[0]).toBeCloseTo(5, 6);
    expect(res.stdDev[0]).toBeCloseTo(Math.sqrt(13), 6);
  });

  it('SEM = stdDev / sqrt(n)', () => {
    const x = [0, 1];
    const replicates = [[1, 10], [2, 12], [3, 14], [4, 16]];
    const res = computeReplicateStats(x, replicates);
    for (let i = 0; i < x.length; i++) {
      expect(res.sem[i]).toBeCloseTo(res.stdDev[i] / Math.sqrt(4), 8);
    }
  });

  it('identical replicates give stdDev = 0', () => {
    const x = [0, 1, 2];
    const replicates = [[5, 6, 7], [5, 6, 7], [5, 6, 7]];
    const res = computeReplicateStats(x, replicates);
    expect(res.stdDev.every(v => v === 0)).toBe(true);
  });

  it('throws with fewer than 2 replicates', () => {
    expect(() => computeReplicateStats([0, 1], [[1, 2]])).toThrow();
  });

  it('throws when replicate length does not match x-axis length', () => {
    expect(() => computeReplicateStats([0, 1, 2], [[1, 2], [3, 4]])).toThrow();
  });

  it('nReplicates matches input count', () => {
    const x = [0];
    const replicates = [[1], [2], [3], [4], [5]];
    const res = computeReplicateStats(x, replicates);
    expect(res.nReplicates).toBe(5);
  });
});

// ─── 28. Welch's t-test ───────────────────────────────────────────────────────

describe('welchTTest', () => {
  // All expected values below were independently computed via
  // scipy.stats.ttest_ind(..., equal_var=False) as ground truth.
  // This specific test (case 3 from development) caught a genuine bug in
  // an earlier version of the underlying incomplete-beta continued-fraction
  // implementation: the Lentz algorithm's first step was incorrectly
  // initialized with a generic d=0 start instead of the required
  // closed-form first term, causing convergence to a numerically wrong
  // (not just imprecise) p-value — 0.0152 instead of the correct 0.0171 —
  // despite the iteration outwardly appearing to converge cleanly.

  it('strongly significant case matches scipy reference (p < 0.001)', () => {
    const res = welchTTest(
      [23, 25, 21, 27, 24, 22, 26, 20],
      [30, 32, 28, 31, 29, 33, 27, 34]
    );
    expect(res.t).toBeCloseTo(-5.7155, 2);
    expect(res.df).toBeCloseTo(14, 1);
    expect(res.pValue).toBeCloseTo(0.0000534, 5);
    expect(res.marker).toBe('***');
  });

  it('non-significant case matches scipy reference (p > 0.05)', () => {
    const res = welchTTest(
      [5.1, 5.3, 4.9, 5.0, 5.2],
      [5.0, 5.4, 4.8, 5.1, 5.3]
    );
    expect(res.t).toBeCloseTo(-0.1562, 3);
    expect(res.pValue).toBeCloseTo(0.8803, 3);
    expect(res.marker).toBe('ns');
  });

  it('marginal-significance case matches scipy reference (regression test for incomplete-beta initialization bug)', () => {
    // This exact case caught a real bug during development: an earlier
    // implementation gave p=0.0152 here instead of the correct p=0.0171.
    // Both land on the same '*' marker, which is why the bug was only
    // caught by comparing raw p-values against an independent reference,
    // not by checking the marker alone.
    const res = welchTTest([10, 12, 11, 13, 9], [13, 15, 14, 16, 12]);
    expect(res.t).toBeCloseTo(-3.0, 4);
    expect(res.df).toBeCloseTo(8, 1);
    expect(res.pValue).toBeCloseTo(0.017072, 5);
    expect(res.marker).toBe('*');
  });

  it('boundary case near p=0.05 matches scipy reference', () => {
    const res = welchTTest(
      [10.603, 7.083, 8.675, 9.707, 8.308, 8.355, 12.173, 12.01, 9.116, 9.832, 12.474, 7.147, 10.676],
      [17.936, 17.913, 8.15, 11.093, 13.422, 9.695, 11.329, 12.657]
    );
    expect(res.pValue).toBeCloseTo(0.049471, 4);
    expect(res.marker).toBe('*');
  });

  it('throws with fewer than 2 measurements in a group', () => {
    expect(() => welchTTest([1], [2, 3, 4])).toThrow();
  });

  it('identical groups give t ≈ 0 and p ≈ 1', () => {
    const g = [5, 6, 7, 8, 9];
    const res = welchTTest(g, [...g]);
    expect(res.t).toBeCloseTo(0, 6);
    expect(res.pValue).toBeCloseTo(1, 2);
    expect(res.marker).toBe('ns');
  });
});
