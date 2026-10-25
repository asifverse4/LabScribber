/**
 * @license
 * SPDX-License-Identifier: MIT
 */

import { SpectrumData } from '../types';

/**
 * Auto-generated "Methods" text.
 *
 * Every processing action a user performs on a dataset (smoothing, baseline
 * correction, peak fitting, Tauc extrapolation, statistical tests, etc.) is
 * already logged verbatim into `SpectrumData.history` as it happens. This
 * module re-parses that log — the single source of truth for what was
 * actually done to the data — and rewrites each entry as a full academic
 * sentence in passive, third-person voice, suitable for pasting directly
 * into a manuscript's Materials & Methods section.
 *
 * Design notes:
 *  - Purely reads `history`; it never re-derives numbers, so the generated
 *    text always matches what the user actually did (no double bookkeeping).
 *  - Unrecognised or non-scientific log entries (undo/redo, UI recalibration,
 *    interactive peak placement) are silently skipped rather than guessed at.
 *  - Output is intentionally conservative — it is a first draft for the
 *    author to review and lightly edit, not a final, publication-ready
 *    sentence with zero human oversight.
 */

const TIMESTAMP_RE = /^\[[^\]]*\]\s*/;

function stripTimestamp(log: string): string {
  return log.replace(TIMESTAMP_RE, '').trim();
}

function stripTrailingPeriod(s: string): string {
  return s.trim().replace(/\.$/, '');
}

function joinList(parts: string[]): string {
  if (parts.length === 1) return parts[0];
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
  return `${parts.slice(0, -1).join(', ')}, and ${parts[parts.length - 1]}`;
}

function describeSmooth(raw: string): string {
  const s = raw.trim();
  if (s.startsWith('Savitzky-Golay')) {
    return `a Savitzky\u2013Golay filter ${s.replace('Savitzky-Golay', '').trim()}`.trim();
  }
  if (s.startsWith('Moving Average')) {
    return `a moving-average filter ${s.replace('Moving Average', '').trim()}`.trim();
  }
  return s;
}

function describeBaseline(raw: string): string {
  const s = raw.trim();
  if (s.startsWith('ALS')) {
    return `an asymmetric least squares (ALS) algorithm ${s.replace('ALS', '').trim()}`.trim();
  }
  if (s === 'Shirley') return 'a Shirley background subtraction';
  if (s === 'SNIP') return 'a SNIP (Statistics-sensitive Non-linear Iterative Peak-clipping) algorithm';
  return s;
}

type Matcher = {
  re: RegExp;
  fmt: (m: RegExpMatchArray) => string | null;
};

const MATCHERS: Matcher[] = [
  // ── Data ingestion ───────────────────────────────────────────────
  {
    re: /^Imported JCAMP-DX: "(.+)", (\d+) points\.$/,
    fmt: (m) => `Data were imported from a JCAMP-DX file ("${m[1]}", ${m[2]} data points).`,
  },
  {
    re: /^Smart-Ingested dataset from file (.+)\.$/,
    fmt: (m) => `Raw data were ingested from the source file "${m[1]}".`,
  },
  {
    re: /^(Generated virtual|Simulated) (.+)\.$/,
    fmt: (m) => `A simulated reference spectrum (${m[2]}) was generated in silico for benchmarking/validation.`,
  },
  {
    re: /^Geometries compiled: simulated (.+)\.$/,
    fmt: (m) => `A simulated reference spectrum (${m[1]}) was compiled.`,
  },

  // ── Signal processing ────────────────────────────────────────────
  {
    re: /^Applied multi-step processing: \(Smoothing: (.+), Baseline: (.+), Norm: (.+)\)$/,
    fmt: (m) => {
      const parts: string[] = [];
      if (m[1] !== 'None') parts.push(`smoothed using ${describeSmooth(m[1])}`);
      if (m[2] !== 'None') parts.push(`baseline-corrected using ${describeBaseline(m[2])}`);
      if (m[3] !== 'None') parts.push(`normalized (${m[3]})`);
      if (parts.length === 0) return null;
      return `The spectrum was ${joinList(parts)}.`;
    },
  },
  {
    re: /^Batch processed: \(Smooth: (.+), Baseline: (.+), Norm: (.+), BaseSrc: (.+)\)$/,
    fmt: (m) => {
      const parts: string[] = [];
      if (m[1] !== 'None') parts.push(`smoothed using ${describeSmooth(m[1])}`);
      if (m[2] !== 'None') parts.push(`baseline-corrected using ${describeBaseline(m[2])}`);
      if (m[3] !== 'None') parts.push(`normalized (${m[3]})`);
      if (parts.length === 0) return null;
      const src = m[4] === 'raw_orig' ? 'the original raw trace' : 'the previously processed trace';
      return `Using an automated batch pipeline applied from ${src}, the spectrum was ${joinList(parts)}.`;
    },
  },
  {
    re: /^Mie\/Rayleigh scatter subtracted: \u03b1=([\d.]+), R\u00b2=([\d.]+)$/,
    fmt: (m) => `A Mie/Rayleigh scattering background was subtracted using a power-law model (\u03b1 = ${m[1]}, R\u00b2 = ${m[2]}).`,
  },

  // ── Peak analysis ────────────────────────────────────────────────
  {
    re: /^Auto-detected (\d+) peaks with prominence >= ([\d.]+)\.$/,
    fmt: (m) => `Peaks were identified automatically using a minimum prominence threshold of ${m[2]}, yielding ${m[1]} candidate peak(s).`,
  },
  {
    re: /^Fit (\d+) (Gaussian|Lorentzian|Voigt) components\. R\u00b2=([\d.]+), \u03c7\u00b2_r=([\deE.+-]+), RMSE=([\deE.+-]+)\.( Param\. SE via covariance\.)?$/,
    fmt: (m) => {
      const uncertaintyClause = m[6]
        ? ' Parameter standard errors were estimated from the asymptotic covariance matrix of the fit (\u03c3\u0302\u00b2\u00b7(J\u1d40J)\u207b\u00b9) and propagated to FWHM and area via the delta method.'
        : '';
      return `Multi-component peak deconvolution was performed using ${m[1]} ${m[2].toLowerCase()} line-shape function(s) (R\u00b2 = ${m[3]}, reduced \u03c7\u00b2 = ${m[4]}, RMSE = ${m[5]}).${uncertaintyClause}`;
    },
  },

  // ── Optical/electronic structure ─────────────────────────────────
  {
    re: /^Executed semiconductor Tauc Plot \((direct|indirect)\)(.*)\. Eg Extrapolation = ([\d.]+) eV\.$/,
    fmt: (m) => {
      const clause = m[2] && m[2].trim() ? `, ${m[2].trim()}` : '';
      return `The optical band gap was estimated by Tauc extrapolation assuming a ${m[1]} allowed transition${clause}, giving Eg = ${m[3]} eV.`;
    },
  },
  {
    re: /^(?:Constructed continuous variation Stoichiometry Job's Plot at target|Calculated Job's Method stoichiometry plot at target coordinate) ([\d.]+)(?: nm)?\.? ?(?:Intercept mole fraction =|Peak intercept at mole fraction X =) ([\d.]+)\.$/,
    fmt: (m) => `Binding stoichiometry was determined by Job's method of continuous variation at ${m[1]} nm, giving an intercept mole fraction of X = ${m[2]}.`,
  },

  // ── Statistics ────────────────────────────────────────────────────
  {
    re: /^Replicate statistics computed across (\d+) datasets \((SD|SEM) error bars\)\. Mean trace \+ error bars applied\.$/,
    fmt: (m) => `Replicate measurements (n = ${m[1]}) were averaged, and uncertainty was expressed as ${m[2] === 'SD' ? 'standard deviation' : 'standard error of the mean'} error bars.`,
  },
  {
    re: /^Welch's t-test\s*(\(.+\))?: t=([\d.-]+), df=([\d.]+), p=([\deE.+-]+) \((ns|\*|\*\*|\*\*\*)\)\.$/,
    fmt: (m) => `Statistical significance between conditions was assessed using Welch's unequal-variances t-test (t = ${Number(m[2]).toFixed(3)}, df = ${Number(m[3]).toFixed(1)}, p = ${m[4]}, ${m[5]}).`,
  },

  // ── Electrochemistry / spectroscopy simulations ──────────────────
  {
    re: /^Butler[\u2013-]Volmer CV simulated: E\u00b0=([\d.]+)V, \u03bd=([\d.]+) ?V\/s, n=(\d+)\.?$/,
    fmt: (m) => `Cyclic voltammetry was simulated using the Butler\u2013Volmer formalism (E\u00b0 = ${m[1]} V, scan rate \u03bd = ${m[2]} V s\u207b\u00b9, n = ${m[3]} electron(s)).`,
  },
  {
    re: /^Randles( circuit)? EIS: Rs=(\d+)\u03a9, Rct=(\d+)\u03a9, Cdl=(.+)$/,
    fmt: (m) => `Electrochemical impedance spectra were simulated using a Randles equivalent circuit (Rs = ${m[2]} \u03a9, Rct = ${m[3]} \u03a9, Cdl = ${stripTrailingPeriod(m[4])}).`,
  },
  {
    re: /^EPR( X-band)? simulated: g=([\d.]+), B\u2080=([\d.]+) ?mT(?:, \u0394B=([\d.]+) ?mT)?\.?$/,
    fmt: (m) => `EPR spectra were simulated (g = ${m[2]}, B\u2080 = ${m[3]} mT${m[4] ? `, linewidth \u0394B = ${m[4]} mT` : ''}).`,
  },
  {
    re: /^EI mass spectrum: (.+), M\u207a=([\d.]+)$/,
    fmt: (m) => `An EI mass spectrum was simulated for ${m[1]} (M\u207a = ${m[2]}).`,
  },
  {
    re: /^TGA simulated: (\d+) decomposition steps$/,
    fmt: (m) => `Thermogravimetric decomposition was simulated across ${m[1]} mass-loss step(s).`,
  },
  {
    re: /^TGA (\d+)-step decomposition: (.+), total loss ([\d.]+)%\.$/,
    fmt: (m) => `Thermogravimetric analysis was simulated as a ${m[1]}-step decomposition (${m[2]}, total mass loss = ${m[3]}%).`,
  },
];

/**
 * Parses a single dataset's history log into methods-relevant sentences,
 * skipping entries that are purely UI bookkeeping (undo/redo, technique
 * relabelling, interactive point placement) or don't match a known pattern.
 */
function historyToSentences(history: string[]): string[] {
  const sentences: string[] = [];
  for (const raw of history) {
    const stripped = stripTimestamp(raw);
    for (const { re, fmt } of MATCHERS) {
      const m = stripped.match(re);
      if (m) {
        const sentence = fmt(m);
        if (sentence) sentences.push(sentence);
        break;
      }
    }
  }
  return sentences;
}

/**
 * Generates a Methods paragraph for one dataset.
 */
export function generateDatasetMethods(sd: SpectrumData): string {
  const sentences = historyToSentences(sd.history);

  if (sd.integrals.length > 0) {
    sentences.push(
      `Peak area(s) were calculated by trapezoidal numerical integration over ${sd.integrals.length} user-defined region${sd.integrals.length > 1 ? 's' : ''}.`
    );
  }

  const xMin = sd.x.length ? Math.min(...sd.x) : 0;
  const xMax = sd.x.length ? Math.max(...sd.x) : 0;
  const intro = `${sd.technique} data for "${sd.name}" (${sd.x.length} data points, range ${xMin.toFixed(1)}\u2013${xMax.toFixed(1)}) were processed and analyzed using LabScribber.`;

  if (sentences.length === 0) {
    return `${intro} No further processing steps were recorded for this dataset; values reflect the raw imported/generated trace.`;
  }
  return `${intro} ${sentences.join(' ')}`;
}

/**
 * Generates Methods text for one or more datasets. A single dataset yields
 * one flowing paragraph; multiple datasets are broken out with a bolded
 * per-sample lead-in so the author can merge or trim as needed.
 */
export function generateMethodsText(datasets: SpectrumData[]): string {
  if (datasets.length === 0) return '';
  if (datasets.length === 1) return generateDatasetMethods(datasets[0]);
  return datasets.map((d) => `**${d.name}.** ${generateDatasetMethods(d)}`).join('\n\n');
}
