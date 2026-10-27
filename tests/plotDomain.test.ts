import { describe, it, expect } from 'vitest';
import { computeAutoDomain, clampDomain } from '../src/utils/plotDomain';

describe('computeAutoDomain', () => {
  it('computes a padded domain from a normal multi-point series', () => {
    const domain = computeAutoDomain([{ x: [0, 5, 10], y_processed: [0, 5, 10] }]);
    // 2% padding on a range of 10 => 0.2 either side
    expect(domain.xMin).toBeCloseTo(-0.2);
    expect(domain.xMax).toBeCloseTo(10.2);
    expect(domain.yMin).toBeCloseTo(-0.2);
    expect(domain.yMax).toBeCloseTo(10.2);
  });

  it('falls back to a default range when there is no data at all', () => {
    const domain = computeAutoDomain([]);
    expect(domain).toEqual({ xMin: 0, xMax: 500, yMin: 0, yMax: 1 });
  });

  it('falls back to a default range when every series is empty', () => {
    const domain = computeAutoDomain([{ x: [], y_processed: [] }]);
    expect(domain).toEqual({ xMin: 0, xMax: 500, yMin: 0, yMax: 1 });
  });

  it('does not produce a zero-width domain for a single-point dataset', () => {
    const domain = computeAutoDomain([{ x: [42], y_processed: [7] }]);
    expect(domain.xMax).toBeGreaterThan(domain.xMin);
    expect(domain.yMax).toBeGreaterThan(domain.yMin);
  });

  it('does not produce a zero-width domain when every point shares the same x', () => {
    const domain = computeAutoDomain([{ x: [5, 5, 5, 5], y_processed: [1, 2, 3, 4] }]);
    expect(domain.xMax).toBeGreaterThan(domain.xMin);
  });

  it('does not produce a zero-width domain when every point shares the same y (flat trace)', () => {
    const domain = computeAutoDomain([{ x: [0, 1, 2, 3], y_processed: [0.5, 0.5, 0.5, 0.5] }]);
    expect(domain.yMax).toBeGreaterThan(domain.yMin);
  });

  it('skips NaN values rather than letting them poison the whole domain', () => {
    const domain = computeAutoDomain([{ x: [0, NaN, 10], y_processed: [0, NaN, 10] }]);
    expect(isFinite(domain.xMin)).toBe(true);
    expect(isFinite(domain.xMax)).toBe(true);
    expect(domain.xMax).toBeGreaterThan(domain.xMin);
  });

  it('skips Infinity/-Infinity values rather than letting them poison the whole domain', () => {
    const domain = computeAutoDomain([{ x: [0, 5, 10], y_processed: [0, Infinity, -Infinity] }]);
    expect(isFinite(domain.yMin)).toBe(true);
    expect(isFinite(domain.yMax)).toBe(true);
  });

  it('one corrupted dataset does not break the domain for other valid datasets on the same plot', () => {
    const domain = computeAutoDomain([
      { x: [NaN, NaN, NaN], y_processed: [NaN, NaN, NaN] },
      { x: [100, 200, 300], y_processed: [1, 2, 3] },
    ]);
    expect(domain.xMin).toBeLessThan(100);
    expect(domain.xMax).toBeGreaterThan(300);
    expect(isFinite(domain.xMin)).toBe(true);
    expect(isFinite(domain.xMax)).toBe(true);
  });

  it('computes the correct domain across multiple series (global min/max)', () => {
    const domain = computeAutoDomain([
      { x: [0, 10], y_processed: [0, 1] },
      { x: [-5, 20], y_processed: [-2, 5] },
    ]);
    expect(domain.xMin).toBeLessThanOrEqual(-5);
    expect(domain.xMax).toBeGreaterThanOrEqual(20);
    expect(domain.yMin).toBeLessThanOrEqual(-2);
    expect(domain.yMax).toBeGreaterThanOrEqual(5);
  });

  it('does not assume x is sorted ascending (descending-wavelength export)', () => {
    const domain = computeAutoDomain([{ x: [800, 600, 400, 200], y_processed: [1, 2, 3, 4] }]);
    expect(domain.xMin).toBeLessThan(200);
    expect(domain.xMax).toBeGreaterThan(800);
  });
});

describe('clampDomain', () => {
  it('leaves a well-formed domain unchanged', () => {
    const domain = clampDomain({ xMin: 0, xMax: 10, yMin: 0, yMax: 5 });
    expect(domain).toEqual({ xMin: 0, xMax: 10, yMin: 0, yMax: 5 });
  });

  it('fixes an equal xMin/xMax (e.g. user typed the same value in both manual fields)', () => {
    const domain = clampDomain({ xMin: 5, xMax: 5, yMin: 0, yMax: 1 });
    expect(domain.xMax).toBeGreaterThan(domain.xMin);
  });

  it('fixes a reversed xMin/xMax (e.g. user typed min > max)', () => {
    const domain = clampDomain({ xMin: 10, xMax: 2, yMin: 0, yMax: 1 });
    expect(domain.xMax).toBeGreaterThan(domain.xMin);
  });

  it('fixes a non-finite xMin/xMax (e.g. a manual field left as NaN from bad input)', () => {
    const domain = clampDomain({ xMin: NaN, xMax: NaN, yMin: 0, yMax: 1 });
    expect(isFinite(domain.xMin)).toBe(true);
    expect(isFinite(domain.xMax)).toBe(true);
    expect(domain.xMax).toBeGreaterThan(domain.xMin);
  });

  it('fixes the y-axis independently of the x-axis', () => {
    const domain = clampDomain({ xMin: 0, xMax: 10, yMin: 5, yMax: 5 });
    expect(domain.xMin).toBe(0);
    expect(domain.xMax).toBe(10);
    expect(domain.yMax).toBeGreaterThan(domain.yMin);
  });
});
