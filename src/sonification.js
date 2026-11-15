// ============================================================================
// src/sonification.js — Thermophone Planetary Fire & Musical Sonification Engine
// Procedural Fire Acoustics + Resonant Musical Chime Nodes across Temperatures
// - Musical Pentatonic Scale (C2 to C6) mapped across temperatures
// - Generates 4-note Melodic Musical Nodes (Arpeggios) per pin
// - Cool Places: Frequency is TOO LOW (65 Hz to 200 Hz sub-bass, deep slow pitch ~0.45x)
// - Hot Places: Frequency is HIGH (6,000 Hz to 13,500 Hz bright sizzle, fast high pitch ~1.9x)
// - Sound Modes: 'blend' (Fire + Musical Notes), 'notes' (Musical Notes only), 'fire' (Fire only)
// - Strict Ear Separation: Left Ear (Pin A), Right Ear (Pin B)
// ============================================================================

export const PENTATONIC_SCALE = [
  { note: 'C2', freq: 65.41 },
  { note: 'D2', freq: 73.42 },
  { note: 'E2', freq: 82.41 },
  { note: 'G2', freq: 98.00 },
  { note: 'A2', freq: 110.00 },
  { note: 'C3', freq: 130.81 },
  { note: 'D3', freq: 146.83 },
  { note: 'E3', freq: 164.81 },
  { note: 'G3', freq: 196.00 },
  { note: 'A3', freq: 220.00 },
  { note: 'C4', freq: 261.63 },
  { note: 'D4', freq: 293.66 },
  { note: 'E4', freq: 329.63 },
  { note: 'G4', freq: 392.00 },
  { note: 'A4', freq: 440.00 },
  { note: 'C5', freq: 523.25 },
  { note: 'D5', freq: 587.33 },
  { note: 'E5', freq: 659.25 },
  { note: 'G5', freq: 783.99 },
  { note: 'A5', freq: 880.00 },
  { note: 'C6', freq: 1046.50 }
];

export class SonificationEngine {
  constructor() {
    this.audioCtx = null;
    this.audioBuffer = null;
    this.sourceNode = null;
    this.filterNode = null;
    this.shaperNode = null;
    this.masterGain = null;
    this.analyserNode = null;

    // Pin comparison active voices
    this.activePinSources = [];
    this.activeMusicalVoices = [];
    this.isPinLooping = false;
    this.currentPinLoopTimer = null;

    // Sound Mode: 'blend' (Fire + Notes), 'notes' (Notes only), 'fire' (Fire only)
    this.soundMode = 'blend';

    this.isPlaying = false;
    this.isMuted = false;
    this.volume = 0.85;
    this.currentYear = 2025;
    this.globalAnomaly = 0.86;
    this.globalTemp = 6.2;
    this.isLoaded = false;
    this.audioUrl = 'audio_sample.mp3';

    // Rain sound layer
    this.rainBuffer = null;
    this.rainAudioUrl = 'rain_sample.mp3';
    this.isRainLoaded = false;

    // Callbacks for UI updates
    this.onStateChange = null;
    this.onPinAudioState = null;
  }

  /**
   * Set active sound mode: 'blend' | 'notes' | 'fire'
   */
  setSoundMode(mode) {
    if (['blend', 'notes', 'fire'].includes(mode)) {
      this.soundMode = mode;
      console.log('[Sonification] Switched Sound Mode to:', mode);
    }
  }

  /**
   * Map temperature to primary musical scale note
   */
  tempToMusicalNote(temp) {
    const norm = Math.max(0.0, Math.min(1.0, (temp + 35) / 85));
    const idx = Math.min(PENTATONIC_SCALE.length - 1, Math.floor(norm * PENTATONIC_SCALE.length));
    return PENTATONIC_SCALE[idx];
  }

  /**
   * Generate 4-note harmonic musical nodes (chord arpeggio progression) from temperature
   */
  generateMusicalNodes(temp) {
    const norm = Math.max(0.0, Math.min(1.0, (temp + 35) / 85));
    const baseIdx = Math.min(PENTATONIC_SCALE.length - 4, Math.floor(norm * (PENTATONIC_SCALE.length - 3)));
    return [
      PENTATONIC_SCALE[baseIdx],
      PENTATONIC_SCALE[Math.min(PENTATONIC_SCALE.length - 1, baseIdx + 1)],
      PENTATONIC_SCALE[Math.min(PENTATONIC_SCALE.length - 1, baseIdx + 2)],
      PENTATONIC_SCALE[Math.min(PENTATONIC_SCALE.length - 1, baseIdx + 3)]
    ];
  }

  /**
   * Compute musical interval name between two frequencies
   */
  getMusicalInterval(freq1, freq2) {
    if (!freq1 || !freq2) return '—';
    const fLow = Math.min(freq1, freq2);
    const fHigh = Math.max(freq1, freq2);
    if (fLow <= 0) return '—';
    const semitones = Math.round(12 * Math.log2(fHigh / fLow));
    const intervals = [
      'Unison', 'Minor 2nd', 'Major 2nd', 'Minor 3rd', 'Major 3rd',
      'Perfect 4th', 'Tritone', 'Perfect 5th', 'Minor 6th', 'Major 6th',
      'Minor 7th', 'Major 7th', 'Octave',
      'Minor 9th', 'Major 9th', 'Minor 10th', 'Major 10th', '11th',
      'Augmented 11th', '12th (Octave + 5th)', 'Minor 13th', 'Major 13th',
      'Minor 14th', 'Major 14th', 'Double Octave'
    ];
    return intervals[semitones] || (`${semitones} Semitones`);
  }

  /**
   * Lazy initialization on first user interaction (browser autoplay compliance)
   */
  async init() {
    if (this.audioCtx) return;

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) {
      console.warn('[Sonification] Web Audio API is not supported in this browser.');
      return;
    }

    this.audioCtx = new AudioContextClass();

    // 1. Master Output Gain
    this.masterGain = this.audioCtx.createGain();
    this.masterGain.gain.setValueAtTime(this.volume, this.audioCtx.currentTime);

    // 2. Analyser for animated soundwave visualizer
    this.analyserNode = this.audioCtx.createAnalyser();
    this.analyserNode.fftSize = 64;
    this.analyserNode.smoothingTimeConstant = 0.8;

    // 3. Master Filter & Saturation
    this.filterNode = this.audioCtx.createBiquadFilter();
    this.filterNode.type = 'lowpass';
    this.filterNode.frequency.setValueAtTime(4500, this.audioCtx.currentTime);

    this.shaperNode = this.audioCtx.createWaveShaper();
    this.updateDistortionCurve(1.0);

    // Connect Main Track Graph
    this.filterNode.connect(this.shaperNode);
    this.shaperNode.connect(this.masterGain);
    this.masterGain.connect(this.analyserNode);
    this.analyserNode.connect(this.audioCtx.destination);

    // 4. Try loading user's base audio track & rain track if available
    await this.loadAudioSample();
    await this.loadRainAudio();
  }

  /**
   * Load and decode user's audio track if present
   */
  async loadAudioSample() {
    try {
      const response = await fetch(this.audioUrl);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const arrayBuffer = await response.arrayBuffer();
      this.audioBuffer = await this.audioCtx.decodeAudioData(arrayBuffer);
      this.isLoaded = true;
    } catch (err) {
      this.isLoaded = true; // Seamless procedural fire fallback
    }
  }

  /**
   * Load and decode authentic rain sample (rain_sample.mp3)
   */
  async loadRainAudio() {
    try {
      const response = await fetch(this.rainAudioUrl);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const arrayBuffer = await response.arrayBuffer();
      this.rainBuffer = await this.audioCtx.decodeAudioData(arrayBuffer);
      this.isRainLoaded = true;
      console.log('[Sonification] Rain audio loaded successfully, duration:', this.rainBuffer.duration.toFixed(1) + 's');
    } catch (err) {
      console.warn('[Sonification] Failed to load rain_sample.mp3, using procedural fallback:', err);
      this.rainBuffer = this.createProceduralRainBuffer(10.0);
      this.isRainLoaded = true;
    }
  }

  /**
   * Procedural pink noise + water droplet buffer as robust fallback
   */
  createProceduralRainBuffer(duration = 6.0) {
    if (!this.audioCtx) return null;
    const sr = this.audioCtx.sampleRate;
    const numSamples = Math.floor(sr * duration);
    const buffer = this.audioCtx.createBuffer(2, numSamples, sr);
    const left = buffer.getChannelData(0);
    const right = buffer.getChannelData(1);

    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < numSamples; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      const pink = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
      b6 = white * 0.115926;

      const dropL = (Math.random() < 0.003) ? (Math.random() * 0.5) : 0;
      const dropR = (Math.random() < 0.003) ? (Math.random() * 0.5) : 0;
      left[i] = pink + dropL;
      right[i] = pink * 0.9 + dropR;
    }
    return buffer;
  }

  /**
   * Thermal Saturation (analog harmonic warmth)
   */
  updateDistortionCurve(drive = 1.0) {
    if (!this.audioCtx || !this.shaperNode) return;
    const n = 256;
    const curve = new Float32Array(n);
    const deg = Math.PI / 180;
    const k = drive * 12;
    for (let i = 0; i < n; ++i) {
      const x = (i * 2) / n - 1;
      curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
    }
    this.shaperNode.curve = curve;
  }

  /**
   * Calculate physical fire metrics, frequency, and musical nodes:
   * - Cool places: Frequency is TOO LOW (65 Hz to 200 Hz sub-bass, deep slow pitch ~0.45x)
   * - Hot places: Frequency is HIGH (6,000 Hz to 13,500 Hz bright sizzle, fast high pitch ~1.9x)
   * - Musical Nodes: 4-note melodic arpeggio on C major pentatonic scale
   */
  getFireMetrics(temp) {
    const norm = Math.max(0.0, Math.min(1.0, (temp + 35) / 80));
    
    // Crackle rate: 3/s (cold) to 133/s (hot)
    const crackleRate = 3 + Math.floor(norm * norm * 130);
    const crackleAmp = 0.15 + norm * 0.75;
    const roarAmp = 0.08 + norm * 0.55;

    // FREQUENCY MAPPING:
    const cutoffFreq = Math.round(65 * Math.pow(13500 / 65, norm));

    // PITCH / SPEED MAPPING:
    const pitchRate = +(0.45 + Math.pow(norm, 1.25) * 1.60).toFixed(2);

    // MUSICAL NODE MAPPING:
    const musicalObj = this.tempToMusicalNote(temp);
    const nodes = this.generateMusicalNodes(temp);

    let freqDesc = 'Ultra-Low Sub-Bass (Too Low Freq) ❄️';
    if (cutoffFreq > 6000) freqDesc = 'High Frequency Sizzle (High Pitch) 🔥';
    else if (cutoffFreq > 2200) freqDesc = 'Mid-High Bright Flame 🪵';
    else if (cutoffFreq > 700) freqDesc = 'Warm Mid-Range 🏕️';
    else if (cutoffFreq > 220) freqDesc = 'Low Frequency Rumble 💨';

    const desc = norm > 0.8 ? 'Raging Inferno 🔥' :
                 norm > 0.55 ? 'Active Blaze 🪵' :
                 norm > 0.35 ? 'Warm Campfire 🏕️' :
                 norm > 0.15 ? 'Dying Embers 💨' : 'Cold Sub-Zero ❄️';
    return {
      norm,
      percent: Math.round(norm * 100),
      crackleRate,
      crackleAmp,
      roarAmp,
      cutoffFreq,
      pitchRate,
      note: musicalObj.note,
      noteFreq: musicalObj.freq,
      nodes, // 4-note melodic progression
      freqDesc,
      desc
    };
  }

  /**
   * Calculate physical rainfall acoustics and metrics:
   * - Dry land (precipitation < 0.25 mm/day): NO SOUND (gain = 0.0, complete silence)
   * - Heavy rain (precipitation >= 15 mm/day): LARGER SOUND (loud gain ~ 0.95-1.0, wide spectrum cutoff up to 14kHz)
   * - Light drizzle (0.25 - 2 mm/day): Soft gain (0.18-0.35, gentle 1.5kHz cutoff)
   */
  getRainMetrics(mm = 0) {
    const rain = Math.max(0, Number(mm) || 0);
    // Strict threshold: dry land produces NO sound
    const isDry = rain < 0.25;

    if (isDry) {
      return {
        mm: 0.0,
        isDry: true,
        norm: 0.0,
        gain: 0.0,
        cutoffFreq: 200,
        pitchRate: 1.0,
        category: 'Dry Land',
        volumeDesc: '0% (Complete Silence)',
        label: '0.0 mm/day · Dry Land (No Sound)'
      };
    }

    // Normalized rainfall intensity (0 at 0.25 mm/day up to 1.0 at 18.0+ mm/day)
    const norm = Math.min(1.0, Math.max(0.0, (rain - 0.25) / 17.75));

    // Perceptual loudness curve: larger sound for heavy rain
    const gain = Math.min(1.0, 0.18 + 0.82 * Math.pow(norm, 0.72));

    // Frequency spectrum: light drizzle is soft and muffled (1,500 Hz), torrential storm opens up full high frequencies (13,500 Hz)
    const cutoffFreq = Math.round(1500 + norm * 12000);

    // Subtle pitch/speed modulation: heavier downpours have faster rushing droplet speed
    const pitchRate = 0.95 + norm * 0.16;

    let category = 'Light Drizzle';
    if (rain >= 14.0) category = 'Torrential Downpour';
    else if (rain >= 7.0) category = 'Heavy Rain';
    else if (rain >= 2.0) category = 'Moderate Rain';

    return {
      mm: rain,
      isDry: false,
      norm,
      gain,
      cutoffFreq,
      pitchRate,
      category,
      volumeDesc: `${Math.round(gain * 100)}% Volume`,
      label: `${rain.toFixed(1)} mm/day · ${category} (${Math.round(gain * 100)}% Vol)`
    };
  }

  /**
   * Instantiate rain audio buffer source (from authentic rain_sample.mp3 or procedural fallback)
   */
  createRainSource(duration = 4.0, playbackRate = 1.0) {
    if (!this.audioCtx) return null;
    let src = null;
    if (this.rainBuffer) {
      src = this.audioCtx.createBufferSource();
      src.buffer = this.rainBuffer;
      src.playbackRate.setValueAtTime(playbackRate, this.audioCtx.currentTime);
      return src;
    }
    const buf = this.createProceduralRainBuffer(duration);
    if (buf) {
      src = this.audioCtx.createBufferSource();
      src.buffer = buf;
      src.playbackRate.setValueAtTime(playbackRate, this.audioCtx.currentTime);
    }
    return src;
  }

  /**
   * Synthesizes an organic, resonant musical chime note
   * with natural exponential decay bell envelope. Hard-panned to stereo ear.
   */
  playMusicalNoteVoice(freq, panVal, duration = 3.2, tStart = null) {
    if (!this.audioCtx) return null;
    const t = tStart || this.audioCtx.currentTime;

    // Fundamental oscillator (sine)
    const oscFund = this.audioCtx.createOscillator();
    oscFund.type = 'sine';
    oscFund.frequency.setValueAtTime(freq, t);

    // Warm overtone oscillator (octave shimmer at 2x frequency)
    const oscHarm = this.audioCtx.createOscillator();
    oscHarm.type = 'sine';
    oscHarm.frequency.setValueAtTime(freq * 2.0, t);

    // Natural bell / chime envelopes
    const gainFund = this.audioCtx.createGain();
    gainFund.gain.setValueAtTime(0.0001, t);
    gainFund.gain.linearRampToValueAtTime(0.32, t + 0.025); // fast chime strike
    gainFund.gain.exponentialRampToValueAtTime(0.0001, t + duration); // resonant decay

    const gainHarm = this.audioCtx.createGain();
    gainHarm.gain.setValueAtTime(0.0001, t);
    gainHarm.gain.linearRampToValueAtTime(0.09, t + 0.015);
    gainHarm.gain.exponentialRampToValueAtTime(0.0001, t + duration * 0.55);

    oscFund.connect(gainFund);
    oscHarm.connect(gainHarm);

    const mixer = this.audioCtx.createGain();
    mixer.gain.setValueAtTime(1.0, t);
    gainFund.connect(mixer);
    gainHarm.connect(mixer);

    const panner = this.createPannedNode(panVal);
    if (panner.pan) {
      mixer.connect(panner);
      panner.connect(this.masterGain);
    } else {
      panner.inputNode(mixer);
      panner.connect(this.masterGain);
    }

    oscFund.start(t);
    oscHarm.start(t);
    oscFund.stop(t + duration + 0.1);
    oscHarm.stop(t + duration + 0.1);

    const voice = { oscFund, oscHarm, mixer };
    this.activeMusicalVoices.push(voice);
    return voice;
  }

  /**
   * Plays a 4-note melodic arpeggio sequence (Musical Nodes)
   */
  playMelodicNodes(nodes, panVal, duration = 3.5, tStart = null) {
    if (!this.audioCtx || !nodes || nodes.length === 0) return;
    const t0 = tStart || this.audioCtx.currentTime;
    const step = 0.18; // 180ms delay between consecutive notes in arpeggio

    nodes.forEach((node, idx) => {
      const noteTime = t0 + idx * step;
      const noteDur = Math.max(1.2, duration - idx * step);
      this.playMusicalNoteVoice(node.freq, panVal, noteDur, noteTime);
    });
  }

  /**
   * Generates a realistic procedural Fire AudioBuffer:
   * - Cool places: Deep low-frequency convective rumble, slow flutter, low-frequency pops
   * - Hot places: High-frequency convective sizzle, rapid flutter, micro-sharp crackles
   */
  createFireAudioBuffer(temp, anomaly = 0.0, duration = 3.5) {
    if (!this.audioCtx) return null;
    const sampleRate = this.audioCtx.sampleRate;
    const totalSamples = Math.floor(sampleRate * duration);
    const buffer = this.audioCtx.createBuffer(1, totalSamples, sampleRate);
    const data = buffer.getChannelData(0);

    const metrics = this.getFireMetrics(temp);
    const { norm, crackleRate, crackleAmp, roarAmp } = metrics;

    // 1. Convective Pink Noise Flame Roar
    let b0 = 0, b1 = 0, b2 = 0;
    const flutterFreq = 1.5 + norm * 5.0;
    for (let i = 0; i < totalSamples; i++) {
      const white = (Math.random() * 2 - 1);
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      const pink = b0 + b1 + b2 + white * 0.5362;

      const tSec = i / sampleRate;
      const flutter = 1.0 + 0.38 * Math.sin(2 * Math.PI * flutterFreq * tSec) + 0.18 * Math.sin(2 * Math.PI * 1.3 * tSec);
      data[i] = pink * 0.14 * roarAmp * flutter;
    }

    // 2. High-Frequency Wood Crackles & Popping Embers (Poisson-distributed impulse spikes)
    const numCrackles = Math.floor(crackleRate * duration);
    for (let c = 0; c < numCrackles; c++) {
      const startIdx = Math.floor(Math.random() * (totalSamples - 600));
      const snapLen = Math.floor(25 + (1.0 - norm) * 180 + Math.random() * 40);
      const amp = crackleAmp * (0.35 + Math.random() * 0.65);
      const sign = Math.random() > 0.5 ? 1 : -1;

      for (let j = 0; j < snapLen && (startIdx + j) < totalSamples; j++) {
        const decay = Math.exp(-j / (snapLen * (0.15 + (1.0 - norm) * 0.25)));
        const noise = (Math.random() * 2 - 1);
        data[startIdx + j] += sign * amp * decay * noise;
      }
    }

    // Smooth envelope at start and end to avoid clicks
    const fadeLen = Math.floor(sampleRate * 0.04);
    for (let i = 0; i < fadeLen; i++) {
      const f = i / fadeLen;
      data[i] *= f;
      data[totalSamples - 1 - i] *= f;
    }

    return buffer;
  }

  /**
   * Helper to create a hard-panned voice node (-1.0 = 100% Left, +1.0 = 100% Right)
   */
  createPannedNode(panVal) {
    if (!this.audioCtx) return null;
    if (this.audioCtx.createStereoPanner) {
      const panner = this.audioCtx.createStereoPanner();
      panner.pan.setValueAtTime(panVal, this.audioCtx.currentTime);
      return panner;
    }
    const merger = this.audioCtx.createChannelMerger(2);
    return {
      panVal,
      connect: (dest) => merger.connect(dest),
      inputNode: (src) => {
        if (panVal <= -0.5) {
          src.connect(merger, 0, 0); // strictly Left channel
        } else if (panVal >= 0.5) {
          src.connect(merger, 0, 1); // strictly Right channel
        } else {
          src.connect(merger, 0, 0);
          src.connect(merger, 0, 1);
        }
      }
    };
  }

  /**
   * Stop any active pin fire or musical voices
   */
  stopPinFire() {
    this.isPinLooping = false;
    if (this.currentPinLoopTimer) {
      clearTimeout(this.currentPinLoopTimer);
      this.currentPinLoopTimer = null;
    }
    for (const src of this.activePinSources) {
      try {
        src.stop();
        src.disconnect();
      } catch (e) {}
    }
    this.activePinSources = [];

    for (const voice of this.activeMusicalVoices) {
      try {
        voice.oscFund.stop();
        voice.oscHarm.stop();
        voice.oscFund.disconnect();
        voice.oscHarm.disconnect();
      } catch (e) {}
    }
    this.activeMusicalVoices = [];

    if (typeof this.onPinAudioState === 'function') {
      this.onPinAudioState({ active: false, mode: 'stopped' });
    }
  }

  /**
   * Hear PIN A ONLY from LEFT EAR (Right ear is 100% silent)
   * Plays:
   * - 4-Node Melodic Chime Arpeggio in Left Ear
   * - Fire combustion acoustics (if mode !== 'notes') in Left Ear
   */
  async playPinFireA(pinA, heatLayer, year) {
    if (!pinA) return;
    await this.ensureContextRunning();
    this.stopPinFire();

    const valA = heatLayer.query(pinA.lat, pinA.lon, year);
    const metricsA = this.getFireMetrics(valA.temp);
    const t = this.audioCtx.currentTime;

    // 1. Play Melodic Musical Nodes (Left Ear)
    if (this.soundMode === 'blend' || this.soundMode === 'notes') {
      this.playMelodicNodes(metricsA.nodes, -1.0, 3.8, t);
    }

    // 2. Play Fire Acoustics (Left Ear)
    if (this.soundMode === 'blend' || this.soundMode === 'fire') {
      const bufferA = this.createFireAudioBuffer(valA.temp, valA.anomaly, 4.0);
      if (bufferA) {
        const srcA = this.audioCtx.createBufferSource();
        srcA.buffer = bufferA;
        srcA.playbackRate.setValueAtTime(metricsA.pitchRate, t);

        const filterA = this.audioCtx.createBiquadFilter();
        filterA.type = 'lowpass';
        filterA.frequency.setValueAtTime(metricsA.cutoffFreq, t);
        filterA.Q.setValueAtTime(metricsA.norm > 0.6 ? 2.5 : 0.7, t);

        const gainA = this.audioCtx.createGain();
        gainA.gain.setValueAtTime(0.85, t);

        const pannerA = this.createPannedNode(-1.0);
        if (pannerA.pan) {
          srcA.connect(filterA);
          filterA.connect(gainA);
          gainA.connect(pannerA);
          pannerA.connect(this.masterGain);
        } else {
          srcA.connect(filterA);
          filterA.connect(gainA);
          pannerA.inputNode(gainA);
          pannerA.connect(this.masterGain);
        }

        srcA.start(t);
        srcA.onended = () => {
          if (!this.isPinLooping) this.stopPinFire();
        };
        this.activePinSources.push(srcA);
      }
    }

    if (typeof this.onPinAudioState === 'function') {
      this.onPinAudioState({ 
        active: true, 
        mode: 'soloA', 
        pin: 'A', 
        ear: 'Left Ear',
        metrics: metricsA,
        temp: valA.temp
      });
    }
  }

  /**
   * Hear PIN B ONLY from RIGHT EAR (Left ear is 100% silent)
   * Plays:
   * - 4-Node Melodic Chime Arpeggio in Right Ear
   * - Fire combustion acoustics (if mode !== 'notes') in Right Ear
   */
  async playPinFireB(pinB, heatLayer, year) {
    if (!pinB) return;
    await this.ensureContextRunning();
    this.stopPinFire();

    const valB = heatLayer.query(pinB.lat, pinB.lon, year);
    const metricsB = this.getFireMetrics(valB.temp);
    const t = this.audioCtx.currentTime;

    // 1. Play Melodic Musical Nodes (Right Ear)
    if (this.soundMode === 'blend' || this.soundMode === 'notes') {
      this.playMelodicNodes(metricsB.nodes, 1.0, 3.8, t);
    }

    // 2. Play Fire Acoustics (Right Ear)
    if (this.soundMode === 'blend' || this.soundMode === 'fire') {
      const bufferB = this.createFireAudioBuffer(valB.temp, valB.anomaly, 4.0);
      if (bufferB) {
        const srcB = this.audioCtx.createBufferSource();
        srcB.buffer = bufferB;
        srcB.playbackRate.setValueAtTime(metricsB.pitchRate, t);

        const filterB = this.audioCtx.createBiquadFilter();
        filterB.type = 'lowpass';
        filterB.frequency.setValueAtTime(metricsB.cutoffFreq, t);
        filterB.Q.setValueAtTime(metricsB.norm > 0.6 ? 2.5 : 0.7, t);

        const gainB = this.audioCtx.createGain();
        gainB.gain.setValueAtTime(0.85, t);

        const pannerB = this.createPannedNode(1.0);
        if (pannerB.pan) {
          srcB.connect(filterB);
          filterB.connect(gainB);
          gainB.connect(pannerB);
          pannerB.connect(this.masterGain);
        } else {
          srcB.connect(filterB);
          filterB.connect(gainB);
          pannerB.inputNode(gainB);
          pannerB.connect(this.masterGain);
        }

        srcB.start(t);
        srcB.onended = () => {
          if (!this.isPinLooping) this.stopPinFire();
        };
        this.activePinSources.push(srcB);
      }
    }

    if (typeof this.onPinAudioState === 'function') {
      this.onPinAudioState({ 
        active: true, 
        mode: 'soloB', 
        pin: 'B', 
        ear: 'Right Ear',
        metrics: metricsB,
        temp: valB.temp
      });
    }
  }

  /**
   * BINAURAL FIRE & MUSICAL HARMONY COMPARISON:
   * Left Ear: Pin A 4-note melodic progression + fire
   * Right Ear: Pin B 4-note melodic progression + fire
   */
  async playPinFireBoth(pinA, pinB, heatLayer, year, isLoop = false) {
    if (!pinA || !pinB) return;
    await this.ensureContextRunning();
    this.stopPinFire();

    const duration = isLoop ? 4.5 : 4.0;
    const valA = heatLayer.query(pinA.lat, pinA.lon, year);
    const valB = heatLayer.query(pinB.lat, pinB.lon, year);

    const metricsA = this.getFireMetrics(valA.temp);
    const metricsB = this.getFireMetrics(valB.temp);

    const t = this.audioCtx.currentTime;

    // 1. Musical Nodes: Cascading Stereo Arpeggio (Left: A, Right: B)
    if (this.soundMode === 'blend' || this.soundMode === 'notes') {
      this.playMelodicNodes(metricsA.nodes, -1.0, 3.8, t);
      this.playMelodicNodes(metricsB.nodes, 1.0, 3.8, t);
    }

    // 2. Fire Combustion Acoustics
    if (this.soundMode === 'blend' || this.soundMode === 'fire') {
      const bufferA = this.createFireAudioBuffer(valA.temp, valA.anomaly, duration);
      const bufferB = this.createFireAudioBuffer(valB.temp, valB.anomaly, duration);

      if (bufferA && bufferB) {
        // Pin A -> Left Ear
        const srcA = this.audioCtx.createBufferSource();
        srcA.buffer = bufferA;
        srcA.playbackRate.setValueAtTime(metricsA.pitchRate, t);

        const filterA = this.audioCtx.createBiquadFilter();
        filterA.type = 'lowpass';
        filterA.frequency.setValueAtTime(metricsA.cutoffFreq, t);
        filterA.Q.setValueAtTime(metricsA.norm > 0.6 ? 2.5 : 0.7, t);

        const gainA = this.audioCtx.createGain();
        gainA.gain.setValueAtTime(0.85, t);

        const pannerA = this.createPannedNode(-1.0);
        if (pannerA.pan) {
          srcA.connect(filterA);
          filterA.connect(gainA);
          gainA.connect(pannerA);
          pannerA.connect(this.masterGain);
        } else {
          srcA.connect(filterA);
          filterA.connect(gainA);
          pannerA.inputNode(gainA);
          pannerA.connect(this.masterGain);
        }

        // Pin B -> Right Ear
        const srcB = this.audioCtx.createBufferSource();
        srcB.buffer = bufferB;
        srcB.playbackRate.setValueAtTime(metricsB.pitchRate, t);

        const filterB = this.audioCtx.createBiquadFilter();
        filterB.type = 'lowpass';
        filterB.frequency.setValueAtTime(metricsB.cutoffFreq, t);
        filterB.Q.setValueAtTime(metricsB.norm > 0.6 ? 2.5 : 0.7, t);

        const gainB = this.audioCtx.createGain();
        gainB.gain.setValueAtTime(0.85, t);

        const pannerB = this.createPannedNode(1.0);
        if (pannerB.pan) {
          srcB.connect(filterB);
          filterB.connect(gainB);
          gainB.connect(pannerB);
          pannerB.connect(this.masterGain);
        } else {
          srcB.connect(filterB);
          filterB.connect(gainB);
          pannerB.inputNode(gainB);
          pannerB.connect(this.masterGain);
        }

        srcA.start(t);
        srcB.start(t);

        this.activePinSources.push(srcA, srcB);

        srcA.onended = () => {
          if (!this.isPinLooping) this.stopPinFire();
        };
      }
    }

    if (isLoop) {
      this.isPinLooping = true;
      this.currentPinLoopTimer = setTimeout(() => {
        if (this.isPinLooping) {
          this.playPinFireBoth(pinA, pinB, heatLayer, year, true);
        }
      }, (duration - 0.15) * 1000);
    }

    if (typeof this.onPinAudioState === 'function') {
      this.onPinAudioState({
        active: true,
        mode: isLoop ? 'loop' : 'both',
        valA,
        valB,
        metricsA,
        metricsB,
        interval: this.getMusicalInterval(metricsA.noteFreq, metricsB.noteFreq)
      });
    }
  }

  /**
   * Toggle continuous looping comparison
   */
  async toggleLoopPinFire(pinA, pinB, heatLayer, year) {
    if (this.isPinLooping) {
      this.stopPinFire();
      return false;
    } else {
      await this.playPinFireBoth(pinA, pinB, heatLayer, year, true);
      return true;
    }
  }

  /**
   * Hear PIN A RAIN ONLY from LEFT EAR (Right ear is 100% silent)
   * User requirement: For heavy rain larger sound, for dry land NO sound.
   */
  async playPinRainA(pinA, rainfallLayer, month = 7) {
    if (!pinA) return;
    await this.ensureContextRunning();
    this.stopPinFire();

    const mmA = rainfallLayer ? rainfallLayer.query(pinA.lat, pinA.lon, month) : 0;
    const metA = this.getRainMetrics(mmA);
    const t = this.audioCtx.currentTime;

    // If dry land: 100% SILENT (no sound)
    if (!metA.isDry && metA.gain > 0.001) {
      const srcA = this.createRainSource(4.0, metA.pitchRate);
      if (srcA) {
        const filterA = this.audioCtx.createBiquadFilter();
        filterA.type = 'lowpass';
        filterA.frequency.setValueAtTime(metA.cutoffFreq, t);

        const gainA = this.audioCtx.createGain();
        gainA.gain.setValueAtTime(metA.gain, t);

        const pannerA = this.createPannedNode(-1.0);
        srcA.connect(filterA);
        filterA.connect(gainA);
        if (pannerA.pan) {
          gainA.connect(pannerA);
          pannerA.connect(this.masterGain);
        } else {
          pannerA.inputNode(gainA);
          pannerA.connect(this.masterGain);
        }

        const maxOffset = Math.max(0, (srcA.buffer ? srcA.buffer.duration - 4.2 : 0));
        const offsetA = Math.random() * maxOffset;
        srcA.start(t, offsetA, 4.0);
        srcA.onended = () => {
          if (!this.isPinLooping) this.stopPinFire();
        };
        this.activePinSources.push(srcA);
      }
    }

    if (typeof this.onPinAudioState === 'function') {
      this.onPinAudioState({
        active: true,
        mode: 'soloA',
        layer: 'rainfall',
        pin: 'A',
        ear: 'Left Ear',
        metrics: metA,
        mm: mmA,
        isDry: metA.isDry
      });
    }
  }

  /**
   * Hear PIN B RAIN ONLY from RIGHT EAR (Left ear is 100% silent)
   * User requirement: For heavy rain larger sound, for dry land NO sound.
   */
  async playPinRainB(pinB, rainfallLayer, month = 7) {
    if (!pinB) return;
    await this.ensureContextRunning();
    this.stopPinFire();

    const mmB = rainfallLayer ? rainfallLayer.query(pinB.lat, pinB.lon, month) : 0;
    const metB = this.getRainMetrics(mmB);
    const t = this.audioCtx.currentTime;

    // If dry land: 100% SILENT (no sound)
    if (!metB.isDry && metB.gain > 0.001) {
      const srcB = this.createRainSource(4.0, metB.pitchRate);
      if (srcB) {
        const filterB = this.audioCtx.createBiquadFilter();
        filterB.type = 'lowpass';
        filterB.frequency.setValueAtTime(metB.cutoffFreq, t);

        const gainB = this.audioCtx.createGain();
        gainB.gain.setValueAtTime(metB.gain, t);

        const pannerB = this.createPannedNode(1.0);
        srcB.connect(filterB);
        filterB.connect(gainB);
        if (pannerB.pan) {
          gainB.connect(pannerB);
          pannerB.connect(this.masterGain);
        } else {
          pannerB.inputNode(gainB);
          pannerB.connect(this.masterGain);
        }

        const maxOffset = Math.max(0, (srcB.buffer ? srcB.buffer.duration - 4.2 : 0));
        const offsetB = Math.random() * maxOffset;
        srcB.start(t, offsetB, 4.0);
        srcB.onended = () => {
          if (!this.isPinLooping) this.stopPinFire();
        };
        this.activePinSources.push(srcB);
      }
    }

    if (typeof this.onPinAudioState === 'function') {
      this.onPinAudioState({
        active: true,
        mode: 'soloB',
        layer: 'rainfall',
        pin: 'B',
        ear: 'Right Ear',
        metrics: metB,
        mm: mmB,
        isDry: metB.isDry
      });
    }
  }

  /**
   * BINAURAL RAIN STEREO COMPARISON:
   * Left Ear: Pin A rainfall acoustics (100% silent if dry land, louder sound for heavy rain)
   * Right Ear: Pin B rainfall acoustics (100% silent if dry land, louder sound for heavy rain)
   */
  async playPinRainBoth(pinA, pinB, rainfallLayer, month = 7, isLoop = false) {
    if (!pinA || !pinB) return;
    await this.ensureContextRunning();
    this.stopPinFire();

    const duration = isLoop ? 4.5 : 4.0;
    const mmA = rainfallLayer ? rainfallLayer.query(pinA.lat, pinA.lon, month) : 0;
    const mmB = rainfallLayer ? rainfallLayer.query(pinB.lat, pinB.lon, month) : 0;

    const metA = this.getRainMetrics(mmA);
    const metB = this.getRainMetrics(mmB);
    const t = this.audioCtx.currentTime;

    // Pin A -> Left Ear (-1.0)
    if (!metA.isDry && metA.gain > 0.001) {
      const srcA = this.createRainSource(duration, metA.pitchRate);
      if (srcA) {
        const filterA = this.audioCtx.createBiquadFilter();
        filterA.type = 'lowpass';
        filterA.frequency.setValueAtTime(metA.cutoffFreq, t);

        const gainA = this.audioCtx.createGain();
        gainA.gain.setValueAtTime(metA.gain, t);

        const pannerA = this.createPannedNode(-1.0);
        srcA.connect(filterA);
        filterA.connect(gainA);
        if (pannerA.pan) {
          gainA.connect(pannerA);
          pannerA.connect(this.masterGain);
        } else {
          pannerA.inputNode(gainA);
          pannerA.connect(this.masterGain);
        }

        const maxOffset = Math.max(0, (srcA.buffer ? srcA.buffer.duration - duration - 0.5 : 0));
        const offsetA = Math.random() * maxOffset;
        srcA.start(t, offsetA, duration);
        this.activePinSources.push(srcA);
        srcA.onended = () => {
          if (!this.isPinLooping) this.stopPinFire();
        };
      }
    }

    // Pin B -> Right Ear (+1.0)
    if (!metB.isDry && metB.gain > 0.001) {
      const srcB = this.createRainSource(duration, metB.pitchRate);
      if (srcB) {
        const filterB = this.audioCtx.createBiquadFilter();
        filterB.type = 'lowpass';
        filterB.frequency.setValueAtTime(metB.cutoffFreq, t);

        const gainB = this.audioCtx.createGain();
        gainB.gain.setValueAtTime(metB.gain, t);

        const pannerB = this.createPannedNode(1.0);
        srcB.connect(filterB);
        filterB.connect(gainB);
        if (pannerB.pan) {
          gainB.connect(pannerB);
          pannerB.connect(this.masterGain);
        } else {
          pannerB.inputNode(gainB);
          pannerB.connect(this.masterGain);
        }

        const maxOffset = Math.max(0, (srcB.buffer ? srcB.buffer.duration - duration - 0.5 : 0));
        const offsetB = Math.random() * maxOffset;
        srcB.start(t, offsetB, duration);
        this.activePinSources.push(srcB);
        srcB.onended = () => {
          if (!this.isPinLooping) this.stopPinFire();
        };
      }
    }

    if (isLoop) {
      this.isPinLooping = true;
      this.currentPinLoopTimer = setTimeout(() => {
        if (this.isPinLooping) {
          this.playPinRainBoth(pinA, pinB, rainfallLayer, month, true);
        }
      }, (duration - 0.15) * 1000);
    }

    if (typeof this.onPinAudioState === 'function') {
      this.onPinAudioState({
        active: true,
        mode: isLoop ? 'loop' : 'both',
        layer: 'rainfall',
        mmA,
        mmB,
        metA,
        metB
      });
    }
  }

  /**
   * Toggle continuous looping comparison for rain
   */
  async toggleLoopPinRain(pinA, pinB, rainfallLayer, month = 7) {
    if (this.isPinLooping) {
      this.stopPinFire();
      return false;
    } else {
      await this.playPinRainBoth(pinA, pinB, rainfallLayer, month, true);
      return true;
    }
  }

  /**
   * Spatial Rain Point Sonification on Click:
   * - Dry land: NO SOUND (silent)
   * - Heavy rain: louder rain burst panned to click longitude
   */
  async sonifyRainPoint(lat, lon, mm) {
    await this.ensureContextRunning();
    if (!this.audioCtx) return { isDry: true, mm: 0 };

    const met = this.getRainMetrics(mm);
    if (met.isDry || met.gain <= 0.001) {
      // Dry land produces no sound
      return { isDry: true, mm: 0 };
    }

    const t = this.audioCtx.currentTime;
    const duration = 2.4;
    const panVal = Math.max(-0.85, Math.min(0.85, lon / 180.0));

    const src = this.createRainSource(duration, met.pitchRate);
    if (!src) return { isDry: false, mm, gain: met.gain };

    const filter = this.audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(met.cutoffFreq, t);

    const gain = this.audioCtx.createGain();
    gain.gain.setValueAtTime(0.001, t);
    gain.gain.exponentialRampToValueAtTime(met.gain, t + 0.25);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

    const panner = this.createPannedNode(panVal);
    src.connect(filter);
    filter.connect(gain);
    if (panner.pan) {
      gain.connect(panner);
      panner.connect(this.masterGain);
    } else {
      panner.inputNode(gain);
      panner.connect(this.masterGain);
    }

    const maxOffset = Math.max(0, (src.buffer ? src.buffer.duration - duration - 0.5 : 0));
    const offset = Math.random() * maxOffset;
    src.start(t, offset, duration);
    return { isDry: false, mm, gain: met.gain };
  }

  /**
   * Spatial Click Sonification:
   * Plays a musical note chime + fire burst tuned to the clicked temperature and coordinate
   */
  async sonifyPoint(lat, lon, temp, anomaly) {
    await this.ensureContextRunning();
    if (!this.audioCtx) return;

    const metrics = this.getFireMetrics(temp);
    const t = this.audioCtx.currentTime;
    const panVal = Math.max(-0.85, Math.min(0.85, lon / 180.0));

    // Musical chime
    if (this.soundMode === 'blend' || this.soundMode === 'notes') {
      this.playMusicalNoteVoice(metrics.noteFreq, panVal, 2.0, t);
    }

    // Fire whoosh
    if (this.soundMode === 'blend' || this.soundMode === 'fire') {
      const buffer = this.createFireAudioBuffer(temp, anomaly, 1.4);
      if (buffer) {
        const src = this.audioCtx.createBufferSource();
        src.buffer = buffer;
        src.playbackRate.setValueAtTime(metrics.pitchRate, t);

        const filter = this.audioCtx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(metrics.cutoffFreq, t);
        filter.Q.setValueAtTime(metrics.norm > 0.6 ? 2.5 : 0.7, t);

        const gain = this.audioCtx.createGain();
        gain.gain.setValueAtTime(0.85, t);

        const panner = this.createPannedNode(panVal);
        if (panner.pan) {
          src.connect(filter);
          filter.connect(gain);
          gain.connect(panner);
          panner.connect(this.masterGain);
        } else {
          src.connect(filter);
          filter.connect(gain);
          panner.inputNode(gain);
          panner.connect(this.masterGain);
        }

        src.start(t);
      }
    }
  }

  /**
   * Global Climate Audio
   */
  async play() {
    await this.ensureContextRunning();

    if (!this.isPlaying) {
      if (this.audioBuffer) {
        this.sourceNode = this.audioCtx.createBufferSource();
        this.sourceNode.buffer = this.audioBuffer;
        this.sourceNode.loop = true;
        this.sourceNode.connect(this.filterNode);
        this.sourceNode.start(0);
      }
      this.isPlaying = true;
      this.setMuted(false);
      this.updateModulation(this.currentYear, this.globalAnomaly, this.globalTemp);
      this.notifyState();
    }
  }

  pause() {
    if (this.sourceNode) {
      try {
        this.sourceNode.stop();
        this.sourceNode.disconnect();
      } catch (e) {}
      this.sourceNode = null;
    }
    this.isPlaying = false;
    this.notifyState();
  }

  async togglePlay() {
    if (this.isPlaying) {
      this.pause();
    } else {
      await this.play();
    }
    return this.isPlaying;
  }

  setMuted(muted) {
    this.isMuted = muted;
    if (this.masterGain && this.audioCtx) {
      const target = this.isMuted ? 0 : this.volume;
      this.masterGain.gain.setTargetAtTime(target, this.audioCtx.currentTime, 0.05);
    }
    this.notifyState();
  }

  setVolume(vol) {
    this.volume = Math.max(0, Math.min(1, vol));
    if (this.masterGain && this.audioCtx && !this.isMuted) {
      this.masterGain.gain.setTargetAtTime(this.volume, this.audioCtx.currentTime, 0.05);
    }
    this.notifyState();
  }

  updateModulation(year, anomaly = 0.0, temp = 5.5) {
    this.currentYear = year;
    this.globalAnomaly = anomaly;
    this.globalTemp = temp;
    this.notifyState();

    if (!this.audioCtx) return;
    const t = this.audioCtx.currentTime;

    const normAnom = Math.max(-0.8, Math.min(1.8, anomaly));
    const targetRate = 1.0 + (normAnom * 0.16);
    if (this.sourceNode && this.sourceNode.playbackRate) {
      this.sourceNode.playbackRate.setTargetAtTime(Math.max(0.75, Math.min(1.4, targetRate)), t, 0.08);
    }

    const filterNorm = Math.max(0, Math.min(1, (anomaly + 0.7) / 2.0));
    const targetFreq = Math.round(90 * Math.pow(13000 / 90, filterNorm));
    const targetQ = 1.0 + filterNorm * 3.5;

    if (this.filterNode) {
      this.filterNode.frequency.setTargetAtTime(targetFreq, t, 0.08);
      this.filterNode.Q.setTargetAtTime(targetQ, t, 0.08);
    }

    const drive = 1.0 + Math.max(0, anomaly) * 1.8;
    this.updateDistortionCurve(drive);
    this.notifyState();
  }

  async ensureContextRunning() {
    if (!this.audioCtx) await this.init();
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      await this.audioCtx.resume();
    }
  }

  getVisualizerData(outArray) {
    if (!this.analyserNode) return;
    this.analyserNode.getByteFrequencyData(outArray);
  }

  notifyState() {
    if (typeof this.onStateChange === 'function') {
      const normAnom = Math.max(-0.8, Math.min(1.8, this.globalAnomaly));
      const rate = 1.0 + (normAnom * 0.16);
      const filterNorm = Math.max(0, Math.min(1, (this.globalAnomaly + 0.7) / 2.0));
      const cutoff = Math.round(90 * Math.pow(13000 / 90, filterNorm));

      this.onStateChange({
        isPlaying: this.isPlaying,
        isMuted: this.isMuted,
        volume: this.volume,
        year: this.currentYear,
        anomaly: this.globalAnomaly,
        playbackRate: rate.toFixed(2),
        cutoffHz: cutoff,
        soundMode: this.soundMode
      });
    }
  }
}

export const sonificationEngine = new SonificationEngine();
