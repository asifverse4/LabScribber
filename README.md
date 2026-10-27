# Labscribber

[![CI](https://github.com/asifverse4/LabScribber/actions/workflows/ci.yml/badge.svg)](https://github.com/asifverse4/LabScribber/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

**A browser-based scientific spectroscopy workstation for academic research, covering nine core techniques, backed by an automated test suite of 177 tests (numerical routines and UI behavior).** *(AI-assisted analysis features are on the roadmap but not yet implemented — see "Known Limitations & Roadmap" below.)*

Labscribber integrates advanced signal processing, multi-technique spectral
visualization, chemometric analysis, and journal-grade export pipelines into
a single application for UV-Vis, FTIR, Raman, NMR (¹H/¹³C/2D COSY), XPS,
photoluminescence, XRD, and electrochemical (CV/EIS) data.

## Run Locally

**Prerequisites:** Node.js ≥ 20.19

1. Install dependencies:
   ```bash
   npm install
   ```
2. Start the development server:
   ```bash
   npm run dev
   ```
3. Open `http://localhost:3000` in your browser.

## Run as a Desktop App (Electron)

```bash
npm run electron:dev
```

## Run Tests

```bash
npm test
```

With a coverage report (`coverage/index.html`):

```bash
npm run test:coverage
```

Every push and pull request runs the full suite on Node 20/22 via
[GitHub Actions](.github/workflows/ci.yml) — see the badge above.

## Build for Production

```bash
npm run build
```

### Desktop installers

`npm run electron:dist` packages Windows / macOS / Linux installers via
electron-builder (output in `dist-desktop/`). The packaging configuration in
`package.json` references `build/icon.ico`, `build/icon.icns`, and
`build/icon.png` (the PNG should be at least 512×512); add these files
before packaging.

See `CONTRIBUTING.md` for the full developer guide, and `docs/SESSION_FORMAT.md`
for the `.lsb` session file format specification.

## Known Limitations & Roadmap

- **Tauc bandgap auto-window selection is noise-sensitive.** The automatic
  window used to extract a bandgap from Tauc-plot data remains sensitive to
  noise even when the manual wavelength-range safeguard is set correctly.
  See the accompanying paper (Section 2.3) for exact figures. Tracked as a
  scoped fix for a future release.
- **AI-assisted analysis is planned, not yet implemented.** The application
  declares a `@google/genai` dependency for a future AI-assisted
  interpretation feature; no such feature is implemented in this version.
- **Validated against synthetic data; real-instrument validation is
  ongoing.** The numerical core has been independently verified against
  synthetic data with known ground truth (see the accompanying paper).
  Validation against real, non-synthetic instrument datasets is in
  progress.

See `CHANGELOG.md` for the full list of what's included in each release.

## Citing LabScribber

If you use LabscribberPro in your research, please cite it using the
metadata in [`CITATION.cff`](CITATION.cff). A draft JOSS submission paper
is also included at `paper.md` / `paper.bib`; it is not yet submitted —
see the `TODO` comment block at the top of `paper.md` for the remaining
steps (ORCID iDs, archived release, etc.) before it is. A separate,
independently-reviewed SoftwareX submission describing this codebase is
in preparation.

---

*Developed at the School of Chemical and Life Sciences, Jamia Hamdard
University, New Delhi, India.*
