/**
 * Parkd — API client (users + admins)
 */
const ParkdAPI = {
  base: '',

  token() {
    return localStorage.getItem('parkd_token');
  },

  adminToken() {
    return localStorage.getItem('parkd_admin_token');
  },

  isAdminPage() {
    return /admin-/.test(location.pathname) || document.body.dataset.admin === '1';
  },

  activeToken() {
    return this.isAdminPage() ? this.adminToken() : this.token();
  },

  user() {
    try { return JSON.parse(localStorage.getItem('parkd_user') || 'null'); } catch { return null; }
  },

  admin() {
    try { return JSON.parse(localStorage.getItem('parkd_admin') || 'null'); } catch { return null; }
  },

  headers(json = true) {
    const h = {};
    if (json) h['Content-Type'] = 'application/json';
    const t = this.activeToken();
    if (t) h['Authorization'] = `Bearer ${t}`;
    return h;
  },

  async request(path, options = {}) {
    const finalHeaders = { ...this.headers(), ...(options.headers || {}) };
    const t = this.activeToken();
    if (t) finalHeaders['Authorization'] = `Bearer ${t}`;

    const res = await fetch(`${this.base}${path}`, {
      ...options,
      headers: finalHeaders
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(data.error || data.detail || res.statusText);
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  },

  requireAuth(redirectTo = 'auth.html') {
    const ok = this.isAdminPage() ? !!this.adminToken() : !!this.token();
    if (!ok) {
      window.location.href = redirectTo;
      return false;
    }
    return true;
  },

  saveSession(token, user) {
    localStorage.setItem('parkd_token', token);
    if (user) localStorage.setItem('parkd_user', JSON.stringify(user));
  },

  saveAdminSession(token, admin) {
    localStorage.setItem('parkd_admin_token', token);
    if (admin) localStorage.setItem('parkd_admin', JSON.stringify(admin));
  },

  logout() {
    localStorage.removeItem('parkd_token');
    localStorage.removeItem('parkd_user');
    window.location.href = 'auth.html';
  },

  adminLogout() {
    localStorage.removeItem('parkd_admin_token');
    localStorage.removeItem('parkd_admin');
    window.location.href = 'auth.html?admin=1';
  }
};
