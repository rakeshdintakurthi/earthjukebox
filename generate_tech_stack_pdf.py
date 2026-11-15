import os
from fpdf import FPDF

class TechReportPDF(FPDF):
    def __init__(self):
        super().__init__(orientation='P', unit='mm', format='A4')
        self.set_auto_page_break(auto=True, margin=18)
        
        # Load TrueType UTF-8 system fonts
        font_dir = "C:/Windows/Fonts"
        self.add_font("Arial", "", os.path.join(font_dir, "arial.ttf"))
        self.add_font("Arial", "B", os.path.join(font_dir, "arialbd.ttf"))
        self.add_font("Arial", "I", os.path.join(font_dir, "ariali.ttf"))

    def header(self):
        if self.page_no() > 1:
            self.set_font("Arial", "I", 8.5)
            self.set_text_color(113, 128, 150) # Slate gray
            self.cell(0, 7, "Thermophone Earth — Technical Architecture & Scientific Datasets", border=0, align="L")
            self.set_font("Arial", "", 8.5)
            self.cell(0, 7, f"Page {self.page_no()}", border=0, align="R", new_x="LMARGIN", new_y="NEXT")
            self.set_draw_color(226, 232, 240)
            self.set_line_width(0.3)
            self.line(self.l_margin, 15, self.w - self.r_margin, 15)
            self.ln(5)

    def footer(self):
        self.set_y(-14)
        self.set_font("Arial", "", 8)
        self.set_text_color(160, 174, 192)
        self.set_draw_color(226, 232, 240)
        self.set_line_width(0.3)
        self.line(self.l_margin, self.get_y() - 2, self.w - self.r_margin, self.get_y() - 2)
        self.cell(0, 8, "Confidential — Engineering Specification & Scientific Data Pipeline — Thermophone Earth 2026", align="C")

    def section_heading(self, number_str, title_str):
        self.ln(4)
        self.set_fill_color(237, 242, 247)
        self.set_draw_color(43, 108, 176) # Accent Blue
        self.set_line_width(0.8)
        
        self.set_font("Arial", "B", 13)
        self.set_text_color(26, 32, 44)
        heading_text = f" {number_str}. {title_str}"
        self.cell(0, 8.5, heading_text, fill=True, border="L", new_x="LMARGIN", new_y="NEXT")
        self.ln(2)

    def sub_heading(self, title_str):
        self.ln(2)
        self.set_font("Arial", "B", 10.5)
        self.set_text_color(43, 108, 176)
        self.cell(0, 6, title_str, new_x="LMARGIN", new_y="NEXT")
        self.ln(1)

    def paragraph(self, text):
        self.set_font("Arial", "", 9.5)
        self.set_text_color(45, 55, 72)
        self.multi_cell(0, 5.2, text)
        self.ln(2)

    def bullet(self, bold_prefix, text):
        self.set_font("Arial", "B", 9)
        self.set_text_color(43, 108, 176)
        self.cell(5, 5, "•", align="R")
        self.cell(3)
        self.cell(self.get_string_width(bold_prefix) + 1, 5, bold_prefix)
        self.set_font("Arial", "", 9)
        self.set_text_color(45, 55, 72)
        self.multi_cell(0, 5, text)
        self.ln(1)

def build_pdf():
    pdf = TechReportPDF()
    pdf.set_margins(15, 16, 15)
    pdf.add_page()

    # --- Title Banner ---
    pdf.set_fill_color(26, 32, 44) # Dark Navy
    pdf.rect(15, 16, 180, 32, 'F')
    
    # Accent top border
    pdf.set_fill_color(221, 107, 32) # Flame Orange
    pdf.rect(15, 16, 180, 2.5, 'F')

    pdf.set_xy(20, 21)
    pdf.set_font("Arial", "B", 16)
    pdf.set_text_color(255, 255, 255)
    pdf.cell(0, 8, "Thermophone Earth — Technical Architecture", new_x="LMARGIN", new_y="NEXT")

    pdf.set_x(20)
    pdf.set_font("Arial", "", 9.5)
    pdf.set_text_color(203, 213, 225)
    pdf.cell(0, 5, "Full Tech Stack Breakdown, Component Coordination, Scientific Datasets & Fire Sonification", new_x="LMARGIN", new_y="NEXT")

    pdf.set_x(20)
    pdf.set_font("Arial", "I", 8.5)
    pdf.set_text_color(160, 174, 192)
    pdf.cell(0, 5, "Version 2.4 | Runtime: Local HTTP Port 8000 | Architecture: ES6+ Modular WebGL & Web Audio", new_x="LMARGIN", new_y="NEXT")

    pdf.set_y(52)

    # --- Section 1: Executive Summary ---
    pdf.section_heading("1", "Executive Summary & System Purpose")
    pdf.paragraph(
        "Thermophone Earth is a high-performance 3D interactive planetary intelligence platform that couples photorealistic "
        "satellite visualization with historical Earth science raster layers (1850–2025) and real-time procedural audio sonification. "
        "The application provides a clean dual-state user experience: a default Google Earth-style photorealistic satellite globe "
        "with real-time atmospheric day/night terminator shading, and an on-demand scientific layer system that dynamically drapes "
        "temperature anomalies, precipitation, wind streamlines, ocean currents, tidal ranges, and tectonic plate boundaries."
    )
    pdf.paragraph(
        "A central innovation of the system is the Binaural Fire Sonification Engine: rather than using synthetic sirens or beeps, "
        "local and global temperatures are mapped to the physical acoustics of burning combustion (flame turbulence, convective air flutter, "
        "and wood fiber micro-crackles). When comparing Pin A and Pin B across geodesic arcs, audio is hard-panned into the Left and Right "
        "stereo channels, allowing researchers to perceive temperature deltas through natural, organic auditory contrast."
    )

    # --- Section 2: Complete Tech Stack Breakdown ---
    pdf.section_heading("2", "Detailed Technology Stack")
    pdf.paragraph("The application uses a pure modern Web standards architecture without bundlers, compilation steps, or heavy framework overhead:")

    # Table Header
    headers = [("Layer", 38), ("Technology", 44), ("Version / Spec", 28), ("Purpose & Function", 70)]
    pdf.set_fill_color(45, 55, 72)
    pdf.set_draw_color(203, 213, 225)
    pdf.set_font("Arial", "B", 8.5)
    pdf.set_text_color(255, 255, 255)
    for title, w in headers:
        pdf.cell(w, 7, title, border=1, fill=True, align="L")
    pdf.ln()

    rows = [
        ("3D Globe Engine", "CesiumJS", "v1.114+ (CDN)", "WGS84 3D rendering, shaders, camera controls, imagery drapes."),
        ("Frontend Core", "Vanilla JavaScript", "ES6+ Native Modules", "Modular zero-bundler architecture; fast load times and clean ESM."),
        ("Geodesics Engine", "Cesium Ellipsoid API", "WGS84 Standard", "Computes surface distances, midpoints, and geodesic glow arcs."),
        ("Audio Engine", "Web Audio API", "W3C Recommendation", "DSP graph: WaveShaper, BiquadFilter, Analyser, StereoPanner."),
        ("Data Pipeline", "Python / xarray / netCDF4", "Python 3.10+", "Regrids multidimensional NetCDF into compact 5° JSON arrays."),
        ("UI & Styling", "HTML5 Canvas & CSS3", "Modern CSS Variables", "Dark UI, glassmorphic floating panels, animated visualizers."),
        ("Geocoding / NLP", "Nominatim & Regex Parser", "OpenStreetMap API", "Converts voice/text queries into camera flights and state actions."),
        ("Web Server", "Python http.server", "Standard Library", "Zero-dependency static file server with byte-range and CORS support.")
    ]

    pdf.set_font("Arial", "", 8)
    for idx, (col1, col2, col3, col4) in enumerate(rows):
        fill = (idx % 2 == 1)
        pdf.set_fill_color(247, 250, 252) if fill else pdf.set_fill_color(255, 255, 255)
        pdf.set_text_color(26, 32, 44)
        
        pdf.cell(38, 6.2, f" {col1}", border=1, fill=True)
        pdf.set_font("Arial", "B", 8)
        pdf.cell(44, 6.2, f" {col2}", border=1, fill=True)
        pdf.set_font("Arial", "", 8)
        pdf.cell(28, 6.2, f" {col3}", border=1, fill=True)
        pdf.cell(70, 6.2, f" {col4}", border=1, fill=True)
        pdf.ln()

    # --- Section 3: Component Coordination Architecture ---
    pdf.add_page()
    pdf.section_heading("3", "Component Coordination & Architecture Flow")
    pdf.paragraph(
        "All subsystems coordinate through a unidirectional, event-driven pattern governed by a centralized state store. "
        "No component directly mutates another; all state updates flow through subscriptions, guaranteeing data consistency:"
    )

    pdf.sub_heading("A. Central Reactive Store (src/store.js)")
    pdf.paragraph(
        "The store encapsulates the single source of truth for the entire application. It maintains: activeRasterLayer "
        "(mutually exclusive: heat, rainfall), activeOverlays (Set of concurrent vector layers: wind, ocean, tides, plates), "
        "timeline parameters (year: 1850-2025, month: 1-12), pin coordinates (Pin A, Pin B), and per-layer opacity levels (0.0 to 1.0). "
        "When any property changes, registered subscribers (UI inspector, Cesium layers, audio engine) receive a fine-grained diff."
    )

    pdf.sub_heading("B. Layer Registry Pattern (src/layerRegistry.js)")
    pdf.paragraph(
        "To decouple Cesium rendering code from application logic, each layer implements a standardized lifecycle interface:\n"
        "• load(): Lazy-loads and caches JSON/imagery data only upon first activation.\n"
        "• show(viewer): Creates ImageryLayers or entity primitives and attaches them to the 3D globe.\n"
        "• hide(viewer): Completely disposes of and removes all graphics from the scene when toggled off.\n"
        "• setOpacity(val): Dynamically scales alpha without rebuilding texture assets.\n"
        "• query(lat, lon, time): Returns interpolated physical values (temperature, precipitation, wind speed) at specific coordinates."
    )

    pdf.sub_heading("C. Spatial Inspection & Ellipsoid Geodesic Computation (src/main.js)")
    pdf.paragraph(
        "When the user drops Pin A and Pin B:\n"
        "1. Cesium screen space event handlers convert mouse click vectors into WGS84 Cartesian3 ellipsoidal coordinates.\n"
        "2. Cesium.EllipsoidGeodesic computes great-circle surface distance across the planetary ellipsoid.\n"
        "3. An arc polyline with PolylineGlowMaterialProperty is dynamically attached to the globe connecting both pins.\n"
        "4. A midpoint badge is placed at the geodesic center displaying physical distance and primary delta summary.\n"
        "5. The Inspector Panel samples all active layers simultaneously and dispatches coordinate values to the audio engine."
    )

    # --- Section 4: Scientific Datasets & Exact Utilization ---
    pdf.section_heading("4", "Scientific Datasets Catalog & Usage Pipeline")
    pdf.paragraph(
        "The application integrates real-world earth observation grids and geophysical models from leading global agencies:"
    )

    dataset_cards = [
        ("NOAA Global Surface Temperature (NOAAGlobalTemp v6.0.0)", 
         "Agency: NOAA / NCEI | File: NOAAGlobalTemp_v6.0.0_gridded_s185001_e202512_c20260107T093746.nc",
         "Coverage: 1850 to 2025 (176 continuous years, monthly grids, 5° x 5° spatial resolution = 2,592 cells/year).\n"
         "Usage: Converted into anomalies.json (quantized Int16 hundredths of °C) and climatology.json (1901-2000 base absolute temps). "
         "Drives dynamic Cesium SingleTileImageryProvider heat map drapes, bilinear coordinate lookups, and the sonification engine."),
        
        ("Global Precipitation Climatology (GPCP / NASA GPM IMERG)", 
         "Agency: NASA Goddard Space Flight Center / GPCP | File: data/rainfall_sample.json",
         "Coverage: 12-month global precipitation climatology in mm/day.\n"
         "Usage: Rendered as a semi-transparent precipitation field with blue-to-magenta colormap, linked to the shared 12-month slider."),

        ("Atmospheric Wind Vectors (NOAA GFS & ECMWF ERA5)", 
         "Agency: NOAA NCEP & ECMWF | File: data/wind_sample.json",
         "Coverage: Eastward (u) and northward (v) wind velocity grids across 4 pressure levels (Surface 10m, 850hPa, 500hPa, 250hPa Jet Stream).\n"
         "Usage: Powers an animated 2D canvas overlay running 5,000–15,000 streamline particles with velocity-coded colors and fading trails."),

        ("Ocean Surface Currents & SST (NASA OSCAR & NOAA OISST v2.1)", 
         "Agency: NASA JPL PO.DAAC & NOAA | File: data/ocean_sample.json",
         "Coverage: Near-surface ocean velocity vectors (u, v) combined with Sea Surface Temperature (SST) grids.\n"
         "Usage: Renders marine-masked current streamlines and allows toggling an SST raster overlay using the thermal color ramp."),

        ("Global Ocean Tide Models (CNES/LEGOS FES2014 & TPXO9)", 
         "Agency: CNES / LEGOS / AVISO+ | File: data/tides_sample.json",
         "Coverage: M2 tidal amplitude grids and 5 dominant harmonic tidal constituents (M2, S2, N2, K1, O1).\n"
         "Usage: Displays global tidal range (m) and computes on-demand 48-hour harmonic sinusoidal tide curves on coastal clicks."),

        ("Tectonic Plate Boundaries & Kinematics (Peter Bird PB2002 & MORVEL)", 
         "Agency: Peter Bird (2002) & MORVEL Model | File: data/plates_sample.json",
         "Coverage: Global plate boundary polygons classified into convergent, divergent, and transform margins, plus velocity vectors.\n"
         "Usage: Rendered as color-coded Cesium polyline entities (Red: Convergent, Blue: Divergent, Green: Transform) with mm/yr drift arrows.")
    ]

    for title, subtitle, desc in dataset_cards:
        pdf.set_fill_color(247, 250, 252)
        pdf.set_draw_color(203, 213, 225)
        pdf.set_font("Arial", "B", 9)
        pdf.set_text_color(26, 32, 44)
        pdf.cell(0, 5.5, f"  {title}", fill=True, border=1, new_x="LMARGIN", new_y="NEXT")
        
        pdf.set_font("Arial", "I", 7.5)
        pdf.set_text_color(113, 128, 150)
        pdf.cell(0, 4.5, f"  {subtitle}", new_x="LMARGIN", new_y="NEXT")
        
        pdf.set_font("Arial", "", 8.5)
        pdf.set_text_color(74, 85, 104)
        pdf.multi_cell(0, 4.5, desc)
        pdf.ln(2)

    # --- Section 5: Binaural Fire Sonification System ---
    pdf.add_page()
    pdf.section_heading("5", "Binaural Fire Sonification Architecture")
    pdf.paragraph(
        "A critical user requirement for the platform was the elimination of electronic synth beeps, whistles, and siren tones. "
        "The system replaces synthetic oscillators with a procedural combustion synthesizer implemented directly in Web Audio API:"
    )

    pdf.sub_heading("A. Procedural Combustion Acoustics (src/sonification.js)")
    pdf.paragraph(
        "The sound of fire is generated algorithmically through three coupled physical acoustic layers:\n"
        "1. Convective Thermal Roar: Pink noise generated via Paul Kellet's filter algorithm, passed through a resonant lowpass filter "
        "(80 Hz to 240 Hz, Q = 1.8). Amplitude is modulated by a low-frequency breathing oscillator (3 Hz to 8 Hz) to simulate the convective "
        "flutter of rising heated air.\n"
        "2. Wood Crackles & Popping Embers: High-frequency Poisson-distributed impulse bursts (1.5 kHz to 4.5 kHz bandpass) with sharp "
        "exponential decays (1 ms to 4 ms). Hotter temperatures produce sharper, denser snaps, while sub-zero temperatures produce sparse, muted clicks.\n"
        "3. Oxygen Hiss: Bandpass-filtered air noise (1.2 kHz to 2.8 kHz) providing the background whisper of combusting air."
    )

    pdf.sub_heading("B. Binaural Ear-Channel Routing")
    pdf.paragraph(
        "To achieve strict isolation between ears, the engine utilizes Web Audio StereoPannerNode with hard-panning values, "
        "falling back to ChannelMergerNode(2) when panners are unavailable:\n"
        "• Pin A (Left Ear Solo): pan.value = -1.0. Channel 0 (Left) receives 100% signal; Channel 1 (Right) receives 0.0.\n"
        "• Pin B (Right Ear Solo): pan.value = +1.0. Channel 1 (Right) receives 100% signal; Channel 0 (Left) receives 0.0.\n"
        "• Compare Both (Stereo): Pin A plays in the Left ear while Pin B plays in the Right ear simultaneously, enabling immediate comparative perception."
    )

    pdf.sub_heading("C. Thermal Contrast & Acoustic Scaling Metrics")
    
    # Table of Fire Metrics
    headers_fire = [("Thermal Regime", 34), ("Temp (°C)", 22), ("Frequency (Hz)", 32), ("Pitch Rate", 22), ("Perceptual Acoustic Profile", 70)]
    pdf.set_fill_color(45, 55, 72)
    pdf.set_font("Arial", "B", 8)
    pdf.set_text_color(255, 255, 255)
    for title, w in headers_fire:
        pdf.cell(w, 6.5, title, border=1, fill=True, align="L")
    pdf.ln()

    fire_rows = [
        ("Raging Inferno [Extreme]", "> +35 °C", "8,500 to 13,500 Hz", "1.85x to 2.05x", "HIGH frequency crisp sizzle; fast, blazing high pitch."),
        ("Active Blaze [Hot]", "+20 to +35 °C", "3,500 to 8,500 Hz", "1.50x to 1.85x", "Bright snappy flames; prominent high-frequency wood crackles."),
        ("Warm Campfire [Mild]", "+5 to +20 °C", "1,200 to 3,500 Hz", "1.15x to 1.50x", "Comforting mid-range hearth; balanced convective warmth."),
        ("Dying Embers [Cool]", "-15 to +5 °C", "250 to 1,200 Hz", "0.75x to 1.15x", "LOW frequency rumble; slow muffled clicks and low air hiss."),
        ("Polar Freeze [Sub-Zero]", "< -15 °C", "65 to 250 Hz", "0.45x to 0.75x", "TOO LOW frequency; deep subterranean sub-bass thud.")
    ]

    pdf.set_font("Arial", "", 8)
    for idx, (col1, col2, col3, col4, col5) in enumerate(fire_rows):
        fill = (idx % 2 == 1)
        pdf.set_fill_color(247, 250, 252) if fill else pdf.set_fill_color(255, 255, 255)
        pdf.set_text_color(26, 32, 44)
        pdf.cell(34, 5.8, f" {col1}", border=1, fill=True)
        pdf.cell(22, 5.8, f" {col2}", border=1, fill=True)
        pdf.cell(32, 5.8, f" {col3}", border=1, fill=True)
        pdf.cell(22, 5.8, f" {col4}", border=1, fill=True)
        pdf.cell(70, 5.8, f" {col5}", border=1, fill=True)
        pdf.ln()

    pdf.sub_heading("D. Musical Pentatonic Scale & Harmonic Intervals")
    pdf.paragraph(
        "In addition to combustion acoustics, temperatures map directly to an acoustic C major pentatonic scale spanning 21 notes "
        "(C2 at 65.4 Hz up to C6 at 1,046.5 Hz). The engine features 3 selectable audio modes in the Inspector:\n"
        "• Blend Mode [Fire + Notes]: Synthesizes warm percussive chime notes harmonized on top of the procedural fire crackle.\n"
        "• Notes Only Mode: Silences combustion and plays pure resonant acoustic bell chimes with natural exponential decay tails.\n"
        "• Fire Only Mode: Pure physical fire acoustics (flame roar and Poisson wood crackles).\n"
        "When comparing Pin A (Left Ear) and Pin B (Right Ear), the system automatically calculates and displays the exact musical interval "
        "(e.g., Perfect 5th, Minor 10th, Octave) and sounds a binaural harmonic chord across headphones."
    )

    # --- Section 6: File Map & Quickstart ---
    pdf.ln(3)
    pdf.section_heading("6", "Project File Structure & Execution")
    pdf.paragraph("The repository is structured cleanly into modular components ready for immediate deployment:")

    files = [
        ("earth.html", "Main application entry point with Cesium container, UI toolbar, and Binaural Fire comparison box."),
        ("src/main.js", "Coordinates Cesium globe initialization, event handling, pin placement, and UI synchronization."),
        ("src/store.js", "Unidirectional reactive state store with subscriber notifications and layer opacity management."),
        ("src/layerRegistry.js", "Pluggable layer lifecycle registry managing activation, hiding, queries, and mutual exclusion."),
        ("src/sonification.js", "Procedural Fire Audio DSP engine with hard-panned stereo routing and zero synthetic sirens."),
        ("src/commands.js", "Natural language keyword and regex intent parser supporting text and voice inputs."),
        ("src/layers/*.js", "Individual implementations for heat, rainfall, wind, ocean, tides, and tectonic plates."),
        ("scripts/convert_climate.py", "Python xarray/netCDF4 pipeline script regridding NOAA NetCDF into optimized JSON grids.")
    ]

    for fname, fdesc in files:
        pdf.bullet(f"{fname}: ", fdesc)

    out_path = "Thermophone_Earth_Tech_Stack_and_Architecture.pdf"
    pdf.output(out_path)
    print(f"Successfully generated PDF report: {out_path} ({os.path.getsize(out_path):,} bytes)")

if __name__ == "__main__":
    build_pdf()
