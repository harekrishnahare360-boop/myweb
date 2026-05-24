/* ============================================
   ui.js — Shared UI helpers
   - Renders sidebar + topbar
   - Toast, modal, money/date formatting
   ============================================ */

const NAV_ITEMS = [
  { href: 'dashboard.html',  icon: '\u25A4', label: 'Dashboard' },
  { href: 'students.html',   icon: '\u{1F465}', label: 'Students' },
  { href: 'fees.html',       icon: '\u{1F4B0}', label: 'Fees' },
  { href: 'attendance.html', icon: '\u{1F4C5}', label: 'Attendance' },
  { href: 'results.html',    icon: '\u{1F4CA}', label: 'Results' },
];

const UI = {
  /** Render sidebar + topbar into the page. activePage = filename */
  renderShell(activePage, pageTitle) {
    const user = AUTH.currentUser();
    const initials = (user.name || user.username || 'A').slice(0, 1).toUpperCase();

    const navHtml = NAV_ITEMS.map(item => `
      <li><a href="${item.href}" class="${item.href === activePage ? 'active' : ''}">
        <span class="icon">${item.icon}</span>${item.label}
      </a></li>
    `).join('');

    const sidebar = document.querySelector('.sidebar');
    if (sidebar) {
      sidebar.innerHTML = `
        <div class="sidebar-brand">
          <div class="logo">SK</div>
          <div>
            <div class="name">Sk Study Way</div>
            <div class="sub">Tuition Management</div>
          </div>
        </div>
        <ul class="nav">${navHtml}</ul>
        <div class="sidebar-footer">
          <button class="btn btn-ghost btn-block" onclick="AUTH.logout()" style="color:#c7d2fe;border-color:rgba(255,255,255,0.15);background:rgba(255,255,255,0.05);">
            <span>\u21AA</span> Sign out
          </button>
        </div>
      `;
    }

    const topbar = document.querySelector('.topbar');
    if (topbar) {
      topbar.innerHTML = `
        <h2>${pageTitle}</h2>
        <div class="user-chip">
          <span class="avatar">${initials}</span>
          <span>${user.name || user.username}</span>
        </div>
      `;
    }
  },

  toast(message, type = '') {
    const t = document.createElement('div');
    t.className = 'toast ' + type;
    t.textContent = message;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 2400);
  },

  openModal(id) {
    const m = document.getElementById(id);
    if (m) m.classList.remove('hidden');
  },
  closeModal(id) {
    const m = document.getElementById(id);
    if (m) m.classList.add('hidden');
  },

  money(n) {
    const v = Number(n) || 0;
    return '\u20B9' + v.toLocaleString('en-IN');
  },

  fmtDate(d) {
    if (!d) return '-';
    const dt = new Date(d);
    if (isNaN(dt)) return d;
    return dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  },

  todayISO() {
    const d = new Date();
    const off = d.getTimezoneOffset();
    const local = new Date(d.getTime() - off * 60000);
    return local.toISOString().slice(0, 10);
  },

  /** Escape HTML for safe insertion */
  esc(str) {
    return String(str ?? '').replace(/[&<>"']/g, c => ({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    }[c]));
  },
};
