/* ============================================
   attendance.js — Daily attendance marking
   ============================================ */
(function () {
  if (!AUTH.requireAuth()) return;
  UI.renderShell('attendance.html', 'Attendance');

  const $ = (id) => document.getElementById(id);

  function refreshClassFilter() {
    const classes = [...new Set(DB.getStudents().map(s => s.class).filter(Boolean))].sort();
    const sel = $('filterClass');
    const cur = sel.value;
    sel.innerHTML = '<option value="">All Classes</option>' +
      classes.map(c => `<option value="${UI.esc(c)}">${UI.esc(c)}</option>`).join('');
    sel.value = cur;
  }

  function getStatus(date, studentId) {
    const rec = DB.getAttendance().find(a => a.date === date && a.studentId === studentId);
    return rec ? rec.status : '';
  }

  function render() {
    const date = $('date').value;
    const cls = $('filterClass').value;
    $('dateLabel').textContent = UI.fmtDate(date);

    refreshClassFilter();

    const students = DB.getStudents()
      .filter(s => s.status !== 'inactive')
      .filter(s => !cls || s.class === cls)
      .sort((a, b) => (a.class || '').localeCompare(b.class || '') || (a.roll || '').localeCompare(b.roll || ''));

    // Stats for selected date
    const dayRecords = DB.attendanceByDate(date);
    const present = dayRecords.filter(a => a.status === 'present').length;
    const absent  = dayRecords.filter(a => a.status === 'absent').length;
    const late    = dayRecords.filter(a => a.status === 'late').length;
    const unmarked = students.length - dayRecords.filter(r => students.some(s => s.id === r.studentId)).length;

    $('attStats').innerHTML = `
      <div class="stat"><div class="stat-icon green">\u2713</div><div class="stat-label">Present</div><div class="stat-value">${present}</div></div>
      <div class="stat"><div class="stat-icon red">\u2717</div><div class="stat-label">Absent</div><div class="stat-value">${absent}</div></div>
      <div class="stat"><div class="stat-icon amber">\u29D6</div><div class="stat-label">Late</div><div class="stat-value">${late}</div></div>
      <div class="stat"><div class="stat-icon indigo">?</div><div class="stat-label">Unmarked</div><div class="stat-value">${Math.max(0, unmarked)}</div></div>
    `;

    const tbody = $('attList');
    if (students.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" class="empty">No active students. <a href="students.html">Add students</a> first.</td></tr>`;
      return;
    }

    tbody.innerHTML = students.map(s => {
      const status = getStatus(date, s.id);
      const badge = status === 'present' ? '<span class="badge badge-success">Present</span>' :
                    status === 'absent'  ? '<span class="badge badge-danger">Absent</span>' :
                    status === 'late'    ? '<span class="badge badge-warning">Late</span>' :
                    '<span style="color:var(--text-muted);font-size:12px;">Not marked</span>';
      return `<tr class="attendance-row">
        <td><strong>${UI.esc(s.roll)}</strong></td>
        <td>${UI.esc(s.name)}</td>
        <td>${UI.esc(s.class)}${s.section ? ' - ' + UI.esc(s.section) : ''}</td>
        <td>${badge}</td>
        <td>
          <div class="att-buttons">
            <button class="btn btn-ghost ${status==='present'?'active present':''}" onclick="setStatus('${s.id}', 'present')">P</button>
            <button class="btn btn-ghost ${status==='absent'?'active absent':''}" onclick="setStatus('${s.id}', 'absent')">A</button>
            <button class="btn btn-ghost ${status==='late'?'active late':''}" onclick="setStatus('${s.id}', 'late')">L</button>
          </div>
        </td>
      </tr>`;
    }).join('');
  }

  window.setStatus = function (studentId, status) {
    const date = $('date').value;
    DB.setAttendance(date, studentId, status);
    render();
  };

  window.markAll = function (status) {
    const date = $('date').value;
    const cls = $('filterClass').value;
    const students = DB.getStudents()
      .filter(s => s.status !== 'inactive')
      .filter(s => !cls || s.class === cls);
    if (students.length === 0) return;
    if (!confirm(`Mark all ${students.length} students as ${status} for ${UI.fmtDate(date)}?`)) return;
    students.forEach(s => DB.setAttendance(date, s.id, status));
    UI.toast(`All marked ${status}`, 'success');
    render();
  };

  window.viewReport = function () {
    const today = UI.todayISO();
    const monthAgo = new Date();
    monthAgo.setDate(monthAgo.getDate() - 30);
    $('reportFrom').value = monthAgo.toISOString().slice(0, 10);
    $('reportTo').value = today;
    $('reportBody').innerHTML = '<p style="color:var(--text-muted);">Pick a date range and click Generate.</p>';
    UI.openModal('reportModal');
  };

  window.generateReport = function () {
    const from = $('reportFrom').value;
    const to = $('reportTo').value;
    if (!from || !to) return UI.toast('Pick both dates', 'error');
    if (from > to) return UI.toast('"From" must be before "To"', 'error');

    const students = DB.getStudents().filter(s => s.status !== 'inactive');
    const all = DB.getAttendance().filter(a => a.date >= from && a.date <= to);

    const rows = students.map(s => {
      const recs = all.filter(a => a.studentId === s.id);
      const p = recs.filter(a => a.status === 'present').length;
      const ab = recs.filter(a => a.status === 'absent').length;
      const l = recs.filter(a => a.status === 'late').length;
      const total = p + ab + l;
      const pct = total ? Math.round(((p + l * 0.5) / total) * 100) : 0;
      return { s, p, ab, l, total, pct };
    });

    $('reportBody').innerHTML = `
      <div style="margin-bottom:14px;font-size:13px;color:var(--text-muted);">
        Period: <strong>${UI.fmtDate(from)}</strong> to <strong>${UI.fmtDate(to)}</strong>
      </div>
      <div class="table-wrap">
        <table class="table">
          <thead><tr><th>Roll</th><th>Name</th><th>Class</th><th>Present</th><th>Absent</th><th>Late</th><th>Total</th><th>%</th></tr></thead>
          <tbody>
            ${rows.length === 0 ? '<tr><td colspan="8" class="empty">No students.</td></tr>' :
              rows.map(r => `<tr>
                <td>${UI.esc(r.s.roll)}</td>
                <td>${UI.esc(r.s.name)}</td>
                <td>${UI.esc(r.s.class)}</td>
                <td style="color:var(--success);font-weight:600;">${r.p}</td>
                <td style="color:var(--danger);font-weight:600;">${r.ab}</td>
                <td style="color:var(--warning);font-weight:600;">${r.l}</td>
                <td>${r.total}</td>
                <td><strong>${r.pct}%</strong></td>
              </tr>`).join('')
            }
          </tbody>
        </table>
      </div>
    `;
  };

  $('date').addEventListener('change', render);
  $('filterClass').addEventListener('change', render);

  $('date').value = UI.todayISO();
  render();
})();
