# 🌍 Thermophone: 3D Multilayer Climate & Earth Systems Globe

[![Live Demo](https://img.shields.io/badge/Live_Demo-Vercel-black?style=flat&logo=vercel)](https://earthjukebox-snowy.vercel.app/)
[![NASA EOSDIS](https://img.shields.io/badge/NASA%20EOSDIS-FIRMS%20Active%20Fires-E03C31?style=flat&logo=nasa&logoColor=white)](https://firms.modaps.eosdis.nasa.gov/)
[![CesiumJS](https://img.shields.io/badge/CesiumJS-1.114+-007ACC?style=flat&logo=cesium&logoColor=white)](https://cesium.com/platform/cesiumjs/)
[![Web Audio API](https://img.shields.io/badge/Web%20Audio%20API-Spatial%20Binaural-FF6B6B?style=flat)](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)
[![NOAA Dataset](https://img.shields.io/badge/NOAA-GlobalTemp%20v6.0-4A90E2?style=flat)](https://www.ncei.noaa.gov/products/land-based-station/noaa-global-temp)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

An interactive, scientifically grounded 3D planetary climate globe built with **CesiumJS** and the **Web Audio API**. Features an on-demand modular layer architecture, dual render states, natural-language voice/command parser, minimal Linear-grade comparative analytics, real NASA satellite data ingestion, and real-time binaural sonification.

> 🚀 **Live Deployment:** [https://earthjukebox-snowy.vercel.app/](https://earthjukebox-snowy.vercel.app/)

![Thermophone Earth 3D Globe](assets/earth_globe_view.png)

---

## 🛰️ Real NASA Datasets Integrated

The application integrates real satellite and Earth observation datasets directly from **NASA EOSDIS** (Earth Observing System Data and Information System) and official NASA science missions:

| Entry | Resource / Link Text | Link URL | Purpose in Project |
| :--- | :--- | :--- | :--- |
| **Entry 1** | **NASA GPM – IMERG Precipitation Data** | [`https://gpm.nasa.gov/data/imerg`](https://gpm.nasa.gov/data/imerg) | Powers the real-time rainfall layer and binaural rain sound sonification |
| **Entry 2** | **NASA OSCAR – Ocean Surface Currents** | [`https://podaac.jpl.nasa.gov/dataset/OSCAR_L4_OC_NRT_V2.0`](https://podaac.jpl.nasa.gov/dataset/OSCAR_L4_OC_NRT_V2.0) | Powers the 3D ocean surface current vectors and sea surface temperature analysis |
| **Entry 3** | **NASA Global Precipitation Climatology Project (GPCP)** | [`https://www.nccs.nasa.gov/gpcp/`](https://www.nccs.nasa.gov/gpcp/) | High-resolution monthly global precipitation baseline grids |
| **Entry 4** | **NASA EOSDIS FIRMS Active Wildfires (MODIS C6.1 NRT)** | [`https://firms.modaps.eosdis.nasa.gov/active_fire/`](https://firms.modaps.eosdis.nasa.gov/active_fire/) | Real-time global active wildfire layer (13,900+ hotspots) with Fire Radiative Power (MW) and combustion audio |
| **Entry 5** | **NASA GISS Surface Temperature Analysis (GISTEMP v4)** | [`https://data.giss.nasa.gov/gistemp/`](https://data.giss.nasa.gov/gistemp/) | Long-term historical surface temperature anomalies and musical harmonic chime mappings |
| **Entry 6** | **NASA Visible Earth – Blue Marble Next Generation** | [`https://visibleearth.nasa.gov/images/73909/december-blue-marble-next-generation`](https://visibleearth.nasa.gov/images/73909/december-blue-marble-next-generation) | Base photorealistic planetary surface and cloud imagery on the 3D Cesium globe |

---

### Detailed NASA Data Breakdown

#### 1. NASA GPM – IMERG & GPCP Precipitation
- **Source:** NASA Global Precipitation Measurement ([NASA GPM IMERG](https://gpm.nasa.gov/data/imerg)) and [NASA NCCS GPCP](https://www.nccs.nasa.gov/gpcp/)
- **Usage:** Mapped into global precipitation grids. Powers the **Rainfall Sonification Engine**, scaling volume from complete silence ($0.0\text{ mm/day}$) to intense downpour ($\ge 14\text{ mm/day}$) with binaural ear separation.

#### 2. NASA OSCAR – Ocean Surface Currents
- **Source:** NASA Physical Oceanography Distributed Active Archive Center ([NASA PO.DAAC OSCAR](https://podaac.jpl.nasa.gov/dataset/OSCAR_L4_OC_NRT_V2.0))
- **Usage:** Renders global ocean current velocities ($m/s$), circulation gyres (Gulf Stream, Kuroshio), and SST anomalies on the 3D Cesium globe.

#### 3. NASA EOSDIS FIRMS – Active Fire Data (MODIS C6.1 NRT)
- **Source:** NASA Earth Observing System Data and Information System ([NASA FIRMS](https://firms.modaps.eosdis.nasa.gov/active_fire/))
- **Satellites:** NASA **Terra** and **Aqua** satellites carrying the **MODIS** sensor.
- **Coverage:** 13,940+ active global wildfire detections within the last 24 hours.
- **Telemetry:** Fire Radiative Power (MW), Brightness Temperature ($K$), and detection confidence.
- **Local Assets:** `data/nasa_firms_modis_24h.csv` (~1.1 MB) and `data/nasa_firms_active_fires.json` (~1.9 MB).

---

## 📂 Cloud Resources & Downloads (Google Drive)

Large raw scientific datasets (NetCDF-4 grids), supplementary audio stems, and architectural documentation are archived and downloadable:

> 🔗 **[Download Datasets & Resources on Google Drive](https://drive.google.com/drive/folders/YOUR_GOOGLE_DRIVE_FOLDER_ID?usp=sharing)**  
> *(Replace `YOUR_GOOGLE_DRIVE_FOLDER_ID` with your Google Drive share link)*

### Archive Contents:
| Resource | File | Size | Description |
| :--- | :--- | :--- | :--- |
| **NASA FIRMS Active Fires (CSV)** | `data/nasa_firms_modis_24h.csv` | ~1.1 MB | 14,600+ real NASA MODIS active thermal anomaly detections |
| **NASA FIRMS Processed (JSON)** | `data/nasa_firms_active_fires.json` | ~1.9 MB | Filtered high-confidence wildfire hotspots with FRP & Kelvin telemetry |
| **NOAA GlobalTemp NetCDF** | `NOAAGlobalTemp_v6.0.0_gridded_s185001_e202512.nc` | ~21 MB | Gridded 5° global temperature anomalies (1850–2025) |
| **Tech Stack & Architecture** | `Thermophone_Earth_Tech_Stack_and_Architecture.pdf` | ~92 KB | Complete engineering tech stack and coordinating workflows |
| **Precipitation Audio** | `rain_sample.mp3` | ~2.8 MB | High-fidelity rainfall acoustics mapped to precipitation rates |
| **Combustion Stems** | `audio_sample.mp3` | ~230 KB | Procedural flame roar and thermal crackle acoustic stems |

---

## ✨ Key Features

### 1. 🔥 NASA Active Wildfire Layer & Combustion Sonification
- **13,900+ Live Hotspots**: Rendered with GPU-accelerated Cesium `PointPrimitiveCollection` color-coded by Fire Radiative Power ($MW$):
  - 🔴 **Extreme Fires ($\ge 100\text{ MW}$)**: Large red emissive beacons.
  - 🟠 **Intense Fires ($30–100\text{ MW}$)**: Vivid orange points.
  - 🟡 **Active Fires ($< 30\text{ MW}$)**: Warm yellow points.
- **Acoustic Driving**: Clicking any NASA fire hotspot drives the **Combustion Engine**, modulating crackle frequency and flame roar gain based on the fire's **FRP ($MW$)** and **Brightness Temperature ($K$)**.
- **Spatial Telemetry**: Live readout in toast notifications displaying distance, satellite name, and radiant energy.

### 2. Multilayer Comparative Analytics Panel
- **Minimal Data Design**: Engineered with strict design tokens (Linear / Apple Weather style) on an 8px grid with `backdrop-filter: blur(16px)` and zero visual clutter.
- **4-Column Metric Grid**: Compares Pin A, Pin B, and signed delta ($\Delta$) across:
  - **Sea Surface Temperature (SST)**
  - **Tectonic Plate Speed**
  - **Wind Velocity**
  - **Precipitation Rate**
  - **Tidal Amplitude**
  - **NASA Fire FRP & Proximity**
- **Geocoding & Ocean Identification**: Real-time reverse geocoding with fallback to named water bodies (e.g., *Arabian Sea*, *North Pacific*) instead of raw coordinates.

![Comparison Panel](assets/comparison_panel.jpg)

### 3. Dual Binaural Sonification Engine
Transforms planetary climate parameters into authentic spatial audio via the Web Audio API without synthetic alarm beeps or sirens:

- **🔥 Heat & Thermal Combustion**:
  - **Flame Roar**: Resonant pink-noise turbulent combustion ($Q = 1.8$, 80–240 Hz) with low-frequency thermal convection breathing (3–8 Hz).
  - **Ember Crackles**: Poisson-distributed micro-impulses (1.5 kHz – 4.5 kHz bandpass) scaling from 3/s (sub-zero) to 133/s (extreme heat).
  - **Musical Pentatonic Nodes**: 4-note resonant harmonic arpeggios on the C major pentatonic scale ($C_2$ sub-bass to $C_6$ crystal highs).
- **🌧️ Rainfall & Precipitation Acoustics**:
  - **Dry Land ($< 0.25\text{ mm/day}$)**: **Complete silence** ($0.0\text{ gain}$, zero audio).
  - **Light Drizzle ($0.5 - 2\text{ mm/day}$)**: Gentle, soft patter ($18\% - 30\%\text{ volume}$, $1.5\text{ kHz}$ lowpass cutoff).
  - **Torrential Storm ($\ge 14\text{ mm/day}$)**: Powerful rushing downpour ($85\% - 100\%\text{ volume}$, full $13.5\text{ kHz}$ spectrum).
- **🎧 Dedicated Binaural Stereo Channels**:
  - **Left Ear Only**: Audition Pin A exclusively.
  - **Right Ear Only**: Audition Pin B exclusively.
  - **Compare Both (L + R)**: Instantaneous spatial comparison. Placing Pin A in the Indian monsoon and Pin B in the Sahara immediately outputs heavy rain in the left ear and total silence in the right ear.

### 4. Real-Time Acoustic Waveform Oscilloscope
Visualizes acoustic waveforms in real time with high-DPI canvas rendering:
- **Pin A Waveform**: Pure pitch and droplet velocity for Pin A. Flat baseline indicates silence on dry land.
- **Pin B Waveform**: Acoustic waveform for Pin B.
- **Composite Superposition**: Live harmonic interference wave demonstrating acoustic contrast and beating frequencies.

![Waveform Oscilloscope](assets/waveform_oscilloscope.png)

---

## 🗺️ Layer Specifications & Data Sources

| Layer | Type | Native Units | Primary Source | Link |
| :--- | :--- | :--- | :--- | :--- |
| **Active Wildfires** | Overlay | MW (FRP) & Kelvin | NASA EOSDIS FIRMS (MODIS C6.1 NRT) | [NASA FIRMS](https://firms.modaps.eosdis.nasa.gov/active_fire/) |
| **Heat Map** | Raster | Anomaly in °C | NOAA GlobalTemp v6.0.0 (1850–2025) | [NOAA NCEI](https://doi.org/10.25921/9qth-2p70) |
| **Rainfall** | Raster | mm/day | NASA GPM IMERG & NASA GPCP | [NASA GPM](https://gpm.nasa.gov/data/imerg) / [NASA GPCP](https://www.nccs.nasa.gov/gpcp/) |
| **Wind** | Overlay | m/s & km/h | NOAA GFS 0.25° / ECMWF ERA5 | [NOAA NOMADS](https://nomads.ncep.noaa.gov/) |
| **Ocean SST & Currents** | Overlay/Raster| °C & m/s | NASA PO.DAAC OSCAR & NOAA OISST | [NASA OSCAR](https://podaac.jpl.nasa.gov/dataset/OSCAR_L4_OC_NRT_V2.0) |
| **Tides** | Overlay | Meters (M2 Amplitude)| CNES/LEGOS FES2014 & TPXO9 | [AVISO+](https://www.aviso.altimetry.fr/) |
| **Tectonic Plates**| Vector | mm/yr (MORVEL) | Peter Bird (PB2002) GeoJSON | [PB2002](https://github.com/fraxen/tectonicplates) |

---

## 🔄 Python Data Processing Pipelines

### Fetch Latest NASA FIRMS Wildfire Data
To refresh the globe with the latest 24-hour NASA satellite detections, run:
```bash
py scripts/download_nasa_firms.py
```
This automatically queries the NASA EOSDIS API, streams the MODIS Collection 6.1 CSV, filters high-confidence thermal detections, and exports `data/nasa_firms_active_fires.json`.

### NOAA NetCDF Climate Grid Pipeline
```bash
py scripts/process_noaa_netcdf.py
```

---

## 🚀 Quick Start & Running Locally

### Option 1: Live Web App (Instant Access)
Visit the live deployed application on Vercel: **[https://earthjukebox-snowy.vercel.app/](https://earthjukebox-snowy.vercel.app/)**

### Option 2: Python HTTP Server (Zero Dependencies Locally)
```bash
py -m http.server 8000
```
Open **`http://localhost:8000/earth.html`** (or `http://localhost:8000/index.html`) in your browser.

### Option 3: Modern Node.js / Vite
```bash
npm install
npm run dev
```

---

## ⌨️ Controls & Natural Language Commands

### Search & Voice Command Bar
Type or speak natural language commands (e.g. via the microphone button):
- `"show fires"` or `"active wildfires"` — Activates NASA FIRMS fire layer.
- `"compare Mumbai and London"` — Drops Pin A & Pin B and opens multilayer comparison.
- `"show rainfall"` or `"enable heat map"` — Activates specified layer.
- `"fly to Tokyo"` — Animates camera smoothly to target location.

### Keyboard Shortcuts
| Key | Action |
| :--- | :--- |
| <kbd>&larr;</kbd> / <kbd>&rarr;</kbd> | Step backward / forward by 1 time step |
| <kbd>Shift</kbd> + <kbd>&larr;</kbd> / <kbd>&rarr;</kbd> | Step backward / forward by 1 year (12 months) |
| <kbd>Space</kbd> | Play / pause timeline animation |
| <kbd>A</kbd> / <kbd>B</kbd> | Place Pin A / Pin B at hovered coordinates |
| <kbd>P</kbd> | Toggle Pin Tool |
| <kbd>Esc</kbd> | Close comparison panel & active drawers |

---

## 🛠️ Architecture & Tech Stack

```mermaid
graph TD
  NASA["NASA EOSDIS (FIRMS Satellite NRT)"] --> FireData["data/nasa_firms_active_fires.json"]
  FireData --> FireLayer["src/layers/nasaFires.js (GPU Point Collection)"]
  UI["index.html (CesiumJS 3D Viewport)"] --> Store["src/store.js (Reactive State Store)"]
  Store --> Reg["src/layerRegistry.js (Layer Manager)"]
  Reg --> FireLayer
  Reg --> Layers["src/layers/ (Heat, Rain, Wind, Ocean, Tides, Plates)"]
  Store --> Soni["src/sonification.js (Web Audio API Engine)"]
  Soni --> AudioOut["Binaural Stereo Output (Left: Pin A | Right: Pin B)"]
  Store --> Osc["src/main.js (AcousticWaveformVisualizer)"]
```

- **3D Geospatial Engine**: CesiumJS (WGS84 Ellipsoid, High-DPI Canvas, GPU PointPrimitiveCollection)
- **Audio DSP Engine**: Web Audio API (BiquadFilterNode, StereoPannerNode, WaveShaper, AnalyserNode)
- **Data Ingestion**: Python (`urllib`, `csv`, `json`, `xarray`, `numpy`, `netCDF4`)
- **Hosting & Edge Delivery**: Vercel Static Edge CDN with custom headers

---

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.
