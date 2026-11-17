// ============================================================================
// src/comparisonPanel.js — Two-Sided Comparison Overlay Layout Component
// Reusable Card Component (used twice: Left Card A & Right Card B).
// Middle ~50% pointer-events pass-through keeps globe interactive.
// Delta strip top center; compact bar & sonification drawer bottom center.
// ============================================================================

import { store } from './store.js';
import { sonificationEngine } from './sonification.js';
import { fetchLocationClimate } from './climateApi.js';

export class ComparisonPanelManager {
  constructor(viewer, heatLayer, rainfallLayer) {
    this.viewer = viewer;
    this.heatLayer = heatLayer;
    this.rainfallLayer = rainfallLayer;

    this.panelEl = document.getElementById('inspector-panel');
    this.activeTarget = 'A';
    this.isPlaying = false;
    this.animFrameId = null;
    this.timeDomainBuffer = new Uint8Array(128);

    this.climateDataA = null;
    this.climateDataB = null;

    this.initPanelStructure();
    this.bindEvents();
    this.startWaveformLoop();
  }

  /**
   * Generates the reusable card component HTML (used identically for Pin A and Pin B)
   */
  renderCardComponent(id, accentColor, sideClass) {
    const isA = (id === 'A');
    const label = `LOCATION ${id}`;
    const idLower = id.toLowerCase();

    return `
      <aside id="card-pin-${idLower}" class="cmp-side-card ${sideClass} cmp-interactive" aria-label="${label} comparison card">
        <div class="cmp-corner-bracket-tl"></div>
        <div class="cmp-corner-bracket-br"></div>

        <!-- 1. Header Strip -->
        <div class="cmp-card-header-strip">
          <div class="cmp-card-tag">
            <span class="cmp-card-dot"></span>
            <span>${label}</span>
          </div>
          <div id="pin-${idLower}-header-title" class="cmp-card-title">Select location</div>
          <div id="pin-${idLower}-coords" class="cmp-card-coords">—</div>
        </div>

        <!-- 2. Satellite Thumbnail (Esri World Imagery zoom ~5) -->
        <div class="cmp-satellite-box">
          <canvas id="canvas-sat-${idLower}" class="cmp-satellite-canvas" width="220" height="90"></canvas>
          <div class="cmp-satellite-pin-overlay"></div>
        </div>

        <!-- 3. Four Metric Tiles (2x2 Grid) -->
        <div class="cmp-metrics-2x2">
          <div class="cmp-metric-tile" id="tile-temp-${idLower}">
            <span class="cmp-metric-label">TEMPERATURE (°C)</span>
            <span id="val-temp-${idLower}" class="cmp-metric-val">—</span>
          </div>
          <div class="cmp-metric-tile" id="tile-hum-${idLower}">
            <span class="cmp-metric-label">HUMIDITY (%)</span>
            <span id="val-hum-${idLower}" class="cmp-metric-val">—</span>
          </div>
          <div class="cmp-metric-tile" id="tile-rain-${idLower}">
            <span class="cmp-metric-label">RAINFALL (mm)</span>
            <span id="val-rain-${idLower}" class="cmp-metric-val">—</span>
          </div>
          <div class="cmp-metric-tile" id="tile-ndvi-${idLower}">
            <span class="cmp-metric-label">VEGETATION INDEX (NDVI 0-1)</span>
            <span id="val-ndvi-${idLower}" class="cmp-metric-val">—</span>
          </div>
        </div>

        <!-- 4. Two Mini Sparklines -->
        <div class="cmp-sparklines-box">
          <div class="cmp-sparkline-row">
            <div class="cmp-spark-label">
              <span>TEMP HISTORY (1850–NOW)</span>
              <span id="spark-temp-lbl-${idLower}">NOAA</span>
            </div>
            <canvas id="spark-temp-${idLower}" class="cmp-spark-canvas" width="220" height="26"></canvas>
          </div>
          <div class="cmp-sparkline-row">
            <div class="cmp-spark-label">
              <span>RAINFALL TREND</span>
              <span id="spark-rain-lbl-${idLower}">MONTHLY</span>
            </div>
            <canvas id="spark-rain-${idLower}" class="cmp-spark-canvas" width="220" height="26"></canvas>
          </div>
        </div>

        <!-- 5. 12-Bar Monthly Chart -->
        <div class="cmp-barchart-box">
          <div class="cmp-barchart-header">
            <span>12-MO RAINFALL (mm)</span>
            <span id="barchart-lbl-${idLower}">JAN–DEC</span>
          </div>
          <div class="cmp-barchart-bars" id="bars-${idLower}">
            <!-- 12 Bars rendered dynamically -->
          </div>
        </div>

        <!-- 6. Waveform Panel -->
        <div class="cmp-waveform-tile">
          <div class="cmp-waveform-meta">
            <span class="cmp-note-tag" id="wave-note-${idLower}">—</span>
            <span id="wave-freq-${idLower}">—</span>
          </div>
          <canvas id="canvas-wave-${idLower}" class="cmp-single-wave-canvas" width="220" height="32"></canvas>
        </div>
      </aside>
    `;
  }

  initPanelStructure() {
    if (!this.panelEl) return;

    this.panelEl.innerHTML = `
      <!-- Top Center Container: Header, Distance Chip, Close Button, & Delta Strip -->
      <div class="cmp-top-center-container cmp-interactive">
        <div class="cmp-top-header-bar">
          <h2 class="cmp-top-title">LOCATION COMPARISON</h2>
          <span id="compare-dist" class="cmp-distance-chip" style="display:none;">—</span>
          <button id="btn-close-inspector" class="cmp-btn-icon-close" aria-label="Close comparison (ESC)" title="Close comparison (ESC)">
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
              <path d="M4 4l8 8M12 4l-8 8"/>
            </svg>
          </button>
        </div>

        <!-- Delta Strip Under the Title -->
        <div id="cmp-delta-strip" class="cmp-delta-strip">
          <div class="cmp-delta-badge">
            <span class="cmp-delta-lbl">Δ TEMP</span>
            <span id="delta-val-temp" class="cmp-delta-val is-neutral">—</span>
          </div>
          <div class="cmp-delta-badge">
            <span class="cmp-delta-lbl">Δ HUMIDITY</span>
            <span id="delta-val-hum" class="cmp-delta-val is-neutral">—</span>
          </div>
          <div class="cmp-delta-badge">
            <span class="cmp-delta-lbl">Δ RAINFALL</span>
            <span id="delta-val-rain" class="cmp-delta-val is-neutral">—</span>
          </div>
          <div class="cmp-delta-badge">
            <span class="cmp-delta-lbl">Δ NDVI</span>
            <span id="delta-val-ndvi" class="cmp-delta-val is-neutral">—</span>
          </div>
        </div>
      </div>

      <!-- LEFT CARD: Location A (Pin A — Cyan #22d3ee) -->
      ${this.renderCardComponent('A', '#22d3ee', 'cmp-card-left')}

      <!-- RIGHT CARD: Location B (Pin B — Amber #fbbf24) -->
      ${this.renderCardComponent('B', '#fbbf24', 'cmp-card-right')}

      <!-- BOTTOM CENTER BAR: Combined Waveform, Controls, & Collapsible Sonification Drawer -->
      <div class="cmp-bottom-center-bar cmp-interactive">
        <div class="cmp-combo-wave-header">
          <span>COMBINED (A + B INTERFERENCE) WAVEFORM</span>
          <span id="cmp-interference-badge">STEREO RESONANCE</span>
        </div>
        <canvas id="canvas-wave-combo" class="cmp-combo-wave-canvas" width="460" height="36"></canvas>

        <!-- Controls Row -->
        <div class="cmp-controls-row">
          <button id="btn-fire-solo-a" class="cmp-btn-ctrl cmp-btn-solo-a" title="Play Pin A in left ear">
            <span>Play A</span>
          </button>
          <button id="btn-fire-both" class="cmp-btn-ctrl cmp-btn-play-both" title="Play both pins in stereo">
            <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor">
              <path d="M4 3l10 5-10 5V3z"/>
            </svg>
            <span>Play Both</span>
          </button>
          <button id="btn-fire-solo-b" class="cmp-btn-ctrl cmp-btn-solo-b" title="Play Pin B in right ear">
            <span>Play B</span>
          </button>
          <button id="btn-fly-a" class="cmp-btn-ctrl" title="Fly camera to Location A">
            <span>Fly to A</span>
          </button>
          <button id="btn-fly-b" class="cmp-btn-ctrl" title="Fly camera to Location B">
            <span>Fly to B</span>
          </button>
          <button id="btn-clear-pins" class="cmp-btn-ctrl cmp-btn-clear" title="Clear Pins">
            <span>Clear</span>
          </button>
        </div>

        <!-- Collapsible Sonification Drawer -->
        <div class="cmp-sonification-drawer">
          <button id="btn-toggle-sound-drawer" class="cmp-sonification-toggle-btn" aria-expanded="false" title="Toggle Sonification Synthesis Modes">
            <span>SYNTHESIS MODE (STEREO BINAURAL)</span>
            <svg id="chevron-sound-drawer" width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <path d="M4 6l4 4 4-4"/>
            </svg>
          </button>
          <div id="sound-drawer-content" class="cmp-sonification-modes" style="display:none;">
            <button id="mode-btn-blend" class="cmp-mode-btn is-active">Blend</button>
            <button id="mode-btn-notes" class="cmp-mode-btn">Notes</button>
            <button id="mode-btn-fire" class="cmp-mode-btn">Heat</button>
          </div>
        </div>
      </div>
    `;
  }

  bindEvents() {
    // Close button
    const btnClose = document.getElementById('btn-close-inspector');
    if (btnClose) {
      btnClose.onclick = () => this.hide();
    }

    // Keyboard ESC key closes the comparison layout
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.panelEl && this.panelEl.style.display === 'block') {
        this.hide();
      }
    });

    // Pin targeting
    const cardA = document.getElementById('card-pin-a');
    const cardB = document.getElementById('card-pin-b');
    if (cardA) {
      cardA.onclick = (e) => {
        if (e.target.tagName !== 'BUTTON') this.setPinTarget('A');
      };
    }
    if (cardB) {
      cardB.onclick = (e) => {
        if (e.target.tagName !== 'BUTTON') this.setPinTarget('B');
      };
    }

    // Fly to buttons
    const btnFlyA = document.getElementById('btn-fly-a');
    if (btnFlyA) {
      btnFlyA.onclick = () => {
        const pinA = store.state.pins.A;
        if (pinA && this.viewer) {
          this.viewer.camera.flyTo({
            destination: Cesium.Cartesian3.fromDegrees(pinA.lon, pinA.lat, 400000.0),
            duration: 1.5
          });
        }
      };
    }

    const btnFlyB = document.getElementById('btn-fly-b');
    if (btnFlyB) {
      btnFlyB.onclick = () => {
        const pinB = store.state.pins.B;
        if (pinB && this.viewer) {
          this.viewer.camera.flyTo({
            destination: Cesium.Cartesian3.fromDegrees(pinB.lon, pinB.lat, 400000.0),
            duration: 1.5
          });
        }
      };
    }

    // Clear pins
    const btnClear = document.getElementById('btn-clear-pins');
    if (btnClear) {
      btnClear.onclick = () => {
        store.clearPins();
        if (typeof window.clearAllPinEntities === 'function') {
          window.clearAllPinEntities();
        }
        this.hide();
      };
    }

    // Audio Playback Buttons
    const btnFireBoth = document.getElementById('btn-fire-both');
    if (btnFireBoth) {
      btnFireBoth.onclick = async () => {
        const { pins, year } = store.state;
        if (!pins.A || !pins.B) return;
        await sonificationEngine.playPinFireBoth(pins.A, pins.B, this.heatLayer, year);
      };
    }

    const btnSoloA = document.getElementById('btn-fire-solo-a');
    if (btnSoloA) {
      btnSoloA.onclick = async () => {
        const { pins, year } = store.state;
        if (!pins.A) return;
        await sonificationEngine.playPinFireA(pins.A, this.heatLayer, year);
      };
    }

    const btnSoloB = document.getElementById('btn-fire-solo-b');
    if (btnSoloB) {
      btnSoloB.onclick = async () => {
        const { pins, year } = store.state;
        if (!pins.B) return;
        await sonificationEngine.playPinFireB(pins.B, this.heatLayer, year);
      };
    }

    // Sonification Drawer Toggle
    const btnToggleSound = document.getElementById('btn-toggle-sound-drawer');
    const soundContent = document.getElementById('sound-drawer-content');
    const chevron = document.getElementById('chevron-sound-drawer');
    if (btnToggleSound && soundContent) {
      btnToggleSound.onclick = () => {
        const isExp = btnToggleSound.getAttribute('aria-expanded') === 'true';
        btnToggleSound.setAttribute('aria-expanded', !isExp);
        soundContent.style.display = isExp ? 'none' : 'flex';
        if (chevron) chevron.style.transform = isExp ? 'rotate(0deg)' : 'rotate(180deg)';
      };
    }

    // Sonification Modes (Blend / Notes / Heat)
    const mBlend = document.getElementById('mode-btn-blend');
    const mNotes = document.getElementById('mode-btn-notes');
    const mFire = document.getElementById('mode-btn-fire');
    const setMode = (mode) => {
      sonificationEngine.soundMode = mode;
      [mBlend, mNotes, mFire].forEach(b => b && b.classList.remove('is-active'));
      if (mode === 'blend' && mBlend) mBlend.classList.add('is-active');
      if (mode === 'notes' && mNotes) mNotes.classList.add('is-active');
      if (mode === 'fire' && mFire) mFire.classList.add('is-active');
    };
    if (mBlend) mBlend.onclick = () => setMode('blend');
    if (mNotes) mNotes.onclick = () => setMode('notes');
    if (mFire) mFire.onclick = () => setMode('fire');

    // Audio state listener
    sonificationEngine.onPinAudioState = (state) => {
      this.isPlaying = state.active;
    };

    // Store subscription
    store.subscribe((changedKeys) => {
      if (changedKeys.includes('pins') || changedKeys.includes('year') || changedKeys.includes('month')) {
        this.update();
      }
    });
  }

  show() {
    if (this.panelEl) this.panelEl.style.display = 'block';
  }

  hide() {
    if (this.panelEl) this.panelEl.style.display = 'none';
    sonificationEngine.stopPinFire();
  }

  setPinTarget(target) {
    this.activeTarget = target;
    const cardA = document.getElementById('card-pin-a');
    const cardB = document.getElementById('card-pin-b');
    if (cardA) cardA.style.borderColor = target === 'A' ? 'var(--cmp-pin-a)' : 'rgba(34, 211, 238, 0.3)';
    if (cardB) cardB.style.borderColor = target === 'B' ? 'var(--cmp-pin-b)' : 'rgba(251, 191, 36, 0.3)';
  }

  async update() {
    const { pins, year } = store.state;
    const distChip = document.getElementById('compare-dist');

    // Only display when at least one pin is set
    if (!pins.A && !pins.B) {
      this.hide();
      if (distChip) distChip.style.display = 'none';
      return;
    }

    this.show();

    // 1. Distance Calculation (shown when both pins are set)
    if (pins.A && pins.B) {
      const geodesic = new Cesium.EllipsoidGeodesic(pins.A.cartographic, pins.B.cartographic);
      const km = Math.round(geodesic.surfaceDistance / 1000);
      const miles = Math.round(km * 0.621371);
      if (distChip) {
        distChip.textContent = `${km.toLocaleString()} km · ${miles.toLocaleString()} mi`;
        distChip.style.display = 'inline-block';
      }
    } else {
      if (distChip) distChip.style.display = 'none';
    }

    // 2. Disambiguate Header Names if both resolve to the same place
    let nameA = pins.A ? (pins.A.name || 'Selected location') : 'Select location';
    let nameB = pins.B ? (pins.B.name || 'Selected location') : 'Select location';

    if (pins.A && pins.B && nameA === nameB && nameA !== 'Select location') {
      nameA = `${nameA} (${Math.abs(pins.A.lat).toFixed(1)}°, ${Math.abs(pins.A.lon).toFixed(1)}°)`;
      nameB = `${nameB} (${Math.abs(pins.B.lat).toFixed(1)}°, ${Math.abs(pins.B.lon).toFixed(1)}°)`;
    }

    // Render Pin A Left Card
    if (pins.A) {
      document.getElementById('pin-a-header-title').textContent = nameA;
      document.getElementById('pin-a-coords').textContent = `${Math.abs(pins.A.lat).toFixed(2)}° ${pins.A.lat >= 0 ? 'N' : 'S'}, ${Math.abs(pins.A.lon).toFixed(2)}° ${pins.A.lon >= 0 ? 'E' : 'W'}`;
      this.renderSatelliteThumbnail('canvas-sat-a', pins.A.lat, pins.A.lon, '#22d3ee');
      this.fetchAndRenderMetrics('A', pins.A.lat, pins.A.lon, year);
    } else {
      document.getElementById('pin-a-header-title').textContent = 'Select location';
      document.getElementById('pin-a-coords').textContent = '—';
      this.resetCardUI('A');
    }

    // Render Pin B Right Card
    if (pins.B) {
      document.getElementById('pin-b-header-title').textContent = nameB;
      document.getElementById('pin-b-coords').textContent = `${Math.abs(pins.B.lat).toFixed(2)}° ${pins.B.lat >= 0 ? 'N' : 'S'}, ${Math.abs(pins.B.lon).toFixed(2)}° ${pins.B.lon >= 0 ? 'E' : 'W'}`;
      this.renderSatelliteThumbnail('canvas-sat-b', pins.B.lat, pins.B.lon, '#fbbf24');
      this.fetchAndRenderMetrics('B', pins.B.lat, pins.B.lon, year);
    } else {
      document.getElementById('pin-b-header-title').textContent = 'Select location';
      document.getElementById('pin-b-coords').textContent = '—';
      this.resetCardUI('B');
    }
  }

  async fetchAndRenderMetrics(col, lat, lon, year) {
    const c = col.toLowerCase();
    const tileTemp = document.getElementById(`tile-temp-${c}`);
    const tileHum = document.getElementById(`tile-hum-${c}`);
    const tileRain = document.getElementById(`tile-rain-${c}`);
    const tileNdvi = document.getElementById(`tile-ndvi-${c}`);

    // Skeleton loaders
    [tileTemp, tileHum, tileRain, tileNdvi].forEach(t => t && t.classList.add('skeleton-shimmer'));

    const data = await fetchLocationClimate(lat, lon, year, this.heatLayer);
    if (col === 'A') this.climateDataA = data;
    else this.climateDataB = data;

    // Remove skeleton loaders
    [tileTemp, tileHum, tileRain, tileNdvi].forEach(t => t && t.classList.remove('skeleton-shimmer'));

    // 1. TEMPERATURE (°C)
    const valTemp = document.getElementById(`val-temp-${c}`);
    if (valTemp) {
      valTemp.textContent = (data.temp !== null) ? `${data.temp.toFixed(1)}°C` : '—';
    }

    // 2. HUMIDITY (%)
    const valHum = document.getElementById(`val-hum-${c}`);
    if (valHum) {
      valHum.textContent = (data.humidity !== null) ? `${data.humidity}%` : '—';
    }

    // 3. RAINFALL (mm)
    const valRain = document.getElementById(`val-rain-${c}`);
    if (valRain) {
      valRain.textContent = (data.rainfall !== null) ? `${data.rainfall} mm` : '—';
    }

    // 4. VEGETATION INDEX (NDVI 0-1) — If unavailable, show "N/A"
    const valNdvi = document.getElementById(`val-ndvi-${c}`);
    if (valNdvi) {
      valNdvi.textContent = (data.ndvi !== null) ? data.ndvi.toFixed(2) : 'N/A';
    }

    // Two Mini Sparklines:
    // (a) Temperature history 1850 to selected year
    this.renderTemperatureSparkline(`spark-temp-${c}`, data.tempHistory, col === 'A' ? '#22d3ee' : '#fbbf24');
    // (b) Monthly rainfall trend
    this.renderRainfallSparkline(`spark-rain-${c}`, data.monthlyRain, col === 'A' ? '#22d3ee' : '#fbbf24');

    // Small 12-Bar Monthly Chart
    this.render12MonthBarChart(`bars-${c}`, data.monthlyRain, col === 'A' ? '#22d3ee' : '#fbbf24');

    // Waveform Note & Frequency
    const met = sonificationEngine.getFireMetrics(data.temp !== null ? data.temp : 15);
    const waveNote = document.getElementById(`wave-note-${c}`);
    const waveFreq = document.getElementById(`wave-freq-${c}`);
    if (waveNote) waveNote.textContent = met.note || '—';
    if (waveFreq) waveFreq.textContent = `${Math.round(met.noteFreq)} Hz`;

    // Update Delta Strip
    this.updateDeltaStrip();
  }

  updateDeltaStrip() {
    const a = this.climateDataA;
    const b = this.climateDataB;
    const dTemp = document.getElementById('delta-val-temp');
    const dHum = document.getElementById('delta-val-hum');
    const dRain = document.getElementById('delta-val-rain');
    const dNdvi = document.getElementById('delta-val-ndvi');

    if (!a || !b) {
      [dTemp, dHum, dRain, dNdvi].forEach(el => {
        if (el) { el.textContent = '—'; el.className = 'cmp-delta-val is-neutral'; }
      });
      return;
    }

    // Temperature Delta (B - A): Warmer = red/orange, Cooler = blue
    if (a.temp !== null && b.temp !== null) {
      const diff = parseFloat((b.temp - a.temp).toFixed(1));
      const isWarm = diff > 0;
      const isCool = diff < 0;
      dTemp.textContent = `${diff > 0 ? '▲ +' : (diff < 0 ? '▼ ' : '')}${Math.abs(diff)}°C`;
      dTemp.className = `cmp-delta-val ${isWarm ? 'is-warm' : (isCool ? 'is-cool' : 'is-neutral')}`;
    } else {
      dTemp.textContent = '—';
      dTemp.className = 'cmp-delta-val is-neutral';
    }

    // Humidity Delta: Higher = red/orange, Lower = blue
    if (a.humidity !== null && b.humidity !== null) {
      const diff = b.humidity - a.humidity;
      dHum.textContent = `${diff > 0 ? '▲ +' : (diff < 0 ? '▼ ' : '')}${Math.abs(diff)}%`;
      dHum.className = `cmp-delta-val ${diff > 0 ? 'is-warm' : (diff < 0 ? 'is-cool' : 'is-neutral')}`;
    } else {
      dHum.textContent = '—';
      dHum.className = 'cmp-delta-val is-neutral';
    }

    // Rainfall Delta: Higher = red/orange, Lower = blue
    if (a.rainfall !== null && b.rainfall !== null) {
      const diff = b.rainfall - a.rainfall;
      dRain.textContent = `${diff > 0 ? '▲ +' : (diff < 0 ? '▼ ' : '')}${Math.abs(diff)} mm`;
      dRain.className = `cmp-delta-val ${diff > 0 ? 'is-warm' : (diff < 0 ? 'is-cool' : 'is-neutral')}`;
    } else {
      dRain.textContent = '—';
      dRain.className = 'cmp-delta-val is-neutral';
    }

    // NDVI Delta: Higher = red/orange, Lower = blue
    if (a.ndvi !== null && b.ndvi !== null) {
      const diff = parseFloat((b.ndvi - a.ndvi).toFixed(2));
      dNdvi.textContent = `${diff > 0 ? '▲ +' : (diff < 0 ? '▼ ' : '')}${Math.abs(diff)}`;
      dNdvi.className = `cmp-delta-val ${diff > 0 ? 'is-warm' : (diff < 0 ? 'is-cool' : 'is-neutral')}`;
    } else {
      dNdvi.textContent = '—';
      dNdvi.className = 'cmp-delta-val is-neutral';
    }
  }

  renderSatelliteThumbnail(canvasId, lat, lon, pinColor) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;

    // Zoom level ~5 Esri World Imagery tile
    const zoom = 5;
    const x = Math.floor((lon + 180) / 360 * Math.pow(2, zoom));
    const latRad = lat * Math.PI / 180;
    const y = Math.floor((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * Math.pow(2, zoom));
    const tileUrl = `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${zoom}/${y}/${x}`;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      ctx.drawImage(img, 0, 0, w, h);
      // Dark vignette overlay
      const grad = ctx.createRadialGradient(w / 2, h / 2, 12, w / 2, h / 2, w / 2);
      grad.addColorStop(0, 'rgba(0,0,0,0)');
      grad.addColorStop(1, 'rgba(6,12,20,0.6)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      // Central crosshairs & pin marker
      ctx.strokeStyle = 'rgba(255,255,255,0.2)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(w / 2 - 12, h / 2); ctx.lineTo(w / 2 + 12, h / 2);
      ctx.moveTo(w / 2, h / 2 - 12); ctx.lineTo(w / 2, h / 2 + 12);
      ctx.stroke();

      ctx.fillStyle = pinColor;
      ctx.shadowColor = pinColor;
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    };
    img.onerror = () => {
      // Offline fallback: atmospheric radar grid
      ctx.fillStyle = '#061320';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      for (let i = 20; i < w; i += 30) {
        ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, h); ctx.stroke();
      }
      ctx.fillStyle = pinColor;
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, 3.5, 0, Math.PI * 2);
      ctx.fill();
    };
    img.src = tileUrl;
  }

  renderTemperatureSparkline(canvasId, history, color) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;

    ctx.clearRect(0, 0, w, h);
    if (!history || history.length < 2) {
      ctx.fillStyle = 'rgba(255,255,255,0.05)';
      ctx.fillRect(0, 0, w, h);
      return;
    }

    const temps = history.map(d => d.temp);
    const minT = Math.min(...temps);
    const maxT = Math.max(...temps);
    const range = Math.max(0.1, maxT - minT);

    ctx.strokeStyle = color;
    ctx.lineWidth = 1.6;
    ctx.beginPath();

    history.forEach((d, i) => {
      const x = (i / (history.length - 1)) * (w - 4) + 2;
      const y = h - 3 - ((d.temp - minT) / range) * (h - 6);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    ctx.lineTo(w, h);
    ctx.lineTo(0, h);
    ctx.closePath();
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, color === '#22d3ee' ? 'rgba(34, 211, 238, 0.22)' : 'rgba(251, 191, 36, 0.22)');
    grad.addColorStop(1, 'transparent');
    ctx.fillStyle = grad;
    ctx.fill();
  }

  renderRainfallSparkline(canvasId, monthlyRain, color) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;

    ctx.clearRect(0, 0, w, h);
    if (!monthlyRain || monthlyRain.length < 2) {
      ctx.fillStyle = 'rgba(255,255,255,0.05)';
      ctx.fillRect(0, 0, w, h);
      return;
    }

    const maxR = Math.max(1, ...monthlyRain);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.4;
    ctx.beginPath();

    monthlyRain.forEach((r, i) => {
      const x = (i / (monthlyRain.length - 1)) * (w - 4) + 2;
      const y = h - 3 - (r / maxR) * (h - 6);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
  }

  render12MonthBarChart(containerId, monthlyRain, color) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const months = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
    if (!monthlyRain || monthlyRain.length !== 12) {
      container.innerHTML = `<span style="font-size:9px; color:rgba(255,255,255,0.3); margin:auto;">Rainfall data unavailable</span>`;
      return;
    }

    const maxR = Math.max(10, ...monthlyRain);
    const currentMonth = store.state.month ? store.state.month - 1 : 6;

    container.innerHTML = monthlyRain.map((val, idx) => {
      const pct = Math.min(100, Math.max(8, Math.round((val / maxR) * 100)));
      const isCur = (idx === currentMonth);
      return `
        <div class="cmp-bar-item" title="${val} mm">
          <div class="cmp-bar-rect" style="height:${pct}%; background:${isCur ? '#ffffff' : color}; opacity:${isCur ? 1 : 0.65};"></div>
          <span class="cmp-bar-month-lbl" style="${isCur ? 'color:#ffffff; font-weight:700;' : ''}">${months[idx]}</span>
        </div>
      `;
    }).join('');
  }

  resetCardUI(col) {
    const c = col.toLowerCase();
    ['temp', 'hum', 'rain', 'ndvi'].forEach(m => {
      const el = document.getElementById(`val-${m}-${c}`);
      if (el) el.textContent = '—';
    });
    const waveNote = document.getElementById(`wave-note-${c}`);
    const waveFreq = document.getElementById(`wave-freq-${c}`);
    if (waveNote) waveNote.textContent = '—';
    if (waveFreq) waveFreq.textContent = '—';
  }

  startWaveformLoop() {
    const canvasA = document.getElementById('canvas-wave-a');
    const canvasB = document.getElementById('canvas-wave-b');
    const canvasCombo = document.getElementById('canvas-wave-combo');
    let phase = 0;

    const render = () => {
      phase += 0.05;

      const analyser = sonificationEngine ? sonificationEngine.analyserNode : null;
      let hasRealAudio = false;

      if (this.isPlaying && analyser) {
        analyser.getByteTimeDomainData(this.timeDomainBuffer);
        hasRealAudio = true;
      }

      // Draw Waveform Pin A
      if (canvasA) {
        const freqA = (this.climateDataA && this.climateDataA.temp !== null) ? sonificationEngine.getFireMetrics(this.climateDataA.temp).noteFreq : 262;
        this.drawWave(canvasA, '#22d3ee', hasRealAudio, freqA, phase, 0);
      }

      // Draw Waveform Pin B
      if (canvasB) {
        const freqB = (this.climateDataB && this.climateDataB.temp !== null) ? sonificationEngine.getFireMetrics(this.climateDataB.temp).noteFreq : 330;
        this.drawWave(canvasB, '#fbbf24', hasRealAudio, freqB, phase, 1.2);
      }

      // Draw Combined Waveform
      if (canvasCombo) {
        this.drawComboWave(canvasCombo, hasRealAudio, phase);
      }

      this.animFrameId = requestAnimationFrame(render);
    };

    if (!this.animFrameId) {
      this.animFrameId = requestAnimationFrame(render);
    }
  }

  drawWave(canvas, color, hasRealAudio, freq, phase, phaseOffset) {
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;

    ctx.clearRect(0, 0, w, h);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.8;
    ctx.beginPath();

    if (hasRealAudio) {
      const len = this.timeDomainBuffer.length;
      for (let i = 0; i < len; i++) {
        const v = this.timeDomainBuffer[i] / 128.0;
        const y = (v * h) / 2;
        const x = (i / len) * w;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
    } else {
      // Clean static preview sine wave matching tone pitch
      const cycles = Math.max(2, Math.min(8, Math.round(freq / 65)));
      for (let x = 0; x < w; x += 2) {
        const normX = x / w;
        const y = h / 2 + Math.sin(normX * Math.PI * 2 * cycles + phase + phaseOffset) * (h * 0.32);
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
    }
    ctx.stroke();
  }

  drawComboWave(canvas, hasRealAudio, phase) {
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;

    ctx.clearRect(0, 0, w, h);
    ctx.beginPath();

    const grad = ctx.createLinearGradient(0, 0, w, 0);
    grad.addColorStop(0, '#22d3ee');
    grad.addColorStop(1, '#fbbf24');
    ctx.strokeStyle = grad;
    ctx.lineWidth = 2.0;

    if (hasRealAudio) {
      const len = this.timeDomainBuffer.length;
      for (let i = 0; i < len; i++) {
        const v = this.timeDomainBuffer[i] / 128.0;
        const y = (v * h) / 2;
        const x = (i / len) * w;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
    } else {
      const fA = (this.climateDataA && this.climateDataA.temp !== null) ? sonificationEngine.getFireMetrics(this.climateDataA.temp).noteFreq : 262;
      const fB = (this.climateDataB && this.climateDataB.temp !== null) ? sonificationEngine.getFireMetrics(this.climateDataB.temp).noteFreq : 330;
      const cA = Math.max(2, Math.round(fA / 80));
      const cB = Math.max(2, Math.round(fB / 80));

      for (let x = 0; x < w; x += 2) {
        const normX = x / w;
        const wA = Math.sin(normX * Math.PI * 2 * cA + phase);
        const wB = Math.sin(normX * Math.PI * 2 * cB + phase * 1.15);
        const y = h / 2 + ((wA + wB) / 2) * (h * 0.35);
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
    }
    ctx.stroke();
  }
}
