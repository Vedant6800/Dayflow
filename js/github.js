/**
 * github.js — GitHub REST API interactions
 * Handles fetching, creating, and updating files in the repository.
 * Includes simple caching and request queuing to prevent race conditions.
 */

const GitHub = (() => {
  const CACHE = new Map();
  let saveQueue = Promise.resolve();

  // Basic toast UI helper
  function showToast(msg, type = 'default') {
    const toast = document.getElementById('save-toast');
    if (!toast) return;
    toast.classList.remove('hidden');
    const dot = toast.querySelector('.toast-dot');
    if (dot) {
      dot.className = 'toast-dot ' + type;
    }
    const text = toast.querySelector('.toast-text');
    if (text) {
      text.textContent = msg;
    }
    
    if (type !== 'default') {
      setTimeout(() => {
        toast.classList.add('hidden');
      }, 2000);
    }
  }

  // UTF-8 aware Base64 encoding/decoding
  function utoa(str) {
    return btoa(unescape(encodeURIComponent(str)));
  }

  function atou(b64) {
    return decodeURIComponent(escape(atob(b64)));
  }

  // Get auth headers
  function getHeaders() {
    const cfg = Config.get();
    return {
      'Authorization': `Bearer ${cfg.token}`,
      'Accept': 'application/vnd.github+json',
      'Content-Type': 'application/json'
    };
  }

  function getBaseUrl() {
    const cfg = Config.get();
    return `https://api.github.com/repos/${cfg.owner}/${cfg.repo}/contents/`;
  }

  /**
   * Fetch a file from the repository
   * @param {string} path - The file path (e.g., 'data/ideas.json')
   * @param {boolean} force - If true, bypasses the cache
   * @returns {Promise<{sha: string, content: any}>}
   */
  async function getFile(path, force = false) {
    if (!force && CACHE.has(path)) {
      return CACHE.get(path);
    }

    try {
      const resp = await fetch(getBaseUrl() + path, {
        method: 'GET',
        headers: getHeaders()
      });

      if (resp.status === 404) {
        // File doesn't exist yet
        return { sha: null, content: null };
      }

      if (!resp.ok) {
        throw new Error(`GitHub API error: ${resp.status}`);
      }

      const data = await resp.json();
      const decodedBody = atou(data.content);
      let parsed = null;
      try {
        parsed = JSON.parse(decodedBody);
      } catch (e) {
        // Not JSON
        parsed = decodedBody;
      }

      const result = { sha: data.sha, content: parsed };
      CACHE.set(path, result);
      return result;

    } catch (error) {
      console.error('Error fetching file:', path, error);
      throw error;
    }
  }

  /**
   * Internal function to save a file
   */
  async function performSaveFile(path, contentObj) {
    showToast('Saving…', 'default');
    
    // First get current SHA
    const current = await getFile(path, true);
    let sha = current.sha;

    const jsonString = JSON.stringify(contentObj, null, 2);
    const encodedContent = utoa(jsonString);

    const body = {
      message: `Dayflow update: ${path}`,
      content: encodedContent
    };
    if (sha) {
      body.sha = sha;
    }

    const resp = await fetch(getBaseUrl() + path, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(body)
    });

    if (!resp.ok) {
      const errData = await resp.json();
      showToast('Error saving', 'error');
      throw new Error(`GitHub API error: ${resp.status} - ${errData.message}`);
    }

    const data = await resp.json();
    
    // Update cache
    const newResult = { sha: data.content.sha, content: contentObj };
    CACHE.set(path, newResult);
    
    showToast('Saved', 'success');
    return newResult;
  }

  /**
   * Queued save to prevent race conditions when saving the same file rapidly
   * @param {string} path - The file path
   * @param {any} contentObj - The JSON object to save
   */
  function saveFile(path, contentObj) {
    // Chain saves sequentially
    saveQueue = saveQueue
      .then(() => performSaveFile(path, contentObj))
      .catch((err) => {
        console.error('Save queue error:', err);
        showToast('Save failed', 'error');
      });
    return saveQueue;
  }

  return { getFile, saveFile };
})();
