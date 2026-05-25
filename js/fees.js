/* ============================================
   fees.js — Payment tracking + receipts (with WhatsApp share)
   ============================================ */
(function () {
  if (!AUTH.requireAuth()) return;
  UI.renderShell('fees.html', 'Fees Management');

  const $ = (id) => document.getElementById(id);

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

  function populateMonthFilter() {
    const months = [...new Set(DB.getFees().map(f => f.month).filter(Boolean))].sort().reverse();
    const sel = $('filterMonth');
    const cur = sel.value;
    sel.innerHTML = '<option value="">All Months</option>' +
      months.map(m => `<option value="${m}">${formatMonth(m)}</option>`).join('');
    sel.value = cur;
  }

  function formatMonth(m) {
    if (!m) return '-';
    const [y, mo] = m.split('-');
    const d = new Date(Number(y), Number(mo) - 1, 1);
    return d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  }

  function getFiltered() {
    const sid = $('filterStudent').value;
    const mon = $('filterMonth').value;
    const q = $('search').value.trim().toLowerCase();
    return DB.getFees().filter(f => {
      if (sid && f.studentId !== sid) return false;
      if (mon && f.month !== mon) return false;
      if (q) {
        const s = DB.getStudent(f.studentId);
        const hay = [s?.name, s?.roll, f.id, f.note, f.mode].join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    }).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }

  function renderStats() {
    const fees = DB.getFees();
    const total = fees.reduce((s, f) => s + Number(f.amount || 0), 0);

    const ym = UI.todayISO().slice(0, 7);
    const thisMonth = fees.filter(f => f.month === ym).reduce((s, f) => s + Number(f.amount || 0), 0);

    const students = DB.getStudents().filter(s => s.status !== 'inactive');
    let pending = 0;
    students.forEach(s => {
      const paid = fees.filter(f => f.studentId === s.id && f.month === ym)
                       .reduce((sum, f) => sum + Number(f.amount || 0), 0);
      const expected = Number(s.monthlyFee) || 0;
      if (expected > paid) pending += (expected - paid);
    });

    $('feeStats').innerHTML = `
      <div class="stat">
        <div class="stat-icon green">\u{1F4B0}</div>
        <div class="stat-label">Total Collected</div>
        <div class="stat-value">${UI.money(total)}</div>
        <div class="stat-foot">${fees.length} payments</div>
      </div>
      <div class="stat">
        <div class="stat-icon indigo">\u{1F4C5}</div>
        <div class="stat-label">This Month (${formatMonth(ym)})</div>
        <div class="stat-value">${UI.money(thisMonth)}</div>
      </div>
      <div class="stat">
        <div class="stat-icon red">\u26A0</div>
        <div class="stat-label">Pending This Month</div>
        <div class="stat-value">${UI.money(pending)}</div>
        <div class="stat-foot">Based on monthly fees</div>
      </div>
    `;
  }

  function render() {
    renderStats();
    populateMonthFilter();
    const list = getFiltered();
    const tbody = $('feeList');
    if (list.length === 0) {
      tbody.innerHTML = `<tr><td colspan="9" class="empty">No fee payments found.</td></tr>`;
      return;
    }
    tbody.innerHTML = list.map(f => {
      const s = DB.getStudent(f.studentId);
      return `<tr>
        <td><code style="font-size:11px;color:var(--text-muted);">${f.id}</code></td>
        <td>${UI.fmtDate(f.date)}</td>
        <td>${UI.esc(s ? s.name : 'Unknown')} <span style="color:var(--text-muted);font-size:12px;">(${UI.esc(s?.roll || '-')})</span></td>
        <td>${UI.esc(s?.batch || '-')}</td>
        <td>${formatMonth(f.month)}</td>
        <td><strong>${UI.money(f.amount)}</strong></td>
        <td><span class="badge badge-info">${UI.esc(f.mode || 'Cash')}</span></td>
        <td>${UI.esc(f.note || '-')}</td>
        <td>
          <button class="btn btn-ghost btn-sm" onclick="showReceipt('${f.id}')">Receipt</button>
          <button class="btn btn-danger btn-sm" onclick="del('${f.id}')">Delete</button>
        </td>
      </tr>`;
    }).join('');
  }

  window.openAdd = function () {
    if (DB.getStudents().length === 0) {
      UI.toast('Please add students first', 'error');
      return;
    }
    $('feeForm').reset();
    $('date').value = UI.todayISO();
    $('month').value = UI.todayISO().slice(0, 7);
    UI.openModal('feeModal');
  };

  window.del = function (id) {
    if (!confirm('Delete this payment record?')) return;
    DB.deleteFee(id);
    UI.toast('Payment deleted', 'success');
    render();
  };

  window.shareReceiptOnWA = function (id) {
    const f = DB.getFees().find(x => x.id === id);
    if (!f) return;
    const s = DB.getStudent(f.studentId);
    const lines = [
      '*SK STUDY WAY - Fee Receipt*',
      '------------------------------',
      `Receipt: ${f.id}`,
      `Student: ${s?.name || '-'} (${s?.roll || '-'})`,
      `Batch: ${s?.batch || '-'}`,
      `Date: ${UI.fmtDate(f.date)}`,
      `For Month: ${formatMonth(f.month)}`,
      `Amount Paid: ${UI.money(f.amount)}`,
      `Mode: ${f.mode || 'Cash'}`,
      f.note ? `Note: ${f.note}` : '',
      '------------------------------',
      'Thank you! - Sk Study Way',
    ].filter(Boolean).join('\n');
    const phone = (s?.phone || '').replace(/\D/g, '');
    const url = phone
      ? `https://wa.me/${phone.length === 10 ? '91' + phone : phone}?text=${encodeURIComponent(lines)}`
      : `https://wa.me/?text=${encodeURIComponent(lines)}`;
    window.open(url, '_blank');
  };

  window.showReceipt = function (id) {
    const f = DB.getFees().find(x => x.id === id);
    if (!f) return;
    const s = DB.getStudent(f.studentId);
    $('receiptBody').innerHTML = `
      <h3>SK STUDY WAY</h3>
      <div class="receipt-sub">Fee Payment Receipt</div>
      <div class="receipt-row"><span>Receipt No:</span><strong>${f.id}</strong></div>
      <div class="receipt-row"><span>Date:</span><strong>${UI.fmtDate(f.date)}</strong></div>
      <div class="receipt-row"><span>Student:</span><strong>${UI.esc(s?.name || '-')}</strong></div>
      <div class="receipt-row"><span>Roll No:</span><strong>${UI.esc(s?.roll || '-')}</strong></div>
      <div class="receipt-row"><span>Batch:</span><strong>${UI.esc(s?.batch || '-')}</strong></div>
      <div class="receipt-row"><span>For Month:</span><strong>${formatMonth(f.month)}</strong></div>
      <div class="receipt-row"><span>Payment Mode:</span><strong>${UI.esc(f.mode || 'Cash')}</strong></div>
      ${f.note ? `<div class="receipt-row"><span>Note:</span><strong>${UI.esc(f.note)}</strong></div>` : ''}
      <div class="receipt-row receipt-total"><span>TOTAL PAID:</span><strong>${UI.money(f.amount)}</strong></div>
      <div style="text-align:center;margin-top:24px;font-size:12px;color:#6b7280;">
        Thank you! \u2014 Sk Study Way
      </div>
    `;
    $('receiptShareBtn').onclick = () => shareReceiptOnWA(f.id);
    UI.openModal('receiptModal');
  };

  $('feeForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const data = {
      studentId: $('studentId').value,
      amount: Number($('amount').value),
      date: $('date').value,
      month: $('month').value,
      mode: $('mode').value,
      note: $('note').value.trim(),
    };
    if (!data.studentId) return UI.toast('Please select a student', 'error');
    const fee = DB.addFee(data);
    UI.toast('Payment recorded', 'success');
    UI.closeModal('feeModal');
    render();
    setTimeout(() => showReceipt(fee.id), 200);
  });

  ['filterStudent', 'filterMonth', 'search'].forEach(id =>
    $(id).addEventListener('input', render)
  );

  populateStudentSelects();
  render();
})();
