/**
 * habits.js — Habits Module Logic
 */

document.addEventListener('DOMContentLoaded', async () => {
  try {
    await GitHub.initializeToken();
  } catch(e) {
    console.error(e);
    document.getElementById('habits-loading').innerHTML = `<p class="loading-text">${e.message}</p>`;
    return;
  }

  const CONFIG_PATH = 'data/habits/config.json';
  
  // State
  let habits = []; // Array of { id, name, created }
  let completions = {}; // { "YYYY-MM-DD": ["habit-id", ...] }
  
  const todayStr = new Date().toISOString().split('T')[0];
  let currentDate = new Date(); // For tracking which month we are viewing

  // UI Elements
  const viewToday = document.getElementById('view-today');
  const viewManage = document.getElementById('view-manage');
  const navToday = document.getElementById('nav-today');
  const navManage = document.getElementById('nav-manage');
  const loading = document.getElementById('habits-loading');
  const content = document.getElementById('habits-content');
  
  const habitList = document.getElementById('habit-list');
  const manageList = document.getElementById('habit-manage-list');
  const emptyToday = document.getElementById('habits-empty');
  const emptyManage = document.getElementById('manage-empty');
  
  const progressBar = document.getElementById('habit-progress-bar');
  const progressLabel = document.getElementById('habit-progress-label');
  const progressRing = document.getElementById('habits-progress-ring'); // optionally an emoji or text

  // Set today's date label
  const dateOptions = { weekday: 'long', month: 'long', day: 'numeric' };
  document.getElementById('habits-date-label').textContent = new Date().toLocaleDateString('en-US', dateOptions);

  function getMonthPath(dateObj) {
    const yyyy = dateObj.getFullYear();
    const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
    return `data/habits/${yyyy}/${mm}.json`;
  }

  async function init() {
    try {
      // Fetch config
      const confRes = await GitHub.getFile(CONFIG_PATH);
      habits = confRes.content || [];

      if (!Array.isArray(habits)) {
        habits = []; // Migration fallback
      }

      // Fetch this month's completions
      const compRes = await GitHub.getFile(getMonthPath(currentDate));
      completions = compRes.content || {};

      loading.classList.add('hidden');
      switchView('today');
      renderManage();

    } catch (e) {
      console.error(e);
      loading.innerHTML = '<p class="loading-text">Error loading habits. Check console.</p>';
    }
  }

  function switchView(view) {
    viewToday.classList.add('hidden');
    viewManage.classList.add('hidden');
    navToday.classList.remove('active');
    navManage.classList.remove('active');

    if (view === 'today') {
      viewToday.classList.remove('hidden');
      navToday.classList.add('active');
      renderToday();
    } else {
      viewManage.classList.remove('hidden');
      navManage.classList.add('active');
      renderManage();
    }
  }

  // Event Listeners for Nav
  navToday.addEventListener('click', () => switchView('today'));
  navManage.addEventListener('click', () => switchView('manage'));

  // --- Manage Logic ---
  const addBtn = document.getElementById('add-habit-btn');
  const addInput = document.getElementById('new-habit-input');

  addBtn.addEventListener('click', async () => {
    const val = addInput.value.trim();
    if (!val) return;
    
    const newHabit = {
      id: 'h_' + Date.now().toString(36),
      name: val,
      created: todayStr
    };
    
    habits.push(newHabit);
    addInput.value = '';
    renderManage();
    GitHub.saveFile(CONFIG_PATH, habits);
  });

  addInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') addBtn.click();
  });

  function renderManage() {
    manageList.innerHTML = '';
    if (habits.length === 0) {
      emptyManage.classList.remove('hidden');
      return;
    }
    emptyManage.classList.add('hidden');

    habits.forEach(h => {
      const el = document.createElement('div');
      el.className = 'habit-manage-item';
      
      const name = document.createElement('span');
      name.className = 'habit-manage-name';
      name.textContent = h.name;
      
      const delBtn = document.createElement('button');
      delBtn.className = 'btn-icon';
      delBtn.textContent = '🗑️';
      delBtn.title = 'Delete habit';
      delBtn.onclick = () => {
        if (confirm(`Remove habit "${h.name}"? Historical data will be preserved but it won't show in your active list.`)) {
          habits = habits.filter(x => x.id !== h.id);
          renderManage();
          GitHub.saveFile(CONFIG_PATH, habits);
        }
      };

      el.appendChild(name);
      el.appendChild(delBtn);
      manageList.appendChild(el);
    });
  }

  // --- Today Logic ---
  function renderToday() {
    habitList.innerHTML = '';
    
    // Only show habits created today or earlier
    const activeHabits = habits; // for simplicity all active habits
    
    if (activeHabits.length === 0) {
      emptyToday.classList.remove('hidden');
      updateProgress(0, 0);
      return;
    }
    emptyToday.classList.add('hidden');

    const todayCompletions = completions[todayStr] || [];

    activeHabits.forEach(h => {
      const isDone = todayCompletions.includes(h.id);
      
      const el = document.createElement('div');
      el.className = `habit-item ${isDone ? 'checked' : ''}`;
      
      const checkbox = document.createElement('div');
      checkbox.className = 'habit-checkbox';
      checkbox.textContent = '✓';
      
      const name = document.createElement('span');
      name.className = 'habit-name';
      name.textContent = h.name;

      el.appendChild(checkbox);
      el.appendChild(name);

      // Lightweight streak visualization
      // Just check if it was done yesterday
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yStr = yesterday.toISOString().split('T')[0];
      const yDone = (completions[yStr] || []).includes(h.id);
      if (yDone) {
        const streak = document.createElement('div');
        streak.className = 'habit-streak';
        streak.innerHTML = '<span class="streak-fire">🔥</span>';
        el.appendChild(streak);
      }

      el.addEventListener('click', () => toggleHabit(h.id, el));
      habitList.appendChild(el);
    });

    updateProgress(todayCompletions.length, activeHabits.length);
  }

  function toggleHabit(id, el) {
    if (!completions[todayStr]) {
      completions[todayStr] = [];
    }
    
    const idx = completions[todayStr].indexOf(id);
    if (idx > -1) {
      completions[todayStr].splice(idx, 1);
      el.classList.remove('checked');
    } else {
      completions[todayStr].push(id);
      el.classList.add('checked');
    }

    updateProgress(completions[todayStr].length, habits.length);
    GitHub.saveFile(getMonthPath(currentDate), completions);
  }

  function updateProgress(done, total) {
    if (total === 0) {
      progressBar.style.width = '0%';
      progressLabel.textContent = '0 / 0';
      return;
    }
    const pct = Math.round((done / total) * 100);
    progressBar.style.width = `${pct}%`;
    progressLabel.textContent = `${done} / ${total}`;
    
    if (pct === 100) {
      progressRing.innerHTML = '🎉 All done!';
    } else {
      progressRing.innerHTML = '';
    }
  }

  // Start app
  init();
});
