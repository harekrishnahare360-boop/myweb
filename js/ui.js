/* ============================================
   ui.js — Shared UI helpers
   - Renders sidebar + topbar (with mobile drawer)
   - Theme toggle (light / dark)
   - Toast, modal, money/date formatting
   - Reveal-on-scroll observer
   ============================================ */

const NAV_ITEMS = [
  { href: 'dashboard.html',  icon: '\u25A4', label: 'Dashboard' },
  { href: 'students.html',   icon: '\u{1F465}', label: 'Students' },
  { href: 'fees.html',       icon: '\u{1F4B0}', label: 'Fees' },
  { href: 'attendance.html', icon: '\u{1F4C5}', label: 'Attendance' },
  { href: 'results.html',    icon: '\u{1F4CA}', label: 'Results' },
  { href: 'notices.html',    icon: '\u{1F4E2}', label: 'Notices' },
];

const UI = {
  /** Render sidebar + topbar into the page. activePage = filename */
  renderShell(activePage, pageTitle) {
    this.applyTheme();

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
          <button class="btn btn-ghost btn-block" onclick="UI.openBackup()" style="color:#c7d2fe;border-color:rgba(255,255,255,0.15);background:rgba(255,255,255,0.05);margin-bottom:8px;">
            <span>\u{1F4BE}</span> Backup / Restore
          </button>
          <button class="btn btn-ghost btn-block" onclick="AUTH.logout()" style="color:#c7d2fe;border-color:rgba(255,255,255,0.15);background:rgba(255,255,255,0.05);">
            <span>\u21AA</span> Sign out
          </button>
        </div>
      `;
    }

    // Inject backdrop for mobile drawer
    if (!document.querySelector('.sidebar-backdrop')) {
      const bd = document.createElement('div');
      bd.className = 'sidebar-backdrop';
      bd.addEventListener('click', () => UI.toggleSidebar(false));
      document.body.appendChild(bd);
    }

    const topbar = document.querySelector('.topbar');
    if (topbar) {
      topbar.innerHTML = `
        <div class="topbar-left">
          <button class="menu-toggle" onclick="UI.toggleSidebar()" aria-label="Menu">
            <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h16"/></svg>
          </button>
          <h2>${pageTitle}</h2>
        </div>
        <div class="topbar-right">
          <button class="theme-toggle" onclick="UI.toggleTheme()" aria-label="Toggle theme" id="themeBtn">
            ${UI.isDark() ? UI._sun() : UI._moon()}
          </button>
          <div class="user-chip">
            <span class="avatar">${initials}</span>
            <span>${user.name || user.username}</span>
          </div>
        </div>
      `;
    }

    // Inject backup/restore modal once
    UI._ensureBackupModal();
  },

  toggleSidebar(force) {
    const s = document.querySelector('.sidebar');
    const b = document.querySelector('.sidebar-backdrop');
    if (!s) return;
    const willOpen = force === undefined ? !s.classList.contains('open') : force;
    s.classList.toggle('open', willOpen);
    if (b) b.classList.toggle('show', willOpen);
  },

  isDark() { return document.documentElement.getAttribute('data-theme') === 'dark'; },

  applyTheme() {
    const saved = localStorage.getItem(DB.KEYS.THEME) || 'light';
    document.documentElement.setAttribute('data-theme', saved);
  },

  toggleTheme() {
    const next = this.isDark() ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem(DB.KEYS.THEME, next);
    const btn = document.getElementById('themeBtn');
    if (btn) btn.innerHTML = next === 'dark' ? this._sun() : this._moon();
  },

  _sun() {
    return '<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path stroke-linecap="round" d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>';
  },
  _moon() {
    return '<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>';
  },

  toast(message, type = '') {
    const t = document.createElement('div');
    t.className = 'toast ' + type;
    t.textContent = message;
    document.body.appendChild(t);
    setTimeout(() => {
      t.style.opacity = '0';
      t.style.transition = 'opacity 0.3s';
      setTimeout(() => t.remove(), 300);
    }, 2200);
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

  fmtDateTime(d) {
    if (!d) return '-';
    const dt = new Date(d);
    if (isNaN(dt)) return d;
    return dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) +
      ' \u00B7 ' + dt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
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

  /** Reveal-on-scroll: add .reveal class to elements; they fade-up when visible. */
  observeReveals() {
    const els = document.querySelectorAll('.reveal');
    if (!('IntersectionObserver' in window)) {
      els.forEach(e => e.classList.add('in'));
      return;
    }
    const io = new IntersectionObserver((entries) => {
      entries.forEach(en => {
        if (en.isIntersecting) {
          en.target.classList.add('in');
          io.unobserve(en.target);
        }
      });
    }, { threshold: 0.12 });
    els.forEach(e => io.observe(e));
  },

  // ---- Backup / Restore modal ----
  _ensureBackupModal() {
    if (document.getElementById('backupModal')) return;
    const div = document.createElement('div');
    div.id = 'backupModal';
    div.className = 'modal-backdrop hidden';
    div.innerHTML = `
      <div class="modal">
        <div class="modal-header">
          <h3>\u{1F4BE} Backup &amp; Restore</h3>
          <button class="modal-close" onclick="UI.closeModal('backupModal')">\u00D7</button>
        </div>
        <div class="modal-body">
          <p style="font-size:14px;color:var(--text-muted);margin-bottom:16px;">
            All data is stored in your browser. Use backup to save it as a file you can keep safe or move to another device.
          </p>
          <div class="card" style="margin-bottom:16px;">
            <div class="card-body">
              <h4 style="font-size:14px;margin-bottom:6px;">Export Data</h4>
              <p style="font-size:13px;color:var(--text-muted);margin-bottom:12px;">Download a backup file (.json) with all students, fees, attendance, results &amp; notices.</p>
              <button class="btn btn-primary" onclick="UI.doExport()">\u2B07 Download Backup</button>
            </div>
          </div>
          <div class="card">
            <div class="card-body">
              <h4 style="font-size:14px;margin-bottom:6px;">Import Data</h4>
              <p style="font-size:13px;color:var(--text-muted);margin-bottom:12px;">Restore from a previous backup file.</p>
              <input id="importFile" type="file" accept=".json,application/json" class="input" style="margin-bottom:10px;" />
              <div style="display:flex;gap:8px;flex-wrap:wrap;">
                <button class="btn btn-warning" onclick="UI.doImport('replace')">\u26A0 Replace All</button>
                <button class="btn btn-ghost" onclick="UI.doImport('merge')">+ Merge with Existing</button>
              </div>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-ghost" onclick="UI.closeModal('backupModal')">Close</button>
        </div>
      </div>
    `;
    document.body.appendChild(div);
  },

  openBackup() { this.openModal('backupModal'); },

  doExport() {
    const data = DB.exportAll();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sk-study-way-backup-${UI.todayISO()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    UI.toast('Backup downloaded', 'success');
  },

  doImport(mode) {
    const f = document.getElementById('importFile').files[0];
    if (!f) return UI.toast('Please choose a backup file', 'error');
    const action = mode === 'replace'
      ? 'Replace ALL current data with the file? This cannot be undone.'
      : 'Merge file data with current data?';
    if (!confirm(action)) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        DB.importAll(data, mode);
        UI.toast('Data restored! Reloading...', 'success');
        setTimeout(() => location.reload(), 600);
      } catch (err) {
        UI.toast('Invalid backup file', 'error');
      }
    };
    reader.readAsText(f);
  },
};
