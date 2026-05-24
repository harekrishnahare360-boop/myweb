/* ============================================
   storage.js — localStorage data layer
   Provides simple CRUD for students, fees,
   attendance, and results.
   ============================================ */

const DB = {
  KEYS: {
    AUTH: 'ssw_auth',
    USER: 'ssw_user',
    STUDENTS: 'ssw_students',
    FEES: 'ssw_fees',
    ATTENDANCE: 'ssw_attendance',
    RESULTS: 'ssw_results',
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

  // ---- Students ----
  getStudents() { return this.read(this.KEYS.STUDENTS, []); },
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
};
