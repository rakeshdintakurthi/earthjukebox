# Thermophone: 3D Multilayer Climate & Earth Systems Globe

An interactive 3D planetary climate globe built with **CesiumJS** featuring an on-demand, modular layer architecture, dual render states, natural-language command parser, and multi-variable comparison.

---

## Quick Start & Running Locally

### Option 1: Modern Node.js / Vite (Recommended)
```bash
npm install
npm run dev
```
Open the local URL displayed by Vite (usually `http://localhost:5173/earth.html` or `http://localhost:8000/earth.html`).

### Option 2: Python HTTP Server (Zero Dependencies)
```bash
python -m http.server 8000
```
Visit **`http://localhost:8000/earth.html`** in any modern web browser.

---

## Architecture & Layer Registry

The application separates state from visual rendering using a central store (`src/store.js`) and an extensible Layer Registry (`src/layerRegistry.js`).

Every layer module implements the standard contract:
```typescript
interface LayerModule {
  id: string;
  label: string;
  type: 'raster' | 'overlay';
  defaultOpacity: number;
  timeline: boolean;
  timeRange?: { min: number; max: number; step: number; default: number };
  legend: { title: string; unit: string; gradient?: string; ticks?: string[]; items?: Array<{ label: string; color: string }> };
  load(viewer: Cesium.Viewer): Promise<void>;
  show(viewer: Cesium.Viewer, options?: any): void;
  hide(viewer: Cesium.Viewer): void;
  update(time: any, viewer: Cesium.Viewer): void;
  setOpacity(alpha: number): void;
  getValueAt(lat: number, lon: number, time?: any): { primary: string; secondary: string; numericValue: number };
}
```

### Layer Behaviors & Stacking Rules
1. **Raster Field Layers** (`heat`, `rainfall`, `ocean_sst`): Mutually exclusive. Enabling one automatically disables any other raster layer. Each renders as a separate, semi-transparent `Cesium.ImageryLayer` (55%–65% opacity) over the photorealistic satellite globe.
2. **Animated & Vector Overlays** (`wind`, `ocean`, `tides`, `plates`): Fully stackable on top of any active raster field or directly over the pristine satellite globe.
3. **Pristine Default State**: When all layers are unchecked, the globe returns to a clean Google Earth satellite view (no draped overlays, no legends, no timelines) with camera position preserved.

---

## Layer Specifications & Official Data Sources

| Layer | Type | Native Units | Primary Real Data Source | Download URL |
| :--- | :--- | :--- | :--- | :--- |
| **Heat Map** | Raster | Anomaly in °C | NOAA GlobalTemp v6.0.0 (1850–2025) | [NOAA NCEI GlobalTemp](https://doi.org/10.25921/9qth-2p70) |
| **Rainfall** | Raster | mm/day & mm/month | GPCP v2.3 / NASA GPM IMERG | [NASA GES DISC GPM](https://gpm.nasa.gov/data/imerg) |
| **Wind** | Overlay | m/s & km/h | NOAA GFS 0.25° / ECMWF ERA5 | [NOAA NOMADS GFS](https://nomads.ncep.noaa.gov/) |
| **Ocean** | Overlay/Raster| m/s & °C | NASA OSCAR & NOAA OISST v2.1 | [PO.DAAC OSCAR](https://podaac.jpl.nasa.gov/) |
| **Tides** | Overlay | Meters (M2 Amplitude)| CNES/LEGOS FES2014 & TPXO9 | [AVISO+ FES2014](https://www.aviso.altimetry.fr/en/data/products/auxiliary-products/global-tide-fes.html) |
| **Tectonic Plates**| Vector | mm/yr (MORVEL) | Peter Bird (PB2002) GeoJSON | [PB2002 GitHub](https://github.com/fraxen/tectonicplates) |

---

## Binaural Fire Sonification Engine (`src/sonification.js`)

The sonification engine transforms heat map temperatures into **authentic procedural fire sound** using the Web Audio API. Absolutely zero synthetic beeps, whistles, or siren tones:

1. **Physical Fire Synthesis**:
   - **Flame Roar**: Resonant pink noise combustion turbulence ($Q = 1.8$, 80–240 Hz) with low-frequency thermal convection breathing flutter (3–8 Hz).
   - **Wood & Ember Crackles**: Poisson-distributed micro-impulses (1.5 kHz – 4.5 kHz bandpass) with sharp exponential decay (1–4 ms).
   - **Thermal Scaling**:
     - **Scorching Heat (+38°C)**: Raging inferno, 110+ crackles/sec, deep heavy roaring flame.
     - **Temperate (+15°C)**: Warm campfire, ~50 crackles/sec, gentle steady rumble.
     - **Cold / Sub-zero (-10°C)**: Dying embers, ~15 crackles/sec, faint distant tick.
2. **Dedicated Separate Ear Options**:
   - **`◀ Pin A (Left Ear Only)`**: Hard-panned `pan = -1.0` (100% Left Ear, Right Ear completely silent).
   - **`Pin B (Right Ear Only) ▶`**: Hard-panned `pan = +1.0` (100% Right Ear, Left Ear completely silent).
   - **`🔥 Compare Both (L + R)`**: Plays Pin A in Left Ear and Pin B in Right Ear simultaneously.
   - **`🔁 Loop Comparison`**: Continuous looping binaural fire playback.
   - **`⏹ Stop`**: Immediate silence.
3. **Inspector Contrast Readout**:
   - Live thermal gauges displaying exact crackle rates and intensity percentage for Pin A and Pin B.
   - Dynamic contrast ratio showing which pin is crackling faster and the temperature difference (e.g., *Pin A crackles 3.8× faster than Pin B (+28.4°C hotter)*).

---

## Python NetCDF Conversion Pipeline

To regrid source NetCDF datasets into the lightweight JSON/raster formats consumed by the frontend, run the conversion pipeline below using `xarray` and `netCDF4`:

```bash
pip install xarray netCDF4 numpy
python prepare_data.py
```

### Conversion Script (`scripts/convert_climate.py`)

```python
import xarray as xr
import numpy as np
import json

# 1. Process Global Temperature Anomalies (NOAA GlobalTemp)
def convert_temperature_anomalies(nc_path, out_json_path):
    ds = xr.open_dataset(nc_path)
    # Regrid to 5-degree grid (36 lats x 72 lons)
    target_lats = np.linspace(87.5, -87.5, 36)
    target_lons = np.linspace(-177.5, 177.5, 72)
    regridded = ds['air'].interp(lat=target_lats, lon=target_lons, method='linear')

    annual_means = regridded.groupby('time.year').mean(dim='time')
    out = {}
    for year in range(1900, 2026):
        if year in annual_means.year.values:
            grid = annual_means.sel(year=year).values
            # Scale to Int16 in 0.01 °C units
            out[year] = np.nan_to_num(np.round(grid * 100), nan=0).astype(int).tolist()

    with open(out_json_path, 'w') as f:
        json.dump(out, f)
    print(f"Exported temperature anomalies to {out_json_path}")

# 2. Process Precipitation / Rainfall (GPCP / IMERG)
def convert_precipitation(nc_path, out_json_path):
    ds = xr.open_dataset(nc_path)
    target_lats = np.linspace(87.5, -87.5, 36)
    target_lons = np.linspace(-177.5, 177.5, 72)
    regridded = ds['precip'].interp(lat=target_lats, lon=target_lons)
    
    monthly_clim = regridded.groupby('time.month').mean(dim='time')
    months_dict = {}
    for m in range(1, 13):
        grid = monthly_clim.sel(month=m).values
        months_dict[m] = np.nan_to_num(np.round(grid, 1), nan=0.0).tolist()

    with open(out_json_path, 'w') as f:
        json.dump({'months': months_dict}, f)
    print(f"Exported precipitation climatology to {out_json_path}")
```


## Configuration & Tuning (`main.js`)

You can customize the following configuration constants directly at the top of `main.js`:

```javascript
// Maximum anomaly scale range in °C (default: 4.0 °C).
// Values are sampled from the map's diverging blue-white-red color gradient.
const ANOMALY_RANGE = 4;

// Longitudinal alignment offset in degrees (default: 0).
// Adjust if you want to rotate the temperature layer relative to the base Earth.
const VIDEO_LNG_OFFSET = 0;

// Vertical texture orientation (default: false).
// Set to true if texture appears upside down.
const FLIP_V = false;

// Maximum interactive frame index (default: 1751 for Dec 2025).
// Frames 1752-1799 are hold frames and are ignored.
const MAX_FRAME = 1751;
```

---

## Sight-to-Sound Mapping

Temperatures sampled from the map color are mapped across 36 semitones, snapping to the nearest note in a C major pentatonic scale ($f = 130.81 \times 2^{n/12}\text{ Hz}$) anchored at C3:
- **Pin A** uses a sine synthesizer in the left stereo channel.
- **Pin B** uses a triangle synthesizer in the right stereo channel.
- **Timeline Playback**: When playing through the timeline, yearly mean anomalies are accumulated and sounded per calendar year.
- **Volume Cap**: Master volume is capped at -12 dB.

---

## Keyboard Controls

| Key | Action |
| :--- | :--- |
| <kbd>&larr;</kbd> / <kbd>&rarr;</kbd> | Step backward / forward by 1 month |
| <kbd>Shift</kbd> + <kbd>&larr;</kbd> / <kbd>&rarr;</kbd> | Step backward / forward by 1 year (12 months) |
| <kbd>Home</kbd> / <kbd>End</kbd> | Jump to start (Jan 1880) / end (Dec 2025) |
| <kbd>Space</kbd> | Play / pause video timeline |
| <kbd>A</kbd> / <kbd>B</kbd> | Set Pin A / Pin B to selected point |
| <kbd>P</kbd> | Pin currently selected point |
| <kbd>G</kbd> | Toggle alignment debug markers (0,0 Green & Guntur Yellow) |
| <kbd>D</kbd> | Toggle debug HUD |
| <kbd>Esc</kbd> | Close panels / popovers |
