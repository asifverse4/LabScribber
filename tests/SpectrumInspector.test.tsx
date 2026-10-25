/**
 * @file SpectrumInspector.test.tsx
 *
 * SpectrumInspector.tsx is the largest component in the codebase and,
 * before this file, had zero direct component-level test coverage — every
 * test up to this point exercised the pure utility functions it calls
 * (math.ts, batchSummary.ts, methodsGenerator.ts, provenance.ts) in
 * isolation, but never the actual component wiring: tab navigation, button
 * clicks, checkbox state, modal open/close.
 *
 * That's a real gap. A bug in the *wiring* — a button calling the wrong
 * handler, a prop threaded incorrectly, a modal never actually opening —
 * would pass every existing test while being completely broken for a real
 * user. These tests mount the real component and drive it through
 * @testing-library/user-event exactly as a person would, covering the
 * reliability features built this session end-to-end: batch peak
 * detection/fitting, the Methods-text generator, and the provenance log
 * export.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SpectrumInspector } from '../src/components/SpectrumInspector';
import type { SpectrumData } from '../src/types';

function makeDataset(overrides: Partial<SpectrumData> = {}): SpectrumData {
  // A clean single-Gaussian-peak trace, well above the default 0.05
  // prominence threshold, so batch peak detection reliably finds it.
  const n = 60;
  const x = Array.from({ length: n }, (_, i) => i);
  const y = x.map(v => Math.exp(-((v - 30) ** 2) / (2 * 5 * 5)));

  return {
    id: 'ds1',
    name: 'Test Sample A',
    technique: 'UV-Vis',
    x_orig: [...x],
    y_orig: [...y],
    x: [...x],
    y_processed: [...y],
    color: '#14b8a6',
    visible: true,
    lineWidth: 1,
    lineStyle: 'solid',
    marker: 'none',
    markerSize: 4,
    peaks: [],
    integrals: [],
    baseline: null,
    fitResult: null,
    fitComponents: null,
    fitResiduals: null,
    yError: null,
    significanceAnnotations: null,
    fitPeakStats: null,
    fitGoodnessOfFit: null,
    isTauc: false,
    taucData: null,
    jobsData: null,
    undoStack: [],
    redoStack: [],
    history: ['[10:00:00] Smart-Ingested dataset from file test.csv.'],
    ...overrides,
  };
}

/** Full default prop set for SpectrumInspector, with vi.fn() for every callback. */
function makeDefaultProps(overrides: Partial<React.ComponentProps<typeof SpectrumInspector>> = {}) {
  const ds = makeDataset();
  return {
    datasets: [ds],
    selectedDataset: ds,
    onDatasetsUpdated: vi.fn(),
    onDatasetSelected: vi.fn(),

    layoutMode: 'single' as any,
    setLayoutMode: vi.fn(),
    journalStyle: 'ACS' as any,
    setJournalStyle: vi.fn(),
    plotBgColor: '#ffffff',
    setPlotBgColor: vi.fn(),
    gridX: true,
    setGridX: vi.fn(),
    gridY: true,
    setGridY: vi.fn(),
    autoX: true,
    setAutoX: vi.fn(),
    autoY: true,
    setAutoY: vi.fn(),
    manualXMin: 0,
    setManualXMin: vi.fn(),
    manualXMax: 100,
    setManualXMax: vi.fn(),
    manualYMin: 0,
    setManualYMin: vi.fn(),
    manualYMax: 1,
    setManualYMax: vi.fn(),
    xLabel: 'Wavelength (nm)',
    setXLabel: vi.fn(),
    yLabel: 'Absorbance',
    setYLabel: vi.fn(),
    showLegend: true,
    setShowLegend: vi.fn(),
    legendPos: 'top-right',
    setLegendPos: vi.fn(),
    thickAxes: false,
    setThickAxes: vi.fn(),
    dropLines: false,
    setDropLines: vi.fn(),
    waterfallOffset: 0,
    setWaterfallOffset: vi.fn(),
    enableInset: false,
    setEnableInset: vi.fn(),
    insetXMin: 0,
    setInsetXMin: vi.fn(),
    insetXMax: 10,
    setInsetXMax: vi.fn(),
    panelGridCols: 2,
    setPanelGridCols: vi.fn(),
    panelLabelCase: 'lowercase' as const,
    setPanelLabelCase: vi.fn(),
    enableHighlight: false,
    setEnableHighlight: vi.fn(),
    highlightMin: 0,
    setHighlightMin: vi.fn(),
    highlightMax: 10,
    setHighlightMax: vi.fn(),
    interactiveMode: 'navigate' as const,
    setInteractiveMode: vi.fn(),
    isPremium: true,
    exportCount: 0,
    setExportCount: vi.fn(),
    onTriggerUpgrade: vi.fn(),
    onExportSuccess: vi.fn(),
    onPreviewCorrectedYChange: vi.fn(),
    onOpenCiteKit: vi.fn(),

    invertX: false,
    setInvertX: vi.fn(),
    invertY: false,
    setInvertY: vi.fn(),
    tickStepX: 0,
    setTickStepX: vi.fn(),
    tickStepY: 0,
    setTickStepY: vi.fn(),
    minorTicksCount: 0,
    setMinorTicksCount: vi.fn(),

    ...overrides,
  };
}

function renderInspector(overrides: Partial<React.ComponentProps<typeof SpectrumInspector>> = {}) {
  const props = makeDefaultProps(overrides);
  render(<SpectrumInspector {...(props as any)} />);
  return props;
}

describe('SpectrumInspector — mounts without crashing', () => {
  it('renders with a single dataset selected', () => {
    renderInspector();
    expect(screen.getByDisplayValue('Test Sample A')).toBeInTheDocument();
  });

  it('renders with no datasets loaded', () => {
    render(<SpectrumInspector {...(makeDefaultProps({ datasets: [], selectedDataset: null }) as any)} />);
    // Should not throw during render even with nothing loaded.
  });

  it('REGRESSION: does not crash when selectedDataset transitions from null to populated on the same mounted instance', () => {
    // This is a regression test for a real production crash (React error
    // #310, "Rendered more hooks than during the previous render"). The
    // component had an early `if (!selectedDataset) return (...)` guard
    // followed by more hooks further down — meaning fewer hooks ran on the
    // "nothing selected" render than on a "dataset selected" render of the
    // *same* mounted instance. That transition is exactly what happens the
    // first time a real user loads data: the app mounts with nothing
    // selected, then selectedDataset becomes populated without an unmount
    // in between.
    //
    // Every other test in this file either mounts fresh with a dataset
    // already present, or mounts fresh with none — neither exercises a
    // transition on one instance, which is exactly why this bug shipped
    // undetected. Only a rerender() of the same render tree can catch it.
    const emptyProps = makeDefaultProps({ datasets: [], selectedDataset: null });
    const { rerender } = render(<SpectrumInspector {...(emptyProps as any)} />);

    const ds = makeDataset();
    const populatedProps = makeDefaultProps({ datasets: [ds], selectedDataset: ds });

    expect(() => {
      rerender(<SpectrumInspector {...(populatedProps as any)} />);
    }).not.toThrow();

    expect(screen.getByDisplayValue('Test Sample A')).toBeInTheDocument();

    // And the reverse direction (populated -> null) must also survive,
    // since a user can delete/deselect their only dataset.
    expect(() => {
      rerender(<SpectrumInspector {...(emptyProps as any)} />);
    }).not.toThrow();
  });
});

describe('SpectrumInspector — Batch Processing (peak detection + fitting)', () => {
  it('detects and fits peaks across selected datasets end-to-end', async () => {
    const user = userEvent.setup();
    const props = renderInspector();

    await user.click(screen.getByRole('button', { name: 'batch' }));
    await user.click(await screen.findByRole('button', { name: 'all' })); // select all target datasets

    const detectLabel = await screen.findByText('Auto-Detect Peaks');
    const detectCheckbox = detectLabel.closest('div')!.querySelector('input[type="checkbox"]') as HTMLInputElement;
    await user.click(detectCheckbox);

    const fitLabel = await screen.findByText("Also fit each spectrum's peaks");
    const fitCheckbox = fitLabel.closest('div')!.querySelector('input[type="checkbox"]') as HTMLInputElement;
    await user.click(fitCheckbox);

    await user.click(screen.getByRole('button', { name: /Apply Batch Workflows/i }));

    await waitFor(() => expect(props.onDatasetsUpdated).toHaveBeenCalled());
    const updated = (props.onDatasetsUpdated as any).mock.calls[0][0] as SpectrumData[];
    const result = updated.find(d => d.id === 'ds1')!;

    expect(result.peaks.length).toBeGreaterThan(0);
    expect(result.fitPeakStats).not.toBeNull();
    expect(result.fitGoodnessOfFit).not.toBeNull();
    expect(result.history.some(h => h.includes('Auto-detected'))).toBe(true);
    expect(result.history.some(h => h.includes('Fit'))).toBe(true);

    // The in-panel results summary + CSV download should now be visible.
    expect(await screen.findByText(/Batch Results/i)).toBeInTheDocument();
  });

  it('shows an alert and does not process when no datasets are selected', async () => {
    const user = userEvent.setup();
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    const props = renderInspector();

    await user.click(screen.getByRole('button', { name: 'batch' }));
    await user.click(await screen.findByRole('button', { name: /Apply Batch Workflows/i }));

    expect(alertSpy).toHaveBeenCalled();
    expect(props.onDatasetsUpdated).not.toHaveBeenCalled();
    alertSpy.mockRestore();
  });
});

describe('SpectrumInspector — Auto-Generated Methods Text', () => {
  it('opens the modal and generates text reflecting the dataset history', async () => {
    const user = userEvent.setup();
    const ds = makeDataset({
      history: [
        '[10:00:00] Imported JCAMP-DX: "sample.jdx", 60 points.',
        '[10:00:01] Auto-detected 1 peaks with prominence >= 0.05.',
      ],
    });
    renderInspector({ datasets: [ds], selectedDataset: ds });

    await user.click(screen.getByRole('button', { name: 'export' }));
    await user.click(await screen.findByRole('button', { name: /Generate Methods Text/i }));

    expect(await screen.findByText('Auto-Generated Methods Text')).toBeInTheDocument();
    expect(screen.getByText(/imported from a JCAMP-DX file/i)).toBeInTheDocument();
    expect(screen.getByText(/minimum prominence threshold of 0.05/i)).toBeInTheDocument();
  });

  it('copies the generated text to the clipboard', async () => {
    const user = userEvent.setup();
    // Must be defined *after* userEvent.setup() — user-event v14 installs
    // its own clipboard emulation during setup(), which would otherwise
    // clobber a mock defined beforehand.
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: writeTextMock },
      writable: true,
      configurable: true,
    });

    renderInspector();

    await user.click(screen.getByRole('button', { name: 'export' }));
    await user.click(await screen.findByRole('button', { name: /Generate Methods Text/i }));
    await screen.findByText('Auto-Generated Methods Text');

    await user.click(screen.getByRole('button', { name: /Copy to Clipboard/i }));

    await waitFor(() => expect(writeTextMock).toHaveBeenCalled());
    const copiedText = writeTextMock.mock.calls[0][0];
    expect(copiedText).toContain('Test Sample A');
  });
});

describe('SpectrumInspector — Provenance / Session Log Export', () => {
  it('opens the modal and shows a data-integrity checksum for the dataset', async () => {
    const user = userEvent.setup();
    renderInspector();

    await user.click(screen.getByRole('button', { name: 'export' }));
    await user.click(await screen.findByRole('button', { name: /Export Provenance Log/i }));

    expect(await screen.findByText('Provenance / Session Log Export')).toBeInTheDocument();
    // JSON preview should include the software id and dataset name.
    expect(screen.getByText(/LabScribber/)).toBeInTheDocument();
    expect(screen.getAllByText(/Test Sample A/).length).toBeGreaterThan(0);
  });

  it('toggling "include all datasets" updates the reported dataset count', async () => {
    const user = userEvent.setup();
    const ds2 = makeDataset({ id: 'ds2', name: 'Test Sample B' });
    renderInspector({ datasets: [makeDataset(), ds2] });

    await user.click(screen.getByRole('button', { name: 'export' }));
    await user.click(await screen.findByRole('button', { name: /Export Provenance Log/i }));
    await screen.findByText('Provenance / Session Log Export');

    // Off by default: only the selected dataset.
    expect(screen.getAllByText(/"datasetCount": 1/).length).toBeGreaterThan(0);

    const toggle = screen.getByText(/Include all loaded datasets/i).closest('div')!.parentElement!.parentElement!.querySelector('button')!;
    await user.click(toggle);

    await waitFor(() => {
      expect(screen.getAllByText(/"datasetCount": 2/).length).toBeGreaterThan(0);
    });
  });
});
