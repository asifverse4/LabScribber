/**
 * @license
 * SPDX-License-Identifier: MIT
 */

export interface PeakData {
  id: string;
  x: number;
  y: number;
  label: string;
  confidence: number;
  dx: number; // visual annotation text offset X (px)
  dy: number; // visual annotation text offset Y (px)
  transition?: string; // spectroscopic molecular transition, e.g., π -> π*
}

export interface IntegralData {
  id: string;
  xmin: number;
  xmax: number;
  area: number;
}

export interface TaucData {
  m: number;
  c: number;
  eg: number;
  x_start: number;
  x_end: number;
  transition: 'direct' | 'indirect';
}

export interface JobsData {
  x_int: number;
  y_int: number;
  m1: number;
  c1: number;
  r2_1: number;
  m2: number;
  c2: number;
  r2_2: number;
}

// ─── Tier-1 new result types ────────────────────────────────────────────────

/**
 * Per-peak statistics returned by fitSpectralPeaks after optimisation.
 * All widths are reported as the full-width at half-maximum (FWHM) in
 * x-axis units; area is the analytical integral of the fitted component.
 */
export interface FitPeakStats {
  index: number;       // 0-based component index
  center: number;      // Optimised peak centre (x-axis units)
  amplitude: number;   // Optimised amplitude
  fwhm: number;        // Full-width at half-maximum (x-axis units)
  area: number;        // Analytical peak area (amplitude × width × √(2π) for Gaussian)
  eta?: number;        // Voigt mixing parameter η ∈ [0,1] (Voigt only)

  // ─── Parameter uncertainty (NEW) ──────────────────────────────────────────
  // Asymptotic 1σ standard errors from the linearized least-squares
  // covariance matrix, Σ = σ̂²·(JᵀJ)⁻¹, evaluated at the optimum (J = Jacobian
  // of the residuals w.r.t. fit parameters via central finite differences,
  // σ̂² = SSR / degrees-of-freedom). FWHM/area errors are propagated from the
  // parameter covariance via the delta method (first-order Taylor expansion).
  // undefined when the covariance matrix could not be computed (e.g.
  // insufficient degrees of freedom or a singular Jacobian).
  centerSE?: number;
  amplitudeSE?: number;
  fwhmSE?: number;
  areaSE?: number;
  etaSE?: number;
}

/**
 * Goodness-of-fit metrics for the full multi-component deconvolution.
 */
export interface FitGoodnessMetrics {
  r2: number;          // Coefficient of determination (1 − SSR/SST)
  chi2: number;        // Reduced chi-squared (SSR / degrees-of-freedom)
  rmse: number;        // Root-mean-square error
  dof: number;         // Degrees of freedom (N_points − N_params)
  uncertaintyAvailable?: boolean; // Whether parameter SEs could be computed (see FitPeakStats)
}

/**
 * One row of the Batch Processor's results summary — one entry per dataset
 * processed, with an optional per-peak breakdown when peak detection/fitting
 * was included in the batch pipeline. Used to render the in-panel results
 * table and to build the downloadable long-format summary CSV.
 */
export interface BatchSummaryRow {
  datasetId: string;
  name: string;
  technique: string;
  nPoints: number;
  peaksDetected: number;
  fitApplied: boolean;
  fitProfile?: 'Gaussian' | 'Lorentzian' | 'Voigt';
  goodnessOfFit?: FitGoodnessMetrics;
  peaks?: FitPeakStats[];
}

/**
 * Complete return value from fitSpectralPeaks — extends the raw arrays with
 * per-peak statistics and global goodness-of-fit metrics.
 */
export interface FitResult {
  fitResult: number[];
  fitComponents: number[][];
  fitResiduals: number[];
  peakStats: FitPeakStats[];       // NEW — one entry per fitted component
  goodnessOfFit: FitGoodnessMetrics; // NEW — global quality metrics
}

/**
 * Scherrer crystallite-size result (XRD).
 * D = K·λ / (β·cosθ)
 */
export interface ScherrerResult {
  /** Mean crystallite size in nanometres */
  D_nm: number;
  /** Scherrer constant used (default 0.94 for spherical crystallites) */
  K: number;
  /** X-ray wavelength used in Å */
  lambda_angstrom: number;
  /** FWHM of the diffraction peak in radians */
  beta_rad: number;
  /** Bragg angle θ in degrees */
  theta_deg: number;
}

/**
 * Urbach energy result (UV-Vis / PL absorption edge).
 * α(E) = α₀ · exp(E / Eᵤ)
 * Fit is performed in log(α) vs E space using linear regression.
 */
export interface UrbachResult {
  /** Urbach energy Eᵤ in eV */
  Eu_eV: number;
  /** Pre-exponential factor α₀ */
  alpha0: number;
  /** R² of the linear fit in log-space */
  r2: number;
  /** Energy range used for fit [E_min, E_max] in eV */
  fitRange_eV: [number, number];
}

/**
 * Stern–Volmer fluorescence-quenching result.
 * I₀/I = 1 + K_sv·[Q]
 * Returns both static and dynamic quenching characterisation.
 */
export interface SternVolmerResult {
  /** Stern–Volmer constant K_sv in units matching [Q] (typically M⁻¹) */
  Ksv: number;
  /** Intercept of the I₀/I vs [Q] plot (should be ≈1.0 for ideal SV) */
  intercept: number;
  /** R² of the linear Stern–Volmer fit */
  r2: number;
  /** Whether significant upward curvature detected (combined quenching) */
  isCombined: boolean;
  /** Bimolecular quenching rate kq = Ksv / τ₀ (requires τ₀ input) */
  kq?: number;
}

/**
 * Beer–Lambert calibration curve result.
 * A = ε · c · l  →  linear regression A vs c
 */
export interface BeerLambertResult {
  /** Molar attenuation coefficient ε (M⁻¹ cm⁻¹) = slope when l=1 cm */
  epsilon: number;
  /** Path length l (cm) — user-supplied or assumed 1.0 */
  pathLength: number;
  /** Intercept of A vs c regression (should be ≈0) */
  intercept: number;
  /** R² of the calibration regression */
  r2: number;
  /** Limit of detection LOD = 3·σ_blank / slope */
  LOD: number;
  /** Limit of quantification LOQ = 10·σ_blank / slope */
  LOQ: number;
  /** Standard error of estimate on ε */
  SE_epsilon: number;
}

// ─── Existing types (unchanged) ─────────────────────────────────────────────

export interface SpectrumData {
  id: string;
  name: string;
  technique: string;
  x_orig: number[];
  y_orig: number[];
  x: number[];
  y_processed: number[];

  color: string;
  visible: boolean;

  // Individual stylistic attributes
  lineWidth: number;
  lineStyle: 'solid' | 'dashed' | 'dotted' | 'none';
  marker: 'none' | 'circle' | 'square' | 'triangle' | 'cross';
  markerSize: number;

  peaks: PeakData[];
  integrals: IntegralData[];

  baseline: number[] | null;
  fitResult: number[] | null;
  fitComponents: number[][] | null;
  fitResiduals: number[] | null;

  // Per-point Y-axis uncertainty (e.g. standard deviation across replicate
  // measurements, or instrument-reported error). One value per point in
  // y_processed, in the same units. null means no error bars are shown.
  yError: number[] | null;

  // Statistical significance comparison brackets (e.g. comparing peak
  // heights or derived values between two conditions). Rendered as a
  // horizontal bracket with the marker text above it, in the canonical
  // ns/*/**/*** convention. Coordinates are in data units (x-axis position,
  // y-axis height), independent of yError.
  significanceAnnotations: Array<{
    id: string;
    x1: number;
    x2: number;
    y: number;
    marker: 'ns' | '*' | '**' | '***';
    label?: string;
  }> | null;

  // Which panel (0-indexed) this dataset is assigned to when layoutMode is
  // 'Multi-Panel Grid'. Datasets sharing the same panelIndex are overlaid
  // together within that one panel, exactly as they would be in Standard
  // Overlay mode, but the panel itself is one independent sub-plot among
  // several laid out in a grid with its own axes and a panel letter.
  // null/undefined defaults to panel 0.
  panelIndex?: number | null;

  // NEW — stored alongside existing fit arrays
  fitPeakStats: FitPeakStats[] | null;
  fitGoodnessOfFit: FitGoodnessMetrics | null;

  isTauc: boolean;
  taucData: TaucData | null;
  jobsData: JobsData | null;

  // State History for robust client-side Undo/Redo State Manager
  undoStack: number[][];
  redoStack: number[][];
  history: string[];
}

export type JournalStyleType = 'ACS' | 'Nature' | 'RSC' | 'Default';
export type ViewLayoutMode = 'Standard Overlay' | 'Waterfall Stack (3D Projection)' | '2D Heatmap / Contour Plot' | 'Multi-Panel Grid';

export interface PCAOutput {
  refX: number[];
  scores: number[][];
  loadings: number[][];
  explainedVariance: number[];
}

// ─── Tier-2 result types ────────────────────────────────────────────────────

export interface KubelkaMunkResult {
  FR: number[];
  taucFR: number[];
  hnu_eV: number[];
  Eg_eV: number;
  transition: 'direct' | 'indirect';
}

export interface ScatteringResult {
  alpha: number;
  A: number;
  background: number[];
  corrected: number[];
  r2: number;
}

export interface KramersKronigResult {
  n: number[];
  k: number[];
  epsilon1: number[];
  epsilon2: number[];
  omega: number[];
}

export interface PLQYResult {
  phi_x: number;
  intPL_x: number;
  intPL_ref: number;
  abs_x: number;
  abs_ref: number;
  phi_ref: number;
  refractiveCorrection: number;
}

export interface WilliamsonHallResult {
  D_nm: number;
  microstrain: number;
  r2: number;
  betaCosTheta: number[];
  fourSinTheta: number[];
  slope: number;
  intercept: number;
}

export interface WHPeakInput {
  twoTheta_deg: number;
  fwhm_deg: number;
  label?: string;
}

// ─── Tier-3 result types ────────────────────────────────────────────────────

export interface MCRALSResult {
  S: number[][];
  C: number[][];
  Dhat: number[][];
  E: number[][];
  lof: number[];
  finalLof: number;
  r2: number;
  nComponents: number;
}

export interface PLSResult {
  b: number[];
  T: number[][];
  P: number[][];
  q: number[];
  W: number[][];
  yHat: number[];
  rmsec: number;
  r2cal: number;
  xVariance: number[];
  nLV: number;
}

export interface HCAResult {
  linkage: Array<[number, number, number, number]>;
  labels: number[];
  nClusters: number;
  distMatrix: number[][];
}

export interface SimilarityResult {
  cosine: number;
  pearson: number;
  sad: number;
  sad_deg: number;
  euclidean: number;
  mad: number;
}

export interface FFTResult {
  frequencies: number[];
  magnitude: number[];
  phase: number[];
  psd: number[];
  dominantFreqIndex: number;
  dominantFreq: number;
  dominantPeriod: number;
}

export interface AutocorrResult {
  lags: number[];
  acf: number[];
  coherenceLength: number;
}

// ─── Tier-4 result types ────────────────────────────────────────────────────

export interface CVSimResult {
  E: number[];
  i: number[];
  Epa: number;
  Epc: number;
  ipa: number;
  ipc: number;
  E_half: number;
  deltaEp: number;
}

export interface EISSimResult {
  omega: number[];
  Zre: number[];
  Zim_neg: number[];
  Zmag: number[];
  phase_deg: number[];
  omega_max: number;
  Rct: number;
  Rs: number;
  Cdl: number;
}

export interface PLEXMapResult {
  ex_nm: number[];
  em_nm: number[];
  intensity: number[][];
  ex_max_nm: number;
  em_max_nm: number;
  stokes_shift_nm: number;
}

export interface EPRSimResult {
  B: number[];
  absorption: number[];
  derivative: number[];
  g: number;
  B0_mT: number;
  linewidth_mT: number;
}

export interface MassSpecResult {
  mz: number[];
  intensity: number[];
  isotopePattern: Array<{ mz: number; abundance: number; label: string }>;
  monoisotopicMass: number;
  averageMass: number;
}

export interface TGASimResult {
  T_C: number[];
  mass_pct: number[];
  dtg: number[];
  T_onset: number[];
  T_mid: number[];
  massLoss: number[];
}

export interface KissingerResult {
  Ea_kJ: number;
  lnA_over_beta2: number;
  r2: number;
  data: Array<{ beta: number; Tp_K: number; x: number; y: number }>;
}

export interface TGAStep {
  Tmid_C: number;
  massLoss_pct: number;
  width_C: number;
  label?: string;
}

export interface ReplicateStatsResult {
  x: number[];
  mean: number[];
  stdDev: number[];
  sem: number[];
  nReplicates: number;
}

export interface TTestResult {
  mean1: number;
  mean2: number;
  t: number;
  df: number;
  pValue: number;
  marker: 'ns' | '*' | '**' | '***';
}
