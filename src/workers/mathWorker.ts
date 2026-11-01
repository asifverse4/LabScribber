/**
 * @license
 * SPDX-License-Identifier: MIT
 *
 * Dedicated background Web Worker for non-blocking scientific computations.
 * Offloads compute-intensive nonlinear Nelder-Mead deconvolution, ALS baseline
 * Cholesky iterations, MCR-ALS factorizations, and PCA SVD from the main UI thread.
 */

import {
  fitSpectralPeaks,
  alsBaseline,
  mcrALS,
  runPCASVD,
  extractTaucBandgap,
} from '../utils/math';

export interface WorkerRequest {
  id: string;
  type: 'FIT_PEAKS' | 'ALS_BASELINE' | 'MCR_ALS' | 'PCA_SVD' | 'TAUC_EXTRACT';
  payload: any;
}

export interface WorkerResponse {
  id: string;
  type: string;
  result?: any;
  error?: string;
}

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const { id, type, payload } = event.data;

  try {
    let result: any;

    switch (type) {
      case 'FIT_PEAKS': {
        const { x, y, initialPeaks, profile, constraints } = payload;
        result = fitSpectralPeaks(x, y, initialPeaks, profile, constraints);
        break;
      }

      case 'ALS_BASELINE': {
        const { y, asymmetry, smoothness, maxIter } = payload;
        result = alsBaseline(y, asymmetry, smoothness, maxIter);
        break;
      }

      case 'MCR_ALS': {
        const { D, numComponents, maxIter, tol } = payload;
        result = mcrALS(D, numComponents, maxIter, tol);
        break;
      }

      case 'PCA_SVD': {
        const { matrices, refX } = payload;
        result = runPCASVD(matrices, refX);
        break;
      }

      case 'TAUC_EXTRACT': {
        const { wavelength_nm, absorbance, transition, options } = payload;
        result = extractTaucBandgap(wavelength_nm, absorbance, transition, options);
        break;
      }

      default:
        throw new Error(`Unknown worker operation: ${type}`);
    }

    const response: WorkerResponse = { id, type, result };
    self.postMessage(response);
  } catch (err: any) {
    const response: WorkerResponse = {
      id,
      type,
      error: err?.message || String(err),
    };
    self.postMessage(response);
  }
};
