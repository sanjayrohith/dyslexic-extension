// Options page logic for Guardian Reader
// Loads settings from storage, populates form, saves changes back and notifies background.

const form = document.getElementById('options-form');
const statusEl = document.getElementById('status');

const fields = [
  'sensitivity','responseMode','zoomScale','zoomDurationMs','fontChoice','theme','enableTTS','enableBackground','enableFontOverride','cooldownMs','holdDelayMs'
];

const triggerButtonEl = document.getElementById('triggerButton');

function load() {
  browser.storage.local.get().then(data => {
    fields.forEach(f => {
      const el = document.getElementById(f);
      if (!el) return;
      if (el.type === 'checkbox') {
        el.checked = data[f] !== undefined ? data[f] : false;
      } else if (el.tagName === 'SELECT' || el.type === 'number' || el.type === 'text') {
        if (data[f] !== undefined) el.value = data[f];
      }
    });
  triggerButtonEl.value = data.triggerButton || 'middle';
  const holdDelayEl = document.getElementById('holdDelayMs');
  if (holdDelayEl) holdDelayEl.value = data.holdDelayMs !== undefined ? data.holdDelayMs : 500;
  });
}

function save(e) {
  e.preventDefault();
  const settings = {};
  fields.forEach(f => {
    const el = document.getElementById(f);
    if (!el) return;
    if (el.type === 'checkbox') settings[f] = el.checked;
    else if (el.type === 'number') settings[f] = parseFloat(el.value);
    else settings[f] = el.value;
  });
  const newSettings = {
    ...settings,
    triggerButton: triggerButtonEl.value
  };
  browser.runtime.sendMessage({ type: 'GR_SAVE_SETTINGS', settings: newSettings }).then(() => {
    statusEl.textContent = 'Saved.';
    setTimeout(()=>statusEl.textContent = '', 2000);
  });
}

form.addEventListener('submit', save);
document.addEventListener('DOMContentLoaded', load);
