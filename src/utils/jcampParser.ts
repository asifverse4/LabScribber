/**
 * JCAMP-DX import parser.
 *
 * Extracted from App.tsx and hardened. The original inline parser had two
 * confirmed correctness bugs that would silently corrupt real-world files
 * rather than erroring out:
 *
 *  1. Every `##XYDATA=(X++(Y..Y))` line in JCAMP-DX begins with a leading
 *     X-check value (the running X-coordinate, restated at the start of
 *     each line as a validation checkpoint) followed by the line's actual Y
 *     values. The original parser had no concept of this and treated every
 *     token on every line — including that leading X-check — as a Y value.
 *     Since real files always wrap at 80 characters (i.e. always have many
 *     lines), this silently inserted one spurious "Y value" per line and
 *     shifted every subsequent point, corrupting the entire trace.
 *
 *  2. No support for ASDF compression (SQZ / DIF / DUP / DIFDUP), which is
 *     the pseudo-digit encoding scheme almost every real spectrometer
 *     export uses to keep file size down (per JCAMP-DX 5.01 §5, Table 1).
 *     Compressed tokens like "J5" or "E0V" aren't valid input to
 *     `parseFloat`, so they silently evaluated to NaN and were dropped —
 *     meaning a compressed file would "successfully" import as a mostly
 *     empty, wrong-shaped spectrum with no error message at all.
 *
 * Both are fixed here via a proper per-line ASDF decoder. Header values
 * (FIRSTX, LASTX, DELTAX, XFACTOR, YFACTOR, NPOINTS) are also parsed
 * defensively — a malformed or missing header field falls back to a sane
 * default instead of propagating NaN through the entire trace.
 */

// ── ASDF pseudo-digit tables (JCAMP-DX 5.01, Table 1) ───────────────────────
// Cross-checked against the nmrglue and jcamp.py reference implementations.
const SQZ_DIGITS: Record<string, string> = {
  '@': '0', 'A': '1', 'B': '2', 'C': '3', 'D': '4', 'E': '5', 'F': '6', 'G': '7', 'H': '8', 'I': '9',
  'a': '-1', 'b': '-2', 'c': '-3', 'd': '-4', 'e': '-5', 'f': '-6', 'g': '-7', 'h': '-8', 'i': '-9',
};
const DIF_DIGITS: Record<string, string> = {
  '%': '0', 'J': '1', 'K': '2', 'L': '3', 'M': '4', 'N': '5', 'O': '6', 'P': '7', 'Q': '8', 'R': '9',
  'j': '-1', 'k': '-2', 'l': '-3', 'm': '-4', 'n': '-5', 'o': '-6', 'p': '-7', 'q': '-8', 'r': '-9',
};
const DUP_DIGITS: Record<string, number> = {
  S: 1, T: 2, U: 3, V: 4, W: 5, X: 6, Y: 7, Z: 8, s: 9,
};

interface ASDFState {
  lastValue: number; // running absolute Y value (persists across lines — DIF chains span line-wraps)
  lastDelta: number;  // the delta most recently applied (0 for a fresh SQZ/AFFN absolute value)
}

function isDigitChar(c: string): boolean {
  return c >= '0' && c <= '9';
}

/**
 * Decodes the Y-data portion of a single JCAMP-DX ASDF line (i.e. the line
 * with its leading X-check value already stripped) into a flat array of
 * absolute Y values. Handles plain AFFN numbers, SQZ, DIF, and DUP tokens
 * — including mixed within the same line, which real files do.
 *
 * Unknown/stray characters are skipped rather than thrown on, so a single
 * corrupted byte doesn't abort the whole import.
 */
export function decodeASDFLine(remainder: string, state: ASDFState): number[] {
  const out: number[] = [];
  const n = remainder.length;
  let i = 0;

  while (i < n) {
    const c = remainder[i];

    if (c === ' ' || c === '\t' || c === ',') { i++; continue; }

    // ── DUP: repeat the last decoded step so its value appears `count` times total ──
    if (c in DUP_DIGITS) {
      const count = DUP_DIGITS[c];
      for (let k = 1; k < count; k++) {
        state.lastValue += state.lastDelta;
        out.push(state.lastValue);
      }
      i++;
      continue;
    }

    if (c in SQZ_DIGITS || c in DIF_DIGITS) {
      const isDif = c in DIF_DIGITS;
      const table = isDif ? DIF_DIGITS : SQZ_DIGITS;
      let numStr = table[c];
      let j = i + 1;
      while (j < n && (isDigitChar(remainder[j]) || remainder[j] === '.')) { numStr += remainder[j]; j++; }
      if (j < n && (remainder[j] === 'e' || remainder[j] === 'E')) {
        let k = j + 1;
        let exp = remainder[j];
        if (k < n && (remainder[k] === '+' || remainder[k] === '-')) { exp += remainder[k]; k++; }
        while (k < n && isDigitChar(remainder[k])) { exp += remainder[k]; k++; }
        numStr += exp;
        j = k;
      }
      const val = parseFloat(numStr);
      if (!isNaN(val)) {
        if (isDif) {
          state.lastValue += val;
          state.lastDelta = val;
        } else {
          state.lastValue = val;
          state.lastDelta = 0;
        }
        out.push(state.lastValue);
      }
      i = j;
      continue;
    }

    // Plain AFFN number: optional sign, digits, optional decimal point/exponent.
    if (c === '+' || c === '-' || isDigitChar(c) || c === '.') {
      let j = i + 1;
      while (j < n && (isDigitChar(remainder[j]) || remainder[j] === '.')) j++;
      if (j < n && (remainder[j] === 'e' || remainder[j] === 'E')) {
        let k = j + 1;
        if (k < n && (remainder[k] === '+' || remainder[k] === '-')) k++;
        while (k < n && isDigitChar(remainder[k])) k++;
        j = k;
      }
      const numStr = remainder.slice(i, j);
      const val = parseFloat(numStr);
      if (!isNaN(val)) {
        state.lastValue = val;
        state.lastDelta = 0;
        out.push(val);
      }
      i = j;
      continue;
    }

    // Unrecognised character — skip it defensively rather than aborting the import.
    i++;
  }

  return out;
}

const LEADING_AFFN_RE = /^\s*[+-]?\d+\.?\d*(?:[eE][+-]?\d+)?\s*/;

/** Parses a `##XYDATA=(X++(Y..Y))` data line, discarding the leading X-check value. */
function parseXYDataLine(line: string, state: ASDFState): number[] {
  const lead = line.match(LEADING_AFFN_RE);
  if (!lead) return []; // malformed line (no leading X-check) — skip defensively
  const remainder = line.slice(lead[0].length);
  return decodeASDFLine(remainder, state);
}

/** Parses a `##XYPOINTS=(XY..XY)` line: explicit, uncompressed X,Y pairs. */
function parseXYPointsLine(line: string): number[] {
  const tokens = line.replace(/[+]/g, ' +').replace(/(?<!^)-/g, ' -').trim().split(/[\s,]+/).filter(Boolean);
  const vals: number[] = [];
  for (const tok of tokens) {
    const v = parseFloat(tok);
    if (!isNaN(v)) vals.push(v);
  }
  return vals;
}

function safeFloat(str: string | undefined, fallback: number): number {
  if (str === undefined) return fallback;
  const v = parseFloat(str);
  return isFinite(v) ? v : fallback;
}

export interface ParsedJCAMP {
  x: number[];
  y: number[];
  meta: Record<string, string>;
}

/**
 * Parses raw JCAMP-DX text into (x, y) arrays plus the parsed metadata
 * dictionary. Returns null if fewer than 2 usable points could be recovered
 * (mirrors the original behaviour: not enough data to plot a trace).
 *
 * Only the first spectral block is parsed (compound/multi-block LINK files
 * are out of scope) — this covers the overwhelming majority of real-world
 * single-spectrum exports (IR, UV-Vis, Raman, NMR, MS) from instrument
 * software.
 */
export function parseJCAMPDXCore(text: string): ParsedJCAMP | null {
  const lines = text.split(/\r?\n/);
  const meta: Record<string, string> = {};
  const yArr: number[] = [];
  let dataMode: 'xydata' | 'xypoints' | null = null;
  const asdfState: ASDFState = { lastValue: 0, lastDelta: 0 };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    if (line.startsWith('##')) {
      const eqIdx = line.indexOf('=');
      if (eqIdx < 0) continue;
      const key = line.slice(2, eqIdx).trim().toUpperCase().replace(/ /g, '');
      const val = line.slice(eqIdx + 1).trim();
      meta[key] = val;

      if (key === 'XYDATA') dataMode = 'xydata';
      else if (key === 'XYPOINTS' || key === 'XYPAIRS') dataMode = 'xypoints';
      else dataMode = null;

      if (key === 'END') break;
      continue;
    }

    if (!dataMode) continue;

    if (dataMode === 'xydata') {
      yArr.push(...parseXYDataLine(line, asdfState));
    } else {
      // XYPOINTS gives explicit (X, Y) pairs — every other value is a Y.
      const vals = parseXYPointsLine(line);
      for (let k = 1; k < vals.length; k += 2) yArr.push(vals[k]);
    }
  }

  if (yArr.length < 2) return null;

  const xFirst = safeFloat(meta['FIRSTX'], 0);
  const xLast = safeFloat(meta['LASTX'], xFirst + yArr.length - 1);
  // Prefer the actual decoded point count over a possibly-stale/mismatched
  // NPOINTS header when computing spacing, so the reconstructed X axis
  // stays internally consistent with the data that was actually recovered.
  const deltaX = meta['DELTAX']
    ? safeFloat(meta['DELTAX'], 1)
    : (xLast - xFirst) / Math.max(yArr.length - 1, 1);

  const xFactor = safeFloat(meta['XFACTOR'], 1);
  const yFactor = safeFloat(meta['YFACTOR'], 1);

  const xArr: number[] = new Array(yArr.length);
  for (let i = 0; i < yArr.length; i++) {
    xArr[i] = (xFirst + i * deltaX) * xFactor;
  }
  const yScaled = yArr.map(v => v * yFactor);

  if (xArr.length < 2 || xArr.some(v => !isFinite(v)) || yScaled.some(v => !isFinite(v))) return null;

  return { x: xArr, y: yScaled, meta };
}
