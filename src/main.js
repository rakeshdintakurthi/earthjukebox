// ============================================================================
// src/main.js — Main Application Controller & Cesium Engine
// ============================================================================

import { store } from './store.js';
import { layerRegistry } from './layerRegistry.js';
import { heatLayer } from './layers/heat.js';
import { rainfallLayer } from './layers/rainfall.js';
import { windLayer } from './layers/wind.js';
import { oceanLayer } from './layers/ocean.js';
import { tidesLayer } from './layers/tides.js';
import { platesLayer } from './layers/plates.js';
import { nasaFiresLayer } from './layers/nasaFires.js';
import { CommandProcessor } from './commands.js';
import { sonificationEngine } from './sonification.js';

// Register all 7 layers (including real NASA FIRMS Active Wildfires)
layerRegistry.register(heatLayer);
layerRegistry.register(rainfallLayer);
layerRegistry.register(windLayer);
layerRegistry.register(oceanLayer);
layerRegistry.register(tidesLayer);
layerRegistry.register(platesLayer);
layerRegistry.register(nasaFiresLayer);

// 1. Initialize Cesium 3D Globe
const START_DESTINATION = Cesium.Cartesian3.fromDegrees(78.9629, 20.5937, 18998000.0);

const viewer = new Cesium.Viewer('cesium', {
  animation: false,
  baseLayerPicker: false,
  fullscreenButton: false,
  geocoder: false,
  homeButton: false,
  infoBox: false,
  sceneModePicker: false,
  selectionIndicator: false,
  timeline: false,
  navigationHelpButton: false,
  scene3DOnly: true,
  creditContainer: document.createElement('div'),
  orderIndependentTranslucency: true
});

const scene = viewer.scene;
const globe = scene.globe;

// Photorealistic atmospheric settings
globe.enableLighting = true;
globe.showGroundAtmosphere = true;
if (scene.skyAtmosphere) {
  scene.skyAtmosphere.show = true;
  scene.skyAtmosphere.brightnessShift = 0.05;
  scene.skyAtmosphere.saturationShift = 0.1;
}
globe.baseColor = Cesium.Color.fromCssColorString('#020b14');

// Satellite Basemap
const satelliteProvider = new Cesium.UrlTemplateImageryProvider({
  url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
  maximumLevel: 19,
  credit: 'Esri, Maxar'
});
const baseImageryLayer = viewer.imageryLayers.addImageryProvider(satelliteProvider);

// High-resolution Country/City Names & Borders Overlay (kept on top)
const labelsProvider = new Cesium.UrlTemplateImageryProvider({
  url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
  maximumLevel: 19
});
const labelsLayer = viewer.imageryLayers.addImageryProvider(labelsProvider);
labelsLayer.alpha = 1.0;

viewer.camera.setView({ destination: START_DESTINATION });

// Camera friction
const ssc = scene.screenSpaceCameraController;
ssc.minimumZoomDistance = 40;
ssc.maximumZoomDistance = 4.0e7;
ssc.inertiaZoom = 0.85;
ssc.inertiaSpin = 0.9;

// Auto-rotation (halts on user interaction)
let userInteracted = false;
const haltRotate = () => { userInteracted = true; };
window.addEventListener('pointerdown', haltRotate, { passive: true });
window.addEventListener('wheel', haltRotate, { passive: true });
window.addEventListener('touchstart', haltRotate, { passive: true });

scene.preUpdate.addEventListener(() => {
  const isDefaultView = (!store.state.activeRasterLayer && store.state.activeOverlays.size === 0);
  if (isDefaultView && store.state.autoRotate && !userInteracted) {
    scene.camera.rotate(Cesium.Cartesian3.UNIT_Z, -0.0004);
  }
});

// Toast Messenger
let toastTimer = null;
export function showToast(text) {
  const toast = document.getElementById('cmd-toast');
  if (!toast) return;
  toast.textContent = text;
  toast.style.display = 'block';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.style.display = 'none'; }, 3200);
}

// 2. Command Processor
const cmdProcessor = new CommandProcessor(viewer, showToast);

// 3. Pin & Great-Circle Comparison
const pinBuilder = new Cesium.PinBuilder();
let pinAEntity = null, pinBEntity = null, arcEntity = null, arcLabelEntity = null;

function clearAllPinEntities() {
  if (pinAEntity) { viewer.entities.remove(pinAEntity); pinAEntity = null; }
  if (pinBEntity) { viewer.entities.remove(pinBEntity); pinBEntity = null; }
  if (arcEntity) { viewer.entities.remove(arcEntity); arcEntity = null; }
  if (arcLabelEntity) { viewer.entities.remove(arcLabelEntity); arcLabelEntity = null; }
  const panel = document.getElementById('inspector-panel');
  if (panel) panel.style.display = 'none';
}

function sampleActiveLayersAt(lat, lon) {
  const values = {};
  const { activeRasterLayer, activeOverlays, year, month, hour } = store.state;

  if (activeRasterLayer) {
    const l = layerRegistry.get(activeRasterLayer);
    if (l && typeof l.getValueAt === 'function') {
      values[l.label] = l.getValueAt(lat, lon, { year, month });
    }
  }

  for (const overlayId of activeOverlays) {
    const l = layerRegistry.get(overlayId);
    if (l && typeof l.getValueAt === 'function') {
      values[l.label] = l.getValueAt(lat, lon, { year, month, hour });
    }
  }

  return values;
}

function getNamedWaterBody(lat, lon) {
  if (lat > 66.5) return 'Arctic Ocean';
  if (lat < -60.0) return 'Southern Ocean';
  if (lat >= 30 && lat <= 46 && lon >= -5 && lon <= 36) return 'Mediterranean Sea';
  if (lat >= 12 && lat <= 30 && lon >= 32 && lon <= 44) return 'Red Sea';
  if (lat >= 8 && lat <= 26 && lon >= 55 && lon <= 77) return 'Arabian Sea';
  if (lat >= 8 && lat <= 23 && lon >= 80 && lon <= 98) return 'Bay of Bengal';
  if (lat >= 3 && lat <= 23 && lon >= 100 && lon <= 122) return 'South China Sea';
  if (lat >= 9 && lat <= 30 && lon >= -98 && lon <= -60) return 'Caribbean Sea';
  if (lon >= 20 && lon <= 140 && lat < 30 && lat >= -60) return 'Indian Ocean';
  if ((lon >= -70 && lon <= 20) || (lon >= -80 && lon <= -70 && lat > 15)) {
    return lat >= 0 ? 'North Atlantic Ocean' : 'South Atlantic Ocean';
  }
  if (lon > 140 || lon < -70) {
    return lat >= 0 ? 'North Pacific Ocean' : 'South Pacific Ocean';
  }
  return 'Open ocean';
}

function formatCoords(lat, lon) {
  const latStr = `${Math.abs(lat).toFixed(2)}° ${lat >= 0 ? 'N' : 'S'}`;
  const lonStr = `${Math.abs(lon).toFixed(2)}° ${lon >= 0 ? 'E' : 'W'}`;
  return `${latStr}, ${lonStr}`;
}

async function reverseGeocode(lat, lon) {
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=6`, {
      headers: { 'Accept': 'application/json' }
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.address) {
        const city = data.address.city || data.address.town || data.address.state || data.address.county;
        const country = data.address.country;
        if (city && country) return `${city}, ${country}`;
        if (country) return country;
        if (city) return city;
      }
      if (data && (data.name || data.display_name)) {
        return data.name || data.display_name.split(',')[0];
      }
    }
  } catch (e) {}
  return getNamedWaterBody(lat, lon);
}

let activePinTarget = 'A';

export function setPinTarget(target) {
  if (target === 'A' || target === 'B') {
    activePinTarget = target;
    syncPinTargetUI();
  }
}

export function syncPinTargetUI() {
  const cardA = document.getElementById('card-pin-a');
  const cardB = document.getElementById('card-pin-b');
  if (cardA) cardA.classList.toggle('target-active-a', activePinTarget === 'A');
  if (cardB) cardB.classList.toggle('target-active-b', activePinTarget === 'B');
}

export async function placePinAtCoordinates(id, lat, lon) {
  const carto = Cesium.Cartographic.fromDegrees(lon, lat);
  const cartesian = Cesium.Cartesian3.fromDegrees(lon, lat);
  await dropPin(id, cartesian, carto);
}

async function dropPin(id, cartesian, carto) {
  const isA = (id === 'A');
  const lat = Cesium.Math.toDegrees(carto.latitude);
  const lon = Cesium.Math.toDegrees(carto.longitude);
  const color = isA ? Cesium.Color.fromCssColorString('#00d2ff') : Cesium.Color.fromCssColorString('#ffd000');
  const image = pinBuilder.fromText(id, color, 48);

  const cfg = {
    position: cartesian,
    billboard: {
      image,
      verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
      heightReference: Cesium.HeightReference.CLAMP_TO_GROUND
    }
  };

  if (isA) {
    if (pinAEntity) { pinAEntity.position = cartesian; pinAEntity.show = true; }
    else { pinAEntity = viewer.entities.add(cfg); }
  } else {
    if (pinBEntity) { pinBEntity.position = cartesian; pinBEntity.show = true; }
    else { pinBEntity = viewer.entities.add(cfg); }
  }

  const values = sampleActiveLayersAt(lat, lon);
  const name = await reverseGeocode(lat, lon);

  store.setPin(id, { lat, lon, cartesian, cartographic: carto, name, values });
  updateInspectorPanel();
}

const METRIC_ICONS = {
  temp: `<svg class="cmp-metric-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9.5 7.5V3a1.5 1.5 0 0 0-3 0v4.5a3 3 0 1 0 3 0z"/><circle cx="8" cy="11" r="1.5"/></svg>`,
  sst: `<svg class="cmp-metric-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2 6c1.5 0 2-1.5 3-1.5s1.5 1.5 3 1.5 2-1.5 3-1.5 1.5 1.5 3 1.5M2 11c1.5 0 2-1.5 3-1.5s1.5 1.5 3 1.5 2-1.5 3-1.5 1.5 1.5 3 1.5"/></svg>`,
  wind: `<svg class="cmp-metric-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 5.5h7a1.5 1.5 0 0 0 0-3h-.5M2 8.5h10.5a1.5 1.5 0 0 1 0 3h-.5M2.5 11.5h5a1.5 1.5 0 0 0 0-3"/></svg>`,
  rain: `<svg class="cmp-metric-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M13 9.5a2.5 2.5 0 0 0-2-3.8 4 4 0 0 0-7.5 1.8A2.5 2.5 0 0 0 4 12.5h8.5a2.5 2.5 0 0 0 .5-3zM5.5 13.5l-.8 1.5M8 13.5l-.8 1.5M10.5 13.5l-.8 1.5"/></svg>`,
  fire: `<svg class="cmp-metric-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2c-1 3-3 4-3 7a4 4 0 0 0 8 0c0-2-1-3-2-4 0 2-1 3-2 3s-1-2-1-3z"/></svg>`,
  plates: `<svg class="cmp-metric-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2 13h12M3 10l3-4 4 3 3-5M7 6v7M10 9v4"/></svg>`,
  tides: `<svg class="cmp-metric-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2 8c2-4 4-4 6 0s4 4 6 0"/></svg>`,
  default: `<svg class="cmp-metric-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="8" r="6"/><path d="M8 5v3l2 2"/></svg>`
};

function getClosestPlate(lat, lon) {
  if (!platesLayer || !platesLayer.data || !platesLayer.data.plates) return null;
  let best = null, minDist = Infinity;
  for (const p of platesLayer.data.plates) {
    const d = Math.hypot(p.center[1] - lat, p.center[0] - lon);
    if (d < minDist) { minDist = d; best = p; }
  }
  return best;
}

// Acoustic Waveform Oscilloscope Visualizer
class AcousticWaveformVisualizer {
  constructor() {
    this.canvasA = document.getElementById('canvas-wave-a');
    this.canvasB = document.getElementById('canvas-wave-b');
    this.canvasCombo = document.getElementById('canvas-wave-combo');
    this.freqLabelA = document.getElementById('wave-freq-a');
    this.freqLabelB = document.getElementById('wave-freq-b');
    this.diffLabel = document.getElementById('wave-freq-diff');
    this.badge = document.getElementById('cmp-waveform-badge');

    this.freqA = 0;
    this.freqB = 0;
    this.gainA = 1.0;
    this.gainB = 1.0;
    this.isRainMode = false;
    this.noteA = '';
    this.noteB = '';
    this.nodesA = [];
    this.nodesB = [];
    this.isPlaying = false;

    this.phaseA = 0;
    this.phaseB = 0;
    this.lastTime = performance.now();

    this.start();
  }

  setPinData(metA, metB) {
    this.isRainMode = false;
    this.gainA = 1.0;
    this.gainB = 1.0;
    this.freqA = metA ? metA.noteFreq : 0;
    this.noteA = metA ? metA.note : '';
    this.nodesA = (metA && metA.nodes) ? metA.nodes : [];

    this.freqB = metB ? metB.noteFreq : 0;
    this.noteB = metB ? metB.note : '';
    this.nodesB = (metB && metB.nodes) ? metB.nodes : [];

    if (this.freqLabelA) {
      this.freqLabelA.textContent = this.freqA > 0 ? `${Math.round(this.freqA)} Hz (${this.noteA})` : '—';
    }
    if (this.freqLabelB) {
      this.freqLabelB.textContent = this.freqB > 0 ? `${Math.round(this.freqB)} Hz (${this.noteB})` : '—';
    }
    if (this.diffLabel) {
      if (this.freqA > 0 && this.freqB > 0) {
        const delta = Math.abs(Math.round(this.freqA - this.freqB));
        const ratio = (Math.max(this.freqA, this.freqB) / Math.max(1, Math.min(this.freqA, this.freqB))).toFixed(1);
        this.diffLabel.textContent = `${ratio}× ratio · ${delta} Hz Δ`;
      } else {
        this.diffLabel.textContent = '—';
      }
    }
    if (this.badge) {
      if (this.freqA > 0 && this.freqB > 0) {
        this.badge.textContent = (this.noteA === this.noteB) ? 'Unison (1.0×)' : 'Superposition';
      } else {
        this.badge.textContent = 'Harmonic Superposition';
      }
    }
  }

  setRainData(metA, metB) {
    this.isRainMode = true;
    this.gainA = (metA && !metA.isDry) ? metA.gain : 0;
    this.gainB = (metB && !metB.isDry) ? metB.gain : 0;
    this.freqA = (metA && !metA.isDry) ? (140 + metA.norm * 420) : 0;
    this.freqB = (metB && !metB.isDry) ? (140 + metB.norm * 420) : 0;
    this.noteA = (metA && !metA.isDry) ? metA.category : 'Dry';
    this.noteB = (metB && !metB.isDry) ? metB.category : 'Dry';
    this.nodesA = [];
    this.nodesB = [];

    if (this.freqLabelA) {
      this.freqLabelA.textContent = metA ? (metA.isDry ? '0.0 mm/day (Silence)' : `${metA.mm.toFixed(1)} mm/day · ${metA.category}`) : '—';
    }
    if (this.freqLabelB) {
      this.freqLabelB.textContent = metB ? (metB.isDry ? '0.0 mm/day (Silence)' : `${metB.mm.toFixed(1)} mm/day · ${metB.category}`) : '—';
    }
    if (this.diffLabel) {
      if (metA && metB) {
        if (metA.isDry && metB.isDry) {
          this.diffLabel.textContent = 'Both dry land · 0.0 mm/day (Silent)';
        } else if (metA.isDry) {
          this.diffLabel.textContent = `Pin A Silent · Pin B ${metB.mm.toFixed(1)} mm/day`;
        } else if (metB.isDry) {
          this.diffLabel.textContent = `Pin A ${metA.mm.toFixed(1)} mm/day · Pin B Silent`;
        } else {
          const delta = Math.abs(metA.mm - metB.mm).toFixed(1);
          this.diffLabel.textContent = `Δ ${delta} mm/day precipitation`;
        }
      } else {
        this.diffLabel.textContent = '—';
      }
    }
    if (this.badge) {
      this.badge.textContent = 'Rain Acoustic Waveform';
    }
  }

  setPlaying(playing) {
    this.isPlaying = playing;
  }

  start() {
    const loop = (currentTime) => {
      const dt = Math.min((currentTime - this.lastTime) / 1000, 0.1);
      this.lastTime = currentTime;

      const speedMultiplier = this.isPlaying ? 4.5 : 1.2;
      this.phaseA += (2.0 + (this.freqA ? this.freqA * 0.008 : 0)) * speedMultiplier * dt;
      this.phaseB += (2.0 + (this.freqB ? this.freqB * 0.008 : 0)) * speedMultiplier * dt;

      this.renderCanvas(this.canvasA, this.freqA, '#4CC9F0', this.phaseA, this.gainA);
      this.renderCanvas(this.canvasB, this.freqB, '#F5B94A', this.phaseB, this.gainB);
      this.renderComboCanvas(this.canvasCombo);

      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  renderCanvas(canvas, freq, color, phase, gain = 1.0) {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    // Center reference line
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, h / 2);
    ctx.lineTo(w, h / 2);
    ctx.stroke();

    // If dry land or frequency is 0: show silent flat center line
    if (!freq || gain <= 0.001) return;

    // Cycles across screen: normalized
    const cycles = this.isRainMode 
      ? (4.0 + (freq / 400.0) * 6.0)
      : (2.0 + Math.min(10.0, Math.max(0.5, ((freq - 65) / (1046 - 65)) * 10.0)));
    const amp = (h * 0.36) * Math.min(1.0, Math.max(0.2, gain));

    ctx.strokeStyle = color;
    ctx.lineWidth = 1.75;
    ctx.beginPath();

    for (let x = 0; x < w; x++) {
      const frac = x / w;
      const t = frac * cycles * 2 * Math.PI;
      let yDisp = Math.sin(t + phase);

      // In rain mode, add high frequency ripple simulating droplet spatters
      if (this.isRainMode) {
        yDisp += 0.18 * Math.sin(frac * cycles * 4.2 * Math.PI + phase * 2.1);
      }

      const y = (h / 2) - amp * yDisp;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  renderComboCanvas(canvas) {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    // Center reference line
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, h / 2);
    ctx.lineTo(w, h / 2);
    ctx.stroke();

    if ((!this.freqA || this.gainA <= 0.001) && (!this.freqB || this.gainB <= 0.001)) return;

    const cyclesA = this.freqA ? (2.0 + Math.min(10.0, Math.max(0.5, ((this.freqA - 65) / (1046 - 65)) * 10.0))) : 0;
    const cyclesB = this.freqB ? (2.0 + Math.min(10.0, Math.max(0.5, ((this.freqB - 65) / (1046 - 65)) * 10.0))) : 0;

    const maxAmp = (h * 0.38);

    const grad = ctx.createLinearGradient(0, 0, w, 0);
    grad.addColorStop(0, '#4CC9F0');
    grad.addColorStop(1, '#F5B94A');

    ctx.strokeStyle = grad;
    ctx.lineWidth = 2.0;
    ctx.beginPath();

    const weightA = (this.freqA && this.freqB) ? (0.48 * this.gainA) : (this.freqA ? (0.9 * this.gainA) : 0);
    const weightB = (this.freqA && this.freqB) ? (0.48 * this.gainB) : (this.freqB ? (0.9 * this.gainB) : 0);

    for (let x = 0; x < w; x++) {
      const frac = x / w;
      let val = 0;
      if (this.freqA && this.gainA > 0.001) {
        val += weightA * Math.sin(frac * cyclesA * 2 * Math.PI + this.phaseA);
      }
      if (this.freqB && this.gainB > 0.001) {
        val += weightB * Math.sin(frac * cyclesB * 2 * Math.PI + this.phaseB);
      }

      // Add harmonic beating envelope if nodes are present
      if (this.nodesA.length > 0 && this.nodesB.length > 0) {
        const overtone = 0.12 * Math.sin(frac * (cyclesA * 2.0) * 2 * Math.PI + this.phaseA * 1.5)
                       + 0.12 * Math.sin(frac * (cyclesB * 1.5) * 2 * Math.PI + this.phaseB * 1.2);
        val += overtone;
      }

      const y = (h / 2) - (val * maxAmp);
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
}

let waveVisualizer = null;

function updateInspectorPanel() {
  const { pins, activeRasterLayer, activeOverlays, year, month } = store.state;
  const panel = document.getElementById('inspector-panel');
  if (!panel) return;

  const emptyState = document.getElementById('cmp-empty-state');
  const identityRow = document.getElementById('cmp-identity-row');
  const tableContainer = document.getElementById('cmp-table-container');
  const soundSection = document.getElementById('cmp-sound-section');
  const footerEl = document.getElementById('cmp-footer');
  const distChip = document.getElementById('compare-dist');

  // If no pins are placed at all
  if (!pins.A && !pins.B) {
    if (emptyState) emptyState.style.display = 'flex';
    if (identityRow) identityRow.style.display = 'none';
    if (tableContainer) tableContainer.style.display = 'none';
    if (soundSection) soundSection.style.display = 'none';
    if (footerEl) footerEl.style.display = 'none';
    if (distChip) distChip.style.display = 'none';
    if (arcEntity) arcEntity.show = false;
    if (arcLabelEntity) arcLabelEntity.show = false;
    return;
  }

  // At least one pin is placed
  panel.style.display = 'flex';
  if (emptyState) emptyState.style.display = 'none';
  if (identityRow) identityRow.style.display = 'grid';
  if (tableContainer) tableContainer.style.display = 'flex';
  if (soundSection) soundSection.style.display = 'flex';
  if (footerEl) footerEl.style.display = 'flex';

  // 1. Render Pin Identity Cards
  const nameA = document.getElementById('pin-a-name');
  const coordsA = document.getElementById('pin-a-coords');
  const nameB = document.getElementById('pin-b-name');
  const coordsB = document.getElementById('pin-b-coords');

  if (pins.A) {
    if (nameA) nameA.textContent = pins.A.name || 'Selected location';
    if (coordsA) coordsA.textContent = formatCoords(pins.A.lat, pins.A.lon);
  } else {
    if (nameA) nameA.textContent = 'Select location';
    if (coordsA) coordsA.textContent = '—';
  }

  if (pins.B) {
    if (nameB) nameB.textContent = pins.B.name || 'Selected location';
    if (coordsB) coordsB.textContent = formatCoords(pins.B.lat, pins.B.lon);
  } else {
    if (nameB) nameB.textContent = 'Select location';
    if (coordsB) coordsB.textContent = '—';
  }

  // 2. Geodesic distance & Arc on Globe
  if (pins.A && pins.B) {
    const geodesic = new Cesium.EllipsoidGeodesic(pins.A.cartographic, pins.B.cartographic);
    const km = Math.round(geodesic.surfaceDistance / 1000);
    const miles = Math.round(km * 0.621371);

    if (distChip) {
      distChip.textContent = `${km.toLocaleString()} km · ${miles.toLocaleString()} mi`;
      distChip.style.display = 'inline-block';
    }

    // Geodesic polyline
    if (arcEntity) {
      arcEntity.polyline.positions = [pins.A.cartesian, pins.B.cartesian];
      arcEntity.show = true;
    } else {
      arcEntity = viewer.entities.add({
        polyline: {
          positions: [pins.A.cartesian, pins.B.cartesian],
          width: 3.5,
          arcType: Cesium.ArcType.GEODESIC,
          material: new Cesium.PolylineGlowMaterialProperty({
            glowPower: 0.35,
            color: Cesium.Color.fromCssColorString('#8ab4f8')
          })
        }
      });
    }

    // Midpoint label
    const midCarto = geodesic.interpolateUsingSurfaceDistance(geodesic.surfaceDistance * 0.5);
    const midPos = Cesium.Cartesian3.fromRadians(midCarto.longitude, midCarto.latitude, 70000.0);
    const labelText = `${km.toLocaleString()} km · ${miles.toLocaleString()} mi`;

    if (arcLabelEntity) {
      arcLabelEntity.position = midPos;
      arcLabelEntity.label.text = labelText;
      arcLabelEntity.show = true;
    } else {
      arcLabelEntity = viewer.entities.add({
        position: midPos,
        label: {
          text: labelText,
          font: 'bold 12px sans-serif',
          fillColor: Cesium.Color.WHITE,
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 3,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          backgroundColor: Cesium.Color.fromCssColorString('rgba(11, 15, 20, 0.9)'),
          showBackground: true,
          backgroundPadding: new Cesium.Cartesian2(10, 6),
          disableDepthTestDistance: Number.POSITIVE_INFINITY
        }
      });
    }
  } else {
    if (distChip) distChip.style.display = 'none';
    if (arcEntity) arcEntity.show = false;
    if (arcLabelEntity) arcLabelEntity.show = false;
  }

  // 3. Comparison Table (4-Column Grid: Metric | Pin A | Pin B | Δ)
  const rows = [];

  // Metric: Temperature (NOAA GlobalTemp)
  if (heatLayer && heatLayer.isLoaded) {
    const qA = pins.A ? heatLayer.query(pins.A.lat, pins.A.lon, year) : null;
    const qB = pins.B ? heatLayer.query(pins.B.lat, pins.B.lon, year) : null;
    const isOcean = (pins.A && oceanLayer?.querySST(pins.A.lat, pins.A.lon) != null) &&
                    (pins.B && oceanLayer?.querySST(pins.B.lat, pins.B.lon) != null);
    rows.push({
      icon: isOcean ? METRIC_ICONS.sst : METRIC_ICONS.temp,
      name: isOcean ? 'SST' : 'Temperature',
      unit: '°C',
      valA: qA ? qA.temp : null,
      valB: qB ? qB.temp : null,
      formattedA: qA ? qA.temp.toFixed(1) : '—',
      formattedB: qB ? qB.temp.toFixed(1) : '—',
      subA: null,
      subB: null,
      precision: 1
    });
  }

  // Metric: Plate Speed
  if (activeOverlays.has('plates') && platesLayer) {
    const pA = pins.A ? getClosestPlate(pins.A.lat, pins.A.lon) : null;
    const pB = pins.B ? getClosestPlate(pins.B.lat, pins.B.lon) : null;
    rows.push({
      icon: METRIC_ICONS.plates,
      name: 'Plate speed',
      unit: 'mm/yr',
      valA: pA ? pA.speed : null,
      valB: pB ? pB.speed : null,
      formattedA: pA ? Math.round(pA.speed) : '—',
      formattedB: pB ? Math.round(pB.speed) : '—',
      subA: pA?.name || null,
      subB: pB?.name || null,
      precision: 0
    });
  }

  // Metric: Wind Speed
  if (activeOverlays.has('wind') && windLayer) {
    const wA = pins.A ? windLayer.getVector(pins.A.lat, pins.A.lon, windLayer.altitude) : null;
    const wB = pins.B ? windLayer.getVector(pins.B.lat, pins.B.lon, windLayer.altitude) : null;
    rows.push({
      icon: METRIC_ICONS.wind,
      name: 'Wind',
      unit: 'm/s',
      valA: wA ? wA.speed : null,
      valB: wB ? wB.speed : null,
      formattedA: wA ? Math.round(wA.speed) : '—',
      formattedB: wB ? Math.round(wB.speed) : '—',
      subA: null,
      subB: null,
      precision: 0
    });
  }

  // Metric: Rainfall
  if ((activeRasterLayer === 'rainfall' || activeOverlays.has('rainfall')) && rainfallLayer) {
    const rA = pins.A ? rainfallLayer.query(pins.A.lat, pins.A.lon, month || 7) : null;
    const rB = pins.B ? rainfallLayer.query(pins.B.lat, pins.B.lon, month || 7) : null;
    rows.push({
      icon: METRIC_ICONS.rain,
      name: 'Rainfall',
      unit: 'mm/day',
      valA: rA,
      valB: rB,
      formattedA: rA != null ? rA.toFixed(1) : '—',
      formattedB: rB != null ? rB.toFixed(1) : '—',
      subA: null,
      subB: null,
      precision: 1
    });
  }

  // Metric: Tides
  if (activeOverlays.has('tides') && tidesLayer) {
    const tA = pins.A ? tidesLayer.queryAmplitude(pins.A.lat, pins.A.lon) : null;
    const tB = pins.B ? tidesLayer.queryAmplitude(pins.B.lat, pins.B.lon) : null;
    rows.push({
      icon: METRIC_ICONS.tides,
      name: 'Tides M2',
      unit: 'm',
      valA: tA,
      valB: tB,
      formattedA: tA != null ? tA.toFixed(2) : '—',
      formattedB: tB != null ? tB.toFixed(2) : '—',
      subA: null,
      subB: null,
      precision: 2
    });
  }

  // Metric: NASA Active Fires (FRP)
  if (activeOverlays.has('nasa_fires') && nasaFiresLayer) {
    const fA = pins.A ? nasaFiresLayer.queryNearest(pins.A.lat, pins.A.lon, 250) : null;
    const fB = pins.B ? nasaFiresLayer.queryNearest(pins.B.lat, pins.B.lon, 250) : null;
    const frpA = (fA && fA.hasFire) ? fA.frp : 0;
    const frpB = (fB && fB.hasFire) ? fB.frp : 0;
    rows.push({
      icon: METRIC_ICONS.fire,
      name: 'NASA Fire FRP',
      unit: 'MW',
      valA: frpA,
      valB: frpB,
      formattedA: frpA > 0 ? frpA.toFixed(1) : 'None',
      formattedB: frpB > 0 ? frpB.toFixed(1) : 'None',
      subA: (fA && fA.hasFire) ? `${fA.brightness}K · ${fA.distKm}km (${fA.satellite})` : 'No fire in 250km',
      subB: (fB && fB.hasFire) ? `${fB.brightness}K · ${fB.distKm}km (${fB.satellite})` : 'No fire in 250km',
      precision: 1
    });
  }

  // Render Table Rows
  const tableBody = document.getElementById('cmp-table-body');
  if (tableBody) {
    tableBody.innerHTML = rows.map(r => {
      let clsA = 'val-secondary';
      let clsB = 'val-secondary';
      let deltaHtml = '<span class="cmp-td-delta delta-neutral">—</span>';

      if (r.valA != null && r.valB != null) {
        if (r.valA > r.valB) {
          clsA = 'val-primary';
          clsB = 'val-secondary';
          const diff = (r.valA - r.valB).toFixed(r.precision);
          deltaHtml = `<span class="cmp-td-delta delta-pos">▲ ${diff} <span class="cmp-unit">${r.unit}</span></span>`;
        } else if (r.valB > r.valA) {
          clsA = 'val-secondary';
          clsB = 'val-primary';
          const diff = (r.valB - r.valA).toFixed(r.precision);
          deltaHtml = `<span class="cmp-td-delta delta-neg">▼ ${diff} <span class="cmp-unit">${r.unit}</span></span>`;
        } else {
          clsA = 'val-primary';
          clsB = 'val-primary';
          deltaHtml = `<span class="cmp-td-delta delta-neutral">0 <span class="cmp-unit">${r.unit}</span></span>`;
        }
      } else if (r.valA != null) {
        clsA = 'val-primary';
      } else if (r.valB != null) {
        clsB = 'val-primary';
      }

      const subHtmlA = r.subA ? `<div class="cmp-sub-text">${r.subA}</div>` : '';
      const subHtmlB = r.subB ? `<div class="cmp-sub-text">${r.subB}</div>` : '';

      return `
        <div class="cmp-tr">
          <div class="cmp-td-metric">
            ${r.icon}
            <span>${r.name}</span>
          </div>
          <div class="cmp-td-val ${clsA}">
            ${r.formattedA} ${r.valA != null ? `<span class="cmp-unit">${r.unit}</span>` : ''}
            ${subHtmlA}
          </div>
          <div class="cmp-td-val ${clsB}">
            ${r.formattedB} ${r.valB != null ? `<span class="cmp-unit">${r.unit}</span>` : ''}
            ${subHtmlB}
          </div>
          ${deltaHtml}
        </div>
      `;
    }).join('');
  }

  // 4. Sound Section (Sonification Mini-Table & Insight)
  const soundValA = document.getElementById('sound-val-a');
  const soundValB = document.getElementById('sound-val-b');
  const soundInsight = document.getElementById('sound-insight');

  const isRainActive = (activeRasterLayer === 'rainfall' || activeOverlays.has('rainfall'));

  if (isRainActive && rainfallLayer) {
    const rA = pins.A ? rainfallLayer.query(pins.A.lat, pins.A.lon, month || 7) : 0;
    const rB = pins.B ? rainfallLayer.query(pins.B.lat, pins.B.lon, month || 7) : 0;
    const metRainA = pins.A ? sonificationEngine.getRainMetrics(rA) : null;
    const metRainB = pins.B ? sonificationEngine.getRainMetrics(rB) : null;

    if (soundValA) {
      soundValA.textContent = metRainA ? (metRainA.isDry ? '0.0 mm/day · Dry Land · Silent' : `${rA.toFixed(1)} mm/day · ${metRainA.category} (${metRainA.volumeDesc})`) : '—';
    }
    if (soundValB) {
      soundValB.textContent = metRainB ? (metRainB.isDry ? '0.0 mm/day · Dry Land · Silent' : `${rB.toFixed(1)} mm/day · ${metRainB.category} (${metRainB.volumeDesc})`) : '—';
    }

    if (soundInsight) {
      if (metRainA && metRainB) {
        if (metRainA.isDry && metRainB.isDry) {
          soundInsight.textContent = 'Both pins on dry land (0 mm/day): Complete silence';
        } else if (metRainA.isDry) {
          soundInsight.textContent = `Left ear (Pin A) is silent; Right ear (Pin B) plays ${metRainB.category} (${rB.toFixed(1)} mm/day)`;
        } else if (metRainB.isDry) {
          soundInsight.textContent = `Left ear (Pin A) plays ${metRainA.category} (${rA.toFixed(1)} mm/day); Right ear (Pin B) is silent`;
        } else {
          const louder = rA >= rB ? 'Pin A louder' : 'Pin B louder';
          soundInsight.textContent = `Stereo rain contrast: ${rA.toFixed(1)} vs ${rB.toFixed(1)} mm/day (${louder})`;
        }
      } else if (pins.A) {
        soundInsight.textContent = 'Pin A ready. Drop Pin B to compare rain acoustics in stereo.';
      } else {
        soundInsight.textContent = 'Drop two pins to audition acoustic rain comparison.';
      }
    }

    if (!waveVisualizer) {
      waveVisualizer = new AcousticWaveformVisualizer();
    }
    waveVisualizer.setRainData(metRainA, metRainB);
  } else {
    let valA = null, valB = null;
    let metA = null, metB = null;

    if (pins.A && heatLayer) {
      valA = heatLayer.query(pins.A.lat, pins.A.lon, year);
      metA = sonificationEngine.getFireMetrics(valA.temp);
      if (soundValA) {
        soundValA.textContent = `${valA.temp.toFixed(1)} °C · ${(metA.cutoffFreq / 1000).toFixed(1)} kHz · ${metA.note}`;
      }
    } else if (soundValA) {
      soundValA.textContent = '—';
    }

    if (pins.B && heatLayer) {
      valB = heatLayer.query(pins.B.lat, pins.B.lon, year);
      metB = sonificationEngine.getFireMetrics(valB.temp);
      if (soundValB) {
        soundValB.textContent = `${valB.temp.toFixed(1)} °C · ${(metB.cutoffFreq / 1000).toFixed(1)} kHz · ${metB.note}`;
      }
    } else if (soundValB) {
      soundValB.textContent = '—';
    }

    if (soundInsight) {
      if (metA && metB) {
        const diffKhz = Math.abs(metA.cutoffFreq - metB.cutoffFreq) / 1000;
        if (metA.note === metB.note) {
          soundInsight.textContent = `Same note on both pins: unison (${metA.note})`;
        } else {
          const intervalName = sonificationEngine.getMusicalInterval(metA.noteFreq, metB.noteFreq);
          const pitchDiff = (metA.cutoffFreq >= metB.cutoffFreq)
            ? `Pin A is ${diffKhz.toFixed(1)} kHz higher pitch`
            : `Pin B is ${diffKhz.toFixed(1)} kHz higher pitch`;
          soundInsight.textContent = `${intervalName} · ${pitchDiff}`;
        }
      } else if (pins.A) {
        soundInsight.textContent = 'Pin A ready. Drop Pin B to compare in stereo.';
      } else {
        soundInsight.textContent = 'Drop two pins to audition acoustic comparison.';
      }
    }

    if (!waveVisualizer) {
      waveVisualizer = new AcousticWaveformVisualizer();
    }
    waveVisualizer.setPinData(metA, metB);
  }

  syncPinTargetUI();
}

// Click handler on Earth
const clickHandler = new Cesium.ScreenSpaceEventHandler(scene.canvas);
clickHandler.setInputAction((click) => {
  userInteracted = true;
  const cartesian = scene.pickPosition(click.position) || viewer.camera.pickEllipsoid(click.position, globe.ellipsoid);
  if (!cartesian) return;
  const carto = Cesium.Cartographic.fromCartesian(cartesian);
  const lat = Cesium.Math.toDegrees(carto.latitude);
  const lon = Cesium.Math.toDegrees(carto.longitude);

  // If Tides layer is active, open 48h harmonic curve modal
  if (store.state.activeOverlays.has('tides')) {
    tidesLayer.openTideCurveModal(lat, lon);
  }

  // Sonify clicked coordinate based on active layer
  const isRainLayerActive = (store.state.activeRasterLayer === 'rainfall' || store.state.activeOverlays.has('rainfall'));
  if (store.state.activeOverlays.has('nasa_fires') && nasaFiresLayer.isLoaded) {
    const fire = nasaFiresLayer.queryNearest(lat, lon, 250);
    if (fire.hasFire) {
      const fireTempC = (fire.brightness - 273.15);
      sonificationEngine.sonifyPoint(lat, lon, fireTempC, fire.frp / 15.0);
      showToast(`🔥 NASA Wildfire: ${fire.frp} MW (FRP) · ${fire.brightness} K (${fire.distKm} km away)`);
    } else {
      showToast('🔥 NASA FIRMS: No active wildfire within 250 km');
    }
  } else if (isRainLayerActive && rainfallLayer.isLoaded) {
    const mm = rainfallLayer.query(lat, lon, store.state.month || 7);
    sonificationEngine.sonifyRainPoint(lat, lon, mm).then(res => {
      if (res && res.isDry) {
        showToast('🌧️ Rainfall: 0.0 mm/day (Dry Land · Complete Silence)');
      } else if (res) {
        const met = sonificationEngine.getRainMetrics(mm);
        showToast(`🌧️ Rainfall: ${mm.toFixed(1)} mm/day (${met.category}) · Auditioning rain sound`);
      }
    });
  } else if (heatLayer.isLoaded) {
    const q = heatLayer.query(lat, lon, store.state.year);
    sonificationEngine.sonifyPoint(lat, lon, q.temp, q.anomaly);
  }

  // If Pin Tool or field layer active, drop the targeted pin (A or B)
  const hasActiveLayer = (store.state.activeRasterLayer != null || store.state.activeOverlays.size > 0);
  if (hasActiveLayer || store.state.pinToolActive) {
    dropPin(activePinTarget, cartesian, carto);
    showToast(`📍 Placed Pin ${activePinTarget} at ${Math.abs(lat).toFixed(1)}°${lat>=0?'N':'S'}, ${Math.abs(lon).toFixed(1)}°${lon>=0?'E':'W'}`);
    
    // Automatically toggle to companion pin for seamless 2-click pairing
    activePinTarget = (activePinTarget === 'A') ? 'B' : 'A';
    syncPinTargetUI();
  }
}, Cesium.ScreenSpaceEventType.LEFT_CLICK);

// Precomputed cosine latitude weights for global climate anomaly & sonification
const latWeights = [];
for (let r = 0; r < 36; r++) {
  latWeights.push(Math.cos((87.5 - r * 5.0) * Math.PI / 180.0));
}
const sumLatWeights = latWeights.reduce((a, b) => a + b, 0) * 72;

export function computeGlobalStats(year) {
  if (!heatLayer.storeData || !heatLayer.storeData.anomalies) {
    return { anomaly: 0.0, temp: 14.5 };
  }
  const grid = heatLayer.storeData.anomalies[year] || heatLayer.storeData.anomalies[Math.round(year)];
  if (!grid) return { anomaly: 0.0, temp: 14.5 };
  let anomSum = 0;
  for (let r = 0; r < 36; r++) {
    const w = latWeights[r];
    const row = grid[r];
    for (let c = 0; c < 72; c++) {
      anomSum += (row[c] * 0.01) * w;
    }
  }
  const meanAnom = anomSum / sumLatWeights;
  return {
    anomaly: meanAnom,
    temp: 14.0 + meanAnom
  };
}

export function updateSonificationClimate(year) {
  const stats = computeGlobalStats(year);
  sonificationEngine.updateModulation(year, stats.anomaly, stats.temp);
}

// 4. Central Store Sync & Scene Management
let prevRasterLayer = null;
const prevOverlays = new Set();

function syncLayersMenuUI(state) {
  const heatChk = document.getElementById('chk-layer-heat');
  if (heatChk) heatChk.checked = (state.activeRasterLayer === 'heat');

  const rainChk = document.getElementById('chk-layer-rainfall');
  if (rainChk) rainChk.checked = (state.activeRasterLayer === 'rainfall');

  ['wind', 'ocean', 'tides', 'plates'].forEach(id => {
    const el = document.getElementById(`chk-layer-${id}`);
    if (el) el.checked = state.activeOverlays.has(id);
  });
  const firesChk = document.getElementById('chk-layer-nasa-fires');
  if (firesChk) firesChk.checked = state.activeOverlays.has('nasa_fires');
}

store.subscribe(async (state, changedKeys) => {
  // Ignore events that only report internal loading or error status to avoid re-triggering scene work
  if (changedKeys && changedKeys.length > 0 && changedKeys.every(k => k === 'layerLoading' || k === 'layerError')) {
    return;
  }

  // Synchronize popover menu checkboxes
  syncLayersMenuUI(state);

  // 1. Manage Raster Layer (Mutually Exclusive)
  if (state.activeRasterLayer !== prevRasterLayer) {
    const oldLayerId = prevRasterLayer;
    prevRasterLayer = state.activeRasterLayer; // Immediately update state tracker to prevent re-entrant loops

    if (oldLayerId) {
      const prev = layerRegistry.get(oldLayerId);
      if (prev) {
        try { prev.hide(viewer); } catch (e) { console.error('[RasterLayer] Error hiding layer:', e); }
      }
    }

    if (state.activeRasterLayer) {
      const curr = layerRegistry.get(state.activeRasterLayer);
      if (curr) {
        try {
          await curr.load(viewer);
          curr.show(viewer, state.year || state.month, state.layerOpacity[state.activeRasterLayer]);
        } catch (e) {
          console.error('[RasterLayer] Error loading/showing layer:', e);
        }
      }
    }

    try {
      if (labelsLayer) viewer.imageryLayers.raiseToTop(labelsLayer);
    } catch (e) {}
  } else if (state.activeRasterLayer && (changedKeys.includes('year') || changedKeys.includes('month'))) {
    const curr = layerRegistry.get(state.activeRasterLayer);
    if (curr) {
      try {
        curr.update({ year: state.year, month: state.month }, viewer, state.layerOpacity[state.activeRasterLayer]);
      } catch (e) {
        console.error('[RasterLayer] Error updating raster layer:', e);
      }
    }
  }

  // 2. Manage Overlays (Stackable)
  for (const id of state.activeOverlays) {
    if (!prevOverlays.has(id)) {
      prevOverlays.add(id); // Immediately mark overlay active
      const overlay = layerRegistry.get(id);
      if (overlay) {
        try {
          await overlay.load(viewer);
          overlay.show(viewer, { altitude: state.windAltitude, hour: state.hour, plateTimeOffset: state.plateTimeOffset });
        } catch (e) {
          console.error('[Overlay] Error loading/showing overlay:', id, e);
        }
      }
    } else if (changedKeys.includes('windAltitude') || changedKeys.includes('hour') || changedKeys.includes('plateTimeOffset')) {
      const overlay = layerRegistry.get(id);
      if (overlay) {
        try {
          overlay.update({ altitude: state.windAltitude, hour: state.hour, plateTimeOffset: state.plateTimeOffset }, viewer);
        } catch (e) {
          console.error('[Overlay] Error updating overlay:', id, e);
        }
      }
    }
  }

  // Hide disabled overlays
  for (const id of Array.from(prevOverlays)) {
    if (!state.activeOverlays.has(id)) {
      prevOverlays.delete(id);
      const overlay = layerRegistry.get(id);
      if (overlay) {
        try {
          overlay.hide(viewer);
        } catch (e) {
          console.error('[Overlay] Error hiding overlay:', id, e);
        }
      }
    }
  }

  // Opacity updates
  if (changedKeys.includes('layerOpacity')) {
    if (state.activeRasterLayer) {
      const r = layerRegistry.get(state.activeRasterLayer);
      if (r) { try { r.setOpacity(state.layerOpacity[state.activeRasterLayer]); } catch (e) {} }
    }
    for (const id of state.activeOverlays) {
      const o = layerRegistry.get(id);
      if (o) { try { o.setOpacity(state.layerOpacity[id]); } catch (e) {} }
    }
  }

  // 3. Reset All Layers Check
  if (changedKeys.includes('reset')) {
    clearAllPinEntities();
  }

  // Keep labels on top
  try {
    if (labelsLayer) viewer.imageryLayers.raiseToTop(labelsLayer);
  } catch (e) {}

  // 4. Update Legends Stack
  try {
    renderLegendsStack(state);
  } catch (e) {
    console.error('[UI] Error rendering legends stack:', e);
  }

  // 5. Update Shared Timeline Dock
  try {
    renderSharedTimeline(state);
  } catch (e) {
    console.error('[UI] Error rendering shared timeline:', e);
  }

  // 6. Refresh Pin Inspector if active
  if (state.pins.A || state.pins.B) {
    try {
      if (state.pins.A) state.pins.A.values = sampleActiveLayersAt(state.pins.A.lat, state.pins.A.lon);
      if (state.pins.B) state.pins.B.values = sampleActiveLayersAt(state.pins.B.lat, state.pins.B.lon);
      updateInspectorPanel();
    } catch (e) {
      console.error('[UI] Error updating pin inspector:', e);
    }
  }

  // 7. Update Sonification Engine with modulated climate frequency & filter
  if (changedKeys.includes('year') || changedKeys.includes('activeRasterLayer') || changedKeys.includes('reset')) {
    updateSonificationClimate(state.year);
  }
});

// 5. Legends Stack Renderer
function renderLegendsStack(state) {
  const container = document.getElementById('legends-stack');
  if (!container) return;

  const activeLayers = [];
  if (state.activeRasterLayer) {
    const l = layerRegistry.get(state.activeRasterLayer);
    if (l) activeLayers.push(l);
  }
  for (const id of state.activeOverlays) {
    const l = layerRegistry.get(id);
    if (l) activeLayers.push(l);
  }

  if (activeLayers.length === 0) {
    container.style.display = 'none';
    container.innerHTML = '';
    return;
  }

  container.style.display = 'flex';
  container.innerHTML = activeLayers.map(l => {
    const leg = l.legend;
    if (!leg) return '';

    if (leg.items) {
      // Discrete items (e.g. Tectonic plates)
      const rows = leg.items.map(it => `
        <div style="display:flex; align-items:center; gap:6px; font-size:11px;">
          <span style="width:10px; height:10px; border-radius:2px; background:${it.color};"></span>
          <span>${it.label}</span>
        </div>
      `).join('');
      return `
        <div class="legend-card floating-ui">
          <div class="legend-card-header">
            <strong>${leg.title}</strong>
            <span class="legend-unit">${leg.unit}</span>
          </div>
          <div style="display:flex; flex-direction:column; gap:4px; margin-top:4px;">${rows}</div>
        </div>
      `;
    }

    // Continuous gradient
    const ticks = (leg.ticks || []).map(t => `<span>${t}</span>`).join('');
    return `
      <div class="legend-card floating-ui">
        <div class="legend-card-header">
          <strong>${leg.title}</strong>
          <span class="legend-unit">${leg.unit}</span>
        </div>
        <div class="legend-bar" style="background:${leg.gradient};"></div>
        <div class="legend-ticks">${ticks}</div>
      </div>
    `;
  }).join('');
}

// 6. Shared Timeline Controller
let isPlaying = false;
let playInterval = null;

function renderSharedTimeline(state) {
  const dock = document.getElementById('shared-timeline-dock');
  if (!dock) return;

  // Determine if any active layer needs time
  let activeTimeLayer = null;
  if (state.activeRasterLayer) {
    const l = layerRegistry.get(state.activeRasterLayer);
    if (l && l.timeline) activeTimeLayer = l;
  }
  if (!activeTimeLayer) {
    for (const id of state.activeOverlays) {
      const l = layerRegistry.get(id);
      if (l && l.timeline) { activeTimeLayer = l; break; }
    }
  }

  if (!activeTimeLayer) {
    dock.style.display = 'none';
    if (isPlaying) togglePlay(false);
    return;
  }

  dock.style.display = 'flex';
  const range = activeTimeLayer.timeRange;
  const slider = document.getElementById('tl-slider');
  const readout = document.getElementById('tl-readout');
  const labelSpan = document.getElementById('tl-layer-label');

  slider.min = range.min;
  slider.max = range.max;
  slider.step = range.step;

  let currentVal = state.year;
  if (range.labelFormat === 'Month') currentVal = state.month;
  else if (range.labelFormat === 'Hour') currentVal = state.hour;
  else if (range.labelFormat === 'Myr') currentVal = state.plateTimeOffset;

  slider.value = currentVal;
  readout.textContent = `${currentVal} ${range.labelFormat || ''}`;
  labelSpan.textContent = activeTimeLayer.label;
}

function togglePlay(start) {
  const playBtn = document.getElementById('tl-btn-play');
  isPlaying = (start !== undefined) ? start : !isPlaying;

  if (isPlaying) {
    playBtn.innerHTML = '⏸';
    playInterval = setInterval(() => {
      const slider = document.getElementById('tl-slider');
      let next = parseFloat(slider.value) + parseFloat(slider.step);
      if (next > parseFloat(slider.max)) next = parseFloat(slider.min);
      slider.value = next;
      handleTimelineInput(next);
    }, 450);
  } else {
    playBtn.innerHTML = '▶';
    clearInterval(playInterval);
  }
}

function handleTimelineInput(val) {
  const num = parseFloat(val);
  const readout = document.getElementById('tl-readout');

  if (store.state.activeRasterLayer === 'heat') {
    store.setYear(num);
    readout.textContent = `${Math.round(num)}`;
  } else if (store.state.activeRasterLayer === 'rainfall') {
    store.setMonth(num);
    readout.textContent = `Month ${Math.round(num)}`;
  } else if (store.state.activeOverlays.has('tides')) {
    store.setHour(num);
    readout.textContent = `${num.toFixed(1)} h`;
  } else if (store.state.activeOverlays.has('plates')) {
    store.setPlateTimeOffset(num);
    readout.textContent = `${num > 0 ? '+' : ''}${num} Myr`;
  }
}

// 7. Wire UI Buttons & Controls
function initUI() {
  // Command form
  const cmdInput = document.getElementById('cmd-input');
  if (cmdInput) {
    cmdInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        cmdProcessor.execute(cmdInput.value);
        cmdInput.value = '';
        cmdInput.blur();
      }
    });
  }

  // Voice recognition
  const btnMic = document.getElementById('btn-mic');
  if (btnMic) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const reco = new SpeechRecognition();
      reco.continuous = false;
      reco.onstart = () => { btnMic.classList.add('listening'); showToast('Listening... Speak command'); };
      reco.onresult = (ev) => {
        const txt = ev.results[0][0].transcript;
        if (cmdInput) cmdInput.value = txt;
        cmdProcessor.execute(txt);
      };
      reco.onend = () => btnMic.classList.remove('listening');
      btnMic.onclick = () => { try { reco.start(); } catch (e) { reco.stop(); } };
    } else {
      btnMic.onclick = () => showToast('Speech recognition not supported in this browser. Please type.');
    }
  }

  // Layers Menu Popover
  const btnLayers = document.getElementById('btn-layers');
  const popover = document.getElementById('layers-popover');
  if (btnLayers && popover) {
    btnLayers.onclick = (e) => {
      e.stopPropagation();
      const open = popover.style.display === 'block';
      popover.style.display = open ? 'none' : 'block';
    };
    window.addEventListener('click', (e) => {
      if (!popover.contains(e.target) && e.target !== btnLayers) {
        popover.style.display = 'none';
      }
    });
  }

  // Layer toggles in Popover
  const bindToggle = (checkboxId, onToggle) => {
    const el = document.getElementById(checkboxId);
    if (el) el.onchange = (e) => onToggle(e.target.checked);
  };
  const bindSlider = (sliderId, onInput) => {
    const el = document.getElementById(sliderId);
    if (el) el.oninput = (e) => onInput(parseFloat(e.target.value) / 100);
  };

  // 1. Heat
  bindToggle('chk-layer-heat', (chk) => {
    store.setRasterLayer(chk ? 'heat' : null);
    if (chk) showToast('Heat map active');
  });
  bindSlider('slider-heat-op', (val) => store.setOpacity('heat', val));
  const heatModeSelect = document.getElementById('sel-heat-mode');
  if (heatModeSelect) {
    heatModeSelect.onchange = (e) => {
      heatLayer.setMode(e.target.value, viewer);
      renderLegendsStack(store.state);
      showToast(e.target.value === 'temperature' ? 'Display: Surface Temperature (°C)' : 'Display: Temperature Anomaly (Δ°C)');
    };
  }

  // 2. Rainfall
  bindToggle('chk-layer-rainfall', (chk) => {
    store.setRasterLayer(chk ? 'rainfall' : null);
    if (chk) showToast('Rainfall active');
  });
  bindSlider('slider-rain-op', (val) => store.setOpacity('rainfall', val));

  // 3. Wind
  bindToggle('chk-layer-wind', (chk) => {
    store.toggleOverlay('wind', chk);
    if (chk) showToast('Wind streamlines active');
  });
  bindSlider('slider-wind-op', (val) => store.setOpacity('wind', val));
  const windAltSelect = document.getElementById('sel-wind-alt');
  if (windAltSelect) {
    windAltSelect.onchange = (e) => store.setWindAltitude(e.target.value);
  }

  // 4. Ocean
  bindToggle('chk-layer-ocean', (chk) => {
    store.toggleOverlay('ocean', chk);
    if (chk) showToast('Ocean currents & SST active');
  });
  bindSlider('slider-ocean-op', (val) => store.setOpacity('ocean', val));
  bindToggle('chk-sub-sst', (chk) => oceanLayer.setSSTVisible(chk));

  // 5. Tides
  bindToggle('chk-layer-tides', (chk) => {
    store.toggleOverlay('tides', chk);
    if (chk) showToast('Global tides active (Click coastal points for tide curve)');
  });
  bindSlider('slider-tides-op', (val) => store.setOpacity('tides', val));

  // 6. Plates
  bindToggle('chk-layer-plates', (chk) => {
    store.toggleOverlay('plates', chk);
    if (chk) showToast('Tectonic plates & drift active');
  });
  bindSlider('slider-plates-op', (val) => store.setOpacity('plates', val));

  // 7. NASA Active Wildfires (FIRMS)
  bindToggle('chk-layer-nasa-fires', (chk) => {
    store.toggleOverlay('nasa_fires', chk);
    if (chk) showToast('NASA Active Wildfires (FIRMS MODIS) active');
  });
  bindSlider('slider-nasa-fires-op', (val) => store.setOpacity('nasa_fires', val));

  // Labels & Atmosphere toggles
  bindToggle('chk-labels', (chk) => { if (labelsLayer) labelsLayer.show = chk; });
  bindToggle('chk-lighting', (chk) => { globe.enableLighting = chk; });

  // Reset button
  const brandReset = document.getElementById('brand-reset');
  if (brandReset) {
    brandReset.onclick = () => {
      store.resetAllLayers();
      // Uncheck UI boxes
      ['chk-layer-heat', 'chk-layer-rainfall', 'chk-layer-wind', 'chk-layer-ocean', 'chk-layer-tides', 'chk-layer-plates', 'chk-layer-nasa-fires'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.checked = false;
      });
      showToast('Reset to Default View (All layers off)');
    };
  }

  // Timeline slider
  const tlSlider = document.getElementById('tl-slider');
  if (tlSlider) tlSlider.addEventListener('input', (e) => handleTimelineInput(e.target.value));

  const tlPlayBtn = document.getElementById('tl-btn-play');
  if (tlPlayBtn) tlPlayBtn.onclick = () => togglePlay();

  // Pin Tool button in top toolbar
  const btnPin = document.getElementById('btn-pin-tool');
  if (btnPin) {
    btnPin.onclick = () => {
      store.state.pinToolActive = !store.state.pinToolActive;
      btnPin.classList.toggle('active', store.state.pinToolActive);
      showToast(store.state.pinToolActive ? 'Pin mode: Click Earth to place Pin A and Pin B' : 'Pin mode off');
    };
  }

  // Inspector panel buttons
  const btnCloseInsp = document.getElementById('btn-close-inspector');
  if (btnCloseInsp) {
    btnCloseInsp.onclick = () => {
      const p = document.getElementById('inspector-panel');
      if (p) p.style.display = 'none';
    };
  }
  const btnClearPins = document.getElementById('btn-clear-pins');
  if (btnClearPins) {
    btnClearPins.onclick = () => {
      store.clearPins();
      clearAllPinEntities();
    };
  }
  // Pin Identity Cards (Click to Target & Fly)
  const cardPinA = document.getElementById('card-pin-a');
  const cardPinB = document.getElementById('card-pin-b');

  if (cardPinA) {
    cardPinA.onclick = () => {
      setPinTarget('A');
      if (store.state.pins.A) {
        viewer.camera.flyTo({
          destination: Cesium.Cartesian3.fromDegrees(store.state.pins.A.lon, store.state.pins.A.lat, 400000.0),
          duration: 1.2
        });
      }
    };
  }
  if (cardPinB) {
    cardPinB.onclick = () => {
      setPinTarget('B');
      if (store.state.pins.B) {
        viewer.camera.flyTo({
          destination: Cesium.Cartesian3.fromDegrees(store.state.pins.B.lon, store.state.pins.B.lat, 400000.0),
          duration: 1.2
        });
      }
    };
  }

  // 1-Click Comparison Presets (Instant Hot vs Cold Pairings)
  const applyPreset = async (latA, lonA, latB, lonB, label) => {
    showToast(`Loading preset: ${label}`);
    await placePinAtCoordinates('A', latA, lonA);
    await placePinAtCoordinates('B', latB, lonB);
    setPinTarget('A');

    const midLat = (latA + latB) / 2;
    const midLon = (lonA + lonB) / 2;
    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(midLon, midLat, 9500000.0),
      duration: 1.5
    });
  };

  const pDelhi = document.getElementById('preset-delhi-siberia');
  if (pDelhi) pDelhi.onclick = () => applyPreset(28.61, 77.20, 63.50, 105.00, 'India vs Siberia');

  const pSahara = document.getElementById('preset-sahara-greenland');
  if (pSahara) pSahara.onclick = () => applyPreset(23.41, 11.50, 72.00, -40.00, 'Sahara vs Greenland');

  const pAmazon = document.getElementById('preset-amazon-antarctica');
  if (pAmazon) pAmazon.onclick = () => applyPreset(-3.46, -62.21, -75.00, 0.00, 'Amazon vs South Pole');

  const pTokyo = document.getElementById('preset-tokyo-iceland');
  if (pTokyo) pTokyo.onclick = () => applyPreset(35.67, 139.65, 64.14, -21.94, 'Tokyo vs Iceland');

  const btnFlyA = document.getElementById('btn-fly-a');
  if (btnFlyA) {
    btnFlyA.onclick = () => {
      if (store.state.pins.A) {
        viewer.camera.flyTo({
          destination: Cesium.Cartesian3.fromDegrees(store.state.pins.A.lon, store.state.pins.A.lat, 400000.0),
          duration: 1.5
        });
      }
    };
  }
  const btnFlyB = document.getElementById('btn-fly-b');
  if (btnFlyB) {
    btnFlyB.onclick = () => {
      if (store.state.pins.B) {
        viewer.camera.flyTo({
          destination: Cesium.Cartesian3.fromDegrees(store.state.pins.B.lon, store.state.pins.B.lat, 400000.0),
          duration: 1.5
        });
      }
    };
  }

  // Collapsible Sonification Section Toggle
  const btnToggleSound = document.getElementById('btn-toggle-sound-section');
  const soundContent = document.getElementById('sound-section-content');
  if (btnToggleSound && soundContent) {
    btnToggleSound.onclick = () => {
      const isExpanded = btnToggleSound.getAttribute('aria-expanded') === 'true';
      btnToggleSound.setAttribute('aria-expanded', !isExpanded);
      soundContent.classList.toggle('expanded', !isExpanded);
    };
  }

  // Audio Mode Selector (Blend, Notes, Heat)
  const modeBtnBlend = document.getElementById('mode-btn-blend');
  const modeBtnNotes = document.getElementById('mode-btn-notes');
  const modeBtnFire = document.getElementById('mode-btn-fire');

  const setAudioMode = (mode) => {
    sonificationEngine.setSoundMode(mode);
    if (modeBtnBlend) modeBtnBlend.classList.toggle('active', mode === 'blend');
    if (modeBtnNotes) modeBtnNotes.classList.toggle('active', mode === 'notes');
    if (modeBtnFire) modeBtnFire.classList.toggle('active', mode === 'fire');
    const label = mode === 'blend' ? 'Blend' : (mode === 'notes' ? 'Notes only' : 'Heat only');
    showToast(`Audio mode: ${label}`);
  };

  if (modeBtnBlend) modeBtnBlend.onclick = () => setAudioMode('blend');
  if (modeBtnNotes) modeBtnNotes.onclick = () => setAudioMode('notes');
  if (modeBtnFire) modeBtnFire.onclick = () => setAudioMode('fire');

  // Playback Controls
  const btnFireSoloA = document.getElementById('btn-fire-solo-a');
  const btnFireSoloB = document.getElementById('btn-fire-solo-b');
  const btnFireBoth = document.getElementById('btn-fire-both');
  const btnFireLoop = document.getElementById('btn-fire-loop');
  const btnFireStop = document.getElementById('btn-fire-stop');

  sonificationEngine.onPinAudioState = (state) => {
    if (waveVisualizer) {
      waveVisualizer.setPlaying(state.active);
    }
    if (btnFireStop) {
      btnFireStop.style.display = state.active ? 'inline-flex' : 'none';
    }
    if (btnFireSoloA) btnFireSoloA.classList.toggle('active', state.active && state.mode === 'soloA');
    if (btnFireSoloB) btnFireSoloB.classList.toggle('active', state.active && state.mode === 'soloB');
    if (btnFireBoth) btnFireBoth.classList.toggle('active', state.active && (state.mode === 'both' || state.mode === 'loop'));
    if (btnFireLoop) btnFireLoop.classList.toggle('active', state.active && state.mode === 'loop');
  };

  if (btnFireSoloA) {
    btnFireSoloA.onclick = async () => {
      if (!store.state.pins.A) {
        showToast('Place Pin A on the globe first');
        return;
      }
      const isRain = (store.state.activeRasterLayer === 'rainfall' || store.state.activeOverlays.has('rainfall'));
      if (isRain) {
        await sonificationEngine.playPinRainA(store.state.pins.A, rainfallLayer, store.state.month || 7);
        const mmA = rainfallLayer ? rainfallLayer.query(store.state.pins.A.lat, store.state.pins.A.lon, store.state.month || 7) : 0;
        const metA = sonificationEngine.getRainMetrics(mmA);
        showToast(metA.isDry ? 'Pin A: Dry Land (Left ear is silent)' : `Auditioning Pin A (${metA.category}, ${mmA.toFixed(1)} mm/day) in left ear`);
      } else {
        await sonificationEngine.playPinFireA(store.state.pins.A, heatLayer, store.state.year);
        showToast('Auditioning Pin A in left ear');
      }
    };
  }

  if (btnFireSoloB) {
    btnFireSoloB.onclick = async () => {
      if (!store.state.pins.B) {
        showToast('Place Pin B on the globe first');
        return;
      }
      const isRain = (store.state.activeRasterLayer === 'rainfall' || store.state.activeOverlays.has('rainfall'));
      if (isRain) {
        await sonificationEngine.playPinRainB(store.state.pins.B, rainfallLayer, store.state.month || 7);
        const mmB = rainfallLayer ? rainfallLayer.query(store.state.pins.B.lat, store.state.pins.B.lon, store.state.month || 7) : 0;
        const metB = sonificationEngine.getRainMetrics(mmB);
        showToast(metB.isDry ? 'Pin B: Dry Land (Right ear is silent)' : `Auditioning Pin B (${metB.category}, ${mmB.toFixed(1)} mm/day) in right ear`);
      } else {
        await sonificationEngine.playPinFireB(store.state.pins.B, heatLayer, store.state.year);
        showToast('Auditioning Pin B in right ear');
      }
    };
  }

  if (btnFireBoth) {
    btnFireBoth.onclick = async () => {
      if (!store.state.pins.A || !store.state.pins.B) {
        showToast('Place both Pin A and Pin B to compare sounds');
        return;
      }
      const isRain = (store.state.activeRasterLayer === 'rainfall' || store.state.activeOverlays.has('rainfall'));
      if (isRain) {
        await sonificationEngine.playPinRainBoth(store.state.pins.A, store.state.pins.B, rainfallLayer, store.state.month || 7);
        const mmA = rainfallLayer ? rainfallLayer.query(store.state.pins.A.lat, store.state.pins.A.lon, store.state.month || 7) : 0;
        const mmB = rainfallLayer ? rainfallLayer.query(store.state.pins.B.lat, store.state.pins.B.lon, store.state.month || 7) : 0;
        showToast(`Comparing rain: A (${mmA.toFixed(1)} mm/day, Left) vs B (${mmB.toFixed(1)} mm/day, Right)`);
      } else {
        await sonificationEngine.playPinFireBoth(store.state.pins.A, store.state.pins.B, heatLayer, store.state.year);
        showToast('Comparing both pins in stereo');
      }
    };
  }

  if (btnFireLoop) {
    btnFireLoop.onclick = async () => {
      if (!store.state.pins.A || !store.state.pins.B) {
        showToast('Place both Pin A and Pin B to start loop');
        return;
      }
      const isRain = (store.state.activeRasterLayer === 'rainfall' || store.state.activeOverlays.has('rainfall'));
      if (isRain) {
        const isLooping = await sonificationEngine.toggleLoopPinRain(store.state.pins.A, store.state.pins.B, rainfallLayer, store.state.month || 7);
        showToast(isLooping ? 'Looping rain stereo comparison' : 'Loop stopped');
      } else {
        const isLooping = await sonificationEngine.toggleLoopPinFire(store.state.pins.A, store.state.pins.B, heatLayer, store.state.year);
        showToast(isLooping ? 'Looping stereo comparison' : 'Loop stopped');
      }
    };
  }

  if (btnFireStop) {
    btnFireStop.onclick = () => {
      sonificationEngine.stopPinFire();
      showToast('Playback stopped');
    };
  }

  // Sonification & Audio Controls
  const btnSonify = document.getElementById('btn-sonification');
  const sonifyLbl = document.getElementById('sonify-label');
  const tlAudioBtn = document.getElementById('tl-btn-audio');
  const visualizerBars = document.querySelectorAll('#audio-bars span');

  const updateAudioUI = (state) => {
    if (btnSonify) {
      btnSonify.classList.toggle('sound-active', state.isPlaying);
    }
    if (sonifyLbl) {
      sonifyLbl.textContent = state.isPlaying ? 'Sound On' : 'Sound';
    }
    if (tlAudioBtn) {
      tlAudioBtn.textContent = state.isPlaying ? '🔊' : '🔈';
    }
  };

  sonificationEngine.onStateChange = (state) => {
    updateAudioUI(state);
  };

  const toggleSonification = async () => {
    const isPlaying = await sonificationEngine.togglePlay();
    updateSonificationClimate(store.state.year);
    showToast(isPlaying ? `🔊 Climate Sonification ON (Modulating ${store.state.year} Data)` : '🔈 Sonification Muted');
  };

  if (btnSonify) btnSonify.onclick = toggleSonification;
  if (tlAudioBtn) tlAudioBtn.onclick = toggleSonification;

  // Real-time audio wave visualizer animation
  const freqData = new Uint8Array(32);
  function animateVisualizer() {
    if (sonificationEngine.isPlaying && visualizerBars.length > 0) {
      sonificationEngine.getVisualizerData(freqData);
      for (let i = 0; i < visualizerBars.length; i++) {
        const val = freqData[i * 2 + 1] || 0;
        const h = Math.max(3, Math.min(14, (val / 255) * 14));
        visualizerBars[i].style.height = `${h}px`;
      }
    } else if (visualizerBars.length > 0) {
      for (let i = 0; i < visualizerBars.length; i++) {
        visualizerBars[i].style.height = '3px';
      }
    }
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(animateVisualizer);
    }
  }
  if (typeof requestAnimationFrame === 'function') {
    animateVisualizer();
  }

  // Navigation stack
  const btnZoomIn = document.getElementById('btn-zoom-in');
  if (btnZoomIn) {
    btnZoomIn.onclick = () => {
      userInteracted = true;
      viewer.camera.zoomIn(viewer.camera.positionCartographic.height * 0.35);
    };
  }
  const btnZoomOut = document.getElementById('btn-zoom-out');
  if (btnZoomOut) {
    btnZoomOut.onclick = () => {
      userInteracted = true;
      viewer.camera.zoomOut(viewer.camera.positionCartographic.height * 0.5);
    };
  }
  const btnCompass = document.getElementById('btn-compass');
  if (btnCompass) {
    btnCompass.onclick = () => {
      userInteracted = true;
      viewer.camera.flyTo({
        destination: viewer.camera.position,
        orientation: { heading: 0.0, pitch: viewer.camera.pitch, roll: 0.0 },
        duration: 0.6
      });
    };
  }
  const btnResetView = document.getElementById('btn-reset-view');
  if (btnResetView) {
    btnResetView.onclick = () => {
      userInteracted = true;
      viewer.camera.flyTo({ destination: START_DESTINATION, duration: 1.5 });
    };
  }
}

initUI();
