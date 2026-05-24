/* ============================================
   dashboard.js — Stats overview
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

  // Active students = those without status='inactive'
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

  // Recent fees
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

  // Today's attendance summary
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
    attBox.innerHTML = `
      <div style="display: flex; gap: 14px; flex-wrap: wrap;">
        <div><div style="font-size:22px;font-weight:700;color:var(--success);">${totalPresent}</div><div style="font-size:12px;color:var(--text-muted);">Present</div></div>
        <div><div style="font-size:22px;font-weight:700;color:var(--danger);">${absent}</div><div style="font-size:12px;color:var(--text-muted);">Absent</div></div>
        <div><div style="font-size:22px;font-weight:700;color:var(--warning);">${late}</div><div style="font-size:12px;color:var(--text-muted);">Late</div></div>
      </div>
    `;
  }
})();
