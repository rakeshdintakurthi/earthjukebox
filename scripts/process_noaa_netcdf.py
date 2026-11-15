"""
Process NOAA GlobalTemp v6.0.0 NetCDF dataset (1850-2025) into anomalies.json
"""
import xarray as xr
import numpy as np
import json
import time
import os

def process_noaa(nc_path='NOAAGlobalTemp_v6.0.0_gridded_s185001_e202512_c20260107T093746.nc', out_file='anomalies.json'):
    t0 = time.time()
    if not os.path.exists(nc_path):
        raise FileNotFoundError(f"Cannot find NetCDF dataset at {nc_path}")

    print(f"Reading NOAA NetCDF dataset: {nc_path}...")
    ds = xr.open_dataset(nc_path)
    anom = ds['anom'].squeeze().values  # (2112, 36, 72)
    start_year = 1850
    end_year = 2025

    data_dict = {}
    for y in range(start_year, end_year + 1):
        idx_start = (y - start_year) * 12
        idx_end = idx_start + 12
        # Annual average anomaly over 12 months
        year_mean = np.nanmean(anom[idx_start:idx_end], axis=0) # (36, 72)
        
        # Orient: North (+87.5) to South (-87.5) via axis 0 reverse;
        # Roll longitudes by 36 to align [-180, 180] centered at -177.5
        grid = np.roll(year_mean[::-1, :], 36, axis=1)
        
        # Scale to integer hundredths of a degree Celsius (0.01 deg C)
        grid_int = np.round(grid * 100).astype(int)
        data_dict[str(y)] = grid_int.tolist()

    print(f"Writing {len(data_dict)} years ({start_year}..{end_year}) to {out_file}...")
    with open(out_file, 'w', encoding='utf-8') as f:
        json.dump(data_dict, f, separators=(',', ':'))

    print(f"Complete in {time.time() - t0:.2f}s. Output size: {os.path.getsize(out_file) / (1024*1024):.2f} MB")

if __name__ == '__main__':
    process_noaa()
