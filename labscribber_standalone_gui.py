#!/usr/bin/env python3
"""
Labscribber Standalone Python Spectroscopy Workstation GUI
Developed for physical chemists, materials scientists and spectroscopy labs.
Uses Tkinter and Matplotlib to run anywhere without heavy software suites.
"""

import tkinter as tk
from tkinter import ttk, filedialog, messagebox
import numpy as np
import matplotlib
matplotlib.use('TkAgg')
import matplotlib.pyplot as plt
from matplotlib.backends.backend_tkagg import FigureCanvasTkAgg, NavigationToolbar2Tk

class LabscriberGUI:
    def __init__(self, root):
        self.root = root
        self.root.title("Labscribber Standalone Spectroscopy GUI")
        self.root.geometry("1100x750")
        self.root.configure(bg="#0f172a") # Dark Slate Theme

        # 1. Create a beautiful synthetic QD UV-Vis Spectrum for out-of-the-box testing!
        points = 800
        self.x_orig = np.linspace(200, 700, points)
        
        # High quality absorption and scattering peaks
        scatter = 0.5 * np.exp(-(self.x_orig - 200) / 80)
        ex1 = 0.55 * np.exp(-((self.x_orig - 268) / 16)**2)
        ex2 = 0.38 * np.exp(-((self.x_orig - 345) / 26)**2)
        ex3 = 0.12 * np.exp(-((self.x_orig - 410) / 40)**2)
        noise = np.random.normal(0, 0.003, points)
        self.y_orig = scatter + ex1 + ex2 + ex3 + noise

        # Work buffers
        self.x = np.copy(self.x_orig)
        self.y_processed = np.copy(self.y_orig)
        self.peaks = []
        
        # Configure Style Theme
        self.style = ttk.Style()
        self.style.theme_use('clam')
        self.style.configure('.', background='#1e293b', foreground='#f1f5f9', font=('Segoe UI', 10))
        self.style.configure('TFrame', background='#0f172a')
        self.style.configure('TLabelframe', background='#1e293b', foreground='#38bdf8', font=('Segoe UI', 10, 'bold'))
        self.style.configure('TLabelframe.Label', background='#1e293b', foreground='#38bdf8')
        self.style.configure('TLabel', background='#1e293b', foreground='#f1f5f9')
        self.style.configure('TButton', background='#0f766e', foreground='#ffffff', font=('Segoe UI', 9, 'bold'))
        self.style.map('TButton', background=[('active', '#0d9488')])
        self.style.configure('Danger.TButton', background='#be123c', foreground='#ffffff')
        self.style.map('Danger.TButton', background=[('active', '#e11d48')])
        
        # main content columns
        self.main_container = ttk.Frame(root)
        self.main_container.pack(fill=tk.BOTH, expand=True, padx=12, pady=12)

        # Left Column (Operations)
        self.ctrl_panel = ttk.Frame(self.main_container, width=330)
        self.ctrl_panel.pack(side=tk.LEFT, fill=tk.Y, padx=(0, 12))
        self.ctrl_panel.pack_propagate(False)

        # Right Column (Interactive Plot)
        self.plot_panel = ttk.Frame(self.main_container)
        self.plot_panel.pack(side=tk.RIGHT, fill=tk.BOTH, expand=True)

        self.setup_control_widgets()
        self.setup_plot_area()
        self.update_plot()

    def setup_control_widgets(self):
        # Header layout banner
        hdr = tk.Label(self.ctrl_panel, text="LABSCRIBBER WORKSTATION", bg="#0d9488", fg="white", font=("Segoe UI", 12, "bold"), pady=10)
        hdr.pack(fill=tk.X, pady=(0, 12))

        # Data Stream Ingestion
        f_io = ttk.LabelFrame(self.ctrl_panel, text=" 1. Ingest Spectroscopic File ")
        f_io.pack(fill=tk.X, padx=10, pady=6)
        
        self.lbl_info = ttk.Label(f_io, text="Loaded: Simulated Colloidal QD\nCoordinates parsed: 800 pairs", font=("Segoe UI", 9, "italic"), justify=tk.LEFT)
        self.lbl_info.pack(fill=tk.X, padx=12, pady=8)

        btn_load = ttk.Button(f_io, text="Load Local CSV Coordinate File", command=self.load_csv)
        btn_load.pack(fill=tk.X, padx=12, pady=10)

        # Spectrum Pre-Processing Pipeline
        f_proc = ttk.LabelFrame(self.ctrl_panel, text=" 2. Chemical Pre-processing ")
        f_proc.pack(fill=tk.X, padx=10, pady=6)

        self.norm_var = tk.BooleanVar(value=False)
        chk_norm = ttk.Checkbutton(f_proc, text="Enable Min/Max Normalization", variable=self.norm_var, command=self.apply_preprocessing)
        chk_norm.pack(anchor=tk.W, padx=12, pady=6)

        lbl_smooth = ttk.Label(f_proc, text="Moving Boxcar Window size:")
        lbl_smooth.pack(anchor=tk.W, padx=12, pady=4)
        
        self.smooth_scale = tk.Scale(f_proc, from_=1, to=51, orient=tk.HORIZONTAL, resolution=2, bg="#1e293b", fg="#38bdf8", highlightthickness=0)
        self.smooth_scale.set(1)
        self.smooth_scale.pack(fill=tk.X, padx=12, pady=6)
        
        btn_smooth = ttk.Button(f_proc, text="Compute Pipeline", command=self.apply_preprocessing)
        btn_smooth.pack(fill=tk.X, padx=12, pady=10)

        # Signal Deconvolution Peaks Frame
        f_peaks = ttk.LabelFrame(self.ctrl_panel, text=" 3. Advanced Peak Extraction ")
        f_peaks.pack(fill=tk.X, padx=10, pady=6)

        lbl_prom = ttk.Label(f_peaks, text="Peak Prominence Threshold (Y):")
        lbl_prom.pack(anchor=tk.W, padx=12, pady=4)

        self.prom_entry = ttk.Entry(f_peaks)
        self.prom_entry.insert(0, "0.04")
        self.prom_entry.pack(fill=tk.X, padx=12, pady=6)

        btn_peaks = ttk.Button(f_peaks, text="Apply Auto Peak Detection", command=self.auto_pick_peaks)
        btn_peaks.pack(fill=tk.X, padx=12, pady=10)

        # Diagnostics & Reset States
        f_reset = ttk.Frame(self.ctrl_panel)
        f_reset.pack(fill=tk.X, padx=10, pady=15)
        
        btn_rst = ttk.Button(f_reset, text="Reset to Raw Spectrum", style="Danger.TButton", command=self.reset_data)
        btn_rst.pack(fill=tk.X, pady=6)

        lbl_footer = tk.Label(self.ctrl_panel, text="Labscribber Standalone v1.0.0\nPowered by Tkinter & Matplotlib", bg="#0f172a", fg="#64748b", font=("Segoe UI", 8), justify=tk.CENTER)
        lbl_footer.pack(side=tk.BOTTOM, pady=10)

    def setup_plot_area(self):
        # Configure embedded Matplotlib canvas
        self.fig, self.ax = plt.subplots(figsize=(7, 5))
        self.fig.patch.set_facecolor('#0f172a')
        self.ax.set_facecolor('#1e293b')
        
        self.ax.grid(True, color='#334155', linestyle=':')
        self.ax.tick_params(colors='#94a3b8')
        for spine in self.ax.spines.values():
            spine.set_color('#475569')

        self.canvas = FigureCanvasTkAgg(self.fig, master=self.plot_panel)
        self.canvas_widget = self.canvas.get_tk_widget()
        self.canvas_widget.pack(fill=tk.BOTH, expand=True)

        self.toolbar = NavigationToolbar2Tk(self.canvas, self.plot_panel)
        self.toolbar.update()
        self.toolbar.pack(side=tk.BOTTOM, fill=tk.X)

    def update_plot(self):
        self.ax.clear()
        self.ax.grid(True, color='#334155', linestyle=':')
        self.ax.set_facecolor('#1e293b')
        self.fig.patch.set_facecolor('#0f172a')
        self.ax.tick_params(colors='#475569', labelcolor='#94a3b8')
        for spine in self.ax.spines.values():
            spine.set_color('#475569')
            
        # Draw dynamic labels and markers
        self.ax.set_title("Active Spectrscopic Energy Sweep", color='#38bdf8', fontsize=12, fontweight='bold', pad=14)
        self.ax.set_xlabel("Wavelength / Shift Coordinate (nm)", color='#94a3b8', fontsize=10, fontweight='bold')
        self.ax.set_ylabel("Absorbance Intensity (a.u.)", color='#94a3b8', fontsize=10, fontweight='bold')

        # Baseline original
        self.ax.plot(self.x_orig, self.y_orig, color='#64748b', linewidth=1.1, linestyle='--', alpha=0.9, label='Original Raw')
        
        # Pre-processed trace
        self.ax.plot(self.x, self.y_processed, color='#38bdf8', linewidth=2.0, label='Processed Spectrum')

        # Detected peak callouts
        for pk_x, pk_y in self.peaks:
            self.ax.plot(pk_x, pk_y, marker='v', color='#f43f5e', markersize=9)
            self.ax.annotate(f"{pk_x:.1f} ({pk_y:.3f})", (pk_x, pk_y), textcoords="offset points", xytext=(0,10), ha='center', color='#f43f5e', fontsize=8, fontweight='bold')

        self.ax.legend(facecolor='#111827', edgecolor='#475569', labelcolor='#f1f5f9')
        self.canvas.draw()

    def load_csv(self):
        file_path = filedialog.askopenfilename(filetypes=[("CSV Data Files", "*.csv"), ("Text Files", "*.txt"), ("All Files", "*.*")])
        if not file_path:
            return
        
        try:
            # Flexible delimiter detection (comma vs tab vs whitespace)
            try:
                data = np.loadtxt(file_path, delimiter=',', skiprows=1, usecols=(0, 1))
            except Exception:
                data = np.loadtxt(file_path, delimiter=None, skiprows=1, usecols=(0, 1))
                
            self.x_orig = data[:, 0]
            self.y_orig = data[:, 1]
            self.reset_data()
            self.lbl_info.config(text=f"Loaded: {file_path.split('/')[-1]}\\nParsed Pairs: {len(self.x_orig)}")
            messagebox.showinfo("Success", f"Loaded organic database trace with {len(self.x_orig)} spectrum indices.")
        except Exception as e:
            messagebox.showerror("Format Error", f"Failed to ingest custom file coordinates\\nPlease ensure files are stored as plain CSV pairs: coordinate,intensity.\\nDetail: {e}")

    def apply_preprocessing(self):
        # Reset trace working coordinates
        temp_y = np.copy(self.y_orig)

        # Smooth sliding win average
        win = int(self.smooth_scale.get())
        if win > 1:
            box = np.ones(win) / win
            temp_y = np.convolve(temp_y, box, mode='same')

        # Apply standard min/max normalizer
        if self.norm_var.get():
            y_min = np.min(temp_y)
            y_max = np.max(temp_y)
            if y_max != y_min:
                temp_y = (temp_y - y_min) / (y_max - y_min)

        self.y_processed = temp_y
        self.update_plot()

    def auto_pick_peaks(self):
        try:
            prominence = float(self.prom_entry.get())
        except ValueError:
            messagebox.showerror("Verification Error", "Please parse a valid decimal prominence value (e.g. 0.05).")
            return

        self.peaks = []
        y = self.y_processed
        len_y = len(y)
        
        # Scipy-equivalent analytical peaks locator
        for i in range(2, len_y - 2):
            if y[i] > y[i-1] and y[i] > y[i-2] and y[i] > y[i+1] and y[i] > y[i+2]:
                base = min(y[i-2], y[i+2])
                if (y[i] - base) >= prominence and y[i] > 0.01:
                    self.peaks.append((self.x[i], y[i]))

        self.update_plot()
        messagebox.showinfo("Results Summary", f"Spotted {len(self.peaks)} unique peak coordinate indices.")

    def reset_data(self):
        self.x = np.copy(self.x_orig)
        self.y_processed = np.copy(self.y_orig)
        self.peaks = []
        self.norm_var.set(False)
        self.smooth_scale.set(1)
        self.update_plot()

if __name__ == "__main__":
    root = tk.Tk()
    app = LabscriberGUI(root)
    root.mainloop()
