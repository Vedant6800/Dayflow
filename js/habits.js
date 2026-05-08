/**
 * habits.js — Habits Module Logic
 */

document.addEventListener('DOMContentLoaded', async () => {
  try {
    await GitHub.initializeToken();
  } catch (e) {
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
  const viewDashboard = document.getElementById('view-dashboard');
  const viewManage = document.getElementById('view-manage');
  const navToday = document.getElementById('nav-today');
  const navDashboard = document.getElementById('nav-dashboard');
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
      const confRes = await GitHub.getFile(CONFIG_PATH);
      const rawHabits = confRes.content || [];
      habits = (Array.isArray(rawHabits) ? rawHabits : []).map(h => ({
        id: h.id,
        name: h.name,
        createdAt: h.createdAt || h.created || todayStr,
        isActive: h.isActive !== undefined ? h.isActive : true,
        deletedAt: h.deletedAt || null
      }));

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
    viewDashboard.classList.add('hidden');
    viewManage.classList.add('hidden');
    navToday.classList.remove('active');
    navDashboard.classList.remove('active');
    navManage.classList.remove('active');

    if (view === 'today') {
      viewToday.classList.remove('hidden');
      navToday.classList.add('active');
      renderToday();
    } else if (view === 'dashboard') {
      viewDashboard.classList.remove('hidden');
      navDashboard.classList.add('active');
      renderDashboard();
    } else {
      viewManage.classList.remove('hidden');
      navManage.classList.add('active');
      renderManage();
    }
  }

  // Event Listeners for Nav
  navToday.addEventListener('click', () => switchView('today'));
  navDashboard.addEventListener('click', () => switchView('dashboard'));
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
      createdAt: todayStr,
      isActive: true,
      deletedAt: null
    };

    habits.push(newHabit);
    addInput.value = '';
    renderManage();
  });

  addInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') addBtn.click();
  });

  const saveManageBtn = document.getElementById('save-manage-btn');
  if (saveManageBtn) {
    saveManageBtn.addEventListener('click', () => {
      GitHub.saveFile(CONFIG_PATH, habits);
    });
  }

  function renderManage() {
    manageList.innerHTML = '';
    // Create local array for managing to preserve ordering but keep inactive out
    const manageActive = habits.filter(h => h.isActive);

    if (manageActive.length === 0) {
      emptyManage.classList.remove('hidden');
      return;
    }
    emptyManage.classList.add('hidden');

    manageActive.forEach(h => {
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
          const target = habits.find(x => x.id === h.id);
          if (target) {
            target.isActive = false;
            target.deletedAt = todayStr;
            renderManage();
          }
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

    // Only show active habits created today or earlier
    const activeHabits = habits.filter(h => h.isActive && h.createdAt <= todayStr);

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
      checkbox.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleHabit(h.id, el);
      });

      const name = document.createElement('span');
      name.className = 'habit-name';
      name.style.cursor = 'pointer';
      name.textContent = h.name;
      name.addEventListener('click', (e) => {
        e.stopPropagation();
        openHabitDetails(h);
      });

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
  }

  const saveTodayBtn = document.getElementById('save-today-btn');
  if (saveTodayBtn) {
    saveTodayBtn.addEventListener('click', () => {
      GitHub.saveFile(getMonthPath(currentDate), completions);
    });
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

  // --- Habit Details Modal ---
  const hdModal = document.getElementById('habit-details-modal');
  const hdCloseBtn = document.getElementById('hd-close-btn');

  hdCloseBtn.addEventListener('click', () => hdModal.classList.add('hidden'));

  async function openHabitDetails(habit) {
    document.getElementById('hd-name').textContent = habit.name;
    document.getElementById('hd-start').textContent = new Date(habit.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    document.getElementById('hd-consistency').textContent = '...';
    document.getElementById('hd-history-list').innerHTML = '<p class="loading-text" style="padding-top:1rem">Loading history...</p>';
    hdModal.classList.remove('hidden');

    const start = new Date(habit.createdAt);
    const endStr = habit.deletedAt ? habit.deletedAt : todayStr;
    const end = new Date(endStr);

    const dates = [];
    let current = new Date(start);
    while (current <= end) {
      dates.push(current.toISOString().split('T')[0]);
      current.setDate(current.getDate() + 1);
    }

    // We only need month files for the dates array
    const monthsNeeded = [...new Set(dates.map(d => {
      const parts = d.split('-');
      return `data/habits/${parts[0]}/${parts[1]}.json`;
    }))];

    let totalDays = dates.length;
    if (totalDays === 0) totalDays = 1;
    let completedDays = 0;

    try {
      const monthData = {};
      await Promise.all(monthsNeeded.map(async path => {
        let res = await GitHub.getFile(path);
        monthData[path] = res.content || {};
      }));

      const listEl = document.getElementById('hd-history-list');
      listEl.innerHTML = '';

      dates.forEach(d => {
        const parts = d.split('-');
        const path = `data/habits/${parts[0]}/${parts[1]}.json`;
        const monthLog = monthData[path];

        let isDone = false;
        // Prioritize local state for today
        if (d === todayStr && completions[todayStr]) {
          isDone = completions[todayStr].includes(habit.id);
        } else {
          isDone = (monthLog[d] || []).includes(habit.id);
        }

        if (isDone) completedDays++;

        const row = document.createElement('div');
        row.className = 'habit-history-row';
        const dateSpan = document.createElement('span');
        dateSpan.textContent = new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        const statusSpan = document.createElement('span');
        statusSpan.className = isDone ? 'habit-status-yes' : 'habit-status-no';
        statusSpan.textContent = isDone ? '✔ Completed' : '✖ Missed';

        row.appendChild(dateSpan);
        row.appendChild(statusSpan);
        listEl.appendChild(row);
      });

      const consistency = Math.round((completedDays / totalDays) * 100);
      document.getElementById('hd-consistency').textContent = consistency;

    } catch (e) {
      document.getElementById('hd-history-list').innerHTML = '<p class="loading-text">Error loading history.</p>';
    }
  }

  // --- Dashboard Logic ---

  function renderDashboard() {
    const activeHabits = habits.filter(h => h.isActive);

    // Overall Consistency (This Month)
    // Formula: sum of completions for active habits / sum of possible days for active habits
    let d = new Date();
    d.setDate(1);
    const startOfMonth = d.toISOString().split('T')[0];

    const datesThisMonth = [];
    let cur = new Date(startOfMonth);
    const end = new Date(todayStr); // Only up to today
    while (cur <= end) {
      datesThisMonth.push(cur.toISOString().split('T')[0]);
      cur.setDate(cur.getDate() + 1);
    }

    let totalPossible = 0;
    let totalDone = 0;
    const summaryData = [];
    const streaksData = [];

    activeHabits.forEach(h => {
      let habitPossible = 0;
      let habitDone = 0;

      datesThisMonth.forEach(date => {
        if (date >= h.createdAt && (!h.deletedAt || date <= h.deletedAt)) {
          habitPossible++;
          // Prioritize today's in-memory unsaved toggles, fallback to API cache
          const isDoneToday = date === todayStr && completions[todayStr] && completions[todayStr].includes(h.id);
          const isDonePast = completions[date] && completions[date].includes(h.id);
          if (isDoneToday || isDonePast) {
            habitDone++;
            totalDone++;
          }
        }
      });
      totalPossible += habitPossible;

      summaryData.push({
        name: h.name,
        done: habitDone,
        possible: habitPossible,
        pct: habitPossible > 0 ? Math.round((habitDone / habitPossible) * 100) : 0
      });

      // Calculate streak
      let streak = 0;
      let checkDate = new Date(todayStr);
      let missingToday = false;

      // If today is not done, move to yesterday
      if (!completions[todayStr] || !completions[todayStr].includes(h.id)) {
        missingToday = true;
        checkDate.setDate(checkDate.getDate() - 1);
      }

      while (true) {
        const dStr = checkDate.toISOString().split('T')[0];
        if (dStr < h.createdAt) break;
        if (h.deletedAt && dStr > h.deletedAt) {
          checkDate.setDate(checkDate.getDate() - 1);
          continue;
        }

        // is done?
        let checkDone = false;
        if (dStr === todayStr) {
          checkDone = completions[todayStr] && completions[todayStr].includes(h.id);
        } else {
          // We might not have past month data loaded if it crosses a month boundary.
          // For streaks, if it crosses a month, it will require an async check.
          // However, if we only look at completions (which only has current month), streak stops at month edge.
          // Let's rely strictly on `completions` which holds the current month loaded data.
          checkDone = completions[dStr] && completions[dStr].includes(h.id);
        }

        if (checkDone) {
          streak++;
          checkDate.setDate(checkDate.getDate() - 1);
        } else {
          break; // Stop climbing back
        }
      }

      // Formatting: if missing today but streak > 0 from yesterday, that's fine.
      streaksData.push({
        name: h.name,
        streak: streak
      });
    });

    // Render Overview
    const overallPct = totalPossible > 0 ? Math.round((totalDone / totalPossible) * 100) : 0;
    document.getElementById('dash-overall-bar').style.width = overallPct + '%';
    document.getElementById('dash-overall-val').textContent = overallPct + '%';

    const sumList = document.getElementById('dash-habit-summary');
    sumList.innerHTML = '';
    if (summaryData.length === 0) sumList.innerHTML = '<p class="form-hint">No active habits.</p>';
    summaryData.forEach(s => {
      sumList.innerHTML += `
        <div class="dash-item" title="Completed on ${s.done} out of ${s.possible} days">
          <span class="dash-item-name">${s.name}</span>
          <div style="display:flex; align-items:center;">
             <span class="dash-item-val">${s.pct}%</span>
             <div class="dash-item-prog"><div class="dash-item-fill" style="width:${s.pct}%"></div></div>
          </div>
        </div>
      `;
    });

    const streakList = document.getElementById('dash-streaks');
    streakList.innerHTML = '';
    if (streaksData.length === 0) streakList.innerHTML = '<p class="form-hint">No active habits.</p>';
    streaksData.forEach(s => {
      streakList.innerHTML += `
        <div class="dash-item" title="Number of consecutive days completed.">
          <span class="dash-item-name">${s.name}</span>
          <span class="dash-item-val">${s.streak} days 🔥</span>
        </div>
      `;
    });

    // Render Explorer Layer
    const explorerList = document.getElementById('explorer-list');
    explorerList.innerHTML = '';

    // Show all habits. If deleted, add (deleted)
    habits.forEach(h => {
      const pill = document.createElement('div');
      pill.className = 'explorer-pill';
      pill.textContent = h.isActive ? h.name : h.name + ' (deleted)';
      pill.onclick = () => {
        document.querySelectorAll('.explorer-pill').forEach(el => el.classList.remove('active'));
        pill.classList.add('active');
        renderExplorerPanel(h);
      };
      explorerList.appendChild(pill);
    });

    // Select first active if exists
    if (activeHabits.length > 0) {
      explorerList.firstChild.click();
    } else {
      document.getElementById('explorer-panel').style.display = 'none';
    }
  }

  async function renderExplorerPanel(habit) {
    const expPanel = document.getElementById('explorer-panel');
    expPanel.style.display = 'block';

    document.getElementById('exp-name').textContent = habit.name;
    document.getElementById('exp-start').textContent = new Date(habit.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    document.getElementById('exp-consistency').textContent = '...';
    document.getElementById('exp-history').innerHTML = '<p class="loading-text" style="padding-top:1rem">Loading history...</p>';

    const start = new Date(habit.createdAt);
    const endStr = habit.deletedAt ? habit.deletedAt : todayStr;
    const end = new Date(endStr);

    const dates = [];
    let current = new Date(end);
    while (current >= start) {
      dates.push(current.toISOString().split('T')[0]);
      current.setDate(current.getDate() - 1);
    }
    dates.reverse(); // oldest first to keep it chronological

    const monthsNeeded = [...new Set(dates.map(d => {
      const parts = d.split('-');
      return `data/habits/${parts[0]}/${parts[1]}.json`;
    }))];

    let totalDays = dates.length;
    if (totalDays === 0) totalDays = 1;
    let completedDays = 0;

    try {
      const monthData = {};
      await Promise.all(monthsNeeded.map(async path => {
        let res = await GitHub.getFile(path);
        monthData[path] = res.content || {};
      }));

      const listEl = document.getElementById('exp-history');
      listEl.innerHTML = '';

      let currentMonthStr = "";

      dates.forEach(d => {
        const parts = d.split('-');
        const monthGroupStr = new Date(d).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        if (monthGroupStr !== currentMonthStr) {
          currentMonthStr = monthGroupStr;
          const groupTitle = document.createElement('div');
          groupTitle.className = 'month-group-title';
          if (listEl.childNodes.length > 0) groupTitle.style.marginTop = '1rem';
          groupTitle.textContent = monthGroupStr;
          listEl.appendChild(groupTitle);
        }

        const path = `data/habits/${parts[0]}/${parts[1]}.json`;
        const monthLog = monthData[path];

        let isDone = false;
        if (d === todayStr && completions[todayStr]) {
          isDone = completions[todayStr].includes(habit.id);
        } else {
          isDone = (monthLog[d] || []).includes(habit.id);
        }

        if (isDone) completedDays++;

        const row = document.createElement('div');
        row.className = 'habit-history-row';
        const dateSpan = document.createElement('span');
        dateSpan.textContent = new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const statusSpan = document.createElement('span');
        statusSpan.className = isDone ? 'habit-status-yes' : 'habit-status-no';
        statusSpan.textContent = isDone ? '✔' : '✖';

        row.appendChild(dateSpan);
        row.appendChild(statusSpan);
        listEl.appendChild(row);
      });

      const consistency = Math.round((completedDays / totalDays) * 100);
      document.getElementById('exp-consistency').textContent = consistency;

    } catch (e) {
      document.getElementById('exp-history').innerHTML = '<p class="loading-text">Error loading history.</p>';
    }
  }

  // Start app
  init();
});
