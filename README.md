Labscribber Pro — Enterprise Scientific Spectroscopy Suite
<div align="center">










Professional Spectral Analysis, Visualization, Deconvolution, and Publication-Ready Figure Generation

Created by Asif Raza

</div>
Overview

Labscribber Pro is an advanced desktop application designed for chemists, material scientists, nanotechnology researchers, spectroscopists, and academic laboratories.

The software provides a complete workflow from:

Raw Experimental Data → Signal Processing → Peak Analysis → Curve Fitting → Publication Figure → Scientific Report

Unlike many plotting tools, Labscribber integrates:

Smart multi-format data ingestion
Advanced signal processing
Automatic peak detection
Spectral interpretation assistance
PCA multivariate analysis
Tauc plot generation
Job's plot analysis
Publication-quality visualization
HDF5 workspace management
Automated report generation
Key Features
Data Import Engine

Supports:

CSV
TXT
DAT
XLS
XLSX
Smart Multi-Column Detection

Labscribber automatically:

Detects X-axis column
Detects multiple Y columns
Extracts multiple spectra from a single spreadsheet
Preserves headers as dataset names

Example:

Wavelength	Sample A	Sample B	Sample C
200	0.12	0.18	0.09
201	0.13	0.19	0.10

Imports all spectra automatically.

Supported Techniques
UV–Vis Spectroscopy
FTIR Spectroscopy
Raman Spectroscopy
Fluorescence Spectroscopy
XRD
XPS
¹H NMR
¹³C NMR
Cyclic Voltammetry
Signal Processing Tools
Smoothing
Savitzky-Golay Filter
Adjustable window size
Adjustable polynomial order
Derivative calculations

Supports:

Raw signal
First derivative
Second derivative
Moving Average Filter

Noise reduction for experimental datasets.

Baseline Correction
ALS Baseline

Best for:

FTIR
Raman
UV-Vis

Features:

Adjustable λ parameter
Iterative optimization
Shirley Background

Optimized for:

XPS spectra
Blank Spectrum Subtraction

Remove:

Solvent contribution
Instrument background
Reference sample signals
Normalization

Min-Max normalization:

0 → minimum intensity
1 → maximum intensity

Useful for:

Comparative spectroscopy
PCA analysis
Peak Analysis
Automatic Peak Detection

Based on:

scipy.signal.find_peaks()

Features:

Prominence filtering
Distance filtering
Manual peak editing
Interactive Peak Picking

Simply click on a peak to:

Add annotation
Include in fitting workflow
Generate assignments
Expert Interpretation System

Labscribber contains a built-in heuristic expert system.

FTIR Assignments
Region	Assignment
3200–3600 cm⁻¹	O-H / N-H
2800–3100 cm⁻¹	C-H Stretch
1650–1750 cm⁻¹	Carbonyl
1000–1300 cm⁻¹	C-O Stretch
¹H NMR Assignments
Chemical Shift	Assignment
0.5–1.5 ppm	Alkyl
1.5–2.5 ppm	Allylic
2.5–4.5 ppm	Heteroatom
6.5–8.5 ppm	Aromatic
9–10.5 ppm	Aldehyde
UV-Vis Assignments
Region	Assignment
200–250 nm	π → π*
250–350 nm	n → π*
Peak Deconvolution

Supports:

Gaussian Fitting

Ideal for:

UV-Vis
Fluorescence
Lorentzian Fitting

Ideal for:

Raman
NMR
Voigt Fitting

Ideal for:

XPS
Real experimental spectra
Levenberg–Marquardt Optimization

Features:

Constrained fitting
Center tolerance control
Width bounds
Residual analysis

Outputs:

Individual peak components
Total fit
Residual curve
Multivariate Analysis
PCA (Principal Component Analysis)

Implemented using:

Singular Value Decomposition (SVD)

Outputs:

Scores Plot

Shows:

Sample clustering
Similarity trends
Loadings Plot

Shows:

Variables responsible for variance

Useful for:

Material screening
Batch comparison
Chemometrics
Solid-State Analysis
Tauc Plot Generator

Supports:

Direct Bandgap

Automatically:

Converts wavelength to energy
Identifies linear region
Calculates:
Eg (eV)

Useful for:

Carbon dots
Semiconductors
Nanomaterials
Job's Plot Generator

Determine:

Complex stoichiometry

Features:

Mole fraction input
Automatic interpolation
Stoichiometric estimation
Visualization Engine
Publication-Ready Figures

Generate figures suitable for:

ACS Journals
Nature Journals
RSC Journals
Supported Layouts
Standard Overlay

Multiple spectra on same axis.

Waterfall Plot

3D spectral stacking.

Contour Heatmap

2D intensity visualization.

Advanced Plot Features
Real-Time Crosshair Tracking

Displays:

X coordinate
Y coordinate

while hovering.

Inset Plot

Zoomed region visualization.

Highlight Regions

Mark:

Absorption bands
Functional group regions
Bandgap region
Journal Styling

Built-in presets:

ACS
Nature
RSC

Automatically adjusts:

Fonts
Tick styles
DPI
Figure dimensions
Workspace Management
HDF5 Project Format

Save:

Spectra
Processing history
Plot styles
Metadata

into a single:

.h5

workspace.

Undo / Redo System

Supports:

Ctrl + Z
Ctrl + Y

Track:

Processing steps
Peak additions
Integrations
Scientific Reporting
Markdown Reports

Automatically generate:

Dataset information
Processing history
Peak assignments
Confidence values
Integrations
Bandgap calculations
CSV Export

Export:

Spectral data
Peak tables
Analytical results
Vector Figure Export

Publication-ready:

SVG
PDF
PNG

High DPI support.

Sample Applications
Carbon Dots Research
UV-Vis analysis
FTIR interpretation
Tauc bandgap calculation
Organic Chemistry
¹H NMR assignments
Peak integration
Materials Science
Raman analysis
XRD comparison
Surface Chemistry
XPS deconvolution
Electrochemistry
Cyclic voltammetry visualization
Installation
Clone Repository
git clone https://github.com/asifverse4/labscribber.git

cd labscribber
Install Dependencies
pip install numpy scipy pandas matplotlib PySide6 h5py openpyxl xlrd
Run GUI
python labscribber.py
Run CLI Mode
python labscribber.py --cli \
    --input data_folder \
    --output results \
    --tech "UV-Vis Spectroscopy"
Architecture
Labscribber
│
├── Data Ingestion
│   ├── CSV
│   ├── Excel
│   └── TXT
│
├── Processing Engine
│   ├── Smoothing
│   ├── Baseline
│   ├── Normalization
│   └── Derivatives
│
├── Analytics Engine
│   ├── Peak Detection
│   ├── PCA
│   ├── Tauc Plot
│   ├── Job's Plot
│   └── Deconvolution
│
├── Visualization Layer
│   ├── Overlay
│   ├── Waterfall
│   ├── Heatmap
│   └── Publication Styles
│
└── Reporting System
    ├── Markdown Reports
    ├── CSV Export
    └── Figure Export
Future Roadmap
Planned Features
Machine Learning Peak Assignment
AI Spectral Interpretation
FTIR Functional Group Predictor
NMR Structure Assistance
Automated Figure Caption Generation
Automated Methods Section Generator
Journal Submission Assistant
Spectral Database Search
Computational Chemistry Integration
LLM-Powered Scientific Copilot
Citation

If you use Labscribber in academic work:

@software {labscribber,

  author = {Asif Raza},
  
  title = {Labscribber Pro: Enterprise Spectral Analysis Suite},
  
  year = {2026},
  
  version = {1.0},
  
  url = {https://github.com/asifverse4/labscribber}
  
}
License

MIT License

Copyright (c) 2026 Asif Raza

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files to deal in the Software without restriction.# LabScribber

DONATE US HERE:- razorpay.me/@onlyasifraza


<sub>Built with ❤️ by <a href="https://github.com/your-username">ASIFVERSE4</a></sub>
</p>
