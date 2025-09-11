# Guardian Reader (Firefox Extension)

Assist users with dyslexia, ADHD, and low vision by detecting reading struggle gestures (circular mouse movement, jitter, long hover) and providing adaptive support: zoomed word popup, contrast/background adjustments, dyslexia-friendly font, and optional text-to-speech.

## Features (Initial Prototype)
1. Injected content script on all pages tracks mouse movement over words.
2. Heuristic gesture detection (circular, jittery zig-zag, long hover >2s) marks a word as potentially difficult.
3. When triggered, displays a large readable popup near cursor with optional high-contrast background, custom font (OpenDyslexic, Verdana), and TTS playback.
4. Options page allows user configuration of sensitivity, response mode, zoom scale & duration, font, and theme.
5. Preferences stored in `browser.storage.local` and broadcast to active tabs on change.

## File Structure
| File | Purpose |
|------|---------|
| `manifest.json` | Firefox MV2 manifest (MV3 TBD) |
| `background.js` | Settings persistence & TTS handling |
| `content.js` | Gesture tracking & overlay rendering |
| `options.html` / `options.js` | User settings UI |
| `style.css` | Shared overlay & (font) styles |

## Development Notes
Gesture detection uses simple heuristics and MUST be refined:
* Circular: Accumulated angle ~>=300° with low radius variance.
* Jitter: Many direction reversals within small bounding span & time window.
* Long hover: Time over word > threshold (2s * sensitivity).

Adjust thresholds in `content.js` (`BASE_THRESHOLDS`). Add telemetry (respecting privacy) or debug overlay (optional) during tuning.

## Sensitivity
User sensitivity scales primary time windows (lower = more sensitive). More nuanced scaling may be added (e.g., per-pattern scaling).

## Text-to-Speech
Uses `speechSynthesis` from background page (MV2). For MV3 migration, a dedicated hidden page or in-page TTS fallback is needed (service workers lack speechSynthesis access).

## Privacy
No external data transmission. All processing is local. Avoid logging actual words in production builds.

## TODO / Enhancement Ideas
* Fine-tune gesture thresholds with user studies.
* Add keyboard shortcut to replay last word.
* Provide per-language voice selection & rate/pitch controls.
* Add option to show syllable breakdown or phonetic hints.
* Respect prefers-reduced-motion: disable transformations if set.
* Provide debug panel (toggle) showing detection metrics.
* Cache OpenDyslexic locally instead of remote URL for offline & CSP safety.
* Add tests for gesture classifiers (extract pure functions & unit test).
* Optional: integrate with selection events for screen reader synergy.

## Loading in Firefox (Temporary Add-On)
1. Open `about:debugging#/runtime/this-firefox`.
2. Click "Load Temporary Add-on".
3. Select the `manifest.json` file in this folder.
4. Visit a page, hover & gesture around a word to test.

## License
Source code: MIT (adjust as desired). OpenDyslexic font under SIL Open Font License.

---
Prototype state – not production-ready. Expect threshold tuning & performance refinements.
