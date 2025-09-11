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
  triggerButton: 'middle',
  holdDelayMs: 500
};

let settings = { ...DEFAULT_SETTINGS };
let lastTriggerTime = 0;
let lastWord = '';
let overlayEl = null;
let hideTimer = null;
let holdTimer = null;
let holdContext = null; // { word, range, clientX, clientY, triggered }

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

  // Desired final scale
  const scale = settings.zoomScale || 2.0;
  overlay.style.transformOrigin = 'top center';

  // Prepare for measurement & animation
  overlay.style.visibility = 'hidden';
  overlay.style.opacity = '0';
  overlay.style.whiteSpace = 'nowrap';
  overlay.style.lineHeight = '1.2';
  overlay.style.left = clientX + 'px';
  overlay.style.top = (clientY + 18) + 'px'; // place below pointer with slight gap
  overlay.style.transform = 'translateX(-50%) scale(0.85)';

  // Force layout to ensure width available for potential clamping
  void overlay.offsetWidth; // reflow

  const vpW = window.innerWidth;
  const rect = overlay.getBoundingClientRect();
  // Clamp horizontally if off-screen when centered
  if (rect.left < 4) {
    overlay.style.left = (rect.width / 2 + 4) + 'px';
  } else if (rect.right > vpW - 4) {
    overlay.style.left = (vpW - rect.width / 2 - 4) + 'px';
  }
  overlay.style.visibility = 'visible';
  requestAnimationFrame(() => {
    overlay.style.opacity = '1';
    overlay.style.transform = `translateX(-50%) scale(${scale})`;
  });

  // Store scale for later cursor-follow updates
  overlay.dataset.scale = String(scale);

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
  if (settings.triggerButton === 'auto') return false; // auto mode ignores button presses
  switch (settings.triggerButton) {
    case 'left': return e.button === 0;
    case 'right': return e.button === 2;
    case 'middle': return e.button === 1;
    default: return e.button === 1;
  }
}

function onMouseDown(e) {
  if (!buttonMatches(e)) return;
  if (holdTimer) { clearTimeout(holdTimer); holdTimer = null; }
  const wordInfo = getWordAtPoint(e.clientX, e.clientY);
  if (!wordInfo || !wordInfo.word) { holdContext = null; return; }
  holdContext = { word: wordInfo.word, range: wordInfo.range, clientX: e.clientX, clientY: e.clientY, triggered: false };
  const delay = settings.holdDelayMs || 500;
  holdTimer = setTimeout(() => {
    if (!holdContext) return;
    // Prevent default actions (like middle auto-scroll or link open) only when activation actually fires
    if (settings.triggerButton === 'right') document.addEventListener('contextmenu', suppressOnce, true);
    showWord(holdContext.word, holdContext.range, holdContext.clientX, holdContext.clientY);
    holdContext.triggered = true;
  }, delay);
}

function onMouseUp(e) {
  if (!buttonMatches(e)) return;
  if (holdTimer) { clearTimeout(holdTimer); holdTimer = null; }
  if (holdContext && holdContext.triggered) {
    // Hide immediately on release (or keep until duration? choose immediate for responsiveness)
    hideOverlay();
  }
  holdContext = null;
}

function onMouseLeaveDoc() {
  if (holdTimer) { clearTimeout(holdTimer); holdTimer = null; }
  holdContext = null;
  hideOverlay();
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
document.addEventListener('mouseup', onMouseUp, true);
document.addEventListener('mouseleave', onMouseLeaveDoc, true);

// --- Auto Hover Mode ---
let lastHoverWord = null;
function handleAutoHover(e) {
  if (settings.triggerButton !== 'auto') return; // only act in auto mode
  const wordInfo = getWordAtPoint(e.clientX, e.clientY);
  if (!wordInfo || !wordInfo.word) {
    if (holdTimer) { clearTimeout(holdTimer); holdTimer = null; }
    lastHoverWord = null;
    return;
  }
  // If moved to a different word, reset timer
  if (wordInfo.word !== lastHoverWord) {
    lastHoverWord = wordInfo.word;
    if (holdTimer) clearTimeout(holdTimer);
    holdContext = { word: wordInfo.word, range: wordInfo.range, clientX: e.clientX, clientY: e.clientY, triggered: false };
    const delay = settings.holdDelayMs || 500;
    holdTimer = setTimeout(() => {
      if (!holdContext || holdContext.word !== lastHoverWord) return;
      showWord(holdContext.word, holdContext.range, holdContext.clientX, holdContext.clientY);
      holdContext.triggered = true;
    }, delay);
  } else if (holdContext && holdContext.triggered) {
    // Update position gently if cursor moves slightly within same word
    holdContext.clientX = e.clientX;
    holdContext.clientY = e.clientY;
  }
}

document.addEventListener('mousemove', handleAutoHover, true);

// --- Cursor follow for hold-based activation ---
function updateOverlayPosition(x, y) {
  if (!overlayEl || overlayEl.style.opacity === '0') return;
  // Keep centered below pointer
  overlayEl.style.left = x + 'px';
  overlayEl.style.top = (y + 18) + 'px';
  // Clamp horizontally
  const rect = overlayEl.getBoundingClientRect();
  const vpW = window.innerWidth;
  if (rect.left < 4) {
    overlayEl.style.left = (rect.width / 2 + 4) + 'px';
  } else if (rect.right > vpW - 4) {
    overlayEl.style.left = (vpW - rect.width / 2 - 4) + 'px';
  }
}

function handleFollowMove(e) {
  // For button hold modes
  if (settings.triggerButton !== 'auto') {
    if (holdContext && holdContext.triggered) {
      updateOverlayPosition(e.clientX, e.clientY);
    }
  } else {
    // Auto mode: if triggered, follow as pointer moves within same word
    if (holdContext && holdContext.triggered) {
      updateOverlayPosition(e.clientX, e.clientY);
    }
  }
}

document.addEventListener('mousemove', handleFollowMove, true);
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
