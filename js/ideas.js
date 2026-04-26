/**
 * ideas.js — Ideas & Projects Module Logic
 */

document.addEventListener('DOMContentLoaded', () => {
  if (!Config.isConfigured()) return;

  const DATA_PATH = 'data/ideas.json';
  
  let ideas = [];
  let currentFilter = 'all';

  // UI
  const loading = document.getElementById('ideas-loading');
  const viewIdeas = document.getElementById('view-ideas');
  const listEl = document.getElementById('idea-list');
  const emptyEl = document.getElementById('ideas-empty');
  
  // Navigation
  const navFilters = document.querySelectorAll('.sidebar-nav-item');

  // Modals
  const modal = document.getElementById('idea-modal');
  const modalTitle = document.getElementById('idea-modal-title');
  const inputId = document.getElementById('idea-edit-id');
  const inputTitle = document.getElementById('idea-title-input');
  const inputDesc = document.getElementById('idea-desc-input');
  const inputStatus = document.getElementById('idea-status-input');
  const cancelBtn = document.getElementById('idea-cancel-btn');
  const saveBtn = document.getElementById('idea-save-btn');
  const openBtn = document.getElementById('open-add-idea');

  const delModal = document.getElementById('delete-modal');
  const delCancelBtn = document.getElementById('delete-cancel-btn');
  const delConfirmBtn = document.getElementById('delete-confirm-btn');
  let ideaToDelete = null;

  async function init() {
    try {
      const res = await GitHub.getFile(DATA_PATH);
      ideas = Array.isArray(res.content) ? res.content : [];
      
      // Sort newest first
      ideas.sort((a, b) => new Date(b.created) - new Date(a.created));

      loading.classList.add('hidden');
      viewIdeas.classList.remove('hidden');
      render();

    } catch (e) {
      console.error(e);
      loading.innerHTML = '<p class="loading-text">Error loading ideas.</p>';
    }
  }

  function render() {
    listEl.innerHTML = '';
    
    const filtered = currentFilter === 'all' 
      ? ideas 
      : ideas.filter(i => i.status === currentFilter);

    if (filtered.length === 0) {
      emptyEl.classList.remove('hidden');
    } else {
      emptyEl.classList.add('hidden');
      filtered.forEach(idea => {
        const card = buildCard(idea);
        listEl.appendChild(card);
      });
    }
  }

  function getStatusLabel(status) {
    if (status === 'in-progress') return 'In Progress';
    if (status === 'completed') return 'Completed';
    return 'Idea';
  }

  function buildCard(idea) {
    const el = document.createElement('div');
    el.className = 'idea-card';
    
    const dot = document.createElement('div');
    dot.className = `idea-status-dot ${idea.status}`;
    
    const body = document.createElement('div');
    body.className = 'idea-body';

    const titleRow = document.createElement('div');
    titleRow.style.display = 'flex';
    titleRow.style.justifyContent = 'space-between';
    titleRow.style.alignItems = 'flex-start';
    
    const title = document.createElement('h3');
    title.className = 'idea-title';
    title.textContent = idea.title;

    const actions = document.createElement('div');
    actions.className = 'idea-actions';
    
    const editBtn = document.createElement('button');
    editBtn.className = 'btn-icon';
    editBtn.textContent = '✏️';
    editBtn.title = 'Edit';
    editBtn.onclick = () => openModal(idea);

    const delBtn = document.createElement('button');
    delBtn.className = 'btn-icon';
    delBtn.textContent = '🗑️';
    delBtn.title = 'Delete';
    delBtn.onclick = () => confirmDelete(idea.id);

    actions.appendChild(editBtn);
    actions.appendChild(delBtn);

    titleRow.appendChild(title);
    titleRow.appendChild(actions);

    const desc = document.createElement('p');
    desc.className = 'idea-desc';
    desc.textContent = idea.desc || 'No description provided.';

    const meta = document.createElement('div');
    meta.className = 'idea-meta';
    
    const badge = document.createElement('span');
    badge.className = `idea-badge ${idea.status}`;
    badge.textContent = getStatusLabel(idea.status);

    const date = document.createElement('span');
    date.className = 'idea-date';
    date.textContent = new Date(idea.created).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

    meta.appendChild(badge);
    meta.appendChild(date);

    body.appendChild(titleRow);
    body.appendChild(desc);
    body.appendChild(meta);

    el.appendChild(dot);
    el.appendChild(body);

    return el;
  }

  // Filters
  navFilters.forEach(nav => {
    nav.addEventListener('click', () => {
      navFilters.forEach(n => n.classList.remove('active'));
      nav.classList.add('active');
      currentFilter = nav.dataset.filter;
      render();
    });
  });

  // Modal logic
  function openModal(idea = null) {
    modalTitle.textContent = idea ? 'Edit Idea' : 'New Idea';
    if (idea) {
      inputId.value = idea.id;
      inputTitle.value = idea.title;
      inputDesc.value = idea.desc;
      inputStatus.value = idea.status;
    } else {
      inputId.value = '';
      inputTitle.value = '';
      inputDesc.value = '';
      inputStatus.value = 'idea';
    }
    modal.classList.remove('hidden');
    inputTitle.focus();
  }

  function closeModal() {
    modal.classList.add('hidden');
  }

  openBtn.addEventListener('click', () => openModal());
  cancelBtn.addEventListener('click', closeModal);

  saveBtn.addEventListener('click', () => {
    const titleVal = inputTitle.value.trim();
    if (!titleVal) return;

    const id = inputId.value;
    if (id) {
      // Edit
      const idx = ideas.findIndex(i => i.id === id);
      if (idx > -1) {
        ideas[idx].title = titleVal;
        ideas[idx].desc = inputDesc.value.trim();
        ideas[idx].status = inputStatus.value;
        ideas[idx].updated = new Date().toISOString();
      }
    } else {
      // New
      ideas.unshift({
        id: 'id_' + Date.now().toString(36),
        title: titleVal,
        desc: inputDesc.value.trim(),
        status: inputStatus.value,
        created: new Date().toISOString(),
        updated: new Date().toISOString()
      });
    }

    closeModal();
    render();
    GitHub.saveFile(DATA_PATH, ideas);
  });

  // Delete Logic
  function confirmDelete(id) {
    ideaToDelete = id;
    delModal.classList.remove('hidden');
  }

  delCancelBtn.addEventListener('click', () => {
    ideaToDelete = null;
    delModal.classList.add('hidden');
  });

  delConfirmBtn.addEventListener('click', () => {
    if (ideaToDelete) {
      ideas = ideas.filter(i => i.id !== ideaToDelete);
      render();
      GitHub.saveFile(DATA_PATH, ideas);
    }
    ideaToDelete = null;
    delModal.classList.add('hidden');
  });

  init();
});
