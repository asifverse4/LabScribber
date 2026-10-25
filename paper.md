---
title: 'LabScribber: A browser-based, multi-technique spectroscopy workstation for reproducible spectral processing and analysis'
tags:
  - spectroscopy
  - chemometrics
  - peak fitting
  - reproducibility
  - TypeScript
  - chemistry
authors:
  - name: Asif Raza
    orcid: 0000-0000-0000-0000  # TODO: replace with your real ORCID iD (https://orcid.org)
    affiliation: 1
  - name: Huma Basheer
    orcid: 0000-0000-0000-0000  # TODO: replace with your real ORCID iD
    affiliation: 1
affiliations:
  - name: School of Chemical and Life Sciences, Jamia Hamdard University, New Delhi, India
    index: 1
date: 16 July 2026
bibliography: paper.bib
---

<!--
  TODO before submitting to JOSS (https://joss.readthedocs.io/en/latest/submitting.html):
  1. Confirm author list and author order. If Dr. Imran A. Khan's contribution
     meets JOSS's authorship bar (substantial contribution to the software
     itself, not only academic supervision), add him as an author + affiliation.
     If his role was supervisory/advisory only, an Acknowledgements mention
     (see below) is the more accurate place for that credit.
  2. Fill in real ORCID iDs for every author (placeholders above are dummy IDs).
  3. Tag and archive a release (e.g. via Zenodo, which can auto-archive a
     GitHub release and mint a DOI) — JOSS requires an archived version with
     a version number and DOI, separate from the GitHub repo itself.
  4. Add that archival DOI + version number to the JOSS submission form.
  5. Re-check the word count (JOSS wants ~250–1000 words in Summary +
     Statement of Need, excluding this comment block and the bibliography).
-->

# Summary

`LabScribber` is a browser-based spectroscopy workstation for processing,
fitting, and visualizing spectral data across multiple techniques — UV-Vis,
FTIR, Raman, NMR (\(^1\)H/\(^{13}\)C/2D COSY), XPS, photoluminescence, XRD,
and electrochemical (CV/EIS) data — within a single application. It provides
a standard signal-processing pipeline (Savitzky–Golay and moving-average
smoothing, ALS/Shirley/SNIP baseline correction, normalization), interactive
multi-component peak deconvolution (Gaussian, Lorentzian, and pseudo-Voigt
line shapes) with asymptotic parameter uncertainty via the fit's linearized
covariance matrix, batch processing across many datasets at once, and
journal-grade vector figure export. It runs entirely client-side (React 19 /
TypeScript / Vite) with no server-side data transmission, and requires no
installation beyond a modern web browser.

# Statement of need

Multi-technique spectroscopic characterization — a UV-Vis absorption edge,
an FTIR fingerprint region, a Raman shift, an XPS core-level peak — is
routine in materials and analytical chemistry, but the tooling researchers
use to go from raw instrument output to a publication-ready figure is
fragmented. Established commercial packages (e.g. OriginLab, Igor Pro,
vendor-specific suites such as OPUS or LabSpec) are closed-source,
per-seat-licensed, and rarely capture *how* a result was produced beyond
whatever the user manually records — a growing concern as reproducibility
expectations rise across the physical sciences [@baker2016reproducibility].
Open-source alternatives exist, but are largely technique-specific: for
example, `RamanSPy` [@georgiev2024ramanspy] and `PyRamanGUI`
[@brehm2023pyramangui] are excellent, actively maintained tools, but are
scoped to Raman spectroscopy specifically, and (being Python packages or
Python-package-backed GUIs) still require a local Python environment.

`LabScribber` targets students and researchers who work across several
spectroscopic techniques in the course of a single project — a common
pattern in synthesis-and-characterization workflows, e.g. characterizing a
newly synthesized nanomaterial by UV-Vis, FTIR, and XPS in sequence — and
who want that workflow to run with zero local setup while still producing an
auditable, reproducible record of the analysis. Three features in
particular aim at that reproducibility gap directly:

- **Auto-generated Methods text**, which reparses a dataset's own recorded
  processing history (smoothing, baseline correction, peak fitting
  parameters, statistical tests) into a draft Materials & Methods paragraph,
  so the text a reader sees is guaranteed to match the processing that
  actually produced the figure.
- **Parameter uncertainty on fitted peaks**, computed from the asymptotic
  covariance matrix of the nonlinear least-squares fit
  (\(\hat\sigma^2 (J^\top J)^{-1}\)) and propagated to derived quantities
  (FWHM, peak area) via the delta method, rather than reporting point
  estimates alone.
- **A structured provenance/session log** — every processing step,
  timestamped and categorized, plus a data-integrity checksum of the raw
  imported trace — exportable as JSON or a flattened CSV for supplementary
  material.

Import correctness matters just as much as analysis correctness: prior to
this work, `LabScribber`'s JCAMP-DX importer [@mcdonald1988jcampdx] did not
implement the format's SQZ/DIF/DUP pseudo-digit (ASDF) compression scheme
used by the majority of real instrument exports, and separately mis-parsed
each data line's leading X-check value as an additional Y value — both bugs
silently corrupted imported spectra rather than raising an error. Both were
identified and fixed as part of hardening the import pipeline, alongside
defensive handling of degenerate or non-finite data in the plotting domain
computation (e.g. a single-point dataset, or a NaN/Infinity value from an
upstream processing error) that previously could silently blank the plot.

# Functionality

Beyond signal processing and peak fitting, `LabScribber` includes
technique-specific analyses (Tauc band-gap extrapolation, Job's-method
binding stoichiometry, Scherrer/Williamson–Hall crystallite size, Stern–Volmer
quenching, Kubelka–Munk transforms, PCA/MCR-ALS/PLS chemometrics), replicate
statistics with Welch's t-test annotations, multi-panel journal-style figure
composition with colorblind-safe palettes, and vector PDF/SVG export via
`jsPDF`/`svg2pdf.js`. Session state persists to a portable `.lsb` JSON file,
with a debounced browser-storage autosave as a crash-recovery safety net.
Signal-processing methods follow established algorithms, including
Savitzky–Golay smoothing [@savitzky1964smoothing] and asymmetric
least-squares baseline correction [@eilers2005baseline].

# Acknowledgements

<!-- TODO: add funding sources, supervisory acknowledgement (e.g. Dr. Imran
     A. Khan, if not listed as a co-author above), and any other academic
     acknowledgements here. -->

# References
