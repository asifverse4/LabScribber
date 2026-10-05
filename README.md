<div align="center">

<img src="https://capsule-render.vercel.app/api?type=waving&color=0:07111f,45:123a5a,100:00b8d9&height=250&section=header&text=LabScribber%20Pro&fontSize=62&fontColor=ffffff&fontAlignY=36&desc=Scientific%20Spectroscopy%20Analysis%20Suite&descAlignY=61&descSize=20&animation=fadeIn" width="100%" alt="LabScribber Pro banner" />

<br />

<img src="https://readme-typing-svg.demolab.com?font=JetBrains+Mono&weight=600&size=19&pause=1000&color=67E8F9&center=true&vCenter=true&width=900&lines=Transform+experimental+spectra+into+scientific+insight;Process+%E2%80%A2+Analyze+%E2%80%A2+Fit+%E2%80%A2+Visualize+%E2%80%A2+Report;Built+for+modern+research+laboratories" alt="Animated LabScribber tagline" />

<br />

<a href="https://github.com/asifverse4/LabScribber/stargazers">
<img src="https://img.shields.io/github/stars/asifverse4/LabScribber?style=for-the-badge&logo=github&color=f59e0b" alt="GitHub stars" />
</a>
<a href="https://github.com/asifverse4/LabScribber/network/members">
<img src="https://img.shields.io/github/forks/asifverse4/LabScribber?style=for-the-badge&logo=github&color=0284c7" alt="GitHub forks" />
</a>
<a href="https://github.com/asifverse4/LabScribber/blob/main/LICENSE">
<img src="https://img.shields.io/badge/License-MIT-22c55e?style=for-the-badge" alt="MIT License" />
</a>
<img src="https://img.shields.io/badge/Python-3.9%2B-3776AB?style=for-the-badge&logo=python&logoColor=white" alt="Python 3.9 or later" />

<br /><br />

<strong>Professional spectral analysis, signal processing, deconvolution, multivariate analytics, and publication-ready figure generation.</strong>

<br /><br />

<a href="#-overview">Overview</a> •
<a href="#-workflow">Workflow</a> •
<a href="#-features">Features</a> •
<a href="#-quick-start">Quick Start</a> •
<a href="#-roadmap">Roadmap</a>

</div>

---

## 🔬 Overview

**LabScribber Pro** is an advanced Python desktop application for chemists, materials scientists, spectroscopists, nanotechnology researchers, and academic laboratories.

It provides an integrated workflow for converting raw experimental data into reproducible scientific results:

> **Raw Data → Signal Processing → Peak Analysis → Curve Fitting → Visualization → Scientific Report**

LabScribber combines data ingestion, spectral processing, peak interpretation, deconvolution, PCA, Tauc plots, Job’s plots, publication styling, HDF5 workspace management, and automated reporting in one research-focused application.

---

## 🧭 Scientific Workflow

<table>
<tr>
<td align="center" width="16%">

### 01

## 📥

### Import

Load CSV, TXT, DAT, XLS, or XLSX datasets.

</td>
<td align="center" width="2%">➜</td>
<td align="center" width="16%">

### 02

## 🧹

### Process

Smooth, normalize, differentiate, and correct baselines.

</td>
<td align="center" width="2%">➜</td>
<td align="center" width="16%">

### 03

## 📍

### Analyze

Detect peaks, assign regions, and inspect spectral features.

</td>
<td align="center" width="2%">➜</td>
<td align="center" width="16%">

### 04

## 🧩

### Model

Fit Gaussian, Lorentzian, or Voigt peak components.

</td>
<td align="center" width="2%">➜</td>
<td align="center" width="16%">

### 05

## 🎨

### Visualize

Create publication-quality overlays, heatmaps, and figures.

</td>
<td align="center" width="2%">➜</td>
<td align="center" width="16%">

### 06

## 📝

### Report

Export figures, analytical tables, and Markdown reports.

</td>
</tr>
</table>

<div align="center">

<img src="https://progress-bar.dev/100/?title=research%20workflow&width=700&color=00b8d9" alt="Complete scientific workflow" />

<br />

<sub>
A complete research pipeline — from experimental measurement to publication-ready scientific communication.
</sub>

</div>

---

## ✨ Why LabScribber?

<table>
<tr>
<td align="center" width="33%">

## 📥

### Unified Import

Automatically detect axes, extract multiple spectra, and preserve dataset headers.

</td>
<td align="center" width="33%">

## 🧠

### Scientific Analysis

Perform peak detection, curve fitting, PCA, bandgap estimation, and stoichiometric analysis.

</td>
<td align="center" width="33%">

## 📊

### Publication Output

Generate polished figures, analytical tables, vector graphics, and reproducible reports.

</td>
</tr>
</table>

---

## 🚀 Features

<details open>
<summary><b>📥 Data Import & Workspace Management</b></summary>

- CSV, TXT, DAT, XLS, and XLSX support
- Automatic X-axis detection
- Multiple Y-column and multi-spectrum extraction
- Header preservation as dataset names
- HDF5 `.h5` project workspace format
- Metadata and processing-history storage
- Undo and redo support

</details>

<details>
<summary><b>🧹 Signal Processing</b></summary>

- Savitzky–Golay smoothing
- Adjustable window size and polynomial order
- Moving-average filtering
- First- and second-derivative calculations
- ALS baseline correction
- Shirley background correction
- Blank and solvent subtraction
- Instrument-background subtraction
- Min–max normalization

</details>

<details>
<summary><b>📍 Peak Analysis & Interpretation</b></summary>

- Automatic peak detection using `scipy.signal.find_peaks`
- Prominence filtering
- Distance filtering
- Interactive peak picking
- Manual peak editing
- Peak annotations
- FTIR assignment assistance
- UV–Vis assignment assistance
- ¹H NMR assignment assistance

</details>

<details>
<summary><b>🧩 Deconvolution & Curve Fitting</b></summary>

- Gaussian fitting
- Lorentzian fitting
- Voigt fitting
- Levenberg–Marquardt optimization
- Constrained fitting
- Center tolerance control
- Width bounds
- Individual peak components
- Total fit curve
- Residual analysis

</details>

<details>
<summary><b>🧬 Multivariate & Solid-State Analysis</b></summary>

- Principal Component Analysis
- SVD-based PCA implementation
- Scores plots
- Loadings plots
- Sample clustering
- Similarity trend analysis
- Tauc plot generation
- Direct bandgap estimation
- Job’s plot generation
- Stoichiometric estimation

</details>

<details>
<summary><b>🎨 Visualization & Reporting</b></summary>

- Standard overlay plots
- Waterfall plots
- Contour heatmaps
- Inset plots
- Highlighted spectral regions
- Real-time crosshair tracking
- ACS-inspired styling
- Nature-inspired styling
- RSC-inspired styling
- SVG export
- PDF export
- High-DPI PNG export
- Markdown report generation
- CSV analytical exports

</details>

---

## 🧪 Supported Techniques

| Technique | Typical Applications |
| --- | --- |
| **UV–Vis Spectroscopy** | Absorption analysis, peak detection, Tauc plots |
| **FTIR Spectroscopy** | Baseline correction and functional-group assignments |
| **Raman Spectroscopy** | Peak fitting, deconvolution, and comparison |
| **Fluorescence Spectroscopy** | Spectral analysis and Gaussian fitting |
| **XRD** | Pattern comparison and visualization |
| **XPS** | Shirley background and Voigt deconvolution |
| **¹H NMR** | Chemical-shift assignments and peak fitting |
| **¹³C NMR** | Spectral visualization and interpretation |
| **Cyclic Voltammetry** | Electrochemical curve visualization |

---

## ⚡ Quick Start

### Clone the Repository

```bash
git clone https://github.com/asifverse4/LabScribber.git
cd LabScribber
```

### Create a Virtual Environment

```bash
python -m venv .venv
```

#### macOS / Linux

```bash
source .venv/bin/activate
```

#### Windows PowerShell

```powershell
.venv\Scripts\Activate.ps1
```

### Install Dependencies

```bash
python -m pip install numpy scipy pandas matplotlib PySide6 h5py openpyxl xlrd
```

### Launch the Desktop Application

```bash
python labscribber.py
```

### Run CLI Mode

```bash
python labscribber.py --cli \
  --input data_folder \
  --output results \
  --tech "UV-Vis Spectroscopy"
```

---

## 🏗️ Architecture

```text
LabScribber
│
├── 📥 Data Ingestion
│   ├── CSV / TXT / DAT
│   └── Excel XLS / XLSX
│
├── 🧹 Processing Engine
│   ├── Smoothing
│   ├── Baseline Correction
│   ├── Normalization
│   ├── Background Subtraction
│   └── Derivatives
│
├── 🧠 Analytics Engine
│   ├── Peak Detection
│   ├── Peak Assignment
│   ├── PCA
│   ├── Tauc Plot
│   ├── Job's Plot
│   └── Curve Deconvolution
│
├── 🎨 Visualization Layer
│   ├── Overlay Plots
│   ├── Waterfall Plots
│   ├── Contour Heatmaps
│   └── Publication Styles
│
└── 📝 Reporting System
    ├── Markdown Reports
    ├── CSV Export
    └── SVG / PDF / PNG Export
```

---

## 📈 Interpretation Helpers

| Technique | Spectral Region | Assignment Aid |
| --- | ---: | --- |
| FTIR | 3200–3600 cm⁻¹ | O–H / N–H |
| FTIR | 2800–3100 cm⁻¹ | C–H stretch |
| FTIR | 1650–1750 cm⁻¹ | Carbonyl |
| FTIR | 1000–1300 cm⁻¹ | C–O stretch |
| ¹H NMR | 0.5–1.5 ppm | Alkyl |
| ¹H NMR | 1.5–2.5 ppm | Allylic |
| ¹H NMR | 2.5–4.5 ppm | Heteroatom environment |
| ¹H NMR | 6.5–8.5 ppm | Aromatic |
| UV–Vis | 200–250 nm | π → π* |
| UV–Vis | 250–350 nm | n → π* |

> These ranges are heuristic interpretation aids and should be validated against the sample, instrument settings, and relevant scientific literature.

---

## 📚 Example Research Applications

### Carbon Nanomaterials

- UV–Vis spectral analysis
- FTIR functional-group interpretation
- Tauc bandgap estimation
- Comparative sample visualization

### Organic Chemistry

- ¹H NMR peak assignments
- Peak integration
- Spectral comparison
- Curve fitting

### Materials Science

- Raman peak analysis
- XRD pattern comparison
- PCA-based sample classification
- Publication-quality figure generation

### Surface Chemistry

- XPS background correction
- Peak deconvolution
- Component fitting
- Residual analysis

### Electrochemistry

- Cyclic voltammetry visualization
- Multi-sample comparison
- Analytical figure export

---

## 🗺️ Roadmap

- [ ] Machine-learning peak assignment
- [ ] AI-assisted spectral interpretation
- [ ] FTIR functional-group predictor
- [ ] NMR structure assistance
- [ ] Automated figure-caption generation
- [ ] Automated methods-section generation
- [ ] Journal submission assistant
- [ ] Spectral database search
- [ ] Computational chemistry integration
- [ ] LLM-powered scientific copilot

---

## 🤝 Contributing

Contributions, ideas, bug reports, scientific validation feedback, and pull requests are welcome.

For major changes:

1. Open an issue first.
2. Explain the scientific or technical use case.
3. Create a focused feature branch.
4. Add clear documentation.
5. Submit a pull request.

---

## ❤️ Acknowledgements

Special thanks to:

- **Dr. Imran A. Khan**
- **Huma Basheer**

Thank you for the continued motivation, encouragement, and support.

---

## 📚 Citation

If you use LabScribber in academic work, please cite:

```bibtex
@software{labscribber,
  author  = {Raza, Asif},
  title   = {LabScribber Pro: Enterprise Spectral Analysis Suite},
  year    = {2026},
  version = {1.0},
  url     = {https://github.com/asifverse4/LabScribber}
}
```

---

## 📄 License

LabScribber is released under the [MIT License](LICENSE).

---

<div align="center">

<a href="https://razorpay.me/@onlyasifraza">
<img src="https://img.shields.io/badge/Support%20LabScribber-Razorpay-0ea5e9?style=for-the-badge&logo=razorpay&logoColor=white" alt="Support LabScribber on Razorpay" />
</a>

<br /><br />

<img src="https://capsule-render.vercel.app/api?type=waving&color=0:00b8d9,50:123a5a,100:07111f&height=140&section=footer&animation=fadeIn" width="100%" alt="LabScribber footer" />

<br />

<sub>
Built with ❤️ for scientific discovery by
<a href="https://github.com/asifverse4">Asif Raza</a>
· ASIFVERSE4
</sub>

</div>
