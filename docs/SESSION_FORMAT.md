# Labscribber Session File Format (.lsb)

## Overview

The `.lsb` file is a JSON-based session format that captures the complete
state of a Labscribber analysis session: all loaded datasets (raw and
processed data, peaks, fits, provenance history) plus the global plot and
UI configuration. This enables full reproducibility — anyone who opens the
`.lsb` file sees exactly what you saw, with every processing step intact.

`.lsb` files are plain JSON and can be version-controlled, emailed, or
archived alongside a manuscript as supplementary data.

## File Structure

```json
{
  "version": "1.0.0",
  "savedAt": "2026-06-17T10:32:00.000Z",
  "appState": {
    "layoutMode": "Standard Overlay",
    "journalStyle": "ACS",
    "isDark": true,
    "plotBgColor": "#131316",
    "gridX": true,
    "gridY": true,
    "autoX": true,
    "autoY": true,
    "invertX": false,
    "invertY": false,
    "xLabel": "Wavelength (nm)",
    "yLabel": "Absorbance (a.u.)",
    "showLegend": true,
    "legendPos": "upper right",
    "thickAxes": true,
    "dropLines": true,
    "waterfallOffset": 0.4,
    "manualXMin": 200,
    "manualXMax": 700,
    "manualYMin": 0,
    "manualYMax": 1.2,
    "tickStepX": 0,
    "tickStepY": 0,
    "minorTicksCount": 4,
    "enableInset": false,
    "insetXMin": 250,
    "insetXMax": 420,
    "enableHighlight": false,
    "highlightMin": 310,
    "highlightMax": 380
  },
  "datasets": [
    {
      "id": "sim-uv-...",
      "name": "UV-Vis [Sample-1]",
      "technique": "UV-Vis",
      "x_orig": [200, 201, ...],
      "y_orig": [0.01, 0.02, ...],
      "x": [200, 201, ...],
      "y_processed": [0.01, 0.02, ...],
      "color": "#3b82f6",
      "visible": true,
      "lineWidth": 1.5,
      "lineStyle": "solid",
      "marker": "none",
      "markerSize": 4,
      "peaks": [ { "id": "...", "x": 345, "y": 0.95, "label": "π→π*", "confidence": 0.95, "dx": 0, "dy": 0 } ],
      "integrals": [],
      "baseline": null,
      "fitResult": null,
      "fitComponents": null,
      "fitResiduals": null,
      "fitPeakStats": null,
      "fitGoodnessOfFit": null,
      "isTauc": false,
      "taucData": null,
      "jobsData": null,
      "undoStack": [[0.01, 0.02, ...]],
      "redoStack": [],
      "history": ["[10:15:32] ALS baseline applied: λ=1e5, p=0.01"]
    }
  ],
  "selectedDatasetId": "sim-uv-..."
}
```

## Field Notes

- **`version`** — Session format version. Currently `1.0.0`. Future versions
  will increment this and the loader will apply migrations as needed.
- **`savedAt`** — ISO 8601 timestamp of when the session was saved.
- **`appState`** — All global plot/UI settings. Optional fields fall back to
  app defaults if missing (forward-compatible with older sessions).
- **`datasets`** — Array of complete `SpectrumData` objects. The `undoStack`
  is trimmed to a single entry (the current `y_processed`) on save to keep
  file size manageable; full undo history is not preserved across sessions.
- **`selectedDatasetId`** — Which dataset was active when the session was
  saved; restored as the active dataset on load.

## Loading Behaviour

When a `.lsb` file is loaded:
1. All datasets are restored with their processing history intact (the
   `history` array of log strings is preserved verbatim).
2. Missing optional fields (e.g. from an older or hand-edited file) are
   filled with safe defaults (`null`, `[]`, `false`) rather than causing
   a load failure.
3. If `selectedDatasetId` doesn't match any loaded dataset, the first
   dataset in the array becomes active.
4. A malformed file (missing `version` or `datasets` array) is rejected
   with a clear error message rather than partially loading.

## Compatibility

`.lsb` files are forward-compatible: a session saved by an older version
of Labscribber will load correctly in newer versions, with any new fields
defaulting sensibly. They are not guaranteed backward-compatible — a file
saved by a newer version may contain fields an older version doesn't
recognise (these are simply ignored on load by older clients).

## Use in Publications

Researchers can attach a `.lsb` file as supplementary material alongside
a manuscript. Reviewers and readers with Labscribber installed can load
the exact session — including every baseline correction, peak fit, and
processing parameter — reproducing the published figure from raw data
with full transparency.
