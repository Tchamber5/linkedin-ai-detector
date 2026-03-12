// LinkedIn AI Detector - Content Script (v3 - structural selectors, no class names)
// LinkedIn uses hashed class names that change frequently, so we rely on
// stable aria-labels, data attributes, and DOM structure instead.

// ─── Quick regex pre-screen ───────────────────────────────────────────────────
const QUICK_SIGNALS = [
  /\bdelve\b/i,
  /\bin today'?s (fast-?paced|rapidly evolving|ever-?changing) (world|landscape)/i,
  /\bI'?m (thrilled|excited|humbled|honored|delighted) to (share|announce)/i,
  /\blet'?s (dive|delve) (in|into)/i,
  /\bgame.?changer/i,
  /\bparadigm.?shift/i,
  /\bholistic (approach|strategy|solution)/i,
  /\bthought.?leader/i,
  /\btransform(ative|ation)?\b.*\bjourney\b/i,
  /\bin (conclusion|summary|closing)\b/i,
  /\bfeel free to (share|comment|reach out)/i,
  /\bkey (takeaway|insight|lesson)\b/i,
  /\bseamless(ly)?\b/i,
];

function quickScore(text) {
  let hits = 0;
  for (const p of QUICK_SIGNALS) if (p.test(text)) hits++;
  const emojiBullets = (text.match(/^[🔹🔸✅❌💡🎯🚀⚡🌟💪🏆✨🔑👇👆➡️▶️]/gm) || []).length;
  if (emojiBullets >= 3) hits += 2;
  const lines = text.split('\n').filter(l => l.trim());
  if (lines.length > 6 && text.split(/\s+/).length / lines.length < 8) hits += 2;
  return hits;
}

// ─── Find post containers using stable structural patterns ────────────────────
function findPostContainers() {
  // Primary: "Hide post by X" buttons are reliably present on every feed post
  const hideButtons = [...document.querySelectorAll('[aria-label^="Hide post by"]')];

  const posts = [];
  const seen = new WeakSet();

  for (const btn of hideButtons) {
    // Walk up to find the post card root
    let el = btn;
    let postRoot = null;
    for (let i = 0; i < 12; i++) {
      el = el.parentElement;
      if (!el) break;
      if (el.offsetHeight > 150 && el.querySelectorAll('p').length >= 1) {
        postRoot = el;
        break;
      }
    }
    if (postRoot && !seen.has(postRoot)) {
      seen.add(postRoot);
      posts.push(postRoot);
    }
  }

  return posts;
}

// ─── Find post body text element ──────────────────────────────────────────────
function findPostText(postEl) {
  // Find paragraphs with substantial text (the post body, not metadata)
  const paras = [...postEl.querySelectorAll('p')].filter(p => {
    const t = (p.innerText || '').trim();
    return t.length > 60;
  });
  // Return the longest one (most likely to be the post body)
  if (!paras.length) return null;
  return paras.reduce((a, b) =>
    (a.innerText || '').length > (b.innerText || '').length ? a : b
  );
}

// ─── Claude API call ──────────────────────────────────────────────────────────
async function analyzeWithClaude(text, apiKey) {
  const prompt = `You are an expert at detecting AI-generated LinkedIn posts. Analyze the following LinkedIn post and determine if it was likely written by an AI (such as ChatGPT or Claude) or by a human.

Consider these signals of AI-generated content:
- Overly polished, corporate tone with buzzwords ("leverage", "synergy", "delve", "game-changer")
- Formulaic structure: hook → numbered list → call to action → hashtags
- Generic motivational content lacking personal specifics
- Phrases like "I'm excited/thrilled/humbled to share", "in today's fast-paced world", "feel free to reach out"
- Every sentence on its own line for false drama
- Ends with a generic question + wall of hashtags
- Lacks genuine personal anecdotes, emotions, or specific details

Respond ONLY with a JSON object in this exact format (no markdown, no explanation):
{"verdict":"human","confidence":85,"reasoning":"one sentence explanation","signals":["signal1","signal2"]}

The verdict field must be one of: "human", "possibly_ai", "probably_ai", "very_likely_ai"

POST TO ANALYZE:
${text.substring(0, 1500)}`;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error?.message || `API error ${response.status}`);
  }

  const data = await response.json();
  let raw = (data.content?.[0]?.text || '').trim();
  // Strip markdown code fences the model sometimes adds (```json ... ```)
  raw = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  // Extract just the JSON object if there's surrounding text
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('No JSON found in response');
  return JSON.parse(jsonMatch[0]);
}

// ─── Badge rendering ──────────────────────────────────────────────────────────
const VERDICT_CONFIG = {
  human:          { label: 'Looks human ✓',  level: 'human',  emoji: '👤' },
  possibly_ai:    { label: 'Possibly AI',     level: 'low',    emoji: '🤖' },
  probably_ai:    { label: 'Probably AI',     level: 'medium', emoji: '🤖' },
  very_likely_ai: { label: 'Very likely AI',  level: 'high',   emoji: '🤖' },
};

function createResultBadge(result) {
  const cfg = VERDICT_CONFIG[result.verdict] || VERDICT_CONFIG['possibly_ai'];
  const badge = document.createElement('div');
  badge.className = 'lai-badge';
  badge.setAttribute('data-level', cfg.level);
  badge.innerHTML = `
    <div class="lai-badge-inner">
      <span class="lai-icon">${cfg.emoji}</span>
      <span class="lai-label">${cfg.label}</span>
      <span class="lai-confidence">${result.confidence}%</span>
      <button class="lai-toggle" aria-label="Show details">▾</button>
    </div>
    <div class="lai-signals hidden">
      <p class="lai-reasoning">${result.reasoning}</p>
      ${result.signals?.length ? `
        <p class="lai-signals-title">Signals detected:</p>
        <ul>${result.signals.map(s => `<li>${s}</li>`).join('')}</ul>
      ` : ''}
    </div>
  `;
  badge.querySelector('.lai-toggle').addEventListener('click', (e) => {
    e.stopPropagation();
    const sigDiv = badge.querySelector('.lai-signals');
    const btn = badge.querySelector('.lai-toggle');
    sigDiv.classList.toggle('hidden');
    btn.textContent = sigDiv.classList.contains('hidden') ? '▾' : '▴';
  });
  return badge;
}

function createAnalyzeButton(text) {
  const hasQuickSignals = quickScore(text) >= 2;
  const wrap = document.createElement('div');
  wrap.className = 'lai-btn-wrap';

  const btn = document.createElement('button');
  btn.className = `lai-analyze-btn${hasQuickSignals ? ' lai-has-signals' : ''}`;
  btn.innerHTML = `<span class="lai-btn-icon">🤖</span> Analyze with AI${hasQuickSignals ? ' ⚠️' : ''}`;
  btn.title = hasQuickSignals
    ? 'Quick scan found possible AI signals — click to confirm with Claude'
    : 'Ask Claude if this post was AI-generated';

  btn.addEventListener('click', async (e) => {
    e.stopPropagation();

    const { anthropicApiKey } = await chrome.storage.local.get('anthropicApiKey');
    if (!anthropicApiKey) {
      btn.textContent = '⚠️ Add API key in extension popup';
      btn.classList.add('lai-btn-error');
      setTimeout(() => {
        btn.innerHTML = `<span class="lai-btn-icon">🤖</span> Analyze with AI`;
        btn.classList.remove('lai-btn-error');
      }, 3000);
      return;
    }

    btn.disabled = true;
    btn.innerHTML = `<span class="lai-spinner"></span> Analyzing…`;

    try {
      const result = await analyzeWithClaude(text, anthropicApiKey);
      wrap.replaceWith(createResultBadge(result));
      chrome.storage.local.get(['detectedCount'], (r) => {
        chrome.storage.local.set({ detectedCount: (r.detectedCount || 0) + (result.verdict !== 'human' ? 1 : 0) });
      });
    } catch (err) {
      btn.disabled = false;
      btn.innerHTML = `<span class="lai-btn-icon">🤖</span> Retry analysis`;
      const errMsg = document.createElement('span');
      errMsg.className = 'lai-err-msg';
      errMsg.textContent = err.message.length > 60 ? err.message.substring(0, 60) + '…' : err.message;
      wrap.appendChild(errMsg);
      setTimeout(() => errMsg.remove(), 5000);
    }
  });

  wrap.appendChild(btn);
  return wrap;
}

// ─── Post processing ──────────────────────────────────────────────────────────
function processPost(postEl) {
  if (postEl.dataset.laiAttached) return;

  const textEl = findPostText(postEl);
  if (!textEl) return;

  const text = (textEl.innerText || '').trim();
  if (text.length < 80) return;

  postEl.dataset.laiAttached = 'true';

  const btnWrap = createAnalyzeButton(text);
  textEl.parentNode.insertBefore(btnWrap, textEl.nextSibling);
}

function scanAllPosts() {
  findPostContainers().forEach(processPost);
}

// Initial scan + re-scan on scroll (new posts loaded)
scanAllPosts();
const observer = new MutationObserver(scanAllPosts);
observer.observe(document.body, { childList: true, subtree: true });

// ─── Messages from popup ──────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === 'getStats') {
    sendResponse({
      total:   document.querySelectorAll('.lai-badge').length,
      high:    document.querySelectorAll('.lai-badge[data-level="high"]').length,
      medium:  document.querySelectorAll('.lai-badge[data-level="medium"]').length,
      low:     document.querySelectorAll('.lai-badge[data-level="low"]').length,
      buttons: document.querySelectorAll('.lai-analyze-btn').length,
    });
  }
  if (msg.action === 'toggleVisibility') {
    document.querySelectorAll('.lai-badge, .lai-btn-wrap').forEach(b => {
      b.style.display = msg.show ? '' : 'none';
    });
    sendResponse({ ok: true });
  }
});
