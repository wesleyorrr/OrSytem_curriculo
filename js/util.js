/* OR System — utilitários compartilhados */
window.ORUtil = (function () {
  'use strict';

  const ESC_MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, c => ESC_MAP[c]);
  }

  function uid(prefix) {
    return (prefix || 'id') + '-' + Date.now().toString(36) + '-' +
           Math.random().toString(36).slice(2, 8);
  }

  /** "a, b , c" -> ["a","b","c"] */
  function parseList(str) {
    return String(str || '')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);
  }

  function joinList(arr) {
    return Array.isArray(arr) ? arr.join(', ') : '';
  }

  /** Clona profundamente de forma segura */
  function clone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  /** ISO -> "12/03/2026" */
  function fmtDateTime(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (isNaN(d)) return '—';
    return d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  }

  /** Define valor em caminho "a.b.c" */
  function setPath(obj, path, value) {
    const parts = path.split('.');
    let cur = obj;
    for (let i = 0; i < parts.length - 1; i++) {
      if (typeof cur[parts[i]] !== 'object' || cur[parts[i]] === null) cur[parts[i]] = {};
      cur = cur[parts[i]];
    }
    cur[parts[parts.length - 1]] = value;
  }

  function getPath(obj, path) {
    return path.split('.').reduce((acc, k) => (acc == null ? undefined : acc[k]), obj);
  }

  /** Valida e-mail de forma simples, sem falso positivo absurdo */
  function isEmail(v) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(v || '').trim());
  }

  return { esc, uid, parseList, joinList, clone, fmtDateTime, setPath, getPath, isEmail };
})();