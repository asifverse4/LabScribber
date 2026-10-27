/**
 * Plot domain (axis range) computation for SpectrumPlot.
 *
 * Extracted so the numerically risky part of the rendering pipeline —
 * computing xMin/xMax/yMin/yMax from the active datasets, which feeds
 * directly into a division in getPixelX/getPixelY — can be unit-tested
 * without needing a real <canvas> 2D context (jsdom's getContext('2d')
 * returns null, so this logic previously had zero test coverage even
 * though it ran unconditionally on every render).
 *
 * Two failure modes this guards against:
 *   - A zero-width domain (a single-point dataset, or every point sharing
 *     the same x or y value) divides by zero in getPixelX/getPixelY,
 *     silently mapping every point to NaN — the plot goes blank with no
 *     error rather than showing the one point it has.
 *   - A single non-finite value (NaN/Infinity) anywhere in a dataset's x
 *     or y array poisons Math.min/Math.max for the *entire* domain,
 *     breaking rendering for every dataset on the plot, not just the
 *     corrupted one.
 */

export interface PlotDomain {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
}

export interface DomainSeries {
  x: number[];
  y_processed: number[];
}

/**
 * Computes the auto-fit domain across one or more series, with 2% padding
 * and non-finite values skipped. Falls back to a sane default range if no
 * finite data exists at all (e.g. every visible dataset is empty).
 */
export function computeAutoDomain(series: DomainSeries[]): PlotDomain {
  let xMin = Infinity;
  let xMax = -Infinity;
  let yMin = Infinity;
  let yMax = -Infinity;

  for (const ds of series) {
    for (let i = 0; i < ds.x.length; i++) {
      const xv = ds.x[i];
      if (isFinite(xv)) {
        xMin = Math.min(xMin, xv);
        xMax = Math.max(xMax, xv);
      }
    }
    for (const v of ds.y_processed) {
      if (isFinite(v)) {
        yMin = Math.min(yMin, v);
        yMax = Math.max(yMax, v);
      }
    }
  }

  if (xMin === Infinity) {
    return { xMin: 0, xMax: 500, yMin: 0, yMax: 1 };
  }

  const dx = xMax - xMin;
  if (dx > 0) {
    xMin -= dx * 0.02;
    xMax += dx * 0.02;
  } else {
    // Zero-width X domain (a single point, or every point sharing the same
    // x) would otherwise divide by zero when mapping to pixel coordinates.
    xMax += 1;
  }

  const dy = yMax - yMin;
  if (dy > 0) {
    yMin -= dy * 0.02;
    yMax += dy * 0.02;
  } else {
    yMax += 1;
  }

  return { xMin, xMax, yMin, yMax };
}

/**
 * Final safety net applied after choosing between the auto-computed domain
 * and manual (free-text user input) axis limits. Manual limits aren't
 * covered by computeAutoDomain's own guards, since the user can type
 * anything — equal min/max, reversed min/max, or a non-numeric value that
 * produced NaN upstream. Without this, getPixelX/getPixelY divide by zero
 * and the plot silently goes blank.
 */
export function clampDomain(domain: PlotDomain): PlotDomain {
  let { xMin, xMax, yMin, yMax } = domain;

  if (!isFinite(xMin)) xMin = 0;
  if (!isFinite(xMax) || xMax <= xMin) xMax = xMin + 1;

  if (!isFinite(yMin)) yMin = 0;
  if (!isFinite(yMax) || yMax <= yMin) yMax = yMin + 1;

  return { xMin, xMax, yMin, yMax };
}
