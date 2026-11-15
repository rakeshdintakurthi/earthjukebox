// ============================================================================
// src/layers/wind.js — Atmospheric Wind Streamlines (nullschool-style)
// ============================================================================

export const windLayer = {
  id: 'wind',
  label: '💨 Wind Streamlines & Jets',
  type: 'overlay',
  defaultOpacity: 0.85,
  timeline: false,
  legend: {
    title: 'Wind Speed',
    unit: 'm/s (km/h)',
    gradient: 'linear-gradient(to right, #40c4ff, #00e676, #ffea00, #ff9100, #ff1744)',
    ticks: ['0 m/s', '10 m/s', '25 m/s', '45 m/s', '≥ 70 m/s']
  },

  canvas: null,
  ctx: null,
  data: null,
  particles: [],
  animId: null,
  viewer: null,
  altitude: 'surface', // 'surface' | '850hpa' | '500hpa' | '250hpa'
  particleCount: 6500,
  isLoaded: false,
  isActive: false,

  async load(viewer) {
    this.viewer = viewer;
    if (this.isLoaded) return;

    try {
      const res = await fetch('data/wind_sample.json');
      if (res.ok) {
        this.data = await res.json();
        this.isLoaded = true;
        return;
      }
    } catch (e) {
      console.warn('[WindLayer] Fallback to procedural wind field:', e);
    }

    this.data = this.generateFallback();
    this.isLoaded = true;
  },

  generateFallback() {
    const levels = ['surface', '850hpa', '500hpa', '250hpa'];
    const out = {};
    levels.forEach((lvl, idx) => {
      const mult = 1.0 + idx * 1.6;
      const u = [], v = [];
      for (let r = 0; r < 36; r++) {
        const lat = 87.5 - r * 5.0;
        const uRow = [], vRow = [];
        for (let c = 0; c < 72; c++) {
          const lon = -177.5 + c * 5.0;
          let uVal = 0, vVal = 0;
          if (Math.abs(lat) < 30) {
            uVal = -7.0 * mult;
            vVal = (lat > 0 ? -2.0 : 2.0);
          } else if (Math.abs(lat) < 60) {
            uVal = (15.0 + Math.sin(lon * Math.PI / 40) * 8.0) * mult;
            vVal = Math.cos(lon * Math.PI / 40) * 5.0;
          } else {
            uVal = -5.0 * mult;
            vVal = (lat > 0 ? -1.0 : 1.0);
          }
          uRow.push(uVal);
          vRow.push(vVal);
        }
        u.push(uRow);
        v.push(vRow);
      }
      out[lvl] = { u, v };
    });
    return out;
  },

  getVector(lat, lon, altitude = this.altitude) {
    if (!this.data || !this.data[altitude]) return { u: 0, v: 0, speed: 0 };
    const grid = this.data[altitude];
    const rowF = Math.max(0, Math.min(35, (87.5 - lat) / 5.0));
    let colF = (lon + 177.5) / 5.0;
    while (colF < 0) colF += 72;
    colF = colF % 72;

    const r0 = Math.floor(rowF), r1 = Math.min(35, r0 + 1), dr = rowF - r0;
    const c0 = Math.floor(colF), c1 = (c0 + 1) % 72, dc = colF - c0;

    const u00 = grid.u[r0][c0] || 0, u01 = grid.u[r0][c1] || 0;
    const u10 = grid.u[r1][c0] || 0, u11 = grid.u[r1][c1] || 0;
    const u = (1 - dr) * ((1 - dc) * u00 + dc * u01) + dr * ((1 - dc) * u10 + dc * u11);

    const v00 = grid.v[r0][c0] || 0, v01 = grid.v[r0][c1] || 0;
    const v10 = grid.v[r1][c0] || 0, v11 = grid.v[r1][c1] || 0;
    const v = (1 - dr) * ((1 - dc) * v00 + dc * v01) + dr * ((1 - dc) * v10 + dc * v11);

    const speed = Math.sqrt(u * u + v * v);
    return { u, v, speed };
  },

  speedColor(speed) {
    // slow = pale cyan/green, fast = bright yellow/magenta
    if (speed < 6) return 'rgba(64, 196, 255, 0.75)';
    if (speed < 18) return 'rgba(0, 230, 118, 0.85)';
    if (speed < 32) return 'rgba(255, 234, 0, 0.9)';
    if (speed < 50) return 'rgba(255, 145, 0, 0.95)';
    return 'rgba(255, 23, 68, 1.0)';
  },

  setupCanvas() {
    if (this.canvas) return;
    this.canvas = document.createElement('canvas');
    this.canvas.id = 'wind-canvas-layer';
    this.canvas.style.position = 'fixed';
    this.canvas.style.inset = '0';
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    this.canvas.style.pointerEvents = 'none';
    this.canvas.style.zIndex = '6';
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
      this.particles.push({
        lat: Math.random() * 170 - 85,
        lon: Math.random() * 360 - 180,
        age: Math.floor(Math.random() * 80),
        maxAge: 60 + Math.floor(Math.random() * 40)
      });
    }
  },

  animate() {
    if (!this.isActive || !this.ctx || !this.viewer) return;

    // Fading trails: transparent dark destination-out
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.90)';
    this.ctx.globalCompositeOperation = 'destination-in';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.globalCompositeOperation = 'source-over';

    const scene = this.viewer.scene;
    const camera = scene.camera;
    const camPos = camera.positionWC;
    const camDir = camera.directionWC;
    const ellipsoid = scene.globe.ellipsoid;
    const dt = 0.45;

    this.ctx.lineWidth = 1.35;

    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      const vec = this.getVector(p.lat, p.lon, this.altitude);

      // Advect lat/lon
      const cosLat = Math.cos(p.lat * Math.PI / 180.0) || 0.001;
      const prevLat = p.lat;
      const prevLon = p.lon;

      p.lon += (vec.u / cosLat) * dt * 0.08;
      p.lat += vec.v * dt * 0.08;
      p.age++;

      // Wrap around earth or respawn if expired
      if (p.age > p.maxAge || p.lat > 88 || p.lat < -88 || p.lon > 180 || p.lon < -180) {
        p.lat = Math.random() * 170 - 85;
        p.lon = Math.random() * 360 - 180;
        p.age = 0;
        continue;
      }

      // Convert 3D positions to 2D window coordinates
      const posPrev = Cesium.Cartesian3.fromDegrees(prevLon, prevLat, 15000.0, ellipsoid);
      const posCur = Cesium.Cartesian3.fromDegrees(p.lon, p.lat, 15000.0, ellipsoid);

      // Occlusion check against horizon
      const toPt = Cesium.Cartesian3.subtract(posCur, camPos, new Cesium.Cartesian3());
      Cesium.Cartesian3.normalize(toPt, toPt);
      if (Cesium.Cartesian3.dot(camDir, toPt) < 0.25) continue; // behind horizon

      const w0 = Cesium.SceneTransforms.wgs84ToWindowCoordinates(scene, posPrev);
      const w1 = Cesium.SceneTransforms.wgs84ToWindowCoordinates(scene, posCur);

      if (w0 && w1) {
        this.ctx.beginPath();
        this.ctx.strokeStyle = this.speedColor(vec.speed);
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
    if (options.altitude) this.altitude = options.altitude;
    this.setupCanvas();
    this.canvas.style.display = 'block';
    this.initParticles();
    cancelAnimationFrame(this.animId);
    this.animate();
  },

  hide(viewer) {
    this.isActive = false;
    cancelAnimationFrame(this.animId);
    if (this.canvas) {
      this.canvas.style.display = 'none';
      if (this.ctx) this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
  },

  update(time, viewer) {
    // If altitude changed or speed adjusted
    if (time && time.altitude) {
      this.altitude = time.altitude;
    }
  },

  setAltitude(alt) {
    this.altitude = alt;
  },

  setOpacity(opacity) {
    if (this.canvas) {
      this.canvas.style.opacity = opacity;
    }
  },

  getValueAt(lat, lon) {
    const vec = this.getVector(lat, lon, this.altitude);
    const kmh = Math.round(vec.speed * 3.6);
    return {
      primary: `${vec.speed.toFixed(1)} m/s (${kmh} km/h)`,
      secondary: `Alt: ${this.altitude.toUpperCase()}`,
      numericValue: vec.speed
    };
  }
};
