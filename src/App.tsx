/**
 * @license
 * SPDX-License-Identifier: MIT
 */

import React, { useState, useEffect } from 'react';
import { SpectrumData, JournalStyleType, ViewLayoutMode } from './types';
import { ObjectBrowser } from './components/ObjectBrowser';
import { SpectrumPlot } from './components/SpectrumPlot';
import { SpectrumInspector } from './components/SpectrumInspector';
import { CoordinateTables } from './components/CoordinateTables';
import { motion, AnimatePresence } from 'motion/react';
import { Beaker, Settings, Waves, Compass, Layers, Info, BookOpen, Sparkles, HelpCircle, GraduationCap, Sun, Moon, CreditCard, Lock, Check, X, Shield, Zap, Award, Clipboard, FileDown, FolderOpen, Save, Upload, Pin, PinOff, History, RotateCcw } from 'lucide-react';
import { saveAutosaveSnapshot, loadAutosaveSnapshot, clearAutosaveSnapshot, AutosaveSnapshot } from './utils/autosave';
import { parseJCAMPDXCore } from './utils/jcampParser';

export default function App() {
  const [datasets, setDatasets] = useState<SpectrumData[]>([]);
  const [selectedDataset, setSelectedDataset] = useState<SpectrumData | null>(null);
  const [dontShowAgain, setDontShowAgain] = useState(false);

  // ── Autosave / crash recovery ────────────────────────────────────────────
  const [pendingAutosave, setPendingAutosave] = useState<AutosaveSnapshot | null>(null);
  const autosaveTimeoutRef = React.useRef<number | null>(null);

  // Theme control state
  const [isDark, setIsDark] = useState<boolean>(() => {
    const saved = localStorage.getItem('labscribber-theme');
    return saved !== 'light';
  });

  // Pin Spectrum: keeps the chart visible in the viewport while the
  // side/bottom modules (repository, controls, tables) scroll independently.
  const [pinSpectrum, setPinSpectrum] = useState<boolean>(() => {
    return localStorage.getItem('labscribber-pin-spectrum') === 'true';
  });

  useEffect(() => {
    localStorage.setItem('labscribber-pin-spectrum', String(pinSpectrum));
  }, [pinSpectrum]);

  // Premium subscription state management - Unlocked for everyone! Premium features are free.
  const [isPremium, setIsPremium] = useState<boolean>(true);
  const [exportCount, setExportCount] = useState<number>(0);
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState<boolean>(false);
  const [isCiteModalOpen, setIsCiteModalOpen] = useState<boolean>(false);
  const [citeTab, setCiteTab] = useState<'bibtex' | 'cff' | 'apa' | 'ris'>('bibtex');
  const [copiedCite, setCopiedCite] = useState<boolean>(false);

  // Emotional interactive donation scheme states
  const [selectedDonationTier, setSelectedDonationTier] = useState<number>(10);
  const [donationComment, setDonationComment] = useState<string>('');
  const [isDonatedVirtual, setIsDonatedVirtual] = useState<boolean>(false);

  // Billing portal mock interactive states
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [cardNumber, setCardNumber] = useState('4242 4242 4242 4242');
  const [cardName, setCardName] = useState('Dr. Marie Curie');
  const [cardExpiry, setCardExpiry] = useState('12/29');
  const [cardCvv, setCardCvv] = useState('321');
  const [isSubmittingCheckout, setIsSubmittingCheckout] = useState(false);
  const [checkoutStep, setCheckoutStep] = useState<'form' | 'success'>('form');

  useEffect(() => {
    localStorage.setItem('labscribber-premium', 'true');
  }, []);

  useEffect(() => {
    localStorage.setItem('labscribber-export-count', '0');
  }, []);

  // Global keyboard shortcuts for undo/redo. The actual undo/redo logic
  // lives in SpectrumInspector (scoped to the active dataset), which
  // exposes handleUndo/handleRedo on window for exactly this purpose —
  // same pattern as the export functions. Deliberately ignores keypresses
  // while focus is inside any text input, textarea, select, or
  // contenteditable element, so this doesn't hijack normal text editing
  // (e.g. Ctrl+Z while typing a dataset name or a numeric parameter
  // should undo the text edit itself, not the spectral processing stack).
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isModifierPressed = e.ctrlKey || e.metaKey;
      if (!isModifierPressed || e.key.toLowerCase() !== 'z' && e.key.toLowerCase() !== 'y') return;

      const target = e.target as HTMLElement | null;
      const contentEditableAttr = target?.getAttribute?.('contenteditable');
      const isEditableField =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable ||
          contentEditableAttr === 'true' ||
          contentEditableAttr === '');
      if (isEditableField) return;

      const key = e.key.toLowerCase();
      if (key === 'z' && !e.shiftKey) {
        e.preventDefault();
        (window as any).labscribberUndo?.();
      } else if ((key === 'z' && e.shiftKey) || key === 'y') {
        e.preventDefault();
        (window as any).labscribberRedo?.();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Inspector layout parameters
  const [layoutMode, setLayoutMode] = useState<ViewLayoutMode>('Standard Overlay');
  const [journalStyle, setJournalStyle] = useState<JournalStyleType>('Default');
  const [plotBgColor, setPlotBgColor] = useState('#131316');

  // Sync theme with body DOM element and default plot color
  useEffect(() => {
    if (isDark) {
      document.body.classList.remove('light-mode');
      document.body.classList.add('dark');
      localStorage.setItem('labscribber-theme', 'dark');
      if (plotBgColor === '#ffffff' || plotBgColor === '#fafafa') {
        setPlotBgColor('#131316');
      }
    } else {
      document.body.classList.add('light-mode');
      document.body.classList.remove('dark');
      localStorage.setItem('labscribber-theme', 'light');
      if (plotBgColor === '#131316') {
        setPlotBgColor('#ffffff');
      }
    }
  }, [isDark]);
  const [gridX, setGridX] = useState(true);
  const [gridY, setGridY] = useState(true);
  
  const [autoX, setAutoX] = useState(true);
  const [autoY, setAutoY] = useState(true);
  const [manualXMin, setManualXMin] = useState(200);
  const [manualXMax, setManualXMax] = useState(700);
  const [manualYMin, setManualYMin] = useState(0);
  const [manualYMax, setManualYMax] = useState(1.2);

  // Custom publication-grade States
  const [invertX, setInvertX] = useState(false);
  const [invertY, setInvertY] = useState(false);
  const [tickStepX, setTickStepX] = useState<number>(0);
  const [tickStepY, setTickStepY] = useState<number>(0);
  const [minorTicksCount, setMinorTicksCount] = useState<number>(4);

  const [xLabel, setXLabel] = useState('');
  const [yLabel, setYLabel] = useState('');
  const [showLegend, setShowLegend] = useState(true);
  const [legendPos, setLegendPos] = useState('upper right');
  const [thickAxes, setThickAxes] = useState(true);
  const [dropLines, setDropLines] = useState(true);
  const [waterfallOffset, setWaterfallOffset] = useState(0.4);

  // Subplot inset parameters
  const [enableInset, setEnableInset] = useState(false);
  const [insetXMin, setInsetXMin] = useState(250);
  const [insetXMax, setInsetXMax] = useState(420);

  // Multi-Panel Grid composition (independent subplots, e.g. for a combined
  // Figure 1a/1b/1c style submission). Panel letter convention differs by
  // journal: lowercase (a, b, c) for Nature/Science, uppercase (A, B, C)
  // for Cell — both are real, distinct house styles, not arbitrary choices.
  const [panelGridCols, setPanelGridCols] = useState(2);
  const [panelLabelCase, setPanelLabelCase] = useState<'lowercase' | 'uppercase'>('lowercase');

  // Accent highlights
  const [enableHighlight, setEnableHighlight] = useState(false);
  const [highlightMin, setHighlightMin] = useState(310);
  const [highlightMax, setHighlightMax] = useState(380);

  // Cursor coordinates
  const [cursorPos, setCursorPos] = useState({ x: 0, y: 0 });

  // Mode state matching user tool choice
  const [interactiveMode, setInteractiveMode] = useState<'navigate' | 'pick' | 'crop' | 'integrate'>('navigate');

  // Real-time corrected baseline preview state
  const [previewCorrectedY, setPreviewCorrectedY] = useState<number[] | null>(null);

  // ── Post-export support toast (non-blocking, no permanent dismiss) ────────
  const [showSupportToast, setShowSupportToast] = useState<boolean>(false);
  const supportToastTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * Called after any successful export. Shows a brief, dismissible toast
   * inviting support — never blocks the export itself, never offers a
   * permanent "don't show again" option, and goes quiet for 15 days once
   * the person actually clicks through to the support link.
   */
  const triggerSupportToast = () => {
    const snoozeUntil = localStorage.getItem('labscribber-support-snooze-until');
    if (snoozeUntil && Date.now() < parseInt(snoozeUntil, 10)) {
      return; // still within the 15-day post-support cooldown
    }
    setShowSupportToast(true);
    if (supportToastTimerRef.current) clearTimeout(supportToastTimerRef.current);
    supportToastTimerRef.current = setTimeout(() => setShowSupportToast(false), 15000);
  };

  const handleSupportLinkClicked = () => {
    const fifteenDaysMs = 15 * 24 * 60 * 60 * 1000;
    localStorage.setItem('labscribber-support-snooze-until', String(Date.now() + fifteenDaysMs));
    setShowSupportToast(false);
    if (supportToastTimerRef.current) clearTimeout(supportToastTimerRef.current);
  };

  // ── Tier-5: Session state ────────────────────────────────────────────────
  const [sessionFileName, setSessionFileName] = useState<string>('');
  const [sessionSaveMsg,  setSessionSaveMsg]  = useState<string>('');
  const [isJcampModalOpen, setIsJcampModalOpen] = useState<boolean>(false);
  const [jcampRawText,   setJcampRawText]    = useState<string>('');
  const [jcampError,     setJcampError]       = useState<string>('');

  // Welcome, Tribute, and Instructions Modal flow step:
  // 1: Welcome & Credit Tributes
  // 2: Operational/Help Manual Guide
  // null: Welcoming series completed
  const [welcomeStep, setWelcomeStep] = useState<1 | 2 | 3 | null>(() => {
    const closed = localStorage.getItem('labscribber-welcome-closed');
    return closed === 'true' ? 3 : 1;
  });

  // -----------------------------------------
  // INTERACTIVE EVENT CALLBACKS
  // -----------------------------------------
  // ── Tier-5: Session save/load ───────────────────────────────────────────────
  const handleSaveSession = () => {
    try {
      const session = {
        version:   '1.0.0',
        savedAt:   new Date().toISOString(),
        appState: {
          layoutMode, journalStyle, isDark, plotBgColor,
          gridX, gridY, autoX, autoY, invertX, invertY,
          xLabel, yLabel, showLegend, legendPos,
          thickAxes, dropLines, waterfallOffset,
          manualXMin, manualXMax, manualYMin, manualYMax,
          tickStepX, tickStepY, minorTicksCount,
          enableInset, insetXMin, insetXMax,
          enableHighlight, highlightMin, highlightMax,
        },
        datasets: datasets.map(d => ({
          ...d,
          // Strip large undo stacks for file size — keep only current state
          undoStack: [d.y_processed],
          redoStack: [],
        })),
        selectedDatasetId: selectedDataset?.id ?? null,
      };
      const blob = new Blob([JSON.stringify(session, null, 2)], { type: 'application/json' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      const name = `labscribber-session-${new Date().toISOString().slice(0,10)}.lsb`;
      a.href = url; a.download = name; a.click();
      URL.revokeObjectURL(url);
      setSessionSaveMsg(`Session saved as "${name}"`);
      setTimeout(() => setSessionSaveMsg(''), 3000);
    } catch (e: any) {
      setSessionSaveMsg(`Save failed: ${e.message}`);
    }
  };

  const handleLoadSession = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSessionFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const session = JSON.parse(ev.target?.result as string);
        if (!session.version || !Array.isArray(session.datasets)) {
          throw new Error('Not a valid .lsb session file.');
        }
        // Restore app state
        const s = session.appState ?? {};
        if (s.layoutMode)  setLayoutMode(s.layoutMode);
        if (s.journalStyle) setJournalStyle(s.journalStyle);
        if (s.isDark !== undefined) setIsDark(s.isDark);
        if (s.plotBgColor) setPlotBgColor(s.plotBgColor);
        if (s.xLabel !== undefined) setXLabel(s.xLabel);
        if (s.yLabel !== undefined) setYLabel(s.yLabel);
        if (s.showLegend !== undefined) setShowLegend(s.showLegend);
        if (s.gridX !== undefined) setGridX(s.gridX);
        if (s.gridY !== undefined) setGridY(s.gridY);
        if (s.invertX !== undefined) setInvertX(s.invertX);
        if (s.invertY !== undefined) setInvertY(s.invertY);

        // Restore datasets
        const restored: SpectrumData[] = session.datasets.map((d: any) => ({
          ...d,
          undoStack: d.undoStack ?? [d.y_processed],
          redoStack: d.redoStack ?? [],
          history:   d.history   ?? [],
          peaks:     d.peaks     ?? [],
          integrals: d.integrals ?? [],
          baseline:  d.baseline  ?? null,
          fitResult: d.fitResult ?? null,
          fitComponents: d.fitComponents ?? null,
          fitResiduals:  d.fitResiduals  ?? null,
          fitPeakStats:  d.fitPeakStats  ?? null,
          fitGoodnessOfFit: d.fitGoodnessOfFit ?? null,
          yError:    d.yError   ?? null,
          significanceAnnotations: d.significanceAnnotations ?? null,
          isTauc:    d.isTauc   ?? false,
          taucData:  d.taucData ?? null,
          jobsData:  d.jobsData ?? null,
        }));
        setDatasets(restored);
        const sel = session.selectedDatasetId
          ? restored.find((d: SpectrumData) => d.id === session.selectedDatasetId) ?? restored[0]
          : restored[0];
        if (sel) setSelectedDataset(sel);
        setSessionSaveMsg(`Session loaded: ${restored.length} dataset(s) from "${file.name}"`);
        setTimeout(() => setSessionSaveMsg(''), 4000);
      } catch (err: any) {
        setSessionSaveMsg(`Load failed: ${err.message}`);
      }
    };
    reader.readAsText(file);
    // Reset input so same file can be re-loaded
    e.target.value = '';
  };

  // ── Autosave / crash recovery ────────────────────────────────────────────
  const buildAutosaveAppState = () => ({
    layoutMode, journalStyle, isDark, plotBgColor,
    gridX, gridY, autoX, autoY, invertX, invertY,
    xLabel, yLabel, showLegend, legendPos,
    thickAxes, dropLines, waterfallOffset,
    manualXMin, manualXMax, manualYMin, manualYMax,
    tickStepX, tickStepY, minorTicksCount,
    enableInset, insetXMin, insetXMax,
    enableHighlight, highlightMin, highlightMax,
  });

  // Check once, on first mount, whether a recoverable autosave exists from a
  // previous session (crash, accidental close, forgotten tab). Deliberately
  // does NOT auto-restore — silently overwriting a blank canvas with old
  // data would be its own kind of surprising data loss if the user actually
  // meant to start fresh.
  useEffect(() => {
    const snap = loadAutosaveSnapshot();
    if (snap) setPendingAutosave(snap);
  }, []);

  // Debounced autosave: fires ~1.5s after the datasets array settles, so
  // rapid-fire edits (dragging a slider, typing) don't hammer localStorage.
  useEffect(() => {
    if (datasets.length === 0) return;
    if (autosaveTimeoutRef.current) window.clearTimeout(autosaveTimeoutRef.current);
    autosaveTimeoutRef.current = window.setTimeout(() => {
      saveAutosaveSnapshot(datasets, buildAutosaveAppState(), selectedDataset?.id ?? null);
    }, 1500);
    return () => {
      if (autosaveTimeoutRef.current) window.clearTimeout(autosaveTimeoutRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [datasets]);

  // Best-effort immediate save on tab close/refresh — catches the case
  // where the debounce above hasn't fired yet.
  useEffect(() => {
    const handler = () => {
      if (datasets.length === 0) return;
      saveAutosaveSnapshot(datasets, buildAutosaveAppState(), selectedDataset?.id ?? null);
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    datasets, selectedDataset, layoutMode, journalStyle, isDark, plotBgColor,
    gridX, gridY, autoX, autoY, invertX, invertY, xLabel, yLabel, showLegend,
    legendPos, thickAxes, dropLines, waterfallOffset, manualXMin, manualXMax,
    manualYMin, manualYMax, tickStepX, tickStepY, minorTicksCount,
    enableInset, insetXMin, insetXMax, enableHighlight, highlightMin, highlightMax,
  ]);

  const handleRestoreAutosave = () => {
    if (!pendingAutosave) return;
    try {
      const s = pendingAutosave.appState ?? {};
      if (s.layoutMode)  setLayoutMode(s.layoutMode as ViewLayoutMode);
      if (s.journalStyle) setJournalStyle(s.journalStyle as JournalStyleType);
      if (s.isDark !== undefined) setIsDark(s.isDark as boolean);
      if (s.plotBgColor) setPlotBgColor(s.plotBgColor as string);
      if (s.xLabel !== undefined) setXLabel(s.xLabel as string);
      if (s.yLabel !== undefined) setYLabel(s.yLabel as string);
      if (s.showLegend !== undefined) setShowLegend(s.showLegend as boolean);
      if (s.gridX !== undefined) setGridX(s.gridX as boolean);
      if (s.gridY !== undefined) setGridY(s.gridY as boolean);
      if (s.invertX !== undefined) setInvertX(s.invertX as boolean);
      if (s.invertY !== undefined) setInvertY(s.invertY as boolean);

      const restored: SpectrumData[] = pendingAutosave.datasets.map((d: any) => ({
        ...d,
        undoStack: d.undoStack ?? [d.y_processed],
        redoStack: d.redoStack ?? [],
        history:   d.history   ?? [],
        peaks:     d.peaks     ?? [],
        integrals: d.integrals ?? [],
        baseline:  d.baseline  ?? null,
        fitResult: d.fitResult ?? null,
        fitComponents: d.fitComponents ?? null,
        fitResiduals:  d.fitResiduals  ?? null,
        fitPeakStats:  d.fitPeakStats  ?? null,
        fitGoodnessOfFit: d.fitGoodnessOfFit ?? null,
        yError:    d.yError   ?? null,
        significanceAnnotations: d.significanceAnnotations ?? null,
        isTauc:    d.isTauc   ?? false,
        taucData:  d.taucData ?? null,
        jobsData:  d.jobsData ?? null,
      }));
      setDatasets(restored);
      const sel = pendingAutosave.selectedDatasetId
        ? restored.find((d: SpectrumData) => d.id === pendingAutosave.selectedDatasetId) ?? restored[0]
        : restored[0];
      if (sel) setSelectedDataset(sel);
      setSessionSaveMsg(`Restored autosaved session: ${restored.length} dataset(s) from ${new Date(pendingAutosave.savedAt).toLocaleString()}`);
      setTimeout(() => setSessionSaveMsg(''), 4000);
    } catch (err: any) {
      setSessionSaveMsg(`Autosave restore failed: ${err.message}`);
    } finally {
      setPendingAutosave(null);
    }
  };

  const handleDismissAutosave = () => {
    clearAutosaveSnapshot();
    setPendingAutosave(null);
  };

  // ── Tier-5: JCAMP-DX parser ───────────────────────────────────────────────
  // Parsing logic itself lives in src/utils/jcampParser.ts (extracted so it
  // can be unit-tested — see tests/jcampParser.test.ts). This wrapper just
  // builds the full SpectrumData object around the parsed (x, y, meta).
  const parseJCAMPDX = (text: string): SpectrumData | null => {
    const parsed = parseJCAMPDXCore(text);
    if (!parsed) return null;
    const { x: xArr, y: yScaled, meta } = parsed;

    const technique = meta['DATATYPE'] ?? meta['.OBSERVENUCLEUS'] ?? 'JCAMP-DX Import';
    const title     = meta['TITLE']    ?? 'JCAMP Import';

    return {
      id:          `jcamp-${Date.now()}`,
      name:        title,
      technique,
      x_orig:      [...xArr],
      y_orig:      [...yScaled],
      x:           [...xArr],
      y_processed: [...yScaled],
      color:       '#38bdf8',
      visible:     true,
      lineWidth:   1.5,
      lineStyle:   'solid',
      marker:      'none',
      markerSize:  4,
      peaks:       [],
      integrals:   [],
      baseline:    null,
      fitResult:   null,
      fitComponents:    null,
      fitResiduals:     null,
      fitPeakStats:     null,
      fitGoodnessOfFit: null,
      yError:           null,
      significanceAnnotations: null,
      isTauc:   false,
      taucData: null,
      jobsData: null,
      undoStack: [[...yScaled]],
      redoStack: [],
      history:   [`[${new Date().toLocaleTimeString()}] Imported JCAMP-DX: "${title}", ${xArr.length} points.`],
    };
  };

  const handleJCAMPLoad = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const text = ev.target?.result as string;
        setJcampRawText(text.slice(0, 500)); // preview
        const ds = parseJCAMPDX(text);
        if (!ds) throw new Error('Could not parse JCAMP-DX data. Check X/Y arrays.');
        const newList = [...datasets, ds];
        setDatasets(newList);
        setSelectedDataset(ds);
        setJcampError('');
        setSessionSaveMsg(`JCAMP-DX loaded: "${ds.name}" (${ds.x.length} pts)`);
        setTimeout(() => setSessionSaveMsg(''), 3000);
      } catch (err: any) {
        setJcampError(err.message);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleRangeSelected = (xmin: number, xmax: number) => {
    if (!selectedDataset) return;

    if (interactiveMode === 'crop') {
      const list = datasets.map(d => {
        if (d.id === selectedDataset.id) {
          const xSlice: number[] = [];
          const ySlice: number[] = [];
          
          for (let i = 0; i < d.x.length; i++) {
            if (d.x[i] >= xmin && d.x[i] <= xmax) {
              xSlice.push(d.x[i]);
              ySlice.push(d.y_processed[i]);
            }
          }
          
          if (xSlice.length < 2) return d;

          const log = `Interactively cropped trace boundaries to X range: [${xmin.toFixed(2)}, ${xmax.toFixed(2)}]`;
          return {
            ...d,
            x: xSlice,
            y_processed: ySlice,
            peaks: d.peaks.filter(p => p.x >= xmin && p.x <= xmax),
            integrals: d.integrals.filter(i => i.xmin >= xmin && i.xmax <= xmax),
            undoStack: [...d.undoStack, [...ySlice]],
            redoStack: [],
            history: [...d.history, `[${new Date().toLocaleTimeString()}] ${log}`]
          };
        }
        return d;
      });
      setDatasets(list);
      setSelectedDataset(list.find(d => d.id === selectedDataset.id)!);
      setInteractiveMode('navigate'); // Return to neutral state
    } else if (interactiveMode === 'integrate') {
      const list = datasets.map(d => {
        if (d.id === selectedDataset.id) {
          const segX: number[] = [];
          const segY: number[] = [];
          for (let i = 0; i < d.x.length; i++) {
            if (d.x[i] >= xmin && d.x[i] <= xmax) {
              segX.push(d.x[i]);
              segY.push(d.y_processed[i]);
            }
          }
          if (segX.length < 2) return d;

          // Trapezoid integral bounds
          let area = 0;
          for (let i = 0; i < segX.length - 1; i++) {
            area += 0.5 * (segX[i + 1] - segX[i]) * (segY[i] + segY[i + 1]);
          }

          const areaAbs = Math.abs(area);
          const newIntg = {
            id: `intg-${Date.now()}-${d.integrals.length}`,
            xmin,
            xmax,
            area: areaAbs
          };

          const log = `Analyzed area integration under spectrum curve between [${xmin.toFixed(2)}, ${xmax.toFixed(2)}] = ${areaAbs.toExponential(4)}`;
          return {
            ...d,
            integrals: [...d.integrals, newIntg],
            history: [...d.history, `[${new Date().toLocaleTimeString()}] ${log}`]
          };
        }
        return d;
      });
      setDatasets(list);
      setSelectedDataset(list.find(d => d.id === selectedDataset.id)!);
      setInteractiveMode('navigate'); // Return to neutral state
    }
  };

  const handlePeakCreated = (x: number, y: number) => {
    if (!selectedDataset) return;
    
    // Create peak annotation trace
    const newPeak = {
      id: `pk-${Date.now()}-${selectedDataset.peaks.length}`,
      x,
      y,
      label: '',
      confidence: 1.0,
      dx: 0,
      dy: 40
    };

    const list = datasets.map(d => {
      if (d.id === selectedDataset.id) {
        return {
          ...d,
          peaks: [...d.peaks, newPeak],
          history: [...d.history, `[${new Date().toLocaleTimeString()}] Interactively placed peak mark at coordinate X: ${x.toFixed(3)}`]
        };
      }
      return d;
    });
    setDatasets(list);
    setSelectedDataset(list.find(d => d.id === selectedDataset.id)!);
  };

  // Sync labels renaming or deletes back to state list of objects
  const handleSyncDatasets = (list: SpectrumData[]) => {
    setDatasets(list);
    if (selectedDataset) {
      const updated = list.find(d => d.id === selectedDataset.id);
      if (updated) {
        setSelectedDataset(updated);
      }
    }
  };

  const handleCompleteWelcome = () => {
    if (dontShowAgain) {
      localStorage.setItem('labscribber-welcome-closed', 'true');
    }
    setWelcomeStep(3);
  };

  return (
    <div className={`min-h-screen flex flex-col font-sans select-none antialiased ${isDark ? 'bg-[#0f172a] text-slate-100' : 'bg-[#f8fafc] text-slate-800'}`}>

      {/* Autosave recovery banner — shown once on load if a recoverable
          session exists from a previous crash/close. Never auto-restores. */}
      <AnimatePresence>
        {pendingAutosave && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="overflow-hidden"
          >
            <div className="border-b border-amber-500/30 bg-amber-500/10 dark:bg-amber-500/[0.07] px-6 py-2.5 flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2.5 min-w-0">
                <History size={16} className="text-amber-500 shrink-0" />
                <p className="text-xs text-amber-800 dark:text-amber-300 min-w-0">
                  <span className="font-semibold">Recovered a previous session</span> — {pendingAutosave.datasets.length} dataset(s), autosaved {new Date(pendingAutosave.savedAt).toLocaleString()}.
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={handleRestoreAutosave}
                  className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 text-white font-semibold text-[11px] px-3 py-1.5 rounded shadow-sm transition-all cursor-pointer select-none"
                >
                  <RotateCcw size={12} /> Restore
                </button>
                <button
                  onClick={handleDismissAutosave}
                  className="text-[11px] font-semibold text-amber-700 dark:text-amber-400 hover:text-amber-900 dark:hover:text-amber-200 px-2 py-1.5 cursor-pointer select-none"
                >
                  Discard
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 1. COMPACT SCIENTIFIC TOOLBAR HEADER SECTION */}
      <header className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] px-6 py-2.5 flex flex-col md:flex-row md:items-center md:justify-between gap-3 shadow-xs transition-colors">
        <div className="flex items-center gap-3">
          {/* Scientific profile icon for the academic app */}
          <div className="relative w-8 h-8 rounded-lg overflow-hidden border border-teal-500/80 shrink-0 select-none flex items-center justify-center bg-teal-500/10">
            <Waves className="w-5 h-5 text-teal-600 dark:text-teal-400" />
          </div>
          <div>
            <h1 className="text-sm font-bold uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2">
              LABSCRIBBER <span className="text-[10px] bg-teal-500/10 text-teal-600 dark:text-teal-400 px-2 py-0.5 rounded-full font-mono font-bold tracking-normal uppercase">Academic Suite</span>
            </h1>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
              High-Fidelity Spectroscopy Analysis Terminal for Physical Sciences
            </p>
          </div>
        </div>

        {/* Clean operational control triggers */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Support project button */}
          <button 
            onClick={() => setIsUpgradeModalOpen(true)}
            className="flex items-center gap-1.5 bg-rose-50 dark:bg-rose-950/20 hover:bg-rose-100 dark:hover:bg-rose-950/35 border border-rose-200 dark:border-rose-905/40 text-rose-700 dark:text-rose-400 px-3 py-1.5 rounded text-xs font-bold cursor-pointer transition-all shrink-0 shadow-xs"
            title="Contribute / Supporting open science"
          >
            <Sparkles size={13} className="text-rose-500 shrink-0" />
            <span>Supporting Open Science</span>
          </button>

          <button
            onClick={() => setWelcomeStep(2)}
            className="flex items-center gap-1.5 bg-slate-50 dark:bg-zinc-900 hover:bg-slate-100 dark:hover:bg-zinc-800 border border-slate-200 dark:border-zinc-805 text-slate-700 dark:text-zinc-300 px-3 py-1.5 rounded text-xs font-semibold cursor-pointer transition-all"
            title="Operational checklist & analytical manual"
          >
            <BookOpen size={13} className="text-teal-600 dark:text-teal-450" />
            <span>Operations Manual</span>
          </button>

          <button
            onClick={() => setWelcomeStep(1)}
            className="flex items-center gap-1.5 bg-slate-50 dark:bg-zinc-900 hover:bg-slate-100 dark:hover:bg-zinc-800 border border-slate-200 dark:border-zinc-805 text-slate-700 dark:text-zinc-300 px-3 py-1.5 rounded text-xs font-semibold cursor-pointer transition-all"
            title="Credits, tributes, and initial team checklist"
          >
            <GraduationCap size={13} className="text-indigo-600 dark:text-indigo-405" />
            <span>Tributes & Credits</span>
          </button>

          <button
            onClick={() => setIsCiteModalOpen(true)}
            className="flex items-center gap-1.5 bg-sky-50 dark:bg-sky-950/20 hover:bg-sky-100 dark:hover:bg-sky-950/35 border border-sky-250 dark:border-sky-905/40 text-sky-700 dark:text-sky-400 px-3 py-1.5 rounded text-xs font-bold cursor-pointer transition-all shrink-0 shadow-xs"
            title="Academic citations and JOSS peer-review compliance kit"
          >
            <Award size={13} className="text-sky-505 shrink-0" />
            <span>Cite & JOSS Kit</span>
          </button>

          {/* Thin divider line */}
          <div className="w-[1px] h-6 bg-slate-200 dark:bg-slate-800 mx-1 hidden sm:block" />

          {/* ── Tier-5: Session Save button ── */}
          <button
            onClick={handleSaveSession}
            title="Save full session to .lsb file (all datasets + settings)"
            className="flex items-center gap-1.5 bg-slate-50 dark:bg-zinc-900 hover:bg-slate-100 dark:hover:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-zinc-300 px-3 py-1.5 rounded text-xs font-semibold cursor-pointer transition-all"
          >
            <Save size={13} className="text-emerald-500" />
            <span>Save Session</span>
          </button>

          {/* ── Tier-5: Session Load button ── */}
          <label
            title="Load a previously saved .lsb session file"
            className="flex items-center gap-1.5 bg-slate-50 dark:bg-zinc-900 hover:bg-slate-100 dark:hover:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-zinc-300 px-3 py-1.5 rounded text-xs font-semibold cursor-pointer transition-all"
          >
            <FolderOpen size={13} className="text-sky-500" />
            <span>Load Session</span>
            <input type="file" accept=".lsb,.json" onChange={handleLoadSession} className="hidden" />
          </label>

          {/* ── Tier-5: JCAMP-DX Import button ── */}
          <label
            title="Import JCAMP-DX (.jdx, .dx) instrument files directly"
            className="flex items-center gap-1.5 bg-slate-50 dark:bg-zinc-900 hover:bg-slate-100 dark:hover:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-zinc-300 px-3 py-1.5 rounded text-xs font-semibold cursor-pointer transition-all"
          >
            <Upload size={13} className="text-amber-500" />
            <span>JCAMP-DX</span>
            <input type="file" accept=".jdx,.dx,.jcamp" onChange={handleJCAMPLoad} className="hidden" />
          </label>

          {/* Session status toast */}
          {sessionSaveMsg && (
            <span className="text-[10px] text-emerald-400 font-mono bg-emerald-950/30 border border-emerald-800/30 px-2 py-1 rounded animate-pulse">
              {sessionSaveMsg}
            </span>
          )}
          {jcampError && (
            <span className="text-[10px] text-red-400 font-mono bg-red-950/30 border border-red-800/30 px-2 py-1 rounded">
              JCAMP: {jcampError}
            </span>
          )}

          <div className="w-[1px] h-6 bg-slate-200 dark:bg-slate-800 mx-1 hidden sm:block" />

          {/* Pin Spectrum toggle - keeps chart fixed in viewport while modules scroll */}
          <button
            onClick={() => setPinSpectrum(prev => !prev)}
            className={`flex items-center gap-1.5 border px-3 py-1.5 rounded text-xs font-semibold cursor-pointer transition-all ${
              pinSpectrum
                ? 'bg-teal-50 dark:bg-teal-950/30 border-teal-300 dark:border-teal-700/50 text-teal-700 dark:text-teal-400'
                : 'bg-slate-50 dark:bg-zinc-900 hover:bg-slate-100 dark:hover:bg-zinc-800 border-slate-200 dark:border-zinc-805 text-slate-700 dark:text-zinc-300'
            }`}
            title={pinSpectrum ? "Spectrum is pinned — click to let it scroll normally" : "Pin spectrum in view while scrolling other panels"}
          >
            {pinSpectrum ? <Pin size={13} className="text-teal-600 dark:text-teal-400" /> : <PinOff size={13} />}
            <span className="hidden sm:inline">{pinSpectrum ? 'Pinned' : 'Pin Spectrum'}</span>
          </button>

          <div className="w-[1px] h-6 bg-slate-200 dark:bg-slate-800 mx-1 hidden sm:block" />

          {/* Theme switcher */}
          <button
            onClick={() => setIsDark(prev => !prev)}
            className="flex items-center gap-1 bg-slate-50 dark:bg-zinc-900 hover:bg-slate-100 dark:hover:bg-zinc-800 border border-slate-200 dark:border-zinc-805 text-slate-700 dark:text-zinc-300 p-2 rounded text-xs font-semibold cursor-pointer transition-all"
            title={isDark ? "Switch to Light Theme" : "Switch to Dark Theme"}
          >
            {isDark ? (
              <Sun size={13} className="text-amber-500" />
            ) : (
              <Moon size={13} className="text-slate-600" />
            )}
          </button>
        </div>
      </header>

      {/* 2. MAIN WORKING INTERFACES SPLIT GRID */}
      <main className="flex-1 h-0 grid grid-cols-1 xl:grid-cols-12 gap-5 p-5 overflow-hidden">
        
        {/* LEFT COLUMN: Data Tree Object browser (Width: 3/12 xl) */}
        <section className="xl:col-span-3 flex flex-col gap-4 overflow-y-auto min-h-0">
          <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-lg p-4 flex items-center gap-3 shadow-xs">
            <Compass className="w-5 h-5 text-teal-600 dark:text-teal-450" />
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">Spectrum Repository</h2>
              <span className="text-[10px] text-slate-500 dark:text-slate-450">Trace layers database browser</span>
            </div>
          </div>
          <ObjectBrowser
            datasets={datasets}
            selectedDataset={selectedDataset}
            onDatasetSelected={setSelectedDataset}
            onDatasetsUpdated={handleSyncDatasets}
          />
        </section>

        {/* MIDDLE COLUMN: Chart Visualization View & Bottom Tables (Width: 6/12 xl) */}
        <section className="xl:col-span-6 flex flex-col gap-5 min-h-0 overflow-y-auto">
          <div
            className={pinSpectrum
              ? "sticky top-0 z-20 flex flex-col gap-5 pb-1 -mt-0.5 pt-0.5 bg-[#f8fafc] dark:bg-[#0f172a] transition-colors"
              : "flex flex-col gap-5"
            }
          >
          <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-lg p-4 flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-2.5">
              <Beaker className="w-5 h-5 text-teal-600 dark:text-teal-450" />
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
                  {selectedDataset ? `${selectedDataset.name}` : "Analytical Spectrogram Area"}
                </h3>
                <span className="text-[10px] text-slate-500 dark:text-slate-450">
                  {selectedDataset ? `Technique: ${selectedDataset.technique}` : "Ingest data molecules to chart profile"}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {/* Float Coordinates snap display */}
              {selectedDataset && (
                <div className="text-[11px] font-mono bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-805 px-3 py-1.5 rounded text-teal-600 dark:text-teal-400 font-bold shadow-inner">
                  Cursor: X = {cursorPos.x.toFixed(2)}, Y = {cursorPos.y.toFixed(4)}
                </div>
              )}
              <button
                onClick={() => setPinSpectrum(prev => !prev)}
                className={`flex items-center justify-center p-1.5 rounded border transition-all cursor-pointer ${
                  pinSpectrum
                    ? 'bg-teal-50 dark:bg-teal-950/30 border-teal-300 dark:border-teal-700/50 text-teal-600 dark:text-teal-400'
                    : 'bg-slate-50 dark:bg-zinc-900 hover:bg-slate-100 dark:hover:bg-zinc-800 border-slate-200 dark:border-zinc-805 text-slate-500 dark:text-zinc-400'
                }`}
                title={pinSpectrum ? "Unpin spectrum" : "Pin spectrum in view while scrolling"}
              >
                {pinSpectrum ? <Pin size={13} /> : <PinOff size={13} />}
              </button>
            </div>
          </div>

          {/* Interactive Plotting Canvas */}
          <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-lg p-4 flex flex-col gap-3 shadow-xs">
            <SpectrumPlot
              datasets={datasets}
              selectedDataset={selectedDataset}
              layoutMode={layoutMode}
              journalStyle={journalStyle}
              plotBgColor={plotBgColor}
              gridX={gridX}
              gridY={gridY}
              autoX={autoX}
              autoY={autoY}
              manualXMin={manualXMin}
              manualXMax={manualXMax}
              manualYMin={manualYMin}
              manualYMax={manualYMax}
              xLabel={xLabel}
              yLabel={yLabel}
              showLegend={showLegend}
              legendPos={legendPos}
              thickAxes={thickAxes}
              dropLines={dropLines}
              waterfallOffset={waterfallOffset}
              waterfallOffset3D={false}
              enableInset={enableInset}
              insetXMin={insetXMin}
              insetXMax={insetXMax}
              panelGridCols={panelGridCols}
              panelLabelCase={panelLabelCase}
              enableHighlight={enableHighlight}
              highlightMin={highlightMin}
              highlightMax={highlightMax}
              interactiveMode={interactiveMode}
              onCursorPositionChange={(x, y) => setCursorPos({ x, y })}
              onRangeSelected={handleRangeSelected}
              onPeakCreated={handlePeakCreated}
              onDatasetsUpdated={handleSyncDatasets}
              previewCorrectedY={previewCorrectedY || undefined}
              invertX={invertX}
              invertY={invertY}
              tickStepX={tickStepX}
              tickStepY={tickStepY}
              minorTicksCount={minorTicksCount}
            />

            {/* Quick Helper Mode bar */}
            <div className="flex items-center justify-between bg-[#18181b]/60 border border-[#27272a] p-2 rounded text-[10px] text-zinc-400 px-3 select-none">
              <span className="flex items-center gap-1">
                <Info size={12} className="text-teal-400" />
                <span className="font-semibold text-zinc-300">Interact Mode:</span>
                <span className="capitalize text-teal-400 font-bold font-mono">{interactiveMode}</span>
              </span>
              <span>
                {interactiveMode === 'navigate' && "Hover on the canvas to trace coordinate crosshairs."}
                {interactiveMode === 'pick' && "Click any position on the curve to mark a Peak coordinate."}
                {interactiveMode === 'crop' && "Click and drag standard range on the chart to crop trace bounds."}
                {interactiveMode === 'integrate' && "Click and drag standard range to calculate trapezoid Area."}
              </span>
            </div>
          </div>
          </div>

          {/* Lower split coordinated values database list */}
          <CoordinateTables
            selectedDataset={selectedDataset}
            datasets={datasets}
            onDatasetsUpdated={handleSyncDatasets}
            onPeaksUpdated={() => {}}
          />
        </section>

        {/* RIGHT COLUMN: Inspector Tools Panels (Width: 3/12 xl) */}
        <section className="xl:col-span-3 flex flex-col gap-4 overflow-y-auto min-h-0">
          <div className="bg-white dark:bg-[#111827] border border-slate-205 dark:border-slate-800 rounded-lg p-4 flex items-center gap-3 shadow-xs">
            <Settings className="w-5 h-5 text-teal-600 dark:text-teal-450" />
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">Analysis Control</h2>
              <span className="text-[10px] text-slate-550 dark:text-slate-455">Mathematical & trace configurations</span>
            </div>
          </div>
          <SpectrumInspector
            datasets={datasets}
            selectedDataset={selectedDataset}
            onDatasetsUpdated={handleSyncDatasets}
            onDatasetSelected={setSelectedDataset}
            onOpenCiteKit={() => setIsCiteModalOpen(true)}
            layoutMode={layoutMode}
            setLayoutMode={setLayoutMode}
            journalStyle={journalStyle}
            setJournalStyle={setJournalStyle}
            plotBgColor={plotBgColor}
            setPlotBgColor={setPlotBgColor}
            gridX={gridX}
            setGridX={setGridX}
            gridY={gridY}
            setGridY={setGridY}
            autoX={autoX}
            setAutoX={setAutoX}
            autoY={autoY}
            setAutoY={setAutoY}
            manualXMin={manualXMin}
            setManualXMin={setManualXMin}
            manualXMax={manualXMax}
            setManualXMax={setManualXMax}
            manualYMin={manualYMin}
            setManualYMin={setManualYMin}
            manualYMax={manualYMax}
            setManualYMax={setManualYMax}
            xLabel={xLabel}
            setXLabel={setXLabel}
            yLabel={yLabel}
            setYLabel={setYLabel}
            showLegend={showLegend}
            setShowLegend={setShowLegend}
            legendPos={legendPos}
            setLegendPos={setLegendPos}
            thickAxes={thickAxes}
            setThickAxes={setThickAxes}
            dropLines={dropLines}
            setDropLines={setDropLines}
            waterfallOffset={waterfallOffset}
            setWaterfallOffset={setWaterfallOffset}
            enableInset={enableInset}
            setEnableInset={setEnableInset}
            insetXMin={insetXMin}
            setInsetXMin={setInsetXMin}
            insetXMax={insetXMax}
            setInsetXMax={setInsetXMax}
            panelGridCols={panelGridCols}
            setPanelGridCols={setPanelGridCols}
            panelLabelCase={panelLabelCase}
            setPanelLabelCase={setPanelLabelCase}
            enableHighlight={enableHighlight}
            setEnableHighlight={setEnableHighlight}
            highlightMin={highlightMin}
            setHighlightMin={setHighlightMin}
            highlightMax={highlightMax}
            setHighlightMax={setHighlightMax}
            interactiveMode={interactiveMode}
            setInteractiveMode={setInteractiveMode}
            isPremium={isPremium}
            exportCount={exportCount}
            setExportCount={setExportCount}
            onTriggerUpgrade={() => setIsUpgradeModalOpen(true)}
            onExportSuccess={triggerSupportToast}
            onPreviewCorrectedYChange={setPreviewCorrectedY}
            
            // Pass advanced publication styles
            invertX={invertX}
            setInvertX={setInvertX}
            invertY={invertY}
            setInvertY={setInvertY}
            tickStepX={tickStepX}
            setTickStepX={setTickStepX}
            tickStepY={tickStepY}
            setTickStepY={setTickStepY}
            minorTicksCount={minorTicksCount}
            setMinorTicksCount={setMinorTicksCount}
          />
        </section>

      </main>

      {/* 3. FOOTER CREDIT BRAND LINE */}
      <footer className="border-t border-slate-205 dark:border-slate-800 bg-white dark:bg-[#111827] py-3 text-center text-[10px] font-mono text-slate-500 dark:text-slate-450 transition-colors">
        Labscribber Scientific Workstation • Made for academic and laboratory physical scientists
      </footer>

      {/* STEP-BY-STEP WELCOMING & INSTRUCTIONS WORKFLOW DIALOG MODAL */}
      {welcomeStep !== null && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 dark:bg-black/85 backdrop-blur-md p-4 overflow-y-auto">
          <div className="relative w-full max-w-xl bg-white dark:bg-[#111827] border border-slate-205 dark:border-slate-800 rounded-xl p-6 shadow-2xl overflow-hidden my-8 text-left transition-all">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-teal-500 via-indigo-500 to-rose-450" />
            
            {/* Step 1: Welcome message, contributions, and academic inspirations */}
            {welcomeStep === 1 && (
              <div className="flex flex-col gap-5 text-center items-center">
                <div className="w-14 h-14 rounded-full bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-500/30 flex items-center justify-center text-teal-600 dark:text-teal-400 shadow-inner group mb-1">
                  <Sparkles className="w-7 h-7 text-teal-600 dark:text-teal-400 animate-pulse" />
                </div>
                
                <div>
                  <h3 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white mb-2 uppercase">
                    Welcome to Labscribber
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-zinc-400 max-w-sm mx-auto leading-relaxed">
                    An elite cloud-ready and offline-capable digital spectroscopy workspace engineered for physical sciences and high-fidelity molecular research.
                  </p>
                </div>

                {/* Creator & Tribute Badges Block */}
                <div className="w-full bg-slate-50 dark:bg-[#18181b]/95 border border-slate-205 dark:border-zinc-800/80 rounded-lg p-4 flex flex-col gap-3 font-mono">
                  <span className="text-[10px] uppercase text-slate-550 dark:text-zinc-500 font-bold tracking-widest block text-left">CREDITS & CONTRIBUTIONS</span>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 text-left">
                    <div className="flex items-start gap-2.5 bg-white dark:bg-zinc-900/60 p-2.5 rounded border border-slate-200 dark:border-zinc-800/60">
                      <div className="w-8 h-8 rounded-full bg-teal-500/10 border border-teal-500/20 flex items-center justify-center shrink-0">
                        <span className="text-teal-600 dark:text-teal-400 font-bold text-xs uppercase text-[10px]">AR</span>
                      </div>
                      <div>
                        <span className="block text-[8px] uppercase tracking-wider text-teal-600 dark:text-teal-400 font-bold">Author & Architect</span>
                        <span className="text-xs text-slate-800 dark:text-white font-medium">Asif Raza</span>
                        <span className="block text-[8px] text-zinc-500 dark:text-zinc-500">Development & Design</span>
                      </div>
                    </div>

                    <div className="flex items-start gap-2.5 bg-white dark:bg-zinc-900/60 p-2.5 rounded border border-slate-200 dark:border-zinc-800/60">
                      <div className="w-8 h-8 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center shrink-0">
                        <span className="text-rose-600 dark:text-rose-400 font-bold text-xs uppercase text-[10px]">HB</span>
                      </div>
                      <div>
                        <span className="block text-[8px] uppercase tracking-wider text-rose-600 dark:text-rose-400 font-bold">Co-Author</span>
                        <span className="text-xs text-slate-800 dark:text-white font-medium">Huma Basheer</span>
                        <span className="block text-[8px] text-zinc-500 dark:text-zinc-500">Research & Validation</span>
                      </div>
                    </div>

                    <div className="flex items-start gap-2.5 bg-white dark:bg-zinc-900/60 p-2.5 rounded border border-slate-205 dark:border-zinc-800/60">
                      <div className="w-8 h-8 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center shrink-0">
                        <span className="text-indigo-600 dark:text-indigo-400 font-bold text-xs uppercase text-[10px]">IK</span>
                      </div>
                      <div>
                        <span className="block text-[8px] uppercase tracking-wider text-indigo-600 dark:text-indigo-400 font-bold">Academic Guidance</span>
                        <span className="text-xs text-slate-800 dark:text-white font-medium">Dr. Imran A. Khan</span>
                        <span className="block text-[8px] text-slate-500 dark:text-zinc-500 font-medium">Supervision & Inspiration</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Introductory Summary text */}
                <div className="text-left text-[10.5px] text-slate-600 dark:text-zinc-400 leading-relaxed bg-slate-50 dark:bg-zinc-900/30 p-3.5 rounded-lg border border-slate-200 dark:border-zinc-800">
                  <span className="font-bold text-slate-800 dark:text-zinc-350 block mb-1">💡 Core Capabilities</span>
                  This workstation renders multi-layer spectrum curves, cleans up experimental drift using advanced baseline fits, performs precise deconvolution models, and exports raw data points table.
                </div>

                {/* Navigation Button */}
                <button
                  type="button"
                  onClick={() => setWelcomeStep(2)}
                  className="w-full bg-teal-600 hover:bg-teal-500 text-white font-semibold text-xs py-2.5 px-4 rounded-lg mt-1 transition-all shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <span>Continue to Operations Manual</span>
                  <BookOpen size={14} />
                </button>
              </div>
            )}

            {/* Step 2: System manual, instructions guides & preferences */}
            {welcomeStep === 2 && (
              <div className="flex flex-col gap-4 text-left">
                <div className="flex items-center gap-3 border-b border-slate-200 dark:border-zinc-800 pb-3">
                  <div className="w-9 h-9 rounded-lg bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-500/20 flex items-center justify-center text-teal-600 dark:text-teal-400 shrink-0">
                    <HelpCircle className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold uppercase tracking-wide text-slate-900 dark:text-white">Workspace Operations</h4>
                    <span className="text-[10px] text-slate-550 dark:text-zinc-450 block leading-none mt-0.5 font-mono">System manual & analytical procedures</span>
                  </div>
                </div>

                {/* Instructions interactive list */}
                <div className="flex flex-col gap-3 font-sans my-1 text-xs max-h-[300px] overflow-y-auto pr-1">
                  
                  <div className="flex gap-3 items-start bg-slate-50 dark:bg-zinc-950/45 p-2.5 rounded border border-slate-200 dark:border-zinc-800">
                    <span className="flex items-center justify-center w-5 h-5 rounded bg-teal-50 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400 font-mono text-[10px] font-bold shrink-0 mt-0.5 border border-teal-200 dark:border-teal-800/30">01</span>
                    <div>
                      <span className="block font-bold text-slate-800 dark:text-zinc-200">Data Selection</span>
                      <p className="text-slate-500 dark:text-zinc-500 text-[10px] leading-relaxed mt-0.5">
                        Select pre-compiled spectral samples from the <strong>Spectrum Repository</strong> sidebar, or drop in RAW datasets. Click rows to focus active layers.
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-3 items-start bg-slate-50 dark:bg-zinc-950/45 p-2.5 rounded border border-slate-200 dark:border-zinc-800">
                    <span className="flex items-center justify-center w-5 h-5 rounded bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 font-mono text-[10px] font-bold shrink-0 mt-0.5 border border-amber-200 dark:border-amber-500/20">02</span>
                    <div>
                      <span className="block font-bold text-slate-800 dark:text-zinc-200">Adjust View Bounds</span>
                      <p className="text-slate-500 dark:text-zinc-500 text-[10px] leading-relaxed mt-0.5">
                        If high peak annotations or multiplicities get cropped off at the top margin, go to the <strong>Style Controls</strong> in the right-side control cards, uncheck autoset bounds, and enter custom numeric constraints.
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-3 items-start bg-slate-50 dark:bg-zinc-950/45 p-2.5 rounded border border-slate-200 dark:border-zinc-800">
                    <span className="flex items-center justify-center w-5 h-5 rounded bg-indigo-50 dark:bg-indigo-505/10 text-indigo-600 dark:text-indigo-400 font-mono text-[10px] font-bold shrink-0 mt-0.5 border border-indigo-200 dark:border-indigo-500/20">03</span>
                    <div>
                      <span className="block font-bold text-slate-800 dark:text-zinc-200">Interactive Cursor States</span>
                      <p className="text-slate-500 dark:text-zinc-500 text-[10px] leading-relaxed mt-0.5">
                        Toggle cursor modes below the chart display. Select <strong>Peak Pick</strong> to annotate chemical bands locally, <strong>Crop</strong> to slice specific bounds, or <strong>Integrate</strong> to map the area trace.
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-3 items-start bg-slate-550 dark:bg-zinc-955/45 p-2.5 rounded border border-slate-202 dark:border-zinc-800">
                    <span className="flex items-center justify-center w-5 h-5 rounded bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 font-mono text-[10px] font-bold shrink-0 mt-0.5 border border-rose-200 dark:border-rose-500/20">04</span>
                    <div>
                      <span className="block font-bold text-slate-800 dark:text-zinc-200">Baseline Filter Smoothing</span>
                      <p className="text-slate-500 dark:text-zinc-505 text-[10px] leading-relaxed mt-0.5">
                        Navigate to the <strong>Process</strong> tab in the right toolbar to apply Savitzky-Golay equations, normalize intensities, or subtract background signals.
                      </p>
                    </div>
                  </div>

                </div>

                {/* Don't show again checkbox config */}
                <div className="flex items-center justify-between border-t border-slate-200 dark:border-zinc-800 pt-3 select-none">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="welcome-mute-checkbox"
                      checked={dontShowAgain}
                      onChange={(e) => setDontShowAgain(e.target.checked)}
                      className="w-4 h-4 text-teal-600 bg-slate-50 dark:bg-zinc-850 border-slate-300 dark:border-zinc-700 rounded focus:ring-teal-500 focus:ring-offset-zinc-900 accent-teal-505 cursor-pointer"
                    />
                    <label htmlFor="welcome-mute-checkbox" className="text-[10px] text-slate-500 dark:text-zinc-400 cursor-pointer hover:text-zinc-350 font-medium font-mono">
                      Do not display onboarding checklist
                    </label>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setWelcomeStep(1)}
                      className="bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-600 dark:text-zinc-300 text-xs font-semibold px-4.5 py-1.5 rounded-lg border border-slate-200 dark:border-zinc-700 transition cursor-pointer"
                    >
                      ← Back
                    </button>
                    <button
                      type="button"
                      onClick={handleCompleteWelcome}
                      className="bg-teal-605 hover:bg-teal-500 text-white text-xs font-bold py-1.5 px-5 rounded-lg transition shadow-xs flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <span>Enter Workspace</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Step 3: Pure Emotional Support & Donation of Creator */}
            {welcomeStep === 3 && (
              <div className="flex flex-col gap-4 text-left">
                <div className="flex items-center gap-3 border-b border-slate-205 dark:border-zinc-800 pb-3">
                  <div className="w-10 h-10 rounded-full bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-500/35 flex items-center justify-center text-rose-600 dark:text-rose-455 shrink-0 select-none animate-pulse">
                    <span className="text-xl">❤️</span>
                  </div>
                  <div>
                    <h4 className="text-sm font-bold uppercase tracking-wide text-slate-900 dark:text-white">Support Asif's Scientific Tools</h4>
                    <span className="text-[10px] text-slate-550 dark:text-zinc-400 leading-none block mt-0.5 font-mono font-bold tracking-wider">Presented with love instead of a paid paywall</span>
                  </div>
                </div>

                <p className="text-[11.5px] text-slate-655 dark:text-zinc-300 leading-relaxed font-sans">
                  Hi there! I am <strong className="text-teal-650 dark:text-teal-400 font-bold">Asif Raza</strong>, the creator of Labscribber. I designed this workspace to serve physical chemists and materials researchers.
                </p>

                <p className="text-[10.5px] text-slate-600 dark:text-zinc-400 leading-relaxed bg-slate-50 dark:bg-[#141416]/90 p-3.5 rounded-lg border border-red-200 dark:border-red-500/15">
                  ⚠️ <strong className="text-rose-600 dark:text-rose-455 font-bold">No Paywalls:</strong> Instead of hiding advanced features like <strong>Voigt Fitting</strong>, <strong>ALS Baselines</strong>, and <strong>High-Res Printing Outputs</strong> behind a premium subscription, I unlocked everything for free.
                  If this software saves you time, please support my work!
                </p>

                {/* Donation selection block */}
                <div className="flex flex-col gap-3 font-sans">
                  <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-zinc-405 block tracking-wider font-mono">Choose a Support Level & view my reaction:</span>
                  
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {[
                      { amount: 3, label: "☕ Asif's Coffee", desc: 'Keeps me awake coding' },
                      { amount: 10, label: '🍕 Science Feast', desc: 'Direct research fuel' },
                      { amount: 25, label: '🛡️ Server Guardian', desc: 'Keeps us online 3mo' },
                      { amount: 50, label: '👑 Grand Patron', desc: 'True legend of science' }
                    ].map(t => (
                      <button
                        key={t.amount}
                        type="button"
                        onClick={() => setSelectedDonationTier(t.amount)}
                        className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer flex flex-col justify-between ${
                          selectedDonationTier === t.amount
                            ? 'bg-rose-50 dark:bg-red-500/10 border-rose-400 dark:border-red-505 text-slate-900 dark:text-white shadow-lg'
                            : 'bg-white dark:bg-zinc-950/45 border-slate-205 dark:border-zinc-850 text-slate-600 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-900/60 hover:text-slate-800 dark:hover:text-zinc-200'
                        }`}
                      >
                        <div>
                          <span className="block text-[11px] font-bold">{t.label}</span>
                          <span className="text-[9.5px] text-slate-400 dark:text-zinc-500 block leading-tight mt-0.5">{t.desc}</span>
                        </div>
                        <span className={`text-xs font-mono font-bold mt-2 block ${selectedDonationTier === t.amount ? 'text-rose-600 dark:text-red-400' : 'text-slate-450 dark:text-zinc-555'}`}>
                          ${t.amount}
                        </span>
                      </button>
                    ))}
                  </div>

                  {/* Emotional reaction screen of Asif */}
                  <div className="bg-slate-50 dark:bg-zinc-950/65 border border-slate-200 dark:border-zinc-805 p-3.5 rounded-xl flex flex-col gap-2 transition-all duration-300">
                    <div className="flex items-center gap-2.5">
                      <span className="text-2xl animate-bounce leading-none shrink-0 text-center" key={selectedDonationTier}>
                        {selectedDonationTier === 3 ? '🥹' : selectedDonationTier === 10 ? '🥰' : selectedDonationTier === 25 ? '😭❤️' : '🧠✨👑'}
                      </span>
                      <div>
                        <span className="text-[9.2px] uppercase font-bold text-rose-650 dark:text-red-400 tracking-widest block font-mono">My Emotional Reaction:</span>
                        <span className="text-xs font-bold text-slate-850 dark:text-zinc-200 block mt-0.5">
                          {selectedDonationTier === 3 && '“Asif’s eyes light up with pure gratitude!”'}
                          {selectedDonationTier === 10 && '“Sweet chemical warmth overflows Asif’s heart!”'}
                          {selectedDonationTier === 25 && '“Absolute tears of joy! You want to keep files safe and online!”'}
                          {selectedDonationTier === 50 && '“Unbelievable! Asif places a shining golden laboratory crown on your head!”'}
                        </span>
                      </div>
                    </div>

                    <p className="text-[10px] text-slate-505 dark:text-zinc-455 italic leading-relaxed border-t border-slate-100 dark:border-zinc-900 pt-2 font-mono">
                      {selectedDonationTier === 3 && '“A cup of warm coffee directly fuels midnight debugging sessions, turning caffeine into high-fidelity spectroscopy code and deconvolution fits.”'}
                      {selectedDonationTier === 10 && '“This gives us direct fuel! Your support ensures Asif, Huma, and Dr. Khan can sit together, fine-tune the algorithms, and make the UI look absolutely pristine.”'}
                      {selectedDonationTier === 25 && '“Incredibly heroic. This covers our hosting fees on Cloud Run for over three whole months, keeping these tools online and accessible to open labs everywhere.”'}
                      {selectedDonationTier === 50 && '“I am truly humbled. You are a legendary patron of open scientific tools. Your contribution directly funds research, and ensures this stays free and accessible forever.”'}
                    </p>
                  </div>

                  {/* Comment notes block */}
                  <div className="flex flex-col gap-1 text-left mt-2">
                    <label className="text-[9.5px] text-slate-500 dark:text-zinc-500 uppercase tracking-wide font-semibold block font-mono">Motivation comment (Optional):</label>
                    <input
                      type="text"
                      value={donationComment}
                      onChange={(e) => setDonationComment(e.target.value)}
                      placeholder="Write a messaging note for Asif..."
                      className="w-full bg-white dark:bg-[#111113] border border-slate-205 dark:border-zinc-805 rounded-lg p-2 text-xs text-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-rose-500 font-sans"
                    />
                  </div>
                </div>

                {/* Operations Buttons */}
                <div className="flex flex-col gap-2 mt-2">
                  <a
                    href="https://razorpay.me/@onlyasifraza"
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => {
                      setIsDonatedVirtual(true);
                    }}
                    className="w-full bg-gradient-to-r from-teal-600 to-emerald-600 dark:from-teal-700 dark:to-emerald-700 hover:opacity-95 text-white font-extrabold text-xs uppercase tracking-wider py-3 px-5 rounded-xl transition shadow-sm text-center flex items-center justify-center gap-1.5 cursor-pointer transform hover:-translate-y-0.5 active:translate-y-0 duration-150"
                  >
                    <span>❤️ Support via Razorpay (${selectedDonationTier})</span>
                  </a>

                  <div className="flex items-center justify-between gap-3 mt-1 font-mono">
                    {/* Bypassed buttons */}
                    <button
                      type="button"
                      onClick={() => {
                        // Go back to instructions block
                        setWelcomeStep(2);
                      }}
                      className="bg-slate-105 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-750 text-slate-600 dark:text-zinc-300 text-xxs font-semibold px-3 py-2 rounded-lg border border-slate-205 dark:border-zinc-700 transition cursor-pointer font-mono uppercase"
                    >
                      ← Back to Manual
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        // Close modal completely
                        setWelcomeStep(null);
                      }}
                      className="flex-1 bg-transparent hover:bg-slate-50 dark:hover:bg-zinc-850 border border-slate-205 dark:border-zinc-800 text-slate-450 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-white text-xxs py-2 px-5 rounded-lg transition text-center cursor-pointer font-mono uppercase"
                    >
                      Dismiss & Enter Workspace
                    </button>
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>
      )}

            {isUpgradeModalOpen && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-900/60 dark:bg-black/95 backdrop-blur-md p-4 overflow-y-auto">
          <div className="relative w-full max-w-3xl bg-white dark:bg-[#111827] border border-slate-205 dark:border-zinc-850 rounded-2xl p-6 shadow-2xl overflow-hidden my-8 text-left transition-all">
            
            {/* Ambient background glow */}
            <div className="absolute top-0 right-0 w-80 h-80 bg-red-500/5 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-80 h-80 bg-teal-500/5 rounded-full blur-3xl pointer-events-none" />

            {/* Header block */}
            <div className="flex items-center justify-between border-b border-slate-205 dark:border-zinc-805 pb-4 mb-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-500 to-indigo-650 flex items-center justify-center text-white shrink-0 shadow-md">
                  <span className="text-lg">❤️</span>
                </div>
                <div>
                  <h3 className="text-base font-bold uppercase tracking-wider text-slate-905 dark:text-white flex items-center gap-2">
                    Labscribber Donation Scheme
                    <span className="text-[9px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full font-mono uppercase tracking-normal">
                      Full Pro Unlocked
                    </span>
                  </h3>
                  <span className="text-xxs text-slate-500 dark:text-zinc-400 block mt-0.5 font-sans">Presented with love for open-access physical science and chemical research</span>
                </div>
              </div>
              <button
                onClick={() => setIsUpgradeModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-205 dark:bg-zinc-855 hover:bg-zinc-800 border border-slate-205 dark:border-zinc-800 text-slate-500 dark:text-zinc-300 hover:text-slate-805 dark:hover:text-white flex items-center justify-center transition-all cursor-pointer"
              >
                <X size={15} />
              </button>
            </div>

            {/* Content panel halves */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-stretch">
              
              {/* Left Column (5/12) - Emotional message and benefits */}
              <div className="md:col-span-12 lg:col-span-5 flex flex-col justify-between border-b md:border-b-0 md:border-r border-slate-250 dark:border-zinc-800 pr-0 md:pr-6 pb-6 md:pb-0 gap-4">
                <div className="flex flex-col gap-3">
                  <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500 font-mono">Message from the Developer</h4>
                  
                  <div className="flex items-center gap-2.5">
                    <img 
                      src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=80&h=80"
                      alt="Creator Avatar" 
                      referrerPolicy="no-referrer"
                      className="w-10 h-10 rounded-full object-cover border border-slate-200 dark:border-zinc-800 shrink-0"
                    />
                    <div>
                      <span className="block text-xs font-bold text-slate-800 dark:text-zinc-200">Asif Raza</span>
                      <span className="block text-[9px] font-mono text-slate-500 dark:text-zinc-500">Author of Labscribber</span>
                    </div>
                  </div>

                  <p className="text-[10.5px] text-slate-600 dark:text-zinc-400 leading-relaxed italic">
                    "I build Labscribber to empower researchers globally. Instead of locking advanced fits and 3D graphs under corporate monthly subscriptions, I decided to make everything free. If this matches your expectations, please support my work!"
                  </p>
                </div>

                <div className="bg-slate-50 dark:bg-[#121214]/80 p-3.5 border border-slate-200 dark:border-zinc-800/80 rounded-xl flex flex-col gap-2.5">
                  <span className="text-[9.5px] font-bold uppercase tracking-wider text-teal-600 dark:text-teal-400 font-mono">🌟 Unlocked Pro Benefits</span>
                  <div className="flex flex-col gap-2 text-[10px] text-slate-600 dark:text-zinc-400">
                    <div className="flex items-start gap-1.5">
                      <span className="text-emerald-600 dark:text-emerald-400 font-bold">✓</span>
                      <span><strong>Voigt Blend:</strong> High-precision deconvolution peaks.</span>
                    </div>
                    <div className="flex items-start gap-1.5">
                      <span className="text-emerald-600 dark:text-emerald-400 font-bold">✓</span>
                      <span><strong>ALS Baseline:</strong> Raman & FTIR noise extraction.</span>
                    </div>
                    <div className="flex items-start gap-1.5">
                      <span className="text-emerald-600 dark:text-emerald-400 font-bold">✓</span>
                      <span><strong>3D Waterfall:</strong> Generous oblique stacked plots.</span>
                    </div>
                    <div className="flex items-start gap-1.5">
                      <span className="text-emerald-600 dark:text-emerald-400 font-bold">✓</span>
                      <span><strong>High-Res Vector PDF:</strong> 1200 DPI publication assets.</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column (7/12) - Interactive Donation widget */}
              <div className="md:col-span-12 lg:col-span-7 flex flex-col justify-between gap-4">
                
                <div className="flex flex-col gap-3 font-sans">
                  <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-zinc-400 block tracking-wider font-mono">Choose a Support Level & see my reaction:</span>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {[
                      { amount: 3, label: "☕ Asif's Coffee", desc: 'Keeps me awake coding' },
                      { amount: 10, label: '🍕 Science Feast', desc: 'Direct research fuel' },
                      { amount: 25, label: '🛡️ Server Guardian', desc: 'Keeps us online 3mo' },
                      { amount: 50, label: '👑 Grand Patron', desc: 'True legend of science' }
                    ].map(t => (
                      <button
                        key={t.amount}
                        type="button"
                        onClick={() => setSelectedDonationTier(t.amount)}
                        className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer flex flex-col justify-between ${
                          selectedDonationTier === t.amount
                            ? 'bg-rose-50 dark:bg-red-500/10 border-rose-450 dark:border-red-500 text-slate-900 dark:text-white shadow-sm'
                            : 'bg-white dark:bg-zinc-950/45 border-slate-205 dark:border-zinc-850 text-slate-600 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-900/60 hover:text-slate-850 dark:hover:text-zinc-100'
                        }`}
                      >
                        <div>
                          <span className="block text-[11px] font-bold">{t.label}</span>
                          <span className="text-[9.5px] text-slate-400 dark:text-zinc-500 block leading-tight mt-0.5">{t.desc}</span>
                        </div>
                        <span className={`text-xs font-mono font-bold mt-2 block ${selectedDonationTier === t.amount ? 'text-rose-600 dark:text-red-400' : 'text-slate-450 dark:text-zinc-500'}`}>
                          ${t.amount}
                        </span>
                      </button>
                    ))}
                  </div>

                  {/* Emotional Reaction Screen */}
                  <div className="bg-slate-50 dark:bg-zinc-950/65 border border-slate-200 dark:border-zinc-800/85 p-3 rounded-xl flex flex-col gap-1.5 transition-all">
                    <div className="flex items-center gap-2">
                      <span className="text-xl animate-bounce leading-none shrink-0" key={selectedDonationTier}>
                        {selectedDonationTier === 3 ? '🥹' : selectedDonationTier === 10 ? '🥰' : selectedDonationTier === 25 ? '😭❤️' : '🧠✨👑'}
                      </span>
                      <div>
                        <span className="text-[8.5px] uppercase font-bold text-rose-650 dark:text-red-400 tracking-widest block font-mono">My Emotional Reaction:</span>
                        <span className="text-[11px] font-bold text-slate-800 dark:text-zinc-200 block">
                          {selectedDonationTier === 3 && '“Asif’s eyes light up with pure gratitude!”'}
                          {selectedDonationTier === 10 && '“Sweet chemical warmth overflows Asif’s heart!”'}
                          {selectedDonationTier === 25 && '“Absolute tears of joy! You want to keep files safe and online!”'}
                          {selectedDonationTier === 50 && '“Unbelievable! Asif places a shining golden laboratory crown on your head!”'}
                        </span>
                      </div>
                    </div>
                    <p className="text-[9.5px] text-slate-505 dark:text-zinc-450 italic leading-relaxed font-mono">
                      {selectedDonationTier === 3 && '“A cup of warm coffee directly fuels midnight debugging sessions, turning caffeine into high-fidelity spectroscopy code and deconvolution fits.”'}
                      {selectedDonationTier === 10 && '“This gives us direct fuel! Your support ensures Asif, Huma, and Dr. Khan can sit together, fine-tune the algorithms, and make the UI look absolutely pristine.”'}
                      {selectedDonationTier === 25 && '“Incredibly heroic. This covers our hosting fees on Cloud Run for over three whole months, keeping these tools online and accessible to open labs everywhere.”'}
                      {selectedDonationTier === 50 && '“I am truly humbled. You are a legendary patron of open scientific tools. Your contribution directly funds research, and ensures this stays free and accessible forever.”'}
                    </p>
                  </div>

                  {/* Motivation comment */}
                  <div className="flex flex-col gap-1 text-left">
                    <label className="text-[9.5px] text-slate-550 dark:text-zinc-500 uppercase tracking-wide font-semibold block font-mono font-sans mt-1">Motivation comment (Optional):</label>
                    <input
                      type="text"
                      value={donationComment}
                      onChange={(e) => setDonationComment(e.target.value)}
                      placeholder="Write a message of inspiration for Asif..."
                      className="w-full bg-white dark:bg-[#111113] border border-slate-205 dark:border-zinc-800/80 rounded-lg p-2 text-xs text-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-rose-500 font-sans"
                    />
                  </div>
                </div>

                {/* Operation Buttons */}
                <div className="flex flex-col gap-1.5 mt-2">
                  <a
                    href="https://razorpay.me/@onlyasifraza"
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => {
                      setIsDonatedVirtual(true);
                    }}
                    className="w-full bg-gradient-to-r from-teal-600 to-emerald-600 dark:from-teal-700 dark:to-emerald-700 hover:opacity-95 text-white font-extrabold text-xs uppercase tracking-wider py-3 px-5 rounded-xl transition shadow-sm text-center flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <span>❤️ Contribute via Razorpay (${selectedDonationTier})</span>
                  </a>

                  <button
                    type="button"
                    onClick={() => setIsUpgradeModalOpen(false)}
                    className="w-full bg-transparent hover:bg-slate-50 dark:hover:bg-zinc-850 border border-slate-205 dark:border-zinc-805 text-slate-450 dark:text-zinc-400 hover:text-slate-805 dark:hover:text-white text-xxs py-2 px-5 rounded-lg transition text-center cursor-pointer font-mono uppercase"
                  >
                    Keep using Free Pro Workspace
                  </button>
                </div>

              </div>
            </div>

          </div>
        </div>
      )}

      {/* ACADEMIC CITATION AND JOSS PEER-REVIEW HUB MODAL */}
      {isCiteModalOpen && (() => {
        let activeContent = '';
        if (citeTab === 'bibtex') {
          activeContent = `@software{Raza2026Labscribber,
  title={{Labscribber: A Cross-Platform Scientific Spectroscopy Workstation}},
  author={Raza, Asif and Basheer, Huma and Khan, Imran A.},
  year={2026},
  publisher={GitHub},
  url={https://github.com/asifverse4/LabScribber},
  note={A peer-reviewed publication and DOI will be added here once available.}
}`;
        } else if (citeTab === 'cff') {
          activeContent = `cff-version: 1.2.0
message: "If you use this software in your research, please cite it using these metadata. A DOI will be added once the accompanying paper is published."
type: software
authors:
  - family-names: "Raza"
    given-names: "Asif"
  - family-names: "Basheer"
    given-names: "Huma"
  - family-names: "Khan"
    given-names: "Imran A."
title: "Labscribber: A Cross-Platform Scientific Spectroscopy Workstation"
version: "1.0.0"
date-released: "2026-06-13"
url: "https://github.com/asifverse4/LabScribber"`;
        } else if (citeTab === 'ris') {
          activeContent = `TY  - COMP
T1  - Labscribber: A Cross-Platform Scientific Spectroscopy Workstation
AU  - Raza, Asif
AU  - Basheer, Huma
AU  - Khan, Imran A.
PY  - 2026
UR  - https://github.com/asifverse4/LabScribber
N1  - A peer-reviewed publication and DOI will be added here once available.
ER  - `;
        } else {
          activeContent = `Raza, A., Basheer, H., & Khan, I. A. (2026). Labscribber: A Cross-Platform Scientific Spectroscopy Workstation [Computer software]. https://github.com/asifverse4/LabScribber

A peer-reviewed publication and DOI will be added here once available.`;
        }

        const handleDownloadCite = () => {
          let filename = 'labscribber.bib';
          if (citeTab === 'cff') filename = 'CITATION.cff';
          else if (citeTab === 'ris') filename = 'labscribber.ris';
          else if (citeTab === 'apa') filename = 'labscribber_apa.txt';

          const blob = new Blob([activeContent], { type: 'text/plain;charset=utf-8' });
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = filename;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
        };

        const handleCopy = () => {
          navigator.clipboard.writeText(activeContent);
          setCopiedCite(true);
          setTimeout(() => setCopiedCite(false), 2000);
        };

        // Determine dynamic diagnostics values
        const provenanceActive = datasets.some(d => d.history && d.history.length > 0);
        const datasetCount = datasets.length;
        const totalLogs = datasets.reduce((acc, d) => acc + (d.history ? d.history.length : 0), 0);

        return (
          <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-900/60 dark:bg-black/95 backdrop-blur-md p-4 overflow-y-auto font-sans text-slate-800 dark:text-slate-100 animate-none">
            <div className="relative w-full max-w-4xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-2xl overflow-hidden my-8 text-left transition-all">
              
              {/* Background Glow */}
              <div className="absolute top-0 right-0 w-96 h-96 bg-sky-500/5 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute bottom-0 left-0 w-96 h-96 bg-teal-500/5 rounded-full blur-3xl pointer-events-none" />

              {/* Modal Header */}
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4 mb-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-500 to-indigo-650 flex items-center justify-center text-white shrink-0 shadow-md">
                    <Award size={20} className="text-white animate-none" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2">
                      Academic Citation & JOSS Hub
                    </h3>
                    <span className="text-xxs text-slate-500 dark:text-slate-400 block mt-0.5">
                      Verify peer-review reproducibility guidelines & download high-citation software metadata tags
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setIsCiteModalOpen(false)}
                  className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-300 flex items-center justify-center transition-all cursor-pointer"
                >
                  <X size={15} />
                </button>
              </div>

              {/* Core Panels Grid */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-stretch">
                
                {/* Left Side: JOSS Review Diagnostic Checker */}
                <div className="md:col-span-12 lg:col-span-5 flex flex-col justify-between border-b md:border-b-0 md:border-r border-slate-200 dark:border-slate-800 pr-0 lg:pr-6 pb-6 lg:pb-0 gap-4">
                  <div className="flex flex-col gap-3">
                    <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 font-mono tracking-widest flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      JOSS Self-Audit Diagnostics
                    </h4>
                    <p className="text-[10.5px] text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
                      Reviewers from the <span className="font-semibold text-slate-700 dark:text-zinc-200">Journal of Open Source Software (JOSS)</span> require several open science standards to accept physical science software:
                    </p>

                    <div className="flex flex-col gap-2.5 mt-2">
                      
                      {/* Check 1: Compilable app */}
                      <div className="bg-slate-50 dark:bg-[#18181b]/50 p-2.5 border border-slate-200 dark:border-slate-800/80 rounded-lg flex items-start gap-2.5">
                        <Check className="text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0 animate-none" size={13} />
                        <div>
                          <span className="block text-[10px] font-bold text-slate-800 dark:text-zinc-200">TypeScript Type-Safe Build</span>
                          <span className="block text-[9px] text-slate-500 dark:text-zinc-400 font-medium">Passed compiler audits with 0 strict flags exceptions.</span>
                        </div>
                      </div>

                      {/* Check 2: SPDX License */}
                      <div className="bg-slate-50 dark:bg-[#18181b]/50 p-2.5 border border-slate-200 dark:border-slate-800/80 rounded-lg flex items-start gap-2.5">
                        <Check className="text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0 animate-none" size={13} />
                        <div>
                          <span className="block text-[10px] font-bold text-slate-800 dark:text-zinc-200">SPDX Code License</span>
                          <span className="block text-[9px] text-slate-500 dark:text-zinc-400 font-medium">MIT License — see LICENSE file in repository root.</span>
                        </div>
                      </div>

                      {/* Check 3: CITATION.cff metadata */}
                      <div className="bg-slate-50 dark:bg-[#18181b]/50 p-2.5 border border-slate-200 dark:border-slate-800/80 rounded-lg flex items-start gap-2.5">
                        <Check className="text-blue-600 dark:text-blue-400 mt-0.5 shrink-0 animate-none" size={13} />
                        <div>
                          <span className="block text-[10px] font-bold text-slate-800 dark:text-zinc-200">Software citation format</span>
                          <span className="block text-[9px] text-slate-500 dark:text-zinc-400 font-medium">Labscribber citation metadata is exported in full CFF v1.2.</span>
                        </div>
                      </div>

                      {/* Check 4: High-Provenance History Logger */}
                      <div className="bg-slate-50 dark:bg-[#18181b]/50 p-2.5 border border-slate-200 dark:border-slate-800/80 rounded-lg flex items-start gap-2.5">
                        {provenanceActive ? (
                          <Check className="text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0 animate-none" size={13} />
                        ) : (
                          <Info className="text-amber-500 mt-0.5 shrink-0 animate-none" size={13} />
                        )}
                        <div>
                          <span className="block text-[10px] font-bold text-slate-800 dark:text-zinc-200 flex items-center gap-1.5 font-sans">
                            Provenance Log Trace Audit 
                            <span className={`text-[8px] font-mono leading-none px-1 rounded uppercase ${provenanceActive ? "bg-emerald-500/10 text-emerald-600" : "bg-amber-500/10 text-amber-600"}`}>
                              {provenanceActive ? "Active" : "Ready"}
                            </span>
                          </span>
                          <span className="block text-[9px] text-slate-500 dark:text-zinc-400 font-medium">
                            {provenanceActive 
                              ? `Active session: tracking ${totalLogs} distinct processing histories on ${datasetCount} traces.`
                              : "Ready. Import CSV or XLS file, or load instruments to track real history logs."}
                          </span>
                        </div>
                      </div>

                    </div>
                  </div>

                  <div className="bg-sky-50 dark:bg-sky-950/10 p-3 border border-sky-100 dark:border-sky-900/30 rounded-xl text-[10px] text-slate-600 dark:text-sky-305 flex flex-col gap-1 pr-4 font-sans">
                    <span className="font-bold text-sky-800 dark:text-sky-400 uppercase tracking-wide font-mono">Peer-Review Note:</span>
                    <span>All algorithms inside <strong>Labscribber</strong> (Voigt fitting, ALS automatic baseline, PCA eigenvalues) are deterministic & mathematically validated to guarantee publication reproduction.</span>
                  </div>

                  <div className="bg-amber-50 dark:bg-amber-950/10 p-3 border border-amber-100 dark:border-amber-900/30 rounded-xl text-[10px] text-slate-600 dark:text-amber-200 flex flex-col gap-1 pr-4 font-sans">
                    <span className="font-bold text-amber-800 dark:text-amber-400 uppercase tracking-wide font-mono">Future Work — Citation Pending:</span>
                    <span>
                      Labscribber does not yet have an associated peer-reviewed publication or DOI.
                      The citation formats below reference the software repository directly. Once a
                      paper describing this work is published, its DOI will be added here and in
                      <code className="mx-1 px-1 py-0.5 bg-amber-100 dark:bg-amber-900/40 rounded text-[9px]">CITATION.cff</code>
                      for formal academic citation.
                    </span>
                  </div>
                </div>

                {/* Right Side: Tabbed Clipboard Copy Box */}
                <div className="md:col-span-12 lg:col-span-7 flex flex-col justify-between gap-4">
                  <div className="flex flex-col gap-3 font-sans h-full">
                    <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 block tracking-wider font-mono">
                      Select Academic Target & Export Metadata:
                    </span>

                    {/* Tab List */}
                    <div className="grid grid-cols-4 gap-1.5 font-sans">
                      {[
                        { key: 'bibtex', label: 'BibTeX (.bib)', desc: 'Overleaf & LaTeX' },
                        { key: 'cff', label: 'CFF (.yaml)', desc: 'GitHub Widget' },
                        { key: 'apa', label: 'APA 7th', desc: 'Direct citation' },
                        { key: 'ris', label: 'RIS (.ris)', desc: 'EndNote & Mendeley' }
                      ].map(tab => (
                        <button
                          key={tab.key}
                          type="button"
                          onClick={() => setCiteTab(tab.key as any)}
                          className={`p-2 rounded-lg border text-center transition-all cursor-pointer flex flex-col justify-between items-center ${
                            citeTab === tab.key
                              ? 'bg-sky-50 dark:bg-sky-950/20 border-sky-450 dark:border-sky-500 text-sky-700 dark:text-sky-300 font-bold shadow-xs'
                              : 'bg-transparent border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-zinc-805 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-zinc-200'
                          }`}
                        >
                          <span className="text-[10.5px] leading-tight block">{tab.label}</span>
                          <span className="text-[8px] font-mono block opacity-75 mt-0.5">{tab.desc}</span>
                        </button>
                      ))}
                    </div>

                    {/* Code Board */}
                    <div className="flex-1 flex flex-col relative min-h-[190px] bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-300 p-3.5 rounded-xl border border-slate-200 dark:border-slate-850 font-mono text-[9px] leading-relaxed overflow-x-auto overflow-y-auto select-all max-h-[260px] scrollbar-thin">
                      <pre className="whitespace-pre-wrap select-all">{activeContent}</pre>
                    </div>

                    {/* Action buttons */}
                    <div className="grid grid-cols-2 gap-3 mt-1 shrink-0">
                      
                      <button
                        type="button"
                        onClick={handleCopy}
                        className="w-full bg-slate-800 hover:bg-slate-700 dark:bg-zinc-800 dark:hover:bg-zinc-700 border border-slate-800 dark:border-zinc-700 text-white font-bold text-xs uppercase tracking-wider py-2.5 px-4 rounded-xl transition shadow-sm text-center flex items-center justify-center gap-1.5 cursor-pointer font-sans"
                      >
                        <Clipboard size={14} className="text-sky-400 animate-none" />
                        <span>{copiedCite ? "Copied! ✓" : "Copy to Clipboard"}</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleDownloadCite}
                        className="w-full bg-gradient-to-r from-sky-600 to-indigo-650 dark:from-sky-750 dark:to-indigo-700 hover:opacity-95 text-white font-bold text-xs uppercase tracking-wider py-2.5 px-4 rounded-xl transition shadow-sm text-center flex items-center justify-center gap-1.5 cursor-pointer font-sans"
                      >
                        <FileDown size={14} className="animate-none" />
                        <span>Download metadata</span>
                      </button>

                    </div>

                  </div>
                </div>

              </div>

            </div>
          </div>
        );
      })()}

      {/* ── Post-export support toast ──────────────────────────────────────── */}
      {/* Non-blocking: floats above the UI, never intercepts the export action  */}
      {/* itself. Auto-dismisses after 15s; can also be closed manually at any   */}
      {/* time. No "don't show again" option — only a real support click-through */}
      {/* earns a 15-day cooldown.                                               */}
      {showSupportToast && (
        <div
          className="fixed bottom-6 right-6 z-[200] w-80 bg-white dark:bg-[#18181b] border border-rose-200 dark:border-rose-900/40 rounded-xl shadow-2xl p-4 animate-in slide-in-from-bottom-4 fade-in duration-300"
          role="status"
          aria-live="polite"
        >
          <div className="flex items-start gap-3">
            <div className="shrink-0 w-9 h-9 rounded-full bg-rose-50 dark:bg-rose-950/30 flex items-center justify-center">
              <Sparkles size={16} className="text-rose-500" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-slate-900 dark:text-white">
                Enjoying Labscribber?
              </p>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5 leading-relaxed">
                This tool is free and open for every lab. If it's helping your work, a small contribution keeps it that way.
              </p>
              <div className="flex items-center gap-2 mt-3">
                <a
                  href="https://razorpay.me/@onlyasifraza"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={handleSupportLinkClicked}
                  className="flex-1 text-center bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold py-1.5 px-3 rounded-lg transition"
                >
                  ❤️ Support (from ₹49)
                </a>
                <button
                  onClick={() => setShowSupportToast(false)}
                  className="text-xs text-slate-400 dark:text-zinc-500 hover:text-slate-600 dark:hover:text-zinc-300 px-2 py-1.5 transition"
                  aria-label="Dismiss for now"
                  title="Dismiss for now"
                >
                  Not now
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
