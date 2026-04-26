/**
 * config.js — GitHub credentials management
 * Stores and retrieves PAT, owner, repo from localStorage.
 */

const Config = (() => {
  const KEY = 'dayflow_config';

  function load() {
    try {
      return JSON.parse(localStorage.getItem(KEY)) || {};
    } catch {
      return {};
    }
  }

  function save(cfg) {
    localStorage.setItem(KEY, JSON.stringify(cfg));
  }

  function isConfigured() {
    const cfg = load();
    return !!(cfg.token && cfg.owner && cfg.repo);
  }

  function get() {
    return load();
  }

  return { save, isConfigured, get };
})();
