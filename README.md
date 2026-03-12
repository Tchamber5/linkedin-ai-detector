# 🤖 LinkedIn AI Detector

A Chrome extension that detects AI-generated posts on LinkedIn using [Claude Haiku](https://anthropic.com) via the Anthropic API.

## How it works

Each post in your LinkedIn feed gets an **"Analyze with AI"** button injected inline. Click it and Claude analyzes the post for AI-generation signals, returning:

- A verdict: `human`, `possibly_ai`, `probably_ai`, or `very_likely_ai`
- A confidence percentage
- A one-sentence reasoning
- Specific signals that triggered the verdict

Posts that match common AI patterns get a ⚠️ pre-warning on the button — so you know where to look first without burning API credits.

## Features

- 🔍 **Per-post analysis** — you control when to call the API
- ⚠️ **Free regex pre-screen** — flags suspicious posts before you click
- 🔑 **API key stored locally** in Chrome extension storage (never leaves your browser)
- 🏷️ **Color-coded badges** — red/orange/yellow/green result badges with expandable details
- ♾️ **Infinite scroll support** — new posts are detected as you scroll
- 📢 **Covers all post types** — regular posts, promoted ads, posts with only control menus

## Installation

1. Download or clone this repo
2. Go to `chrome://extensions/`
3. Enable **Developer mode** (top-right toggle)
4. Click **Load unpacked** and select the repo folder
5. Navigate to [linkedin.com/feed](https://linkedin.com/feed)

## Setup

1. Get an API key from [console.anthropic.com](https://console.anthropic.com/settings/keys)
2. Click the extension icon 🤖 in Chrome's toolbar
3. Paste your key and hit **Save**

Cost: ~$0.001 per post analyzed using Claude Haiku.

## How AI posts are detected

Claude looks for:
- Buzzwords: "leverage", "synergy", "delve", "game-changer", "thought leader"
- Formulaic structure: hook → numbered list → call-to-action → hashtag wall
- Generic motivational content with no personal specifics
- Phrases like "I'm thrilled to share", "in today's fast-paced world", "feel free to reach out"
- Every sentence on its own line for false drama
- Lacks genuine anecdotes, specific details, or authentic voice

## Tech

- Chrome Manifest V3
- Anthropic API (`claude-haiku-4-5-20251001`)
- Pure vanilla JS / CSS — no build step, no dependencies

## Notes

LinkedIn uses obfuscated/hashed class names that change with every deploy. This extension uses structural aria selectors (`[aria-label^="Hide post by"]`, `[aria-label^="Open control menu for post by"]`) rather than class names, making it resilient to LinkedIn's frequent UI updates.

---

Built by [Tim Chambers](https://timothychambers.me) · Powered by [Anthropic](https://anthropic.com)
