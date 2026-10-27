/**
 * @file ObjectBrowser.test.tsx
 * Component tests for ObjectBrowser — specifically targeting the file
 * import / "Smart Ingestion Parser" path, since this is exactly where two
 * genuine production bugs were found and fixed during development against
 * a real uploaded instrument data file (a Cu-QD UV-Vis titration series
 * with 16 columns, two of which were shorter than the rest).
 *
 * Prior to the fix, a CSV/Excel file with even one shorter trailing column
 * (e.g. a secondary scan recorded over a smaller wavelength range, pasted
 * into a sheet that already had a longer wavelength axis) could silently
 * corrupt every other column's data alignment, or drop ~60% of otherwise
 * valid rows entirely. These tests render the real component and simulate
 * a real file upload through the actual file input, rather than testing a
 * reimplementation of the import logic in isolation — this is the only way
 * to catch a regression in the genuine code path that broke before.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ObjectBrowser } from '../src/components/ObjectBrowser';
import type { SpectrumData } from '../src/types';

function renderObjectBrowser(onDatasetsUpdated = vi.fn(), onDatasetSelected = vi.fn()) {
  render(
    <ObjectBrowser
      datasets={[]}
      selectedDataset={null}
      onDatasetSelected={onDatasetSelected}
      onDatasetsUpdated={onDatasetsUpdated}
    />
  );
  return { onDatasetsUpdated, onDatasetSelected };
}

/** Locates the hidden file input used for CSV/TXT/Excel ingestion. */
function getIngestFileInput(): HTMLInputElement {
  const input = document.querySelector('input[type="file"][accept*=".csv"]');
  if (!input) throw new Error('Could not find the Smart Ingestion file input.');
  return input as HTMLInputElement;
}

describe('ObjectBrowser — Smart Ingestion Parser', () => {
  it('renders the ingestion button and hidden file input', () => {
    renderObjectBrowser();
    expect(screen.getByText(/Ingest File/i)).toBeInTheDocument();
    expect(getIngestFileInput()).toBeInTheDocument();
  });

  it('imports a clean, fully-rectangular CSV into one dataset per column', async () => {
    const { onDatasetsUpdated } = renderObjectBrowser();
    const csv = [
      'Wavelength,SampleA,SampleB',
      '400,0.10,0.20',
      '450,0.30,0.40',
      '500,0.50,0.60',
    ].join('\n');
    const file = new File([csv], 'clean.csv', { type: 'text/csv' });

    const input = getIngestFileInput();
    await userEvent.upload(input, file);

    await waitFor(() => expect(onDatasetsUpdated).toHaveBeenCalled(), { timeout: 3000 });
    const datasets = onDatasetsUpdated.mock.calls[0][0] as SpectrumData[];

    expect(datasets).toHaveLength(2); // SampleA + SampleB, one dataset per non-x column
    expect(datasets[0].x).toEqual([400, 450, 500]);
    expect(datasets[0].y_processed).toEqual([0.10, 0.30, 0.50]);
    expect(datasets[1].y_processed).toEqual([0.20, 0.40, 0.60]);
  });

  it('regression test: a ragged (shorter) trailing column does not corrupt or truncate the other columns', async () => {
    // Recreates the exact real-world shape that broke before the fix:
    // a normal-length column (SampleA, full range) alongside a column
    // that runs out partway through (ShortScan, ends early) — mirroring
    // the real Cu-QD file's "lemon grass" columns that were shorter than
    // the other 13 titration series sharing the same sheet.
    const { onDatasetsUpdated } = renderObjectBrowser();
    const csv = [
      'Wavelength,SampleA,ShortScan',
      '400,0.10,0.05',
      '450,0.30,0.15',
      '500,0.50,0.25',
      '550,0.70,',   // ShortScan ends here — SampleA continues
      '600,0.90,',
    ].join('\n');
    const file = new File([csv], 'ragged.csv', { type: 'text/csv' });

    const input = getIngestFileInput();
    await userEvent.upload(input, file);

    await waitFor(() => expect(onDatasetsUpdated).toHaveBeenCalled(), { timeout: 3000 });
    const datasets = onDatasetsUpdated.mock.calls[0][0] as SpectrumData[];

    const sampleA = datasets.find(d => d.name.includes('SampleA'));
    const shortScan = datasets.find(d => d.name.includes('ShortScan'));

    expect(sampleA).toBeDefined();
    expect(shortScan).toBeDefined();

    // The critical regression check: SampleA must retain ALL 5 points
    // across the full wavelength range, not be truncated to match
    // ShortScan's shorter length — this is exactly what broke before
    // the fix (the real file lost ~60% of valid rows this way).
    expect(sampleA!.x).toEqual([400, 450, 500, 550, 600]);
    expect(sampleA!.y_processed).toEqual([0.10, 0.30, 0.50, 0.70, 0.90]);

    // ShortScan should retain only its own genuinely valid points,
    // correctly paired with their matching wavelengths — not padded
    // with fabricated zeros, and not misaligned against SampleA's axis.
    expect(shortScan!.x).toEqual([400, 450, 500]);
    expect(shortScan!.y_processed).toEqual([0.05, 0.15, 0.25]);
  });

  it('skips comment lines (# prefix) when parsing CSV', async () => {
    const { onDatasetsUpdated } = renderObjectBrowser();
    const csv = [
      '# Instrument: Test Spectrometer',
      '# Operator: A.Raza',
      'Wavelength,Sample',
      '400,0.1',
      '450,0.2',
    ].join('\n');
    const file = new File([csv], 'commented.csv', { type: 'text/csv' });

    const input = getIngestFileInput();
    await userEvent.upload(input, file);

    await waitFor(() => expect(onDatasetsUpdated).toHaveBeenCalled(), { timeout: 3000 });
    const datasets = onDatasetsUpdated.mock.calls[0][0] as SpectrumData[];

    expect(datasets).toHaveLength(1);
    expect(datasets[0].x).toEqual([400, 450]);
  });

  it('does not call onDatasetsUpdated for a file with no valid numeric rows', async () => {
    const { onDatasetsUpdated } = renderObjectBrowser();
    const csv = 'just,some,header,text\nno,numeric,data,here';
    const file = new File([csv], 'empty.csv', { type: 'text/csv' });

    const input = getIngestFileInput();
    await userEvent.upload(input, file);

    // Give the async file-read a moment to settle either way
    await new Promise(r => setTimeout(r, 100));
    expect(onDatasetsUpdated).not.toHaveBeenCalled();
  });

  it('rejects Infinity/-Infinity tokens rather than letting them poison the dataset', async () => {
    // Number("Infinity") and Number("-Infinity") both parse successfully
    // and are not NaN, so a plain isNaN() guard alone lets them through —
    // this is a regression test for the isFinite() hardening fix.
    const { onDatasetsUpdated } = renderObjectBrowser();
    const csv = [
      'Wavelength,Sample',
      '400,0.10',
      '450,Infinity',
      '500,0.50',
      '550,-Infinity',
      '600,0.90',
    ].join('\n');
    const file = new File([csv], 'infinity.csv', { type: 'text/csv' });

    const input = getIngestFileInput();
    await userEvent.upload(input, file);

    await waitFor(() => expect(onDatasetsUpdated).toHaveBeenCalled(), { timeout: 3000 });
    const datasets = onDatasetsUpdated.mock.calls[0][0] as SpectrumData[];

    // The Infinity/-Infinity rows should be dropped for this column, not
    // included as non-finite y-values.
    expect(datasets[0].y_processed.every(v => isFinite(v))).toBe(true);
    expect(datasets[0].y_processed).toEqual([0.10, 0.50, 0.90]);
    expect(datasets[0].x).toEqual([400, 500, 600]);
  });
});
