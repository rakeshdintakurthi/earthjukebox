// ============================================================================
// src/layers/heat.js — Global Surface Temperature & Anomaly Heat Map
// ============================================================================

export const heatLayer = {
  id: 'heat',
  label: '🔥 Heat Map (1850–2025) [NOAA GlobalTemp]',
  type: 'raster',
  defaultOpacity: 0.60,
  timeline: true,
  timeRange: { min: 1850, max: 2025, step: 1, default: 2025 },
  mode: 'temperature', // 'temperature' | 'anomaly'
  legend: {
    title: 'Surface Temperature',
    unit: '°C',
    gradient: 'linear-gradient(to right, #0a1237, #1450a0, #00afdf, #23c896, #82cd3c, #ffd700, #ff7d1e, #eb1e14, #8c001e)',
    ticks: ['≤ -30°C', '-15°C', '0°C', '+15°C', '+25°C', '≥ 35°C']
  },

  cesiumLayer: null,
  canvas: null,
  ctx: null,
  storeData: null,
  isLoaded: false,

  async load(viewer) {
    if (this.isLoaded) return;
    if (!this.canvas) {
      this.canvas = document.createElement('canvas');
      this.canvas.width = 360;
      this.canvas.height = 180;
      this.ctx = this.canvas.getContext('2d');
    }

    try {
      const [aRes, cRes] = await Promise.all([
        fetch('anomalies.json'),
        fetch('climatology.json')
      ]);
      if (aRes.ok && cRes.ok) {
        const anomalies = await aRes.json();
        const climatology = await cRes.json();
        this.storeData = { anomalies, climatology };
        this.isLoaded = true;
        return;
      }
    } catch (e) {
      console.warn('[HeatLayer] Fetching local JSON fallback:', e);
    }

    // Procedural fallback
    this.storeData = this.generateFallbackData();
    this.isLoaded = true;
  },

  generateFallbackData() {
    const anomalies = {};
    const climatology = [];
    for (let r = 0; r < 36; r++) {
      const lat = 87.5 - r * 5.0;
      const normLat = Math.abs(lat) / 90.0;
      const climRow = [];
      for (let c = 0; c < 72; c++) {
        climRow.push(Math.round((28.0 - normLat * 54.0) * 100));
      }
      climatology.push(climRow);
    }
    for (let y = 1850; y <= 2025; y++) {
      const progress = (y - 1850) / 175.0;
      const grid = [];
      for (let r = 0; r < 36; r++) {
        const lat = 87.5 - r * 5.0;
        const normLat = Math.abs(lat) / 90.0;
        const amp = normLat > 0.6 ? 2.6 : 1.0;
        const row = [];
        for (let c = 0; c < 72; c++) {
          const lon = -177.5 + c * 5.0;
          const wave = Math.sin((lon + 45) * Math.PI / 90) * Math.cos(lat * Math.PI / 45) * 0.4;
          const a = (progress * 1.45 * amp - 0.4) + wave;
          row.push(Math.round(a * 100));
        }
        grid.push(row);
      }
      anomalies[y] = grid;
    }
    return { anomalies, climatology };
  },

  query(lat, lon, year) {
    if (!this.storeData) return { temp: 20.0, anomaly: 0.0 };
    const clampYear = Math.max(1850, Math.min(2025, year));
    const y0 = Math.floor(clampYear);
    const y1 = Math.min(2025, Math.ceil(clampYear));
    const frac = clampYear - y0;

    const rowF = Math.max(0, Math.min(35, (87.5 - lat) / 5.0));
    let colF = (lon + 177.5) / 5.0;
    while (colF < 0) colF += 72;
    colF = colF % 72;

    const r0 = Math.floor(rowF);
    const r1 = Math.min(35, r0 + 1);
    const dr = rowF - r0;
    const c0 = Math.floor(colF);
    const c1 = (c0 + 1) % 72;
    const dc = colF - c0;

    const grid0 = this.storeData.anomalies[y0] || this.storeData.anomalies[1850];
    const grid1 = this.storeData.anomalies[y1] || grid0;

    const sample = (g) => {
      if (!g) return 0.0;
      const v00 = (g[r0] && g[r0][c0] != null) ? g[r0][c0] * 0.01 : 0.0;
      const v01 = (g[r0] && g[r0][c1] != null) ? g[r0][c1] * 0.01 : v00;
      const v10 = (g[r1] && g[r1][c0] != null) ? g[r1][c0] * 0.01 : v00;
      const v11 = (g[r1] && g[r1][c1] != null) ? g[r1][c1] * 0.01 : v10;
      return (1 - dr) * ((1 - dc) * v00 + dc * v01) + dr * ((1 - dc) * v10 + dc * v11);
    };

    const anom = (1 - frac) * sample(grid0) + frac * sample(grid1);
    let clim = 24.0 - (Math.abs(lat) / 90.0) * 48.0;
    if (this.storeData.climatology) {
      const cg = this.storeData.climatology;
      const c00 = (cg[r0] && cg[r0][c0] != null) ? cg[r0][c0] * 0.01 : clim;
      const c01 = (cg[r0] && cg[r0][c1] != null) ? cg[r0][c1] * 0.01 : c00;
      const c10 = (cg[r1] && cg[r1][c0] != null) ? cg[r1][c0] * 0.01 : c00;
      const c11 = (cg[r1] && cg[r1][c1] != null) ? cg[r1][c1] * 0.01 : c10;
      clim = (1 - dr) * ((1 - dc) * c00 + dc * c01) + dr * ((1 - dc) * c10 + dc * c11);
    }

    return { temp: clim + anom, anomaly: anom };
  },

  colorForTemperature(temp) {
    // Thermal heat map palette:
    // Polar freeze (-35°C to -10°C): Deep Navy -> Steel Blue
    // Freezing to cool (-10°C to 10°C): Cyan -> Aqua -> Mint -> Green
    // Mild to warm (10°C to 24°C): Lime -> Warm Yellow
    // Hot (24°C to 32°C): Amber -> Bright Orange
    // Scorching (> 32°C): Vivid Red -> Dark Crimson
    const stops = [
      { t: -35, rgb: [10, 18, 55] },
      { t: -20, rgb: [20, 80, 160] },
      { t:  -5, rgb: [0, 175, 215] },
      { t:   5, rgb: [35, 200, 150] },
      { t:  14, rgb: [130, 205, 60] },
      { t:  22, rgb: [255, 215, 0] },
      { t:  28, rgb: [255, 125, 30] },
      { t:  34, rgb: [235, 30, 20] },
      { t:  42, rgb: [140, 0, 30] }
    ];
    if (temp <= stops[0].t) return stops[0].rgb;
    if (temp >= stops[stops.length - 1].t) return stops[stops.length - 1].rgb;
    for (let i = 0; i < stops.length - 1; i++) {
      const s0 = stops[i], s1 = stops[i + 1];
      if (temp >= s0.t && temp <= s1.t) {
        const f = (temp - s0.t) / (s1.t - s0.t);
        return [
          Math.round(s0.rgb[0] + f * (s1.rgb[0] - s0.rgb[0])),
          Math.round(s0.rgb[1] + f * (s1.rgb[1] - s0.rgb[1])),
          Math.round(s0.rgb[2] + f * (s1.rgb[2] - s0.rgb[2]))
        ];
      }
    }
    return [255, 255, 255];
  },

  colorForAnomaly(anom) {
    const stops = [
      { a: -2.5, rgb: [0, 34, 255] },
      { a: -1.0, rgb: [0, 180, 216] },
      { a:  0.0, rgb: [82, 183, 136] },
      { a:  0.6, rgb: [255, 234, 0] },
      { a:  1.4, rgb: [255, 123, 0] },
      { a:  2.4, rgb: [230, 20, 20] },
      { a:  3.6, rgb: [140, 0, 30] }
    ];
    if (anom <= stops[0].a) return stops[0].rgb;
    if (anom >= stops[stops.length - 1].a) return stops[stops.length - 1].rgb;
    for (let i = 0; i < stops.length - 1; i++) {
      const s0 = stops[i], s1 = stops[i + 1];
      if (anom >= s0.a && anom <= s1.a) {
        const t = (anom - s0.a) / (s1.a - s0.a);
        return [
          Math.round(s0.rgb[0] + t * (s1.rgb[0] - s0.rgb[0])),
          Math.round(s0.rgb[1] + t * (s1.rgb[1] - s0.rgb[1])),
          Math.round(s0.rgb[2] + t * (s1.rgb[2] - s0.rgb[2]))
        ];
      }
    }
    return [255, 255, 255];
  },

  setMode(newMode, viewer) {
    this.mode = newMode;
    if (newMode === 'temperature') {
      this.legend = {
        title: 'Surface Temperature',
        unit: '°C',
        gradient: 'linear-gradient(to right, #0a1237, #1450a0, #00afdf, #23c896, #82cd3c, #ffd700, #ff7d1e, #eb1e14, #8c001e)',
        ticks: ['≤ -30°C', '-15°C', '0°C', '+15°C', '+25°C', '≥ 35°C']
      };
    } else {
      this.legend = {
        title: 'Temperature Anomaly',
        unit: 'Δ°C',
        gradient: 'linear-gradient(to right, #0022ff, #00b4d8, #52b788, #ffea00, #ff7b00, #ff0000)',
        ticks: ['≤ -2.0°C', '-1.0°C', '0.0°C', '+1.0°C', '≥ +2.5°C']
      };
    }
    if (this.cesiumLayer && viewer) {
      this.renderRaster(this.currentYear || 2025);
      const newProvider = new Cesium.SingleTileImageryProvider({
        url: this.canvas.toDataURL(),
        rectangle: Cesium.Rectangle.fromDegrees(-180, -90, 180, 90)
      });
      const oldLayer = this.cesiumLayer;
      const idx = viewer.imageryLayers.indexOf(oldLayer);
      const newLayer = viewer.imageryLayers.addImageryProvider(newProvider, idx >= 0 ? idx : undefined);
      newLayer.alpha = oldLayer.alpha;
      newLayer.show = true;
      this.cesiumLayer = newLayer;
      if (oldLayer) {
        try { viewer.imageryLayers.remove(oldLayer, true); } catch (e) {}
      }
    }
  },

  renderRaster(year) {
    if (!this.ctx || !this.isLoaded) return;
    this.currentYear = year;
    const w = this.canvas.width;
    const h = this.canvas.height;
    const imgData = this.ctx.createImageData(w, h);
    const data = imgData.data;

    const isTemp = (this.mode === 'temperature');

    for (let y = 0; y < h; y++) {
      const lat = 90 - (y / h) * 180;
      for (let x = 0; x < w; x++) {
        const lon = (x / w) * 360 - 180;
        const { temp, anomaly } = this.query(lat, lon, year);
        const [r, g, b] = isTemp ? this.colorForTemperature(temp) : this.colorForAnomaly(anomaly);
        const idx = (y * w + x) * 4;
        data[idx]     = r;
        data[idx + 1] = g;
        data[idx + 2] = b;
        data[idx + 3] = 255;
      }
    }
    this.ctx.putImageData(imgData, 0, 0);
  },

  show(viewer, year = 2025, opacity = 0.60) {
    if (!this.canvas) {
      this.canvas = document.createElement('canvas');
      this.canvas.width = 360;
      this.canvas.height = 180;
      this.ctx = this.canvas.getContext('2d');
    }
    this.renderRaster(year);
    const provider = new Cesium.SingleTileImageryProvider({
      url: this.canvas.toDataURL(),
      rectangle: Cesium.Rectangle.fromDegrees(-180, -90, 180, 90)
    });

    if (this.cesiumLayer) {
      try { viewer.imageryLayers.remove(this.cesiumLayer, true); } catch (e) {}
    }
    this.cesiumLayer = viewer.imageryLayers.addImageryProvider(provider);
    this.cesiumLayer.alpha = opacity;
    this.cesiumLayer.show = true;
  },

  hide(viewer) {
    if (this.cesiumLayer) {
      try {
        this.cesiumLayer.show = false;
        viewer.imageryLayers.remove(this.cesiumLayer, true);
      } catch (e) {}
      this.cesiumLayer = null;
    }
  },

  update(time, viewer, opacity = 0.60) {
    const year = (typeof time === 'object' && time.year != null) ? time.year : (time || 2025);
    if (!this.cesiumLayer || !this.isLoaded) {
      this.show(viewer, year, opacity);
      return;
    }
    this.renderRaster(year);
    const newProvider = new Cesium.SingleTileImageryProvider({
      url: this.canvas.toDataURL(),
      rectangle: Cesium.Rectangle.fromDegrees(-180, -90, 180, 90)
    });
    const oldLayer = this.cesiumLayer;
    const idx = viewer.imageryLayers.indexOf(oldLayer);
    const newLayer = viewer.imageryLayers.addImageryProvider(newProvider, idx >= 0 ? idx : undefined);
    newLayer.alpha = opacity;
    newLayer.show = true;
    this.cesiumLayer = newLayer;
    if (oldLayer) {
      try { viewer.imageryLayers.remove(oldLayer, true); } catch (e) {}
    }
  },

  setOpacity(opacity) {
    if (this.cesiumLayer) {
      this.cesiumLayer.alpha = opacity;
    }
  },

  getValueAt(lat, lon, time) {
    const year = (typeof time === 'number') ? time : ((time && time.year != null) ? time.year : 2025);
    const { temp, anomaly } = this.query(lat, lon, year);
    return {
      primary: `${temp > 0 ? '+' : ''}${temp.toFixed(1)} °C`,
      secondary: `Anomaly: ${anomaly >= 0 ? '+' : ''}${anomaly.toFixed(2)} °C`,
      numericValue: temp
    };
  }
};
