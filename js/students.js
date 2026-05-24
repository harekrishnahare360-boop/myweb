/* ============================================
   students.js — CRUD for students
   ============================================ */
(function () {
  if (!AUTH.requireAuth()) return;
  UI.renderShell('students.html', 'Students');

  const $ = (id) => document.getElementById(id);

  function getFiltered() {
    const q = $('search').value.trim().toLowerCase();
    const cls = $('filterClass').value;
    return DB.getStudents().filter(s => {
      if (cls && s.class !== cls) return false;
      if (!q) return true;
      return [s.name, s.roll, s.class, s.parent, s.phone].some(v =>
        String(v || '').toLowerCase().includes(q)
      );
    });
  }

  function refreshClassFilter() {
    const classes = [...new Set(DB.getStudents().map(s => s.class).filter(Boolean))].sort();
    const sel = $('filterClass');
    const cur = sel.value;
    sel.innerHTML = '<option value="">All Classes</option>' +
      classes.map(c => `<option value="${UI.esc(c)}">${UI.esc(c)}</option>`).join('');
    sel.value = cur;
  }

  function render() {
    refreshClassFilter();
    const list = getFiltered();
    const tbody = $('studentList');
    if (list.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" class="empty">No students found. Click "+ Add Student" to get started.</td></tr>`;
      return;
    }
    tbody.innerHTML = list.map(s => `
      <tr>
        <td><strong>${UI.esc(s.roll)}</strong></td>
        <td>${UI.esc(s.name)}</td>
        <td>${UI.esc(s.class)}${s.section ? ' - ' + UI.esc(s.section) : ''}</td>
        <td>${UI.esc(s.parent || '-')}</td>
        <td>${UI.esc(s.phone || '-')}</td>
        <td>${UI.money(s.monthlyFee)}</td>
        <td>${s.status === 'inactive'
            ? '<span class="badge badge-danger">Inactive</span>'
            : '<span class="badge badge-success">Active</span>'}</td>
        <td>
          <button class="btn btn-ghost btn-sm" onclick="openEdit('${s.id}')">Edit</button>
          <button class="btn btn-danger btn-sm" onclick="del('${s.id}')">Delete</button>
        </td>
      </tr>
    `).join('');
  }

  window.openAdd = function () {
    $('modalTitle').textContent = 'Add Student';
    $('studentForm').reset();
    $('studentId').value = '';
    UI.openModal('studentModal');
  };

  window.openEdit = function (id) {
    const s = DB.getStudent(id);
    if (!s) return;
    $('modalTitle').textContent = 'Edit Student';
    $('studentId').value = s.id;
    $('roll').value = s.roll || '';
    $('name').value = s.name || '';
    $('class').value = s.class || '';
    $('section').value = s.section || '';
    $('parent').value = s.parent || '';
    $('phone').value = s.phone || '';
    $('monthlyFee').value = s.monthlyFee || '';
    $('status').value = s.status || 'active';
    $('address').value = s.address || '';
    UI.openModal('studentModal');
  };

  window.del = function (id) {
    const s = DB.getStudent(id);
    if (!s) return;
    if (!confirm(`Delete "${s.name}"? This will also remove all their fees, attendance, and results.`)) return;
    DB.deleteStudent(id);
    UI.toast('Student deleted', 'success');
    render();
  };

  $('studentForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const data = {
      roll: $('roll').value.trim(),
      name: $('name').value.trim(),
      class: $('class').value.trim(),
      section: $('section').value.trim(),
      parent: $('parent').value.trim(),
      phone: $('phone').value.trim(),
      monthlyFee: Number($('monthlyFee').value) || 0,
      status: $('status').value,
      address: $('address').value.trim(),
    };
    const id = $('studentId').value;
    if (id) {
      DB.updateStudent(id, data);
      UI.toast('Student updated', 'success');
    } else {
      DB.addStudent(data);
      UI.toast('Student added', 'success');
    }
    UI.closeModal('studentModal');
    render();
  });

  $('search').addEventListener('input', render);
  $('filterClass').addEventListener('change', render);

  render();
})();
