/**
 * @license
 * SPDX-License-Identifier: MIT
 *
 * Web Worker Client Bridge
 *
 * Provides a Promise-based interface for delegating heavy scientific calculations
 * to background Web Workers, with automatic fallback to main-thread execution
 * in environments lacking Web Worker support (e.g. Node/Vitest/JSDOM).
 */

import {
  FitResult,
  PeakData,
  PCAOutput,
  MCRALSResult,
} from '../types';
import {
  fitSpectralPeaks,
  alsBaseline,
  mcrALS,
  runPCASVD,
  extractTaucBandgap,
  TaucExtractionResult,
} from './math';

let workerInstance: Worker | null = null;
let reqCounter = 0;
const pendingRequests = new Map<
  string,
  { resolve: (val: any) => void; reject: (err: Error) => void; timer: any }
>();

function isWorkerSupported(): boolean {
  return typeof window !== 'undefined' && typeof window.Worker !== 'undefined';
}

function getWorker(): Worker | null {
  if (!isWorkerSupported()) return null;
  if (!workerInstance) {
    try {
      workerInstance = new Worker(
        new URL('../workers/mathWorker.ts', import.meta.url),
        { type: 'module' }
      );

      workerInstance.onmessage = (event: MessageEvent) => {
        const { id, error, result } = event.data || {};
        const pending = pendingRequests.get(id);
        if (pending) {
          clearTimeout(pending.timer);
          pendingRequests.delete(id);
          if (error) {
            pending.reject(new Error(error));
          } else {
            pending.resolve(result);
          }
        }
      };

      workerInstance.onerror = (err) => {
        console.error('Math worker error:', err);
      };
    } catch (e) {
      console.warn('Web Worker initialization failed, falling back to synchronous execution:', e);
      workerInstance = null;
    }
  }
  return workerInstance;
}

function postToWorker<T>(type: string, payload: any, timeoutMs = 30000): Promise<T> {
  const worker = getWorker();
  if (!worker) {
    return Promise.reject(new Error('Worker not available'));
  }

  const id = `req_${++reqCounter}_${Date.now()}`;
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      pendingRequests.delete(id);
      reject(new Error(`Worker request timed out after ${timeoutMs}ms for ${type}`));
    }, timeoutMs);

    pendingRequests.set(id, { resolve, reject, timer });
    worker.postMessage({ id, type, payload });
  });
}

/**
 * Offload multi-peak deconvolution to the background Web Worker.
 * Falls back to main thread execution if Worker is unsupported.
 */
export async function computeFitSpectralPeaksAsync(
  x: number[],
  y: number[],
  initialPeaks: PeakData[],
  profile: 'Gaussian' | 'Lorentzian' | 'Voigt',
  constraints: {
    enforce: boolean;
    centerTol: number;
    widthMin: number;
    widthMax: number;
  }
): Promise<FitResult> {
  if (isWorkerSupported()) {
    try {
      return await postToWorker<FitResult>('FIT_PEAKS', {
        x,
        y,
        initialPeaks,
        profile,
        constraints,
      });
    } catch {
      // Fallback on error or timeout
    }
  }
  return fitSpectralPeaks(x, y, initialPeaks, profile, constraints);
}

/**
 * Offload Asymmetric Least Squares (ALS) baseline correction.
 */
export async function computeAlsBaselineAsync(
  y: number[],
  asymmetry = 0.001,
  smoothness = 100000,
  maxIter = 10
): Promise<number[]> {
  if (isWorkerSupported()) {
    try {
      return await postToWorker<number[]>('ALS_BASELINE', {
        y,
        asymmetry,
        smoothness,
        maxIter,
      });
    } catch {
      // Fallback
    }
  }
  return alsBaseline(y, asymmetry, smoothness, maxIter);
}

/**
 * Offload MCR-ALS factorization.
 */
export async function computeMcrALSAsync(
  D: number[][],
  numComponents: number,
  maxIter = 50,
  tol = 1e-5
): Promise<MCRALSResult> {
  if (isWorkerSupported()) {
    try {
      return await postToWorker<MCRALSResult>('MCR_ALS', {
        D,
        numComponents,
        maxIter,
        tol,
      });
    } catch {
      // Fallback
    }
  }
  return mcrALS(D, numComponents, maxIter, tol);
}

/**
 * Offload PCA-SVD decomposition.
 */
export async function computePCASVDAsync(
  matrices: number[][],
  refX: number[]
): Promise<PCAOutput> {
  if (isWorkerSupported()) {
    try {
      return await postToWorker<PCAOutput>('PCA_SVD', { matrices, refX });
    } catch {
      // Fallback
    }
  }
  return runPCASVD(matrices, refX);
}

/**
 * Offload robust Tauc bandgap extraction.
 */
export async function computeTaucAsync(
  wavelength_nm: number[],
  absorbance: number[],
  transition: 'direct' | 'indirect' = 'direct',
  options?: {
    manualRangeMin?: number;
    manualRangeMax?: number;
    minWindowPts?: number;
  }
): Promise<TaucExtractionResult> {
  if (isWorkerSupported()) {
    try {
      return await postToWorker<TaucExtractionResult>('TAUC_EXTRACT', {
        wavelength_nm,
        absorbance,
        transition,
        options,
      });
    } catch {
      // Fallback
    }
  }
  return extractTaucBandgap(wavelength_nm, absorbance, transition, options);
}

/**
 * Terminate the background worker instance (useful for cleanups / tests).
 */
export function terminateMathWorker(): void {
  if (workerInstance) {
    workerInstance.terminate();
    workerInstance = null;
    pendingRequests.clear();
  }
}
