"""
Download and process real NASA FIRMS (Fire Information for Resource Management System) active fire dataset
Source: NASA MODIS C6.1 NRT (Near Real-Time) 24h Global Active Fire Detections
URL: https://firms.modaps.eosdis.nasa.gov/data/active_fire/modis-c6.1/csv/MODIS_C6_1_Global_24h.csv
"""
import urllib.request
import csv
import json
import os
import time

URL = 'https://firms.modaps.eosdis.nasa.gov/data/active_fire/modis-c6.1/csv/MODIS_C6_1_Global_24h.csv'
CSV_OUT = 'data/nasa_firms_modis_24h.csv'
JSON_OUT = 'data/nasa_firms_active_fires.json'

def download_and_process():
    t0 = time.time()
    os.makedirs('data', exist_ok=True)
    print(f"Downloading real NASA FIRMS dataset from {URL}...")
    
    req = urllib.request.Request(URL, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'})
    with urllib.request.urlopen(req, timeout=30) as resp:
        content = resp.read().decode('utf-8')
    
    with open(CSV_OUT, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"Saved raw CSV to {CSV_OUT} ({len(content) / 1024:.1f} KB)")
    
    reader = csv.DictReader(content.splitlines())
    fires = []
    
    for row in reader:
        try:
            lat = round(float(row['latitude']), 3)
            lon = round(float(row['longitude']), 3)
            bright = round(float(row['brightness']), 1)
            conf = int(row['confidence'])
            frp = round(float(row['frp']), 1)
            sat = 'Terra' if row['satellite'] == 'T' else 'Aqua'
            daynight = 'Day' if row['daynight'] == 'D' else 'Night'
            
            # Filter for high-confidence active fire observations (confidence >= 30%)
            if conf >= 30:
                fires.append({
                    'lat': lat,
                    'lon': lon,
                    'brightness': bright, # Kelvin
                    'confidence': conf,   # Percent
                    'frp': frp,           # Fire Radiative Power (MW)
                    'sat': sat,
                    'daynight': daynight,
                    'date': row['acq_date'],
                    'time': row['acq_time']
                })
        except Exception:
            continue
            
    # Sort by Fire Radiative Power descending
    fires.sort(key=lambda x: x['frp'], reverse=True)
    
    # Summary metadata
    output = {
        'source': 'NASA EOSDIS FIRMS (MODIS Collection 6.1)',
        'description': 'Global 24-hour active fire and thermal anomaly observations detected by NASA Terra & Aqua satellites',
        'generated_at': time.strftime('%Y-%m-%d %H:%M:%S UTC', time.gmtime()),
        'total_fires': len(fires),
        'max_frp': fires[0]['frp'] if fires else 0,
        'max_brightness': max([f['brightness'] for f in fires]) if fires else 0,
        'fires': fires
    }
    
    with open(JSON_OUT, 'w', encoding='utf-8') as f:
        json.dump(output, f, separators=(',', ':'))
        
    print(f"Exported {len(fires)} active NASA fire hotspots to {JSON_OUT} ({os.path.getsize(JSON_OUT) / 1024:.1f} KB) in {time.time() - t0:.2f}s")

if __name__ == '__main__':
    download_and_process()
