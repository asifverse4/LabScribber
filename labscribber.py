"""
Labscribber (SpectraForge Edition): Ultimate Scientific Visualization and Plotting Toolkit
A professional application for computational chemists and materials scientists.
Features: 1st/2nd Derivatives, SVD-PCA, Bounded LM Fitting, 3D Waterfall, 2D Contour Heatmaps,
Real-Time Snapping Crosshairs, Mnova Heuristic Expert System, Smart Ingestion (Excel/CSV/TXT),
Undo/Redo State Manager, and High-Provenance HDF5 Workspaces.
"""

import sys
import os
import csv
import json
import logging
import datetime
import argparse
import subprocess
from typing import List, Tuple, Dict, Optional, Any

# Dynamic Dependency Handler
def ensure_dependencies():
    required = {
        'numpy': 'numpy', 'scipy': 'scipy', 'pandas': 'pandas', 
        'matplotlib': 'matplotlib', 'PySide6': 'PySide6', 'h5py': 'h5py',
        'openpyxl': 'openpyxl', 'xlrd': 'xlrd'
    }
    for pkg, imp in required.items():
        try:
            __import__(imp)
        except ImportError:
            print(f"Installing {pkg}...")
            subprocess.check_call([sys.executable, "-m", "pip", "install", pkg])

if '--cli' not in sys.argv:
    ensure_dependencies()

import h5py
import numpy as np
import pandas as pd
from scipy import sparse
from scipy.sparse.linalg import spsolve
from scipy.signal import savgol_filter, find_peaks
from scipy.interpolate import interp1d
from scipy.optimize import curve_fit
from scipy.integrate import trapezoid
from scipy.special import voigt_profile
from scipy.stats import linregress

import matplotlib
matplotlib.use('QtAgg' if '--cli' not in sys.argv else 'Agg')
import matplotlib.pyplot as plt
from matplotlib.backends.backend_qtagg import FigureCanvasQTAgg, NavigationToolbar2QT
from matplotlib.figure import Figure
from mpl_toolkits.mplot3d import Axes3D
from matplotlib.ticker import AutoMinorLocator

from PySide6.QtWidgets import (
    QApplication, QMainWindow, QWidget, QVBoxLayout, QHBoxLayout, 
    QPushButton, QListWidget, QComboBox, QFileDialog, QLabel, 
    QSlider, QFormLayout, QCheckBox, QDoubleSpinBox, QSpinBox,
    QColorDialog, QSplitter, QGroupBox, QTabWidget, QMessageBox, QTableWidget, QTableWidgetItem,
    QAbstractItemView, QDialog, QDialogButtonBox, QLineEdit, QListWidgetItem, QMenu,
    QRadioButton, QScrollArea, QHeaderView
)
from PySide6.QtCore import Qt, QTimer
from PySide6.QtGui import QColor, QPalette, QShortcut, QKeySequence

# ==========================================
# CONFIGURATION & LOGGING & STYLING
# ==========================================
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger("Labscribber")

MODERN_QSS = """
QMainWindow { background-color: #1e1e1e; color: #cccccc; }
QWidget { font-family: "Segoe UI", sans-serif; font-size: 10pt; }
QGroupBox { border: 1px solid #3e3e42; border-radius: 4px; margin-top: 2ex; padding: 10px; background-color: #252526; }
QGroupBox::title { subcontrol-origin: margin; subcontrol-position: top left; padding: 0 5px; color: #4fc1ff; font-weight: bold; }
QPushButton { background-color: #0e639c; color: #fff; border: none; border-radius: 4px; padding: 6px 12px; font-weight: bold; }
QPushButton:hover { background-color: #1177bb; }
QPushButton#btn_export { background-color: #c72a2a; }
QTabWidget::pane { border: 1px solid #3e3e42; background-color: #252526; }
QTabBar::tab { background-color: #2d2d2d; color: #969696; padding: 8px 16px; border: 1px solid #3e3e42; border-bottom: none; border-top-left-radius: 4px; border-top-right-radius: 4px; }
QTabBar::tab:selected { background-color: #1e1e1e; color: #fff; border-top: 2px solid #4fc1ff; }
QListWidget, QTableWidget { background-color: #1e1e1e; border: 1px solid #3e3e42; color: #cccccc; gridline-color: #3e3e42; border-radius: 4px; }
QHeaderView::section { background-color: #2d2d30; color: #4fc1ff; border: 1px solid #3e3e42; padding: 4px; font-weight: bold; }
QLineEdit { background-color: #333337; border: 1px solid #3e3e42; color: #fff; padding: 4px; border-radius: 3px; }
QListWidget::item:selected { background-color: #094771; }

/* ROBUST SPINBOX UP/DOWN BUTTON FIX */
QSpinBox, QDoubleSpinBox {
    background-color: #333337; border: 1px solid #3e3e42; color: #ffffff;
    padding: 4px; padding-right: 20px; border-radius: 3px; min-height: 20px;
}
QSpinBox::up-button, QDoubleSpinBox::up-button {
    subcontrol-origin: border; subcontrol-position: top right; width: 18px;
    border-left: 1px solid #3e3e42; background-color: #2d2d30; border-top-right-radius: 3px;
}
QSpinBox::up-button:hover, QDoubleSpinBox::up-button:hover { background-color: #0e639c; }
QSpinBox::up-arrow, QDoubleSpinBox::up-arrow {
    image: none; border-left: 4px solid transparent; border-right: 4px solid transparent; border-bottom: 5px solid #cccccc; width: 0; height: 0;
}
QSpinBox::down-button, QDoubleSpinBox::down-button {
    subcontrol-origin: border; subcontrol-position: bottom right; width: 18px;
    border-left: 1px solid #3e3e42; border-top: 1px solid #3e3e42; background-color: #2d2d30; border-bottom-right-radius: 3px;
}
QSpinBox::down-button:hover, QDoubleSpinBox::down-button:hover { background-color: #0e639c; }
QSpinBox::down-arrow, QDoubleSpinBox::down-arrow {
    image: none; border-left: 4px solid transparent; border-right: 4px solid transparent; border-top: 5px solid #cccccc; width: 0; height: 0;
}

/* COMBOBOX ARROW FIX */
QComboBox { background-color: #333337; border: 1px solid #3e3e42; color: #ffffff; padding: 4px; padding-right: 20px; border-radius: 3px; }
QComboBox::drop-down { subcontrol-origin: padding; subcontrol-position: top right; width: 18px; border-left: 1px solid #3e3e42; }
QComboBox::down-arrow { image: none; border-left: 4px solid transparent; border-right: 4px solid transparent; border-top: 5px solid #cccccc; width: 0; height: 0; }
"""

JOURNAL_STYLES = {
    "Nature": {
        "font.family": "sans-serif", "font.sans-serif": ["Arial", "Helvetica", "sans-serif"],
        "font.size": 7, "axes.linewidth": 1.0, "axes.labelsize": 7,
        "xtick.labelsize": 7, "ytick.labelsize": 7, "lines.linewidth": 1.0,
        "legend.fontsize": 7, "figure.dpi": 600
    },
    "ACS": {
        "font.family": "sans-serif", "font.sans-serif": ["Arial", "Helvetica", "sans-serif"],
        "font.size": 10, "axes.linewidth": 1.5, "axes.labelsize": 10,
        "xtick.labelsize": 10, "ytick.labelsize": 10, "lines.linewidth": 1.5,
        "legend.fontsize": 9, "figure.dpi": 600
    },
    "RSC": {
        "font.family": "serif", "font.serif": ["Times New Roman", "serif"],
        "font.size": 10, "axes.linewidth": 1.2, "axes.labelsize": 10,
        "xtick.labelsize": 10, "ytick.labelsize": 10, "lines.linewidth": 1.2,
        "legend.fontsize": 9, "figure.dpi": 600
    }
}
TECHNIQUES = ["UV-Vis Spectroscopy", "FTIR Spectroscopy", "1H NMR Spectroscopy", "13C NMR Spectroscopy", "Raman Spectroscopy", "Fluorescence", "XRD", "XPS", "Cyclic Voltammetry"]

# ==========================================
# UNIVERSAL DATA INGESTION ENGINE
# ==========================================
class DataIngestion:
    @staticmethod
    def smart_load_multi(filepath: str) -> List[Tuple[str, np.ndarray, np.ndarray]]:
        """Universal loader extracting multiple Y columns against a shared X column. 
           Reads Excel/CSV headers dynamically."""
        ext = os.path.splitext(filepath)[1].lower()
        results = []
        try:
            if ext in ['.xlsx', '.xls']:
                df_raw = pd.read_excel(filepath, header=None)
            else:
                df_raw = pd.read_csv(filepath, sep=None, engine='python', header=None, comment='#')
            
            df_num = df_raw.apply(pd.to_numeric, errors='coerce')
            data_rows = df_num.dropna(thresh=2)
            
            if data_rows.empty:
                raise ValueError("Could not find numerical data block.")
            
            valid_cols = data_rows.dropna(axis=1, how='all').columns
            if len(valid_cols) < 2:
                raise ValueError("Need at least one X and one Y column.")
            
            first_data_idx = data_rows.index[0]
            headers = [f"Series {i}" for i in range(df_raw.shape[1])]
            if first_data_idx > 0:
                potential_headers = df_raw.iloc[first_data_idx - 1].fillna("").astype(str).tolist()
                for i, h in enumerate(potential_headers):
                    if h.strip() and str(h).lower() != 'nan':
                        headers[i] = h.strip()
            
            x_col = valid_cols[0]
            x_arr = data_rows[x_col].values
            sort_idx = np.argsort(x_arr)
            x_sorted = x_arr[sort_idx]
            
            for y_col in valid_cols[1:]:
                y_arr = data_rows[y_col].values
                valid_mask = ~np.isnan(x_sorted) & ~np.isnan(y_arr[sort_idx])
                if np.sum(valid_mask) > 0:
                    y_sorted = y_arr[sort_idx][valid_mask]
                    x_clean = x_sorted[valid_mask]
                    col_name = headers[y_col]
                    base_filename = os.path.basename(filepath)
                    if col_name.startswith("Series ") or col_name.lower() in ["y", "abs", "intensity"]:
                        dataset_name = f"{base_filename} ({col_name})"
                    else:
                        dataset_name = f"{col_name} ({base_filename})"
                    results.append((dataset_name, x_clean, y_sorted))
            return results
        except Exception as e:
            raise ValueError(f"Parsing failed: {e}")

# ==========================================
# EXPERT SYSTEM: HEURISTIC INTERPRETATION
# ==========================================
class SpectralExpert:
    @staticmethod
    def interpret_peak(technique: str, x: float) -> Tuple[str, float]:
        if "1H NMR" in technique:
            if 0.5 <= x <= 1.5: return ("Alkyl ($-CH_3, -CH_2-$)", 0.95)
            if 1.5 <= x <= 2.5: return ("Allylic/$\\alpha$-Carbonyl", 0.85)
            if 2.5 <= x <= 4.5: return ("$\\alpha$-Heteroatom", 0.90)
            if 4.5 <= x <= 6.5: return ("Vinylic $=C-H$", 0.80)
            if 6.5 <= x <= 8.5: return ("Aromatic $C-H$", 0.98)
            if 9.0 <= x <= 10.5: return ("Aldehyde $-CHO$", 0.99)
            if 10.5 <= x <= 12.0: return ("Carboxylic Acid $-COOH$", 0.95)
        elif "FTIR" in technique:
            if 3200 <= x <= 3600: return ("O-H / N-H Stretch", 0.90)
            if 2800 <= x <= 3100: return ("C-H Stretch", 0.95)
            if 1650 <= x <= 1750: return ("C=O Carbonyl Stretch", 0.98)
            if 1550 <= x <= 1650: return ("C=C / Aromatic Stretch", 0.85)
            if 1000 <= x <= 1300: return ("C-O Stretch", 0.80)
        elif "UV-Vis" in technique:
            if 200 <= x <= 250: return ("Aromatic $\\pi \\rightarrow \\pi^*$", 0.85)
            if 250 <= x <= 350: return ("$n \\rightarrow \\pi^*$ / Defect", 0.80)
        elif "XPS" in technique:
            if 284 <= x <= 285: return ("C 1s ($C-C/C=C$)", 0.95)
            if 286 <= x <= 289: return ("C 1s ($C-O, C=O$)", 0.90)
            if 531 <= x <= 533: return ("O 1s", 0.99)
        return ("Unassigned", 0.0)

# ==========================================
# DATA MODELS & PROVENANCE
# ==========================================
class PeakData:
    def __init__(self, x: float, y: float):
        self.x, self.y, self.label, self.confidence = x, y, "", 0.0
        self.dx, self.dy = 0.0, 40.0  

class IntegralData:
    def __init__(self, xmin: float, xmax: float, area: float):
        self.xmin, self.xmax, self.area = xmin, xmax, area
        
class SpectrumData:
    def __init__(self, x: np.ndarray, y: np.ndarray, name: str, technique: str, color: str = '#1f77b4'):
        self.x_orig, self.y_orig = np.copy(x), np.copy(y)
        self.x, self.y_raw, self.y_processed = x, y, np.copy(y)
        self.name, self.technique, self.color = name, technique, color
        self.peaks, self.integrals = [], []
        self.baseline, self.fit_result, self.fit_components, self.fit_residuals = None, None, [], None
        self.is_tauc, self.tauc_data, self.jobs_data = False, None, None
        
        # Style Attributes
        self.visible = True
        self.line_width = 1.5
        self.line_style = '-'
        self.marker = 'None'
        self.marker_size = 6

        # State Stack for Undo/Redo
        self.undo_stack: List[np.ndarray] = [np.copy(self.y_processed)]
        self.redo_stack: List[np.ndarray] = []
        self.history: List[str] = [f"[{datetime.datetime.now().strftime('%H:%M:%S')}] Imported raw data ({len(x)} points)."]

    def log(self, action: str):
        self.history.append(f"[{datetime.datetime.now().strftime('%H:%M:%S')}] {action}")

    def commit_state(self):
        """Pushes current processed state to undo stack and clears redo stack."""
        self.undo_stack.append(np.copy(self.y_processed))
        self.redo_stack.clear()

    def undo(self) -> bool:
        if len(self.undo_stack) > 1:
            self.redo_stack.append(self.undo_stack.pop())
            self.y_processed = np.copy(self.undo_stack[-1])
            return True
        return False

    def redo(self) -> bool:
        if self.redo_stack:
            state = self.redo_stack.pop()
            self.undo_stack.append(state)
            self.y_processed = np.copy(state)
            return True
        return False

# ==========================================
# ANALYTICS ENGINE
# ==========================================
class DataProcessor:
    @staticmethod
    def smooth_savgol_deriv(y: np.ndarray, window: int = 11, polyorder: int = 2, deriv: int = 0) -> np.ndarray:
        if window % 2 == 0: window += 1
        if window <= polyorder: return y
        try:
            return savgol_filter(y, window, polyorder, deriv=deriv)
        except Exception as e:
            logger.error(f"Derivative calculus failed: {e}")
            return y

    @staticmethod
    def smooth_data(sd: SpectrumData, method: str, window: int = 11, polyorder: int = 2, deriv: int = 0):
        if window % 2 == 0: window += 1
        if method == "Savitzky-Golay":
            if window > polyorder:
                sd.y_processed = savgol_filter(sd.y_processed, window, polyorder, deriv=deriv)
                sd.log(f"Applied Savitzky-Golay (window={window}, poly={polyorder}, deriv={deriv}).")
        elif method == "Moving Average":
            kernel = np.ones(window) / window
            sd.y_processed = np.convolve(sd.y_processed, kernel, mode='same')
            sd.log(f"Applied Moving Average Smoothing (window={window}).")

    @staticmethod
    def baseline_als(y: np.ndarray, lam: float = 1e5, p: float = 0.01, niter: int = 10) -> np.ndarray:
        L = len(y)
        D = sparse.diags([1, -2, 1], [0, 1, 2], shape=(L, L - 2))
        D = lam * D.dot(D.transpose())
        w = np.ones(L)
        for _ in range(niter):
            W = sparse.spdiags(w, 0, L, L)
            Z = W + D
            try: z = spsolve(Z, w * y)
            except Exception as e:
                logger.error(f"Baseline ALS failed: {e}")
                return np.zeros_like(y)
            w = p * (y > z) + (1 - p) * (y < z)
        return z

    @staticmethod
    def baseline_shirley(sd: SpectrumData, max_iter: int = 10):
        y = sd.y_processed; bg = np.copy(y)
        for _ in range(max_iter):
            last_bg = np.copy(bg)
            for j in range(len(y)-2, -1, -1):
                bg[j] = y[-1] + (y[0] - y[-1]) * np.sum(y[j:] - bg[j:]) / np.sum(y - bg)
            if np.linalg.norm(bg - last_bg) < 1e-5: break
        sd.baseline = bg; sd.y_processed = sd.y_processed - bg
        sd.log("Subtracted Shirley Iterative Baseline.")

    @staticmethod
    def subtract_blank(sd_main: SpectrumData, sd_bg: SpectrumData):
        f = interp1d(sd_bg.x, sd_bg.y_processed, bounds_error=False, fill_value="extrapolate")
        sd_main.y_processed = sd_main.y_processed - f(sd_main.x)
        sd_main.log(f"Subtracted blank spectrum '{sd_bg.name}'.")

    @staticmethod
    def normalize_minmax(sd: SpectrumData):
        y_min, y_max = np.min(sd.y_processed), np.max(sd.y_processed)
        if y_max > y_min:
            sd.y_processed = (sd.y_processed - y_min) / (y_max - y_min)
            sd.log("Normalized Y-axis intensities to range [0, 1].")

    @staticmethod
    def find_spectrum_peaks(x: np.ndarray, y: np.ndarray, prominence: float = 0.1, distance: int = 10) -> List[PeakData]:
        peak_indices, _ = find_peaks(y, prominence=prominence, distance=distance)
        return [PeakData(x[i], y[i]) for i in peak_indices]

    @staticmethod
    def convert_to_tauc(sd: SpectrumData, transition='direct'):
        e_ev = 1240.0 / sd.x; sort_indices = np.argsort(e_ev)
        e_ev, alpha = e_ev[sort_indices], sd.y_processed[sort_indices]
        y_tauc = (alpha * e_ev)**2 if transition == 'direct' else (alpha * e_ev)**0.5
        
        dy_dx = np.gradient(y_tauc, e_ev)
        search = slice(int(len(dy_dx)*0.1), int(len(dy_dx)*0.9))
        max_idx = np.argmax(dy_dx[search]) + int(len(dy_dx)*0.1)
        x_fit, y_fit = e_ev[max_idx-5 : max_idx+5], y_tauc[max_idx-5 : max_idx+5]
        
        sd.x, sd.y_processed, sd.is_tauc = e_ev, y_tauc, True
        if len(x_fit) > 1:
            m, c, _, _, _ = linregress(x_fit, y_fit)
            sd.tauc_data = {'m': m, 'c': c, 'eg': -c/m, 'x_start': e_ev[max_idx]-0.5, 'x_end': -c/m}
            sd.log(f"Transformed to {transition} Tauc Plot. Extrapolated Bandgap (Eg) = {-c/m:.3f} eV.")
        else:
            sd.log(f"Transformed to {transition} Tauc Plot. Extrapolation failed.")

    @staticmethod
    def run_pca(datasets: List[SpectrumData]) -> Tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
        """Calculates Principal Component Analysis (SVD) across multi-column spectra arrays."""
        if len(datasets) < 2:
            raise ValueError("PCA requires at least 2 datasets.")
        
        ref_x = datasets[0].x
        matrix = []
        for ds in datasets:
            f = interp1d(ds.x, ds.y_processed, bounds_error=False, fill_value="extrapolate")
            matrix.append(f(ref_x))
            
        matrix = np.array(matrix)
        mean_centered = matrix - np.mean(matrix, axis=0)
        
        U, S, Vt = np.linalg.svd(mean_centered, full_matrices=False)
        scores = U * S
        loadings = Vt
        explained_variance = (S**2) / np.sum(S**2)
        
        return ref_x, scores, loadings, explained_variance

class PeakFitter:
    @staticmethod
    def gaussian(x, amp, cen, wid): return amp * np.exp(-(x-cen)**2 / (2*wid**2))
    @staticmethod
    def lorentzian(x, amp, cen, wid): return amp * wid**2 / ((x-cen)**2 + wid**2)
    @staticmethod
    def voigt(x, amp, cen, wid): return amp * voigt_profile(x - cen, wid/2, wid/2)

    @classmethod
    def fit_peaks(cls, sd: SpectrumData, profile='Gaussian', center_tolerance=10.0, min_width=1.0, max_width=100.0, enforce_bounds=False):
        if not sd.peaks: raise ValueError("No peaks provided.")
        p0 = []
        bounds_lower, bounds_upper = [], []
        
        for p in sd.peaks:
            amp_est = p.y
            width_est = (np.max(sd.x) - np.min(sd.x)) / 50.0
            p0.extend([amp_est, p.x, width_est])
            
            if enforce_bounds:
                bounds_lower.extend([0.0, p.x - center_tolerance, min_width])
                bounds_upper.extend([amp_est * 2.5, p.x + center_tolerance, max_width])

        def combined(x_data, *p_args):
            y_fit = np.zeros_like(x_data)
            for i in range(len(sd.peaks)):
                a, c, w = p_args[i*3 : i*3+3]
                if profile == 'Gaussian': y_fit += cls.gaussian(x_data, a, c, w)
                elif profile == 'Lorentzian': y_fit += cls.lorentzian(x_data, a, c, w)
                elif profile == 'Voigt': y_fit += cls.voigt(x_data, a, c, w)
            return y_fit

        if enforce_bounds:
            popt, _ = curve_fit(combined, sd.x, sd.y_processed, p0=p0, bounds=(bounds_lower, bounds_upper), maxfev=10000)
        else:
            popt, _ = curve_fit(combined, sd.x, sd.y_processed, p0=p0, maxfev=10000)

        comps = []
        for i in range(len(sd.peaks)):
            a, c, w = popt[i*3 : i*3+3]
            if profile == 'Gaussian': comps.append(cls.gaussian(sd.x, a, c, w))
            elif profile == 'Lorentzian': comps.append(cls.lorentzian(sd.x, a, c, w))
            elif profile == 'Voigt': comps.append(cls.voigt(sd.x, a, c, w))
        
        sd.fit_result = combined(sd.x, *popt)
        sd.fit_components = comps
        sd.fit_residuals = sd.y_processed - sd.fit_result
        sd.log(f"Executed Levenberg-Marquardt Deconvolution ({profile} profile).")

class ReportGenerator:
    @staticmethod
    def generate_markdown(sd: SpectrumData, filename: str):
        with open(filename, 'w') as f:
            f.write(f"# Labscribber Analytical Report\n\n**Dataset:** {sd.name}  \n**Technique:** {sd.technique}  \n\n")
            f.write("## Provenance & Processing History\n")
            for entry in sd.history: f.write(f"- {entry}\n")
            f.write("\n## Detected Peaks & AI Assignments\n| X | Y | Expert Assignment | Confidence |\n|---|---|---|---|\n")
            for p in sd.peaks: f.write(f"| {p.x:.2f} | {p.y:.3f} | {p.label} | {p.confidence:.2f} |\n")
            if sd.integrals:
                f.write("\n## Area Integrations\n| X-Min | X-Max | Area |\n|---|---|---|\n")
                for i in sd.integrals: f.write(f"| {i.xmin:.2f} | {i.xmax:.2f} | {i.area:.4g} |\n")
            if sd.is_tauc and sd.tauc_data:
                f.write(f"\n## Solid-State Physics\n- **Optical Bandgap ($E_g$):** {sd.tauc_data['eg']:.3f} eV\n")
            if sd.jobs_data:
                f.write(f"\n## Job's Plot Stoichiometry\n- **Intersection ($X$):** {sd.jobs_data['x_int']:.3f}\n")

# ==========================================
# HEADLESS CLI (BATCH PIPELINE)
# ==========================================
def run_cli_pipeline(args):
    print(f"Labscribber Headless CLI initialized. Processing directory: {args.input}")
    if not os.path.exists(args.output): os.makedirs(args.output)
    files = [f for f in os.listdir(args.input) if f.endswith(('.csv', '.txt', '.dat', '.xlsx', '.xls'))]
    for file in files:
        filepath = os.path.join(args.input, file)
        try:
            extracted_data = DataIngestion.smart_load_multi(filepath)
        except Exception as e:
            print(f"Skipping {file}: {e}")
            continue
            
        for name, x_val, y_val in extracted_data:
            sd = SpectrumData(x_val, y_val, name, args.tech)
            
            if args.smooth: DataProcessor.smooth_data(sd, 'Savitzky-Golay', window=args.smooth)
            if args.baseline == 'ALS': 
                sd.baseline = DataProcessor.baseline_als(sd.y_processed)
                sd.y_processed = sd.y_processed - sd.baseline
            elif args.baseline == 'Shirley': DataProcessor.baseline_shirley(sd)
            
            if args.tauc: DataProcessor.convert_to_tauc(sd, transition=args.tauc)
            else:
                indices, _ = find_peaks(sd.y_processed, prominence=0.1)
                for i in indices:
                    p = PeakData(sd.x[i], sd.y_processed[i])
                    p.label, p.confidence = SpectralExpert.interpret_peak(sd.technique, p.x)
                    sd.peaks.append(p)
                    
            safe_name = name.replace("/", "_").replace("\\", "_").replace(" ", "_")
            ReportGenerator.generate_markdown(sd, os.path.join(args.output, f"{safe_name}_report.md"))
            print(f"Processed {name}")
            
    print("Batch processing complete.")
    sys.exit(0)

# ==========================================
# GUI CLASSES
# ==========================================
if '--cli' not in sys.argv:
    class JobsPlotDialog(QDialog):
        def __init__(self, datasets, parent=None):
            super().__init__(parent)
            self.setWindowTitle("Job's Plot Configuration")
            self.resize(450, 500)
            layout = QVBoxLayout(self)
            form = QFormLayout()
            self.spin_target = QDoubleSpinBox(); self.spin_target.setRange(-5000, 5000); self.spin_target.setValue(400)
            form.addRow("Target Wavelength/Shift:", self.spin_target)
            layout.addLayout(form)
            
            self.table = QTableWidget(len(datasets), 2)
            self.table.setHorizontalHeaderLabels(["Dataset", "Mole Fraction ($X$)"])
            self.table.horizontalHeader().setSectionResizeMode(QHeaderView.Stretch)
            fractions = np.linspace(0, 1, len(datasets))
            for i, (ds, frac) in enumerate(zip(datasets, fractions)):
                self.table.setItem(i, 0, QTableWidgetItem(ds.name)); self.table.item(i, 0).setFlags(Qt.ItemIsEnabled)
                self.table.setItem(i, 1, QTableWidgetItem(f"{frac:.3f}"))
            layout.addWidget(self.table)
            self.bbox = QDialogButtonBox(QDialogButtonBox.Ok | QDialogButtonBox.Cancel)
            self.bbox.accepted.connect(self.accept); self.bbox.rejected.connect(self.reject)
            layout.addWidget(self.bbox)

        def get_data(self):
            return self.spin_target.value(), np.array([float(self.table.item(i, 1).text()) for i in range(self.table.rowCount())])

    class PlotCanvas(FigureCanvasQTAgg):
        def __init__(self, parent=None, width=8, height=6, dpi=100):
            self.fig = Figure(figsize=(width, height), dpi=dpi)
            super(PlotCanvas, self).__init__(self.fig)
            self.setParent(parent)
            self.fig.tight_layout()

    class PCADialog(QDialog):
        def __init__(self, datasets: List[SpectrumData], parent=None):
            super().__init__(parent)
            self.setWindowTitle("Multivariate Analysis: Principal Component Analysis (PCA)")
            self.resize(900, 600)
            layout = QVBoxLayout(self)
            self.canvas = PlotCanvas(self, width=8, height=5)
            layout.addWidget(self.canvas)
            try:
                ref_x, scores, loadings, explained_var = DataProcessor.run_pca(datasets)
                ax1 = self.canvas.fig.add_subplot(121)
                for i, ds in enumerate(datasets):
                    ax1.scatter(scores[i, 0], scores[i, 1], label=ds.name, s=100, edgecolors='black', alpha=0.8)
                ax1.set_xlabel(f"PC1 ({explained_var[0]*100:.1f}%)")
                ax1.set_ylabel(f"PC2 ({explained_var[1]*100:.1f}%)")
                ax1.set_title("PCA Scores Plot")
                ax1.legend(fontsize=7, loc='best')
                ax1.grid(True, linestyle=':', alpha=0.3)
                
                ax2 = self.canvas.fig.add_subplot(122)
                ax2.plot(ref_x, loadings[0], label="PC1 Loadings", color="#4fc1ff", lw=1.5)
                ax2.plot(ref_x, loadings[1], label="PC2 Loadings", color="#e74c3c", lw=1.5)
                ax2.set_xlabel("X-Axis Variable")
                ax2.set_ylabel("Component Weighting")
                ax2.set_title("PCA Loading Profiles")
                ax2.legend(fontsize=7, loc='best')
                ax2.grid(True, linestyle=':', alpha=0.3)
                self.canvas.fig.tight_layout()
                self.canvas.draw()
            except Exception as e:
                layout.addWidget(QLabel(f"PCA Math Error: {e}"))
            bbox = QDialogButtonBox(QDialogButtonBox.Ok)
            bbox.accepted.connect(self.accept)
            layout.addWidget(bbox)

    class LabscribberApp(QMainWindow):
        def __init__(self):
            super().__init__()
            self.setWindowTitle("Labscribber Pro - Enterprise Analytical Suite (JOSS Edition)")
            self.resize(1800, 1000)
            self.setStyleSheet(MODERN_QSS)
            self.datasets: List[SpectrumData] = []
            self.current_dataset: Optional[SpectrumData] = None
            self.plot_bg_color = "#ffffff"
            self._updating_table = False
            self._updating_list = False
            self._init_ui()
            self._setup_shortcuts()
            self._connect_canvas_interactions()
            
            # Professional Welcome Banner Timer
            QTimer.singleShot(400, self.show_welcome_popup)
            
        def show_welcome_popup(self):
            """Launches a high-provenance welcome modal with credits."""
            welcome_box = QMessageBox(self)
            welcome_box.setWindowTitle("Welcome to Labscribber Pro")
            welcome_box.setText(
                "<h3>Thank you for choosing Labscribber Pro!</h3>"
                "<p>Made with ❤️ by <b>Asif Raza</b> and inspired by <b>Imran A. Khan</b>.</p>"
                "<p>This platform provides professional, citable, and reproducible "
                "spectral analysis workflows for physical scientists and peer-review processes.</p>"
            )
            welcome_box.setIcon(QMessageBox.Information)
            welcome_box.setStyleSheet(
                "QLabel { color: #cccccc; font-size: 10.5pt; } "
                "QPushButton { background-color: #0e639c; color: white; padding: 6px 12px; font-weight: bold; border-radius: 4px; }"
                "QPushButton:hover { background-color: #1177bb; }"
            )
            welcome_box.exec()

        def _init_ui(self):
            central_widget = QWidget(); self.setCentralWidget(central_widget)
            main_layout = QHBoxLayout(central_widget)
            main_splitter = QSplitter(Qt.Horizontal); main_layout.addWidget(main_splitter)
            
            # --- 1. LEFT PANEL (Data Object Tree) ---
            left_panel = QWidget(); left_layout = QVBoxLayout(left_panel)
            ws_layout = QHBoxLayout()
            self.btn_save_ws = QPushButton("💾 Save .h5"); self.btn_load_ws = QPushButton("📂 Load .h5")
            self.btn_save_ws.clicked.connect(self.save_workspace); self.btn_load_ws.clicked.connect(self.load_workspace)
            ws_layout.addWidget(self.btn_save_ws); ws_layout.addWidget(self.btn_load_ws)
            
            self.btn_load = QPushButton("Import Data (Excel, CSV, TXT)")
            self.btn_load.clicked.connect(self.load_data)
            self.btn_sample = QPushButton("🧪 Generate Test Data ▾")
            menu = QMenu(self)
            menu.addAction("Simulate CQD UV-Vis", lambda: self.generate_sample_data("UV-Vis"))
            menu.addAction("Simulate 1H NMR", lambda: self.generate_sample_data("NMR"))
            self.btn_sample.setMenu(menu)
            
            self.technique_combo = QComboBox(); self.technique_combo.addItems(TECHNIQUES)
            
            self.data_list = QListWidget() 
            self.data_list.setSelectionMode(QAbstractItemView.ExtendedSelection)
            self.data_list.itemSelectionChanged.connect(self.on_data_selected)
            self.data_list.itemChanged.connect(self.on_item_state_changed)
            
            left_layout.addWidget(QLabel("<b>Project Management</b>")); left_layout.addLayout(ws_layout)
            left_layout.addWidget(QLabel("<b>Data Ingestion</b>")); left_layout.addWidget(self.technique_combo)
            left_layout.addWidget(self.btn_load); left_layout.addWidget(self.btn_sample)
            left_layout.addWidget(QLabel("<b>Object Browser</b>\n(Check to Show/Hide | Double-click to Rename)")); left_layout.addWidget(self.data_list)
            
            # --- 2. CENTER PANEL (Plot & Bottom Tables) ---
            center_splitter = QSplitter(Qt.Vertical)
            plot_panel = QWidget(); plot_layout = QVBoxLayout(plot_panel)
            interactive_layout = QHBoxLayout()
            self.mode_nav = QRadioButton("Navigate"); self.mode_nav.setChecked(True)
            self.mode_peak = QRadioButton("Add Peak (Click)"); self.mode_crop = QRadioButton("Crop X-Range (Drag)")
            self.mode_integrate = QRadioButton("Integrate (Drag)") 
            for mode in [self.mode_nav, self.mode_peak, self.mode_crop, self.mode_integrate]:
                mode.toggled.connect(self.on_mode_change); interactive_layout.addWidget(mode)
            interactive_layout.addStretch()
            
            self.lbl_cursor = QLabel("Snapped: X = 0.00, Y = 0.00")
            self.lbl_cursor.setStyleSheet("color: #4fc1ff; font-weight: bold; margin-left: 20px;")
            interactive_layout.addWidget(self.lbl_cursor)
            interactive_layout.addStretch()
            
            plot_layout.addWidget(QLabel("<b>Interactive Canvas Tools:</b>")); plot_layout.addLayout(interactive_layout)
            self.canvas = PlotCanvas(self, width=8, height=6, dpi=100)
            self.toolbar = NavigationToolbar2QT(self.canvas, self)
            plot_layout.addWidget(self.toolbar); plot_layout.addWidget(self.canvas)
            
            tables_panel = QWidget(); tables_layout = QVBoxLayout(tables_panel)
            tables_tabs = QTabWidget()
            self.peak_table = QTableWidget(0, 5)
            self.peak_table.setHorizontalHeaderLabels(["X", "Y", "Label (LaTeX)", "Text dX (↔)", "Text dY (↕)"])
            self.peak_table.horizontalHeader().setSectionResizeMode(QHeaderView.Stretch)
            self.peak_table.cellChanged.connect(self.sync_table_to_data)
            
            self.intg_table = QTableWidget(0, 3)
            self.intg_table.setHorizontalHeaderLabels(["X-Min", "X-Max", "Integral Area"])
            self.intg_table.horizontalHeader().setSectionResizeMode(QHeaderView.Stretch)
            
            tables_tabs.addTab(self.peak_table, "Detected Peaks & Annotations")
            tables_tabs.addTab(self.intg_table, "Integrated Regions")
            tables_layout.addWidget(tables_tabs)
            
            center_splitter.addWidget(plot_panel); center_splitter.addWidget(tables_panel)
            center_splitter.setSizes([700, 200])
            
            # --- 3. RIGHT PANEL (Tools Inspector) ---
            right_panel = QWidget(); right_layout = QVBoxLayout(right_panel)
            tools_tabs = QTabWidget()
            
            # Tab 1: Processing
            tab_proc = QWidget(); proc_layout = QVBoxLayout(tab_proc)
            grp_bg = QGroupBox("Background Subtraction")
            bg_layout = QFormLayout(grp_bg)
            self.combo_bg_subtract = QComboBox(); self.combo_bg_subtract.addItem("None")
            bg_layout.addRow("Subtract Blank:", self.combo_bg_subtract)
            
            grp_crop = QGroupBox("Precise Data Cropping")
            crop_layout = QFormLayout(grp_crop)
            self.spin_crop_min = QDoubleSpinBox(); self.spin_crop_min.setRange(-5000, 5000); self.spin_crop_min.setValue(250)
            self.spin_crop_max = QDoubleSpinBox(); self.spin_crop_max.setRange(-5000, 5000); self.spin_crop_max.setValue(800)
            self.btn_apply_crop = QPushButton("✂ Crop Selected Data")
            self.btn_apply_crop.clicked.connect(self.apply_manual_crop)
            crop_layout.addRow("Min X:", self.spin_crop_min)
            crop_layout.addRow("Max X:", self.spin_crop_max)
            crop_layout.addRow(self.btn_apply_crop)
            
            grp_prep = QGroupBox("Advanced Smoothing & Baseline")
            prep_layout = QFormLayout(grp_prep)
            
            self.chk_smooth = QCheckBox("Enable Smoothing")
            self.combo_smooth = QComboBox(); self.combo_smooth.addItems(["Savitzky-Golay", "Moving Average"])
            self.spin_window = QSpinBox(); self.spin_window.setRange(3, 999); self.spin_window.setSingleStep(2); self.spin_window.setValue(11)
            self.spin_poly = QSpinBox(); self.spin_poly.setRange(1, 9); self.spin_poly.setValue(2)
            self.combo_calc_deriv = QComboBox()
            self.combo_calc_deriv.addItems(["0 (Raw Intensity)", "1 (1st Derivative Calculus)", "2 (2nd Derivative Calculus)"])
            
            self.combo_baseline = QComboBox(); self.combo_baseline.addItems(["None", "ALS (IR/Raman)", "Shirley (XPS)"])
            self.spin_als_lam = QDoubleSpinBox(); self.spin_als_lam.setRange(1e2, 1e9); self.spin_als_lam.setValue(1e5)
            self.chk_normalize = QCheckBox("Normalize Y to [0, 1]")
            
            prep_layout.addRow(self.chk_smooth, self.combo_smooth)
            prep_layout.addRow("Window Size (Pts):", self.spin_window)
            prep_layout.addRow("Polynomial Order:", self.spin_poly)
            prep_layout.addRow("Derivative Calculus:", self.combo_calc_deriv)
            prep_layout.addRow("Baseline:", self.combo_baseline)
            prep_layout.addRow("ALS Lam:", self.spin_als_lam)
            prep_layout.addRow(self.chk_normalize)

            self.btn_apply_proc = QPushButton("Apply Processing")
            self.btn_apply_proc.clicked.connect(self.process_current_data)
            self.btn_reset = QPushButton("↺ Reset to Raw"); self.btn_reset.setObjectName("btn_reset"); self.btn_reset.clicked.connect(self.reset_current_data)
            
            proc_layout.addWidget(grp_bg); proc_layout.addWidget(grp_crop); proc_layout.addWidget(grp_prep); proc_layout.addWidget(self.btn_apply_proc); proc_layout.addWidget(self.btn_reset); proc_layout.addStretch()
            
            # Tab 2: Analytics & Expert
            tab_ana = QWidget(); ana_layout = QVBoxLayout(tab_ana)
            grp_expert = QGroupBox("Expert System & Auto-Detect")
            expert_layout = QVBoxLayout(grp_expert)
            self.btn_auto_pick = QPushButton("Auto-Detect Peaks (SciPy)"); self.btn_auto_pick.clicked.connect(self.auto_pick_peaks)
            self.btn_auto_interpret = QPushButton("🤖 Auto-Assign Labels (Mnova Style)")
            self.btn_auto_interpret.setObjectName("btn_interpret"); self.btn_auto_interpret.clicked.connect(self.run_expert_system)
            expert_layout.addWidget(self.btn_auto_pick); expert_layout.addWidget(self.btn_auto_interpret)
            
            grp_stoic = QGroupBox("Solid State & Stoichiometry")
            stoic_layout = QVBoxLayout(grp_stoic)
            self.btn_jobs = QPushButton("Generate Rigorous Job's Plot"); self.btn_jobs.setObjectName("btn_jobs"); self.btn_jobs.clicked.connect(self.run_jobs_plot)
            self.btn_tauc_direct = QPushButton("Direct Bandgap Extrap. ($E_g$)"); self.btn_tauc_direct.clicked.connect(lambda: self.apply_tauc('direct'))
            stoic_layout.addWidget(self.btn_jobs); stoic_layout.addWidget(self.btn_tauc_direct)

            grp_fit = QGroupBox("LM Deconvolution Constraints")
            fit_layout = QFormLayout(grp_fit)
            self.combo_fit_profile = QComboBox(); self.combo_fit_profile.addItems(["Gaussian", "Lorentzian", "Voigt"])
            self.chk_show_residuals = QCheckBox("Render Residuals Subplot"); self.chk_show_residuals.stateChanged.connect(self.update_plot)
            self.chk_constrain_fit = QCheckBox("Enforce Bounds Constraints")
            self.spin_constrain_tol = QDoubleSpinBox(); self.spin_constrain_tol.setRange(0.1, 500.0); self.spin_constrain_tol.setValue(10.0)
            self.spin_constrain_width_min = QDoubleSpinBox(); self.spin_constrain_width_min.setRange(0.1, 100.0); self.spin_constrain_width_min.setValue(1.0)
            self.spin_constrain_width_max = QDoubleSpinBox(); self.spin_constrain_width_max.setRange(1.0, 500.0); self.spin_constrain_width_max.setValue(50.0)
            self.btn_run_fit = QPushButton("Run Curve Fit"); self.btn_run_fit.clicked.connect(self.run_deconvolution)
            
            fit_layout.addRow("Profile:", self.combo_fit_profile)
            fit_layout.addRow(self.chk_show_residuals)
            fit_layout.addRow(self.chk_constrain_fit)
            fit_layout.addRow("Center Tolerance:", self.spin_constrain_tol)
            fit_layout.addRow("Min/Max Width Range:", self.spin_constrain_width_min)
            fit_layout.addRow("", self.spin_constrain_width_max)
            fit_layout.addRow(self.btn_run_fit)
            ana_layout.addWidget(grp_expert); ana_layout.addWidget(grp_stoic); ana_layout.addWidget(grp_fit); ana_layout.addStretch()

            # Tab 3: Plot Appearance
            tab_appear = QWidget(); appear_layout = QVBoxLayout(tab_appear)
            grp_curve_style = QGroupBox("Selected Curve Styling")
            curve_style_form = QFormLayout(grp_curve_style)
            self.spin_line_width = QDoubleSpinBox(); self.spin_line_width.setRange(0, 10); self.spin_line_width.setValue(1.5); self.spin_line_width.setSingleStep(0.5); self.spin_line_width.valueChanged.connect(self.apply_curve_style)
            self.combo_line_style = QComboBox(); self.combo_line_style.addItems(["Solid (-)", "Dashed (--)", "Dotted (:)", "None"]) ; self.combo_line_style.currentTextChanged.connect(self.apply_curve_style)
            self.combo_marker = QComboBox(); self.combo_marker.addItems(["None", "Circle (o)", "Square (s)", "Triangle (^)", "Cross (x)"]) ; self.combo_marker.currentTextChanged.connect(self.apply_curve_style)
            self.spin_marker_size = QSpinBox(); self.spin_marker_size.setRange(1, 30); self.spin_marker_size.setValue(6); self.spin_marker_size.valueChanged.connect(self.apply_curve_style)
            self.btn_color = QPushButton("Curve Color"); self.btn_color.clicked.connect(self.change_color)
            
            curve_style_form.addRow("Line Style:", self.combo_line_style)
            curve_style_form.addRow("Line Width:", self.spin_line_width)
            curve_style_form.addRow("Marker:", self.combo_marker)
            curve_style_form.addRow("Marker Size:", self.spin_marker_size)
            curve_style_form.addRow(self.btn_color)
            
            grp_axes = QGroupBox("Axes & Grid Controls")
            axes_form = QFormLayout(grp_axes)
            self.edit_x_label = QLineEdit(); self.edit_x_label.setPlaceholderText("Auto"); self.edit_x_label.textChanged.connect(self.update_plot)
            self.edit_y_label = QLineEdit(); self.edit_y_label.setPlaceholderText("Auto"); self.edit_y_label.textChanged.connect(self.update_plot)
            
            self.chk_auto_x = QCheckBox("Auto X Bounds"); self.chk_auto_x.setChecked(True); self.chk_auto_x.stateChanged.connect(self.update_plot)
            self.spin_lim_xmin = QDoubleSpinBox(); self.spin_lim_xmin.setRange(-1e6, 1e6); self.spin_lim_xmin.valueChanged.connect(self.update_plot)
            self.spin_lim_xmax = QDoubleSpinBox(); self.spin_lim_xmax.setRange(-1e6, 1e6); self.spin_lim_xmax.setValue(100); self.spin_lim_xmax.valueChanged.connect(self.update_plot)
            
            self.chk_auto_y = QCheckBox("Auto Y Bounds"); self.chk_auto_y.setChecked(True); self.chk_auto_y.stateChanged.connect(self.update_plot)
            self.spin_lim_ymin = QDoubleSpinBox(); self.spin_lim_ymin.setRange(-1e6, 1e6); self.spin_lim_ymin.valueChanged.connect(self.update_plot)
            self.spin_lim_ymax = QDoubleSpinBox(); self.spin_lim_ymax.setRange(-1e6, 1e6); self.spin_lim_ymax.setValue(100); self.spin_lim_ymax.valueChanged.connect(self.update_plot)

            self.chk_grid_x = QCheckBox("Show X Grid"); self.chk_grid_x.stateChanged.connect(self.update_plot)
            self.chk_grid_y = QCheckBox("Show Y Grid"); self.chk_grid_y.stateChanged.connect(self.update_plot)
            
            axes_form.addRow("X Label:", self.edit_x_label)
            axes_form.addRow("Y Label:", self.edit_y_label)
            axes_form.addRow(self.chk_auto_x)
            axes_form.addRow("Manual X Min:", self.spin_lim_xmin)
            axes_form.addRow("Manual X Max:", self.spin_lim_xmax)
            axes_form.addRow(self.chk_auto_y)
            axes_form.addRow("Manual Y Min:", self.spin_lim_ymin)
            axes_form.addRow("Manual Y Max:", self.spin_lim_ymax)
            axes_form.addRow(self.chk_grid_x, self.chk_grid_y)

            grp_legend = QGroupBox("Chart Settings")
            legend_form = QFormLayout(grp_legend)
            self.chk_show_legend = QCheckBox("Show Legend"); self.chk_show_legend.setChecked(True); self.chk_show_legend.stateChanged.connect(self.update_plot)
            self.combo_legend_pos = QComboBox(); self.combo_legend_pos.addItems(["best", "upper right", "upper left", "lower left", "lower right", "center left", "center right", "lower center", "upper center", "center"])
            self.combo_legend_pos.currentTextChanged.connect(self.update_plot)
            self.btn_bg_color = QPushButton("Canvas BG"); self.btn_bg_color.clicked.connect(self.change_bg_color)
            
            legend_form.addRow(self.chk_show_legend)
            legend_form.addRow("Legend Pos:", self.combo_legend_pos)
            legend_form.addRow(self.btn_bg_color)
            
            appear_layout.addWidget(grp_curve_style)
            appear_layout.addWidget(grp_axes)
            appear_layout.addWidget(grp_legend)
            appear_layout.addStretch()

            # Tab 4: Export & Layout
            tab_style = QWidget(); style_scroll = QScrollArea(); style_scroll.setWidgetResizable(True)
            style_content = QWidget(); style_layout = QFormLayout(style_content)
            
            self.btn_undo = QPushButton("↩ Undo Process (Ctrl+Z)")
            self.btn_undo.clicked.connect(self.undo_state)
            self.btn_redo = QPushButton("↪ Redo Process (Ctrl+Y)")
            self.btn_redo.clicked.connect(self.redo_state)
            style_layout.addRow("State Transactions:", self.btn_undo)
            style_layout.addRow("", self.btn_redo)
            
            self.combo_view_layout = QComboBox()
            self.combo_view_layout.addItems(["Standard Overlay", "Waterfall Stack (3D Projection)", "2D Heatmap / Contour Plot"])
            self.combo_view_layout.currentTextChanged.connect(self.update_plot)
            style_layout.addRow("Spectra Layout:", self.combo_view_layout)

            self.combo_journal = QComboBox(); self.combo_journal.addItems(["ACS", "Nature", "RSC", "Default"]); self.combo_journal.currentTextChanged.connect(self.update_plot)
            self.combo_fig_size = QComboBox(); self.combo_fig_size.addItems(["Auto", "ACS Single (3.33x2.5)", "Nature Double (7x5)"]); self.combo_fig_size.currentTextChanged.connect(self.update_plot)
            style_layout.addRow("Journal Standard:", self.combo_journal); style_layout.addRow("Dimensions Size:", self.combo_fig_size)
            
            self.combo_cmap = QComboBox()
            self.combo_cmap.addItems(["viridis", "plasma", "inferno", "coolwarm", "tab10"])
            self.btn_apply_cmap = QPushButton("Apply Overlay Gradient")
            self.btn_apply_cmap.clicked.connect(self.apply_colormap)
            style_layout.addRow(self.combo_cmap, self.btn_apply_cmap)
            
            self.btn_pca = QPushButton("Run SVD Multivariate PCA")
            self.btn_pca.setStyleSheet("background-color: #6a9955; font-weight: bold;")
            self.btn_pca.clicked.connect(self.run_multivariate_pca)
            style_layout.addRow("Multivariate PCA:", self.btn_pca)
            
            grp_pub = QGroupBox("Publication Aesthetics Layout")
            pub_layout = QFormLayout(grp_pub)
            self.chk_pub_axes = QCheckBox("Thick Box & Inward Ticks"); self.chk_pub_axes.setChecked(True); self.chk_pub_axes.stateChanged.connect(self.update_plot)
            self.chk_drop_lines = QCheckBox("Draw Vertical Drop-lines"); self.chk_drop_lines.setChecked(True); self.chk_drop_lines.stateChanged.connect(self.update_plot)
            self.chk_waterfall = QCheckBox("Waterfall Offset Stack (2D/3D)")
            self.spin_waterfall = QDoubleSpinBox(); self.spin_waterfall.setRange(-1000, 1000); self.spin_waterfall.setValue(0.5); self.spin_waterfall.valueChanged.connect(self.update_plot)
            pub_layout.addRow(self.chk_pub_axes); pub_layout.addRow(self.chk_drop_lines); pub_layout.addRow(self.chk_waterfall, self.spin_waterfall)
            style_layout.addRow(grp_pub)
            
            grp_inset = QGroupBox("Picture-in-Picture Inset Plot")
            inset_form = QFormLayout(grp_inset)
            self.chk_inset = QCheckBox("Enable Inset Preview"); self.chk_inset.stateChanged.connect(self.update_plot)
            self.spin_inset_xmin = QDoubleSpinBox(); self.spin_inset_xmin.setRange(-5000, 5000)
            self.spin_inset_xmax = QDoubleSpinBox(); self.spin_inset_xmax.setRange(-5000, 5000); self.spin_inset_xmax.setValue(450)
            self.spin_inset_xmin.valueChanged.connect(self.update_plot)
            self.spin_inset_xmax.valueChanged.connect(self.update_plot)
            inset_form.addRow(self.chk_inset)
            inset_form.addRow("Inset Start X:", self.spin_inset_xmin)
            inset_form.addRow("Inset Stop X:", self.spin_inset_xmax)
            style_layout.addRow(grp_inset)
            
            grp_hl = QGroupBox("Highlight Spectral Region Band")
            hl_layout = QFormLayout(grp_hl)
            self.chk_hl = QCheckBox("Enable Highlight Span"); self.chk_hl.stateChanged.connect(self.update_plot)
            self.spin_hl_min = QDoubleSpinBox(); self.spin_hl_min.setRange(-5000, 5000); self.spin_hl_min.setValue(310); self.spin_hl_min.valueChanged.connect(self.update_plot)
            self.spin_hl_max = QDoubleSpinBox(); self.spin_hl_max.setRange(-5000, 5000); self.spin_hl_max.setValue(380); self.spin_hl_max.valueChanged.connect(self.update_plot)
            hl_layout.addRow(self.chk_hl); hl_layout.addRow("Min X Bounds:", self.spin_hl_min); hl_layout.addRow("Max X Bounds:", self.spin_hl_max)
            style_layout.addRow(grp_hl)
            
            self.btn_export = QPushButton("💾 Export Publication Vector Figures")
            self.btn_export.setObjectName("btn_export"); self.btn_export.clicked.connect(self.export_figure)
            self.btn_export_csv = QPushButton("📑 Export Peaks and Raw Data to CSV")
            self.btn_export_csv.clicked.connect(self.export_csv_report)
            self.btn_export_md = QPushButton("📝 Export Comprehensive Scientific Report")
            self.btn_export_md.clicked.connect(self.export_md_report)
            
            style_layout.addRow(QLabel(" ")); style_layout.addRow(self.btn_export); style_layout.addRow(self.btn_export_csv); style_layout.addRow(self.btn_export_md)
            style_scroll.setWidget(style_content); tab_style.setLayout(QVBoxLayout()); tab_style.layout().addWidget(style_scroll)
            
            tools_tabs.addTab(tab_proc, "1. Process")
            tools_tabs.addTab(tab_ana, "2. Analyze")
            tools_tabs.addTab(tab_appear, "3. Plot & Style")
            tools_tabs.addTab(tab_style, "4. Layout/Export")
            
            right_layout.addWidget(tools_tabs)
            main_splitter.addWidget(left_panel); main_splitter.addWidget(center_splitter); main_splitter.addWidget(right_panel)
            main_splitter.setSizes([300, 900, 400])

        # ==========================================
        # EVENT HANDLERS & BINDINGS & MATACTION
        # ==========================================
        def _setup_shortcuts(self):
            self.shortcut_undo = QShortcut(QKeySequence("Ctrl+Z"), self)
            self.shortcut_undo.activated.connect(self.undo_state)
            self.shortcut_redo = QShortcut(QKeySequence("Ctrl+Y"), self)
            self.shortcut_redo.activated.connect(self.redo_state)

        def _connect_canvas_interactions(self):
            self.canvas.mpl_connect('motion_notify_event', self.on_canvas_hover)
            self.canvas.mpl_connect('button_press_event', self.on_canvas_click)

        def undo_state(self):
            if self.current_dataset and self.current_dataset.undo():
                self.sync_data_to_table()
                self.update_plot()
                logger.info("Step Undone.")

        def redo_state(self):
            if self.current_dataset and self.current_dataset.redo():
                self.sync_data_to_table()
                self.update_plot()
                logger.info("Step Redone.")

        def _add_to_tree(self, sd: SpectrumData):
            """Adds a dataset to the object browser with checkable visibility and inline editing."""
            self._updating_list = True
            item = QListWidgetItem(sd.name)
            item.setFlags(item.flags() | Qt.ItemIsUserCheckable | Qt.ItemIsEditable)
            item.setCheckState(Qt.Checked if sd.visible else Qt.Unchecked)
            self.datasets.append(sd)
            self.data_list.addItem(item)
            self.combo_bg_subtract.addItem(sd.name)
            self._updating_list = False

        def on_item_state_changed(self, item):
            if self._updating_list: return
            idx = self.data_list.row(item)
            if 0 <= idx < len(self.datasets):
                sd = self.datasets[idx]
                sd.visible = (item.checkState() == Qt.Checked)
                sd.name = item.text()
                self.update_plot()

        def apply_curve_style(self):
            """Applies granular style settings from the inspector to the selected curve(s)."""
            if self._updating_table: return
            selected_items = self.data_list.selectedItems()
            if not selected_items: return
            
            ls_map = {"Solid (-)": '-', "Dashed (--)": '--', "Dotted (:)": ':', "None": ''}
            mk_map = {"None": '', "Circle (o)": 'o', "Square (s)": 's', "Triangle (^)": '^', "Cross (x)": 'x'}
            
            for item in selected_items:
                sd = self.datasets[self.data_list.row(item)]
                sd.line_width = self.spin_line_width.value()
                sd.line_style = ls_map.get(self.combo_line_style.currentText(), '-')
                sd.marker = mk_map.get(self.combo_marker.currentText(), '')
                sd.marker_size = self.spin_marker_size.value()
            self.update_plot()

        def save_workspace(self):
            file, _ = QFileDialog.getSaveFileName(self, "Save Workspace", "workspace.h5", "HDF5 Files (*.h5)")
            if file:
                with h5py.File(file, 'w') as f:
                    for idx, ds in enumerate(self.datasets):
                        grp = f.create_group(f"dataset_{idx}")
                        grp.attrs['name'], grp.attrs['technique'] = ds.name, ds.technique
                        import json
                        grp.attrs['history'] = json.dumps(ds.history)
                        style_dict = {
                            'color': ds.color, 'visible': ds.visible, 'lw': ds.line_width,
                            'ls': ds.line_style, 'm': ds.marker, 'ms': ds.marker_size
                        }
                        grp.attrs['style'] = json.dumps(style_dict)
                        grp.create_dataset('x_orig', data=ds.x_orig); grp.create_dataset('y_orig', data=ds.y_orig)
                QMessageBox.information(self, "Success", "Workspace saved.")

        def load_workspace(self):
            file, _ = QFileDialog.getOpenFileName(self, "Load Workspace", "", "HDF5 Files (*.h5)")
            if file:
                with h5py.File(file, 'r') as f:
                    self.datasets.clear(); self.data_list.clear(); self.combo_bg_subtract.clear(); self.combo_bg_subtract.addItem("None")
                    for grp_name in f.keys():
                        grp = f[grp_name]
                        sd = SpectrumData(grp['x_orig'][:], grp['y_orig'][:], grp.attrs.get('name', 'Loaded'), grp.attrs.get('technique', 'Unknown'))
                        import json
                        if 'history' in grp.attrs: sd.history = json.loads(grp.attrs['history'])
                        if 'style' in grp.attrs:
                            style = json.loads(grp.attrs['style'])
                            sd.color = style.get('color', '#4fc1ff'); sd.visible = style.get('visible', True)
                            sd.line_width = style.get('lw', 1.5); sd.line_style = style.get('ls', '-')
                            sd.marker = style.get('m', ''); sd.marker_size = style.get('ms', 6)
                        self._add_to_tree(sd)
                self.update_plot()

        def generate_sample_data(self, sim_type):
            if sim_type == "UV-Vis":
                x = np.linspace(200, 700, 1000)
                y = 0.8 * np.exp(-(x - 200) / 100) 
                peaks = [(265, 0.6, 15), (340, 0.3, 25)]
                for mu, amp, sig in peaks: y += amp * np.exp(-(x - mu)**2 / (2. * sig**2))
                y += np.random.normal(0, 0.01, len(x)) 
                name, tech = f"Lemon CQD Extract ({len(self.datasets)+1})", "UV-Vis Spectroscopy"
            else:
                x = np.linspace(0, 10, 2000); y = np.random.normal(0, 0.01, len(x))
                peaks = [(1.2, 0.8, 0.02), (2.7, 0.5, 0.02), (7.2, 0.6, 0.015), (9.8, 0.3, 0.01)]
                for mu, amp, sig in peaks: y += amp * np.exp(-(x - mu)**2 / (2. * sig**2))
                name, tech = f"Organic Extract 1H NMR ({len(self.datasets)+1})", "1H NMR Spectroscopy"
                
            sd = SpectrumData(x, y, name, tech)
            sd.color = matplotlib.colors.to_hex(plt.get_cmap('tab10')(len(self.datasets) % 10))
            self._add_to_tree(sd)
            self.data_list.item(len(self.datasets) - 1).setSelected(True)

        def load_data(self):
            files, _ = QFileDialog.getOpenFileNames(self, "Open Data File", "", "Data Files (*.txt *.csv *.dat *.xlsx *.xls);;All Files (*.*)")
            tech = self.technique_combo.currentText()
            for file in files:
                try:
                    extracted_datasets = DataIngestion.smart_load_multi(file)
                    for name, x_arr, y_arr in extracted_datasets:
                        sd = SpectrumData(x_arr, y_arr, name, tech)
                        sd.color = matplotlib.colors.to_hex(plt.get_cmap('tab10')(len(self.datasets) % 10))
                        self._add_to_tree(sd)
                except Exception as e:
                    QMessageBox.warning(self, "Load Error", f"Could not parse file: {os.path.basename(file)}\n{e}")

        def on_data_selected(self):
            if self.data_list.selectedItems():
                self.current_dataset = self.datasets[self.data_list.currentRow()]
                # Sync Inspector GUI to selected dataset
                self._updating_table = True
                ls_rev = {'-': "Solid (-)", '--': "Dashed (--)", ':': "Dotted (:)", '': "None"}
                mk_rev = {'': "None", 'o': "Circle (o)", 's': "Square (s)", '^': "Triangle (^)", 'x': "Cross (x)"}
                
                self.spin_line_width.setValue(self.current_dataset.line_width)
                if self.current_dataset.line_style in ls_rev: self.combo_line_style.setCurrentText(ls_rev[self.current_dataset.line_style])
                if self.current_dataset.marker in mk_rev: self.combo_marker.setCurrentText(mk_rev[self.current_dataset.marker])
                self.spin_marker_size.setValue(self.current_dataset.marker_size)
                self._updating_table = False
                
                self.sync_data_to_table(); self.update_plot()

        def on_mode_change(self):
            if hasattr(self, 'span') and self.span:
                self.span.set_active(self.mode_crop.isChecked() or self.mode_integrate.isChecked())
                if self.mode_crop.isChecked(): self.span.props['facecolor'] = 'red'
                elif self.mode_integrate.isChecked(): self.span.props['facecolor'] = 'green'

        def on_canvas_hover(self, event):
            if event.inaxes is None or not self.data_list.selectedItems(): return
            if not self.current_dataset: return
            
            sd = self.current_dataset
            idx = np.argmin(np.abs(sd.x - event.xdata))
            snapped_x = sd.x[idx]
            snapped_y = sd.y_processed[idx]
            
            self.lbl_cursor.setText(f"Snapped: X = {snapped_x:.2f}, Y = {snapped_y:.4f}")
            
            # Real-Time Crosshairs Snapping Render
            ax = event.inaxes
            if hasattr(self, '_live_lines'):
                for line in self._live_lines:
                    try: line.remove()
                    except: pass
            
            self._live_lines = [
                ax.axvline(snapped_x, color='gray', linestyle=':', alpha=0.5),
                ax.plot([snapped_x], [snapped_y], marker='o', color='red', markersize=6)[0]
            ]
            self.canvas.draw_idle()

        def on_canvas_click(self, event):
            if not self.mode_peak.isChecked() or event.inaxes is None or not self.current_dataset: return
            idx = np.argmin(np.abs(self.current_dataset.x - event.xdata))
            p = PeakData(self.current_dataset.x[idx], self.current_dataset.y_processed[idx])
            self.current_dataset.peaks.append(p)
            self.current_dataset.log(f"Interactively picked peak at X={p.x:.2f}")
            self.current_dataset.commit_state()
            self.sync_data_to_table(); self.update_plot()

        def on_span_select(self, xmin, xmax):
            if xmin == xmax: return
            if self.mode_crop.isChecked():
                for item in self.data_list.selectedItems():
                    sd = self.datasets[self.data_list.row(item)]
                    mask = (sd.x >= xmin) & (sd.x <= xmax)
                    sd.x, sd.y_raw, sd.y_processed = sd.x[mask], sd.y_raw[mask], sd.y_processed[mask]
                    sd.peaks = [p for p in sd.peaks if xmin <= p.x <= xmax]
                    sd.log(f"Cropped data to range [{xmin:.2f}, {xmax:.2f}].")
                    sd.commit_state()
                self.sync_data_to_table(); self.update_plot()
            elif self.mode_integrate.isChecked():
                for item in self.data_list.selectedItems():
                    sd = self.datasets[self.data_list.row(item)]
                    mask = (sd.x >= xmin) & (sd.x <= xmax)
                    x_seg, y_seg = sd.x[mask], sd.y_processed[mask]
                    if len(x_seg) > 1:
                        area = trapezoid(y_seg, x_seg)
                        sd.integrals.append(IntegralData(xmin, xmax, abs(area)))
                        sd.log(f"Integrated area between [{xmin:.2f}, {xmax:.2f}] = {abs(area):.4g}.")
                        sd.commit_state()
                self.sync_data_to_table(); self.update_plot()

        def apply_manual_crop(self):
            if not self.data_list.selectedItems(): return
            xmin = self.spin_crop_min.value(); xmax = self.spin_crop_max.value()
            if xmin >= xmax:
                QMessageBox.warning(self, "Invalid Range", "Min X must be less than Max X.")
                return

            reply = QMessageBox.question(self, "Crop Data", f"Permanently crop selected data to [{xmin}, {xmax}]?", QMessageBox.Yes | QMessageBox.No)
            if reply == QMessageBox.Yes:
                for item in self.data_list.selectedItems():
                    sd = self.datasets[self.data_list.row(item)]
                    mask = (sd.x >= xmin) & (sd.x <= xmax)
                    sd.x, sd.y_raw, sd.y_processed = sd.x[mask], sd.y_raw[mask], sd.y_processed[mask]
                    sd.peaks = [p for p in sd.peaks if xmin <= p.x <= xmax]
                    sd.log(f"Manually cropped data to exact range [{xmin:.2f}, {xmax:.2f}].")
                    sd.commit_state()
                self.sync_data_to_table()
                self.update_plot()

        def process_current_data(self):
            bg_name = self.combo_bg_subtract.currentText()
            bg_sd = next((d for d in self.datasets if d.name == bg_name), None) if bg_name != "None" else None

            for item in self.data_list.selectedItems():
                sd = self.datasets[self.data_list.row(item)]
                if bg_sd: DataProcessor.subtract_blank(sd, bg_sd)
                
                deriv_order = int(self.combo_calc_deriv.currentText().split()[0])
                if self.chk_smooth.isChecked() or deriv_order > 0: 
                    DataProcessor.smooth_data(sd, self.combo_smooth.currentText(), window=self.spin_window.value(), polyorder=self.spin_poly.value(), deriv=deriv_order)
                
                base_choice = self.combo_baseline.currentText()
                if base_choice == "ALS (IR/Raman)":
                    sd.baseline = DataProcessor.baseline_als(sd.y_processed, lam=self.spin_als_lam.value())
                    sd.y_processed = sd.y_processed - sd.baseline
                    sd.log(f"Subtracted ALS baseline (lambda={self.spin_als_lam.value()}).")
                elif base_choice == "Shirley (XPS)":
                    DataProcessor.baseline_shirley(sd)
                
                if self.chk_normalize.isChecked(): DataProcessor.normalize_minmax(sd)
                sd.commit_state()
            self.update_plot()

        def auto_pick_peaks(self):
            if not self.current_dataset: return
            indices = DataProcessor.find_spectrum_peaks(self.current_dataset.x, self.current_dataset.y_processed, self.spin_prominence.value(), 10)
            for p in indices:
                self.current_dataset.peaks.append(p)
            self.current_dataset.log(f"Auto-detected {len(indices)} peaks.")
            self.current_dataset.commit_state()
            self.sync_data_to_table(); self.update_plot()

        def run_expert_system(self):
            if not self.current_dataset or not self.current_dataset.peaks:
                QMessageBox.information(self, "Expert System", "Please pick or auto-detect peaks first.")
                return
            tech = self.current_dataset.technique
            for p in self.current_dataset.peaks:
                if not p.label: 
                    p.label, p.confidence = SpectralExpert.interpret_peak(tech, p.x)
            self.current_dataset.log("Applied Mnova-style heuristic expert system assignments.")
            self.current_dataset.commit_state()
            self.sync_data_to_table(); self.update_plot()

        def reset_current_data(self):
            if not self.data_list.selectedItems(): return
            for item in self.data_list.selectedItems():
                sd = self.datasets[self.data_list.row(item)]
                sd.x, sd.y_raw, sd.y_processed = np.copy(sd.x_orig), np.copy(sd.y_orig), np.copy(sd.y_orig)
                sd.baseline, sd.peaks, sd.integrals = None, [], []
                sd.fit_result, sd.fit_components, sd.fit_residuals, sd.is_tauc, sd.tauc_data, sd.jobs_data = None, [], None, False, None, None
                sd.log("Performed full Raw Data Reset.")
                sd.commit_state()
            self.sync_data_to_table(); self.update_plot()

        def run_jobs_plot(self):
            selected_items = self.data_list.selectedItems()
            if len(selected_items) < 3: return
            datasets = [self.datasets[self.data_list.row(i)] for i in selected_items]
            dialog = JobsPlotDialog(datasets, self)
            if dialog.exec():
                target_x, fractions = dialog.get_data()
                y_vals = np.array([float(interp1d(ds.x, ds.y_processed, bounds_error=False, fill_value="extrapolate")(target_x)) for ds in datasets])
                sort_idx = np.argsort(fractions); fractions, y_vals = fractions[sort_idx], y_vals[sort_idx]
                delta_y = y_vals - (y_vals[0] * (1 - fractions) + y_vals[-1] * fractions)
                
                sd = SpectrumData(fractions, delta_y, f"Job's Plot @ {target_x}", "Job's Plot")
                max_idx = np.argmax(np.abs(delta_y))
                if 0 < max_idx < len(fractions) - 1:
                    x_l, y_l = fractions[:max_idx+1], delta_y[:max_idx+1]
                    m1, c1, r1, _, _ = linregress(x_l, y_l)
                    x_r, y_r = fractions[max_idx:], delta_y[max_idx:]
                    m2, c2, r2, _, _ = linregress(x_r, y_r)
                    if m1 != m2:
                        x_int = (c2 - c1) / (m1 - m2)
                        sd.jobs_data = {'x_int': x_int, 'y_int': m1 * x_int + c1, 'line1': m1 * fractions + c1, 'line2': m2 * fractions + c2, 'left_mask': fractions <= x_int, 'right_mask': fractions >= x_int, 'm1': m1, 'c1': c1, 'r2_1': r1**2, 'm2': m2, 'c2': c2, 'r2_2': r2**2}
                sd.color = '#e74c3c'
                sd.log("Generated continuous variation Job's Plot.")
                sd.commit_state()
                self._add_to_tree(sd)
                self.data_list.clearSelection(); self.data_list.item(len(self.datasets)-1).setSelected(True)
                self.update_plot()

        def apply_tauc(self, transition):
            for item in self.data_list.selectedItems():
                sd_target = self.datasets[self.data_list.row(item)]
                DataProcessor.convert_to_tauc(sd_target, transition)
                sd_target.commit_state()
            self.update_plot()

        def run_deconvolution(self):
            if not self.current_dataset or not self.current_dataset.peaks: return
            profile = self.combo_fit_profile.currentText()
            try:
                PeakFitter.fit_peaks(
                    self.current_dataset, profile, 
                    center_tolerance=self.spin_constrain_tol.value(),
                    min_width=self.spin_constrain_width_min.value(),
                    max_width=self.spin_constrain_width_max.value(),
                    enforce_bounds=self.chk_constrain_fit.isChecked()
                )
                self.current_dataset.commit_state()
                self.update_plot()
            except Exception as e: QMessageBox.critical(self, "Fitting Failed", str(e))

        def run_multivariate_pca(self):
            selected = [self.datasets[self.data_list.row(i)] for i in self.data_list.selectedItems()]
            if len(selected) < 2:
                QMessageBox.information(self, "PCA Engine", "Please select at least 2 datasets to execute PCA SVD decomposition.")
                return
            dialog = PCADialog(selected, self)
            dialog.exec()

        def sync_data_to_table(self):
            if not self.current_dataset: return
            self._updating_table = True
            self.peak_table.setRowCount(len(self.current_dataset.peaks))
            for i, p in enumerate(self.current_dataset.peaks):
                self.peak_table.setItem(i, 0, QTableWidgetItem(f"{p.x:.2f}")); self.peak_table.setItem(i, 1, QTableWidgetItem(f"{p.y:.3f}"))
                self.peak_table.setItem(i, 2, QTableWidgetItem(p.label)); self.peak_table.setItem(i, 3, QTableWidgetItem(f"{p.dx:.1f}")); self.peak_table.setItem(i, 4, QTableWidgetItem(f"{p.dy:.1f}"))
            self.intg_table.setRowCount(len(self.current_dataset.integrals))
            for i, intg in enumerate(self.current_dataset.integrals):
                self.intg_table.setItem(i, 0, QTableWidgetItem(f"{intg.xmin:.2f}")); self.intg_table.setItem(i, 1, QTableWidgetItem(f"{intg.xmax:.2f}")); self.intg_table.setItem(i, 2, QTableWidgetItem(f"{intg.area:.4g}"))
            self._updating_table = False

        def sync_table_to_data(self, row, col):
            if self._updating_table or not self.current_dataset: return
            try:
                p = self.current_dataset.peaks[row]
                if col == 0: p.x = float(self.peak_table.item(row, col).text())
                if col == 1: p.y = float(self.peak_table.item(row, col).text())
                if col == 2: p.label = self.peak_table.item(row, col).text()
                if col == 3: p.dx = float(self.peak_table.item(row, col).text())
                if col == 4: p.dy = float(self.peak_table.item(row, col).text())
                self.update_plot()
            except ValueError: pass 

        def change_color(self):
            if not self.data_list.selectedItems(): return
            color = QColorDialog.getColor()
            if color.isValid():
                for item in self.data_list.selectedItems(): self.datasets[self.data_list.row(item)].color = color.name()
                self.update_plot()
                
        def apply_colormap(self):
            items = self.data_list.selectedItems()
            if not items: return
            cmap_name = self.combo_cmap.currentText()
            cmap = plt.get_cmap(cmap_name)
            colors = cmap(np.linspace(0, 1, len(items)))
            for i, item in enumerate(items):
                self.datasets[self.data_list.row(item)].color = matplotlib.colors.to_hex(colors[i])
            self.update_plot()
                
        def change_bg_color(self):
            color = QColorDialog.getColor()
            if color.isValid(): self.plot_bg_color = color.name(); self.update_plot()

        def export_figure(self):
            file, _ = QFileDialog.getSaveFileName(self, "Export Figure", "", "PNG (*.png);;PDF (*.pdf);;SVG (*.svg)")
            if file: self.canvas.fig.savefig(file, dpi=matplotlib.rcParams.get('figure.dpi', 600), bbox_inches='tight', transparent=not bool(self.plot_bg_color))
                
        def export_csv_report(self):
            if not self.current_dataset: return
            file, _ = QFileDialog.getSaveFileName(self, "Export Report", f"{self.current_dataset.name}_data.csv", "CSV Files (*.csv)")
            if file:
                with open(file, 'w', newline='') as f:
                    writer = csv.writer(f)
                    writer.writerow(["Detected Peaks", "X", "Y", "Label", "Confidence"])
                    for p in self.current_dataset.peaks: writer.writerow(["", p.x, p.y, p.label, p.confidence])
                    writer.writerow(["Integrals", "X-Min", "X-Max", "Area"])
                    for i in self.current_dataset.integrals: writer.writerow(["", i.xmin, i.xmax, i.area])
                    writer.writerow(["Raw Data", "X", "Y"])
                    for i in range(len(self.current_dataset.x)): writer.writerow(["", self.current_dataset.x[i], self.current_dataset.y_processed[i]])
        
        def export_md_report(self):
            if not self.current_dataset: return
            file, _ = QFileDialog.getSaveFileName(self, "Export Provenance", f"{self.current_dataset.name}_provenance.md", "Markdown (*.md)")
            if file: ReportGenerator.generate_markdown(self.current_dataset, file)

        # ==========================================
        # RENDER ENGINE (Phase 4: Publication)
        # ==========================================
        def update_plot(self):
            journal = self.combo_journal.currentText()
            if journal in JOURNAL_STYLES: matplotlib.rcParams.update(JOURNAL_STYLES[journal])
            else: matplotlib.rcdefaults()

            if self.plot_bg_color:
                fg = 'black' if QColor(self.plot_bg_color).lightness() > 128 else 'white'
                matplotlib.rcParams.update({'text.color': fg, 'axes.labelcolor': fg, 'xtick.color': fg, 'ytick.color': fg, 'axes.edgecolor': fg, 'figure.facecolor': self.plot_bg_color, 'axes.facecolor': self.plot_bg_color})
            else:
                matplotlib.rcParams.update({'figure.facecolor': '#1e1e1e', 'axes.facecolor': '#1e1e1e', 'text.color': '#cccccc', 'axes.labelcolor': '#cccccc', 'xtick.color': '#cccccc', 'ytick.color': '#cccccc', 'axes.edgecolor': '#cccccc'})

            dim_map = {"ACS Single (3.33x2.5)": (3.33, 2.5), "Nature Double (7x5)": (7.0, 5.0)}
            dim = self.combo_fig_size.currentText()
            if dim in dim_map: self.canvas.fig.set_size_inches(*dim_map[dim])

            self.canvas.fig.clear()
            
            # Smart Active plotting filtration based on tree checkbox check state
            visible_items = []
            for i in range(self.data_list.count()):
                item = self.data_list.item(i)
                sd = self.datasets[i]
                if sd.visible and item.isSelected(): 
                    visible_items.append((i, item, sd))

            if not visible_items: self.canvas.draw(); return
                
            sd_main = visible_items[0][2]
            ax_res = None
            if self.chk_show_residuals.isChecked() and sd_main.fit_result is not None:
                gs = self.canvas.fig.add_gridspec(2, 1, height_ratios=[3, 1], hspace=0.1)
                ax = self.canvas.fig.add_subplot(gs[0]); ax_res = self.canvas.fig.add_subplot(gs[1], sharex=ax)
            else: ax = self.canvas.fig.add_subplot(111)

            if self.chk_hl.isChecked(): ax.axvspan(self.spin_hl_min.value(), self.spin_hl_max.value(), color='orange', alpha=0.15, zorder=0)

            offset_val = self.spin_waterfall.value() if self.chk_waterfall.isChecked() else 0
            layout_mode = self.combo_view_layout.currentText()
            
            # True 2D Contour maps
            if layout_mode == "2D Heatmap / Contour Plot" and len(visible_items) >= 2:
                ref_x = sd_main.x
                Z = []
                for idx, item, sd in visible_items:
                    f = interp1d(sd.x, sd.y_processed, bounds_error=False, fill_value="extrapolate")
                    Z.append(f(ref_x))
                Z = np.array(Z)
                Y_idx = np.arange(len(visible_items))
                X_grid, Y_grid = np.meshgrid(ref_x, Y_idx)
                cont = ax.contourf(X_grid, Y_grid, Z, levels=30, cmap=self.combo_cmap.currentText())
                self.canvas.fig.colorbar(cont, ax=ax, label="Normalized Intensity")
                ax.set_yticks(Y_idx)
                ax.set_yticklabels([sd.name for _, _, sd in visible_items], fontsize=8)
                ax.set_xlabel("X Axis Matrix variable")
                self.canvas.draw()
                return

            # True 3D Waterfall stacked line projections
            elif layout_mode == "Waterfall Stack (3D Projection)":
                self.canvas.fig.clear()
                ax = self.canvas.fig.add_subplot(111, projection='3d')
                if self.plot_bg_color:
                    ax.set_facecolor(self.plot_bg_color)
                    ax.w_xaxis.set_pane_color((0,0,0,0)); ax.w_yaxis.set_pane_color((0,0,0,0)); ax.w_zaxis.set_pane_color((0,0,0,0))
                for i, (ds_idx, item, sd) in enumerate(visible_items):
                    ax.plot(sd.x, np.ones_like(sd.x) * i, sd.y_processed, color=sd.color, label=sd.name, lw=sd.line_width)
                ax.set_ylabel("Stacked Trace Index")
                ax.set_zlabel("Intensity")
                ax.set_xlabel("Wavelength / Energy")
                self.canvas.draw()
                return

            global_x_min, global_x_max = float('inf'), float('-inf')
            
            show_inset = self.chk_inset.isChecked()
            ax_inset = None
            if show_inset:
                ax_inset = self.canvas.fig.add_axes([0.65, 0.6, 0.23, 0.25])
                if self.plot_bg_color: ax_inset.set_facecolor(self.plot_bg_color)
                ax_inset.set_xlim(self.spin_inset_xmin.value(), self.spin_inset_xmax.value())
                ax_inset.tick_params(labelsize=6)

            plot_idx = 0
            for ds_idx, item, sd in visible_items:
                global_x_min = min(global_x_min, np.min(sd.x))
                global_x_max = max(global_x_max, np.max(sd.x))
                
                current_y = sd.y_processed + (plot_idx * offset_val)
                plot_idx += 1
                
                ls = sd.line_style
                mk = sd.marker
                lw = sd.line_width
                ms = sd.marker_size
                
                # Render Job's Plot
                if sd.technique == "Job's Plot":
                    ax.plot(sd.x, current_y, linestyle=ls, marker=mk if mk else 'o', label=sd.name, color=sd.color, markersize=ms if ms else 8, linewidth=lw, zorder=4)
                    if hasattr(sd, 'jobs_data') and sd.jobs_data:
                        jd = sd.jobs_data; xi, yi = jd['x_int'], jd['y_int']
                        ax.plot(sd.x, jd['line1'], '--', color=sd.color, lw=lw, alpha=0.5)
                        ax.plot(sd.x, jd['line2'], '--', color=sd.color, lw=lw, alpha=0.5)
                        ax.plot(np.append(sd.x[jd['left_mask']], xi), np.append(jd['line1'][jd['left_mask']], yi), '-', color=sd.color, lw=lw+0.5)
                        ax.plot(np.insert(sd.x[jd['right_mask']], 0, xi), np.insert(jd['line2'][jd['right_mask']], 0, yi), '-', color=sd.color, lw=lw+0.5)
                        ax.plot([xi, xi], [0, yi], ':', color='gray', lw=1.5)
                        ax.plot(xi, yi, '*', color='gold', markersize=16, markeredgecolor='black', zorder=5)
                        bbox_props = dict(boxstyle="round,pad=0.3", fc="#333" if not self.plot_bg_color else self.plot_bg_color, alpha=0.8)
                        ax.text(0.05, 0.95, f"Reg 1: $R^2 = {jd['r2_1']:.4f}$", transform=ax.transAxes, va='top', bbox=bbox_props)
                        ax.text(0.95, 0.95, f"Reg 2: $R^2 = {jd['r2_2']:.4f}$", transform=ax.transAxes, va='top', ha='right', bbox=bbox_props)
                        ax.annotate(f"$x = {xi:.2f}$", xy=(xi, 0), xytext=(0, -15), textcoords="offset points", ha='center', va='top', bbox=bbox_props)
                
                # Render Tauc Plot
                elif sd.is_tauc:
                    ax.plot(sd.x, current_y, linestyle=ls, marker=mk, label=sd.name, color=sd.color, linewidth=lw, markersize=ms)
                    if show_inset:
                        ax_inset.plot(sd.x, current_y, color=sd.color, lw=1.0)
                    if sd.tauc_data:
                        td = sd.tauc_data
                        x_tan = np.linspace(td['x_start'], td['x_end'], 50)
                        ax.plot(x_tan, td['m'] * x_tan + td['c'], '--', color='red', lw=1.5)
                        dy_offset = 15 + (plot_idx * 20)
                        ax.annotate(f"$E_g = {td['eg']:.2f}$ eV", xy=(td['eg'], 0), xytext=(15, dy_offset), textcoords="offset points", color=sd.color, weight='bold', arrowprops=dict(arrowstyle="->", color=sd.color))
                
                # Render Standard Spectrum
                else:
                    ax.plot(sd.x, current_y, linestyle=ls, marker=mk, label=sd.name, color=sd.color, linewidth=lw, markersize=ms, zorder=3)
                    if show_inset:
                        ax_inset.plot(sd.x, current_y, color=sd.color, lw=1.0)
                
                # Render Fits deconvolution curves
                if sd.fit_result is not None:
                    ax.plot(sd.x, sd.fit_result + ((plot_idx-1)*offset_val), 'r--', label='Cumulative Fit', lw=1.5)
                    colors = plt.cm.plasma(np.linspace(0, 1, len(sd.fit_components)))
                    for c_idx, comp in enumerate(sd.fit_components):
                        ax.fill_between(sd.x, comp + ((plot_idx-1)*offset_val), np.min(current_y), color=colors[c_idx], alpha=0.3)
                    if ax_res is not None:
                        ax_res.plot(sd.x, sd.fit_residuals, color='cyan', lw=1)
                        ax_res.axhline(0, color='gray', linestyle='--', lw=1)

                # Angled Annotations & Drop-Lines
                for p in sd.peaks:
                    actual_py = p.y + ((plot_idx-1) * offset_val)
                    if self.chk_drop_lines.isChecked(): ax.axvline(p.x, ymin=0, ymax=actual_py / max(ax.get_ylim()[1], 1e-10), color='gray', linestyle=':', alpha=0.6, zorder=1)
                    display_text = f"{p.x:.1f}"
                    if p.label: display_text += f"\n{p.label}"
                    halign = 'left' if p.dx > 10 else 'right' if p.dx < -10 else 'center'
                    ax.annotate(display_text, xy=(p.x, actual_py), xytext=(p.dx, p.dy), textcoords="offset points", ha=halign, va='bottom' if p.dy >= 0 else 'top', fontsize=9, color=sd.color, arrowprops=dict(arrowstyle="->", connectionstyle="arc3,rad=0.0", color=sd.color, lw=1.0, shrinkB=3), zorder=5)

                for intg in sd.integrals:
                    mask = (sd.x >= intg.xmin) & (sd.x <= intg.xmax)
                    ax.fill_between(sd.x[mask], current_y[mask], np.min(current_y), color='green', alpha=0.3, zorder=2)
                    ax.annotate(f"{intg.area:.3g}", xy=((intg.xmin+intg.xmax)/2, np.max(current_y[mask])), ha='center', va='bottom', color='green', fontsize=8, bbox=dict(boxstyle="round", fc="black", ec="green", alpha=0.7))

            # Manual vs Auto Axes Controls
            if not self.chk_auto_x.isChecked():
                ax.set_xlim(self.spin_lim_xmin.value(), self.spin_lim_xmax.value())
            elif global_x_min != float('inf') and global_x_max != float('-inf'):
                margin = (global_x_max - global_x_min) * 0.02 
                if sd_main.technique == "Job's Plot": 
                    ax.set_xlim(0, 1)
                elif "NMR" in sd_main.technique or "FTIR" in sd_main.technique:
                    ax.set_xlim(global_x_max + margin, global_x_min - margin)
                else:
                    ax.set_xlim(global_x_min - margin, global_x_max + margin)
            
            if not self.chk_auto_y.isChecked():
                ax.set_ylim(self.spin_lim_ymin.value(), self.spin_lim_ymax.value())

            # Thick Box and Inward ticks on all spines matching ACS standards
            if self.chk_pub_axes.isChecked():
                for spine in ax.spines.values(): spine.set_linewidth(1.5)
                ax.tick_params(direction='in', length=6, width=1.5, top=True, right=True, bottom=True, left=True, which='major')
                ax.tick_params(direction='in', length=3, width=1.0, top=True, right=True, bottom=True, left=True, which='minor')
                ax.xaxis.set_minor_locator(AutoMinorLocator()); ax.yaxis.set_minor_locator(AutoMinorLocator())
            
            if self.chk_grid_x.isChecked(): ax.grid(True, axis='x', linestyle='--', alpha=0.5)
            if self.chk_grid_y.isChecked(): ax.grid(True, axis='y', linestyle='--', alpha=0.5)

            # Manual Labels Override
            c_x_label = self.edit_x_label.text().strip()
            c_y_label = self.edit_y_label.text().strip()

            if c_x_label and c_x_label.lower() != "auto": ax.set_xlabel(c_x_label)
            else:
                if sd_main.technique == "Job's Plot": ax.set_xlabel("Mole Fraction, $X$")
                elif sd_main.is_tauc: ax.set_xlabel("Energy, $h\\nu$ (eV)")
                elif "UV-Vis" in sd_main.technique: ax.set_xlabel("Wavelength, $\lambda$ (nm)")
                else: ax.set_xlabel("X-Axis")
                
            if c_y_label and c_y_label.lower() != "auto": ax.set_ylabel(c_y_label)
            else:
                if sd_main.technique == "Job's Plot": ax.set_ylabel("$\Delta$ Absorbance")
                elif sd_main.is_tauc: ax.set_ylabel("$(\\alpha h\\nu)^2$")
                elif "UV-Vis" in sd_main.technique: ax.set_ylabel("Absorbance, $A$ (a.u.)")
                else: ax.set_ylabel("Y-Axis")

            if self.chk_show_legend.isChecked():
                leg = ax.legend(loc=self.combo_legend_pos.currentText(), fontsize='small', frameon=False)
                if leg: leg.set_draggable(True)
                
            self.span = SpanSelector(ax, self.on_span_select, 'horizontal', useblit=True, props=dict(alpha=0.3, facecolor='red'), interactive=False)
            self.span.set_active(self.mode_crop.isChecked() or self.mode_integrate.isChecked())
            if dim == "Auto": self.canvas.fig.tight_layout()
            self.canvas.draw()

if __name__ == "__main__":
    if '--cli' in sys.argv:
        parser = argparse.ArgumentParser(description="Labscribber Pro: Headless Batch Processor")
        parser.add_argument('--cli', action='store_true')
        parser.add_argument('--input', required=True, type=str, help="Input directory containing CSVs/XLSXs")
        parser.add_argument('--output', required=True, type=str, help="Output directory for reports")
        parser.add_argument('--tech', default="UV-Vis", type=str, help="Spectroscopy Technique")
        parser.add_argument('--smooth', type=int, default=None, help="Apply Savitzky-Golay window size")
        parser.add_argument('--baseline', choices=['ALS', 'Shirley', 'None'], default='None')
        parser.add_argument('--tauc', choices=['direct', 'indirect'], default=None)
        run_cli_pipeline(parser.parse_args())
    else:
        app = QApplication(sys.argv)
        window = LabscribberApp()
        window.show()
        sys.exit(app.exec())