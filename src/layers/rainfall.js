// ============================================================================
// src/layers/rainfall.js — Global Precipitation & Rainfall Climatology
// ============================================================================

export const rainfallLayer = {
  id: 'rainfall',
  label: '🌧️ Rainfall (NASA GPM / GPCP)',
  type: 'raster',
  defaultOpacity: 0.60,
  timeline: true,
  timeRange: { min: 1, max: 12, step: 1, default: 7, labelFormat: 'Month' },
  legend: {
    title: 'Precipitation Rate',
    unit: 'mm/day',
    gradient: 'linear-gradient(to right, rgba(200,230,255,0.1), #90caf9, #1976d2, #7b1fa2, #e91e63)',
    ticks: ['0 mm', '2 mm', '5 mm', '10 mm', '≥ 20 mm']
  },

  cesiumLayer: null,
  canvas: null,
  ctx: null,
  data: null,
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
      const res = await fetch('data/rainfall_sample.json');
      if (res.ok) {
        this.data = await res.json();
        this.isLoaded = true;
        return;
      }
    } catch (e) {
      console.warn('[Rainfall] Fallback to procedural precipitation:', e);
    }

    this.data = this.generateFallback();
    this.isLoaded = true;
  },

  generateFallback() {
    const months = {};
    for (let m = 1; m <= 12; m++) {
      const grid = [];
      const itczShift = Math.sin((m - 1) / 11 * Math.PI) * 12;
      for (let r = 0; r < 36; r++) {
        const lat = 87.5 - r * 5.0;
        const row = [];
        for (let c = 0; c < 72; c++) {
          const lon = -177.5 + c * 5.0;
          const dist = Math.abs(lat - itczShift);
          let mm = Math.max(0, 14.0 * Math.exp(-(dist * dist) / 100.0));
          if (m >= 6 && m <= 9 && lat > 5 && lat < 30 && lon > 65 && lon < 100) mm += 16.0;
          if (lat > 15 && lat < 32 && lon > -15 && lon < 55) mm *= 0.05;
          row.push(Math.round(mm * 10) / 10);
        }
        grid.push(row);
      }
      months[m] = grid;
    }
    return { months };
  },

  query(lat, lon, month = 7) {
    if (!this.data || !this.data.months) return 2.0;
    const m = Math.max(1, Math.min(12, Math.round(month)));
    const grid = this.data.months[m] || this.data.months[7];

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

    const v00 = grid[r0][c0] || 0;
    const v01 = grid[r0][c1] || 0;
    const v10 = grid[r1][c0] || 0;
    const v11 = grid[r1][c1] || 0;
    return (1 - dr) * ((1 - dc) * v00 + dc * v01) + dr * ((1 - dc) * v10 + dc * v11);
  },

  colorForRain(mm) {
    // Transparent (dry) -> Light blue -> Blue -> Purple -> Magenta (extreme)
    if (mm < 0.2) return [0, 0, 0, 0]; // Transparent for dry regions
    if (mm < 2.0) {
      const t = mm / 2.0;
      return [144, 202, 249, Math.floor(60 + t * 140)];
    } else if (mm < 6.0) {
      const t = (mm - 2.0) / 4.0;
      return [Math.floor(144 - t * 119), Math.floor(202 - t * 84), Math.floor(249 - t * 39), 210];
    } else if (mm < 14.0) {
      const t = (mm - 6.0) / 8.0;
      return [Math.floor(25 + t * 98), Math.floor(118 - t * 87), Math.floor(210 - t * 48), 235];
    } else {
      const t = Math.min(1.0, (mm - 14.0) / 12.0);
      return [Math.floor(123 + t * 110), Math.floor(31 - t * 1), Math.floor(162 - t * 63), 255];
    }
  },

  renderRaster(month = 7) {
    if (!this.ctx || !this.isLoaded) return;
    const w = this.canvas.width;
    const h = this.canvas.height;
    const imgData = this.ctx.createImageData(w, h);
    const data = imgData.data;

    for (let y = 0; y < h; y++) {
      const lat = 90 - (y / h) * 180;
      for (let x = 0; x < w; x++) {
        const lon = (x / w) * 360 - 180;
        const mm = this.query(lat, lon, month);
        const [r, g, b, a] = this.colorForRain(mm);
        const idx = (y * w + x) * 4;
        data[idx]     = r;
        data[idx + 1] = g;
        data[idx + 2] = b;
        data[idx + 3] = a;
      }
    }
    this.ctx.putImageData(imgData, 0, 0);
  },

  show(viewer, month = 7, opacity = 0.60) {
    if (!this.canvas) {
      this.canvas = document.createElement('canvas');
      this.canvas.width = 360;
      this.canvas.height = 180;
      this.ctx = this.canvas.getContext('2d');
    }
    this.renderRaster(month);
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
    const month = (typeof time === 'object' && time.month != null) ? time.month : (time || 7);
    if (!this.cesiumLayer || !this.isLoaded) {
      this.show(viewer, month, opacity);
      return;
    }
    this.renderRaster(month);
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
    const month = (typeof time === 'number') ? time : ((time && time.month != null) ? time.month : 7);
    const val = this.query(lat, lon, month);
    return {
      primary: `${val.toFixed(1)} mm/day`,
      secondary: `${Math.round(val * 30)} mm/month`,
      numericValue: val
    };
  }
};
