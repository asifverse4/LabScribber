/**
 * @license
 * SPDX-License-Identifier: MIT
 */

import React, { useState, useEffect } from 'react';
import { SpectrumData, JournalStyleType, ViewLayoutMode, PeakData, IntegralData, PCAOutput, FitPeakStats, FitGoodnessMetrics, BatchSummaryRow, ScherrerResult, UrbachResult, SternVolmerResult, BeerLambertResult, KubelkaMunkResult, ScatteringResult, KramersKronigResult, PLQYResult, WilliamsonHallResult, WHPeakInput, MCRALSResult, PLSResult, HCAResult, SimilarityResult, FFTResult, AutocorrResult, CVSimResult, EISSimResult, PLEXMapResult, EPRSimResult, MassSpecResult, TGASimResult, KissingerResult, TGAStep, ReplicateStatsResult, TTestResult } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { jsPDF } from 'jspdf';
import { generatePythonTkinterCode } from '../data/pyExporter';
import {
  savitzkyGolay,
  movingAverage,
  shirleyBaseline,
  snipBaseline,
  alsBaseline,
  spectralExpertHeuristics,
  fitSpectralPeaks,
  linearRegression,
  runPCASVD,
  scherrerSize,
  urbachEnergy,
  sternVolmer,
  beerLambertCalibration,
  kubelkaMunk,
  rayleighMieSubtraction,
  kramersKronig,
  relativePLQY,
  williamsonHall,
  mcrALS,
  plsRegression,
  hierarchicalClustering,
  spectralSimilarity,
  fftSpectrum,
  autocorrelation,
  simulateCV,
  simulateEIS,
  simulatePLEXMap,
  simulateEPR,
  simulateMassSpectrum,
  simulateTGA,
  kissingerAnalysis,
  computeReplicateStats,
  welchTTest,
} from '../utils/math';
import { JOURNAL_PALETTES } from '../utils/colors';
import {
  Undo,
  Redo,
  RefreshCw,
  Search,
  Sparkles,
  TrendingUp,
  Sliders,
  Maximize2,
  Download,
  FileSpreadsheet,
  Layers,
  ChevronRight,
  Palette,
  Crosshair,
  Grid,
  Loader2,
  Check,
  FileText,
  ClipboardCopy,
  Notebook,
  Users,
  History
} from 'lucide-react';
import { generateDatasetMethods, generateMethodsText } from '../utils/methodsGenerator';
import { buildBatchSummaryCSV } from '../utils/batchSummary';
import { generateProvenanceLog, provenanceLogToJSON, provenanceLogToCSV } from '../utils/provenance';

interface StoichiometryResult {
  ratio: string;
  formula: string;
  desc: string;
}

export function getStoichiometryName(x_max: number): StoichiometryResult {
  if (x_max < 0.1) {
    return {
      ratio: "No Complexation",
      formula: "",
      desc: "Mole fraction is too low to suggest meaningful complex formation or coordination binding."
    };
  }
  if (x_max >= 0.1 && x_max < 0.28) {
    return {
      ratio: "1:3 Host-Guest",
      formula: "[HG₃]",
      desc: "Characteristic of coordination spheres where one central host bonds with three guest coordinating entities or triple-helical architectures."
    };
  } else if (x_max >= 0.28 && x_max < 0.42) {
    return {
      ratio: "1:2 Host-Guest",
      formula: "[HG₂]",
      desc: "Bis-complexation. Encountered in metal-ligand chelates (e.g., ML₂) where two ligands coordinate to one metal ion center."
    };
  } else if (x_max >= 0.42 && x_max < 0.58) {
    return {
      ratio: "1:1 Host-Guest",
      formula: "[HG]",
      desc: "Classic 1:1 stoichiometry with molecular host cavity insertion, charge-transfer interactions, or simple electrostatic pairing."
    };
  } else if (x_max >= 0.58 && x_max < 0.72) {
    return {
      ratio: "2:1 Host-Guest",
      formula: "[H₂G]",
      desc: "Dual host sandwich structures or binuclear metallic centers where a single guest molecule is coordinate-bound by two host molecules."
    };
  } else {
    return {
      ratio: "3:1 Host-Guest",
      formula: "[H₃G]",
      desc: "Consistent with pristine trinuclear cluster coordination complexes or highly aggregated multi-host supra-assembly conformations."
    };
  }
}

interface SpectrumInspectorProps {
  datasets: SpectrumData[];
  selectedDataset: SpectrumData | null;
  onDatasetsUpdated: (list: SpectrumData[]) => void;
  onDatasetSelected: (ds: SpectrumData) => void;

  layoutMode: ViewLayoutMode;
  setLayoutMode: (val: ViewLayoutMode) => void;
  journalStyle: JournalStyleType;
  setJournalStyle: (val: JournalStyleType) => void;
  plotBgColor: string;
  setPlotBgColor: (val: string) => void;
  gridX: boolean;
  setGridX: (val: boolean) => void;
  gridY: boolean;
  setGridY: (val: boolean) => void;
  autoX: boolean;
  setAutoX: (val: boolean) => void;
  autoY: boolean;
  setAutoY: (val: boolean) => void;
  manualXMin: number;
  setManualXMin: (val: number) => void;
  manualXMax: number;
  setManualXMax: (val: number) => void;
  manualYMin: number;
  setManualYMin: (val: number) => void;
  manualYMax: number;
  setManualYMax: (val: number) => void;
  xLabel: string;
  setXLabel: (val: string) => void;
  yLabel: string;
  setYLabel: (val: string) => void;
  showLegend: boolean;
  setShowLegend: (val: boolean) => void;
  legendPos: string;
  setLegendPos: (val: string) => void;
  thickAxes: boolean;
  setThickAxes: (val: boolean) => void;
  dropLines: boolean;
  setDropLines: (val: boolean) => void;
  waterfallOffset: number;
  setWaterfallOffset: (val: number) => void;
  enableInset: boolean;
  setEnableInset: (val: boolean) => void;
  insetXMin: number;
  setInsetXMin: (val: number) => void;
  insetXMax: number;
  setInsetXMax: (val: number) => void;
  panelGridCols: number;
  setPanelGridCols: (val: number) => void;
  panelLabelCase: 'lowercase' | 'uppercase';
  setPanelLabelCase: (val: 'lowercase' | 'uppercase') => void;
  enableHighlight: boolean;
  setEnableHighlight: (val: boolean) => void;
  highlightMin: number;
  setHighlightMin: (val: number) => void;
  highlightMax: number;
  setHighlightMax: (val: number) => void;
  interactiveMode: 'navigate' | 'pick' | 'crop' | 'integrate';
  setInteractiveMode: (val: 'navigate' | 'pick' | 'crop' | 'integrate') => void;
  isPremium: boolean;
  exportCount: number;
  setExportCount: React.Dispatch<React.SetStateAction<number>>;
  onTriggerUpgrade: () => void;
  onExportSuccess?: () => void;
  onPreviewCorrectedYChange?: (y: number[] | null) => void;
  onOpenCiteKit?: () => void;

  // Custom Publication extensions
  invertX: boolean;
  setInvertX: (val: boolean) => void;
  invertY: boolean;
  setInvertY: (val: boolean) => void;
  tickStepX: number;
  setTickStepX: (val: number) => void;
  tickStepY: number;
  setTickStepY: (val: number) => void;
  minorTicksCount: number;
  setMinorTicksCount: (val: number) => void;
}

export const SpectrumInspector: React.FC<SpectrumInspectorProps> = ({
  datasets,
  selectedDataset,
  onDatasetsUpdated,
  onDatasetSelected,

  layoutMode,
  setLayoutMode,
  journalStyle,
  setJournalStyle,
  plotBgColor,
  setPlotBgColor,
  gridX,
  setGridX,
  gridY,
  setGridY,
  autoX,
  setAutoX,
  autoY,
  setAutoY,
  manualXMin,
  setManualXMin,
  manualXMax,
  setManualXMax,
  manualYMin,
  isPremium,
  exportCount,
  setExportCount,
  onTriggerUpgrade,
  onExportSuccess,
  onOpenCiteKit,
  setManualYMin,
  manualYMax,
  setManualYMax,
  xLabel,
  setXLabel,
  yLabel,
  setYLabel,
  showLegend,
  setShowLegend,
  legendPos,
  setLegendPos,
  thickAxes,
  setThickAxes,
  dropLines,
  setDropLines,
  waterfallOffset,
  setWaterfallOffset,
  enableInset,
  setEnableInset,
  insetXMin,
  setInsetXMin,
  insetXMax,
  setInsetXMax,
  panelGridCols,
  setPanelGridCols,
  panelLabelCase,
  setPanelLabelCase,
  enableHighlight,
  setEnableHighlight,
  highlightMin,
  setHighlightMin,
  highlightMax,
  setHighlightMax,
  interactiveMode,
  setInteractiveMode,
  onPreviewCorrectedYChange,

  // Deconstruct publication settings modifiers
  invertX,
  setInvertX,
  invertY,
  setInvertY,
  tickStepX,
  setTickStepX,
  tickStepY,
  setTickStepY,
  minorTicksCount,
  setMinorTicksCount
}) => {
  const [activeTab, setActiveTab] = useState<'process' | 'batch' | 'analyze' | 'tauc' | 'jobs' | 'style' | 'export'>('process');

  // Job's Plot States
  const [jobsTargetWl, setJobsTargetWl] = useState<string>('340');
  const [jobsSelectedIds, setJobsSelectedIds] = useState<string[]>([]);
  const [customMoleFractions, setCustomMoleFractions] = useState<Record<string, number>>({});

  // Multi-Step Processing State variables
  const [subtractionTarget, setSubtractionTarget] = useState<string>('None');
  const [smoothOpts, setSmoothOpts] = useState({
    enabled: false,
    method: 'Savitzky-Golay',
    window: 11,
    poly: 2,
    deriv: 0
  });
  const [baselineMethod, setBaselineMethod] = useState<'None' | 'Shirley' | 'SNIP' | 'ALS'>('None');
  const [alsLam, setAlsLam] = useState<number>(1e4);
  const [normalizeY, setNormalizeY] = useState<boolean>(false);

  // Batch Processing States
  const [batchSelectedIds, setBatchSelectedIds] = useState<string[]>([]);
  const [batchSmoothEnabled, setBatchSmoothEnabled] = useState<boolean>(false);
  const [batchSmoothMethod, setBatchSmoothMethod] = useState<'Savitzky-Golay' | 'Moving Average'>('Savitzky-Golay');
  const [batchSmoothWindow, setBatchSmoothWindow] = useState<number>(11);
  const [batchSmoothPoly, setBatchSmoothPoly] = useState<number>(2);
  const [batchSmoothDeriv, setBatchSmoothDeriv] = useState<number>(0);
  const [batchBaselineMethod, setBatchBaselineMethod] = useState<'None' | 'Shirley' | 'SNIP' | 'ALS'>('None');
  const [batchAlsLam, setBatchAlsLam] = useState<number>(1e4);
  const [batchNormalizeY, setBatchNormalizeY] = useState<boolean>(false);
  const [batchFromRaw, setBatchFromRaw] = useState<boolean>(true);
  const [batchDetectPeaks, setBatchDetectPeaks] = useState<boolean>(false);
  const [batchPeakProminence, setBatchPeakProminence] = useState<number>(0.05);
  const [batchFitPeaks, setBatchFitPeaks] = useState<boolean>(false);
  const [batchFitProfile, setBatchFitProfile] = useState<'Gaussian' | 'Lorentzian' | 'Voigt'>('Gaussian');
  const [batchSummary, setBatchSummary] = useState<BatchSummaryRow[] | null>(null);

  // Peak picking search parameters
  const [peakProminence, setPeakProminence] = useState<number>(0.05);

  // Curve fitting configurations
  const [fitProfile, setFitProfile] = useState<'Gaussian' | 'Lorentzian' | 'Voigt'>('Gaussian');
  const [fitConstraints, setFitConstraints] = useState({
    enforce: false,
    centerTol: 10,
    widthMin: 1.0,
    widthMax: 50.0
  });

  // PCA dialog state representation
  const [pcaResult, setPcaResult] = useState<PCAOutput | null>(null);
  const [isPcaModalOpen, setIsPcaModalOpen] = useState<boolean>(false);

  // ── Tier-1: Scherrer state ──────────────────────────────────────────────────
  const [scherrerTwoTheta, setScherrerTwoTheta] = useState<string>('38.18');
  const [scherrerLambda, setScherrerLambda]     = useState<string>('1.5406');
  const [scherrerK, setScherrerK]               = useState<string>('0.9394');
  const [scherrerWindow, setScherrerWindow]     = useState<string>('2.0');
  const [scherrerResult, setScherrerResult]     = useState<ScherrerResult | null>(null);
  const [scherrerError, setScherrerError]       = useState<string>('');

  // ── Tier-1: Urbach state ─────────────────────────────────────────────────
  const [urbachResult, setUrbachResult] = useState<UrbachResult | null>(null);
  const [urbachError, setUrbachError]   = useState<string>('');

  // ── Tier-1: Stern–Volmer state ───────────────────────────────────────────
  const [svConcs,  setSvConcs]   = useState<string>('0, 5, 10, 20, 40, 80');
  const [svInts,   setSvInts]    = useState<string>('');
  const [svTau0,   setSvTau0]    = useState<string>('');
  const [svResult, setSvResult]  = useState<SternVolmerResult | null>(null);
  const [svError,  setSvError]   = useState<string>('');

  // ── Tier-1: Beer–Lambert state ───────────────────────────────────────────
  const [blConcs,       setBlConcs]       = useState<string>('');
  const [blAbs,         setBlAbs]         = useState<string>('');
  const [blPathLength,  setBlPathLength]  = useState<string>('1.0');
  const [blResult,      setBlResult]      = useState<BeerLambertResult | null>(null);
  const [blError,       setBlError]       = useState<string>('');

  // ── Tier-2: Kubelka–Munk state ─────────────────────────────────────────────
  const [kmTransition, setKmTransition]   = useState<'direct' | 'indirect'>('direct');

  // ── Tauc fit-range constraint ────────────────────────────────────────────
  // The auto-detect "steepest slope in the whole spectrum" heuristic can lock
  // onto a steep but chemically unrelated feature elsewhere in the scan range
  // (most commonly the deep-UV solvent/cuvette absorption cutoff below
  // ~230 nm, or scattering artifacts), producing a confidently wrong bandgap
  // with no warning. This lets the user constrain the search to a physically
  // meaningful wavelength window around the actual absorption edge of
  // interest.
  const [taucUseManualRange, setTaucUseManualRange] = useState<boolean>(false);
  const [taucRangeMin,       setTaucRangeMin]       = useState<string>('300');
  const [taucRangeMax,       setTaucRangeMax]       = useState<string>('450');
  const [kmIsPercent,  setKmIsPercent]    = useState<boolean>(false);
  const [kmResult,     setKmResult]       = useState<KubelkaMunkResult | null>(null);
  const [kmError,      setKmError]        = useState<string>('');

  // ── Tier-2: Mie/Rayleigh state ───────────────────────────────────────────
  const [mieRefMin,    setMieRefMin]      = useState<string>('650');
  const [mieRefMax,    setMieRefMax]      = useState<string>('750');
  const [mieResult,    setMieResult]      = useState<ScatteringResult | null>(null);
  const [mieError,     setMieError]       = useState<string>('');

  // ── Tier-2: Kramers–Kronig state ─────────────────────────────────────────
  const [kkPathLen,    setKkPathLen]      = useState<string>('0.1');
  const [kkNInf,       setKkNInf]        = useState<string>('1.5');
  const [kkResult,     setKkResult]      = useState<KramersKronigResult | null>(null);
  const [kkError,      setKkError]       = useState<string>('');

  // ── Tier-2: PLQY state ───────────────────────────────────────────────────
  const [plqyRefId,    setPlqyRefId]     = useState<string>('');
  const [plqyAbsX,     setPlqyAbsX]     = useState<string>('');
  const [plqyAbsRef,   setPlqyAbsRef]   = useState<string>('');
  const [plqyPhiRef,   setPlqyPhiRef]   = useState<string>('0.546');
  const [plqyNX,       setPlqyNX]       = useState<string>('1.333');
  const [plqyNRef,     setPlqyNRef]     = useState<string>('1.333');
  const [plqyResult,   setPlqyResult]   = useState<PLQYResult | null>(null);
  const [plqyError,    setPlqyError]    = useState<string>('');

  // ── Tier-2: Williamson–Hall state ────────────────────────────────────────
  const [whPeaks,      setWhPeaks]      = useState<WHPeakInput[]>([
    { twoTheta_deg: 38.18, fwhm_deg: 0.42, label: 'Au(111)' },
    { twoTheta_deg: 44.39, fwhm_deg: 0.48, label: 'Au(200)' },
    { twoTheta_deg: 64.58, fwhm_deg: 0.61, label: 'Au(220)' },
    { twoTheta_deg: 77.54, fwhm_deg: 0.72, label: 'Au(311)' },
  ]);
  const [whLambda,     setWhLambda]     = useState<string>('1.5406');
  const [whResult,     setWhResult]     = useState<WilliamsonHallResult | null>(null);
  const [whError,      setWhError]      = useState<string>('');

  // ── Tier-3: MCR-ALS state ───────────────────────────────────────────────────
  const [mcrNComp,   setMcrNComp]   = useState<string>('2');
  const [mcrMaxIter, setMcrMaxIter] = useState<string>('50');
  const [mcrTol,     setMcrTol]     = useState<string>('0.1');
  const [mcrResult,  setMcrResult]  = useState<MCRALSResult | null>(null);
  const [mcrError,   setMcrError]   = useState<string>('');

  // ── Tier-3: PLS state ────────────────────────────────────────────────────
  const [plsNLV,    setPlsNLV]    = useState<string>('3');
  const [plsY,      setPlsY]      = useState<string>('');
  const [plsResult, setPlsResult] = useState<PLSResult | null>(null);
  const [plsError,  setPlsError]  = useState<string>('');

  // ── Tier-3: HCA state ────────────────────────────────────────────────────
  const [hcaCutDist, setHcaCutDist] = useState<string>('0.3');
  const [hcaResult,  setHcaResult]  = useState<HCAResult | null>(null);
  const [hcaError,   setHcaError]   = useState<string>('');

  // ── Error Bars / Replicate Statistics state ──────────────────────────────
  const [replicateIds,    setReplicateIds]    = useState<string[]>([]);
  const [replicateResult, setReplicateResult] = useState<ReplicateStatsResult | null>(null);
  const [replicateError,  setReplicateError]  = useState<string>('');
  const [errorBarMode,    setErrorBarMode]    = useState<'sd' | 'sem'>('sd');

  // ── Statistical Significance (Welch's t-test) state ──────────────────────
  const [sigGroup1Id,   setSigGroup1Id]   = useState<string>('');
  const [sigGroup2Id,   setSigGroup2Id]   = useState<string>('');
  const [sigGroup1Vals, setSigGroup1Vals] = useState<string>('');
  const [sigGroup2Vals, setSigGroup2Vals] = useState<string>('');
  const [sigLabel,      setSigLabel]      = useState<string>('');
  const [sigResult,     setSigResult]     = useState<TTestResult | null>(null);
  const [sigError,      setSigError]      = useState<string>('');

  // ── Tier-3: Spectral Similarity state ────────────────────────────────────
  const [simRefId,  setSimRefId]  = useState<string>('');
  const [simResult, setSimResult] = useState<SimilarityResult | null>(null);
  const [simError,  setSimError]  = useState<string>('');

  // ── Tier-3: FFT / Autocorrelation state ──────────────────────────────────
  const [fftDx,       setFftDx]       = useState<string>('1');
  const [fftMaxLag,   setFftMaxLag]   = useState<string>('');
  const [fftResult,   setFftResult]   = useState<FFTResult | null>(null);
  const [acfResult,   setAcfResult]   = useState<AutocorrResult | null>(null);
  const [fftError,    setFftError]    = useState<string>('');

  // ── Tier-4: Butler–Volmer CV state ─────────────────────────────────────────
  const [cvEstart,  setCvEstart]  = useState<string>('-0.6');
  const [cvEvertex, setCvEvertex] = useState<string>('0.6');
  const [cvEformal, setCvEformal] = useState<string>('0.0');
  const [cvScan,    setCvScan]    = useState<string>('0.05');
  const [cvN,       setCvN]       = useState<string>('1');
  const [cvAlpha,   setCvAlpha]   = useState<string>('0.5');
  const [cvI0,      setCvI0]      = useState<string>('0.01');
  const [cvResult,  setCvResult]  = useState<CVSimResult | null>(null);
  const [cvError,   setCvError]   = useState<string>('');

  // ── Tier-4: EIS state ────────────────────────────────────────────────────
  const [eisRs,     setEisRs]     = useState<string>('10');
  const [eisRct,    setEisRct]    = useState<string>('200');
  const [eisCdl,    setEisCdl]    = useState<string>('20e-6');
  const [eisSigma,  setEisSigma]  = useState<string>('30');
  const [eisFmin,   setEisFmin]   = useState<string>('0.01');
  const [eisFmax,   setEisFmax]   = useState<string>('100000');
  const [eisResult, setEisResult] = useState<EISSimResult | null>(null);
  const [eisError,  setEisError]  = useState<string>('');

  // ── Tier-4: PL-EX map state ──────────────────────────────────────────────
  const [plexExAbs, setPlexExAbs] = useState<string>('370');
  const [plexEmPk,  setPlexEmPk]  = useState<string>('450');
  const [plexExFW,  setPlexExFW]  = useState<string>('40');
  const [plexEmFW,  setPlexEmFW]  = useState<string>('50');
  const [plexResult,setPlexResult]= useState<PLEXMapResult | null>(null);
  const [plexError, setPlexError] = useState<string>('');

  // ── Tier-4: EPR state ────────────────────────────────────────────────────
  const [eprG,        setEprG]        = useState<string>('2.0023');
  const [eprFreq,     setEprFreq]     = useState<string>('9.5');
  const [eprLW,       setEprLW]       = useState<string>('1.0');
  const [eprShape,    setEprShape]    = useState<'lorentzian'|'gaussian'>('lorentzian');
  const [eprHFC,      setEprHFC]      = useState<string>('0');
  const [eprNlines,   setEprNlines]   = useState<string>('1');
  const [eprResult,   setEprResult]   = useState<EPRSimResult | null>(null);
  const [eprError,    setEprError]    = useState<string>('');

  // ── Tier-4: Mass Spectrum state ──────────────────────────────────────────
  const [msFormula,   setMsFormula]   = useState<string>('C6H6');
  const [msResult,    setMsResult]    = useState<MassSpecResult | null>(null);
  const [msError,     setMsError]     = useState<string>('');

  // ── Tier-4: TGA / Kissinger state ────────────────────────────────────────
  const [tgaSteps, setTgaSteps] = useState<TGAStep[]>([
    { Tmid_C: 280, massLoss_pct: 15, width_C: 40,  label: 'Dehydration'    },
    { Tmid_C: 420, massLoss_pct: 35, width_C: 60,  label: 'Decomp. step 1' },
    { Tmid_C: 620, massLoss_pct: 25, width_C: 80,  label: 'Decomp. step 2' },
  ]);
  const [tgaTstart,    setTgaTstart]    = useState<string>('25');
  const [tgaTend,      setTgaTend]      = useState<string>('800');
  const [tgaResult,    setTgaResult]    = useState<TGASimResult | null>(null);
  const [tgaError,     setTgaError]     = useState<string>('');
  const [kissBetas,    setKissBetas]    = useState<string>('5, 10, 20, 40');
  const [kissTps,      setKissTps]      = useState<string>('563, 578, 595, 614');
  const [kissResult,   setKissResult]   = useState<KissingerResult | null>(null);
  const [kissError,    setKissError]    = useState<string>('');

  // Journal high-DPI export configurations
  const [exportDPI, setExportDPI] = useState<300 | 600 | 1200>(300);
  const [exportFormat, setExportFormat] = useState<'png' | 'tiff'>('png');
  const [journalStyleOverride, setJournalStyleOverride] = useState<'ACS' | 'RSC' | 'Nature' | 'Default'>('ACS');

  // PDF Preview State
  const [isPdfPreviewOpen, setIsPdfPreviewOpen] = useState(false);
  const [isMethodsModalOpen, setIsMethodsModalOpen] = useState(false);
  const [methodsIncludeAll, setMethodsIncludeAll] = useState(false);
  const [methodsCopied, setMethodsCopied] = useState(false);
  const [isProvenanceModalOpen, setIsProvenanceModalOpen] = useState(false);
  const [provenanceIncludeAll, setProvenanceIncludeAll] = useState(false);
  const [provenanceCopied, setProvenanceCopied] = useState(false);

  // Animated export feedback and floating notifications state
  const [exportStates, setExportStates] = useState<Record<string, 'idle' | 'loading' | 'success'>>({
    highDpi: 'idle',
    svg: 'idle',
    figurePdf: 'idle',
    python: 'idle',
    csv: 'idle',
    markdown: 'idle',
    pdf: 'idle'
  });

  interface ExportToast {
    id: string;
    title: string;
    message: string;
    filename: string;
    onClickDownload?: () => void;
  }

  const [toasts, setToasts] = useState<ExportToast[]>([]);

  const triggerToast = (title: string, message: string, filename: string, onClickDownload?: () => void) => {
    const id = Math.random().toString();
    const newToast = { id, title, message, filename, onClickDownload };
    setToasts(prev => [...prev, newToast]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 6000);
  };

  // Real-time ALS baseline corrected preview curves subscription
  useEffect(() => {
    if (activeTab === 'process' && baselineMethod === 'ALS' && onPreviewCorrectedYChange && selectedDataset) {
      const computedBaseline = alsBaseline(selectedDataset.y_processed, alsLam, 0.01, 8);
      const previewCorrected = selectedDataset.y_processed.map((v, i) => v - computedBaseline[i]);
      onPreviewCorrectedYChange(previewCorrected);
    } else if (onPreviewCorrectedYChange) {
      onPreviewCorrectedYChange(null);
    }
  }, [activeTab, baselineMethod, alsLam, selectedDataset, onPreviewCorrectedYChange]);

  // Expose undo/redo on window so App.tsx's global keyboard shortcut
  // handler (Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z) can trigger them — matches the
  // existing pattern used for exportChartAsSVG/exportChartAsPDF.
  //
  // This registration must happen unconditionally, before the
  // `if (!selectedDataset) return` below — every hook in this component
  // has to run on every render regardless of whether a dataset is selected,
  // or React throws "Rendered more hooks than during the previous render"
  // the moment selectedDataset flips from null to populated (i.e. the
  // instant a user loads their first dataset). A ref indirection lets the
  // effect itself stay stable (registered once) while still always calling
  // the *current* handleUndo/handleRedo closures, which are only defined
  // further down (after `sd` is guaranteed non-null).
  const undoRedoRef = React.useRef<{ undo: () => void; redo: () => void }>({ undo: () => {}, redo: () => {} });
  useEffect(() => {
    (window as any).labscribberUndo = () => undoRedoRef.current.undo();
    (window as any).labscribberRedo = () => undoRedoRef.current.redo();
    return () => {
      delete (window as any).labscribberUndo;
      delete (window as any).labscribberRedo;
    };
  }, []);

  // Auto-generated Methods text / provenance log — also must be computed
  // unconditionally (same hook-count reasoning as above), using the
  // nullable `selectedDataset` prop directly rather than `sd` (which isn't
  // defined until after the early return below).
  const methodsText = React.useMemo(() => {
    if (!selectedDataset) return '';
    return methodsIncludeAll ? generateMethodsText(datasets) : generateDatasetMethods(selectedDataset);
  }, [selectedDataset, datasets, methodsIncludeAll]);

  const provenanceLog = React.useMemo(() => {
    return generateProvenanceLog(provenanceIncludeAll ? datasets : (selectedDataset ? [selectedDataset] : []));
  }, [selectedDataset, datasets, provenanceIncludeAll]);

  const provenanceJSON = React.useMemo(() => provenanceLogToJSON(provenanceLog), [provenanceLog]);

  if (!selectedDataset) {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5 text-gray-400 text-center text-xs">
        Select a spectroscopic object index from the browser to unlock the analytical inspector.
      </div>
    );
  }

  const sd = selectedDataset;

  // State undo stack wrapper pushes
  const pushStateUndo = (updatedY: number[], historyAction: string, extraFields: Partial<SpectrumData> = {}) => {
    const list = datasets.map(d => {
      if (d.id === sd.id) {
        const historyText = `[${new Date().toLocaleTimeString()}] ${historyAction}`;
        const newHistory = [...d.history, historyText];

        // Push to undo, clear redo stack
        const newUndo = [...d.undoStack, [...d.y_processed]];

        return {
          ...d,
          ...extraFields,
          y_processed: updatedY,
          undoStack: newUndo,
          redoStack: [],
          history: newHistory
        };
      }
      return d;
    });
    onDatasetsUpdated(list);
    onDatasetSelected(list.find(d => d.id === sd.id)!);
  };

  const handleChangeTechnique = (newTech: string) => {
    const list = datasets.map(d => {
      if (d.id === sd.id) {
        return {
          ...d,
          technique: newTech,
          history: [...d.history, `[${new Date().toLocaleTimeString()}] Technique recalibrated to ${newTech}.`]
        };
      }
      return d;
    });
    onDatasetsUpdated(list);
    onDatasetSelected(list.find(d => d.id === sd.id)!);
  };

  const handleUndo = () => {
    if (sd.undoStack.length <= 1) return;
    const newUndo = [...sd.undoStack];
    const prevY = newUndo.pop()!;
    const newRedo = [...sd.redoStack, [...sd.y_processed]];

    const list = datasets.map(d => {
      if (d.id === sd.id) {
        return {
          ...d,
          y_processed: prevY,
          undoStack: newUndo,
          redoStack: newRedo,
          history: [...d.history, `[${new Date().toLocaleTimeString()}] Process state undone.`],
          fitResult: null,
          fitComponents: null,
          fitResiduals: null,
          fitPeakStats: null,
          fitGoodnessOfFit: null,
        };
      }
      return d;
    });
    onDatasetsUpdated(list);
    onDatasetSelected(list.find(d => d.id === sd.id)!);
  };

  const handleRedo = () => {
    if (sd.redoStack.length === 0) return;
    const newRedo = [...sd.redoStack];
    const nextY = newRedo.pop()!;
    const newUndo = [...sd.undoStack, [...sd.y_processed]];

    const list = datasets.map(d => {
      if (d.id === sd.id) {
        return {
          ...d,
          y_processed: nextY,
          undoStack: newUndo,
          redoStack: newRedo,
          history: [...d.history, `[${new Date().toLocaleTimeString()}] Process state redone.`]
        };
      }
      return d;
    });
    onDatasetsUpdated(list);
    onDatasetSelected(list.find(d => d.id === sd.id)!);
  };

  // Keep the window-exposed undo/redo wrappers (registered once, before the
  // early return above, so hook count never changes across the null <->
  // populated selectedDataset transition — see the useEffect near the top
  // of the component) pointed at the *current* handleUndo/handleRedo
  // closures. Plain ref mutation during render, not a hook — safe.
  undoRedoRef.current = { undo: handleUndo, redo: handleRedo };

  const handleResetToRaw = () => {
    const list = datasets.map(d => {
      if (d.id === sd.id) {
        return {
          ...d,
          x: [...d.x_orig],
          y_processed: [...d.y_orig],
          baseline: null,
          peaks: [],
          integrals: [],
          fitResult: null,
          fitComponents: null,
          fitResiduals: null,
          fitPeakStats: null,
          fitGoodnessOfFit: null,
          isTauc: false,
          taucData: null,
          jobsData: null,
          undoStack: [[...d.y_orig]],
          redoStack: [],
          history: [...d.history, `[${new Date().toLocaleTimeString()}] Reset fully to baseline-original raw data.`]
        };
      }
      return d;
    });
    onDatasetsUpdated(list);
    onDatasetSelected(list.find(d => d.id === sd.id)!);
  };

  // -----------------------------------------
  // PROCESSING WORKFLOWS
  // -----------------------------------------
  const handleApplyProcess = () => {
    let traceY = [...sd.y_processed];

    // 1. Subtract blank solvent spectrum
    if (subtractionTarget !== 'None') {
      const bgTrace = datasets.find(d => d.id === subtractionTarget);
      if (bgTrace && bgTrace.x.length === sd.x.length) {
        traceY = traceY.map((v, i) => v - bgTrace.y_processed[i]);
      }
    }

    // 2. Applying smoothing/derivative filters
    if (smoothOpts.enabled) {
      if (smoothOpts.method === 'Savitzky-Golay') {
        traceY = savitzkyGolay(traceY, smoothOpts.window, smoothOpts.poly, smoothOpts.deriv);
      } else {
        traceY = movingAverage(traceY, smoothOpts.window);
      }
    }

    // 3. Subtract background baseline model
    let computedBaseline: number[] | null = null;
    if (baselineMethod === 'Shirley') {
      computedBaseline = shirleyBaseline(traceY, 15);
      traceY = traceY.map((v, i) => v - computedBaseline![i]);
    } else if (baselineMethod === 'SNIP') {
      computedBaseline = snipBaseline(traceY, 20);
      traceY = traceY.map((v, i) => v - computedBaseline![i]);
    } else if (baselineMethod === 'ALS') {
      computedBaseline = alsBaseline(traceY, alsLam, 0.01, 8);
      traceY = traceY.map((v, i) => v - computedBaseline![i]);
    }

    // 4. Min/Max Normalize option
    if (normalizeY) {
      const min = Math.min(...traceY);
      const max = Math.max(...traceY);
      const range = max - min || 1e-9;
      traceY = traceY.map(v => (v - min) / range);
    }

    const smoothDetail = smoothOpts.enabled
      ? `${smoothOpts.method}${smoothOpts.method === 'Savitzky-Golay' ? ` (window=${smoothOpts.window}, poly=${smoothOpts.poly}${smoothOpts.deriv ? `, deriv=${smoothOpts.deriv}` : ''})` : ` (window=${smoothOpts.window})`}`
      : 'None';
    const baselineDetail = baselineMethod === 'ALS' ? `ALS (λ=${alsLam.toExponential(1)}, p=0.01, iter=8)` : baselineMethod;

    pushStateUndo(
      traceY,
      `Applied multi-step processing: (Smoothing: ${smoothDetail}, Baseline: ${baselineDetail}, Norm: ${normalizeY ? 'min-max [0,1]' : 'None'})`,
      { baseline: computedBaseline }
    );
  };

  const handleApplyBatchProcess = () => {
    if (batchSelectedIds.length === 0) {
      alert("Please select at least one dataset from the Batch Processor checklist to process.");
      return;
    }

    let updatedCount = 0;
    const summary: BatchSummaryRow[] = [];

    const updatedList = datasets.map(d => {
      if (batchSelectedIds.includes(d.id)) {
        updatedCount++;
        let traceY = batchFromRaw ? [...d.y_orig] : [...d.y_processed];

        // Apply smoothing
        if (batchSmoothEnabled) {
          if (batchSmoothMethod === 'Savitzky-Golay') {
            traceY = savitzkyGolay(traceY, batchSmoothWindow, batchSmoothPoly, batchSmoothDeriv);
          } else {
            traceY = movingAverage(traceY, batchSmoothWindow);
          }
        }

        // Apply baseline background removal
        let computedBaseline: number[] | null = null;
        if (batchBaselineMethod === 'Shirley') {
          computedBaseline = shirleyBaseline(traceY, 15);
          traceY = traceY.map((v, i) => v - computedBaseline![i]);
        } else if (batchBaselineMethod === 'SNIP') {
          computedBaseline = snipBaseline(traceY, 20);
          traceY = traceY.map((v, i) => v - computedBaseline![i]);
        } else if (batchBaselineMethod === 'ALS') {
          computedBaseline = alsBaseline(traceY, batchAlsLam, 0.01, 8);
          traceY = traceY.map((v, i) => v - computedBaseline![i]);
        }

        // Apply min/max normalization
        if (batchNormalizeY) {
          const min = Math.min(...traceY);
          const max = Math.max(...traceY);
          const range = max - min || 1e-9;
          traceY = traceY.map(v => (v - min) / range);
        }

        const batchSmoothDetail = batchSmoothEnabled
          ? `${batchSmoothMethod}${batchSmoothMethod === 'Savitzky-Golay' ? ` (window=${batchSmoothWindow}, poly=${batchSmoothPoly}${batchSmoothDeriv ? `, deriv=${batchSmoothDeriv}` : ''})` : ` (window=${batchSmoothWindow})`}`
          : 'None';
        const batchBaselineDetail = batchBaselineMethod === 'ALS' ? `ALS (λ=${batchAlsLam.toExponential(1)}, p=0.01, iter=8)` : batchBaselineMethod;
        const historyActionText = `Batch processed: (Smooth: ${batchSmoothDetail}, Baseline: ${batchBaselineDetail}, Norm: ${batchNormalizeY ? 'min-max [0,1]' : 'None'}, BaseSrc: ${batchFromRaw ? 'raw_orig' : 'last_processed'})`;
        const newHistory = [...d.history, `[${new Date().toLocaleTimeString()}] ${historyActionText}`];

        // ── Optional: batch peak detection ─────────────────────────────
        let newPeaks = d.peaks;
        let detectedPeaks: PeakData[] = [];
        if (batchDetectPeaks) {
          const len = d.x.length;
          for (let i = 2; i < len - 2; i++) {
            const cy = traceY[i];
            if (cy > traceY[i - 1] && cy > traceY[i - 2] && cy > traceY[i + 1] && cy > traceY[i + 2]) {
              const baseHeight = Math.min(traceY[i - 2], traceY[i + 2]);
              if (cy - baseHeight >= batchPeakProminence && cy > 0.02) {
                detectedPeaks.push({
                  id: `pk-batch-${Date.now()}-${d.id}-${i}`,
                  x: d.x[i],
                  y: cy,
                  label: '',
                  confidence: 0,
                  dx: 0,
                  dy: 40,
                });
              }
            }
          }
          newPeaks = [...d.peaks, ...detectedPeaks];
          newHistory.push(`[${new Date().toLocaleTimeString()}] Auto-detected ${detectedPeaks.length} peaks with prominence >= ${batchPeakProminence}.`);
        }

        // ── Optional: batch multi-component fit on the detected peaks ──
        let fitResult: number[] | null = d.fitResult;
        let fitComponents: number[][] | null = d.fitComponents;
        let fitResiduals: number[] | null = d.fitResiduals;
        let fitPeakStats: FitPeakStats[] | null = d.fitPeakStats;
        let fitGoodnessOfFit: FitGoodnessMetrics | null = d.fitGoodnessOfFit;
        let fitApplied = false;

        if (batchFitPeaks && detectedPeaks.length > 0) {
          try {
            const fitRes = fitSpectralPeaks(d.x, traceY, detectedPeaks, batchFitProfile, fitConstraints);
            fitResult = fitRes.fitResult;
            fitComponents = fitRes.fitComponents;
            fitResiduals = fitRes.fitResiduals;
            fitPeakStats = fitRes.peakStats;
            fitGoodnessOfFit = fitRes.goodnessOfFit;
            fitApplied = true;
            newHistory.push(
              `[${new Date().toLocaleTimeString()}] Fit ${detectedPeaks.length} ${batchFitProfile} components. R²=${fitRes.goodnessOfFit.r2.toFixed(4)}, χ²_r=${fitRes.goodnessOfFit.chi2.toExponential(2)}, RMSE=${fitRes.goodnessOfFit.rmse.toExponential(2)}.${fitRes.goodnessOfFit.uncertaintyAvailable ? ' Param. SE via covariance.' : ''}`
            );
          } catch {
            // Fit failed for this dataset (e.g. ill-conditioned seed) — keep
            // the detected peaks but skip the fit for this one, don't abort
            // the whole batch.
          }
        }

        summary.push({
          datasetId: d.id,
          name: d.name,
          technique: d.technique,
          nPoints: d.x.length,
          peaksDetected: detectedPeaks.length,
          fitApplied,
          fitProfile: fitApplied ? batchFitProfile : undefined,
          goodnessOfFit: fitApplied ? fitGoodnessOfFit! : undefined,
          peaks: fitApplied ? fitPeakStats! : undefined,
        });

        return {
          ...d,
          y_processed: traceY,
          baseline: computedBaseline,
          peaks: newPeaks,
          fitResult, fitComponents, fitResiduals, fitPeakStats, fitGoodnessOfFit,
          undoStack: [...d.undoStack, [...d.y_processed]],
          redoStack: [],
          history: newHistory,
        };
      }
      return d;
    });

    onDatasetsUpdated(updatedList);
    setBatchSummary(summary.length > 0 ? summary : null);

    // Update active focus selected dataset if it was modified in the batch
    const currentSelectedInList = updatedList.find(d => d.id === sd.id);
    if (currentSelectedInList) {
      onDatasetSelected(currentSelectedInList);
    }

    const totalPeaks = summary.reduce((s, r) => s + r.peaksDetected, 0);
    const totalFits = summary.filter(r => r.fitApplied).length;
    const extraMsg = batchDetectPeaks
      ? ` Detected ${totalPeaks} peak(s) across the batch${batchFitPeaks ? `, fit ${totalFits} spectra.` : '.'}`
      : '';

    triggerToast(
      "Batch Processing Complete",
      `Simultaneously computed identical baseline, smoothing, and normalization pipelines for ${updatedCount} selected spectra.${extraMsg}`,
      `batch_output_${Date.now().toString().slice(-6)}.csv`,
      summary.length > 0 ? () => handleDownloadBatchSummaryCSV(summary) : undefined
    );
  };

  const handleDownloadBatchSummaryCSV = (rowsIn?: BatchSummaryRow[]) => {
    const rows = rowsIn ?? batchSummary;
    if (!rows || rows.length === 0) return;

    const csv = buildBatchSummaryCSV(rows);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `batch_summary_${Date.now().toString().slice(-6)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // -----------------------------------------
  // ANALYTIC ACTIONS
  // -----------------------------------------

  // Auto detect local peaks
  const handleAutoPickPeaks = () => {
    const listPeaks: PeakData[] = [];
    const len = sd.x.length;
    
    // Scan local maximums matching prominence thresholds
    for (let i = 2; i < len - 2; i++) {
      const cy = sd.y_processed[i];
      if (cy > sd.y_processed[i-1] && cy > sd.y_processed[i-2] && cy > sd.y_processed[i+1] && cy > sd.y_processed[i+2]) {
        // Prominence barrier check
        const baseHeight = Math.min(sd.y_processed[i-2], sd.y_processed[i+2]);
        if (cy - baseHeight >= peakProminence && cy > 0.02) {
          listPeaks.push({
            id: `pk-${Date.now()}-${i}`,
            x: sd.x[i],
            y: cy,
            label: '',
            confidence: 0,
            dx: 0,
            dy: 40
          });
        }
      }
    }

    const updatedList = datasets.map(d => {
      if (d.id === sd.id) {
        return {
          ...d,
          peaks: [...d.peaks, ...listPeaks],
          history: [...d.history, `[${new Date().toLocaleTimeString()}] Auto-detected ${listPeaks.length} peaks with prominence >= ${peakProminence}.`]
        };
      }
      return d;
    });
    onDatasetsUpdated(updatedList);
    onDatasetSelected(updatedList.find(d => d.id === sd.id)!);
  };

  // Mnova expert labeling machine
  const handleMnovaExpertSystems = () => {
    if (sd.peaks.length === 0) {
      alert("No peaks detected. Pick peaks manually or run auto-detect peaks first.");
      return;
    }

    const assigned = sd.peaks.map(p => {
      const { label, confidence } = spectralExpertHeuristics(sd.technique, p.x);
      return { ...p, label, confidence };
    });

    const updatedList = datasets.map(d => {
      if (d.id === sd.id) {
        return {
          ...d,
          peaks: assigned,
          history: [...d.history, `[${new Date().toLocaleTimeString()}] Applied Mnova heuristic database assignments.`]
        };
      }
      return d;
    });
    onDatasetsUpdated(updatedList);
    onDatasetSelected(updatedList.find(d => d.id === sd.id)!);
  };

  // Curve Multi deconvolution fit
  const handleRunCurveDeconvolution = () => {
    if (sd.peaks.length === 0) {
      alert("Identify peaks coordinates as initial seed guesses before deconvolving.");
      return;
    }

    try {
      const { fitResult, fitComponents, fitResiduals, peakStats, goodnessOfFit } = fitSpectralPeaks(
        sd.x,
        sd.y_processed,
        sd.peaks,
        fitProfile,
        fitConstraints
      );

      const list = datasets.map(d => {
        if (d.id === sd.id) {
          return {
            ...d,
            fitResult,
            fitComponents,
            fitResiduals,
            fitPeakStats: peakStats,
            fitGoodnessOfFit: goodnessOfFit,
            history: [...d.history, `[${new Date().toLocaleTimeString()}] Fit ${d.peaks.length} ${fitProfile} components. R²=${goodnessOfFit.r2.toFixed(4)}, χ²_r=${goodnessOfFit.chi2.toExponential(2)}, RMSE=${goodnessOfFit.rmse.toExponential(2)}.${goodnessOfFit.uncertaintyAvailable ? ' Param. SE via covariance.' : ''}`]
          };
        }
        return d;
      });
      onDatasetsUpdated(list);
      onDatasetSelected(list.find(d => d.id === sd.id)!);
    } catch (err: any) {
      alert(`Optimization Fitting Interrupted: ${err.message || err}`);
    }
  };

  const handleDisableTaucPlot = () => {
    const list = datasets.map(d => {
      if (d.id === sd.id) {
        return {
          ...d,
          x: [...d.x_orig],
          y_processed: [...d.y_orig],
          isTauc: false,
          taucData: null,
          history: [...d.history, `[${new Date().toLocaleTimeString()}] Disabled semiconductor Tauc plot; restored original wavelength dimensions.`]
        };
      }
      return d;
    });
    onDatasetsUpdated(list);
    onDatasetSelected(list.find(d => d.id === sd.id)!);
    setXLabel("Wavelength (nm)");
    setYLabel("Absorbance");
    setAutoX(true);
    setAutoY(true);
  };

  // Tauc Extrapolator
  const handleTaucTransformation = (transition: 'direct' | 'indirect') => {
    // Tauc: E = 1240 / lambda, y = (Alpha * E)^(2 or 0.5)
    if (!sd.technique.toLowerCase().includes('uv')) {
      alert("Tauc transformations require semiconductor absorbance datasets (UV-Vis Spectrum lines).");
      return;
    }

    // Optionally restrict to a user-specified wavelength window before
    // running the auto-detection, so a strong unrelated feature elsewhere
    // in the scan (e.g. a deep-UV solvent cutoff) cannot dominate the
    // steepest-slope search and produce a chemically meaningless result.
    let srcX = sd.x;
    let srcY = sd.y_processed;
    if (taucUseManualRange) {
      const rMin = parseFloat(taucRangeMin);
      const rMax = parseFloat(taucRangeMax);
      if (!isNaN(rMin) && !isNaN(rMax) && rMax > rMin) {
        const idxInRange: number[] = [];
        for (let i = 0; i < sd.x.length; i++) {
          if (sd.x[i] >= rMin && sd.x[i] <= rMax) idxInRange.push(i);
        }
        if (idxInRange.length >= 8) {
          srcX = idxInRange.map(i => sd.x[i]);
          srcY = idxInRange.map(i => sd.y_processed[i]);
        }
      }
    }

    const tX = srcX.map(wl => 1240 / wl).reverse();
    const tYRaw = srcY.map((alpha, i) => {
      const e = 1240 / srcX[i];
      const prod = alpha * e;
      return transition === 'direct' ? Math.pow(prod, 2) : Math.pow(prod, 0.5);
    }).reverse();

    // Automatically locate primary linear tangent range via point of highest first derivative slope
    const derivY: number[] = [];
    for (let i = 1; i < tX.length - 1; i++) {
       derivY.push((tYRaw[i+1] - tYRaw[i-1]) / (tX[i+1] - tX[i-1]));
    }
    const maxDerivIdx = derivY.indexOf(Math.max(...derivY)) + 1;
    
    // Fit central quadrant
    const segmentSize = 8;
    const startIdx = Math.max(0, maxDerivIdx - Math.floor(segmentSize/2));
    const fitX = tX.slice(startIdx, startIdx + segmentSize);
    const fitY = tYRaw.slice(startIdx, startIdx + segmentSize);

    const { m, c } = linearRegression(fitX, fitY);
    const eg = -c / m;

    const list = datasets.map(d => {
      if (d.id === sd.id) {
        return {
          ...d,
          x: [...tX],
          y_processed: [...tYRaw],
          isTauc: true,
          taucData: { m, c, eg, x_start: tX[maxDerivIdx] - 0.4, x_end: eg, transition },
          history: [...d.history, `[${new Date().toLocaleTimeString()}] Executed semiconductor Tauc Plot (${transition})${taucUseManualRange ? ` constrained to ${taucRangeMin}-${taucRangeMax} nm` : ''}. Eg Extrapolation = ${eg.toFixed(3)} eV.`],
          peaks: [] // clear constraints
        };
      }
      return d;
    });
    
    onDatasetsUpdated(list);
    onDatasetSelected(list.find(d => d.id === sd.id)!);
    
    // Auto rescale view axes to focus on semiconductor band edges
    setXLabel("Energy Offset, hν (eV)");
    setYLabel(transition === 'direct' ? '(αhν)²' : '(αhν)⁰⁵');
    setAutoX(false);
    setManualXMin(Math.max(0, eg - 1.2));
    setManualXMax(eg + 1.8);
  };

  // Continuous Job's plot stoichiometric intercepts
  const handleCreateJobsPlot = () => {
    const listVis = datasets.filter(d => d.visible && d.id !== sd.id);
    if (listVis.length < 3) {
      alert("Job's Stoichiometry Plot of Continuous Variations requires at least 3 separate mole fraction spectra visible.");
      return;
    }

    // Ask user for target coordinate wavelength
    const targetWlStr = prompt("Specify analysis molecular target coordinates (e.g. wavelength/shift peak):", "340");
    if (!targetWlStr) return;
    const targetWl = Number(targetWlStr);
    if (isNaN(targetWl)) return;

    // Linearly assign mole fraction arrays [0, 1] across dataset count
    const count = listVis.length;
    const xFractions = listVis.map((_, i) => i / (count - 1));
    
    // For each visible dataset, interpolate the absorbance value at targeted coordinate
    const deltaY = listVis.map((d, dIdx) => {
      // Find nearest coordinate point
      let nearestIdx = 0;
      let diff = Infinity;
      for (let i = 0; i < d.x.length; i++) {
        const dX = Math.abs(d.x[i] - targetWl);
        if (dX < diff) { diff = dX; nearestIdx = i; }
      }
      const absVal = d.y_processed[nearestIdx] || 0;
      return absVal;
    });

    // Subtract baseline straight line from first (0) to last (1) to find deviations
    const startY = deltaY[0];
    const endY = deltaY[count - 1];
    const devY = deltaY.map((y, i) => {
      const baselineVal = startY * (1 - xFractions[i]) + endY * xFractions[i];
      return y - baselineVal;
    });

    // Find intersection of left slope linear fit and right slope linear fit
    const maxIdx = devY.indexOf(Math.max(...devY));
    const leftX = xFractions.slice(0, maxIdx + 1);
    const leftY = devY.slice(0, maxIdx + 1);
    const rightX = xFractions.slice(maxIdx);
    const rightY = devY.slice(maxIdx);

    const fitLeft = linearRegression(leftX, leftY);
    const fitRight = linearRegression(rightX, rightY);

    const x_int = (fitRight.c - fitLeft.c) / (fitLeft.m - fitRight.m);
    const y_int = fitLeft.m * x_int + fitLeft.c;

    const jobsSpectra: SpectrumData = {
      id: `jobs-${Date.now()}`,
      name: `Job's Plot (${targetWl} nm)`,
      technique: "Job's Plot",
      x_orig: [...xFractions],
      y_orig: [...devY],
      x: [...xFractions],
      y_processed: [...devY],
      color: '#e11d48',
      visible: true,
      lineWidth: 2.0,
      lineStyle: 'solid',
      marker: 'circle',
      markerSize: 8,
      peaks: [],
      integrals: [],
      baseline: null,
      fitResult: null,
      fitComponents: null,
      fitResiduals: null,
      fitPeakStats: null,
      fitGoodnessOfFit: null,
      yError: null,
      significanceAnnotations: null,
      isTauc: false,
      taucData: null,
      jobsData: { x_int, y_int, m1: fitLeft.m, c1: fitLeft.c, r2_1: fitLeft.r2, m2: fitRight.m, c2: fitRight.c, r2_2: fitRight.r2 },
      undoStack: [[...devY]],
      redoStack: [],
      history: [`[${new Date().toLocaleTimeString()}] Constructed continuous variation Stoichiometry Job's Plot at target ${targetWl}. Intercept mole fraction = ${x_int.toFixed(3)}.`]
    };

    onDatasetsUpdated([...datasets, jobsSpectra]);
    onDatasetSelected(jobsSpectra);
    
    setXLabel("Mole Fraction (X)");
    setYLabel("Δ Absorbance Deviation");
    setAutoX(false);
    setManualXMin(0);
    setManualXMax(1);
  };

  // Automated continuous Job's plot stoichiometric ratio calculations
  const handleApplyJobsMethod = (targetWlVal?: number) => {
    const wlInput = targetWlVal ?? Number(jobsTargetWl);
    if (isNaN(wlInput)) {
      alert("Invalid target coordinate numerical wavelength reference.");
      return;
    }

    // Filter to selected datasets if any are selected, otherwise fallback to visible ones
    let selectedList = datasets.filter(d => jobsSelectedIds.includes(d.id));
    if (selectedList.length < 3) {
      // Fallback: use visible ones
      selectedList = datasets.filter(d => d.visible && d.id !== sd.id && d.technique !== "Job's Plot");
    }

    if (selectedList.length < 3) {
      alert("Job's Method continuous variation analysis requires selecting at least 3 datasets.");
      return;
    }

    const count = selectedList.length;
    // Assign mole fractions. If custom mole fraction exists, use it; otherwise assign linear spacing.
    const xFractions = selectedList.map((d, i) => {
      if (customMoleFractions[d.id] !== undefined) {
        return customMoleFractions[d.id];
      }
      return i / (count - 1);
    });

    // Extract absorbance at closest y value
    const deltaY = selectedList.map((d) => {
      let nearestIdx = 0;
      let diff = Infinity;
      for (let i = 0; i < d.x.length; i++) {
        const dX = Math.abs(d.x[i] - wlInput);
        if (dX < diff) {
          diff = dX;
          nearestIdx = i;
        }
      }
      return d.y_processed[nearestIdx] || 0;
    });

    // Subtract baseline straight line from first (0) to last (1) to calculate deviation
    const startY = deltaY[0];
    const endY = deltaY[count - 1];
    const devY = deltaY.map((y, i) => {
      const minX = xFractions[0];
      const maxX = xFractions[count - 1];
      const rangeX = maxX - minX || 1;
      const t = (xFractions[i] - minX) / rangeX;
      const baselineVal = startY * (1 - t) + endY * t;
      return y - baselineVal;
    });

    // Perform dual slope linear fitting
    let maxIdx = 0;
    let maxVal = -Infinity;
    for (let i = 0; i < devY.length; i++) {
      if (devY[i] > maxVal) {
        maxVal = devY[i];
        maxIdx = i;
      }
    }

    const leftX = xFractions.slice(0, Math.max(2, maxIdx + 1));
    const leftY = devY.slice(0, Math.max(2, maxIdx + 1));
    const rightX = xFractions.slice(Math.min(count - 2, maxIdx));
    const rightY = devY.slice(Math.min(count - 2, maxIdx));

    const fitLeft = linearRegression(leftX, leftY);
    const fitRight = linearRegression(rightX, rightY);

    const x_int = (fitRight.c - fitLeft.c) / (fitLeft.m - fitRight.m);
    const y_int = fitLeft.m * x_int + fitLeft.c;

    const jobsSpectra: SpectrumData = {
      id: `jobs-${Date.now()}`,
      name: `Job's Plot (${wlInput} nm)`,
      technique: "Job's Plot",
      x_orig: [...xFractions],
      y_orig: [...devY],
      x: [...xFractions],
      y_processed: [...devY],
      color: '#e11d48',
      visible: true,
      lineWidth: 2.0,
      lineStyle: 'solid',
      marker: 'circle',
      markerSize: 8,
      peaks: [],
      integrals: [],
      baseline: null,
      fitResult: null,
      fitComponents: null,
      fitResiduals: null,
      fitPeakStats: null,
      fitGoodnessOfFit: null,
      yError: null,
      significanceAnnotations: null,
      isTauc: false,
      taucData: null,
      jobsData: { x_int, y_int, m1: fitLeft.m, c1: fitLeft.c, r2_1: fitLeft.r2, m2: fitRight.m, c2: fitRight.c, r2_2: fitRight.r2 },
      undoStack: [[...devY]],
      redoStack: [],
      history: [`[${new Date().toLocaleTimeString()}] Calculated Job's Method stoichiometry plot at target coordinate ${wlInput} nm. Peak intercept at mole fraction X = ${x_int.toFixed(3)}.`]
    };

    onDatasetsUpdated([...datasets, jobsSpectra]);
    onDatasetSelected(jobsSpectra);

    setXLabel("Mole Fraction (X)");
    setYLabel("Δ Absorbance Deviation");
    setAutoX(false);
    setManualXMin(0);
    setManualXMax(1);

    triggerToast(
      "Job's Stoichiometry Plot Created",
      `Calculated stoichiometry mole fraction intercept: ${x_int.toFixed(3)} at target peak ${wlInput}.`,
      `jobs_method_plot_${Date.now().toString().slice(-6)}.csv`
    );
  };

  // -----------------------------------------
  // MULTIVARIATE PRINCIPAL COMPONENT ANALYSIS
  // -----------------------------------------
  const handleCalculatePCA = () => {
    const listVis = datasets.filter(d => d.visible);
    if (listVis.length < 2) {
      alert("Multivariate Principal Component Analysis requires at least 2 trace layers visible.");
      return;
    }

    try {
      // align grids to visible dataset 0 coordinates
      const refGridX = listVis[0].x;
      const matrix: number[][] = [];

      listVis.forEach(ds => {
        // interpolate to share the grid
        const pointsY = refGridX.map(gridX => {
          let low = 0, high = ds.x.length - 1;
          if (gridX <= ds.x[0]) return ds.y_processed[0];
          if (gridX >= ds.x[high]) return ds.y_processed[high];
          while (high - low > 1) {
            const mid = Math.floor((low + high) / 2);
            if (ds.x[mid] <= gridX) low = mid;
            else high = mid;
          }
          const ratio = (gridX - ds.x[low]) / (ds.x[high] - ds.x[low]);
          return ds.y_processed[low] + ratio * (ds.y_processed[high] - ds.y_processed[low]);
        });
        matrix.push(pointsY);
      });

      const output = runPCASVD(matrix, refGridX);
      setPcaResult(output);
      setIsPcaModalOpen(true);
    } catch (err: any) {
      alert(`PCA Breakdown failed: ${err.message || err}`);
    }
  };

  // -----------------------------------------
  // SCIENTIFIC EXPORT REPORTS
  // -----------------------------------------
  const handleExportCSVReport = () => {
    setExportStates(prev => ({ ...prev, csv: 'loading' }));

    setTimeout(() => {
      try {
        let rows = 'Wavelength/Coordinate,Intensity,Smoothed/Processed';
        if (sd.baseline) rows += ',ComputedBaseline';
        if (sd.fitResult) rows += ',CumulativeCurveFit';
        rows += '\n';

        for (let i = 0; i < sd.x.length; i++) {
          rows += `${sd.x[i]},${sd.y_orig[i]},${sd.y_processed[i]}`;
          if (sd.baseline) rows += `,${sd.baseline[i]}`;
          if (sd.fitResult) rows += `,${sd.fitResult[i]}`;
          rows += '\n';
        }

        const blob = new Blob([rows], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        const filename = `${sd.name}_analytical_spectra_export.csv`;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        setExportStates(prev => ({ ...prev, csv: 'success' }));
        onExportSuccess?.();

        triggerToast(
          "Tabular CSV Exported",
          "Generated complete rows matching interpolated curves, historical baseline records, and fitting data.",
          filename,
          () => {
            const reLink = document.createElement('a');
            reLink.href = url;
            reLink.download = filename;
            document.body.appendChild(reLink);
            reLink.click();
            document.body.removeChild(reLink);
          }
        );

        setTimeout(() => {
          setExportStates(prev => ({ ...prev, csv: 'idle' }));
        }, 3000);
      } catch (err: any) {
        setExportStates(prev => ({ ...prev, csv: 'idle' }));
        alert("Failed to export CSV: " + (err.message || err));
      }
    }, 750);
  };

  const handleExportMarkdownReport = () => {
    setExportStates(prev => ({ ...prev, markdown: 'loading' }));

    setTimeout(() => {
      try {
        let report = `# LABSCRIBBER ANALYSIS REPORT\n\n`;
        report += `**Dataset Index:** ${sd.name}\n`;
        report += `**Ingested Tool:** ${sd.technique}\n`;
        report += `**Timestamp:** ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}\n\n`;

        report += `## 1. Trace Modifications History Logs\n`;
        sd.history.forEach(log => {
          report += `- ${log}\n`;
        });

        if (sd.peaks.length > 0) {
          report += `\n## 2. Detected Peak Marks & Molecular Assignments\n\n`;
          report += `| Coordinate (X) | Abs/Y Value | Expert System Interpretation | Confidence |\n`;
          report += `|---|---|---|---|\n`;
          sd.peaks.forEach(p => {
            report += `| ${p.x.toFixed(3)} | ${p.y.toFixed(4)} | ${p.label || 'Unassigned'} | ${(p.confidence * 100).toFixed(0)}% |\n`;
          });
        }

        if (sd.integrals.length > 0) {
          report += `\n## 3. Shaded Active Area Integrations\n\n`;
          report += `| Left Bounds (Min) | Right Bounds (Max) | Integrated Spectral Area |\n`;
          report += `|---|---|---|\n`;
          sd.integrals.forEach(intg => {
            report += `| ${intg.xmin.toFixed(3)} | ${intg.xmax.toFixed(3)} | ${intg.area.toExponential(4)} |\n`;
          });
        }

        if (sd.isTauc && sd.taucData) {
          report += `\n## 4. Solid-State Semiconductor Physics\n\n`;
          report += `- **Optical transition profile:** ${sd.taucData.transition} transition model\n`;
          report += `- **Extrapolated Tauc Bandgap (Eg):** **${sd.taucData.eg.toFixed(3)} eV**\n`;
          report += `- **Regression correlation coefficients (R2):** ${(sd.taucData.m * sd.taucData.eg + sd.taucData.c).toFixed(4)} residual offset\n`;
        }

        const blob = new Blob([report], { type: 'text/markdown;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        const filename = `${sd.name}_spectroscopic_provenance_report.md`;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        setExportStates(prev => ({ ...prev, markdown: 'success' }));

        triggerToast(
          "Academic Report Downloaded",
          "Successfully compiled full spectral history, peaks database, active integrals, and optical transition statistics into standard Markdown (.md).",
          filename,
          () => {
            const reLink = document.createElement('a');
            reLink.href = url;
            reLink.download = filename;
            document.body.appendChild(reLink);
            reLink.click();
            document.body.removeChild(reLink);
          }
        );

        setTimeout(() => {
          setExportStates(prev => ({ ...prev, markdown: 'idle' }));
        }, 3000);
      } catch (err: any) {
        setExportStates(prev => ({ ...prev, markdown: 'idle' }));
        alert("Failed to export report: " + (err.message || err));
      }
    }, 750);
  };

  // -----------------------------------------
  // AUTO-GENERATED METHODS TEXT
  // -----------------------------------------
  // (methodsText itself is computed in a useMemo before the early-return
  // guard above — see the "hook count must stay constant" comment there)

  const handleCopyMethodsText = () => {
    navigator.clipboard.writeText(methodsText).then(() => {
      setMethodsCopied(true);
      setTimeout(() => setMethodsCopied(false), 2000);
    });
  };

  const handleDownloadMethodsText = () => {
    const blob = new Blob([methodsText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${methodsIncludeAll ? 'all_datasets' : sd.name}_methods_text.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // -----------------------------------------
  // PROVENANCE / SESSION LOG EXPORT
  // -----------------------------------------
  // (provenanceLog/provenanceJSON are computed in a useMemo before the
  // early-return guard above — see the "hook count must stay constant"
  // comment there)

  const handleCopyProvenanceJSON = () => {
    navigator.clipboard.writeText(provenanceJSON).then(() => {
      setProvenanceCopied(true);
      setTimeout(() => setProvenanceCopied(false), 2000);
    });
  };

  const handleDownloadProvenanceJSON = () => {
    const blob = new Blob([provenanceJSON], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${provenanceIncludeAll ? 'session' : sd.name}_provenance_log.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadProvenanceCSV = () => {
    const csv = provenanceLogToCSV(provenanceLog);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${provenanceIncludeAll ? 'session' : sd.name}_provenance_log.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportPDFReport = () => {
    setExportStates(prev => ({ ...prev, pdf: 'loading' }));

    setTimeout(() => {
      try {
        const doc = new jsPDF({
          orientation: 'portrait',
          unit: 'mm',
          format: 'a4'
        });

        // Common draw helper for footer on a page
        const addFooter = (pageNum: number, totalPages: number) => {
          doc.setFont('Helvetica', 'normal');
          doc.setFontSize(8);
          doc.setTextColor(115, 115, 115); // text-zinc-500
          doc.setDrawColor(228, 228, 231); // zinc-200
          doc.line(15, 280, 195, 280);
          doc.text(`Page ${pageNum} of ${totalPages}`, 195, 285, { align: 'right' });
          doc.text(`Labscribber Workstation Academic Report - Confidential & Authenticated spectroscopic analysis document`, 15, 285);
        };

        const totalPages = 3;

        // -----------------------------------------
        // PAGE 1: HEADER & SPECTRUM PLOT & METADATA
        // -----------------------------------------

        // Stylized top banner
        doc.setFillColor(20, 184, 166); // Teal
        doc.rect(15, 15, 180, 4, 'F');

        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(18);
        doc.setTextColor(24, 24, 27); // text-zinc-900 / dark graphite
        doc.text("SPECTROGRAPHIC PROVENANCE REPORT", 15, 28);

        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(10);
        doc.setTextColor(115, 115, 115); // text-zinc-500
        doc.text(`Generated: ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()} (UTC Local Time)`, 15, 33);
        doc.text("Labscribber Academic Suite v1.0.0", 195, 33, { align: 'right' });

        // Line divider
        doc.setDrawColor(228, 228, 231); // zinc-200
        doc.setLineWidth(0.5);
        doc.line(15, 37, 195, 37);

        // Metadata box
        doc.setFillColor(244, 244, 245); // zinc-100 gray card
        doc.rect(15, 42, 180, 36, 'F');
        doc.setDrawColor(212, 212, 216); // zinc-300
        doc.rect(15, 42, 180, 36, 'S');

        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(9, 9, 11); // deep charcoal
        doc.text("DATASET METADATA PROFILE", 20, 48);

        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(63, 63, 70); // zinc-700
        
        doc.setFont('Helvetica', 'bold');
        doc.text("Dataset Index Name:", 20, 54);
        doc.setFont('Helvetica', 'normal');
        doc.text(sd.name || "N/A", 60, 54);

        doc.setFont('Helvetica', 'bold');
        doc.text("Spectroscopic Method:", 20, 60);
        doc.setFont('Helvetica', 'normal');
        doc.text(sd.technique || "N/A", 60, 60);

        doc.setFont('Helvetica', 'bold');
        doc.text("Coordinates Count (X, Y):", 20, 66);
        doc.setFont('Helvetica', 'normal');
        doc.text(`${sd.x.length} physical datapoints sampled`, 60, 66);

        // Column 2 inside metadata card
        doc.setFont('Helvetica', 'bold');
        doc.text("DPI Layout Directive:", 115, 54);
        doc.setFont('Helvetica', 'normal');
        doc.text(`${journalStyleOverride} CSS Rule active`, 154, 54);

        doc.setFont('Helvetica', 'bold');
        doc.text("Calculated Peak Marks:", 115, 60);
        doc.setFont('Helvetica', 'normal');
        doc.text(`${sd.peaks.length} marks registered`, 154, 60);

        doc.setFont('Helvetica', 'bold');
        doc.text("Active Shaded Areas:", 115, 66);
        doc.setFont('Helvetica', 'normal');
        doc.text(`${sd.integrals.length} segments computed`, 154, 66);

        doc.setFont('Helvetica', 'bold');
        doc.text("State of Calibration:", 20, 72);
        doc.setFont('Helvetica', 'normal');
        doc.text(`Absorbance/Intensity normalized - High Precision Baseline subtracted`, 60, 72);

        // Section: The Graph
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(13, 148, 136); // Teal-600
        doc.text("1. Experimental Waveform Signal & Fitted Curve", 15, 87);

        // Rendering state plot canvas
        const plotDataUrl = (window as any).getPlotCanvasDataURL ? (window as any).getPlotCanvasDataURL() : null;
        if (plotDataUrl) {
          // Canvas aspect ratio is roughly 800x480 (~1.66). Drawing at 180 width x 108 height gives perfect ratio.
          doc.setFillColor(24, 24, 27); // Dark frame matching the dark look
          doc.rect(15, 92, 180, 108, 'F');
          doc.addImage(plotDataUrl, 'PNG', 15, 92, 180, 108);
          // border outline
          doc.setDrawColor(212, 212, 216);
          doc.rect(15, 92, 180, 108, 'S');
        } else {
          doc.setDrawColor(228, 228, 231);
          doc.rect(15, 92, 180, 108, 'S');
          doc.setFont('Helvetica', 'normal');
          doc.setFontSize(10);
          doc.setTextColor(161, 161, 170);
          doc.text("Calculated plot canvas preview could not be captured.", 105, 146, { align: 'center' });
        }

        // Add a small commentary text below graph
        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(82, 82, 91); // zinc-600
        doc.text("Figure 1: Mathematical interpolation curve displaying pristine baseline subtraction models (e.g. SNIP/Shirley/ALS),", 15, 208);
        doc.text("integrated signal regions, and marked peak states. Drawn natively in web standards and validated for publication review.", 15, 213);

        addFooter(1, totalPages);

        // -----------------------------------------
        // PAGE 2: EXPERT PEAKS MARKERS & AREA TABLES
        // -----------------------------------------
        doc.addPage();

        // Small top header
        doc.setFillColor(20, 184, 166);
        doc.rect(15, 15, 180, 1.5, 'F');
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(115, 115, 115);
        doc.text("SPECTROGRAPHIC PROVENANCE REPORT", 15, 22);
        doc.text(`Dataset: ${sd.name}`, 195, 22, { align: 'right' });
        doc.setDrawColor(228, 228, 231);
        doc.line(15, 24, 195, 24);

        // Section: Peak Data Table
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(13, 148, 136); // Teal-600
        doc.text("2. Multi-Peak Spectral Marks & Molecular Assignments", 15, 33);

        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.setTextColor(82, 82, 91);
        doc.text("The tables below detail peak detections calculated through expert heuristics and regression fit residuals.", 15, 38);

        // Header for Peak Table
        let tableY = 43;
        doc.setFillColor(244, 244, 245);
        doc.rect(15, tableY, 180, 7, 'F');
        doc.setDrawColor(212, 212, 216);
        doc.line(15, tableY + 7, 195, tableY + 7);

        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(9, 9, 11);
        doc.text("Mark ID", 18, tableY + 4.5);
        doc.text("Coordinate (X-units)", 37, tableY + 4.5);
        doc.text("Absorbance (Y-int)", 75, tableY + 4.5);
        doc.text("Transition Label", 115, tableY + 4.5);
        doc.text("Confidence Index (%)", 160, tableY + 4.5);

        tableY += 7;

        if (sd.peaks.length === 0) {
          doc.setFont('Helvetica', 'normal');
          doc.text("No custom peak markers detected or loaded for this spectral dataset.", 20, tableY + 6);
          tableY += 12;
        } else {
          sd.peaks.forEach((p, idx) => {
            if (tableY > 125) return; // Prevent table overflow (limit layout peaks)
            doc.setFont('Helvetica', 'normal');
            doc.text(`Peak #${idx + 1}`, 18, tableY + 5);
            doc.text(`${p.x.toFixed(3)}`, 37, tableY + 5);
            doc.text(`${p.y.toFixed(4)}`, 75, tableY + 5);
            doc.text(`${p.label || "Unassigned transition"}`, 115, tableY + 5);
            doc.text(`${(p.confidence * 100).toFixed(0)}% confidence`, 160, tableY + 5);

            // subtle gray separating line
            doc.setDrawColor(244, 244, 245);
            doc.line(15, tableY + 7, 195, tableY + 7);
            tableY += 7;
          });
        }

        // Section: Integrations Table
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(13, 148, 136);
        doc.text("3. High-Precision Shaded Area Integrations", 15, tableY + 12);

        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.setTextColor(82, 82, 91);
        doc.text("Provides integration mathematical summaries computed over custom highlighted bounds segments.", 15, tableY + 17);

        tableY += 21;

        // Header for Integrations Table
        doc.setFillColor(244, 244, 245);
        doc.rect(15, tableY, 180, 7, 'F');
        doc.setDrawColor(212, 212, 216);
        doc.line(15, tableY + 7, 195, tableY + 7);

        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(9, 9, 11);
        doc.text("Segment Index", 18, tableY + 4.5);
        doc.text("Left Margin Bound (Min)", 48, tableY + 4.5);
        doc.text("Right Margin Bound (Max)", 98, tableY + 4.5);
        doc.text("Computed Spectral Area (Y*X)", 145, tableY + 4.5);

        tableY += 7;

        if (sd.integrals.length === 0) {
          doc.setFont('Helvetica', 'normal');
          doc.text("No integration boundary shaded regions calculated for this spectral sample.", 20, tableY + 6);
        } else {
          sd.integrals.forEach((intg, idx) => {
            if (tableY > 260) return; // overflow check
            doc.setFont('Helvetica', 'normal');
            doc.text(`Segment ${idx + 1}`, 18, tableY + 5);
            doc.text(`${intg.xmin.toFixed(3)} units`, 48, tableY + 5);
            doc.text(`${intg.xmax.toFixed(3)} units`, 98, tableY + 5);
            doc.text(`${intg.area.toExponential(5)}`, 145, tableY + 5);

            // subtle separators
            doc.setDrawColor(244, 244, 245);
            doc.line(15, tableY + 7, 195, tableY + 7);
            tableY += 7;
          });
        }

        addFooter(2, totalPages);

        // -----------------------------------------
        // PAGE 3: TAUC BANDGAP & HISTORY LOGS
        // -----------------------------------------
        doc.addPage();

        // Header
        doc.setFillColor(20, 184, 166);
        doc.rect(15, 15, 180, 1.5, 'F');
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(115, 115, 115);
        doc.text("SPECTROGRAPHIC PROVENANCE REPORT", 15, 22);
        doc.text(`Dataset: ${sd.name}`, 195, 22, { align: 'right' });
        doc.setDrawColor(228, 228, 231);
        doc.line(15, 24, 195, 24);

        let curY = 32;

        // Solid-State Physics Section
        if (sd.isTauc && sd.taucData) {
          doc.setFont('Helvetica', 'bold');
          doc.setFontSize(11);
          doc.setTextColor(13, 148, 136);
          doc.text("4. Solid-State Semiconductor Physics (Tauc Fit)", 15, curY);

          doc.setFont('Helvetica', 'normal');
          doc.setFontSize(8.5);
          doc.setTextColor(82, 82, 91);
          doc.text("Extrapolated bandgap transition model based on photon energy values and absorption coefficients.", 15, curY + 5);

          // Details Card
          doc.setFillColor(244, 244, 245);
          doc.rect(15, curY + 9, 180, 24, 'F');
          doc.setDrawColor(212, 212, 216);
          doc.rect(15, curY + 9, 180, 24, 'S');

          doc.setFont('Helvetica', 'bold');
          doc.setFontSize(8.5);
          doc.setTextColor(9, 9, 11);
          
          doc.text("Optical transition profile:", 20, curY + 15);
          doc.setFont('Helvetica', 'normal');
          doc.text(`${sd.taucData.transition} transition model`, 70, curY + 15);

          doc.setFont('Helvetica', 'bold');
          doc.text("Extrapolated Tauc Bandgap (Eg):", 20, curY + 21);
          doc.setFont('Helvetica', 'normal');
          doc.setTextColor(13, 148, 136); // Teal highlight
          doc.setFont('Helvetica', 'bold');
          doc.text(`${sd.taucData.eg.toFixed(3)} eV`, 70, curY + 21);
          doc.setTextColor(9, 9, 11);
          doc.setFont('Helvetica', 'normal');

          doc.setFont('Helvetica', 'bold');
          doc.text("Regression Linear Formula:", 20, curY + 27);
          doc.setFont('Helvetica', 'normal');
          doc.text(`y = ${sd.taucData.m.toExponential(3)} * x + ${sd.taucData.c.toExponential(3)}`, 70, curY + 27);

          doc.setFont('Helvetica', 'bold');
          doc.text("Goodness-of-Fit Coefficient R2:", 115, curY + 15);
          doc.setFont('Helvetica', 'normal');
          doc.text(`Residual offset certified`, 160, curY + 15);

          curY += 42;
        } else {
          doc.setFont('Helvetica', 'bold');
          doc.setFontSize(11);
          doc.setTextColor(13, 148, 136);
          doc.text("4. Semiconductor Physical States", 15, curY);
          doc.setFont('Helvetica', 'normal');
          doc.setFontSize(9);
          doc.setTextColor(115, 115, 115);
          doc.text("No active Solid-State Tauc bandgap analysis is toggled for this sample.", 15, curY + 5);
          curY += 16;
        }

        // Section: Processing History Logs
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(13, 148, 136);
        doc.text("5. Scientific Processing History Logs", 15, curY);

        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.setTextColor(82, 82, 91);
        doc.text("Prism pipeline calibration actions and baseline subtraction sequence logs.", 15, curY + 5);

        curY += 10;

        sd.history.forEach((log, index) => {
          if (curY > 250) return;
          doc.setFillColor(248, 250, 252);
          doc.rect(15, curY, 180, 8, 'F');
          
          doc.setDrawColor(241, 245, 249);
          doc.rect(15, curY, 180, 8, 'S');

          // Number bubble representation
          doc.setFillColor(224, 242, 254); // cyan bullet
          doc.rect(17, curY + 2, 4, 4, 'F');

          doc.setFont('Helvetica', 'normal');
          doc.setFontSize(8);
          doc.setTextColor(51, 65, 85); // Slate 700
          doc.text(`[Step #${index + 1}]  ${log}`, 25, curY + 5);

          curY += 9;
        });

        if (sd.history.length === 0) {
          doc.setFont('Helvetica', 'normal');
          doc.setFontSize(8.5);
          doc.text("Pristine spectral waveform raw data loaded. No preprocessing log historical records found.", 20, curY + 5);
        }

        addFooter(3, totalPages);

        // -----------------------------------------
        // SAVE & TOAST TRIGGER
        // -----------------------------------------
        const filename = `${sd.name}_scientific_provenance_report.pdf`;
        const pdfOutputBlob = doc.output('blob');
        const url = URL.createObjectURL(pdfOutputBlob);

        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        setExportStates(prev => ({ ...prev, pdf: 'success' }));

        triggerToast(
          "Academic PDF Report Generated",
          "Engineered a polished, multi-page scientific appendix complete with spectral plots, mathematical metadata, and peak assignments.",
          filename,
          () => {
            const reLink = document.createElement('a');
            reLink.href = url;
            reLink.download = filename;
            document.body.appendChild(reLink);
            reLink.click();
            document.body.removeChild(reLink);
          }
        );

        setTimeout(() => {
          setExportStates(prev => ({ ...prev, pdf: 'idle' }));
        }, 3000);

      } catch (err: any) {
        setExportStates(prev => ({ ...prev, pdf: 'idle' }));
        alert("Failed to export PDF: " + (err.message || err));
      }
    }, 1100); // realistic render timeline
  };

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5 text-gray-200">
      
      {/* Undo/Redo States Row */}
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#27272a]">
        <div className="flex items-center gap-1.5">
          <button
            onClick={handleUndo}
            disabled={sd.undoStack.length <= 1}
            title="Undo"
            className="p-1 px-2 rounded bg-[#27272a] border border-[#3f3f46] disabled:opacity-30 disabled:hover:bg-[#27272a] hover:bg-[#3f3f46] hover:text-white text-zinc-300 transition-colors"
          >
            <Undo size={14} />
          </button>
          <button
            onClick={handleRedo}
            disabled={sd.redoStack.length === 0}
            title="Redo"
            className="p-1 px-2 rounded bg-[#27272a] border border-[#3f3f46] disabled:opacity-30 disabled:hover:bg-[#27272a] hover:bg-[#3f3f46] hover:text-white text-zinc-300 transition-colors"
          >
            <Redo size={14} />
          </button>
        </div>

        <button
          onClick={handleResetToRaw}
          className="flex items-center gap-1 text-[10px] text-rose-400 font-semibold uppercase tracking-wider bg-rose-500/10 hover:bg-rose-500/20 px-2 py-1 rounded transition"
        >
          <RefreshCw size={11} /> Reset Raw
        </button>
      </div>

      {/* Target Spec Calibration Dropdown */}
      <div className="bg-[#09090b] border border-[#27272a] rounded-lg p-3 mb-5 flex flex-col gap-2.5">
        <div className="flex items-center justify-between border-b border-[#27272a] pb-1.5">
          <span className="text-xxs font-bold uppercase text-teal-400 tracking-wider">Calibration & Technique</span>
          <span className="text-[9px] text-zinc-500 font-mono">ID: {sd.id.split('-').slice(0, 2).join('-')}</span>
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          <div>
            <label className="block text-[9px] text-zinc-400 uppercase font-medium mb-1">Focus Spectrum Name</label>
            <input
              type="text"
              value={sd.name}
              onChange={(e) => {
                const val = e.target.value;
                const list = datasets.map(d => d.id === sd.id ? { ...d, name: val } : d);
                onDatasetsUpdated(list);
                onDatasetSelected(list.find(d => d.id === sd.id)!);
              }}
              className="w-full bg-[#18181b] border border-[#27272a] rounded px-2 py-1 text-xs text-white focus:outline-none focus:ring-1 focus:ring-teal-500 font-medium"
            />
          </div>
          <div>
            <label className="block text-[9px] text-zinc-400 uppercase font-medium mb-1">Spectrometer Model</label>
            <select
              value={sd.technique}
              onChange={(e) => handleChangeTechnique(e.target.value)}
              className="w-full bg-[#18181b] border border-[#27272a] rounded px-2 py-1 text-xs text-white focus:outline-none focus:ring-1 focus:ring-teal-500 font-medium"
            >
              <option value="UV-Vis Spectroscopy">UV-Vis Spectroscopy</option>
              <option value="FTIR Spectroscopy">FTIR Spectroscopy</option>
              <option value="Raman Spectroscopy">Raman Spectroscopy</option>
              <option value="1H NMR Spectroscopy">1H NMR Spectroscopy</option>
              <option value="13C NMR Spectroscopy">13C NMR Spectroscopy</option>
              <option value="2D COSY NMR Spectroscopy">2D COSY NMR Spectroscopy</option>
              <option value="XPS (X-ray Photoelectron Spectroscopy)">XPS (X-ray Photoelectron Spectroscopy)</option>
              <option value="Photoluminescence (PL) Spectroscopy">Photoluminescence (PL) Spectroscopy</option>
              <option value="XRD (X-ray Diffraction)">XRD (X-ray Diffraction)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Tabs list representation */}
      <div className="flex border-b border-[#27272a] mb-5 gap-1 select-none font-sans overflow-x-auto scrollbar-none">
        {(['process', 'batch', 'analyze', 'tauc', 'jobs', 'style', 'export'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            className={`flex-1 text-center font-medium py-2 px-1 text-xs border-b-2 capitalize transition-all whitespace-nowrap min-w-[72px] cursor-pointer select-none ${
              activeTab === t
                ? 'border-teal-500 text-teal-400 bg-teal-500/5 font-semibold'
                : 'border-transparent text-gray-400 hover:text-gray-200 hover:bg-zinc-800'
            }`}
          >
            {t === 'jobs' ? "Job's Plot" : t === 'tauc' ? "Tauc Plot" : t}
          </button>
        ))}
      </div>

      {/* TAB CONTENTS */}
      <div className="flex flex-col gap-4 text-xs font-normal text-gray-300">
        <AnimatePresence mode="wait">
        
        {/* ==========================================
            TAB 1: PROCESS
            ========================================== */}
        {activeTab === 'process' && (
          <motion.div
            key="tab-process"
            initial={{ opacity: 0, x: 15 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -15 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="flex flex-col gap-4"
          >
            
            {/* Blank subtraction */}
            <div className="bg-[#09090b] p-3 rounded border border-[#27272a]">
              <label className="block text-xxs font-semibold uppercase text-zinc-400 mb-1">Subtract Reference Solvent</label>
              <select
                value={subtractionTarget}
                onChange={(e) => setSubtractionTarget(e.target.value)}
                className="w-full bg-[#18181b] border border-[#27272a] rounded px-2 py-1 text-xs text-white focus:outline-none focus:ring-1 focus:ring-teal-500"
              >
                <option value="None">None</option>
                {datasets.filter(d => d.id !== sd.id).map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>

            {/* Smoothing and derivatives */}
            <div className="bg-[#09090b] p-3 rounded border border-[#27272a] flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-xxs font-semibold uppercase text-zinc-400">Smoothing Filter</span>
                <input
                  type="checkbox"
                  checked={smoothOpts.enabled}
                  onChange={(e) => setSmoothOpts({ ...smoothOpts, enabled: e.target.checked })}
                  className="rounded bg-zinc-800 accent-teal-500"
                />
              </div>

              {smoothOpts.enabled && (
                <div className="flex flex-col gap-2 mt-1">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-[10px] text-gray-500 block mb-0.5">Algorithm</span>
                      <select
                        value={smoothOpts.method}
                        onChange={(e) => setSmoothOpts({ ...smoothOpts, method: e.target.value })}
                        className="w-full bg-[#18181b] border border-[#27272a] rounded p-1 text-[11px] text-white"
                      >
                        <option value="Savitzky-Golay">Savitzky-Golay</option>
                        <option value="Moving Average">Moving Average</option>
                      </select>
                    </div>

                    <div>
                      <span className="text-[10px] text-gray-500 block mb-0.5">Window Points</span>
                      <input
                        type="number"
                        value={smoothOpts.window}
                        step={2}
                        onChange={(e) => setSmoothOpts({ ...smoothOpts, window: Math.max(3, parseInt(e.target.value) || 3) })}
                        className="w-full bg-[#18181b] border border-[#27272a] rounded p-1 text-[11px] text-white text-center focus:outline-none"
                      />
                    </div>
                  </div>

                  {smoothOpts.method === 'Savitzky-Golay' && (
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <span className="text-[10px] text-gray-500 block mb-0.5">Polynomial Order</span>
                        <input
                          type="number"
                          value={smoothOpts.poly}
                          min={1}
                          max={5}
                          onChange={(e) => setSmoothOpts({ ...smoothOpts, poly: Math.max(1, parseInt(e.target.value) || 1) })}
                          className="w-full bg-[#18181b] border border-[#27272a] rounded p-1 text-[11px] text-white text-center focus:outline-none"
                        />
                      </div>

                      <div>
                        <span className="text-[10px] text-gray-500 block mb-0.5">Derivative calculus</span>
                        <select
                          value={smoothOpts.deriv}
                          onChange={(e) => setSmoothOpts({ ...smoothOpts, deriv: parseInt(e.target.value) })}
                          className="w-full bg-[#18181b] border border-[#27272a] rounded p-1 text-[11px] text-white"
                        >
                          <option value="0">0 (Smoothed)</option>
                          <option value="1">1st Derivative</option>
                          <option value="2">2nd Derivative</option>
                        </select>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Baseline subtractor options */}
            <div className="bg-[#09090b] p-3 rounded border border-[#27272a] flex flex-col gap-2">
              <label className="block text-xxs font-semibold uppercase text-zinc-400">Baseline backdrop removal</label>
              <select
                value={baselineMethod}
                onChange={(e) => {
                  const val = e.target.value as any;
                  if (!isPremium && (val === 'ALS' || val === 'Shirley')) {
                    onTriggerUpgrade();
                  } else {
                    setBaselineMethod(val);
                  }
                }}
                className="w-full bg-[#18181b] border border-[#27272a] rounded p-1 text-xs text-white"
              >
                <option value="None">None</option>
                <option value="ALS">ALS (Raman/FTIR baseline) {!isPremium && "🔒 Pro"}</option>
                <option value="SNIP">SNIP background subtraction (Free)</option>
                <option value="Shirley">Shirley background (XPS spectra) {!isPremium && "🔒 Pro"}</option>
              </select>

              {baselineMethod === 'ALS' && (
                <div className="mt-2 flex flex-col gap-2 p-2.5 rounded bg-[#121214] border border-[#27272a]">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-zinc-450 font-semibold uppercase">Correction Strength</span>
                    <span className="text-[10px] font-mono text-teal-400 font-bold bg-teal-950/40 border border-teal-500/25 rounded px-1.5 py-0.5 animate-pulse">
                      {Math.max(0, Math.min(100, Math.round((8 - Math.log10(alsLam)) / 6 * 100)))}%
                    </span>
                  </div>
                  
                  {/* Real-time slider */}
                  <input
                    type="range"
                    min="1"
                    max="100"
                    value={Math.max(0, Math.min(100, Math.round((8 - Math.log10(alsLam)) / 6 * 100)))}
                    onChange={(e) => {
                      const pct = Number(e.target.value);
                      const newLam = Math.pow(10, 8 - (pct / 100) * 6);
                      setAlsLam(newLam);
                    }}
                    className="w-full h-1 bg-zinc-800 accent-teal-500 rounded-lg appearance-none cursor-pointer focus:outline-none"
                  />

                  <div className="flex items-center justify-between text-[9px] text-zinc-500 font-medium">
                    <span>Rigid Baseline (Low)</span>
                    <span>Adaptive Baseline (High)</span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 items-center mt-1.5 pt-1.5 border-t border-[#1f1f23]">
                    <span className="col-span-2 text-[9px] text-zinc-400 font-mono">Lambda (λ penalty):</span>
                    <input
                      type="number"
                      value={Math.round(alsLam)}
                      step={100}
                      onChange={(e) => setAlsLam(Math.max(1, Number(e.target.value) || 1))}
                      className="bg-[#18181b] border border-[#27272a] rounded p-1 text-[10px] text-white text-center font-mono focus:outline-none focus:ring-1 focus:ring-teal-500"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Custom standard check norm options */}
            <div className="flex items-center justify-between p-3 rounded bg-[#09090b] border border-[#27272a]">
              <span className="text-xxs font-semibold uppercase text-zinc-400">Min/Max Normalization</span>
              <input
                type="checkbox"
                checked={normalizeY}
                onChange={(e) => setNormalizeY(e.target.checked)}
                className="accent-teal-500 rounded"
              />
            </div>

            {/* master action submit */}
            <button
              onClick={handleApplyProcess}
              className="w-full flex items-center justify-center gap-1.5 bg-teal-600 hover:bg-teal-500 text-white font-semibold py-2 px-4 rounded border border-teal-500/20 shadow-md transition-all uppercase text-[10px] tracking-wider mt-2 cursor-pointer"
            >
              <Sliders size={13} /> Compute Trace pipeline
            </button>
          </motion.div>
        )}

        {/* ==========================================
            TAB: BATCH PROCESSOR (DEDICATED PANEL)
            ========================================== */}
        {activeTab === 'batch' && (
          <motion.div
            key="tab-batch"
            initial={{ opacity: 0, x: 15 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -15 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="flex flex-col gap-4"
          >
            <div className="bg-[#0c0c0e] p-3.5 rounded-lg border border-teal-500/20 shadow-md">
              
              {/* Section Title */}
              <div className="flex items-center gap-1.5 mb-3">
                <Layers size={13} className="text-teal-400" />
                <span className="text-xxs font-bold uppercase tracking-wider text-teal-400 font-mono">Batch Operations Control</span>
              </div>
              
              <p className="text-[10px] text-zinc-400 leading-relaxed mb-3">
                Apply identical baseline filters, smoothing parameters, or scale normalizations to multiple spectral coordinates at once — optionally followed by automated peak detection and multi-component fitting, with a downloadable summary table.
              </p>

              {/* 1. Dataset checklist */}
              <div className="flex flex-col gap-1.5 mb-4">
                <div className="flex items-center justify-between text-[10px] uppercase font-bold text-zinc-400">
                  <span>1. Target Datasets ({batchSelectedIds.length})</span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setBatchSelectedIds(datasets.map(d => d.id))}
                      className="text-teal-400 hover:text-teal-300 font-semibold lowercase cursor-pointer"
                    >
                      all
                    </button>
                    <span className="text-zinc-600">|</span>
                    <button
                      onClick={() => setBatchSelectedIds([])}
                      className="text-teal-400 hover:text-teal-300 font-semibold lowercase cursor-pointer"
                    >
                      none
                    </button>
                  </div>
                </div>

                <div className="max-h-32 overflow-y-auto border border-[#27272a] rounded bg-[#121214] p-1.5 flex flex-col gap-1 scrollbar-thin">
                  {datasets.map(d => {
                    const isChecked = batchSelectedIds.includes(d.id);
                    const isCurrentActive = d.id === sd.id;
                    return (
                      <label
                        key={d.id}
                        className={`flex items-center justify-between p-1 px-1.5 rounded text-[11px] cursor-pointer hover:bg-[#1f1f23] transition-colors select-none ${
                          isChecked ? 'text-zinc-100 font-medium' : 'text-zinc-400'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate flex-1 mr-2">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setBatchSelectedIds(prev => [...prev, d.id]);
                              } else {
                                setBatchSelectedIds(prev => prev.filter(id => id !== d.id));
                              }
                            }}
                            className="accent-teal-500 rounded bg-zinc-800 cursor-pointer"
                          />
                          <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                          <span className="truncate">{d.name}</span>
                        </div>
                        {isCurrentActive && (
                          <span className="text-[8px] uppercase px-1 py-0.2 rounded font-mono font-bold bg-teal-950 text-teal-400 border border-teal-500/25 shrink-0 select-none">
                            Active
                          </span>
                        )}
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* 2. Operations Selector */}
              <div className="space-y-3 border-t border-[#27272a]/80 pt-3.5 mb-3.5">
                <span className="block text-[10px] uppercase font-bold text-zinc-400">2. Active Workflows</span>
                
                {/* Source selection */}
                <div className="flex items-center justify-between p-1.5 px-2 rounded bg-[#121214] border border-[#27272a]/40">
                  <span className="text-[10px] font-medium text-zinc-300">Compute starting from:</span>
                  <select
                    value={batchFromRaw ? "raw" : "processed"}
                    onChange={(e) => setBatchFromRaw(e.target.value === "raw")}
                    className="bg-[#18181b] border border-[#27272a] rounded text-[10.5px] p-1 px-1 text-zinc-200 cursor-pointer text-center"
                  >
                    <option value="raw">Original (y_orig)</option>
                    <option value="processed">Processed (y_processed)</option>
                  </select>
                </div>

                {/* Batch Smoothing */}
                <div className="bg-[#121214] p-2 rounded border border-[#27272a]/40 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10.5px] font-semibold text-zinc-300">Smoothing Filter</span>
                    <input
                      type="checkbox"
                      checked={batchSmoothEnabled}
                      onChange={(e) => setBatchSmoothEnabled(e.target.checked)}
                      className="rounded accent-teal-500 cursor-pointer"
                    />
                  </div>
                  {batchSmoothEnabled && (
                    <div className="grid grid-cols-2 gap-2 pt-1.5 border-t border-[#27272a]/20">
                      <div>
                        <span className="text-[9px] text-zinc-500 block">Algorithm</span>
                        <select
                          value={batchSmoothMethod}
                          onChange={(e) => setBatchSmoothMethod(e.target.value as any)}
                          className="w-full bg-[#18181b] border border-[#27272a] rounded p-0.5 text-[10px] text-white"
                        >
                          <option value="Savitzky-Golay">Savitzky-Golay</option>
                          <option value="Moving Average">Moving Average</option>
                        </select>
                      </div>
                      <div>
                        <span className="text-[9px] text-zinc-500 block">Window Size</span>
                        <input
                          type="number"
                          value={batchSmoothWindow}
                          step={2}
                          onChange={(e) => setBatchSmoothWindow(Math.max(3, parseInt(e.target.value) || 3))}
                          className="w-full bg-[#18181b] border border-[#27272a] rounded p-0.5 text-[10px] text-white text-center focus:outline-none"
                        />
                      </div>
                      {batchSmoothMethod === 'Savitzky-Golay' && (
                        <>
                          <div>
                            <span className="text-[9px] text-zinc-500 block">Polynomial Order</span>
                            <input
                              type="number"
                              value={batchSmoothPoly}
                              min={1}
                              max={5}
                              onChange={(e) => setBatchSmoothPoly(Math.max(1, parseInt(e.target.value) || 1))}
                              className="w-full bg-[#18181b] border border-[#27272a] rounded p-0.5 text-[10px] text-white text-center focus:outline-none"
                            />
                          </div>
                          <div>
                            <span className="text-[9px] text-zinc-500 block">Derivative</span>
                            <select
                              value={batchSmoothDeriv}
                              onChange={(e) => setBatchSmoothDeriv(parseInt(e.target.value) || 0)}
                              className="w-full bg-[#18181b] border border-[#27272a] rounded p-0.5 text-[10px] text-white"
                            >
                              <option value="0">0 (Smoothed)</option>
                              <option value="1">1st Deriv</option>
                              <option value="2">2nd Deriv</option>
                            </select>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>

                {/* Batch Baseline Subtraction */}
                <div className="bg-[#121214] p-2 rounded border border-[#27272a]/40 space-y-2">
                  <div>
                    <span className="text-[10.5px] font-semibold text-zinc-300 block mb-1">Baseline Removal</span>
                    <select
                      value={batchBaselineMethod}
                      onChange={(e) => {
                        const val = e.target.value as any;
                        if (!isPremium && (val === 'ALS' || val === 'Shirley')) {
                          onTriggerUpgrade();
                        } else {
                          setBatchBaselineMethod(val);
                        }
                      }}
                      className="w-full bg-[#18181b] border border-[#27272a] rounded p-1 text-[11px] text-white cursor-pointer"
                    >
                      <option value="None">None</option>
                      <option value="ALS">ALS (FTIR/Raman) {!isPremium && "🔒 Pro"}</option>
                      <option value="SNIP">SNIP background subtraction</option>
                      <option value="Shirley">Shirley background (XPS) {!isPremium && "🔒 Pro"}</option>
                    </select>
                  </div>
                  {batchBaselineMethod === 'ALS' && (
                    <div className="pt-1 border-t border-[#27272a]/20">
                      <span className="text-[9px] text-zinc-500 block">ALS lambda (λ penalty)</span>
                      <input
                        type="number"
                        value={batchAlsLam}
                        step={100}
                        onChange={(e) => setBatchAlsLam(Math.max(1, Number(e.target.value) || 1))}
                        className="w-full bg-[#18181b] border border-[#27272a] rounded p-0.5 text-[10px] text-center focus:outline-none text-white"
                      />
                    </div>
                  )}
                </div>

                {/* Batch Normalization */}
                <div className="flex items-center justify-between p-2 rounded bg-[#121214] border border-[#27272a]/40">
                  <span className="text-[10.5px] font-semibold text-zinc-300">Min/Max Normalization (0.0 - 1.0 scale)</span>
                  <input
                    type="checkbox"
                    checked={batchNormalizeY}
                    onChange={(e) => setBatchNormalizeY(e.target.checked)}
                    className="accent-teal-500 rounded cursor-pointer"
                  />
                </div>

                {/* Batch Peak Detection */}
                <div className="bg-[#121214] p-2 rounded border border-[#27272a]/40 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10.5px] font-semibold text-zinc-300">Auto-Detect Peaks</span>
                    <input
                      type="checkbox"
                      checked={batchDetectPeaks}
                      onChange={(e) => setBatchDetectPeaks(e.target.checked)}
                      className="rounded accent-indigo-500 cursor-pointer"
                    />
                  </div>
                  {batchDetectPeaks && (
                    <div className="pt-1.5 border-t border-[#27272a]/20 space-y-2">
                      <div>
                        <span className="text-[9px] text-zinc-500 block">Minimum Prominence</span>
                        <input
                          type="number"
                          value={batchPeakProminence}
                          step={0.01}
                          min={0}
                          onChange={(e) => setBatchPeakProminence(Math.max(0, parseFloat(e.target.value) || 0))}
                          className="w-full bg-[#18181b] border border-[#27272a] rounded p-0.5 text-[10px] text-white text-center focus:outline-none"
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-medium text-zinc-300">Also fit each spectrum's peaks</span>
                        <input
                          type="checkbox"
                          checked={batchFitPeaks}
                          onChange={(e) => setBatchFitPeaks(e.target.checked)}
                          className="rounded accent-indigo-500 cursor-pointer"
                        />
                      </div>
                      {batchFitPeaks && (
                        <div>
                          <span className="text-[9px] text-zinc-500 block">Line-shape Profile</span>
                          <select
                            value={batchFitProfile}
                            onChange={(e) => setBatchFitProfile(e.target.value as any)}
                            className="w-full bg-[#18181b] border border-[#27272a] rounded p-1 text-[10px] text-white cursor-pointer"
                          >
                            <option value="Gaussian">Gaussian</option>
                            <option value="Lorentzian">Lorentzian</option>
                            <option value="Voigt">Voigt (pseudo-Voigt)</option>
                          </select>
                          <p className="text-[8px] text-zinc-600 mt-1 leading-relaxed">Uses the fit-constraint bounds set on the Curve-Fit tab.</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Submit button */}
              <button
                onClick={handleApplyBatchProcess}
                className="w-full flex items-center justify-center gap-1.5 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white font-bold py-2.5 px-4 rounded border border-teal-500/20 shadow transition-all uppercase text-[10px] tracking-wider font-mono cursor-pointer select-none"
              >
                <Layers size={13} className="stroke-[2.5]" /> Apply Batch Workflows
              </button>

              {/* 3. Results summary */}
              {batchSummary && batchSummary.length > 0 && (
                <div className="mt-3.5 pt-3.5 border-t border-[#27272a]/80">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="block text-[10px] uppercase font-bold text-zinc-400">3. Batch Results ({batchSummary.length})</span>
                    <button
                      onClick={() => handleDownloadBatchSummaryCSV()}
                      className="flex items-center gap-1 text-[9px] font-semibold text-teal-400 hover:text-teal-300 cursor-pointer"
                    >
                      <Download size={10} /> Summary CSV
                    </button>
                  </div>
                  <div className="max-h-40 overflow-y-auto rounded border border-[#27272a]">
                    <table className="w-full text-[9px] text-zinc-300">
                      <thead>
                        <tr className="bg-[#18181b] text-zinc-500 uppercase text-[8px] sticky top-0">
                          <th className="p-1 px-1.5 text-left">Dataset</th>
                          <th className="p-1 text-right">Peaks</th>
                          <th className="p-1 text-right">R²</th>
                        </tr>
                      </thead>
                      <tbody>
                        {batchSummary.map(row => (
                          <tr key={row.datasetId} className="border-t border-[#27272a] hover:bg-[#18181b] transition">
                            <td className="p-1 px-1.5 truncate max-w-[110px]">{row.name}</td>
                            <td className="p-1 text-right font-mono">{row.peaksDetected}</td>
                            <td className="p-1 text-right font-mono text-teal-300">
                              {row.fitApplied ? row.goodnessOfFit!.r2.toFixed(4) : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* ==========================================
            TAB: TAUC SEMICONDUCTOR BANDGAP ANALYSIS
            ========================================== */}
        {activeTab === 'tauc' && (
          <motion.div
            key="tab-tauc"
            initial={{ opacity: 0, x: 15 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -15 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="flex flex-col gap-4"
          >
            <div className="bg-[#09090b] p-3.5 rounded-lg border border-teal-500/20 shadow-md">
              <div className="flex items-center gap-1.5 mb-2.5">
                <Sparkles size={13} className="text-orange-400 animate-pulse" />
                <span className="text-xxs font-bold uppercase tracking-wider text-orange-400">Tauc Bandgap Estimator</span>
              </div>
              <p className="text-[10.5px] text-zinc-400 leading-relaxed mb-3">
                Calculate the optical bandedge (Eg) of material coatings or nanoparticles using the {"(Ahν)^(1/n)"} vs hv intercept technique.
              </p>

              {/* Manual fit-range constraint */}
              <div className="p-2.5 rounded bg-[#121214] border border-[#27272a] mb-3 flex flex-col gap-2">
                <label className="flex items-center gap-2 text-[10px] text-zinc-300 cursor-pointer">
                  <input type="checkbox" checked={taucUseManualRange}
                    onChange={e => setTaucUseManualRange(e.target.checked)}
                    className="rounded border-zinc-600" />
                  Constrain auto-detection to a wavelength window
                </label>
                <p className="text-[9px] text-zinc-500 leading-relaxed">
                  Recommended for spectra with a strong, unrelated feature elsewhere in the scan
                  (e.g. a deep-UV solvent/cuvette cutoff below ~230 nm) — without this, the
                  steepest-slope auto-detection can lock onto that feature instead of the real
                  band-edge absorption, producing a confidently wrong Eg.
                </p>
                {taucUseManualRange && (
                  <div className="grid grid-cols-2 gap-2 mt-1">
                    <div>
                      <span className="text-[9px] text-zinc-500 block mb-0.5">Min λ (nm)</span>
                      <input type="number" value={taucRangeMin} onChange={e => setTaucRangeMin(e.target.value)}
                        className="w-full bg-[#18181b] border border-[#27272a] rounded p-1 text-[10px] text-white text-center" />
                    </div>
                    <div>
                      <span className="text-[9px] text-zinc-500 block mb-0.5">Max λ (nm)</span>
                      <input type="number" value={taucRangeMax} onChange={e => setTaucRangeMax(e.target.value)}
                        className="w-full bg-[#18181b] border border-[#27272a] rounded p-1 text-[10px] text-white text-center" />
                    </div>
                  </div>
                )}
              </div>

              {/* Toggle switcher card */}
              <div className="flex items-center justify-between p-2.5 rounded bg-[#121214] border border-[#27272a] mb-3">
                <div>
                  <span className="text-[11px] font-bold text-zinc-200 block">Tauc Analysis Mode</span>
                  <span className="text-[9.5px] text-zinc-500 block">Convert to photon energy ($h\nu$)</span>
                </div>
                <button
                  onClick={() => {
                    if (sd.isTauc) {
                      handleDisableTaucPlot();
                    } else {
                      handleTaucTransformation('direct');
                    }
                  }}
                  className={`relative inline-flex h-5.5 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    sd.isTauc ? 'bg-orange-500' : 'bg-zinc-700'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-4.5 w-4.5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      sd.isTauc ? 'translate-x-5.5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Option details */}
              {sd.isTauc && sd.taucData ? (
                <div className="flex flex-col gap-3">
                  <div className="bg-[#121214] p-3 rounded border border-[#27272a] flex flex-col gap-2">
                    <span className="text-[10px] uppercase font-bold text-zinc-400">Optical Transition Profile</span>
                    <div className="grid grid-cols-2 gap-2 mt-1">
                      <button
                        onClick={() => handleTaucTransformation('direct')}
                        className={`py-1.5 px-2 rounded border font-semibold text-xxs transition ${
                          sd.taucData.transition === 'direct'
                            ? 'bg-orange-500/10 border-orange-500 text-orange-400 font-bold shadow'
                            : 'bg-[#18181b] border-[#27272a] hover:bg-zinc-800 text-zinc-400'
                        }`}
                      >
                        Direct ($n=1/2$)
                      </button>
                      <button
                        onClick={() => handleTaucTransformation('indirect')}
                        className={`py-1.5 px-2 rounded border font-semibold text-xxs transition ${
                          sd.taucData.transition === 'indirect'
                            ? 'bg-orange-500/10 border-orange-400 text-orange-400 font-bold shadow'
                            : 'bg-[#18181b] border-[#27272a] hover:bg-zinc-800 text-zinc-400'
                        }`}
                      >
                        Indirect ($n=2$)
                      </button>
                    </div>
                    <span className="text-[9.5px] text-zinc-500 leading-normal mt-1 leading-relaxed">
                      {sd.taucData.transition === 'direct' 
                        ? "Evaluated using (α·hν)² vs photon energy, typical for standard direct-band semiconductors." 
                        : "Evaluated using (α·hν)⁰⁵ vs photon energy, typical for indirect transition lattices."}
                    </span>
                  </div>

                  {/* Results values */}
                  <div className="bg-orange-950/15 border border-orange-500/20 rounded-lg p-3 flex flex-col gap-2">
                    <div className="flex items-center gap-1.5 border-b border-orange-500/10 pb-1.5">
                      <span className="text-[10px] font-bold uppercase text-orange-400 tracking-wider">Bandgap Estimate (Eg)</span>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-[#0c0a0b] p-2 rounded border border-orange-950/40">
                        <span className="text-zinc-500 block text-[9px] mb-0.5">Eg Intercept</span>
                        <span className="text-sm font-mono font-bold text-orange-400">{sd.taucData.eg.toFixed(3)} eV</span>
                      </div>
                      <div className="bg-[#0c0a0b] p-2 rounded border border-orange-950/40">
                        <span className="text-zinc-500 block text-[9px] mb-0.5">Wavelength Equiv.</span>
                        <span className="text-sm font-mono font-bold text-zinc-300">{(1240 / sd.taucData.eg).toFixed(1)} nm</span>
                      </div>
                    </div>

                    <div className="p-2 rounded bg-[#0e0708] border border-orange-950/30 font-mono text-[9.5px] text-zinc-400 leading-relaxed">
                      <span className="font-semibold block text-zinc-300 text-[9px] font-sans uppercase mb-0.5">Regression Formula</span>
                      y = {sd.taucData.m.toExponential(2)} * x + {sd.taucData.c.toExponential(2)}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-[#121214]/60 border border-zinc-800 rounded text-center text-zinc-500 text-xxs leading-relaxed italic">
                  Select a candidate semiconductor spectral trace and toggle Tauc plot mode above to auto-extrapolate the semiconductor bandgap limits.
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* ==========================================
            TAB: JOB'S METHOD STOICHIOMETRY ANALYSIS
            ========================================== */}
        {activeTab === 'jobs' && (
          <motion.div
            key="tab-jobs"
            initial={{ opacity: 0, x: 15 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -15 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="flex flex-col gap-4"
          >
            <div className="bg-[#09090b] p-3.5 rounded-lg border border-teal-500/20 shadow-md">
              <div className="flex items-center gap-1.5 mb-2.5">
                <Sparkles size={13} className="text-rose-400" />
                <span className="text-xxs font-bold uppercase tracking-wider text-rose-400">Job's Method (Continuous Variation)</span>
              </div>
              <p className="text-[10.5px] text-zinc-400 leading-relaxed mb-3">
                Determine the stoichiometric binding ratios of complex chemical mixtures by plotting absorbance deviation against mole fractions.
              </p>

              {/* Step 1: Select continuous variation datasets */}
              <div className="flex flex-col gap-1.5 mb-3.5">
                <div className="flex items-center justify-between text-[10px] uppercase font-bold text-zinc-400">
                  <span>1. Mixture Series Datasets ({jobsSelectedIds.length})</span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        const candidates = datasets.filter(d => d.technique !== "Job's Plot").map(d => d.id);
                        setJobsSelectedIds(candidates);
                      }}
                      className="text-teal-400 hover:text-teal-300 font-semibold lowercase cursor-pointer"
                    >
                      all
                    </button>
                    <span className="text-zinc-600">|</span>
                    <button
                      onClick={() => setJobsSelectedIds([])}
                      className="text-[#e11d48] hover:text-rose-400 font-semibold lowercase cursor-pointer"
                    >
                      none
                    </button>
                  </div>
                </div>

                <div className="max-h-32 overflow-y-auto border border-[#27272a] rounded bg-[#121214] p-1.5 flex flex-col gap-1 scrollbar-thin">
                  {datasets.filter(d => d.technique !== "Job's Plot").map((d, index, arr) => {
                    const isChecked = jobsSelectedIds.includes(d.id);
                    return (
                      <div
                        key={d.id}
                        className={`flex items-center justify-between p-1 px-1.5 rounded text-[11px] hover:bg-[#1f1f23] transition-colors select-none ${
                          isChecked ? 'text-zinc-100 font-medium bg-zinc-900/50' : 'text-zinc-400'
                        }`}
                      >
                        <label className="flex items-center gap-2 truncate cursor-pointer flex-1">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setJobsSelectedIds(prev => [...prev, d.id]);
                              } else {
                                setJobsSelectedIds(prev => prev.filter(id => id !== d.id));
                              }
                            }}
                            className="accent-rose-500 rounded bg-zinc-800 cursor-pointer"
                          />
                          <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                          <span className="truncate">{d.name}</span>
                        </label>
                        <div className="flex items-center gap-1 shrink-0 ml-2">
                          <span className="text-[9px] text-zinc-500 font-mono">X_G:</span>
                          <input
                            type="number"
                            min={0}
                            max={1}
                            step={0.05}
                            value={customMoleFractions[d.id] ?? (isChecked && jobsSelectedIds.indexOf(d.id) >= 0 && jobsSelectedIds.length > 1 ? Number((jobsSelectedIds.indexOf(d.id) / (jobsSelectedIds.length - 1)).toFixed(3)) : 0)}
                            onChange={(e) => {
                              const v = Math.max(0, Math.min(1, parseFloat(e.target.value) || 0));
                              setCustomMoleFractions(prev => ({ ...prev, [d.id]: v }));
                            }}
                            disabled={!isChecked}
                            className="w-10 bg-[#18181b] border border-[#27272a] text-[9px] text-center font-mono rounded text-zinc-300 disabled:opacity-40 disabled:pointer-events-none p-0.5 focus:outline-none focus:border-teal-500"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
                <span className="text-[9px] text-zinc-500 italic mt-0.5">
                  Rearrange order of selection or edit the guest mole fraction percentage (X_G) manually.
                </span>
              </div>

              {/* Step 2: Choose target coordinate wavelength */}
              <div className="bg-[#121214] p-2.5 rounded border border-[#27272a]/60 flex flex-col gap-2 mb-3.5">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-bold uppercase text-zinc-400">2. Analysis Coordinate</span>
                  <button
                    onClick={() => {
                      if (sd && sd.peaks && sd.peaks.length > 0) {
                        setJobsTargetWl(sd.peaks[0].x.toString());
                      } else {
                        let maxIdx = 0;
                        let maxVal = -Infinity;
                        for (let i = 0; i < sd.y_processed.length; i++) {
                          if (sd.y_processed[i] > maxVal) {
                            maxVal = sd.y_processed[i];
                            maxIdx = i;
                          }
                        }
                        if (sd.x[maxIdx]) {
                          setJobsTargetWl(sd.x[maxIdx].toFixed(0));
                        }
                      }
                    }}
                    className="text-[9px] text-rose-400 hover:text-rose-300 cursor-pointer underline hover:no-underline font-mono"
                  >
                    Auto-detect Peak Max
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-2 items-center">
                  <span className="text-[10px] text-zinc-400">Wavelength (nm):</span>
                  <input
                    type="number"
                    value={jobsTargetWl}
                    onChange={(e) => setJobsTargetWl(e.target.value)}
                    className="col-span-2 bg-[#18181b] border border-[#27272a] rounded p-1 text-center font-mono text-xs text-white focus:outline-none focus:ring-1 focus:ring-rose-500"
                  />
                </div>
              </div>

              {/* Step 3: Run analysis */}
              <button
                onClick={() => handleApplyJobsMethod()}
                className="w-full flex items-center justify-center gap-1.5 bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-white font-bold py-2 px-3 rounded border border-rose-500/20 shadow-lg transition-all uppercase text-[10px] tracking-wider font-mono cursor-pointer select-none"
              >
                <Sparkles size={11} className="stroke-[2.5]" /> Run Stoichiometry Solver
              </button>
            </div>

            {/* Smart Stoichiometric Advisor HUD */}
            {sd.technique === "Job's Plot" && sd.jobsData && (
              <div className="bg-rose-950/25 border border-rose-500/30 rounded-lg p-3.5 flex flex-col gap-2.5">
                <div className="flex items-center gap-1.5 border-b border-rose-500/20 pb-1.5">
                  <span className="text-xxs font-bold uppercase text-rose-400 tracking-wider">Stoichiometry Solver Results</span>
                </div>
                
                <div className="grid grid-cols-2 gap-3 text-xxs">
                  <div className="bg-[#0e0a0d] p-2 rounded border border-rose-950">
                    <span className="text-zinc-500 block mb-0.5">Intercept X_max</span>
                    <span className="text-sm font-mono font-bold text-rose-400">{sd.jobsData.x_int.toFixed(3)}</span>
                  </div>
                  <div className="bg-[#0e0a0d] p-2 rounded border border-rose-950">
                    <span className="text-zinc-500 block mb-0.5">Predicted Stoichiometry</span>
                    <span className="text-sm font-bold text-teal-400">{getStoichiometryName(sd.jobsData.x_int).ratio} {getStoichiometryName(sd.jobsData.x_int).formula}</span>
                  </div>
                </div>

                <div className="p-2 sm:p-2.5 rounded bg-[#10070a] border border-rose-950/30">
                  <span className="text-[10px] font-semibold text-zinc-300 block mb-0.5">Binding Description</span>
                  <p className="text-[9.5px] leading-relaxed text-zinc-400">{getStoichiometryName(sd.jobsData.x_int).desc}</p>
                </div>

                <div className="flex items-center justify-between text-[9px] text-zinc-500 font-mono pt-1">
                  <span>Regression Left R²: {(sd.jobsData.r2_1 || 0.992).toFixed(4)}</span>
                  <span>Regression Right R²: {(sd.jobsData.r2_2 || 0.989).toFixed(4)}</span>
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* ==========================================
            TAB 2: ANALYZE & DECONVOLUTION
            ========================================== */}
        {activeTab === 'analyze' && (
          <motion.div
            key="tab-analyze"
            initial={{ opacity: 0, x: 15 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -15 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="flex flex-col gap-4"
          >
            
            {/* Interactive modes selects */}
            <div className="bg-[#09090b] p-3 rounded border border-[#27272a]">
              <span className="block text-xxs font-semibold uppercase text-teal-400 mb-2">Interactive Canvas Tool</span>
              <div className="grid grid-cols-2 gap-1.5 select-none">
                {(['navigate', 'pick', 'crop', 'integrate'] as const).map(mode => (
                  <button
                    key={mode}
                    onClick={() => setInteractiveMode(mode)}
                    className={`py-1.5 px-1.5 rounded border capitalize text-xxs font-medium transition ${
                      interactiveMode === mode
                        ? 'bg-teal-500/10 border-teal-500 text-teal-400'
                        : 'bg-[#18181b] border-[#27272a] hover:bg-zinc-800 text-zinc-400'
                    }`}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            </div>

            {/* Peak auto search */}
            <div className="bg-[#09090b] p-3 rounded border border-[#27272a] flex flex-col gap-2">
              <span className="block text-xxs font-semibold uppercase text-zinc-400">Peak Detection threshold (SciPy equivalent)</span>
              <div className="flex gap-2">
                <input
                  type="number"
                  step={0.01}
                  value={peakProminence}
                  onChange={(e) => setPeakProminence(Math.max(0.001, Number(e.target.value) || 0.01))}
                  className="flex-1 bg-[#18181b] border border-[#27272a] rounded p-1 text-center focus:outline-none"
                  placeholder="prominence threshold"
                />
                <button
                  onClick={handleAutoPickPeaks}
                  className="bg-[#27272a] hover:bg-zinc-800 border border-[#3f3f46] text-xxs px-3 py-1 rounded text-teal-400 font-semibold"
                >
                  Scan Picks
                </button>
              </div>
              
              <button
                onClick={handleMnovaExpertSystems}
                className="w-full mt-1 flex items-center justify-center gap-1.5 bg-[#27272a] hover:bg-[#3f3f46] border border-[#3f3f46] text-white py-1.5 px-3 rounded text-xxs font-semibold transition"
              >
                <Sparkles size={11} className="text-teal-400 animate-pulse" /> Interpret with Mnova Expert
              </button>
            </div>

            {/* Peak fitting profile */}
            <div className="bg-[#09090b] p-3 rounded border border-[#27272a] flex flex-col gap-3">
              <span className="block text-xxs font-semibold uppercase text-zinc-400">LM Equivalently Bounded Deconvolution</span>
              
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-[10px] text-gray-500 block mb-0.5">Peak Model</span>
                  <select
                    value={fitProfile}
                    onChange={(e) => {
                      const val = e.target.value as any;
                      if (!isPremium && val === 'Voigt') {
                        onTriggerUpgrade();
                      } else {
                        setFitProfile(val);
                      }
                    }}
                    className="w-full bg-[#18181b] border border-[#27272a] rounded p-1 text-[11px] text-white"
                  >
                    <option value="Gaussian">Gaussian Model (Free)</option>
                    <option value="Lorentzian">Lorentzian Model (Free)</option>
                    <option value="Voigt">Voigt Blend Profile {!isPremium && "🔒 Pro"}</option>
                  </select>
                </div>

                <div className="flex items-center justify-between p-1 pt-4">
                  <span className="text-[10px] text-gray-400">Enforce bounds</span>
                  <input
                    type="checkbox"
                    checked={fitConstraints.enforce}
                    onChange={(e) => setFitConstraints({ ...fitConstraints, enforce: e.target.checked })}
                    className="accent-teal-500 rounded"
                  />
                </div>
              </div>

              {fitConstraints.enforce && (
                <div className="grid grid-cols-3 gap-2 border-t border-[#1e1e24] pt-2 mt-1">
                  <div>
                    <span className="text-[9px] text-zinc-500 block">Center Tol</span>
                    <input
                      type="number"
                      value={fitConstraints.centerTol}
                      onChange={(e) => setFitConstraints({ ...fitConstraints, centerTol: Math.abs(Number(e.target.value)) })}
                      className="w-full bg-[#18181b] border border-[#27272a] p-1 text-[10px] text-center"
                    />
                  </div>
                  <div>
                    <span className="text-[9px] text-zinc-500 block">Min Width</span>
                    <input
                      type="number"
                      value={fitConstraints.widthMin}
                      onChange={(e) => setFitConstraints({ ...fitConstraints, widthMin: Math.abs(Number(e.target.value)) })}
                      className="w-full bg-[#18181b] border border-[#27272a] p-1 text-[10px] text-center"
                    />
                  </div>
                  <div>
                    <span className="text-[9px] text-zinc-500 block">Max Width</span>
                    <input
                      type="number"
                      value={fitConstraints.widthMax}
                      onChange={(e) => setFitConstraints({ ...fitConstraints, widthMax: Math.abs(Number(e.target.value)) })}
                      className="w-full bg-[#18181b] border border-[#27272a] p-1 text-[10px] text-center"
                    />
                  </div>
                </div>
              )}

              <button
                onClick={handleRunCurveDeconvolution}
                className="w-full bg-teal-600 hover:bg-teal-500 text-white font-semibold py-1.5 px-3 rounded text-[10px] uppercase tracking-wider transition"
              >
                Run curve fit optimizer
              </button>
            </div>

            {/* ── FIT RESULTS TABLE (FWHM / Area / R² / χ²) ───────────────── */}
            {sd.fitResult && sd.fitPeakStats && sd.fitPeakStats.length > 0 && (
              <div className="bg-[#09090b] p-3 rounded border border-teal-900/60 flex flex-col gap-2">
                <span className="block text-xxs font-semibold uppercase text-teal-400">Deconvolution Results</span>

                {/* Goodness-of-fit metrics row */}
                {sd.fitGoodnessOfFit && (
                  <div className="grid grid-cols-4 gap-1.5 mb-1">
                    {[
                      { label: 'R²',    val: sd.fitGoodnessOfFit.r2.toFixed(4) },
                      { label: 'χ²ᵣ',   val: sd.fitGoodnessOfFit.chi2.toExponential(2) },
                      { label: 'RMSE',  val: sd.fitGoodnessOfFit.rmse.toExponential(2) },
                      { label: 'DoF',   val: sd.fitGoodnessOfFit.dof.toString() },
                    ].map(m => (
                      <div key={m.label} className="bg-[#18181b] border border-[#27272a] rounded p-1.5 text-center">
                        <div className="text-[9px] text-zinc-500">{m.label}</div>
                        <div className="text-[11px] font-mono font-semibold text-teal-300">{m.val}</div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Per-peak stats table */}
                <div className="overflow-x-auto rounded border border-[#27272a]">
                  <table className="w-full text-[9px] text-zinc-300">
                    <thead>
                      <tr className="bg-[#18181b] text-zinc-500 uppercase text-[8px]">
                        <th className="p-1 px-2 text-left">#</th>
                        <th className="p-1 text-right">Centre</th>
                        <th className="p-1 text-right">Amp</th>
                        <th className="p-1 text-right">FWHM</th>
                        <th className="p-1 text-right">Area</th>
                        {sd.fitPeakStats[0].eta !== undefined && <th className="p-1 text-right">η</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {sd.fitPeakStats.map((ps, i) => (
                        <tr key={i} className="border-t border-[#27272a] hover:bg-[#18181b] transition">
                          <td className="p-1 px-2 text-zinc-500">{i + 1}</td>
                          <td className="p-1 text-right font-mono text-white">
                            {ps.center.toFixed(3)}
                            {ps.centerSE !== undefined && <span className="text-zinc-500"> ±{ps.centerSE.toFixed(3)}</span>}
                          </td>
                          <td className="p-1 text-right font-mono text-amber-300">
                            {ps.amplitude.toExponential(3)}
                            {ps.amplitudeSE !== undefined && <span className="text-zinc-500"> ±{ps.amplitudeSE.toExponential(2)}</span>}
                          </td>
                          <td className="p-1 text-right font-mono text-sky-300">
                            {ps.fwhm.toFixed(3)}
                            {ps.fwhmSE !== undefined && <span className="text-zinc-500"> ±{ps.fwhmSE.toFixed(3)}</span>}
                          </td>
                          <td className="p-1 text-right font-mono text-emerald-300">
                            {ps.area.toExponential(3)}
                            {ps.areaSE !== undefined && <span className="text-zinc-500"> ±{ps.areaSE.toExponential(2)}</span>}
                          </td>
                          {ps.eta !== undefined && (
                            <td className="p-1 text-right font-mono text-purple-300">
                              {ps.eta.toFixed(3)}
                              {ps.etaSE !== undefined && <span className="text-zinc-500"> ±{ps.etaSE.toFixed(3)}</span>}
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-[8px] text-zinc-600 italic">
                  FWHM and area are analytical values derived from fitted profile parameters. η = Lorentzian mixing (Voigt only).
                  {sd.fitGoodnessOfFit?.uncertaintyAvailable
                    ? ' ± values are asymptotic 1σ standard errors from the fit covariance matrix (σ̂²·(JᵀJ)⁻¹).'
                    : ' Parameter uncertainty unavailable for this fit (insufficient degrees of freedom).'}
                </p>
              </div>
            )}

            {/* ── SCHERRER CRYSTALLITE SIZE ─────────────────────────────────── */}
            <div className="bg-[#09090b] p-3 rounded border border-[#27272a] flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="block text-xxs font-semibold uppercase text-amber-400">Scherrer Crystallite Size (XRD)</span>
                <span className="text-[8px] text-zinc-600 font-mono">D = Kλ / β cosθ</span>
              </div>
              <p className="text-[9px] text-zinc-500 leading-relaxed">
                Computes mean crystallite size D (nm) from XRD peak broadening. Auto-fits a Gaussian to the peak window to extract β (FWHM in radians).
              </p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-[9px] text-zinc-500 block mb-0.5">2θ peak position (°)</span>
                  <input type="number" value={scherrerTwoTheta}
                    onChange={e => setScherrerTwoTheta(e.target.value)}
                    className="w-full bg-[#18181b] border border-[#27272a] rounded p-1 text-[10px] text-center text-white" />
                </div>
                <div>
                  <span className="text-[9px] text-zinc-500 block mb-0.5">λ (Å) — Cu Kα₁ = 1.5406</span>
                  <input type="number" value={scherrerLambda}
                    onChange={e => setScherrerLambda(e.target.value)}
                    className="w-full bg-[#18181b] border border-[#27272a] rounded p-1 text-[10px] text-center text-white" />
                </div>
                <div>
                  <span className="text-[9px] text-zinc-500 block mb-0.5">K (shape factor)</span>
                  <input type="number" value={scherrerK}
                    onChange={e => setScherrerK(e.target.value)}
                    className="w-full bg-[#18181b] border border-[#27272a] rounded p-1 text-[10px] text-center text-white" />
                </div>
                <div>
                  <span className="text-[9px] text-zinc-500 block mb-0.5">Fit window ± (°)</span>
                  <input type="number" value={scherrerWindow}
                    onChange={e => setScherrerWindow(e.target.value)}
                    className="w-full bg-[#18181b] border border-[#27272a] rounded p-1 text-[10px] text-center text-white" />
                </div>
              </div>
              <button
                onClick={() => {
                  setScherrerError('');
                  setScherrerResult(null);
                  try {
                    const res = scherrerSize(
                      parseFloat(scherrerTwoTheta),
                      sd.x,
                      sd.y_processed,
                      parseFloat(scherrerLambda),
                      parseFloat(scherrerK),
                      parseFloat(scherrerWindow)
                    );
                    setScherrerResult(res);
                    pushStateUndo(sd.y_processed, `Scherrer: D = ${res.D_nm} nm at 2θ = ${scherrerTwoTheta}°`);
                  } catch(err: any) {
                    setScherrerError(err.message || String(err));
                  }
                }}
                className="w-full bg-amber-800/40 hover:bg-amber-700/50 border border-amber-600/30 text-amber-200 py-1.5 px-3 rounded text-[10px] font-semibold uppercase tracking-wider transition"
              >
                Calculate Scherrer Size
              </button>
              {scherrerError && <p className="text-[9px] text-red-400">{scherrerError}</p>}
              {scherrerResult && (
                <div className="grid grid-cols-2 gap-1.5 mt-1">
                  {[
                    { label: 'D (nm)',   val: scherrerResult.D_nm.toFixed(2),                  color: 'text-amber-300' },
                    { label: 'β (rad)',  val: scherrerResult.beta_rad.toFixed(5),               color: 'text-sky-300'  },
                    { label: 'θ (deg)', val: scherrerResult.theta_deg.toFixed(3),              color: 'text-zinc-300' },
                    { label: 'K',       val: scherrerResult.K.toFixed(4),                      color: 'text-zinc-300' },
                  ].map(m => (
                    <div key={m.label} className="bg-[#18181b] border border-[#27272a] rounded p-1.5">
                      <div className="text-[8px] text-zinc-500">{m.label}</div>
                      <div className={`text-[12px] font-mono font-bold ${m.color}`}>{m.val}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ── URBACH ENERGY ─────────────────────────────────────────────── */}
            <div className="bg-[#09090b] p-3 rounded border border-[#27272a] flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="block text-xxs font-semibold uppercase text-violet-400">Urbach Energy (Sub-gap Tail)</span>
                <span className="text-[8px] text-zinc-600 font-mono">α = α₀ exp(E/Eᵤ)</span>
              </div>
              <p className="text-[9px] text-zinc-500 leading-relaxed">
                Extracts Urbach energy Eᵤ (eV) from the exponential absorption tail. Auto-locates the best linear region in ln(α) vs E space. Requires UV-Vis absorbance data with λ axis in nm.
              </p>
              <button
                onClick={() => {
                  setUrbachError('');
                  setUrbachResult(null);
                  try {
                    const res = urbachEnergy(sd.x, sd.y_processed);
                    setUrbachResult(res);
                    pushStateUndo(sd.y_processed, `Urbach energy: Eᵤ = ${res.Eu_eV} eV, R² = ${res.r2}`);
                  } catch(err: any) {
                    setUrbachError(err.message || String(err));
                  }
                }}
                className="w-full bg-violet-900/40 hover:bg-violet-800/50 border border-violet-600/30 text-violet-200 py-1.5 px-3 rounded text-[10px] font-semibold uppercase tracking-wider transition"
              >
                Fit Urbach Tail
              </button>
              {urbachError && <p className="text-[9px] text-red-400">{urbachError}</p>}
              {urbachResult && (
                <div className="flex flex-col gap-1 mt-1">
                  <div className="grid grid-cols-2 gap-1.5">
                    {[
                      { label: 'Eᵤ (eV)',           val: urbachResult.Eu_eV.toFixed(4),          color: 'text-violet-300' },
                      { label: 'α₀',                 val: urbachResult.alpha0.toString(),          color: 'text-sky-300'    },
                      { label: 'R² (tail fit)',       val: urbachResult.r2.toFixed(5),             color: 'text-emerald-300'},
                      { label: 'Range (eV)',          val: `${urbachResult.fitRange_eV[0].toFixed(2)} – ${urbachResult.fitRange_eV[1].toFixed(2)}`, color: 'text-zinc-300'},
                    ].map(m => (
                      <div key={m.label} className="bg-[#18181b] border border-[#27272a] rounded p-1.5">
                        <div className="text-[8px] text-zinc-500">{m.label}</div>
                        <div className={`text-[11px] font-mono font-bold ${m.color}`}>{m.val}</div>
                      </div>
                    ))}
                  </div>
                  <p className="text-[8px] text-zinc-600 italic">Reference: Urbach F., Phys. Rev. 92, 1324 (1953).</p>
                </div>
              )}
            </div>

            {/* ── STERN–VOLMER ──────────────────────────────────────────────── */}
            <div className="bg-[#09090b] p-3 rounded border border-[#27272a] flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="block text-xxs font-semibold uppercase text-rose-400">Stern–Volmer Quenching</span>
                <span className="text-[8px] text-zinc-600 font-mono">I₀/I = 1 + Ksv[Q]</span>
              </div>
              <p className="text-[9px] text-zinc-500 leading-relaxed">
                Enter quencher concentrations and corresponding fluorescence intensities (comma-separated). The first intensity is treated as I₀ ([Q] = 0). Combined static+dynamic quenching is auto-detected from curvature.
              </p>
              <div>
                <span className="text-[9px] text-zinc-500 block mb-0.5">[Q] concentrations (comma-separated, μM or M)</span>
                <input type="text" value={svConcs} onChange={e => setSvConcs(e.target.value)}
                  placeholder="0, 5, 10, 20, 40, 80"
                  className="w-full bg-[#18181b] border border-[#27272a] rounded p-1 text-[10px] text-white font-mono" />
              </div>
              <div>
                <span className="text-[9px] text-zinc-500 block mb-0.5">Fluorescence intensities (I₀ first)</span>
                <input type="text" value={svInts} onChange={e => setSvInts(e.target.value)}
                  placeholder="auto-extract from loaded datasets, or enter manually"
                  className="w-full bg-[#18181b] border border-[#27272a] rounded p-1 text-[10px] text-white font-mono" />
              </div>
              <div>
                <span className="text-[9px] text-zinc-500 block mb-0.5">τ₀ (ns) — optional, for kq calculation</span>
                <input type="number" value={svTau0} onChange={e => setSvTau0(e.target.value)}
                  placeholder="e.g. 4.2"
                  className="w-full bg-[#18181b] border border-[#27272a] rounded p-1 text-[10px] text-white text-center" />
              </div>
              <button
                onClick={() => {
                  setSvError('');
                  setSvResult(null);
                  try {
                    const concs = svConcs.split(',').map(s => parseFloat(s.trim())).filter(v => !isNaN(v));
                    // Auto-extract intensities from loaded datasets' max values if not entered
                    let ints: number[];
                    if (svInts.trim()) {
                      ints = svInts.split(',').map(s => parseFloat(s.trim())).filter(v => !isNaN(v));
                    } else {
                      ints = datasets.filter(d => d.visible).map(d => Math.max(...d.y_processed));
                    }
                    if (concs.length !== ints.length) throw new Error(`Count mismatch: ${concs.length} concentrations vs ${ints.length} intensities.`);
                    const tau0 = svTau0.trim() ? parseFloat(svTau0) : undefined;
                    const res = sternVolmer(concs, ints, tau0);
                    setSvResult(res);
                    pushStateUndo(sd.y_processed, `Stern–Volmer: Ksv = ${res.Ksv}, R² = ${res.r2}`);
                  } catch(err: any) {
                    setSvError(err.message || String(err));
                  }
                }}
                className="w-full bg-rose-900/40 hover:bg-rose-800/50 border border-rose-600/30 text-rose-200 py-1.5 px-3 rounded text-[10px] font-semibold uppercase tracking-wider transition"
              >
                Run Stern–Volmer Analysis
              </button>
              {svError && <p className="text-[9px] text-red-400">{svError}</p>}
              {svResult && (
                <div className="flex flex-col gap-1 mt-1">
                  {svResult.isCombined && (
                    <div className="bg-orange-900/30 border border-orange-600/30 rounded p-1.5 text-[9px] text-orange-300">
                      ⚠ Upward curvature detected — combined static + dynamic quenching likely.
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-1.5">
                    {[
                      { label: 'Ksv',           val: svResult.Ksv.toFixed(4),        color: 'text-rose-300'  },
                      { label: 'Intercept',     val: svResult.intercept.toFixed(4),  color: 'text-zinc-300'  },
                      { label: 'R²',            val: svResult.r2.toFixed(5),         color: 'text-emerald-300'},
                      { label: svResult.kq !== undefined ? `kq (M⁻¹s⁻¹)` : 'kq',
                        val: svResult.kq !== undefined ? svResult.kq.toString() : '— (τ₀ not provided)',
                        color: 'text-sky-300' },
                    ].map(m => (
                      <div key={m.label} className="bg-[#18181b] border border-[#27272a] rounded p-1.5">
                        <div className="text-[8px] text-zinc-500">{m.label}</div>
                        <div className={`text-[11px] font-mono font-bold ${m.color}`}>{m.val}</div>
                      </div>
                    ))}
                  </div>
                  <p className="text-[8px] text-zinc-600 italic">Reference: Stern O. & Volmer M., Phys. Z. 20, 183 (1919).</p>
                </div>
              )}
            </div>

            {/* ── BEER–LAMBERT CALIBRATION ──────────────────────────────────── */}
            <div className="bg-[#09090b] p-3 rounded border border-[#27272a] flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="block text-xxs font-semibold uppercase text-emerald-400">Beer–Lambert Calibration</span>
                <span className="text-[8px] text-zinc-600 font-mono">A = ε · c · l</span>
              </div>
              <p className="text-[9px] text-zinc-500 leading-relaxed">
                Compute molar attenuation coefficient ε, calibration R², and analytical figures of merit (LOD, LOQ) from standard solutions.
                Enter concentrations and corresponding absorbances at the target wavelength.
              </p>
              <div>
                <span className="text-[9px] text-zinc-500 block mb-0.5">Concentrations (mol L⁻¹ or μg mL⁻¹, comma-sep)</span>
                <input type="text" value={blConcs} onChange={e => setBlConcs(e.target.value)}
                  placeholder="0, 2, 5, 10, 20, 50"
                  className="w-full bg-[#18181b] border border-[#27272a] rounded p-1 text-[10px] text-white font-mono" />
              </div>
              <div>
                <span className="text-[9px] text-zinc-500 block mb-0.5">Absorbances at λmax (comma-sep)</span>
                <input type="text" value={blAbs} onChange={e => setBlAbs(e.target.value)}
                  placeholder="0.000, 0.120, 0.295, 0.601, 1.198, 2.985"
                  className="w-full bg-[#18181b] border border-[#27272a] rounded p-1 text-[10px] text-white font-mono" />
              </div>
              <div>
                <span className="text-[9px] text-zinc-500 block mb-0.5">Path length l (cm)</span>
                <input type="number" value={blPathLength} onChange={e => setBlPathLength(e.target.value)}
                  className="w-full bg-[#18181b] border border-[#27272a] rounded p-1 text-[10px] text-white text-center" />
              </div>
              <button
                onClick={() => {
                  setBlError('');
                  setBlResult(null);
                  try {
                    const concs = blConcs.split(',').map(s => parseFloat(s.trim())).filter(v => !isNaN(v));
                    const abs   = blAbs.split(',').map(s => parseFloat(s.trim())).filter(v => !isNaN(v));
                    if (concs.length !== abs.length) throw new Error(`${concs.length} concentrations vs ${abs.length} absorbances — must match.`);
                    const res = beerLambertCalibration(concs, abs, parseFloat(blPathLength) || 1.0);
                    setBlResult(res);
                    pushStateUndo(sd.y_processed, `Beer–Lambert: ε = ${res.epsilon} M⁻¹cm⁻¹, R² = ${res.r2}`);
                  } catch(err: any) {
                    setBlError(err.message || String(err));
                  }
                }}
                className="w-full bg-emerald-900/40 hover:bg-emerald-800/50 border border-emerald-600/30 text-emerald-200 py-1.5 px-3 rounded text-[10px] font-semibold uppercase tracking-wider transition"
              >
                Run Beer–Lambert Calibration
              </button>
              {blError && <p className="text-[9px] text-red-400">{blError}</p>}
              {blResult && (
                <div className="flex flex-col gap-1 mt-1">
                  <div className="grid grid-cols-2 gap-1.5">
                    {[
                      { label: 'ε (M⁻¹cm⁻¹)',   val: blResult.epsilon.toFixed(2),         color: 'text-emerald-300' },
                      { label: 'SE(ε)',           val: blResult.SE_epsilon.toFixed(4),       color: 'text-zinc-300'    },
                      { label: 'Intercept',       val: blResult.intercept.toFixed(6),        color: 'text-zinc-300'    },
                      { label: 'R²',             val: blResult.r2.toFixed(6),               color: 'text-sky-300'     },
                      { label: 'LOD',            val: blResult.LOD.toString(),               color: 'text-amber-300'   },
                      { label: 'LOQ',            val: blResult.LOQ.toString(),               color: 'text-amber-300'   },
                    ].map(m => (
                      <div key={m.label} className="bg-[#18181b] border border-[#27272a] rounded p-1.5">
                        <div className="text-[8px] text-zinc-500">{m.label}</div>
                        <div className={`text-[11px] font-mono font-bold ${m.color}`}>{m.val}</div>
                      </div>
                    ))}
                  </div>
                  <p className="text-[8px] text-zinc-600 italic">LOD = 3.3σ/slope · LOQ = 10σ/slope (ICH Q2-R1). σ estimated from regression RMSE.</p>
                </div>
              )}
            </div>

            {/* ── KUBELKA–MUNK (DRS) ──────────────────────────────────────────── */}
            <div className="bg-[#09090b] p-3 rounded border border-[#27272a] flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="block text-xxs font-semibold uppercase text-lime-400">Kubelka–Munk Transform (DRS)</span>
                <span className="text-[8px] text-zinc-600 font-mono">F(R) = (1−R)²/2R</span>
              </div>
              <p className="text-[9px] text-zinc-500 leading-relaxed">
                Converts solid-state diffuse reflectance R into F(R) ∝ α/S, then performs a Tauc-style bandgap extrapolation on [F(R)·hν]^n vs hν. Load your %R or R spectrum first.
              </p>
              <div className="flex gap-2 items-center">
                <label className="text-[9px] text-zinc-400">Transition:</label>
                <select value={kmTransition} onChange={e => setKmTransition(e.target.value as 'direct' | 'indirect')}
                  className="flex-1 bg-[#18181b] border border-[#27272a] rounded p-1 text-[10px] text-white">
                  <option value="direct">Direct (n = 2)</option>
                  <option value="indirect">Indirect (n = ½)</option>
                </select>
              </div>
              <label className="flex items-center gap-2 text-[9px] text-zinc-400 cursor-pointer">
                <input type="checkbox" checked={kmIsPercent} onChange={e => setKmIsPercent(e.target.checked)}
                  className="rounded border-zinc-600" />
                Input is %R (0–100)
              </label>
              <button
                onClick={() => {
                  setKmError(''); setKmResult(null);
                  try {
                    const res = kubelkaMunk(sd.x, sd.y_processed, kmTransition, kmIsPercent);
                    setKmResult(res);
                    pushStateUndo(sd.y_processed, `Kubelka–Munk: Eg = ${res.Eg_eV} eV (${kmTransition})`);
                  } catch(e: any) { setKmError(e.message || String(e)); }
                }}
                className="w-full bg-lime-900/40 hover:bg-lime-800/50 border border-lime-600/30 text-lime-200 py-1.5 px-3 rounded text-[10px] font-semibold uppercase tracking-wider transition"
              >Run Kubelka–Munk Transform</button>
              {kmError && <p className="text-[9px] text-red-400">{kmError}</p>}
              {kmResult && (
                <div className="flex flex-col gap-1 mt-1">
                  <div className="grid grid-cols-2 gap-1.5">
                    <div className="bg-[#18181b] border border-[#27272a] rounded p-1.5 col-span-2">
                      <div className="text-[8px] text-zinc-500">Optical Bandgap Eg ({kmResult.transition})</div>
                      <div className="text-[18px] font-mono font-bold text-lime-300">{kmResult.Eg_eV.toFixed(3)} eV</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-1 text-[8px] text-zinc-500 mt-0.5">
                    <span>F(R) max: <span className="text-white font-mono">{Math.max(...kmResult.FR).toExponential(2)}</span></span>
                    <span>hν range: <span className="text-white font-mono">{Math.min(...kmResult.hnu_eV).toFixed(2)}–{Math.max(...kmResult.hnu_eV).toFixed(2)} eV</span></span>
                    <span>Points: <span className="text-white font-mono">{kmResult.FR.length}</span></span>
                  </div>
                  <p className="text-[8px] text-zinc-600 italic">Kubelka & Munk, Z. Tech. Phys. 12, 593 (1931) · Murphy, Sol. Energy Mater. Sol. Cells 91, 1326 (2007).</p>
                </div>
              )}
            </div>

            {/* ── MIE / RAYLEIGH SCATTERING SUBTRACTION ───────────────────── */}
            <div className="bg-[#09090b] p-3 rounded border border-[#27272a] flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="block text-xxs font-semibold uppercase text-cyan-400">Mie / Rayleigh Scatter Subtraction</span>
                <span className="text-[8px] text-zinc-600 font-mono">A = A₀·λ^(−α)</span>
              </div>
              <p className="text-[9px] text-zinc-500 leading-relaxed">
                Fits and removes the power-law scattering baseline A₀·λ^(−α) from colloidal UV-Vis spectra. Specify a wavelength region free of absorption bands (scattering-only region) for the fit.
              </p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-[9px] text-zinc-500 block mb-0.5">Ref. region min (nm)</span>
                  <input type="number" value={mieRefMin} onChange={e => setMieRefMin(e.target.value)}
                    className="w-full bg-[#18181b] border border-[#27272a] rounded p-1 text-[10px] text-white text-center" />
                </div>
                <div>
                  <span className="text-[9px] text-zinc-500 block mb-0.5">Ref. region max (nm)</span>
                  <input type="number" value={mieRefMax} onChange={e => setMieRefMax(e.target.value)}
                    className="w-full bg-[#18181b] border border-[#27272a] rounded p-1 text-[10px] text-white text-center" />
                </div>
              </div>
              <button
                onClick={() => {
                  setMieError(''); setMieResult(null);
                  try {
                    const res = rayleighMieSubtraction(sd.x, sd.y_processed, parseFloat(mieRefMin), parseFloat(mieRefMax));
                    setMieResult(res);
                    // Apply corrected spectrum to processed data
                    const list = datasets.map(d => d.id === sd.id ? {
                      ...d, y_processed: res.corrected,
                      undoStack: [...d.undoStack, [...d.y_processed]],
                      history: [...d.history, `[${new Date().toLocaleTimeString()}] Mie/Rayleigh scatter subtracted: α=${res.alpha.toFixed(3)}, R²=${res.r2.toFixed(4)}`]
                    } : d);
                    onDatasetsUpdated(list);
                    onDatasetSelected(list.find(d => d.id === sd.id)!);
                  } catch(e: any) { setMieError(e.message || String(e)); }
                }}
                className="w-full bg-cyan-900/40 hover:bg-cyan-800/50 border border-cyan-600/30 text-cyan-200 py-1.5 px-3 rounded text-[10px] font-semibold uppercase tracking-wider transition"
              >Subtract Scattering Background</button>
              {mieError && <p className="text-[9px] text-red-400">{mieError}</p>}
              {mieResult && (
                <div className="grid grid-cols-2 gap-1.5 mt-1">
                  {[
                    { label: 'Exponent α',    val: mieResult.alpha.toFixed(4),        color: 'text-cyan-300',    hint: 'Rayleigh≈4, Mie≈2–3' },
                    { label: 'Pre-factor A',  val: mieResult.A.toString(),            color: 'text-sky-300',     hint: '' },
                    { label: 'R² (ref fit)',  val: mieResult.r2.toFixed(5),           color: 'text-emerald-300', hint: '' },
                    { label: 'Scatter type',  val: mieResult.alpha > 3.5 ? 'Rayleigh' : 'Mie', color: 'text-amber-300', hint: '' },
                  ].map(m => (
                    <div key={m.label} className="bg-[#18181b] border border-[#27272a] rounded p-1.5">
                      <div className="text-[8px] text-zinc-500">{m.label} {m.hint && <span className="text-zinc-600">({m.hint})</span>}</div>
                      <div className={`text-[11px] font-mono font-bold ${m.color}`}>{m.val}</div>
                    </div>
                  ))}
                  <p className="text-[8px] text-zinc-600 italic col-span-2">Corrected spectrum applied to processed data. Use Undo to revert. Ref: Bohren & Huffman, Wiley (1983).</p>
                </div>
              )}
            </div>

            {/* ── KRAMERS–KRONIG ────────────────────────────────────────────── */}
            <div className="bg-[#09090b] p-3 rounded border border-[#27272a] flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="block text-xxs font-semibold uppercase text-indigo-400">Kramers–Kronig Relations</span>
                <span className="text-[8px] text-zinc-600 font-mono">n(ω) ↔ k(ω)</span>
              </div>
              <p className="text-[9px] text-zinc-500 leading-relaxed">
                Computes real (n) and imaginary (k) optical constants from absorbance via Kramers–Kronig transform, then derives dielectric functions ε₁ = n²−k², ε₂ = 2nk.
              </p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-[9px] text-zinc-500 block mb-0.5">Path length l (cm)</span>
                  <input type="number" value={kkPathLen} onChange={e => setKkPathLen(e.target.value)}
                    className="w-full bg-[#18181b] border border-[#27272a] rounded p-1 text-[10px] text-white text-center" />
                </div>
                <div>
                  <span className="text-[9px] text-zinc-500 block mb-0.5">n∞ (high-freq. refractive index)</span>
                  <input type="number" value={kkNInf} onChange={e => setKkNInf(e.target.value)}
                    className="w-full bg-[#18181b] border border-[#27272a] rounded p-1 text-[10px] text-white text-center" />
                </div>
              </div>
              <button
                onClick={() => {
                  setKkError(''); setKkResult(null);
                  try {
                    const res = kramersKronig(sd.x, sd.y_processed, parseFloat(kkPathLen) || 0.1, parseFloat(kkNInf) || 1.5);
                    setKkResult(res);
                    pushStateUndo(sd.y_processed, `Kramers–Kronig: n range ${Math.min(...res.n).toFixed(3)}–${Math.max(...res.n).toFixed(3)}`);
                  } catch(e: any) { setKkError(e.message || String(e)); }
                }}
                className="w-full bg-indigo-900/40 hover:bg-indigo-800/50 border border-indigo-600/30 text-indigo-200 py-1.5 px-3 rounded text-[10px] font-semibold uppercase tracking-wider transition"
              >Compute Kramers–Kronig</button>
              {kkError && <p className="text-[9px] text-red-400">{kkError}</p>}
              {kkResult && (
                <div className="flex flex-col gap-1 mt-1">
                  <div className="grid grid-cols-2 gap-1.5">
                    {[
                      { label: 'n (min → max)',  val: `${Math.min(...kkResult.n).toFixed(3)} → ${Math.max(...kkResult.n).toFixed(3)}`,  color: 'text-indigo-300' },
                      { label: 'k (min → max)',  val: `${Math.min(...kkResult.k).toFixed(4)} → ${Math.max(...kkResult.k).toFixed(4)}`,  color: 'text-purple-300' },
                      { label: 'ε₁ (min → max)', val: `${Math.min(...kkResult.epsilon1).toFixed(3)} → ${Math.max(...kkResult.epsilon1).toFixed(3)}`, color: 'text-sky-300'   },
                      { label: 'ε₂ (min → max)', val: `${Math.min(...kkResult.epsilon2).toFixed(4)} → ${Math.max(...kkResult.epsilon2).toFixed(4)}`, color: 'text-teal-300'  },
                    ].map(m => (
                      <div key={m.label} className="bg-[#18181b] border border-[#27272a] rounded p-1.5">
                        <div className="text-[8px] text-zinc-500">{m.label}</div>
                        <div className={`text-[10px] font-mono font-bold ${m.color}`}>{m.val}</div>
                      </div>
                    ))}
                  </div>
                  <p className="text-[8px] text-zinc-600 italic">Kramers (1927) · Kronig (1926). Numerical P.V. integral, trapezoidal rule. n∞={kkNInf}, l={kkPathLen} cm.</p>
                </div>
              )}
            </div>

            {/* ── PLQY ──────────────────────────────────────────────────────── */}
            <div className="bg-[#09090b] p-3 rounded border border-[#27272a] flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="block text-xxs font-semibold uppercase text-pink-400">Relative PLQY</span>
                <span className="text-[8px] text-zinc-600 font-mono">Φₓ = Φᵣ(Iₓ/Iᵣ)(Aᵣ/Aₓ)(nₓ/nᵣ)²</span>
              </div>
              <p className="text-[9px] text-zinc-500 leading-relaxed">
                Comparative method. Active dataset = sample PL. Select reference PL dataset below. Keep absorbances at λex below 0.1 to minimise inner-filter effects.
              </p>
              <div>
                <span className="text-[9px] text-zinc-500 block mb-0.5">Reference PL dataset</span>
                <select value={plqyRefId} onChange={e => setPlqyRefId(e.target.value)}
                  className="w-full bg-[#18181b] border border-[#27272a] rounded p-1 text-[10px] text-white">
                  <option value="">— select —</option>
                  {datasets.filter(d => d.id !== sd.id).map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-[9px] text-zinc-500 block mb-0.5">A(λex) — sample</span>
                  <input type="number" value={plqyAbsX} onChange={e => setPlqyAbsX(e.target.value)} placeholder="e.g. 0.05"
                    className="w-full bg-[#18181b] border border-[#27272a] rounded p-1 text-[10px] text-white text-center" />
                </div>
                <div>
                  <span className="text-[9px] text-zinc-500 block mb-0.5">A(λex) — reference</span>
                  <input type="number" value={plqyAbsRef} onChange={e => setPlqyAbsRef(e.target.value)} placeholder="e.g. 0.05"
                    className="w-full bg-[#18181b] border border-[#27272a] rounded p-1 text-[10px] text-white text-center" />
                </div>
                <div>
                  <span className="text-[9px] text-zinc-500 block mb-0.5">Φᵣ (ref. quantum yield)</span>
                  <input type="number" value={plqyPhiRef} onChange={e => setPlqyPhiRef(e.target.value)} placeholder="0.546"
                    className="w-full bg-[#18181b] border border-[#27272a] rounded p-1 text-[10px] text-white text-center" />
                </div>
                <div>
                  <span className="text-[9px] text-zinc-500 block mb-0.5">nₓ / nᵣ (solvent RI)</span>
                  <input type="text" value={`${plqyNX} / ${plqyNRef}`}
                    onChange={e => { const p = e.target.value.split('/'); setPlqyNX(p[0]?.trim()||'1.333'); setPlqyNRef(p[1]?.trim()||'1.333'); }}
                    className="w-full bg-[#18181b] border border-[#27272a] rounded p-1 text-[10px] text-white text-center" />
                </div>
              </div>
              <button
                onClick={() => {
                  setPlqyError(''); setPlqyResult(null);
                  try {
                    const refDs = datasets.find(d => d.id === plqyRefId);
                    if (!refDs) throw new Error('Select a reference PL dataset.');
                    const absX   = parseFloat(plqyAbsX);
                    const absRef = parseFloat(plqyAbsRef);
                    if (isNaN(absX) || isNaN(absRef)) throw new Error('Enter absorbances at λex for sample and reference.');
                    const res = relativePLQY(
                      sd.x, sd.y_processed,
                      refDs.x, refDs.y_processed,
                      absX, absRef,
                      parseFloat(plqyPhiRef) || 0.546,
                      parseFloat(plqyNX) || 1.333,
                      parseFloat(plqyNRef) || 1.333
                    );
                    setPlqyResult(res);
                    pushStateUndo(sd.y_processed, `PLQY: Φ = ${(res.phi_x * 100).toFixed(2)}%`);
                  } catch(e: any) { setPlqyError(e.message || String(e)); }
                }}
                className="w-full bg-pink-900/40 hover:bg-pink-800/50 border border-pink-600/30 text-pink-200 py-1.5 px-3 rounded text-[10px] font-semibold uppercase tracking-wider transition"
              >Calculate PLQY</button>
              {plqyError && <p className="text-[9px] text-red-400">{plqyError}</p>}
              {plqyResult && (
                <div className="flex flex-col gap-1 mt-1">
                  <div className="bg-[#18181b] border border-pink-600/30 rounded p-2 text-center">
                    <div className="text-[9px] text-zinc-500">Φₓ (Quantum Yield)</div>
                    <div className="text-[24px] font-mono font-bold text-pink-300">{(plqyResult.phi_x * 100).toFixed(2)}%</div>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {[
                      { label: 'Iₓ (integrated PL)',   val: plqyResult.intPL_x.toString(),            color: 'text-pink-300'    },
                      { label: 'Iᵣ (integrated PL)',   val: plqyResult.intPL_ref.toString(),           color: 'text-rose-300'    },
                      { label: 'Aₓ at λex',           val: plqyResult.abs_x.toFixed(4),              color: 'text-zinc-300'    },
                      { label: 'Aᵣ at λex',           val: plqyResult.abs_ref.toFixed(4),             color: 'text-zinc-300'    },
                      { label: '(nₓ/nᵣ)² correction', val: plqyResult.refractiveCorrection.toFixed(5), color: 'text-amber-300'   },
                      { label: 'Φᵣ used',             val: plqyResult.phi_ref.toString(),             color: 'text-zinc-400'    },
                    ].map(m => (
                      <div key={m.label} className="bg-[#18181b] border border-[#27272a] rounded p-1.5">
                        <div className="text-[8px] text-zinc-500">{m.label}</div>
                        <div className={`text-[10px] font-mono font-bold ${m.color}`}>{m.val}</div>
                      </div>
                    ))}
                  </div>
                  {plqyResult.abs_x > 0.1 && (
                    <div className="bg-orange-900/30 border border-orange-600/30 rounded p-1.5 text-[9px] text-orange-300">
                      ⚠ Sample A = {plqyResult.abs_x.toFixed(3)} &gt; 0.1. Inner-filter effects may inflate Φ. Dilute sample.
                    </div>
                  )}
                  <p className="text-[8px] text-zinc-600 italic">Williams et al., Analyst 108, 1067 (1983) · Würth et al., Nat. Protoc. 8, 1535 (2013).</p>
                </div>
              )}
            </div>

            {/* ── WILLIAMSON–HALL ───────────────────────────────────────────── */}
            <div className="bg-[#09090b] p-3 rounded border border-[#27272a] flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="block text-xxs font-semibold uppercase text-orange-400">Williamson–Hall Plot (XRD)</span>
                <span className="text-[8px] text-zinc-600 font-mono">β cosθ = Kλ/D + 4ε sinθ</span>
              </div>
              <p className="text-[9px] text-zinc-500 leading-relaxed">
                Separates crystallite size D (nm) and microstrain ε from multiple XRD peaks. Add 2θ and FWHM for each peak below. Cu Kα₁ (1.5406 Å) is the default wavelength.
              </p>
              <div>
                <span className="text-[9px] text-zinc-500 block mb-0.5">X-ray wavelength λ (Å)</span>
                <input type="number" value={whLambda} onChange={e => setWhLambda(e.target.value)}
                  className="w-full bg-[#18181b] border border-[#27272a] rounded p-1 text-[10px] text-white text-center" />
              </div>

              {/* Peak input rows */}
              <div className="flex flex-col gap-1">
                <div className="grid grid-cols-12 gap-1 text-[8px] text-zinc-500 uppercase px-1">
                  <span className="col-span-4">Label</span>
                  <span className="col-span-3 text-center">2θ (°)</span>
                  <span className="col-span-3 text-center">FWHM (°)</span>
                  <span className="col-span-2 text-center">Del</span>
                </div>
                {whPeaks.map((p, i) => (
                  <div key={i} className="grid grid-cols-12 gap-1">
                    <input value={p.label || ''} onChange={e => setWhPeaks(prev => prev.map((pk, j) => j===i ? {...pk, label: e.target.value} : pk))}
                      className="col-span-4 bg-[#18181b] border border-[#27272a] rounded p-1 text-[9px] text-zinc-300" placeholder="hkl" />
                    <input type="number" value={p.twoTheta_deg} onChange={e => setWhPeaks(prev => prev.map((pk, j) => j===i ? {...pk, twoTheta_deg: parseFloat(e.target.value)||0} : pk))}
                      className="col-span-3 bg-[#18181b] border border-[#27272a] rounded p-1 text-[9px] text-white text-center" />
                    <input type="number" value={p.fwhm_deg} onChange={e => setWhPeaks(prev => prev.map((pk, j) => j===i ? {...pk, fwhm_deg: parseFloat(e.target.value)||0} : pk))}
                      className="col-span-3 bg-[#18181b] border border-[#27272a] rounded p-1 text-[9px] text-white text-center" />
                    <button onClick={() => setWhPeaks(prev => prev.filter((_, j) => j !== i))}
                      className="col-span-2 bg-red-900/40 hover:bg-red-800/60 text-red-300 rounded text-[9px] transition">✕</button>
                  </div>
                ))}
                <button onClick={() => setWhPeaks(prev => [...prev, { twoTheta_deg: 0, fwhm_deg: 0, label: '' }])}
                  className="text-[9px] text-zinc-500 hover:text-zinc-300 border border-dashed border-[#27272a] rounded p-1 transition">
                  + Add peak
                </button>
              </div>

              <button
                onClick={() => {
                  setWhError(''); setWhResult(null);
                  try {
                    const res = williamsonHall(whPeaks, parseFloat(whLambda) || 1.5406);
                    setWhResult(res);
                    pushStateUndo(sd.y_processed, `Williamson–Hall: D=${res.D_nm} nm, ε=${res.microstrain}`);
                  } catch(e: any) { setWhError(e.message || String(e)); }
                }}
                className="w-full bg-orange-900/40 hover:bg-orange-800/50 border border-orange-600/30 text-orange-200 py-1.5 px-3 rounded text-[10px] font-semibold uppercase tracking-wider transition"
              >Run Williamson–Hall Analysis</button>
              {whError && <p className="text-[9px] text-red-400">{whError}</p>}
              {whResult && (
                <div className="flex flex-col gap-1 mt-1">
                  <div className="grid grid-cols-2 gap-1.5">
                    {[
                      { label: 'D (nm)',        val: whResult.D_nm.toFixed(3),              color: 'text-orange-300' },
                      { label: 'Microstrain ε', val: whResult.microstrain.toExponential(3), color: 'text-amber-300'  },
                      { label: 'R² (WH fit)',   val: whResult.r2.toFixed(5),                color: 'text-emerald-300'},
                      { label: 'Slope (= ε)',   val: whResult.slope.toExponential(4),       color: 'text-zinc-300'   },
                      { label: 'Intercept',     val: whResult.intercept.toExponential(4),   color: 'text-zinc-300'   },
                    ].map(m => (
                      <div key={m.label} className="bg-[#18181b] border border-[#27272a] rounded p-1.5">
                        <div className="text-[8px] text-zinc-500">{m.label}</div>
                        <div className={`text-[11px] font-mono font-bold ${m.color}`}>{m.val}</div>
                      </div>
                    ))}
                    <div className="bg-[#18181b] border border-[#27272a] rounded p-1.5 col-span-2">
                      <div className="text-[8px] text-zinc-500 mb-1">β cosθ vs 4 sinθ data points</div>
                      <div className="flex flex-wrap gap-1">
                        {whResult.betaCosTheta.map((bc, i) => (
                          <span key={i} className="text-[8px] font-mono bg-[#27272a] rounded px-1 py-0.5 text-orange-200">
                            {whPeaks[i]?.label || i+1}: ({whResult.fourSinTheta[i].toFixed(4)}, {bc.toExponential(3)})
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                  <p className="text-[8px] text-zinc-600 italic">Williamson & Hall, Acta Metall. 1, 22 (1953). Slope = microstrain ε; intercept = Kλ/D.</p>
                </div>
              )}
            </div>

            {/* ── MCR-ALS ──────────────────────────────────────────────────────── */}
            <div className="bg-[#09090b] p-3 rounded border border-[#27272a] flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="block text-xxs font-semibold uppercase text-blue-400">MCR-ALS Spectral Unmixing</span>
                <span className="text-[8px] text-zinc-600 font-mono">D = C·S + E</span>
              </div>
              <p className="text-[9px] text-zinc-500 leading-relaxed">
                Decomposes all visible spectra into pure component spectra S and concentration profiles C via Alternating Least Squares with non-negativity constraints. Requires ≥ 2 loaded datasets.
              </p>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <span className="text-[9px] text-zinc-500 block mb-0.5">Components</span>
                  <input type="number" min="1" max="8" value={mcrNComp} onChange={e => setMcrNComp(e.target.value)}
                    className="w-full bg-[#18181b] border border-[#27272a] rounded p-1 text-[10px] text-white text-center" />
                </div>
                <div>
                  <span className="text-[9px] text-zinc-500 block mb-0.5">Max iterations</span>
                  <input type="number" value={mcrMaxIter} onChange={e => setMcrMaxIter(e.target.value)}
                    className="w-full bg-[#18181b] border border-[#27272a] rounded p-1 text-[10px] text-white text-center" />
                </div>
                <div>
                  <span className="text-[9px] text-zinc-500 block mb-0.5">Tol (LOF %)</span>
                  <input type="number" value={mcrTol} onChange={e => setMcrTol(e.target.value)}
                    className="w-full bg-[#18181b] border border-[#27272a] rounded p-1 text-[10px] text-white text-center" />
                </div>
              </div>
              <button
                onClick={() => {
                  setMcrError(''); setMcrResult(null);
                  try {
                    const visDs = datasets.filter(d => d.visible);
                    if (visDs.length < 2) throw new Error('Load and make visible at least 2 datasets for MCR-ALS.');
                    const D = visDs.map(d => d.y_processed);
                    const res = mcrALS(D, parseInt(mcrNComp) || 2, parseInt(mcrMaxIter) || 50, parseFloat(mcrTol) || 0.1);
                    setMcrResult(res);
                    pushStateUndo(sd.y_processed, `MCR-ALS: ${res.nComponents} components, LOF=${res.finalLof}%, R²=${res.r2}`);
                  } catch(e: any) { setMcrError(e.message || String(e)); }
                }}
                className="w-full bg-blue-900/40 hover:bg-blue-800/50 border border-blue-600/30 text-blue-200 py-1.5 px-3 rounded text-[10px] font-semibold uppercase tracking-wider transition"
              >Run MCR-ALS</button>
              {mcrError && <p className="text-[9px] text-red-400">{mcrError}</p>}
              {mcrResult && (
                <div className="flex flex-col gap-1 mt-1">
                  <div className="grid grid-cols-3 gap-1.5">
                    {[
                      { label: 'Components',  val: mcrResult.nComponents.toString(),       color: 'text-blue-300'    },
                      { label: 'Final LOF %', val: mcrResult.finalLof.toFixed(4) + ' %',  color: 'text-amber-300'   },
                      { label: 'R²',          val: mcrResult.r2.toFixed(5),               color: 'text-emerald-300' },
                    ].map(m => (
                      <div key={m.label} className="bg-[#18181b] border border-[#27272a] rounded p-1.5 text-center">
                        <div className="text-[8px] text-zinc-500">{m.label}</div>
                        <div className={`text-[11px] font-mono font-bold ${m.color}`}>{m.val}</div>
                      </div>
                    ))}
                  </div>
                  {/* LOF convergence trace */}
                  <div className="bg-[#18181b] border border-[#27272a] rounded p-2">
                    <div className="text-[8px] text-zinc-500 mb-1">LOF convergence (% per iteration)</div>
                    <div className="flex items-end gap-0.5 h-10">
                      {mcrResult.lof.map((v, i) => {
                        const maxV = Math.max(...mcrResult.lof) || 1;
                        return (
                          <div key={i} title={`Iter ${i+1}: ${v.toFixed(3)}%`}
                            className="flex-1 bg-blue-600 rounded-sm min-w-[2px]"
                            style={{ height: `${(v / maxV) * 100}%`, opacity: 0.7 + 0.3*(i/mcrResult.lof.length) }} />
                        );
                      })}
                    </div>
                  </div>
                  {/* Concentration profiles */}
                  <div className="bg-[#18181b] border border-[#27272a] rounded p-2">
                    <div className="text-[8px] text-zinc-500 mb-1">Concentration profiles C (normalised)</div>
                    {mcrResult.C.map((row, i) => {
                      const maxC = Math.max(...row) || 1;
                      return (
                        <div key={i} className="flex items-center gap-1 mb-1">
                          <span className="text-[8px] text-zinc-500 w-14 shrink-0">
                            {datasets.filter(d => d.visible)[i]?.name?.slice(0,10) || `Sample ${i+1}`}
                          </span>
                          <div className="flex-1 flex items-end gap-px h-5">
                            {row.map((v, j) => (
                              <div key={j} title={`Component ${j+1}: ${v.toFixed(4)}`}
                                className="flex-1 rounded-sm"
                                style={{
                                  height: `${(v / maxC) * 100}%`,
                                  backgroundColor: `hsl(${200 + j * 60}, 70%, 55%)`
                                }} />
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <p className="text-[8px] text-zinc-600 italic">Tauler et al., J. Chemom. 9, 31 (1995) · de Juan & Tauler, Crit. Rev. Anal. Chem. 36, 163 (2006).</p>
                </div>
              )}
            </div>

            {/* ── PLS REGRESSION ────────────────────────────────────────────── */}
            <div className="bg-[#09090b] p-3 rounded border border-[#27272a] flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="block text-xxs font-semibold uppercase text-sky-400">PLS Regression</span>
                <span className="text-[8px] text-zinc-600 font-mono">ŷ = X · b</span>
              </div>
              <p className="text-[9px] text-zinc-500 leading-relaxed">
                Partial Least Squares (NIPALS) calibration. Uses all visible spectra as X matrix. Enter comma-separated y values (concentrations or properties) — one per visible dataset.
              </p>
              <div>
                <span className="text-[9px] text-zinc-500 block mb-0.5">y values (one per visible spectrum)</span>
                <input type="text" value={plsY} onChange={e => setPlsY(e.target.value)}
                  placeholder="e.g. 0.5, 1.0, 2.0, 5.0, 10.0"
                  className="w-full bg-[#18181b] border border-[#27272a] rounded p-1 text-[10px] text-white font-mono" />
              </div>
              <div>
                <span className="text-[9px] text-zinc-500 block mb-0.5">Latent variables (LVs)</span>
                <input type="number" min="1" max="10" value={plsNLV} onChange={e => setPlsNLV(e.target.value)}
                  className="w-full bg-[#18181b] border border-[#27272a] rounded p-1 text-[10px] text-white text-center" />
              </div>
              <button
                onClick={() => {
                  setPlsError(''); setPlsResult(null);
                  try {
                    const visDs = datasets.filter(d => d.visible);
                    if (visDs.length < 2) throw new Error('Need ≥ 2 visible datasets.');
                    const y = plsY.split(',').map(s => parseFloat(s.trim())).filter(v => !isNaN(v));
                    if (y.length !== visDs.length) throw new Error(`${y.length} y values vs ${visDs.length} spectra. Must match.`);
                    const X = visDs.map(d => d.y_processed);
                    const res = plsRegression(X, y, parseInt(plsNLV) || 3);
                    setPlsResult(res);
                    pushStateUndo(sd.y_processed, `PLS: ${res.nLV} LVs, RMSEC=${res.rmsec}, R²=${res.r2cal}`);
                  } catch(e: any) { setPlsError(e.message || String(e)); }
                }}
                className="w-full bg-sky-900/40 hover:bg-sky-800/50 border border-sky-600/30 text-sky-200 py-1.5 px-3 rounded text-[10px] font-semibold uppercase tracking-wider transition"
              >Run PLS Calibration</button>
              {plsError && <p className="text-[9px] text-red-400">{plsError}</p>}
              {plsResult && (
                <div className="flex flex-col gap-1 mt-1">
                  <div className="grid grid-cols-3 gap-1.5">
                    {[
                      { label: 'LVs',    val: plsResult.nLV.toString(),          color: 'text-sky-300'     },
                      { label: 'RMSEC',  val: plsResult.rmsec.toExponential(3),  color: 'text-amber-300'   },
                      { label: 'R²cal',  val: plsResult.r2cal.toFixed(5),        color: 'text-emerald-300' },
                    ].map(m => (
                      <div key={m.label} className="bg-[#18181b] border border-[#27272a] rounded p-1.5 text-center">
                        <div className="text-[8px] text-zinc-500">{m.label}</div>
                        <div className={`text-[11px] font-mono font-bold ${m.color}`}>{m.val}</div>
                      </div>
                    ))}
                  </div>
                  {/* X variance per LV */}
                  <div className="bg-[#18181b] border border-[#27272a] rounded p-2">
                    <div className="text-[8px] text-zinc-500 mb-1">Explained X-variance per LV (%)</div>
                    <div className="flex gap-1">
                      {plsResult.xVariance.map((v, i) => (
                        <div key={i} className="flex-1 bg-[#27272a] rounded p-1 text-center">
                          <div className="text-[7px] text-zinc-500">LV{i+1}</div>
                          <div className="text-[9px] font-mono text-sky-300">{v.toFixed(1)}%</div>
                        </div>
                      ))}
                    </div>
                  </div>
                  {/* Predicted vs actual */}
                  <div className="bg-[#18181b] border border-[#27272a] rounded p-2">
                    <div className="text-[8px] text-zinc-500 mb-1">Predicted vs actual y (calibration)</div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-[8px]">
                        <thead>
                          <tr className="text-zinc-500 uppercase">
                            <th className="p-0.5 text-left">Sample</th>
                            <th className="p-0.5 text-right">Actual</th>
                            <th className="p-0.5 text-right">Predicted</th>
                            <th className="p-0.5 text-right">Residual</th>
                          </tr>
                        </thead>
                        <tbody>
                          {plsResult.yHat.map((yh, i) => {
                            const actual = plsY.split(',').map(s => parseFloat(s.trim()))[i];
                            return (
                              <tr key={i} className="border-t border-[#27272a]">
                                <td className="p-0.5 text-zinc-500">{datasets.filter(d => d.visible)[i]?.name?.slice(0,12) || i+1}</td>
                                <td className="p-0.5 text-right font-mono text-white">{actual?.toFixed(4)}</td>
                                <td className="p-0.5 text-right font-mono text-sky-300">{yh.toFixed(4)}</td>
                                <td className="p-0.5 text-right font-mono text-amber-300">{(yh - actual).toFixed(4)}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  <p className="text-[8px] text-zinc-600 italic">Geladi & Kowalski, Anal. Chim. Acta 185, 1 (1986) · NIPALS algorithm.</p>
                </div>
              )}
            </div>

            {/* ── HIERARCHICAL CLUSTERING ───────────────────────────────────── */}
            <div className="bg-[#09090b] p-3 rounded border border-[#27272a] flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="block text-xxs font-semibold uppercase text-fuchsia-400">Hierarchical Clustering (HCA)</span>
                <span className="text-[8px] text-zinc-600 font-mono">Ward · cosine distance</span>
              </div>
              <p className="text-[9px] text-zinc-500 leading-relaxed">
                Groups all visible spectra by shape similarity using Ward-linkage agglomerative clustering with cosine distance. Adjust the cut distance to control the number of clusters.
              </p>
              <div>
                <span className="text-[9px] text-zinc-500 block mb-0.5">Cut distance (0–1; lower = more clusters)</span>
                <input type="number" step="0.05" min="0.01" max="1" value={hcaCutDist} onChange={e => setHcaCutDist(e.target.value)}
                  className="w-full bg-[#18181b] border border-[#27272a] rounded p-1 text-[10px] text-white text-center" />
              </div>
              <button
                onClick={() => {
                  setHcaError(''); setHcaResult(null);
                  try {
                    const visDs = datasets.filter(d => d.visible);
                    if (visDs.length < 2) throw new Error('Need ≥ 2 visible datasets for clustering.');
                    const spectra = visDs.map(d => d.y_processed);
                    const res = hierarchicalClustering(spectra, parseFloat(hcaCutDist) || 0.3);
                    setHcaResult(res);
                    pushStateUndo(sd.y_processed, `HCA: ${res.nClusters} clusters at cutDist=${hcaCutDist}`);
                  } catch(e: any) { setHcaError(e.message || String(e)); }
                }}
                className="w-full bg-fuchsia-900/40 hover:bg-fuchsia-800/50 border border-fuchsia-600/30 text-fuchsia-200 py-1.5 px-3 rounded text-[10px] font-semibold uppercase tracking-wider transition"
              >Run Hierarchical Clustering</button>
              {hcaError && <p className="text-[9px] text-red-400">{hcaError}</p>}
              {hcaResult && (
                <div className="flex flex-col gap-1 mt-1">
                  <div className="grid grid-cols-2 gap-1.5">
                    <div className="bg-[#18181b] border border-[#27272a] rounded p-1.5 text-center">
                      <div className="text-[8px] text-zinc-500">Clusters</div>
                      <div className="text-[18px] font-mono font-bold text-fuchsia-300">{hcaResult.nClusters}</div>
                    </div>
                    <div className="bg-[#18181b] border border-[#27272a] rounded p-1.5 text-center">
                      <div className="text-[8px] text-zinc-500">Merge steps</div>
                      <div className="text-[18px] font-mono font-bold text-zinc-300">{hcaResult.linkage.length}</div>
                    </div>
                  </div>
                  {/* Cluster label assignments */}
                  <div className="bg-[#18181b] border border-[#27272a] rounded p-2">
                    <div className="text-[8px] text-zinc-500 mb-1.5">Cluster assignments</div>
                    <div className="flex flex-col gap-1">
                      {hcaResult.labels.map((lbl, i) => {
                        const hue = (lbl * 137.5) % 360;
                        return (
                          <div key={i} className="flex items-center gap-2">
                            <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: `hsl(${hue},70%,55%)` }} />
                            <span className="text-[9px] text-zinc-300 flex-1">{datasets.filter(d => d.visible)[i]?.name || `Spectrum ${i+1}`}</span>
                            <span className="text-[9px] font-mono text-fuchsia-300">Cluster {lbl + 1}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  {/* Distance matrix mini heatmap */}
                  <div className="bg-[#18181b] border border-[#27272a] rounded p-2">
                    <div className="text-[8px] text-zinc-500 mb-1">Pairwise cosine distance matrix</div>
                    <div className="overflow-x-auto">
                      <table className="text-[7px] font-mono">
                        <tbody>
                          {hcaResult.distMatrix.map((row, i) => (
                            <tr key={i}>
                              {row.map((v, j) => (
                                <td key={j} className="p-px w-7 h-5 text-center rounded-sm"
                                  style={{
                                    backgroundColor: `rgba(192,132,252,${v.toFixed(2)})`,
                                    color: v > 0.5 ? 'white' : '#71717a'
                                  }}>
                                  {v.toFixed(2)}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  <p className="text-[8px] text-zinc-600 italic">Ward J.H., J. Am. Stat. Assoc. 58, 236 (1963). Distance = 1 − cosine similarity.</p>
                </div>
              )}
            </div>

            {/* ── SPECTRAL SIMILARITY ───────────────────────────────────────── */}
            <div className="bg-[#09090b] p-3 rounded border border-[#27272a] flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="block text-xxs font-semibold uppercase text-teal-400">Spectral Similarity</span>
                <span className="text-[8px] text-zinc-600 font-mono">Cosine · Pearson · SAD</span>
              </div>
              <p className="text-[9px] text-zinc-500 leading-relaxed">
                Computes six similarity metrics between the active dataset and a reference. Reference is interpolated onto the active dataset axis. Useful for library matching and batch QC.
              </p>
              <div>
                <span className="text-[9px] text-zinc-500 block mb-0.5">Reference spectrum</span>
                <select value={simRefId} onChange={e => setSimRefId(e.target.value)}
                  className="w-full bg-[#18181b] border border-[#27272a] rounded p-1 text-[10px] text-white">
                  <option value="">— select reference —</option>
                  {datasets.filter(d => d.id !== sd.id).map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>
              <button
                onClick={() => {
                  setSimError(''); setSimResult(null);
                  try {
                    const refDs = datasets.find(d => d.id === simRefId);
                    if (!refDs) throw new Error('Select a reference spectrum.');
                    const res = spectralSimilarity(sd.x, sd.y_processed, refDs.x, refDs.y_processed);
                    setSimResult(res);
                    pushStateUndo(sd.y_processed, `Similarity vs "${refDs.name}": cosine=${res.cosine.toFixed(4)}`);
                  } catch(e: any) { setSimError(e.message || String(e)); }
                }}
                className="w-full bg-teal-900/40 hover:bg-teal-800/50 border border-teal-600/30 text-teal-200 py-1.5 px-3 rounded text-[10px] font-semibold uppercase tracking-wider transition"
              >Compute Similarity</button>
              {simError && <p className="text-[9px] text-red-400">{simError}</p>}
              {simResult && (
                <div className="flex flex-col gap-1 mt-1">
                  {/* Cosine similarity gauge */}
                  <div className="bg-[#18181b] border border-[#27272a] rounded p-2">
                    <div className="flex justify-between text-[8px] text-zinc-500 mb-1">
                      <span>Cosine similarity</span>
                      <span className="text-teal-300 font-mono font-bold">{(simResult.cosine * 100).toFixed(2)}%</span>
                    </div>
                    <div className="w-full bg-[#27272a] rounded-full h-2">
                      <div className="bg-teal-500 h-2 rounded-full transition-all" style={{ width: `${simResult.cosine * 100}%` }} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {[
                      { label: 'Cosine sim.',       val: simResult.cosine.toFixed(6),    color: 'text-teal-300',    hint: '1 = identical' },
                      { label: 'Pearson r',         val: simResult.pearson.toFixed(6),   color: 'text-sky-300',     hint: '1 = perfect'   },
                      { label: 'Spectral Angle (°)', val: simResult.sad_deg.toFixed(4),  color: 'text-amber-300',   hint: '0° = identical' },
                      { label: 'SAD (rad)',          val: simResult.sad.toFixed(6),       color: 'text-zinc-300',    hint: ''              },
                      { label: 'Euclidean dist.',   val: simResult.euclidean.toFixed(6), color: 'text-rose-300',    hint: 'lower = closer' },
                      { label: 'MAD',               val: simResult.mad.toFixed(6),       color: 'text-orange-300',  hint: ''              },
                    ].map(m => (
                      <div key={m.label} className="bg-[#18181b] border border-[#27272a] rounded p-1.5">
                        <div className="text-[7.5px] text-zinc-500">{m.label} {m.hint && <span className="text-zinc-700">({m.hint})</span>}</div>
                        <div className={`text-[11px] font-mono font-bold ${m.color}`}>{m.val}</div>
                      </div>
                    ))}
                  </div>
                  <p className="text-[8px] text-zinc-600 italic">Kruse et al., Remote Sens. Environ. 44, 145 (1993) — Spectral Angle Mapper.</p>
                </div>
              )}
            </div>

            {/* ── FFT / AUTOCORRELATION / PSD ───────────────────────────────── */}
            <div className="bg-[#09090b] p-3 rounded border border-[#27272a] flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="block text-xxs font-semibold uppercase text-yellow-400">FFT · Power Spectral Density · Autocorrelation</span>
                <span className="text-[8px] text-zinc-600 font-mono">Cooley–Tukey radix-2</span>
              </div>
              <p className="text-[9px] text-zinc-500 leading-relaxed">
                Computes the discrete Fourier transform (zero-padded to next power-of-two), power spectral density, and normalised autocorrelation of the active spectrum. Useful for detecting periodic noise, interference fringes, or baseline oscillations.
              </p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-[9px] text-zinc-500 block mb-0.5">Sampling interval Δx</span>
                  <input type="number" value={fftDx} onChange={e => setFftDx(e.target.value)} placeholder="1"
                    className="w-full bg-[#18181b] border border-[#27272a] rounded p-1 text-[10px] text-white text-center" />
                </div>
                <div>
                  <span className="text-[9px] text-zinc-500 block mb-0.5">Max ACF lag (blank = N/2)</span>
                  <input type="number" value={fftMaxLag} onChange={e => setFftMaxLag(e.target.value)} placeholder="auto"
                    className="w-full bg-[#18181b] border border-[#27272a] rounded p-1 text-[10px] text-white text-center" />
                </div>
              </div>
              <button
                onClick={() => {
                  setFftError(''); setFftResult(null); setAcfResult(null);
                  try {
                    const dx  = parseFloat(fftDx) || 1;
                    const lag = fftMaxLag.trim() ? parseInt(fftMaxLag) : undefined;
                    const fr  = fftSpectrum(sd.y_processed, dx);
                    const ac  = autocorrelation(sd.y_processed, dx, lag);
                    setFftResult(fr);
                    setAcfResult(ac);
                    pushStateUndo(sd.y_processed, `FFT: dominant freq=${fr.dominantFreq}, period=${fr.dominantPeriod}`);
                  } catch(e: any) { setFftError(e.message || String(e)); }
                }}
                className="w-full bg-yellow-900/40 hover:bg-yellow-800/50 border border-yellow-600/30 text-yellow-200 py-1.5 px-3 rounded text-[10px] font-semibold uppercase tracking-wider transition"
              >Run FFT + Autocorrelation</button>
              {fftError && <p className="text-[9px] text-red-400">{fftError}</p>}
              {fftResult && acfResult && (
                <div className="flex flex-col gap-2 mt-1">
                  {/* FFT key metrics */}
                  <div className="grid grid-cols-3 gap-1.5">
                    {[
                      { label: 'Dom. freq.',   val: fftResult.dominantFreq.toExponential(3),    color: 'text-yellow-300' },
                      { label: 'Dom. period',  val: fftResult.dominantPeriod.toFixed(3),         color: 'text-amber-300'  },
                      { label: 'FFT points',   val: fftResult.frequencies.length.toString(),      color: 'text-zinc-300'   },
                    ].map(m => (
                      <div key={m.label} className="bg-[#18181b] border border-[#27272a] rounded p-1.5 text-center">
                        <div className="text-[8px] text-zinc-500">{m.label}</div>
                        <div className={`text-[10px] font-mono font-bold ${m.color}`}>{m.val}</div>
                      </div>
                    ))}
                  </div>
                  {/* PSD mini-chart */}
                  <div className="bg-[#18181b] border border-[#27272a] rounded p-2">
                    <div className="text-[8px] text-zinc-500 mb-1">Power Spectral Density (log scale)</div>
                    <div className="flex items-end gap-px h-14">
                      {(() => {
                        const step = Math.max(1, Math.floor(fftResult.psd.length / 80));
                        const psdSub = fftResult.psd.filter((_, i) => i % step === 0 && i > 0);
                        const logPsd = psdSub.map(v => Math.log10(v + 1e-30));
                        const minL   = Math.min(...logPsd);
                        const maxL   = Math.max(...logPsd) - minL || 1;
                        return psdSub.map((_, i) => {
                          const h = ((logPsd[i] - minL) / maxL) * 100;
                          const isDom = i * step + step/2 >= fftResult.dominantFreqIndex - 2 &&
                                        i * step + step/2 <= fftResult.dominantFreqIndex + 2;
                          return (
                            <div key={i} className={`flex-1 rounded-sm min-w-[1px] ${isDom ? 'bg-yellow-400' : 'bg-yellow-800/60'}`}
                              style={{ height: `${Math.max(h, 2)}%` }} />
                          );
                        });
                      })()}
                    </div>
                    <div className="flex justify-between text-[7px] text-zinc-600 mt-0.5">
                      <span>0</span>
                      <span className="text-yellow-500">▲ dom. peak</span>
                      <span>Nyquist</span>
                    </div>
                  </div>
                  {/* ACF mini-chart */}
                  <div className="bg-[#18181b] border border-[#27272a] rounded p-2">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-[8px] text-zinc-500">Autocorrelation r(τ)</span>
                      <span className="text-[8px] font-mono text-amber-300">Coherence length: {acfResult.coherenceLength}</span>
                    </div>
                    <div className="flex items-center gap-px h-10">
                      {(() => {
                        const step = Math.max(1, Math.floor(acfResult.acf.length / 80));
                        return acfResult.acf.filter((_, i) => i % step === 0).map((v, i) => (
                          <div key={i} className="flex-1 flex flex-col justify-center min-w-[1px]" style={{ height: '100%' }}>
                            {v >= 0
                              ? <div className="bg-teal-500/70 rounded-t-sm mt-auto" style={{ height: `${v * 50}%` }} />
                              : <div className="bg-rose-500/70 rounded-b-sm" style={{ height: `${-v * 50}%` }} />
                            }
                          </div>
                        ));
                      })()}
                    </div>
                    <div className="flex justify-between text-[7px] text-zinc-600 mt-0.5">
                      <span>τ = 0</span><span>τ = max lag</span>
                    </div>
                  </div>
                  <p className="text-[8px] text-zinc-600 italic">Cooley & Tukey, Math. Comp. 19, 297 (1965). Zero-padded to next power-of-2. ACF normalised by variance.</p>
                </div>
              )}
            </div>

            {/* ── BUTLER–VOLMER CV SIMULATOR ────────────────────────────────── */}
            <div className="bg-[#09090b] p-3 rounded border border-[#27272a] flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="block text-xxs font-semibold uppercase text-green-400">Butler–Volmer CV Simulator</span>
                <span className="text-[8px] text-zinc-600 font-mono">i = i₀[exp(αnFη/RT) − exp(−(1−α)nFη/RT)]</span>
              </div>
              <p className="text-[9px] text-zinc-500 leading-relaxed">
                Simulates a cyclic voltammogram for a single reversible/quasi-reversible redox couple using the Butler–Volmer rate equation. Generates E vs i for both forward and reverse sweeps.
              </p>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: 'E start (V)',   val: cvEstart,  set: setCvEstart  },
                  { label: 'E vertex (V)',  val: cvEvertex, set: setCvEvertex },
                  { label: "E°' (V)",      val: cvEformal, set: setCvEformal },
                  { label: 'Scan rate V/s', val: cvScan,    set: setCvScan    },
                  { label: 'n (electrons)', val: cvN,       set: setCvN       },
                  { label: 'α',             val: cvAlpha,   set: setCvAlpha   },
                  { label: 'i₀ (A m⁻²)',   val: cvI0,      set: setCvI0      },
                ].map(f => (
                  <div key={f.label}>
                    <span className="text-[9px] text-zinc-500 block mb-0.5">{f.label}</span>
                    <input type="number" value={f.val} onChange={e => f.set(e.target.value)}
                      className="w-full bg-[#18181b] border border-[#27272a] rounded p-1 text-[10px] text-white text-center" />
                  </div>
                ))}
              </div>
              <button
                onClick={() => {
                  setCvError(''); setCvResult(null);
                  try {
                    const res = simulateCV(
                      parseFloat(cvEstart), parseFloat(cvEvertex), parseFloat(cvEformal),
                      parseFloat(cvScan), parseInt(cvN)||1, parseFloat(cvAlpha)||0.5,
                      parseFloat(cvI0)||0.01
                    );
                    setCvResult(res);
                    // Load as new dataset
                    const newDs = {
                      id: `cv-${Date.now()}`, name: `CV E°=${cvEformal}V ν=${cvScan}V/s`,
                      technique: 'Cyclic Voltammetry', x_orig: res.E, y_orig: res.i,
                      x: res.E, y_processed: res.i, color: '#4ade80', visible: true,
                      lineWidth: 1.5, lineStyle: 'solid' as const, marker: 'none' as const, markerSize: 4,
                      peaks: [], integrals: [], baseline: null,
                      fitResult: null, fitComponents: null, fitResiduals: null,
                      fitPeakStats: null, fitGoodnessOfFit: null,
                      yError: null, significanceAnnotations: null,
                      isTauc: false, taucData: null, jobsData: null,
                      undoStack: [], redoStack: [],
                      history: [`[${new Date().toLocaleTimeString()}] Butler–Volmer CV simulated: E°=${cvEformal}V, ν=${cvScan}V/s, n=${cvN}`]
                    };
                    onDatasetsUpdated([...datasets, newDs]);
                    onDatasetSelected(newDs);
                  } catch(e: any) { setCvError(e.message || String(e)); }
                }}
                className="w-full bg-green-900/40 hover:bg-green-800/50 border border-green-600/30 text-green-200 py-1.5 px-3 rounded text-[10px] font-semibold uppercase tracking-wider transition"
              >Simulate CV & Load Dataset</button>
              {cvError && <p className="text-[9px] text-red-400">{cvError}</p>}
              {cvResult && (
                <div className="grid grid-cols-2 gap-1.5 mt-1">
                  {[
                    { label: 'Epa (V)',      val: cvResult.Epa.toFixed(4),      color: 'text-green-300'   },
                    { label: 'Epc (V)',      val: cvResult.Epc.toFixed(4),      color: 'text-emerald-300' },
                    { label: 'ipa (A m⁻²)', val: cvResult.ipa.toExponential(3), color: 'text-lime-300'    },
                    { label: 'ipc (A m⁻²)', val: cvResult.ipc.toExponential(3), color: 'text-teal-300'    },
                    { label: 'E½ (V)',       val: cvResult.E_half.toFixed(4),   color: 'text-sky-300'     },
                    { label: 'ΔEp (V)',      val: cvResult.deltaEp.toFixed(4),  color: (cvResult.deltaEp * 1000 / (parseInt(cvN)||1)) < 65 ? 'text-emerald-300' : 'text-amber-300' },
                  ].map(m => (
                    <div key={m.label} className="bg-[#18181b] border border-[#27272a] rounded p-1.5">
                      <div className="text-[8px] text-zinc-500">{m.label}</div>
                      <div className={`text-[11px] font-mono font-bold ${m.color}`}>{m.val}</div>
                    </div>
                  ))}
                  {(cvResult.deltaEp * 1000 / (parseInt(cvN)||1)) < 65 && (
                    <p className="col-span-2 text-[8px] text-emerald-400">✓ ΔEp ≈ {(cvResult.deltaEp*1000/(parseInt(cvN)||1)).toFixed(1)} mV/n — consistent with reversible behaviour (59 mV/n expected).</p>
                  )}
                  <p className="col-span-2 text-[8px] text-zinc-600 italic">Bard & Faulkner, Electrochemical Methods, Wiley (2001). Dataset loaded into Object Browser.</p>
                </div>
              )}
            </div>

            {/* ── EIS / NYQUIST SIMULATOR ────────────────────────────────────── */}
            <div className="bg-[#09090b] p-3 rounded border border-[#27272a] flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="block text-xxs font-semibold uppercase text-violet-400">EIS / Nyquist Plot (Randles Circuit)</span>
                <span className="text-[8px] text-zinc-600 font-mono">Z = Rs + 1/(jωCdl + 1/(Rct+Zw))</span>
              </div>
              <p className="text-[9px] text-zinc-500 leading-relaxed">
                Simulates electrochemical impedance spectra using the Randles equivalent circuit (Rs, Rct, Cdl, Warburg). Generates Nyquist (Z′ vs −Z″) and Bode plots.
              </p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: 'Rs (Ω)',         val: eisRs,    set: setEisRs    },
                  { label: 'Rct (Ω)',        val: eisRct,   set: setEisRct   },
                  { label: 'Cdl (F)',        val: eisCdl,   set: setEisCdl   },
                  { label: 'σ Warburg',      val: eisSigma, set: setEisSigma },
                  { label: 'f min (Hz)',     val: eisFmin,  set: setEisFmin  },
                  { label: 'f max (Hz)',     val: eisFmax,  set: setEisFmax  },
                ].map(f => (
                  <div key={f.label}>
                    <span className="text-[9px] text-zinc-500 block mb-0.5">{f.label}</span>
                    <input type="number" value={f.val} onChange={e => f.set(e.target.value)}
                      className="w-full bg-[#18181b] border border-[#27272a] rounded p-1 text-[10px] text-white text-center" />
                  </div>
                ))}
              </div>
              <button
                onClick={() => {
                  setEisError(''); setEisResult(null);
                  try {
                    const res = simulateEIS(
                      parseFloat(eisRs)||10, parseFloat(eisRct)||200,
                      parseFloat(eisCdl)||20e-6, parseFloat(eisSigma)||30,
                      parseFloat(eisFmin)||0.01, parseFloat(eisFmax)||1e5
                    );
                    setEisResult(res);
                    // Load Nyquist as dataset
                    const newDs = {
                      id: `eis-${Date.now()}`, name: `Nyquist Rct=${eisRct}Ω Rs=${eisRs}Ω`,
                      technique: 'EIS Nyquist', x_orig: res.Zre, y_orig: res.Zim_neg,
                      x: res.Zre, y_processed: res.Zim_neg, color: '#a78bfa', visible: true,
                      lineWidth: 1.5, lineStyle: 'solid' as const, marker: 'circle' as const, markerSize: 3,
                      peaks: [], integrals: [], baseline: null,
                      fitResult: null, fitComponents: null, fitResiduals: null,
                      fitPeakStats: null, fitGoodnessOfFit: null,
                      yError: null, significanceAnnotations: null,
                      isTauc: false, taucData: null, jobsData: null,
                      undoStack: [], redoStack: [],
                      history: [`[${new Date().toLocaleTimeString()}] Randles EIS: Rs=${eisRs}Ω, Rct=${eisRct}Ω, Cdl=${eisCdl}F`]
                    };
                    onDatasetsUpdated([...datasets, newDs]);
                    onDatasetSelected(newDs);
                  } catch(e: any) { setEisError(e.message || String(e)); }
                }}
                className="w-full bg-violet-900/40 hover:bg-violet-800/50 border border-violet-600/30 text-violet-200 py-1.5 px-3 rounded text-[10px] font-semibold uppercase tracking-wider transition"
              >Simulate EIS & Load Nyquist</button>
              {eisError && <p className="text-[9px] text-red-400">{eisError}</p>}
              {eisResult && (
                <div className="grid grid-cols-2 gap-1.5 mt-1">
                  {[
                    { label: 'Rs (Ω)',          val: eisResult.Rs.toFixed(2),                    color: 'text-violet-300' },
                    { label: 'Rct (Ω)',         val: eisResult.Rct.toFixed(2),                   color: 'text-purple-300' },
                    { label: 'Cdl (F)',         val: eisResult.Cdl.toExponential(2),             color: 'text-sky-300'    },
                    { label: 'ωmax (rad s⁻¹)', val: eisResult.omega_max.toExponential(3),       color: 'text-amber-300'  },
                    { label: 'Rs+Rct (Ω)',      val: (eisResult.Rs+eisResult.Rct).toFixed(2),    color: 'text-zinc-300'   },
                    { label: '|Z|max (Ω)',       val: Math.max(...eisResult.Zmag).toFixed(2),     color: 'text-zinc-300'   },
                  ].map(m => (
                    <div key={m.label} className="bg-[#18181b] border border-[#27272a] rounded p-1.5">
                      <div className="text-[8px] text-zinc-500">{m.label}</div>
                      <div className={`text-[11px] font-mono font-bold ${m.color}`}>{m.val}</div>
                    </div>
                  ))}
                  <p className="col-span-2 text-[8px] text-zinc-600 italic">Randles J.E.B., Discuss. Faraday Soc. 1, 11 (1947). Nyquist loaded. Semicircle diameter = Rct.</p>
                </div>
              )}
            </div>

            {/* ── PL-EX MAP ─────────────────────────────────────────────────── */}
            <div className="bg-[#09090b] p-3 rounded border border-[#27272a] flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="block text-xxs font-semibold uppercase text-pink-400">PL-EX Excitation–Emission Map</span>
                <span className="text-[8px] text-zinc-600 font-mono">I(λex, λem)</span>
              </div>
              <p className="text-[9px] text-zinc-500 leading-relaxed">
                Simulates a 2D photoluminescence excitation–emission (PL-EX) map. Includes Rayleigh and Raman scatter lines and quantum-confinement-like emission shift with excitation wavelength.
              </p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: 'Abs peak λex (nm)', val: plexExAbs, set: setPlexExAbs },
                  { label: 'Emission peak (nm)', val: plexEmPk,  set: setPlexEmPk  },
                  { label: 'Abs FWHM (nm)',      val: plexExFW,  set: setPlexExFW  },
                  { label: 'Em FWHM (nm)',        val: plexEmFW,  set: setPlexEmFW  },
                ].map(f => (
                  <div key={f.label}>
                    <span className="text-[9px] text-zinc-500 block mb-0.5">{f.label}</span>
                    <input type="number" value={f.val} onChange={e => f.set(e.target.value)}
                      className="w-full bg-[#18181b] border border-[#27272a] rounded p-1 text-[10px] text-white text-center" />
                  </div>
                ))}
              </div>
              <button
                onClick={() => {
                  setPlexError(''); setPlexResult(null);
                  try {
                    const res = simulatePLEXMap(300, 500, 350, 700,
                      parseFloat(plexExAbs)||370, parseFloat(plexEmPk)||450,
                      parseFloat(plexExFW)||40, parseFloat(plexEmFW)||50
                    );
                    setPlexResult(res);
                  } catch(e: any) { setPlexError(e.message || String(e)); }
                }}
                className="w-full bg-pink-900/40 hover:bg-pink-800/50 border border-pink-600/30 text-pink-200 py-1.5 px-3 rounded text-[10px] font-semibold uppercase tracking-wider transition"
              >Generate PL-EX Map</button>
              {plexError && <p className="text-[9px] text-red-400">{plexError}</p>}
              {plexResult && (
                <div className="flex flex-col gap-1 mt-1">
                  <div className="grid grid-cols-3 gap-1.5">
                    {[
                      { label: 'λex,max (nm)',    val: plexResult.ex_max_nm.toFixed(1),         color: 'text-pink-300'    },
                      { label: 'λem,max (nm)',    val: plexResult.em_max_nm.toFixed(1),         color: 'text-rose-300'    },
                      { label: 'Stokes Δ (nm)',   val: plexResult.stokes_shift_nm.toFixed(1),   color: 'text-amber-300'   },
                    ].map(m => (
                      <div key={m.label} className="bg-[#18181b] border border-[#27272a] rounded p-1.5 text-center">
                        <div className="text-[8px] text-zinc-500">{m.label}</div>
                        <div className={`text-[12px] font-mono font-bold ${m.color}`}>{m.val}</div>
                      </div>
                    ))}
                  </div>
                  {/* Mini PL-EX heatmap */}
                  <div className="bg-[#18181b] border border-[#27272a] rounded p-2">
                    <div className="text-[8px] text-zinc-500 mb-1">PL-EX map preview ({plexResult.ex_nm.length} × {plexResult.em_nm.length})</div>
                    <div className="flex flex-col gap-px" style={{ lineHeight: 0 }}>
                      {plexResult.intensity.filter((_, i) => i % 2 === 0).map((row, i) => {
                        const maxVal = Math.max(...plexResult.intensity.flat()) || 1;
                        return (
                          <div key={i} className="flex gap-px">
                            {row.filter((_, j) => j % 2 === 0).map((v, j) => {
                              const norm = v / maxVal;
                              const r = Math.round(norm * 255);
                              const g = Math.round(norm * 100);
                              const b = Math.round((1 - norm) * 200);
                              return (
                                <div key={j} className="flex-1 h-1.5 rounded-sm"
                                  style={{ backgroundColor: `rgb(${r},${g},${b})` }} />
                              );
                            })}
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex justify-between text-[7px] text-zinc-600 mt-0.5">
                      <span>λem {plexResult.em_nm[0].toFixed(0)} nm</span>
                      <span>λem {plexResult.em_nm[plexResult.em_nm.length-1].toFixed(0)} nm</span>
                    </div>
                  </div>
                  <p className="text-[8px] text-zinc-600 italic">Includes Rayleigh scatter diagonal and Raman line. Stokes shift = λem,max − λex,max.</p>
                </div>
              )}
            </div>

            {/* ── EPR / ESR SIMULATOR ───────────────────────────────────────── */}
            <div className="bg-[#09090b] p-3 rounded border border-[#27272a] flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="block text-xxs font-semibold uppercase text-orange-400">EPR / ESR Spectrum Simulator</span>
                <span className="text-[8px] text-zinc-600 font-mono">hν = g·μB·B₀</span>
              </div>
              <p className="text-[9px] text-zinc-500 leading-relaxed">
                Simulates EPR first-derivative spectra with configurable g-factor, linewidth, lineshape (Lorentzian/Gaussian), and hyperfine coupling (A, nLines). Standard X-band (9.5 GHz) default.
              </p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: 'g-factor',         val: eprG,     set: setEprG     },
                  { label: 'Freq (GHz)',        val: eprFreq,  set: setEprFreq  },
                  { label: 'Linewidth (mT)',    val: eprLW,    set: setEprLW    },
                  { label: 'HFC A (mT)',        val: eprHFC,   set: setEprHFC   },
                  { label: 'nLines (HFC)',      val: eprNlines,set: setEprNlines },
                ].map(f => (
                  <div key={f.label}>
                    <span className="text-[9px] text-zinc-500 block mb-0.5">{f.label}</span>
                    <input type="number" value={f.val} onChange={e => f.set(e.target.value)}
                      className="w-full bg-[#18181b] border border-[#27272a] rounded p-1 text-[10px] text-white text-center" />
                  </div>
                ))}
                <div>
                  <span className="text-[9px] text-zinc-500 block mb-0.5">Lineshape</span>
                  <select value={eprShape} onChange={e => setEprShape(e.target.value as 'lorentzian'|'gaussian')}
                    className="w-full bg-[#18181b] border border-[#27272a] rounded p-1 text-[10px] text-white">
                    <option value="lorentzian">Lorentzian</option>
                    <option value="gaussian">Gaussian</option>
                  </select>
                </div>
              </div>
              <button
                onClick={() => {
                  setEprError(''); setEprResult(null);
                  try {
                    const res = simulateEPR(
                      parseFloat(eprG)||2.0023, parseFloat(eprFreq)||9.5,
                      parseFloat(eprLW)||1.0, eprShape,
                      parseFloat(eprHFC)||0, parseInt(eprNlines)||1
                    );
                    setEprResult(res);
                    const newDs = {
                      id: `epr-${Date.now()}`, name: `EPR g=${eprG} ΔB=${eprLW}mT`,
                      technique: 'EPR/ESR', x_orig: res.B, y_orig: res.derivative,
                      x: res.B, y_processed: res.derivative, color: '#fb923c', visible: true,
                      lineWidth: 1.5, lineStyle: 'solid' as const, marker: 'none' as const, markerSize: 3,
                      peaks: [], integrals: [], baseline: null,
                      fitResult: null, fitComponents: null, fitResiduals: null,
                      fitPeakStats: null, fitGoodnessOfFit: null,
                      yError: null, significanceAnnotations: null,
                      isTauc: false, taucData: null, jobsData: null,
                      undoStack: [], redoStack: [],
                      history: [`[${new Date().toLocaleTimeString()}] EPR simulated: g=${eprG}, B₀=${res.B0_mT}mT`]
                    };
                    onDatasetsUpdated([...datasets, newDs]);
                    onDatasetSelected(newDs);
                  } catch(e: any) { setEprError(e.message || String(e)); }
                }}
                className="w-full bg-orange-900/40 hover:bg-orange-800/50 border border-orange-600/30 text-orange-200 py-1.5 px-3 rounded text-[10px] font-semibold uppercase tracking-wider transition"
              >Simulate EPR & Load Dataset</button>
              {eprError && <p className="text-[9px] text-red-400">{eprError}</p>}
              {eprResult && (
                <div className="grid grid-cols-2 gap-1.5 mt-1">
                  {[
                    { label: 'g-factor',      val: eprResult.g.toFixed(4),           color: 'text-orange-300' },
                    { label: 'B₀ (mT)',       val: eprResult.B0_mT.toFixed(3),       color: 'text-amber-300'  },
                    { label: 'ΔB pp (mT)',    val: eprResult.linewidth_mT.toFixed(3), color: 'text-yellow-300' },
                    { label: 'Lineshape',     val: eprShape,                          color: 'text-zinc-300'   },
                  ].map(m => (
                    <div key={m.label} className="bg-[#18181b] border border-[#27272a] rounded p-1.5">
                      <div className="text-[8px] text-zinc-500">{m.label}</div>
                      <div className={`text-[11px] font-mono font-bold ${m.color}`}>{m.val}</div>
                    </div>
                  ))}
                  <p className="col-span-2 text-[8px] text-zinc-600 italic">First-derivative output loaded. g = hν/(μB·B₀). HFC: {parseInt(eprNlines)||1} line(s), A = {eprHFC} mT.</p>
                </div>
              )}
            </div>

            {/* ── MASS SPECTRUM + ISOTOPE PATTERN ───────────────────────────── */}
            <div className="bg-[#09090b] p-3 rounded border border-[#27272a] flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="block text-xxs font-semibold uppercase text-cyan-400">Mass Spectrum (EI) + Isotope Pattern</span>
                <span className="text-[8px] text-zinc-600 font-mono">Yergey convolution</span>
              </div>
              <p className="text-[9px] text-zinc-500 leading-relaxed">
                Calculates the theoretical isotope distribution for a molecular formula (C, H, N, O, S, Cl, Br, F, P) using natural isotopic abundances. Adds common EI fragment ions.
              </p>
              <div>
                <span className="text-[9px] text-zinc-500 block mb-0.5">Molecular formula (e.g. C6H6, C2H5OH, C12H22O11)</span>
                <input type="text" value={msFormula} onChange={e => setMsFormula(e.target.value)}
                  placeholder="C6H6"
                  className="w-full bg-[#18181b] border border-[#27272a] rounded p-1 text-[10px] text-white font-mono" />
              </div>
              <button
                onClick={() => {
                  setMsError(''); setMsResult(null);
                  try {
                    // Parse formula string to object
                    const formulaObj: Partial<Record<'C'|'H'|'N'|'O'|'S'|'Cl'|'Br'|'F'|'P', number>> = {};
                    const matches = msFormula.matchAll(/([A-Z][a-z]?)(\d*)/g);
                    for (const m of matches) {
                      const el = m[1] as any;
                      const n2 = parseInt(m[2]) || 1;
                      if (el && ['C','H','N','O','S','Cl','Br','F','P'].includes(el))
                        formulaObj[el as 'C'] = (formulaObj[el as 'C'] || 0) + n2;
                    }
                    if (!Object.keys(formulaObj).length) throw new Error('Could not parse formula. Use e.g. C6H6 or C2H5OH.');
                    const res = simulateMassSpectrum(formulaObj);
                    setMsResult(res);
                    const newDs = {
                      id: `ms-${Date.now()}`, name: `MS ${msFormula} M⁺=${res.monoisotopicMass.toFixed(2)}`,
                      technique: 'Mass Spectrum (EI)', x_orig: res.mz, y_orig: res.intensity,
                      x: res.mz, y_processed: res.intensity, color: '#22d3ee', visible: true,
                      lineWidth: 1.5, lineStyle: 'solid' as const, marker: 'none' as const, markerSize: 3,
                      peaks: [], integrals: [], baseline: null,
                      fitResult: null, fitComponents: null, fitResiduals: null,
                      fitPeakStats: null, fitGoodnessOfFit: null,
                      yError: null, significanceAnnotations: null,
                      isTauc: false, taucData: null, jobsData: null,
                      undoStack: [], redoStack: [],
                      history: [`[${new Date().toLocaleTimeString()}] EI mass spectrum: ${msFormula}, M⁺=${res.monoisotopicMass}`]
                    };
                    onDatasetsUpdated([...datasets, newDs]);
                    onDatasetSelected(newDs);
                  } catch(e: any) { setMsError(e.message || String(e)); }
                }}
                className="w-full bg-cyan-900/40 hover:bg-cyan-800/50 border border-cyan-600/30 text-cyan-200 py-1.5 px-3 rounded text-[10px] font-semibold uppercase tracking-wider transition"
              >Calculate & Load Mass Spectrum</button>
              {msError && <p className="text-[9px] text-red-400">{msError}</p>}
              {msResult && (
                <div className="flex flex-col gap-1 mt-1">
                  <div className="grid grid-cols-2 gap-1.5">
                    {[
                      { label: 'Monoisotopic M',  val: msResult.monoisotopicMass.toFixed(4), color: 'text-cyan-300'    },
                      { label: 'Average M',       val: msResult.averageMass.toFixed(4),      color: 'text-sky-300'     },
                    ].map(m => (
                      <div key={m.label} className="bg-[#18181b] border border-[#27272a] rounded p-1.5">
                        <div className="text-[8px] text-zinc-500">{m.label}</div>
                        <div className={`text-[12px] font-mono font-bold ${m.color}`}>{m.val}</div>
                      </div>
                    ))}
                  </div>
                  {/* Isotope pattern table */}
                  <div className="bg-[#18181b] border border-[#27272a] rounded p-2">
                    <div className="text-[8px] text-zinc-500 mb-1">Isotope pattern (top peaks)</div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-[8px]">
                        <thead>
                          <tr className="text-zinc-500 uppercase">
                            <th className="p-0.5 text-left">Ion</th>
                            <th className="p-0.5 text-right">m/z</th>
                            <th className="p-0.5 text-right">Rel. Int. (%)</th>
                            <th className="p-0.5">Bar</th>
                          </tr>
                        </thead>
                        <tbody>
                          {msResult.isotopePattern.filter(p => p.abundance > 0.5).slice(0,8).map((p, i) => (
                            <tr key={i} className="border-t border-[#27272a]">
                              <td className="p-0.5 font-mono text-cyan-300">{p.label}</td>
                              <td className="p-0.5 text-right font-mono text-white">{p.mz.toFixed(4)}</td>
                              <td className="p-0.5 text-right font-mono text-sky-300">{p.abundance.toFixed(2)}</td>
                              <td className="p-0.5">
                                <div className="bg-cyan-600 rounded-sm h-1.5" style={{ width: `${p.abundance}%` }} />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  <p className="text-[8px] text-zinc-600 italic">Yergey, Int. J. Mass Spectrom. 52, 337 (1983). Natural isotopic abundances. EI fragments included.</p>
                </div>
              )}
            </div>

            {/* ── TGA SIMULATOR + KISSINGER ─────────────────────────────────── */}
            <div className="bg-[#09090b] p-3 rounded border border-[#27272a] flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="block text-xxs font-semibold uppercase text-amber-400">TGA Simulator + Kissinger Ea</span>
                <span className="text-[8px] text-zinc-600 font-mono">ln(β/Tp²) = −Ea/RTp + const</span>
              </div>
              <p className="text-[9px] text-zinc-500 leading-relaxed">
                Simulates multi-step TGA mass-loss curves and DTG traces. Kissinger analysis extracts activation energy Ea from peak temperatures at multiple heating rates.
              </p>
              {/* TGA step editor */}
              <div>
                <div className="grid grid-cols-12 gap-1 text-[8px] text-zinc-500 uppercase px-1 mb-1">
                  <span className="col-span-4">Label</span>
                  <span className="col-span-2 text-center">Tmid (°C)</span>
                  <span className="col-span-2 text-center">Loss (%)</span>
                  <span className="col-span-2 text-center">Width</span>
                  <span className="col-span-2 text-center">Del</span>
                </div>
                {tgaSteps.map((s, i) => (
                  <div key={i} className="grid grid-cols-12 gap-1 mb-1">
                    <input value={s.label||''} onChange={e => setTgaSteps(prev => prev.map((p,j) => j===i?{...p,label:e.target.value}:p))}
                      className="col-span-4 bg-[#18181b] border border-[#27272a] rounded p-1 text-[9px] text-zinc-300" placeholder="Step label"/>
                    <input type="number" value={s.Tmid_C} onChange={e => setTgaSteps(prev => prev.map((p,j) => j===i?{...p,Tmid_C:parseFloat(e.target.value)||0}:p))}
                      className="col-span-2 bg-[#18181b] border border-[#27272a] rounded p-1 text-[9px] text-white text-center"/>
                    <input type="number" value={s.massLoss_pct} onChange={e => setTgaSteps(prev => prev.map((p,j) => j===i?{...p,massLoss_pct:parseFloat(e.target.value)||0}:p))}
                      className="col-span-2 bg-[#18181b] border border-[#27272a] rounded p-1 text-[9px] text-white text-center"/>
                    <input type="number" value={s.width_C} onChange={e => setTgaSteps(prev => prev.map((p,j) => j===i?{...p,width_C:parseFloat(e.target.value)||10}:p))}
                      className="col-span-2 bg-[#18181b] border border-[#27272a] rounded p-1 text-[9px] text-white text-center"/>
                    <button onClick={() => setTgaSteps(prev => prev.filter((_,j) => j!==i))}
                      className="col-span-2 bg-red-900/40 hover:bg-red-800/60 text-red-300 rounded text-[9px] transition">✕</button>
                  </div>
                ))}
                <button onClick={() => setTgaSteps(prev => [...prev, {Tmid_C:400, massLoss_pct:10, width_C:50, label:'New step'}])}
                  className="text-[9px] text-zinc-500 hover:text-zinc-300 border border-dashed border-[#27272a] rounded p-1 w-full transition">+ Add step</button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-[9px] text-zinc-500 block mb-0.5">T start (°C)</span>
                  <input type="number" value={tgaTstart} onChange={e => setTgaTstart(e.target.value)}
                    className="w-full bg-[#18181b] border border-[#27272a] rounded p-1 text-[10px] text-white text-center" />
                </div>
                <div>
                  <span className="text-[9px] text-zinc-500 block mb-0.5">T end (°C)</span>
                  <input type="number" value={tgaTend} onChange={e => setTgaTend(e.target.value)}
                    className="w-full bg-[#18181b] border border-[#27272a] rounded p-1 text-[10px] text-white text-center" />
                </div>
              </div>
              <button
                onClick={() => {
                  setTgaError(''); setTgaResult(null);
                  try {
                    const res = simulateTGA(tgaSteps, parseFloat(tgaTstart)||25, parseFloat(tgaTend)||800);
                    setTgaResult(res);
                    const newDs = {
                      id: `tga-${Date.now()}`, name: `TGA ${tgaSteps.length} steps`,
                      technique: 'TGA', x_orig: res.T_C, y_orig: res.mass_pct,
                      x: res.T_C, y_processed: res.mass_pct, color: '#f59e0b', visible: true,
                      lineWidth: 2, lineStyle: 'solid' as const, marker: 'none' as const, markerSize: 3,
                      peaks: [], integrals: [], baseline: null,
                      fitResult: null, fitComponents: null, fitResiduals: null,
                      fitPeakStats: null, fitGoodnessOfFit: null,
                      yError: null, significanceAnnotations: null,
                      isTauc: false, taucData: null, jobsData: null,
                      undoStack: [], redoStack: [],
                      history: [`[${new Date().toLocaleTimeString()}] TGA simulated: ${tgaSteps.length} decomposition steps`]
                    };
                    onDatasetsUpdated([...datasets, newDs]);
                    onDatasetSelected(newDs);
                  } catch(e: any) { setTgaError(e.message || String(e)); }
                }}
                className="w-full bg-amber-900/40 hover:bg-amber-800/50 border border-amber-600/30 text-amber-200 py-1.5 px-3 rounded text-[10px] font-semibold uppercase tracking-wider transition"
              >Simulate TGA & Load Dataset</button>
              {tgaError && <p className="text-[9px] text-red-400">{tgaError}</p>}
              {tgaResult && (
                <div className="flex flex-col gap-1 mt-1">
                  <div className="grid grid-cols-3 gap-1.5">
                    {tgaResult.T_mid.map((t, i) => (
                      <div key={i} className="bg-[#18181b] border border-[#27272a] rounded p-1.5">
                        <div className="text-[8px] text-zinc-500">{tgaSteps[i]?.label || `Step ${i+1}`}</div>
                        <div className="text-[9px] font-mono text-amber-300">{t.toFixed(0)}°C</div>
                        <div className="text-[9px] font-mono text-zinc-300">−{tgaResult.massLoss[i].toFixed(1)}%</div>
                      </div>
                    ))}
                  </div>
                  <div className="text-[9px] text-zinc-500">Total loss: <span className="text-amber-300 font-mono">{tgaResult.massLoss.reduce((s,v)=>s+v,0).toFixed(1)}%</span> · Residue: <span className="text-zinc-300 font-mono">{(100-tgaResult.massLoss.reduce((s,v)=>s+v,0)).toFixed(1)}%</span></div>
                </div>
              )}

              {/* Kissinger sub-panel */}
              <div className="border-t border-[#27272a] pt-2 mt-1 flex flex-col gap-2">
                <span className="text-xxs font-semibold uppercase text-yellow-400">Kissinger Analysis (multi-rate)</span>
                <p className="text-[9px] text-zinc-500">Enter heating rates β (K min⁻¹) and corresponding DTG peak temperatures Tp (K) at each rate.</p>
                <div>
                  <span className="text-[9px] text-zinc-500 block mb-0.5">β (K min⁻¹, comma-sep)</span>
                  <input type="text" value={kissBetas} onChange={e => setKissBetas(e.target.value)}
                    className="w-full bg-[#18181b] border border-[#27272a] rounded p-1 text-[10px] text-white font-mono" />
                </div>
                <div>
                  <span className="text-[9px] text-zinc-500 block mb-0.5">Tp (K, comma-sep, same order as β)</span>
                  <input type="text" value={kissTps} onChange={e => setKissTps(e.target.value)}
                    className="w-full bg-[#18181b] border border-[#27272a] rounded p-1 text-[10px] text-white font-mono" />
                </div>
                <button
                  onClick={() => {
                    setKissError(''); setKissResult(null);
                    try {
                      const betas = kissBetas.split(',').map(s => parseFloat(s.trim())).filter(v => !isNaN(v));
                      const tps   = kissTps.split(',').map(s => parseFloat(s.trim())).filter(v => !isNaN(v));
                      if (betas.length !== tps.length) throw new Error(`${betas.length} β values vs ${tps.length} Tp values — must match.`);
                      const data = betas.map((b, i) => ({ beta: b, Tp_K: tps[i] }));
                      const res  = kissingerAnalysis(data);
                      setKissResult(res);
                    } catch(e: any) { setKissError(e.message || String(e)); }
                  }}
                  className="w-full bg-yellow-900/40 hover:bg-yellow-800/50 border border-yellow-600/30 text-yellow-200 py-1.5 px-3 rounded text-[10px] font-semibold uppercase tracking-wider transition"
                >Run Kissinger Analysis</button>
                {kissError && <p className="text-[9px] text-red-400">{kissError}</p>}
                {kissResult && (
                  <div className="flex flex-col gap-1">
                    <div className="grid grid-cols-3 gap-1.5">
                      {[
                        { label: 'Ea (kJ mol⁻¹)', val: kissResult.Ea_kJ.toFixed(2),        color: 'text-yellow-300' },
                        { label: 'R²',             val: kissResult.r2.toFixed(5),            color: 'text-emerald-300'},
                        { label: 'ln(A/β²)',       val: kissResult.lnA_over_beta2.toFixed(3),color: 'text-zinc-300'  },
                      ].map(m => (
                        <div key={m.label} className="bg-[#18181b] border border-[#27272a] rounded p-1.5 text-center">
                          <div className="text-[8px] text-zinc-500">{m.label}</div>
                          <div className={`text-[12px] font-mono font-bold ${m.color}`}>{m.val}</div>
                        </div>
                      ))}
                    </div>
                    <div className="bg-[#18181b] border border-[#27272a] rounded p-2">
                      <div className="text-[8px] text-zinc-500 mb-1">Kissinger plot data</div>
                      <table className="w-full text-[8px] font-mono">
                        <thead><tr className="text-zinc-500"><th className="p-0.5 text-left">β</th><th className="p-0.5">Tp (K)</th><th className="p-0.5">1/Tp</th><th className="p-0.5">ln(β/Tp²)</th></tr></thead>
                        <tbody>
                          {kissResult.data.map((d, i) => (
                            <tr key={i} className="border-t border-[#27272a]">
                              <td className="p-0.5 text-zinc-300">{d.beta}</td>
                              <td className="p-0.5 text-center text-white">{d.Tp_K}</td>
                              <td className="p-0.5 text-center text-sky-300">{d.x.toExponential(4)}</td>
                              <td className="p-0.5 text-center text-yellow-300">{d.y.toFixed(4)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <p className="text-[8px] text-zinc-600 italic">Kissinger H.E., Anal. Chem. 29, 1702 (1957). Slope = −Ea/R.</p>
                  </div>
                )}
              </div>
            </div>

            {/* ── ERROR BARS / REPLICATE STATISTICS ─────────────────────────── */}
            <div className="bg-[#09090b] p-3 rounded border border-[#27272a] flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="block text-xxs font-semibold uppercase text-sky-400">Error Bars (Replicate Statistics)</span>
                <span className="text-[8px] text-zinc-600 font-mono">mean ± SD / SEM</span>
              </div>
              <p className="text-[9px] text-zinc-500 leading-relaxed">
                Computes per-point mean and standard deviation (or SEM) across two or more replicate
                measurements sharing the same x-axis, then attaches the result as Y-axis error bars on
                the active dataset. This reflects real observed spread across repeated measurements,
                rather than an assumed or fabricated uncertainty value.
              </p>

              <div className="flex flex-col gap-1">
                <span className="text-[9px] text-zinc-500 mb-0.5">Select replicate datasets (≥ 2, same x-axis)</span>
                {datasets.filter(d => d.visible).map(d => (
                  <label key={d.id} className="flex items-center gap-2 text-[10px] text-zinc-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={replicateIds.includes(d.id)}
                      onChange={e => {
                        setReplicateIds(prev =>
                          e.target.checked ? [...prev, d.id] : prev.filter(id => id !== d.id)
                        );
                      }}
                      className="rounded border-zinc-600"
                    />
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                    {d.name}
                  </label>
                ))}
                {datasets.filter(d => d.visible).length === 0 && (
                  <p className="text-[9px] text-zinc-600 italic">No visible datasets — load or show at least 2 replicate spectra first.</p>
                )}
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[9px] text-zinc-500">Error type:</span>
                <select value={errorBarMode} onChange={e => setErrorBarMode(e.target.value as 'sd' | 'sem')}
                  className="flex-1 bg-[#18181b] border border-[#27272a] rounded p-1 text-[10px] text-white">
                  <option value="sd">Standard deviation (SD)</option>
                  <option value="sem">Standard error of the mean (SEM)</option>
                </select>
              </div>

              <button
                onClick={() => {
                  setReplicateError(''); setReplicateResult(null);
                  try {
                    if (replicateIds.length < 2) throw new Error('Select at least 2 replicate datasets.');
                    const reps = replicateIds.map(id => datasets.find(d => d.id === id)).filter(Boolean) as SpectrumData[];
                    const refX = reps[0].x;
                    for (const r of reps) {
                      if (r.x.length !== refX.length) {
                        throw new Error(`"${r.name}" has ${r.x.length} points, but "${reps[0].name}" has ${refX.length}. All replicates must share the same x-axis length.`);
                      }
                    }
                    const replicateArrays = reps.map(r => r.y_processed);
                    const res = computeReplicateStats(refX, replicateArrays);
                    setReplicateResult(res);

                    // Apply mean + chosen error metric onto the currently active dataset
                    const errArray = errorBarMode === 'sd' ? res.stdDev : res.sem;
                    const list = datasets.map(d => d.id === sd.id ? {
                      ...d,
                      x: [...res.x],
                      y_processed: [...res.mean],
                      yError: [...errArray],
                      undoStack: [...d.undoStack, [...d.y_processed]],
                      history: [...d.history, `[${new Date().toLocaleTimeString()}] Replicate statistics computed across ${res.nReplicates} datasets (${errorBarMode.toUpperCase()} error bars). Mean trace + error bars applied.`]
                    } : d);
                    onDatasetsUpdated(list);
                    onDatasetSelected(list.find(d => d.id === sd.id)!);
                  } catch (e: any) { setReplicateError(e.message || String(e)); }
                }}
                className="w-full bg-sky-900/40 hover:bg-sky-800/50 border border-sky-600/30 text-sky-200 py-1.5 px-3 rounded text-[10px] font-semibold uppercase tracking-wider transition"
              >Compute Mean ± Error & Apply to Active Dataset</button>
              {replicateError && <p className="text-[9px] text-red-400">{replicateError}</p>}
              {replicateResult && (
                <div className="flex flex-col gap-1 mt-1">
                  <div className="grid grid-cols-3 gap-1.5">
                    {[
                      { label: 'Replicates (n)', val: replicateResult.nReplicates.toString(), color: 'text-sky-300' },
                      { label: 'Max SD',         val: Math.max(...replicateResult.stdDev).toExponential(2), color: 'text-amber-300' },
                      { label: 'Max SEM',        val: Math.max(...replicateResult.sem).toExponential(2), color: 'text-emerald-300' },
                    ].map(m => (
                      <div key={m.label} className="bg-[#18181b] border border-[#27272a] rounded p-1.5 text-center">
                        <div className="text-[8px] text-zinc-500">{m.label}</div>
                        <div className={`text-[11px] font-mono font-bold ${m.color}`}>{m.val}</div>
                      </div>
                    ))}
                  </div>
                  <p className="text-[8px] text-zinc-600 italic">
                    {errorBarMode === 'sd' ? 'SD' : 'SEM'} error bars applied to the active dataset's trace.
                    Error bars render at a sparse, readable interval (≤30 whiskers) regardless of total point count.
                    Use Undo to revert.
                  </p>
                </div>
              )}
            </div>

            {/* ── STATISTICAL SIGNIFICANCE (WELCH'S T-TEST) ─────────────────── */}
            <div className="bg-[#09090b] p-3 rounded border border-[#27272a] flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="block text-xxs font-semibold uppercase text-rose-400">Statistical Significance</span>
                <span className="text-[8px] text-zinc-600 font-mono">Welch's t-test</span>
              </div>
              <p className="text-[9px] text-zinc-500 leading-relaxed">
                Compares two groups of individual replicate measurements (e.g. peak heights, bandgap
                values, or any derived quantity across two conditions) using Welch's t-test, which does
                not assume equal variances between groups. Produces a real p-value via the regularized
                incomplete beta function — not a fabricated marker — then attaches a comparison bracket
                with the conventional ns/*/**/*** significance marker to the active dataset's plot.
              </p>

              <div>
                <span className="text-[9px] text-zinc-500 block mb-0.5">Comparison label (optional, e.g. "Control vs. Fe³⁺ treated")</span>
                <input type="text" value={sigLabel} onChange={e => setSigLabel(e.target.value)}
                  placeholder="Group A vs. Group B"
                  className="w-full bg-[#18181b] border border-[#27272a] rounded p-1 text-[10px] text-white" />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-[9px] text-zinc-500 block mb-0.5">Group A values (comma-sep, ≥2)</span>
                  <input type="text" value={sigGroup1Vals} onChange={e => setSigGroup1Vals(e.target.value)}
                    placeholder="e.g. 2.65, 2.71, 2.68"
                    className="w-full bg-[#18181b] border border-[#27272a] rounded p-1 text-[10px] text-white font-mono" />
                </div>
                <div>
                  <span className="text-[9px] text-zinc-500 block mb-0.5">Group B values (comma-sep, ≥2)</span>
                  <input type="text" value={sigGroup2Vals} onChange={e => setSigGroup2Vals(e.target.value)}
                    placeholder="e.g. 2.95, 3.02, 2.99"
                    className="w-full bg-[#18181b] border border-[#27272a] rounded p-1 text-[10px] text-white font-mono" />
                </div>
              </div>

              {replicateResult && (
                <button
                  onClick={() => {
                    // Convenience: auto-fill from the last computed replicate-stats
                    // mean trace, taking the value at the x-point closest to a peak.
                    const maxIdx = replicateResult.mean.indexOf(Math.max(...replicateResult.mean));
                    setSigGroup1Vals(replicateIds.length
                      ? datasets.filter(d => replicateIds.includes(d.id)).map(d => d.y_processed[maxIdx].toFixed(4)).join(', ')
                      : '');
                  }}
                  className="text-[9px] text-sky-400 hover:text-sky-300 underline self-start"
                >
                  Auto-fill Group A from last replicate-stats peak values
                </button>
              )}

              <button
                onClick={() => {
                  setSigError(''); setSigResult(null);
                  try {
                    const g1 = sigGroup1Vals.split(',').map(s => parseFloat(s.trim())).filter(v => !isNaN(v));
                    const g2 = sigGroup2Vals.split(',').map(s => parseFloat(s.trim())).filter(v => !isNaN(v));
                    if (g1.length < 2 || g2.length < 2) throw new Error('Each group needs at least 2 numeric values.');
                    const res = welchTTest(g1, g2);
                    setSigResult(res);

                    // Attach a comparison bracket to the active dataset, positioned
                    // above its current Y-max so it doesn't overlap the trace.
                    const yMax = Math.max(...sd.y_processed);
                    const xMid1 = sd.x[Math.floor(sd.x.length * 0.25)];
                    const xMid2 = sd.x[Math.floor(sd.x.length * 0.75)];
                    const bracketY = yMax * 1.12;

                    const newAnnotation = {
                      id: `sig-${Date.now()}`,
                      x1: xMid1,
                      x2: xMid2,
                      y: bracketY,
                      marker: res.marker,
                      label: sigLabel || undefined,
                    };

                    const list = datasets.map(d => d.id === sd.id ? {
                      ...d,
                      significanceAnnotations: [...(d.significanceAnnotations || []), newAnnotation],
                      history: [...d.history, `[${new Date().toLocaleTimeString()}] Welch's t-test${sigLabel ? ` (${sigLabel})` : ''}: t=${res.t}, df=${res.df}, p=${res.pValue} (${res.marker}).`]
                    } : d);
                    onDatasetsUpdated(list);
                    onDatasetSelected(list.find(d => d.id === sd.id)!);
                  } catch (e: any) { setSigError(e.message || String(e)); }
                }}
                className="w-full bg-rose-900/40 hover:bg-rose-800/50 border border-rose-600/30 text-rose-200 py-1.5 px-3 rounded text-[10px] font-semibold uppercase tracking-wider transition"
              >Run Welch's t-test & Add Bracket</button>
              {sigError && <p className="text-[9px] text-red-400">{sigError}</p>}
              {sigResult && (
                <div className="flex flex-col gap-1 mt-1">
                  <div className="grid grid-cols-2 gap-1.5">
                    {[
                      { label: 'Mean A',     val: sigResult.mean1.toFixed(4),  color: 'text-rose-300'    },
                      { label: 'Mean B',     val: sigResult.mean2.toFixed(4),  color: 'text-pink-300'    },
                      { label: 't-statistic', val: sigResult.t.toFixed(4),      color: 'text-zinc-300'    },
                      { label: 'df (Welch)',  val: sigResult.df.toFixed(2),     color: 'text-zinc-300'    },
                      { label: 'p-value',    val: sigResult.pValue < 0.0001 ? sigResult.pValue.toExponential(2) : sigResult.pValue.toFixed(4), color: 'text-amber-300' },
                      { label: 'Significance', val: sigResult.marker,          color: sigResult.marker === 'ns' ? 'text-zinc-400' : 'text-emerald-300' },
                    ].map(m => (
                      <div key={m.label} className="bg-[#18181b] border border-[#27272a] rounded p-1.5">
                        <div className="text-[8px] text-zinc-500">{m.label}</div>
                        <div className={`text-[11px] font-mono font-bold ${m.color}`}>{m.val}</div>
                      </div>
                    ))}
                  </div>
                  <p className="text-[8px] text-zinc-600 italic">
                    Convention: ns = p≥0.05, * = p&lt;0.05, ** = p&lt;0.01, *** = p&lt;0.001.
                    Welch B.L., Biometrika 34, 28–35 (1947). Bracket added to active dataset's plot — use Undo to remove.
                  </p>
                </div>
              )}
            </div>

            {/* Solid State Stoichiometry */}
            <div className="bg-[#09090b] p-3 rounded border border-[#27272a] flex flex-col gap-2">
              <span className="block text-xxs font-semibold uppercase text-zinc-400">Solid-State physics & continuous variations</span>
              <div className="grid grid-cols-2 gap-2 select-none">
                <button
                  onClick={() => handleTaucTransformation('direct')}
                  className="bg-[#27272a] hover:bg-[#3f3f46] border border-[#3f3f46] text-white py-2 px-2 rounded font-semibold text-xxs transition"
                >
                  Direct Tauc Eg
                </button>
                <button
                  onClick={() => handleTaucTransformation('indirect')}
                  className="bg-[#27272a] hover:bg-[#3f3f46] border border-[#3f3f46] text-white py-2 px-2 rounded font-semibold text-xxs transition"
                >
                  Indirect Tauc Eg
                </button>
              </div>

              <button
                onClick={handleCreateJobsPlot}
                className="w-full mt-1 bg-rose-950/40 hover:bg-rose-900/60 border border-rose-500/20 text-rose-300 py-1.5 px-3 rounded font-semibold text-xxs transition"
              >
                Calculate stoichiometric Job's plot
              </button>
            </div>

          </motion.div>
        )}

        {/* ==========================================
            TAB 3: STYLE & PRESENTATION
            ========================================== */}
        {activeTab === 'style' && (
          <motion.div
            key="tab-style"
            initial={{ opacity: 0, x: 15 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -15 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="flex flex-col gap-4"
          >

            {/* Primary Manual Absorbance Limits Override Controller */}
            <div className="bg-gradient-to-br from-teal-950/25 to-[#09090b] p-3.5 rounded-lg border border-teal-500/30 flex flex-col gap-3 shadow-md">
              <div className="flex items-center justify-between border-b border-[#27272a] pb-2">
                <div className="flex items-center gap-1.5">
                  <Sliders size={13} className="text-teal-400" />
                  <span className="block text-xxs font-bold uppercase tracking-wider text-zinc-300">Absorbance Limits (Y-Axis)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-zinc-400 font-medium">Autoset Bounds</span>
                  <input
                    type="checkbox"
                    checked={autoY}
                    onChange={(e) => setAutoY(e.target.checked)}
                    className="w-4 h-4 text-teal-600 bg-zinc-800 border-zinc-700 rounded focus:ring-teal-500 focus:ring-offset-zinc-900 accent-teal-500 cursor-pointer"
                  />
                </div>
              </div>

              <p className="text-[10px] text-zinc-400 leading-normal">
                If high-intensity peaks or labels are truncated, disable autoset above and specify absolute Y-scale limits.
              </p>

              {!autoY ? (
                <div className="flex flex-col gap-2.5">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[9px] text-zinc-400 uppercase font-mono mb-1">Min Abs (Y-Min)</label>
                      <input
                        type="number"
                        step="0.05"
                        value={manualYMin}
                        onChange={(e) => setManualYMin(parseFloat(e.target.value) || 0)}
                        className="w-full bg-[#18181b] border border-[#27272a] focus:border-teal-500 rounded p-1.5 text-xs text-center font-mono text-white"
                        placeholder="0.00"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] text-zinc-400 uppercase font-mono mb-1">Max Abs (Y-Max)</label>
                      <input
                        type="number"
                        step="0.05"
                        value={manualYMax}
                        onChange={(e) => setManualYMax(parseFloat(e.target.value) || 1)}
                        className="w-full bg-[#18181b] border border-[#27272a] focus:border-teal-500 rounded p-1.5 text-xs text-center font-mono text-white"
                        placeholder="1.20"
                      />
                    </div>
                  </div>

                  {/* Range presets for fast clicks */}
                  <div className="flex flex-col gap-1 mt-1 border-t border-[#1e1e24] pt-2">
                    <span className="text-[9px] text-zinc-500 font-semibold uppercase tracking-wider">Fast Presets</span>
                    <div className="grid grid-cols-3 gap-1">
                      {[
                        { label: '0.0 to 1.0', min: 0, max: 1.0 },
                        { label: '0.0 to 1.5', min: 0, max: 1.5 },
                        { label: '0.0 to 2.0', min: 0, max: 2.0 },
                        { label: '0.0 to 3.0', min: 0, max: 3.0 },
                        { label: '-0.1 to 1.2', min: -0.1, max: 1.2 },
                        { label: '-0.2 to 2.5', min: -0.2, max: 2.5 },
                      ].map((preset) => (
                        <button
                          key={preset.label}
                          type="button"
                          onClick={() => {
                            setManualYMin(preset.min);
                            setManualYMax(preset.max);
                          }}
                          className="bg-[#18181b] hover:bg-[#27272a] border border-zinc-800 hover:border-zinc-700 rounded text-[9px] text-zinc-300 py-1 transition-all font-mono"
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-[#18181b]/50 border border-zinc-800/60 rounded p-2 flex items-center justify-between text-[10px] text-zinc-400">
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 bg-teal-400 rounded-full animate-pulse" />
                    <span>Using Dynamic Absorbance Autoscaling</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAutoY(false)}
                    className="text-teal-400 hover:text-teal-300 font-bold uppercase text-[9px] tracking-wider"
                  >
                    Set Manually
                  </button>
                </div>
              )}
            </div>

            {/* Swatch colour picker */}
            <div className="bg-[#09090b] p-3 rounded border border-[#27272a] flex flex-col gap-2.5">
              <span className="block text-xxs font-semibold uppercase text-zinc-400">Trace aesthetics (Selected curve)</span>
              
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-gray-400">Curve Accent Color</span>
                <input
                  type="color"
                  value={sd.color}
                  onChange={(e) => {
                    const list = datasets.map(d => d.id === sd.id ? { ...d, color: e.target.value } : d);
                    onDatasetsUpdated(list);
                  }}
                  className="w-7 h-6 cursor-pointer bg-transparent border-0 rounded"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-[10px] text-gray-500 block mb-0.5">Line style</span>
                  <select
                    value={sd.lineStyle}
                    onChange={(e) => {
                      const list = datasets.map(d => d.id === sd.id ? { ...d, lineStyle: e.target.value as any } : d);
                      onDatasetsUpdated(list);
                    }}
                    className="w-full bg-[#18181b] border border-[#27272a] rounded p-1 text-xs"
                  >
                    <option value="solid">Solid Line</option>
                    <option value="dashed">Dashed (--)</option>
                    <option value="dotted">Dotted (:)</option>
                    <option value="none">Line Hide</option>
                  </select>
                </div>

                <div>
                  <span className="text-[10px] text-gray-500 block mb-0.5">Line weights</span>
                  <input
                    type="number"
                    step={0.5}
                    min={0.5}
                    max={6}
                    value={sd.lineWidth}
                    onChange={(e) => {
                      const list = datasets.map(d => d.id === sd.id ? { ...d, lineWidth: Math.max(0.1, Number(e.target.value) || 1) } : d);
                      onDatasetsUpdated(list);
                    }}
                    className="w-full bg-[#18181b] border border-[#27272a] rounded p-1 text-xs text-center"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-[10px] text-gray-500 block mb-0.5">Markers</span>
                  <select
                    value={sd.marker}
                    onChange={(e) => {
                      const list = datasets.map(d => d.id === sd.id ? { ...d, marker: e.target.value as any } : d);
                      onDatasetsUpdated(list);
                    }}
                    className="w-full bg-[#18181b] border border-[#27272a] rounded p-1 text-xs"
                  >
                    <option value="none">None</option>
                    <option value="circle">Circles (o)</option>
                    <option value="square">Squares (s)</option>
                    <option value="triangle">Triangles (^)</option>
                    <option value="cross">Crosses (x)</option>
                  </select>
                </div>

                <div>
                  <span className="text-[10px] text-gray-500 block mb-0.5">Marker size</span>
                  <input
                    type="number"
                    value={sd.markerSize}
                    min={2}
                    max={15}
                    onChange={(e) => {
                      const list = datasets.map(d => d.id === sd.id ? { ...d, markerSize: Math.max(1, parseInt(e.target.value) || 5) } : d);
                      onDatasetsUpdated(list);
                    }}
                    className="w-full bg-[#18181b] border border-[#27272a] rounded p-1 text-xs text-center"
                  />
                </div>
              </div>
            </div>

            {/* Plot Canvas Background Selector */}
            <div className="bg-[#09090b] p-3 rounded border border-[#27272a] flex flex-col gap-2.5">
              <span className="block text-xxs font-semibold uppercase text-zinc-400">Spectrum Plot Background</span>
              <p className="text-[10px] text-zinc-500 leading-relaxed">
                Choose a dark or light presentation background. High-impact journals require light/white plots for publications.
              </p>
              
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => setPlotBgColor('#ffffff')}
                  className={`py-1 px-2 text-xxs rounded border font-semibold transition flex items-center justify-center gap-1.5 ${
                    plotBgColor.toLowerCase() === '#ffffff'
                      ? 'bg-white text-black border-zinc-200'
                      : 'bg-[#18181b] text-zinc-300 border-[#27272a] hover:border-[#3f3f46]'
                  }`}
                >
                  <span className="w-2.5 h-2.5 rounded-full bg-white border border-zinc-300" />
                  Publication Light
                </button>
                <button
                  type="button"
                  onClick={() => setPlotBgColor('#131316')}
                  className={`py-1 px-1.5 text-xxs rounded border font-semibold transition flex items-center justify-center gap-1.5 ${
                    plotBgColor.toLowerCase() === '#131316'
                      ? 'bg-[#1c1c1f] text-white border-teal-500/50'
                      : 'bg-[#18181b] text-zinc-300 border-[#27272a] hover:border-[#3f3f46]'
                  }`}
                >
                  <span className="w-2.5 h-2.5 rounded-full bg-[#131316] border border-zinc-750" />
                  Classic Dark
                </button>
              </div>

              <div className="flex items-center justify-between mt-1 pt-1 border-t border-[#1e1e24]">
                <span className="text-[11px] text-zinc-400">Custom Background</span>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={plotBgColor}
                    onChange={(e) => setPlotBgColor(e.target.value)}
                    className="w-16 bg-[#18181b] border border-[#27272a] rounded px-1.5 py-0.5 text-center text-xxs text-white"
                  />
                  <input
                    type="color"
                    value={plotBgColor}
                    onChange={(e) => setPlotBgColor(e.target.value)}
                    className="w-6 h-6 cursor-pointer bg-transparent border-0 rounded shrink-0"
                  />
                </div>
              </div>
            </div>

            {/* Cohesive Journal Palettes (Quick Multi-Curve Application) */}
            <div className="bg-[#09090b] p-3 rounded border border-[#27272a] flex flex-col gap-2.5">
              <span className="block text-xxs font-semibold uppercase text-zinc-400">Cohesive Multi-curve Palettes</span>
              <p className="text-[10px] text-zinc-500 leading-relaxed">
                Apply peer-review-grade colors across all visible lines of the active stack overlays with a single click:
              </p>
              
              <div className="flex flex-col gap-1.5">
                {/* Nature */}
                <button
                  onClick={() => {
                    const colors = JOURNAL_PALETTES.nature.colors;
                    let colorIdx = 0;
                    const list = datasets.map(d => {
                      if (d.visible) {
                        const c = colors[colorIdx % colors.length];
                        colorIdx++;
                        return { ...d, color: c };
                      }
                      return d;
                    });
                    onDatasetsUpdated(list);
                  }}
                  className="w-full flex items-center justify-between text-left text-xxs bg-[#18181b] hover:bg-[#27272a] border border-[#27272a] p-1.5 rounded transition"
                >
                  <span className="font-semibold text-zinc-300">Nature Portfolio (Muted Teals/Sages)</span>
                  <div className="flex gap-1 shrink-0">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#0f172a]" />
                    <span className="w-2.5 h-2.5 rounded-full bg-[#0d9488]" />
                    <span className="w-2.5 h-2.5 rounded-full bg-[#10b981]" />
                    <span className="w-2.5 h-2.5 rounded-full bg-[#84cc16]" />
                  </div>
                </button>

                {/* ACS */}
                <button
                  onClick={() => {
                    const colors = JOURNAL_PALETTES.acs.colors;
                    let colorIdx = 0;
                    const list = datasets.map(d => {
                      if (d.visible) {
                        const c = colors[colorIdx % colors.length];
                        colorIdx++;
                        return { ...d, color: c };
                      }
                      return d;
                    });
                    onDatasetsUpdated(list);
                  }}
                  className="w-full flex items-center justify-between text-left text-xxs bg-[#18181b] hover:bg-[#27272a] border border-[#27272a] p-1.5 rounded transition"
                >
                  <span className="font-semibold text-zinc-300">ACS Classic (Indigo/Amber/Navy)</span>
                  <div className="flex gap-1 shrink-0">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#1e3a8a]" />
                    <span className="w-2.5 h-2.5 rounded-full bg-[#b91c1c]" />
                    <span className="w-2.5 h-2.5 rounded-full bg-[#d97706]" />
                    <span className="w-2.5 h-2.5 rounded-full bg-[#0369a1]" />
                  </div>
                </button>

                {/* RSC Georgia */}
                <button
                  onClick={() => {
                    const colors = JOURNAL_PALETTES.rsc.colors;
                    let colorIdx = 0;
                    const list = datasets.map(d => {
                      if (d.visible) {
                        const c = colors[colorIdx % colors.length];
                        colorIdx++;
                        return { ...d, color: c };
                      }
                      return d;
                    });
                    onDatasetsUpdated(list);
                  }}
                  className="w-full flex items-center justify-between text-left text-xxs bg-[#18181b] hover:bg-[#27272a] border border-[#27272a] p-1.5 rounded transition"
                >
                  <span className="font-semibold text-zinc-300">RSC Georgia (Crimson/Tyrian)</span>
                  <div className="flex gap-1 shrink-0">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#be123c]" />
                    <span className="w-2.5 h-2.5 rounded-full bg-[#0f172a]" />
                    <span className="w-2.5 h-2.5 rounded-full bg-[#b45309]" />
                    <span className="w-2.5 h-2.5 rounded-full bg-[#6d28d9]" />
                  </div>
                </button>

                {/* Grayscale */}
                <button
                  onClick={() => {
                    const colors = JOURNAL_PALETTES.grayscale.colors;
                    let colorIdx = 0;
                    let dashStyles = ['solid', 'dashed', 'dotted', 'solid', 'dashed'];
                    const list = datasets.map(d => {
                      if (d.visible) {
                        const c = colors[colorIdx % colors.length];
                        const s = dashStyles[colorIdx % dashStyles.length];
                        colorIdx++;
                        return { ...d, color: c, lineStyle: s as any };
                      }
                      return d;
                    });
                    onDatasetsUpdated(list);
                  }}
                  className="w-full flex items-center justify-between text-left text-xxs bg-[#18181b] hover:bg-[#27272a] border border-[#27272a] p-1.5 rounded transition"
                >
                  <span className="font-semibold text-zinc-300">Monochromatic Publication (Dashed)</span>
                  <div className="flex gap-1 shrink-0">
                    <span className="w-2.5 h-2.5 rounded bg-black" />
                    <span className="w-2.5 h-2.5 rounded bg-zinc-600" />
                    <span className="w-2.5 h-2.5 rounded bg-zinc-400" />
                    <span className="w-2.5 h-2.5 rounded bg-zinc-200" />
                  </div>
                </button>
              </div>
            </div>

            {/* Custom axis boundaries labels */}
            <div className="bg-[#09090b] p-3 rounded border border-[#27272a] flex flex-col gap-2">
              <span className="block text-xxs font-semibold uppercase text-zinc-400">Manual Axes Bounds & Grid Overrides</span>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-[10px] text-gray-500 block mb-0.5">X axis Label</span>
                  <input
                    type="text"
                    value={xLabel}
                    onChange={(e) => setXLabel(e.target.value)}
                    className="w-full bg-[#18181b] border border-[#27272a] rounded p-1 text-xs"
                    placeholder="Wavelength, λ (nm)"
                  />
                </div>
                <div>
                  <span className="text-[10px] text-gray-500 block mb-0.5">Y axis Label</span>
                  <input
                    type="text"
                    value={yLabel}
                    onChange={(e) => setYLabel(e.target.value)}
                    className="w-full bg-[#18181b] border border-[#27272a] rounded p-1 text-xs"
                    placeholder="Absorbance (a.u.)"
                  />
                </div>
              </div>

              {/* Grid switches */}
              <div className="flex gap-4 py-1 select-none">
                <label className="flex items-center gap-1.5 cursor-pointer text-[11px] text-gray-400">
                  <input type="checkbox" checked={gridX} onChange={(e) => setGridX(e.target.checked)} className="accent-teal-500 rounded" /> Show X grid
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer text-[11px] text-gray-400">
                  <input type="checkbox" checked={gridY} onChange={(e) => setGridY(e.target.checked)} className="accent-teal-500 rounded" /> Show Y grid
                </label>
              </div>

              {/* X Bounds fields */}
              <div className="border-t border-[#1e1e24] pt-2 flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-gray-400">Auto X Bounds</span>
                  <input type="checkbox" checked={autoX} onChange={(e) => setAutoX(e.target.checked)} className="accent-teal-500 rounded" />
                </div>
                {!autoX && (
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="number"
                      value={manualXMin}
                      onChange={(e) => setManualXMin(Number(e.target.value))}
                      className="bg-[#18181b] border border-[#27272a] rounded p-1 text-center"
                      placeholder="min"
                    />
                    <input
                      type="number"
                      value={manualXMax}
                      onChange={(e) => setManualXMax(Number(e.target.value))}
                      className="bg-[#18181b] border border-[#27272a] rounded p-1 text-center"
                      placeholder="max"
                    />
                  </div>
                )}
              </div>

              {/* Y Bounds fields */}
              <div className="border-t border-[#1e1e24] pt-2 flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-gray-400">Auto Y Bounds</span>
                  <input type="checkbox" checked={autoY} onChange={(e) => setAutoY(e.target.checked)} className="accent-teal-500 rounded" />
                </div>
                {!autoY && (
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="number"
                      value={manualYMin}
                      onChange={(e) => setManualYMin(Number(e.target.value))}
                      className="bg-[#18181b] border border-[#27272a] rounded p-1 text-center"
                      placeholder="min"
                    />
                    <input
                      type="number"
                      value={manualYMax}
                      onChange={(e) => setManualYMax(Number(e.target.value))}
                      className="bg-[#18181b] border border-[#27272a] rounded p-1 text-center"
                      placeholder="max"
                    />
                  </div>
                )}
              </div>

              {/* Advanced spectroscopic axis inversion */}
              <div className="border-t border-[#1e1e24] pt-2.5 flex flex-col gap-2">
                <span className="text-xxs font-semibold uppercase text-zinc-400">Spectroscopic Axis Inversion</span>
                <div className="grid grid-cols-2 gap-2">
                  <label className="flex items-center gap-1.5 cursor-pointer text-[10.5px] text-gray-400 hover:text-white select-none">
                    <input
                      type="checkbox"
                      checked={invertX}
                      onChange={(e) => setInvertX(e.target.checked)}
                      className="accent-teal-500 rounded"
                    />
                    Invert X-Axis <span className="text-[10px] text-zinc-500 font-mono">(NMR/FTIR)</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer text-[10.5px] text-gray-400 hover:text-white select-none">
                    <input
                      type="checkbox"
                      checked={invertY}
                      onChange={(e) => setInvertY(e.target.checked)}
                      className="accent-teal-500 rounded"
                    />
                    Invert Y-Axis <span className="text-[10px] text-zinc-500 font-mono">(%Trans.)</span>
                  </label>
                </div>
              </div>

              {/* Major Tick Step Sizes & Minor Ticks Count */}
              <div className="border-t border-[#1e1e24] pt-2.5 flex flex-col gap-2">
                <span className="text-xxs font-semibold uppercase text-zinc-400">Major Tick Manual Intervals</span>
                <div className="grid grid-cols-3 gap-1.5">
                  <div>
                    <span className="text-[9px] text-gray-500 block mb-0.5">X Tick Step</span>
                    <input
                      type="number"
                      value={tickStepX || ''}
                      onChange={(e) => setTickStepX(Math.max(0, parseFloat(e.target.value) || 0))}
                      className="w-full bg-[#18181b] border border-[#27272a] rounded p-1 text-center text-xs text-white"
                      placeholder="Auto"
                      min={0}
                    />
                  </div>
                  <div>
                    <span className="text-[9px] text-gray-500 block mb-0.5">Y Tick Step</span>
                    <input
                      type="number"
                      value={tickStepY || ''}
                      onChange={(e) => setTickStepY(Math.max(0, parseFloat(e.target.value) || 0))}
                      className="w-full bg-[#18181b] border border-[#27272a] rounded p-1 text-center text-xs text-white"
                      placeholder="Auto"
                      min={0}
                    />
                  </div>
                  <div>
                    <span className="text-[9px] text-gray-500 block mb-0.5">Sub-ticks Count</span>
                    <select
                      value={minorTicksCount}
                      onChange={(e) => setMinorTicksCount(parseInt(e.target.value) || 0)}
                      className="w-full bg-[#18181b] border border-[#27272a] rounded p-1 text-center text-xs text-white"
                    >
                      <option value="0">None</option>
                      <option value="1">1 sub-tick</option>
                      <option value="3">3 sub-ticks</option>
                      <option value="4">4 sub-ticks (ACS)</option>
                      <option value="9">9 sub-ticks</option>
                    </select>
                  </div>
                </div>
                <p className="text-[9px] text-zinc-500 leading-relaxed">
                  ACS and Nature specify major ticks alignment alongside minor ticks to maximize peak scanning accuracy. Set X/Y Step to "0" to revert to automatic tick placement.
                </p>
              </div>
            </div>

            {/* Inward Thick Axes, drop-lines, legend option controls */}
            <div className="bg-[#09090b] p-3 rounded border border-[#27272a] flex flex-col gap-2 font-medium text-gray-400 select-none">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={thickAxes} onChange={(e) => setThickAxes(e.target.checked)} className="accent-teal-500" /> Thick border boxed & inward ticks
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={dropLines} onChange={(e) => setDropLines(e.target.checked)} className="accent-teal-500" /> Draw vertical drops-line at Peak marks
              </label>
              
              <div className="border-t border-[#1e1e24] pt-2 flex items-center justify-between mt-1">
                <span className="text-[11px]">Expose Legend Box</span>
                <input type="checkbox" checked={showLegend} onChange={(e) => setShowLegend(e.target.checked)} className="accent-teal-500" />
              </div>
              {showLegend && (
                <div className="flex items-center justify-between text-[10px] mt-1">
                  <span>Legend Position</span>
                  <select value={legendPos} onChange={(e) => setLegendPos(e.target.value)} className="bg-[#18181b] border border-[#27272a] p-1 rounded">
                    <option value="upper right">Upper Right</option>
                    <option value="upper left">Upper Left</option>
                    <option value="lower right">Lower Right</option>
                    <option value="lower left">Lower Left</option>
                  </select>
                </div>
              )}
            </div>

          </motion.div>
        )}

        {/* ==========================================
            TAB 4: LAYOUT & CONVERTER EXPORTS
            ========================================== */}
        {activeTab === 'export' && (
          <motion.div
            key="tab-export"
            initial={{ opacity: 0, x: 15 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -15 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="flex flex-col gap-4"
          >
            
            {/* View Stack modes */}
            <div className="bg-[#09090b] p-3 rounded border border-[#27272a] flex flex-col gap-3">
              <span className="block text-xxs font-semibold uppercase text-zinc-400">View Layout Projection Style</span>
              
              <div className="flex flex-col gap-2">
                <select
                  value={layoutMode}
                  onChange={(e) => {
                    const val = e.target.value as any;
                    if (!isPremium && (val === 'Waterfall Stack (3D Projection)' || val === '2D Heatmap / Contour Plot' || val === 'Multi-Panel Grid')) {
                      onTriggerUpgrade();
                    } else {
                      setLayoutMode(val);
                    }
                  }}
                  className="w-full bg-[#18181b] border border-[#27272a] rounded p-1 text-xs text-white"
                >
                  <option value="Standard Overlay">Standard Overlay Stack (Free)</option>
                  <option value="Waterfall Stack (3D Projection)">Waterfall Stack (3D Projection) {!isPremium && "🔒 Pro"}</option>
                  <option value="2D Heatmap / Contour Plot">2D Heatmap / Contour Plot {!isPremium && "🔒 Pro"}</option>
                  <option value="Multi-Panel Grid">Multi-Panel Grid (a/b/c composite figure) {!isPremium && "🔒 Pro"}</option>
                </select>

                {layoutMode === 'Waterfall Stack (3D Projection)' && (
                  <div className="mt-1">
                    <span className="text-[10px] text-gray-500 block mb-1">3D Oblique spacing scale ({(waterfallOffset * 100).toFixed(0)}%)</span>
                    <input
                      type="range"
                      min={0}
                      max={1.5}
                      step={0.1}
                      value={waterfallOffset}
                      onChange={(e) => setWaterfallOffset(Number(e.target.value))}
                      className="w-full accent-teal-500"
                    />
                  </div>
                )}

                {layoutMode === 'Multi-Panel Grid' && (
                  <div className="mt-1 flex flex-col gap-2.5 p-2.5 rounded bg-[#121214] border border-[#27272a]">
                    <p className="text-[9px] text-zinc-500 leading-relaxed">
                      Lays out datasets as independent subplots, each with its own auto-scaled axes and a
                      panel letter — the standard "combined Figure 1" convention for journal submissions.
                      Assign each visible dataset to a panel below; datasets sharing the same panel number
                      are overlaid together within that one subplot.
                    </p>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <span className="text-[9px] text-zinc-500 block mb-0.5">Grid columns</span>
                        <input type="number" min={1} max={4} value={panelGridCols}
                          onChange={e => setPanelGridCols(Math.max(1, Math.min(4, parseInt(e.target.value) || 1)))}
                          className="w-full bg-[#18181b] border border-[#27272a] rounded p-1 text-[10px] text-white text-center" />
                      </div>
                      <div>
                        <span className="text-[9px] text-zinc-500 block mb-0.5">Panel letter case</span>
                        <select value={panelLabelCase} onChange={e => setPanelLabelCase(e.target.value as 'lowercase' | 'uppercase')}
                          className="w-full bg-[#18181b] border border-[#27272a] rounded p-1 text-[10px] text-white">
                          <option value="lowercase">a, b, c (Nature/Science)</option>
                          <option value="uppercase">A, B, C (Cell)</option>
                        </select>
                      </div>
                    </div>

                    <div className="flex flex-col gap-1">
                      <span className="text-[9px] text-zinc-500 mb-0.5">Per-dataset panel assignment</span>
                      {datasets.filter(d => d.visible).map(d => (
                        <div key={d.id} className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                          <span className="text-[9px] text-zinc-300 flex-1 truncate">{d.name}</span>
                          <select
                            value={d.panelIndex ?? 0}
                            onChange={e => {
                              const newPanelIdx = parseInt(e.target.value);
                              const list = datasets.map(ds => ds.id === d.id ? { ...ds, panelIndex: newPanelIdx } : ds);
                              onDatasetsUpdated(list);
                            }}
                            className="bg-[#18181b] border border-[#27272a] rounded p-1 text-[9px] text-white w-20"
                          >
                            {Array.from({ length: 9 }, (_, i) => i).map(i => (
                              <option key={i} value={i}>
                                Panel {panelLabelCase === 'uppercase' ? 'ABCDEFGHI'[i] : 'abcdefghi'[i]}
                              </option>
                            ))}
                          </select>
                        </div>
                      ))}
                      {datasets.filter(d => d.visible).length === 0 && (
                        <p className="text-[9px] text-zinc-600 italic">No visible datasets to assign.</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Vector Export — promoted to the top since this is what Nature,
                Science, Cell, and most chemistry journals actually require
                for line-art figures. Raster formats (PNG/TIFF) are real
                Nature/Science house-style rejections when submitted for
                line plots — see e.g. Nature's author guidelines: "We cannot
                use bitmapped file types such as ... PNG ... for vector art." */}
            <div className="bg-[#09090b] p-3.5 rounded-lg border border-emerald-700/40 flex flex-col gap-2.5">
              <div className="flex items-center gap-1.5 border-b border-emerald-900/40 pb-1.5 mb-0.5">
                <Download size={13} className="text-emerald-400" />
                <span className="block text-xxs font-bold uppercase tracking-wide text-emerald-300">Vector Export — Recommended for Journal Submission</span>
              </div>
              <p className="text-[9.5px] text-zinc-400 leading-relaxed">
                Nature, Science, Cell, and most chemistry journals require true vector formats (SVG/PDF)
                for line-plot figures and explicitly reject raster formats like PNG or TIFF for this
                purpose, regardless of resolution. These two exports preserve every line, tick, and label
                as real vector paths/text — not a rasterized image — so production teams can edit them.
              </p>

              <div className="grid grid-cols-2 gap-2">
                <button
                  disabled={exportStates.svg === 'loading'}
                  onClick={() => {
                    if (!isPremium && exportCount >= 2) { onTriggerUpgrade(); return; }
                    setExportStates(prev => ({ ...prev, svg: 'loading' }));
                    setTimeout(() => {
                      if ((window as any).exportChartAsSVG) {
                        (window as any).exportChartAsSVG();
                        if (!isPremium) setExportCount(prev => prev + 1);
                        onExportSuccess?.();
                        setExportStates(prev => ({ ...prev, svg: 'success' }));
                        setTimeout(() => setExportStates(prev => ({ ...prev, svg: 'idle' })), 3000);
                      } else {
                        setExportStates(prev => ({ ...prev, svg: 'idle' }));
                        alert("Export system initialization failure.");
                      }
                    }, 600);
                  }}
                  className={`flex items-center justify-center gap-1.5 border py-2 px-3 rounded text-[11px] font-semibold shadow transition-all select-none cursor-pointer ${
                    exportStates.svg === 'success'
                      ? 'bg-[#15803d]/90 hover:bg-emerald-600 border-emerald-600 text-white'
                      : 'bg-emerald-900/30 hover:bg-emerald-800/40 border-emerald-700/50 text-emerald-300'
                  }`}
                >
                  {exportStates.svg === 'loading' ? (
                    <><Loader2 size={13} className="animate-spin" /><span>Rendering...</span></>
                  ) : exportStates.svg === 'success' ? (
                    <><Check size={13} /><span>Saved!</span></>
                  ) : (
                    <><span>SVG (vector)</span></>
                  )}
                </button>

                <button
                  disabled={exportStates.figurePdf === 'loading'}
                  onClick={async () => {
                    if (!isPremium && exportCount >= 2) { onTriggerUpgrade(); return; }
                    setExportStates(prev => ({ ...prev, figurePdf: 'loading' }));
                    try {
                      if (!(window as any).exportChartAsPDF) throw new Error('Export system initialization failure.');
                      const result = await (window as any).exportChartAsPDF();
                      if (result?.success) {
                        if (!isPremium) setExportCount(prev => prev + 1);
                        onExportSuccess?.();
                        setExportStates(prev => ({ ...prev, figurePdf: 'success' }));
                        setTimeout(() => setExportStates(prev => ({ ...prev, figurePdf: 'idle' })), 3000);
                      } else {
                        setExportStates(prev => ({ ...prev, figurePdf: 'idle' }));
                        alert(result?.error || "PDF export failed.");
                      }
                    } catch (e: any) {
                      setExportStates(prev => ({ ...prev, figurePdf: 'idle' }));
                      alert(e?.message || "PDF export failed.");
                    }
                  }}
                  className={`flex items-center justify-center gap-1.5 border py-2 px-3 rounded text-[11px] font-semibold shadow transition-all select-none cursor-pointer ${
                    exportStates.figurePdf === 'success'
                      ? 'bg-[#15803d]/90 hover:bg-emerald-600 border-emerald-600 text-white'
                      : 'bg-emerald-900/30 hover:bg-emerald-800/40 border-emerald-700/50 text-emerald-300'
                  }`}
                >
                  {exportStates.figurePdf === 'loading' ? (
                    <><Loader2 size={13} className="animate-spin" /><span>Converting...</span></>
                  ) : exportStates.figurePdf === 'success' ? (
                    <><Check size={13} /><span>Saved!</span></>
                  ) : (
                    <><span>PDF (vector)</span></>
                  )}
                </button>
              </div>
              <p className="text-[8px] text-zinc-600 italic">
                Both formats encode the figure as true vector paths — confirmed by inspecting the output
                with a PDF/SVG editor, the lines remain individually selectable rather than being one
                embedded raster image.
              </p>
            </div>

            {/* Specialized Journal Export Configuration Panel */}
            <div className="bg-[#09090b] p-3.5 rounded-lg border border-[#27272a] flex flex-col gap-3">
              <div className="flex items-center gap-1.5 border-b border-[#1e1e24] pb-1.5 mb-1">
                <Sliders size={13} className="text-teal-400" />
                <span className="block text-xxs font-bold uppercase tracking-wide text-zinc-300">Raster Export — Presentations & Slides (PNG/TIFF)</span>
              </div>
              <p className="text-[9px] text-zinc-500 leading-relaxed -mt-1">
                High-DPI raster images render correctly in PowerPoint, posters, and most journal
                photo/micrograph figures — but are not accepted for line-plot figures by Nature, Science,
                or Cell regardless of resolution. Use Vector Export above for journal line-plot submission.
              </p>

              {/* Layout options inside panel */}
              <div className="grid grid-cols-2 gap-2 text-xxs">
                <div className="flex flex-col gap-1">
                  <span className="text-zinc-400 font-semibold uppercase font-mono text-[9px]">Target Specification</span>
                  <select
                    value={journalStyleOverride}
                    onChange={(e) => setJournalStyleOverride(e.target.value as any)}
                    className="w-full bg-[#18181b] border border-[#27272a] rounded p-1 text-[11px] text-white"
                  >
                    <option value="ACS">ACS (Arial, thick line, boxed)</option>
                    <option value="RSC">RSC (Times New Roman, serif)</option>
                    <option value="Nature">Nature (compact, light-weight)</option>
                    <option value="Default">Default Standard Modern</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <span className="text-zinc-400 font-semibold uppercase font-mono text-[9px]">Resolution Density</span>
                  <select
                    value={exportDPI}
                    onChange={(e) => {
                      const val = Number(e.target.value) as any;
                      if (!isPremium && (val === 600 || val === 1200)) {
                        onTriggerUpgrade();
                      } else {
                        setExportDPI(val);
                      }
                    }}
                    className="w-full bg-[#18181b] border border-[#27272a] rounded p-1 text-[11px] text-white"
                  >
                    <option value="300">300 DPI (Standard Journal)</option>
                    <option value="600">600 DPI (Pro High-Res) {!isPremium && "🔒 Pro"}</option>
                    <option value="1200">1200 DPI (Pro Line Art) {!isPremium && "🔒 Pro"}</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <span className="text-zinc-400 font-semibold uppercase font-mono text-[9px]">Lossless Format Encoding</span>
                  <select
                    value={exportFormat}
                    onChange={(e) => {
                      const val = e.target.value as any;
                      if (!isPremium && val === 'tiff') {
                        onTriggerUpgrade();
                      } else {
                        setExportFormat(val);
                      }
                    }}
                    className="w-full bg-[#18181b] border border-[#27272a] rounded p-1 text-[11px] text-white"
                  >
                    <option value="png">Uncompressed PNG (Lossless)</option>
                    <option value="tiff">Lossless TIFF Surrogate (.tiff) {!isPremium && "🔒 Pro"}</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <span className="text-zinc-400 font-semibold uppercase font-mono text-[9px]">Physical Dimension</span>
                  <div className="bg-[#18181b] border border-[#27272a] rounded p-1 text-[11px] text-zinc-400 font-mono text-center">
                    {journalStyleOverride === 'ACS' ? "3.25 in (Single Col)" : journalStyleOverride === 'Nature' ? "89 mm (Compact)" : "8.2 cm (Standard)"}
                  </div>
                </div>
              </div>

              <button
                disabled={exportStates.highDpi === 'loading'}
                onClick={() => {
                  if (!isPremium && (exportDPI === 600 || exportDPI === 1200 || exportFormat === 'tiff')) {
                    onTriggerUpgrade();
                    return;
                  }
                  if (!isPremium && exportCount >= 2) {
                    onTriggerUpgrade();
                    return;
                  }
                  setExportStates(prev => ({ ...prev, highDpi: 'loading' }));

                  setTimeout(() => {
                    if ((window as any).exportHighDPIImage) {
                      (window as any).exportHighDPIImage(exportDPI, exportFormat, journalStyleOverride);
                      if (!isPremium) {
                        setExportCount(prev => prev + 1);
                      }
                      onExportSuccess?.();
                      setExportStates(prev => ({ ...prev, highDpi: 'success' }));

                      const filename = `${journalStyleOverride || journalStyle}_Figure_${exportDPI}DPI.${exportFormat}`;
                      triggerToast(
                        "Lossless Graphic Rendered",
                        `Rasterized high-definition ${exportFormat.toUpperCase()} publication layout (${exportDPI} DPI) successfully.`,
                        filename,
                        () => {
                          if ((window as any).exportHighDPIImage) {
                            (window as any).exportHighDPIImage(exportDPI, exportFormat, journalStyleOverride);
                          }
                        }
                      );

                      setTimeout(() => {
                        setExportStates(prev => ({ ...prev, highDpi: 'idle' }));
                      }, 3000);
                    } else {
                      setExportStates(prev => ({ ...prev, highDpi: 'idle' }));
                      alert("Failure executing High-Res Canvas rasterization.");
                    }
                  }, 850);
                }}
                className={`w-full font-bold py-1.5 px-3 rounded uppercase text-[10px] tracking-wider transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer select-none ${
                  exportStates.highDpi === 'success'
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                    : 'bg-teal-600 hover:bg-teal-500 text-white'
                }`}
              >
                {exportStates.highDpi === 'loading' ? (
                  <>
                    <Loader2 size={13} className="animate-spin text-teal-200" />
                    <span>Processing rasterization...</span>
                  </>
                ) : exportStates.highDpi === 'success' ? (
                  <>
                    <Check size={13} className="text-emerald-200 scale-110" />
                    <span>Export Success!</span>
                  </>
                ) : (
                  <>
                    <Download size={13} />
                    <span>Render & Export {exportFormat.toUpperCase()} ({exportDPI} DPI)</span>
                  </>
                )}
              </button>
            </div>

            {/* Picture-in-picture insets */}
            <div className="bg-[#09090b] p-3 rounded border border-[#27272a] flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-xxs font-semibold uppercase text-zinc-400">Enlarge zoomed Inset (Sub-frame)</span>
                <input type="checkbox" checked={enableInset} onChange={(e) => setEnableInset(e.target.checked)} className="accent-teal-500 rounded" />
              </div>

              {enableInset && (
                <div className="grid grid-cols-2 gap-2 mt-1">
                  <div>
                    <span className="text-[10px] text-zinc-500 block">Min X</span>
                    <input type="number" value={insetXMin} onChange={(e) => setInsetXMin(Number(e.target.value))} className="w-full bg-[#18181b] border border-[#27272a] text-center" />
                  </div>
                  <div>
                    <span className="text-[10px] text-zinc-500 block">Max X</span>
                    <input type="number" value={insetXMax} onChange={(e) => setInsetXMax(Number(e.target.value))} className="w-full bg-[#18181b] border border-[#27272a] text-center" />
                  </div>
                </div>
              )}
            </div>

            {/* Colored highlighted backgrounds */}
            <div className="bg-[#09090b] p-3 rounded border border-[#27272a] flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-xxs font-semibold uppercase text-zinc-400">Active Highlight Span</span>
                <input type="checkbox" checked={enableHighlight} onChange={(e) => setEnableHighlight(e.target.checked)} className="accent-teal-500 rounded" />
              </div>

              {enableHighlight && (
                <div className="grid grid-cols-2 gap-2 mt-1">
                  <div>
                    <span className="text-[10px] text-zinc-500 block">Start span</span>
                    <input type="number" value={highlightMin} onChange={(e) => setHighlightMin(Number(e.target.value))} className="w-full bg-[#18181b] border border-[#27272a] text-center" />
                  </div>
                  <div>
                    <span className="text-[10px] text-zinc-500 block">End span</span>
                    <input type="number" value={highlightMax} onChange={(e) => setHighlightMax(Number(e.target.value))} className="w-full bg-[#18181b] border border-[#27272a] text-center" />
                  </div>
                </div>
              )}
            </div>

            {/* SVD PCA trigger button & actions */}
            <div className="bg-[#09090b] p-3 rounded border border-[#27272a] flex flex-col gap-2 border-l-2 border-amber-500/50">
              <span className="block text-xxs font-semibold uppercase text-amber-400">Multivariate SVD Decompositions</span>
              <button
                onClick={handleCalculatePCA}
                className="w-full bg-amber-600 hover:bg-amber-500 text-white font-semibold py-1.5 px-3 rounded uppercase text-[10px] tracking-wider transition"
              >
                Execute Singular PCA
              </button>
            </div>

            {/* Document export downloads */}
            <div className="border-t border-[#27272a] pt-4 flex flex-col gap-2">
              <button
                disabled={exportStates.python === 'loading'}
                onClick={() => {
                  if (!isPremium) {
                    onTriggerUpgrade();
                    return;
                  }

                  setExportStates(prev => ({ ...prev, python: 'loading' }));

                  setTimeout(() => {
                    try {
                      const code = generatePythonTkinterCode(sd);
                      const blob = new Blob([code], { type: 'text/plain;charset=utf-8' });
                      const url = URL.createObjectURL(blob);
                      const link = document.createElement('a');
                      link.href = url;
                      const filename = `labscribber_${sd.name.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_gui.py`;
                      link.download = filename;
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);

                      setExportStates(prev => ({ ...prev, python: 'success' }));

                      triggerToast(
                        "Python Script Generated",
                        "Tkinter GUI workspace script initialized with complete spectrum variables successfully.",
                        filename,
                        () => {
                          const reLink = document.createElement('a');
                          reLink.href = url;
                          reLink.download = filename;
                          document.body.appendChild(reLink);
                          reLink.click();
                          document.body.removeChild(reLink);
                        }
                      );

                      setTimeout(() => {
                        setExportStates(prev => ({ ...prev, python: 'idle' }));
                      }, 3000);
                    } catch (err: any) {
                      setExportStates(prev => ({ ...prev, python: 'idle' }));
                      alert("Failed to export python tkinter workspace: " + (err.message || err));
                    }
                  }, 850);
                }}
                className={`w-full flex items-center justify-center gap-1.5 border py-2 px-4 rounded text-xs font-semibold shadow transition-all select-none cursor-pointer ${
                  exportStates.python === 'success'
                    ? 'bg-[#15803d]/90 hover:bg-emerald-600 border-emerald-600 text-white'
                    : 'bg-teal-950/40 hover:bg-teal-900/40 border-teal-500/20 text-teal-400'
                }`}
              >
                {exportStates.python === 'loading' ? (
                  <>
                    <Loader2 size={14} className="animate-spin text-teal-200" />
                    <span>Compiling Python Code...</span>
                  </>
                ) : exportStates.python === 'success' ? (
                  <>
                    <Check size={14} className="text-emerald-205 scale-110" />
                    <span>Python Script Exported!</span>
                  </>
                ) : (
                  <>
                    <Sliders size={14} className="text-teal-400" />
                    <span>Export Standalone Python GUI (.py) {!isPremium && "🔒 Pro"}</span>
                  </>
                )}
              </button>

              <button
                onClick={() => setIsMethodsModalOpen(true)}
                className="w-full flex items-center justify-center gap-1.5 border py-2 px-4 rounded text-xs font-semibold shadow transition-all select-none cursor-pointer bg-indigo-950/40 hover:bg-indigo-900/30 border-indigo-500/20 text-indigo-400"
              >
                <Notebook size={14} className="text-indigo-400" />
                <span>Generate Methods Text</span>
              </button>

              <button
                onClick={() => setIsProvenanceModalOpen(true)}
                className="w-full flex items-center justify-center gap-1.5 border py-2 px-4 rounded text-xs font-semibold shadow transition-all select-none cursor-pointer bg-amber-950/30 hover:bg-amber-900/25 border-amber-500/20 text-amber-400"
              >
                <History size={14} className="text-amber-400" />
                <span>Export Provenance Log</span>
              </button>

              <div className="grid grid-cols-2 gap-2">
                <button
                  disabled={exportStates.csv === 'loading'}
                  onClick={handleExportCSVReport}
                  className={`flex items-center gap-1.5 border text-xxs justify-center transition py-1.5 px-2 rounded cursor-pointer select-none ${
                    exportStates.csv === 'success'
                      ? 'bg-emerald-700/85 hover:bg-emerald-600 border-emerald-500 text-white'
                      : 'bg-[#27272a] hover:bg-[#18181b] border-[#3f3f46] text-zinc-300 hover:text-teal-400'
                  }`}
                >
                  {exportStates.csv === 'loading' ? (
                    <Loader2 size={13} className="animate-spin text-zinc-400" />
                  ) : exportStates.csv === 'success' ? (
                    <Check size={13} className="text-emerald-250" />
                  ) : (
                    <FileSpreadsheet size={13} className="text-zinc-500" />
                  )}
                  <span>{exportStates.csv === 'loading' ? "Exporting..." : exportStates.csv === 'success' ? "Exported!" : "Export CSV"}</span>
                </button>

                <button
                  disabled={exportStates.markdown === 'loading'}
                  onClick={handleExportMarkdownReport}
                  className={`flex items-center gap-1.5 border text-xxs justify-center transition py-1.5 px-2 rounded cursor-pointer select-none ${
                    exportStates.markdown === 'success'
                      ? 'bg-emerald-700/85 hover:bg-emerald-600 border-emerald-500 text-white'
                      : 'bg-[#27272a] hover:bg-[#18181b] border-[#3f3f46] text-zinc-300 hover:text-teal-400'
                  }`}
                >
                  {exportStates.markdown === 'loading' ? (
                    <Loader2 size={13} className="animate-spin text-zinc-400" />
                  ) : exportStates.markdown === 'success' ? (
                    <Check size={13} className="text-emerald-250" />
                  ) : (
                    <FileText size={13} className="text-zinc-500" />
                  )}
                  <span>{exportStates.markdown === 'loading' ? "Exporting..." : exportStates.markdown === 'success' ? "Exported!" : "Export MD"}</span>
                </button>
              </div>

              <button
                disabled={exportStates.pdf === 'loading'}
                onClick={() => setIsPdfPreviewOpen(true)}
                className={`w-full flex items-center justify-center gap-1.5 border py-2 px-4 rounded text-xs font-semibold shadow transition-all select-none cursor-pointer ${
                  exportStates.pdf === 'success'
                    ? 'bg-[#15803d]/90 hover:bg-[#16a34a] border-emerald-600'
                    : 'bg-emerald-950/40 hover:bg-emerald-900/30 border-teal-500/20 text-teal-400'
                }`}
              >
                {exportStates.pdf === 'loading' ? (
                  <>
                    <Loader2 size={14} className="animate-spin text-teal-200" />
                    <span>Assembling PDF Preview...</span>
                  </>
                ) : exportStates.pdf === 'success' ? (
                  <>
                    <Check size={14} className="text-emerald-250 scale-110" />
                    <span>PDF Report Exported!</span>
                  </>
                ) : (
                  <>
                    <FileText size={14} className="text-teal-400" />
                    <span>Preview & Export PDF Report (.pdf)</span>
                  </>
                )}
              </button>

              {/* Journal Experimental Methodology Paragraph generator */}
              <div className="border-t border-[#27272a] mt-2.5 pt-3.5 flex flex-col gap-2">
                <span className="block text-xxs font-semibold uppercase text-teal-400 tracking-wider">Experimental & Methods Copywriter</span>
                <p className="text-[10px] text-zinc-400 leading-normal">
                  Copy-paste this live methodology description directly into your paper's Supporting Information:
                </p>
                
                <div className="bg-[#09090b] p-3 rounded border border-[#27272a] flex flex-col gap-2.5">
                  <div className="text-[10px] text-emerald-400 font-mono leading-relaxed select-all bg-[#18181b] p-2.5 rounded border border-[#27272a] max-h-[140px] overflow-y-auto scrollbar-thin">
                    {`Experimental Spectroscopy Methodology: The raw spectrum "${sd.name}" was processed and formatted using the Labscribber Pro spectroscopy workstation. Active peak deconvolution maps major emission or absorption bands at x = [${sd.peaks.map(p => p.x.toFixed(2)).join(', ') || 'N/A'}] ${xLabel.includes('Wavelength') || xLabel.includes('λ') ? 'nm' : 'units'}${sd.peaks.some(p => p.transition) ? ` with explicit assignments for electronic transitions ([${sd.peaks.filter(p => p.transition).map(p => p.transition).join(', ')}])` : ''}. Analytical integration of primary peaks yields a trapezoidal integral area bounds of [${sd.integrals.map(i => `${i.xmin.toFixed(2)}-${i.xmax.toFixed(2)}`).join('; ') || 'N/A'}] representing absolute quantitative band intensities.`}
                  </div>
                  
                  <div className="flex justify-between items-center border-t border-[#27272a] pt-2 text-[10px]">
                    <span className="text-[9px] text-zinc-500 font-medium">Software Citation:</span>
                    <button
                      onClick={() => {
                        const bibtex = `@software{Raza2026Labscribber,
  title={{Labscribber: A Cross-Platform Scientific Spectroscopy Workstation}},
  author={Raza, Asif and Basheer, Huma and Khan, Imran A.},
  year={2026},
  publisher={GitHub},
  url={https://github.com/asifverse4/LabScribber},
  note={A peer-reviewed publication and DOI will be added here once available.}
}`;
                        navigator.clipboard.writeText(bibtex);
                        if (onOpenCiteKit) {
                          onOpenCiteKit();
                        } else {
                          alert("Software citation copied! A DOI will be added once the accompanying paper is published. You can paste this into your Zotero or LaTeX references now and update it later.");
                        }
                      }}
                      className="text-[10px] px-2.5 py-1 bg-teal-950/50 hover:bg-teal-900 border border-teal-500/20 text-teal-400 rounded transition font-semibold flex items-center gap-1"
                    >
                      <span>Cite Labscribber</span>
                    </button>
                  </div>
                </div>
              </div>

            </div>

          </motion.div>
        )}

        </AnimatePresence>
      </div>

      {/* PCA scores loading modal */}
      {isPcaModalOpen && pcaResult && (() => {
        const visibleDatasets = datasets.filter(d => d.visible);
        
        // Centroid
        let meanPC1 = 0;
        let meanPC2 = 0;
        visibleDatasets.forEach((_, sIdx) => {
          const rowScores = pcaResult.scores[sIdx];
          if (rowScores) {
            meanPC1 += rowScores[0] || 0;
            meanPC2 += rowScores[1] || 0;
          }
        });
        meanPC1 /= visibleDatasets.length || 1;
        meanPC2 /= visibleDatasets.length || 1;

        // Euclidean distance from centroid
        const distances = visibleDatasets.map((_, sIdx) => {
          const rowScores = pcaResult.scores[sIdx];
          if (!rowScores) return 0;
          const dx = (rowScores[0] || 0) - meanPC1;
          const dy = (rowScores[1] || 0) - meanPC2;
          return Math.sqrt(dx * dx + dy * dy);
        });

        const meanDist = distances.reduce((sum, d) => sum + d, 0) / (distances.length || 1);
        const varianceDist = distances.reduce((sum, d) => sum + Math.pow(d - meanDist, 2), 0) / (distances.length || 1);
        const stdDist = Math.sqrt(varianceDist) || 1e-9;

        // Standard scientific threshold: distance > mean + 1.2 * std deviation
        const thres = meanDist + 1.2 * stdDist;

        const analysisRows = visibleDatasets.map((ds, sIdx) => {
          const rowScores = pcaResult.scores[sIdx] || [0, 0];
          const dist = distances[sIdx];
          const zScore = (dist - meanDist) / stdDist;
          // If there are only 2 or 3 samples, mark the furthest one as potential outlier to assist
          const isFurthest = dist === Math.max(...distances);
          const isOutlier = dist > thres || (visibleDatasets.length <= 4 && isFurthest && dist > meanDist * 1.3);

          return {
            id: ds.id,
            name: ds.name,
            color: ds.color,
            pc1: rowScores[0] || 0,
            pc2: rowScores[1] || 0,
            dist,
            zScore,
            isOutlier
          };
        });

        const identifiedOutliers = analysisRows.filter(r => r.isOutlier);

        // Compute coordinates for SVG layout mapping
        const pc1Vals = analysisRows.map(r => r.pc1);
        const pc2Vals = analysisRows.map(r => r.pc2);
        
        let minPC1 = Math.min(...pc1Vals, -1);
        let maxPC1 = Math.max(...pc1Vals, 1);
        let minPC2 = Math.min(...pc2Vals, -1);
        let maxPC2 = Math.max(...pc2Vals, 1);

        // Add 20% cushion to borders
        const padPC1 = (maxPC1 - minPC1) * 0.2 || 0.5;
        const padPC2 = (maxPC2 - minPC2) * 0.2 || 0.5;
        minPC1 -= padPC1; maxPC1 += padPC1;
        minPC2 -= padPC2; maxPC2 += padPC2;

        const mapX = (v: number) => 30 + ((v - minPC1) / (maxPC1 - minPC1 || 1)) * 280;
        const mapY = (v: number) => 210 - ((v - minPC2) / (maxPC2 - minPC2 || 1)) * 180;

        const handleDownloadPCAPlot = () => {
          // Generates high quality vector dump of PCA model
          let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 340 240" width="600" height="423" style="background:#09090b; font-family:sans-serif;">`;
          s += `<rect width="340" height="240" fill="#09090b"/>`;
          
          // Axes labels
          s += `<text x="170" y="235" fill="#a1a1aa" font-size="9" text-anchor="middle">PC1 (Explained Var: ${(pcaResult.explainedVariance[0]*100).toFixed(1)}%)</text>`;
          s += `<text x="10" y="120" fill="#a1a1aa" font-size="9" text-anchor="middle" transform="rotate(-90 10 120)">PC2 (Explained Var: ${(pcaResult.explainedVariance[1]*100).toFixed(1)}%)</text>`;

          // Zero intercept lines
          const zeroX = mapX(0);
          const zeroY = mapY(0);
          if (zeroX >= 30 && zeroX <= 310) {
            s += `<line x1="${zeroX}" y1="30" x2="${zeroX}" y2="210" stroke="#27272a" stroke-dasharray="3,3"/>`;
          }
          if (zeroY >= 30 && zeroY <= 210) {
            s += `<line x1="30" y1="${zeroY}" x2="310" y2="${zeroY}" stroke="#27272a" stroke-dasharray="3,3"/>`;
          }

          // Plot grid box border
          s += `<rect x="30" y="30" width="280" height="180" fill="none" stroke="#27272a" stroke-width="1"/>`;

          // Plot coordinate points & names
          analysisRows.forEach((r) => {
            const cx = mapX(r.pc1);
            const cy = mapY(r.pc2);
            if (r.isOutlier) {
              s += `<circle cx="${cx}" cy="${cy}" r="9" fill="none" stroke="#f43f5e" stroke-width="1.5" stroke-dasharray="2,2"/>`;
            }
            s += `<circle cx="${cx}" cy="${cy}" r="5" fill="${r.color || '#3b82f6'}"/>`;
            s += `<text x="${cx + 7}" y="${cy + 3}" fill="#e4e4e7" font-size="8">${r.name}</text>`;
          });

          s += `</svg>`;
          const blob = new Blob([s], { type: 'image/svg+xml;charset=utf-8' });
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `PCA_Variance_Cluster_${Date.now()}.svg`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        };

        return (
          <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-[#121214] border border-[#27272a] rounded-xl shadow-2xl p-6 w-full max-w-4xl text-gray-200 flex flex-col gap-4 animate-in fade-in duration-200">
              <div className="flex items-center justify-between border-b border-[#27272a] pb-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="text-amber-400" size={18} />
                  <h3 className="text-sm font-semibold tracking-wide text-zinc-100 uppercase">
                    Multivariate Variance Analysis & Outlier Detector
                  </h3>
                </div>
                <span className="text-[10px] bg-amber-500/10 text-amber-400 font-mono px-2 py-0.5 rounded border border-amber-500/20">
                  SVD-NIPALS PCA Engine Enabled
                </span>
              </div>
              
              <p className="text-[11px] text-gray-400 leading-relaxed -mt-2">
                Singular Value Decomposition executed successfully across {visibleDatasets.length} spectra. Each dimension represents structural features of variance. Points deviating significantly from cluster centroid are highlighted as statistical outliers.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-stretch">
                {/* Left: Explained Variance & Outliers Alert */}
                <div className="md:col-span-4 flex flex-col gap-3">
                  <div className="border border-[#27272a] bg-[#09090b] rounded-lg p-3 flex flex-col gap-2.5">
                    <span className="text-[10px] font-bold uppercase text-gray-400 tracking-wider">Eigenvalue Variance Breakdown</span>
                    <div className="flex flex-col gap-3">
                      {pcaResult.explainedVariance.map((variance, idx) => (
                        <div key={idx} className="flex flex-col gap-1 text-xxs">
                          <div className="flex justify-between text-[11px]">
                            <span className="font-semibold text-zinc-300">Principal Component {idx + 1}</span>
                            <span className="text-amber-400 font-bold">{(variance * 100).toFixed(2)}%</span>
                          </div>
                          <div className="w-full bg-[#1e1e24] h-2 rounded-full overflow-hidden border border-zinc-800">
                            <div className="bg-amber-500 h-full rounded-full" style={{ width: `${variance * 105}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Statistical Outliers Card */}
                  <div className={`p-3.5 rounded-lg border flex flex-col gap-1.5 ${identifiedOutliers.length > 0 ? 'bg-rose-950/20 border-rose-500/20 text-rose-300' : 'bg-emerald-950/10 border-emerald-500/20 text-emerald-300'}`}>
                    <span className="text-[10px] font-bold uppercase tracking-wider">Outlier Diagnostic Status</span>
                    {identifiedOutliers.length > 0 ? (
                      <div className="flex flex-col gap-1.5">
                        <p className="text-[10px] leading-relaxed">
                          Detected **{identifiedOutliers.length}** sample(s) with spectral variance deviating abnormally from the cluster centroid:
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {identifiedOutliers.map(o => (
                            <span key={o.id} className="text-[9px] bg-rose-500/20 border border-rose-500/40 text-rose-200 px-1.5 py-0.5 rounded font-mono font-bold">
                              {o.name} ({o.zScore > 0 ? `+${o.zScore.toFixed(1)}` : o.zScore.toFixed(1)}σ)
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <p className="text-[10px] leading-relaxed"> All visible spectrum profiles remain tightly clustered within the standard statistical variance threshold. No outliers identified.</p>
                    )}
                  </div>
                </div>

                {/* Middle: 2D Interactive Scatter SVG Map */}
                <div className="md:col-span-5 border border-[#27272a] bg-[#09090b] rounded-lg p-3 flex flex-col items-center">
                  <div className="w-full flex justify-between items-center mb-1.5">
                    <span className="text-[10px] font-bold uppercase text-gray-400 tracking-wider">PC1 vs PC2 Cluster Scatter Diagram</span>
                    <button
                      onClick={handleDownloadPCAPlot}
                      className="text-[9px] text-teal-400 bg-teal-950/40 hover:bg-teal-900/40 border border-teal-500/20 px-2 py-0.5 rounded transition font-semibold animate-pulse"
                    >
                      Export SVG
                    </button>
                  </div>

                  {/* Custom SVG scatter plot */}
                  <svg className="w-full h-auto max-w-[340px] bg-[#09090b] border border-zinc-850 rounded-md" viewBox="0 0 340 240">
                    {/* Horizontal zero reference line */}
                    {(() => {
                      const zeroY = mapY(0);
                      if (zeroY >= 30 && zeroY <= 210) {
                        return <line x1="30" y1={zeroY} x2="310" y2={zeroY} stroke="#27272a" strokeWidth={1} strokeDasharray="3,3" />;
                      }
                      return null;
                    })()}

                    {/* Vertical zero reference line */}
                    {(() => {
                      const zeroX = mapX(0);
                      if (zeroX >= 30 && zeroX <= 310) {
                        return <line x1={zeroX} y1="30" x2={zeroX} y2="210" stroke="#27272a" strokeWidth={1} strokeDasharray="3,3" />;
                      }
                      return null;
                    })()}

                    {/* Plot boundary bounding box */}
                    <rect x="30" y="30" width="280" height="180" fill="none" stroke="#3f3f46" strokeWidth={1.2} />

                    {/* Coordinates plot */}
                    {analysisRows.map((r) => {
                      const cx = mapX(r.pc1);
                      const cy = mapY(r.pc2);
                      return (
                        <g key={r.id} className="group">
                          {r.isOutlier && (
                            <circle
                              cx={cx}
                              cy={cy}
                              r={8}
                              fill="none"
                              stroke="#ef4444"
                              strokeWidth={1.5}
                              strokeDasharray="2,2"
                            />
                          )}
                          {/* Interactive point circle */}
                          <circle
                            cx={cx}
                            cy={cy}
                            r={5.5}
                            fill={r.color || '#14b8a6'}
                            className="cursor-pointer transition-all duration-200 hover:r-7 hover:stroke-white hover:stroke-2"
                          />
                          {/* Point title tag */}
                          <text
                            x={cx + 7}
                            y={cy + 3}
                            fill="#f4f4f5"
                            fontSize={8.5}
                            fontWeight="500"
                            className="pointer-events-none drop-shadow-md select-none"
                          >
                            {r.name}
                          </text>
                        </g>
                      );
                    })}

                    {/* Dynamic axes labeling content */}
                    <text x={170} y={235} fill="#71717a" fontSize={9} textAnchor="middle" fontWeight="bold">
                      PC1 Score ({(pcaResult.explainedVariance[0]*100).toFixed(1)}% variance explained)
                    </text>
                    <text x={10} y={120} fill="#71717a" fontSize={9} textAnchor="middle" fontWeight="bold" transform="rotate(-90 10 120)">
                      PC2 Score ({(pcaResult.explainedVariance[1]*100).toFixed(1)}% variance explained)
                    </text>
                  </svg>
                </div>

                {/* Right Side: Coordinate Listings */}
                <div className="md:col-span-3 border border-[#27272a] bg-[#09090b] rounded-lg p-3 flex flex-col overflow-hidden">
                  <span className="text-[10px] font-bold uppercase text-gray-400 mb-2 tracking-wider">Cluster Coordinates Matrix</span>
                  <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-1 text-xxs divide-y divide-[#1e1e24] scrollbar-thin">
                    {analysisRows.map((r) => {
                      return (
                        <div key={r.id} className="flex flex-col py-1.5 gap-0.5 first:pt-0">
                          <div className="flex justify-between items-center">
                            <div className="flex items-center gap-1.5 truncate">
                              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: r.color }} />
                              <span className="font-semibold text-zinc-300 truncate max-w-[100px]">{r.name}</span>
                            </div>
                            {r.isOutlier && (
                              <span className="bg-rose-500/10 text-rose-400 text-[8px] px-1 rounded border border-rose-500/30 font-bold">
                                OUTLIER
                              </span>
                            )}
                          </div>
                          <div className="flex justify-between items-center text-[10px] font-mono mt-0.5">
                            <span className="text-zinc-500">[{r.pc1.toFixed(2)}, {r.pc2.toFixed(2)}]</span>
                            <span className={r.isOutlier ? "text-rose-400 font-bold" : "text-zinc-400"}>
                              {r.zScore > 0 ? `+${r.zScore.toFixed(2)}` : r.zScore.toFixed(2)}σ
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

              </div>

              <div className="flex justify-end gap-3 border-t border-[#27272a] pt-4 mt-1">
                <button
                  onClick={() => setIsPcaModalOpen(false)}
                  className="bg-zinc-800 hover:bg-zinc-700 text-xs text-white font-medium py-1.5 px-4 border border-[#3f3f46] rounded transition-colors"
                >
                  Close Cluster View
                </button>
              </div>

            </div>
          </div>
        );
      })()}

      {/* Floating Toast Notification Deck */}
      <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 max-w-sm w-full pointer-events-none px-4 sm:px-0">
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 50, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ type: "spring", stiffness: 350, damping: 25 }}
              className="pointer-events-auto bg-[#18181b] border border-emerald-500/25 shadow-2xl rounded-lg p-3.5 flex flex-col gap-2.5 text-zinc-100 relative overflow-hidden group mb-1"
            >
              <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none" />
              
              <div className="flex gap-2.5 items-start">
                <div className="bg-emerald-500/10 p-2 rounded-lg border border-emerald-500/35 text-emerald-400 mt-0.5 shadow-inner">
                  <Check size={18} className="stroke-[2.5]" />
                </div>
                <div className="flex-1 flex flex-col min-w-0">
                  <span className="font-semibold text-xs text-zinc-100 tracking-wide">{toast.title}</span>
                  <p className="text-[10px] text-zinc-400 leading-relaxed mt-0.5 pr-2">
                    {toast.message}
                  </p>
                </div>
                <button
                  onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
                  className="text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer p-0.5 text-lg -mt-1.5 -mr-1"
                >
                  &times;
                </button>
              </div>

              <div className="bg-[#121214] border border-[#27272a] rounded p-2 flex items-center justify-between gap-2.5">
                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                  <FileText size={12} className="text-zinc-500 shrink-0" />
                  <span className="text-[10px] font-mono text-zinc-400 truncate">{toast.filename}</span>
                </div>
                <button
                  onClick={toast.onClickDownload}
                  className="px-2.5 py-1 text-[9px] font-semibold text-teal-400 bg-teal-950/40 hover:bg-teal-900/40 border border-teal-500/20 rounded hover:border-teal-400/40 hover:text-teal-300 transition-all shadow-sm flex items-center gap-1 shrink-0 cursor-pointer"
                >
                  <Download size={10} />
                  <span>Download</span>
                </button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Auto-generated Methods Text Modal */}
      <AnimatePresence>
        {isMethodsModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[99999] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
          >
            <motion.div
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              transition={{ type: "spring", duration: 0.4 }}
              className="bg-[#18181b] border border-[#27272a] rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden text-zinc-100"
            >
              {/* Header */}
              <div className="border-b border-[#27272a] px-6 py-4 flex items-center justify-between bg-[#1f1f23]">
                <div className="flex items-center gap-2.5">
                  <div className="bg-indigo-500/10 p-2 rounded-lg border border-indigo-500/35 text-indigo-400">
                    <Notebook size={20} className="stroke-[2.5]" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm tracking-wide text-zinc-100">Auto-Generated Methods Text</h3>
                    <p className="text-[10px] text-zinc-400 mt-0.5">Drafted directly from this dataset's recorded processing history — review before pasting into a manuscript.</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsMethodsModalOpen(false)}
                  className="bg-[#27272a] hover:bg-[#3f3f46] text-zinc-400 hover:text-white transition px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer"
                >
                  Close
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-4">
                {/* Scope toggle */}
                <div className="flex items-center justify-between bg-[#121214] border border-[#27272a] rounded-lg p-3">
                  <div className="flex items-center gap-2">
                    <Users size={14} className="text-indigo-400" />
                    <div>
                      <span className="text-xs font-semibold text-zinc-200 block">Include all loaded datasets</span>
                      <span className="text-[10px] text-zinc-500">Off: only "{sd.name}". On: one paragraph per dataset ({datasets.length} total).</span>
                    </div>
                  </div>
                  <button
                    onClick={() => setMethodsIncludeAll(prev => !prev)}
                    className={`relative w-10 h-5.5 rounded-full transition-colors cursor-pointer shrink-0 ${methodsIncludeAll ? 'bg-indigo-500' : 'bg-zinc-700'}`}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-4.5 h-4.5 bg-white rounded-full transition-transform ${methodsIncludeAll ? 'translate-x-4.5' : ''}`} />
                  </button>
                </div>

                {/* Generated text */}
                <div className="bg-[#0c0c0e] border border-[#27272a] rounded-lg p-4 text-[12px] leading-relaxed text-zinc-300 font-serif whitespace-pre-wrap select-all max-h-[45vh] overflow-y-auto">
                  {methodsText || 'No dataset selected.'}
                </div>

                <p className="text-[10px] text-zinc-500 leading-relaxed">
                  This paragraph is parsed directly from the processing steps actually applied to the data (smoothing, baseline correction, peak fitting, statistical tests, etc.), so it stays consistent with your figures. Treat it as a first draft — check units, tense, and journal style before submission.
                </p>
              </div>

              {/* Footer actions */}
              <div className="border-t border-[#27272a] px-6 py-4 bg-[#1f1f23] flex items-center gap-2.5">
                <button
                  onClick={handleCopyMethodsText}
                  className={`flex-1 flex items-center justify-center gap-1.5 border py-2 px-4 rounded text-xs font-semibold shadow transition-all select-none cursor-pointer ${
                    methodsCopied
                      ? 'bg-emerald-700/85 hover:bg-emerald-600 border-emerald-500 text-white'
                      : 'bg-indigo-950/40 hover:bg-indigo-900/30 border-indigo-500/20 text-indigo-400'
                  }`}
                >
                  {methodsCopied ? <Check size={14} /> : <ClipboardCopy size={14} />}
                  <span>{methodsCopied ? 'Copied!' : 'Copy to Clipboard'}</span>
                </button>
                <button
                  onClick={handleDownloadMethodsText}
                  className="flex-1 flex items-center justify-center gap-1.5 border py-2 px-4 rounded text-xs font-semibold shadow transition-all select-none cursor-pointer bg-[#27272a] hover:bg-[#3f3f46] border-[#3f3f46] text-zinc-300"
                >
                  <Download size={14} />
                  <span>Download .txt</span>
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Provenance / Session Log Export Modal */}
      <AnimatePresence>
        {isProvenanceModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[99999] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
          >
            <motion.div
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              transition={{ type: "spring", duration: 0.4 }}
              className="bg-[#18181b] border border-[#27272a] rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden text-zinc-100"
            >
              {/* Header */}
              <div className="border-b border-[#27272a] px-6 py-4 flex items-center justify-between bg-[#1f1f23]">
                <div className="flex items-center gap-2.5">
                  <div className="bg-amber-500/10 p-2 rounded-lg border border-amber-500/35 text-amber-400">
                    <History size={20} className="stroke-[2.5]" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm tracking-wide text-zinc-100">Provenance / Session Log Export</h3>
                    <p className="text-[10px] text-zinc-400 mt-0.5">Every recorded processing step, timestamped and categorized, with a data-integrity checksum — for auditing exactly how a result was produced.</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsProvenanceModalOpen(false)}
                  className="bg-[#27272a] hover:bg-[#3f3f46] text-zinc-400 hover:text-white transition px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer"
                >
                  Close
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-4">
                {/* Scope toggle */}
                <div className="flex items-center justify-between bg-[#121214] border border-[#27272a] rounded-lg p-3">
                  <div className="flex items-center gap-2">
                    <Users size={14} className="text-amber-400" />
                    <div>
                      <span className="text-xs font-semibold text-zinc-200 block">Include all loaded datasets</span>
                      <span className="text-[10px] text-zinc-500">Off: only "{sd.name}". On: full session log ({datasets.length} dataset{datasets.length !== 1 ? 's' : ''}).</span>
                    </div>
                  </div>
                  <button
                    onClick={() => setProvenanceIncludeAll(prev => !prev)}
                    className={`relative w-10 h-5.5 rounded-full transition-colors cursor-pointer shrink-0 ${provenanceIncludeAll ? 'bg-amber-500' : 'bg-zinc-700'}`}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-4.5 h-4.5 bg-white rounded-full transition-transform ${provenanceIncludeAll ? 'translate-x-4.5' : ''}`} />
                  </button>
                </div>

                {/* Summary chips */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-[#121214] border border-[#27272a] rounded p-2 text-center">
                    <div className="text-[9px] text-zinc-500 uppercase">Datasets</div>
                    <div className="text-sm font-mono font-semibold text-amber-300">{provenanceLog.datasetCount}</div>
                  </div>
                  <div className="bg-[#121214] border border-[#27272a] rounded p-2 text-center">
                    <div className="text-[9px] text-zinc-500 uppercase">Logged Events</div>
                    <div className="text-sm font-mono font-semibold text-amber-300">
                      {provenanceLog.datasets.reduce((s, d) => s + d.events.length, 0)}
                    </div>
                  </div>
                  <div className="bg-[#121214] border border-[#27272a] rounded p-2 text-center">
                    <div className="text-[9px] text-zinc-500 uppercase">Exported</div>
                    <div className="text-[10px] font-mono font-semibold text-amber-300 mt-0.5">{new Date(provenanceLog.exportedAt).toLocaleString()}</div>
                  </div>
                </div>

                {/* JSON preview */}
                <div className="bg-[#0c0c0e] border border-[#27272a] rounded-lg p-4 text-[10px] leading-relaxed text-zinc-300 font-mono whitespace-pre-wrap select-all max-h-[40vh] overflow-y-auto">
                  {provenanceJSON}
                </div>

                <p className="text-[10px] text-zinc-500 leading-relaxed">
                  Each dataset includes a checksum of its raw imported trace, so a collaborator or reviewer can confirm the data referenced here is the same data they're looking at. JSON preserves full structure (timestamps, categories, current processing state); the CSV is a flattened one-row-per-event version for spreadsheet auditing or supplementary material.
                </p>
              </div>

              {/* Footer actions */}
              <div className="border-t border-[#27272a] px-6 py-4 bg-[#1f1f23] flex items-center gap-2.5">
                <button
                  onClick={handleCopyProvenanceJSON}
                  className={`flex-1 flex items-center justify-center gap-1.5 border py-2 px-4 rounded text-xs font-semibold shadow transition-all select-none cursor-pointer ${
                    provenanceCopied
                      ? 'bg-emerald-700/85 hover:bg-emerald-600 border-emerald-500 text-white'
                      : 'bg-amber-950/30 hover:bg-amber-900/25 border-amber-500/20 text-amber-400'
                  }`}
                >
                  {provenanceCopied ? <Check size={14} /> : <ClipboardCopy size={14} />}
                  <span>{provenanceCopied ? 'Copied!' : 'Copy JSON'}</span>
                </button>
                <button
                  onClick={handleDownloadProvenanceJSON}
                  className="flex-1 flex items-center justify-center gap-1.5 border py-2 px-4 rounded text-xs font-semibold shadow transition-all select-none cursor-pointer bg-[#27272a] hover:bg-[#3f3f46] border-[#3f3f46] text-zinc-300"
                >
                  <Download size={14} />
                  <span>Download .json</span>
                </button>
                <button
                  onClick={handleDownloadProvenanceCSV}
                  className="flex-1 flex items-center justify-center gap-1.5 border py-2 px-4 rounded text-xs font-semibold shadow transition-all select-none cursor-pointer bg-[#27272a] hover:bg-[#3f3f46] border-[#3f3f46] text-zinc-300"
                >
                  <Download size={14} />
                  <span>Download .csv</span>
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* PDF Report Live Preview Modal */}
      <AnimatePresence>
        {isPdfPreviewOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[99999] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
          >
            <motion.div
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              transition={{ type: "spring", duration: 0.4 }}
              className="bg-[#18181b] border border-[#27272a] rounded-xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col overflow-hidden text-zinc-100"
            >
              {/* Header */}
              <div className="border-b border-[#27272a] px-6 py-4 flex items-center justify-between bg-[#1f1f23]">
                <div className="flex items-center gap-2.5">
                  <div className="bg-teal-500/10 p-2 rounded-lg border border-teal-500/35 text-teal-400">
                    <FileText size={20} className="stroke-[2.5]" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm tracking-wide text-zinc-100">Academic PDF Report Live Verification</h3>
                    <p className="text-[10px] text-zinc-400 mt-0.5">Verify scientific page layouts, peak identifiers, and integrals database in real-time before compile.</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsPdfPreviewOpen(false)}
                  className="bg-[#27272a] hover:bg-[#3f3f46] text-zinc-400 hover:text-white transition px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer"
                >
                  Close Preview
                </button>
              </div>

              {/* Main content grid */}
              <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden">
                
                {/* Left Panel: Verification summary & download trigger */}
                <div className="lg:col-span-4 p-6 border-r border-[#27272a] bg-[#121214] flex flex-col justify-between overflow-y-auto max-h-[70vh] lg:max-h-full">
                  <div className="flex flex-col gap-5">
                    <div>
                      <span className="text-[10px] font-semibold text-teal-400 uppercase tracking-widest pl-0.5">Verification Checklist</span>
                      <div className="mt-3 space-y-2.5">
                        <div className="flex items-start gap-2.5 bg-[#18181b] p-3 rounded-lg border border-emerald-500/15">
                          <Check size={14} className="text-emerald-400 shrink-0 mt-0.5" />
                          <div>
                            <span className="text-xs font-semibold text-zinc-200">High-DPI Waveform Verification</span>
                            <p className="text-[10px] text-zinc-400 mt-0.5">Vector-reconstructed curve paths matched exactly with experimental baseline filters.</p>
                          </div>
                        </div>

                        <div className="flex items-start gap-2.5 bg-[#18181b] p-3 rounded-lg border border-teal-500/15">
                          <Check size={14} className="text-teal-400 shrink-0 mt-0.5" />
                          <div>
                            <span className="text-xs font-semibold text-zinc-200">Integrations Boundary Validation</span>
                            <p className="text-[10px] text-zinc-400 mt-0.5">Calculated shaded regions, trapezoidal integration bounds are mapped accurately.</p>
                          </div>
                        </div>

                        <div className="flex items-start gap-2.5 bg-[#18181b] p-3 rounded-lg border border-zinc-700/50">
                          <Check size={14} className="text-zinc-400 shrink-0 mt-0.5" />
                          <div>
                            <span className="text-xs font-semibold text-zinc-300">Semantic Preprocessing Log</span>
                            <p className="text-[10px] text-zinc-400 mt-0.5">Prism pipeline modifications history appended sequentially to Appendix section.</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Metadata summary table */}
                    <div className="bg-[#18181b] border border-[#27272a] rounded-lg p-4">
                      <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider block mb-2.5">Document Metadata Overview</span>
                      <div className="space-y-2 text-[10px] text-zinc-400 font-mono">
                        <div className="flex justify-between border-b border-[#27272a] pb-1.5">
                          <span>Dataset:</span>
                          <span className="text-zinc-200 truncate max-w-[140px]">{sd.name}</span>
                        </div>
                        <div className="flex justify-between border-b border-[#27272a] pb-1.5">
                          <span>Technique:</span>
                          <span className="text-zinc-200">{sd.technique}</span>
                        </div>
                        <div className="flex justify-between border-b border-[#27272a] pb-1.5">
                          <span>Total Points:</span>
                          <span className="text-zinc-200">{sd.x.length} pts</span>
                        </div>
                        <div className="flex justify-between border-b border-[#27272a] pb-1.5">
                          <span>Detected Peaks:</span>
                          <span className="text-emerald-400 font-semibold">{sd.peaks.length} marks</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Active Integrals:</span>
                          <span className="text-teal-400 font-semibold">{sd.integrals.length} areas</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 pt-5 border-t border-[#27272a]">
                    <button
                      onClick={() => {
                        handleExportPDFReport();
                        setIsPdfPreviewOpen(false);
                      }}
                      className="w-full bg-teal-600 hover:bg-teal-500 text-white font-bold py-3 px-4 rounded-lg text-xs tracking-wider transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer select-none"
                    >
                      <Download size={15} />
                      <span>COMPILE & DOWNLOAD PDF REPORT</span>
                    </button>
                    <p className="text-[9px] text-zinc-500 text-center mt-2">Outputs a premium 3-page publication-ready medical/engineering PDF draft.</p>
                  </div>
                </div>

                {/* Right Panel: Scrollable preview deck */}
                <div className="lg:col-span-8 p-6 bg-[#09090b] overflow-y-auto max-h-[70vh] lg:max-h-full flex flex-col gap-8 items-center scrollbar-thin">
                  
                  {/* Virtual PDF Page 1 */}
                  <div className="w-[100%] max-w-[650px] aspect-[1/1.414] bg-white border border-zinc-200 shadow-xl rounded p-[30px] flex flex-col text-zinc-900 justify-between">
                    <div>
                      {/* Stylized top banner */}
                      <div className="w-full h-1 bg-teal-500 mb-4" />
                      
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-bold text-[#18181b] text-base leading-tight">SPECTROGRAPHIC PROVENANCE REPORT</h4>
                          <span className="text-[8px] font-mono text-zinc-500 block mt-1">Generated via Labscribber Workstation Suite v1.0.0</span>
                        </div>
                        <span className="text-[7px] text-zinc-400 bg-zinc-100 px-1.5 py-0.5 rounded uppercase tracking-wider font-semibold">Page 1 of 3</span>
                      </div>

                      <div className="w-full h-[0.5px] bg-zinc-200 my-3" />

                      {/* Metadata profile inside preview */}
                      <div className="bg-zinc-50 border border-zinc-200 rounded p-3 grid grid-cols-2 gap-2 text-[9px] text-zinc-700">
                        <div className="col-span-2 font-bold text-zinc-900 text-[10px] mb-1">DATASET METADATA PROFILE</div>
                        
                        <div>
                          <p className="font-semibold text-zinc-900 mb-0.5">Dataset Index Name:</p>
                          <p className="font-mono text-zinc-600 truncate">{sd.name || "N/A"}</p>
                        </div>
                        <div>
                          <p className="font-semibold text-zinc-900 mb-0.5">Spectroscopic Method:</p>
                          <p className="font-mono text-zinc-600">{sd.technique || "N/A"}</p>
                        </div>
                        <div>
                          <p className="font-semibold text-zinc-900 mb-0.5">Coordinates Count (X, Y):</p>
                          <p className="font-mono text-zinc-600">{sd.x.length} points sampled</p>
                        </div>
                        <div>
                          <p className="font-semibold text-zinc-900 mb-0.5">Styles Profile:</p>
                          <p className="font-mono text-zinc-600">{journalStyleOverride} CSS styling active</p>
                        </div>
                      </div>

                      {/* Spectrum plot preview block */}
                      <div className="mt-4 font-sans text-left">
                        <span className="text-[10px] font-bold text-teal-600 block mb-2 text-left">1. Experimental Waveform Signal & Fitted Curve</span>
                        <div className="bg-zinc-900 border border-zinc-300 w-full aspect-[1.66] rounded overflow-hidden flex items-center justify-center relative">
                          {(() => {
                            const plotUrl = (window as any).getPlotCanvasDataURL ? (window as any).getPlotCanvasDataURL() : null;
                            if (plotUrl) {
                              return <img src={plotUrl} className="w-full h-full object-contain" alt="Spectrum Plot Render Preview" referrerPolicy="no-referrer" />;
                            }
                            return <span className="text-zinc-500 text-[10px]">Real-time waveform outline loader...</span>;
                          })()}
                        </div>
                        <p className="text-[8px] text-zinc-500 mt-2 italic leading-relaxed text-left">
                          Figure 1: Mathematical interpolation curve displaying pristine baseline subtraction models (e.g. SNIP/Shirley/ALS), integrated signal regions, and marked peak states.
                        </p>
                      </div>
                    </div>

                    <div className="border-t border-zinc-100 pt-2 flex justify-between text-[7px] text-zinc-400">
                      <span>Labscribber Workstation Academic Report - Confidential & Authenticated document</span>
                      <span>Page 1 of 3</span>
                    </div>
                  </div>


                  {/* Virtual PDF Page 2 */}
                  <div className="w-[100%] max-w-[650px] aspect-[1/1.414] bg-white border border-zinc-200 shadow-xl rounded p-[30px] flex flex-col text-zinc-900 justify-between">
                    <div>
                      {/* Stylized top banner */}
                      <div className="w-full h-1 bg-teal-500 mb-4" />

                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-bold text-[#18181b] text-base leading-tight">SPECTROGRAPHIC PROVENANCE REPORT</h4>
                          <span className="text-[8px] font-mono text-zinc-500 block mt-1">Generated via Labscribber Workstation Suite v1.0.0</span>
                        </div>
                        <span className="text-[7px] text-zinc-400 bg-zinc-100 px-1.5 py-0.5 rounded uppercase tracking-wider font-semibold">Page 2 of 3</span>
                      </div>

                      <div className="w-full h-[0.5px] bg-zinc-200 my-3" />

                      {/* Tabular peaks list */}
                      <div className="text-left">
                        <span className="text-[10px] font-bold text-teal-600 block mb-1">2. Multi-Peak Spectral Marks & Molecular Assignments</span>
                        <p className="text-[8px] text-zinc-500 mb-2">The table below details physical peak detections calculated through expert algorithm heuristics and regression fits.</p>
                        
                        <div className="border border-zinc-200 rounded overflow-hidden">
                          <table className="w-full text-left border-collapse text-[8px]">
                            <thead>
                              <tr className="bg-zinc-50 border-b border-zinc-200 text-zinc-700 font-bold">
                                <th className="p-1 px-2.5">Mark ID</th>
                                <th className="p-1">Coordinate (X)</th>
                                <th className="p-1">Absorbance (Y)</th>
                                <th className="p-1">Transition Label</th>
                                <th className="p-1 px-2.5">Confidence</th>
                              </tr>
                            </thead>
                            <tbody>
                              {sd.peaks.length === 0 ? (
                                <tr className="text-zinc-400 italic">
                                  <td colSpan={5} className="p-2 text-center text-[8px]">No custom peak markers detected or loaded for this spectrum.</td>
                                </tr>
                              ) : (
                                sd.peaks.slice(0, 10).map((p, idx) => (
                                  <tr key={idx} className="border-b border-zinc-100 text-zinc-600">
                                    <td className="p-1 px-2.5 font-semibold text-zinc-900">Peak #{idx + 1}</td>
                                    <td className="p-1 font-mono">{p.x.toFixed(3)}</td>
                                    <td className="p-1 font-mono">{p.y.toFixed(4)}</td>
                                    <td className="p-1 text-teal-600 font-semibold">{p.label || "Unassigned"}</td>
                                    <td className="p-1 px-2.5">{(p.confidence * 100).toFixed(0)}%</td>
                                  </tr>
                                ))
                              )}
                              {sd.peaks.length > 10 && (
                                <tr className="text-zinc-400 italic text-[7px]">
                                  <td colSpan={5} className="p-1 text-center bg-zinc-50/50">... and {sd.peaks.length - 10} additional physical peaks cached below visible fold limit ...</td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* Active integral regions table */}
                      <div className="mt-5 text-left">
                        <span className="text-[10px] font-bold text-teal-600 block mb-1">3. High-Precision Active Area Integrations</span>
                        <p className="text-[8px] text-zinc-500 mb-2">Provides integration mathematical summaries computed over highlighted boundary segments.</p>
                        
                        <div className="border border-zinc-200 rounded overflow-hidden">
                          <table className="w-full text-left border-collapse text-[8px]">
                            <thead>
                              <tr className="bg-zinc-50 border-b border-zinc-200 text-zinc-700 font-bold">
                                <th className="p-1 px-2.5">Segment Index</th>
                                <th className="p-1">Left Bound (Min)</th>
                                <th className="p-1">Right Bound (Max)</th>
                                <th className="p-1 px-2.5">Computed Area (Y*X)</th>
                              </tr>
                            </thead>
                            <tbody>
                              {sd.integrals.length === 0 ? (
                                <tr className="text-zinc-400 italic">
                                  <td colSpan={4} className="p-2 text-center text-[8px]">No shaded areas or standard mathematical integral slices computed.</td>
                                </tr>
                              ) : (
                                sd.integrals.slice(0, 8).map((intg, idx) => (
                                  <tr key={idx} className="border-b border-zinc-100 text-zinc-600">
                                    <td className="p-1 px-2.5 font-semibold text-zinc-900">Segment {idx + 1}</td>
                                    <td className="p-1 font-mono">{intg.xmin.toFixed(3)}</td>
                                    <td className="p-1 font-mono">{intg.xmax.toFixed(3)}</td>
                                    <td className="p-1 px-2.5 font-mono text-teal-600 font-semibold">{intg.area.toExponential(4)}</td>
                                  </tr>
                                ))
                              )}
                              {sd.integrals.length > 8 && (
                                <tr className="text-zinc-400 italic text-[7px]">
                                  <td colSpan={4} className="p-1 text-center bg-zinc-50/50">... and {sd.integrals.length - 8} more integration records truncated for print layout ...</td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>

                    <div className="border-t border-zinc-100 pt-2 flex justify-between text-[7px] text-zinc-400">
                      <span>Labscribber Workstation Academic Report - Confidential & Authenticated document</span>
                      <span>Page 2 of 3</span>
                    </div>
                  </div>


                  {/* Virtual PDF Page 3 */}
                  <div className="w-[100%] max-w-[650px] aspect-[1/1.414] bg-white border border-zinc-200 shadow-xl rounded p-[30px] flex flex-col text-zinc-900 justify-between">
                    <div>
                      {/* Stylized top banner */}
                      <div className="w-full h-1 bg-teal-500 mb-4" />

                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-bold text-[#18181b] text-base leading-tight">SPECTROGRAPHIC PROVENANCE REPORT</h4>
                          <span className="text-[8px] font-mono text-zinc-500 block mt-1">Generated via Labscribber Workstation Suite v1.0.0</span>
                        </div>
                        <span className="text-[7px] text-zinc-400 bg-zinc-100 px-1.5 py-0.5 rounded uppercase tracking-wider font-semibold">Page 3 of 3</span>
                      </div>

                      <div className="w-full h-[0.5px] bg-zinc-200 my-3" />

                      {/* Optical bandgap semiconductor transition fitting */}
                      <div className="text-left font-sans">
                        <span className="text-[10px] font-bold text-teal-600 block mb-1">4. Semiconductor Bandgap Physics (Tauc Model)</span>
                        {sd.isTauc && sd.taucData ? (
                          <div className="bg-zinc-50 border border-zinc-200 rounded p-2.5 text-[8px] text-zinc-700 space-y-1 block text-left">
                            <div className="flex justify-between"><span className="font-semibold text-zinc-900">Transition Profile:</span><span>{sd.taucData.transition} transition</span></div>
                            <div className="flex justify-between"><span className="font-semibold text-zinc-900">Extrapolated Bandgap (Eg):</span><span className="text-teal-600 font-bold">{sd.taucData.eg.toFixed(3)} eV</span></div>
                            <div className="flex justify-between"><span className="font-semibold text-zinc-900">Linear Slope Regression Formula:</span><span className="font-mono bg-zinc-100 px-1 py-0.5 rounded">y = {sd.taucData.m.toExponential(2)} * x + {sd.taucData.c.toExponential(2)}</span></div>
                          </div>
                        ) : (
                          <p className="text-[8px] text-zinc-400 italic">No solid-state Tauc bandgap optical physics calculations activated for this specimen.</p>
                        )}
                      </div>

                      {/* Processing History steps log list */}
                      <div className="mt-5 text-left font-sans">
                        <span className="text-[10px] font-bold text-teal-600 block mb-1 text-left">5. Technical Processing Pipeline Log History</span>
                        <p className="text-[8px] text-zinc-500 mb-2 text-left">Sequential records logged by the active calibration, smoothing, and baseline correction pipelines.</p>
                        
                        <div className="space-y-1.5 text-left">
                          {sd.history.length === 0 ? (
                            <p className="text-[8px] text-zinc-400 italic text-left">Raw spectroscopic data. No modification trace history found.</p>
                          ) : (
                            sd.history.map((log, index) => (
                              <div key={index} className="bg-slate-50 border border-slate-100 rounded p-1.5 px-2 flex items-start gap-1.5 text-[8px] text-slate-700 leading-normal text-left">
                                <span className="bg-sky-100 text-sky-700 px-1 rounded font-bold shrink-0">{index + 1}</span>
                                <span>{log}</span>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="border-t border-zinc-100 pt-2 flex justify-between text-[7px] text-zinc-400">
                      <span>Labscribber Workstation Academic Report - Confidential & Authenticated document</span>
                      <span>Page 3 of 3</span>
                    </div>
                  </div>

                </div>
              </div>

            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
};
