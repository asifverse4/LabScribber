/**
 * @license
 * SPDX-License-Identifier: MIT
 */

import React, { useRef, useEffect, useState } from 'react';
import { SpectrumData, JournalStyleType, ViewLayoutMode, PeakData, IntegralData, WilliamsonHallResult, KubelkaMunkResult, FFTResult, AutocorrResult, SimilarityResult, HCAResult, CVSimResult, EISSimResult, PLEXMapResult, EPRSimResult } from '../types';
import { jsPDF } from 'jspdf';
import { svg2pdf } from 'svg2pdf.js';
import { computeAutoDomain, clampDomain } from '../utils/plotDomain';

interface SpectrumPlotProps {
  datasets: SpectrumData[];
  selectedDataset: SpectrumData | null;
  layoutMode: ViewLayoutMode;
  journalStyle: JournalStyleType;
  plotBgColor: string;
  gridX: boolean;
  gridY: boolean;
  autoX: boolean;
  autoY: boolean;
  manualXMin: number;
  manualXMax: number;
  manualYMin: number;
  manualYMax: number;
  xLabel: string;
  yLabel: string;
  showLegend: boolean;
  legendPos: string;
  thickAxes: boolean;
  dropLines: boolean;
  waterfallOffset: number;
  waterfallOffset3D: boolean;
  enableInset: boolean;
  insetXMin: number;
  insetXMax: number;
  panelGridCols: number;
  panelLabelCase: 'lowercase' | 'uppercase';
  enableHighlight: boolean;
  highlightMin: number;
  highlightMax: number;
  interactiveMode: 'navigate' | 'pick' | 'crop' | 'integrate';
  onCursorPositionChange: (x: number, y: number) => void;
  onRangeSelected: (xmin: number, xmax: number) => void;
  onPeakCreated: (x: number, y: number) => void;
  onDatasetsUpdated: (list: SpectrumData[]) => void;
  previewCorrectedY?: number[];
  
  // Custom Publication-grade Additions
  invertX?: boolean;
  invertY?: boolean;
  tickStepX?: number;
  tickStepY?: number;
  minorTicksCount?: number;
}

// High-fidelity Colormaps
const COLOR_MAPS: Record<string, [number, number, number][]> = {
  viridis: [
    [68, 1, 84], [72, 40, 120], [62, 74, 137], [49, 104, 142],
    [38, 130, 142], [31, 158, 137], [53, 183, 121], [109, 205, 89],
    [180, 222, 44], [253, 231, 37]
  ],
  plasma: [
    [13, 8, 135], [76, 12, 159], [126, 3, 168], [168, 34, 150],
    [203, 70, 121], [229, 107, 84], [248, 149, 44], [254, 196, 25],
    [240, 249, 33]
  ],
  coolwarm: [
    [59, 76, 192], [106, 137, 247], [161, 188, 250], [210, 220, 242],
    [242, 211, 201], [244, 159, 133], [225, 95, 73], [180, 4, 38]
  ]
};

function getCmapColor(cmapName: string, ratio: number): string {
  const cmap = COLOR_MAPS[cmapName.toLowerCase()] || COLOR_MAPS.viridis;
  const len = cmap.length;
  const idx = ratio * (len - 1);
  const low = Math.floor(idx);
  const high = Math.ceil(idx);
  const mix = idx - low;
  const c1 = cmap[low];
  const c2 = cmap[high];
  const r = Math.round(c1[0] + (c2[0] - c1[0]) * mix);
  const g = Math.round(c1[1] + (c2[1] - c1[1]) * mix);
  const b = Math.round(c1[2] + (c2[2] - c1[2]) * mix);
  return `rgb(${r}, ${g}, ${b})`;
}

const getTransitionPresetsForTechnique = (technique: string): string[] => {
  const t = technique?.toLowerCase() || '';
  if (t.includes('infrared') || t.includes('ftir') || t.includes('ir') || t.includes('raman')) {
    return [
      'O-H stretch',
      'N-H stretch',
      'C-H stretch (sp³)',
      'C-H stretch (sp²)',
      'C-H stretch (sp)',
      'C≡N stretch',
      'C=O stretch',
      'C=C stretch',
      'C-O stretch',
      'C-H bend',
      'N-H bend',
      'C-C stretch'
    ];
  }
  if (t.includes('1h nmr') || t.includes('nmr')) {
    return [
      '-CH₃ singlet',
      '-CH₂- triplet',
      'Aliphatic -CH',
      'Allylic H',
      'α-H (carbonyl)',
      'α-H (oxygen)',
      'Aromatic H',
      'Vinylic H',
      'Aldehydic H',
      'Carboxylic H',
      'Phenolic -OH'
    ];
  }
  if (t.includes('13c nmr') || t.includes('13c')) {
    return [
      'Aliphatic sp³ C',
      'Heteroatom C-O',
      'Heteroatom C-N',
      'Acetylenic sp C',
      'Alkenyl sp² C',
      'Aromatic C',
      'Ester C=O',
      'Amide C=O',
      'Aldehyde C=O',
      'Ketone C=O'
    ];
  }
  if (t.includes('2d cosy') || t.includes('cosy')) {
    return [
      'H-H Diagonal Peak',
      'Coupled Cross Peak',
      'Aromatic Coupling',
      'Alkyl Coupling',
      'Residual Solvent'
    ];
  }
  if (t.includes('xps')) {
    return [
      'C 1s (C-C/C-H)',
      'C 1s (C-O)',
      'C 1s (C=O)',
      'C 1s (O-C=O)',
      'O 1s (Metal Oxide)',
      'O 1s (C-O/C=O)',
      'N 1s (Pyridinic)',
      'N 1s (Pyrrolic)',
      'N 1s (Quaternary)',
      'S 2p3/2',
      'S 2p1/2'
    ];
  }
  if (t.includes('photoluminescence') || t.includes('pl') || t.includes('fluorescence')) {
    return [
      'Singlet (S₁ → S₀)',
      'Triplet (T₁ → S₀)',
      'Band Edge (Near)',
      'Excitonic Recomb.',
      'Donor-Acceptor Pair',
      'Deep Defect State',
      'Surface State PL',
      'Radiative Decay'
    ];
  }
  if (t.includes('xrd') || t.includes('diffraction') || t.includes('crystallography')) {
    return [
      '(111)',
      '(200)',
      '(220)',
      '(311)',
      '(222)',
      '(400)',
      '(002)',
      '(101)',
      '(110)',
      '(211)'
    ];
  }
  // Default to UV-Vis electronic transitions
  return [
    'π → π*',
    'n → π*',
    'σ → σ*',
    'd → d (LF)',
    'S₀ → S₁',
    'S₀ → T₁',
    'LMCT',
    'MLCT',
    'IVCT',
    'π → d'
  ];
};

/**
 * Renders datasets as a grid of independent subplots, each with its own
 * auto-scaled axes, rather than sharing one coordinate system. Datasets are
 * grouped by their `panelIndex` field (defaulting to 0 if unset), so
 * multiple datasets can be overlaid within the same panel exactly as they
 * would be in Standard Overlay mode — the panel itself is just one
 * independent subplot among several.
 *
 * Panel letters follow the journal-specific convention: lowercase (a, b, c)
 * for Nature/Science house style, uppercase (A, B, C) for Cell — both real,
 * distinct conventions, not an arbitrary stylistic choice.
 */
function drawMultiPanelGrid(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  activeSeries: SpectrumData[],
  gridCols: number,
  labelCase: 'lowercase' | 'uppercase',
  isDark: boolean,
  fontSize: number,
  labelFont: string,
  lineW: number,
  gridColor: string,
  textColor: string,
  spineColor: string,
  plotBgColor: string,
  gridX: boolean,
  gridY: boolean,
  xLabel: string,
  yLabel: string,
  invertX: boolean,
  invertY: boolean
) {
  // Group datasets by panelIndex (default 0 for anything unassigned)
  const panelMap = new Map<number, SpectrumData[]>();
  activeSeries.forEach(sd => {
    const idx = sd.panelIndex ?? 0;
    if (!panelMap.has(idx)) panelMap.set(idx, []);
    panelMap.get(idx)!.push(sd);
  });

  const panelIndices = Array.from(panelMap.keys()).sort((a, b) => a - b);
  const nPanels = Math.max(panelIndices.length, 1);

  if (nPanels === 0 || activeSeries.length === 0) {
    ctx.fillStyle = textColor;
    ctx.font = `${fontSize}px ${labelFont}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('No datasets assigned to panels — assign a panel index per dataset to use Multi-Panel Grid mode.', w / 2, h / 2);
    return;
  }

  const cols = Math.max(1, Math.min(gridCols, nPanels));
  const rows = Math.ceil(nPanels / cols);

  const outerMargin = 16;
  const panelGap = 28; // generous gap so neighboring panel labels/axes never collide
  const panelW = (w - outerMargin * 2 - panelGap * (cols - 1)) / cols;
  const panelH = (h - outerMargin * 2 - panelGap * (rows - 1)) / rows;

  const letters = labelCase === 'uppercase'
    ? 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
    : 'abcdefghijklmnopqrstuvwxyz';

  panelIndices.forEach((panelIdx, gridPos) => {
    const row = Math.floor(gridPos / cols);
    const col = gridPos % cols;
    const panelX = outerMargin + col * (panelW + panelGap);
    const panelY = outerMargin + row * (panelH + panelGap);

    const panelDatasets = panelMap.get(panelIdx)!;

    // Per-panel padding, smaller than the single-canvas mode since each
    // panel is itself already a fraction of the full canvas.
    const pPadLeft = 42, pPadRight = 12, pPadTop = 22, pPadBottom = 32;
    const innerW = panelW - pPadLeft - pPadRight;
    const innerH = panelH - pPadTop - pPadBottom;
    if (innerW <= 10 || innerH <= 10) return; // panel too small to render meaningfully

    // Independent auto-scale derived only from this panel's datasets
    let pxMin = Infinity, pxMax = -Infinity, pyMin = Infinity, pyMax = -Infinity;
    panelDatasets.forEach(sd => {
      for (let i = 0; i < sd.x.length; i++) {
        pxMin = Math.min(pxMin, sd.x[i]);
        pxMax = Math.max(pxMax, sd.x[i]);
      }
      sd.y_processed.forEach(v => {
        pyMin = Math.min(pyMin, v);
        pyMax = Math.max(pyMax, v);
      });
    });
    if (pxMin === Infinity) { pxMin = 0; pxMax = 1; }
    if (pyMin === Infinity) { pyMin = 0; pyMax = 1; }
    const xPad = (pxMax - pxMin) * 0.02 || 1;
    const yPad = (pyMax - pyMin) * 0.08 || 1;
    pxMin -= xPad; pxMax += xPad;
    pyMin -= yPad; pyMax += yPad;

    const px = (vx: number) => {
      const frac = (vx - pxMin) / (pxMax - pxMin);
      return invertX ? panelX + pPadLeft + innerW - frac * innerW : panelX + pPadLeft + frac * innerW;
    };
    const py = (vy: number) => {
      const frac = (vy - pyMin) / (pyMax - pyMin);
      return invertY ? panelY + pPadTop + frac * innerH : panelY + pPadTop + innerH - frac * innerH;
    };

    // Panel background (subtle, helps visually separate adjacent panels)
    ctx.fillStyle = plotBgColor || '#151515';
    ctx.fillRect(panelX, panelY, panelW, panelH);

    // Gridlines (optional, same toggle as single-canvas mode)
    if (gridX || gridY) {
      ctx.strokeStyle = gridColor;
      ctx.lineWidth = 0.6;
      const nLines = 4;
      if (gridY) {
        for (let i = 1; i < nLines; i++) {
          const gy = panelY + pPadTop + (i / nLines) * innerH;
          ctx.beginPath(); ctx.moveTo(panelX + pPadLeft, gy); ctx.lineTo(panelX + pPadLeft + innerW, gy); ctx.stroke();
        }
      }
      if (gridX) {
        for (let i = 1; i < nLines; i++) {
          const gx = panelX + pPadLeft + (i / nLines) * innerW;
          ctx.beginPath(); ctx.moveTo(gx, panelY + pPadTop); ctx.lineTo(gx, panelY + pPadTop + innerH); ctx.stroke();
        }
      }
    }

    // Panel border (full box, inward ticks — same convention as single-canvas mode)
    ctx.strokeStyle = spineColor;
    ctx.lineWidth = lineW > 1.5 ? 1.2 : lineW;
    ctx.strokeRect(panelX + pPadLeft, panelY + pPadTop, innerW, innerH);

    // Traces — each dataset assigned to this panel, overlaid together
    panelDatasets.forEach(sd => {
      if (sd.x.length < 2) return;
      ctx.strokeStyle = sd.color || '#3b82f6';
      ctx.lineWidth = sd.lineWidth || 1.3;
      ctx.beginPath();
      let first = true;
      for (let i = 0; i < sd.x.length; i++) {
        const cx = px(sd.x[i]);
        const cy = py(sd.y_processed[i]);
        if (first) { ctx.moveTo(cx, cy); first = false; }
        else ctx.lineTo(cx, cy);
      }
      ctx.stroke();
    });

    // Panel letter — top-left corner, bold, journal-convention case
    const letter = letters[gridPos] || '?';
    ctx.fillStyle = textColor;
    ctx.font = `bold ${fontSize + 3}px ${labelFont}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(letter, panelX + 2, panelY - 2);

    // Compact axis labels (smaller than single-canvas mode, since space is limited)
    ctx.font = `${Math.max(fontSize - 3, 7)}px ${labelFont}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(xLabel || 'X', panelX + pPadLeft + innerW / 2, panelY + pPadTop + innerH + 4);

    ctx.save();
    ctx.translate(panelX + 10, panelY + pPadTop + innerH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textBaseline = 'bottom';
    ctx.fillText(yLabel || 'Y', 0, 0);
    ctx.restore();

    // Small dataset legend in the corner if more than one trace shares this panel
    if (panelDatasets.length > 1) {
      ctx.font = `${Math.max(fontSize - 4, 6)}px ${labelFont}`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      panelDatasets.forEach((sd, i) => {
        ctx.fillStyle = sd.color || '#3b82f6';
        ctx.fillText('—', panelX + pPadLeft + 2, panelY + pPadTop + 2 + i * 9);
        ctx.fillStyle = textColor;
        ctx.fillText(sd.name.slice(0, 18), panelX + pPadLeft + 10, panelY + pPadTop + 2 + i * 9);
      });
    }
  });
}

export const SpectrumPlot: React.FC<SpectrumPlotProps> = ({
  datasets,
  selectedDataset,
  layoutMode,
  journalStyle,
  plotBgColor,
  gridX,
  gridY,
  autoX,
  autoY,
  manualXMin,
  manualXMax,
  manualYMin,
  manualYMax,
  xLabel,
  yLabel,
  showLegend,
  legendPos,
  thickAxes,
  dropLines,
  waterfallOffset,
  waterfallOffset3D,
  enableInset,
  insetXMin,
  insetXMax,
  panelGridCols,
  panelLabelCase,
  enableHighlight,
  highlightMin,
  highlightMax,
  interactiveMode,
  onCursorPositionChange,
  onRangeSelected,
  onPeakCreated,
  onDatasetsUpdated,
  previewCorrectedY,
  
  // Destructure new publication-grade arguments
  invertX = false,
  invertY = false,
  tickStepX = 0,
  tickStepY = 0,
  minorTicksCount = 4
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Interaction State
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);

  // Interative dragging and double-click editing of peak annotations & transitions
  const [draggingPeak, setDraggingPeak] = useState<{
    datasetId: string;
    peakId: string;
    type: 'label' | 'marker';
    initDx: number;
    initDy: number;
    startX: number;
    startY: number;
  } | null>(null);

  interface EditingPeakState {
    datasetId: string;
    peakId: string;
    x: number;
    y: number;
    label: string;
    transition: string;
  }
  const [editingPeak, setEditingPeak] = useState<EditingPeakState | null>(null);

  
  // Plotting Limits (Derived inside redraw loop)
  const limitsRef = useRef({ xMin: 0, xMax: 100, yMin: 0, yMax: 100 });

  // Get active selected/visible datasets
  const activeSeries = datasets.filter(d => d.visible);

  // Domain (axis range) computation lives in src/utils/plotDomain.ts — see
  // that file for why it's a separate, unit-tested module rather than
  // inline logic (this is the numerically risky part of the render path:
  // division by zero on a degenerate domain, or a single NaN/Infinity
  // point poisoning the whole plot's Math.min/Math.max).
  const autoDomain = computeAutoDomain(activeSeries);

  // Final rendering bounds: auto-fit or manual (free-text user input) per axis.
  const { xMin, xMax, yMin, yMax } = clampDomain({
    xMin: autoX ? autoDomain.xMin : manualXMin,
    xMax: autoX ? autoDomain.xMax : manualXMax,
    yMin: autoY ? autoDomain.yMin : manualYMin,
    yMax: autoY ? autoDomain.yMax : manualYMax,
  });

  limitsRef.current = { xMin, xMax, yMin, yMax };

  // Watch size changes on container to resize canvas properly
  useEffect(() => {
    if (!containerRef.current || !canvasRef.current) return;
    const canvas = canvasRef.current;
    
    const resizeObserver = new ResizeObserver((entries) => {
      for (let entry of entries) {
        const { width, height } = entry.contentRect;
        const dpr = window.devicePixelRatio || 1;
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
        triggerRedraw();
      }
    });

    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, [datasets, selectedDataset, layoutMode, journalStyle, plotBgColor, gridX, gridY, xMin, xMax, yMin, yMax, xLabel, yLabel, showLegend, legendPos, thickAxes, dropLines, waterfallOffset, waterfallOffset3D, enableInset, insetXMin, insetXMax, panelGridCols, panelLabelCase, enableHighlight, highlightMin, highlightMax, interactiveMode, isDragging, mousePos, dragStart]);

  // Handle re-trigger coordinates
  const triggerRedraw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Setup high DPI scale
    const exportScale = (window as any).currentExportScale;
    const dpr = exportScale !== undefined ? exportScale : (window.devicePixelRatio || 1);
    ctx.resetTransform();
    ctx.scale(dpr, dpr);

    const w = canvas.width / dpr;
    const h = canvas.height / dpr;

    // Clear Canvas
    ctx.fillStyle = plotBgColor || '#151515';
    ctx.fillRect(0, 0, w, h);

    const isDark = isColorDark(plotBgColor);
    const gridColor = isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)';
    const textColor = isDark ? '#b3b3b3' : '#1a1a1a';
    const spineColor = isDark ? '#3f3f3f' : '#b3b3b3';

    // -----------------------------------------
    // RENDER METADATA JOURNAL SETTINGS
    // -----------------------------------------
    let fontSize = 11;
    let labelFont = 'sans-serif';
    let lineW = 1.5;

    const activeJournalStyle = (window as any).currentExportJournalStyle || journalStyle;

    if (activeJournalStyle === 'ACS') {
      fontSize = 11;
      labelFont = '"Arial", "Helvetica", sans-serif';
      lineW = 2.0;
    } else if (activeJournalStyle === 'Nature') {
      fontSize = 9;
      labelFont = '"Helvetica Neue", sans-serif';
      lineW = 1.0;
    } else if (activeJournalStyle === 'RSC') {
      fontSize = 11;
      labelFont = '"Georgia", "Times New Roman", serif';
      lineW = 1.4;
    }

    ctx.font = `${fontSize}px ${labelFont}`;

    const paddingLeft = 65;
    const paddingRight = 40;
    const paddingTop = 35;
    const paddingBottom = 60;

    const plotW = w - paddingLeft - paddingRight;
    const plotH = h - paddingTop - paddingBottom;

    if (plotW <= 0 || plotH <= 0) return;

    // -----------------------------------------
    // MULTI-PANEL GRID MODE — independent subplots
    // -----------------------------------------
    // Genuinely different from every other layout mode: rather than sharing
    // one coordinate system, each panel gets its own axes, its own X/Y
    // auto-scale derived only from the datasets assigned to it, and a
    // panel letter (a/b/c or A/B/C per panelLabelCase) in its top-left
    // corner — the standard "combined Figure 1" convention required by
    // Nature, Science, Cell, and most chemistry journals for multi-part
    // figures. This is handled as a fully separate code path rather than
    // threaded through the single-canvas pipeline below, since the two
    // have almost nothing in common beyond sharing a canvas element.
    if (layoutMode === 'Multi-Panel Grid') {
      drawMultiPanelGrid(ctx, w, h, activeSeries, panelGridCols, panelLabelCase, isDark, fontSize, labelFont, lineW, gridColor, textColor, spineColor, plotBgColor, gridX, gridY, xLabel, yLabel, invertX, invertY);
      return;
    }

    // Helper functions for scaling coordinates (supports inverted axes for NMR & FTIR)
    const getPixelX = (valX: number) => {
      if (invertX) {
        return paddingLeft + plotW - ((valX - xMin) / (xMax - xMin)) * plotW;
      } else {
        return paddingLeft + ((valX - xMin) / (xMax - xMin)) * plotW;
      }
    };
    const getPixelY = (valY: number) => {
      if (invertY) {
        return paddingTop + ((valY - yMin) / (yMax - yMin)) * plotH;
      } else {
        return (paddingTop + plotH) - ((valY - yMin) / (yMax - yMin)) * plotH;
      }
    };
    
    const getValX = (pixelX: number) => {
      if (invertX) {
        return xMin + ((paddingLeft + plotW - pixelX) / plotW) * (xMax - xMin);
      } else {
        return xMin + ((pixelX - paddingLeft) / plotW) * (xMax - xMin);
      }
    };
    const getValY = (pixelY: number) => {
      if (invertY) {
        return yMin + ((pixelY - paddingTop) / plotH) * (yMax - yMin);
      } else {
        return yMin + (((paddingTop + plotH) - pixelY) / plotH) * (yMax - yMin);
      }
    };

    // Render Highlights
    if (enableHighlight && highlightMin < highlightMax) {
      const hx1 = Math.max(paddingLeft, Math.min(paddingLeft + plotW, getPixelX(highlightMin)));
      const hx2 = Math.max(paddingLeft, Math.min(paddingLeft + plotW, getPixelX(highlightMax)));
      ctx.fillStyle = isDark ? 'rgba(245, 158, 11, 0.12)' : 'rgba(245, 158, 11, 0.18)';
      ctx.fillRect(hx1, paddingTop, hx2 - hx1, plotH);
    }

    // -----------------------------------------
    // DRAWS 2D CONTOUR PLOT / HEATMAP
    // -----------------------------------------
    if (layoutMode === '2D Heatmap / Contour Plot' && activeSeries.length >= 2) {
      const rows = activeSeries.length;
      const colPoints = activeSeries[0].x.length;
      
      const cellH = plotH / rows;
      const cellW = plotW / colPoints;

      // Draw pixel maps
      for (let r = 0; r < rows; r++) {
        const ds = activeSeries[r];
        const ry = paddingTop + r * cellH;
        
        // Find spectral normalized bounds
        let dMin = Infinity;
        let dMax = -Infinity;
        ds.y_processed.forEach(v => {
          if (v < dMin) dMin = v;
          if (v > dMax) dMax = v;
        });
        const dDiff = (dMax - dMin) || 1;

        for (let c = 0; c < ds.x.length; c++) {
          const rx = getPixelX(ds.x[c]);
          const dVal = ds.y_processed[c];
          const ratio = (dVal - dMin) / dDiff;
          
          ctx.fillStyle = getCmapColor('viridis', ratio);
          ctx.fillRect(rx - cellW, ry, cellW + 0.5, cellH + 0.5);
        }

        // Draw Row Label
        ctx.fillStyle = textColor;
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillText(ds.name.slice(0, 15), paddingLeft - 10, ry + cellH / 2);
      }

      // Draw bottom axis spine
      ctx.strokeStyle = spineColor;
      ctx.lineWidth = lineW;
      ctx.beginPath();
      ctx.moveTo(paddingLeft, paddingTop + plotH);
      ctx.lineTo(paddingLeft + plotW, paddingTop + plotH);
      ctx.stroke();

      // Horizontal ticks
      ctx.fillStyle = textColor;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      const xticks = 5;
      for (let i = 0; i < xticks; i++) {
        const ratio = i / (xticks - 1);
        const val = xMin + ratio * (xMax - xMin);
        const px = getPixelX(val);
        ctx.beginPath();
        ctx.moveTo(px, paddingTop + plotH);
        ctx.lineTo(px, paddingTop + plotH + 5);
        ctx.stroke();
        ctx.fillText(val.toFixed(0), px, paddingTop + plotH + 8);
      }
      return;
    }

    // -----------------------------------------
    // DRAWS 3D WATERFALL STACK LINES
    // -----------------------------------------
    if (layoutMode === 'Waterfall Stack (3D Projection)' && activeSeries.length > 0) {
      // Sort back to front (bottom elements plotted first or vice versa depending on tilt)
      const stackCount = activeSeries.length;
      
      for (let idx = stackCount - 1; idx >= 0; idx--) {
        const ds = activeSeries[idx];
        const offsetPct = (idx / (stackCount - 1 || 1)) * waterfallOffset;
        const xOffset = offsetPct * 40;
        const yOffset = -offsetPct * 40;

        ctx.strokeStyle = ds.color || '#10b981';
        ctx.lineWidth = ds.lineWidth || lineW;
        ctx.beginPath();

        let drewAny = false;
        
        ctx.fillStyle = isDark ? 'rgba(21, 21, 21, 0.85)' : 'rgba(255, 255, 255, 0.85)';
        
        // Draw fill loop to hide back layers!
        ctx.beginPath();
        for (let i = 0; i < ds.x.length; i++) {
          const px = getPixelX(ds.x[i]) + xOffset;
          const py = getPixelY(ds.y_processed[i]) + yOffset;
          
          if (px >= paddingLeft && px <= paddingLeft + plotW) {
            if (!drewAny) {
              ctx.moveTo(px, py);
              drewAny = true;
            } else {
              ctx.lineTo(px, py);
            }
          }
        }
        
        // Form closed path at baseline
        if (drewAny) {
          ctx.lineTo(getPixelX(ds.x[ds.x.length - 1]) + xOffset, getPixelY(yMin) + yOffset);
          ctx.lineTo(getPixelX(ds.x[0]) + xOffset, getPixelY(yMin) + yOffset);
          ctx.closePath();
          ctx.fill();
        }

        // Draw line trace
        drewAny = false;
        ctx.beginPath();
        for (let i = 0; i < ds.x.length; i++) {
          const px = getPixelX(ds.x[i]) + xOffset;
          const py = getPixelY(ds.y_processed[i]) + yOffset;
          
          if (px >= paddingLeft && px <= paddingLeft + plotW) {
            if (!drewAny) {
              ctx.moveTo(px, py);
              drewAny = true;
            } else {
              ctx.lineTo(px, py);
            }
          }
        }
        ctx.stroke();
      }
      return;
    }

    // -----------------------------------------
    // STANDARD OVERLAY SPECTRUM PLOT DRAW PASS
    // -----------------------------------------

    // Render background grids
    if (gridX) {
      ctx.strokeStyle = gridColor;
      ctx.lineWidth = 0.8;
      const ticks = 6;
      for (let i = 1; i < ticks - 1; i++) {
        const px = paddingLeft + (i / (ticks - 1)) * plotW;
        ctx.beginPath();
        ctx.moveTo(px, paddingTop);
        ctx.lineTo(px, paddingTop + plotH);
        ctx.stroke();
      }
    }

    if (gridY) {
      ctx.strokeStyle = gridColor;
      ctx.lineWidth = 0.8;
      const ticks = 5;
      for (let i = 1; i < ticks - 1; i++) {
        const py = paddingTop + (i / (ticks - 1)) * plotH;
        ctx.beginPath();
        ctx.moveTo(paddingLeft, py);
        ctx.lineTo(paddingLeft + plotW, py);
        ctx.stroke();
      }
    }

    // Iteratively trace curves for active overlay series
    activeSeries.forEach((sd, index) => {
      if (sd.x.length < 2) return;

      // Only apply the waterfall vertical offset when the user has explicitly
      // selected Waterfall Stack mode. Previously this was applied
      // unconditionally in every layout mode (including Standard Overlay),
      // which silently pushed later series in a multi-column dataset far
      // outside the autoscaled Y-range and rendered them off-canvas —
      // most visible with real multi-series instrument exports (e.g. a
      // titration series with 10+ columns), where the cumulative offset
      // (index * waterfallOffset) could reach several absorbance units
      // while the actual data range was under 3.
      const offsetVal = layoutMode === 'Waterfall Stack (3D Projection)' ? index * waterfallOffset : 0;

      // Draw baseline subtraction preview if exists
      if (sd.baseline) {
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.4)';
        ctx.lineWidth = 1.0;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        let first = true;
        for (let i = 0; i < sd.x.length; i++) {
          const px = getPixelX(sd.x[i]);
          const py = getPixelY(sd.baseline[i] + offsetVal);
          if (px >= paddingLeft && px <= paddingLeft + plotW) {
            if (first) { ctx.moveTo(px, py); first = false; }
            else ctx.lineTo(px, py);
          }
        }
        ctx.stroke();
        ctx.setLineDash([]); // clear
      }

      // Draw real-time baseline corrected preview curve
      if (sd.id === selectedDataset?.id && previewCorrectedY && previewCorrectedY.length === sd.x.length) {
        ctx.strokeStyle = '#06b6d4'; // beautiful and vivid cyan preview
        ctx.lineWidth = 1.5;
        ctx.setLineDash([5, 3]);
        ctx.beginPath();
        let first = true;
        for (let i = 0; i < sd.x.length; i++) {
          const px = getPixelX(sd.x[i]);
          const py = getPixelY(previewCorrectedY[i] + offsetVal);
          if (px >= paddingLeft && px <= paddingLeft + plotW) {
            if (first) { ctx.moveTo(px, py); first = false; }
            else ctx.lineTo(px, py);
          }
        }
        ctx.stroke();
        ctx.setLineDash([]);

        // Small label overlay
        ctx.fillStyle = '#06b6d4';
        ctx.font = 'bold 9px sans-serif';
        ctx.fillText('ALS Corrected Preview Curve (Dashed Cyan)', paddingLeft + 12, paddingTop + 18);
      }

      // Draw shaded integrated area regions
      sd.integrals.forEach(intg => {
        ctx.fillStyle = 'rgba(16, 185, 129, 0.28)';
        ctx.beginPath();
        let drew = false;
        let startPx = getPixelX(intg.xmin);
        let endPx = getPixelX(intg.xmax);

        for (let i = 0; i < sd.x.length; i++) {
          const vX = sd.x[i];
          if (vX >= intg.xmin && vX <= intg.xmax) {
            const px = getPixelX(vX);
            const py = getPixelY(sd.y_processed[i] + offsetVal);
            if (px >= paddingLeft && px <= paddingLeft + plotW) {
              if (!drew) { ctx.moveTo(px, getPixelY(yMin + offsetVal)); ctx.lineTo(px, py); drew = true; }
              else ctx.lineTo(px, py);
            }
          }
        }
        if (drew) {
          ctx.lineTo(getPixelX(intg.xmax), getPixelY(yMin + offsetVal));
          ctx.lineTo(getPixelX(intg.xmin), getPixelY(yMin + offsetVal));
          ctx.closePath();
          ctx.fill();
        }
      });

      // Draw custom Curve Fit components if available
      if (sd.fitResult && sd.fitComponents) {
        // Individual Components
        sd.fitComponents.forEach((comp, cIdx) => {
          ctx.fillStyle = getCmapColor('coolwarm', cIdx / (sd.fitComponents!.length || 1));
          ctx.globalAlpha = 0.25;
          ctx.beginPath();
          let drew = false;
          for (let i = 0; i < sd.x.length; i++) {
            const px = getPixelX(sd.x[i]);
            const py = getPixelY(comp[i] + offsetVal);
            if (px >= paddingLeft && px <= paddingLeft + plotW) {
              if (!drew) { ctx.moveTo(px, getPixelY(yMin + offsetVal)); ctx.lineTo(px, py); drew = true; }
              else ctx.lineTo(px, py);
            }
          }
          if (drew) {
            ctx.lineTo(getPixelX(sd.x[sd.x.length - 1]), getPixelY(yMin + offsetVal));
            ctx.lineTo(getPixelX(sd.x[0]), getPixelY(yMin + offsetVal));
            ctx.closePath();
            ctx.fill();
          }
          ctx.globalAlpha = 1.0;

          // Component lines outline
          ctx.strokeStyle = '#e11d48';
          ctx.lineWidth = 1.0;
          ctx.beginPath();
          drew = false;
          for (let i = 0; i < sd.x.length; i++) {
            const px = getPixelX(sd.x[i]);
            const py = getPixelY(comp[i] + offsetVal);
            if (px >= paddingLeft && px <= paddingLeft + plotW) {
              if (!drew) { ctx.moveTo(px, py); drew = true; }
              else ctx.lineTo(px, py);
            }
          }
          ctx.stroke();
        });

        // Cumulative fit model
        ctx.strokeStyle = '#f43f5e';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([6, 3]);
        ctx.beginPath();
        let drewVal = false;
        for (let i = 0; i < sd.x.length; i++) {
          const px = getPixelX(sd.x[i]);
          const py = getPixelY(sd.fitResult[i] + offsetVal);
          if (px >= paddingLeft && px <= paddingLeft + plotW) {
            if (!drewVal) { ctx.moveTo(px, py); drewVal = true; }
            else ctx.lineTo(px, py);
          }
        }
        ctx.stroke();
        ctx.setLineDash([]);

        // ── FWHM BRACKETS (Tier-1) ──────────────────────────────────────────
        // Draw a horizontal bracket at half-maximum for each fitted component,
        // annotated with the FWHM value in x-axis units.
        if (sd.fitPeakStats && sd.fitPeakStats.length > 0 && layoutMode === 'Standard Overlay') {
          sd.fitPeakStats.forEach((ps, cIdx) => {
            const halfMax   = ps.amplitude / 2;
            const xLeft     = ps.center - ps.fwhm / 2;
            const xRight    = ps.center + ps.fwhm / 2;
            const pxCenter  = getPixelX(ps.center);
            const pxLeft    = getPixelX(xLeft);
            const pxRight   = getPixelX(xRight);
            const pyHalf    = getPixelY(halfMax + offsetVal);
            const compColor = getCmapColor('coolwarm', cIdx / (sd.fitPeakStats!.length || 1));

            // Skip if outside plot area
            if (pxRight < paddingLeft || pxLeft > paddingLeft + plotW) return;

            ctx.save();
            ctx.strokeStyle = compColor;
            ctx.lineWidth   = 1.2;
            ctx.globalAlpha = 0.85;

            // Horizontal span line
            ctx.beginPath();
            ctx.moveTo(Math.max(pxLeft,  paddingLeft), pyHalf);
            ctx.lineTo(Math.min(pxRight, paddingLeft + plotW), pyHalf);
            ctx.stroke();

            // Left serif tick
            ctx.beginPath();
            ctx.moveTo(Math.max(pxLeft, paddingLeft), pyHalf - 4);
            ctx.lineTo(Math.max(pxLeft, paddingLeft), pyHalf + 4);
            ctx.stroke();

            // Right serif tick
            ctx.beginPath();
            ctx.moveTo(Math.min(pxRight, paddingLeft + plotW), pyHalf - 4);
            ctx.lineTo(Math.min(pxRight, paddingLeft + plotW), pyHalf + 4);
            ctx.stroke();

            // FWHM label above the bracket
            ctx.globalAlpha = 1.0;
            ctx.fillStyle   = compColor;
            ctx.font        = `bold ${Math.max(fontSize - 2, 8)}px ${labelFont}`;
            ctx.textAlign   = 'center';
            ctx.textBaseline = 'bottom';
            const fwhmLabel = `FWHM ${ps.fwhm.toFixed(2)}`;
            // Background pill for readability
            const tw = ctx.measureText(fwhmLabel).width;
            ctx.fillStyle = isDark ? 'rgba(9,9,11,0.75)' : 'rgba(255,255,255,0.75)';
            ctx.fillRect(pxCenter - tw / 2 - 3, pyHalf - fontSize - 7, tw + 6, fontSize + 4);
            ctx.fillStyle = compColor;
            ctx.fillText(fwhmLabel, pxCenter, pyHalf - 4);

            ctx.restore();
          });
        }

        // ── RESIDUALS SUB-AXIS (Tier-1) ─────────────────────────────────────
        // Draw fit residuals in a small sub-panel at the bottom of the plot.
        // Height = 15% of plotH. Only in Standard Overlay mode.
        if (sd.fitResiduals && sd.fitResiduals.length > 0 && layoutMode === 'Standard Overlay') {
          const residH    = plotH * 0.15;
          const residTop  = paddingTop + plotH - residH;
          const residMid  = residTop + residH / 2;
          const rMax      = Math.max(...sd.fitResiduals.map(Math.abs), 1e-9);
          const rScale    = (residH / 2) / rMax;

          // Background
          ctx.fillStyle = isDark ? 'rgba(0,0,0,0.35)' : 'rgba(0,0,0,0.05)';
          ctx.fillRect(paddingLeft, residTop, plotW, residH);

          // Zero line
          ctx.strokeStyle = isDark ? '#3f3f46' : '#d4d4d8';
          ctx.lineWidth   = 0.7;
          ctx.setLineDash([3, 3]);
          ctx.beginPath();
          ctx.moveTo(paddingLeft, residMid);
          ctx.lineTo(paddingLeft + plotW, residMid);
          ctx.stroke();
          ctx.setLineDash([]);

          // Residual trace
          ctx.strokeStyle = '#94a3b8';
          ctx.lineWidth   = 0.9;
          ctx.beginPath();
          let firstR = true;
          for (let i = 0; i < sd.x.length; i++) {
            const px = getPixelX(sd.x[i]);
            const py = residMid - sd.fitResiduals[i] * rScale;
            if (px >= paddingLeft && px <= paddingLeft + plotW) {
              if (firstR) { ctx.moveTo(px, py); firstR = false; }
              else ctx.lineTo(px, py);
            }
          }
          ctx.stroke();

          // Label
          ctx.fillStyle    = isDark ? '#71717a' : '#52525b';
          ctx.font         = `${Math.max(fontSize - 3, 7)}px ${labelFont}`;
          ctx.textAlign    = 'left';
          ctx.textBaseline = 'top';
          ctx.fillText('Residuals', paddingLeft + 4, residTop + 2);

          // R² inline in residuals panel
          if (sd.fitGoodnessOfFit) {
            ctx.textAlign = 'right';
            ctx.fillText(`R²=${sd.fitGoodnessOfFit.r2.toFixed(4)}`, paddingLeft + plotW - 4, residTop + 2);
          }
        }
      }

      // -----------------------------------------
      // DRAW ERROR BARS (if yError is present)
      // -----------------------------------------
      // Drawn underneath the main trace so the line and any markers stay
      // visually clear on top. Error bars are subsampled to a readable
      // density rather than drawn at every point — with spectra commonly
      // containing 1000+ points, error whiskers at every single point would
      // overlap into an unreadable smear; this follows the same convention
      // used in typical scientific plotting libraries (matplotlib errorbar
      // with errorevery=N, OriginLab's error bar frequency control).
      if (sd.yError && sd.yError.length === sd.x.length && layoutMode === 'Standard Overlay') {
        const maxErrorBars = 30; // readable density regardless of total point count
        const step = Math.max(1, Math.floor(sd.x.length / maxErrorBars));
        const capHalfWidthPx = 4;

        ctx.save();
        ctx.strokeStyle = sd.color || '#3b82f6';
        ctx.lineWidth = 1.1;
        ctx.globalAlpha = 0.75;

        for (let i = 0; i < sd.x.length; i += step) {
          const err = sd.yError[i];
          if (err === null || err === undefined || isNaN(err) || err <= 0) continue;

          const px = getPixelX(sd.x[i]);
          if (px < paddingLeft || px > paddingLeft + plotW) continue;

          const yCenter = sd.y_processed[i] + offsetVal;
          const pyTop    = getPixelY(yCenter + err);
          const pyBottom = getPixelY(yCenter - err);

          // Vertical whisker
          ctx.beginPath();
          ctx.moveTo(px, pyTop);
          ctx.lineTo(px, pyBottom);
          ctx.stroke();

          // Top cap
          ctx.beginPath();
          ctx.moveTo(px - capHalfWidthPx, pyTop);
          ctx.lineTo(px + capHalfWidthPx, pyTop);
          ctx.stroke();

          // Bottom cap
          ctx.beginPath();
          ctx.moveTo(px - capHalfWidthPx, pyBottom);
          ctx.lineTo(px + capHalfWidthPx, pyBottom);
          ctx.stroke();
        }
        ctx.restore();
      }

      // -----------------------------------------
      // DRAW MAIN TRACE LINE
      // -----------------------------------------
      const isSelected = selectedDataset && sd.id === selectedDataset.id;
      ctx.strokeStyle = sd.color || '#3b82f6';
      ctx.lineWidth = (sd.lineWidth || lineW) + (isSelected ? 1.0 : 0);
      
      if (sd.lineStyle === 'dashed') ctx.setLineDash([6, 4]);
      else if (sd.lineStyle === 'dotted') ctx.setLineDash([2, 3]);
      else if (sd.lineStyle === 'none') ctx.setLineDash([0, 1000]);

      ctx.beginPath();
      let started = false;
      for (let i = 0; i < sd.x.length; i++) {
        const px = getPixelX(sd.x[i]);
        const py = getPixelY(sd.y_processed[i] + offsetVal);
        if (px >= paddingLeft && px <= paddingLeft + plotW) {
          if (!started) {
            ctx.moveTo(px, py);
            started = true;
          } else {
            ctx.lineTo(px, py);
          }
        }
      }
      ctx.stroke();
      ctx.setLineDash([]); // Reset line dash

      // -----------------------------------------
      // DRAW 2D CONTOURS FOR COSY SPECTROSCOPY
      // -----------------------------------------
      if (sd.technique === '2D COSY NMR Spectroscopy') {
        const cosyPeaks2D = [
          // Diagonal peaks (F1 = F2)
          { f1: 1.2, f2: 1.2, intensity: 1.0 },
          { f1: 2.0, f2: 2.0, intensity: 0.8 },
          { f1: 4.1, f2: 4.1, intensity: 0.9 },
          { f1: 7.3, f2: 7.3, intensity: 0.7 },
          { f1: 7.5, f2: 7.5, intensity: 0.6 },
          
          // Cross-peaks (F1 != F2, symmetric couplings!)
          { f1: 1.2, f2: 4.1, intensity: 0.75 },
          { f1: 4.1, f2: 1.2, intensity: 0.75 },
          { f1: 7.3, f2: 7.5, intensity: 0.5 },
          { f1: 7.5, f2: 7.3, intensity: 0.5 }
        ];

        // Draw diagonal reference line
        ctx.strokeStyle = isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)';
        ctx.lineWidth = 1.0;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        const p1x = getPixelX(xMin);
        const p1y = getPixelY(yMin);
        const p2x = getPixelX(xMax);
        const p2y = getPixelY(yMax);
        ctx.moveTo(p1x, p1y);
        ctx.lineTo(p2x, p2y);
        ctx.stroke();
        ctx.setLineDash([]);

        // Draw nested contour lines for each peak spot!
        cosyPeaks2D.forEach(peak => {
          if (peak.f1 >= xMin && peak.f1 <= xMax && peak.f2 >= xMin && peak.f2 <= xMax) {
            const px = getPixelX(peak.f1);
            const yScaled = ((peak.f2 - xMin) / (xMax - xMin || 1)) * (yMax - yMin) + yMin;
            const py = getPixelY(yScaled);

            // Draw concentric contour rings
            const rings = 4;
            for (let r = 1; r <= rings; r++) {
              const radiusVal = r * 3.5 * peak.intensity;
              ctx.strokeStyle = `rgba(20, 184, 166, ${0.8 - (r * 0.16)})`; // Teal nested contours
              ctx.lineWidth = 1.0;
              ctx.beginPath();
              ctx.ellipse(px, py, radiusVal * 1.3, radiusVal, 0, 0, 2 * Math.PI);
              ctx.stroke();

              if (r === 1) {
                ctx.fillStyle = 'rgba(20, 184, 166, 0.1)';
                ctx.fill();
              }
            }
          }
        });
      }

      // Render Markers if requested
      if (sd.marker !== 'none') {
        ctx.fillStyle = sd.color || '#3b82f6';
        const ms = sd.markerSize || 5;
        for (let i = 0; i < sd.x.length; i += 8) { // downsample markers for visual clarity
          const px = getPixelX(sd.x[i]);
          const py = getPixelY(sd.y_processed[i] + offsetVal);
          if (px >= paddingLeft && px <= paddingLeft + plotW) {
            ctx.beginPath();
            if (sd.marker === 'circle') {
              ctx.arc(px, py, ms / 2, 0, 2 * Math.PI);
              ctx.fill();
            } else if (sd.marker === 'square') {
              ctx.fillRect(px - ms / 2, py - ms / 2, ms, ms);
            } else if (sd.marker === 'triangle') {
              ctx.moveTo(px, py - ms / 2);
              ctx.lineTo(px - ms / 2, py + ms / 2);
              ctx.lineTo(px + ms / 2, py + ms / 2);
              ctx.closePath();
              ctx.fill();
            } else if (sd.marker === 'cross') {
              ctx.strokeStyle = sd.color || '#3b82f6';
              ctx.lineWidth = 1;
              ctx.moveTo(px - ms/2, py - ms/2); ctx.lineTo(px + ms/2, py + ms/2);
              ctx.moveTo(px - ms/2, py + ms/2); ctx.lineTo(px + ms/2, py - ms/2);
              ctx.stroke();
            }
          }
        }
      }

      // ─────────────────────────────────────────
      // DRAW CV ANNOTATION OVERLAY  (Tier-4)
      // ─────────────────────────────────────────
      // When sd.technique === 'Cyclic Voltammetry' draw Epa, Epc, E½ markers
      if (sd.technique === 'Cyclic Voltammetry' && (sd as any).cvResult && layoutMode === 'Standard Overlay') {
        const cv: CVSimResult = (sd as any).cvResult;
        const yPa = getPixelY(cv.ipa + offsetVal);
        const yPc = getPixelY(cv.ipc + offsetVal);
        const xPa = getPixelX(cv.Epa);
        const xPc = getPixelX(cv.Epc);

        // Epa marker
        ctx.strokeStyle = '#4ade80'; ctx.lineWidth = 1;
        ctx.setLineDash([3,3]);
        ctx.beginPath(); ctx.moveTo(xPa, yPa); ctx.lineTo(xPa, paddingTop + plotH); ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = '#4ade80'; ctx.font = `bold ${Math.max(fontSize-1,8)}px ${labelFont}`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
        ctx.fillText(`Epa=${cv.Epa.toFixed(3)}V`, xPa, yPa - 4);

        // Epc marker
        ctx.strokeStyle = '#34d399'; ctx.lineWidth = 1;
        ctx.setLineDash([3,3]);
        ctx.beginPath(); ctx.moveTo(xPc, yPc); ctx.lineTo(xPc, paddingTop + plotH); ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = '#34d399';
        ctx.textBaseline = 'top';
        ctx.fillText(`Epc=${cv.Epc.toFixed(3)}V`, xPc, yPc + 4);

        // E½ vertical line
        const xHalf = getPixelX(cv.E_half);
        ctx.strokeStyle = '#a3e635'; ctx.lineWidth = 0.8;
        ctx.setLineDash([2,4]);
        ctx.beginPath(); ctx.moveTo(xHalf, paddingTop); ctx.lineTo(xHalf, paddingTop+plotH); ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = '#a3e635'; ctx.font = `${Math.max(fontSize-2,7)}px ${labelFont}`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'top';
        ctx.fillText(`E½=${cv.E_half.toFixed(3)}V`, xHalf, paddingTop+4);

        // ΔEp annotation box
        ctx.fillStyle = isDark ? 'rgba(9,9,11,0.82)' : 'rgba(255,255,255,0.88)';
        ctx.strokeStyle = '#4ade80'; ctx.lineWidth = 0.8;
        ctx.beginPath(); ctx.roundRect(paddingLeft+6, paddingTop+6, 130, 30, 4); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#4ade80'; ctx.font = `bold ${Math.max(fontSize-1,8)}px ${labelFont}`;
        ctx.textAlign = 'left'; ctx.textBaseline = 'top';
        ctx.fillText(`ΔEp = ${(cv.deltaEp*1000).toFixed(1)} mV`, paddingLeft+10, paddingTop+10);
        ctx.fillStyle = isDark ? '#a1a1aa' : '#52525b'; ctx.font = `${Math.max(fontSize-2,7)}px ${labelFont}`;
        ctx.fillText(`E½ = ${cv.E_half.toFixed(3)} V`, paddingLeft+10, paddingTop+22);
      }

      // ─────────────────────────────────────────
      // DRAW EIS / NYQUIST ANNOTATION  (Tier-4)
      // ─────────────────────────────────────────
      if (sd.technique === 'EIS Nyquist' && (sd as any).eisResult && layoutMode === 'Standard Overlay') {
        const eis: EISSimResult = (sd as any).eisResult;
        // Semicircle diameter annotation
        const xRs   = getPixelX(eis.Rs);
        const xRsRct = getPixelX(eis.Rs + eis.Rct);
        const yBase  = paddingTop + plotH - 10;

        ctx.strokeStyle = '#a78bfa'; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(xRs, yBase); ctx.lineTo(xRsRct, yBase); ctx.stroke();
        // Ticks
        [xRs, xRsRct].forEach(x => {
          ctx.beginPath(); ctx.moveTo(x, yBase-5); ctx.lineTo(x, yBase+5); ctx.stroke();
        });
        ctx.fillStyle = '#a78bfa'; ctx.font = `${Math.max(fontSize-2,7)}px ${labelFont}`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'top';
        ctx.fillText(`Rct=${eis.Rct.toFixed(0)}Ω`, (xRs+xRsRct)/2, yBase+6);

        // Rs marker
        ctx.fillStyle = '#c4b5fd'; ctx.font = `${Math.max(fontSize-2,7)}px ${labelFont}`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
        ctx.fillText(`Rs=${eis.Rs.toFixed(0)}Ω`, xRs, yBase-8);
      }

      // ─────────────────────────────────────────
      // DRAW PL-EX MAP INSET  (Tier-4)
      // ─────────────────────────────────────────
      if ((sd as any).plexResult && layoutMode === 'Standard Overlay') {
        const plex: PLEXMapResult = (sd as any).plexResult;
        const insetW = Math.min(180, plotW * 0.30);
        const insetH = Math.min(140, plotH * 0.30);
        const insetX = paddingLeft + plotW - insetW - 8;
        const insetY = paddingTop + 8;

        ctx.fillStyle = isDark ? 'rgba(9,9,11,0.90)' : 'rgba(255,255,255,0.92)';
        ctx.strokeStyle = '#f472b6'; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.roundRect(insetX, insetY, insetW, insetH, 5); ctx.fill(); ctx.stroke();

        ctx.fillStyle = '#f472b6'; ctx.font = `bold ${Math.max(fontSize-1,8)}px ${labelFont}`;
        ctx.textAlign = 'left'; ctx.textBaseline = 'top';
        ctx.fillText('PL-EX Map', insetX+6, insetY+5);

        // Render mini heatmap pixel by pixel
        const nEx = plex.ex_nm.length, nEm = plex.em_nm.length;
        const maxV = Math.max(...plex.intensity.flat()) || 1;
        const cellW = (insetW-12) / nEx;
        const cellH = (insetH-26) / nEm;
        for (let i = 0; i < nEx; i++) {
          for (let j = 0; j < nEm; j++) {
            const norm = plex.intensity[i][j] / maxV;
            const r = Math.round(norm * 255);
            const g = Math.round(norm * 80);
            const b = Math.round((1-norm)*180);
            ctx.fillStyle = `rgba(${r},${g},${b},0.9)`;
            ctx.fillRect(insetX+6+i*cellW, insetY+20+j*cellH, Math.max(cellW,1), Math.max(cellH,1));
          }
        }
        // Stokes shift label
        ctx.fillStyle = '#fda4af'; ctx.font = `${Math.max(fontSize-2,7)}px ${labelFont}`;
        ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
        ctx.fillText(`Stokes Δ=${plex.stokes_shift_nm}nm`, insetX+6, insetY+insetH-2);
      }

      // ─────────────────────────────────────────
      // DRAW FFT / PSD INSET OVERLAY  (Tier-3)
      // ─────────────────────────────────────────
      if ((sd as any).fftResult && layoutMode === 'Standard Overlay') {
        const fr: FFTResult = (sd as any).fftResult;
        const insetW = Math.min(240, plotW * 0.38);
        const insetH = Math.min(130, plotH * 0.28);
        const insetX = paddingLeft + 10;
        const insetY = paddingTop + plotH - insetH - 10;

        ctx.fillStyle   = isDark ? 'rgba(9,9,11,0.90)' : 'rgba(255,255,255,0.92)';
        ctx.strokeStyle = '#eab308';
        ctx.lineWidth   = 1.2;
        ctx.beginPath(); ctx.roundRect(insetX, insetY, insetW, insetH, 5);
        ctx.fill(); ctx.stroke();

        ctx.fillStyle    = '#eab308';
        ctx.font         = `bold ${Math.max(fontSize-1,8)}px ${labelFont}`;
        ctx.textAlign    = 'left'; ctx.textBaseline = 'top';
        ctx.fillText('Power Spectral Density', insetX+8, insetY+5);

        // Downsample PSD for display
        const psd = fr.psd.slice(1);  // skip DC
        const step = Math.max(1, Math.floor(psd.length / 120));
        const psdSub  = psd.filter((_, i) => i % step === 0);
        const logPsd  = psdSub.map(v => Math.log10(v + 1e-30));
        const minL    = Math.min(...logPsd);
        const maxL    = Math.max(...logPsd) - minL || 1;

        const iPX = insetX + 8, iPY = insetY + 22;
        const iPW = insetW - 16, iPH = insetH - 36;
        const barW = iPW / psdSub.length;

        for (let i = 0; i < psdSub.length; i++) {
          const h   = ((logPsd[i] - minL) / maxL) * iPH;
          const isDom = (i * step + 1) === fr.dominantFreqIndex;
          ctx.fillStyle = isDom ? '#facc15' : (isDark ? '#713f12' : '#ca8a04');
          ctx.fillRect(iPX + i * barW, iPY + iPH - h, Math.max(barW - 0.5, 1), h);
        }

        // Dominant freq label
        ctx.fillStyle    = '#fde047';
        ctx.font         = `${Math.max(fontSize-2,7)}px ${labelFont}`;
        ctx.textAlign    = 'left'; ctx.textBaseline = 'bottom';
        ctx.fillText(`f* = ${fr.dominantFreq.toExponential(2)}  T = ${fr.dominantPeriod.toFixed(2)}`, insetX+8, insetY+insetH-3);
      }

      // ─────────────────────────────────────────
      // DRAW AUTOCORRELATION INSET  (Tier-3)
      // ─────────────────────────────────────────
      if ((sd as any).acfResult && layoutMode === 'Standard Overlay') {
        const ac: AutocorrResult = (sd as any).acfResult;
        const insetW = Math.min(200, plotW * 0.30);
        const insetH = Math.min(100, plotH * 0.22);
        const insetX = paddingLeft + plotW - insetW - 10;
        const insetY = paddingTop + plotH - insetH - 10;

        ctx.fillStyle   = isDark ? 'rgba(9,9,11,0.88)' : 'rgba(255,255,255,0.9)';
        ctx.strokeStyle = '#0d9488';
        ctx.lineWidth   = 1.2;
        ctx.beginPath(); ctx.roundRect(insetX, insetY, insetW, insetH, 5);
        ctx.fill(); ctx.stroke();

        ctx.fillStyle    = '#0d9488';
        ctx.font         = `bold ${Math.max(fontSize-1,8)}px ${labelFont}`;
        ctx.textAlign    = 'left'; ctx.textBaseline = 'top';
        ctx.fillText('Autocorrelation r(τ)', insetX+8, insetY+5);

        const acf  = ac.acf;
        const step = Math.max(1, Math.floor(acf.length / 80));
        const sub  = acf.filter((_, i) => i % step === 0);
        const iPX  = insetX + 8, iPY = insetY + 20;
        const iPW  = insetW - 16, iPH = insetH - 32;
        const bW   = iPW / sub.length;
        const mid  = iPY + iPH / 2;

        // zero line
        ctx.strokeStyle = isDark ? '#27272a' : '#d4d4d8';
        ctx.lineWidth   = 0.6;
        ctx.beginPath(); ctx.moveTo(iPX, mid); ctx.lineTo(iPX + iPW, mid); ctx.stroke();

        // bars
        for (let i = 0; i < sub.length; i++) {
          const h = Math.abs(sub[i]) * (iPH / 2);
          ctx.fillStyle = sub[i] >= 0 ? '#0d9488' : '#e11d48';
          if (sub[i] >= 0) ctx.fillRect(iPX + i*bW, mid - h, Math.max(bW-0.5,1), h);
          else ctx.fillRect(iPX + i*bW, mid, Math.max(bW-0.5,1), h);
        }

        ctx.fillStyle    = isDark ? '#71717a' : '#52525b';
        ctx.font         = `${Math.max(fontSize-3,6)}px ${labelFont}`;
        ctx.textAlign    = 'right'; ctx.textBaseline = 'bottom';
        ctx.fillText(`Lc=${ac.coherenceLength}`, insetX+insetW-6, insetY+insetH-3);
      }

      // ─────────────────────────────────────────
      // DRAW WILLIAMSON–HALL INSET OVERLAY
      // ─────────────────────────────────────────
      if ((sd as any).whResult && layoutMode === 'Standard Overlay') {
        const whr: WilliamsonHallResult = (sd as any).whResult;
        const insetW = Math.min(220, plotW * 0.38);
        const insetH = Math.min(155, plotH * 0.34);
        const insetX = paddingLeft + plotW - insetW - 10;
        const insetY = paddingTop + 10;

        ctx.fillStyle   = isDark ? 'rgba(9,9,11,0.88)' : 'rgba(255,255,255,0.9)';
        ctx.strokeStyle = '#f97316';
        ctx.lineWidth   = 1.2;
        ctx.beginPath();
        ctx.roundRect(insetX, insetY, insetW, insetH, 5);
        ctx.fill(); ctx.stroke();

        ctx.fillStyle    = '#f97316';
        ctx.font         = `bold ${Math.max(fontSize - 1, 8)}px ${labelFont}`;
        ctx.textAlign    = 'left'; ctx.textBaseline = 'top';
        ctx.fillText('Williamson–Hall Plot', insetX + 8, insetY + 5);
        ctx.fillStyle = isDark ? '#71717a' : '#52525b';
        ctx.font      = `${Math.max(fontSize - 3, 7)}px ${labelFont}`;
        ctx.fillText('β·cosθ  vs  4·sinθ', insetX + 8, insetY + 17);

        const xArr = whr.fourSinTheta, yArr = whr.betaCosTheta;
        const xMin = Math.min(...xArr)*0.94, xMax = Math.max(...xArr)*1.06;
        const yMin = Math.min(...yArr)*0.88, yMax = Math.max(...yArr)*1.12;
        const iPX = insetX + 30, iPY = insetY + 30;
        const iPW = insetW - 38, iPH = insetH - 46;
        const ix = (v: number) => iPX + ((v-xMin)/(xMax-xMin))*iPW;
        const iy = (v: number) => iPY + iPH - ((v-yMin)/(yMax-yMin))*iPH;

        ctx.strokeStyle = isDark ? '#3f3f46' : '#d4d4d8';
        ctx.lineWidth   = 0.8;
        ctx.beginPath();
        ctx.moveTo(iPX, iPY); ctx.lineTo(iPX, iPY+iPH); ctx.lineTo(iPX+iPW, iPY+iPH);
        ctx.stroke();

        ctx.fillStyle = isDark ? '#52525b' : '#71717a';
        ctx.font      = `${Math.max(fontSize-3, 6)}px ${labelFont}`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'top';
        ctx.fillText('4·sinθ', iPX + iPW/2, iPY + iPH + 3);
        ctx.save();
        ctx.translate(iPX - 18, iPY + iPH/2);
        ctx.rotate(-Math.PI/2);
        ctx.textBaseline = 'middle';
        ctx.fillText('β·cosθ', 0, 0);
        ctx.restore();

        // Regression line
        ctx.strokeStyle = '#f97316'; ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        ctx.moveTo(ix(xMin), iy(whr.slope*xMin + whr.intercept));
        ctx.lineTo(ix(xMax), iy(whr.slope*xMax + whr.intercept));
        ctx.stroke(); ctx.setLineDash([]);

        // Data points
        for (let i = 0; i < xArr.length; i++) {
          ctx.fillStyle = '#fb923c';
          ctx.beginPath(); ctx.arc(ix(xArr[i]), iy(yArr[i]), 3.5, 0, 2*Math.PI); ctx.fill();
          ctx.strokeStyle = isDark ? '#09090b' : '#fff'; ctx.lineWidth = 0.6; ctx.stroke();
        }

        ctx.fillStyle    = isDark ? '#e4e4e7' : '#18181b';
        ctx.font         = `bold ${Math.max(fontSize-2, 7)}px ${labelFont}`;
        ctx.textAlign    = 'left'; ctx.textBaseline = 'bottom';
        ctx.fillText(`D = ${whr.D_nm.toFixed(2)} nm   ε = ${whr.microstrain.toExponential(2)}`, insetX+8, insetY+insetH-14);
        ctx.fillStyle = isDark ? '#71717a' : '#52525b';
        ctx.font      = `${Math.max(fontSize-3, 7)}px ${labelFont}`;
        ctx.fillText(`R² = ${whr.r2.toFixed(4)}`, insetX+8, insetY+insetH-3);
      }

      // ─────────────────────────────────────────
      // DRAW KUBELKA–MUNK F(R) INSET OVERLAY
      // ─────────────────────────────────────────
      if ((sd as any).kmResult && layoutMode === 'Standard Overlay') {
        const kmr: KubelkaMunkResult = (sd as any).kmResult;
        const insetW = Math.min(200, plotW * 0.32);
        const insetH = Math.min(115, plotH * 0.24);
        const insetX = paddingLeft + 10;
        const insetY = paddingTop + 10;

        ctx.fillStyle   = isDark ? 'rgba(9,9,11,0.88)' : 'rgba(255,255,255,0.9)';
        ctx.strokeStyle = '#84cc16'; ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.roundRect(insetX, insetY, insetW, insetH, 5);
        ctx.fill(); ctx.stroke();

        ctx.fillStyle    = '#84cc16';
        ctx.font         = `bold ${Math.max(fontSize-1, 8)}px ${labelFont}`;
        ctx.textAlign    = 'left'; ctx.textBaseline = 'top';
        ctx.fillText('Kubelka–Munk  F(R)', insetX+8, insetY+5);

        const frArr = kmr.FR, hnuArr = kmr.hnu_eV;
        const frMax = Math.max(...frArr)*1.05 || 1;
        const eMin  = Math.min(...hnuArr), eMax = Math.max(...hnuArr);
        const iPX2  = insetX+8, iPY2 = insetY+20;
        const iPW2  = insetW-16, iPH2 = insetH-34;
        const ix2 = (v: number) => iPX2 + ((v-eMin)/(eMax-eMin))*iPW2;
        const iy2 = (v: number) => iPY2 + iPH2 - (v/frMax)*iPH2;

        ctx.strokeStyle = '#84cc16'; ctx.lineWidth = 1.5;
        ctx.beginPath();
        let first2 = true;
        for (let i = 0; i < frArr.length; i++) {
          const px2 = ix2(hnuArr[i]), py2 = iy2(frArr[i]);
          if (px2 >= iPX2 && px2 <= iPX2+iPW2) {
            if (first2) { ctx.moveTo(px2, py2); first2 = false; }
            else ctx.lineTo(px2, py2);
          }
        }
        ctx.stroke();

        ctx.fillStyle    = '#bef264';
        ctx.font         = `bold ${Math.max(fontSize-1, 8)}px ${labelFont}`;
        ctx.textAlign    = 'left'; ctx.textBaseline = 'bottom';
        ctx.fillText(`Eg = ${kmr.Eg_eV.toFixed(3)} eV (${kmr.transition})`, insetX+8, insetY+insetH-3);
      }

      // ─────────────────────────────────────────
      // DRAW FFT PSD INSET OVERLAY
      // ─────────────────────────────────────────
      if ((sd as any).fftResult && layoutMode === 'Standard Overlay') {
        const fft: FFTResult = (sd as any).fftResult;
        const insetW = Math.min(210, plotW * 0.35);
        const insetH = Math.min(130, plotH * 0.28);
        const insetX = paddingLeft + plotW - insetW - 10;
        const insetY = paddingTop + 10;

        ctx.fillStyle   = isDark ? 'rgba(9,9,11,0.88)' : 'rgba(255,255,255,0.9)';
        ctx.strokeStyle = '#d946ef';
        ctx.lineWidth   = 1.2;
        ctx.beginPath(); ctx.roundRect(insetX, insetY, insetW, insetH, 5);
        ctx.fill(); ctx.stroke();

        ctx.fillStyle = '#d946ef';
        ctx.font = `bold ${Math.max(fontSize-1, 8)}px ${labelFont}`;
        ctx.textAlign = 'left'; ctx.textBaseline = 'top';
        ctx.fillText('Power Spectral Density', insetX+8, insetY+5);

        const psd   = fft.psd.slice(1);   // skip DC
        const maxP  = Math.max(...psd) || 1;
        const iPX   = insetX+8, iPY = insetY+22;
        const iPW   = insetW-16, iPH = insetH-34;
        const step  = Math.max(1, Math.floor(psd.length/iPW));

        for (let k = 0; k < psd.length; k += step) {
          const bx = iPX + (k/psd.length)*iPW;
          const bh = (psd[k]/maxP)*iPH;
          ctx.fillStyle = k === fft.dominantFreqIndex - 1 ? '#e879f9' : isDark ? '#6b21a8' : '#a855f7';
          ctx.fillRect(bx, iPY + iPH - bh, Math.max(1, iPW/psd.length*step - 0.5), bh);
        }

        // Axes
        ctx.strokeStyle = isDark ? '#3f3f46' : '#d4d4d8'; ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(iPX, iPY); ctx.lineTo(iPX, iPY+iPH); ctx.lineTo(iPX+iPW, iPY+iPH);
        ctx.stroke();

        ctx.fillStyle    = '#e879f9';
        ctx.font         = `bold ${Math.max(fontSize-2, 7)}px ${labelFont}`;
        ctx.textAlign    = 'left'; ctx.textBaseline = 'bottom';
        ctx.fillText(`f*=${fft.dominantFreq.toFixed(4)}  T*=${fft.dominantPeriod.toFixed(2)}`, insetX+8, insetY+insetH-3);
      }

      // ─────────────────────────────────────────
      // DRAW HCA DISTANCE MATRIX HEATMAP INSET
      // ─────────────────────────────────────────
      if ((sd as any).hcaResult && layoutMode === 'Standard Overlay') {
        const hca: HCAResult = (sd as any).hcaResult;
        const n    = hca.distMatrix.length;
        const side = Math.min(140, plotH * 0.28, plotW * 0.22);
        const insetX = paddingLeft + 10;
        const insetY = paddingTop + 10;
        const cellSize = Math.floor(side / n);
        const actualSide = cellSize * n;

        ctx.fillStyle   = isDark ? 'rgba(9,9,11,0.88)' : 'rgba(255,255,255,0.9)';
        ctx.strokeStyle = '#f97316'; ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.roundRect(insetX, insetY, actualSide + 20, actualSide + 26, 5);
        ctx.fill(); ctx.stroke();

        ctx.fillStyle = '#f97316';
        ctx.font = `bold ${Math.max(fontSize-1, 8)}px ${labelFont}`;
        ctx.textAlign = 'left'; ctx.textBaseline = 'top';
        ctx.fillText('Cosine Distance Matrix', insetX+6, insetY+5);

        // Heatmap cells
        for (let i = 0; i < n; i++) {
          for (let j = 0; j < n; j++) {
            const v = hca.distMatrix[i][j];
            const t = Math.min(v / 1.2, 1);
            const r = Math.round(255 * t);
            const b = Math.round(255 * (1 - t));
            ctx.fillStyle = `rgb(${r},${Math.round(30*(1-t))},${b})`;
            ctx.fillRect(insetX + 6 + j*cellSize, insetY + 18 + i*cellSize, cellSize, cellSize);
          }
        }

        // Cluster label badges on diagonal
        for (let i = 0; i < n; i++) {
          const lbl = hca.labels[i];
          ctx.fillStyle = `hsl(${30 + lbl*60},80%,55%)`;
          ctx.fillRect(insetX + 6 + i*cellSize, insetY + 18 + actualSide + 2, cellSize, 4);
        }

        ctx.fillStyle    = isDark ? '#71717a' : '#52525b';
        ctx.font         = `${Math.max(fontSize-3, 6)}px ${labelFont}`;
        ctx.textAlign    = 'left'; ctx.textBaseline = 'bottom';
        ctx.fillText(`${hca.nClusters} clusters · cut=${(sd as any).hcaCut ?? ''}`, insetX+6, insetY + 18 + actualSide + 20);
      }

      // -----------------------------------------
      // DRAW PEAKS & SCIENTIFIC ANNOTATIONS
      // -----------------------------------------
      sd.peaks.forEach(p => {
        const pyVal = p.y + offsetVal;
        const pPx = getPixelX(p.x);
        const pPy = getPixelY(pyVal);

        if (pPx >= paddingLeft && pPx <= paddingLeft + plotW) {
          // Draw peak drop-line pointer
          if (dropLines) {
            ctx.strokeStyle = isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0,0,0,0.18)';
            ctx.lineWidth = 1;
            ctx.setLineDash([2, 2]);
            ctx.beginPath();
            ctx.moveTo(pPx, pPy);
            ctx.lineTo(pPx, getPixelY(yMin + offsetVal));
            ctx.stroke();
            ctx.setLineDash([]);
          }

          // Draw marker accent
          ctx.fillStyle = sd.color || '#3b82f6';
          ctx.beginPath();
          ctx.arc(pPx, pPy, 4, 0, 2 * Math.PI);
          ctx.fill();

          // Connect text offset coordinates
          const tPx = pPx + p.dx;
          const tPy = pPy - p.dy;

          ctx.strokeStyle = sd.color || '#3b82f6';
          ctx.fillStyle = sd.color || '#3b82f6';
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.moveTo(tPx, tPy);
          ctx.lineTo(pPx, pPy);
          ctx.stroke();

          // Elegant arrowhead at (pPx, pPy) pointing exactly to peak
          const arrowHeadLength = 6;
          const arrowAngle = Math.atan2(pPy - tPy, pPx - tPx);
          ctx.beginPath();
          ctx.moveTo(pPx, pPy);
          ctx.lineTo(
            pPx - arrowHeadLength * Math.cos(arrowAngle - Math.PI / 6),
            pPy - arrowHeadLength * Math.sin(arrowAngle - Math.PI / 6)
          );
          ctx.lineTo(
            pPx - arrowHeadLength * Math.cos(arrowAngle + Math.PI / 6),
            pPy - arrowHeadLength * Math.sin(arrowAngle + Math.PI / 6)
          );
          ctx.closePath();
          ctx.fill();

          // Text content
          ctx.fillStyle = textColor;
          ctx.textAlign = p.dx > 0 ? 'left' : 'right';
          ctx.textBaseline = p.dy > 0 ? 'bottom' : 'top';
          
          const labelParts = [p.x.toFixed(2)];
          if (p.label) labelParts.push(p.label);
          if (p.transition) labelParts.push(`[${p.transition}]`);
          const peakText = labelParts.join('\n');
          
          // Row breaks helper for assignments
          const lines = peakText.split('\n');
          lines.forEach((line, lineI) => {
            const fontOffset = lineI * (fontSize + 3);
            ctx.fillText(
              line,
              p.dx > 0 ? tPx + 4 : tPx - 4,
              p.dy > 0 ? tPy - 4 + fontOffset : tPy + 4 + fontOffset
            );
          });
        }
      });

      // -----------------------------------------
      // DRAW TAUC PLOT EXTRAPOLATION
      // -----------------------------------------
      if (sd.isTauc && sd.taucData) {
        const { m, c, eg, transition } = sd.taucData;
        const x_tangent_start = eg - 0.3;
        const x_tangent_end = eg + 1.0;
        
        ctx.strokeStyle = '#f97316'; // Vivid orange tangent
        ctx.lineWidth = 2.0;
        ctx.setLineDash([6, 3]);
        ctx.beginPath();
        
        const tx1 = getPixelX(x_tangent_start);
        const ty1 = getPixelY((m * x_tangent_start + c) + offsetVal);
        const tx2 = getPixelX(x_tangent_end);
        const ty2 = getPixelY((m * x_tangent_end + c) + offsetVal);
        
        ctx.moveTo(tx1, ty1);
        ctx.lineTo(tx2, ty2);
        ctx.stroke();
        ctx.setLineDash([]);

        // Draw intercept point at Y = 0
        const ix = getPixelX(eg);
        const iy = getPixelY(0 + offsetVal);
        
        ctx.fillStyle = '#f97316';
        ctx.beginPath();
        ctx.arc(ix, iy, 7, 0, 2 * Math.PI);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(ix, iy, 3, 0, 2 * Math.PI);
        ctx.fill();

        // Draw beautiful callout bubble / text label
        const lx = ix - 50;
        const ly = iy - 60;
        
        ctx.strokeStyle = '#f97316';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(ix, iy);
        ctx.lineTo(lx, ly);
        ctx.stroke();

        ctx.fillStyle = 'rgba(15, 23, 42, 0.95)'; // Slate-900 high-density backdrop
        ctx.strokeStyle = '#f97316';
        ctx.lineWidth = 1.5;
        const rectW = 140;
        const rectH = 34;
        ctx.beginPath();
        ctx.roundRect(lx - rectW / 2, ly - rectH, rectW, rectH, 5);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 10px "Inter", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`Eg = ${eg.toFixed(3)} eV`, lx, ly - 20);
        ctx.fillStyle = '#94a3b8';
        ctx.font = '8px "JetBrains Mono", monospace';
        ctx.fillText(`${transition.toUpperCase()} BANDGAP`, lx, ly - 8);
      }

      // -----------------------------------------
      // DRAW JOB'S STOICHIOMETRY PLOT EXTENSIONS
      // -----------------------------------------
      if (sd.technique === "Job's Plot" && sd.jobsData) {
        const { x_int, y_int, m1, c1, m2, c2 } = sd.jobsData;
        
        // Draw left tangent line
        ctx.strokeStyle = '#e11d48'; // Bright Rose/Crimson
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 2]);
        ctx.beginPath();
        ctx.moveTo(getPixelX(0), getPixelY(c1 + offsetVal));
        ctx.lineTo(getPixelX(x_int), getPixelY((m1 * x_int + c1) + offsetVal));
        ctx.stroke();

        // Draw right tangent line
        ctx.beginPath();
        ctx.moveTo(getPixelX(x_int), getPixelY((m2 * x_int + c2) + offsetVal));
        ctx.lineTo(getPixelX(1.0), getPixelY((m2 * 1.0 + c2) + offsetVal));
        ctx.stroke();
        ctx.setLineDash([]);

        // Vertical drop line from intersection to X-axis
        const ix = getPixelX(x_int);
        const iy = getPixelY(y_int + offsetVal);
        const ibaseY = getPixelY(0 + offsetVal);

        ctx.strokeStyle = 'rgba(225, 29, 72, 0.4)';
        ctx.lineWidth = 1.0;
        ctx.setLineDash([2, 2]);
        ctx.beginPath();
        ctx.moveTo(ix, iy);
        ctx.lineTo(ix, ibaseY);
        ctx.stroke();
        ctx.setLineDash([]);

        // Intercept node marker
        ctx.fillStyle = '#e11d48';
        ctx.beginPath();
        ctx.arc(ix, iy, 6, 0, 2 * Math.PI);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(ix, iy, 2.5, 0, 2 * Math.PI);
        ctx.fill();

        // Stoichiometry formula resolution
        let ratioLabel = "ML Complex";
        let ratioDesc = " stoichiometry undetermined";
        if (Math.abs(x_int - 0.5) <= 0.08) {
          ratioLabel = "1:1 Binding Ratio";
          ratioDesc = "Form: ML Complex (x ≈ 0.50)";
        } else if (Math.abs(x_int - 0.33) <= 0.08) {
          ratioLabel = "1:2 Binding Ratio";
          ratioDesc = "Form: ML₂ Complex (x ≈ 0.33)";
        } else if (Math.abs(x_int - 0.67) <= 0.08) {
          ratioLabel = "2:1 Binding Ratio";
          ratioDesc = "Form: M₂L Complex (x ≈ 0.67)";
        } else if (Math.abs(x_int - 0.25) <= 0.06) {
          ratioLabel = "1:3 Binding Ratio";
          ratioDesc = "Form: ML₃ Complex (x ≈ 0.25)";
        } else if (Math.abs(x_int - 0.75) <= 0.06) {
          ratioLabel = "3:1 Binding Ratio";
          ratioDesc = "Form: M₃L Complex (x ≈ 0.75)";
        } else {
          const lNum = Math.round(x_int * 10);
          const rNum = Math.round((1 - x_int) * 10);
          ratioLabel = `Complex ratio ${lNum}:${rNum}`;
          ratioDesc = `Mole fraction x ≈ ${x_int.toFixed(2)}`;
        }

        // Draw elegant callout box near the intersection
        const lx = ix;
        const ly = iy - 50;

        ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
        ctx.strokeStyle = '#e11d48';
        ctx.lineWidth = 1.5;
        const rectW = 160;
        const rectH = 38;
        ctx.beginPath();
        ctx.roundRect(lx - rectW / 2, ly - rectH, rectW, rectH, 5);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 10px "Inter", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(ratioLabel, lx, ly - 23);
        ctx.fillStyle = '#fda4af'; // light pink
        ctx.font = '8px "JetBrains Mono", monospace';
        ctx.fillText(ratioDesc, lx, ly - 10);
      }
    });

    // -----------------------------------------
    // DRAW STATISTICAL SIGNIFICANCE BRACKETS
    // -----------------------------------------
    // Drawn in a separate pass after all traces, so brackets appear above
    // every series' line rather than being occluded by a later-drawn trace.
    // Convention: horizontal bracket spanning x1-x2 at height y, with the
    // marker (ns/*/**/***) centered above it — the standard comparison
    // annotation used throughout the chemistry/biology literature.
    if (layoutMode === 'Standard Overlay') {
      activeSeries.forEach(sd => {
        if (!sd.significanceAnnotations || sd.significanceAnnotations.length === 0) return;

        sd.significanceAnnotations.forEach(ann => {
          const px1 = getPixelX(ann.x1);
          const px2 = getPixelX(ann.x2);
          const py  = getPixelY(ann.y);

          if (px2 < paddingLeft || px1 > paddingLeft + plotW) return; // fully off-canvas

          const capHeight = 6;
          const textColor = isDark ? '#f1f5f9' : '#1e293b';

          ctx.save();
          ctx.strokeStyle = textColor;
          ctx.lineWidth = 1.2;

          // Horizontal bracket bar
          ctx.beginPath();
          ctx.moveTo(px1, py);
          ctx.lineTo(px2, py);
          ctx.stroke();

          // Downward end-caps (bracket "ticks")
          ctx.beginPath();
          ctx.moveTo(px1, py);
          ctx.lineTo(px1, py + capHeight);
          ctx.moveTo(px2, py);
          ctx.lineTo(px2, py + capHeight);
          ctx.stroke();

          // Marker text, centered above the bracket
          const midPx = (px1 + px2) / 2;
          ctx.fillStyle = textColor;
          ctx.font = ann.marker === 'ns'
            ? `${Math.max(fontSize - 2, 8)}px ${labelFont}`
            : `bold ${Math.max(fontSize + 1, 11)}px ${labelFont}`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'bottom';
          ctx.fillText(ann.marker, midPx, py - 3);

          // Optional comparison label, shown smaller below the marker line
          if (ann.label) {
            ctx.font = `${Math.max(fontSize - 4, 7)}px ${labelFont}`;
            ctx.fillStyle = isDark ? '#94a3b8' : '#64748b';
            ctx.textBaseline = 'top';
            ctx.fillText(ann.label, midPx, py + capHeight + 2);
          }

          ctx.restore();
        });
      });
    }

    // -----------------------------------------
    // DRAWS CHART AXES, BOUNDS, SPINES (ACS/NATURE INWARD TICKS)
    // -----------------------------------------
    ctx.strokeStyle = spineColor;
    ctx.lineWidth = thickAxes ? 2.0 : lineW;
    
    // Draw 4 border spines forming a complete boxed frame (ACS specification)
    ctx.beginPath();
    ctx.rect(paddingLeft, paddingTop, plotW, plotH);
    ctx.stroke();

    // Minor/Major Ticks
    ctx.fillStyle = textColor;
    ctx.lineWidth = thickAxes ? 1.5 : 1.0;

    // Draw Inward Ticks (Major & Minor) on bottoms and sides
    const xRange = xMax - xMin;
    const yRange = yMax - yMin;

    // X Axis Ticks
    let xTickVals: number[] = [];
    if (tickStepX && tickStepX > 0) {
      const startTick = Math.ceil(xMin / tickStepX) * tickStepX;
      for (let val = startTick; val <= xMax + 1e-9; val += tickStepX) {
        xTickVals.push(val);
      }
    } else {
      const xSegments = 8;
      for (let i = 0; i <= xSegments; i++) {
        xTickVals.push(xMin + (i / xSegments) * xRange);
      }
    }

    xTickVals.forEach(val => {
      const px = getPixelX(val);
      if (px >= paddingLeft && px <= paddingLeft + plotW) {
        // Draw inward major tick
        ctx.beginPath();
        ctx.moveTo(px, paddingTop + plotH);
        ctx.lineTo(px, paddingTop + plotH - 5);
        ctx.stroke();

        // Top spine inward tick
        ctx.beginPath();
        ctx.moveTo(px, paddingTop);
        ctx.lineTo(px, paddingTop + 5);
        ctx.stroke();

        // Tick Text
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(val.toFixed(1), px, paddingTop + plotH + 8);
      }
    });

    // Draw X Minor Ticks (sub-ticks)
    if (minorTicksCount > 0 && xTickVals.length >= 2) {
      ctx.lineWidth = thickAxes ? 1.0 : 0.7;
      const step = xTickVals[1] - xTickVals[0];
      const intervals = [...xTickVals];
      intervals.unshift(xTickVals[0] - step);
      intervals.push(xTickVals[xTickVals.length - 1] + step);

      for (let j = 0; j < intervals.length - 1; j++) {
        const v1 = intervals[j];
        const v2 = intervals[j + 1];
        for (let m = 1; m <= minorTicksCount; m++) {
          const mVal = v1 + (m / (minorTicksCount + 1)) * (v2 - v1);
          if (mVal >= xMin && mVal <= xMax) {
            const mPx = getPixelX(mVal);
            if (mPx >= paddingLeft && mPx <= paddingLeft + plotW) {
              ctx.beginPath();
              ctx.moveTo(mPx, paddingTop + plotH);
              ctx.lineTo(mPx, paddingTop + plotH - 3);
              ctx.stroke();

              ctx.beginPath();
              ctx.moveTo(mPx, paddingTop);
              ctx.lineTo(mPx, paddingTop + 3);
              ctx.stroke();
            }
          }
        }
      }
      ctx.lineWidth = thickAxes ? 1.5 : 1.0; // restore
    }

    // Y Axis Ticks
    let yTickVals: number[] = [];
    if (tickStepY && tickStepY > 0) {
      const startTick = Math.ceil(yMin / tickStepY) * tickStepY;
      for (let val = startTick; val <= yMax + 1e-9; val += tickStepY) {
        yTickVals.push(val);
      }
    } else {
      const ySegments = 5;
      for (let i = 0; i <= ySegments; i++) {
        yTickVals.push(yMin + (i / ySegments) * yRange);
      }
    }

    yTickVals.forEach(val => {
      const py = getPixelY(val);
      if (py >= paddingTop && py <= paddingTop + plotH) {
        // Draw inward major tick
        ctx.beginPath();
        ctx.moveTo(paddingLeft, py);
        ctx.lineTo(paddingLeft + 5, py);
        ctx.stroke();

        // Right spine inward tick
        ctx.beginPath();
        ctx.moveTo(paddingLeft + plotW, py);
        ctx.lineTo(paddingLeft + plotW - 5, py);
        ctx.stroke();

        // Tick Text
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillText(val.toFixed(2), paddingLeft - 8, py);
      }
    });

    // Draw Y Minor Ticks
    if (minorTicksCount > 0 && yTickVals.length >= 2) {
      ctx.lineWidth = thickAxes ? 1.0 : 0.7;
      const step = yTickVals[1] - yTickVals[0];
      const intervals = [...yTickVals];
      intervals.unshift(yTickVals[0] - step);
      intervals.push(yTickVals[yTickVals.length - 1] + step);

      for (let j = 0; j < intervals.length - 1; j++) {
        const v1 = intervals[j];
        const v2 = intervals[j + 1];
        for (let m = 1; m <= minorTicksCount; m++) {
          const mVal = v1 + (m / (minorTicksCount + 1)) * (v2 - v1);
          if (mVal >= yMin && mVal <= yMax) {
            const mPy = getPixelY(mVal);
            if (mPy >= paddingTop && mPy <= paddingTop + plotH) {
              ctx.beginPath();
              ctx.moveTo(paddingLeft, mPy);
              ctx.lineTo(paddingLeft + 3, mPy);
              ctx.stroke();

              ctx.beginPath();
              ctx.moveTo(paddingLeft + plotW, mPy);
              ctx.lineTo(paddingLeft + plotW - 3, mPy);
              ctx.stroke();
            }
          }
        }
      }
      ctx.lineWidth = thickAxes ? 1.5 : 1.0; // restore
    }

    // Label Titles
    ctx.fillStyle = textColor;
    ctx.textAlign = 'center';
    
    // X Label
    ctx.textBaseline = 'middle';
    ctx.font = `bold ${fontSize + 1}px ${labelFont}`;
    ctx.fillText(xLabel || 'Spectral Coordinate / Energy Offset', paddingLeft + plotW / 2, h - 20);

    // Y Label with rotated transformation
    ctx.save();
    ctx.translate(18, paddingTop + plotH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText(yLabel || 'Absorbance Intensity (a.u.)', 0, 0);
    ctx.restore();

    ctx.font = `${fontSize}px ${labelFont}`;

    // -----------------------------------------
    // RENDER INTERACTION DRAG HIGHLIGHT PREVIEW
    // -----------------------------------------
    if (isDragging && dragStart && (interactiveMode === 'crop' || interactiveMode === 'integrate')) {
      const startX = dragStart.x;
      const currentX = mousePos.x;

      const px1 = Math.max(paddingLeft, Math.min(paddingLeft + plotW, startX));
      const px2 = Math.max(paddingLeft, Math.min(paddingLeft + plotW, currentX));

      ctx.fillStyle = interactiveMode === 'crop' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.2)';
      ctx.fillRect(px1, paddingTop, px2 - px1, plotH);
      
      ctx.strokeStyle = interactiveMode === 'crop' ? '#ef4444' : '#10b981';
      ctx.lineWidth = 1;
      ctx.strokeRect(px1, paddingTop, px2 - px1, plotH);
    }

    // -----------------------------------------
    // REAL-TIME SNAPPING CROSSHAIR BINDING
    // -----------------------------------------
    if (mousePos.x >= paddingLeft && mousePos.x <= paddingLeft + plotW && activeSeries.length > 0) {
      const snapXVal = getValX(mousePos.x);

      // Find closest node inside selected or first dataset
      const snapDS = selectedDataset || activeSeries[0];
      let bestIdx = 0;
      let minDiff = Infinity;
      for (let i = 0; i < snapDS.x.length; i++) {
        const d = Math.abs(snapDS.x[i] - snapXVal);
        if (d < minDiff) {
          minDiff = d;
          bestIdx = i;
        }
      }

      if (snapDS.x[bestIdx] !== undefined) {
        const px = getPixelX(snapDS.x[bestIdx]);
        const py = getPixelY(snapDS.y_processed[bestIdx]);

        // Snapped callback coordinate values
        onCursorPositionChange(snapDS.x[bestIdx], snapDS.y_processed[bestIdx]);

        // Hover Crosswires
        ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.25)';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        
        ctx.beginPath();
        ctx.moveTo(px, paddingTop);
        ctx.lineTo(px, paddingTop + plotH);
        ctx.stroke();

        ctx.setLineDash([]);

        // snap dot accent
        ctx.fillStyle = '#ef4444';
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(px, py, 6, 0, 2 * Math.PI);
        ctx.fill();
        ctx.stroke();
      }
    }

    // -----------------------------------------
    // RENDER METADATA LABELS OR LEGENDS
    // -----------------------------------------
    if (showLegend && activeSeries.length > 0) {
      const lW = 140;
      const lH = activeSeries.length * 20 + 10;
      
      // Default to upper right inside chart frame
      let lx = paddingLeft + plotW - lW - 15;
      let ly = paddingTop + 15;

      if (legendPos === 'upper left') {
        lx = paddingLeft + 15;
      } else if (legendPos === 'lower left') {
        lx = paddingLeft + 15;
        ly = paddingTop + plotH - lH - 15;
      } else if (legendPos === 'lower right') {
        lx = paddingLeft + plotW - lW - 15;
        ly = paddingTop + plotH - lH - 15;
      }

      ctx.fillStyle = isDark ? 'rgba(20, 20, 20, 0.85)' : 'rgba(255, 255, 255, 0.85)';
      ctx.strokeStyle = spineColor;
      ctx.lineWidth = 0.8;
      ctx.fillRect(lx, ly, lW, lH);
      ctx.strokeRect(lx, ly, lW, lH);

      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      activeSeries.forEach((d, dIdx) => {
        const itemY = ly + 15 + dIdx * 20;
        
        ctx.fillStyle = d.color || '#3b82f6';
        ctx.fillRect(lx + 10, itemY - 3, 14, 6);

        ctx.fillStyle = textColor;
        ctx.fillText(d.name.slice(0, 16), lx + 30, itemY);
      });
    }

    // -----------------------------------------
    // RENDER PICTURE-IN-PICTURE (ZOOMED INSET)
    // -----------------------------------------
    if (enableInset && insetXMin < insetXMax) {
      // Draw sub-axes boxed region in upper right quadrant of chart typical of journals
      const ix = paddingLeft + plotW * 0.58;
      const iy = paddingTop + plotH * 0.08;
      const iw = plotW * 0.38;
      const ih = plotH * 0.38;

      ctx.fillStyle = plotBgColor || '#151515';
      ctx.strokeStyle = spineColor;
      ctx.lineWidth = 1.0;
      
      ctx.fillRect(ix, iy, iw, ih);
      ctx.strokeRect(ix, iy, iw, ih);

      // Render overlay paths limited to bounds inside inset
      ctx.save();
      
      // Create clip region
      ctx.beginPath();
      ctx.rect(ix, iy, iw, ih);
      ctx.clip();

      const getInsetPxX = (vX: number) => ix + ((vX - insetXMin) / (insetXMax - insetXMin)) * iw;
      
      // Find y limits inside inset domain
      let inYMin = Infinity;
      let inYMax = -Infinity;
      activeSeries.forEach(s => {
        for (let i = 0; i < s.x.length; i++) {
          if (s.x[i] >= insetXMin && s.x[i] <= insetXMax) {
            if (s.y_processed[i] < inYMin) inYMin = s.y_processed[i];
            if (s.y_processed[i] > inYMax) inYMax = s.y_processed[i];
          }
        }
      });

      if (inYMin === Infinity) {
        inYMin = yMin; inYMax = yMax;
      } else {
        const d = (inYMax - inYMin) || 1;
        inYMin -= d * 0.05;
        inYMax += d * 0.05;
      }

      const getInsetPxY = (vY: number) => (iy + ih) - ((vY - inYMin) / (inYMax - inYMin)) * ih;

      // Draw inside lines
      activeSeries.forEach((sd) => {
        ctx.strokeStyle = sd.color || '#3b82f6';
        ctx.lineWidth = sd.lineWidth || 1.2;
        ctx.beginPath();
        let first = true;
        for (let i = 0; i < sd.x.length; i++) {
          if (sd.x[i] >= insetXMin && sd.x[i] <= insetXMax) {
            const px = getInsetPxX(sd.x[i]);
            const py = getInsetPxY(sd.y_processed[i]);
            if (first) { ctx.moveTo(px, py); first = false; }
            else ctx.lineTo(px, py);
          }
        }
        ctx.stroke();
      });

      ctx.restore();

      // Show tiny micro inset ranges
      ctx.fillStyle = textColor;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.font = '8px sans-serif';
      ctx.fillText(insetXMin.toFixed(0), ix + 4, iy + ih - 11);
      ctx.textAlign = 'right';
      ctx.fillText(insetXMax.toFixed(0), ix + iw - 4, iy + ih - 11);
    }
  };

  // Helper dark theme detector
  const isColorDark = (hex: string): boolean => {
    if (!hex) return true;
    if (hex.slice(0, 3) === 'rgb') return true;
    const clean = hex.replace('#', '');
    const num = parseInt(clean, 16);
    const r = (num >> 16) & 255;
    const g = (num >> 8) & 255;
    const b = num & 255;
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    return brightness < 128;
  };

  // Find a peak marked coordinate or text offset near the mouse click
  const findPeakNearPixel = (mx: number, my: number) => {
    if (!canvasRef.current) return null;
    const dpr = window.devicePixelRatio || 1;
    const w = canvasRef.current.width / dpr;
    const h = canvasRef.current.height / dpr;

    const paddingLeft = 65;
    const paddingRight = 40;
    const paddingTop = 35;
    const paddingBottom = 60;

    const plotW = w - paddingLeft - paddingRight;
    const plotH = h - paddingTop - paddingBottom;

    if (plotW <= 0 || plotH <= 0) return null;

    const getPixelX = (valX: number) => {
      if (invertX) {
        return paddingLeft + plotW - ((valX - xMin) / (xMax - xMin)) * plotW;
      } else {
        return paddingLeft + ((valX - xMin) / (xMax - xMin)) * plotW;
      }
    };
    const getPixelY = (valY: number) => {
      if (invertY) {
        return paddingTop + ((valY - yMin) / (yMax - yMin)) * plotH;
      } else {
        return (paddingTop + plotH) - ((valY - yMin) / (yMax - yMin)) * plotH;
      }
    };

    // Loop through visible series and check their peaks
    for (let index = 0; index < activeSeries.length; index++) {
      const sd = activeSeries[index];
      const offsetVal = layoutMode === 'Waterfall Stack (3D Projection)' ? index * waterfallOffset : 0;

      for (let pIdx = 0; pIdx < sd.peaks.length; pIdx++) {
        const p = sd.peaks[pIdx];
        const pPx = getPixelX(p.x);
        const pPy = getPixelY(p.y + offsetVal);

        const tPx = pPx + p.dx;
        const tPy = pPy - p.dy;

        // Peak marker hit or label hit
        const distLabel = Math.hypot(mx - tPx, my - tPy);
        const distMarker = Math.hypot(mx - pPx, my - pPy);

        // Allow selection of label (within 28px) or peak marker (within 16px)
        if (distLabel < 28) {
          return { datasetId: sd.id, peak: p, type: 'label' };
        }
        if (distMarker < 18) {
          return { datasetId: sd.id, peak: p, type: 'marker' };
        }
      }
    }
    return null;
  };

  // Mouse Handlers for zoom and crops
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return;
    const r = canvasRef.current.getBoundingClientRect();
    const mx = e.clientX - r.left;
    const my = e.clientY - r.top;

    // 1. Check if we down-clicked right near any peak or label first to enable dragging!
    const hit = findPeakNearPixel(mx, my);
    if (hit) {
      setDraggingPeak({
        datasetId: hit.datasetId,
        peakId: hit.peak.id,
        type: hit.type as 'label' | 'marker',
        initDx: hit.peak.dx,
        initDy: hit.peak.dy,
        startX: mx,
        startY: my
      });
      return;
    }

    setDragStart({ x: mx, y: my });
    setIsDragging(true);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return;
    const r = canvasRef.current.getBoundingClientRect();
    const mx = e.clientX - r.left;
    const my = e.clientY - r.top;
    setMousePos({ x: mx, y: my });

    // 2. Handle interactive peak label dragging or peak marker snapping
    if (draggingPeak) {
      if (draggingPeak.type === 'label') {
        const deltaX = mx - draggingPeak.startX;
        const deltaY = my - draggingPeak.startY;

        const newDx = Math.round(draggingPeak.initDx + deltaX);
        const newDy = Math.round(draggingPeak.initDy - deltaY);

        const list = datasets.map(d => {
          if (d.id === draggingPeak.datasetId) {
            return {
              ...d,
              peaks: d.peaks.map(p => {
                if (p.id === draggingPeak.peakId) {
                  return { ...p, dx: newDx, dy: newDy };
                }
                return p;
              })
            };
          }
          return d;
        });
        onDatasetsUpdated(list);
      } else {
        // Dragging the pointer peak marker itself! Slide along the spectrum curve
        const paddingLeft = 65;
        const paddingRight = 40;
        const dpr = window.devicePixelRatio || 1;
        const plotW = (canvasRef.current.width / dpr) - paddingLeft - paddingRight;

        let targetX = xMin + ((mx - paddingLeft) / plotW) * (xMax - xMin);
        targetX = Math.max(xMin, Math.min(xMax, targetX));

        const sd = datasets.find(d => d.id === draggingPeak.datasetId);
        if (sd && sd.x.length > 0) {
          let bestIdx = 0;
          let minDiff = Infinity;
          for (let i = 0; i < sd.x.length; i++) {
            const diff = Math.abs(sd.x[i] - targetX);
            if (diff < minDiff) {
              minDiff = diff;
              bestIdx = i;
            }
          }
          const finalX = sd.x[bestIdx];
          const finalY = sd.y_processed[bestIdx];

          const list = datasets.map(d => {
            if (d.id === draggingPeak.datasetId) {
              return {
                ...d,
                peaks: d.peaks.map(p => {
                  if (p.id === draggingPeak.peakId) {
                    return { ...p, x: finalX, y: finalY };
                  }
                  return p;
                })
              };
            }
            return d;
          });
          onDatasetsUpdated(list);
        }
      }
      return;
    }

    triggerRedraw();
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    // 3. Complete dragging action if happening
    if (draggingPeak) {
      setDraggingPeak(null);
      return;
    }

    if (!canvasRef.current || !dragStart) return;
    
    const r = canvasRef.current.getBoundingClientRect();
    const mx = e.clientX - r.left;
    const my = e.clientY - r.top;

    setIsDragging(false);

    const paddingLeft = 65;
    const plotW = r.width - paddingLeft - 40;

    // Get mapped values
    const valStart = xMin + ((dragStart.x - paddingLeft) / plotW) * (xMax - xMin);
    const valEnd = xMin + ((mx - paddingLeft) / plotW) * (xMax - xMin);

    const x1 = Math.min(valStart, valEnd);
    const x2 = Math.max(valStart, valEnd);

    // If click or very tiny slide -> handle click behavior (Peak Picking)
    if (Math.abs(mx - dragStart.x) < 4) {
      if (interactiveMode === 'pick' && activeSeries.length > 0) {
        // Snapped peak creator
        const clickVal = xMin + ((mx - paddingLeft) / plotW) * (xMax - xMin);
        const snapDS = selectedDataset || activeSeries[0];
        let bestIdx = 0;
        let minDiff = Infinity;
        for (let i = 0; i < snapDS.x.length; i++) {
          const d = Math.abs(snapDS.x[i] - clickVal);
          if (d < minDiff) {
            minDiff = d;
            bestIdx = i;
          }
        }
        if (snapDS.x[bestIdx] !== undefined) {
          onPeakCreated(snapDS.x[bestIdx], snapDS.y_processed[bestIdx]);
        }
      }
    } else {
      // Slide action -> Crop or Integrate
      if (interactiveMode === 'crop' || interactiveMode === 'integrate') {
        onRangeSelected(x1, x2);
      }
    }
    setDragStart(null);
  };

  // 4. Double click handles peak annotation & electronic transition assignments
  const handleDoubleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return;
    const r = canvasRef.current.getBoundingClientRect();
    const mx = e.clientX - r.left;
    const my = e.clientY - r.top;

    const hit = findPeakNearPixel(mx, my);
    if (hit) {
      setEditingPeak({
        datasetId: hit.datasetId,
        peakId: hit.peak.id,
        x: hit.peak.x,
        y: hit.peak.y,
        label: hit.peak.label || '',
        transition: hit.peak.transition || ''
      });
    }
  };

  // Convert canvas to a highly professional vector SVG for direct scientific publication
  /**
   * Builds the full SVG markup string for the current plot — the same
   * vector representation used for direct SVG export, reused here so PDF
   * export shares one single source of truth for figure geometry rather
   * than duplicating the entire coordinate-transform and drawing logic a
   * second time in a different format.
   */
  const buildSvgString = (): string | null => {
    if (!canvasRef.current) return null;
    
    // Create an elegant scalar high fidelity SVG string reflecting active boundaries
    const w = canvasRef.current.width / (window.devicePixelRatio || 1);
    const h = canvasRef.current.height / (window.devicePixelRatio || 1);
    
    let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">`;
    svg += `<!-- Professional Vector Spectrum generated by Labscribber -->\n`;
    svg += `<style>
      .tick-text { font-family: ${journalStyle === 'ACS' ? 'Arial, Helvetica, sans-serif' : journalStyle === 'RSC' ? 'Georgia, serif' : journalStyle === 'Nature' ? '"Helvetica Neue", Helvetica, sans-serif' : '"Inter", sans-serif'}; font-size: ${journalStyle === 'Nature' ? '9.5px' : '11px'}; transition: none; }
      .axis-title { font-family: ${journalStyle === 'ACS' ? 'Arial, Helvetica, sans-serif' : journalStyle === 'RSC' ? 'Georgia, serif' : journalStyle === 'Nature' ? '"Helvetica Neue", Helvetica, sans-serif' : '"Inter", sans-serif'}; font-size: ${journalStyle === 'Nature' ? '11px' : '12px'}; font-weight: bold; }
    </style>\n`;
    svg += `<rect width="100%" height="100%" fill="${plotBgColor || '#ffffff'}"/>`;

    // Detect if color scheme is dark
    const isDark = isColorDark(plotBgColor);
    const textCol = isDark ? '#e5e7eb' : '#111827';
    const spineColor = isDark ? '#3f3f3f' : '#18181b';
    const gridColor = isDark ? 'rgba(255, 255, 255, 0.07)' : 'rgba(0, 0, 0, 0.07)';

    const paddingLeft = 65;
    const paddingRight = 40;
    const paddingTop = 35;
    const paddingBottom = 60;

    const plotW = w - paddingLeft - paddingRight;
    const plotH = h - paddingTop - paddingBottom;
    const xRange = xMax - xMin;
    const yRange = yMax - yMin;

    const getSvgX = (vx: number) => {
      if (invertX) {
        return paddingLeft + plotW - ((vx - xMin) / xRange) * plotW;
      } else {
        return paddingLeft + ((vx - xMin) / xRange) * plotW;
      }
    };
    const getSvgY = (vy: number) => {
      if (invertY) {
        return paddingTop + ((vy - yMin) / yRange) * plotH;
      } else {
        return (paddingTop + plotH) - ((vy - yMin) / yRange) * plotH;
      }
    };

    // 1. Gather Ticks Vals
    let xTickVals: number[] = [];
    if (tickStepX && tickStepX > 0) {
      const startTick = Math.ceil(xMin / tickStepX) * tickStepX;
      for (let val = startTick; val <= xMax + 1e-9; val += tickStepX) {
        xTickVals.push(val);
      }
    } else {
      const xSegments = 8;
      for (let i = 0; i <= xSegments; i++) {
        xTickVals.push(xMin + (i / xSegments) * xRange);
      }
    }

    let yTickVals: number[] = [];
    if (tickStepY && tickStepY > 0) {
      const startTick = Math.ceil(yMin / tickStepY) * tickStepY;
      for (let val = startTick; val <= yMax + 1e-9; val += tickStepY) {
        yTickVals.push(val);
      }
    } else {
      const ySegments = 5;
      for (let i = 0; i <= ySegments; i++) {
        yTickVals.push(yMin + (i / ySegments) * yRange);
      }
    }

    // 2. Render Grid Lines
    let gridElements = '<!-- Grid Lines -->\n<g>';
    if (gridX) {
      xTickVals.forEach(val => {
        const px = getSvgX(val);
        if (px >= paddingLeft && px <= paddingLeft + plotW) {
          gridElements += `<line x1="${px.toFixed(2)}" y1="${paddingTop}" x2="${px.toFixed(2)}" y2="${paddingTop + plotH}" stroke="${gridColor}" stroke-width="0.5" stroke-dasharray="2,2"/>\n`;
        }
      });
    }
    if (gridY) {
      yTickVals.forEach(val => {
        const py = getSvgY(val);
        if (py >= paddingTop && py <= paddingTop + plotH) {
          gridElements += `<line x1="${paddingLeft}" y1="${py.toFixed(2)}" x2="${paddingLeft + plotW}" y2="${py.toFixed(2)}" stroke="${gridColor}" stroke-width="0.5" stroke-dasharray="2,2"/>\n`;
        }
      });
    }
    gridElements += '</g>\n';
    svg += gridElements;

    // 3. Render Spines Frame and Inward/Outward Ticks
    let axesElements = '<!-- Spines and Ticks -->\n<g>';
    // Outer Border
    axesElements += `<rect x="${paddingLeft}" y="${paddingTop}" width="${plotW}" height="${plotH}" stroke="${spineColor}" stroke-width="${thickAxes ? 2.0 : 1.0}" fill="none"/>\n`;

    // Bottom and Top ticks
    xTickVals.forEach(val => {
      const px = getSvgX(val);
      if (px >= paddingLeft && px <= paddingLeft + plotW) {
        // bottom major tick (pointing inwards)
        axesElements += `<line x1="${px.toFixed(2)}" y1="${paddingTop + plotH}" x2="${px.toFixed(2)}" y2="${paddingTop + plotH - 5}" stroke="${spineColor}" stroke-width="${thickAxes ? 1.5 : 1.0}"/>\n`;
        // top major tick (pointing inwards)
        axesElements += `<line x1="${px.toFixed(2)}" y1="${paddingTop}" x2="${px.toFixed(2)}" y2="${paddingTop + 5}" stroke="${spineColor}" stroke-width="${thickAxes ? 1.5 : 1.0}"/>\n`;
        // Label Text
        axesElements += `<text x="${px.toFixed(2)}" y="${paddingTop + plotH + 18}" class="tick-text" fill="${textCol}" text-anchor="middle">${val.toFixed(1)}</text>\n`;
      }
    });

    // Sub-ticks / Minor Ticks (X)
    if (minorTicksCount > 0 && xTickVals.length >= 2) {
      const step = xTickVals[1] - xTickVals[0];
      const intervals = [...xTickVals];
      intervals.unshift(xTickVals[0] - step);
      intervals.push(xTickVals[xTickVals.length - 1] + step);

      for (let j = 0; j < intervals.length - 1; j++) {
        const v1 = intervals[j];
        const v2 = intervals[j + 1];
        for (let m = 1; m <= minorTicksCount; m++) {
          const mVal = v1 + (m / (minorTicksCount + 1)) * (v2 - v1);
          if (mVal >= xMin && mVal <= xMax) {
            const mPx = getSvgX(mVal);
            if (mPx >= paddingLeft && mPx <= paddingLeft + plotW) {
              axesElements += `<line x1="${mPx.toFixed(2)}" y1="${paddingTop + plotH}" x2="${mPx.toFixed(2)}" y2="${paddingTop + plotH - 3}" stroke="${spineColor}" stroke-width="${thickAxes ? 1.0 : 0.7}"/>\n`;
              axesElements += `<line x1="${mPx.toFixed(2)}" y1="${paddingTop}" x2="${mPx.toFixed(2)}" y2="${paddingTop + 3}" stroke="${spineColor}" stroke-width="${thickAxes ? 1.0 : 0.7}"/>\n`;
            }
          }
        }
      }
    }

    // Left and Right Y ticks
    yTickVals.forEach(val => {
      const py = getSvgY(val);
      if (py >= paddingTop && py <= paddingTop + plotH) {
        // left major inward
        axesElements += `<line x1="${paddingLeft}" y1="${py.toFixed(2)}" x2="${paddingLeft + 5}" y2="${py.toFixed(2)}" stroke="${spineColor}" stroke-width="${thickAxes ? 1.5 : 1.0}"/>\n`;
        // right major inward
        axesElements += `<line x1="${paddingLeft + plotW}" y1="${py.toFixed(2)}" x2="${paddingLeft + plotW - 5}" y2="${py.toFixed(2)}" stroke="${spineColor}" stroke-width="${thickAxes ? 1.5 : 1.0}"/>\n`;
        // label text
        axesElements += `<text x="${paddingLeft - 8}" y="${(py + 3.5).toFixed(2)}" class="tick-text" fill="${textCol}" text-anchor="end">${val.toFixed(2)}</text>\n`;
      }
    });

    // Sub-ticks / Minor Ticks (Y)
    if (minorTicksCount > 0 && yTickVals.length >= 2) {
      const step = yTickVals[1] - yTickVals[0];
      const intervals = [...yTickVals];
      intervals.unshift(yTickVals[0] - step);
      intervals.push(yTickVals[yTickVals.length - 1] + step);

      for (let j = 0; j < intervals.length - 1; j++) {
        const v1 = intervals[j];
        const v2 = intervals[j + 1];
        for (let m = 1; m <= minorTicksCount; m++) {
          const mVal = v1 + (m / (minorTicksCount + 1)) * (v2 - v1);
          if (mVal >= yMin && mVal <= yMax) {
            const mPy = getSvgY(mVal);
            if (mPy >= paddingTop && mPy <= paddingTop + plotH) {
              axesElements += `<line x1="${paddingLeft}" y1="${mPy.toFixed(2)}" x2="${paddingLeft + 3}" y2="${mPy.toFixed(2)}" stroke="${spineColor}" stroke-width="${thickAxes ? 1.0 : 0.7}"/>\n`;
              axesElements += `<line x1="${paddingLeft + plotW}" y1="${mPy.toFixed(2)}" x2="${paddingLeft + plotW - 3}" y2="${mPy.toFixed(2)}" stroke="${spineColor}" stroke-width="${thickAxes ? 1.0 : 0.7}"/>\n`;
            }
          }
        }
      }
    }
    axesElements += '</g>\n';
    svg += axesElements;

    // AXES TITLES
    const activeXLabel = xLabel || (selectedDataset ? `${selectedDataset.technique} Axis` : 'Wavelength (nm)');
    const activeYLabel = yLabel || 'Intensity / Absorbance';
    svg += '<!-- Titles -->\n<g>';
    svg += `<text x="${(paddingLeft + plotW / 2).toFixed(2)}" y="${h - 15}" class="axis-title" fill="${textCol}" text-anchor="middle">${activeXLabel}</text>\n`;
    svg += `<text transform="rotate(-90)" x="-${(paddingTop + plotH / 2).toFixed(2)}" y="20" class="axis-title" fill="${textCol}" text-anchor="middle">${activeYLabel}</text>\n`;
    svg += '</g>\n';

    // 4. Trace curves, markers, drop-lines
    let curvesElements = '<!-- Spectrum Curves -->\n<g>';
    let dropLinesElements = '<!-- Drop Lines -->\n<g>';
    let markersElements = '<!-- Line Markers -->\n<g>';
    let peakAnnotations = '<!-- Peak Annotations -->\n<g>';

    activeSeries.forEach((sd) => {
      let paths = '';
      let started = false;

      let dashAttr = '';
      if (sd.lineStyle === 'dashed') {
        dashAttr = ' stroke-dasharray="6,4"';
      } else if (sd.lineStyle === 'dotted') {
        dashAttr = ' stroke-dasharray="2,3"';
      }

      for (let i = 0; i < sd.x.length; i++) {
        const px = getSvgX(sd.x[i]);
        const py = getSvgY(sd.y_processed[i]);
        if (px >= paddingLeft && px <= paddingLeft + plotW) {
          if (!started) {
            paths += `M ${px.toFixed(2)} ${py.toFixed(2)} `;
            started = true;
          } else {
            paths += `L ${px.toFixed(2)} ${py.toFixed(2)} `;
          }

          // Render marker shapes
          if (sd.marker && sd.marker !== 'none' && i % 8 === 0) {
            const mSize = sd.markerSize || 5;
            if (sd.marker === 'circle') {
              markersElements += `<circle cx="${px.toFixed(2)}" cy="${py.toFixed(2)}" r="${(mSize/2).toFixed(1)}" fill="${sd.color}" stroke="${sd.color}" stroke-width="0.5"/>\n`;
            } else if (sd.marker === 'square') {
              markersElements += `<rect x="${(px - mSize/2).toFixed(2)}" y="${(py - mSize/2).toFixed(2)}" width="${mSize}" height="${mSize}" fill="${sd.color}" stroke="${sd.color}" stroke-width="0.5"/>\n`;
            } else if (sd.marker === 'triangle') {
              const half = mSize / 2;
              const points = `${px.toFixed(2)},${(py - half).toFixed(2)} ${(px - half).toFixed(2)},${(py + half).toFixed(2)} ${(px + half).toFixed(2)},${(py + half).toFixed(2)}`;
              markersElements += `<polygon points="${points}" fill="${sd.color}" stroke="${sd.color}" stroke-width="0.5"/>\n`;
            } else if (sd.marker === 'cross') {
              const half = mSize / 2;
              markersElements += `<line x1="${(px - half).toFixed(2)}" y1="${(py - half).toFixed(2)}" x2="${(px + half).toFixed(2)}" y2="${(py + half).toFixed(2)}" stroke="${sd.color}" stroke-width="1.2"/>\n`;
              markersElements += `<line x1="${(px - half).toFixed(2)}" y1="${(py + half).toFixed(2)}" x2="${(px + half).toFixed(2)}" y2="${(py - half).toFixed(2)}" stroke="${sd.color}" stroke-width="1.2"/>\n`;
            }
          }
        }
      }

      curvesElements += `<path d="${paths}" stroke="${sd.color}" stroke-width="${sd.lineWidth || 1.6}" fill="none"${dashAttr}/>\n`;

      // Peak analysis
      sd.peaks.forEach(p => {
        const px = getSvgX(p.x);
        const py = getSvgY(p.y);
        if (px >= paddingLeft && px <= paddingLeft + plotW) {
          if (dropLines) {
            dropLinesElements += `<line x1="${px.toFixed(2)}" y1="${py.toFixed(2)}" x2="${px.toFixed(2)}" y2="${(paddingTop + plotH).toFixed(2)}" stroke="${sd.color}" stroke-width="0.75" stroke-dasharray="2,2"/>\n`;
          }

          peakAnnotations += `<circle cx="${px.toFixed(2)}" cy="${py.toFixed(2)}" r="4.5" fill="${sd.color}" stroke="#ffffff" stroke-width="1"/>\n`;
          
          const arrowX = px + p.dx;
          const arrowY = py - p.dy;
          peakAnnotations += `<line x1="${px.toFixed(2)}" y1="${py.toFixed(2)}" x2="${arrowX.toFixed(2)}" y2="${arrowY.toFixed(2)}" stroke="${sd.color}" stroke-width="1.0" stroke-dasharray="1.5,1.5"/>\n`;
          
          let anchor = p.dx > 0 ? 'start' : 'end';
          if (Math.abs(p.dx) < 3) anchor = 'middle';
          const textOffsetX = p.dx > 0 ? 5 : p.dx < 0 ? -5 : 0;
          const textOffsetY = p.dy > 0 ? -3 : 11;
          
          peakAnnotations += `<text x="${(arrowX + textOffsetX).toFixed(2)}" y="${(arrowY + textOffsetY).toFixed(2)}" fill="${textCol}" font-family="${journalStyle === 'ACS' ? 'Arial, Helvetica, sans-serif' : 'sans-serif'}" font-size="9.5px" font-weight="bold" text-anchor="${anchor}">${p.x.toFixed(2)} (${p.label || 'Peak'})</text>\n`;
        }
      });
    });

    curvesElements += '</g>\n';
    dropLinesElements += '</g>\n';
    markersElements += '</g>\n';
    peakAnnotations += '</g>\n';

    svg += dropLinesElements;
    svg += curvesElements;
    svg += markersElements;
    svg += peakAnnotations;

    // 5. Legend Box
    if (showLegend && activeSeries.length > 0) {
      let legX = paddingLeft + 15;
      let legY = paddingTop + 15;
      if (legendPos === 'upper right') {
        legX = paddingLeft + plotW - 165;
        legY = paddingTop + 15;
      } else if (legendPos === 'lower left') {
        legX = paddingLeft + 15;
        legY = paddingTop + plotH - 25 - (activeSeries.length * 15);
      } else if (legendPos === 'lower right') {
        legX = paddingLeft + plotW - 165;
        legY = paddingTop + plotH - 25 - (activeSeries.length * 15);
      }

      let legendBody = '<!-- Legend Box -->\n<g>';
      legendBody += `<rect x="${legX}" y="${legY}" width="150" height="${15 + activeSeries.length * 16}" fill="${plotBgColor}" stroke="${spineColor}" stroke-width="1" rx="3"/>\n`;
      
      activeSeries.forEach((sd, index) => {
        const itemY = legY + 15 + index * 16;
        legendBody += `<line x1="${legX + 10}" y1="${itemY}" x2="${legX + 25}" y2="${itemY}" stroke="${sd.color}" stroke-width="2.5"/>\n`;
        const safeName = sd.name.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
        legendBody += `<text x="${legX + 32}" y="${itemY + 4}" fill="${textCol}" font-family="sans-serif" font-size="9.5px" text-anchor="start">${safeName.substring(0, 18)}</text>\n`;
      });
      legendBody += '</g>\n';
      svg += legendBody;
    }

    // 6. Picture-in-picture Inset subplot
    if (enableInset && activeSeries.length > 0) {
      const ix = paddingLeft + plotW - 210;
      const iy = paddingTop + 30;
      const iw = 180;
      const ih = 120;

      let insetBody = '<!-- Inset Subplot -->\n<g>';
      insetBody += `<rect x="${ix}" y="${iy}" width="${iw}" height="${ih}" fill="${plotBgColor}" stroke="${spineColor}" stroke-width="1.5"/>\n`;

      // Plot curves inside inset limits
      activeSeries.forEach(sd => {
        let iPaths = '';
        let iStarted = false;
        
        // Find local bounds of Y inside target range
        let yLocalMax = -Infinity;
        let yLocalMin = Infinity;
        for (let i = 0; i < sd.x.length; i++) {
          const vx = sd.x[i];
          if (vx >= insetXMin && vx <= insetXMax) {
            if (sd.y_processed[i] > yLocalMax) yLocalMax = sd.y_processed[i];
            if (sd.y_processed[i] < yLocalMin) yLocalMin = sd.y_processed[i];
          }
        }
        if (yLocalMax === -Infinity) yLocalMax = yMax;
        if (yLocalMin === Infinity) yLocalMin = yMin;
        const localRangeY = yLocalMax - yLocalMin || 1;

        const getInsetSvgX = (vx: number) => ix + ((vx - insetXMin) / (insetXMax - insetXMin)) * iw;
        const getInsetSvgY = (vy: number) => (iy + ih) - ((vy - yLocalMin) / localRangeY) * ih;

        for (let i = 0; i < sd.x.length; i++) {
          const vx = sd.x[i];
          if (vx >= insetXMin && vx <= insetXMax) {
            const ipx = getInsetSvgX(vx);
            const ipy = getInsetSvgY(sd.y_processed[i]);
            if (!iStarted) {
              iPaths += `M ${ipx.toFixed(2)} ${ipy.toFixed(2)} `;
              iStarted = true;
            } else {
              iPaths += `L ${ipx.toFixed(2)} ${ipy.toFixed(2)} `;
            }
          }
        }
        if (iPaths) {
          insetBody += `<path d="${iPaths}" stroke="${sd.color}" stroke-width="1.2" fill="none"/>\n`;
        }
      });

      // Sub-bounds tick labels
      insetBody += `<text x="${ix + 4}" y="${iy + ih - 6}" fill="${textCol}" font-size="8.5px" font-family="monospace" text-anchor="start">${insetXMin.toFixed(0)}</text>\n`;
      insetBody += `<text x="${ix + iw - 4}" y="${iy + ih - 6}" fill="${textCol}" font-size="8.5px" font-family="monospace" text-anchor="end">${insetXMax.toFixed(0)}</text>\n`;
      insetBody += '</g>\n';
      svg += insetBody;
    }

    svg += '</svg>';

    return svg;
  };

  /** Downloads the current plot as an SVG file — thin wrapper around buildSvgString(). */
  const handleExportSVG = () => {
    const svg = buildSvgString();
    if (!svg) return;

    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Labscribber_Vector_Figure_${Date.now()}.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  /**
   * Exports the current plot as a true vector PDF — not a rasterized
   * image embedded in a PDF wrapper, which is the common mistake that
   * fails journal production requirements even though the file extension
   * is correct. Reuses buildSvgString() for the figure geometry, parses
   * it into a real DOM SVG element, and converts it via svg2pdf.js, which
   * walks the SVG's actual paths/text/shapes and emits true PDF vector
   * drawing operators rather than rasterizing first.
   */
  const handleExportPDF = async (): Promise<{ success: boolean; error?: string }> => {
    try {
      const svgString = buildSvgString();
      if (!svgString || !canvasRef.current) {
        return { success: false, error: 'No active plot to export.' };
      }

      const w = canvasRef.current.width / (window.devicePixelRatio || 1);
      const h = canvasRef.current.height / (window.devicePixelRatio || 1);

      // Parse the SVG string into a real DOM element — svg2pdf.js requires
      // an actual Element, not a string, since it walks the live DOM tree
      // (including computed styles) rather than re-parsing markup itself.
      const parser = new DOMParser();
      const svgDoc = parser.parseFromString(svgString, 'image/svg+xml');
      const svgElement = svgDoc.documentElement;

      if (svgElement.tagName !== 'svg' && svgElement.tagName !== 'svg:svg') {
        return { success: false, error: 'Generated SVG markup could not be parsed.' };
      }

      // jsPDF page sized in points (pt) to exactly match the figure's
      // pixel dimensions 1:1, so no unwanted scaling/cropping occurs.
      const doc = new jsPDF({
        orientation: w > h ? 'landscape' : 'portrait',
        unit: 'pt',
        format: [w, h],
      });

      // Temporarily attach the parsed SVG to the live document — some SVG
      // attribute/style resolution in svg2pdf.js depends on the element
      // being connected to a real document, not a detached parse result.
      svgElement.style.position = 'absolute';
      svgElement.style.left = '-9999px';
      document.body.appendChild(svgElement);

      try {
        await svg2pdf(svgElement, doc, { x: 0, y: 0, width: w, height: h });
      } finally {
        document.body.removeChild(svgElement);
      }

      doc.save(`Labscribber_Vector_Figure_${Date.now()}.pdf`);
      return { success: true };
    } catch (err: any) {
      console.error('PDF export failed:', err);
      return { success: false, error: err?.message || 'Unknown error during PDF export.' };
    }
  };

  const handleExportHighDPI = (dpi: number, format: 'png' | 'tiff', customJournalStyle?: JournalStyleType) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Base DPI corresponds roughly to 2.0x for 300, 4.5x for 600, 9.0x for 1200
    let scale = 2.0;
    if (dpi === 600) scale = 4.5;
    if (dpi === 1200) scale = 9.0;

    const baseW = containerRef.current?.clientWidth || 800;
    const baseH = containerRef.current?.clientHeight || 480;

    (window as any).isHighDPIExporting = true;
    (window as any).currentExportScale = scale;
    if (customJournalStyle) {
      (window as any).currentExportJournalStyle = customJournalStyle;
    }

    // Set dimensions
    canvas.width = baseW * scale;
    canvas.height = baseH * scale;

    // Trigger full redrawing cycle
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.resetTransform();
      ctx.scale(scale, scale);
      
      // Clear canvas with background
      ctx.fillStyle = plotBgColor || '#151515';
      ctx.fillRect(0, 0, baseW, baseH);
      
      triggerRedraw();
    }

    const mimeType = 'image/png';
    const extension = format === 'tiff' ? 'tiff' : 'png';
    const filename = `${customJournalStyle || journalStyle}_Figure_${dpi}DPI.${extension}`;

    canvas.toBlob((blob) => {
      if (blob) {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }

      // Revert states
      delete (window as any).isHighDPIExporting;
      delete (window as any).currentExportScale;
      delete (window as any).currentExportJournalStyle;

      const dpr = window.devicePixelRatio || 1;
      canvas.width = baseW * dpr;
      canvas.height = baseH * dpr;
      canvas.style.width = `${baseW}px`;
      canvas.style.height = `${baseH}px`;
      triggerRedraw();
    }, mimeType);
  };

  const currentDatasetIndex = datasets.findIndex(d => d.id === selectedDataset?.id);

  // Expose methods on window for access by inspector
  useEffect(() => {
    (window as any).exportChartAsSVG = handleExportSVG;
    (window as any).exportChartAsPDF = handleExportPDF;
    (window as any).exportHighDPIImage = handleExportHighDPI;
    (window as any).getPlotCanvasDataURL = () => canvasRef.current?.toDataURL('image/png');
    return () => {
      delete (window as any).exportChartAsSVG;
      delete (window as any).exportChartAsPDF;
      delete (window as any).exportHighDPIImage;
      delete (window as any).getPlotCanvasDataURL;
    };
  }, [datasets, selectedDataset, xMin, xMax, yMin, yMax, journalStyle, plotBgColor]);

  return (
    <div className="relative w-full h-[480px] bg-[#1a1a1a] rounded-lg border border-[#2b2b2b] overflow-hidden" ref={containerRef}>
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onDoubleClick={handleDoubleClick}
        className="cursor-crosshair block"
      />



      {/* Floating Dialog Modal for advanced peak transitions and labeling */}
      {editingPeak && (
        <div className="absolute inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#121214] border border-[#27272a] rounded-xl shadow-2xl max-w-sm w-full p-4 flex flex-col gap-3.5 animate-in fade-in duration-200">
            <div className="flex items-center justify-between border-b border-[#27272a] pb-2">
              <h4 className="text-xxs font-bold uppercase tracking-wider text-teal-400">
                Spectroscopic Peak Labeller
              </h4>
              <button
                type="button"
                onClick={() => setEditingPeak(null)}
                className="text-zinc-500 hover:text-zinc-300 text-xs font-semibold px-1"
                aria-label="Close modal"
              >
                ✕
              </button>
            </div>

            <div className="text-[10px] text-zinc-400 font-mono bg-[#09090b] p-2 rounded border border-[#27272a] flex justify-between">
              <div>Peak: <span className="text-white font-semibold">X = {editingPeak.x.toFixed(2)}</span></div>
              <div>Intensity: <span className="text-white font-semibold">Y = {editingPeak.y.toFixed(4)}</span></div>
            </div>

            <div className="flex flex-col gap-3">
              {/* Transition Preset Quick Tags */}
              <div className="flex flex-col gap-1">
                <label className="text-[9px] text-zinc-400 uppercase font-semibold">
                  Spectroscopic Transitions Presets
                </label>
                <div className="grid grid-cols-3 gap-1 mb-1.5">
                  {getTransitionPresetsForTechnique(selectedDataset?.technique || 'UV-Vis Spectroscopy').map(t => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setEditingPeak(prev => prev ? { ...prev, transition: t } : null)}
                      className={`text-[9px] font-semibold py-1 px-1 rounded border transition truncate ${
                        editingPeak.transition === t
                          ? 'bg-teal-950/80 text-teal-400 border-teal-500/40 font-bold text-[8.5px]'
                          : 'bg-[#09090b] text-zinc-400 border-[#27272a] hover:bg-[#18181b]/50 text-[8.5px]'
                      }`}
                      title={t}
                    >
                      {t}
                    </button>
                  ))}
                </div>
                
                <input
                  type="text"
                  value={editingPeak.transition}
                  onChange={(e) => {
                    const val = e.target.value;
                    setEditingPeak(prev => prev ? { ...prev, transition: val } : null);
                  }}
                  className="bg-[#09090b] border border-[#27272a] rounded p-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-teal-500"
                  placeholder="Or enter custom transition type..."
                />
              </div>

              {/* Assignment Label input */}
              <div className="flex flex-col gap-1">
                <label className="text-[9px] text-zinc-400 uppercase font-semibold">
                  Molecular Assignment / Characterisation
                </label>
                <input
                  type="text"
                  value={editingPeak.label}
                  onChange={(e) => {
                    const val = e.target.value;
                    setEditingPeak(prev => prev ? { ...prev, label: val } : null);
                  }}
                  className="bg-[#09090b] border border-[#27272a] rounded p-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-teal-500"
                  placeholder="e.g., C=O stretch, Quinoid core absorption..."
                />
              </div>
            </div>

            <div className="flex justify-between items-center pt-2 border-t border-[#27272a] gap-2">
              <button
                type="button"
                onClick={() => {
                  const list = datasets.map(d => {
                    if (d.id === editingPeak.datasetId) {
                      return {
                        ...d,
                        peaks: d.peaks.filter(p => p.id !== editingPeak.peakId)
                      };
                    }
                    return d;
                  });
                  onDatasetsUpdated(list);
                  setEditingPeak(null);
                }}
                className="bg-rose-950/80 hover:bg-rose-900 border border-rose-500/20 text-rose-300 font-semibold px-2.5 py-1.5 rounded text-xxs transition"
              >
                Delete Peak
              </button>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setEditingPeak(null)}
                  className="bg-[#27272a] hover:bg-[#3f3f46] text-zinc-300 px-3 py-1.5 rounded text-xxs transition font-medium"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const list = datasets.map(d => {
                      if (d.id === editingPeak.datasetId) {
                        return {
                          ...d,
                          peaks: d.peaks.map(p => {
                            if (p.id === editingPeak.peakId) {
                              return {
                                ...p,
                                label: editingPeak.label,
                                transition: editingPeak.transition
                              };
                            }
                            return p;
                          })
                        };
                      }
                      return d;
                    });
                    onDatasetsUpdated(list);
                    setEditingPeak(null);
                  }}
                  className="bg-teal-600 hover:bg-teal-500 text-white font-bold px-3 py-1.5 rounded text-xxs shadow transition"
                >
                  Save Changes
                </button>
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
};
