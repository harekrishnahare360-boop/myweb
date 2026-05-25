/* ============================================
   results.js — Marks entry & report cards (Batch + WhatsApp share)
   ============================================ */
(function () {
  if (!AUTH.requireAuth()) return;
  UI.renderShell('results.html', 'Results');

  const $ = (id) => document.getElementById(id);

  function gradeFor(pct) {
    if (pct >= 90) return { g: 'A+', cls: 'badge-success' };
    if (pct >= 80) return { g: 'A',  cls: 'badge-success' };
    if (pct >= 70) return { g: 'B+', cls: 'badge-info' };
    if (pct >= 60) return { g: 'B',  cls: 'badge-info' };
    if (pct >= 50) return { g: 'C',  cls: 'badge-warning' };
    if (pct >= 40) return { g: 'D',  cls: 'badge-warning' };
    return { g: 'F', cls: 'badge-danger' };
  }

  function totals(subjects) {
    const obtained = subjects.reduce((s, x) => s + Number(x.marks || 0), 0);
    const max = subjects.reduce((s, x) => s + Number(x.outOf || 0), 0);
    const pct = max ? Math.round((obtained / max) * 100) : 0;
    return { obtained, max, pct };
  }

  function populateStudentSelects() {
    const students = DB.getStudents();
    const opts = students
      .map(s => `<option value="${s.id}">${UI.esc(s.name)} (${UI.esc(s.roll)} - ${UI.esc(s.batch)})</option>`)
      .join('');
    $('studentId').innerHTML = '<option value="">-- Select student --</option>' + opts;

    const filt = $('filterStudent');
    const cur = filt.value;
    filt.innerHTML = '<option value="">All Students</option>' + opts;
    filt.value = cur;
  }

  function populateExamFilter() {
    const exams = [...new Set(DB.getResults().map(r => r.examName).filter(Boolean))].sort();
    const sel = $('filterExam');
    const cur = sel.value;
    sel.innerHTML = '<option value="">All Exams</option>' +
      exams.map(e => `<option value="${UI.esc(e)}">${UI.esc(e)}</option>`).join('');
    sel.value = cur;
  }

  function getFiltered() {
    const sid = $('filterStudent').value;
    const exam = $('filterExam').value;
    return DB.getResults().filter(r => {
      if (sid && r.studentId !== sid) return false;
      if (exam && r.examName !== exam) return false;
      return true;
    }).sort((a, b) => (b.examDate || '').localeCompare(a.examDate || ''));
  }

  function render() {
    populateExamFilter();
    const list = getFiltered();
    const tbody = $('resultList');
    if (list.length === 0) {
      tbody.innerHTML = `<tr><td colspan="9" class="empty">No results recorded. Click "+ Enter Marks" to add one.</td></tr>`;
      return;
    }
    tbody.innerHTML = list.map(r => {
      const s = DB.getStudent(r.studentId);
      const t = totals(r.subjects || []);
      const g = gradeFor(t.pct);
      return `<tr>
        <td><strong>${UI.esc(s ? s.name : 'Unknown')}</strong> <span style="color:var(--text-muted);font-size:12px;">(${UI.esc(s?.roll || '-')})</span></td>
        <td>${UI.esc(s?.batch || '-')}</td>
        <td>${UI.esc(r.examName)}</td>
        <td>${UI.fmtDate(r.examDate)}</td>
        <td>${(r.subjects || []).length} subjects</td>
        <td><strong>${t.obtained} / ${t.max}</strong></td>
        <td>${t.pct}%</td>
        <td><span class="badge ${g.cls}">${g.g}</span></td>
        <td>
          <button class="btn btn-ghost btn-sm" onclick="viewCard('${r.id}')">View</button>
          <button class="btn btn-danger btn-sm" onclick="del('${r.id}')">Delete</button>
        </td>
      </tr>`;
    }).join('');
  }

  function subjectRowHtml(name = '', marks = '', outOf = 100) {
    return `<tr>
      <td><input class="input subj-name" type="text" placeholder="e.g. Mathematics" value="${UI.esc(name)}" /></td>
      <td><input class="input subj-marks" type="number" min="0" step="0.5" value="${marks}" /></td>
      <td><input class="input subj-outOf" type="number" min="1" step="1" value="${outOf}" /></td>
      <td><button type="button" class="btn btn-ghost btn-sm" onclick="this.closest('tr').remove()">&times;</button></td>
    </tr>`;
  }

  window.addSubjectRow = function () {
    $('subjectRows').insertAdjacentHTML('beforeend', subjectRowHtml());
  };

  function readSubjects() {
    const rows = $('subjectRows').querySelectorAll('tr');
    const subs = [];
    rows.forEach(tr => {
      const name = tr.querySelector('.subj-name').value.trim();
      const marks = tr.querySelector('.subj-marks').value;
      const outOf = tr.querySelector('.subj-outOf').value;
      if (name) subs.push({ name, marks: Number(marks) || 0, outOf: Number(outOf) || 100 });
    });
    return subs;
  }

  window.openAdd = function () {
    if (DB.getStudents().length === 0) {
      UI.toast('Please add students first', 'error');
      return;
    }
    $('resultForm').reset();
    $('examDate').value = UI.todayISO();
    $('subjectRows').innerHTML =
      subjectRowHtml('Mathematics', '', 100) +
      subjectRowHtml('English', '', 100) +
      subjectRowHtml('Science', '', 100);
    UI.openModal('resultModal');
  };

  window.del = function (id) {
    if (!confirm('Delete this result?')) return;
    DB.deleteResult(id);
    UI.toast('Result deleted', 'success');
    render();
  };

  window.shareCardOnWA = function (id) {
    const r = DB.getResults().find(x => x.id === id);
    if (!r) return;
    const s = DB.getStudent(r.studentId);
    const t = totals(r.subjects || []);
    const g = gradeFor(t.pct);
    const lines = [
      '*SK STUDY WAY - Report Card*',
      '------------------------------',
      `Student: ${s?.name || '-'} (${s?.roll || '-'})`,
      `Batch: ${s?.batch || '-'}`,
      `Exam: ${r.examName}`,
      `Date: ${UI.fmtDate(r.examDate)}`,
      '',
      '*Subjects:*',
      ...(r.subjects || []).map(sub => `- ${sub.name}: ${sub.marks}/${sub.outOf}`),
      '',
      `*Total: ${t.obtained} / ${t.max}*`,
      `*Percentage: ${t.pct}%*`,
      `*Grade: ${g.g}*`,
      r.remarks ? `\nRemarks: ${r.remarks}` : '',
      '------------------------------',
      '- Sk Study Way',
    ].filter(Boolean).join('\n');
    const phone = (s?.phone || '').replace(/\D/g, '');
    const url = phone
      ? `https://wa.me/${phone.length === 10 ? '91' + phone : phone}?text=${encodeURIComponent(lines)}`
      : `https://wa.me/?text=${encodeURIComponent(lines)}`;
    window.open(url, '_blank');
  };

  window.viewCard = function (id) {
    const r = DB.getResults().find(x => x.id === id);
    if (!r) return;
    const s = DB.getStudent(r.studentId);
    const t = totals(r.subjects || []);
    const g = gradeFor(t.pct);

    const subjectRows = (r.subjects || []).map((sub, i) => {
      const pct = sub.outOf ? Math.round((sub.marks / sub.outOf) * 100) : 0;
      const sg = gradeFor(pct);
      return `<tr>
        <td>${i + 1}</td>
        <td>${UI.esc(sub.name)}</td>
        <td style="text-align:right;">${sub.marks}</td>
        <td style="text-align:right;">${sub.outOf}</td>
        <td style="text-align:right;">${pct}%</td>
        <td><span class="badge ${sg.cls}">${sg.g}</span></td>
      </tr>`;
    }).join('');

    $('cardBody').innerHTML = `
      <div style="text-align:center; border-bottom: 2px solid var(--primary); padding-bottom: 14px; margin-bottom: 18px;">
        <h2 style="color: var(--primary); letter-spacing: 1px;">SK STUDY WAY</h2>
        <div style="color: var(--text-muted); font-size: 13px;">Tuition Management Center</div>
        <div style="margin-top: 8px; font-size: 16px; font-weight: 600;">REPORT CARD</div>
      </div>

      <div class="row row-2" style="margin-bottom: 18px;">
        <div>
          <div style="font-size:12px;color:var(--text-muted);">Student Name</div>
          <div style="font-size:16px;font-weight:600;">${UI.esc(s?.name || '-')}</div>
        </div>
        <div>
          <div style="font-size:12px;color:var(--text-muted);">Roll No</div>
          <div style="font-size:16px;font-weight:600;">${UI.esc(s?.roll || '-')}</div>
        </div>
        <div>
          <div style="font-size:12px;color:var(--text-muted);">Batch</div>
          <div style="font-size:16px;font-weight:600;">${UI.esc(s?.batch || '-')}</div>
        </div>
        <div>
          <div style="font-size:12px;color:var(--text-muted);">Exam</div>
          <div style="font-size:16px;font-weight:600;">${UI.esc(r.examName)}</div>
        </div>
        <div>
          <div style="font-size:12px;color:var(--text-muted);">Date</div>
          <div style="font-size:16px;font-weight:600;">${UI.fmtDate(r.examDate)}</div>
        </div>
      </div>

      <table class="table" style="margin-bottom: 18px;">
        <thead>
          <tr><th>#</th><th>Subject</th><th style="text-align:right;">Marks</th><th style="text-align:right;">Out of</th><th style="text-align:right;">%</th><th>Grade</th></tr>
        </thead>
        <tbody>${subjectRows || '<tr><td colspan="6" class="empty">No subjects</td></tr>'}</tbody>
      </table>

      <div style="display:grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; padding: 18px; background: var(--primary-light); border-radius: 10px; text-align: center;">
        <div>
          <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;">Total</div>
          <div style="font-size:22px;font-weight:700;color:var(--primary);">${t.obtained} / ${t.max}</div>
        </div>
        <div>
          <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;">Percentage</div>
          <div style="font-size:22px;font-weight:700;color:var(--primary);">${t.pct}%</div>
        </div>
        <div>
          <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;">Grade</div>
          <div style="font-size:22px;font-weight:700;color:var(--primary);">${g.g}</div>
        </div>
      </div>

      ${r.remarks ? `<div style="margin-top:18px;padding:14px;background:var(--surface-hover);border-radius:8px;"><strong>Remarks:</strong> ${UI.esc(r.remarks)}</div>` : ''}

      <div style="margin-top:30px; display:grid; grid-template-columns: 1fr 1fr; gap: 40px;">
        <div style="text-align:center;border-top:1px solid var(--border);padding-top:8px;font-size:12px;color:var(--text-muted);">Teacher's Signature</div>
        <div style="text-align:center;border-top:1px solid var(--border);padding-top:8px;font-size:12px;color:var(--text-muted);">Principal's Signature</div>
      </div>
    `;
    $('cardShareBtn').onclick = () => shareCardOnWA(r.id);
    UI.openModal('cardModal');
  };

  $('resultForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const subjects = readSubjects();
    if (subjects.length === 0) return UI.toast('Add at least one subject', 'error');
    const data = {
      studentId: $('studentId').value,
      examName: $('examName').value.trim(),
      examDate: $('examDate').value,
      subjects,
      remarks: $('remarks').value.trim(),
      createdAt: new Date().toISOString(),
    };
    if (!data.studentId) return UI.toast('Please select a student', 'error');
    DB.addResult(data);
    UI.toast('Result saved', 'success');
    UI.closeModal('resultModal');
    render();
  });

  ['filterStudent', 'filterExam'].forEach(id =>
    $(id).addEventListener('change', render)
  );

  populateStudentSelects();
  render();
})();
