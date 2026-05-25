/* ============================================
   dashboard.js — Stats overview with charts
   ============================================ */
(function () {
  if (!AUTH.requireAuth()) return;
  UI.renderShell('dashboard.html', 'Dashboard');

  const students = DB.getStudents();
  const fees = DB.getFees();
  const today = UI.todayISO();
  const todayAtt = DB.attendanceByDate(today);

  const totalCollected = fees.reduce((s, f) => s + Number(f.amount || 0), 0);
  const totalPresent = todayAtt.filter(a => a.status === 'present').length;
  const totalMarked = todayAtt.length;
  const attPct = totalMarked ? Math.round((totalPresent / totalMarked) * 100) : 0;

  const activeStudents = students.filter(s => s.status !== 'inactive').length;

  document.getElementById('stats').innerHTML = `
    <div class="stat">
      <div class="stat-icon indigo">\u{1F465}</div>
      <div class="stat-label">Total Students</div>
      <div class="stat-value">${students.length}</div>
      <div class="stat-foot">${activeStudents} active</div>
    </div>
    <div class="stat">
      <div class="stat-icon green">\u{1F4B0}</div>
      <div class="stat-label">Fees Collected</div>
      <div class="stat-value">${UI.money(totalCollected)}</div>
      <div class="stat-foot">${fees.length} payments</div>
    </div>
    <div class="stat">
      <div class="stat-icon blue">\u{1F4C5}</div>
      <div class="stat-label">Today's Attendance</div>
      <div class="stat-value">${attPct}%</div>
      <div class="stat-foot">${totalPresent} of ${totalMarked || students.length} present</div>
    </div>
    <div class="stat">
      <div class="stat-icon amber">\u{1F4CA}</div>
      <div class="stat-label">Results Recorded</div>
      <div class="stat-value">${DB.getResults().length}</div>
      <div class="stat-foot">Across all students</div>
    </div>
  `;

  // ---- Fee chart (last 6 months) ----
  function renderFeeChart() {
    const monthsBack = 6;
    const now = new Date();
    const months = [];
    for (let i = monthsBack - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = d.toISOString().slice(0, 7);
      const label = d.toLocaleDateString('en-IN', { month: 'short' });
      months.push({ key, label, total: 0 });
    }
    fees.forEach(f => {
      const k = (f.date || '').slice(0, 7);
      const m = months.find(x => x.key === k);
      if (m) m.total += Number(f.amount || 0);
    });

    const max = Math.max(1, ...months.map(m => m.total));
    const grandTotal = months.reduce((s, m) => s + m.total, 0);
    document.getElementById('chartTotal').textContent = UI.money(grandTotal) + ' total';

    const W = 480, H = 220, padX = 30, padY = 30;
    const barW = (W - padX * 2) / months.length * 0.65;
    const gap = (W - padX * 2) / months.length;

    const bars = months.map((m, i) => {
      const x = padX + i * gap + (gap - barW) / 2;
      const h = max ? (m.total / max) * (H - padY * 2) : 0;
      const y = H - padY - h;
      return `
        <rect class="chart-bar" x="${x}" y="${y}" width="${barW}" height="${h}" rx="4">
          <title>${m.label}: ${UI.money(m.total)}</title>
        </rect>
        <text class="chart-value" x="${x + barW/2}" y="${y - 6}" text-anchor="middle">${m.total > 0 ? '\u20B9' + (m.total >= 1000 ? Math.round(m.total/1000) + 'k' : m.total) : ''}</text>
        <text class="chart-label" x="${x + barW/2}" y="${H - padY + 16}" text-anchor="middle">${m.label}</text>
      `;
    }).join('');

    document.getElementById('feeChart').innerHTML = `
      <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" style="width:100%;height:auto;max-height:240px;">
        <line class="chart-axis" x1="${padX}" y1="${H - padY}" x2="${W - padX}" y2="${H - padY}" />
        ${bars}
      </svg>
    `;
  }
  renderFeeChart();

  // ---- Recent fees ----
  const recent = [...fees].sort((a, b) => (b.date || '').localeCompare(a.date || '')).slice(0, 6);
  const tbody = document.getElementById('recentFees');
  if (recent.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" class="empty">No fee payments yet. <a href="fees.html">Record one</a>.</td></tr>`;
  } else {
    tbody.innerHTML = recent.map(f => {
      const stu = DB.getStudent(f.studentId);
      return `<tr>
        <td>${UI.fmtDate(f.date)}</td>
        <td>${UI.esc(stu ? stu.name : 'Unknown')}</td>
        <td><strong>${UI.money(f.amount)}</strong></td>
        <td><span class="badge badge-info">${UI.esc(f.mode || 'Cash')}</span></td>
      </tr>`;
    }).join('');
  }

  // ---- Today's attendance ----
  const attBox = document.getElementById('todayAtt');
  if (students.length === 0) {
    attBox.innerHTML = `<p style="color: var(--text-muted);">Add students first to track attendance.</p>`;
  } else if (totalMarked === 0) {
    attBox.innerHTML = `
      <p style="color: var(--text-muted); margin-bottom: 12px;">Attendance not yet marked for today.</p>
      <a href="attendance.html" class="btn btn-primary btn-sm">Mark now</a>
    `;
  } else {
    const absent = todayAtt.filter(a => a.status === 'absent').length;
    const late = todayAtt.filter(a => a.status === 'late').length;

    // Donut chart
    const total = totalPresent + absent + late;
    const r = 38, c = 2 * Math.PI * r;
    const presentArc = total ? (totalPresent / total) * c : 0;
    const absentArc = total ? (absent / total) * c : 0;
    const lateArc = total ? (late / total) * c : 0;

    attBox.innerHTML = `
      <div style="display:flex;align-items:center;gap:18px;flex-wrap:wrap;">
        <svg width="100" height="100" viewBox="0 0 100 100" style="flex-shrink:0;">
          <circle class="donut-bg" cx="50" cy="50" r="${r}"/>
          <circle class="donut-fg" cx="50" cy="50" r="${r}" stroke="${total ? '#10b981' : 'transparent'}"
            stroke-dasharray="${presentArc} ${c}" stroke-dashoffset="0" transform="rotate(-90 50 50)"/>
          <circle class="donut-fg" cx="50" cy="50" r="${r}" stroke="${total ? '#ef4444' : 'transparent'}"
            stroke-dasharray="${absentArc} ${c}" stroke-dashoffset="${-presentArc}" transform="rotate(-90 50 50)"/>
          <circle class="donut-fg" cx="50" cy="50" r="${r}" stroke="${total ? '#f59e0b' : 'transparent'}"
            stroke-dasharray="${lateArc} ${c}" stroke-dashoffset="${-(presentArc + absentArc)}" transform="rotate(-90 50 50)"/>
          <text x="50" y="48" text-anchor="middle" style="font-size:18px;font-weight:700;fill:var(--text);">${attPct}%</text>
          <text x="50" y="62" text-anchor="middle" style="font-size:9px;fill:var(--text-muted);">attendance</text>
        </svg>
        <div style="flex:1;min-width:120px;">
          <div style="margin-bottom:6px;display:flex;justify-content:space-between;font-size:13px;">
            <span><span style="display:inline-block;width:8px;height:8px;background:#10b981;border-radius:50%;margin-right:6px;"></span>Present</span>
            <strong>${totalPresent}</strong>
          </div>
          <div style="margin-bottom:6px;display:flex;justify-content:space-between;font-size:13px;">
            <span><span style="display:inline-block;width:8px;height:8px;background:#ef4444;border-radius:50%;margin-right:6px;"></span>Absent</span>
            <strong>${absent}</strong>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:13px;">
            <span><span style="display:inline-block;width:8px;height:8px;background:#f59e0b;border-radius:50%;margin-right:6px;"></span>Late</span>
            <strong>${late}</strong>
          </div>
        </div>
      </div>
    `;
  }

  // ---- Latest notices ----
  const notices = DB.getNotices().slice(0, 3);
  const noticeBox = document.getElementById('latestNotices');
  if (notices.length === 0) {
    noticeBox.innerHTML = `
      <p style="color: var(--text-muted); margin-bottom: 12px; font-size: 13px;">No notices posted yet.</p>
      <a href="notices.html" class="btn btn-primary btn-sm">+ Post Notice</a>
    `;
  } else {
    noticeBox.innerHTML = notices.map(n => `
      <div style="padding-bottom:10px;margin-bottom:10px;border-bottom:1px solid var(--border);">
        <div style="font-weight:600;font-size:13px;margin-bottom:2px;">${n.pinned ? '\u{1F4CC} ' : ''}${UI.esc(n.title)}</div>
        <div style="font-size:11px;color:var(--text-muted);">${UI.fmtDateTime(n.createdAt)}</div>
      </div>
    `).join('');
  }
})();
