# Fetwa Chat

A ChatGPT-style web app powered by Anthropic's Claude API. Pure HTML / CSS / vanilla JS — no build step, no backend.

## Features

- Clean, dark, ChatGPT-inspired UI (sidebar + chat + composer)
- Multiple Claude models (Sonnet 4.5, Opus 4.1, Haiku 4.5, 3.7 Sonnet, 3.5 Haiku)
- Streaming responses (SSE) with a stop button
- Conversation history saved in `localStorage`
- Per-conversation auto-titling from the first message
- Markdown rendering with code blocks + copy buttons
- Configurable system prompt, max tokens, and temperature
- Keyboard shortcuts: `Enter` to send, `Shift+Enter` for newline, `Cmd/Ctrl+K` for new chat
- Mobile-responsive layout

## Quick start

1. Open `fetwa-chat/index.html` in a browser
   - Either double-click the file, or serve the `fetwa-chat/` folder with any static server (e.g. `python -m http.server`).
2. Click the **Settings** button in the sidebar.
3. Paste your Anthropic API key from <https://console.anthropic.com/>.
4. Save and start chatting.

## How it talks to Claude

The browser sends requests directly to `https://api.anthropic.com/v1/messages` with these headers:

- `x-api-key: <your key>`
- `anthropic-version: 2023-06-01`
- `anthropic-dangerous-direct-browser-access: true`

The last header tells Anthropic that you knowingly want to call the API from a browser (which CORS-blocks by default). Streaming uses Server-Sent Events: each `content_block_delta` event of type `text_delta` is appended to the assistant's reply.

## Important security note

Because this is a static, client-side app, your API key lives in `localStorage` and is sent from the browser. That is fine for personal use on your own machine. **Do NOT host this publicly with your key embedded** — anyone who visits the page would also be able to read and spend against the key. For a public deployment, put a small backend (e.g. a serverless function) in front of the API and never expose the key.

## File layout

```
fetwa-chat/
  index.html       # Markup + DOM
  css/style.css    # All styles
  js/api.js        # Claude streaming client
  js/app.js        # State, rendering, events
  README.md
```

## Customization

- **Default system prompt / model**: edit `DEFAULT_SETTINGS` in `js/app.js`.
- **Available models**: edit the `<select id="modelSelect">` options in `index.html`.
- **Theme colors**: tweak the CSS variables at the top of `css/style.css` (`--accent`, `--bg`, etc.).
