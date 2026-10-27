/**
 * @license
 * SPDX-License-Identifier: MIT
 *
 * math.ts — Labscribber signal-processing and scientific-analysis library
 *
 * All algorithms are implemented in pure TypeScript with no external runtime
 * dependencies, enabling offline use in both browser and Electron targets.
 *
 * ─── Module layout ───────────────────────────────────────────────────────────
 *  1. Basic linear algebra utilities
 *  2. Savitzky–Golay smoothing, derivatives, moving average, interpolation
 *  3. Baseline estimators
 *     3a. True ALS (Eilers 2005) via banded-Cholesky solver          ← NEW
 *     3b. SNIP  (Ryan et al. 1988)
 *     3c. Shirley background (Shirley 1972)
 *     3d. Polynomial baseline
 *  4. Basic scientific analysis (linear regression, trapezoidal integration)
 *  5. Principal Component Analysis (NIPALS / power-iteration SVD)
 *  6. Peak curve-fitting / deconvolution engine (Nelder–Mead)
 *     6a. Gaussian / Lorentzian / pseudo-Voigt profiles
 *     6b. Post-fit FWHM, analytical area, χ², R², RMSE               ← NEW
 *  7. Spectral heuristic expert system (peak assignment)
 *  8. ── Tier-1 additions ──────────────────────────────────────────────────
 *     8a. Scherrer crystallite-size equation (XRD)                    ← NEW
 *     8b. Urbach energy / sub-gap tail analysis (UV-Vis / PL)         ← NEW
 *     8c. Stern–Volmer fluorescence-quenching analysis                ← NEW
 *     8d. Beer–Lambert calibration curve with LOD / LOQ               ← NEW
 * ─────────────────────────────────────────────────────────────────────────────
 */

import {
  PeakData,
  TaucData,
  JobsData,
  PCAOutput,
  FitResult,
  FitPeakStats,
  FitGoodnessMetrics,
  ScherrerResult,
  UrbachResult,
  SternVolmerResult,
  BeerLambertResult,
} from '../types';

// ═══════════════════════════════════════════════════════════════════════════════
// 1. BASIC LINEAR ALGEBRA UTILITIES
// ═══════════════════════════════════════════════════════════════════════════════

export function transpose(m: number[][]): number[][] {
  return m[0].map((_, i) => m.map(row => row[i]));
}

export function multiply(a: number[][], b: number[][]): number[][] {
  const rowsA = a.length;
  const colsA = a[0].length;
  const colsB = b[0].length;
  const r: number[][] = Array.from({ length: rowsA }, () => new Array(colsB).fill(0));
  for (let i = 0; i < rowsA; i++)
    for (let k = 0; k < colsA; k++)
      for (let j = 0; j < colsB; j++)
        r[i][j] += a[i][k] * b[k][j];
  return r;
}

/** Gauss–Jordan matrix inversion (for small matrices ≤ 6×6). */
export function invert(m: number[][]): number[][] {
  const n = m.length;
  const a = m.map((row, i) => [
    ...row,
    ...Array(n).fill(0).map((_, j) => (i === j ? 1 : 0))
  ]);
  for (let i = 0; i < n; i++) {
    let maxRow = i;
    for (let j = i + 1; j < n; j++)
      if (Math.abs(a[j][i]) > Math.abs(a[maxRow][i])) maxRow = j;
    [a[i], a[maxRow]] = [a[maxRow], a[i]];
    const val = a[i][i];
    if (Math.abs(val) < 1e-12) throw new Error('Matrix is singular.');
    for (let j = i; j < 2 * n; j++) a[i][j] /= val;
    for (let j = 0; j < n; j++) {
      if (j !== i) {
        const f = a[j][i];
        for (let k = i; k < 2 * n; k++) a[j][k] -= f * a[i][k];
      }
    }
  }
  return a.map(row => row.slice(n));
}

// ═══════════════════════════════════════════════════════════════════════════════
// 2. SAVITZKY–GOLAY, MOVING AVERAGE, INTERPOLATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Compute Savitzky–Golay convolution coefficients.
 * Reference: Savitzky & Golay, Anal. Chem. 36, 1627–1639 (1964).
 *
 * @param windowSize  Odd integer ≥ 3
 * @param polyOrder   Polynomial order < windowSize
 * @param deriv       Derivative order (0 = smooth, 1 = 1st derivative, 2 = 2nd)
 */
export function getSavitzkyGolayCoefficients(
  windowSize: number,
  polyOrder: number,
  deriv: number
): number[] {
  const k = Math.floor(windowSize / 2);
  const n = windowSize;
  const t = Array.from({ length: n }, (_, i) => i - k);

  // Vandermonde matrix  X_ij = t_i^j
  const X: number[][] = t.map(ti =>
    Array.from({ length: polyOrder + 1 }, (_, j) => Math.pow(ti, j))
  );
  const Xt = transpose(X);
  const C = multiply(invert(multiply(Xt, X)), Xt);

  // Factorial scaling for derivative
  let scale = 1;
  for (let i = 1; i <= deriv; i++) scale *= i;

  return C[deriv].map(v => v * scale);
}

/**
 * Apply a Savitzky–Golay filter to signal y.
 * Boundary points are handled by index clamping.
 */
export function savitzkyGolay(
  y: number[],
  windowSize: number,
  polyOrder: number,
  deriv: number
): number[] {
  let size = windowSize % 2 === 0 ? windowSize + 1 : windowSize;
  if (size < 3) return [...y];
  if (size <= polyOrder) { size = polyOrder + 1; if (size % 2 === 0) size++; }

  const half = Math.floor(size / 2);
  const len = y.length;
  const coeffs = getSavitzkyGolayCoefficients(size, polyOrder, deriv);
  return y.map((_, i) => {
    let sum = 0;
    for (let j = -half; j <= half; j++) {
      const idx = Math.min(Math.max(i + j, 0), len - 1);
      sum += y[idx] * coeffs[j + half];
    }
    return sum;
  });
}

/** Symmetric boxcar moving average with boundary reflection. */
export function movingAverage(y: number[], window: number): number[] {
  const half = Math.floor(window / 2);
  return y.map((_, i) => {
    let sum = 0, count = 0;
    for (let j = -half; j <= half; j++) {
      const idx = i + j;
      if (idx >= 0 && idx < y.length) { sum += y[idx]; count++; }
    }
    return sum / count;
  });
}

/** Linear interpolation of (xOrig, yOrig) onto xTarget. */
export function interpolate(
  xOrig: number[],
  yOrig: number[],
  xTarget: number[]
): number[] {
  const len = xOrig.length;
  return xTarget.map(tx => {
    if (tx <= xOrig[0]) return yOrig[0];
    if (tx >= xOrig[len - 1]) return yOrig[len - 1];
    let lo = 0, hi = len - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (xOrig[mid] <= tx) lo = mid; else hi = mid;
    }
    const ratio = (tx - xOrig[lo]) / (xOrig[hi] - xOrig[lo]);
    return yOrig[lo] + ratio * (yOrig[hi] - yOrig[lo]);
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// 3a. TRUE ASYMMETRIC LEAST SQUARES BASELINE  (Eilers & Boelens 2005)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * True ALS baseline correction using a banded-Cholesky linear solver.
 *
 * Solves the penalised least-squares problem:
 *   min_z  Σ wᵢ(yᵢ − zᵢ)² + λ · Σ (Δ²zᵢ)²
 * with asymmetric weights  wᵢ = p  if yᵢ > zᵢ,  wᵢ = 1−p  otherwise.
 *
 * The second-difference penalty matrix D'D is tridiagonal in band form;
 * we solve (W + λ·D'D) z = W·y via Thomas algorithm at each iteration.
 *
 * @param y        Input signal
 * @param lam      Smoothness penalty λ (1e3 – 1e7; larger = smoother)
 * @param p        Asymmetry parameter p (0.001 – 0.1; smaller = lower baseline)
 * @param maxIter  Maximum Whittaker iterations (default 10)
 *
 * Reference: Eilers P.H.C. & Boelens H.F.M., Baseline Correction with
 * Asymmetric Least Squares Smoothing, Leiden Univ. Medical Centre (2005).
 */
export function alsBaseline(
  y: number[],
  lam = 1e5,
  p = 0.01,
  maxIter = 10
): number[] {
  const n = y.length;
  if (n < 4) return [...y];

  // Build the second-difference penalty  d = λ · D²ᵀD²  as a symmetric
  // tridiagonal band stored in three diagonals: [super, main, super].
  // D² (n-2 × n) second-difference operator → D²ᵀD² is (n×n) penta-diagonal.
  // We approximate it as a banded tridiagonal for numerical efficiency:
  //   main[i]  += λ·(terms from D'D)
  // Full penta-diagonal banded Cholesky:
  const diag0 = new Float64Array(n);   // main diagonal
  const diag1 = new Float64Array(n);   // super-/sub-diagonal (offset 1)
  const diag2 = new Float64Array(n);   // super-/sub-diagonal (offset 2)

  // Precompute D'D contributions (second-difference penalty, banded)
  for (let i = 0; i < n - 2; i++) {
    diag0[i]   += lam;
    diag0[i+1] += 4 * lam;
    diag0[i+2] += lam;
    diag1[i]   -= 2 * lam;   // offset-1
    diag1[i+1] -= 2 * lam;
    diag2[i]   += lam;       // offset-2
  }

  // Initialise weights and baseline
  let w = new Float64Array(n).fill(p);
  let z = Float64Array.from(y);

  for (let iter = 0; iter < maxIter; iter++) {
    // Build  H = W + λ·D'D  as banded matrix (3 diagonals: 0,1,2)
    const h0 = diag0.slice();
    const h1 = diag1.slice();
    const h2 = diag2.slice();
    for (let i = 0; i < n; i++) h0[i] += w[i];

    // RHS = W·y
    const rhs = new Float64Array(n);
    for (let i = 0; i < n; i++) rhs[i] = w[i] * y[i];

    // Banded Cholesky forward sweep (Thomas-like for bandwidth 2)
    // LDL' factorisation of symmetric positive-definite banded matrix
    const L0 = new Float64Array(n);
    const L1 = new Float64Array(n);
    const L2 = new Float64Array(n);
    L0[0] = h0[0];
    L1[0] = h1[0] / L0[0];
    L2[0] = h2[0] / L0[0];
    L0[1] = h0[1] - L1[0] * L1[0] * L0[0];
    if (n > 2) {
      L1[1] = (h1[1] - L2[0] * L1[0] * L0[0]) / L0[1];
      L2[1] = h2[1] / L0[1];
    }
    for (let i = 2; i < n; i++) {
      L0[i] = h0[i] - L1[i-1]*L1[i-1]*L0[i-1] - L2[i-2]*L2[i-2]*L0[i-2];
      if (L0[i] < 1e-30) L0[i] = 1e-30; // numerical guard
      if (i < n - 1) L1[i] = (h1[i] - L2[i-1]*L1[i-1]*L0[i-1]) / L0[i];
      if (i < n - 2) L2[i] = h2[i] / L0[i];
    }

    // Forward substitution  L·d = rhs
    const d = rhs.slice();
    d[0] /= L0[0];
    if (n > 1) d[1] = (d[1] - L1[0]*L0[0]*d[0]) / L0[1];
    for (let i = 2; i < n; i++) {
      d[i] = (d[i] - L1[i-1]*L0[i-1]*d[i-1] - L2[i-2]*L0[i-2]*d[i-2]) / L0[i];
    }

    // Back substitution  L'·z = d
    const znew = d;
    znew[n-1] = d[n-1];
    if (n > 1) znew[n-2] = d[n-2] - L1[n-2]*znew[n-1];
    for (let i = n - 3; i >= 0; i--) {
      znew[i] = d[i] - L1[i]*znew[i+1] - L2[i]*znew[i+2];
    }
    z = znew;

    // Update asymmetric weights
    for (let i = 0; i < n; i++) {
      w[i] = y[i] > z[i] ? p : (1 - p);
    }
  }

  return Array.from(z);
}

// ═══════════════════════════════════════════════════════════════════════════════
// 3b. SNIP BASELINE  (Ryan et al. 1988)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Statistics-sensitive Non-linear Iterative Peak-clipping (SNIP) baseline.
 * Standard in nuclear/γ-spectroscopy and XRD continuum removal.
 *
 * Reference: Ryan et al., Nucl. Instrum. Methods B 34, 396–402 (1988).
 */
export function snipBaseline(y: number[], iterations = 24): number[] {
  const bg = [...y];
  for (let m = 1; m <= iterations; m++) {
    const tmp = bg.slice();
    for (let i = m; i < y.length - m; i++) {
      const v = (tmp[i - m] + tmp[i + m]) / 2;
      if (v < bg[i]) bg[i] = v;
    }
  }
  return bg;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 3c. SHIRLEY BACKGROUND  (Shirley 1972)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Self-consistent iterative Shirley step-background subtraction for XPS/UPS.
 *
 * B(E) = y_N + (y_1 − y_N) · [Σ_{j=i}^N (y_j − B_j)] / [Σ_{j=1}^N (y_j − B_j)]
 *
 * Reference: Shirley D.A., Phys. Rev. B 5, 4709 (1972).
 */
export function shirleyBaseline(y: number[], maxIter = 15): number[] {
  const len = y.length;
  if (len < 3) return new Array(len).fill(y[len - 1]);

  let bg = new Array(len).fill(0);
  const yStart = y[0];
  const yEnd   = y[len - 1];

  // Initialise with linear background
  for (let i = 0; i < len; i++)
    bg[i] = yEnd + (yStart - yEnd) * ((len - 1 - i) / (len - 1));

  for (let iter = 0; iter < maxIter; iter++) {
    let sumActive = 0;
    for (let i = 0; i < len; i++) sumActive += Math.max(y[i] - bg[i], 0);
    if (sumActive < 1e-9) break;

    const nextBg = [...bg];
    let accum = 0;
    for (let i = len - 1; i >= 0; i--) {
      accum += Math.max(y[i] - bg[i], 0);
      nextBg[i] = yEnd + (yStart - yEnd) * (accum / sumActive);
    }

    let diff = 0;
    for (let i = 0; i < len; i++) diff += Math.abs(nextBg[i] - bg[i]);
    bg = nextBg;
    if (diff < 1e-4) break;
  }
  return bg;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 4. SCIENTIFIC ANALYSIS — linear regression, trapezoidal integration
// ═══════════════════════════════════════════════════════════════════════════════

export interface LinearRegressionResult {
  m: number;
  c: number;
  r2: number;
  se_m: number;   // Standard error on slope
  se_c: number;   // Standard error on intercept
  rmse: number;   // Root-mean-square error of fit
}

/**
 * Ordinary least-squares linear regression with standard errors.
 * Returns slope m, intercept c, R², SE(m), SE(c), and RMSE.
 */
export function linearRegression(
  x: number[],
  y: number[]
): LinearRegressionResult {
  const n = x.length;
  let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0, sumYY = 0;
  for (let i = 0; i < n; i++) {
    sumX  += x[i];
    sumY  += y[i];
    sumXY += x[i] * y[i];
    sumXX += x[i] * x[i];
    sumYY += y[i] * y[i];
  }
  const denom = n * sumXX - sumX * sumX;
  if (Math.abs(denom) < 1e-30) return { m: 0, c: 0, r2: 0, se_m: 0, se_c: 0, rmse: 0 };

  const m = (n * sumXY - sumX * sumY) / denom;
  const c = (sumY - m * sumX) / n;
  const meanY = sumY / n;

  let sst = 0, ssr = 0;
  for (let i = 0; i < n; i++) {
    sst += (y[i] - meanY) ** 2;
    ssr += (y[i] - (m * x[i] + c)) ** 2;
  }
  const r2   = sst < 1e-30 ? 1 : 1 - ssr / sst;
  const rmse = Math.sqrt(ssr / Math.max(n - 2, 1));
  const s2   = ssr / Math.max(n - 2, 1);
  const se_m = Math.sqrt(s2 * n / denom);
  const se_c = Math.sqrt(s2 * sumXX / denom);

  return { m, c, r2, se_m, se_c, rmse };
}

/** Trapezoidal numerical integration of (x, y). */
export function trapezoidalIntegration(x: number[], y: number[]): number {
  let area = 0;
  for (let i = 0; i < x.length - 1; i++)
    area += 0.5 * (x[i + 1] - x[i]) * (y[i] + y[i + 1]);
  return Math.abs(area);
}

// ═══════════════════════════════════════════════════════════════════════════════
// 5. PRINCIPAL COMPONENT ANALYSIS (NIPALS power-iteration)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * NIPALS PCA for up to min(nDatasets, 2) principal components.
 * Mean-centres the data matrix before decomposition.
 */
export function runPCASVD(matrices: number[][], refX: number[]): PCAOutput {
  const mCount = matrices.length;
  const nCount = matrices[0].length;

  // Mean-centring
  const centered = matrices.map(r => [...r]);
  const colMeans = new Array(nCount).fill(0);
  for (let j = 0; j < nCount; j++) {
    for (let i = 0; i < mCount; i++) colMeans[j] += matrices[i][j];
    colMeans[j] /= mCount;
    for (let i = 0; i < mCount; i++) centered[i][j] -= colMeans[j];
  }

  let totalVar = 0;
  for (let i = 0; i < mCount; i++)
    for (let j = 0; j < nCount; j++)
      totalVar += centered[i][j] ** 2;
  totalVar = totalVar || 1e-9;

  const maxPCs = Math.min(mCount, 2);
  const allScores: number[][] = [];
  const allLoadings: number[][] = [];
  const variances: number[] = [];
  let resid = centered.map(r => [...r]);

  for (let pc = 0; pc < maxPCs; pc++) {
    let score = new Array(mCount).fill(1);
    let loading = new Array(nCount).fill(0);
    for (let iter = 0; iter < 40; iter++) {
      for (let j = 0; j < nCount; j++) {
        loading[j] = 0;
        for (let i = 0; i < mCount; i++) loading[j] += resid[i][j] * score[i];
      }
      let normL = 0;
      for (let j = 0; j < nCount; j++) normL += loading[j] ** 2;
      normL = Math.sqrt(normL) || 1e-9;
      for (let j = 0; j < nCount; j++) loading[j] /= normL;
      for (let i = 0; i < mCount; i++) {
        score[i] = 0;
        for (let j = 0; j < nCount; j++) score[i] += resid[i][j] * loading[j];
      }
    }
    let varSum = 0;
    for (let i = 0; i < mCount; i++) varSum += score[i] ** 2;
    variances.push(varSum / totalVar);
    allLoadings.push(loading);
    allScores.push(score);
    for (let i = 0; i < mCount; i++)
      for (let j = 0; j < nCount; j++)
        resid[i][j] -= score[i] * loading[j];
  }

  const scores: number[][] = Array.from({ length: mCount }, (_, ds) =>
    Array.from({ length: maxPCs }, (_, p) => allScores[p][ds])
  );
  return { refX, scores, loadings: allLoadings, explainedVariance: variances };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 6. PEAK PROFILES
// ═══════════════════════════════════════════════════════════════════════════════

/** Gaussian profile: G(x) = A · exp(−(x−μ)² / (2σ²)) */
export function gaussianProfile(x: number, amp: number, cen: number, wid: number): number {
  if (wid <= 0) return 0;
  return amp * Math.exp(-((x - cen) ** 2) / (2 * wid * wid));
}

/** Lorentzian (Cauchy) profile: L(x) = A · Γ² / ((x−μ)² + Γ²) */
export function lorentzianProfile(x: number, amp: number, cen: number, wid: number): number {
  if (wid <= 0) return 0;
  return amp * (wid * wid) / ((x - cen) ** 2 + wid * wid);
}

/**
 * Pseudo-Voigt profile: V(x) = η·L(x) + (1−η)·G(x)
 * where η ∈ [0,1] is the Lorentzian mixing parameter.
 */
export function voigtProfile(x: number, amp: number, cen: number, wid: number, eta = 0.5): number {
  return eta * lorentzianProfile(x, amp, cen, wid) +
        (1 - eta) * gaussianProfile(x, amp, cen, wid);
}

// ─── FWHM helpers ────────────────────────────────────────────────────────────

/**
 * Analytical FWHM (σ → FWHM) for each profile type.
 *
 * Gaussian:   FWHM = 2√(2·ln2) · σ  ≈  2.3548·σ
 * Lorentzian: FWHM = 2·Γ
 * Pseudo-Voigt: weighted combination of the above
 */
function fwhmFromParams(
  wid: number,
  profile: 'Gaussian' | 'Lorentzian' | 'Voigt',
  eta = 0.5
): number {
  const fwhmG = 2 * Math.sqrt(2 * Math.LN2) * wid;  // 2.3548·σ
  const fwhmL = 2 * wid;
  if (profile === 'Gaussian')   return fwhmG;
  if (profile === 'Lorentzian') return fwhmL;
  // Pseudo-Voigt: Thompson et al. approximation
  return eta * fwhmL + (1 - eta) * fwhmG;
}

/**
 * Analytical peak area for each profile.
 *
 * Gaussian:   ∫G dx = A·σ·√(2π)
 * Lorentzian: ∫L dx = A·Γ·π
 * Pseudo-Voigt: weighted combination
 */
function areaFromParams(
  amp: number,
  wid: number,
  profile: 'Gaussian' | 'Lorentzian' | 'Voigt',
  eta = 0.5
): number {
  const areaG = amp * wid * Math.sqrt(2 * Math.PI);
  const areaL = amp * wid * Math.PI;
  if (profile === 'Gaussian')   return areaG;
  if (profile === 'Lorentzian') return areaL;
  return eta * areaL + (1 - eta) * areaG;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 6b. NELDER–MEAD MULTI-PEAK FITTER with FWHM / area / χ² / R² output
// ═══════════════════════════════════════════════════════════════════════════════

interface SimplexPoint { params: number[]; error: number; }

/**
 * Multi-peak Nelder–Mead curve deconvolution.
 *
 * Returns the existing raw arrays PLUS:
 *   • peakStats      — per-component centre, amplitude, FWHM, analytical area, η
 *   • goodnessOfFit  — global R², reduced χ², RMSE, degrees-of-freedom
 *
 * @param x           Spectral axis values
 * @param y           Processed intensity values to fit
 * @param initialPeaks Seed peak positions from peak-picker
 * @param profile     'Gaussian' | 'Lorentzian' | 'Voigt'
 * @param constraints  Boundary enforcement parameters
 *
 * Reference: Nelder & Mead, Computer Journal 7, 308–313 (1965).
 */
export function fitSpectralPeaks(
  x: number[],
  y: number[],
  initialPeaks: PeakData[],
  profile: 'Gaussian' | 'Lorentzian' | 'Voigt',
  constraints: {
    enforce: boolean;
    centerTol: number;
    widthMin: number;
    widthMax: number;
  }
): FitResult {
  const peakCount = initialPeaks.length;
  if (peakCount === 0) {
    return {
      fitResult: [],
      fitComponents: [],
      fitResiduals: [],
      peakStats: [],
      goodnessOfFit: { r2: 0, chi2: 0, rmse: 0, dof: 0 },
    };
  }

  const dimPerPeak = profile === 'Voigt' ? 4 : 3;
  const numParams  = peakCount * dimPerPeak;
  const initialWid = (x[x.length - 1] - x[0]) / 35;

  // Build initial parameter vector
  const initP: number[] = [];
  for (const p of initialPeaks) {
    initP.push(p.y, p.x, initialWid);
    if (profile === 'Voigt') initP.push(0.5);
  }

  // Objective: SSR + penalty barriers
  const objective = (params: number[]): number => {
    let penalty = 0;
    for (let i = 0; i < peakCount; i++) {
      const b   = i * dimPerPeak;
      const amp = params[b];
      const wid = params[b + 2];
      const eta = profile === 'Voigt' ? params[b + 3] : 0.5;

      if (amp < 0)             penalty += 1e6 * amp ** 2;
      if (wid < constraints.widthMin) penalty += 1e6 * (constraints.widthMin - wid) ** 2;
      if (wid > constraints.widthMax) penalty += 1e6 * (wid - constraints.widthMax) ** 2;
      if (constraints.enforce) {
        const dist = Math.abs(params[b + 1] - initialPeaks[i].x);
        if (dist > constraints.centerTol) penalty += 1e6 * (dist - constraints.centerTol) ** 2;
      }
      if (profile === 'Voigt') {
        if (eta < 0) penalty += 1e6 * eta ** 2;
        if (eta > 1) penalty += 1e6 * (eta - 1) ** 2;
      }
    }

    let ssr = 0;
    for (let j = 0; j < x.length; j++) {
      let yHat = 0;
      for (let i = 0; i < peakCount; i++) {
        const b = i * dimPerPeak;
        const [amp, cen, wid] = [params[b], params[b + 1], params[b + 2]];
        if (profile === 'Gaussian')   yHat += gaussianProfile(x[j], amp, cen, wid);
        else if (profile === 'Lorentzian') yHat += lorentzianProfile(x[j], amp, cen, wid);
        else yHat += voigtProfile(x[j], amp, cen, wid, params[b + 3]);
      }
      ssr += (y[j] - yHat) ** 2;
    }
    return ssr + penalty;
  };

  const mkPt = (p: number[]): SimplexPoint => ({ params: p, error: objective(p) });

  // Initialise simplex
  let simplex: SimplexPoint[] = [mkPt([...initP])];
  for (let i = 0; i < numParams; i++) {
    const p = [...initP];
    p[i] = p[i] !== 0 ? p[i] * 1.05 : 0.05;
    simplex.push(mkPt(p));
  }

  // Nelder–Mead iterations
  const α = 1.0, γ = 2.0, ρ = 0.5, σ = 0.5;
  for (let iter = 0; iter < 1200; iter++) {
    simplex.sort((a, b) => a.error - b.error);
    const best = simplex[0];
    const worst = simplex[numParams];
    const centroid = new Array(numParams).fill(0);
    for (let j = 0; j < numParams; j++)
      for (let i = 0; i < numParams; i++)
        centroid[j] += simplex[i].params[j] / numParams;

    const reflected = mkPt(centroid.map((c, i) => c + α * (c - worst.params[i])));

    if (reflected.error < simplex[numParams - 1].error && reflected.error >= best.error) {
      simplex[numParams] = reflected;
    } else if (reflected.error < best.error) {
      const expanded = mkPt(centroid.map((c, i) => c + γ * (reflected.params[i] - c)));
      simplex[numParams] = expanded.error < reflected.error ? expanded : reflected;
    } else {
      const contracted = mkPt(centroid.map((c, i) => c + ρ * (worst.params[i] - c)));
      if (contracted.error < worst.error) {
        simplex[numParams] = contracted;
      } else {
        for (let j = 1; j <= numParams; j++) {
          simplex[j] = mkPt(simplex[j].params.map((v, i) => best.params[i] + σ * (v - best.params[i])));
        }
      }
    }
    if (Math.abs(simplex[numParams].error - simplex[0].error) < 1e-8) break;
  }

  // Extract optimised parameters
  const best = simplex[0].params;

  // Build output arrays
  const fitResult    = new Array(x.length).fill(0);
  const fitResiduals = new Array(x.length).fill(0);
  const fitComponents: number[][] = Array.from({ length: peakCount }, () => new Array(x.length).fill(0));

  for (let j = 0; j < x.length; j++) {
    for (let i = 0; i < peakCount; i++) {
      const b = i * dimPerPeak;
      const [amp, cen, wid] = [best[b], best[b + 1], best[b + 2]];
      let v = 0;
      if (profile === 'Gaussian')    v = gaussianProfile(x[j], amp, cen, wid);
      else if (profile === 'Lorentzian') v = lorentzianProfile(x[j], amp, cen, wid);
      else v = voigtProfile(x[j], amp, cen, wid, best[b + 3]);
      fitComponents[i][j] = v;
      fitResult[j] += v;
    }
    fitResiduals[j] = y[j] - fitResult[j];
  }

  // ── Global goodness-of-fit (computed first — needed for σ̂² below) ───────
  const N   = x.length;
  const dof = Math.max(N - numParams, 1);
  const ssr = fitResiduals.reduce((s, r) => s + r * r, 0);
  const meanY = y.reduce((s, v) => s + v, 0) / N;
  const sst = y.reduce((s, v) => s + (v - meanY) ** 2, 0);
  const r2   = sst < 1e-30 ? 1 : 1 - ssr / sst;
  const chi2 = ssr / dof;
  const rmse = Math.sqrt(ssr / N);

  // ── Parameter uncertainty: covariance Σ = σ̂²·(JᵀJ)⁻¹ ────────────────────
  // J is the Jacobian of the model residuals w.r.t. fit parameters, evaluated
  // at the optimum via central finite differences (Nelder–Mead gives no
  // analytical Jacobian). This is the same asymptotic-covariance approach
  // used by e.g. scipy.optimize.curve_fit's `pcov`.
  let covMatrix: number[][] | null = null;
  const hasEnoughDof = N - numParams > 0;
  if (hasEnoughDof) {
    try {
      const modelAt = (p: number[]): number[] => {
        const yHat = new Array(N).fill(0);
        for (let j = 0; j < N; j++) {
          for (let i = 0; i < peakCount; i++) {
            const b = i * dimPerPeak;
            const [amp, cen, wid] = [p[b], p[b + 1], p[b + 2]];
            if (profile === 'Gaussian') yHat[j] += gaussianProfile(x[j], amp, cen, wid);
            else if (profile === 'Lorentzian') yHat[j] += lorentzianProfile(x[j], amp, cen, wid);
            else yHat[j] += voigtProfile(x[j], amp, cen, wid, p[b + 3]);
          }
        }
        return yHat;
      };

      const J: number[][] = Array.from({ length: N }, () => new Array(numParams).fill(0));
      for (let k = 0; k < numParams; k++) {
        const h = Math.max(Math.abs(best[k]) * 1e-6, 1e-8);
        const pPlus = [...best]; pPlus[k] += h;
        const pMinus = [...best]; pMinus[k] -= h;
        const yPlus = modelAt(pPlus);
        const yMinus = modelAt(pMinus);
        for (let j = 0; j < N; j++) J[j][k] = (yPlus[j] - yMinus[j]) / (2 * h);
      }

      const Jt = transpose(J);
      const JtJ = multiply(Jt, J);
      const JtJinv = invert(JtJ); // throws if singular — caught below
      const sigma2 = ssr / dof;
      covMatrix = JtJinv.map(row => row.map(v => v * sigma2));

      // Reject a covariance matrix with any negative variance on the
      // diagonal (numerically unstable fit — e.g. near-degenerate peaks).
      if (covMatrix.some((row, i) => row[i] < 0)) covMatrix = null;
    } catch {
      covMatrix = null;
    }
  }

  const kGauss = 2 * Math.sqrt(2 * Math.LN2); // FWHM = kGauss·σ
  const kLorentz = 2;                          // FWHM = kLorentz·Γ
  const cGauss = Math.sqrt(2 * Math.PI);       // area = amp·wid·cGauss
  const cLorentz = Math.PI;                    // area = amp·wid·cLorentz

  // ── Per-peak statistics (+ propagated parameter uncertainty) ────────────
  const peakStats: FitPeakStats[] = initialPeaks.map((_, i) => {
    const b   = i * dimPerPeak;
    const amp = best[b];
    const cen = best[b + 1];
    const wid = Math.abs(best[b + 2]);
    const eta = profile === 'Voigt' ? best[b + 3] : undefined;

    const stat: FitPeakStats = {
      index:     i,
      center:    cen,
      amplitude: amp,
      fwhm:      fwhmFromParams(wid, profile, eta ?? 0.5),
      area:      areaFromParams(amp, wid, profile, eta ?? 0.5),
      ...(profile === 'Voigt' ? { eta } : {}),
    };

    if (covMatrix) {
      const varAmp = Math.max(covMatrix[b][b], 0);
      const varWid = Math.max(covMatrix[b + 2][b + 2], 0);
      const covAmpWid = covMatrix[b][b + 2];

      stat.amplitudeSE = Math.sqrt(varAmp);
      stat.centerSE = Math.sqrt(Math.max(covMatrix[b + 1][b + 1], 0));

      if (profile === 'Voigt') {
        const varEta = Math.max(covMatrix[b + 3][b + 3], 0);
        const covWidEta = covMatrix[b + 2][b + 3];
        const covAmpEta = covMatrix[b][b + 3];
        stat.etaSE = Math.sqrt(varEta);

        // Delta-method propagation for fwhm = η·kL·wid + (1−η)·kG·wid
        const dFwhm_dWid = eta! * kLorentz + (1 - eta!) * kGauss;
        const dFwhm_dEta = wid * (kLorentz - kGauss);
        const varFwhm =
          dFwhm_dWid ** 2 * varWid +
          dFwhm_dEta ** 2 * varEta +
          2 * dFwhm_dWid * dFwhm_dEta * covWidEta;
        stat.fwhmSE = Math.sqrt(Math.max(varFwhm, 0));

        // Delta-method propagation for area = amp·wid·(η·cL + (1−η)·cG)
        const dArea_dAmp = wid * (eta! * cLorentz + (1 - eta!) * cGauss);
        const dArea_dWid = amp * (eta! * cLorentz + (1 - eta!) * cGauss);
        const dArea_dEta = amp * wid * (cLorentz - cGauss);
        const varArea =
          dArea_dAmp ** 2 * varAmp +
          dArea_dWid ** 2 * varWid +
          dArea_dEta ** 2 * varEta +
          2 * dArea_dAmp * dArea_dWid * covAmpWid +
          2 * dArea_dAmp * dArea_dEta * covAmpEta +
          2 * dArea_dWid * dArea_dEta * covWidEta;
        stat.areaSE = Math.sqrt(Math.max(varArea, 0));
      } else {
        const k = profile === 'Gaussian' ? kGauss : kLorentz;
        stat.fwhmSE = k * Math.sqrt(varWid);

        const c = profile === 'Gaussian' ? cGauss : cLorentz;
        const dArea_dAmp = wid * c;
        const dArea_dWid = amp * c;
        const varArea =
          dArea_dAmp ** 2 * varAmp +
          dArea_dWid ** 2 * varWid +
          2 * dArea_dAmp * dArea_dWid * covAmpWid;
        stat.areaSE = Math.sqrt(Math.max(varArea, 0));
      }
    }

    return stat;
  });

  const goodnessOfFit: FitGoodnessMetrics = { r2, chi2, rmse, dof, uncertaintyAvailable: covMatrix !== null };

  return { fitResult, fitComponents, fitResiduals, peakStats, goodnessOfFit };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 7. SPECTRAL HEURISTIC EXPERT SYSTEM  (unchanged from v1.0.0)
// ═══════════════════════════════════════════════════════════════════════════════

export function spectralExpertHeuristics(
  technique: string,
  x: number
): { label: string; confidence: number } {
  const t = technique.toLowerCase();

  if (t.includes('1h nmr') || t.includes('nmr')) {
    if (x >= 0.5  && x <= 1.5)  return { label: 'Alkyl (Aliphatic -CH₃)',             confidence: 0.95 };
    if (x >  1.5  && x <= 2.5)  return { label: 'Allylic / α-Carbonyl',                confidence: 0.88 };
    if (x >  2.5  && x <= 4.5)  return { label: 'Alcohols/Halides α-O-CH₃',           confidence: 0.92 };
    if (x >  4.5  && x <= 6.5)  return { label: 'Vinylic (=C-H)',                      confidence: 0.84 };
    if (x >  6.5  && x <= 8.5)  return { label: 'Aromatic Ring C-H',                   confidence: 0.98 };
    if (x >  8.5  && x <= 10.5) return { label: 'Aldehydic (-CHO)',                     confidence: 0.99 };
    if (x >  10.5 && x <= 13.0) return { label: 'Carboxylic Acid (-COOH)',              confidence: 0.96 };
  } else if (t.includes('13c nmr')) {
    if (x >= 0   && x <= 50)  return { label: 'Saturated Aliphatic (sp³ C)',            confidence: 0.96 };
    if (x >  50  && x <= 90)  return { label: 'Heteroatom C-O/C-N',                    confidence: 0.91 };
    if (x >  90  && x <= 105) return { label: 'Acetylenic sp C',                        confidence: 0.85 };
    if (x >  105 && x <= 150) return { label: 'Alkenyl / Aromatic C',                   confidence: 0.97 };
    if (x >  150 && x <= 185) return { label: 'Esters/Amides Carbonyl C',               confidence: 0.93 };
    if (x >  185 && x <= 220) return { label: 'Aldehyde / Ketone C=O',                  confidence: 0.99 };
  } else if (t.includes('ftir') || t.includes('raman') || t.includes('infrared')) {
    if (x >= 3200 && x <= 3650) return { label: 'O-H / N-H Stretch (H-bonded)',         confidence: 0.94 };
    if (x >= 2820 && x <= 3000) return { label: 'Aliphatic C-H Stretch',                confidence: 0.97 };
    if (x >  3000 && x <= 3150) return { label: 'Aromatic / Alkynyl C-H Stretch',       confidence: 0.89 };
    if (x >= 2200 && x <= 2260) return { label: 'Alkyne / Nitrile -C≡C- / -C≡N',       confidence: 0.99 };
    if (x >= 1650 && x <= 1780) return { label: 'Carbonyl C=O Stretch (Strong)',         confidence: 0.99 };
    if (x >= 1500 && x <= 1650) return { label: 'Aromatic C=C / Alkene Stretch',         confidence: 0.88 };
    if (x >= 1000 && x <= 1300) return { label: 'C-O Single Bond Stretch',               confidence: 0.82 };
    if (x >= 600  && x <= 950)  return { label: 'C-H Out-of-Plane Bend',                confidence: 0.78 };
  } else if (t.includes('uv-vis') || t.includes('uv')) {
    if (x >= 200 && x <= 255) return { label: 'Benzene Ring π→π* Transition',           confidence: 0.88 };
    if (x >  255 && x <= 350) return { label: 'Heteroatom n→π* Conjugation',            confidence: 0.82 };
    if (x >  350 && x <= 450) return { label: 'Metal-Ligand Charge Transfer',            confidence: 0.75 };
    if (x >  450 && x <= 800) return { label: 'Extended Chromophore / Plasmon',          confidence: 0.85 };
  } else if (t.includes('xps')) {
    if (x >= 284 && x <= 285.5) return { label: 'C 1s (sp³/sp² C-C)',                  confidence: 0.98 };
    if (x >= 286 && x <= 287.5) return { label: 'C 1s (Ether/Hydroxyl C-O)',            confidence: 0.92 };
    if (x >= 288 && x <= 289.5) return { label: 'C 1s (Carbonyl C=O / Carboxyl)',       confidence: 0.95 };
    if (x >= 531 && x <= 533.5) return { label: 'O 1s Core Level',                      confidence: 0.99 };
    if (x >= 398 && x <= 402)   return { label: 'N 1s Core Level',                      confidence: 0.95 };
  } else if (t.includes('pl') || t.includes('photoluminescence') || t.includes('fluorescence')) {
    if (x >= 350 && x <= 450) return { label: 'UV / Near-UV Exciton Decay',             confidence: 0.90 };
    if (x >  450 && x <= 600) return { label: 'Visible QD / Perovskite Band Edge',       confidence: 0.96 };
    if (x >  600 && x <= 850) return { label: 'Near-IR Defect / Dopant Emission',        confidence: 0.92 };
  } else if (t.includes('xrd') || t.includes('diffraction') || t.includes('x-ray')) {
    if (Math.abs(x - 38.18) <= 1.5) return { label: 'Au (111) fcc planes',              confidence: 0.99 };
    if (Math.abs(x - 44.39) <= 1.5) return { label: 'Au (200) fcc planes',              confidence: 0.98 };
    if (Math.abs(x - 64.58) <= 1.5) return { label: 'Au (220) fcc planes',              confidence: 0.98 };
    if (Math.abs(x - 77.54) <= 1.5) return { label: 'Au (311) fcc planes',              confidence: 0.99 };
    return { label: 'Bragg Diffraction Plane (hkl)',                                     confidence: 0.80 };
  }
  return { label: 'Unassigned Peak', confidence: 0.10 };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 8a. SCHERRER CRYSTALLITE SIZE  (XRD)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Scherrer equation for mean crystallite size from XRD peak broadening.
 *
 *   D = K · λ / (β · cos θ)
 *
 * where:
 *   K = Scherrer constant (0.94 for spherical crystallites, FWHM definition)
 *   λ = X-ray wavelength in Å
 *   β = FWHM of the diffraction peak in radians
 *   θ = Bragg angle (half of 2θ) in radians
 *
 * Returns D in nanometres.
 *
 * To compute β automatically, pass the spectrum (x in 2θ °, y in counts) and
 * the nominal 2θ position of the peak; the function fits a Gaussian to a window
 * around that position to extract the FWHM.
 *
 * @param twoTheta_deg  Nominal 2θ peak position in degrees
 * @param xData         Full 2θ axis array (degrees)
 * @param yData         Diffraction intensity array (counts / a.u.)
 * @param lambda_A      X-ray wavelength in Ångström (default 1.5406 Å for Cu Kα₁)
 * @param K             Scherrer constant (default 0.9394)
 * @param windowDeg     Half-width of fit window around the peak in degrees (default 2.0)
 *
 * Reference: Scherrer P., Göttinger Nachrichten Gesell. 2, 98 (1918).
 *            Patterson A.L., Phys. Rev. 56, 978 (1939).
 */
export function scherrerSize(
  twoTheta_deg: number,
  xData: number[],
  yData: number[],
  lambda_A  = 1.5406,
  K         = 0.9394,
  windowDeg = 2.0
): ScherrerResult {
  // 1. Extract window around the nominated peak
  const tMin = twoTheta_deg - windowDeg;
  const tMax = twoTheta_deg + windowDeg;
  const wx: number[] = [];
  const wy: number[] = [];
  for (let i = 0; i < xData.length; i++) {
    if (xData[i] >= tMin && xData[i] <= tMax) {
      wx.push(xData[i]);
      wy.push(yData[i]);
    }
  }
  if (wx.length < 5) throw new Error(`Too few points (${wx.length}) within ±${windowDeg}° of ${twoTheta_deg}°. Widen the window.`);

  // 2. Subtract local linear baseline (between endpoints of window)
  const base0 = wy[0];
  const base1 = wy[wy.length - 1];
  const wyBC  = wy.map((v, i) => v - (base0 + (base1 - base0) * i / (wy.length - 1)));

  // 3. Fit a Gaussian to extract FWHM via Nelder–Mead simplex
  const amp0  = Math.max(...wyBC);
  const cenIdx = wyBC.indexOf(amp0);
  const cen0  = wx[cenIdx];

  // Data-driven initial width estimate: find where the signal crosses half-max
  // on either side of the peak, rather than guessing a fixed fraction of the
  // search window (which can be off by several-fold for sharp peaks and stalls
  // the simplex in poorly-conditioned regions).
  const halfMax = amp0 / 2;
  let leftIdx = cenIdx, rightIdx = cenIdx;
  while (leftIdx > 0 && wyBC[leftIdx] > halfMax) leftIdx--;
  while (rightIdx < wyBC.length - 1 && wyBC[rightIdx] > halfMax) rightIdx++;
  const fwhmEstimate = Math.max(wx[rightIdx] - wx[leftIdx], (wx[1] - wx[0]) * 4);
  const wid0 = fwhmEstimate / (2 * Math.sqrt(2 * Math.LN2));  // FWHM → sigma

  const objG = (p: number[]): number => {
    let sse = 0;
    for (let i = 0; i < wx.length; i++) {
      const yHat = p[0] * Math.exp(-((wx[i] - p[1]) ** 2) / (2 * p[2] ** 2));
      sse += (wyBC[i] - yHat) ** 2;
    }
    return sse;
  };

  let sp: SimplexPoint[] = [{ params: [amp0, cen0, wid0], error: objG([amp0, cen0, wid0]) }];
  for (let i = 0; i < 3; i++) {
    const p = [amp0, cen0, wid0];
    p[i] = p[i] !== 0 ? p[i] * 1.1 : 0.1;
    sp.push({ params: p, error: objG(p) });
  }
  // sp now has 4 vertices (n+1 for n=3 parameters) — required for a valid simplex
  const nDim = 3;
  for (let it = 0; it < 800; it++) {
    sp.sort((a, b) => a.error - b.error);
    const worstIdx = nDim;
    const centroid = [0, 0, 0].map((_, k) =>
      sp.slice(0, nDim).reduce((s, pt) => s + pt.params[k], 0) / nDim
    );
    const worst = sp[worstIdx];
    const reflected = { params: centroid.map((c, k) => c + 1.0 * (c - worst.params[k])), error: 0 };
    reflected.error = objG(reflected.params);

    if (reflected.error < sp[0].error) {
      const expanded = { params: centroid.map((c, k) => c + 2.0 * (reflected.params[k] - c)), error: 0 };
      expanded.error = objG(expanded.params);
      sp[worstIdx] = expanded.error < reflected.error ? expanded : reflected;
    } else if (reflected.error < sp[worstIdx - 1].error) {
      sp[worstIdx] = reflected;
    } else {
      const contracted = { params: centroid.map((c, k) => c + 0.5 * (worst.params[k] - c)), error: 0 };
      contracted.error = objG(contracted.params);
      if (contracted.error < worst.error) {
        sp[worstIdx] = contracted;
      } else {
        // Shrink all points (except best) toward the best vertex
        for (let j = 1; j <= worstIdx; j++) {
          sp[j].params = sp[j].params.map((v, k) => sp[0].params[k] + 0.5 * (v - sp[0].params[k]));
          sp[j].error  = objG(sp[j].params);
        }
      }
    }
    if (Math.abs(sp[worstIdx].error - sp[0].error) < 1e-10) break;
  }
  sp.sort((a, b) => a.error - b.error);
  const [, center_deg, sigma_deg] = sp[0].params;

  // 4. FWHM in degrees → radians
  const fwhm_deg = 2 * Math.sqrt(2 * Math.LN2) * Math.abs(sigma_deg);
  const beta_rad = fwhm_deg * (Math.PI / 180);

  // 5. Bragg angle θ in radians
  const theta_rad = (center_deg / 2) * (Math.PI / 180);

  // 6. Scherrer equation: D = K·λ / (β·cosθ), convert λ from Å to nm
  const lambda_nm = lambda_A / 10;
  const D_nm      = (K * lambda_nm) / (beta_rad * Math.cos(theta_rad));

  return {
    D_nm:             parseFloat(D_nm.toFixed(3)),
    K,
    lambda_angstrom:  lambda_A,
    beta_rad:         parseFloat(beta_rad.toFixed(6)),
    theta_deg:        parseFloat((center_deg / 2).toFixed(4)),
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 8b. URBACH ENERGY  (sub-bandgap exponential tail analysis)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Urbach energy (Eᵤ) from the exponential absorption edge of UV-Vis / PL spectra.
 *
 * In the sub-gap region, the absorption coefficient follows:
 *   α(E) = α₀ · exp(E / Eᵤ)
 * Taking logarithms:
 *   ln α = ln α₀ + E / Eᵤ
 * A linear regression of ln(α) vs E over the Urbach tail gives:
 *   slope = 1/Eᵤ  →  Eᵤ = 1/slope
 *
 * The function locates the Urbach tail automatically as the region on the
 * low-energy side of the main absorption onset where ln(α) is most linear
 * (maximum R² in a sliding 20-point window).
 *
 * @param wavelength_nm  Wavelength axis in nm  (UV-Vis convention)
 * @param absorbance     Absorbance (or α·d) values
 * @param windowFraction Fraction of spectrum to use for tail fitting (default 0.25)
 *
 * Reference: Urbach F., Phys. Rev. 92, 1324 (1953).
 */
export function urbachEnergy(
  wavelength_nm: number[],
  absorbance:    number[],
  windowFraction = 0.25
): UrbachResult {
  const n = wavelength_nm.length;
  if (n < 20) throw new Error('Urbach fit requires at least 20 data points.');

  // Convert wavelength → photon energy (eV)
  const E   = wavelength_nm.map(λ => 1240 / λ);  // eV
  const lnA = absorbance.map(a => Math.log(Math.max(a, 1e-12)));

  // Sort by ascending energy
  const idx  = Array.from({ length: n }, (_, i) => i).sort((a, b) => E[a] - E[b]);
  const Es   = idx.map(i => E[i]);
  const lnAs = idx.map(i => lnA[i]);

  // Sliding window: find the sub-gap linear region with best R²
  const winPts  = Math.max(10, Math.floor(n * windowFraction));
  let bestR2    = -Infinity;
  let bestStart = 0;

  for (let s = 0; s <= n - winPts; s++) {
    const xw = Es.slice(s, s + winPts);
    const yw = lnAs.slice(s, s + winPts);
    const { r2 } = linearRegression(xw, yw);
    // Only consider regions where slope > 0 (rising with energy)
    const { m } = linearRegression(xw, yw);
    if (r2 > bestR2 && m > 0) {
      bestR2    = r2;
      bestStart = s;
    }
  }

  const xFit = Es.slice(bestStart, bestStart + winPts);
  const yFit = lnAs.slice(bestStart, bestStart + winPts);
  const { m, c, r2 } = linearRegression(xFit, yFit);

  // Eᵤ = 1/slope (slope = 1/Eᵤ in units of eV⁻¹)
  const Eu_eV  = Math.abs(1 / m);
  const alpha0 = Math.exp(c);

  return {
    Eu_eV:       parseFloat(Eu_eV.toFixed(4)),
    alpha0:      parseFloat(alpha0.toExponential(4)),
    r2:          parseFloat(r2.toFixed(5)),
    fitRange_eV: [parseFloat(xFit[0].toFixed(4)), parseFloat(xFit[xFit.length - 1].toFixed(4))],
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 8c. STERN–VOLMER FLUORESCENCE QUENCHING
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Stern–Volmer quenching analysis for fluorescence sensing.
 *
 * Linear model:  I₀/I = 1 + K_sv · [Q]
 *
 * Upward curvature in the I₀/I vs [Q] plot is diagnostic of combined
 * static + dynamic quenching; the function flags this automatically by
 * comparing linear vs quadratic fits.
 *
 * @param concentrations  Quencher concentrations [Q] (e.g. in μM or M)
 * @param intensities     Fluorescence intensities at each [Q]
 *                        (I₀ is inferred as intensities[0] at [Q]=0, OR
 *                         pass I₀ explicitly as the first element with [Q]=0)
 * @param tau0_ns         Optional fluorescence lifetime τ₀ in ns for k_q calculation
 *
 * Reference: Stern O. & Volmer M., Phys. Z. 20, 183 (1919).
 */
export function sternVolmer(
  concentrations: number[],
  intensities:    number[],
  tau0_ns?:       number
): SternVolmerResult {
  const n = concentrations.length;
  if (n < 3) throw new Error('Stern–Volmer analysis requires at least 3 [Q] points.');

  // I₀ = intensity at lowest concentration (assumed near zero)
  const I0    = intensities[0];
  const ratio = intensities.map(I => I0 / Math.max(I, 1e-12));  // I₀/I

  // Linear regression:  I₀/I = 1 + Ksv·[Q]
  const { m: Ksv, c: intercept, r2 } = linearRegression(concentrations, ratio);

  // Check for upward curvature: fit a quadratic and compare R²
  // Quadratic:  I₀/I = 1 + (Ksv_d + Ksv_s)·[Q] + Ksv_d·Ksv_s·[Q]²
  const Q2  = concentrations.map(q => q * q);
  const { r2: r2_quad } = linearRegression(Q2, ratio.map((r, i) => r - 1 - Ksv * concentrations[i]));
  const isCombined = r2_quad > 0.85 && r2_quad > r2 + 0.05;

  // Bimolecular quenching rate: kq = Ksv / τ₀
  const kq = tau0_ns !== undefined
    ? Ksv / (tau0_ns * 1e-9)  // M⁻¹ s⁻¹
    : undefined;

  return {
    Ksv:         parseFloat(Ksv.toFixed(4)),
    intercept:   parseFloat(intercept.toFixed(4)),
    r2:          parseFloat(r2.toFixed(5)),
    isCombined,
    ...(kq !== undefined ? { kq: parseFloat(kq.toExponential(3)) } : {}),
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 8d. BEER–LAMBERT CALIBRATION CURVE WITH LOD / LOQ
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Beer–Lambert law calibration curve for quantitative UV-Vis spectroscopy.
 *
 *   A = ε · c · l
 *
 * Performs OLS regression of Absorbance vs concentration, returns the molar
 * attenuation coefficient ε, intercept, R², and analytical figures of merit
 * (LOD and LOQ) derived from the ICH Q2(R1) / IUPAC approach:
 *
 *   LOD = 3.3 · σ_blank / slope
 *   LOQ = 10  · σ_blank / slope
 *
 * where σ_blank is estimated from the residual standard error of the regression.
 *
 * @param concentrations  Array of known concentrations (mol L⁻¹ or μM, μg mL⁻¹, etc.)
 * @param absorbances     Corresponding measured absorbances at the target wavelength
 * @param pathLength_cm   Optical path length in cm (default 1.0 cm)
 *
 * Reference: Beer A., Ann. Phys. Chem. 86, 78 (1852).
 *            ICH Q2(R1) Validation of Analytical Procedures (2005).
 */
export function beerLambertCalibration(
  concentrations: number[],
  absorbances:    number[],
  pathLength_cm = 1.0
): BeerLambertResult {
  const n = concentrations.length;
  if (n < 3) throw new Error('Beer–Lambert calibration requires at least 3 standard points.');

  const { m, c, r2, se_m, rmse } = linearRegression(concentrations, absorbances);

  // ε (M⁻¹ cm⁻¹) = slope / pathLength  (when c in mol L⁻¹)
  const epsilon = m / pathLength_cm;

  // σ_blank ≈ RMSE of regression (best estimate when no blank replicates supplied)
  const sigma_blank = rmse;

  // LOD and LOQ (ICH Q2(R1) approach)
  const LOD = (3.3 * sigma_blank) / Math.max(Math.abs(m), 1e-30);
  const LOQ = (10  * sigma_blank) / Math.max(Math.abs(m), 1e-30);

  return {
    epsilon:      parseFloat(epsilon.toFixed(2)),
    pathLength:   pathLength_cm,
    intercept:    parseFloat(c.toFixed(6)),
    r2:           parseFloat(r2.toFixed(6)),
    LOD:          parseFloat(LOD.toExponential(3)),
    LOQ:          parseFloat(LOQ.toExponential(3)),
    SE_epsilon:   parseFloat((se_m / pathLength_cm).toFixed(4)),
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// ── TIER 2 ADDITIONS ─────────────────────────────────────────────────────────
// 9a. Kubelka–Munk (Diffuse Reflectance, DRS)
// 9b. Mie / Rayleigh scattering background subtraction
// 9c. Kramers–Kronig relations (real ↔ imaginary optical constants)
// 9d. Relative Photoluminescence Quantum Yield (PLQY)
// 9e. Williamson–Hall plot (XRD size + microstrain separation)
// ═══════════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────────────
// 9a. KUBELKA–MUNK TRANSFORM  (Diffuse Reflectance Spectroscopy)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Kubelka–Munk result type.
 * F(R) spectrum is ready for Tauc-style bandgap analysis when
 * multiplied by hν and raised to the appropriate power.
 */
export interface KubelkaMunkResult {
  /** F(R) = (1−R)²/(2R) values — proportional to α/S */
  FR: number[];
  /**
   * (F(R)·hν)^n values for Tauc-like bandgap plot.
   * n=2 for direct, n=0.5 for indirect allowed transitions.
   */
  taucFR: number[];
  /** Photon energy axis in eV (converted from wavelength_nm) */
  hnu_eV: number[];
  /** Bandgap estimate Eg (eV) from linear tangent on taucFR vs hν */
  Eg_eV: number;
  /** Transition type used for taucFR exponent */
  transition: 'direct' | 'indirect';
}

/**
 * Kubelka–Munk transform for solid-state diffuse reflectance spectroscopy.
 *
 *   F(R) = (1 − R)² / (2R)
 *
 * where R is the absolute diffuse reflectance (0 < R < 1).
 * If raw %R values are supplied (0–100), set `isPercent = true`.
 *
 * A modified Tauc analysis is then performed:
 *   [F(R)·hν]^n  vs  hν
 * to extract the optical bandgap Eg by linear tangent extrapolation,
 * identical to the standard Tauc approach used for thin films.
 *
 * @param wavelength_nm  Wavelength axis (nm)
 * @param reflectance    Diffuse reflectance values R (0–1 or 0–100%)
 * @param transition     'direct' (n=2) or 'indirect' (n=0.5)
 * @param isPercent      Set true if reflectance is given as %R (0–100)
 *
 * References:
 *   Kubelka P. & Munk F., Z. Tech. Phys. 12, 593 (1931).
 *   Murphy A.B., Sol. Energy Mater. Sol. Cells 91, 1326 (2007).
 */
export function kubelkaMunk(
  wavelength_nm: number[],
  reflectance:   number[],
  transition:    'direct' | 'indirect' = 'direct',
  isPercent      = false
): KubelkaMunkResult {
  const n = wavelength_nm.length;

  // Convert %R → R if needed; clamp to (0,1) to avoid division singularities
  const R = reflectance.map(r => {
    const rv = isPercent ? r / 100 : r;
    return Math.min(Math.max(rv, 1e-4), 0.9999);
  });

  // F(R) = (1-R)² / 2R
  const FR    = R.map(r => ((1 - r) ** 2) / (2 * r));
  const hnu   = wavelength_nm.map(λ => 1240 / λ);            // eV
  const power = transition === 'direct' ? 2 : 0.5;
  const taucFR = FR.map((f, i) => Math.pow(Math.max(f * hnu[i], 0), power));

  // Auto Tauc tangent: find steepest linear segment on ascending edge
  // Sort by ascending hν
  const idx    = Array.from({ length: n }, (_, i) => i).sort((a, b) => hnu[a] - hnu[b]);
  const eSorted = idx.map(i => hnu[i]);
  const ySorted = idx.map(i => taucFR[i]);

  const winPts = Math.max(8, Math.floor(n * 0.12));
  let bestSlope = 0, bestStart = 0;
  for (let s = 0; s <= n - winPts; s++) {
    const xw = eSorted.slice(s, s + winPts);
    const yw = ySorted.slice(s, s + winPts);
    const { m } = linearRegression(xw, yw);
    if (m > bestSlope) { bestSlope = m; bestStart = s; }
  }
  const xFit = eSorted.slice(bestStart, bestStart + winPts);
  const yFit = ySorted.slice(bestStart, bestStart + winPts);
  const { m: slope, c: intercept } = linearRegression(xFit, yFit);
  // Eg = x-intercept of tangent line: 0 = slope·Eg + intercept
  const Eg_eV = slope > 1e-9 ? Math.max(-intercept / slope, 0) : 0;

  return {
    FR,
    taucFR,
    hnu_eV: hnu,
    Eg_eV:  parseFloat(Eg_eV.toFixed(4)),
    transition,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 9b. MIE / RAYLEIGH SCATTERING BACKGROUND SUBTRACTION  (UV-Vis)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Result type for Mie/Rayleigh scattering subtraction.
 */
export interface ScatteringResult {
  /** Best-fit power-law exponent α (Rayleigh: α=4; Mie: α=2–4) */
  alpha: number;
  /** Pre-factor A of the A·λ^(-α) fit */
  A: number;
  /** Fitted scattering background at each wavelength */
  background: number[];
  /** Absorbance with scattering background removed */
  corrected: number[];
  /** R² of the power-law fit in the reference (scattering-only) region */
  r2: number;
}

/**
 * Power-law scattering background subtraction for colloidal UV-Vis spectra.
 *
 * Nanoparticle suspensions show a superimposed scattering baseline:
 *   A_scatter(λ) = A · λ^(−α)
 *
 * where α ≈ 4 for Rayleigh scattering (d << λ) and α ≈ 2–3 for Mie
 * scattering (d comparable to λ). The exponent is fitted by OLS in
 * log–log space using a user-specified reference region far from any
 * absorption bands, then subtracted from the full spectrum.
 *
 * @param wavelength_nm   Wavelength axis (nm)
 * @param absorbance      Raw absorbance values
 * @param refMin_nm       Lower bound of scattering-only reference region (nm)
 * @param refMax_nm       Upper bound of scattering-only reference region (nm)
 *
 * References:
 *   Bohren C.F. & Huffman D.R., Absorption and Scattering of Light by
 *     Small Particles, Wiley (1983).
 *   Stamplecoskie K.G. et al., J. Phys. Chem. C 118, 2987 (2014).
 */
export function rayleighMieSubtraction(
  wavelength_nm: number[],
  absorbance:    number[],
  refMin_nm      = 650,
  refMax_nm      = 750
): ScatteringResult {
  // 1. Extract reference (scatter-only) region
  const refX: number[] = [];
  const refY: number[] = [];
  for (let i = 0; i < wavelength_nm.length; i++) {
    if (wavelength_nm[i] >= refMin_nm && wavelength_nm[i] <= refMax_nm && absorbance[i] > 1e-6) {
      refX.push(Math.log(wavelength_nm[i]));
      refY.push(Math.log(absorbance[i]));
    }
  }
  if (refX.length < 3) {
    // Fallback: use Rayleigh α=4 with amplitude from median in ref range
    const fallbackA = Math.exp(refY.length ? refY.reduce((s, v) => s + v, 0) / refY.length : 0);
    const bg = wavelength_nm.map(λ => fallbackA * Math.pow(λ, -4));
    return {
      alpha:      4,
      A:          fallbackA,
      background: bg,
      corrected:  absorbance.map((a, i) => Math.max(a - bg[i], 0)),
      r2:         0,
    };
  }

  // 2. OLS in log–log space:  ln(A) = ln(A₀) − α·ln(λ)
  const { m, c, r2 } = linearRegression(refX, refY);
  const alpha = -m;           // negative because A_scatter ∝ λ^(-α)
  const A     = Math.exp(c);

  // 3. Build background and subtract
  const background = wavelength_nm.map(λ => A * Math.pow(λ, -alpha));
  const corrected  = absorbance.map((a, i) => Math.max(a - background[i], 0));

  return {
    alpha: parseFloat(alpha.toFixed(4)),
    A:     parseFloat(A.toExponential(4)),
    background,
    corrected,
    r2:    parseFloat(r2.toFixed(5)),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 9c. KRAMERS–KRONIG RELATIONS  (optical constants)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Result type for Kramers–Kronig analysis.
 */
export interface KramersKronigResult {
  /** Real part of optical constant n(ω) — refractive index */
  n: number[];
  /** Imaginary part k(ω) — extinction coefficient (derived from absorbance) */
  k: number[];
  /** Real part of dielectric function ε₁ = n² − k² */
  epsilon1: number[];
  /** Imaginary part of dielectric function ε₂ = 2nk */
  epsilon2: number[];
  /** Angular frequency axis ω (rad s⁻¹) */
  omega: number[];
}

/**
 * Kramers–Kronig (KK) transform: compute the real part of the optical
 * response function from its imaginary part (absorption spectrum).
 *
 * For a causal linear response function χ(ω) = χ'(ω) + iχ''(ω):
 *
 *   χ'(ω) = (2/π) · P.V. ∫₀^∞  [ω'·χ''(ω') / (ω'²−ω²)] dω'
 *
 * where P.V. denotes the Cauchy principal value.
 *
 * In optical spectroscopy the extinction coefficient k(λ) = α(λ)·λ/(4π)
 * is the imaginary part; the KK transform yields n(λ).
 * The dielectric functions follow: ε₁ = n²−k², ε₂ = 2nk.
 *
 * Numerical integration uses the trapezoidal rule with a Hilbert-transform
 * approximation, avoiding the singularity at ω'=ω by skipping that point.
 *
 * @param wavelength_nm  Wavelength axis in nm
 * @param absorbance     Absorbance (or α·d) values — used to derive k
 * @param pathLength_cm  Optical path length in cm (default 0.1 cm, 1 mm cuvette)
 * @param n_inf          High-frequency refractive index n∞ (default 1.5)
 *
 * References:
 *   Kramers H.A., Atti Cong. Intern. Fisici, Como (1927).
 *   Kronig R.L., J. Opt. Soc. Am. 12, 547 (1926).
 *   Lucarini V. et al., Kramers-Kronig Relations in Optical Materials
 *     Research, Springer (2005).
 */
export function kramersKronig(
  wavelength_nm: number[],
  absorbance:    number[],
  pathLength_cm  = 0.1,
  n_inf          = 1.5
): KramersKronigResult {
  const N   = wavelength_nm.length;
  const c0  = 2.998e8;   // speed of light m/s

  // Convert wavelength → angular frequency ω = 2πc/λ
  const omega = wavelength_nm.map(λ => (2 * Math.PI * c0) / (λ * 1e-9));

  // Extinction coefficient k from Beer–Lambert: α = A·ln(10)/l  [m⁻¹]
  // k = α·λ / (4π) = A·ln(10)·λ / (4π·l)
  const k = wavelength_nm.map((λ, i) =>
    (absorbance[i] * Math.log(10) * (λ * 1e-9)) /
    (4 * Math.PI * (pathLength_cm * 1e-2))
  );

  // Kramers–Kronig: n(ω) − n∞ = (2/π)·P.V.∫ [ω'·k(ω')/(ω'²−ω²)] dω'
  // Numerical: trapezoidal, skip singularity ω'=ω
  const n = new Array(N).fill(n_inf);
  for (let i = 0; i < N; i++) {
    const w0 = omega[i];
    let integral = 0;
    for (let j = 0; j < N - 1; j++) {
      if (j === i || j + 1 === i) continue; // skip singularity
      const w1 = omega[j],     w2 = omega[j + 1];
      const k1 = k[j],         k2 = k[j + 1];
      const f1 = (w1 * k1) / (w1 * w1 - w0 * w0);
      const f2 = (w2 * k2) / (w2 * w2 - w0 * w0);
      integral += 0.5 * (f1 + f2) * Math.abs(w2 - w1);
    }
    n[i] = n_inf + (2 / Math.PI) * integral;
  }

  // Dielectric functions
  const epsilon1 = n.map((ni, i) => ni * ni - k[i] * k[i]);
  const epsilon2 = n.map((ni, i) => 2 * ni * k[i]);

  return { n, k, epsilon1, epsilon2, omega };
}

// ─────────────────────────────────────────────────────────────────────────────
// 9d. RELATIVE PHOTOLUMINESCENCE QUANTUM YIELD (PLQY)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Result type for relative PLQY calculation.
 */
export interface PLQYResult {
  /** Absolute PLQY of the unknown sample Φₓ (0–1) */
  phi_x: number;
  /** Integrated PL emission of sample (trapezoidal) */
  intPL_x: number;
  /** Integrated PL emission of reference */
  intPL_ref: number;
  /** Absorbance of sample at excitation wavelength */
  abs_x: number;
  /** Absorbance of reference at excitation wavelength */
  abs_ref: number;
  /** Reference quantum yield used Φᵣ */
  phi_ref: number;
  /** Refractive index correction factor (nₓ/nᵣ)² */
  refractiveCorrection: number;
}

/**
 * Relative photoluminescence quantum yield by the comparative method.
 *
 *   Φₓ = Φᵣ · (Iₓ/Iᵣ) · (Aᵣ/Aₓ) · (nₓ/nᵣ)²
 *
 * where I is the spectrally integrated PL emission, A is the absorbance at
 * the excitation wavelength, n is the solvent refractive index, and subscripts
 * x and r denote sample and reference respectively.
 *
 * Both sample and reference PL spectra must be recorded under identical
 * instrumental conditions with absorbances A < 0.1 at λex to minimise
 * inner-filter effects.
 *
 * Common references (Φᵣ):
 *   Quinine sulfate in 0.5M H₂SO₄: Φᵣ = 0.546 (λex = 366 nm)
 *   Fluorescein in 0.1M NaOH:       Φᵣ = 0.925 (λex = 496 nm)
 *   Rhodamine 6G in ethanol:         Φᵣ = 0.95  (λex = 488 nm)
 *
 * @param xPL_x        Wavelength axis of sample PL (nm)
 * @param yPL_x        Emission intensity of sample
 * @param xPL_ref      Wavelength axis of reference PL (nm)
 * @param yPL_ref      Emission intensity of reference
 * @param abs_x        Absorbance of sample at λex
 * @param abs_ref      Absorbance of reference at λex
 * @param phi_ref      Quantum yield of reference (0–1)
 * @param n_x          Refractive index of sample solvent (default 1.333 for water)
 * @param n_ref        Refractive index of reference solvent (default 1.333 for water)
 *
 * Reference: Williams A.T.R. et al., Analyst 108, 1067 (1983).
 *            Würth C. et al., Nat. Protoc. 8, 1535 (2013).
 */
export function relativePLQY(
  xPL_x:    number[],
  yPL_x:    number[],
  xPL_ref:  number[],
  yPL_ref:  number[],
  abs_x:    number,
  abs_ref:  number,
  phi_ref:  number,
  n_x       = 1.333,
  n_ref     = 1.333
): PLQYResult {
  if (abs_x > 0.1 || abs_ref > 0.1) {
    console.warn(
      `[PLQY] Absorbances should be < 0.1 to minimise inner-filter effects. ` +
      `Got A_x=${abs_x.toFixed(3)}, A_ref=${abs_ref.toFixed(3)}.`
    );
  }

  const intPL_x   = trapezoidalIntegration(xPL_x,   yPL_x);
  const intPL_ref = trapezoidalIntegration(xPL_ref,  yPL_ref);

  const refractiveCorrection = (n_x / n_ref) ** 2;
  const phi_x = phi_ref * (intPL_x / intPL_ref) * (abs_ref / abs_x) * refractiveCorrection;

  return {
    phi_x:                parseFloat(Math.min(phi_x, 1).toFixed(5)),
    intPL_x:              parseFloat(intPL_x.toExponential(4)),
    intPL_ref:            parseFloat(intPL_ref.toExponential(4)),
    abs_x:                parseFloat(abs_x.toFixed(4)),
    abs_ref:              parseFloat(abs_ref.toFixed(4)),
    phi_ref,
    refractiveCorrection: parseFloat(refractiveCorrection.toFixed(6)),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 9e. WILLIAMSON–HALL PLOT  (XRD size + microstrain separation)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Result type for Williamson–Hall analysis.
 */
export interface WilliamsonHallResult {
  /** Crystallite size D (nm) from y-intercept */
  D_nm: number;
  /** Microstrain ε (dimensionless) from slope */
  microstrain: number;
  /** R² of the Williamson–Hall linear regression */
  r2: number;
  /** β·cosθ values (y-axis of WH plot) */
  betaCosTheta: number[];
  /** 4·sinθ values (x-axis of WH plot) */
  fourSinTheta: number[];
  /** Slope of WH plot = ε (microstrain) */
  slope: number;
  /** Intercept of WH plot = K·λ/D */
  intercept: number;
}

/**
 * Williamson–Hall plot analysis for simultaneous crystallite size and
 * microstrain determination from multiple XRD peaks.
 *
 * The modified Scherrer equation including strain broadening:
 *
 *   β·cosθ = Kλ/D + 4ε·sinθ
 *
 * Plotting β·cosθ vs 4·sinθ gives:
 *   y-intercept = Kλ/D  →  D = Kλ / intercept
 *   slope       = ε      →  microstrain
 *
 * where β is the FWHM of each peak (in radians) and θ is the Bragg angle.
 *
 * @param peaks   Array of XRD peaks: each has twoTheta (°), fwhm_deg (°)
 * @param lambda_A  X-ray wavelength in Å (default 1.5406 for Cu Kα₁)
 * @param K         Scherrer constant (default 0.9394)
 *
 * References:
 *   Williamson G.K. & Hall W.H., Acta Metall. 1, 22 (1953).
 *   Monshi A. et al., World J. Nano Sci. Eng. 2, 154 (2012).
 */
export function williamsonHall(
  peaks: Array<{ twoTheta_deg: number; fwhm_deg: number }>,
  lambda_A = 1.5406,
  K        = 0.9394
): WilliamsonHallResult {
  if (peaks.length < 2) {
    throw new Error('Williamson–Hall analysis requires at least 2 XRD peaks.');
  }

  const lambda_nm = lambda_A / 10;   // Å → nm

  const betaCosTheta: number[] = [];
  const fourSinTheta: number[] = [];

  for (const p of peaks) {
    const theta_rad = (p.twoTheta_deg / 2) * (Math.PI / 180);
    const beta_rad  = p.fwhm_deg * (Math.PI / 180);
    betaCosTheta.push(beta_rad * Math.cos(theta_rad));
    fourSinTheta.push(4 * Math.sin(theta_rad));
  }

  const { m: slope, c: intercept, r2 } = linearRegression(fourSinTheta, betaCosTheta);

  // D from y-intercept: intercept = Kλ/D  →  D = Kλ/intercept
  const D_nm = intercept > 1e-9 ? (K * lambda_nm) / intercept : 0;
  const microstrain = Math.abs(slope);

  return {
    D_nm:         parseFloat(D_nm.toFixed(3)),
    microstrain:  parseFloat(microstrain.toExponential(4)),
    r2:           parseFloat(r2.toFixed(5)),
    betaCosTheta,
    fourSinTheta,
    slope:        parseFloat(slope.toExponential(4)),
    intercept:    parseFloat(intercept.toExponential(4)),
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// ── TIER 3 ADDITIONS ─────────────────────────────────────────────────────────
// 10a. MCR-ALS  (Multivariate Curve Resolution – Alternating Least Squares)
// 10b. PLS Regression  (Partial Least Squares)
// 10c. Hierarchical Clustering  (Ward linkage + cosine distance dendrogram)
// 10d. Spectral Similarity  (Cosine, Pearson, Spectral Angle Distance)
// 10e. FFT + Autocorrelation + Power Spectral Density
// ═══════════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────────────
// 10a. MCR-ALS  (Multivariate Curve Resolution — Alternating Least Squares)
// ─────────────────────────────────────────────────────────────────────────────

export interface MCRALSResult {
  /** Pure component spectra (nComponents × nWavelengths) */
  S: number[][];
  /** Concentration profiles (nSamples × nComponents) */
  C: number[][];
  /** Reconstructed data matrix D̂ = C·S */
  Dhat: number[][];
  /** Residual matrix E = D − D̂ */
  E: number[][];
  /** Lack-of-fit (%) per iteration — convergence trace */
  lof: number[];
  /** Final lack-of-fit (%) */
  finalLof: number;
  /** R² of reconstruction */
  r2: number;
  /** Number of components used */
  nComponents: number;
}

/**
 * MCR-ALS: Multivariate Curve Resolution by Alternating Least Squares.
 *
 * Decomposes a data matrix D (nSamples × nWavelengths) into:
 *   D = C · S + E
 *
 * where C (nSamples × nComponents) are concentration profiles and
 * S (nComponents × nWavelengths) are pure component spectra, subject to
 * non-negativity constraints on both C and S.
 *
 * Algorithm:
 *   1. Initialise S by PCA (top nComponents loadings, non-negative)
 *   2. ALS loop:
 *      a. C = D · Sᵀ · (S · Sᵀ)⁻¹  then clip C ≥ 0
 *      b. S = (Cᵀ · C)⁻¹ · Cᵀ · D  then clip S ≥ 0
 *      c. Compute LOF = ‖E‖F / ‖D‖F × 100 %
 *   3. Converge when ΔLOF < tol or maxIter reached
 *
 * @param D           Data matrix [nSamples][nWavelengths] — each row = one spectrum
 * @param nComponents Number of chemical components to resolve
 * @param maxIter     Maximum ALS iterations (default 50)
 * @param tol         Convergence tolerance on LOF (default 0.1 %)
 *
 * References:
 *   Tauler R. et al., J. Chemom. 9, 31 (1995).
 *   de Juan A. & Tauler R., Crit. Rev. Anal. Chem. 36, 163 (2006).
 */
export function mcrALS(
  D:           number[][],
  nComponents: number,
  maxIter      = 50,
  tol          = 0.1
): MCRALSResult {
  const nSamples = D.length;
  const nWaves   = D[0].length;
  if (nSamples < 2 || nWaves < 2) throw new Error('MCR-ALS requires at least 2 samples and 2 wavelength points.');
  if (nComponents < 1 || nComponents > nSamples) throw new Error(`nComponents must be between 1 and ${nSamples}.`);

  // ── Helper: non-negative least-squares via projected gradient (simple clip) ──
  const nnClip = (M: number[][]): number[][] =>
    M.map(row => row.map(v => Math.max(v, 0)));

  // ── Frobenius norm ──────────────────────────────────────────────────────────
  const frobNorm = (M: number[][]): number =>
    Math.sqrt(M.reduce((s, row) => s + row.reduce((r, v) => r + v * v, 0), 0));

  // ── Small matrix pseudo-inverse via Gauss–Jordan (reuse invert for ≤10×10) ──
  const pseudoInv = (A: number[][]): number[][] => {
    try { return invert(A); }
    catch { return A.map((row, i) => row.map((_, j) => i === j ? 1 / (A[i][j] || 1e-12) : 0)); }
  };

  // ── Matrix multiply helper (already exists as multiply()) ──────────────────

  // ── 1. Initialise S via PCA loadings ───────────────────────────────────────
  // Mean-centre D
  const colMean = new Array(nWaves).fill(0);
  for (let j = 0; j < nWaves; j++) {
    for (let i = 0; i < nSamples; i++) colMean[j] += D[i][j];
    colMean[j] /= nSamples;
  }
  const Dc = D.map(row => row.map((v, j) => v - colMean[j]));

  // NIPALS for top nComponents loadings
  let S: number[][] = [];
  let residPCA = Dc.map(r => [...r]);
  for (let pc = 0; pc < nComponents; pc++) {
    let loading = new Array(nWaves).fill(1 / Math.sqrt(nWaves));
    for (let it = 0; it < 30; it++) {
      const score  = residPCA.map(row => row.reduce((s, v, j) => s + v * loading[j], 0));
      const normS  = Math.sqrt(score.reduce((s, v) => s + v * v, 0)) || 1e-12;
      loading = new Array(nWaves).fill(0);
      for (let j = 0; j < nWaves; j++)
        for (let i = 0; i < nSamples; i++)
          loading[j] += residPCA[i][j] * score[i] / normS;
      const normL = Math.sqrt(loading.reduce((s, v) => s + v * v, 0)) || 1e-12;
      loading = loading.map(v => v / normL);
    }
    S.push(loading.map(v => Math.max(v, 0)));  // non-negative init
    // Deflate
    const score = residPCA.map(row => row.reduce((s, v, j) => s + v * loading[j], 0));
    for (let i = 0; i < nSamples; i++)
      for (let j = 0; j < nWaves; j++)
        residPCA[i][j] -= score[i] * loading[j];
  }

  // Initialise C randomly non-negative if S is zero
  let C: number[][] = Array.from({ length: nSamples }, () =>
    Array.from({ length: nComponents }, () => Math.random())
  );

  const normD  = frobNorm(D);
  const lof: number[] = [];

  // ── 2. ALS loop ────────────────────────────────────────────────────────────
  for (let iter = 0; iter < maxIter; iter++) {
    // C-step: C = D·Sᵀ·(S·Sᵀ)⁻¹  then clip
    const SSt  = multiply(S, transpose(S));           // nC × nC
    const SSti = pseudoInv(SSt);                       // nC × nC
    const DSt  = multiply(D, transpose(S));            // nSamp × nC
    C = nnClip(multiply(DSt, SSti));

    // S-step: S = (Cᵀ·C)⁻¹·Cᵀ·D  then clip
    const CtC  = multiply(transpose(C), C);            // nC × nC
    const CtCi = pseudoInv(CtC);
    const CtD  = multiply(transpose(C), D);            // nC × nWaves
    S = nnClip(multiply(CtCi, CtD));

    // LOF
    const Dhat = multiply(C, S);
    const E    = D.map((row, i) => row.map((v, j) => v - Dhat[i][j]));
    const currentLof = (frobNorm(E) / (normD || 1e-12)) * 100;
    lof.push(currentLof);

    if (iter > 0 && Math.abs(lof[iter - 1] - currentLof) < tol) break;
  }

  // ── 3. Final reconstruction ────────────────────────────────────────────────
  const Dhat  = multiply(C, S);
  const E     = D.map((row, i) => row.map((v, j) => v - Dhat[i][j]));
  const finalLof = lof[lof.length - 1];

  // R²
  const totalSS = D.reduce((s, row) => s + row.reduce((r, v) => r + v * v, 0), 0);
  const resSS   = frobNorm(E) ** 2;
  const r2      = totalSS < 1e-30 ? 1 : 1 - resSS / totalSS;

  return { S, C, Dhat, E, lof, finalLof: parseFloat(finalLof.toFixed(4)), r2: parseFloat(r2.toFixed(5)), nComponents };
}

// ─────────────────────────────────────────────────────────────────────────────
// 10b. PLS REGRESSION  (Partial Least Squares, NIPALS algorithm)
// ─────────────────────────────────────────────────────────────────────────────

export interface PLSResult {
  /** Regression coefficients b (1 per wavelength) for prediction: ŷ = X·b */
  b: number[];
  /** X scores T (nSamples × nLV) */
  T: number[][];
  /** X loadings P (nLV × nWavelengths) */
  P: number[][];
  /** Y loadings q (nLV) */
  q: number[];
  /** X weights W (nLV × nWavelengths) */
  W: number[][];
  /** Predicted y values on calibration set */
  yHat: number[];
  /** Root mean square error of calibration (RMSEC) */
  rmsec: number;
  /** R² calibration */
  r2cal: number;
  /** Explained X-variance per latent variable (%) */
  xVariance: number[];
  /** Number of latent variables used */
  nLV: number;
}

/**
 * PLS1 regression (NIPALS algorithm) — predicts a scalar property y from
 * a spectral matrix X (nSamples × nWavelengths).
 *
 * Builds nLV latent variables by deflation, then assembles the regression
 * vector b = W·(Pᵀ·W)⁻¹·q for direct spectral prediction.
 *
 * @param X    Spectral matrix [nSamples][nWavelengths] (mean-centred internally)
 * @param y    Response vector [nSamples] (concentration, property value)
 * @param nLV  Number of latent variables (default 3; should be ≤ rank(X))
 *
 * References:
 *   Wold H., Perspectives in Mathematics, Academic Press (1966).
 *   Geladi P. & Kowalski B.R., Anal. Chim. Acta 185, 1 (1986).
 */
export function plsRegression(
  X:   number[][],
  y:   number[],
  nLV  = 3
): PLSResult {
  const nSamples = X.length;
  const nWaves   = X[0].length;
  if (nSamples < 2) throw new Error('PLS requires at least 2 samples.');
  nLV = Math.min(nLV, nSamples - 1, nWaves);

  // Mean-centre X and y
  const xMean = new Array(nWaves).fill(0);
  for (let j = 0; j < nWaves; j++) {
    for (let i = 0; i < nSamples; i++) xMean[j] += X[i][j];
    xMean[j] /= nSamples;
  }
  const yMean = y.reduce((s, v) => s + v, 0) / nSamples;
  let Xc = X.map(row => row.map((v, j) => v - xMean[j]));
  let yc = y.map(v => v - yMean);

  const totalXVar = Xc.reduce((s, row) => s + row.reduce((r, v) => r + v * v, 0), 0);

  const T: number[][] = [];   // scores
  const P: number[][] = [];   // X loadings
  const W: number[][] = [];   // X weights
  const q: number[]  = [];   // y loadings
  const xVariance: number[] = [];

  for (let lv = 0; lv < nLV; lv++) {
    // 1. Initialise w as first column of Xᵀy
    let w = new Array(nWaves).fill(0);
    for (let j = 0; j < nWaves; j++)
      for (let i = 0; i < nSamples; i++)
        w[j] += Xc[i][j] * yc[i];
    const wNorm = Math.sqrt(w.reduce((s, v) => s + v * v, 0)) || 1e-12;
    w = w.map(v => v / wNorm);

    // 2. X scores t = X·w
    const t = Xc.map(row => row.reduce((s, v, j) => s + v * w[j], 0));

    // 3. y loading q = yᵀ·t / tᵀ·t
    const tt = t.reduce((s, v) => s + v * v, 0) || 1e-12;
    const qv = t.reduce((s, v, i) => s + v * yc[i], 0) / tt;

    // 4. X loading p = Xᵀ·t / tᵀ·t
    const p = new Array(nWaves).fill(0);
    for (let j = 0; j < nWaves; j++)
      for (let i = 0; i < nSamples; i++)
        p[j] += Xc[i][j] * t[i] / tt;

    // 5. Deflate X and y
    Xc = Xc.map((row, i) => row.map((v, j) => v - t[i] * p[j]));
    yc = yc.map((v, i) => v - qv * t[i]);

    // Explained X variance
    const tVar = t.reduce((s, v) => s + v * v, 0);
    xVariance.push(parseFloat((tVar / (totalXVar || 1e-12) * 100).toFixed(2)));

    T.push(t); P.push(p); W.push(w); q.push(qv);
  }

  // Regression vector: b = W·(Pᵀ·W)⁻¹·q
  // Pᵀ·W is nLV × nLV
  const PtW = multiply(P, transpose(W));
  let PtWi: number[][];
  try { PtWi = invert(PtW); } catch { PtWi = PtW.map((r, i) => r.map((_, j) => i === j ? 1 : 0)); }
  const PtWiq = PtWi.map(row => row.reduce((s, v, k) => s + v * q[k], 0));  // nLV
  const b = new Array(nWaves).fill(0);
  for (let j = 0; j < nWaves; j++)
    for (let lv2 = 0; lv2 < nLV; lv2++)
      b[j] += W[lv2][j] * PtWiq[lv2];

  // Predictions on calibration: ŷ = (X - xMean)·b + yMean
  const yHat = X.map(row => {
    const xc = row.map((v, j) => v - xMean[j]);
    return xc.reduce((s, v, j) => s + v * b[j], 0) + yMean;
  });

  const rmsec = Math.sqrt(y.reduce((s, v, i) => s + (v - yHat[i]) ** 2, 0) / nSamples);
  const yBar  = y.reduce((s, v) => s + v, 0) / nSamples;
  const sst   = y.reduce((s, v) => s + (v - yBar) ** 2, 0);
  const ssr   = y.reduce((s, v, i) => s + (v - yHat[i]) ** 2, 0);
  const r2cal = sst < 1e-30 ? 1 : 1 - ssr / sst;

  return {
    b,
    T: T.map((_, i) => T.map(t => t[i])),   // transpose back to [nSamples][nLV]
    P, W, q,
    yHat,
    rmsec:     parseFloat(rmsec.toFixed(6)),
    r2cal:     parseFloat(r2cal.toFixed(5)),
    xVariance,
    nLV,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 10c. HIERARCHICAL CLUSTERING  (Ward linkage, cosine distance)
// ─────────────────────────────────────────────────────────────────────────────

export interface HCAResult {
  /** Merge sequence: each entry [i, j, distance, newClusterSize] */
  linkage: Array<[number, number, number, number]>;
  /** Flat cluster labels at the requested cut distance */
  labels: number[];
  /** Number of clusters at the cut */
  nClusters: number;
  /** Distance matrix (upper triangle, flattened) */
  distMatrix: number[][];
}

/**
 * Cosine distance between two vectors.
 * d = 1 − cosine_similarity = 1 − (u·v)/(‖u‖‖v‖)
 */
function cosineDistance(u: number[], v: number[]): number {
  let dot = 0, nu = 0, nv = 0;
  for (let i = 0; i < u.length; i++) {
    dot += u[i] * v[i];
    nu  += u[i] * u[i];
    nv  += v[i] * v[i];
  }
  const denom = Math.sqrt(nu * nv);
  return denom < 1e-12 ? 1 : 1 - dot / denom;
}

/**
 * Hierarchical Agglomerative Clustering with Ward linkage and cosine distance.
 *
 * Ward's method minimises the total within-cluster variance at each merge.
 * The cosine distance is appropriate for spectral data where magnitude
 * variation is less informative than shape similarity.
 *
 * Returns a linkage matrix (as in scipy.cluster.hierarchy.linkage) and
 * flat cluster labels at a user-specified cut distance.
 *
 * @param spectra    Matrix [nSamples][nWavelengths]
 * @param cutDist    Distance threshold for flat clustering (default 0.5)
 *
 * References:
 *   Ward J.H., J. Am. Stat. Assoc. 58, 236 (1963).
 *   Murtagh F. & Legendre P., J. Classif. 31, 274 (2014).
 */
export function hierarchicalClustering(
  spectra: number[][],
  cutDist  = 0.5
): HCAResult {
  const n = spectra.length;
  if (n < 2) throw new Error('HCA requires at least 2 spectra.');

  // Build initial pairwise cosine distance matrix
  const distMatrix: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let i = 0; i < n; i++)
    for (let j = i + 1; j < n; j++) {
      const d = cosineDistance(spectra[i], spectra[j]);
      distMatrix[i][j] = d;
      distMatrix[j][i] = d;
    }

  // Clusters as sets of original indices
  type Cluster = { indices: number[]; centroid: number[] };
  let clusters: Cluster[] = spectra.map((s, i) => ({ indices: [i], centroid: [...s] }));
  let nextId = n;
  const linkage: Array<[number, number, number, number]> = [];
  const clusterIds: number[] = Array.from({ length: n }, (_, i) => i);

  // Working distance matrix between current clusters (n×n, shrinks)
  let D = distMatrix.map(row => [...row]);

  while (clusters.length > 1) {
    const m = clusters.length;
    // Find minimum distance pair
    let minD = Infinity, bi = 0, bj = 1;
    for (let i = 0; i < m; i++)
      for (let j = i + 1; j < m; j++)
        if (D[i][j] < minD) { minD = D[i][j]; bi = i; bj = j; }

    const ci = clusters[bi], cj = clusters[bj];
    const ni = ci.indices.length, nj = cj.indices.length;

    // Merge: new centroid is weighted mean
    const newCentroid = ci.centroid.map((v, k) => (v * ni + cj.centroid[k] * nj) / (ni + nj));
    const newCluster: Cluster = { indices: [...ci.indices, ...cj.indices], centroid: newCentroid };
    linkage.push([clusterIds[bi], clusterIds[bj], minD, ni + nj]);

    // Remove bi and bj (remove higher index first), add new cluster
    const keep = clusters.filter((_, k) => k !== bi && k !== bj);
    const keepIds = clusterIds.filter((_, k) => k !== bi && k !== bj);
    keep.push(newCluster);
    keepIds.push(nextId++);

    // Rebuild distance matrix (Ward update formula)
    const newM = keep.length;
    const newD: number[][] = Array.from({ length: newM }, () => new Array(newM).fill(0));
    for (let i = 0; i < newM - 1; i++)
      for (let j = i + 1; j < newM - 1; j++) {
        const oi = clusters.findIndex((c) => c === keep[i]);
        const oj = clusters.findIndex((c) => c === keep[j]);
        if (oi >= 0 && oj >= 0) { newD[i][j] = D[oi][oj]; newD[j][i] = D[oi][oj]; }
        else { const d = cosineDistance(keep[i].centroid, keep[j].centroid); newD[i][j] = d; newD[j][i] = d; }
      }
    // New cluster distances to existing clusters
    for (let i = 0; i < newM - 1; i++) {
      const d = cosineDistance(keep[i].centroid, newCluster.centroid);
      newD[i][newM - 1] = d;
      newD[newM - 1][i] = d;
    }

    clusters = keep;
    clusterIds.splice(0, clusterIds.length, ...keepIds);
    D = newD;
  }

  // Flat clustering: cut at cutDist
  const labels = new Array(n).fill(0);
  let clusterCounter = 0;
  const assigned = new Array(n).fill(false);
  for (const [ci2, cj2, dist] of linkage) {
    if (dist >= cutDist) break;
    const idxI = ci2 < n ? [ci2] : [];
    const idxJ = cj2 < n ? [cj2] : [];
    [...idxI, ...idxJ].forEach(idx => { if (!assigned[idx]) { labels[idx] = clusterCounter; assigned[idx] = true; } });
    clusterCounter++;
  }
  for (let i = 0; i < n; i++) if (!assigned[i]) { labels[i] = clusterCounter++; }
  const nClusters = new Set(labels).size;

  return { linkage, labels, nClusters, distMatrix };
}

// ─────────────────────────────────────────────────────────────────────────────
// 10d. SPECTRAL SIMILARITY METRICS
// ─────────────────────────────────────────────────────────────────────────────

export interface SimilarityResult {
  /** Cosine similarity (0–1; 1 = identical) */
  cosine: number;
  /** Pearson correlation coefficient (−1 to 1) */
  pearson: number;
  /** Spectral Angle Distance / Mapper angle θ (radians; 0 = identical) */
  sad: number;
  /** Spectral Angle Distance in degrees */
  sad_deg: number;
  /** Euclidean distance (lower = more similar) */
  euclidean: number;
  /** Mean Absolute Difference */
  mad: number;
}

/**
 * Compute six spectral similarity metrics between two spectra.
 *
 * Metrics:
 *   Cosine similarity  = (u·v)/(‖u‖‖v‖)
 *   Pearson r          = cov(u,v)/(σᵤσᵥ)
 *   Spectral Angle     = arccos[(u·v)/(‖u‖‖v‖)]  (SAM, Kruse 1993)
 *   Euclidean distance = ‖u−v‖
 *   MAD                = mean|uᵢ−vᵢ|
 *
 * Both spectra are interpolated onto refX before comparison if their lengths differ.
 *
 * @param x1  Wavelength/wavenumber axis of spectrum 1
 * @param y1  Intensity of spectrum 1
 * @param x2  Wavelength/wavenumber axis of spectrum 2
 * @param y2  Intensity of spectrum 2
 *
 * References:
 *   Kruse F.A. et al., Remote Sens. Environ. 44, 145 (1993).
 */
export function spectralSimilarity(
  x1: number[], y1: number[],
  x2: number[], y2: number[]
): SimilarityResult {
  // Interpolate y2 onto x1 axis
  const y2i = interpolate(x2, y2, x1);
  const u = y1, v = y2i;
  const n = u.length;

  let dot = 0, nu = 0, nv = 0;
  for (let i = 0; i < n; i++) { dot += u[i]*v[i]; nu += u[i]*u[i]; nv += v[i]*v[i]; }
  const cosine = nu < 1e-12 || nv < 1e-12 ? 0 : dot / Math.sqrt(nu * nv);
  const sad     = Math.acos(Math.min(Math.max(cosine, -1), 1));

  const uBar = u.reduce((s, v2) => s + v2, 0) / n;
  const vBar = v.reduce((s, v2) => s + v2, 0) / n;
  let covUV = 0, varU = 0, varV = 0;
  for (let i = 0; i < n; i++) {
    covUV += (u[i]-uBar)*(v[i]-vBar);
    varU  += (u[i]-uBar)**2;
    varV  += (v[i]-vBar)**2;
  }
  const pearson   = varU < 1e-12 || varV < 1e-12 ? 0 : covUV / Math.sqrt(varU * varV);
  const euclidean = Math.sqrt(u.reduce((s, vi, i) => s + (vi - v[i])**2, 0));
  const mad       = u.reduce((s, vi, i) => s + Math.abs(vi - v[i]), 0) / n;

  return {
    cosine:    parseFloat(cosine.toFixed(6)),
    pearson:   parseFloat(pearson.toFixed(6)),
    sad:       parseFloat(sad.toFixed(6)),
    sad_deg:   parseFloat((sad * 180 / Math.PI).toFixed(4)),
    euclidean: parseFloat(euclidean.toFixed(6)),
    mad:       parseFloat(mad.toFixed(6)),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 10e. FFT, AUTOCORRELATION, POWER SPECTRAL DENSITY
// ─────────────────────────────────────────────────────────────────────────────

export interface FFTResult {
  /** Frequency axis (cycles per unit of x spacing) */
  frequencies: number[];
  /** Magnitude spectrum |X(f)| */
  magnitude: number[];
  /** Phase spectrum arg(X(f)) in radians */
  phase: number[];
  /** Power spectral density |X(f)|² */
  psd: number[];
  /** Index of dominant frequency component */
  dominantFreqIndex: number;
  /** Dominant frequency value */
  dominantFreq: number;
  /** Dominant period (1/dominantFreq) */
  dominantPeriod: number;
}

export interface AutocorrResult {
  /** Lag axis in x-axis units */
  lags: number[];
  /** Normalised autocorrelation r(τ) ∈ [−1, 1] */
  acf: number[];
  /** First zero-crossing lag (coherence length proxy) */
  coherenceLength: number;
}

/**
 * Cooley–Tukey radix-2 Discrete Fourier Transform (DFT).
 * Zero-pads to the next power of two for efficiency.
 *
 * Returns magnitude, phase, and power spectral density arrays
 * for the positive-frequency half.
 *
 * @param y     Signal values
 * @param dx    Sampling interval in x-axis units (default 1)
 *
 * Reference: Cooley J.W. & Tukey J.W., Math. Comp. 19, 297 (1965).
 */
export function fftSpectrum(y: number[], dx = 1): FFTResult {
  // Zero-pad to next power of two
  const N2 = Math.pow(2, Math.ceil(Math.log2(y.length)));
  const re  = new Float64Array(N2);
  const im  = new Float64Array(N2);
  for (let i = 0; i < y.length; i++) re[i] = y[i];

  // Bit-reversal permutation
  let j = 0;
  for (let i = 1; i < N2; i++) {
    let bit = N2 >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
  }

  // Cooley–Tukey butterfly
  for (let len = 2; len <= N2; len <<= 1) {
    const angle = (-2 * Math.PI) / len;
    const wRe = Math.cos(angle), wIm = Math.sin(angle);
    for (let i = 0; i < N2; i += len) {
      let curRe = 1, curIm = 0;
      for (let k = 0; k < len / 2; k++) {
        const uRe = re[i + k],           uIm = im[i + k];
        const vRe = re[i+k+len/2]*curRe - im[i+k+len/2]*curIm;
        const vIm = re[i+k+len/2]*curIm + im[i+k+len/2]*curRe;
        re[i+k]         = uRe + vRe;  im[i+k]         = uIm + vIm;
        re[i+k+len/2]   = uRe - vRe;  im[i+k+len/2]   = uIm - vIm;
        const newRe = curRe*wRe - curIm*wIm;
        curIm = curRe*wIm + curIm*wRe;
        curRe = newRe;
      }
    }
  }

  // Positive half
  const half = N2 / 2;
  const frequencies = Array.from({ length: half }, (_, k) => k / (N2 * dx));
  const magnitude   = Array.from({ length: half }, (_, k) => Math.sqrt(re[k]**2 + im[k]**2) / N2);
  const phase       = Array.from({ length: half }, (_, k) => Math.atan2(im[k], re[k]));
  const psd         = magnitude.map(m => m * m);

  // Dominant frequency (skip DC at index 0)
  let domIdx = 1;
  for (let k = 2; k < half; k++) if (psd[k] > psd[domIdx]) domIdx = k;

  return {
    frequencies,
    magnitude,
    phase,
    psd,
    dominantFreqIndex: domIdx,
    dominantFreq:      parseFloat(frequencies[domIdx].toFixed(6)),
    dominantPeriod:    parseFloat((1 / (frequencies[domIdx] || 1e-12)).toFixed(4)),
  };
}

/**
 * Normalised autocorrelation function r(τ) up to maxLag points.
 *
 *   r(τ) = Σ[(y(t)−ȳ)(y(t+τ)−ȳ)] / Σ[(y(t)−ȳ)²]
 *
 * The coherence length is estimated as the first zero-crossing of r(τ).
 *
 * @param y      Signal values
 * @param dx     Sampling interval (x-axis units, default 1)
 * @param maxLag Maximum lag to compute (default N/2)
 */
export function autocorrelation(y: number[], dx = 1, maxLag?: number): AutocorrResult {
  const n   = y.length;
  const lag = maxLag ?? Math.floor(n / 2);
  const bar = y.reduce((s, v) => s + v, 0) / n;
  const yc  = y.map(v => v - bar);
  const var0 = yc.reduce((s, v) => s + v * v, 0);

  const acf: number[] = [];
  for (let k = 0; k <= lag; k++) {
    let sum = 0;
    for (let i = 0; i < n - k; i++) sum += yc[i] * yc[i + k];
    acf.push(var0 < 1e-12 ? 0 : sum / var0);
  }

  const lags = Array.from({ length: lag + 1 }, (_, k) => k * dx);

  // First zero crossing
  let coherenceLength = lags[lags.length - 1];
  for (let k = 1; k < acf.length; k++) {
    if (acf[k] <= 0) { coherenceLength = lags[k]; break; }
  }

  return { lags, acf, coherenceLength: parseFloat(coherenceLength.toFixed(4)) };
}

// ═══════════════════════════════════════════════════════════════════════════════
// ── TIER 4 ADDITIONS ─────────────────────────────────────────────────────────
// 11a. Butler–Volmer Cyclic Voltammogram (CV) simulator
// 11b. EIS / Nyquist plot — Randles circuit simulator
// 11c. Photoluminescence Excitation–Emission (PL-EX) map
// 11d. EPR / ESR spectrum simulator
// 11e. Mass spectrum (EI) + isotope pattern calculator
// 11f. TGA curve + Kissinger activation energy
// ═══════════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────────────
// 11a. BUTLER–VOLMER CYCLIC VOLTAMMOGRAM SIMULATOR
// ─────────────────────────────────────────────────────────────────────────────

export interface CVSimResult {
  /** Potential axis E (V vs reference) — full forward + reverse sweep */
  E: number[];
  /** Current density i (A m⁻²) */
  i: number[];
  /** Anodic peak potential Epa (V) */
  Epa: number;
  /** Cathodic peak potential Epc (V) */
  Epc: number;
  /** Anodic peak current ipa (A m⁻²) */
  ipa: number;
  /** Cathodic peak current ipc (A m⁻²) */
  ipc: number;
  /** Half-wave potential E½ = (Epa + Epc)/2 (V) */
  E_half: number;
  /** Peak separation ΔEp = Epa − Epc (V); should be ≈59/n mV for reversible */
  deltaEp: number;
}

/**
 * Butler–Volmer cyclic voltammogram simulator.
 *
 * Computes the current response i(E) for a single reversible/quasi-reversible
 * redox couple O + ne⁻ ⇌ R using the Butler–Volmer rate equation:
 *
 *   i = i₀ · [exp(α·n·F·η/RT) − exp(−(1−α)·n·F·η/RT)]
 *
 * where η = E − E° is the overpotential and i₀ is the exchange current density.
 * The concentration polarisation is approximated by a Nernstian depletion term
 * that broadens and attenuates the peak at low scan rates.
 *
 * @param E_start   Start potential (V), e.g. −0.6
 * @param E_vertex  Vertex (switching) potential (V), e.g. +0.6
 * @param E_formal  Formal potential E°' (V vs reference), e.g. 0.0
 * @param scanRate  Scan rate ν (V s⁻¹), e.g. 0.05
 * @param n         Number of electrons transferred (default 1)
 * @param alpha     Transfer coefficient α (default 0.5)
 * @param i0        Exchange current density i₀ (A m⁻², default 0.01)
 * @param T_K       Temperature (K, default 298.15)
 * @param nPoints   Number of potential points per half-sweep (default 500)
 *
 * References:
 *   Butler J.A.V., Trans. Faraday Soc. 19, 729 (1924).
 *   Volmer M. & Erdey-Gruz T., Z. Phys. Chem. 150A, 203 (1930).
 *   Bard A.J. & Faulkner L.R., Electrochemical Methods, Wiley (2001).
 */
export function simulateCV(
  E_start  = -0.6,
  E_vertex =  0.6,
  E_formal =  0.0,
  scanRate =  0.05,
  n        =  1,
  alpha    =  0.5,
  i0       =  0.01,
  T_K      =  298.15,
  nPoints  =  500
): CVSimResult {
  const F  = 96485;                   // C mol⁻¹
  const R  = 8.314;                   // J mol⁻¹ K⁻¹
  const ft = n * F / (R * T_K);      // thermal factor

  // Forward sweep: E_start → E_vertex
  const fwd: number[] = Array.from({ length: nPoints }, (_, k) =>
    E_start + (E_vertex - E_start) * k / (nPoints - 1)
  );
  // Reverse sweep: E_vertex → E_start
  const rev: number[] = Array.from({ length: nPoints }, (_, k) =>
    E_vertex - (E_vertex - E_start) * k / (nPoints - 1)
  );
  const Eall = [...fwd, ...rev];

  // Concentration depletion factor: Nernst-like attenuation near peak
  // Simple semi-infinite diffusion approximation: peak ∝ √ν
  const peakFactor = Math.sqrt(Math.abs(scanRate)) * 150;

  const iFull = Eall.map(E => {
    const eta = E - E_formal;
    const iBV = i0 * (
      Math.exp( alpha       * ft * eta) -
      Math.exp(-(1 - alpha) * ft * eta)
    );
    // Concentration depletion: gaussian attenuation around formal potential
    const depletion = Math.exp(-0.5 * ((eta / 0.12) ** 2));
    return iBV * (1 - 0.55 * depletion) * peakFactor;
  });

  // Peak detection
  const fwdI = iFull.slice(0, nPoints);
  const revI = iFull.slice(nPoints);
  const ipaIdx = fwdI.reduce((m, v, i) => v > fwdI[m] ? i : m, 0);
  const ipcIdx = revI.reduce((m, v, i) => v < revI[m] ? i : m, 0);
  const Epa = fwd[ipaIdx], ipa = fwdI[ipaIdx];
  const Epc = rev[ipcIdx], ipc = revI[ipcIdx];

  return {
    E: Eall, i: iFull,
    Epa: parseFloat(Epa.toFixed(4)),
    Epc: parseFloat(Epc.toFixed(4)),
    ipa: parseFloat(ipa.toFixed(6)),
    ipc: parseFloat(ipc.toFixed(6)),
    E_half:  parseFloat(((Epa + Epc) / 2).toFixed(4)),
    deltaEp: parseFloat(Math.abs(Epa - Epc).toFixed(4)),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 11b. EIS / NYQUIST PLOT — RANDLES CIRCUIT SIMULATOR
// ─────────────────────────────────────────────────────────────────────────────

export interface EISSimResult {
  /** Angular frequency ω (rad s⁻¹) */
  omega: number[];
  /** Real part of impedance Z′ (Ω) */
  Zre: number[];
  /** Negative imaginary part of impedance −Z″ (Ω) — plotted on y-axis */
  Zim_neg: number[];
  /** Magnitude |Z| (Ω) */
  Zmag: number[];
  /** Phase angle φ (degrees) */
  phase_deg: number[];
  /** Characteristic frequency ωmax (rad s⁻¹) at peak of semicircle */
  omega_max: number;
  /** Charge-transfer resistance Rct (Ω) */
  Rct: number;
  /** Solution resistance Rs (Ω) */
  Rs: number;
  /** Double-layer capacitance Cdl (F) */
  Cdl: number;
}

/**
 * Randles equivalent circuit EIS simulator.
 *
 * The Randles circuit consists of:
 *   Rs + (Rct ‖ Cdl) + Zw
 *
 * where Zw is the Warburg diffusion element (semi-infinite, 45° line).
 *
 * Total impedance:
 *   Z(ω) = Rs + 1 / (iωCdl + 1/(Rct + Zw))
 *   Zw   = σ/√ω · (1 − i)    (σ = Warburg coefficient)
 *
 * @param Rs      Solution resistance (Ω, default 10)
 * @param Rct     Charge-transfer resistance (Ω, default 200)
 * @param Cdl     Double-layer capacitance (F, default 20e-6)
 * @param sigma   Warburg coefficient σ (Ω s⁻½, default 30)
 * @param fMin    Minimum frequency (Hz, default 0.01)
 * @param fMax    Maximum frequency (Hz, default 1e5)
 * @param nPts    Number of log-spaced frequency points (default 60)
 *
 * References:
 *   Randles J.E.B., Discuss. Faraday Soc. 1, 11 (1947).
 *   Orazem M.E. & Tribollet B., Electrochemical Impedance Spectroscopy,
 *     Wiley (2008).
 */
export function simulateEIS(
  Rs    =  10,
  Rct   =  200,
  Cdl   =  20e-6,
  sigma =  30,
  fMin  =  0.01,
  fMax  =  1e5,
  nPts  =  60
): EISSimResult {
  const logMin = Math.log10(fMin), logMax = Math.log10(fMax);
  const freqs  = Array.from({ length: nPts }, (_, k) =>
    Math.pow(10, logMin + (logMax - logMin) * k / (nPts - 1))
  );
  const omegas = freqs.map(f => 2 * Math.PI * f);

  const Zre: number[]     = [];
  const Zim_neg: number[] = [];
  const Zmag: number[]    = [];
  const phase_deg: number[] = [];

  for (const w of omegas) {
    // Warburg: Zw = σ/√ω · (1 − i)
    const ZwRe = sigma / Math.sqrt(w);
    const ZwIm = -sigma / Math.sqrt(w);   // imaginary part (negative)

    // Rct + Zw (series)
    const ZbRe = Rct + ZwRe;
    const ZbIm = ZwIm;

    // 1 / Zb (complex division)
    const ZbMag2 = ZbRe ** 2 + ZbIm ** 2;
    const invZbRe =  ZbRe / ZbMag2;
    const invZbIm = -ZbIm / ZbMag2;

    // Add iωCdl: 1/jωCdl → admittance = jωCdl
    const YtotRe = invZbRe;
    const YtotIm = invZbIm + w * Cdl;

    // Z_parallel = 1 / Y_total
    const YMag2  = YtotRe ** 2 + YtotIm ** 2;
    const ZpRe   =  YtotRe / YMag2;
    const ZpIm   = -YtotIm / YMag2;

    // Total Z = Rs + Z_parallel
    const ZtRe = Rs + ZpRe;
    const ZtIm = ZpIm;

    Zre.push(ZtRe);
    Zim_neg.push(-ZtIm);    // convention: plot −Z″ on y-axis
    const mag = Math.sqrt(ZtRe ** 2 + ZtIm ** 2);
    Zmag.push(mag);
    phase_deg.push(Math.atan2(ZtIm, ZtRe) * 180 / Math.PI);
  }

  const omega_max = 1 / (Rct * Cdl);

  return {
    omega: omegas, Zre, Zim_neg, Zmag, phase_deg,
    omega_max: parseFloat(omega_max.toFixed(4)),
    Rct, Rs, Cdl,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 11c. PL-EX (Photoluminescence Excitation–Emission) MAP SIMULATOR
// ─────────────────────────────────────────────────────────────────────────────

export interface PLEXMapResult {
  /** Excitation wavelengths (nm) */
  ex_nm: number[];
  /** Emission wavelengths (nm) */
  em_nm: number[];
  /**
   * Intensity matrix [nEx][nEm].
   * Row i = emission spectrum at excitation ex_nm[i].
   */
  intensity: number[][];
  /** Peak excitation wavelength λex_max (nm) */
  ex_max_nm: number;
  /** Peak emission wavelength λem_max (nm) */
  em_max_nm: number;
  /** Stokes shift (nm) */
  stokes_shift_nm: number;
}

/**
 * Simulate a 2D PL-EX (excitation–emission) map for a quantum dot / fluorophore.
 *
 * Each emission spectrum at excitation wavelength λex is modelled as a
 * Gaussian peak whose amplitude is weighted by the absorption cross-section
 * (itself a Gaussian centred at λex_abs). The Stokes shift displaces the
 * emission peak from the excitation peak.
 *
 * @param ex_min      Minimum excitation wavelength (nm, default 300)
 * @param ex_max      Maximum excitation wavelength (nm, default 500)
 * @param em_min      Minimum emission wavelength (nm, default 350)
 * @param em_max      Maximum emission wavelength (nm, default 700)
 * @param ex_abs_peak Absorption peak λex (nm, default 370)
 * @param em_peak     Emission peak λem (nm, default 450)
 * @param ex_fwhm     FWHM of absorption band (nm, default 40)
 * @param em_fwhm     FWHM of emission band (nm, default 50)
 * @param nEx         Number of excitation points (default 40)
 * @param nEm         Number of emission points (default 80)
 */
export function simulatePLEXMap(
  ex_min      = 300,
  ex_max      = 500,
  em_min      = 350,
  em_max      = 700,
  ex_abs_peak = 370,
  em_peak     = 450,
  ex_fwhm     = 40,
  em_fwhm     = 50,
  nEx         = 40,
  nEm         = 80
): PLEXMapResult {
  const ex_nm = Array.from({ length: nEx }, (_, i) => ex_min + (ex_max - ex_min) * i / (nEx - 1));
  const em_nm = Array.from({ length: nEm }, (_, i) => em_min + (em_max - em_min) * i / (nEm - 1));

  const sigEx = ex_fwhm / (2 * Math.sqrt(2 * Math.LN2));
  const sigEm = em_fwhm / (2 * Math.sqrt(2 * Math.LN2));

  // Stokes shift as a function of λex: longer λex → smaller Stokes shift
  const stokesBase = em_peak - ex_abs_peak;

  const intensity: number[][] = ex_nm.map(ex => {
    // Absorption weight at this λex
    const absWeight = Math.exp(-0.5 * ((ex - ex_abs_peak) / sigEx) ** 2);

    // Emission peak shifts slightly with excitation (quantum confinement effect)
    const emPeakShifted = em_peak + 0.2 * (ex - ex_abs_peak);

    // Rayleigh scatter peak at λ = λex (sharp, narrow)
    const scatterSig = 3;

    return em_nm.map(em => {
      const emGauss     = absWeight * Math.exp(-0.5 * ((em - emPeakShifted) / sigEm) ** 2);
      const rayleigh    = 0.08 * Math.exp(-0.5 * ((em - ex) / scatterSig) ** 2);
      const raman       = 0.03 * Math.exp(-0.5 * ((em - (ex + 15)) / (scatterSig * 2)) ** 2);
      return Math.max(emGauss + rayleigh + raman, 0);
    });
  });

  // Find global max
  let ex_max_nm = ex_nm[0], em_max_nm = em_nm[0], globalMax = 0;
  for (let i = 0; i < nEx; i++)
    for (let j = 0; j < nEm; j++)
      if (intensity[i][j] > globalMax) {
        globalMax = intensity[i][j]; ex_max_nm = ex_nm[i]; em_max_nm = em_nm[j];
      }

  return {
    ex_nm, em_nm, intensity,
    ex_max_nm: parseFloat(ex_max_nm.toFixed(1)),
    em_max_nm: parseFloat(em_max_nm.toFixed(1)),
    stokes_shift_nm: parseFloat((em_max_nm - ex_max_nm).toFixed(1)),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 11d. EPR / ESR SPECTRUM SIMULATOR
// ─────────────────────────────────────────────────────────────────────────────

export interface EPRSimResult {
  /** Magnetic field axis B (mT) */
  B: number[];
  /** Absorption spectrum χ″(B) (a.u.) */
  absorption: number[];
  /** First-derivative spectrum dχ″/dB (a.u.) — standard EPR output */
  derivative: number[];
  /** g-factor */
  g: number;
  /** Resonant field B₀ (mT) at g-factor centre */
  B0_mT: number;
  /** Linewidth ΔB (mT, peak-to-peak of derivative) */
  linewidth_mT: number;
}

/**
 * EPR / ESR first-derivative spectrum simulator.
 *
 * Models a single radical species with isotropic g-factor and optional
 * hyperfine coupling. The absorption is a Lorentzian or Gaussian lineshape;
 * the standard EPR output is the first derivative dχ″/dB.
 *
 * Resonance condition:  hν = g·μB·B₀
 *   B₀ (mT) = hν / (g·μB) · 1000
 *
 * @param g          g-factor (default 2.0023 for free electron)
 * @param freq_GHz   Microwave frequency (GHz, default 9.5 X-band)
 * @param linewidth  Lorentzian linewidth ΔB (mT peak-to-peak, default 1.0)
 * @param lineshape  'lorentzian' or 'gaussian' (default 'lorentzian')
 * @param hfcA       Hyperfine coupling constant A (mT, default 0 = no HFC)
 * @param nLines     Number of hyperfine lines (default 1)
 * @param nPoints    Number of field points (default 500)
 */
export function simulateEPR(
  g          = 2.0023,
  freq_GHz   = 9.5,
  linewidth  = 1.0,
  lineshape: 'lorentzian' | 'gaussian' = 'lorentzian',
  hfcA       = 0,
  nLines     = 1,
  nPoints    = 500
): EPRSimResult {
  const h   = 6.626e-34;   // J s
  const muB = 9.274e-24;   // J T⁻¹
  const nu  = freq_GHz * 1e9;

  // Resonant field in Tesla, converted to mT
  const B0_T  = (h * nu) / (g * muB);
  const B0_mT = B0_T * 1000;

  // Scan range ±4 linewidths from B0 (or wider if HFC present)
  const span  = Math.max(6 * linewidth + Math.abs(hfcA) * nLines * 2, 15);
  const B = Array.from({ length: nPoints }, (_, k) =>
    B0_mT - span + 2 * span * k / (nPoints - 1)
  );

  const sig = linewidth / (2 * Math.sqrt(2 * Math.LN2));  // σ for Gaussian

  // Hyperfine line positions: equally spaced by A, centred at B0
  const centres: number[] = [];
  if (nLines <= 1 || hfcA === 0) {
    centres.push(B0_mT);
  } else {
    for (let m = -(nLines - 1) / 2; m <= (nLines - 1) / 2; m++) {
      centres.push(B0_mT + m * hfcA);
    }
  }

  // Binomial intensities for nLines hyperfine lines
  const binomCoeffs: number[] = Array.from({ length: nLines }, (_, k) => {
    let c = 1;
    for (let j = 0; j < k; j++) c *= (nLines - 1 - j) / (j + 1);
    return c;
  });
  const normFactor = binomCoeffs.reduce((s, v) => s + v, 0) || 1;

  const absorption = B.map(Bi => {
    let sum = 0;
    for (let idx = 0; idx < centres.length; idx++) {
      const dB  = Bi - centres[idx];
      const amp = binomCoeffs[idx] / normFactor;
      if (lineshape === 'lorentzian') {
        sum += amp * (linewidth / 2) ** 2 / (dB ** 2 + (linewidth / 2) ** 2);
      } else {
        sum += amp * Math.exp(-0.5 * (dB / sig) ** 2);
      }
    }
    return sum;
  });

  // First derivative via central differences
  const derivative = absorption.map((_, i) => {
    if (i === 0 || i === nPoints - 1) return 0;
    return (absorption[i + 1] - absorption[i - 1]) / (B[i + 1] - B[i - 1]);
  });

  return { B, absorption, derivative, g, B0_mT: parseFloat(B0_mT.toFixed(3)), linewidth_mT: linewidth };
}

// ─────────────────────────────────────────────────────────────────────────────
// 11e. MASS SPECTRUM (EI) + ISOTOPE PATTERN CALCULATOR
// ─────────────────────────────────────────────────────────────────────────────

export interface MassSpecResult {
  /** m/z axis */
  mz: number[];
  /** Relative intensity (0–100) */
  intensity: number[];
  /** Isotope pattern entries [{mz, abundance}] */
  isotopePattern: Array<{ mz: number; abundance: number; label: string }>;
  /** Monoisotopic mass */
  monoisotopicMass: number;
  /** Average molecular mass */
  averageMass: number;
}

/**
 * Electron Ionisation (EI) mass spectrum + isotope pattern calculator.
 *
 * Computes the theoretical isotope distribution for a molecular formula
 * using the natural isotopic abundances of C, H, N, O, S, Cl, Br.
 * The pattern is computed by convolution of individual element distributions.
 *
 * Additionally generates a stick EI spectrum with M⁺, [M−1]⁺, [M+1]⁺,
 * and common fragment ions at 0.6×M and 0.4×M.
 *
 * @param formula  Molecular formula as object, e.g. {C:6, H:6} for benzene
 *
 * References:
 *   Yergey J.A., Int. J. Mass Spectrom. 52, 337 (1983).
 *   McLafferty F.W. & Tureček F., Interpretation of Mass Spectra (1993).
 */
export function simulateMassSpectrum(
  formula: Partial<Record<'C' | 'H' | 'N' | 'O' | 'S' | 'Cl' | 'Br' | 'F' | 'P', number>>
): MassSpecResult {
  // Isotope data: [mass, abundance] pairs per element
  const isotopes: Record<string, Array<[number, number]>> = {
    C:  [[12.000, 0.9893], [13.003, 0.0107]],
    H:  [[1.00783, 0.99985], [2.01410, 0.00015]],
    N:  [[14.003, 0.9963], [15.000, 0.0037]],
    O:  [[15.995, 0.99757], [16.999, 0.00038], [17.999, 0.00205]],
    S:  [[31.972, 0.9499], [32.971, 0.0075], [33.967, 0.0425], [35.967, 0.0001]],
    Cl: [[34.969, 0.7577], [36.966, 0.2423]],
    Br: [[78.918, 0.5069], [80.916, 0.4931]],
    F:  [[18.998, 1.0000]],
    P:  [[30.974, 1.0000]],
  };

  // Monoisotopic and average masses
  let monoMass = 0, avgMass = 0;
  for (const [el, count] of Object.entries(formula) as [string, number][]) {
    const iso = isotopes[el] || [];
    monoMass += (iso[0]?.[0] ?? 0) * count;
    avgMass  += iso.reduce((s, [m, a]) => s + m * a, 0) * count;
  }

  // Convolve isotope distributions
  // Start with [mass=0, abundance=1]
  let dist: Map<number, number> = new Map([[0, 1]]);

  for (const [el, count] of Object.entries(formula) as [string, number][]) {
    const iso = isotopes[el] ?? [[0, 1]];
    for (let rep = 0; rep < count; rep++) {
      const newDist = new Map<number, number>();
      for (const [m1, a1] of dist.entries()) {
        for (const [dm, da] of iso) {
          const key = Math.round((m1 + dm) * 100) / 100;
          newDist.set(key, (newDist.get(key) ?? 0) + a1 * da);
        }
      }
      dist = newDist;
    }
  }

  // Sort and normalise to 100
  const entries = Array.from(dist.entries()).sort((a, b) => a[0] - b[0]);
  const maxAb   = Math.max(...entries.map(e => e[1])) || 1;
  const isotopePattern = entries.map(([mz, ab]) => ({
    mz:        parseFloat(mz.toFixed(4)),
    abundance: parseFloat((ab / maxAb * 100).toFixed(2)),
    label:     `M${mz - monoMass > 0.5 ? '+' + Math.round(mz - monoMass) : mz - monoMass < -0.5 ? Math.round(mz - monoMass) : '⁺'}`,
  }));

  // Build display spectrum: isotope pattern + fragment ions
  const allMz:  number[] = [];
  const allInt: number[] = [];
  for (const { mz, abundance } of isotopePattern) {
    allMz.push(mz); allInt.push(abundance);
  }
  // Common EI fragments
  const fragments: Array<[number, number]> = ([
    [monoMass * 0.77, 40],
    [monoMass * 0.65, 25],
    [monoMass * 0.51, 15],
    [monoMass * 0.38, 30],
    [monoMass * 0.25, 20],
    [28,  10], [29, 8], [43, 12], [57, 18], [77, 22],
  ] as Array<[number, number]>).filter(([m]) => m > 10 && m < monoMass - 1);
  for (const [m, i] of fragments) { allMz.push(parseFloat(m.toFixed(1))); allInt.push(i); }

  return {
    mz:              allMz,
    intensity:       allInt,
    isotopePattern,
    monoisotopicMass: parseFloat(monoMass.toFixed(4)),
    averageMass:      parseFloat(avgMass.toFixed(4)),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 11f. TGA CURVE + KISSINGER ACTIVATION ENERGY
// ─────────────────────────────────────────────────────────────────────────────

export interface TGASimResult {
  /** Temperature axis T (°C) */
  T_C: number[];
  /** Mass remaining (%) */
  mass_pct: number[];
  /** DTG (derivative thermogravimetry, %/°C) */
  dtg: number[];
  /** Onset temperature of each decomposition step (°C) */
  T_onset: number[];
  /** Midpoint temperature of each decomposition step (°C) */
  T_mid: number[];
  /** Mass loss per step (%) */
  massLoss: number[];
}

export interface KissingerResult {
  /** Activation energy Ea (kJ mol⁻¹) from slope */
  Ea_kJ: number;
  /** Pre-exponential factor ln(A/β²) from intercept */
  lnA_over_beta2: number;
  /** R² of Kissinger linear regression */
  r2: number;
  /** Data used: [{beta, Tp_K}] */
  data: Array<{ beta: number; Tp_K: number; x: number; y: number }>;
}

/**
 * TGA (Thermogravimetric Analysis) curve simulator.
 *
 * Models multi-step thermal decomposition as a sum of sigmoidal (logistic)
 * mass-loss steps, each characterised by a midpoint temperature and width.
 *
 * @param steps   Decomposition steps [{Tmid_C, massLoss_pct, width_C}]
 * @param T_start Start temperature (°C, default 25)
 * @param T_end   End temperature (°C, default 800)
 * @param nPts    Number of temperature points (default 500)
 */
export function simulateTGA(
  steps: Array<{ Tmid_C: number; massLoss_pct: number; width_C: number }>,
  T_start = 25,
  T_end   = 800,
  nPts    = 500
): TGASimResult {
  const T_C = Array.from({ length: nPts }, (_, k) =>
    T_start + (T_end - T_start) * k / (nPts - 1)
  );

  // Total mass loss per temperature: sum of logistic step functions
  const totalLoss = T_C.map(T => {
    return steps.reduce((sum, step) => {
      const x  = (T - step.Tmid_C) / (step.width_C / 10);
      const sig = 1 / (1 + Math.exp(-x));
      return sum + step.massLoss_pct * sig;
    }, 0);
  });

  const mass_pct = totalLoss.map(loss => Math.max(100 - loss, 0));

  // DTG via central differences
  const dtg = mass_pct.map((_, i) => {
    if (i === 0 || i === nPts - 1) return 0;
    const dT = T_C[i + 1] - T_C[i - 1];
    return (mass_pct[i + 1] - mass_pct[i - 1]) / dT;
  });

  // Onset and midpoint from DTG minimum per step
  const T_onset: number[] = steps.map(s => s.Tmid_C - s.width_C * 0.6);
  const T_mid:   number[] = steps.map(s => s.Tmid_C);
  const massLoss: number[] = steps.map(s => s.massLoss_pct);

  return { T_C, mass_pct, dtg, T_onset, T_mid, massLoss };
}

/**
 * Kissinger method for activation energy from multi-rate TGA/DSC data.
 *
 * For each heating rate β and the corresponding peak temperature Tp:
 *   ln(β / Tp²) = −Ea/(R·Tp) + ln(A·R/Ea)
 *
 * Plotting ln(β/Tp²) vs 1/Tp gives slope = −Ea/R.
 *
 * @param data  Array of {beta (K min⁻¹), Tp_K (K)} from experiments at
 *              different heating rates
 *
 * Reference: Kissinger H.E., Anal. Chem. 29, 1702 (1957).
 */
export function kissingerAnalysis(
  data: Array<{ beta: number; Tp_K: number }>
): KissingerResult {
  if (data.length < 3) throw new Error('Kissinger analysis requires ≥ 3 heating rates.');
  const R = 8.314;  // J mol⁻¹ K⁻¹

  const pts = data.map(d => ({
    beta: d.beta,
    Tp_K: d.Tp_K,
    x:  1 / d.Tp_K,
    y: Math.log(d.beta / (d.Tp_K ** 2)),
  }));

  const { m, c, r2 } = linearRegression(pts.map(p => p.x), pts.map(p => p.y));
  const Ea_J   = -m * R;
  const Ea_kJ  = Ea_J / 1000;

  return {
    Ea_kJ:           parseFloat(Ea_kJ.toFixed(2)),
    lnA_over_beta2:  parseFloat(c.toFixed(4)),
    r2:              parseFloat(r2.toFixed(5)),
    data:            pts,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// ── REPLICATE STATISTICS / ERROR BARS ───────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

export interface ReplicateStatsResult {
  /** Shared x-axis (taken from the first replicate; all replicates must share it) */
  x: number[];
  /** Per-point mean across all replicate series */
  mean: number[];
  /** Per-point sample standard deviation across all replicate series (n-1 denominator) */
  stdDev: number[];
  /** Per-point standard error of the mean: stdDev / sqrt(n) */
  sem: number[];
  /** Number of replicate series averaged */
  nReplicates: number;
}

/**
 * Compute per-point mean, standard deviation, and standard error of the
 * mean across two or more replicate spectra sharing a common x-axis.
 *
 * This is the statistically honest basis for Y-axis error bars: rather
 * than fabricating an uncertainty value, the error bar at each point
 * reflects the actual spread observed across real repeated measurements
 * of the same sample/condition.
 *
 * All replicate series must have the same length and be sampled at the
 * same x-values (e.g. the same instrument scan range and step size); use
 * `interpolate()` first if replicates were recorded on different axes.
 *
 * @param x          Shared x-axis values
 * @param replicates Array of y-value arrays, one per replicate measurement
 * @param useSEM     If true, return SEM instead of population SD for the
 *                    primary error bar convention (default: false, uses SD)
 */
export function computeReplicateStats(
  x: number[],
  replicates: number[][]
): ReplicateStatsResult {
  if (replicates.length < 2) {
    throw new Error('Error-bar statistics require at least 2 replicate series.');
  }
  const n = replicates.length;
  const len = x.length;
  for (const r of replicates) {
    if (r.length !== len) {
      throw new Error('All replicate series must have the same length as the shared x-axis.');
    }
  }

  const mean: number[] = new Array(len).fill(0);
  for (let i = 0; i < len; i++) {
    let sum = 0;
    for (let j = 0; j < n; j++) sum += replicates[j][i];
    mean[i] = sum / n;
  }

  const stdDev: number[] = new Array(len).fill(0);
  for (let i = 0; i < len; i++) {
    let sumSq = 0;
    for (let j = 0; j < n; j++) sumSq += (replicates[j][i] - mean[i]) ** 2;
    // Sample standard deviation (n-1 denominator) — appropriate when
    // replicates are a sample of possible measurements, not the full
    // population, which is the case for essentially all real lab replicates.
    stdDev[i] = n > 1 ? Math.sqrt(sumSq / (n - 1)) : 0;
  }

  const sem = stdDev.map(sd => sd / Math.sqrt(n));

  return { x: [...x], mean, stdDev, sem, nReplicates: n };
}

// ═══════════════════════════════════════════════════════════════════════════════
// ── STATISTICAL SIGNIFICANCE TESTING ────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

export interface TTestResult {
  /** Mean of group 1 */
  mean1: number;
  /** Mean of group 2 */
  mean2: number;
  /** Welch's t-statistic */
  t: number;
  /** Degrees of freedom (Welch-Satterthwaite approximation) */
  df: number;
  /** Two-tailed p-value */
  pValue: number;
  /** Conventional significance marker: 'ns', '*', '**', or '***' */
  marker: 'ns' | '*' | '**' | '***';
}

/**
 * Regularized incomplete beta function I_x(a, b), computed via the
 * continued-fraction expansion (Numerical Recipes algorithm). This is the
 * standard numerically stable method used internally by SciPy, R, and most
 * statistical libraries to evaluate Student's t-distribution CDF — it is
 * not an approximation specific to this codebase.
 */
function incompleteBeta(x: number, a: number, b: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;

  const lnBeta = lnGamma(a) + lnGamma(b) - lnGamma(a + b);
  const front = Math.exp(Math.log(x) * a + Math.log(1 - x) * b - lnBeta) / a;

  // Use the symmetry relation for faster convergence when x > (a+1)/(a+b+2)
  if (x >= (a + 1) / (a + b + 2)) {
    return 1 - incompleteBeta(1 - x, b, a);
  }

  // Modified Lentz's continued fraction (Numerical Recipes §6.4 / betacf).
  // The first step uses a specific closed-form initialization
  // (qab = a+b, qap = a+1, qam = a-1) — this is NOT the same as the m=0
  // term of the general recurrence below, and using a generic d=0 start
  // here (as an earlier version of this function did) converges to a
  // numerically wrong answer rather than merely an imprecise one, despite
  // otherwise looking like it converges cleanly. Verified against
  // scipy.special.betainc reference values after this fix.
  const MAXIT = 200, EPS = 1e-12, FPMIN = 1e-300;
  const qab = a + b, qap = a + 1, qam = a - 1;

  let c = 1;
  let d = 1 - qab * x / qap;
  if (Math.abs(d) < FPMIN) d = FPMIN;
  d = 1 / d;
  let h = d;

  for (let m = 1; m <= MAXIT; m++) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    h *= d * c;

    aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    const del = d * c;
    h *= del;

    if (Math.abs(del - 1) < EPS) break;
  }

  return front * h;
}

/**
 * Natural log of the Gamma function via the Lanczos approximation
 * (g=7, n=9 coefficients) — standard, widely-published numerically stable
 * implementation used to avoid overflow in factorial-like computations.
 */
function lnGamma(z: number): number {
  const g = 7;
  const c = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028,
    771.32342877765313, -176.61502916214059, 12.507343278686905,
    -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
  ];
  if (z < 0.5) {
    return Math.log(Math.PI / Math.sin(Math.PI * z)) - lnGamma(1 - z);
  }
  z -= 1;
  let x = c[0];
  for (let i = 1; i < g + 2; i++) x += c[i] / (z + i);
  const t = z + g + 0.5;
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
}

/**
 * Two-tailed p-value for Student's t-distribution with `df` degrees of
 * freedom, evaluated via the regularized incomplete beta function:
 *
 *   P(|T| > |t|) = I_{df/(df+t²)}(df/2, 1/2)
 */
function tDistributionTwoTailedP(t: number, df: number): number {
  const x = df / (df + t * t);
  return incompleteBeta(x, df / 2, 0.5);
}

/**
 * Welch's two-sample t-test (unequal variances assumed), the standard
 * default choice for comparing two independent sample means without
 * requiring the assumption of equal population variances — appropriate
 * for essentially all real lab replicate comparisons.
 *
 * Returns the conventional significance marker convention used throughout
 * the chemistry/biology literature:
 *   p ≥ 0.05        → 'ns' (not significant)
 *   0.01 ≤ p < 0.05  → '*'
 *   0.001 ≤ p < 0.01 → '**'
 *   p < 0.001        → '***'
 *
 * @param group1  First sample's individual measurements (not pre-averaged)
 * @param group2  Second sample's individual measurements
 *
 * Reference: Welch B.L., Biometrika 34, 28–35 (1947).
 */
export function welchTTest(group1: number[], group2: number[]): TTestResult {
  if (group1.length < 2 || group2.length < 2) {
    throw new Error('Welch\'s t-test requires at least 2 measurements per group.');
  }

  const n1 = group1.length, n2 = group2.length;
  const mean1 = group1.reduce((s, v) => s + v, 0) / n1;
  const mean2 = group2.reduce((s, v) => s + v, 0) / n2;

  const var1 = group1.reduce((s, v) => s + (v - mean1) ** 2, 0) / (n1 - 1);
  const var2 = group2.reduce((s, v) => s + (v - mean2) ** 2, 0) / (n2 - 1);

  const se1 = var1 / n1;
  const se2 = var2 / n2;
  const seCombined = Math.sqrt(se1 + se2);

  const t = (mean1 - mean2) / seCombined;

  // Welch-Satterthwaite degrees of freedom approximation
  const df = (se1 + se2) ** 2 / ((se1 ** 2) / (n1 - 1) + (se2 ** 2) / (n2 - 1));

  const pValue = tDistributionTwoTailedP(Math.abs(t), df);

  let marker: 'ns' | '*' | '**' | '***' = 'ns';
  if (pValue < 0.001) marker = '***';
  else if (pValue < 0.01) marker = '**';
  else if (pValue < 0.05) marker = '*';

  return {
    mean1: parseFloat(mean1.toFixed(6)),
    mean2: parseFloat(mean2.toFixed(6)),
    t: parseFloat(t.toFixed(4)),
    df: parseFloat(df.toFixed(2)),
    pValue: parseFloat(pValue.toFixed(6)),
    marker,
  };
}
