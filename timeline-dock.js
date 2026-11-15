// ============================================================================
// TIMELINE DOCK (1900–2025) for Thermophone Earth
// ============================================================================

(function () {
  'use strict';

  const MIN_YEAR = 1900;
  const MAX_YEAR = 2025;
  const DEFAULT_YEAR = 2025;
  const SPEEDS = [1, 2, 5, 10];

  let viewerInstance = null;
  let currentYear = DEFAULT_YEAR;
  let isPlaying = false;
  let speedIndex = 0; // 1x
  let playTimer = null;
  const changeCallbacks = [];

  // DOM Elements
  let dockEl = null;
  let sliderEl = null;
  let yearDisplayEl = null;
  let playBtnEl = null;
  let playIconEl = null;
  let pauseIconEl = null;
  let speedBtnEl = null;

  function injectStyles() {
    if (document.getElementById('tl-dock-styles')) return;
    const style = document.createElement('style');
    style.id = 'tl-dock-styles';
    style.textContent = `
      .tl-dock {
        position: absolute;
        bottom: 16px;
        left: 50%;
        transform: translateX(-50%);
        width: calc(100% - 460px);
        max-width: 540px;
        min-width: 300px;
        height: 52px;
        background-color: var(--surface, #1f1f23);
        border: 1px solid var(--border, rgba(255, 255, 255, 0.08));
        border-radius: 26px;
        box-shadow: var(--shadow, 0 2px 8px rgba(0, 0, 0, 0.4));
        display: flex;
        align-items: center;
        padding: 0 14px;
        gap: 10px;
        z-index: 45;
        user-select: none;
        font-family: var(--font, "Google Sans", Roboto, Inter, system-ui, sans-serif);
        color: var(--text, #e8eaed);
        box-sizing: border-box;
      }

      .tl-dock:focus-within {
        border-color: rgba(138, 180, 248, 0.4);
      }

      .tl-btn-group {
        display: flex;
        align-items: center;
        gap: 4px;
        flex-shrink: 0;
      }

      .tl-btn {
        background: transparent;
        border: none;
        color: var(--muted, #9aa0a6);
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 0;
        border-radius: 50%;
        transition: background-color 0.15s, color 0.15s, transform 0.1s;
      }

      .tl-btn:hover {
        background-color: var(--surface-2, #2a2a2f);
        color: var(--text, #e8eaed);
      }

      .tl-btn:focus-visible {
        outline: 2px solid var(--accent, #8ab4f8);
        outline-offset: 1px;
      }

      .tl-btn-step {
        width: 28px;
        height: 28px;
      }

      .tl-btn-play {
        width: 36px;
        height: 36px;
        background-color: var(--accent, #8ab4f8);
        color: #12151c;
      }

      .tl-btn-play:hover {
        background-color: var(--accent-hover, #aecbfa);
        color: #12151c;
        transform: scale(1.05);
      }

      .tl-btn-play:active {
        transform: scale(0.95);
      }

      .tl-slider-container {
        position: relative;
        flex: 1;
        display: flex;
        flex-direction: column;
        justify-content: center;
        min-width: 120px;
      }

      .tl-slider {
        width: 100%;
        height: 4px;
        -webkit-appearance: none;
        appearance: none;
        background: var(--surface-2, #2a2a2f);
        border-radius: 2px;
        outline: none;
        cursor: pointer;
        margin: 0;
      }

      .tl-slider:focus-visible {
        outline: 2px solid var(--accent, #8ab4f8);
        outline-offset: 4px;
      }

      .tl-slider::-webkit-slider-thumb {
        -webkit-appearance: none;
        appearance: none;
        width: 14px;
        height: 14px;
        border-radius: 50%;
        background: #ffffff;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.5);
        cursor: pointer;
        transition: transform 0.1s;
      }

      .tl-slider::-webkit-slider-thumb:hover {
        transform: scale(1.2);
      }

      .tl-slider::-moz-range-thumb {
        width: 14px;
        height: 14px;
        border-radius: 50%;
        background: #ffffff;
        border: none;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.5);
        cursor: pointer;
      }

      .tl-ticks {
        display: flex;
        justify-content: space-between;
        margin-top: 4px;
        font-size: 10px;
        color: var(--muted, #9aa0a6);
        pointer-events: auto;
      }

      .tl-tick {
        cursor: pointer;
        transition: color 0.15s;
        padding: 0 2px;
      }

      .tl-tick:hover {
        color: var(--accent, #8ab4f8);
      }

      .tl-info-group {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-shrink: 0;
      }

      .tl-year-display {
        font-size: 16px;
        font-weight: 500;
        color: var(--text, #e8eaed);
        min-width: 44px;
        text-align: center;
        letter-spacing: -0.2px;
      }

      .tl-btn-speed {
        width: 32px;
        height: 24px;
        border-radius: 12px;
        background-color: var(--surface-2, #2a2a2f);
        font-size: 11px;
        font-weight: 500;
        color: var(--muted, #9aa0a6);
      }

      .tl-btn-speed:hover {
        color: var(--text, #e8eaed);
        background-color: rgba(255, 255, 255, 0.12);
      }

      @media (max-width: 768px) {
        .tl-dock {
          left: 10px;
          right: 10px;
          bottom: calc(10px + env(safe-area-inset-bottom, 0px));
          transform: none;
          width: auto;
          max-width: none;
          height: 50px;
          padding: 0 10px;
          gap: 8px;
        }
        .tl-ticks {
          display: none;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function setYear(year, notify = true) {
    const clamped = Math.max(MIN_YEAR, Math.min(MAX_YEAR, parseInt(year, 10)));
    currentYear = clamped;

    if (sliderEl && parseInt(sliderEl.value, 10) !== clamped) {
      sliderEl.value = clamped;
      sliderEl.setAttribute('aria-valuenow', clamped);
    }

    if (yearDisplayEl) {
      yearDisplayEl.textContent = clamped;
    }

    // Set Cesium clock to July 1 of that year at 12:00:00Z without auto-animating
    if (viewerInstance && viewerInstance.clock && typeof Cesium !== 'undefined' && Cesium.JulianDate) {
      try {
        viewerInstance.clock.currentTime = Cesium.JulianDate.fromIso8601(`${clamped}-07-01T12:00:00Z`);
        viewerInstance.clock.shouldAnimate = false;
      } catch (err) {
        console.warn('EarthTimeline: failed to update Cesium clock currentTime:', err);
      }
    }

    if (notify) {
      changeCallbacks.forEach(fn => {
        try { fn(clamped); } catch (e) { console.error('EarthTimeline callback error:', e); }
      });
      window.dispatchEvent(new CustomEvent('timeline:change', {
        detail: { year: clamped }
      }));
    }
  }

  function stepYear(delta) {
    let next = currentYear + delta;
    if (next > MAX_YEAR) next = MIN_YEAR; // Loop back
    else if (next < MIN_YEAR) next = MAX_YEAR;
    setYear(next);
  }

  function startPlayback() {
    if (isPlaying) return;
    isPlaying = true;
    updatePlayButtonState();
    const speed = SPEEDS[speedIndex];
    const intervalMs = Math.max(80, Math.round(800 / speed));

    playTimer = setInterval(() => {
      let next = currentYear + 1;
      if (next > MAX_YEAR) {
        next = MIN_YEAR; // Loop from 2025 back to 1900
      }
      setYear(next);
    }, intervalMs);
  }

  function stopPlayback() {
    if (!isPlaying) return;
    isPlaying = false;
    updatePlayButtonState();
    if (playTimer) {
      clearInterval(playTimer);
      playTimer = null;
    }
  }

  function togglePlay() {
    if (isPlaying) stopPlayback();
    else startPlayback();
  }

  function cycleSpeed() {
    speedIndex = (speedIndex + 1) % SPEEDS.length;
    const speed = SPEEDS[speedIndex];
    if (speedBtnEl) {
      speedBtnEl.textContent = `${speed}\u00D7`;
      speedBtnEl.setAttribute('aria-label', `Playback speed ${speed}x`);
    }
    if (isPlaying) {
      stopPlayback();
      startPlayback();
    }
  }

  function updatePlayButtonState() {
    if (!playBtnEl || !playIconEl || !pauseIconEl) return;
    if (isPlaying) {
      playIconEl.style.display = 'none';
      pauseIconEl.style.display = 'block';
      playBtnEl.setAttribute('aria-label', 'Pause timeline');
    } else {
      playIconEl.style.display = 'block';
      pauseIconEl.style.display = 'none';
      playBtnEl.setAttribute('aria-label', 'Play timeline');
    }
  }

  function buildDOM() {
    dockEl = document.createElement('div');
    dockEl.className = 'tl-dock';
    dockEl.setAttribute('role', 'region');
    dockEl.setAttribute('aria-label', 'Timeline navigation (1900-2025)');

    // Playback Controls (Prev, Play/Pause, Next)
    const btnGroup = document.createElement('div');
    btnGroup.className = 'tl-btn-group';

    const prevBtn = document.createElement('button');
    prevBtn.type = 'button';
    prevBtn.className = 'tl-btn tl-btn-step tl-step-prev';
    prevBtn.setAttribute('aria-label', 'Previous year');
    prevBtn.title = 'Previous year (Left arrow)';
    prevBtn.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <polyline points="15 18 9 12 15 6"></polyline>
      </svg>
    `;
    prevBtn.onclick = () => stepYear(-1);

    playBtnEl = document.createElement('button');
    playBtnEl.type = 'button';
    playBtnEl.className = 'tl-btn tl-btn-play';
    playBtnEl.setAttribute('aria-label', 'Play timeline');
    playBtnEl.title = 'Play/Pause timeline (Space)';
    playBtnEl.innerHTML = `
      <svg class="tl-icon-play" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <polygon points="6 4 20 12 6 20 6 4"></polygon>
      </svg>
      <svg class="tl-icon-pause" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style="display:none;">
        <rect x="6" y="4" width="4" height="16"></rect>
        <rect x="14" y="4" width="4" height="16"></rect>
      </svg>
    `;
    playIconEl = playBtnEl.querySelector('.tl-icon-play');
    pauseIconEl = playBtnEl.querySelector('.tl-icon-pause');
    playBtnEl.onclick = togglePlay;

    const nextBtn = document.createElement('button');
    nextBtn.type = 'button';
    nextBtn.className = 'tl-btn tl-btn-step tl-step-next';
    nextBtn.setAttribute('aria-label', 'Next year');
    nextBtn.title = 'Next year (Right arrow)';
    nextBtn.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <polyline points="9 18 15 12 9 6"></polyline>
      </svg>
    `;
    nextBtn.onclick = () => stepYear(1);

    btnGroup.appendChild(prevBtn);
    btnGroup.appendChild(playBtnEl);
    btnGroup.appendChild(nextBtn);

    // Slider and Ticks
    const sliderContainer = document.createElement('div');
    sliderContainer.className = 'tl-slider-container';

    sliderEl = document.createElement('input');
    sliderEl.type = 'range';
    sliderEl.className = 'tl-slider';
    sliderEl.min = String(MIN_YEAR);
    sliderEl.max = String(MAX_YEAR);
    sliderEl.step = '1';
    sliderEl.value = String(currentYear);
    sliderEl.setAttribute('aria-label', 'Year timeline slider');
    sliderEl.setAttribute('aria-valuemin', String(MIN_YEAR));
    sliderEl.setAttribute('aria-valuemax', String(MAX_YEAR));
    sliderEl.setAttribute('aria-valuenow', String(currentYear));

    sliderEl.oninput = (e) => {
      stopPlayback();
      setYear(parseInt(e.target.value, 10));
    };

    const ticksEl = document.createElement('div');
    ticksEl.className = 'tl-ticks';
    ticksEl.setAttribute('aria-hidden', 'true');
    const tickYears = [1900, 1925, 1950, 1975, 2000, 2025];
    tickYears.forEach(yr => {
      const span = document.createElement('span');
      span.className = 'tl-tick';
      span.textContent = yr;
      span.onclick = () => {
        stopPlayback();
        setYear(yr);
      };
      ticksEl.appendChild(span);
    });

    sliderContainer.appendChild(sliderEl);
    sliderContainer.appendChild(ticksEl);

    // Info Group (Big Year Display + Speed Button)
    const infoGroup = document.createElement('div');
    infoGroup.className = 'tl-info-group';

    yearDisplayEl = document.createElement('span');
    yearDisplayEl.className = 'tl-year-display';
    yearDisplayEl.setAttribute('aria-live', 'polite');
    yearDisplayEl.setAttribute('aria-atomic', 'true');
    yearDisplayEl.textContent = String(currentYear);

    speedBtnEl = document.createElement('button');
    speedBtnEl.type = 'button';
    speedBtnEl.className = 'tl-btn tl-btn-speed';
    speedBtnEl.setAttribute('aria-label', 'Playback speed 1x');
    speedBtnEl.title = 'Change playback speed';
    speedBtnEl.textContent = '1\u00D7';
    speedBtnEl.onclick = cycleSpeed;

    infoGroup.appendChild(yearDisplayEl);
    infoGroup.appendChild(speedBtnEl);

    dockEl.appendChild(btnGroup);
    dockEl.appendChild(sliderContainer);
    dockEl.appendChild(infoGroup);

    // Keydown conflicts resolved: handle Space, Arrows, Home, End ONLY when focus is inside the dock
    dockEl.addEventListener('keydown', (e) => {
      if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        e.stopPropagation();
        togglePlay();
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
        e.preventDefault();
        e.stopPropagation();
        stopPlayback();
        stepYear(-1);
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
        e.preventDefault();
        e.stopPropagation();
        stopPlayback();
        stepYear(1);
      } else if (e.key === 'Home') {
        e.preventDefault();
        e.stopPropagation();
        stopPlayback();
        setYear(MIN_YEAR);
      } else if (e.key === 'End') {
        e.preventDefault();
        e.stopPropagation();
        stopPlayback();
        setYear(MAX_YEAR);
      }
    });

    document.body.appendChild(dockEl);
  }

  // Public EarthTimeline API
  window.EarthTimeline = {
    init: function (options) {
      if (options && options.viewer) {
        viewerInstance = options.viewer;
      }
      injectStyles();
      buildDOM();
      setYear(DEFAULT_YEAR, false);
      return this;
    },

    setYear: function (year) {
      setYear(year, true);
    },

    getYear: function () {
      return currentYear;
    },

    play: function () {
      startPlayback();
    },

    pause: function () {
      stopPlayback();
    },

    togglePlay: function () {
      togglePlay();
    },

    onChange: function (callback) {
      if (typeof callback === 'function') {
        changeCallbacks.push(callback);
      }
    }
  };
})();
