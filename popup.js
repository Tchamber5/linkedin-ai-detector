// LinkedIn AI Detector - Popup Script v2

let badgesVisible = true;

async function getActiveLinkedInTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.url?.includes('linkedin.com')) return null;
  return tab;
}

// ── API Key management ────────────────────────────────────────────────────────
async function loadApiKey() {
  const { anthropicApiKey } = await chrome.storage.local.get('anthropicApiKey');
  const input = document.getElementById('api-key-input');
  const dot   = document.getElementById('api-dot');

  if (anthropicApiKey) {
    input.value = anthropicApiKey;
    dot.classList.add('active');
  } else {
    dot.classList.remove('active');
  }
}

document.getElementById('api-save-btn').addEventListener('click', async () => {
  const key = document.getElementById('api-key-input').value.trim();
  if (!key) return;

  await chrome.storage.local.set({ anthropicApiKey: key });
  document.getElementById('api-dot').classList.add('active');

  const msg = document.getElementById('saved-msg');
  msg.classList.add('show');
  setTimeout(() => msg.classList.remove('show'), 2000);
});

document.getElementById('api-clear-btn').addEventListener('click', async () => {
  await chrome.storage.local.remove('anthropicApiKey');
  document.getElementById('api-key-input').value = '';
  document.getElementById('api-dot').classList.remove('active');
});

// Allow saving with Enter key
document.getElementById('api-key-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') document.getElementById('api-save-btn').click();
});

// ── Stats ─────────────────────────────────────────────────────────────────────
async function loadStats() {
  const tab = await getActiveLinkedInTab();

  if (!tab) {
    document.getElementById('main-content').style.display = 'none';
    document.getElementById('not-linkedin').style.display = 'block';
    return;
  }

  try {
    const r = await chrome.tabs.sendMessage(tab.id, { action: 'getStats' });
    if (r) {
      document.getElementById('stat-buttons').textContent = r.buttons ?? '—';
      document.getElementById('stat-total').textContent  = r.total;
      document.getElementById('stat-high').textContent   = r.high;
      document.getElementById('stat-medium').textContent = r.medium;
      document.getElementById('stat-low').textContent    = r.low;
    }
  } catch {
    ['stat-buttons','stat-total','stat-high','stat-medium','stat-low']
      .forEach(id => document.getElementById(id).textContent = '0');
  }
}

// ── Controls ──────────────────────────────────────────────────────────────────
document.getElementById('visibility-toggle').addEventListener('click', async () => {
  badgesVisible = !badgesVisible;
  document.getElementById('visibility-toggle').classList.toggle('active', badgesVisible);
  const tab = await getActiveLinkedInTab();
  if (tab) chrome.tabs.sendMessage(tab.id, { action: 'toggleVisibility', show: badgesVisible });
});

document.getElementById('btn-rescan').addEventListener('click', async () => {
  const tab = await getActiveLinkedInTab();
  if (!tab) return;
  await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
  setTimeout(loadStats, 700);
});

// ── Init ──────────────────────────────────────────────────────────────────────
loadApiKey();
loadStats();
