# Thermophone: Hear the Heat

An interactive 3D planetary climate sonification web application for the NASA Space Apps Challenge (Earth Jukebox) that turns global temperature anomalies into sound.

Live Demo: https://mobin72090.github.io/Juke-Box/

---

## Running Locally

> **Important**: The application must be served over an HTTP web server (`http://localhost:8000/`). Browsers block reading canvas pixels from video elements on the `file://` protocol due to CORS security restrictions.

### Option 1: Quick Launch Scripts
- **Windows**: Double-click `run.bat`
- **Linux / macOS**: Run `./run.sh`

### Option 2: Command Line
```bash
# Python
python -m http.server 8000

# Node.js
npx serve .
```

Open **`http://localhost:8000/`** in your browser.

---

## NASA GISTEMP Video Temperature Layer

Thermophone maps historical planetary monthly temperature anomalies (1880–2025) directly from official NASA GISTEMP equirectangular video clips located in `./media/`:

| Clip | Timeline Seconds | Calendar Years | Frames |
| :--- | :--- | :--- | :--- |
| `GISTEMP_part01.mp4` | 0 – 8 s | 1880 – 1899 | 0 – 239 |
| `GISTEMP_part02.mp4` | 8 – 14 s | 1900 – 1914 | 240 – 419 |
| `GISTEMP_part03.mp4` | 14 – 22 s | 1915 – 1934 | 420 – 659 |
| `GISTEMP_part04.mp4` | 22 – 28 s | 1935 – 1949 | 660 – 839 |
| `GISTEMP_part05.mp4` | 28 – 36 s | 1950 – 1969 | 840 – 1079 |
| `GISTEMP_part06.mp4` | 36 – 42 s | 1970 – 1984 | 1080 – 1259 |
| `GISTEMP_part07.mp4` | 42 – 50 s | 1985 – 2004 | 1260 – 1499 |
| `GISTEMP_part08.mp4` | 50 – 56 s | 2005 – 2019 | 1500 – 1679 |
| `GISTEMP_part09.mp4` | 56 – 60 s | 2020 – 2025 | 1680 – 1799 |

* **Framerate**: 30 fps
* **Cadence**: 12 frames per year (1 frame per calendar month)
* **Resolution**: 4096 × 2048 px equirectangular (lng -180 at left edge, lat +90 at top)

---

## Configuration & Tuning (`main.js`)

You can customize the following configuration constants directly at the top of `main.js`:

```javascript
// Maximum anomaly scale range in °C (default: 4.0 °C).
// Values are sampled from the map's diverging blue-white-red color gradient.
const ANOMALY_RANGE = 4;

// Longitudinal alignment offset in degrees (default: 0).
// Adjust if you want to rotate the temperature layer relative to the base Earth.
const VIDEO_LNG_OFFSET = 0;

// Vertical texture orientation (default: false).
// Set to true if texture appears upside down.
const FLIP_V = false;

// Maximum interactive frame index (default: 1751 for Dec 2025).
// Frames 1752-1799 are hold frames and are ignored.
const MAX_FRAME = 1751;
```

---

## Sight-to-Sound Mapping

Temperatures sampled from the map color are mapped across 36 semitones, snapping to the nearest note in a C major pentatonic scale ($f = 130.81 \times 2^{n/12}\text{ Hz}$) anchored at C3:
- **Pin A** uses a sine synthesizer in the left stereo channel.
- **Pin B** uses a triangle synthesizer in the right stereo channel.
- **Timeline Playback**: When playing through the timeline, yearly mean anomalies are accumulated and sounded per calendar year.
- **Volume Cap**: Master volume is capped at -12 dB.

---

## Keyboard Controls

| Key | Action |
| :--- | :--- |
| <kbd>&larr;</kbd> / <kbd>&rarr;</kbd> | Step backward / forward by 1 month |
| <kbd>Shift</kbd> + <kbd>&larr;</kbd> / <kbd>&rarr;</kbd> | Step backward / forward by 1 year (12 months) |
| <kbd>Home</kbd> / <kbd>End</kbd> | Jump to start (Jan 1880) / end (Dec 2025) |
| <kbd>Space</kbd> | Play / pause video timeline |
| <kbd>A</kbd> / <kbd>B</kbd> | Set Pin A / Pin B to selected point |
| <kbd>P</kbd> | Pin currently selected point |
| <kbd>G</kbd> | Toggle alignment debug markers (0,0 Green & Guntur Yellow) |
| <kbd>D</kbd> | Toggle debug HUD |
| <kbd>Esc</kbd> | Close panels / popovers |
