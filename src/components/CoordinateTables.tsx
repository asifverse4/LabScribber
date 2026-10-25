/**
 * @license
 * SPDX-License-Identifier: MIT
 */

import React, { useState, useEffect } from 'react';
import { SpectrumData, PeakData, IntegralData } from '../types';
import { Trash2, FileText, ClipboardList, BookOpen } from 'lucide-react';

// Focus-retaining edit component with local state to prevent focus loss on typing
const EditableInput: React.FC<{
  value: string;
  onSave: (val: string) => void;
  placeholder?: string;
  className?: string;
  list?: string;
}> = ({ value, onSave, placeholder, className, list }) => {
  const [localVal, setLocalVal] = useState(value);

  useEffect(() => {
    setLocalVal(value);
  }, [value]);

  const handleBlur = () => {
    if (localVal !== value) {
      onSave(localVal);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.currentTarget.blur();
    }
  };

  return (
    <input
      type="text"
      value={localVal}
      onChange={(e) => setLocalVal(e.target.value)}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      placeholder={placeholder}
      className={className}
      list={list}
    />
  );
};

interface CoordinateTablesProps {
  selectedDataset: SpectrumData | null;
  datasets: SpectrumData[];
  onDatasetsUpdated: (list: SpectrumData[]) => void;
  onPeaksUpdated: () => void;
}

const getDatalistPresetsForTechnique = (technique: string): string[] => {
  const t = technique?.toLowerCase() || '';
  if (t.includes('1h nmr') || t.includes('1h-1h')) {
    return [
      'Singlet (s)',
      'Doublet (d)',
      'Triplet (t)',
      'Quartet (q)',
      'Quintet (pent)',
      'Sextet (sex)',
      'Multiplet (m)',
      'Broad Singlet (br s)',
      'Doublet of Doublets (dd)'
    ];
  }
  if (t.includes('13c nmr') || t.includes('13c')) {
    return [
      'Carbonyl / Ester (C=O)',
      'Quaternary Carbon (Ar-C)',
      'Aromatic / Alkenylic C-H',
      'Heteroatom Carbon (C-O / C-N)',
      'Aliphatic Carbon (sp³)',
      'Solvent Triplet (CDCl₃)'
    ];
  }
  if (t.includes('2d cosy') || t.includes('cosy')) {
    return [
      'H-H Diagonal Peak',
      'Coupled Cross Peak',
      'Aromatic Coupling',
      'Alkyl Coupling',
      'Residual Solvent'
    ];
  }
  if (t.includes('infrared') || t.includes('ftir') || t.includes('ir') || t.includes('raman')) {
    return [
      'O-H stretch (broad)',
      'N-H stretch',
      'C-H stretch (sp³)',
      'C-H stretch (sp²)',
      'C≡N stretch',
      'C=O stretch (strong)',
      'C=C stretch',
      'C-O stretch',
      'C-H bend',
      'N-H bend',
      'G-band (Raman)',
      'D-band (Raman)'
    ];
  }
  if (t.includes('xps') || t.includes('photoelectron')) {
    return [
      'C 1s (C-C / C-H)',
      'C 1s (C-O)',
      'C 1s (C=O)',
      'C 1s (O-C=O)',
      'O 1s Core level',
      'N 1s Core level',
      'S 2p3/2 Core level'
    ];
  }
  if (t.includes('photoluminescence') || t.includes('pl') || t.includes('fluorescence')) {
    return [
      'Band Edge (Near)',
      'Singlet (S₁ → S₀)',
      'Triplet (T₁ → S₀)',
      'Radiative Decay',
      'Surface State PL',
      'Defect Emission'
    ];
  }
  if (t.includes('xrd') || t.includes('diffraction')) {
    return [
      '(111) reflection',
      '(200) reflection',
      '(220) reflection',
      '(311) reflection',
      '(222) reflection',
      '(400) reflection',
      'Amorphous Broad Hump'
    ];
  }
  // Default to UV-Vis electronic transitions
  return [
    'π → π*',
    'n → π*',
    'σ → σ*',
    'd → d (LF)',
    'S₀ → S₁',
    'S₀ → T₁',
    'LMCT',
    'MLCT',
    'IVCT',
    'Charge Transfer'
  ];
};

export const CoordinateTables: React.FC<CoordinateTablesProps> = ({
  selectedDataset,
  datasets,
  onDatasetsUpdated,
  onPeaksUpdated
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'peaks' | 'integrals' | 'history'>('peaks');

  if (!selectedDataset) {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 text-gray-500 text-center text-xs">
        No active spectroscopic object selected. Ingest data to see picked peak coordinates or logs.
      </div>
    );
  }

  const sd = selectedDataset;

  // Sync edits from input boxes
  const handleUpdatePeakLabel = (peakId: string, text: string) => {
    const list = datasets.map(d => {
      if (d.id === sd.id) {
        return {
          ...d,
          peaks: d.peaks.map(p => p.id === peakId ? { ...p, label: text } : p)
        };
      }
      return d;
    });
    onDatasetsUpdated(list);
  };

  const handleUpdatePeakTransition = (peakId: string, text: string) => {
    const list = datasets.map(d => {
      if (d.id === sd.id) {
        return {
          ...d,
          peaks: d.peaks.map(p => p.id === peakId ? { ...p, transition: text } : p)
        };
      }
      return d;
    });
    onDatasetsUpdated(list);
  };

  const handleUpdatePeakOffset = (peakId: string, field: 'dx' | 'dy', val: number) => {
    const list = datasets.map(d => {
      if (d.id === sd.id) {
        return {
          ...d,
          peaks: d.peaks.map(p => p.id === peakId ? { ...p, [field]: val } : p)
        };
      }
      return d;
    });
    onDatasetsUpdated(list);
  };

  const handleDeletePeak = (peakId: string) => {
    const list = datasets.map(d => {
      if (d.id === sd.id) {
        return {
          ...d,
          peaks: d.peaks.filter(p => p.id !== peakId)
        };
      }
      return d;
    });
    onDatasetsUpdated(list);
  };

  const handleDeleteIntegral = (intgId: string) => {
    const list = datasets.map(d => {
      if (d.id === sd.id) {
        return {
          ...d,
          integrals: d.integrals.filter(i => i.id !== intgId)
        };
      }
      return d;
    });
    onDatasetsUpdated(list);
  };

  return (
    <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg p-5 text-slate-800 dark:text-gray-300 shadow-sm transition-all">
      
      {/* Sub tabs list */}
      <div className="flex border-b border-slate-200 dark:border-zinc-805 mb-4 gap-2 select-none">
        <button
          onClick={() => setActiveSubTab('peaks')}
          className={`flex items-center gap-1.5 py-2 px-3 text-xs font-semibold transition-all ${
            activeSubTab === 'peaks'
              ? 'border-b-2 border-teal-600 text-teal-600 dark:border-teal-400 dark:text-teal-400'
              : 'border-b-2 border-transparent text-slate-500 dark:text-gray-400 hover:text-slate-800 dark:hover:text-gray-200'
          }`}
        >
          <ClipboardList size={13} /> Peaks & Core Assignments ({sd.peaks.length})
        </button>
 
        <button
          onClick={() => setActiveSubTab('integrals')}
          className={`flex items-center gap-1.5 py-2 px-3 text-xs font-semibold transition-all ${
            activeSubTab === 'integrals'
              ? 'border-b-2 border-teal-600 text-teal-600 dark:border-teal-400 dark:text-teal-400'
              : 'border-b-2 border-transparent text-slate-500 dark:text-gray-400 hover:text-slate-800 dark:hover:text-gray-200'
          }`}
        >
          <BookOpen size={13} /> Spectral Integration ({sd.integrals.length})
        </button>
 
        <button
          onClick={() => setActiveSubTab('history')}
          className={`flex items-center gap-1.5 py-2 px-3 text-xs font-semibold transition-all ${
            activeSubTab === 'history'
              ? 'border-b-2 border-teal-600 text-teal-600 dark:border-teal-400 dark:text-teal-400'
              : 'border-b-2 border-transparent text-slate-500 dark:text-gray-400 hover:text-slate-800 dark:hover:text-gray-200'
          }`}
        >
          <FileText size={13} /> Instrument Provenance ({sd.history.length})
        </button>
      </div>
 
      {/* Pane container */}
      <div className="max-h-[160px] overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-350 dark:scrollbar-thumb-zinc-805">
        
        {/* PEAKS PANE */}
        {activeSubTab === 'peaks' && (
          <div>
            {sd.peaks.length === 0 ? (
              <p className="text-slate-400 dark:text-zinc-500 text-center py-6 text-xs">
                No peak markers identified. Set active cursor to 'Peak Pick' mode on the toolbar and click coordinates directly on the trace layer.
              </p>
            ) : (
              <>
                <table className="w-full text-[11px] text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-205 dark:border-[#27272a] text-slate-550 dark:text-zinc-400 uppercase tracking-wider font-semibold text-[10px]">
                    <th className="py-2 px-3 font-mono">Coordinate (X)</th>
                    <th className="py-2 px-2 font-mono">Intensity (Y)</th>
                    <th className="py-2 px-3">Molecular Assignment / Chemical Group</th>
                    <th className="py-2 px-2">
                      {sd.technique?.toLowerCase().includes('nmr') ? 'Multiplicity' : 'Transition Type'}
                    </th>
                    <th className="py-2 px-1 text-center font-normal">OffsetX</th>
                    <th className="py-2 px-1 text-center font-normal">OffsetY</th>
                    <th className="py-2 px-2 text-right">Delete</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/40">
                  {sd.peaks.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-zinc-800/20 text-slate-700 dark:text-gray-300">
                      <td className="py-2 px-3 font-mono font-bold text-teal-600 dark:text-teal-400">{p.x.toFixed(3)}</td>
                      <td className="py-2 px-2 font-mono text-slate-500 dark:text-zinc-400">{p.y.toFixed(4)}</td>
                      <td className="py-2 px-3">
                        <EditableInput
                          value={p.label}
                          onSave={(text) => handleUpdatePeakLabel(p.id, text)}
                          className="bg-white dark:bg-zinc-950 border border-slate-250 dark:border-zinc-800 rounded px-2.5 py-0.5 text-xs text-slate-800 dark:text-white w-full focus:outline-none focus:ring-1 focus:ring-teal-500"
                          placeholder="e.g. Allylic C-H"
                        />
                      </td>
                      <td className="py-2 px-2">
                        <EditableInput
                          value={p.transition || ''}
                          list="transition-presets"
                          onSave={(text) => handleUpdatePeakTransition(p.id, text)}
                          className="bg-white dark:bg-zinc-950 border border-slate-250 dark:border-zinc-800 rounded px-2.5 py-0.5 text-xs text-slate-800 dark:text-white w-full focus:outline-none focus:ring-1 focus:ring-teal-500"
                          placeholder="e.g. π → π*"
                        />
                      </td>
                      <td className="py-2 px-1 text-center font-mono">
                        <input
                          type="number"
                          value={p.dx}
                          onChange={(e) => handleUpdatePeakOffset(p.id, 'dx', Number(e.target.value) || 0)}
                          className="bg-white dark:bg-zinc-950 border border-slate-250 dark:border-zinc-800 rounded px-1 py-0.5 text-xs text-center w-12 text-slate-800 dark:text-white"
                        />
                      </td>
                      <td className="py-2 px-1 text-center font-mono">
                        <input
                          type="number"
                          value={p.dy}
                          onChange={(e) => handleUpdatePeakOffset(p.id, 'dy', Number(e.target.value) || 0)}
                          className="bg-white dark:bg-zinc-950 border border-slate-250 dark:border-zinc-800 rounded px-1 py-0.5 text-xs text-center w-12 text-slate-800 dark:text-white"
                        />
                      </td>
                      <td className="py-2 px-2 text-right">
                        <button
                          onClick={() => handleDeletePeak(p.id)}
                          className="text-slate-400 dark:text-zinc-500 hover:text-rose-500 p-1 rounded transition"
                          title="Purge Peak Marker"
                        >
                          <Trash2 size={12} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </>
            )}
          </div>
        )}
 
        {/* INTEGRALS PANE */}
        {activeSubTab === 'integrals' && (
          <div>
            {sd.integrals.length === 0 ? (
              <p className="text-slate-400 dark:text-zinc-500 text-center py-6 text-xs">
                No active integrated regions. Choose 'Integrate' cursor and click-drag coordinates on the main chart to define bounding regions.
              </p>
            ) : (
              <table className="w-full text-[11px] text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-205 dark:border-[#27272a] text-slate-550 dark:text-zinc-400 uppercase tracking-wider font-semibold text-[10px]">
                    <th className="py-2 px-3 font-mono">X-Start (Min)</th>
                    <th className="py-2 px-3 font-mono">X-End (Max)</th>
                    <th className="py-2 px-3 font-mono">Integrated Area (Trapezoidal)</th>
                    <th className="py-2 px-2 text-right">Delete</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/40">
                  {sd.integrals.map((intg) => (
                    <tr key={intg.id} className="hover:bg-slate-50 dark:hover:bg-zinc-800/20 text-slate-700 dark:text-gray-300">
                      <td className="py-2 px-3 font-mono text-slate-500 dark:text-zinc-400">{intg.xmin.toFixed(3)}</td>
                      <td className="py-2 px-3 font-mono text-slate-500 dark:text-zinc-400">{intg.xmax.toFixed(3)}</td>
                      <td className="py-2 px-3 font-mono font-bold text-emerald-600 dark:text-emerald-400">{intg.area.toFixed(5)}</td>
                      <td className="py-2 px-2 text-right">
                        <button
                          onClick={() => handleDeleteIntegral(intg.id)}
                          className="text-slate-400 dark:text-zinc-500 hover:text-rose-500 p-1 rounded transition"
                          title="Purge Integral Range"
                        >
                          <Trash2 size={12} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
 
        {/* HISTORY PANE */}
        {activeSubTab === 'history' && (
          <div className="flex flex-col gap-1 px-1 py-1 max-h-[140px] overflow-y-auto w-full select-text text-[10px]">
            {sd.history.map((log, index) => (
              <div key={index} className="flex gap-2 font-mono text-slate-550 dark:text-zinc-405 hover:text-teal-600 dark:hover:text-teal-400 transition-colors leading-relaxed">
                <span className="text-slate-400 dark:text-zinc-600 font-medium shrink-0">{(index+1).toString().padStart(2, '0')}.</span>
                <span>{log}</span>
              </div>
            ))}
          </div>
        )}
 
      </div>
 
      {/* Shared Datalist support for dynamic technique options */}
      <datalist id="transition-presets">
        {getDatalistPresetsForTechnique(sd.technique).map((pres) => (
          <option key={pres} value={pres} />
        ))}
      </datalist>
 
    </div>
  );
};
