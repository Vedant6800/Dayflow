/**
 * habits.js — Habits Module Logic
 * Supports marking habits for any past (or current) date via selectedDate state.
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

  // ── State ────────────────────────────────────────────────────────────────
  let habits = [];       // Array of { id, name, createdAt, isActive, deletedAt }

  /**
   * monthCache holds one completions object per month path.
   * Shape: { "data/habits/YYYY/MM.json": { "YYYY-MM-DD": ["h_id", ...], ... } }
   * This is the single source of truth for all date operations.
   */
  const monthCache = {};

  // Use local date parts — never toISOString() — to avoid UTC offset drift.
  function localDateStr(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  // Shift a YYYY-MM-DD string by `delta` days (positive = forward, negative = back).
  // Operates entirely in local time — no UTC conversion.
  function shiftDate(dateStr, delta) {
    const [y, m, d] = dateStr.split('-').map(Number);
    return localDateStr(new Date(y, m - 1, d + delta));
  }

  const todayStr = localDateStr(new Date());

  // selectedDate drives everything in the Today view.
  let selectedDateStr = todayStr;

  // ── UI Elements ───────────────────────────────────────────────────────────
  const viewToday     = document.getElementById('view-today');
  const viewDashboard = document.getElementById('view-dashboard');
  const viewManage    = document.getElementById('view-manage');
  const navToday      = document.getElementById('nav-today');
  const navDashboard  = document.getElementById('nav-dashboard');
  const navManage     = document.getElementById('nav-manage');
  const loading       = document.getElementById('habits-loading');

  const habitList   = document.getElementById('habit-list');
  const manageList  = document.getElementById('habit-manage-list');
  const emptyToday  = document.getElementById('habits-empty');
  const emptyManage = document.getElementById('manage-empty');

  const progressBar   = document.getElementById('habit-progress-bar');
  const progressLabel = document.getElementById('habit-progress-label');
  const progressRing  = document.getElementById('habits-progress-ring');

  // Date navigator
  const datePicker    = document.getElementById('date-picker');
  const dateNavLabel  = document.getElementById('date-nav-label');
  const datePrevBtn   = document.getElementById('date-prev-btn');
  const dateNextBtn   = document.getElementById('date-next-btn');
  const dateContextBar = document.getElementById('date-context-bar');

  // Set eyebrow to today's human-readable date
  const dateOptions = { weekday: 'long', month: 'long', day: 'numeric' };
  document.getElementById('habits-date-label').textContent =
    new Date().toLocaleDateString('en-US', dateOptions);

  // ── Helpers ───────────────────────────────────────────────────────────────
  function getMonthPath(dateStr) {
    const [yyyy, mm] = dateStr.split('-');
    return `data/habits/${yyyy}/${mm}.json`;
  }

  /** Ensure monthCache has the completions for the given dateStr's month. */
  async function ensureMonthLoaded(dateStr) {
    const path = getMonthPath(dateStr);
    if (monthCache[path] !== undefined) return; // already loaded
    const res = await GitHub.getFile(path);
    monthCache[path] = res.content || {};
  }

  /** Get the completions array for a specific date (from cache). */
  function getCompletionsForDate(dateStr) {
    const path = getMonthPath(dateStr);
    const month = monthCache[path] || {};
    return month[dateStr] || [];
  }

  /** Format a dateStr as a friendly label, e.g. "Fri, 9 May 2026". */
  function formatDateLabel(dateStr) {
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
      weekday: 'short', day: 'numeric', month: 'short', year: 'numeric'
    });
  }

  // ── Date Navigator ────────────────────────────────────────────────────────
  function updateDateNavigator() {
    datePicker.value = selectedDateStr;
    datePicker.max   = todayStr; // no future dates

    dateNavLabel.textContent = formatDateLabel(selectedDateStr);

    // Disable next button when we're already on today
    dateNextBtn.disabled = (selectedDateStr >= todayStr);
    dateNextBtn.style.opacity = (selectedDateStr >= todayStr) ? '0.35' : '';
    dateNextBtn.style.cursor  = (selectedDateStr >= todayStr) ? 'default' : '';

    // Context bar
    if (selectedDateStr === todayStr) {
      dateContextBar.textContent = '';
      dateContextBar.className = 'date-context-bar';
    } else {
      dateContextBar.textContent = '✏ Editing past record — ' + formatDateLabel(selectedDateStr);
      dateContextBar.className = 'date-context-bar past';
    }
  }

  datePicker.addEventListener('change', async () => {
    const val = datePicker.value;
    if (!val || val > todayStr) return; // block future
    selectedDateStr = val;
    updateDateNavigator();
    await loadAndRenderToday();
  });

  datePrevBtn.addEventListener('click', async () => {
    selectedDateStr = shiftDate(selectedDateStr, -1);
    updateDateNavigator();
    await loadAndRenderToday();
  });

  dateNextBtn.addEventListener('click', async () => {
    if (selectedDateStr >= todayStr) return;
    selectedDateStr = shiftDate(selectedDateStr, +1);
    updateDateNavigator();
    await loadAndRenderToday();
  });

  // ── Init ──────────────────────────────────────────────────────────────────
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

      // Pre-load today's (= selectedDate's) month
      await ensureMonthLoaded(selectedDateStr);

      loading.classList.add('hidden');
      updateDateNavigator();
      switchView('today');
      renderManage();

    } catch (e) {
      console.error(e);
      loading.innerHTML = '<p class="loading-text">Error loading habits. Check console.</p>';
    }
  }

  // ── View Switching ────────────────────────────────────────────────────────
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
      loadAndRenderToday();
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

  navToday.addEventListener('click',     () => switchView('today'));
  navDashboard.addEventListener('click', () => switchView('dashboard'));
  navManage.addEventListener('click',    () => switchView('manage'));

  // ── Manage Logic ──────────────────────────────────────────────────────────
  const addBtn   = document.getElementById('add-habit-btn');
  const addInput = document.getElementById('new-habit-input');

  addBtn.addEventListener('click', () => {
    const val = addInput.value.trim();
    if (!val) return;
    habits.push({
      id: 'h_' + Date.now().toString(36),
      name: val,
      createdAt: todayStr,
      isActive: true,
      deletedAt: null
    });
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
    const active = habits.filter(h => h.isActive);
    if (active.length === 0) {
      emptyManage.classList.remove('hidden');
      return;
    }
    emptyManage.classList.add('hidden');

    active.forEach(h => {
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

  // ── Today Logic ───────────────────────────────────────────────────────────

  /**
   * Ensure the correct month is loaded, then render the habit list
   * for selectedDateStr.
   */
  async function loadAndRenderToday() {
    // Show a subtle loading state in the list without hiding the whole view
    habitList.innerHTML = '<p class="loading-text" style="padding:1rem 0">Loading…</p>';
    emptyToday.classList.add('hidden');

    try {
      await ensureMonthLoaded(selectedDateStr);
    } catch (e) {
      habitList.innerHTML = '<p class="loading-text" style="padding:1rem 0">Error loading data.</p>';
      console.error(e);
      return;
    }

    renderToday();
  }

  function renderToday() {
    habitList.innerHTML = '';

    /**
     * Visibility rule for a habit on selectedDateStr:
     *   - must exist at or before selectedDate (createdAt <= selectedDateStr)
     *   - must not be deleted before selectedDate (deletedAt null OR deletedAt >= selectedDateStr)
     *   - isActive is for the manage list; for past records we still show if the above match
     */
    const visibleHabits = habits.filter(h => {
      const started = h.createdAt <= selectedDateStr;
      const notYetDeleted = !h.deletedAt || h.deletedAt >= selectedDateStr;
      return started && notYetDeleted;
    });

    if (visibleHabits.length === 0) {
      emptyToday.classList.remove('hidden');
      updateProgress(0, 0);
      return;
    }
    emptyToday.classList.add('hidden');

    const selectedCompletions = getCompletionsForDate(selectedDateStr);

    // For streak indicator: check the day before selectedDate
    const prevDate = new Date(selectedDateStr + 'T00:00:00');
    prevDate.setDate(prevDate.getDate() - 1);
    const prevDateStr = prevDate.toISOString().split('T')[0];
    const prevCompletions = getCompletionsForDate(prevDateStr);

    // Is this a past date? Disable toggling for future (shouldn't reach here) or as needed.
    const isFuture = selectedDateStr > todayStr;

    visibleHabits.forEach(h => {
      const isDone = selectedCompletions.includes(h.id);

      const el = document.createElement('div');
      el.className = `habit-item ${isDone ? 'checked' : ''} ${isFuture ? 'habit-disabled' : ''}`;

      const checkbox = document.createElement('div');
      checkbox.className = 'habit-checkbox';
      checkbox.textContent = '✓';

      if (!isFuture) {
        checkbox.addEventListener('click', (e) => {
          e.stopPropagation();
          toggleHabit(h.id, el);
        });
        el.addEventListener('click', () => toggleHabit(h.id, el));
      }

      const name = document.createElement('span');
      name.className = 'habit-name';
      name.style.cursor = isFuture ? 'default' : 'pointer';
      name.textContent = h.name;
      // Clicking the name opens details (works on any date)
      name.addEventListener('click', (e) => {
        e.stopPropagation();
        openHabitDetails(h);
      });

      el.appendChild(checkbox);
      el.appendChild(name);

      // Streak fire: show if the previous day was completed
      const prevDone = prevCompletions.includes(h.id);
      if (prevDone && selectedDateStr === todayStr) {
        // Only show streak fire in today view to avoid confusing past views
        const streak = document.createElement('div');
        streak.className = 'habit-streak';
        streak.innerHTML = '<span class="streak-fire">🔥</span>';
        el.appendChild(streak);
      }

      habitList.appendChild(el);
    });

    updateProgress(selectedCompletions.filter(id => visibleHabits.some(h => h.id === id)).length, visibleHabits.length);
  }

  function toggleHabit(id, el) {
    const path = getMonthPath(selectedDateStr);

    // Ensure the month object exists in cache
    if (!monthCache[path]) monthCache[path] = {};
    if (!monthCache[path][selectedDateStr]) monthCache[path][selectedDateStr] = [];

    const arr = monthCache[path][selectedDateStr];
    const idx = arr.indexOf(id);
    if (idx > -1) {
      arr.splice(idx, 1);
      el.classList.remove('checked');
    } else {
      arr.push(id);
      el.classList.add('checked');
    }

    // Re-count progress
    const visibleHabits = habits.filter(h => {
      return h.createdAt <= selectedDateStr && (!h.deletedAt || h.deletedAt >= selectedDateStr);
    });
    const done = arr.filter(id => visibleHabits.some(h => h.id === id)).length;
    updateProgress(done, visibleHabits.length);
  }

  const saveTodayBtn = document.getElementById('save-today-btn');
  if (saveTodayBtn) {
    saveTodayBtn.addEventListener('click', () => {
      const path = getMonthPath(selectedDateStr);
      const data = monthCache[path] || {};
      GitHub.saveFile(path, data);
    });
  }

  function updateProgress(done, total) {
    if (total === 0) {
      progressBar.style.width = '0%';
      progressLabel.textContent = '0 / 0';
      progressRing.innerHTML = '';
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

  // ── Habit Details Modal ───────────────────────────────────────────────────
  const hdModal   = document.getElementById('habit-details-modal');
  const hdCloseBtn = document.getElementById('hd-close-btn');

  hdCloseBtn.addEventListener('click', () => hdModal.classList.add('hidden'));

  async function openHabitDetails(habit) {
    document.getElementById('hd-name').textContent = habit.name;
    document.getElementById('hd-start').textContent = new Date(habit.createdAt + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    document.getElementById('hd-consistency').textContent = '...';
    document.getElementById('hd-history-list').innerHTML = '<p class="loading-text" style="padding-top:1rem">Loading history...</p>';
    hdModal.classList.remove('hidden');

    const start  = new Date(habit.createdAt + 'T00:00:00');
    const endStr = habit.deletedAt ? habit.deletedAt : todayStr;
    const end    = new Date(endStr + 'T00:00:00');

    const dates = [];
    let cur = new Date(start);
    while (cur <= end) {
      dates.push(cur.toISOString().split('T')[0]);
      cur.setDate(cur.getDate() + 1);
    }

    const monthsNeeded = [...new Set(dates.map(d => getMonthPath(d)))];

    let totalDays = dates.length || 1;
    let completedDays = 0;

    try {
      const monthData = {};
      await Promise.all(monthsNeeded.map(async path => {
        const res = await GitHub.getFile(path);
        // Merge with in-memory cache so unsaved toggles are reflected
        monthData[path] = { ...(res.content || {}), ...(monthCache[path] || {}) };
      }));

      const listEl = document.getElementById('hd-history-list');
      listEl.innerHTML = '';

      dates.forEach(d => {
        const path = getMonthPath(d);
        const monthLog = monthData[path] || {};
        const isDone = (monthLog[d] || []).includes(habit.id);
        if (isDone) completedDays++;

        const row = document.createElement('div');
        row.className = 'habit-history-row';

        const dateSpan = document.createElement('span');
        dateSpan.textContent = new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

        const statusSpan = document.createElement('span');
        statusSpan.className = isDone ? 'habit-status-yes' : 'habit-status-no';
        statusSpan.textContent = isDone ? '✔ Completed' : '✖ Missed';

        row.appendChild(dateSpan);
        row.appendChild(statusSpan);
        listEl.appendChild(row);
      });

      document.getElementById('hd-consistency').textContent = Math.round((completedDays / totalDays) * 100);

    } catch (e) {
      document.getElementById('hd-history-list').innerHTML = '<p class="loading-text">Error loading history.</p>';
    }
  }

  // ── Dashboard Logic ───────────────────────────────────────────────────────
  function renderDashboard() {
    const activeHabits = habits.filter(h => h.isActive);

    let d = new Date();
    d.setDate(1);
    const startOfMonth = d.toISOString().split('T')[0];

    const datesThisMonth = [];
    let cur2 = new Date(startOfMonth + 'T00:00:00');
    const end2 = new Date(todayStr + 'T00:00:00');
    while (cur2 <= end2) {
      datesThisMonth.push(cur2.toISOString().split('T')[0]);
      cur2.setDate(cur2.getDate() + 1);
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
          const comps = getCompletionsForDate(date);
          if (comps.includes(h.id)) {
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

      // Streak calculation (relies on monthCache; only current month available)
      let streak = 0;
      let checkDate = new Date(todayStr + 'T00:00:00');
      if (!getCompletionsForDate(todayStr).includes(h.id)) {
        checkDate.setDate(checkDate.getDate() - 1);
      }
      while (true) {
        const dStr = checkDate.toISOString().split('T')[0];
        if (dStr < h.createdAt) break;
        if (h.deletedAt && dStr > h.deletedAt) { checkDate.setDate(checkDate.getDate() - 1); continue; }
        if (getCompletionsForDate(dStr).includes(h.id)) {
          streak++;
          checkDate.setDate(checkDate.getDate() - 1);
        } else {
          break;
        }
      }
      streaksData.push({ name: h.name, streak });
    });

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

    // Explorer
    const explorerList = document.getElementById('explorer-list');
    explorerList.innerHTML = '';
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
    document.getElementById('exp-start').textContent = new Date(habit.createdAt + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    document.getElementById('exp-consistency').textContent = '...';
    document.getElementById('exp-history').innerHTML = '<p class="loading-text" style="padding-top:1rem">Loading history...</p>';

    const start  = new Date(habit.createdAt + 'T00:00:00');
    const endStr = habit.deletedAt ? habit.deletedAt : todayStr;
    const end    = new Date(endStr + 'T00:00:00');

    const dates = [];
    let cur = new Date(end);
    while (cur >= start) {
      dates.push(cur.toISOString().split('T')[0]);
      cur.setDate(cur.getDate() - 1);
    }
    dates.reverse();

    const monthsNeeded = [...new Set(dates.map(d => getMonthPath(d)))];
    let totalDays = dates.length || 1;
    let completedDays = 0;

    try {
      const monthData = {};
      await Promise.all(monthsNeeded.map(async path => {
        const res = await GitHub.getFile(path);
        monthData[path] = { ...(res.content || {}), ...(monthCache[path] || {}) };
      }));

      const listEl = document.getElementById('exp-history');
      listEl.innerHTML = '';
      let currentMonthStr = '';

      dates.forEach(d => {
        const monthGroupStr = new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        if (monthGroupStr !== currentMonthStr) {
          currentMonthStr = monthGroupStr;
          const groupTitle = document.createElement('div');
          groupTitle.className = 'month-group-title';
          if (listEl.childNodes.length > 0) groupTitle.style.marginTop = '1rem';
          groupTitle.textContent = monthGroupStr;
          listEl.appendChild(groupTitle);
        }

        const path = getMonthPath(d);
        const monthLog = monthData[path] || {};
        const isDone = (monthLog[d] || []).includes(habit.id);
        if (isDone) completedDays++;

        const row = document.createElement('div');
        row.className = 'habit-history-row';
        const dateSpan = document.createElement('span');
        dateSpan.textContent = new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const statusSpan = document.createElement('span');
        statusSpan.className = isDone ? 'habit-status-yes' : 'habit-status-no';
        statusSpan.textContent = isDone ? '✔' : '✖';

        row.appendChild(dateSpan);
        row.appendChild(statusSpan);
        listEl.appendChild(row);
      });

      document.getElementById('exp-consistency').textContent = Math.round((completedDays / totalDays) * 100);

    } catch (e) {
      document.getElementById('exp-history').innerHTML = '<p class="loading-text">Error loading history.</p>';
    }
  }

  // ── Start ─────────────────────────────────────────────────────────────────
  init();
});
