// ============================================================================
// src/store.js — Central State Store for Thermophone Earth
// ============================================================================

export const store = {
  state: {
    activeRasterLayer: null, // null | 'heat' | 'rainfall' | 'ocean_sst'
    activeOverlays: new Set(), // Set<'wind' | 'ocean_currents' | 'tides' | 'plates'>
    year: 2025,
    month: 7, // 1 to 12
    hour: 12, // 0 to 24 for tides
    windAltitude: 'surface', // 'surface' | '850hpa' | '500hpa' | '250hpa'
    plateTimeOffset: 0, // -100 to +100 Myr
    showLabels: true,
    showAtmosphere: true,
    showTerminator: true,
    autoRotate: true,
    pins: {
      A: null, // { lat, lon, cartesian, cartographic, name, values: {} }
      B: null
    },
    pinToolActive: false,
    layerOpacity: {
      heat: 0.60,
      rainfall: 0.60,
      ocean_sst: 0.60,
      wind: 0.85,
      ocean_currents: 0.85,
      tides: 0.75,
      plates: 0.95,
      nasa_fires: 0.95
    },
    layerLoading: {},
    layerError: {}
  },

  listeners: new Set(),
  isNotifying: false,
  pendingKeys: new Set(),

  getState() {
    return this.state;
  },

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  },

  notify(changedKeys = []) {
    for (const k of changedKeys) {
      this.pendingKeys.add(k);
    }
    if (this.isNotifying) {
      // Re-entrant notify call while already executing listeners:
      // keys have been queued and will be processed in the current loop.
      return;
    }
    this.isNotifying = true;
    try {
      while (this.pendingKeys.size > 0) {
        const batch = Array.from(this.pendingKeys);
        this.pendingKeys.clear();
        for (const listener of Array.from(this.listeners)) {
          try {
            listener(this.state, batch);
          } catch (e) {
            console.error('[Store] listener error:', e);
          }
        }
      }
    } finally {
      this.isNotifying = false;
    }
  },

  setRasterLayer(layerId) {
    if (this.state.activeRasterLayer === layerId) return;
    this.state.activeRasterLayer = layerId;
    this.notify(['activeRasterLayer']);
  },

  toggleOverlay(overlayId, force) {
    const shouldAdd = (force !== undefined) ? force : !this.state.activeOverlays.has(overlayId);
    if (shouldAdd) {
      this.state.activeOverlays.add(overlayId);
    } else {
      this.state.activeOverlays.delete(overlayId);
    }
    this.notify(['activeOverlays']);
  },

  setOpacity(layerId, opacity) {
    this.state.layerOpacity[layerId] = Math.max(0, Math.min(1, opacity));
    this.notify(['layerOpacity']);
  },

  setYear(year) {
    this.state.year = Math.max(1850, Math.min(2025, Math.round(year)));
    this.notify(['year']);
  },

  setMonth(month) {
    this.state.month = Math.max(1, Math.min(12, Math.round(month)));
    this.notify(['month']);
  },

  setHour(hour) {
    this.state.hour = (hour + 24) % 24;
    this.notify(['hour']);
  },

  setWindAltitude(alt) {
    this.state.windAltitude = alt;
    this.notify(['windAltitude']);
  },

  setPlateTimeOffset(myr) {
    this.state.plateTimeOffset = myr;
    this.notify(['plateTimeOffset']);
  },

  setPin(pinId, data) {
    this.state.pins[pinId] = data;
    this.notify(['pins']);
  },

  setPinToolActive(active) {
    this.state.pinToolActive = Boolean(active);
    this.notify(['pinToolActive']);
  },

  clearPins() {
    this.state.pins.A = null;
    this.state.pins.B = null;
    this.notify(['pins']);
  },

  resetAllLayers() {
    this.state.activeRasterLayer = null;
    this.state.activeOverlays.clear();
    this.state.pins.A = null;
    this.state.pins.B = null;
    this.state.plateTimeOffset = 0;
    this.notify(['activeRasterLayer', 'activeOverlays', 'pins', 'reset']);
  },

  setLoading(layerId, isLoading) {
    this.state.layerLoading[layerId] = isLoading;
    this.notify(['layerLoading']);
  },

  setError(layerId, errorMsg) {
    this.state.layerError[layerId] = errorMsg;
    this.notify(['layerError']);
  }
};
