// ============================================================================
// src/commands.js — Natural Language Command & Voice Intent Parser
// ============================================================================

import { store } from './store.js';
import { layerRegistry } from './layerRegistry.js';
import { sonificationEngine } from './sonification.js';

export class CommandProcessor {
  constructor(viewer, onToast) {
    this.viewer = viewer;
    this.onToast = onToast || console.log;
    this.llmEndpoint = null; // Clear hook to plug in Gemini / OpenAI API
  }

  /**
   * Set custom LLM endpoint or API hook
   */
  setLLMHook(endpointFn) {
    this.llmEndpoint = endpointFn;
  }

  /**
   * Main entry point to process a voice or text command
   */
  async execute(input) {
    if (!input || !input.trim()) return;
    const text = input.trim();

    // If an external LLM hook is provided, delegate to it
    if (this.llmEndpoint) {
      try {
        const intent = await this.llmEndpoint(text);
        if (intent) {
          this.applyIntent(intent);
          return;
        }
      } catch (err) {
        console.warn('[Commands] LLM hook failed, falling back to rule parser:', err);
      }
    }

    // Default fast local keyword & regex intent parser
    const intent = this.parseRuleBased(text);
    this.applyIntent(intent, text);
  }

  /**
   * Fast rule-based intent parsing
   */
  parseRuleBased(raw) {
    const text = raw.toLowerCase();

    // 1. Reset / Remove Everything
    if (text.includes('remove everything') || text.includes('reset') || text.includes('clear all') ||
        text.includes('default view') || text.includes('satellite view') || text === 'clear') {
      return { action: 'RESET' };
    }

    // Fire Sonification & Binaural Ear Commands
    if (text.includes('pin a') && (text.includes('left') || text.includes('hear') || text.includes('listen') || text.includes('sound') || text.includes('fire'))) {
      return { action: 'FIRE_PIN_A' };
    }
    if (text.includes('pin b') && (text.includes('right') || text.includes('hear') || text.includes('listen') || text.includes('sound') || text.includes('fire'))) {
      return { action: 'FIRE_PIN_B' };
    }
    if (text.includes('stop fire') || text.includes('silence fire')) {
      return { action: 'FIRE_STOP' };
    }
    if (text.includes('loop fire')) {
      return { action: 'FIRE_LOOP' };
    }
    if (text.includes('fire') && (text.includes('compare') || text.includes('both') || text.includes('ear') || text.includes('binaural'))) {
      return { action: 'FIRE_BOTH' };
    }

    // Audio / Sonification commands
    if (text.includes('play sound') || text.includes('turn on sound') || text.includes('sound on') ||
        text.includes('start audio') || text.includes('sonify') || text.includes('sonification') ||
        text.includes('audio on') || text.includes('enable sound') || text.includes('unmute')) {
      return { action: 'AUDIO_PLAY' };
    }
    if (text.includes('mute sound') || text.includes('turn off sound') || text.includes('sound off') ||
        text.includes('stop audio') || text.includes('stop sound') || text.includes('mute audio') ||
        text.includes('disable sound')) {
      return { action: 'AUDIO_PAUSE' };
    }

    // 2. Hide / Remove specific layers
    if (text.includes('hide heat') || text.includes('remove heat') || text.includes('turn off heat')) {
      return { action: 'DISABLE_LAYER', layer: 'heat' };
    }
    if (text.includes('hide rain') || text.includes('remove rain')) {
      return { action: 'DISABLE_LAYER', layer: 'rainfall' };
    }
    if (text.includes('hide wind') || text.includes('remove wind')) {
      return { action: 'DISABLE_LAYER', layer: 'wind' };
    }
    if (text.includes('hide ocean') || text.includes('remove ocean')) {
      return { action: 'DISABLE_LAYER', layer: 'ocean' };
    }
    if (text.includes('hide tide') || text.includes('remove tide')) {
      return { action: 'DISABLE_LAYER', layer: 'tides' };
    }
    if (text.includes('hide plate') || text.includes('remove plate')) {
      return { action: 'DISABLE_LAYER', layer: 'plates' };
    }

    // 3. Multi-layer compound commands: "add wind and ocean currents"
    const hasWind = text.includes('wind');
    const hasOcean = text.includes('ocean');
    const hasHeat = text.includes('heat') || text.includes('temperature') || text.includes('warming');
    const hasRain = text.includes('rain') || text.includes('precipitation');
    const hasPlates = text.includes('plate') || text.includes('tectonic');
    const hasTides = text.includes('tide');

    // Extract potential year (1850 to 2025)
    let year = null;
    const yearMatch = text.match(/\b(18[5-9]\d|19\d\d|20[0-2]\d)\b/);
    if (yearMatch) year = parseInt(yearMatch[1], 10);

    // Extract location queries like "tides near Visakhapatnam", "heat map of india"
    let locationQuery = null;
    const locMatch = text.match(/(?:near|in|of|at|around)\s+([a-zA-Z\s]+)/i);
    if (locMatch) locationQuery = locMatch[1].trim();

    // Compound layers
    if ((hasWind && hasOcean) || (hasWind && hasPlates) || (hasOcean && hasPlates)) {
      return {
        action: 'MULTI_LAYERS',
        layers: [
          hasWind ? 'wind' : null,
          hasOcean ? 'ocean' : null,
          hasPlates ? 'plates' : null,
          hasTides ? 'tides' : null
        ].filter(Boolean)
      };
    }

    // Single layer triggers
    if (hasHeat) return { action: 'ENABLE_LAYER', layer: 'heat', year };
    if (hasRain) return { action: 'ENABLE_LAYER', layer: 'rainfall' };
    if (hasWind) return { action: 'ENABLE_LAYER', layer: 'wind' };
    if (hasOcean) return { action: 'ENABLE_LAYER', layer: 'ocean' };
    if (hasTides) return { action: 'ENABLE_LAYER', layer: 'tides', location: locationQuery };
    if (hasPlates) return { action: 'ENABLE_LAYER', layer: 'plates' };

    // Geocoding place search
    return { action: 'SEARCH_LOCATION', query: raw };
  }

  /**
   * Apply parsed intent to global state and Cesium scene
   */
  async applyIntent(intent, originalText) {
    if (!intent) return;

    switch (intent.action) {
      case 'FIRE_PIN_A': {
        const heat = layerRegistry.get('heat');
        if (store.state.pins.A && heat) {
          sonificationEngine.playPinFireA(store.state.pins.A, heat, store.state.year);
          this.onToast('🔥 Playing Pin A Fire in LEFT EAR ONLY (Right Ear silent)');
        } else {
          this.onToast('Place Pin A on the globe first');
        }
        break;
      }

      case 'FIRE_PIN_B': {
        const heat = layerRegistry.get('heat');
        if (store.state.pins.B && heat) {
          sonificationEngine.playPinFireB(store.state.pins.B, heat, store.state.year);
          this.onToast('🔥 Playing Pin B Fire in RIGHT EAR ONLY (Left Ear silent)');
        } else {
          this.onToast('Place Pin B on the globe first');
        }
        break;
      }

      case 'FIRE_BOTH': {
        const heat = layerRegistry.get('heat');
        if (store.state.pins.A && store.state.pins.B && heat) {
          sonificationEngine.playPinFireBoth(store.state.pins.A, store.state.pins.B, heat, store.state.year);
          this.onToast('🔥 Comparing Both: Pin A (Left Ear) vs Pin B (Right Ear)');
        } else {
          this.onToast('Place both Pin A and Pin B first to compare fire');
        }
        break;
      }

      case 'FIRE_LOOP': {
        const heat = layerRegistry.get('heat');
        if (store.state.pins.A && store.state.pins.B && heat) {
          sonificationEngine.toggleLoopPinFire(store.state.pins.A, store.state.pins.B, heat, store.state.year);
          this.onToast('🔁 Looping Fire Comparison: Left Ear = Pin A | Right Ear = Pin B');
        } else {
          this.onToast('Place both Pin A and Pin B to start continuous loop');
        }
        break;
      }

      case 'FIRE_STOP':
        sonificationEngine.stopPinFire();
        this.onToast('⏹ Fire audio stopped');
        break;

      case 'AUDIO_PLAY':
        sonificationEngine.play();
        this.onToast('🔊 Heat Map Sonification Playing');
        break;

      case 'AUDIO_PAUSE':
        sonificationEngine.pause();
        this.onToast('🔈 Sonification Muted');
        break;

      case 'RESET':
        store.resetAllLayers();
        this.onToast('Reset to Default Satellite View (All layers removed)');
        break;

      case 'ENABLE_LAYER':
        if (intent.layer === 'heat') {
          store.setRasterLayer('heat');
          if (intent.year) store.setYear(intent.year);
          this.onToast(`Heat Map Active (${store.state.year})`);
        } else if (intent.layer === 'rainfall') {
          store.setRasterLayer('rainfall');
          this.onToast('Rainfall & Precipitation Active (Month ' + store.state.month + ')');
        } else {
          store.toggleOverlay(intent.layer, true);
          this.onToast(`Enabled ${intent.layer} layer`);
        }

        if (intent.location && this.viewer) {
          await this.geocodeAndFly(intent.location);
        }
        break;

      case 'DISABLE_LAYER':
        if (store.state.activeRasterLayer === intent.layer) {
          store.setRasterLayer(null);
        } else {
          store.toggleOverlay(intent.layer, false);
        }
        this.onToast(`Disabled ${intent.layer} layer`);
        break;

      case 'MULTI_LAYERS':
        for (const l of intent.layers) {
          store.toggleOverlay(l, true);
        }
        this.onToast(`Active layers: ${intent.layers.join(', ')}`);
        break;

      case 'SEARCH_LOCATION':
        this.onToast(`Searching for "${intent.query}"...`);
        await this.geocodeAndFly(intent.query);
        break;
    }
  }

  async geocodeAndFly(query) {
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`, {
        headers: { 'Accept': 'application/json' }
      });
      if (res.ok) {
        const list = await res.json();
        if (list && list.length > 0) {
          const lat = parseFloat(list[0].lat);
          const lon = parseFloat(list[0].lon);
          this.viewer.camera.flyTo({
            destination: Cesium.Cartesian3.fromDegrees(lon, lat, 450000.0),
            duration: 1.8
          });
          this.onToast(`Flew to ${list[0].display_name.split(',')[0]}`);
          return;
        }
      }
    } catch (e) {
      console.warn('[Commands] Geocoding error:', e);
    }
    this.onToast(`Could not find "${query}"`);
  }
}
