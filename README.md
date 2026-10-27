<div align="center">

<img src="assets/hero.svg" alt="LabScribber — scientific spectroscopy workstation" width="100%">

<br>

[![CI](https://img.shields.io/github/actions/workflow/status/asifverse4/LabScribber/ci.yml?branch=main&style=flat-square&label=CI&labelColor=0C1424&color=5FD6CF)](https://github.com/asifverse4/LabScribber/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-D4B483?style=flat-square&labelColor=0C1424)](LICENSE)
[![Tests](https://img.shields.io/badge/tests-177-5FD6CF?style=flat-square&labelColor=0C1424)](tests)
[![Node](https://img.shields.io/badge/node-%E2%89%A520.19-D4B483?style=flat-square&labelColor=0C1424)](package.json)
[![Cite](https://img.shields.io/badge/cite-CITATION.cff-8FA3BF?style=flat-square&labelColor=0C1424)](CITATION.cff)

**[Quick start](#quick-start)** &nbsp;·&nbsp; **[Capabilities](#capabilities)** &nbsp;·&nbsp; **[Quality](#quality--reproducibility)** &nbsp;·&nbsp; **[Roadmap](#known-limitations--roadmap)** &nbsp;·&nbsp; **[Citing](#citing)**

</div>

<br>

LabScribber is a browser-based, Electron-packaged workstation for academic spectroscopy. It takes instrument data through baseline correction, peak deconvolution, chemometrics and journal-grade export in one application, and is backed by an automated suite of **177 tests** covering numerical routines and UI behaviour.

<br>

<div align="center">
<img src="assets/pipeline.svg" alt="Analysis workflow: import, baseline, peaks, deconvolve, chemometrics, report" width="100%">
</div>

<br>

[![DOI](https://zenodo.org/badge/1266337796.svg)](https://doi.org/10.5281/zenodo.23688639)


## Techniques

<div align="center">
<img src="assets/techniques.svg" alt="UV-Vis, FTIR, Raman, NMR, XPS, PL, XRD, CV, EIS" width="100%">
</div>

<br>

## Capabilities

| | |
|---|---|
| **Signal processing** | Baseline correction, smoothing and peak detection across all supported techniques |
| **Peak deconvolution** | Multi-peak fitting with covariance-based parameter uncertainty |
| **Solid-state analysis** | Scherrer and Williamson–Hall XRD analysis; Tauc bandgap extraction |
| **Chemometrics** | PCA, MCR-ALS, PLS and hierarchical clustering |
| **NMR** | ¹H, ¹³C and 2D COSY |
| **Electrochemistry** | Cyclic voltammetry and impedance (EIS) |
| **Reproducibility** | Session files (`.lsb`), provenance tracking and methods-section text generation |
| **Export** | Publication-oriented figures and PDF output |

## Quick start

**Requires Node.js ≥ 20.19**

```bash
git clone https://github.com/asifverse4/LabScribber.git
cd LabScribber
npm install
npm run dev
```

Open **http://localhost:3000**.

<details>
<summary><b>Desktop app, tests, production build</b></summary>

<br>

```bash
npm run electron:dev      # desktop app (Electron)
npm test                  # full test suite
npm run test:coverage     # coverage report -> coverage/index.html
npm run build             # production build
npm run electron:dist     # Windows / macOS / Linux installers
```

`electron:dist` expects `build/icon.ico`, `build/icon.icns` and `build/icon.png` (PNG at least 512×512). Add them before packaging. See [`CONTRIBUTING.md`](CONTRIBUTING.md) for the developer guide and [`docs/SESSION_FORMAT.md`](docs/SESSION_FORMAT.md) for the `.lsb` session format.

</details>

## Quality & reproducibility

- **177 automated tests** across the numerical core and the UI.
- **Continuous integration** runs type-check, tests and a production build on every push and pull request ([workflow](.github/workflows/ci.yml)).
- **Verified on synthetic data** with known ground truth; see the accompanying paper (`paper.md`).

## Known limitations & roadmap

- **Tauc auto-window selection is noise-sensitive**, even with the manual wavelength-range safeguard set correctly (paper §2.3). A scoped fix is planned.
- **AI-assisted interpretation is planned, not implemented.** A `@google/genai` dependency is declared for future work only.
- **Real-instrument validation is ongoing.** Validation on non-synthetic datasets is in progress.

Full release history: [`CHANGELOG.md`](CHANGELOG.md).

## Citing

If you use LabScribber in your research, please cite it using [`CITATION.cff`](CITATION.cff). GitHub's **Cite this repository** button reads it directly. A draft JOSS paper is included (`paper.md`, `paper.bib`) but has not been submitted.

<br>

<div align="center">

<sub>Developed at the School of Chemical and Life Sciences, Jamia Hamdard University, New Delhi, India.<br>
Created by <b>Asif Raza</b> · Contributor: <b>Huma Basheer</b> · Supervision: <b>Imran A. Khan</b> · Released under the <a href="LICENSE">MIT License</a></sub>

</div>
