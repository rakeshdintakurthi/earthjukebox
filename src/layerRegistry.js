// ============================================================================
// src/layerRegistry.js — Extensible Layer Registry
// ============================================================================

class LayerRegistry {
  constructor() {
    this.layers = new Map();
  }

  /**
   * Register a layer module with the interface:
   * { id, label, type, defaultOpacity, legend, timeline: bool, load(viewer), show(viewer), hide(viewer), update(time, viewer), getValueAt(lat, lon) }
   */
  register(layer) {
    if (!layer || !layer.id) {
      throw new Error('[LayerRegistry] Layer must have an id');
    }
    this.layers.set(layer.id, layer);
    return this;
  }

  get(id) {
    return this.layers.get(id);
  }

  getAll() {
    return Array.from(this.layers.values());
  }

  has(id) {
    return this.layers.has(id);
  }
}

export const layerRegistry = new LayerRegistry();
