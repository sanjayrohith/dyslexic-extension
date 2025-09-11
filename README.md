<div align="center">

<h1>🛡️ Guardian Reader</h1>
<p><strong>A lightweight accessibility companion for Firefox that enlarges, clarifies, and optionally speaks difficult words on any page.</strong></p>

<p>
<em>Designed to support readers with dyslexia, ADHD, low vision, or anyone who just needs a moment of focus.</em>
</p>

<!-- Screenshot: place the actual file (e.g. docs/options.png) or a repo-relative path -->
<p>
	<img src="docs/screenshot-options.png" alt="Guardian Reader Options Screenshot" width="520" />
</p>

<sub>Screenshot of the customization panel (add your own image at <code>docs/screenshot-options.png</code>).</sub>

</div>

---

## ✨ Key Features

| Feature | Description |
|---------|-------------|
| Popup Zoom | Enlarges the targeted word directly beneath the cursor with high clarity & dyslexia-friendly font. |
| Multiple Activation Modes | Hold Left / Middle / Right mouse button over a word, or optional Auto Hover (opt-in). |
| Follow Cursor | Popup smoothly follows while you keep holding or continue hovering. |
| Contrast Themes | Yellow on Black, Black on White, Sepia. |
| Dyslexia-Friendly Font | Ships with OpenDyslexic (embedded). |
| Text-to-Speech | Optional pronunciation via Web Speech API. |
| Adjustable Timing | Hold delay, zoom duration, and cooldown to prevent rapid re-triggers. |
| Persistent Preferences | Stored using `browser.storage.local`. |

---

## 🚀 Quick Start (Temporary Install)
1. Clone the repo:
	 ```bash
	 git clone https://github.com/sanjayrohith/dyslexic-extension.git
	 cd dyslexic-extension
	 ```
2. Open Firefox: navigate to `about:debugging#/runtime/this-firefox`.
3. Click **Load Temporary Add-on** → select `manifest.json`.
4. Visit any article page. Hold Middle Mouse (default) over a word until the popup appears.
5. Open the extension’s options to tweak activation method, hold delay, theme, and more.

---

## 🛠 Activation Modes
| Mode | How It Works | Use Case |
|------|--------------|----------|
| Left / Middle / Right Hold | Press & hold chosen button over a word for the configured hold delay. | Precise, intentional activation. |
| Auto (Hover) | Hover steadily over a word for the hold delay. | Hands-free exploration, low-effort reading. |

Hold delay and cooldown prevent accidental triggers and sensory overload.

---

## 🎨 Visual & Readability Enhancements
- OpenDyslexic enforced for popup text (with local font load + fallback).
- High-contrast background styles.
- Smooth scale/opacity animation; repositioning follows cursor while active.
- Planned (optional): syllable hints, phonetic support, reduced-motion mode.

---

## 🔊 Text-to-Speech
Triggered if TTS is enabled or if the response mode includes it. Uses `speechSynthesis` (availability and voices depend on OS / Firefox build). Future enhancements may include voice selection and rate controls.

---

## ⚙️ Configuration Reference
| Setting | Description |
|---------|-------------|
| Sensitivity | (Legacy from gesture prototype – currently reserved for future heuristics). |
| Response Mode | Choose visual only, visual + background, or include TTS. |
| Zoom Scale / Duration | Size and lifespan of the popup. |
| Cooldown | Minimum ms between triggers on the same word. |
| Activation Method | left / middle / right / auto (hover). |
| Hold Delay | Time the pointer must remain on word before popup shows. |
| Theme | Contrast color scheme. |
| Font Override | Enforce OpenDyslexic or revert to page font. |

---

## 📁 Project Structure
```
manifest.json        # Firefox manifest (MV2)
background.js        # Settings + TTS broker
content.js           # Activation logic, overlay rendering, cursor follow
options.html/js      # Options UI & persistence
style.css            # Overlay + font definitions
fonts/               # Local OpenDyslexic font assets
icons/               # Extension icons (48/96px)
docs/                # (Add screenshot-assets here manually)
```

---

## 🔄 Roadmap / Ideas
- Optional progress ring while holding.
- Adaptive repositioning (flip above if near viewport bottom).
- Multi-word (phrase) expansion with slight drag gesture.
- Inline syllable/phonetic breakdown (toggle).
- Voice, rate, pitch selectors for TTS.
- Export/import settings profile.
- MV3 migration (service worker + offscreen document for TTS).

---

## 🔐 Privacy & Data
All processing occurs locally. No analytics, no external calls except optional CDN font fallback (removed once bundled). Avoid logging real word content in production builds.

---

## 🧪 Development Tips
- Use `about:debugging` → Reload after code edits.
- Open DevTools → Console: look for `[Guardian Reader]` diagnostics (font load, etc.).
- Adjust `holdDelayMs` if activation feels too fast/slow.
- For hover mode, try 400–600ms delay to balance intent vs noise.

---

## 🤝 Contributing
1. Fork & branch (`feat/your-idea`).
2. Keep changes modular & documented.
3. Add/update README or inline comments where behavior shifts.
4. Open a PR—describe UX rationale for accessibility changes.

Accessibility first: prefer enhancements that reduce cognitive load and visual clutter.

---

## 📄 License
Source code: MIT (adjust if needed). OpenDyslexic font under the SIL Open Font License.

---
<sub>Made with care to reduce friction between readers and words. Suggestions welcome.</sub>

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
