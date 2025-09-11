/*
 * Guardian Reader - Middle Click Activation Version
 * Replaces prior gesture-based detection. Middle mouse button over a word triggers zoom/support.
 */

// ----- Configuration & State -----
const DEFAULT_SETTINGS = {
  sensitivity: 1.0,
  responseMode: 'zoom_background_tts', // 'zoom_only' | 'zoom_background' | 'zoom_background_tts'
  zoomScale: 2.0,
  zoomDurationMs: 2500,
  fontPreference: 'OpenDyslexic', // 'normal' | 'OpenDyslexic' | 'Verdana'
  theme: 'yellow_on_black',       // 'yellow_on_black' | 'black_on_white' | 'sepia'
  enableTTS: true,
  enableBackground: true,
  enableFontOverride: true,
  cooldownMs: 2000,
  triggerButton: 'middle'
};

let settings = { ...DEFAULT_SETTINGS };
let lastTriggerTime = 0;
let lastWord = '';
let overlayEl = null;
let hideTimer = null;

// Request settings from background
function loadSettings() {
  try {
    browser.runtime.sendMessage({ type: 'GR_GET_SETTINGS' }).then(resp => {
      if (resp && resp.settings) settings = { ...settings, ...resp.settings };
    }).catch(() => {});
  } catch (e) {}
}
loadSettings();

// Listen for settings push (if options page updates)
browser.runtime.onMessage.addListener((msg) => {
  if (msg && msg.type === 'GR_SETTINGS_UPDATED') {
    settings = { ...settings, ...msg.settings };
  }
});

// ----- Word Extraction Utility -----

function getWordAtPoint(x, y) {
  // Firefox: caretPositionFromPoint; fallback: caretRangeFromPoint
  let pos = null;
  if (document.caretPositionFromPoint) {
    pos = document.caretPositionFromPoint(x, y);
    if (!pos) return null;
    const node = pos.offsetNode;
    if (!node || node.nodeType !== Node.TEXT_NODE) return null;
    const text = node.textContent;
    if (!text) return null;
    let idx = pos.offset;
    if (idx < 0 || idx >= text.length) idx = text.length - 1;
    if (!/\w/.test(text[idx])) {
      // Move outward to nearest word char
      let left = idx - 1;
      let right = idx + 1;
      while (left >= 0 || right < text.length) {
        if (left >= 0 && /\w/.test(text[left])) { idx = left; break; }
        if (right < text.length && /\w/.test(text[right])) { idx = right; break; }
        left--; right++;
      }
      if (!/\w/.test(text[idx])) return null;
    }
    // Expand to word boundaries
    let start = idx;
    let end = idx;
    while (start > 0 && /\w/.test(text[start - 1])) start--;
    while (end < text.length - 1 && /\w/.test(text[end + 1])) end++;
    const word = text.slice(start, end + 1);
    if (!word) return null;

    // Build a range for visual position
    const range = document.createRange();
    range.setStart(node, start);
    range.setEnd(node, end + 1);
    return { word, range };
  } else if (document.caretRangeFromPoint) {
    const range = document.caretRangeFromPoint(x, y);
    if (!range) return null;
    const node = range.startContainer;
    if (!node || node.nodeType !== Node.TEXT_NODE) return null;
    const text = node.textContent;
    if (!text) return null;
    let idx = range.startOffset;
    if (idx >= text.length) idx = text.length - 1;
    if (idx < 0) return null;
    if (!/\w/.test(text[idx])) return null;
    let start = idx;
    let end = idx;
    while (start > 0 && /\w/.test(text[start - 1])) start--;
    while (end < text.length - 1 && /\w/.test(text[end + 1])) end++;
    const word = text.slice(start, end + 1);
    const wordRange = document.createRange();
    wordRange.setStart(node, start);
    wordRange.setEnd(node, end + 1);
    return { word, range: wordRange };
  }
  return null;
}

// ----- Overlay UI -----

function ensureOverlay() {
  if (overlayEl) return overlayEl;
  overlayEl = document.createElement('div');
  overlayEl.id = 'guardian-reader-overlay';
  overlayEl.setAttribute('aria-live', 'polite');
  overlayEl.style.position = 'fixed';
  overlayEl.style.zIndex = '999999';
  overlayEl.style.pointerEvents = 'none';
  overlayEl.style.transition = 'opacity 120ms ease';
  overlayEl.style.fontSize = '28px';
  overlayEl.style.padding = '6px 10px';
  overlayEl.style.borderRadius = '6px';
  overlayEl.style.boxShadow = '0 2px 6px rgba(0,0,0,0.35)';
  overlayEl.style.opacity = '0';
  document.documentElement.appendChild(overlayEl);
  return overlayEl;
}

function applyTheme(el, theme) {
  switch (theme) {
    case 'yellow_on_black':
      el.style.background = '#000';
      el.style.color = '#ffeb3b';
      break;
    case 'black_on_white':
      el.style.background = '#fff';
      el.style.color = '#000';
      break;
    case 'sepia':
      el.style.background = '#f4ecd8';
      el.style.color = '#4b3f2f';
      break;
    default:
      el.style.background = '#222';
      el.style.color = '#fff';
  }
}

function showWord(word, range, clientX, clientY) {
  const now = Date.now();
  if (now - lastTriggerTime < settings.cooldownMs && word === lastWord) return;

  lastTriggerTime = now;
  lastWord = word;

  const overlay = ensureOverlay();
  overlay.textContent = word;

  if (settings.enableBackground || /zoom_background/.test(settings.responseMode)) {
    applyTheme(overlay, settings.theme);
  } else {
    overlay.style.background = 'transparent';
    overlay.style.color = '#000';
  }

  // Force OpenDyslexic regardless of settings
  overlay.style.fontFamily = '"OpenDyslexic", "Arial", sans-serif';

  // Scale
  const scale = settings.zoomScale || 2.0;
  overlay.style.transform = `scale(${scale})`;
  overlay.style.transformOrigin = 'left top';

  // Position: prefer above word if space; fallback below; slight offset from cursor
  const rects = range.getClientRects();
  let targetRect = rects[0];
  if (!targetRect) {
    targetRect = { left: clientX, top: clientY, width: 1, height: 1 };
  }

  // Initial position near cursor
  let left = clientX + 12;
  let top = clientY - 10;

  // Keep inside viewport
  const vpW = window.innerWidth;
  const vpH = window.innerHeight;
  overlay.style.visibility = 'hidden';
  overlay.style.opacity = '0';
  overlay.style.left = '0px';
  overlay.style.top = '0px';
  overlay.style.maxWidth = '60vw';
  overlay.style.whiteSpace = 'nowrap';
  overlay.style.lineHeight = '1.2';

  // Force layout to measure
  document.body.offsetHeight; // eslint-disable-line no-unused-expressions
  const estWidth = overlay.offsetWidth * scale;
  const estHeight = overlay.offsetHeight * scale;

  if (left + estWidth > vpW - 8) left = vpW - estWidth - 8;
  if (top + estHeight > vpH - 8) top = vpH - estHeight - 8;
  if (left < 4) left = 4;
  if (top < 4) top = 4;

  overlay.style.left = `${left}px`;
  overlay.style.top = `${top}px`;
  overlay.style.visibility = 'visible';
  requestAnimationFrame(() => {
    overlay.style.opacity = '1';
  });

  if (hideTimer) clearTimeout(hideTimer);
  hideTimer = setTimeout(() => hideOverlay(), settings.zoomDurationMs || 2500);

  if (settings.enableTTS || /tts/.test(settings.responseMode)) {
    try {
      // NOTE: Background expects 'GR_SPEAK' with { word }
      browser.runtime.sendMessage({ type: 'GR_SPEAK', word });
    } catch (e) { /* swallow */ }
  }
}

function hideOverlay() {
  if (!overlayEl) return;
  overlayEl.style.opacity = '0';
  if (hideTimer) {
    clearTimeout(hideTimer);
    hideTimer = null;
  }
}

// ----- Event Handling -----

function buttonMatches(e) {
  switch (settings.triggerButton) {
    case 'left': return e.button === 0;
    case 'right': return e.button === 2;
    case 'middle':
    default: return e.button === 1;
  }
}

function onMouseDown(e) {
  if (!buttonMatches(e)) return;
  const wordInfo = getWordAtPoint(e.clientX, e.clientY);
  if (!wordInfo || !wordInfo.word) return;
  // Suppress default action only if we triggered (avoid breaking normal usage)
  e.preventDefault();
  e.stopPropagation();
  if (settings.triggerButton === 'right') {
    // Prevent context menu for this click only
    document.addEventListener('contextmenu', suppressOnce, true);
  }
  showWord(wordInfo.word, wordInfo.range, e.clientX, e.clientY);
}

function suppressOnce(ev) {
  ev.preventDefault();
  ev.stopPropagation();
  document.removeEventListener('contextmenu', suppressOnce, true);
}

function onKeyDown(e) {
  // Esc hides overlay
  if (e.key === 'Escape') hideOverlay();
}

document.addEventListener('mousedown', onMouseDown, true);
document.addEventListener('keydown', onKeyDown, true);
window.addEventListener('blur', hideOverlay);
window.addEventListener('scroll', () => hideOverlay(), { passive: true });

// Clean up on unload
window.addEventListener('unload', () => {
  document.removeEventListener('mousedown', onMouseDown, true);
  document.removeEventListener('keydown', onKeyDown, true);
});

// Robust font loading & diagnostics
// We attempt to use bundled fonts/OpenDyslexic-Regular.woff2 (must be added by user) and fall back to CDN if not present / fails.
async function ensureOpenDyslexicFont() {
  if (!('fonts' in document)) return; // Older browsers
  // Quick check if already available
  if (document.fonts.check('16px "OpenDyslexic"')) return;
  const localUrl = browser.runtime.getURL('fonts/OpenDyslexic-Regular.woff2');
  try {
    const face = new FontFace('OpenDyslexic', `url(${localUrl}) format('woff2')`, { style: 'normal', weight: '400' });
    await face.load();
    document.fonts.add(face);
    if (document.fonts.check('16px "OpenDyslexic"')) {
      console.info('[Guardian Reader] OpenDyslexic font loaded from bundled file.');
      return;
    }
  } catch (err) {
    console.warn('[Guardian Reader] Failed to load local OpenDyslexic font:', err);
  }
  // Fallback CDN (only if still not available)
  if (!document.fonts.check('16px "OpenDyslexic"')) {
    const id = 'gr-opendyslexic-cdn';
    if (!document.getElementById(id)) {
      const link = document.createElement('link');
      link.id = id;
      link.rel = 'stylesheet';
      link.href = 'https://cdn.jsdelivr.net/gh/antijingoist/open-dyslexic/alternatives/OpenDyslexic.css';
      document.documentElement.appendChild(link);
      link.addEventListener('load', () => {
        setTimeout(() => {
          console.info('[Guardian Reader] CDN OpenDyslexic loaded?', document.fonts.check('16px "OpenDyslexic"'));
        }, 300);
      });
    }
  }
}

ensureOpenDyslexicFont();

// Diagnostic: after 2s log computed font of overlay if exists
setTimeout(() => {
  if (overlayEl) {
    const cs = getComputedStyle(overlayEl);
    console.info('[Guardian Reader] Overlay font-family:', cs.fontFamily);
  }
}, 2000);
