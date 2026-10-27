# Changelog

All notable changes to LabscribberPro are documented here. Dates use ISO 8601 (YYYY-MM-DD).

## [1.1.1] — 2026-10-27

### Changed
- CI now tests Node 20 and 22; Node 18 is unsupported (jsdom and the Vite React plugin require Node >= 20.19).
- Declared `engines.node >= 20.19.0` in `package.json`.
- Redesigned README with animated graphics.

### Removed
- Unused dependencies: `@google/genai`, `express`, `dotenv`, `@types/express`; duplicate `vite` entry.
- `metadata.json` (leftover AI Studio configuration).

### Added
- `SECURITY.md`, Dependabot configuration, issue templates.

## [1.0.0] — Initial release

Initial public release candidate. This version was independently reviewed
alongside the accompanying SoftwareX submission; see the paper for full
methodological detail. Summary of what's included:

### Core numerical engine (`src/utils/math.ts`, 42 exports; `tests/math.test.ts`, 70 tests)
- Preprocessing: Savitzky-Golay smoothing/derivatives; ALS, Shirley, and
  SNIP baseline correction. ALS uses a banded Cholesky-style solve with a
  tie-safe weight update, independently verified to correctly resolve
  baselines on realistic, sharp-peaked spectra.
- Peak fitting: Gaussian/Lorentzian/Voigt deconvolution via Nelder-Mead
  simplex optimization, with parameter uncertainty from a numerically-
  estimated Jacobian and asymptotic covariance matrix, propagated to FWHM
  and area via the delta method. Independently verified against known
  synthetic ground truth.
- Technique-specific modules: Scherrer crystallite size (independently
  verified to 0.05% against a known synthetic target) and Williamson-Hall
  analysis for XRD; Tauc direct/indirect bandgap extraction with an
  optional manual-range safeguard; Urbach energy; Stern-Volmer quenching;
  Beer-Lambert calibration with LOD/LOQ; Kubelka-Munk transform;
  Mie/Rayleigh scattering subtraction; Kramers-Kronig transform; relative
  PLQY.
- Chemometrics: SVD-PCA, MCR-ALS, PLS (NIPALS) regression, Ward-linkage
  hierarchical clustering, six-metric spectral similarity.
- Statistics and signal processing: Welch's t-test with a genuine
  p-value, replicate error-bar statistics, FFT/PSD/autocorrelation.

### Data handling
- CSV/TXT/XLS/XLSX ingestion with automatic multi-series detection.
- JCAMP-DX ingestion with full ASDF (SQZ/DIF/DUP) pseudo-digit
  decompression per the JCAMP-DX 5.01 specification (22 tests).
- Debounced browser-storage autosave with a size guard and portable
  `.lsb` session export/import (11 tests).
- Batch operations across multiple datasets with a downloadable summary
  table (5 tests).
- Provenance/processing-history logging (11 tests) and an auto-generated
  Methods-paragraph feature that drafts manuscript text directly from a
  dataset's recorded history (16 tests).

### Instrument simulators (13 techniques)
UV-Vis, FTIR, Raman, 1H NMR, 13C NMR, 2D COSY, photoluminescence
(including a 2D PL excitation-emission map), XRD, XPS, cyclic voltammetry
(Butler-Volmer kinetics), EIS (Randles equivalent circuit), EPR/ESR, and
thermogravimetric analysis with multi-rate Kissinger activation-energy
extraction.

### Reporting and export
- Vector (SVG/PDF) export, positioned for journal submission, alongside
  raster (PNG/TIFF) export for presentations.
- Selectable ACS/Nature/RSC/monochromatic figure style presets.
- Job's-method continuous-variation stoichiometry analysis.

### Quality assurance
- 177 automated tests across 10 suites (Vitest): 7 unit-test suites for the
  numerical and utility modules, plus 3 React component-level suites
  (`SpectrumInspector`, `ObjectBrowser`, `KeyboardShortcuts`) covering
  end-to-end UI behavior such as batch peak detection and fitting,
  Methods-text generation, provenance export, file ingestion, and keyboard
  shortcuts.
- GitHub Actions CI: type-check, test, and build, across Node 18/20/22,
  with coverage reporting.

### Release-preparation corrections
- The in-application "Cite & JOSS Kit" generated BibTeX/RIS/APA citations
  that pointed to a repository URL that does not exist
  (`github.com/asifraza/labscribber`) and described the software as
  "AI-Assisted", which is not yet implemented. Citations now point to
  `https://github.com/asifverse4/LabScribber` and no longer make the AI claim.
- `README.md`, `CONTRIBUTING.md`, and `package.json` carried the same stale
  URL and/or claim, and stale test counts; all corrected. `package.json`
  gained `repository`, `homepage`, and `bugs` fields.

### Known limitations (see the accompanying paper for full detail and exact numbers)
- Tauc bandgap auto-window selection remains noise-sensitive even when
  its manual-range safeguard is used correctly (verified: 35% deviation
  unguided, 13% with a correctly-chosen manual range, on a representative
  synthetic case). Not yet fixed; a wider default fitting segment, or an
  R²/linearity check before accepting the auto-detected window, are both
  concrete options for a future release.
- The application declares a `@google/genai` dependency and a
  server-side Gemini API capability in its build metadata, but no
  generative-AI feature is implemented yet. AI-assisted analysis is on the
  roadmap, not yet built.
- The Electron packaging configuration references `build/icon.ico`,
  `build/icon.icns`, and `build/icon.png`, which are not yet present in the
  repository.

## Prior history

[Not tracked before this changelog was introduced. Future releases should
add entries above this line, newest first.]
