/* OR System — camada única de persistência (localStorage)
   Quando existir backend, apenas este arquivo precisará mudar. */
window.ORStorage = (function () {
  'use strict';

  const KEY = 'orsystem.curriculo.v1';
  const VERSION = 1;

  let state = null;
  const listeners = [];

  /* ---------------- Estruturas vazias ---------------- */
  function emptyProfile() {
    return {
      personal: {
        fullName: '', email: '', phone: '', city: '', state: '',
        linkedin: '', portfolio: '', targetRole: ''
      },
      summary: '',
      experiences: [],
      education: [],
      courses: [],
      skills: { technical: [], tools: [], soft: [], languages: [] },
      projects: []
    };
  }

  function emptyState() {
    return {
      version: VERSION,
      consent: true,
      profile: emptyProfile(),
      meta: { createdAt: new Date().toISOString(), updatedAt: null }
    };
  }

  /* ---------------- Migração / saneamento ---------------- */
  function merge(base, incoming) {
    if (incoming == null) return base;
    if (Array.isArray(base)) return Array.isArray(incoming) ? incoming : base;
    if (typeof base === 'object') {
      const out = Array.isArray(incoming) ? base : Object.assign({}, base);
      if (typeof incoming === 'object' && !Array.isArray(incoming)) {
        Object.keys(base).forEach(k => { out[k] = merge(base[k], incoming[k]); });
      }
      return out;
    }
    return incoming === undefined ? base : incoming;
  }

  function migrate(raw) {
    const base = emptyState();
    const merged = merge(base, raw || {});
    merged.version = VERSION;
    // garante arrays onde devem existir
    ['experiences', 'education', 'courses', 'projects'].forEach(k => {
      if (!Array.isArray(merged.profile[k])) merged.profile[k] = [];
    });
    const sk = merged.profile.skills;
    ['technical', 'tools', 'soft'].forEach(k => { if (!Array.isArray(sk[k])) sk[k] = []; });
    if (!Array.isArray(sk.languages)) sk.languages = [];
    return merged;
  }

  /* ---------------- API ---------------- */
  function get() {
    if (state) return state;
    try {
      const raw = localStorage.getItem(KEY);
      state = raw ? migrate(JSON.parse(raw)) : emptyState();
    } catch (e) {
      console.warn('[ORStorage] Falha ao ler dados locais:', e);
      state = emptyState();
    }
    return state;
  }

  function save() {
    const s = get();
    s.meta.updatedAt = new Date().toISOString();
    try {
      localStorage.setItem(KEY, JSON.stringify(s));
      notify();
      return true;
    } catch (e) {
      console.error('[ORStorage] Falha ao salvar:', e);
      return false;
    }
  }

  /** Substitui o perfil inteiro (usado pelo formulário) */
  function setProfile(profile) {
    const s = get();
    s.profile = merge(emptyProfile(), profile);
    return save();
  }

  function clear() {
    try { localStorage.removeItem(KEY); } catch (e) { /* noop */ }
    state = emptyState();
    notify();
  }

  function exportJSON() {
    return JSON.stringify(get(), null, 2);
  }

  function importJSON(text) {
    const parsed = JSON.parse(text);
    state = migrate(parsed);
    save();
    return true;
  }

  /** true se houver qualquer conteúdo relevante */
  function hasContent() {
    const p = get().profile;
    return !!(
      p.personal.fullName || p.personal.email || p.summary ||
      p.experiences.length || p.education.length || p.courses.length ||
      p.projects.length || p.skills.technical.length ||
      p.skills.tools.length || p.skills.soft.length || p.skills.languages.length
    );
  }

  function onChange(fn) { listeners.push(fn); }
  function notify() { listeners.forEach(fn => { try { fn(get()); } catch (e) { console.warn(e); } }); }

  return {
    KEY, VERSION,
    get, save, setProfile, clear,
    exportJSON, importJSON, hasContent, onChange,
    emptyProfile
  };
})();