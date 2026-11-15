// ============================================================================
// THERMOPHONE: Hear the Heat — Planetary Climate Sonification
// ============================================================================

// ============================================================================
// TOKENS & CONFIGURATION
// ============================================================================
let baseMapMode = 'realistic'; // Default: Google Earth realistic look
let isGraticuleActive = false;
let isCinematicLighting = true;
let isBordersActive = true;
let isLabelsActive = true;
let isHeatActive = true;
let heatOpacity = 0.90;

const ANOMALY_RANGE = 4;
const VIDEO_LNG_OFFSET = 0;
const FLIP_V = false;
const MAX_FRAME = 1751; // Dec 2025

// ============================================================================
// VIDEO SOURCE
// ============================================================================
const FPS = 30;
const CLIPS = [
 {file:'media/GISTEMP_part01.mp4', first:0,    last:239},
 {file:'media/GISTEMP_part02.mp4', first:240,  last:419},
 {file:'media/GISTEMP_part03.mp4', first:420,  last:659},
 {file:'media/GISTEMP_part04.mp4', first:660,  last:839},
 {file:'media/GISTEMP_part05.mp4', first:840,  last:1079},
 {file:'media/GISTEMP_part06.mp4', first:1080, last:1259},
 {file:'media/GISTEMP_part07.mp4', first:1260, last:1499},
 {file:'media/GISTEMP_part08.mp4', first:1500, last:1679},
 {file:'media/GISTEMP_part09.mp4', first:1680, last:1799},
];

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_FULL = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const clipVideos = [];
let activeClipIdx = 0;
let isVideoLoaded = false;
let videoLoadFailed = false;

// Canvases for video frame rendering & fast pixel sampling
let displayCanvas, displayCtx;
let sampleCanvas, sampleCtx;

function initVideoSources() {
  const container = document.getElementById('video-sources') || document.body;
  displayCanvas = document.getElementById('display-canvas');
  if (!displayCanvas) {
    displayCanvas = document.createElement('canvas');
    displayCanvas.id = 'display-canvas';
    displayCanvas.width = 2048; displayCanvas.height = 1024;
    displayCanvas.style.display = 'none';
    document.body.appendChild(displayCanvas);
  }
  displayCtx = displayCanvas.getContext('2d');

  sampleCanvas = document.getElementById('sample-canvas');
  if (!sampleCanvas) {
    sampleCanvas = document.createElement('canvas');
    sampleCanvas.id = 'sample-canvas';
    sampleCanvas.width = 1024; sampleCanvas.height = 512;
    sampleCanvas.style.display = 'none';
    document.body.appendChild(sampleCanvas);
  }
  sampleCtx = sampleCanvas.getContext('2d', { willReadFrequently: true });

  CLIPS.forEach((clip, i) => {
    const vid = document.createElement('video');
    vid.id = `video-clip-${i}`;
    vid.src = clip.file;
    vid.muted = true;
    vid.defaultMuted = true;
    vid.playsInline = true;
    vid.setAttribute('playsinline', '');
    vid.setAttribute('webkit-playsinline', '');
    vid.preload = (i === 0 || i === 1) ? 'auto' : 'metadata';
    vid.style.display = 'none';

    vid.onerror = (e) => {
      console.warn(`Clip ${clip.file} load error:`, e);
      if (!videoLoadFailed) {
        videoLoadFailed = true;
        showCompareToast("Temperature video could not load. Serve the folder over http (python -m http.server).");
      }
    };

    vid.onloadeddata = () => {
      if (i === 0 && !isVideoLoaded) isVideoLoaded = true;
    };

    container.appendChild(vid);
    clipVideos.push(vid);
  });
}

function updateClipPreloads(activeIdx) {
  clipVideos.forEach((vid, i) => {
    if (i === activeIdx || i === activeIdx + 1) {
      if (vid.preload !== 'auto') vid.preload = 'auto';
    }
  });
}

// ============================================================================
// FRAME ENGINE (exact seeking & video playback)
// ============================================================================
let currentFrame = 1751; // default to Dec 2025
let currentYear = 2025;
let currentMonth = 11;
let isSeeking = false;
let pendingFrame = null;
let isPlaying = false;
let currentPlaybackRate = 2.0;

function frameToYearMonth(f) {
  const clamped = Math.max(0, Math.min(MAX_FRAME, f));
  return {
    year: 1880 + Math.floor(clamped / 12),
    month: clamped % 12
  };
}

function getClipForFrame(f) {
  for (let i = 0; i < CLIPS.length; i++) {
    if (f >= CLIPS[i].first && f <= CLIPS[i].last) {
      return { clip: CLIPS[i], index: i };
    }
  }
  return { clip: CLIPS[CLIPS.length - 1], index: CLIPS.length - 1 };
}

function showFrame(f) {
  const targetFrame = Math.max(0, Math.min(MAX_FRAME, f));
  currentFrame = targetFrame;
  const ym = frameToYearMonth(targetFrame);
  currentYear = ym.year;
  currentMonth = ym.month;

  updateTimelineUI(targetFrame, ym.year, ym.month);

  if (isSeeking) {
    pendingFrame = targetFrame;
    return;
  }

  const { clip, index } = getClipForFrame(targetFrame);
  activeClipIdx = index;
  updateClipPreloads(index);
  const video = clipVideos[index];

  if (!video) {
    renderCurrentFrameCanvases(null);
    dispatchFrameChange(targetFrame, ym.year, ym.month);
    return;
  }

  isSeeking = true;
  const targetTime = (targetFrame - clip.first) / FPS + (0.5 / FPS);

  const onSeeked = () => {
    video.removeEventListener('seeked', onSeeked);
    renderCurrentFrameCanvases(video);
    isSeeking = false;
    dispatchFrameChange(targetFrame, ym.year, ym.month);

    if (pendingFrame !== null) {
      const nextF = pendingFrame;
      pendingFrame = null;
      showFrame(nextF);
    }
  };

  video.addEventListener('seeked', onSeeked, { once: true });
  video.currentTime = targetTime;
}

function renderCurrentFrameCanvases(video) {
  if (video && video.readyState >= 2 && displayCtx && sampleCtx) {
    try {
      displayCtx.drawImage(video, 0, 0, displayCanvas.width, displayCanvas.height);
      sampleCtx.drawImage(video, 0, 0, sampleCanvas.width, sampleCanvas.height);
      if (heatTexture) {
        heatTexture.needsUpdate = true;
      }
    } catch (e) {
      console.warn("drawImage failed on canvas:", e);
    }
  }
}

function dispatchFrameChange(frame, year, month) {
  window.dispatchEvent(new CustomEvent('framechange', {
    detail: { frame, year, month }
  }));
  refreshInspectorAndPins();
  throttledAriaAnnounce();
}

function updateTimelineUI(frame, year, month) {
  const slider = document.getElementById('year-slider');
  const display = document.getElementById('year-display');
  if (slider && parseInt(slider.value, 10) !== frame) {
    slider.value = frame;
    slider.setAttribute('aria-valuenow', frame);
  }
  if (display) {
    display.textContent = `${MONTHS[month]} ${year}`;
  }
}

// Timeline Playback
let playRafId = null;

function startPlayback() {
  if (isPlaying) return;
  isPlaying = true;
  updatePlayButtonIcon(true);
  announceAria(`Playback started at ${currentPlaybackRate}x speed`);

  const { clip, index } = getClipForFrame(currentFrame);
  activeClipIdx = index;
  const video = clipVideos[index];
  if (!video) return;

  video.playbackRate = currentPlaybackRate;
  const targetTime = (currentFrame - clip.first) / FPS;
  video.currentTime = Math.max(0, targetTime);

  video.play().catch(err => {
    console.warn("Video play failed:", err);
    stopPlayback();
  });

  lastAudioTickFrame = currentFrame;

  if ('requestVideoFrameCallback' in video) {
    const onFrame = (now, metadata) => {
      if (!isPlaying) return;
      handlePlaybackTick(video, clip, index);
      video.requestVideoFrameCallback(onFrame);
    };
    video.requestVideoFrameCallback(onFrame);
  } else {
    const loop = () => {
      if (!isPlaying) return;
      handlePlaybackTick(video, clip, index);
      playRafId = requestAnimationFrame(loop);
    };
    playRafId = requestAnimationFrame(loop);
  }
}

function handlePlaybackTick(video, clip, index) {
  const computedFrame = clip.first + Math.round(video.currentTime * FPS);
  if (computedFrame !== currentFrame && computedFrame <= MAX_FRAME) {
    currentFrame = computedFrame;
    const ym = frameToYearMonth(currentFrame);
    currentYear = ym.year;
    currentMonth = ym.month;
    updateTimelineUI(currentFrame, currentYear, currentMonth);
    renderCurrentFrameCanvases(video);
    dispatchFrameChange(currentFrame, currentYear, currentMonth);
    stepPlaybackAudio(currentFrame);
  }

  // Clip transitions
  if (video.currentTime >= video.duration - (1.0 / FPS) || computedFrame >= clip.last) {
    if (computedFrame >= MAX_FRAME || index >= CLIPS.length - 1) {
      stopPlayback();
      showFrame(MAX_FRAME);
    } else {
      switchPlaybackToNextClip(index + 1);
    }
  }
}

function switchPlaybackToNextClip(nextIdx) {
  clipVideos[activeClipIdx].pause();
  activeClipIdx = nextIdx;
  updateClipPreloads(nextIdx);
  const nextClip = CLIPS[nextIdx];
  const nextVideo = clipVideos[nextIdx];

  nextVideo.playbackRate = currentPlaybackRate;
  nextVideo.currentTime = 0;
  nextVideo.play().catch(e => console.warn(e));

  if ('requestVideoFrameCallback' in nextVideo) {
    const onFrame = () => {
      if (!isPlaying) return;
      handlePlaybackTick(nextVideo, nextClip, nextIdx);
      nextVideo.requestVideoFrameCallback(onFrame);
    };
    nextVideo.requestVideoFrameCallback(onFrame);
  }
}

function stopPlayback() {
  if (!isPlaying) return;
  isPlaying = false;
  updatePlayButtonIcon(false);
  clipVideos.forEach(v => v.pause());
  if (playRafId) {
    cancelAnimationFrame(playRafId);
    playRafId = null;
  }
  flushAccumulatedAudio();
}

function toggleTimeline() {
  if (isPlaying) stopPlayback();
  else startPlayback();
}

function updatePlayButtonIcon(playing) {
  const iconPlay = document.getElementById('icon-play');
  const iconPause = document.getElementById('icon-pause');
  const playBtn = document.getElementById('btn-timeline-play');
  if (iconPlay && iconPause) {
    iconPlay.style.display = playing ? 'none' : 'block';
    iconPause.style.display = playing ? 'block' : 'none';
  }
  if (playBtn) {
    playBtn.setAttribute('aria-label', playing ? 'Pause timeline' : 'Play timeline from 1880 to 2025');
  }
}

// Audio during playback
let lastAudioTickFrame = -1;
let yearSampleAccumulatorA = { sum: 0, count: 0 };
let yearSampleAccumulatorB = { sum: 0, count: 0 };
let yearSampleAccumulatorSelected = { sum: 0, count: 0 };

function stepPlaybackAudio(f) {
  if (!isAudioStarted) return;
  accumulatePlaybackSamples();
  const ym = frameToYearMonth(f);
  if (ym.month === 11 || f === MAX_FRAME) {
    flushAccumulatedAudio();
  }
}

function accumulatePlaybackSamples() {
  const pinA = pinsList.find(p => p.isA);
  const pinB = pinsList.find(p => p.isB);
  if (pinA) {
    const vA = sampleAt(pinA.lat, pinA.lon);
    if (vA !== null) { yearSampleAccumulatorA.sum += vA; yearSampleAccumulatorA.count++; }
  }
  if (pinB) {
    const vB = sampleAt(pinB.lat, pinB.lon);
    if (vB !== null) { yearSampleAccumulatorB.sum += vB; yearSampleAccumulatorB.count++; }
  }
  const vSel = sampleAt(currentCell.lat, currentCell.lon);
  if (vSel !== null) { yearSampleAccumulatorSelected.sum += vSel; yearSampleAccumulatorSelected.count++; }
}

function flushAccumulatedAudio() {
  if (!isAudioStarted) return;
  if (yearSampleAccumulatorA.count > 0 && synthA) {
    const avgA = yearSampleAccumulatorA.sum / yearSampleAccumulatorA.count;
    playNote(getFrequencyForValue(avgA, currentMode), synthA, '8n');
  }
  if (yearSampleAccumulatorB.count > 0 && synthB) {
    const avgB = yearSampleAccumulatorB.sum / yearSampleAccumulatorB.count;
    playNote(getFrequencyForValue(avgB, currentMode), synthB, '8n', Tone.now() + 0.12);
  }
  if (yearSampleAccumulatorSelected.count > 0 && synthSelected) {
    const avgSel = yearSampleAccumulatorSelected.sum / yearSampleAccumulatorSelected.count;
    playNote(getFrequencyForValue(avgSel, currentMode), synthSelected, '8n', Tone.now() + 0.24);
  }
  yearSampleAccumulatorA = { sum: 0, count: 0 };
  yearSampleAccumulatorB = { sum: 0, count: 0 };
  yearSampleAccumulatorSelected = { sum: 0, count: 0 };
}

// ============================================================================
// SAMPLING & COLOUR LOOKUP
// ============================================================================
const PALETTE_CONTROL_POINTS = [
  { val: -4.0, rgb: [0, 18, 230] },
  { val: -2.0, rgb: [0, 110, 245] },
  { val: -1.0, rgb: [0, 191, 255] },
  { val:  0.0, rgb: [248, 248, 248] },
  { val: +1.0, rgb: [255, 165, 0] },
  { val: +2.0, rgb: [235, 60, 20] },
  { val: +4.0, rgb: [184, 0, 0] }
];

function sampleAt(lat, lon) {
  if (!sampleCtx || !sampleCanvas) return syntheticSample(lat, lon, currentYear, currentMonth);

  const x = Math.floor(((lon + 180 + VIDEO_LNG_OFFSET) % 360) / 360 * sampleCanvas.width);
  const rawY = Math.floor((90 - lat) / 180 * sampleCanvas.height);
  const y = FLIP_V ? (sampleCanvas.height - 1 - rawY) : rawY;

  const clX = Math.max(0, Math.min(sampleCanvas.width - 1, x));
  const clY = Math.max(0, Math.min(sampleCanvas.height - 1, y));

  try {
    const pixel = sampleCtx.getImageData(clX, clY, 1, 1).data;
    const r = pixel[0], g = pixel[1], b = pixel[2];

    const luma = 0.299 * r + 0.587 * g + 0.114 * b;
    const chroma = Math.max(r, g, b) - Math.min(r, g, b);

    // Discard line pixels (coastline/borders) and unobserved grey
    if (luma < 75 && chroma < 30) return null;
    if (chroma < 10 && luma >= 125 && luma <= 175) return null;

    let bestDist = Infinity;
    let bestVal = 0;
    for (let i = 0; i < PALETTE_CONTROL_POINTS.length - 1; i++) {
      const p1 = PALETTE_CONTROL_POINTS[i];
      const p2 = PALETTE_CONTROL_POINTS[i + 1];
      for (let step = 0; step <= 10; step++) {
        const t = step / 10;
        const testR = p1.rgb[0] * (1 - t) + p2.rgb[0] * t;
        const testG = p1.rgb[1] * (1 - t) + p2.rgb[1] * t;
        const testB = p1.rgb[2] * (1 - t) + p2.rgb[2] * t;
        const dist = (r - testR) ** 2 + (g - testG) ** 2 + (b - testB) ** 2;
        if (dist < bestDist) {
          bestDist = dist;
          bestVal = p1.val * (1 - t) + p2.val * t;
        }
      }
    }
    return Math.round(bestVal * 100) / 100;
  } catch (err) {
    return syntheticSample(lat, lon, currentYear, currentMonth);
  }
}

function syntheticSample(lat, lon, year, month) {
  const normLat = lat / 90.0;
  const warming = Math.max(0, (year - 1880) / 145) * 1.5;
  const seasonal = Math.cos((month - 6) / 12 * Math.PI * 2) * (lat > 0 ? 0.8 : -0.8);
  const arcticAmp = normLat > 0.6 ? 1.4 : 1.0;
  return Math.round((warming * arcticAmp + seasonal * 0.3) * 100) / 100;
}

// ============================================================================
// SOUND ENGINE (Tone.js)
// ============================================================================
let isAudioStarted = false;
let synthA, synthB, synthSelected;
let pannerA, pannerB;
let masterVolume;

function initTone() {
  if (isAudioStarted || typeof Tone === 'undefined') return;
  Tone.start().then(() => {
    isAudioStarted = true;
    pannerA = new Tone.Panner(-0.8).toDestination();
    pannerB = new Tone.Panner(0.8).toDestination();

    synthA = new Tone.Synth({
      oscillator: { type: 'sine' },
      envelope: { attack: 0.05, decay: 0.2, sustain: 0.3, release: 0.8 }
    }).connect(pannerA);

    synthB = new Tone.Synth({
      oscillator: { type: 'sine' },
      envelope: { attack: 0.05, decay: 0.2, sustain: 0.3, release: 0.8 }
    }).connect(pannerB);

    synthSelected = new Tone.Synth({
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.03, decay: 0.15, sustain: 0.2, release: 0.5 }
    }).toDestination();

    Tone.Destination.volume.value = Tone.gainToDb(0.75 * 0.25);
  }).catch(e => console.warn("Tone start blocked:", e));
}

const PENTATONIC_SCALE = [
  'C3', 'D3', 'E3', 'G3', 'A3',
  'C4', 'D4', 'E4', 'G4', 'A4',
  'C5', 'D5', 'E5', 'G5', 'A5',
  'C6'
];

function getFrequencyForValue(val, mode) {
  if (val === null || isNaN(val)) return 'C4';
  const clamped = Math.max(-ANOMALY_RANGE, Math.min(ANOMALY_RANGE, val));
  const norm = (clamped + ANOMALY_RANGE) / (ANOMALY_RANGE * 2);
  const idx = Math.floor(norm * (PENTATONIC_SCALE.length - 1));
  return PENTATONIC_SCALE[idx];
}

function playNote(freq, synth = synthSelected, duration = '8n', time = undefined) {
  if (!isAudioStarted || !synth) return;
  try {
    if (time !== undefined) synth.triggerAttackRelease(freq, duration, time);
    else synth.triggerAttackRelease(freq, duration);
  } catch (err) {}
}

let scrubAudioTimer = null;
function throttledScrubAudio() {
  if (!isAudioStarted) return;
  if (scrubAudioTimer) return;
  scrubAudioTimer = setTimeout(() => {
    scrubAudioTimer = null;
    const val = sampleAt(currentCell.lat, currentCell.lon);
    if (val !== null) playNote(getFrequencyForValue(val, currentMode));
  }, 120);
}

// ============================================================================
// SCENE & GLOBE (Google Earth photorealistic setup)
// ============================================================================
let myGlobe;
let scene, camera, renderer, controls;
let GLOBE_RADIUS = 100;
let sunLight, ambLight;
const SUN_POSITION = new THREE.Vector3(-300.0, 170.0, 200.0);

function initGlobe() {
  const container = document.getElementById('globe-container');
  if (!container || typeof Globe !== 'function') return;

  // 1) SCENE: Start from globe.gl defaults, realistic blue marble
  myGlobe = Globe()(container)
    .globeImageUrl('https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg')
    .bumpImageUrl('https://unpkg.com/three-globe/example/img/earth-topology.png')
    .showAtmosphere(false) // We add custom Google Earth atmosphere below
    .pointOfView({ lat: 20, lng: 78, altitude: 2.2 });

  scene = myGlobe.scene();
  camera = myGlobe.camera();
  renderer = myGlobe.renderer();
  controls = myGlobe.controls();
  GLOBE_RADIUS = myGlobe.getGlobeRadius();

  // Configure Earth surface material (MeshPhongMaterial)
  const earthMat = myGlobe.globeMaterial();
  if (earthMat) {
    earthMat.bumpScale = 6;
    earthMat.shininess = 6;
    earthMat.specular = new THREE.Color(0x111111);
    earthMat.color = new THREE.Color(0x1a4f8a); // Fallback ocean colour
  }

  // Renderer settings
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  if (renderer.outputEncoding !== undefined) {
    renderer.outputEncoding = THREE.sRGBEncoding;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

  // Remove any default lights and add directional + ambient
  const existingLights = [];
  scene.traverse(obj => { if (obj.isLight) existingLights.push(obj); });
  existingLights.forEach(l => { if (l.parent) l.parent.remove(l); });

  sunLight = new THREE.DirectionalLight(0xffffff, 2.6);
  sunLight.position.copy(SUN_POSITION);
  scene.add(sunLight);

  ambLight = new THREE.AmbientLight(0xffffff, 0.28);
  scene.add(ambLight);

  // 2) STARS (Milky Way background)
  initStarfield();

  // 3) SHADOW (Terminator darkness)
  initShadowTerminator();

  // 4) CLOUDS
  initClouds();

  // 5) ATMOSPHERE (Thin, pale edge)
  initAtmosphere();

  // 6) HEAT OVERLAY
  initVideoHeatOverlay();

  // Navigation, borders, pins, and controls
  initBordersConfig();
  initLabelsConfig();
  initPins();
  initGlobeTooltip();
  initSelectionRing();

  myGlobe.onGlobeClick(({ lat, lng }) => {
    selectCell(lat, lng, true, false);
  });

  window.addEventListener('resize', () => {
    myGlobe.width(window.innerWidth).height(window.innerHeight);
    if (camera) {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
    }
  });

  // Hide loading pill once globe is ready
  const loader = document.getElementById('earth-loader');
  if (loader) {
    setTimeout(() => {
      loader.style.opacity = '0';
      setTimeout(() => { loader.style.display = 'none'; }, 400);
    }, 1200);
  }
}

// ============================================================================
// STARS
// ============================================================================
function initStarfield() {
  const texLoader = new THREE.TextureLoader();
  texLoader.load(
    'assets/starfield.jpg',
    (texture) => {
      texture.mapping = THREE.EquirectangularReflectionMapping;
      if (texture.encoding !== undefined) texture.encoding = THREE.sRGBEncoding;
      scene.background = texture;
    },
    undefined,
    (err) => {
      console.warn('Starfield image failed to load, falling back to pure black:', err);
      scene.background = new THREE.Color(0x000000);
    }
  );

  // Camera settings: FOV 45, far plane 5000
  if (camera) {
    camera.fov = 45;
    camera.far = 5000;
    camera.updateProjectionMatrix();
  }
}

// ============================================================================
// EARTH (Base Map Modes: Realistic & Data view)
// ============================================================================
function setBaseMapMode(mode) {
  baseMapMode = mode;
  const btnReal = document.getElementById('btn-view-realistic');
  const btnData = document.getElementById('btn-view-data');
  if (btnReal && btnData) {
    btnReal.classList.toggle('active', mode === 'realistic');
    btnReal.setAttribute('aria-selected', mode === 'realistic' ? 'true' : 'false');
    btnData.classList.toggle('active', mode === 'data');
    btnData.setAttribute('aria-selected', mode === 'data' ? 'true' : 'false');
  }

  const graticuleCheck = document.getElementById('toggle-graticule');
  if (mode === 'data') {
    if (graticuleCheck) {
      graticuleCheck.checked = true;
      isGraticuleActive = true;
    }
    if (typeof myGlobe.showGraticules === 'function') myGlobe.showGraticules(true);
    if (cloudsMesh) cloudsMesh.visible = false;
  } else {
    if (graticuleCheck) {
      graticuleCheck.checked = false;
      isGraticuleActive = false;
    }
    if (typeof myGlobe.showGraticules === 'function') myGlobe.showGraticules(false);
    if (cloudsMesh) cloudsMesh.visible = true;
  }

  // Border colors
  if (typeof myGlobe.polygonStrokeColor === 'function') {
    myGlobe.polygonStrokeColor(d => mode === 'data' ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.35)');
  }
}

// ============================================================================
// SHADOW (Soft Terminator Independent of Earth Texture)
// ============================================================================
let shadowMat, shadowMesh;

function initShadowTerminator() {
  shadowMat = new THREE.ShaderMaterial({
    uniforms: {
      uOpacity: { value: 1.0 },
      uSunDir: { value: SUN_POSITION.clone().normalize() }
    },
    vertexShader: `
      varying vec3 vNormalW;
      void main() {
        vNormalW = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec3 vNormalW;
      uniform float uOpacity;
      uniform vec3 uSunDir;
      void main() {
        float d = dot(normalize(vNormalW), uSunDir);
        float dark = 1.0 - smoothstep(-0.30, 0.55, d);
        gl_FragColor = vec4(0.0, 0.01, 0.03, dark * 0.92 * uOpacity);
      }
    `,
    transparent: true,
    depthWrite: false,
    side: THREE.FrontSide
  });

  shadowMesh = new THREE.Mesh(
    new THREE.SphereGeometry(GLOBE_RADIUS * 1.004, 64, 64),
    shadowMat
  );
  shadowMesh.renderOrder = 2;
  scene.add(shadowMesh);
}

// ============================================================================
// CLOUDS
// ============================================================================
let cloudMat, cloudsMesh;

function initClouds() {
  cloudMat = new THREE.MeshLambertMaterial({
    transparent: true,
    opacity: 0.7,
    depthWrite: false
  });

  cloudsMesh = new THREE.Mesh(
    new THREE.SphereGeometry(GLOBE_RADIUS * 1.008, 64, 64),
    cloudMat
  );
  cloudsMesh.renderOrder = 3;
  scene.add(cloudsMesh);

  const texLoader = new THREE.TextureLoader();
  texLoader.load(
    'https://unpkg.com/three-globe/example/clouds/clouds.png',
    (tex) => {
      cloudMat.map = tex;
      cloudMat.alphaMap = tex;
      cloudMat.needsUpdate = true;
    },
    undefined,
    () => {
      texLoader.load('earth_clouds_vibrant.png', (fallbackTex) => {
        cloudMat.map = fallbackTex;
        cloudMat.alphaMap = fallbackTex;
        cloudMat.needsUpdate = true;
      });
    }
  );
}

// ============================================================================
// ATMOSPHERE (Thin, Pale Limb Edge)
// ============================================================================
let atmosMat, atmosMesh;

function initAtmosphere() {
  atmosMat = new THREE.ShaderMaterial({
    uniforms: {
      uSunDir: { value: SUN_POSITION.clone().normalize() }
    },
    vertexShader: `
      varying vec3 vNormal;
      varying vec3 vWorldNormal;
      void main() {
        vNormal = normalize(normalMatrix * normal);
        vWorldNormal = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec3 vNormal;
      varying vec3 vWorldNormal;
      uniform vec3 uSunDir;
      void main() {
        float edge = clamp(0.70 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 0.0, 1.0);
        float intensity = pow(edge, 4.0) * 0.5;
        float sunLimb = smoothstep(-0.2, 0.5, dot(normalize(vWorldNormal), uSunDir));
        intensity *= sunLimb;
        gl_FragColor = vec4(vec3(0.45, 0.68, 1.0) * intensity, intensity);
      }
    `,
    side: THREE.BackSide,
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthWrite: false
  });

  atmosMesh = new THREE.Mesh(
    new THREE.SphereGeometry(GLOBE_RADIUS * 1.05, 64, 64),
    atmosMat
  );
  atmosMesh.renderOrder = 4;
  scene.add(atmosMesh);
}

// ============================================================================
// HEAT OVERLAY (Smooth 5x5 Masked Blur Shader)
// ============================================================================
let heatTexture, heatMaterial, heatMesh;

function initVideoHeatOverlay() {
  if (!displayCanvas) return;
  heatTexture = new THREE.CanvasTexture(displayCanvas);
  if (heatTexture.encoding !== undefined) heatTexture.encoding = THREE.sRGBEncoding;
  heatTexture.generateMipmaps = false;
  heatTexture.minFilter = THREE.LinearFilter;
  heatTexture.magFilter = THREE.LinearFilter;

  heatMaterial = new THREE.ShaderMaterial({
    uniforms: {
      map: { value: heatTexture },
      uOpacity: { value: heatOpacity },
      uTexel: { value: new THREE.Vector2(1.0 / 2048.0, 1.0 / 1024.0) },
      uLngOffset: { value: VIDEO_LNG_OFFSET / 360.0 },
      uFlipV: { value: FLIP_V }
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D map;
      uniform float uOpacity;
      uniform vec2 uTexel;
      uniform float uLngOffset;
      uniform bool uFlipV;
      varying vec2 vUv;

      void sampleTexel(vec2 uvCoord, out vec3 rgb, out float w) {
        vec4 c = texture2D(map, uvCoord);
        rgb = c.rgb;
        float luma = dot(rgb, vec3(0.299, 0.587, 0.114));
        float maxC = max(rgb.r, max(rgb.g, rgb.b));
        float minC = min(rgb.r, min(rgb.g, rgb.b));
        float chroma = maxC - minC;

        bool isLine = (luma < 0.30 && chroma < 0.12);
        bool isNoData = (chroma < 0.035 && luma >= 0.50 && luma <= 0.68);
        w = (isLine || isNoData) ? 0.0 : 1.0;
      }

      void main() {
        vec2 baseUv = vUv;
        if (uFlipV) baseUv.y = 1.0 - baseUv.y;
        baseUv.x = fract(baseUv.x + uLngOffset);

        float weights[5];
        weights[0] = 0.06136;
        weights[1] = 0.24477;
        weights[2] = 0.38774;
        weights[3] = 0.24477;
        weights[4] = 0.06136;

        vec3 accRgb = vec3(0.0);
        float totalWeight = 0.0;
        float maxWeight = 0.0;

        for (int i = -2; i <= 2; i++) {
          for (int j = -2; j <= 2; j++) {
            float wG = weights[i + 2] * weights[j + 2];
            maxWeight += wG;
            vec2 offset = vec2(float(i) * 3.0 * uTexel.x, float(j) * 3.0 * uTexel.y);
            vec2 sampleUv = baseUv + offset;
            sampleUv.x = fract(sampleUv.x);
            sampleUv.y = clamp(sampleUv.y, 0.0, 1.0);

            vec3 sRgb;
            float sW;
            sampleTexel(sampleUv, sRgb, sW);
            accRgb += sRgb * (sW * wG);
            totalWeight += sW * wG;
          }
        }

        if (totalWeight < 0.15) discard;

        vec3 finalRgb = accRgb / totalWeight;
        float alpha = uOpacity * smoothstep(0.15, 0.50, totalWeight / maxWeight);
        gl_FragColor = vec4(finalRgb, alpha);
      }
    `,
    side: THREE.FrontSide,
    transparent: true,
    depthWrite: false
  });

  heatMesh = new THREE.Mesh(
    new THREE.SphereGeometry(GLOBE_RADIUS * 1.003, 128, 128),
    heatMaterial
  );
  heatMesh.rotation.y = -Math.PI / 2;
  heatMesh.renderOrder = 1;
  scene.add(heatMesh);
}

// ============================================================================
// PINS & SELECTION RING (Occlusion Handling)
// ============================================================================
let pinsList = [
  { id: 'pin-a', lat: 48.8, lon: 2.3, name: 'Paris', isA: true, isB: false, color: '#00e5ff' },
  { id: 'pin-b', lat: 28.6, lon: 77.2, name: 'Delhi', isA: false, isB: true, color: '#facc15' }
];

let currentCell = { lat: 20.0, lon: 78.0 };
let currentMode = 'anomaly'; // 'anomaly' | 'absolute'

function latLonToVector3(lat, lon, radius) {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  const x = -(radius * Math.sin(phi) * Math.cos(theta));
  const z = (radius * Math.sin(phi) * Math.sin(theta));
  const y = (radius * Math.cos(phi));
  return new THREE.Vector3(x, y, z);
}

function createPinMarkerElement(pin) {
  const el = document.createElement('div');
  el.className = 'globe-pin-marker';
  el.dataset.pinId = pin.id;
  const color = pin.color || (pin.isA ? '#00e5ff' : pin.isB ? '#facc15' : '#ff7a45');
  const letter = pin.isA ? 'A' : (pin.isB ? 'B' : '');
  const textColor = pin.isB ? '#0d1117' : '#ffffff';

  el.innerHTML = `
    <svg width="18" height="22" viewBox="0 0 18 22" fill="none">
      <path d="M9 0C4.03 0 0 4.03 0 9c0 6.5 9 13 9 13s9-6.5 9-13c0-4.97-4.03-9-9-9z" fill="${color}" stroke="#ffffff" stroke-width="1.2"/>
      <text x="9" y="12" text-anchor="middle" font-size="9" font-weight="700" fill="${textColor}">${letter}</text>
    </svg>
    <div class="pin-tooltip">${pin.name}</div>
  `;

  el.addEventListener('click', (e) => {
    e.stopPropagation();
    selectCell(pin.lat, pin.lon, true, false);
  });
  return el;
}

function initPins() {
  pinsList.forEach(p => { p.el = createPinMarkerElement(p); });
  if (myGlobe && typeof myGlobe.htmlElementsData === 'function') {
    myGlobe
      .htmlElementsData(pinsList)
      .htmlLat(d => d.lat)
      .htmlLng(d => d.lon)
      .htmlElement(d => d.el)
      .htmlAltitude(0.001);
  }
}

function initSelectionRing() {
  const ring = document.getElementById('selection-ring');
  if (ring) ring.style.display = 'none';
}

function updateOcclusionAndRings() {
  if (!camera || !myGlobe) return;
  const camDir = camera.position.clone().normalize();

  // Hide pins on far side of globe (dot < 0.12)
  pinsList.forEach(pin => {
    if (!pin.el) return;
    const ptDir = latLonToVector3(pin.lat, pin.lon, 1.0).normalize();
    const dot = camDir.dot(ptDir);
    pin.el.style.display = dot < 0.12 ? 'none' : 'block';
  });

  // Screen-space selection ring (14px circle)
  const ring = document.getElementById('selection-ring');
  if (ring && currentCell && currentCell.lat !== undefined) {
    const selDir = latLonToVector3(currentCell.lat, currentCell.lon, 1.0).normalize();
    const dot = camDir.dot(selDir);
    if (dot < 0.12) {
      ring.style.display = 'none';
    } else {
      const pt = latLonToVector3(currentCell.lat, currentCell.lon, GLOBE_RADIUS);
      pt.project(camera);
      if (pt.z > 1.0) {
        ring.style.display = 'none';
      } else {
        const x = (pt.x * 0.5 + 0.5) * window.innerWidth;
        const y = (-(pt.y * 0.5) + 0.5) * window.innerHeight;
        ring.style.left = `${x}px`;
        ring.style.top = `${y}px`;
        ring.style.display = 'block';
      }
    }
  }
}

function initGlobeTooltip() {
  const tooltipEl = document.getElementById('globe-tooltip');
  if (!tooltipEl || !renderer || !renderer.domElement) return;

  const domEl = renderer.domElement;
  domEl.addEventListener('mousemove', (e) => {
    if (!myGlobe || !camera) return;
    const coords = myGlobe.toGlobeCoords(e.clientX, e.clientY);
    if (!coords) {
      tooltipEl.style.display = 'none';
      return;
    }

    const camDir = camera.position.clone().normalize();
    const ptDir = latLonToVector3(coords.lat, coords.lng, 1.0).normalize();
    if (camDir.dot(ptDir) < 0.12) {
      tooltipEl.style.display = 'none';
      return;
    }

    const val = sampleAt(coords.lat, coords.lng);
    const country = getCountryAt(coords.lat, coords.lng) || 'Open Ocean';
    const tempStr = val !== null ? `${val > 0 ? '+' : ''}${val.toFixed(2)} °C (approx.)` : 'No data';

    tooltipEl.innerHTML = `
      <div class="tooltip-title">${country} (${coords.lat.toFixed(1)}°, ${coords.lng.toFixed(1)}°)</div>
      <div class="tooltip-value">${tempStr}</div>
      <div class="tooltip-date">${MONTHS[currentMonth]} ${currentYear}</div>
    `;
    tooltipEl.style.left = `${e.clientX + 14}px`;
    tooltipEl.style.top = `${e.clientY + 14}px`;
    tooltipEl.style.display = 'block';
  });

  domEl.addEventListener('mouseleave', () => {
    tooltipEl.style.display = 'none';
  });
}

// ============================================================================
// TOOLBAR & SEARCH (Nominatim Geocoding)
// ============================================================================
let lastSearchTime = 0;

async function searchPlace(query) {
  if (!query || !query.trim()) return;
  const msgEl = document.getElementById('search-msg');

  const now = Date.now();
  if (now - lastSearchTime < 1000) {
    await new Promise(r => setTimeout(r, 1000 - (now - lastSearchTime)));
  }
  lastSearchTime = Date.now();

  if (msgEl) {
    msgEl.textContent = 'Searching...';
    msgEl.style.display = 'block';
  }

  try {
    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(query.trim())}`;
    const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
    if (!res.ok) throw new Error('Search failed');
    const data = await res.json();

    if (data && data.length > 0) {
      if (msgEl) msgEl.style.display = 'none';
      const lat = parseFloat(data[0].lat);
      const lng = parseFloat(data[0].lon);
      if (myGlobe) {
        myGlobe.pointOfView({ lat, lng, altitude: 0.25 }, 1500);
      }
      setTimeout(() => {
        selectCell(lat, lng, true, false);
      }, 700);
      announceAria(`Found and selected ${data[0].display_name}`);
    } else {
      if (msgEl) {
        msgEl.textContent = 'No results';
        msgEl.style.display = 'block';
        setTimeout(() => { if (msgEl.textContent === 'No results') msgEl.style.display = 'none'; }, 3000);
      }
      announceAria('No search results found');
    }
  } catch (err) {
    console.warn('Geocoding search failed:', err);
    if (msgEl) {
      msgEl.textContent = 'Search unavailable';
      msgEl.style.display = 'block';
      setTimeout(() => { msgEl.style.display = 'none'; }, 3000);
    }
  }
}

// ============================================================================
// SIDE CONTROLS (Zoom, Reset View, My Location)
// ============================================================================
function zoomBy(deltaAlt) {
  if (!myGlobe) return;
  const pov = myGlobe.pointOfView();
  const newAlt = Math.max(0.08, Math.min(4.0, pov.altitude + deltaAlt));
  myGlobe.pointOfView({ altitude: newAlt }, 300);
}

function resetView() {
  if (!myGlobe) return;
  myGlobe.pointOfView({ lat: 20, lng: 78, altitude: 2.2 }, 1200);
}

function goToMyLocation() {
  if (!navigator.geolocation) {
    showCompareToast('Geolocation is not supported by your browser');
    return;
  }
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      if (myGlobe) {
        myGlobe.pointOfView({ lat, lng, altitude: 0.35 }, 1500);
        setTimeout(() => selectCell(lat, lng, true, false), 700);
      }
      announceAria('Centered on your location');
    },
    (err) => {
      showCompareToast('Could not retrieve your location');
    }
  );
}

// ============================================================================
// INSPECTOR
// ============================================================================
function showInspector() {
  const insp = document.getElementById('inspector');
  if (insp) {
    insp.style.display = 'block';
    insp.setAttribute('aria-hidden', 'false');
  }
}

function hideInspector() {
  const insp = document.getElementById('inspector');
  if (insp) {
    insp.style.display = 'none';
    insp.setAttribute('aria-hidden', 'true');
  }
}

function selectCell(lat, lon, triggerAudio = true, shouldFly = false) {
  currentCell = { lat, lon };
  updateOcclusionAndRings();

  if (shouldFly && myGlobe) {
    const curAlt = myGlobe.pointOfView().altitude;
    myGlobe.pointOfView({ lat, lng: lon, altitude: curAlt }, 600);
  }

  const val = sampleAt(lat, lon);
  const latStr = `${Math.abs(lat).toFixed(2)}°${lat >= 0 ? 'N' : 'S'}`;
  const lonStr = `${Math.abs(lon).toFixed(2)}°${lon >= 0 ? 'E' : 'W'}`;
  const placeName = getCountryAt(lat, lon) || 'Open Ocean';

  const placeEl = document.getElementById('inspector-place');
  if (placeEl) placeEl.textContent = placeName;

  const coordsEl = document.getElementById('cursor-coords');
  if (coordsEl) coordsEl.textContent = `Lat ${latStr}, Lon ${lonStr}`;

  const valEl = document.getElementById('cursor-value');
  if (valEl) valEl.textContent = val !== null ? `${val > 0 ? '+' : ''}${val}` : 'No data';

  showInspector();

  if (val === null) {
    if (triggerAudio) announceAria('No data for this location and month');
  } else {
    if (triggerAudio && isAudioStarted) playNote(getFrequencyForValue(val, currentMode));
  }
}

function refreshInspectorAndPins() {
  if (currentCell && currentCell.lat !== undefined) {
    const val = sampleAt(currentCell.lat, currentCell.lon);
    const valEl = document.getElementById('cursor-value');
    if (valEl) valEl.textContent = val !== null ? `${val > 0 ? '+' : ''}${val}` : 'No data';
  }
  updatePinDisplays();
}

function updatePinDisplays() {
  const pinA = pinsList.find(p => p.isA) || pinsList[0];
  const pinB = pinsList.find(p => p.isB) || pinsList[1];
  const valA = sampleAt(pinA.lat, pinA.lon);
  const valB = sampleAt(pinB.lat, pinB.lon);
  const labelA = pinA.name || getCountryAt(pinA.lat, pinA.lon) || 'Point A';
  const labelB = pinB.name || getCountryAt(pinB.lat, pinB.lon) || 'Point B';

  const pinAEl = document.getElementById('pin-a-val');
  if (pinAEl) pinAEl.textContent = `${labelA} • ${valA !== null ? (valA > 0 ? '+' : '') + valA + ' °C' : 'No Data'}`;

  const pinBEl = document.getElementById('pin-b-val');
  if (pinBEl) pinBEl.textContent = `${labelB} • ${valB !== null ? (valB > 0 ? '+' : '') + valB + ' °C' : 'No Data'}`;

  const diffEl = document.getElementById('pin-ab-diff');
  if (diffEl) {
    if (valA !== null && valB !== null) {
      const diff = (valB - valA).toFixed(2);
      const sign = Number(diff) >= 0 ? 'warmer' : 'cooler';
      diffEl.textContent = `B is ${Math.abs(diff)}°C ${sign} than A (approximate)`;
      diffEl.style.display = 'block';
    } else {
      diffEl.style.display = 'none';
    }
  }

  const sameWarn = document.getElementById('same-place-warn');
  if (sameWarn) {
    const isSame = Math.abs(pinA.lat - pinB.lat) < 0.1 && Math.abs(pinA.lon - pinB.lon) < 0.1;
    sameWarn.hidden = !isSame;
  }
}

function comparePins() {
  initTone();
  const pinA = pinsList.find(p => p.isA) || pinsList[0];
  const pinB = pinsList.find(p => p.isB) || pinsList[1];
  const valA = sampleAt(pinA.lat, pinA.lon);
  const valB = sampleAt(pinB.lat, pinB.lon);

  if (valA !== null && synthA) {
    playNote(getFrequencyForValue(valA, currentMode), synthA, '4n');
  }
  if (valB !== null && synthB && typeof Tone !== 'undefined') {
    playNote(getFrequencyForValue(valB, currentMode), synthB, '4n', Tone.now() + 0.28);
  }

  const diffStr = (valA !== null && valB !== null)
    ? `A: ${valA > 0 ? '+' : ''}${valA}°C, B: ${valB > 0 ? '+' : ''}${valB}°C`
    : 'Data missing for comparison';
  showCompareToast(`Comparing: ${diffStr}`);
}

function playLegend() {
  initTone();
  if (typeof Tone === 'undefined') return;
  const values = [-4.0, -2.0, -1.0, 0.0, 1.0, 2.0, 4.0];
  values.forEach((v, idx) => {
    playNote(getFrequencyForValue(v, currentMode), synthSelected, '8n', Tone.now() + idx * 0.22);
  });
  announceAria('Playing temperature sonification scale from cold to warm');
}

function describeView() {
  const pinA = pinsList.find(p => p.isA) || pinsList[0];
  const pinB = pinsList.find(p => p.isB) || pinsList[1];
  const val = sampleAt(currentCell.lat, currentCell.lon);
  const valA = sampleAt(pinA.lat, pinA.lon);
  const valB = sampleAt(pinB.lat, pinB.lon);
  const diff = (valA !== null && valB !== null) ? (valB - valA).toFixed(2) : null;
  const compStr = diff !== null
    ? `(${Math.abs(diff)}°C ${Number(diff) > 0 ? 'warmer at B' : 'warmer at A'})`
    : '(comparison unavailable)';

  const summary = `In ${MONTHS[currentMonth]} ${currentYear} (${currentMode} mode), selected point at Lat ${currentCell.lat.toFixed(2)}°, Lon ${currentCell.lon.toFixed(2)}° is ${val !== null ? (val > 0 ? '+' : '') + val + '°C' : 'no data'}. Pin A is ${valA !== null ? valA + '°C' : 'no data'}, Pin B is ${valB !== null ? valB + '°C' : 'no data'} ${compStr}. Source: NASA GISTEMP v4 monthly anomaly.`;

  const sb = document.getElementById('summary-box');
  if (sb) sb.textContent = summary;
  const drawer = document.getElementById('drawer-help');
  if (drawer) drawer.style.display = 'block';
  announceAria(summary);
}

// ============================================================================
// DOCK & UI CONTROLS
// ============================================================================
let openPopoverEl = null;

function togglePopover(id, btn) {
  const target = document.getElementById(id);
  if (!target) return;
  const isHidden = target.hidden || target.style.display === 'none';
  closeAllPopovers();
  if (isHidden) {
    target.hidden = false;
    target.style.display = 'block';
    if (btn) btn.setAttribute('aria-expanded', 'true');
    openPopoverEl = target;
  }
}

function closeAllPopovers() {
  document.querySelectorAll('.popover-card').forEach(p => {
    p.hidden = true;
    p.style.display = 'none';
  });
  document.querySelectorAll('[aria-expanded="true"]').forEach(b => {
    b.setAttribute('aria-expanded', 'false');
  });
  openPopoverEl = null;
}

let toastTimer = null;
function showCompareToast(msg) {
  const toast = document.getElementById('compare-toast');
  if (!toast) return;
  toast.textContent = msg;
  toast.hidden = false;
  toast.style.display = 'block';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.hidden = true;
    toast.style.display = 'none';
  }, 5000);
}

function announceAria(msg) {
  const el = document.getElementById('aria-status');
  if (el) el.textContent = msg;
}

let ariaDebounceTimer = null;
function throttledAriaAnnounce() {
  clearTimeout(ariaDebounceTimer);
  ariaDebounceTimer = setTimeout(() => {
    const pinA = pinsList.find(p => p.isA) || pinsList[0];
    const valA = sampleAt(pinA.lat, pinA.lon);
    if (valA !== null) {
      const sign = valA >= 0 ? 'warmer than' : 'cooler than';
      announceAria(`${MONTHS[currentMonth]} ${currentYear}. Pin A ${Math.abs(valA)} degrees ${sign} baseline, approximately.`);
    }
  }, 800);
}

// Borders and labels configuration
let cachedCountriesGeoJSON = null;
let countryFeatures = [];

function initBordersConfig() {
  if (myGlobe && typeof myGlobe.polygonsData === 'function') {
    myGlobe
      .polygonCapColor(() => 'rgba(0,0,0,0)')
      .polygonSideColor(() => 'rgba(0,0,0,0)')
      .polygonStrokeColor(d => baseMapMode === 'data' ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.35)')
      .polygonAltitude(0.0006)
      .polygonsTransitionDuration(0);
  }
}

function initLabelsConfig() {
  if (myGlobe && typeof myGlobe.labelsData === 'function') {
    myGlobe
      .labelLat(d => d.lat)
      .labelLng(d => d.lng)
      .labelText(d => d.text)
      .labelSize(0.7)
      .labelDotRadius(0.1)
      .labelColor(() => '#ffffff')
      .labelAltitude(0.002);
  }
}

async function loadWorldBorders() {
  try {
    const res = await fetch('https://cdn.jsdelivr.net/gh/nvkelso/natural-earth-vector@master/geojson/ne_50m_admin_0_countries.geojson');
    const data = await res.json();
    if (data && data.features) {
      cachedCountriesGeoJSON = data;
      countryFeatures = data.features;
      if (myGlobe && isBordersActive) {
        myGlobe.polygonsData(data.features);
      }
    }
  } catch (err) {
    console.warn('Natural earth vector offline, checking local atlas:', err);
  }
}

function getCountryAt(lat, lon) {
  if (!countryFeatures || countryFeatures.length === 0 || typeof d3 === 'undefined') return null;
  for (let i = 0; i < countryFeatures.length; i++) {
    const feat = countryFeatures[i];
    if (d3.geoContains(feat, [lon, lat])) {
      return feat.properties ? (feat.properties.NAME || feat.properties.name || feat.properties.ADMIN) : null;
    }
  }
  return null;
}

function updateAltitudeScale() {
  if (!myGlobe) return;
  const alt = myGlobe.pointOfView().altitude;
  const km = Math.round(alt * 6371 / 100) * 100;
  const altEl = document.getElementById('altitude-scale');
  if (altEl) altEl.textContent = `Altitude ~ ${km.toLocaleString()} km`;
}

function initUI() {
  // Start overlay
  const btnStart = document.getElementById('btn-start');
  if (btnStart) {
    btnStart.onclick = () => {
      initTone();
      const overlay = document.getElementById('start-overlay');
      if (overlay) overlay.style.display = 'none';
      selectCell(currentCell.lat, currentCell.lon, true, false);
    };
  }

  // Search box
  const searchForm = document.getElementById('search-form');
  const searchInput = document.getElementById('search-input');
  if (searchForm && searchInput) {
    searchForm.onsubmit = (e) => {
      e.preventDefault();
      searchPlace(searchInput.value);
    };
  }

  // Toolbar action buttons
  const btnLayers = document.getElementById('btn-layers');
  if (btnLayers) btnLayers.onclick = (e) => { e.stopPropagation(); togglePopover('popover-layers', btnLayers); };

  const btnPins = document.getElementById('btn-pins');
  if (btnPins) {
    btnPins.onclick = () => {
      const insp = document.getElementById('inspector');
      if (insp.style.display === 'none') showInspector();
      else hideInspector();
    };
  }

  const btnTbCompare = document.getElementById('btn-tb-compare');
  if (btnTbCompare) btnTbCompare.onclick = comparePins;

  const btnTbDescribe = document.getElementById('btn-tb-describe');
  if (btnTbDescribe) btnTbDescribe.onclick = describeView;

  const btnVolume = document.getElementById('btn-volume');
  if (btnVolume) btnVolume.onclick = (e) => { e.stopPropagation(); togglePopover('popover-volume', btnVolume); };

  const btnAbout = document.getElementById('btn-about');
  if (btnAbout) btnAbout.onclick = (e) => { e.stopPropagation(); togglePopover('popover-about', btnAbout); };

  const btnLegendInfo = document.getElementById('btn-legend-info');
  if (btnLegendInfo) btnLegendInfo.onclick = (e) => { e.stopPropagation(); togglePopover('popover-legend-info', btnLegendInfo); };

  // Base Map Mode buttons
  const btnViewReal = document.getElementById('btn-view-realistic');
  if (btnViewReal) btnViewReal.onclick = () => setBaseMapMode('realistic');
  const btnViewData = document.getElementById('btn-view-data');
  if (btnViewData) btnViewData.onclick = () => setBaseMapMode('data');

  // Side navigation buttons
  const btnZoomIn = document.getElementById('btn-zoom-in');
  if (btnZoomIn) btnZoomIn.onclick = () => zoomBy(-0.35);

  const btnZoomOut = document.getElementById('btn-zoom-out');
  if (btnZoomOut) btnZoomOut.onclick = () => zoomBy(0.35);

  const btnResetView = document.getElementById('btn-reset-view');
  if (btnResetView) btnResetView.onclick = resetView;

  const btnMyLocation = document.getElementById('btn-my-location');
  if (btnMyLocation) btnMyLocation.onclick = goToMyLocation;

  // Anomaly | Absolute mode toggle
  const modeAnom = document.getElementById('mode-anomaly');
  const modeAbs = document.getElementById('mode-absolute');
  if (modeAnom && modeAbs) {
    modeAnom.onclick = () => {
      currentMode = 'anomaly';
      modeAnom.classList.add('active'); modeAnom.setAttribute('aria-selected', 'true');
      modeAbs.classList.remove('active'); modeAbs.setAttribute('aria-selected', 'false');
      refreshInspectorAndPins();
    };
    modeAbs.onclick = () => {
      currentMode = 'absolute';
      modeAbs.classList.add('active'); modeAbs.setAttribute('aria-selected', 'true');
      modeAnom.classList.remove('active'); modeAnom.setAttribute('aria-selected', 'false');
      refreshInspectorAndPins();
    };
  }

  // Time dock controls
  const playBtn = document.getElementById('btn-timeline-play');
  if (playBtn) playBtn.onclick = toggleTimeline;

  const slider = document.getElementById('year-slider');
  if (slider) {
    slider.oninput = (e) => {
      stopPlayback();
      const f = parseInt(e.target.value, 10);
      showFrame(f);
      throttledScrubAudio();
    };
    slider.onchange = (e) => {
      showFrame(parseInt(e.target.value, 10));
    };
  }

  document.querySelectorAll('.speed-btn').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('.speed-btn').forEach(b => {
        b.classList.remove('active');
        b.setAttribute('aria-pressed', 'false');
      });
      btn.classList.add('active');
      btn.setAttribute('aria-pressed', 'true');
      currentPlaybackRate = parseFloat(btn.dataset.speed);
      clipVideos.forEach(v => { v.playbackRate = currentPlaybackRate; });
    };
  });

  // Layer settings checkboxes
  const toggleHeat = document.getElementById('toggle-heat');
  if (toggleHeat) {
    toggleHeat.onchange = (e) => {
      isHeatActive = e.target.checked;
      if (heatMaterial) heatMaterial.uniforms.uOpacity.value = isHeatActive ? heatOpacity : 0.0;
    };
  }

  const heatSlider = document.getElementById('heat-opacity');
  const heatValEl = document.getElementById('heat-opacity-val');
  if (heatSlider && heatValEl) {
    heatSlider.oninput = (e) => {
      const v = parseInt(e.target.value, 10);
      heatOpacity = v / 100.0;
      heatValEl.textContent = `${v}%`;
      if (isHeatActive && heatMaterial) heatMaterial.uniforms.uOpacity.value = heatOpacity;
    };
  }

  const toggleGraticule = document.getElementById('toggle-graticule');
  if (toggleGraticule) {
    toggleGraticule.onchange = (e) => {
      isGraticuleActive = e.target.checked;
      if (myGlobe && typeof myGlobe.showGraticules === 'function') {
        myGlobe.showGraticules(isGraticuleActive);
      }
    };
  }

  const toggleLighting = document.getElementById('toggle-lighting');
  if (toggleLighting) {
    toggleLighting.onchange = (e) => {
      isCinematicLighting = e.target.checked;
      if (shadowMesh) shadowMesh.visible = isCinematicLighting;
      if (sunLight && ambLight) {
        sunLight.intensity = isCinematicLighting ? 2.6 : 0.8;
        ambLight.intensity = isCinematicLighting ? 0.28 : 0.8;
      }
    };
  }

  const toggleBorders = document.getElementById('toggle-borders');
  if (toggleBorders) {
    toggleBorders.onchange = (e) => {
      isBordersActive = e.target.checked;
      if (myGlobe && cachedCountriesGeoJSON) {
        myGlobe.polygonsData(isBordersActive ? cachedCountriesGeoJSON.features : []);
      }
    };
  }

  const volSlider = document.getElementById('vol-slider');
  if (volSlider) {
    volSlider.oninput = (e) => {
      if (typeof Tone !== 'undefined' && Tone.Destination) {
        Tone.Destination.volume.value = Tone.gainToDb(parseFloat(e.target.value) * 0.25);
      }
    };
  }

  // Inspector and drawer actions
  document.getElementById('btn-set-pin-a').onclick = () => {
    const pinA = pinsList.find(p => p.isA) || pinsList[0];
    pinA.lat = currentCell.lat; pinA.lon = currentCell.lon;
    pinA.name = getCountryAt(currentCell.lat, currentCell.lon) || 'Point A';
    if (myGlobe && typeof myGlobe.htmlElementsData === 'function') myGlobe.htmlElementsData([...pinsList]);
    updatePinDisplays();
    announceAria(`Pin A set to ${pinA.name}`);
  };

  document.getElementById('btn-set-pin-b').onclick = () => {
    const pinB = pinsList.find(p => p.isB) || pinsList[1];
    pinB.lat = currentCell.lat; pinB.lon = currentCell.lon;
    pinB.name = getCountryAt(currentCell.lat, currentCell.lon) || 'Point B';
    if (myGlobe && typeof myGlobe.htmlElementsData === 'function') myGlobe.htmlElementsData([...pinsList]);
    updatePinDisplays();
    announceAria(`Pin B set to ${pinB.name}`);
  };

  document.getElementById('btn-compare').onclick = comparePins;
  document.getElementById('btn-legend').onclick = playLegend;
  document.getElementById('inspector-close').onclick = hideInspector;
  document.getElementById('drawer-close').onclick = () => {
    const d = document.getElementById('drawer-help');
    if (d) d.style.display = 'none';
  };
  document.getElementById('btn-describe').onclick = describeView;

  // Close popovers on outer click
  document.addEventListener('click', (e) => {
    if (openPopoverEl && !openPopoverEl.contains(e.target)) {
      closeAllPopovers();
    }
  });

  // Global Keyboard Shortcuts
  window.addEventListener('keydown', (e) => {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;

    if (e.key === 'Escape') {
      closeAllPopovers();
      hideInspector();
      const d = document.getElementById('drawer-help');
      if (d) d.style.display = 'none';
      return;
    }

    if (e.key === ' ' || e.code === 'Space') {
      e.preventDefault();
      toggleTimeline();
      return;
    }

    if (e.key === '+' || e.key === '=') {
      zoomBy(-0.35);
      return;
    }
    if (e.key === '-' || e.key === '_') {
      zoomBy(0.35);
      return;
    }

    if (e.key === 'a' || e.key === 'A') {
      document.getElementById('btn-set-pin-a').click();
      return;
    }
    if (e.key === 'b' || e.key === 'B') {
      document.getElementById('btn-set-pin-b').click();
      return;
    }

    if (e.key === 'ArrowRight') {
      e.preventDefault();
      stopPlayback();
      const step = e.shiftKey ? 12 : 1;
      showFrame(Math.min(MAX_FRAME, currentFrame + step));
      throttledScrubAudio();
      return;
    }
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      stopPlayback();
      const step = e.shiftKey ? 12 : 1;
      showFrame(Math.max(0, currentFrame - step));
      throttledScrubAudio();
      return;
    }

    if (e.key === 'Home') {
      e.preventDefault();
      stopPlayback();
      showFrame(0);
      return;
    }
    if (e.key === 'End') {
      e.preventDefault();
      stopPlayback();
      showFrame(MAX_FRAME);
      return;
    }

    if (e.key === 'p' || e.key === 'P') {
      const name = getCountryAt(currentCell.lat, currentCell.lon) || 'Pinned Location';
      const newPin = {
        id: 'pin-' + Date.now(),
        lat: currentCell.lat,
        lon: currentCell.lon,
        name,
        isA: false,
        isB: false,
        color: '#ff7a45'
      };
      newPin.el = createPinMarkerElement(newPin);
      pinsList.push(newPin);
      if (myGlobe && typeof myGlobe.htmlElementsData === 'function') myGlobe.htmlElementsData([...pinsList]);
      announceAria(`Pinned ${name}`);
    }
  });
}

// Animation loop
function animate() {
  requestAnimationFrame(animate);

  if (controls) controls.update();

  const alt = myGlobe ? myGlobe.pointOfView().altitude : 1.0;

  // Cloud rotation & fade
  if (cloudsMesh && cloudMat) {
    if (baseMapMode === 'realistic') {
      const cloudFade = Math.max(0.0, Math.min(1.0, (alt - 0.35) / 0.55));
      cloudMat.opacity = 0.7 * cloudFade;
      cloudsMesh.visible = cloudMat.opacity > 0.01;
      if (cloudsMesh.visible) cloudsMesh.rotation.y += 0.00005;
    } else {
      cloudsMesh.visible = false;
    }
  }

  // Shadow fade below altitude 0.5
  if (shadowMat && shadowMat.uniforms.uOpacity) {
    const shadowFade = Math.max(0.0, Math.min(1.0, (alt - 0.35) / 0.15));
    shadowMat.uniforms.uOpacity.value = shadowFade;
  }

  // Update pin markers & screen-space selection ring occlusion
  updateOcclusionAndRings();

  // Update camera altitude readout
  updateAltitudeScale();
}

// Page initialization
window.onload = async () => {
  try {
    initVideoSources();
  } catch (err) {
    console.error('initVideoSources failed:', err);
  }
  try {
    initGlobe();
  } catch (err) {
    console.error('initGlobe failed:', err);
  }
  try {
    initUI();
  } catch (err) {
    console.error('initUI failed:', err);
  }

  showFrame(currentFrame);
  await loadWorldBorders();
  animate();
};
