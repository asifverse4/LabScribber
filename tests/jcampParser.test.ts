import { describe, it, expect } from 'vitest';
import { decodeASDFLine, parseJCAMPDXCore } from '../src/utils/jcampParser';

describe('decodeASDFLine', () => {
  it('decodes a plain AFFN (uncompressed) sequence', () => {
    const state = { lastValue: 0, lastDelta: 0 };
    expect(decodeASDFLine('30 32 34', state)).toEqual([30, 32, 34]);
  });

  it('decodes SQZ (squeezed leading digit) values', () => {
    // E0 = SQZ '+5' + literal '0' => 50
    const state = { lastValue: 0, lastDelta: 0 };
    expect(decodeASDFLine('E0', state)).toEqual([50]);
  });

  it('decodes negative SQZ values', () => {
    // e0 = SQZ '-5' + literal '0' => -50
    const state = { lastValue: 0, lastDelta: 0 };
    expect(decodeASDFLine('e0', state)).toEqual([-50]);
  });

  it('matches the spec worked example: 30, 32 in DIF form is "C0K"', () => {
    // C0 = SQZ +30 (absolute), K = DIF +2 => 30 + 2 = 32
    const state = { lastValue: 0, lastDelta: 0 };
    expect(decodeASDFLine('C0K', state)).toEqual([30, 32]);
  });

  it('matches the spec worked example: 50 50 50 50 in SQZ+DUP form is "E0V"', () => {
    // E0 = 50 (absolute, delta 0), V = DUP(4) => 3 more repeats of the same delta (0)
    const state = { lastValue: 0, lastDelta: 0 };
    expect(decodeASDFLine('E0V', state)).toEqual([50, 50, 50, 50]);
  });

  it('matches the spec worked example: 50 50 50 50 in DIF form is "E0%%%"', () => {
    const state = { lastValue: 0, lastDelta: 0 };
    expect(decodeASDFLine('E0%%%', state)).toEqual([50, 50, 50, 50]);
  });

  it('matches the spec worked example: 50 50 50 50 in DIFDUP form is "E0%U"', () => {
    // E0 = 50, % = DIF 0 => 50 (2nd), U = DUP(3) => 2 more repeats of delta 0 (3rd, 4th)
    const state = { lastValue: 0, lastDelta: 0 };
    expect(decodeASDFLine('E0%U', state)).toEqual([50, 50, 50, 50]);
  });

  it('carries DIF chain state across multiple decodeASDFLine calls (line-wrap boundary)', () => {
    const state = { lastValue: 0, lastDelta: 0 };
    const line1 = decodeASDFLine('C0K', state); // 30, 32
    const line2 = decodeASDFLine('JJ', state);  // +1 => 33, +1 => 34 (continues from 32)
    expect(line1).toEqual([30, 32]);
    expect(line2).toEqual([33, 34]);
  });

  it('handles mixed SQZ and DIF tokens on the same line', () => {
    const state = { lastValue: 0, lastDelta: 0 };
    // A0 = SQZ +10 (absolute), K = DIF +2 => 12, J = DIF +1 => 13
    expect(decodeASDFLine('A0KJ', state)).toEqual([10, 12, 13]);
  });

  it('skips unrecognised characters instead of throwing', () => {
    const state = { lastValue: 0, lastDelta: 0 };
    expect(() => decodeASDFLine('30 ?? 32', state)).not.toThrow();
    expect(decodeASDFLine('30 ?? 32', { lastValue: 0, lastDelta: 0 })).toEqual([30, 32]);
  });

  it('decodes negative DIF deltas correctly', () => {
    const state = { lastValue: 0, lastDelta: 0 };
    // C0 = 30 (absolute), k = DIF -2 => 28
    expect(decodeASDFLine('C0k', state)).toEqual([30, 28]);
  });
});

describe('parseJCAMPDXCore', () => {
  const HEADER = [
    '##TITLE=Test Spectrum',
    '##JCAMP-DX=5.01',
    '##DATA TYPE=INFRARED SPECTRUM',
    '##XUNITS=1/CM',
    '##YUNITS=ABSORBANCE',
    '##FIRSTX=4000',
    '##LASTX=3990',
    '##NPOINTS=11',
    '##XFACTOR=1',
    '##YFACTOR=1',
  ];

  it('returns null for text with no XYDATA block', () => {
    const text = HEADER.join('\n') + '\n##END=\n';
    expect(parseJCAMPDXCore(text)).toBeNull();
  });

  it('returns null for an empty string', () => {
    expect(parseJCAMPDXCore('')).toBeNull();
  });

  it('returns null for completely garbage input', () => {
    expect(parseJCAMPDXCore('this is not a jcamp file at all\njust random text\n')).toBeNull();
  });

  it('does NOT treat the per-line leading X-check value as a Y data point (regression test)', () => {
    // Two data lines, each starting with an X-check value followed by plain
    // Y values. A naive parser that swallows every token as Y data would
    // produce 8 y-values (2 spurious X-checks + 6 real). The correct
    // behaviour recovers exactly 6.
    const text = [
      ...HEADER,
      '##NPOINTS=6',
      '##XYDATA=(X++(Y..Y))',
      '4000 1.0 1.1 1.2',
      '3997 1.3 1.4 1.5',
      '##END=',
    ].join('\n');
    const result = parseJCAMPDXCore(text);
    expect(result).not.toBeNull();
    expect(result!.y).toEqual([1.0, 1.1, 1.2, 1.3, 1.4, 1.5]);
    expect(result!.x).toHaveLength(6);
  });

  it('correctly decodes an SQZ/DIF compressed XYDATA block', () => {
    const text = [
      '##TITLE=Compressed Spectrum',
      '##FIRSTX=0',
      '##LASTX=3',
      '##XFACTOR=1',
      '##YFACTOR=1',
      '##XYDATA=(X++(Y..Y))',
      '0 C0K',    // X-check "0", then Y: 30, 32
      '2 JJ',     // X-check "2", then Y: 33, 34 (DIF continues from 32)
      '##END=',
    ].join('\n');
    const result = parseJCAMPDXCore(text);
    expect(result).not.toBeNull();
    expect(result!.y).toEqual([30, 32, 33, 34]);
  });

  it('applies XFACTOR and YFACTOR scaling', () => {
    const text = [
      '##TITLE=Scaled',
      '##FIRSTX=0',
      '##LASTX=2',
      '##XFACTOR=2',
      '##YFACTOR=0.5',
      '##XYDATA=(X++(Y..Y))',
      '0 10 20 30',
      '##END=',
    ].join('\n');
    const result = parseJCAMPDXCore(text);
    expect(result).not.toBeNull();
    expect(result!.y).toEqual([5, 10, 15]);
    // x reconstructed from FIRSTX/LASTX/point-count, then scaled by XFACTOR
    expect(result!.x[0]).toBeCloseTo(0);
    expect(result!.x[result!.x.length - 1]).toBeCloseTo(4); // (2) * xFactor(2)
  });

  it('falls back to safe defaults for malformed numeric headers instead of propagating NaN', () => {
    const text = [
      '##TITLE=Bad Header',
      '##FIRSTX=not-a-number',
      '##LASTX=also-bad',
      '##XFACTOR=nope',
      '##YFACTOR=nope',
      '##XYDATA=(X++(Y..Y))',
      '0 1 2 3',
      '##END=',
    ].join('\n');
    const result = parseJCAMPDXCore(text);
    expect(result).not.toBeNull();
    expect(result!.x.every(v => isFinite(v))).toBe(true);
    expect(result!.y.every(v => isFinite(v))).toBe(true);
  });

  it('parses an XYPOINTS block as explicit (X,Y) pairs', () => {
    const text = [
      '##TITLE=XY Pairs',
      '##XYPOINTS=(XY..XY)',
      '350,0.12 360,0.15 370,0.20',
      '##END=',
    ].join('\n');
    const result = parseJCAMPDXCore(text);
    expect(result).not.toBeNull();
    expect(result!.y).toEqual([0.12, 0.15, 0.20]);
  });

  it('stops parsing at ##END= and ignores trailing garbage', () => {
    const text = [
      '##TITLE=Truncated',
      '##FIRSTX=0',
      '##LASTX=2',
      '##XYDATA=(X++(Y..Y))',
      '0 1 2 3',
      '##END=',
      'this should be ignored entirely',
      '##NOTANLDR=garbage',
    ].join('\n');
    const result = parseJCAMPDXCore(text);
    expect(result).not.toBeNull();
    expect(result!.y).toEqual([1, 2, 3]);
  });

  it('handles Windows-style CRLF line endings', () => {
    const text = [
      '##TITLE=CRLF Test',
      '##FIRSTX=0',
      '##LASTX=2',
      '##XYDATA=(X++(Y..Y))',
      '0 1 2 3',
      '##END=',
    ].join('\r\n');
    const result = parseJCAMPDXCore(text);
    expect(result).not.toBeNull();
    expect(result!.y).toEqual([1, 2, 3]);
  });

  it('returns null when only a single point can be recovered', () => {
    const text = [
      '##TITLE=Too Short',
      '##XYDATA=(X++(Y..Y))',
      '0 1',
      '##END=',
    ].join('\n');
    expect(parseJCAMPDXCore(text)).toBeNull();
  });
});
