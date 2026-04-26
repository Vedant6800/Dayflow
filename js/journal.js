/**
 * journal.js — Daily Journal Module Logic
 */

document.addEventListener('DOMContentLoaded', async () => {
  try {
    await GitHub.initializeToken();
  } catch(e) {
    console.error(e);
    document.getElementById('journal-loading').innerHTML = `<p class="loading-text">${e.message}</p>`;
    return;
  }

  // State
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  let currentDate = new Date(); // Date object to track current loaded month for archive
  
  let currentMonthEntries = {}; // { "YYYY-MM-DD": "Entry content..." }
  let saveTimeout = null;

  // UI - Main
  const loading = document.getElementById('journal-loading');
  const viewWrite = document.getElementById('view-write');
  const viewPast = document.getElementById('view-past');
  const navWrite = document.getElementById('nav-write');
  const navPast = document.getElementById('nav-past');
  
  // UI - Write
  const textarea = document.getElementById('journal-textarea');
  const saveBtn = document.getElementById('journal-save-btn');
  const dateLabel = document.getElementById('journal-date-label');

  // UI - Archive
  const monthLabel = document.getElementById('month-label');
  const prevMonthBtn = document.getElementById('prev-month');
  const nextMonthBtn = document.getElementById('next-month');
  const pastList = document.getElementById('past-entries-list');
  const emptyPast = document.getElementById('past-empty');

  // Initialization
  dateLabel.textContent = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

  function getMonthPath(dateObj) {
    const yyyy = dateObj.getFullYear();
    const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
    return `data/journal/${yyyy}/${mm}.json`;
  }

  async function loadMonth(dateObj) {
    loading.classList.remove('hidden');
    viewWrite.classList.add('hidden');
    viewPast.classList.add('hidden');

    try {
      const res = await GitHub.getFile(getMonthPath(dateObj));
      currentMonthEntries = res.content || {};
    } catch (e) {
      console.error(e);
      currentMonthEntries = {};
    }

    loading.classList.add('hidden');
  }

  async function init() {
    await loadMonth(currentDate);
    
    // Set textarea content for today if exists
    if (currentMonthEntries[todayStr]) {
      textarea.value = currentMonthEntries[todayStr];
    }

    switchView('write');
  }

  // View Switching
  function switchView(view) {
    viewWrite.classList.add('hidden');
    viewPast.classList.add('hidden');
    navWrite.classList.remove('active');
    navPast.classList.remove('active');

    if (view === 'write') {
      viewWrite.classList.remove('hidden');
      navWrite.classList.add('active');
      
      // If we navigated away from current month, reload current month
      if (currentDate.getMonth() !== now.getMonth() || currentDate.getFullYear() !== now.getFullYear()) {
        currentDate = new Date();
        loadMonth(currentDate).then(() => {
          viewWrite.classList.remove('hidden');
        });
      }
    } else {
      viewPast.classList.remove('hidden');
      navPast.classList.add('active');
      renderArchive();
    }
  }

  navWrite.addEventListener('click', () => switchView('write'));
  navPast.addEventListener('click', () => switchView('past'));

  // --- Write Logic ---
  function saveEntry() {
    const text = textarea.value.trim();
    if (!text && !currentMonthEntries[todayStr]) return; // nothing to save
    
    if (!text) {
      delete currentMonthEntries[todayStr];
    } else {
      currentMonthEntries[todayStr] = text;
    }

    // Ensure we are saving to the correct month file for today
    GitHub.saveFile(getMonthPath(now), currentMonthEntries);
  }

  saveBtn.addEventListener('click', saveEntry);

  // --- Archive Logic ---
  function formatMonthLabel(dateObj) {
    return dateObj.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }

  function renderArchive() {
    monthLabel.textContent = formatMonthLabel(currentDate);
    pastList.innerHTML = '';

    // Disable next button if we're in the current month
    if (currentDate.getFullYear() === now.getFullYear() && currentDate.getMonth() === now.getMonth()) {
      nextMonthBtn.style.opacity = '0.3';
      nextMonthBtn.style.pointerEvents = 'none';
    } else {
      nextMonthBtn.style.opacity = '1';
      nextMonthBtn.style.pointerEvents = 'auto';
    }

    const entries = Object.keys(currentMonthEntries).sort((a, b) => new Date(b) - new Date(a));

    if (entries.length === 0) {
      emptyPast.classList.remove('hidden');
    } else {
      emptyPast.classList.add('hidden');
      entries.forEach(dateStr => {
        // Skip today in archive view usually, but we can show it
        const card = document.createElement('div');
        card.className = 'past-entry-card';

        const header = document.createElement('div');
        header.className = 'past-entry-header';

        const dateEl = document.createElement('div');
        dateEl.className = 'past-entry-date';
        dateEl.textContent = new Date(dateStr).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

        const preview = document.createElement('div');
        preview.className = 'past-entry-preview';
        preview.textContent = currentMonthEntries[dateStr];

        const chevron = document.createElement('div');
        chevron.className = 'past-entry-chevron';
        chevron.textContent = '▼';

        header.appendChild(dateEl);
        header.appendChild(preview);
        header.appendChild(chevron);

        const body = document.createElement('div');
        body.className = 'past-entry-body';
        body.textContent = currentMonthEntries[dateStr];

        header.addEventListener('click', () => {
          card.classList.toggle('open');
          if (card.classList.contains('open')) {
             preview.style.display = 'none';
          } else {
             preview.style.display = 'block';
          }
        });

        card.appendChild(header);
        card.appendChild(body);
        pastList.appendChild(card);
      });
    }
  }

  prevMonthBtn.addEventListener('click', async () => {
    currentDate.setMonth(currentDate.getMonth() - 1);
    await loadMonth(currentDate);
    viewPast.classList.remove('hidden');
    renderArchive();
  });

  nextMonthBtn.addEventListener('click', async () => {
    currentDate.setMonth(currentDate.getMonth() + 1);
    await loadMonth(currentDate);
    viewPast.classList.remove('hidden');
    renderArchive();
  });

  init();
});
