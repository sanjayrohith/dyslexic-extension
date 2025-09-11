/*
 * Guardian Reader - background script
 * Responsibilities:
 *  - Initialize & persist default settings in browser.storage.local.
 *  - Respond to messages from content scripts (fetch settings, speak word, settings updated broadcast).
 *  - Handle text-to-speech via window.speechSynthesis (available in MV2 background page context).
 *  - Provide a single source of truth for current settings.
 */

// Default settings (can be extended). Sensitivity works as multiplier (lower = more sensitive)
const DEFAULT_SETTINGS = {
  sensitivity: 1.0, // 1.0 = baseline, 0.7 = more sensitive, 1.3 = less
  responseMode: 'zoom_bg_tts', // 'zoom', 'zoom_bg', 'zoom_bg_tts'
  zoomScale: 2.0,
  zoomDurationMs: 2500,
  fontChoice: 'OpenDyslexic', // 'Default', 'OpenDyslexic', 'Verdana'
  theme: 'yellow_on_black', // 'yellow_on_black', 'black_on_white', 'sepia'
  enableTTS: true,
  enableBackground: true,
  enableFontOverride: true,
  cooldownMs: 4000, // prevent repeat triggers on same word quickly
  triggerButton: 'middle', // 'left' | 'middle' | 'right'
  holdDelayMs: 500 // time user must hold button before popup shows
};

let currentSettings = { ...DEFAULT_SETTINGS };

// Initialize storage with defaults if missing
browser.storage.local.get().then(data => {
  if (!data || Object.keys(data).length === 0) {
    browser.storage.local.set(DEFAULT_SETTINGS);
    currentSettings = { ...DEFAULT_SETTINGS };
  } else {
    currentSettings = { ...DEFAULT_SETTINGS, ...data };
  }
});

browser.runtime.onMessage.addListener(async (msg) => {
  if (!msg || !msg.type) return;

  switch (msg.type) {
    case 'GR_GET_SETTINGS': {
      const stored = await browser.storage.local.get('grSettings');
      const settings = { ...DEFAULT_SETTINGS, ...(stored.grSettings || {}) };
      return { settings };
    }
    case 'GR_SPEAK': {
      // Text-to-speech logic. NOTE: Firefox uses speechSynthesis; voices availability varies.
      if (currentSettings.enableTTS && msg.word) {
        try {
          const utter = new SpeechSynthesisUtterance(msg.word);
          utter.rate = 0.9; // Slightly slower for clarity
          // TODO: Allow user-configurable voice, rate, pitch.
          window.speechSynthesis.cancel(); // Cancel any ongoing speech for responsiveness.
          window.speechSynthesis.speak(utter);
        } catch (e) {
          console.warn('[Guardian Reader] TTS error:', e);
        }
      }
      break;
    }
    case 'GR_SAVE_SETTINGS': {
      const updated = { ...DEFAULT_SETTINGS, ...(msg.settings || {}) };
      await browser.storage.local.set({ grSettings: updated });
      browser.tabs.query({}).then(tabs => {
        for (const t of tabs) browser.tabs.sendMessage(t.id, { type: 'GR_SETTINGS_UPDATED', settings: updated }).catch(()=>{});
      });
      return { ok: true };
    }
    default:
      break;
  }
  // Indicate async response possibility false (we responded inline when needed)
  return true;
});
