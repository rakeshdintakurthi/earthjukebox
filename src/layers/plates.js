// ============================================================================
// src/layers/plates.js — Tectonic Plates (PB2002 Boundaries & MORVEL Velocities)
// ============================================================================

export const platesLayer = {
  id: 'plates',
  label: '🌋 Tectonic Plates & Drift',
  type: 'overlay',
  defaultOpacity: 0.95,
  timeline: true,
  timeRange: { min: -100, max: 100, step: 5, default: 0, labelFormat: 'Myr' },
  legend: {
    title: 'Plate Boundaries & Motion',
    unit: 'mm/year (MORVEL)',
    items: [
      { label: 'Convergent (Subduction)', color: '#ff3d00' },
      { label: 'Divergent (Rift/Ridge)', color: '#00b0ff' },
      { label: 'Transform (Strike-Slip)', color: '#00e676' },
      { label: 'Motion Vector', color: '#ffea00' }
    ]
  },

  data: null,
  viewer: null,
  entities: [],
  isLoaded: false,
  timeOffsetMyr: 0, // -100 to +100 Myr

  async load(viewer) {
    this.viewer = viewer;
    if (this.isLoaded) return;

    try {
      const res = await fetch('data/plates_sample.json');
      if (res.ok) {
        this.data = await res.json();
        this.isLoaded = true;
        return;
      }
    } catch (e) {
      console.warn('[PlatesLayer] Fallback to procedural plates data:', e);
    }

    this.data = this.generateFallback();
    this.isLoaded = true;
  },

  generateFallback() {
    return {
      features: [
        { properties: { name: 'Pacific Subduction Zone', type: 'convergent', speed_mm_yr: 80 },
          geometry: { coordinates: [[140, 35], [145, 15], [160, -10], [178, -20], [-170, -45], [-130, -60]] } },
        { properties: { name: 'Mid-Atlantic Ridge', type: 'divergent', speed_mm_yr: 25 },
          geometry: { coordinates: [[-30, 80], [-20, 65], [-30, 45], [-42, 25], [-35, 10], [-25, 0], [-15, -20], [-13, -50]] } },
        { properties: { name: 'San Andreas Fault', type: 'transform', speed_mm_yr: 35 },
          geometry: { coordinates: [[-115, 32], [-118, 34.5], [-121, 36.5], [-124, 40]] } },
        { properties: { name: 'Himalayan Thrust', type: 'convergent', speed_mm_yr: 45 },
          geometry: { coordinates: [[73, 34], [78, 30], [84, 28], [92, 27], [96, 28]] } },
        { properties: { name: 'East Pacific Rise', type: 'divergent', speed_mm_yr: 140 },
          geometry: { coordinates: [[-105, 20], [-104, 5], [-102, -10], [-110, -35], [-115, -55]] } }
      ],
      plates: [
        { name: 'Pacific Plate', center: [-160, -20], speed: 80, dir: 290 },
        { name: 'Indo-Australian Plate', center: [85, -15], speed: 65, dir: 35 },
        { name: 'Eurasian Plate', center: [60, 50], speed: 22, dir: 100 },
        { name: 'North American Plate', center: [-100, 45], speed: 24, dir: 250 },
        { name: 'South American Plate', center: [-60, -20], speed: 30, dir: 275 },
        { name: 'African Plate', center: [20, 5], speed: 20, dir: 20 },
        { name: 'Antarctic Plate', center: [0, -80], speed: 12, dir: 0 }
      ]
    };
  },

  getTypeColor(type) {
    if (type === 'convergent') return Cesium.Color.fromCssColorString('#ff3d00'); // Red
    if (type === 'divergent') return Cesium.Color.fromCssColorString('#00b0ff');  // Blue
    return Cesium.Color.fromCssColorString('#00e676');                           // Transform (Green)
  },

  renderPlates(viewer, offsetMyr = 0) {
    this.clear(viewer);
    if (!this.data) return;

    // Schematic drift scale: 1 Myr = ~1.0 degree drift scaled
    const driftScale = (offsetMyr / 100.0) * 8.0;

    // 1. Boundary lines
    for (const feat of this.data.features) {
      const type = feat.properties.type;
      const col = this.getTypeColor(type);
      const coords = feat.geometry.coordinates.map(pt => {
        let lon = pt[0] + driftScale;
        let lat = pt[1];
        return Cesium.Cartesian3.fromDegrees(lon, lat, 2000.0);
      });

      const lineEntity = viewer.entities.add({
        name: feat.properties.name || 'Plate Boundary',
        polyline: {
          positions: coords,
          width: 3.5,
          material: new Cesium.PolylineGlowMaterialProperty({
            glowPower: 0.25,
            color: col
          }),
          clampToGround: true
        },
        properties: {
          boundaryType: type,
          speed: feat.properties.speed_mm_yr
        }
      });
      this.entities.push(lineEntity);
    }

    // 2. Velocity vector arrows and labels on major plates
    for (const p of this.data.plates) {
      const rad = (90 - p.dir) * Math.PI / 180.0;
      const lenDeg = (p.speed / 80.0) * 12.0;
      const startLon = p.center[0] + driftScale;
      const startLat = p.center[1];
      const endLon = startLon + Math.cos(rad) * lenDeg;
      const endLat = startLat + Math.sin(rad) * lenDeg;

      // Arrow polyline
      const arrowEntity = viewer.entities.add({
        name: p.name,
        polyline: {
          positions: [
            Cesium.Cartesian3.fromDegrees(startLon, startLat, 15000.0),
            Cesium.Cartesian3.fromDegrees(endLon, endLat, 15000.0)
          ],
          width: 5,
          material: new Cesium.PolylineArrowMaterialProperty(Cesium.Color.fromCssColorString('#ffea00'))
        },
        label: {
          text: `${p.name}\n${p.speed} mm/yr (${p.dir}°)`,
          font: 'bold 11px sans-serif',
          fillColor: Cesium.Color.WHITE,
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 2,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          pixelOffset: new Cesium.Cartesian2(0, -22),
          disableDepthTestDistance: Number.POSITIVE_INFINITY
        },
        properties: {
          plateName: p.name,
          speed: p.speed,
          direction: p.dir
        }
      });
      this.entities.push(arrowEntity);
    }
  },

  clear(viewer) {
    for (const ent of this.entities) {
      viewer.entities.remove(ent);
    }
    this.entities = [];
  },

  show(viewer, options = {}) {
    this.viewer = viewer;
    this.timeOffsetMyr = options.plateTimeOffset || 0;
    this.renderPlates(viewer, this.timeOffsetMyr);
  },

  hide(viewer) {
    this.clear(viewer);
  },

  update(time, viewer) {
    const offset = (typeof time === 'object' && time.plateTimeOffset != null) ? time.plateTimeOffset : 0;
    this.timeOffsetMyr = offset;
    this.renderPlates(viewer, this.timeOffsetMyr);
  },

  setOpacity(opacity) {
    for (const ent of this.entities) {
      if (ent.polyline && ent.polyline.material) {
        // Opacity tuning
      }
    }
  },

  getValueAt(lat, lon) {
    // Find closest plate
    let best = null, minDist = Infinity;
    if (this.data && this.data.plates) {
      for (const p of this.data.plates) {
        const d = Math.hypot(p.center[1] - lat, p.center[0] - lon);
        if (d < minDist) { minDist = d; best = p; }
      }
    }
    if (best) {
      return {
        primary: `${best.name} (${best.speed} mm/yr)`,
        secondary: `Motion Azimuth: ${best.dir}°`,
        numericValue: best.speed
      };
    }
    return { primary: 'Plate Boundary Zone', secondary: '—', numericValue: 30 };
  }
};
