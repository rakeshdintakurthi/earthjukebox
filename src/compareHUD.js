// ============================================================================
// src/compareHUD.js — CompareHUD Component for Thermophone Earth (Phase 1)
// Two-sided comparison layout with cards docked to left and right edges.
// Middle ~50% pointer-events pass-through keeps globe interactive.
// Static placeholder data clearly marked for Phase 1 visual verification.
// ============================================================================

import { store } from './store.js';
import { sonificationEngine } from './sonification.js';

export class CompareHUD {
  constructor(viewer, heatLayer, rainfallLayer) {
    this.viewer = viewer;
    this.heatLayer = heatLayer;
    this.rainfallLayer = rainfallLayer;
    this.isVisible = false; // Hidden initially; only appears after pin points are selected
    this.sonifyDrawerOpen = false;
    this.activeSonifyMode = 'blend'; // 'blend' | 'notes' | 'heat'

    // Mount to DOM
    this.mount();
    this.bindEvents();
    this.subscribeToStore();

    // Initial sync: hide all cards and HUD if no pins selected
    this.updateFromPins(store.state.pins);

    // Ensure legacy inspector panel is hidden
    const legacy = document.getElementById('inspector-panel');
    if (legacy) {
      legacy.style.setProperty('display', 'none', 'important');
    }
  }

  mount() {
    // If already mounted, remove first
    const existing = document.getElementById('hud-compare-root');
    if (existing) existing.remove();

    const root = document.createElement('div');
    root.id = 'hud-compare-root';
    root.className = 'hud-root hud-hidden'; // Start hidden
    root.style.display = 'none'; // Explicitly hidden until pin points are selected
    root.setAttribute('role', 'region');
    root.setAttribute('aria-label', 'Earth Location Comparison HUD');

    root.innerHTML = `
      <!-- Top Center Header & Delta Strip -->
      <header class="hud-title-container">
        <div class="hud-title-bar">
          <span class="hud-title-text">LOCATION COMPARISON</span>
          <span class="hud-dist-chip" id="hud-dist-chip">2,840 km (placeholder)</span>
          <button class="hud-close-btn" id="hud-btn-close" title="Close HUD (ESC)" aria-label="Close Comparison">✕</button>
        </div>
        <div class="hud-delta-strip" id="hud-delta-strip">
          <span class="hud-delta-chip delta-warmer">ΔT ▲ 2.4 °C (placeholder)</span>
          <span class="hud-delta-chip delta-cooler">ΔHumidity ▼ 14 % (placeholder)</span>
          <span class="hud-delta-chip delta-cooler">ΔRain ▼ 2,180 mm (placeholder)</span>
          <span class="hud-delta-chip delta-cooler">ΔNDVI ▼ 0.37 (placeholder)</span>
        </div>
      </header>

      <!-- Left Card: Pin A (Cyan #22d3ee) -->
      ${this.renderCard({
        id: 'A',
        sideClass: 'hud-card--a',
        accentColor: '#22d3ee',
        title: 'VIJAYAWADA, INDIA',
        coords: '16.51° N, 80.64° E',
        temp: '28.5 °C',
        humidity: '62 %',
        rainfall: '120 mm',
        ndvi: '0.45',
        note: '262 Hz · C4',
        waveColor: '#22d3ee',
        esriTileMock: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/5/14/23'
      })}

      <!-- Right Card: Pin B (Amber #fbbf24) -->
      ${this.renderCard({
        id: 'B',
        sideClass: 'hud-card--b',
        accentColor: '#fbbf24',
        title: 'AMAZON BASIN, BRAZIL',
        coords: '3.46° S, 62.21° W',
        temp: '26.1 °C',
        humidity: '76 %',
        rainfall: '2,300 mm',
        ndvi: '0.82',
        note: '330 Hz · E4',
        waveColor: '#fbbf24',
        esriTileMock: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/5/16/10'
      })}

      <!-- Bottom Center Controls Bar -->
      <footer class="hud-controls-container">
        <!-- Upward-collapsible sonification drawer -->
        <div class="hud-sonify-drawer drawer-hidden" id="hud-sonify-drawer">
          <div class="hud-sonify-header">
            <span>Audio Sonification Mode</span>
            <span style="font-size: 10px; color: #38bdf8;">Dual Pitch Engine</span>
          </div>
          <div class="hud-segmented-group">
            <button class="hud-segmented-btn active" data-mode="blend">Blend</button>
            <button class="hud-segmented-btn" data-mode="notes">Notes</button>
            <button class="hud-segmented-btn" data-mode="heat">Heat</button>
          </div>
        </div>

        <!-- Main Bar -->
        <div class="hud-controls-bar">
          <button class="hud-btn hud-btn-a" id="hud-btn-play-a" title="Audition Location A sound">
            <span>▶ Play A</span>
          </button>
          <button class="hud-btn hud-btn-primary" id="hud-btn-play-both" title="Audition Stereo Comparison">
            <span>▶ Play both</span>
          </button>
          <button class="hud-btn hud-btn-b" id="hud-btn-play-b" title="Audition Location B sound">
            <span>▶ Play B</span>
          </button>

          <span style="width: 1px; height: 16px; background: rgba(255,255,255,0.15);"></span>

          <!-- Combined Interference Waveform Mock Preview -->
          <div class="hud-combined-wave-box" title="Combined acoustic interference preview (placeholder)">
            <svg viewBox="0 0 96 26" preserveAspectRatio="none">
              <path d="M 0 13 Q 12 2, 24 13 T 48 13 T 72 13 T 96 13" fill="none" stroke="#22d3ee" stroke-width="1.2" opacity="0.8"/>
              <path d="M 0 13 Q 16 23, 32 13 T 64 13 T 96 13" fill="none" stroke="#fbbf24" stroke-width="1.2" opacity="0.8"/>
            </svg>
          </div>

          <span style="width: 1px; height: 16px; background: rgba(255,255,255,0.15);"></span>

          <button class="hud-btn" id="hud-btn-fly-a" title="Fly globe camera to Pin A">Fly to A</button>
          <button class="hud-btn" id="hud-btn-fly-b" title="Fly globe camera to Pin B">Fly to B</button>
          <button class="hud-btn hud-btn-clear" id="hud-btn-clear" title="Clear dropped pins">Clear</button>

          <button class="hud-btn" id="hud-btn-toggle-drawer" title="Toggle audio mode settings">
            <span>Audio Mode ▴</span>
          </button>
        </div>
      </footer>
    `;

    document.body.appendChild(root);
    this.rootEl = root;
  }

  /**
   * Generates identical card structure for Pin A and Pin B
   */
  renderCard(data) {
    const isA = data.id === 'A';
    return `
      <aside class="hud-card ${data.sideClass}" id="hud-card-${data.id.toLowerCase()}" aria-label="Pin ${data.id} details">
        <!-- 4 Corner-bracket accents -->
        <div class="hud-corner-bracket hud-corner-tl"></div>
        <div class="hud-corner-bracket hud-corner-tr"></div>
        <div class="hud-corner-bracket hud-corner-bl"></div>
        <div class="hud-corner-bracket hud-corner-br"></div>

        <!-- 1. Header Strip -->
        <header class="hud-card-header">
          <div class="hud-card-label">
            <span class="hud-card-dot"></span>
            <span>LOCATION ${data.id}: <span class="hud-placeholder-tag">(placeholder)</span></span>
          </div>
          <div class="hud-card-name" id="hud-pin-${data.id.toLowerCase()}-name">${data.title}</div>
          <div class="hud-card-coords" id="hud-pin-${data.id.toLowerCase()}-coords">${data.coords}</div>
        </header>

        <!-- 2. Satellite Thumbnail (Esri World Imagery tile zoom 5) -->
        <div class="hud-satellite-box">
          <img class="hud-satellite-img" src="${data.esriTileMock}" alt="Satellite thumbnail for Location ${data.id}" onerror="this.src='earth_atmos_2048.jpg';">
          <div class="hud-satellite-pin">
            <div class="hud-satellite-pin-dot"></div>
          </div>
          <div class="hud-satellite-badge">Esri World Imagery · Zoom 5</div>
        </div>

        <!-- 3. Four Metric Tiles (2x2 Grid) -->
        <div class="hud-metrics-grid">
          <div class="hud-metric-tile">
            <div class="hud-metric-label">TEMPERATURE (°C)</div>
            <div class="hud-metric-value">${data.temp}</div>
            <div class="hud-placeholder-tag">placeholder</div>
          </div>
          <div class="hud-metric-tile">
            <div class="hud-metric-label">HUMIDITY (%)</div>
            <div class="hud-metric-value">${data.humidity}</div>
            <div class="hud-placeholder-tag">placeholder</div>
          </div>
          <div class="hud-metric-tile">
            <div class="hud-metric-label">RAINFALL (mm)</div>
            <div class="hud-metric-value">${data.rainfall}</div>
            <div class="hud-placeholder-tag">placeholder</div>
          </div>
          <div class="hud-metric-tile">
            <div class="hud-metric-label">VEGETATION (NDVI)</div>
            <div class="hud-metric-value">${data.ndvi}</div>
            <div class="hud-placeholder-tag">placeholder</div>
          </div>
        </div>

        <!-- 4. Two Mini Sparklines Side-by-Side (56px tall) -->
        <div class="hud-sparklines-row">
          <div class="hud-sparkline-box">
            <div class="hud-sparkline-header">
              <span>TEMP 1850–2025</span>
              <span class="hud-placeholder-tag">placeholder</span>
            </div>
            <svg class="hud-sparkline-svg" viewBox="0 0 140 56">
              <path d="${isA ? 'M 0 45 Q 35 40, 70 32 T 140 10' : 'M 0 48 Q 40 44, 80 38 T 140 16'}" fill="none" stroke="${data.accentColor}" stroke-width="2"/>
              <path d="${isA ? 'M 0 45 Q 35 40, 70 32 T 140 10 L 140 56 L 0 56 Z' : 'M 0 48 Q 40 44, 80 38 T 140 16 L 140 56 L 0 56 Z'}" fill="${data.accentColor}" fill-opacity="0.12"/>
            </svg>
          </div>
          <div class="hud-sparkline-box">
            <div class="hud-sparkline-header">
              <span>NDVI / RAIN TREND</span>
              <span class="hud-placeholder-tag">placeholder</span>
            </div>
            <svg class="hud-sparkline-svg" viewBox="0 0 140 56">
              <path d="${isA ? 'M 0 35 Q 30 20, 60 38 T 110 25 T 140 30' : 'M 0 20 Q 35 15, 70 28 T 120 18 T 140 22'}" fill="none" stroke="${data.accentColor}" stroke-width="2"/>
              <path d="${isA ? 'M 0 35 Q 30 20, 60 38 T 110 25 T 140 30 L 140 56 L 0 56 Z' : 'M 0 20 Q 35 15, 70 28 T 120 18 T 140 22 L 140 56 L 0 56 Z'}" fill="${data.accentColor}" fill-opacity="0.12"/>
            </svg>
          </div>
        </div>

        <!-- 5. 12-bar Monthly Chart (64px tall) -->
        <div class="hud-barchart-box">
          <div class="hud-barchart-header">
            <span>MONTHLY CLIMATOLOGY (12 MO)</span>
            <span class="hud-placeholder-tag">placeholder</span>
          </div>
          <svg class="hud-barchart-svg" viewBox="0 0 240 64">
            <!-- 12 Bars (Jan to Dec) -->
            ${this.render12Bars(data.accentColor, isA)}
          </svg>
        </div>

        <!-- 6. Waveform Panel for tone (72px tall) -->
        <div class="hud-waveform-box">
          <div class="hud-waveform-header">
            <span>FREQUENCY & HARMONIC TONE</span>
            <span class="hud-waveform-freq">${data.note} (placeholder)</span>
          </div>
          <svg class="hud-waveform-svg" viewBox="0 0 240 72">
            <path d="${isA ? 'M 0 36 Q 20 6, 40 36 T 80 36 T 120 36 T 160 36 T 200 36 T 240 36' : 'M 0 36 Q 15 10, 30 36 T 60 36 T 90 36 T 120 36 T 150 36 T 180 36 T 210 36 T 240 36'}" fill="none" stroke="${data.accentColor}" stroke-width="2.2"/>
            <line x1="0" y1="36" x2="240" y2="36" stroke="rgba(255,255,255,0.1)" stroke-dasharray="2,3"/>
          </svg>
        </div>
      </aside>
    `;
  }

  /**
   * Helper to render 12 SVG bars for monthly chart
   */
  render12Bars(accentColor, isA) {
    const months = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
    const mockHeightsA = [18, 22, 28, 38, 45, 42, 36, 32, 29, 26, 20, 16];
    const mockHeightsB = [42, 45, 48, 44, 38, 32, 28, 30, 34, 37, 40, 44];
    const heights = isA ? mockHeightsA : mockHeightsB;

    let bars = '';
    const barWidth = 14;
    const gap = 5;
    const startX = 8;

    heights.forEach((h, i) => {
      const x = startX + i * (barWidth + gap);
      const y = 50 - h;
      bars += `
        <rect x="${x}" y="${y}" width="${barWidth}" height="${h}" rx="2" fill="${accentColor}" fill-opacity="0.8"/>
        <text x="${x + barWidth / 2}" y="60" font-size="8" fill="#94a3b8" text-anchor="middle">${months[i]}</text>
      `;
    });
    return bars;
  }

  bindEvents() {
    // Close button
    const closeBtn = document.getElementById('hud-btn-close');
    if (closeBtn) {
      closeBtn.onclick = () => {
        this.toggleVisibility(false);
        if (store.setPinToolActive) {
          store.setPinToolActive(false);
        } else {
          store.state.pinToolActive = false;
        }
        const btnPin = document.getElementById('btn-pin-tool');
        if (btnPin) btnPin.classList.remove('active');
      };
    }

    // ESC key closes HUD
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isVisible) {
        this.toggleVisibility(false);
        if (store.setPinToolActive) {
          store.setPinToolActive(false);
        } else {
          store.state.pinToolActive = false;
        }
        const btnPin = document.getElementById('btn-pin-tool');
        if (btnPin) btnPin.classList.remove('active');
      }
    });

    // Fly to A button
    const flyABtn = document.getElementById('hud-btn-fly-a');
    if (flyABtn) {
      flyABtn.onclick = () => {
        const pinA = store.state.pins.A;
        if (pinA && this.viewer) {
          this.viewer.camera.flyTo({
            destination: Cesium.Cartesian3.fromDegrees(pinA.lon, pinA.lat, 2500000.0),
            duration: 1.5
          });
        }
      };
    }

    // Fly to B button
    const flyBBtn = document.getElementById('hud-btn-fly-b');
    if (flyBBtn) {
      flyBBtn.onclick = () => {
        const pinB = store.state.pins.B;
        if (pinB && this.viewer) {
          this.viewer.camera.flyTo({
            destination: Cesium.Cartesian3.fromDegrees(pinB.lon, pinB.lat, 2500000.0),
            duration: 1.5
          });
        }
      };
    }

    // Clear pins
    const clearBtn = document.getElementById('hud-btn-clear');
    if (clearBtn) {
      clearBtn.onclick = () => {
        if (typeof window.clearAllPinEntities === 'function') {
          window.clearAllPinEntities();
        }
        store.clearPins();
      };
    }

    // Sonification Drawer Toggle
    const drawerToggleBtn = document.getElementById('hud-btn-toggle-drawer');
    const drawerEl = document.getElementById('hud-sonify-drawer');
    if (drawerToggleBtn && drawerEl) {
      drawerToggleBtn.onclick = () => {
        this.sonifyDrawerOpen = !this.sonifyDrawerOpen;
        drawerEl.classList.toggle('drawer-hidden', !this.sonifyDrawerOpen);
        drawerToggleBtn.querySelector('span').textContent = this.sonifyDrawerOpen ? 'Audio Mode ▾' : 'Audio Mode ▴';
      };
    }

    // Audio Playback buttons
    const playABtn = document.getElementById('hud-btn-play-a');
    const playBBtn = document.getElementById('hud-btn-play-b');
    const playBothBtn = document.getElementById('hud-btn-play-both');

    if (playABtn) {
      playABtn.onclick = async () => {
        await this.playA();
      };
    }

    if (playBBtn) {
      playBBtn.onclick = async () => {
        await this.playB();
      };
    }

    if (playBothBtn) {
      playBothBtn.onclick = async () => {
        await this.playBoth();
      };
    }

    // Segmented Sonification Mode buttons
    const segButtons = document.querySelectorAll('.hud-segmented-btn');
    segButtons.forEach(btn => {
      btn.onclick = () => {
        segButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.activeSonifyMode = btn.dataset.mode;
        const mappedMode = (this.activeSonifyMode === 'heat') ? 'fire' : this.activeSonifyMode;
        if (sonificationEngine && sonificationEngine.setSoundMode) {
          sonificationEngine.setSoundMode(mappedMode);
        }
      };
    });
  }

  async playA() {
    const pinA = store.state.pins.A;
    if (!pinA) {
      if (typeof window.showToast === 'function') window.showToast('Please place Pin A on the Earth first');
      return;
    }
    if (!sonificationEngine) return;
    try {
      await sonificationEngine.ensureContextRunning();
      const isRain = (store.state.activeRasterLayer === 'rainfall' || store.state.activeOverlays.has('rainfall'));
      if (isRain && sonificationEngine.playPinRainA) {
        const mmA = this.rainfallLayer ? this.rainfallLayer.query(pinA.lat, pinA.lon, store.state.month || 7) : 0;
        await sonificationEngine.playPinRainA(pinA, this.rainfallLayer, store.state.month || 7);
        if (typeof window.showToast === 'function') {
          window.showToast(`Auditioning Pin A rain in left ear (${mmA.toFixed(1)} mm/day)`);
        }
      } else {
        await sonificationEngine.playPinFireA(pinA, this.heatLayer, store.state.year || 2025);
        if (typeof window.showToast === 'function') {
          window.showToast('Auditioning Pin A tone in left ear');
        }
      }
    } catch (err) {
      console.error('[CompareHUD] Error playing Pin A audio:', err);
    }
  }

  async playB() {
    const pinB = store.state.pins.B;
    if (!pinB) {
      if (typeof window.showToast === 'function') window.showToast('Please place Pin B on the Earth first');
      return;
    }
    if (!sonificationEngine) return;
    try {
      await sonificationEngine.ensureContextRunning();
      const isRain = (store.state.activeRasterLayer === 'rainfall' || store.state.activeOverlays.has('rainfall'));
      if (isRain && sonificationEngine.playPinRainB) {
        const mmB = this.rainfallLayer ? this.rainfallLayer.query(pinB.lat, pinB.lon, store.state.month || 7) : 0;
        await sonificationEngine.playPinRainB(pinB, this.rainfallLayer, store.state.month || 7);
        if (typeof window.showToast === 'function') {
          window.showToast(`Auditioning Pin B rain in right ear (${mmB.toFixed(1)} mm/day)`);
        }
      } else {
        await sonificationEngine.playPinFireB(pinB, this.heatLayer, store.state.year || 2025);
        if (typeof window.showToast === 'function') {
          window.showToast('Auditioning Pin B tone in right ear');
        }
      }
    } catch (err) {
      console.error('[CompareHUD] Error playing Pin B audio:', err);
    }
  }

  async playBoth() {
    const pinA = store.state.pins.A;
    const pinB = store.state.pins.B;

    if (!pinA && !pinB) {
      if (typeof window.showToast === 'function') {
        window.showToast('Place Pin A and Pin B on the Earth to audition stereo comparison');
      }
      return;
    }

    if (pinA && !pinB) {
      if (typeof window.showToast === 'function') {
        window.showToast('Auditioning Pin A. Click Earth to place Pin B for stereo comparison');
      }
      await this.playA();
      return;
    }

    if (!pinA && pinB) {
      if (typeof window.showToast === 'function') {
        window.showToast('Auditioning Pin B. Click Earth to place Pin A for stereo comparison');
      }
      await this.playB();
      return;
    }

    if (!sonificationEngine) return;
    try {
      await sonificationEngine.ensureContextRunning();
      const isRain = (store.state.activeRasterLayer === 'rainfall' || store.state.activeOverlays.has('rainfall'));
      if (isRain && sonificationEngine.playPinRainBoth) {
        await sonificationEngine.playPinRainBoth(pinA, pinB, this.rainfallLayer, store.state.month || 7);
        if (typeof window.showToast === 'function') {
          window.showToast('Comparing rain acoustics: Pin A (Left) vs Pin B (Right)');
        }
      } else {
        await sonificationEngine.playPinFireBoth(pinA, pinB, this.heatLayer, store.state.year || 2025);
        if (typeof window.showToast === 'function') {
          window.showToast('Comparing harmonic tones in stereo: Pin A (Left) vs Pin B (Right)');
        }
      }
    } catch (err) {
      console.error('[CompareHUD] Error playing dual pin audio:', err);
    }
  }

  subscribeToStore() {
    store.subscribe((state, changedKeys) => {
      if (changedKeys.includes('pins')) {
        this.updateFromPins(state.pins);
      }
    });
  }

  updateFromPins(pins) {
    const hasA = Boolean(pins && pins.A);
    const hasB = Boolean(pins && pins.B);

    const cardA = document.getElementById('hud-card-a');
    const cardB = document.getElementById('hud-card-b');
    const titleContainer = document.querySelector('.hud-title-container');
    const controlsContainer = document.querySelector('.hud-controls-container');

    // If neither pin point is selected, hide the entire HUD completely
    if (!hasA && !hasB) {
      this.toggleVisibility(false);
      if (cardA) {
        cardA.classList.remove('card-visible');
        cardA.style.display = 'none';
      }
      if (cardB) {
        cardB.classList.remove('card-visible');
        cardB.style.display = 'none';
      }
      if (titleContainer) {
        titleContainer.classList.remove('title-visible');
        titleContainer.style.display = 'none';
      }
      if (controlsContainer) {
        controlsContainer.classList.remove('controls-visible');
        controlsContainer.style.display = 'none';
      }
      return;
    }

    // At least one pin point has been selected: show HUD root container
    this.toggleVisibility(true);

    // Left Box (Pin A): appears right after Pin A is selected
    if (cardA) {
      if (hasA) {
        cardA.classList.add('card-visible');
        cardA.style.display = 'flex';
        const nameEl = document.getElementById('hud-pin-a-name');
        const coordsEl = document.getElementById('hud-pin-a-coords');
        if (nameEl && pins.A.name) nameEl.textContent = pins.A.name;
        if (coordsEl && pins.A.lat !== undefined) {
          coordsEl.textContent = `${Math.abs(pins.A.lat).toFixed(2)}° ${pins.A.lat >= 0 ? 'N' : 'S'}, ${Math.abs(pins.A.lon).toFixed(2)}° ${pins.A.lon >= 0 ? 'E' : 'W'}`;
        }
      } else {
        cardA.classList.remove('card-visible');
        cardA.style.display = 'none';
      }
    }

    // Right Box (Pin B): appears right after Pin B is selected
    if (cardB) {
      if (hasB) {
        cardB.classList.add('card-visible');
        cardB.style.display = 'flex';
        const nameEl = document.getElementById('hud-pin-b-name');
        const coordsEl = document.getElementById('hud-pin-b-coords');
        if (nameEl && pins.B.name) nameEl.textContent = pins.B.name;
        if (coordsEl && pins.B.lat !== undefined) {
          coordsEl.textContent = `${Math.abs(pins.B.lat).toFixed(2)}° ${pins.B.lat >= 0 ? 'N' : 'S'}, ${Math.abs(pins.B.lon).toFixed(2)}° ${pins.B.lon >= 0 ? 'E' : 'W'}`;
        }
      } else {
        cardB.classList.remove('card-visible');
        cardB.style.display = 'none';
      }
    }

    // Top Comparison Header & Delta Strip appear when both pins are set
    if (titleContainer) {
      if (hasA && hasB) {
        titleContainer.classList.add('title-visible');
        titleContainer.style.display = 'flex';
      } else {
        titleContainer.classList.remove('title-visible');
        titleContainer.style.display = 'none';
      }
    }

    // Bottom Controls Bar appears when at least one pin is set
    if (controlsContainer) {
      controlsContainer.classList.add('controls-visible');
      controlsContainer.style.display = 'flex';
    }

    // Calculate real geodesic distance if both pins are present
    if (hasA && hasB && pins.A.lat !== undefined && pins.B.lat !== undefined) {
      const distKm = this.calculateGeodesicDistance(pins.A.lat, pins.A.lon, pins.B.lat, pins.B.lon);
      const distChip = document.getElementById('hud-dist-chip');
      if (distChip) {
        distChip.textContent = `${Math.round(distKm).toLocaleString()} km`;
      }
    }
  }

  calculateGeodesicDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  toggleVisibility(show) {
    this.isVisible = Boolean(show);
    if (this.rootEl) {
      this.rootEl.classList.toggle('hud-visible', this.isVisible);
      this.rootEl.classList.toggle('hud-hidden', !this.isVisible);
      this.rootEl.style.display = this.isVisible ? 'block' : 'none';
    }
    // Also keep legacy panel hidden
    const legacy = document.getElementById('inspector-panel');
    if (legacy) {
      legacy.style.setProperty('display', 'none', 'important');
    }
  }
}
