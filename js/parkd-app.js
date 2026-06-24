/** Parkd — shared UI helpers */
const ParkdApp = {
  rupee(n) {
    return '₹' + Number(n || 0).toFixed(0);
  },

  initials(name) {
    return (name || 'U').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  },

  fmtDate(d) {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  },

  fmtTime(ts) {
    if (!ts) return '—';
    return new Date(ts).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  },

  tierLabel(t) {
    const m = { general: 'General', gold: 'Gold', platinum: 'Platinum' };
    return m[t] || t || 'General';
  },

  applyUserShell(profile) {
    const u = profile || ParkdAPI.user();
    if (!u) return;
    const name = u.name || u.NAME || 'User';
    const plan = (u.planType || u.PLAN_TYPE || 'general');
    document.querySelectorAll('.sb-uname').forEach(el => { el.textContent = name; });
    document.querySelectorAll('.sb-urole').forEach(el => {
      el.textContent = `${this.tierLabel(plan)} Plan · Active`;
    });
    document.querySelectorAll('.sb-avatar').forEach(el => {
      el.textContent = this.initials(name);
    });
    document.querySelectorAll('.topbar-title').forEach(el => {
      const h = new Date().getHours();
      const greet = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
      el.textContent = `${greet}, ${name.split(' ')[0]}`;
    });
  },

  applyAdminShell(admin) {
    const a = admin || ParkdAPI.admin();
    if (!a) return;
    document.querySelectorAll('.sb-uname').forEach(el => { el.textContent = a.name || 'Admin'; });
    document.querySelectorAll('.sb-urole').forEach(el => {
      const role = a.role === 'super_admin' ? 'Super Admin' : a.role === 'local_admin' ? 'Local Admin' : 'Admin';
      el.textContent = role;
    });
    document.querySelectorAll('.sb-avatar').forEach(el => {
      el.textContent = this.initials(a.name);
    });
  },

  setTopDate() {
    const el = document.getElementById('topDate') || document.getElementById('adminDate');
    if (el) {
      el.textContent = new Date().toLocaleDateString('en-IN', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
      }) + ' · Live';
    }
  },

  poll(fn, ms = 5000) {
    fn();
    return setInterval(fn, ms);
  }
};
