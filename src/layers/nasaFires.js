// ============================================================================
// src/layers/nasaFires.js — NASA FIRMS Real-Time Global Active Wildfire Hotspots
// Data Source: NASA EOSDIS Fire Information for Resource Management System
// Satellite Instruments: MODIS (Terra & Aqua) Collection 6.1 NRT
// ============================================================================

export const nasaFiresLayer = {
  id: 'nasa_fires',
  label: '🔥 NASA Active Fires (FIRMS)',
  type: 'overlay',
  defaultOpacity: 0.95,
  timeline: false,
  legend: {
    title: 'NASA Active Wildfires (24h MODIS)',
    unit: 'Fire Radiative Power (MW)',
    items: [
      { label: 'Extreme Fire (≥ 100 MW)', color: '#ff1744' },
      { label: 'Intense Fire (30–100 MW)', color: '#ff9100' },
      { label: 'Active Fire (< 30 MW)', color: '#ffea00' }
    ]
  },

  data: null,
  viewer: null,
  pointCollection: null,
  isLoaded: false,
  isVisible: false,

  async load(viewer) {
    this.viewer = viewer;
    if (this.isLoaded) return;

    try {
      const res = await fetch('data/nasa_firms_active_fires.json');
      if (res.ok) {
        this.data = await res.json();
        this.isLoaded = true;
        console.log(`[NASA FIRMS] Loaded ${this.data.total_fires} active fire detections from NASA EOSDIS`);
        return;
      }
    } catch (e) {
      console.warn('[NASA FIRMS] Fallback to procedural sample:', e);
    }

    this.data = { fires: [] };
    this.isLoaded = true;
  },

  show(viewer) {
    this.viewer = viewer;
    this.isVisible = true;

    if (!this.pointCollection) {
      this.buildPoints(viewer);
    } else {
      this.pointCollection.show = true;
    }
  },

  hide(viewer) {
    this.isVisible = false;
    if (this.pointCollection) {
      this.pointCollection.show = false;
    }
  },

  buildPoints(viewer) {
    if (!this.data || !this.data.fires) return;
    const scene = viewer.scene;

    // Use GPU-accelerated PointPrimitiveCollection for high performance rendering of 10k+ points
    this.pointCollection = scene.primitives.add(new Cesium.PointPrimitiveCollection());

    const cExtreme = Cesium.Color.fromCssColorString('#ff1744').withAlpha(0.95);
    const cIntense = Cesium.Color.fromCssColorString('#ff9100').withAlpha(0.90);
    const cActive = Cesium.Color.fromCssColorString('#ffea00').withAlpha(0.85);
    const cOutline = Cesium.Color.fromCssColorString('rgba(0, 0, 0, 0.7)');

    const fires = this.data.fires;
    for (let i = 0; i < fires.length; i++) {
      const f = fires[i];
      let color = cActive;
      let pSize = 5;

      if (f.frp >= 100) {
        color = cExtreme;
        pSize = 10;
      } else if (f.frp >= 30) {
        color = cIntense;
        pSize = 7;
      } else if (f.frp >= 10) {
        pSize = 5;
      } else {
        pSize = 4;
      }

      this.pointCollection.add({
        position: Cesium.Cartesian3.fromDegrees(f.lon, f.lat, 1000.0),
        color: color,
        pixelSize: pSize,
        outlineColor: cOutline,
        outlineWidth: 1.0,
        id: `nasa_fire_${i}`
      });
    }

    viewer.scene.requestRender();
  },

  setOpacity(alpha) {
    // Opacity scaling on active primitives
    if (this.pointCollection) {
      this.pointCollection.show = (alpha > 0.05);
    }
  },

  /**
   * Spatial Query: Finds nearest active NASA wildfire to (lat, lon) within maxDistKm
   */
  queryNearest(lat, lon, maxDistKm = 250) {
    if (!this.data || !this.data.fires || this.data.fires.length === 0) {
      return { hasFire: false, frp: 0, brightness: 0, distKm: 9999 };
    }

    let nearest = null;
    let minDist = maxDistKm;

    for (const f of this.data.fires) {
      const dLat = (f.lat - lat) * 111.0;
      const dLon = (f.lon - lon) * 111.0 * Math.cos((lat * Math.PI) / 180.0);
      const dist = Math.sqrt(dLat * dLat + dLon * dLon);

      if (dist < minDist) {
        minDist = dist;
        nearest = { ...f, distKm: Math.round(dist) };
      }
    }

    if (nearest) {
      return {
        hasFire: true,
        frp: nearest.frp,
        brightness: nearest.brightness,
        confidence: nearest.confidence,
        satellite: nearest.sat,
        daynight: nearest.daynight,
        date: nearest.date,
        distKm: nearest.distKm
      };
    }

    return { hasFire: false, frp: 0, brightness: 0, distKm: Math.round(minDist) };
  },

  getValueAt(lat, lon) {
    const q = this.queryNearest(lat, lon, 250);
    if (q.hasFire) {
      return {
        primary: `${q.frp} MW (FRP)`,
        secondary: `${q.brightness} K · NASA ${q.satellite} (${q.distKm} km away)`,
        numericValue: q.frp
      };
    }
    return {
      primary: 'No Active Fire',
      secondary: 'No NASA thermal anomalies within 250 km',
      numericValue: 0
    };
  }
};
