/* ===== Fetwa Chat — App logic ===== */

(() => {
  // ---------- Storage keys ----------
  const KEY_SETTINGS = 'fetwa.settings.v1';
  const KEY_CONVERSATIONS = 'fetwa.conversations.v1';
  const KEY_ACTIVE = 'fetwa.activeId.v1';

  // ---------- Default settings ----------
  const DEFAULT_SETTINGS = {
    apiKey: '',
    model: 'claude-sonnet-4-5',
    systemPrompt: 'You are Fetwa, a helpful, concise, and friendly AI assistant. Format answers using markdown when useful.',
    maxTokens: 4096,
    temperature: 1,
  };

  // ---------- DOM ----------
  const $ = (sel) => document.querySelector(sel);
  const els = {
    app: $('.app'),
    sidebar: $('#sidebar'),
    closeSidebarBtn: $('#closeSidebarBtn'),
    openSidebarBtn: $('#openSidebarBtn'),
    newChatBtn: $('#newChatBtn'),
    convList: $('#conversationList'),
    settingsBtn: $('#settingsBtn'),
    clearAllBtn: $('#clearAllBtn'),

    modelSelect: $('#modelSelect'),
    topbarTitle: $('#topbarTitle'),
    messages: $('#messages'),

    composerForm: $('#composerForm'),
    promptInput: $('#promptInput'),
    sendBtn: $('#sendBtn'),
    stopBtn: $('#stopBtn'),

    settingsModal: $('#settingsModal'),
    closeSettingsBtn: $('#closeSettingsBtn'),
    cancelSettingsBtn: $('#cancelSettingsBtn'),
    saveSettingsBtn: $('#saveSettingsBtn'),
    apiKeyInput: $('#apiKeyInput'),
    toggleKeyVisibility: $('#toggleKeyVisibility'),
    systemPromptInput: $('#systemPromptInput'),
    maxTokensInput: $('#maxTokensInput'),
    temperatureInput: $('#temperatureInput'),

    toast: $('#toast'),
  };

  // ---------- State ----------
  /** @type {{id:string,title:string,createdAt:number,messages:Array<{role:'user'|'assistant',content:string,error?:boolean}>}[]} */
  let conversations = [];
  let activeId = null;
  let settings = { ...DEFAULT_SETTINGS };
  let abortController = null;
  let isStreaming = false;

  // ---------- Storage helpers ----------
  function loadSettings() {
    try {
      const raw = localStorage.getItem(KEY_SETTINGS);
      if (raw) settings = { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
    } catch { /* noop */ }
  }
  function saveSettings() {
    localStorage.setItem(KEY_SETTINGS, JSON.stringify(settings));
  }
  function loadConversations() {
    try {
      const raw = localStorage.getItem(KEY_CONVERSATIONS);
      conversations = raw ? JSON.parse(raw) : [];
    } catch {
      conversations = [];
    }
    activeId = localStorage.getItem(KEY_ACTIVE) || null;
    if (activeId && !conversations.find((c) => c.id === activeId)) {
      activeId = null;
    }
  }
  function saveConversations() {
    localStorage.setItem(KEY_CONVERSATIONS, JSON.stringify(conversations));
    if (activeId) localStorage.setItem(KEY_ACTIVE, activeId);
    else localStorage.removeItem(KEY_ACTIVE);
  }

  function getActiveConversation() {
    if (!activeId) return null;
    return conversations.find((c) => c.id === activeId) || null;
  }

  function createConversation() {
    const conv = {
      id: 'c_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36),
      title: 'New chat',
      createdAt: Date.now(),
      messages: [],
    };
    conversations.unshift(conv);
    activeId = conv.id;
    saveConversations();
    return conv;
  }

  function deleteConversation(id) {
    conversations = conversations.filter((c) => c.id !== id);
    if (activeId === id) activeId = conversations[0]?.id || null;
    saveConversations();
  }

  // ---------- Markdown rendering (lightweight, safe) ----------
  // Escapes HTML, then applies a small markdown subset:
  // headings, bold, italic, inline code, fenced code blocks, lists, links,
  // blockquotes, paragraphs, line breaks.
  function escapeHtml(s) {
    return s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function renderMarkdown(src) {
    if (!src) return '';
    // Step 1: extract fenced code blocks first to protect them.
    const codeBlocks = [];
    let text = src.replace(/```([a-zA-Z0-9_+\-]*)\n([\s\S]*?)```/g, (_, lang, code) => {
      const idx = codeBlocks.length;
      codeBlocks.push({ lang, code });
      return `\u0000CODEBLOCK_${idx}\u0000`;
    });

    text = escapeHtml(text);

    // Headings (#, ##, ###, ####)
    text = text.replace(/^####\s+(.+)$/gm, '<h4>$1</h4>');
    text = text.replace(/^###\s+(.+)$/gm, '<h3>$1</h3>');
    text = text.replace(/^##\s+(.+)$/gm, '<h2>$1</h2>');
    text = text.replace(/^#\s+(.+)$/gm, '<h1>$1</h1>');

    // Blockquote
    text = text.replace(/^&gt;\s?(.+)$/gm, '<blockquote>$1</blockquote>');

    // Inline code
    text = text.replace(/`([^`\n]+?)`/g, '<code>$1</code>');

    // Bold then italic (order matters)
    text = text.replace(/\*\*([^*\n]+?)\*\*/g, '<strong>$1</strong>');
    text = text.replace(/\*([^*\n]+?)\*/g, '<em>$1</em>');
    text = text.replace(/(^|\W)_([^_\n]+?)_(?=\W|$)/g, '$1<em>$2</em>');

    // Links [text](url)
    text = text.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');

    // Lists — group consecutive lines starting with - or * or 1.
    const lines = text.split('\n');
    const out = [];
    let inUl = false;
    let inOl = false;
    let para = [];

    const flushPara = () => {
      if (para.length) {
        const joined = para.join('<br>');
        out.push(`<p>${joined}</p>`);
        para = [];
      }
    };
    const closeLists = () => {
      if (inUl) { out.push('</ul>'); inUl = false; }
      if (inOl) { out.push('</ol>'); inOl = false; }
    };

    for (const ln of lines) {
      const ulMatch = /^\s*[-*]\s+(.*)$/.exec(ln);
      const olMatch = /^\s*\d+\.\s+(.*)$/.exec(ln);
      const isBlockTag = /^<(h[1-4]|blockquote|pre|ul|ol|p)\b/.test(ln.trim()) ||
                        ln.includes('\u0000CODEBLOCK_');

      if (ulMatch) {
        flushPara();
        if (inOl) { out.push('</ol>'); inOl = false; }
        if (!inUl) { out.push('<ul>'); inUl = true; }
        out.push(`<li>${ulMatch[1]}</li>`);
      } else if (olMatch) {
        flushPara();
        if (inUl) { out.push('</ul>'); inUl = false; }
        if (!inOl) { out.push('<ol>'); inOl = true; }
        out.push(`<li>${olMatch[1]}</li>`);
      } else if (ln.trim() === '') {
        flushPara();
        closeLists();
      } else if (isBlockTag) {
        flushPara();
        closeLists();
        out.push(ln);
      } else {
        para.push(ln);
      }
    }
    flushPara();
    closeLists();

    let html = out.join('\n');

    // Restore code blocks
    html = html.replace(/\u0000CODEBLOCK_(\d+)\u0000/g, (_, i) => {
      const { lang, code } = codeBlocks[+i];
      const langClass = lang ? ` class="lang-${escapeHtml(lang)}"` : '';
      return `<pre><button class="copy-code-btn" type="button">Copy</button><code${langClass}>${escapeHtml(code)}</code></pre>`;
    });

    return html;
  }

  // ---------- Rendering ----------
  function renderConversationList() {
    els.convList.innerHTML = '';
    if (conversations.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'empty-list';
      empty.textContent = 'No conversations yet';
      els.convList.appendChild(empty);
      return;
    }
    for (const conv of conversations) {
      const item = document.createElement('div');
      item.className = 'conv-item' + (conv.id === activeId ? ' active' : '');
      item.dataset.id = conv.id;
      item.innerHTML = `
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
        <span class="title"></span>
        <button class="delete-btn" title="Delete chat" aria-label="Delete chat">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6"/></svg>
        </button>
      `;
      item.querySelector('.title').textContent = conv.title || 'Untitled';
      item.addEventListener('click', (ev) => {
        if (ev.target.closest('.delete-btn')) return;
        switchConversation(conv.id);
      });
      item.querySelector('.delete-btn').addEventListener('click', (ev) => {
        ev.stopPropagation();
        if (confirm(`Delete "${conv.title || 'this chat'}"?`)) {
          deleteConversation(conv.id);
          renderAll();
        }
      });
      els.convList.appendChild(item);
    }
  }

  function renderWelcome() {
    els.messages.innerHTML = `
      <div class="welcome">
        <h1>Fetwa Chat</h1>
        <p>A ChatGPT-style interface powered by Anthropic's Claude.</p>
        <div class="suggestions">
          <button class="suggestion-card" data-prompt="Explain quantum entanglement to me like I'm a curious 12-year-old.">
            <div class="label">Explain a concept</div>
            <div class="sub">Quantum entanglement, like I'm 12</div>
          </button>
          <button class="suggestion-card" data-prompt="Write a Python function that finds the longest palindromic substring in a string.">
            <div class="label">Write code</div>
            <div class="sub">Longest palindromic substring (Python)</div>
          </button>
          <button class="suggestion-card" data-prompt="Plan a 3-day weekend trip to Kyoto in autumn for someone who loves food and gardens.">
            <div class="label">Plan a trip</div>
            <div class="sub">3 days in Kyoto, autumn</div>
          </button>
          <button class="suggestion-card" data-prompt="Summarize the differences between TCP and UDP, with a small comparison table.">
            <div class="label">Compare options</div>
            <div class="sub">TCP vs UDP, with a table</div>
          </button>
        </div>
      </div>
    `;
    els.messages.querySelectorAll('.suggestion-card').forEach((card) => {
      card.addEventListener('click', () => {
        els.promptInput.value = card.dataset.prompt;
        autoResize();
        els.promptInput.focus();
      });
    });
  }

  function renderMessages() {
    const conv = getActiveConversation();
    els.topbarTitle.textContent = conv?.title || 'New conversation';

    if (!conv || conv.messages.length === 0) {
      renderWelcome();
      return;
    }

    els.messages.innerHTML = '';
    for (const msg of conv.messages) {
      els.messages.appendChild(buildMessageEl(msg));
    }
    scrollToBottom();
  }

  function buildMessageEl(msg) {
    const el = document.createElement('div');
    el.className = 'message';
    el.dataset.role = msg.role;
    const isUser = msg.role === 'user';

    const avatar = document.createElement('div');
    avatar.className = 'avatar ' + (isUser ? 'user' : 'assistant');
    avatar.textContent = isUser ? 'You' : 'F';

    const bubble = document.createElement('div');
    bubble.className = 'bubble';
    bubble.innerHTML = `
      <div class="role">${isUser ? 'You' : 'Fetwa'}</div>
      <div class="content"></div>
    `;
    const contentEl = bubble.querySelector('.content');
    if (isUser) {
      contentEl.textContent = msg.content;
    } else {
      contentEl.innerHTML = renderMarkdown(msg.content || '');
      attachCodeCopyButtons(contentEl);
    }
    if (msg.error) {
      const err = document.createElement('div');
      err.className = 'message-error';
      err.textContent = msg.error;
      bubble.appendChild(err);
    }

    el.appendChild(avatar);
    el.appendChild(bubble);
    return el;
  }

  function attachCodeCopyButtons(root) {
    root.querySelectorAll('pre .copy-code-btn').forEach((btn) => {
      btn.addEventListener('click', async (ev) => {
        ev.stopPropagation();
        const code = btn.parentElement.querySelector('code')?.innerText || '';
        try {
          await navigator.clipboard.writeText(code);
          const old = btn.textContent;
          btn.textContent = 'Copied!';
          setTimeout(() => { btn.textContent = old; }, 1200);
        } catch {
          showToast('Could not copy', 'error');
        }
      });
    });
  }

  function scrollToBottom() {
    els.messages.scrollTop = els.messages.scrollHeight;
  }

  function renderAll() {
    renderConversationList();
    renderMessages();
  }

  // ---------- Conversation actions ----------
  function switchConversation(id) {
    activeId = id;
    saveConversations();
    renderAll();
    closeSidebarOnMobile();
  }

  function startNewChat() {
    // Reuse an existing empty "New chat" if there is one at the top.
    const top = conversations[0];
    if (top && top.messages.length === 0) {
      activeId = top.id;
    } else {
      createConversation();
    }
    saveConversations();
    renderAll();
    els.promptInput.focus();
    closeSidebarOnMobile();
  }

  function clearAllConversations() {
    if (!conversations.length) return;
    if (!confirm('Delete ALL conversations? This cannot be undone.')) return;
    conversations = [];
    activeId = null;
    saveConversations();
    renderAll();
  }

  function setConversationTitleFromFirstMessage(conv, text) {
    if (!conv) return;
    if (conv.title && conv.title !== 'New chat') return;
    const t = text.trim().split('\n')[0].slice(0, 48);
    conv.title = t || 'New chat';
  }

  // ---------- Sending messages ----------
  async function sendMessage(text) {
    if (!text.trim() || isStreaming) return;
    if (!settings.apiKey) {
      showToast('Add your Anthropic API key in Settings first.', 'error');
      openSettings();
      return;
    }

    let conv = getActiveConversation();
    if (!conv) conv = createConversation();

    const userMsg = { role: 'user', content: text };
    conv.messages.push(userMsg);
    setConversationTitleFromFirstMessage(conv, text);
    saveConversations();

    // Render user message immediately
    if (els.messages.querySelector('.welcome')) {
      els.messages.innerHTML = '';
    }
    els.messages.appendChild(buildMessageEl(userMsg));
    scrollToBottom();

    // Append empty assistant message that will be streamed into
    const assistantMsg = { role: 'assistant', content: '' };
    conv.messages.push(assistantMsg);
    const assistantEl = buildMessageEl(assistantMsg);
    const contentEl = assistantEl.querySelector('.content');
    contentEl.innerHTML = '<span class="cursor-blink"></span>';
    els.messages.appendChild(assistantEl);
    scrollToBottom();

    setStreamingUI(true);
    abortController = new AbortController();

    // Build API messages (exclude the empty assistant placeholder + drop errored msgs)
    const apiMessages = conv.messages
      .slice(0, -1)
      .filter((m) => !(m.role === 'assistant' && (!m.content || m.error)))
      .map((m) => ({ role: m.role, content: m.content }));

    let buffered = '';
    let lastRender = 0;
    const RENDER_INTERVAL = 60; // ms throttle for markdown re-render

    try {
      await ClaudeAPI.streamMessage({
        apiKey: settings.apiKey,
        model: settings.model,
        system: settings.systemPrompt,
        messages: apiMessages,
        maxTokens: Number(settings.maxTokens) || 4096,
        temperature: Number(settings.temperature) || 1,
        signal: abortController.signal,
        onDelta: (delta) => {
          buffered += delta;
          assistantMsg.content = buffered;
          const now = performance.now();
          if (now - lastRender > RENDER_INTERVAL) {
            contentEl.innerHTML =
              renderMarkdown(buffered) + '<span class="cursor-blink"></span>';
            lastRender = now;
            scrollToBottom();
          }
        },
      });
      // Final render without cursor
      contentEl.innerHTML = renderMarkdown(buffered);
      attachCodeCopyButtons(contentEl);
      saveConversations();
      renderConversationList();
    } catch (err) {
      // If aborted, keep partial content; otherwise show error.
      if (err.name === 'AbortError') {
        assistantMsg.content = buffered;
        contentEl.innerHTML = renderMarkdown(buffered) || '<em style="color:#a0a3ad">(stopped)</em>';
        attachCodeCopyButtons(contentEl);
      } else {
        assistantMsg.error = err.message || 'Something went wrong.';
        if (!buffered) {
          // remove empty assistant bubble — replace with error block
          contentEl.innerHTML = '';
          const errBox = document.createElement('div');
          errBox.className = 'message-error';
          errBox.textContent = assistantMsg.error;
          contentEl.appendChild(errBox);
        } else {
          const errBox = document.createElement('div');
          errBox.className = 'message-error';
          errBox.textContent = assistantMsg.error;
          assistantEl.querySelector('.bubble').appendChild(errBox);
        }
        showToast(assistantMsg.error, 'error');
      }
      saveConversations();
    } finally {
      setStreamingUI(false);
      abortController = null;
      scrollToBottom();
    }
  }

  function stopStreaming() {
    if (abortController) {
      abortController.abort();
    }
  }

  function setStreamingUI(streaming) {
    isStreaming = streaming;
    els.sendBtn.hidden = streaming;
    els.stopBtn.hidden = !streaming;
    els.promptInput.disabled = streaming;
  }

  // ---------- Settings modal ----------
  function openSettings() {
    els.apiKeyInput.value = settings.apiKey || '';
    els.apiKeyInput.type = 'password';
    els.toggleKeyVisibility.textContent = 'Show';
    els.systemPromptInput.value = settings.systemPrompt || '';
    els.maxTokensInput.value = settings.maxTokens || 4096;
    els.temperatureInput.value = settings.temperature ?? 1;
    els.settingsModal.hidden = false;
    setTimeout(() => els.apiKeyInput.focus(), 50);
  }
  function closeSettings() {
    els.settingsModal.hidden = true;
  }
  function saveSettingsFromForm() {
    settings.apiKey = els.apiKeyInput.value.trim();
    settings.systemPrompt = els.systemPromptInput.value;
    const mt = parseInt(els.maxTokensInput.value, 10);
    settings.maxTokens = Number.isFinite(mt) && mt > 0 ? mt : 4096;
    const t = parseFloat(els.temperatureInput.value);
    settings.temperature = Number.isFinite(t) ? Math.max(0, Math.min(1, t)) : 1;
    saveSettings();
    closeSettings();
    showToast('Settings saved', 'success');
  }

  // ---------- Toast ----------
  let toastTimer = null;
  function showToast(msg, kind = '') {
    els.toast.className = 'toast' + (kind ? ' ' + kind : '');
    els.toast.textContent = msg;
    els.toast.hidden = false;
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { els.toast.hidden = true; }, 3500);
  }

  // ---------- Sidebar ----------
  function closeSidebarOnMobile() {
    if (window.matchMedia('(max-width: 768px)').matches) {
      els.app.classList.add('sidebar-collapsed');
    }
  }
  function toggleSidebar(forceClose) {
    if (forceClose === true) {
      els.app.classList.add('sidebar-collapsed');
    } else if (forceClose === false) {
      els.app.classList.remove('sidebar-collapsed');
    } else {
      els.app.classList.toggle('sidebar-collapsed');
    }
  }

  // ---------- Composer ----------
  function autoResize() {
    const ta = els.promptInput;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 200) + 'px';
  }

  // ---------- Init ----------
  function bindEvents() {
    // Sidebar toggles
    els.closeSidebarBtn.addEventListener('click', () => toggleSidebar(true));
    els.openSidebarBtn.addEventListener('click', () => toggleSidebar(false));

    // New chat
    els.newChatBtn.addEventListener('click', startNewChat);

    // Clear all
    els.clearAllBtn.addEventListener('click', clearAllConversations);

    // Model select
    els.modelSelect.value = settings.model;
    els.modelSelect.addEventListener('change', () => {
      settings.model = els.modelSelect.value;
      saveSettings();
    });

    // Settings modal
    els.settingsBtn.addEventListener('click', openSettings);
    els.closeSettingsBtn.addEventListener('click', closeSettings);
    els.cancelSettingsBtn.addEventListener('click', closeSettings);
    els.saveSettingsBtn.addEventListener('click', saveSettingsFromForm);
    els.settingsModal.addEventListener('click', (e) => {
      if (e.target === els.settingsModal) closeSettings();
    });
    els.toggleKeyVisibility.addEventListener('click', () => {
      const isPwd = els.apiKeyInput.type === 'password';
      els.apiKeyInput.type = isPwd ? 'text' : 'password';
      els.toggleKeyVisibility.textContent = isPwd ? 'Hide' : 'Show';
    });

    // Composer
    els.promptInput.addEventListener('input', autoResize);
    els.promptInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        els.composerForm.requestSubmit();
      }
    });
    els.composerForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const text = els.promptInput.value;
      if (!text.trim() || isStreaming) return;
      els.promptInput.value = '';
      autoResize();
      sendMessage(text);
    });
    els.stopBtn.addEventListener('click', stopStreaming);

    // Global shortcuts
    document.addEventListener('keydown', (e) => {
      // Cmd/Ctrl + K → new chat
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        startNewChat();
      }
      // Esc → close modal
      if (e.key === 'Escape' && !els.settingsModal.hidden) {
        closeSettings();
      }
    });
  }

  function init() {
    loadSettings();
    loadConversations();

    if (window.matchMedia('(max-width: 768px)').matches) {
      els.app.classList.add('sidebar-collapsed');
    }

    bindEvents();
    renderAll();

    if (!settings.apiKey) {
      // Gentle hint on first run
      setTimeout(() => {
        showToast('Add your Anthropic API key in Settings to start chatting.');
      }, 400);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
