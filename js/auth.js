/* ============================================
   auth.js — Login, logout, session guard
   Default credentials: admin / admin123
   ============================================ */

const AUTH = {
  DEFAULT_USER: { username: 'admin', password: 'admin123', name: 'Administrator' },

  init() {
    if (!localStorage.getItem(DB.KEYS.USER)) {
      DB.write(DB.KEYS.USER, this.DEFAULT_USER);
    }
  },

  login(username, password) {
    this.init();
    const user = DB.read(DB.KEYS.USER, this.DEFAULT_USER);
    if (user.username === username && user.password === password) {
      DB.write(DB.KEYS.AUTH, { loggedIn: true, at: Date.now() });
      return true;
    }
    return false;
  },

  logout() {
    localStorage.removeItem(DB.KEYS.AUTH);
    location.href = 'admin.html';
  },

  requireAuth() {
    const auth = DB.read(DB.KEYS.AUTH, null);
    if (!auth || !auth.loggedIn) {
      location.href = 'admin.html';
      return false;
    }
    return true;
  },

  currentUser() {
    return DB.read(DB.KEYS.USER, this.DEFAULT_USER);
  },
};
