import { SpectrumData } from '../types';

const SOFTWARE_ID = 'LabScribber v1.0.0';

/**
 * Fast, deterministic, non-cryptographic 32-bit FNV-1a hash.
 *
 * This is a data-integrity *fingerprint*, not a security primitive: it lets
 * a reader (or the original author, months later) confirm that the raw
 * trace referenced in an exported provenance log is the same trace they're
 * looking at, without needing to diff two arrays of floats by eye.
 */
function fnv1aHash(str: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

/**
 * Checksum of a dataset's raw (as-imported) trace. Values are rounded to 6
 * significant figures before hashing so the checksum stays stable across a
 * save/reload round-trip that may lose trailing floating-point precision,
 * while still changing if the actual data changes.
 */
function dataChecksum(x: number[], y: number[]): string {
  const str = x.map(v => v.toPrecision(6)).join(',') + '|' + y.map(v => v.toPrecision(6)).join(',');
  return fnv1aHash(str);
}

const TIMESTAMP_RE = /^\[([^\]]*)\]\s*(.*)$/;

export type ProvenanceCategory =
  | 'ingestion'
  | 'processing'
  | 'peak-analysis'
  | 'fitting'
  | 'statistics'
  | 'simulation'
  | 'electrochemistry'
  | 'other';

function categorize(text: string): ProvenanceCategory {
  if (/^(Imported|Smart-Ingested)/.test(text)) return 'ingestion';
  if (/^(Applied multi-step|Batch processed)/.test(text) || /^Mie\/Rayleigh/.test(text)) return 'processing';
  if (/^Auto-detected \d+ peaks|placed peak mark|Mnova/.test(text)) return 'peak-analysis';
  if (/^Fit \d+/.test(text)) return 'fitting';
  if (/Replicate statistics|Welch's t-test|Job's Plot|Job's Method|Tauc Plot/.test(text)) return 'statistics';
  if (/^(Butler|Randles|EPR|EI mass spectrum|TGA)/.test(text)) return 'electrochemistry';
  if (/^(Generated virtual|Simulated|Geometries compiled)/.test(text)) return 'simulation';
  return 'other';
}

export interface ProvenanceEvent {
  timestamp: string;
  raw: string;
  category: ProvenanceCategory;
}

export interface DatasetProvenance {
  datasetId: string;
  name: string;
  technique: string;
  nPoints: number;
  xRange: [number, number];
  dataChecksum: string;
  currentState: {
    baselineApplied: boolean;
    fitApplied: boolean;
    peaksCount: number;
    integralsCount: number;
  };
  events: ProvenanceEvent[];
}

export interface ProvenanceLog {
  software: string;
  exportedAt: string;
  datasetCount: number;
  datasets: DatasetProvenance[];
}

/**
 * Builds the full provenance record for a single dataset: a data-integrity
 * fingerprint plus every logged event, timestamped and categorized.
 */
export function generateDatasetProvenance(sd: SpectrumData): DatasetProvenance {
  const events: ProvenanceEvent[] = sd.history.map(raw => {
    const m = raw.match(TIMESTAMP_RE);
    const timestamp = m ? m[1] : '';
    const text = m ? m[2] : raw;
    return { timestamp, raw: text, category: categorize(text) };
  });

  const xMin = sd.x.length ? Math.min(...sd.x) : 0;
  const xMax = sd.x.length ? Math.max(...sd.x) : 0;

  return {
    datasetId: sd.id,
    name: sd.name,
    technique: sd.technique,
    nPoints: sd.x.length,
    xRange: [xMin, xMax],
    dataChecksum: dataChecksum(sd.x, sd.y_orig),
    currentState: {
      baselineApplied: sd.baseline !== null,
      fitApplied: sd.fitResult !== null,
      peaksCount: sd.peaks.length,
      integralsCount: sd.integrals.length,
    },
    events,
  };
}

/** Builds a full session provenance log across one or more datasets. */
export function generateProvenanceLog(datasets: SpectrumData[]): ProvenanceLog {
  return {
    software: SOFTWARE_ID,
    exportedAt: new Date().toISOString(),
    datasetCount: datasets.length,
    datasets: datasets.map(generateDatasetProvenance),
  };
}

export function provenanceLogToJSON(log: ProvenanceLog): string {
  return JSON.stringify(log, null, 2);
}

/** Flattens a provenance log to CSV — one row per event, dataset metadata repeated. */
export function provenanceLogToCSV(log: ProvenanceLog): string {
  const header = ['Dataset', 'Technique', 'Data_Checksum', 'Event_Timestamp', 'Category', 'Description'].join(',');
  const lines: string[] = [header];

  for (const ds of log.datasets) {
    const name = `"${ds.name.replace(/"/g, '""')}"`;
    if (ds.events.length === 0) {
      lines.push([name, ds.technique, ds.dataChecksum, '', '', ''].join(','));
      continue;
    }
    for (const ev of ds.events) {
      lines.push([
        name,
        ds.technique,
        ds.dataChecksum,
        ev.timestamp,
        ev.category,
        `"${ev.raw.replace(/"/g, '""')}"`,
      ].join(','));
    }
  }

  return lines.join('\n');
}
