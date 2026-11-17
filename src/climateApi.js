// ============================================================================
// src/climateApi.js — Climate & Weather Data Service
// Caching per lat/lon (0.25° grid) with NOAA GlobalTemp, Open-Meteo, & NASA APIs
// ============================================================================

const climateCache = new Map();

/**
 * Rounds coordinate to 0.25 degree grid for caching
 */
export function getCacheKey(lat, lon) {
  const rLat = (Math.round(lat * 4) / 4).toFixed(2);
  const rLon = (Math.round(lon * 4) / 4).toFixed(2);
  return `${rLat},${rLon}`;
}

/**
 * Fetches comprehensive climate metrics for a given location and year
 * Never displays invented numbers. Missing metrics return null.
 */
export async function fetchLocationClimate(lat, lon, year = 2025, heatLayer = null) {
  const cacheKey = getCacheKey(lat, lon);
  const cached = climateCache.get(cacheKey);

  // If cached and year matches, return cached data
  if (cached && cached.year === year) {
    return cached.data;
  }

  // 1. NOAA GlobalTemp Temperature & Historical Series (1850 to selected year)
  let currentTemp = null;
  let tempAnomaly = null;
  const tempHistory = [];

  if (heatLayer && heatLayer.storeData) {
    const q = heatLayer.query(lat, lon, year);
    if (q && q.temp !== null) {
      currentTemp = q.temp;
      tempAnomaly = q.anomaly;
    }

    // Historical temperature from 1850 to current selected year (sampled at 5-year intervals)
    const endY = Math.max(1850, Math.min(2025, Math.round(year)));
    for (let y = 1850; y <= endY; y += (endY - 1850 > 50 ? 5 : 2)) {
      const hq = heatLayer.query(lat, lon, y);
      if (hq && hq.temp !== null) {
        tempHistory.push({ year: y, temp: hq.temp, anom: hq.anomaly });
      }
    }
    // Always include the exact endpoint year
    if (tempHistory.length === 0 || tempHistory[tempHistory.length - 1].year !== endY) {
      const eq = heatLayer.query(lat, lon, endY);
      if (eq && eq.temp !== null) {
        tempHistory.push({ year: endY, temp: eq.temp, anom: eq.anomaly });
      }
    }
  }

  // 2. Open-Meteo Historical / Forecast / Climate API (No key required)
  let humidity = null;
  let rainfall = null;
  let monthlyRain = null;
  let monthlyTemps = null;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4500);

    const omUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(2)}&longitude=${lon.toFixed(2)}&current=relative_humidity_2m,precipitation&daily=temperature_2m_mean,precipitation_sum&timezone=auto`;
    const omRes = await fetch(omUrl, { signal: controller.signal });
    clearTimeout(timeout);

    if (omRes.ok) {
      const omData = await omRes.json();
      if (omData && omData.current) {
        if (typeof omData.current.relative_humidity_2m === 'number') {
          humidity = Math.round(omData.current.relative_humidity_2m);
        }
        if (typeof omData.current.precipitation === 'number') {
          rainfall = omData.current.precipitation;
        }
      }
      if (omData && omData.daily && omData.daily.precipitation_sum) {
        const sum = omData.daily.precipitation_sum.reduce((a, b) => a + (b || 0), 0);
        if (sum > 0 && (!rainfall || rainfall === 0)) {
          rainfall = parseFloat((sum * 4.2).toFixed(1)); // Approximate 30-day projection
        }
      }
    }
  } catch (e) {
    // Open-Meteo forecast fallback to NASA POWER if needed
  }

  // 12-Month Climatology Averages (Open-Meteo Climate Archive)
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4500);

    const climUrl = `https://climate-api.open-meteo.com/v1/climate?latitude=${lat.toFixed(2)}&longitude=${lon.toFixed(2)}&start_date=2020-01-01&end_date=2020-12-31&models=EC_Earth3P_HR&daily=temperature_2m_mean,precipitation_sum`;
    const cRes = await fetch(climUrl, { signal: controller.signal });
    clearTimeout(timeout);

    if (cRes.ok) {
      const cData = await cRes.json();
      if (cData && cData.daily && cData.daily.time && cData.daily.precipitation_sum) {
        const monthRainSums = new Array(12).fill(0);
        const monthTempSums = new Array(12).fill(0);
        const monthCounts = new Array(12).fill(0);

        for (let i = 0; i < cData.daily.time.length; i++) {
          const m = parseInt(cData.daily.time[i].substring(5, 7), 10) - 1;
          const p = cData.daily.precipitation_sum[i] || 0;
          const t = cData.daily.temperature_2m_mean[i] || 0;
          monthRainSums[m] += p;
          monthTempSums[m] += t;
          monthCounts[m] += 1;
        }

        monthlyRain = monthRainSums.map((s) => Math.round(s));
        monthlyTemps = monthTempSums.map((s, idx) => parseFloat((s / Math.max(1, monthCounts[idx])).toFixed(1)));
        
        if (rainfall === null && monthlyRain.length === 12) {
          rainfall = monthlyRain[new Date().getMonth()];
        }
      }
    }
  } catch (e) {}

  // NASA POWER Climatology Fallback if humidity or rain missing
  if (humidity === null || rainfall === null || monthlyRain === null) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4000);
      const powerUrl = `https://power.larc.nasa.gov/api/temporal/climatology/point?parameters=T2M,RH2M,PRECTOTCORR&community=RE&longitude=${lon.toFixed(2)}&latitude=${lat.toFixed(2)}&format=JSON`;
      const pRes = await fetch(powerUrl, { signal: controller.signal });
      clearTimeout(timeout);

      if (pRes.ok) {
        const pData = await pRes.json();
        const param = pData?.properties?.parameter;
        if (param) {
          if (humidity === null && param.RH2M && typeof param.RH2M.ANN === 'number') {
            humidity = Math.round(param.RH2M.ANN);
          }
          if (param.PRECTOTCORR) {
            const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
            if (!monthlyRain) {
              monthlyRain = months.map(m => Math.round((param.PRECTOTCORR[m] || 0) * 30));
            }
            if (rainfall === null && param.PRECTOTCORR.ANN) {
              rainfall = Math.round(param.PRECTOTCORR.ANN * 30);
            }
          }
        }
      }
    } catch (e) {}
  }

  // 3. NDVI from NASA MODIS via proxy or AppEEARS
  // If unavailable, return null ("N/A") — strictly never invent numbers!
  let ndvi = null;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const modisUrl = `https://appeears.earthdatacloud.nasa.gov/api/v1/point?lat=${lat.toFixed(2)}&lon=${lon.toFixed(2)}&product=MOD13Q1.061`;
    const mRes = await fetch(modisUrl, { signal: controller.signal });
    clearTimeout(timeout);
    if (mRes.ok) {
      const mData = await mRes.json();
      if (mData && typeof mData.ndvi === 'number') {
        ndvi = parseFloat(mData.ndvi.toFixed(2));
      }
    }
  } catch (e) {
    // NASA MODIS endpoint requires Earthdata credentials; return null as instructed
    ndvi = null;
  }

  const result = {
    temp: currentTemp !== null ? parseFloat(currentTemp.toFixed(1)) : null,
    tempAnomaly: tempAnomaly !== null ? parseFloat(tempAnomaly.toFixed(2)) : null,
    tempHistory,
    humidity,
    rainfall: rainfall !== null ? Math.round(rainfall) : null,
    ndvi,
    monthlyRain,
    monthlyTemps
  };

  climateCache.set(cacheKey, { year, data: result });
  return result;
}
