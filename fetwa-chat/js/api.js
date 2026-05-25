/* ===== Fetwa Chat — Claude API client ===== */
/*
 * Talks directly to Anthropic's Messages API from the browser.
 * Requires the `anthropic-dangerous-direct-browser-access` header to bypass
 * the default browser CORS guard. The API key lives in localStorage,
 * which is fine for a personal/local app but should NOT be used to ship
 * to other users — anyone visiting the site would see the key.
 */

const ClaudeAPI = (() => {
  const ENDPOINT = 'https://api.anthropic.com/v1/messages';
  const API_VERSION = '2023-06-01';

  /**
   * Send a streaming message request to Claude.
   *
   * @param {Object} opts
   * @param {string} opts.apiKey
   * @param {string} opts.model
   * @param {string} [opts.system]
   * @param {Array<{role:'user'|'assistant', content:string}>} opts.messages
   * @param {number} [opts.maxTokens=4096]
   * @param {number} [opts.temperature=1]
   * @param {AbortSignal} [opts.signal]
   * @param {(textDelta:string) => void} opts.onDelta
   * @param {(stopReason:string) => void} [opts.onComplete]
   * @param {(err:Error) => void} [opts.onError]
   */
  async function streamMessage(opts) {
    const {
      apiKey,
      model,
      system,
      messages,
      maxTokens = 4096,
      temperature = 1,
      signal,
      onDelta,
      onComplete,
      onError,
    } = opts;

    if (!apiKey) {
      const e = new Error('Missing API key. Open Settings to add one.');
      onError && onError(e);
      throw e;
    }

    const body = {
      model,
      max_tokens: maxTokens,
      temperature,
      stream: true,
      messages,
    };
    if (system && system.trim()) body.system = system.trim();

    let response;
    try {
      response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': API_VERSION,
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify(body),
        signal,
      });
    } catch (err) {
      const e = new Error(
        err.name === 'AbortError'
          ? 'Generation stopped.'
          : `Network error: ${err.message}`
      );
      e.name = err.name;
      onError && onError(e);
      throw e;
    }

    if (!response.ok || !response.body) {
      let detail = '';
      try {
        const data = await response.json();
        detail = data?.error?.message || JSON.stringify(data);
      } catch {
        detail = await response.text().catch(() => '');
      }
      const e = new Error(
        `API error ${response.status}: ${detail || response.statusText}`
      );
      onError && onError(e);
      throw e;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let stopReason = null;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // SSE events are separated by a blank line.
        let sepIdx;
        while ((sepIdx = buffer.indexOf('\n\n')) !== -1) {
          const rawEvent = buffer.slice(0, sepIdx);
          buffer = buffer.slice(sepIdx + 2);

          // Each event has lines like "event: <name>\ndata: <json>".
          const dataLines = rawEvent
            .split('\n')
            .filter((l) => l.startsWith('data:'))
            .map((l) => l.slice(5).trim());
          if (dataLines.length === 0) continue;
          const dataStr = dataLines.join('\n');
          if (!dataStr || dataStr === '[DONE]') continue;

          let payload;
          try {
            payload = JSON.parse(dataStr);
          } catch {
            continue;
          }

          if (payload.type === 'content_block_delta') {
            const delta = payload.delta;
            if (delta?.type === 'text_delta' && typeof delta.text === 'string') {
              onDelta && onDelta(delta.text);
            }
          } else if (payload.type === 'message_delta') {
            if (payload.delta?.stop_reason) stopReason = payload.delta.stop_reason;
          } else if (payload.type === 'message_stop') {
            // end of stream
          } else if (payload.type === 'error') {
            const e = new Error(
              payload.error?.message || 'Unknown streaming error'
            );
            onError && onError(e);
            throw e;
          }
        }
      }
    } catch (err) {
      if (err.name === 'AbortError') {
        // Graceful stop — caller already knows.
      } else {
        onError && onError(err);
        throw err;
      }
    }

    onComplete && onComplete(stopReason);
    return stopReason;
  }

  return { streamMessage };
})();
