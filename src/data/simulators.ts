/**
 * @license
 * SPDX-License-Identifier: MIT
 */

import { SpectrumData } from '../types';

export function simulateUVVis(index: number): SpectrumData {
  const points = 1000;
  const x: number[] = [];
  const yReal: number[] = [];
  
  // 200 to 700 nm
  for (let i = 0; i < points; i++) {
    const wl = 200 + (500 * i) / (points - 1);
    x.push(wl);

    // Scattering background + absorptions
    const scatter = 0.7 * Math.exp(-(wl - 200) / 90);
    const ex1 = 0.55 * Math.exp(-Math.pow(wl - 268, 2) / (2 * Math.pow(16, 2)));
    const ex2 = 0.28 * Math.exp(-Math.pow(wl - 345, 2) / (2 * Math.pow(26, 2)));
    const ex3 = 0.12 * Math.exp(-Math.pow(wl - 410, 2) / (2 * Math.pow(40, 2)));
    
    // Tiny thermal high-frequency noise
    const noise = (Math.random() - 0.5) * 0.006;
    
    yReal.push(scatter + ex1 + ex2 + ex3 + noise);
  }

  const name = `Colloidal QD UV-Vis [Batch-${index}]`;
  const technique = 'UV-Vis Spectroscopy';

  return {
    id: `sim-uv-${Date.now()}-${index}`,
    name,
    technique,
    x_orig: [...x],
    y_orig: [...yReal],
    x: [...x],
    y_processed: [...yReal],
    color: '#0ea5e9',
    visible: true,
    lineWidth: 1.8,
    lineStyle: 'solid',
    marker: 'none',
    markerSize: 6,
    peaks: [],
    integrals: [],
    baseline: null,
    fitResult: null,
    fitPeakStats: null,
    fitGoodnessOfFit: null,
    fitComponents: null,
    fitResiduals: null,
    yError: null,
    significanceAnnotations: null,
    isTauc: false,
    taucData: null,
    jobsData: null,
    undoStack: [[...yReal]],
    redoStack: [],
    history: [`[${new Date().toLocaleTimeString()}] Generated virtual QD UV-Vis spectrum.`]
  };
}

export function simulateNMR(index: number): SpectrumData {
  const points = 2500;
  const x: number[] = [];
  const yReal: number[] = [];
  
  // 0 to 12 ppm (NMR usually plotted descending, but stored ascending)
  const xMin = 0;
  const xMax = 12;

  // Let's create an elegant simulated Ethyl Acetate or similar ester!
  // Alkyl CH3 (Triplet split at 1.2 ppm)
  // Carbonyl CH3 (Singlet at 2.1 ppm)
  // Methylene O-CH2 (Quartet split at 4.1 ppm)
  // Solvent Residual CHCl3 (Singlet at 7.26 ppm)
  // Water peak (Singlet at 1.56 ppm)
  
  for (let i = 0; i < points; i++) {
    const shift = xMin + ((xMax - xMin) * i) / (points - 1);
    x.push(shift);

    let val = 0;
    const w = 0.007; // Narrow NMR linewidth

    // Triplet split at 1.23 ppm (coupled j = 7Hz, looks like 1 : 2 : 1)
    const tripJ = 0.024;
    val += 0.35 * Math.exp(-Math.pow(shift - (1.23 - tripJ), 2) / (2 * w * w));
    val += 0.70 * Math.exp(-Math.pow(shift - 1.23, 2) / (2 * w * w));
    val += 0.35 * Math.exp(-Math.pow(shift - (1.23 + tripJ), 2) / (2 * w * w));

    // Singlet at 1.56 ppm (water impurity)
    val += 0.08 * Math.exp(-Math.pow(shift - 1.56, 2) / (2 * w * w));

    // Acetyl Singlet at 2.05 ppm (3 protons equivalent)
    val += 0.95 * Math.exp(-Math.pow(shift - 2.05, 2) / (2 * w * w));

    // Quartet split at 4.12 ppm (coupled j = 7Hz, looks like 1 : 3 : 3 : 1)
    val += 0.15 * Math.exp(-Math.pow(shift - (4.12 - 1.5 * tripJ), 2) / (2 * w * w));
    val += 0.45 * Math.exp(-Math.pow(shift - (4.12 - 0.5 * tripJ), 2) / (2 * w * w));
    val += 0.45 * Math.exp(-Math.pow(shift - (4.12 + 0.5 * tripJ), 2) / (2 * w * w));
    val += 0.15 * Math.exp(-Math.pow(shift - (4.12 + 1.5 * tripJ), 2) / (2 * w * w));

    // Solvent Singlet at 7.26 ppm
    val += 0.12 * Math.exp(-Math.pow(shift - 7.26, 2) / (2 * (w * 1.5) * (w * 1.5)));

    // Background roll/baseline drift (very typical in older spectrometers)
    const roll = 0.04 * Math.sin(shift / 2) + 0.015 * Math.cos(shift * 1.2);
    
    const noise = (Math.random() - 0.5) * 0.01;
    yReal.push(val + Math.abs(roll) + noise);
  }

  const name = `Ester Extract 1H NMR [Sample-${index}]`;
  const technique = '1H NMR Spectroscopy';

  return {
    id: `sim-nmr-${Date.now()}-${index}`,
    name,
    technique,
    x_orig: [...x],
    y_orig: [...yReal],
    x: [...x],
    y_processed: [...yReal],
    color: '#e11d48',
    visible: true,
    lineWidth: 1.3,
    lineStyle: 'solid',
    marker: 'none',
    markerSize: 6,
    peaks: [],
    integrals: [],
    baseline: null,
    fitResult: null,
    fitPeakStats: null,
    fitGoodnessOfFit: null,
    fitComponents: null,
    fitResiduals: null,
    yError: null,
    significanceAnnotations: null,
    isTauc: false,
    taucData: null,
    jobsData: null,
    undoStack: [[...yReal]],
    redoStack: [],
    history: [`[${new Date().toLocaleTimeString()}] Generated virtual 1H organic molecule NMR spectrum.`]
  };
}

export function simulateFTIR(index: number): SpectrumData {
  const points = 1000;
  const x: number[] = [];
  const yReal: number[] = [];
  
  for (let i = 0; i < points; i++) {
    const cm = 400 + (3600 * i) / (points - 1);
    x.push(cm);

    let trans = 95.0;

    // Carbonyl band C=O stretch at 1715 cm-1 (Very strong, sharp)
    trans -= 65.0 * Math.exp(-Math.pow(cm - 1715, 2) / (2 * Math.pow(22, 2)));

    // O-H stretch centered around 3350 cm-1 (Very broad, strong)
    trans -= 40.0 * Math.exp(-Math.pow(cm - 3350, 2) / (2 * Math.pow(180, 2)));

    // Aliphatic C-H stretch centered around 2920 cm-1 (Medium size, sharp triplet-like)
    trans -= 25.0 * Math.exp(-Math.pow(cm - 2924, 2) / (2 * Math.pow(15, 2)));
    trans -= 18.0 * Math.exp(-Math.pow(cm - 2855, 2) / (2 * Math.pow(15, 2)));

    // C-O single bond stretch centered around 1150 cm-1 (Broad, medium)
    trans -= 32.0 * Math.exp(-Math.pow(cm - 1150, 2) / (2 * Math.pow(55, 2)));

    // Ambient background lines
    if (cm > 2300 && cm < 2380) {
      trans -= 8.0 * Math.sin((cm - 2300) * 1.5) * Math.exp(-Math.pow(cm - 2340, 2) / (2 * Math.pow(20, 2)));
    }

    const noise = (Math.random() - 0.5) * 0.45;
    yReal.push(Math.max(2.0, trans + noise) / 100.0);
  }

  const name = `Polymer Film FTIR [Sample-${index}]`;
  const technique = 'FTIR Spectroscopy';

  return {
    id: `sim-ftir-${Date.now()}-${index}`,
    name,
    technique,
    x_orig: [...x],
    y_orig: [...yReal],
    x: [...x],
    y_processed: [...yReal],
    color: '#10b981',
    visible: true,
    lineWidth: 1.8,
    lineStyle: 'solid',
    marker: 'none',
    markerSize: 6,
    peaks: [],
    integrals: [],
    baseline: null,
    fitResult: null,
    fitPeakStats: null,
    fitGoodnessOfFit: null,
    fitComponents: null,
    fitResiduals: null,
    yError: null,
    significanceAnnotations: null,
    isTauc: false,
    taucData: null,
    jobsData: null,
    undoStack: [[...yReal]],
    redoStack: [],
    history: [`[${new Date().toLocaleTimeString()}] Simulated advanced thin-film FTIR polymer spectrum.`]
  };
}

export function simulateRaman(index: number): SpectrumData {
  const points = 1000;
  const x: number[] = [];
  const yReal: number[] = [];

  for (let i = 0; i < points; i++) {
    const shift = 200 + (2000 * i) / (points - 1);
    x.push(shift);

    let val = 0.05;

    // Graphene G-band at 1582
    val += 0.85 * Math.exp(-Math.pow(shift - 1582, 2) / (2 * Math.pow(14, 2)));

    // Graphene D-band at 1348
    val += 0.35 * Math.exp(-Math.pow(shift - 1348, 2) / (2 * Math.pow(25, 2)));

    // Silicon lattice peak at 520
    val += 0.15 * Math.exp(-Math.pow(shift - 520, 2) / (2 * Math.pow(9, 2)));

    const fluorescence = 0.18 * Math.exp(-(shift - 200) / 1200);
    const noise = (Math.random() - 0.5) * 0.012;
    yReal.push(Math.max(0.001, val + fluorescence + noise));
  }

  const name = `Graphene Oxide Raman [Site-${index}]`;
  const technique = 'Raman Spectroscopy';

  return {
    id: `sim-raman-${Date.now()}-${index}`,
    name,
    technique,
    x_orig: [...x],
    y_orig: [...yReal],
    x: [...x],
    y_processed: [...yReal],
    color: '#8b5cf6',
    visible: true,
    lineWidth: 1.5,
    lineStyle: 'solid',
    marker: 'none',
    markerSize: 6,
    peaks: [],
    integrals: [],
    baseline: null,
    fitResult: null,
    fitPeakStats: null,
    fitGoodnessOfFit: null,
    fitComponents: null,
    fitResiduals: null,
    yError: null,
    significanceAnnotations: null,
    isTauc: false,
    taucData: null,
    jobsData: null,
    undoStack: [[...yReal]],
    redoStack: [],
    history: [`[${new Date().toLocaleTimeString()}] Simulated graphitic carbonaceous Raman signature.`]
  };
}

export function simulatePL(index: number): SpectrumData {
  const points = 1000;
  const x: number[] = [];
  const yReal: number[] = [];

  for (let i = 0; i < points; i++) {
    const wl = 400 + (500 * i) / (points - 1);
    x.push(wl);

    let val = 0.0;
    val += 0.90 * Math.exp(-Math.pow(wl - 532, 2) / (2 * Math.pow(12, 2)));
    val += 0.18 * Math.exp(-Math.pow(wl - 680, 2) / (2 * Math.pow(80, 2)));

    const noise = (Math.random() - 0.5) * 0.005;
    yReal.push(Math.max(0.0, val + noise));
  }

  const name = `MAPbI3 Perovskite PL [Sample-${index}]`;
  const technique = 'Photoluminescence (PL) Spectroscopy';

  return {
    id: `sim-pl-${Date.now()}-${index}`,
    name,
    technique,
    x_orig: [...x],
    y_orig: [...yReal],
    x: [...x],
    y_processed: [...yReal],
    color: '#ec4899',
    visible: true,
    lineWidth: 1.8,
    lineStyle: 'solid',
    marker: 'none',
    markerSize: 6,
    peaks: [],
    integrals: [],
    baseline: null,
    fitResult: null,
    fitPeakStats: null,
    fitGoodnessOfFit: null,
    fitComponents: null,
    fitResiduals: null,
    yError: null,
    significanceAnnotations: null,
    isTauc: false,
    taucData: null,
    jobsData: null,
    undoStack: [[...yReal]],
    redoStack: [],
    history: [`[${new Date().toLocaleTimeString()}] Simulated thin-film semiconductor bandgap PL peak.`]
  };
}

export function simulateXRD(index: number): SpectrumData {
  const points = 1200;
  const x: number[] = [];
  const yReal: number[] = [];

  for (let i = 0; i < points; i++) {
    const t2 = 10 + (70 * i) / (points - 1);
    x.push(t2);

    let val = 0.0;
    val += 0.88 * Math.exp(-Math.pow(t2 - 38.18, 2) / (2 * Math.pow(0.28, 2)));
    val += 0.42 * Math.exp(-Math.pow(t2 - 44.39, 2) / (2 * Math.pow(0.30, 2)));
    val += 0.28 * Math.exp(-Math.pow(t2 - 64.58, 2) / (2 * Math.pow(0.32, 2)));
    val += 0.31 * Math.exp(-Math.pow(t2 - 77.54, 2) / (2 * Math.pow(0.35, 2)));

    const hump = 0.08 * Math.exp(-Math.pow(t2 - 25.0, 2) / (2 * Math.pow(12, 2)));
    const noise = (Math.random() - 0.5) * 0.015;
    yReal.push(Math.max(0.001, val + hump + noise));
  }

  const name = `Gold Nanocrystal fcc XRD [Sample-${index}]`;
  const technique = 'XRD (X-ray Diffraction)';

  return {
    id: `sim-xrd-${Date.now()}-${index}`,
    name,
    technique,
    x_orig: [...x],
    y_orig: [...yReal],
    x: [...x],
    y_processed: [...yReal],
    color: '#f59e0b',
    visible: true,
    lineWidth: 1.2,
    lineStyle: 'solid',
    marker: 'none',
    markerSize: 6,
    peaks: [],
    integrals: [],
    baseline: null,
    fitResult: null,
    fitPeakStats: null,
    fitGoodnessOfFit: null,
    fitComponents: null,
    fitResiduals: null,
    yError: null,
    significanceAnnotations: null,
    isTauc: false,
    taucData: null,
    jobsData: null,
    undoStack: [[...yReal]],
    redoStack: [],
    history: [`[${new Date().toLocaleTimeString()}] Simulated polycrystalline fcc XRD diffraction peaks.`]
  };
}

export function simulateXPS(index: number): SpectrumData {
  const points = 800;
  const x: number[] = [];
  const yReal: number[] = [];

  for (let i = 0; i < points; i++) {
    const ev = 280 + (15 * i) / (points - 1);
    x.push(ev);

    let val = 0.0;
    val += 0.75 * Math.exp(-Math.pow(ev - 284.8, 2) / (2 * Math.pow(0.70, 2)));
    val += 0.28 * Math.exp(-Math.pow(ev - 286.2, 2) / (2 * Math.pow(0.80, 2)));
    val += 0.15 * Math.exp(-Math.pow(ev - 287.8, 2) / (2 * Math.pow(0.85, 2)));
    val += 0.12 * Math.exp(-Math.pow(ev - 288.9, 2) / (2 * Math.pow(0.80, 2)));

    let bg = 0.05;
    if (ev > 284.0) {
      bg += 0.10 * (1 - Math.exp(-(ev - 284.0) / 4.0));
    }

    const noise = (Math.random() - 0.5) * 0.011;
    yReal.push(Math.max(0.001, val + bg + noise));
  }

  const name = `Carbon C1s High-Res XPS [Spot-${index}]`;
  const technique = 'XPS (X-ray Photoelectron Spectroscopy)';

  return {
    id: `sim-xps-${Date.now()}-${index}`,
    name,
    technique,
    x_orig: [...x],
    y_orig: [...yReal],
    x: [...x],
    y_processed: [...yReal],
    color: '#e11d48',
    visible: true,
    lineWidth: 1.5,
    lineStyle: 'solid',
    marker: 'none',
    markerSize: 6,
    peaks: [],
    integrals: [],
    baseline: null,
    fitResult: null,
    fitPeakStats: null,
    fitGoodnessOfFit: null,
    fitComponents: null,
    fitResiduals: null,
    yError: null,
    significanceAnnotations: null,
    isTauc: false,
    taucData: null,
    jobsData: null,
    undoStack: [[...yReal]],
    redoStack: [],
    history: [`[${new Date().toLocaleTimeString()}] Geometries compiled: simulated Shirley background-corrected high-res C 1s photoelectron peak.`]
  };
}

export function simulate13CNMR(index: number): SpectrumData {
  const points = 2000;
  const x: number[] = [];
  const yReal: number[] = [];
  const xMin = 0;
  const xMax = 220;

  for (let i = 0; i < points; i++) {
    const shift = xMin + ((xMax - xMin) * i) / (points - 1);
    x.push(shift);

    let val = 0;
    const w = 0.12; // super narrow 13C lines

    // Carbonyl C=O ester at 167.3 ppm (quaternary, low relative intensity)
    val += 0.25 * Math.exp(-Math.pow(shift - 167.3, 2) / (2 * w * w));

    // Aromatic C1 (quaternary, low intensity) at 130.5 ppm
    val += 0.24 * Math.exp(-Math.pow(shift - 130.5, 2) / (2 * w * w));

    // Aromatic C-para at 133.0 ppm (medium intensity)
    val += 0.50 * Math.exp(-Math.pow(shift - 133.0, 2) / (2 * w * w));

    // Aromatic C-ortho at 129.6 ppm (high intensity, symmetric 2 carbons)
    val += 0.88 * Math.exp(-Math.pow(shift - 129.6, 2) / (2 * w * w));

    // Aromatic C-meta at 128.3 ppm (high intensity, symmetric 2 carbons)
    val += 0.86 * Math.exp(-Math.pow(shift - 128.3, 2) / (2 * w * w));

    // CDCl3 solvent triplet centered at 77.0 ppm (1:1:1 ratio)
    val += 0.18 * Math.exp(-Math.pow(shift - 76.8, 2) / (2 * w * w));
    val += 0.18 * Math.exp(-Math.pow(shift - 77.0, 2) / (2 * w * w));
    val += 0.18 * Math.exp(-Math.pow(shift - 77.2, 2) / (2 * w * w));

    // CH2-O ester at 60.8 ppm (medium, 1 carbon)
    val += 0.48 * Math.exp(-Math.pow(shift - 60.8, 2) / (2 * w * w));

    // Alkyl CH3 methyl at 14.3 ppm (medium, 1 carbon)
    val += 0.52 * Math.exp(-Math.pow(shift - 14.3, 2) / (2 * w * w));

    const noise = (Math.random() - 0.5) * 0.006;
    yReal.push(Math.max(0.0, val + noise));
  }

  const name = `Ester Extract 13C NMR [Sample-${index}]`;
  const technique = '13C NMR Spectroscopy';

  return {
    id: `sim-c13-${Date.now()}-${index}`,
    name,
    technique,
    x_orig: [...x],
    y_orig: [...yReal],
    x: [...x],
    y_processed: [...yReal],
    color: '#8b5cf6',
    visible: true,
    lineWidth: 1.2,
    lineStyle: 'solid',
    marker: 'none',
    markerSize: 6,
    peaks: [],
    integrals: [],
    baseline: null,
    fitResult: null,
    fitPeakStats: null,
    fitGoodnessOfFit: null,
    fitComponents: null,
    fitResiduals: null,
    yError: null,
    significanceAnnotations: null,
    isTauc: false,
    taucData: null,
    jobsData: null,
    undoStack: [[...yReal]],
    redoStack: [],
    history: [`[${new Date().toLocaleTimeString()}] Generated virtual proton-decoupled 13C NMR organic spectrum.`]
  };
}

export function simulate2DCOSY(index: number): SpectrumData {
  const points = 1000;
  const x: number[] = [];
  const yReal: number[] = [];
  const xMin = 0;
  const xMax = 10; // Protons coupling

  // We simulate a beautiful COSY spectrum projection as a 1D reference,
  // but we can also store coupling information directly in the spectrum trace and draw beautiful 2D nested contour loops on the plot!
  for (let i = 0; i < points; i++) {
    const shift = xMin + ((xMax - xMin) * i) / (points - 1);
    x.push(shift);

    // Sum of standard proton resonances as outline reference
    let val = 0.02;
    const w = 0.015;

    // Aromatic protons around 7.5 ppm
    val += 0.45 * Math.exp(-Math.pow(shift - 7.5, 2) / (2 * w * w));
    val += 0.35 * Math.exp(-Math.pow(shift - 7.3, 2) / (2 * w * w));

    // Methylene O-CH2 at 4.1 ppm
    val += 0.38 * Math.exp(-Math.pow(shift - 4.1, 2) / (2 * w * w));

    // Acetyl CH3 at 2.0 ppm
    val += 0.50 * Math.exp(-Math.pow(shift - 2.0, 2) / (2 * w * w));

    // Alkyl CH3 at 1.2 ppm
    val += 0.42 * Math.exp(-Math.pow(shift - 1.2, 2) / (2 * w * w));

    const noise = (Math.random() - 0.5) * 0.005;
    yReal.push(Math.max(0.0, val + noise));
  }

  const name = `Ester Coupling 2D COSY NMR [Sample-${index}]`;
  const technique = '2D COSY NMR Spectroscopy';

  return {
    id: `sim-cosy-${Date.now()}-${index}`,
    name,
    technique,
    x_orig: [...x],
    y_orig: [...yReal],
    x: [...x],
    y_processed: [...yReal],
    color: '#0ea5e9',
    visible: true,
    lineWidth: 1.4,
    lineStyle: 'solid',
    marker: 'none',
    markerSize: 6,
    peaks: [],
    integrals: [],
    baseline: null,
    fitResult: null,
    fitPeakStats: null,
    fitGoodnessOfFit: null,
    fitComponents: null,
    fitResiduals: null,
    yError: null,
    significanceAnnotations: null,
    isTauc: false,
    taucData: null,
    jobsData: null,
    undoStack: [[...yReal]],
    redoStack: [],
    history: [`[${new Date().toLocaleTimeString()}] Generated virtual 2D COSY 1H-1H homonuclear correlation NMR.`]
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// ── TIER 4 SIMULATORS ────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

import { simulateCV, simulateEIS, simulateEPR, simulateTGA } from '../utils/math';

export function simulateCyclicVoltammogram(index: number): SpectrumData {
  const result = simulateCV(-0.6, 0.6, 0.0, 0.05, 1, 0.5, 0.01);
  const name = `Butler-Volmer CV [Sample-${index}]`;
  const technique = 'Cyclic Voltammetry';
  return {
    id: `sim-cv-${Date.now()}-${index}`,
    name,
    technique,
    x_orig: [...result.E],
    y_orig: [...result.i],
    x: [...result.E],
    y_processed: [...result.i],
    color: '#4ade80',
    visible: true,
    lineWidth: 1.8,
    lineStyle: 'solid',
    marker: 'none',
    markerSize: 4,
    peaks: [],
    integrals: [],
    baseline: null,
    fitResult: null,
    fitPeakStats: null,
    fitGoodnessOfFit: null,
    fitComponents: null,
    fitResiduals: null,
    yError: null,
    significanceAnnotations: null,
    isTauc: false,
    taucData: null,
    jobsData: null,
    undoStack: [[...result.i]],
    redoStack: [],
    history: [`[${new Date().toLocaleTimeString()}] Butler-Volmer CV simulated: E°=0.0V, ν=0.05 V/s, n=1.`]
  };
}

export function simulateNyquistEIS(index: number): SpectrumData {
  const result = simulateEIS(10, 200, 20e-6, 30, 0.01, 1e5, 60);
  const name = `Randles EIS Nyquist [Sample-${index}]`;
  const technique = 'EIS Nyquist';
  return {
    id: `sim-eis-${Date.now()}-${index}`,
    name,
    technique,
    x_orig: [...result.Zre],
    y_orig: [...result.Zim_neg],
    x: [...result.Zre],
    y_processed: [...result.Zim_neg],
    color: '#a78bfa',
    visible: true,
    lineWidth: 1.5,
    lineStyle: 'solid',
    marker: 'circle',
    markerSize: 3,
    peaks: [],
    integrals: [],
    baseline: null,
    fitResult: null,
    fitPeakStats: null,
    fitGoodnessOfFit: null,
    fitComponents: null,
    fitResiduals: null,
    yError: null,
    significanceAnnotations: null,
    isTauc: false,
    taucData: null,
    jobsData: null,
    undoStack: [[...result.Zim_neg]],
    redoStack: [],
    history: [`[${new Date().toLocaleTimeString()}] Randles circuit EIS: Rs=10Ω, Rct=200Ω, Cdl=20μF.`]
  };
}

export function simulateEPRSpectrum(index: number): SpectrumData {
  const result = simulateEPR(2.0023, 9.5, 1.0, 'lorentzian', 0, 1, 500);
  const name = `EPR/ESR X-band [Sample-${index}]`;
  const technique = 'EPR/ESR';
  return {
    id: `sim-epr-${Date.now()}-${index}`,
    name,
    technique,
    x_orig: [...result.B],
    y_orig: [...result.derivative],
    x: [...result.B],
    y_processed: [...result.derivative],
    color: '#fb923c',
    visible: true,
    lineWidth: 1.5,
    lineStyle: 'solid',
    marker: 'none',
    markerSize: 4,
    peaks: [],
    integrals: [],
    baseline: null,
    fitResult: null,
    fitPeakStats: null,
    fitGoodnessOfFit: null,
    fitComponents: null,
    fitResiduals: null,
    yError: null,
    significanceAnnotations: null,
    isTauc: false,
    taucData: null,
    jobsData: null,
    undoStack: [[...result.derivative]],
    redoStack: [],
    history: [`[${new Date().toLocaleTimeString()}] EPR X-band simulated: g=2.0023, B₀=${result.B0_mT.toFixed(2)} mT, ΔB=1.0 mT.`]
  };
}

export function simulateTGACurve(index: number): SpectrumData {
  const steps = [
    { Tmid_C: 280, massLoss_pct: 15, width_C: 40 },
    { Tmid_C: 420, massLoss_pct: 35, width_C: 60 },
    { Tmid_C: 620, massLoss_pct: 25, width_C: 80 },
  ];
  const result = simulateTGA(steps, 25, 800, 500);
  const name = `TGA 3-step Decomposition [Sample-${index}]`;
  const technique = 'TGA';
  return {
    id: `sim-tga-${Date.now()}-${index}`,
    name,
    technique,
    x_orig: [...result.T_C],
    y_orig: [...result.mass_pct],
    x: [...result.T_C],
    y_processed: [...result.mass_pct],
    color: '#f59e0b',
    visible: true,
    lineWidth: 2.0,
    lineStyle: 'solid',
    marker: 'none',
    markerSize: 4,
    peaks: [],
    integrals: [],
    baseline: null,
    fitResult: null,
    fitPeakStats: null,
    fitGoodnessOfFit: null,
    fitComponents: null,
    fitResiduals: null,
    yError: null,
    significanceAnnotations: null,
    isTauc: false,
    taucData: null,
    jobsData: null,
    undoStack: [[...result.mass_pct]],
    redoStack: [],
    history: [`[${new Date().toLocaleTimeString()}] TGA 3-step decomposition: 25–800°C, total loss ${steps.reduce((s,st) => s+st.massLoss_pct, 0)}%.`]
  };
}
