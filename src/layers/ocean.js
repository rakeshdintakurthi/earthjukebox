// ============================================================================
// src/layers/ocean.js — Ocean Currents & Sea Surface Temperature (SST)
// ============================================================================

export const oceanLayer = {
  id: 'ocean',
  label: '🌊 Ocean Currents & SST',
  type: 'overlay', // has currents overlay + sst raster sub-layer
  defaultOpacity: 0.85,
  timeline: false,
  legend: {
    title: 'Ocean Circulation & SST',
    unit: 'm/s & °C',
    gradient: 'linear-gradient(to right, #0012e6, #00bfff, #ffff00, #ff8c00, #b80000)',
    ticks: ['-2°C', '+10°C', '+20°C', '+28°C', '≥ +32°C']
  },

  canvas: null,
  ctx: null,
  data: null,
  particles: [],
  animId: null,
  viewer: null,
  sstCesiumLayer: null,
  showSST: true,
  showCurrents: true,
  particleCount: 3800,
  isLoaded: false,
  isActive: false,

  async load(viewer) {
    this.viewer = viewer;
    if (this.isLoaded) return;

    try {
      const res = await fetch('data/ocean_sample.json');
      if (res.ok) {
        this.data = await res.json();
        this.isLoaded = true;
        return;
      }
    } catch (e) {
      console.warn('[OceanLayer] Fallback to procedural ocean data:', e);
    }

    this.data = this.generateFallback();
    this.isLoaded = true;
  },

  generateFallback() {
    const sst = [], u = [], v = [], mask = [];
    for (let r = 0; r < 36; r++) {
      const lat = 87.5 - r * 5.0;
      const normLat = Math.abs(lat) / 90.0;
      const sstRow = [], uRow = [], vRow = [], maskRow = [];
      for (let c = 0; c < 72; c++) {
        const lon = -177.5 + c * 5.0;
        let isLand = false;
        if (lat > 10 && lat < 70 && lon > -165 && lon < -50) isLand = true;
        if (lat < 12 && lat > -55 && lon > -82 && lon < -34) isLand = true;
        if (lat > 35 && lat < 72 && lon > -10 && lon < 170) isLand = true;
        if (lat > -35 && lat < 37 && lon > -18 && lon < 52) isLand = true;
        if (lat < -10 && lat > -42 && lon > 112 && lon < 155) isLand = true;
        if (lat < -65) isLand = true;

        maskRow.push(isLand ? 0 : 1);
        sstRow.push(isLand ? null : Math.round((30.0 - normLat * 33.0) * 10) / 10);

        let uVal = 0, vVal = 0;
        if (!isLand) {
          if (lat < -45 && lat > -65) { uVal = 0.85; vVal = 0.05; }
          else if (lat > 25 && lat < 45 && lon > -80 && lon < -40) { uVal = 1.2; vVal = 0.8; }
          else if (lat > 20 && lat < 45 && lon > 125 && lon < 165) { uVal = 1.1; vVal = 0.7; }
          else if (Math.abs(lat) < 15) { uVal = -0.6; vVal = 0.0; }
          else { uVal = Math.sin(lat * Math.PI / 30) * 0.3; vVal = Math.cos(lon * Math.PI / 40) * 0.2; }
        }
        uRow.push(uVal);
        vRow.push(vVal);
      }
      sst.push(sstRow);
      u.push(uRow);
      v.push(vRow);
      mask.push(maskRow);
    }
    return { sst, u, v, mask };
  },

  querySST(lat, lon) {
    if (!this.data || !this.data.sst) return null;
    const r = Math.max(0, Math.min(35, Math.round((87.5 - lat) / 5.0)));
    let c = Math.round((lon + 177.5) / 5.0);
    while (c < 0) c += 72;
    c = c % 72;
    if (this.data.mask[r][c] === 0) return null; // Land masked
    return this.data.sst[r][c];
  },

  queryCurrent(lat, lon) {
    if (!this.data || !this.data.u) return { u: 0, v: 0, speed: 0, isWater: false };
    const r = Math.max(0, Math.min(35, Math.round((87.5 - lat) / 5.0)));
    let c = Math.round((lon + 177.5) / 5.0);
    while (c < 0) c += 72;
    c = c % 72;
    const isWater = (this.data.mask[r][c] === 1);
    const u = isWater ? (this.data.u[r][c] || 0) : 0;
    const v = isWater ? (this.data.v[r][c] || 0) : 0;
    return { u, v, speed: Math.sqrt(u * u + v * v), isWater };
  },

  // Build SST raster masked to water
  buildSSTRaster() {
    const canvas = document.createElement('canvas');
    canvas.width = 360;
    canvas.height = 180;
    const ctx = canvas.getContext('2d');
    const imgData = ctx.createImageData(360, 180);
    const data = imgData.data;

    for (let y = 0; y < 180; y++) {
      const lat = 90 - (y / 180) * 180;
      for (let x = 0; x < 360; x++) {
        const lon = (x / 360) * 360 - 180;
        const sst = this.querySST(lat, lon);
        const idx = (y * 360 + x) * 4;

        if (sst === null) {
          // Land is completely transparent
          data[idx] = 0; data[idx + 1] = 0; data[idx + 2] = 0; data[idx + 3] = 0;
        } else {
          // Blue (-2°C) -> Teal -> Green -> Yellow -> Red (+32°C)
          const norm = Math.max(0, Math.min(1, (sst + 2.0) / 34.0));
          let r = 0, g = 0, b = 0;
          if (norm < 0.25) {
            const t = norm / 0.25;
            r = 0; g = Math.floor(t * 180); b = 255;
          } else if (norm < 0.5) {
            const t = (norm - 0.25) / 0.25;
            r = Math.floor(t * 150); g = 220; b = Math.floor(255 * (1 - t));
          } else if (norm < 0.75) {
            const t = (norm - 0.5) / 0.25;
            r = Math.floor(150 + t * 105); g = Math.floor(220 - t * 80); b = 0;
          } else {
            const t = (norm - 0.75) / 0.25;
            r = 255; g = Math.floor(140 * (1 - t)); b = Math.floor(t * 30);
          }
          data[idx]     = r;
          data[idx + 1] = g;
          data[idx + 2] = b;
          data[idx + 3] = 210; // Alpha
        }
      }
    }
    ctx.putImageData(imgData, 0, 0);
    return canvas.toDataURL();
  },

  setupCanvas() {
    if (this.canvas) return;
    this.canvas = document.createElement('canvas');
    this.canvas.id = 'ocean-currents-canvas';
    this.canvas.style.position = 'fixed';
    this.canvas.style.inset = '0';
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    this.canvas.style.pointerEvents = 'none';
    this.canvas.style.zIndex = '5';
    document.body.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d');

    this.resize();
    window.addEventListener('resize', () => this.resize());
  },

  resize() {
    if (!this.canvas) return;
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  },

  initParticles() {
    this.particles = [];
    for (let i = 0; i < this.particleCount; i++) {
      let lat = Math.random() * 160 - 80;
      let lon = Math.random() * 360 - 180;
      let check = this.queryCurrent(lat, lon);
      // Spawn only in water
      let tries = 0;
      while (!check.isWater && tries++ < 5) {
        lat = Math.random() * 160 - 80;
        lon = Math.random() * 360 - 180;
        check = this.queryCurrent(lat, lon);
      }
      this.particles.push({
        lat, lon,
        age: Math.floor(Math.random() * 90),
        maxAge: 70 + Math.floor(Math.random() * 50)
      });
    }
  },

  animate() {
    if (!this.isActive || !this.ctx || !this.viewer || !this.showCurrents) return;

    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.90)';
    this.ctx.globalCompositeOperation = 'destination-in';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.globalCompositeOperation = 'source-over';

    const scene = this.viewer.scene;
    const camera = scene.camera;
    const camPos = camera.positionWC;
    const camDir = camera.directionWC;
    const ellipsoid = scene.globe.ellipsoid;
    const dt = 0.55;

    this.ctx.lineWidth = 1.6;

    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      const cur = this.queryCurrent(p.lat, p.lon);

      if (!cur.isWater) {
        p.age = p.maxAge + 1; // Respawn on land
      }

      const cosLat = Math.cos(p.lat * Math.PI / 180.0) || 0.001;
      const prevLat = p.lat;
      const prevLon = p.lon;

      p.lon += (cur.u / cosLat) * dt * 0.25;
      p.lat += cur.v * dt * 0.25;
      p.age++;

      if (p.age > p.maxAge || p.lat > 85 || p.lat < -85 || p.lon > 180 || p.lon < -180) {
        p.lat = Math.random() * 160 - 80;
        p.lon = Math.random() * 360 - 180;
        p.age = 0;
        continue;
      }

      const posCur = Cesium.Cartesian3.fromDegrees(p.lon, p.lat, 8000.0, ellipsoid);
      const toPt = Cesium.Cartesian3.subtract(posCur, camPos, new Cesium.Cartesian3());
      Cesium.Cartesian3.normalize(toPt, toPt);
      if (Cesium.Cartesian3.dot(camDir, toPt) < 0.25) continue;

      const posPrev = Cesium.Cartesian3.fromDegrees(prevLon, prevLat, 8000.0, ellipsoid);
      const w0 = Cesium.SceneTransforms.wgs84ToWindowCoordinates(scene, posPrev);
      const w1 = Cesium.SceneTransforms.wgs84ToWindowCoordinates(scene, posCur);

      if (w0 && w1) {
        this.ctx.beginPath();
        // Warm currents amber/gold, cool currents cyan
        this.ctx.strokeStyle = cur.u > 0.5 ? 'rgba(255, 183, 77, 0.95)' : 'rgba(77, 208, 225, 0.85)';
        this.ctx.moveTo(w0.x, w0.y);
        this.ctx.lineTo(w1.x, w1.y);
        this.ctx.stroke();
      }
    }

    this.animId = requestAnimationFrame(() => this.animate());
  },

  show(viewer, options = {}) {
    this.viewer = viewer;
    this.isActive = true;

    // 1. SST Raster
    if (this.showSST) {
      const sstDataUrl = this.buildSSTRaster();
      const provider = new Cesium.SingleTileImageryProvider({
        url: sstDataUrl,
        rectangle: Cesium.Rectangle.fromDegrees(-180, -90, 180, 90)
      });
      if (this.sstCesiumLayer) {
        try { viewer.imageryLayers.remove(this.sstCesiumLayer, true); } catch (e) {}
      }
      this.sstCesiumLayer = viewer.imageryLayers.addImageryProvider(provider);
      this.sstCesiumLayer.alpha = 0.60;
      this.sstCesiumLayer.show = true;
    }

    // 2. Animated Currents Canvas
    if (this.showCurrents) {
      this.setupCanvas();
      this.canvas.style.display = 'block';
      this.initParticles();
      cancelAnimationFrame(this.animId);
      this.animate();
    }
  },

  hide(viewer) {
    this.isActive = false;
    cancelAnimationFrame(this.animId);
    if (this.canvas) {
      this.canvas.style.display = 'none';
      if (this.ctx) this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
    if (this.sstCesiumLayer) {
      try { viewer.imageryLayers.remove(this.sstCesiumLayer, true); } catch (e) {}
      this.sstCesiumLayer = null;
    }
  },

  update(time, viewer) {},

  setSSTVisible(show) {
    this.showSST = show;
    if (this.sstCesiumLayer) this.sstCesiumLayer.show = show;
  },

  setOpacity(opacity) {
    if (this.sstCesiumLayer) this.sstCesiumLayer.alpha = opacity;
    if (this.canvas) this.canvas.style.opacity = opacity;
  },

  getValueAt(lat, lon) {
    const sst = this.querySST(lat, lon);
    const cur = this.queryCurrent(lat, lon);
    if (!cur.isWater) {
      return { primary: 'Land (No ocean data)', secondary: '—', numericValue: 0 };
    }
    return {
      primary: sst != null ? `SST: ${sst > 0 ? '+' : ''}${sst.toFixed(1)} °C` : 'Water',
      secondary: `Current: ${cur.speed.toFixed(2)} m/s`,
      numericValue: sst || cur.speed
    };
  }
};
