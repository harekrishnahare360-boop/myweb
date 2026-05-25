/* ============================================
   notices.js — Admin: post / edit / delete
   ============================================ */
(function () {
  if (!AUTH.requireAuth()) return;
  UI.renderShell('notices.html', 'Notices & Announcements');

  const $ = (id) => document.getElementById(id);

  function getFiltered() {
    const q = $('search').value.trim().toLowerCase();
    const list = DB.getNotices();
    // Pinned first, then newest
    list.sort((a, b) => {
      if (!!b.pinned !== !!a.pinned) return (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0);
      return (b.createdAt || '').localeCompare(a.createdAt || '');
    });
    if (!q) return list;
    return list.filter(n =>
      [n.title, n.body].some(v => String(v || '').toLowerCase().includes(q))
    );
  }

  function render() {
    const list = getFiltered();
    const box = $('noticeList');
    if (list.length === 0) {
      box.innerHTML = `<div class="card"><div class="card-body" style="text-align:center;padding:40px;color:var(--text-muted);">
        No notices yet. Click <strong>+ Post Notice</strong> to create the first one.
      </div></div>`;
      return;
    }
    box.innerHTML = list.map(n => `
      <div class="notice-card ${n.pinned ? 'pinned' : ''}">
        <div class="notice-head">
          <div>
            <div class="notice-title">${n.pinned ? '\u{1F4CC} ' : ''}${UI.esc(n.title)}</div>
            <div class="notice-meta">${UI.fmtDateTime(n.createdAt)}</div>
          </div>
          <div class="notice-actions">
            <button class="btn btn-ghost btn-sm" onclick="togglePin('${n.id}')">${n.pinned ? 'Unpin' : 'Pin'}</button>
            <button class="btn btn-ghost btn-sm" onclick="openEdit('${n.id}')">Edit</button>
            <button class="btn btn-danger btn-sm" onclick="del('${n.id}')">Delete</button>
          </div>
        </div>
        <div class="notice-body">${UI.esc(n.body)}</div>
      </div>
    `).join('');
  }

  window.openAdd = function () {
    $('modalTitle').textContent = 'Post Notice';
    $('noticeForm').reset();
    $('noticeId').value = '';
    UI.openModal('noticeModal');
  };

  window.openEdit = function (id) {
    const n = DB.getNotices().find(x => x.id === id);
    if (!n) return;
    $('modalTitle').textContent = 'Edit Notice';
    $('noticeId').value = n.id;
    $('title').value = n.title || '';
    $('body').value = n.body || '';
    $('pinned').checked = !!n.pinned;
    UI.openModal('noticeModal');
  };

  window.del = function (id) {
    if (!confirm('Delete this notice? It will also be removed from the public landing page.')) return;
    DB.deleteNotice(id);
    UI.toast('Notice deleted', 'success');
    render();
  };

  window.togglePin = function (id) {
    const n = DB.getNotices().find(x => x.id === id);
    if (!n) return;
    DB.updateNotice(id, { pinned: !n.pinned });
    UI.toast(n.pinned ? 'Notice unpinned' : 'Notice pinned', 'success');
    render();
  };

  $('noticeForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const data = {
      title: $('title').value.trim(),
      body: $('body').value.trim(),
      pinned: $('pinned').checked,
    };
    const id = $('noticeId').value;
    if (id) {
      DB.updateNotice(id, data);
      UI.toast('Notice updated', 'success');
    } else {
      DB.addNotice(data);
      UI.toast('Notice posted', 'success');
    }
    UI.closeModal('noticeModal');
    render();
  });

  $('search').addEventListener('input', render);
  render();
})();
