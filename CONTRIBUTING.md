# Contributing to Labscribber

Thank you for your interest in contributing! This guide covers everything you need to get the app running, add new features, and submit a pull request.

---

## Table of Contents

1. [Development Setup](#1-development-setup)
2. [Project Structure](#2-project-structure)
3. [Running the App](#3-running-the-app)
4. [Running Tests](#4-running-tests)
5. [How to Add a New Algorithm](#5-how-to-add-a-new-algorithm)
6. [How to Add a New Simulator](#6-how-to-add-a-new-simulator)
7. [How to Add a New UI Panel](#7-how-to-add-a-new-ui-panel)
8. [Code Style](#8-code-style)
9. [Pull Request Checklist](#9-pull-request-checklist)
10. [Reporting Bugs](#10-reporting-bugs)

---

## 1. Development Setup

**Requirements:**
- Node.js ≥ 20.19 (check with `node -v`)
- npm ≥ 9.0 (check with `npm -v`)

```bash
# Clone the repository
git clone https://github.com/asifverse4/LabScribber.git
cd LabScribber

# Install dependencies
npm install

# Start development server (hot reload)
npm run dev
```

The app will be available at `http://localhost:5173`.

**Optional — Electron desktop mode:**
```bash
npm run electron:dev
```

---

## 2. Project Structure

```
src/
├── App.tsx                  # Root layout, session save/load, autosave wiring
├── types.ts                 # All TypeScript interfaces (SpectrumData, result types)
├── components/
│   ├── SpectrumPlot.tsx     # Canvas rendering engine (all visual overlays)
│   ├── SpectrumInspector.tsx# Right-panel: processing, analysis, export tabs
│   ├── ObjectBrowser.tsx    # Left-panel: dataset list + simulator buttons
│   └── CoordinateTables.tsx # Data table viewer
├── data/
│   ├── simulators.ts        # Virtual spectrum generators
│   └── pyExporter.ts        # Generates the standalone Python/Tkinter export script
└── utils/
    ├── math.ts              # Signal processing + analysis algorithms (42 exports)
    ├── jcampParser.ts       # JCAMP-DX parser incl. ASDF (SQZ/DIF/DUP) decompression
    ├── autosave.ts          # Debounced browser-storage autosave + session recovery
    ├── batchSummary.ts      # Batch-operation summary table generation
    ├── provenance.ts        # Processing-history / provenance logging
    ├── methodsGenerator.ts  # Auto-generated Methods-paragraph text
    ├── plotDomain.ts        # Plot axis-domain computation (incl. degenerate-data handling)
    └── colors.ts            # Colour palettes / journal style presets

tests/                       # Vitest suites (10 files, 177 tests total)
├── math.test.ts
├── jcampParser.test.ts
├── autosave.test.ts
├── batchSummary.test.ts
├── provenance.test.ts
├── methodsGenerator.test.ts
├── plotDomain.test.ts
├── SpectrumInspector.test.tsx   # React component tests (batch, Methods text, provenance)
├── ObjectBrowser.test.tsx       # React component tests (file ingestion)
└── KeyboardShortcuts.test.tsx   # React component tests (keyboard shortcuts)

public/                      # Static assets
main.cjs                     # Electron main process
preload.cjs                  # Electron preload
splash.html                  # Electron splash screen
```

---

## 3. Running the App

| Command | Description |
|---------|-------------|
| `npm run dev` | Development server with HMR |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Preview production build |
| `npm run electron:dev` | Electron + Vite dev mode |
| `npm run electron:build` | Package Electron app |

---

## 4. Running Tests

```bash
# Run all tests once
npx vitest run

# Watch mode (re-runs on file change)
npx vitest

# Coverage report
npx vitest run --coverage
```

Tests live in `tests/` (10 suites, 177 tests in total). `tests/math.test.ts` covers the numerical routines exported from `src/utils/math.ts`; the other unit suites cover the JCAMP-DX parser, autosave, batch summaries, provenance logging, Methods-text generation, and plot-domain computation; the three `.test.tsx` suites are React component tests covering end-to-end UI behavior (batch peak detection and fitting, Methods-text generation, provenance export, file ingestion, and keyboard shortcuts). All tests must pass before a PR is merged.

**Adding a new test:**
1. Open `tests/math.test.ts`
2. Add a new `describe` block for your function
3. Include at least: identity/trivial case, known-output case, error/edge case

---

## 5. How to Add a New Algorithm

All algorithms live in `src/utils/math.ts`. The module is pure TypeScript with zero runtime dependencies — keep it that way.

**Steps:**

1. **Add result interface to `src/types.ts`:**
```typescript
export interface MyAlgorithmResult {
  value: number;
  r2: number;
  // ...
}
```

2. **Write the function in `math.ts`:**
```typescript
/**
 * Brief description.
 * @param x  Input array description
 * @returns  MyAlgorithmResult
 *
 * Reference: Author, Journal, Year, DOI
 */
export function myAlgorithm(x: number[]): MyAlgorithmResult {
  // implementation
  return { value: ..., r2: ... };
}
```

3. **Add at least 3 tests in `tests/math.test.ts`:**
   - One trivial/identity case
   - One known-output case (pre-compute with Python/SciPy)
   - One edge/error case

4. **Export the type in `types.ts` and the function is automatically available.**

---

## 6. How to Add a New Simulator

Simulators are dataset factories in `src/data/simulators.ts`.

```typescript
export function simulateMyTechnique(index: number): SpectrumData {
  const x: number[] = [];
  const y: number[] = [];

  // ... generate x and y arrays ...

  return {
    id:          `sim-mytechnique-${Date.now()}-${index}`,
    name:        `My Technique [Sample-${index}]`,
    technique:   'My Technique',
    x_orig:      [...x],
    y_orig:      [...y],
    x:           [...x],
    y_processed: [...y],
    color:       '#38bdf8',
    visible:     true,
    lineWidth:   1.5,
    lineStyle:   'solid',
    marker:      'none',
    markerSize:  4,
    peaks: [], integrals: [], baseline: null,
    fitResult: null, fitComponents: null, fitResiduals: null,
    fitPeakStats: null, fitGoodnessOfFit: null,
    isTauc: false, taucData: null, jobsData: null,
    undoStack:   [[...y]],
    redoStack:   [],
    history:     [`[${new Date().toLocaleTimeString()}] My technique simulated.`]
  };
}
```

Then add a button in `src/components/ObjectBrowser.tsx`:
1. Import the new simulator
2. Add `'mytechnique'` to the `handleLoadSim` type union
3. Add a `case 'mytechnique':` to the switch
4. Add a `<button onClick={() => handleLoadSim('mytechnique')}>` in the grid

---

## 7. How to Add a New UI Panel

All analysis panels live in `src/components/SpectrumInspector.tsx`.

1. Add state variables near the top of the component (look for the `// ── Tier-N` blocks)
2. Import your function from `math.ts` and your result type from `types.ts`
3. Add your panel JSX in the analyze tab, following the existing panel pattern:
   - Dark card wrapper: `<div className="bg-[#09090b] p-3 rounded border ...">`
   - Header row with label + equation
   - Description paragraph
   - Input fields
   - Action button
   - Result cards grid
   - Literature citation
4. If your result should render on the canvas, add an overlay block in `SpectrumPlot.tsx`
   (look for the `// ── Tier-N` canvas sections)

---

## 8. Code Style

- **TypeScript strict mode** — no `any` unless casting canvas/DOM APIs
- **No external runtime dependencies** in `math.ts` — pure TypeScript only
- **JSDoc** on every exported function: description, `@param`, `@returns`, `Reference:`
- **Tailwind CSS** for all styling (no inline `style={}` except for dynamic values like colors/widths)
- **Functional React** components only — no class components
- **Named exports** everywhere (no default exports except `App`)
- Keep `math.ts` functions **pure** — no side effects, no DOM access

---

## 9. Pull Request Checklist

Before opening a PR, confirm:

- [ ] `npm run build` succeeds with no TypeScript errors
- [ ] `npx vitest run` passes all tests (zero failures)
- [ ] New algorithms have JSDoc with a literature reference
- [ ] New algorithms have ≥ 3 tests in `math.test.ts`
- [ ] New `SpectrumData` factories include all required fields (see template above)
- [ ] No new runtime dependencies added to `math.ts`
- [ ] PR description explains what the contribution adds and links to the relevant paper

---

## 10. Reporting Bugs

Open a GitHub Issue with:
- Labscribber version (see top of `App.tsx`)
- Browser + OS
- Steps to reproduce
- Expected vs actual behaviour
- Console errors (F12 → Console)

For algorithm correctness issues, include the dataset or parameters that produce wrong results.

---

*Labscribber is developed at Jamia Hamdard University, New Delhi, India.*
*We welcome contributions from researchers worldwide.*
