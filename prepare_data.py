#!/usr/bin/env python3
"""
prepare_data.py — Data Processing Pipeline for Thermophone (NASA Space Apps Challenge)

Reads official NOAA GlobalTemp gridded monthly surface temperature anomalies and
NCEP Reanalysis surface climatology, calculates yearly means, regrids onto a
5-degree global grid (36 lat rows x 72 lon cols), and exports:
  - anomalies.json: Int16 values (in units of 0.01 °C) for each year (1900-2025)
  - climatology.json: Annual baseline mean temperature (in units of 0.01 °C)
  - meta.json: Dataset provenance, grid specification, units, and baseline info
"""

import os
import json
import urllib.request
import datetime
import numpy as np
import xarray as xr
import cftime

# URLs for official NOAA gridded NetCDF datasets
NOAA_ANOM_URL = "https://downloads.psl.noaa.gov/Datasets/noaaglobaltemp/air.mon.anom.nc"
NOAA_CLIM_URL = "https://downloads.psl.noaa.gov/Datasets/ncep.reanalysis.derived/surface/air.mon.ltm.nc"

RAW_ANOM_FILE = "noaa_anomalies_raw.nc"
RAW_CLIM_FILE = "climatology_raw.nc"

# Target 5-degree grid specification
TARGET_LATS = np.linspace(87.5, -87.5, 36)    # Row 0: +87.5 (North) -> Row 35: -87.5 (South)
TARGET_LONS = np.linspace(-177.5, 177.5, 72)  # Col 0: -177.5 (West) -> Col 71: +177.5 (East)
START_YEAR = 1900
END_YEAR = 2025

def ensure_data_files():
    """Download source NetCDF datasets if not already present."""
    if not os.path.exists(RAW_ANOM_FILE):
        print(f"Downloading NOAA GlobalTemp anomalies from {NOAA_ANOM_URL}...")
        urllib.request.urlretrieve(NOAA_ANOM_URL, RAW_ANOM_FILE)
        print("Download complete.")

    if not os.path.exists(RAW_CLIM_FILE):
        print(f"Downloading NOAA/NCEP Climatology from {NOAA_CLIM_URL}...")
        urllib.request.urlretrieve(NOAA_CLIM_URL, RAW_CLIM_FILE)
        print("Download complete.")

def process_climatology():
    """
    Process NCEP long-term monthly mean surface air temperature to annual climatology
    and regrid onto the target 5-degree grid (36 lats x 72 lons).
    """
    print("Processing climatology...")
    ds_clim = xr.open_dataset(RAW_CLIM_FILE, decode_times=False)
    # Compute annual mean across the 12 monthly climatological means
    clim_annual = ds_clim['air'].mean(dim='time')  # (lat: 73, lon: 144)

    # Every target lat (87.5 to -87.5 by 5) and lon (-177.5 to 177.5 by 5)
    # is an exact coordinate point in the 2.5-degree resolution grid.
    target_lons_360 = (TARGET_LONS + 360) % 360
    clim_grid = clim_annual.sel(lat=TARGET_LATS, lon=target_lons_360).values  # shape (36, 72)

    # Convert to integer in 0.01 °C units, or None for missing
    clim_json = []
    for r in range(36):
        row_vals = []
        for c in range(72):
            val = clim_grid[r, c]
            if np.isnan(val):
                row_vals.append(None)
            else:
                row_vals.append(int(round(float(val) * 100)))
        clim_json.append(row_vals)

    return clim_json

def process_anomalies():
    """
    Process NOAA GlobalTemp monthly anomalies:
    - Decodes dates using cftime
    - Groups and averages by calendar year
    - Regrids to 36 lat x 72 lon grid (North-to-South, West-to-East)
    - Exports int16 values in 0.01 °C (or None for missing cells)
    """
    print(f"Processing NOAA GlobalTemp anomalies for years {START_YEAR} to {END_YEAR}...")
    ds = xr.open_dataset(RAW_ANOM_FILE, decode_times=False)
    time_units = ds['time'].attrs.get('units', 'days since 1800-1-1 00:00:0.0')
    dates = cftime.num2date(ds['time'].values, units=time_units, calendar='gregorian')
    all_years = np.array([d.year for d in dates])
    air = ds['air'].values  # shape (time, 36, 72) where lat is -87.5..87.5, lon is 2.5..357.5

    anomalies_by_year = {}
    os.makedirs("data", exist_ok=True)

    for yr in range(START_YEAR, END_YEAR + 1):
        mask = (all_years == yr)
        if not np.any(mask):
            continue

        # Annual mean across all months of the year
        with np.errstate(all='ignore'):
            yr_mean = np.nanmean(air[mask], axis=0)  # shape (36, 72)

        # 1. Reverse latitudes: from South-to-North (-87.5..87.5) to North-to-South (87.5..-87.5)
        yr_mean = yr_mean[::-1, :]

        # 2. Shift longitudes: from [2.5..357.5] to [-177.5..177.5]
        # Columns 36..71 (182.5..357.5) become -177.5..-2.5; Columns 0..35 (2.5..177.5) remain positive
        yr_mean = np.concatenate([yr_mean[:, 36:], yr_mean[:, :36]], axis=1)

        # Convert to 0.01 °C integers or null
        grid_data = []
        for r in range(36):
            row_data = []
            for c in range(72):
                v = yr_mean[r, c]
                if np.isnan(v):
                    row_data.append(None)
                else:
                    row_data.append(int(round(float(v) * 100)))
            grid_data.append(row_data)

        anomalies_by_year[str(yr)] = grid_data

        # Also write per-year JSON in data/anomalies_<year>.json
        with open(f"data/anomalies_{yr}.json", "w") as f_yr:
            json.dump(grid_data, f_yr)

    return anomalies_by_year

def main():
    ensure_data_files()
    clim_data = process_climatology()
    anomalies_data = process_anomalies()

    # Save consolidated anomalies.json
    print("Exporting anomalies.json...")
    with open("anomalies.json", "w") as f:
        json.dump(anomalies_data, f)
    anom_size_mb = os.path.getsize("anomalies.json") / (1024 * 1024)
    print(f"anomalies.json saved ({anom_size_mb:.2f} MB)")

    # Save climatology.json
    print("Exporting climatology.json...")
    with open("climatology.json", "w") as f:
        json.dump(clim_data, f)
    clim_size_kb = os.path.getsize("climatology.json") / 1024
    print(f"climatology.json saved ({clim_size_kb:.1f} KB)")

    # Save meta.json
    meta = {
        "title": "Thermophone Real Climate Dataset (NASA Space Apps Challenge)",
        "units": "0.01 degC (multiply integer value by 0.01 to obtain degrees Celsius)",
        "scale_factor": 0.01,
        "missing_value": None,
        "baseline_period": "1971-2000 (NOAA GlobalTemp v5 anomaly baseline)",
        "climatology_baseline": "1991-2020 (NCEP Reanalysis Surface Climatology annual mean)",
        "grid_spec": {
            "lat_min": -87.5,
            "lat_max": 87.5,
            "lon_min": -177.5,
            "lon_max": 177.5,
            "step": 5.0,
            "rows": 36,
            "cols": 72
        },
        "source": "NOAA National Centers for Environmental Information (NCEI) / PSL NOAAGlobalTemp v5",
        "climatology_source": "NOAA / Physical Sciences Laboratory NCEP-NCAR Reanalysis 1 Surface Air Temperature",
        "download_date": datetime.date.today().isoformat(),
        "years": list(range(START_YEAR, END_YEAR + 1))
    }

    print("Exporting meta.json...")
    with open("meta.json", "w") as f:
        json.dump(meta, f, indent=2)

    total_size_mb = anom_size_mb + (clim_size_kb / 1024)
    print(f"Total payload size: {total_size_mb:.2f} MB (well under 5 MB limit)")
    print("Data preparation complete!")

if __name__ == "__main__":
    main()

