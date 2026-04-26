/**
 * github.js — GitHub API interactions using Ledgerly's token management approach
 */

// ==========================================
// GITHUB CONFIGURATION
// ==========================================
const GITHUB_CONFIG = {
  owner: 'Vedant6800', // Hardcoded as per user instructions
  repo: 'Dayflow',
  branch: 'main',
  token: '' // Loaded dynamically
};

// ==========================================
// TOKEN MANAGER
// ==========================================
class TokenManager {
  static STORAGE_KEY = 'dayflow_github_token';

  static getToken() {
      return localStorage.getItem(this.STORAGE_KEY);
  }

  static saveToken(token) {
      if (token && token.trim()) {
          localStorage.setItem(this.STORAGE_KEY, token.trim());
          return true;
      }
      return false;
  }

  static clearToken() {
      localStorage.removeItem(this.STORAGE_KEY);
  }

  static promptForToken(message = 'Please enter your GitHub Personal Access Token:') {
      const instructions = `
${message}

To generate a new token:
1. Go to: https://github.com/settings/tokens
2. Click "Generate new token (classic)"
3. Define name and select "repo" scope
4. Generate and copy the token (starts with 'ghp_' or 'github_pat_')

Enter your token below:`;

      const token = prompt(instructions);
      if (token && token.trim()) {
          return token.trim();
      }
      return null;
  }
}

// ==========================================
// GITHUB API CLIENT
// ==========================================
const GitHub = (() => {
  const CACHE = new Map();
  let saveQueue = Promise.resolve();

  function showToast(msg, type = 'default') {
      const toast = document.getElementById('save-toast');
      if (!toast) return;
      toast.classList.remove('hidden');
      const dot = toast.querySelector('.toast-dot');
      if (dot) dot.className = 'toast-dot ' + type;
      const text = toast.querySelector('.toast-text');
      if (text) text.textContent = msg;

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
      return {
          'Authorization': `Bearer ${GITHUB_CONFIG.token}`,
          'Accept': 'application/vnd.github+json',
          'Content-Type': 'application/json'
      };
  }

  function getBaseUrl() {
      return `https://api.github.com/repos/${GITHUB_CONFIG.owner}/${GITHUB_CONFIG.repo}/contents/`;
  }

  async function validateToken() {
      try {
          const response = await fetch(`https://api.github.com/user`, {
              method: 'GET',
              headers: {
                  'Authorization': `Bearer ${GITHUB_CONFIG.token}`,
                  'Accept': 'application/vnd.github.v3+json'
              }
          });
          return response.status === 200;
      } catch (error) {
          console.error('Error validating token:', error);
          return false;
      }
  }

  async function initializeToken() {
      let token = TokenManager.getToken();

      if (token) {
          GITHUB_CONFIG.token = token;
          const isValid = await validateToken();

          if (isValid) {
              return true;
          } else {
              TokenManager.clearToken();
              token = TokenManager.promptForToken('Your stored token has expired or is invalid.\n\nPlease provide a new GitHub Personal Access Token:');

              if (!token) throw new Error('GitHub token is required to use this app');
              
              GITHUB_CONFIG.token = token;
              const isNewTokenValid = await validateToken();
              
              if (isNewTokenValid) {
                  TokenManager.saveToken(token);
                  return true;
              } else {
                  throw new Error('The provided token is invalid. Please refresh and try again.');
              }
          }
      } else {
          token = TokenManager.promptForToken('Welcome to Dayflow!\n\nTo connect to GitHub, you need a Personal Access Token.');
          if (!token) throw new Error('GitHub token is required to use this app');
          
          GITHUB_CONFIG.token = token;
          const isValid = await validateToken();

          if (isValid) {
              TokenManager.saveToken(token);
              return true;
          } else {
              TokenManager.clearToken();
              throw new Error('The provided token is invalid. Please refresh and try again.');
          }
      }
  }

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

  async function performSaveFile(path, contentObj) {
      showToast('Saving…', 'default');

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
          showToast('Error saving', 'error');
          throw new Error('GitHub API error on save');
      }

      const data = await resp.json();

      const newResult = { sha: data.content.sha, content: contentObj };
      CACHE.set(path, newResult);

      showToast('Saved', 'success');
      return newResult;
  }

  function saveFile(path, contentObj) {
      saveQueue = saveQueue
          .then(() => performSaveFile(path, contentObj))
          .catch((err) => {
              console.error('Save queue error:', err);
              showToast('Save failed', 'error');
          });
      return saveQueue;
  }

  return { initializeToken, getFile, saveFile, TokenManager };
})();
