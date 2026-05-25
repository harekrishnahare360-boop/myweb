/* ============================================
   storage.js — localStorage data layer
   Provides simple CRUD for students, fees,
   attendance, results and notices.
   ============================================ */

const DB = {
  KEYS: {
    AUTH: 'ssw_auth',
    USER: 'ssw_user',
    STUDENTS: 'ssw_students',
    FEES: 'ssw_fees',
    ATTENDANCE: 'ssw_attendance',
    RESULTS: 'ssw_results',
    NOTICES: 'ssw_notices',
    THEME: 'ssw_theme',
  },

  read(key, fallback = []) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  },

  write(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  },

  /** One-shot migration: rename `class` -> `batch`, drop `section`. */
  _migrateStudents() {
    const list = this.read(this.KEYS.STUDENTS, []);
    let changed = false;
    list.forEach(s => {
      if (s.class !== undefined && s.batch === undefined) {
        s.batch = s.class;
        delete s.class;
        changed = true;
      }
      if (s.section !== undefined) {
        delete s.section;
        changed = true;
      }
    });
    if (changed) this.write(this.KEYS.STUDENTS, list);
  },

  // ---- Students ----
  getStudents() { this._migrateStudents(); return this.read(this.KEYS.STUDENTS, []); },
  saveStudents(list) { this.write(this.KEYS.STUDENTS, list); },
  getStudent(id) { return this.getStudents().find(s => s.id === id); },
  addStudent(s) {
    const list = this.getStudents();
    s.id = 'S' + Date.now();
    s.createdAt = new Date().toISOString();
    list.push(s);
    this.saveStudents(list);
    return s;
  },
  updateStudent(id, patch) {
    const list = this.getStudents();
    const i = list.findIndex(s => s.id === id);
    if (i >= 0) { list[i] = { ...list[i], ...patch }; this.saveStudents(list); }
    return list[i];
  },
  deleteStudent(id) {
    this.saveStudents(this.getStudents().filter(s => s.id !== id));
    // cascade clean
    this.saveFees(this.getFees().filter(f => f.studentId !== id));
    this.saveAttendance(this.getAttendance().filter(a => a.studentId !== id));
    this.saveResults(this.getResults().filter(r => r.studentId !== id));
  },

  // ---- Fees ----
  getFees() { return this.read(this.KEYS.FEES, []); },
  saveFees(list) { this.write(this.KEYS.FEES, list); },
  addFee(f) {
    const list = this.getFees();
    f.id = 'F' + Date.now();
    list.push(f);
    this.saveFees(list);
    return f;
  },
  deleteFee(id) {
    this.saveFees(this.getFees().filter(f => f.id !== id));
  },
  feesByStudent(studentId) {
    return this.getFees().filter(f => f.studentId === studentId);
  },

  // ---- Attendance ----
  getAttendance() { return this.read(this.KEYS.ATTENDANCE, []); },
  saveAttendance(list) { this.write(this.KEYS.ATTENDANCE, list); },
  setAttendance(date, studentId, status) {
    const list = this.getAttendance();
    const i = list.findIndex(a => a.date === date && a.studentId === studentId);
    if (i >= 0) list[i].status = status;
    else list.push({ id: 'A' + Date.now() + Math.random().toString(36).slice(2,5), date, studentId, status });
    this.saveAttendance(list);
  },
  attendanceByDate(date) {
    return this.getAttendance().filter(a => a.date === date);
  },
  attendanceByStudent(studentId) {
    return this.getAttendance().filter(a => a.studentId === studentId);
  },

  // ---- Results ----
  getResults() { return this.read(this.KEYS.RESULTS, []); },
  saveResults(list) { this.write(this.KEYS.RESULTS, list); },
  addResult(r) {
    const list = this.getResults();
    r.id = 'R' + Date.now();
    list.push(r);
    this.saveResults(list);
    return r;
  },
  deleteResult(id) {
    this.saveResults(this.getResults().filter(r => r.id !== id));
  },
  resultsByStudent(studentId) {
    return this.getResults().filter(r => r.studentId === studentId);
  },

  // ---- Notices ----
  getNotices() { return this.read(this.KEYS.NOTICES, []); },
  saveNotices(list) { this.write(this.KEYS.NOTICES, list); },
  addNotice(n) {
    const list = this.getNotices();
    n.id = 'N' + Date.now();
    n.createdAt = new Date().toISOString();
    list.unshift(n);
    this.saveNotices(list);
    return n;
  },
  updateNotice(id, patch) {
    const list = this.getNotices();
    const i = list.findIndex(n => n.id === id);
    if (i >= 0) { list[i] = { ...list[i], ...patch }; this.saveNotices(list); }
    return list[i];
  },
  deleteNotice(id) {
    this.saveNotices(this.getNotices().filter(n => n.id !== id));
  },

  // ---- Backup / Restore ----
  exportAll() {
    return {
      version: 1,
      exportedAt: new Date().toISOString(),
      students: this.getStudents(),
      fees: this.getFees(),
      attendance: this.getAttendance(),
      results: this.getResults(),
      notices: this.getNotices(),
    };
  },
  importAll(data, mode = 'replace') {
    if (!data || typeof data !== 'object') throw new Error('Invalid backup file');
    if (mode === 'replace') {
      this.write(this.KEYS.STUDENTS, data.students || []);
      this.write(this.KEYS.FEES, data.fees || []);
      this.write(this.KEYS.ATTENDANCE, data.attendance || []);
      this.write(this.KEYS.RESULTS, data.results || []);
      this.write(this.KEYS.NOTICES, data.notices || []);
    } else {
      // merge by id
      const merge = (existing, incoming) => {
        const seen = new Set(existing.map(x => x.id));
        return [...existing, ...(incoming || []).filter(x => !seen.has(x.id))];
      };
      this.write(this.KEYS.STUDENTS, merge(this.getStudents(), data.students));
      this.write(this.KEYS.FEES, merge(this.getFees(), data.fees));
      this.write(this.KEYS.ATTENDANCE, merge(this.getAttendance(), data.attendance));
      this.write(this.KEYS.RESULTS, merge(this.getResults(), data.results));
      this.write(this.KEYS.NOTICES, merge(this.getNotices(), data.notices));
    }
  },
};
