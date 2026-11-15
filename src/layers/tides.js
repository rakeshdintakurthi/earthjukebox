// ============================================================================
// src/layers/tides.js — Global Tidal Range & Interactive Harmonic Tide Curves
// ============================================================================

export const tidesLayer = {
  id: 'tides',
  label: '🌊 Global Tides & Harmonic Range',
  type: 'overlay',
  defaultOpacity: 0.75,
  timeline: true,
  timeRange: { min: 0, max: 24, step: 0.5, default: 12, labelFormat: 'Hour' },
  legend: {
    title: 'M2 Tidal Amplitude',
    unit: 'meters (peak)',
    gradient: 'linear-gradient(to right, #0d47a1, #00b4d8, #52b788, #fee440, #d62828)',
    ticks: ['0.2 m', '0.6 m', '1.2 m', '2.0 m', '≥ 3.5 m']
  },

  cesiumLayer: null,
  canvas: null,
  ctx: null,
  data: null,
  viewer: null,
  stationEntities: [],
  curveModal: null,
  isLoaded: false,

  // Speed frequencies in rad/hr for major constituents
  freqs: {
    M2: 2 * Math.PI / 12.42,
    S2: 2 * Math.PI / 12.00,
    N2: 2 * Math.PI / 12.66,
    K1: 2 * Math.PI / 23.93,
    O1: 2 * Math.PI / 25.82
  },

  async load(viewer) {
    this.viewer = viewer;
    if (this.isLoaded) return;

    if (!this.canvas) {
      this.canvas = document.createElement('canvas');
      this.canvas.width = 360;
      this.canvas.height = 180;
      this.ctx = this.canvas.getContext('2d');
    }

    try {
      const res = await fetch('data/tides_sample.json');
      if (res.ok) {
        this.data = await res.json();
        this.isLoaded = true;
        return;
      }
    } catch (e) {
      console.warn('[TidesLayer] Fallback to procedural tides:', e);
    }

    this.data = this.generateFallback();
    this.isLoaded = true;
  },

  generateFallback() {
    const m2_amplitude = [];
    for (let r = 0; r < 36; r++) {
      const lat = 87.5 - r * 5.0;
      const row = [];
      for (let c = 0; c < 72; c++) {
        const lon = -177.5 + c * 5.0;
        let amp = 0.4 + Math.sin((lon + 80) * Math.PI / 40) * 0.25;
        if (lat > 40 && lat < 55 && lon > -70 && lon < -55) amp = 2.8;
        if (lat > 48 && lat < 58 && lon > -10 && lon < 5) amp = 1.9;
        if (lat > 18 && lat < 24 && lon > 68 && lon < 74) amp = 2.2;
        row.push(Math.max(0.1, Math.round(amp * 100) / 100));
      }
      m2_amplitude.push(row);
    }
    const stations = [
      { name: 'Visakhapatnam', lat: 17.6868, lon: 83.2185, constituents: { M2: 0.58, S2: 0.22, N2: 0.12, K1: 0.19, O1: 0.11 } },
      { name: 'Mumbai', lat: 18.9220, lon: 72.8347, constituents: { M2: 1.55, S2: 0.56, N2: 0.32, K1: 0.44, O1: 0.23 } },
      { name: 'Bay of Fundy', lat: 45.28, lon: -64.72, constituents: { M2: 4.85, S2: 0.82, N2: 0.98, K1: 0.24, O1: 0.15 } },
      { name: 'London (Thames)', lat: 51.50, lon: 0.05, constituents: { M2: 2.30, S2: 0.72, N2: 0.45, K1: 0.15, O1: 0.12 } },
      { name: 'Tokyo Bay', lat: 35.53, lon: 139.77, constituents: { M2: 0.62, S2: 0.28, N2: 0.14, K1: 0.35, O1: 0.26 } }
    ];
    return { m2_amplitude, stations };
  },

  queryAmplitude(lat, lon) {
    if (!this.data || !this.data.m2_amplitude) return 0.5;
    const r = Math.max(0, Math.min(35, Math.round((87.5 - lat) / 5.0)));
    let c = Math.round((lon + 177.5) / 5.0);
    while (c < 0) c += 72;
    c = c % 72;
    return this.data.m2_amplitude[r][c] || 0.4;
  },

  // Calculate 48-hour tide curve at any lat/lon
  computeTideCurve(lat, lon, startHour = 0, hoursCount = 48) {
    // Find closest station or synthesise from local M2 amp
    let bestStation = null;
    let minDist = Infinity;
    if (this.data && this.data.stations) {
      for (const st of this.data.stations) {
        const d = Math.hypot(st.lat - lat, st.lon - lon);
        if (d < minDist) { minDist = d; bestStation = st; }
      }
    }

    const amp = this.queryAmplitude(lat, lon);
    const consts = (bestStation && minDist < 15.0) ? bestStation.constituents : {
      M2: amp,
      S2: amp * 0.35,
      N2: amp * 0.20,
      K1: amp * 0.25,
      O1: amp * 0.18
    };

    const curve = [];
    for (let h = 0; h <= hoursCount; h += 0.5) {
      const t = startHour + h;
      let height = 0;
      for (const [key, A] of Object.entries(consts)) {
        const omega = this.freqs[key] || 0.5;
        height += A * Math.cos(omega * t);
      }
      curve.push({ hour: h, absoluteHour: t, height: Math.round(height * 100) / 100 });
    }

    return {
      locationName: (bestStation && minDist < 15.0) ? bestStation.name : `${Math.abs(lat).toFixed(1)}°${lat>=0?'N':'S'}, ${Math.abs(lon).toFixed(1)}°${lon>=0?'E':'W'}`,
      constituents: consts,
      curve
    };
  },

  renderRaster(hour = 12) {
    if (!this.ctx || !this.isLoaded) return;
    const w = this.canvas.width;
    const h = this.canvas.height;
    const imgData = this.ctx.createImageData(w, h);
    const data = imgData.data;

    // Instantaneous tidal range oscillation across 24h
    const phaseShift = (hour / 12.42) * Math.PI * 2.0;

    for (let y = 0; y < h; y++) {
      const lat = 90 - (y / h) * 180;
      for (let x = 0; x < w; x++) {
        const lon = (x / w) * 360 - 180;
        const amp = this.queryAmplitude(lat, lon);
        const osc = amp * Math.cos((lon * Math.PI / 90) + phaseShift);

        // Normalize color
        const norm = Math.max(0, Math.min(1, (amp - 0.2) / 3.0));
        let r = 0, g = 0, b = 0, a = 190;
        if (norm < 0.25) {
          r = 13; g = Math.floor(71 + norm * 400); b = 161;
        } else if (norm < 0.5) {
          r = 0; g = Math.floor(180 + norm * 80); b = 216;
        } else if (norm < 0.75) {
          r = Math.floor(82 + (norm - 0.5) * 600); g = 228; b = 136;
        } else {
          r = 214; g = Math.floor(40 + (1 - norm) * 400); b = 40;
        }

        const idx = (y * w + x) * 4;
        data[idx]     = r;
        data[idx + 1] = g;
        data[idx + 2] = b;
        data[idx + 3] = a;
      }
    }
    this.ctx.putImageData(imgData, 0, 0);
  },

  renderStations(viewer) {
    this.clearStations(viewer);
    if (!this.data || !this.data.stations) return;

    for (const st of this.data.stations) {
      const entity = viewer.entities.add({
        position: Cesium.Cartesian3.fromDegrees(st.lon, st.lat, 5000.0),
        point: {
          pixelSize: 8,
          color: Cesium.Color.fromCssColorString('#00d2ff'),
          outlineColor: Cesium.Color.WHITE,
          outlineWidth: 2
        },
        label: {
          text: `⚓ ${st.name} (${st.constituents.M2}m)`,
          font: '11px sans-serif',
          fillColor: Cesium.Color.WHITE,
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 2,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          pixelOffset: new Cesium.Cartesian2(0, -14),
          disableDepthTestDistance: Number.POSITIVE_INFINITY
        }
      });
      this.stationEntities.push(entity);
    }
  },

  clearStations(viewer) {
    for (const ent of this.stationEntities) {
      viewer.entities.remove(ent);
    }
    this.stationEntities = [];
  },

  show(viewer, options = {}) {
    this.viewer = viewer;
    const hour = (typeof options === 'object' && options.hour != null) ? options.hour : (options || 12);
    this.renderRaster(hour);

    const provider = new Cesium.SingleTileImageryProvider({
      url: this.canvas.toDataURL(),
      rectangle: Cesium.Rectangle.fromDegrees(-180, -90, 180, 90)
    });

    if (this.cesiumLayer) {
      try { viewer.imageryLayers.remove(this.cesiumLayer, true); } catch (e) {}
    }
    this.cesiumLayer = viewer.imageryLayers.addImageryProvider(provider);
    this.cesiumLayer.alpha = 0.70;
    this.cesiumLayer.show = true;

    this.renderStations(viewer);
  },

  hide(viewer) {
    if (this.cesiumLayer) {
      try { viewer.imageryLayers.remove(this.cesiumLayer, true); } catch (e) {}
      this.cesiumLayer = null;
    }
    this.clearStations(viewer);
    this.hideCurveModal();
  },

  update(time, viewer) {
    const hour = (typeof time === 'object' && time.hour != null) ? time.hour : 12;
    if (!this.cesiumLayer) return;
    this.renderRaster(hour);

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
  },

  setOpacity(opacity) {
    if (this.cesiumLayer) this.cesiumLayer.alpha = opacity;
  },

  openTideCurveModal(lat, lon) {
    const result = this.computeTideCurve(lat, lon);
    this.showCurveModal(result);
  },

  showCurveModal(result) {
    let modal = document.getElementById('tide-curve-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'tide-curve-modal';
      modal.className = 'floating-ui';
      modal.style.position = 'absolute';
      modal.style.bottom = '80px';
      modal.style.right = '20px';
      modal.style.width = '360px';
      modal.style.padding = '14px';
      modal.style.zIndex = '80';
      document.body.appendChild(modal);
    }

    // Generate mini SVG curve
    const pts = result.curve;
    const minH = -2.5, maxH = 2.5;
    const svgW = 320, svgH = 120;
    const pathD = pts.map((p, i) => {
      const x = (i / (pts.length - 1)) * svgW;
      const y = svgH - ((p.height - minH) / (maxH - minH)) * svgH;
      return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
    }).join(' ');

    modal.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
        <strong style="font-size:13px; color:var(--text);">⚓ 48-Hour Tide Curve: ${result.locationName}</strong>
        <button id="close-tide-modal" style="background:none; border:none; color:var(--muted); cursor:pointer; font-size:16px;">&times;</button>
      </div>
      <div style="font-size:11px; color:var(--muted); margin-bottom:8px;">
        M2: ${result.constituents.M2.toFixed(2)}m &bull; S2: ${result.constituents.S2.toFixed(2)}m &bull; K1: ${result.constituents.K1.toFixed(2)}m
      </div>
      <svg width="${svgW}" height="${svgH}" style="background:rgba(0,0,0,0.3); border-radius:6px; margin-bottom:6px;">
        <line x1="0" y1="${svgH/2}" x2="${svgW}" y2="${svgH/2}" stroke="rgba(255,255,255,0.15)" stroke-dasharray="4"/>
        <path d="${pathD}" fill="none" stroke="#00d2ff" stroke-width="2"/>
      </svg>
      <div style="display:flex; justify-content:space-between; font-size:10px; color:var(--muted);">
        <span>Now (0h)</span>
        <span>+24h</span>
        <span>+48h</span>
      </div>
    `;
    modal.style.display = 'block';

    document.getElementById('close-tide-modal').onclick = () => {
      modal.style.display = 'none';
    };
  },

  hideCurveModal() {
    const modal = document.getElementById('tide-curve-modal');
    if (modal) modal.style.display = 'none';
  },

  getValueAt(lat, lon) {
    const amp = this.queryAmplitude(lat, lon);
    return {
      primary: `M2 Amplitude: ${amp.toFixed(2)} m`,
      secondary: 'Click to open 48h Tide Curve',
      numericValue: amp
    };
  }
};
