/**
 * tasks.js — Tasks Module Logic
 * Date-based task management with manual save workflow.
 * Storage: data/todos/YYYY/MM.json  →  { "YYYY-MM-DD": [taskObj, ...], ... }
 */

document.addEventListener('DOMContentLoaded', async () => {
  // ── Bootstrap ─────────────────────────────────────────────────────────────
  try {
    await GitHub.initializeToken();
  } catch (e) {
    console.error(e);
    document.getElementById('tasks-loading').innerHTML =
      `<p class="loading-text">${e.message}</p>`;
    return;
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  /** Return YYYY-MM-DD from a local Date object (no UTC drift). */
  function localDateStr(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  /** Shift a YYYY-MM-DD string by `delta` days in local time. */
  function shiftDate(dateStr, delta) {
    const [y, m, d] = dateStr.split('-').map(Number);
    return localDateStr(new Date(y, m - 1, d + delta));
  }

  /** Parse a YYYY-MM-DD as local midnight. */
  function parseLocal(dateStr) {
    return new Date(dateStr + 'T00:00:00');
  }

  function formatDateLabel(dateStr) {
    return parseLocal(dateStr).toLocaleDateString('en-US', {
      weekday: 'short', day: 'numeric', month: 'short', year: 'numeric'
    });
  }

  function formatDateTitle(dateStr) {
    return parseLocal(dateStr).toLocaleDateString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric'
    });
  }

  function getMonthPath(dateStr) {
    const [yyyy, mm] = dateStr.split('-');
    return `data/todos/${yyyy}/${mm}.json`;
  }

  function genId() {
    return 'tk_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
  }

  const PRIORITY_ORDER = { high: 0, medium: 1, low: 2, none: 3 };

  const PRIORITY_LABELS = {
    high:   { label: 'High',   badge: 'tasks-badge-high' },
    medium: { label: 'Medium', badge: 'tasks-badge-medium' },
    low:    { label: 'Low',    badge: 'tasks-badge-low' },
    none:   { label: '',       badge: '' },
  };

  // ── State ─────────────────────────────────────────────────────────────────
  const todayStr = localDateStr(new Date());
  let selectedDateStr = todayStr;

  /**
   * monthCache: path → { "YYYY-MM-DD": [taskObj, ...] }
   * This is the single source of truth for local (in-memory) state.
   */
  const monthCache = {};

  /**
   * dirtyMonths: Set of month paths that have been modified locally
   * but not yet saved to GitHub.
   */
  const dirtyMonths = new Set();

  // ── DOM refs ──────────────────────────────────────────────────────────────
  const loading            = document.getElementById('tasks-loading');
  const viewTasks          = document.getElementById('view-tasks');
  const viewUpcoming       = document.getElementById('view-upcoming');
  const navTasks           = document.getElementById('nav-tasks');
  const navUpcoming        = document.getElementById('nav-upcoming');

  const eyebrow            = document.getElementById('tasks-eyebrow');
  const dateDisplay        = document.getElementById('tasks-date-display');
  const datePicker         = document.getElementById('tasks-date-picker');
  const dateLabel          = document.getElementById('tasks-date-label');
  const datePrevBtn        = document.getElementById('tasks-date-prev');
  const dateNextBtn        = document.getElementById('tasks-date-next');
  const gotoTodayBtn       = document.getElementById('tasks-goto-today');

  const statTotal          = document.getElementById('stat-total');
  const statDone           = document.getElementById('stat-done');
  const statPending        = document.getElementById('stat-pending');
  const progressFill       = document.getElementById('tasks-progress-fill');
  const progressPct        = document.getElementById('tasks-progress-pct');

  const taskNewInput       = document.getElementById('task-new-input');
  const taskNewPriority    = document.getElementById('task-new-priority');
  const taskAddBtn         = document.getElementById('task-add-btn');

  const pendingList        = document.getElementById('tasks-pending-list');
  const tasksEmpty         = document.getElementById('tasks-empty');
  const completedSection   = document.getElementById('tasks-completed-section');
  const completedToggle    = document.getElementById('tasks-completed-toggle');
  const completedChevron   = document.getElementById('tasks-completed-chevron');
  const completedList      = document.getElementById('tasks-completed-list');
  const completedCount     = document.getElementById('tasks-completed-count');

  const upcomingList       = document.getElementById('upcoming-list');
  const upcomingEmpty      = document.getElementById('upcoming-empty');

  const unsavedIndicator   = document.getElementById('unsaved-indicator');
  const saveTasksBtn       = document.getElementById('save-tasks-btn');

  const editModal          = document.getElementById('task-edit-modal');
  const editTaskText       = document.getElementById('edit-task-text');
  const editTaskPriority   = document.getElementById('edit-task-priority');
  const editTaskDate       = document.getElementById('edit-task-date');
  const editCancelBtn      = document.getElementById('edit-cancel-btn');
  const editSaveBtn        = document.getElementById('edit-save-btn');

  let completedOpen = false; // collapsed state for completed section
  let editingTaskId = null;  // id of the task currently in the edit modal

  // ── Month Loading ─────────────────────────────────────────────────────────
  async function ensureMonthLoaded(dateStr) {
    const path = getMonthPath(dateStr);
    if (monthCache[path] !== undefined) return;
    const res = await GitHub.getFile(path);
    monthCache[path] = res.content || {};
  }

  function getTasksForDate(dateStr) {
    const path = getMonthPath(dateStr);
    const month = monthCache[path] || {};
    return month[dateStr] ? [...month[dateStr]] : [];
  }

  function setTasksForDate(dateStr, tasks) {
    const path = getMonthPath(dateStr);
    if (!monthCache[path]) monthCache[path] = {};
    monthCache[path][dateStr] = tasks;
    dirtyMonths.add(path);
    updateUnsavedIndicator();
  }

  // ── Unsaved changes tracking ───────────────────────────────────────────────
  function updateUnsavedIndicator() {
    const hasDirty = dirtyMonths.size > 0;
    unsavedIndicator.classList.toggle('hidden', !hasDirty);
    saveTasksBtn.classList.toggle('btn-primary', true);
  }

  // Warn on navigation away with unsaved changes
  window.addEventListener('beforeunload', (e) => {
    if (dirtyMonths.size > 0) {
      e.preventDefault();
      e.returnValue = '';
    }
  });

  // Intercept back-to-home link
  document.getElementById('back-home-link').addEventListener('click', (e) => {
    if (dirtyMonths.size > 0) {
      if (!confirm('You have unsaved changes. Leave without saving?')) {
        e.preventDefault();
      }
    }
  });

  // ── Save ──────────────────────────────────────────────────────────────────
  saveTasksBtn.addEventListener('click', async () => {
    if (dirtyMonths.size === 0) return;
    const months = [...dirtyMonths];
    for (const path of months) {
      await GitHub.saveFile(path, monthCache[path] || {});
      dirtyMonths.delete(path);
    }
    updateUnsavedIndicator();
  });

  // ── Date Navigator ────────────────────────────────────────────────────────
  function updateDateNavigator() {
    datePicker.value       = selectedDateStr;
    dateLabel.textContent  = formatDateLabel(selectedDateStr);
    dateDisplay.textContent = formatDateTitle(selectedDateStr);

    // eyebrow context
    if (selectedDateStr === todayStr) {
      eyebrow.textContent = 'Today';
      gotoTodayBtn.classList.add('hidden');
    } else if (selectedDateStr > todayStr) {
      const diff = Math.round((parseLocal(selectedDateStr) - parseLocal(todayStr)) / 86400000);
      eyebrow.textContent = `In ${diff} day${diff !== 1 ? 's' : ''}`;
      gotoTodayBtn.classList.remove('hidden');
    } else {
      const diff = Math.round((parseLocal(todayStr) - parseLocal(selectedDateStr)) / 86400000);
      eyebrow.textContent = `${diff} day${diff !== 1 ? 's' : ''} ago`;
      gotoTodayBtn.classList.remove('hidden');
    }
  }

  datePicker.addEventListener('change', async () => {
    const val = datePicker.value;
    if (!val) return;
    selectedDateStr = val;
    updateDateNavigator();
    await loadAndRender();
  });

  datePrevBtn.addEventListener('click', async () => {
    selectedDateStr = shiftDate(selectedDateStr, -1);
    updateDateNavigator();
    await loadAndRender();
  });

  dateNextBtn.addEventListener('click', async () => {
    selectedDateStr = shiftDate(selectedDateStr, +1);
    updateDateNavigator();
    await loadAndRender();
  });

  gotoTodayBtn.addEventListener('click', async () => {
    selectedDateStr = todayStr;
    updateDateNavigator();
    await loadAndRender();
  });

  // ── View Switching ─────────────────────────────────────────────────────────
  function switchView(view) {
    viewTasks.classList.add('hidden');
    viewUpcoming.classList.add('hidden');
    navTasks.classList.remove('active');
    navUpcoming.classList.remove('active');

    if (view === 'tasks') {
      viewTasks.classList.remove('hidden');
      navTasks.classList.add('active');
      loadAndRender();
    } else {
      viewUpcoming.classList.remove('hidden');
      navUpcoming.classList.add('active');
      renderUpcoming();
    }
  }

  navTasks.addEventListener('click',    () => switchView('tasks'));
  navUpcoming.addEventListener('click', () => switchView('upcoming'));

  // ── Add Task ──────────────────────────────────────────────────────────────
  taskAddBtn.addEventListener('click', addTask);
  taskNewInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') addTask();
  });

  function addTask() {
    const text = taskNewInput.value.trim();
    if (!text) {
      taskNewInput.focus();
      return;
    }
    const now = new Date().toISOString();
    const task = {
      id: genId(),
      text,
      completed: false,
      date: selectedDateStr,
      priority: taskNewPriority.value || 'none',
      createdAt: now,
      updatedAt: now,
    };
    const tasks = getTasksForDate(selectedDateStr);
    tasks.push(task);
    setTasksForDate(selectedDateStr, tasks);
    taskNewInput.value = '';
    taskNewPriority.value = 'none';
    renderTaskList();
  }

  // ── Render Task List ──────────────────────────────────────────────────────
  async function loadAndRender() {
    pendingList.innerHTML = '<p class="loading-text" style="padding:1rem 0">Loading…</p>';
    tasksEmpty.classList.add('hidden');
    completedSection.classList.add('hidden');
    try {
      await ensureMonthLoaded(selectedDateStr);
    } catch (e) {
      pendingList.innerHTML = '<p class="loading-text" style="padding:1rem 0">Error loading tasks.</p>';
      console.error(e);
      return;
    }
    renderTaskList();
  }

  function renderTaskList() {
    const allTasks = getTasksForDate(selectedDateStr);
    const pending   = allTasks.filter(t => !t.completed)
      .sort((a, b) => PRIORITY_ORDER[a.priority || 'none'] - PRIORITY_ORDER[b.priority || 'none']);
    const completed = allTasks.filter(t => t.completed)
      .sort((a, b) => PRIORITY_ORDER[a.priority || 'none'] - PRIORITY_ORDER[b.priority || 'none']);

    // Stats
    statTotal.textContent   = allTasks.length;
    statDone.textContent    = completed.length;
    statPending.textContent = pending.length;
    const pct = allTasks.length > 0 ? Math.round((completed.length / allTasks.length) * 100) : 0;
    progressFill.style.width = pct + '%';
    progressPct.textContent  = pct + '%';

    // Pending
    pendingList.innerHTML = '';
    if (pending.length === 0 && completed.length === 0) {
      tasksEmpty.classList.remove('hidden');
    } else {
      tasksEmpty.classList.add('hidden');
      renderGroup(pendingList, pending, false);
    }

    // Completed
    if (completed.length > 0) {
      completedSection.classList.remove('hidden');
      completedCount.textContent = completed.length;
      completedList.innerHTML = '';
      if (completedOpen) {
        renderGroup(completedList, completed, true);
        completedChevron.textContent = '▼';
        completedList.classList.remove('hidden');
      } else {
        completedChevron.textContent = '▶';
        completedList.classList.add('hidden');
      }
    } else {
      completedSection.classList.add('hidden');
    }
  }

  function renderGroup(container, tasks, isCompleted) {
    // Group by priority
    const groups = {};
    tasks.forEach(t => {
      const p = t.priority || 'none';
      if (!groups[p]) groups[p] = [];
      groups[p].push(t);
    });

    const priorityKeys = Object.keys(groups).sort(
      (a, b) => PRIORITY_ORDER[a] - PRIORITY_ORDER[b]
    );

    priorityKeys.forEach(priority => {
      if (priority !== 'none') {
        const groupHeader = document.createElement('div');
        groupHeader.className = 'tasks-group-header';
        groupHeader.innerHTML = `<span class="tasks-priority-dot tasks-dot-${priority}"></span> ${PRIORITY_LABELS[priority].label}`;
        container.appendChild(groupHeader);
      }
      groups[priority].forEach(task => {
        container.appendChild(buildTaskItem(task, isCompleted));
      });
    });
  }

  function buildTaskItem(task, isCompleted) {
    const item = document.createElement('div');
    item.className = `tasks-item${isCompleted ? ' tasks-item-done' : ''}`;
    item.dataset.id = task.id;

    // Checkbox
    const checkbox = document.createElement('button');
    checkbox.className = `tasks-checkbox${isCompleted ? ' tasks-checkbox-done' : ''}`;
    checkbox.setAttribute('aria-label', isCompleted ? 'Mark incomplete' : 'Mark complete');
    checkbox.innerHTML = isCompleted ? '✓' : '';
    checkbox.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleComplete(task.id);
    });

    // Text
    const textEl = document.createElement('span');
    textEl.className = 'tasks-item-text';
    textEl.textContent = task.text;

    // Priority badge (only if not 'none')
    const badgeEl = document.createElement('span');
    if (task.priority && task.priority !== 'none') {
      badgeEl.className = `tasks-priority-badge ${PRIORITY_LABELS[task.priority].badge}`;
      badgeEl.textContent = PRIORITY_LABELS[task.priority].label;
    }

    // Actions
    const actions = document.createElement('div');
    actions.className = 'tasks-item-actions';

    const editBtn = document.createElement('button');
    editBtn.className = 'btn-icon tasks-action-btn';
    editBtn.title = 'Edit';
    editBtn.innerHTML = '✏️';
    editBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      openEditModal(task);
    });

    const delBtn = document.createElement('button');
    delBtn.className = 'btn-icon tasks-action-btn tasks-delete-btn';
    delBtn.title = 'Delete task';
    delBtn.innerHTML = '🗑️';
    delBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteTask(task.id, task.date);
    });

    actions.appendChild(editBtn);
    actions.appendChild(delBtn);

    item.appendChild(checkbox);
    item.appendChild(textEl);
    if (task.priority && task.priority !== 'none') item.appendChild(badgeEl);
    item.appendChild(actions);

    return item;
  }

  // ── Toggle Complete ────────────────────────────────────────────────────────
  function toggleComplete(taskId) {
    // The task might be on a different date if it was moved; always use task.date
    const task = findTaskById(taskId);
    if (!task) return;

    const tasks = getTasksForDate(task.date);
    const t = tasks.find(x => x.id === taskId);
    if (!t) return;

    t.completed = !t.completed;
    t.updatedAt = new Date().toISOString();
    setTasksForDate(task.date, tasks);

    if (task.date === selectedDateStr) {
      renderTaskList();
    }
  }

  // ── Delete Task ────────────────────────────────────────────────────────────
  function deleteTask(taskId, dateStr) {
    const tasks = getTasksForDate(dateStr || selectedDateStr);
    const idx = tasks.findIndex(t => t.id === taskId);
    if (idx === -1) return;
    tasks.splice(idx, 1);
    setTasksForDate(dateStr || selectedDateStr, tasks);
    renderTaskList();
  }

  // ── Find task across loaded months ────────────────────────────────────────
  function findTaskById(taskId) {
    for (const [path, monthData] of Object.entries(monthCache)) {
      for (const [date, tasks] of Object.entries(monthData)) {
        const t = tasks.find(x => x.id === taskId);
        if (t) return t;
      }
    }
    return null;
  }

  // ── Completed toggle ───────────────────────────────────────────────────────
  completedToggle.addEventListener('click', () => {
    completedOpen = !completedOpen;
    renderTaskList();
  });

  // ── Edit Modal ─────────────────────────────────────────────────────────────
  function openEditModal(task) {
    editingTaskId = task.id;
    editTaskText.value     = task.text;
    editTaskPriority.value = task.priority || 'none';
    editTaskDate.value     = task.date;
    editModal.classList.remove('hidden');
    editTaskText.focus();
    editTaskText.select();
  }

  editCancelBtn.addEventListener('click', () => {
    editModal.classList.add('hidden');
    editingTaskId = null;
  });

  editModal.addEventListener('click', (e) => {
    if (e.target === editModal) {
      editModal.classList.add('hidden');
      editingTaskId = null;
    }
  });

  editSaveBtn.addEventListener('click', () => {
    if (!editingTaskId) return;
    const newText     = editTaskText.value.trim();
    const newPriority = editTaskPriority.value;
    const newDate     = editTaskDate.value;
    if (!newText || !newDate) return;

    const task = findTaskById(editingTaskId);
    if (!task) return;

    const oldDate = task.date;

    if (oldDate !== newDate) {
      // Move task: remove from old date, add to new date
      const oldTasks = getTasksForDate(oldDate).filter(t => t.id !== editingTaskId);
      setTasksForDate(oldDate, oldTasks);

      const updatedTask = {
        ...task,
        text: newText,
        priority: newPriority,
        date: newDate,
        updatedAt: new Date().toISOString(),
      };
      // Ensure new date's month is in cache (if not already, treat as empty)
      const newPath = getMonthPath(newDate);
      if (!monthCache[newPath]) monthCache[newPath] = {};
      const newTasks = getTasksForDate(newDate);
      newTasks.push(updatedTask);
      setTasksForDate(newDate, newTasks);
    } else {
      const tasks = getTasksForDate(oldDate);
      const t = tasks.find(x => x.id === editingTaskId);
      if (t) {
        t.text     = newText;
        t.priority = newPriority;
        t.updatedAt = new Date().toISOString();
      }
      setTasksForDate(oldDate, tasks);
    }

    editModal.classList.add('hidden');
    editingTaskId = null;
    renderTaskList();
  });

  editTaskText.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') editSaveBtn.click();
    if (e.key === 'Escape') editCancelBtn.click();
  });

  // ── Upcoming View ──────────────────────────────────────────────────────────
  async function renderUpcoming() {
    upcomingList.innerHTML = '<p class="loading-text" style="padding:1rem 0">Loading…</p>';
    upcomingEmpty.classList.add('hidden');

    // Load next 30 days (including today)
    const dates = [];
    for (let i = 0; i <= 30; i++) {
      dates.push(shiftDate(todayStr, i));
    }

    // Collect unique months needed
    const monthPaths = [...new Set(dates.map(getMonthPath))];
    try {
      await Promise.all(monthPaths.map(async path => {
        if (monthCache[path] !== undefined) return;
        const res = await GitHub.getFile(path);
        monthCache[path] = res.content || {};
      }));
    } catch (e) {
      upcomingList.innerHTML = '<p class="loading-text">Error loading data.</p>';
      return;
    }

    upcomingList.innerHTML = '';
    let anyTask = false;

    dates.forEach(dateStr => {
      const tasks = getTasksForDate(dateStr);
      if (tasks.length === 0) return;
      anyTask = true;

      const daySection = document.createElement('div');
      daySection.className = 'upcoming-day';

      const isToday = dateStr === todayStr;
      const isPast  = dateStr < todayStr;

      const dayHeader = document.createElement('div');
      dayHeader.className = 'upcoming-day-header';
      dayHeader.innerHTML = `
        <span class="upcoming-day-label ${isToday ? 'upcoming-today' : ''}">${isToday ? '📍 Today' : formatDateLabel(dateStr)}</span>
        <span class="upcoming-day-count">${tasks.length} task${tasks.length !== 1 ? 's' : ''}</span>
      `;
      dayHeader.addEventListener('click', () => {
        selectedDateStr = dateStr;
        switchView('tasks');
      });

      daySection.appendChild(dayHeader);

      const sorted = [...tasks].sort((a, b) => {
        if (a.completed !== b.completed) return a.completed ? 1 : -1;
        return PRIORITY_ORDER[a.priority || 'none'] - PRIORITY_ORDER[b.priority || 'none'];
      });

      sorted.slice(0, 5).forEach(task => {
        const row = document.createElement('div');
        row.className = `upcoming-task-row${task.completed ? ' upcoming-task-done' : ''}`;
        const pBadge = task.priority && task.priority !== 'none'
          ? `<span class="tasks-priority-badge ${PRIORITY_LABELS[task.priority].badge}">${PRIORITY_LABELS[task.priority].label}</span>`
          : '';
        row.innerHTML = `
          <span class="upcoming-task-check">${task.completed ? '✓' : '○'}</span>
          <span class="upcoming-task-text">${escapeHtml(task.text)}</span>
          ${pBadge}
        `;
        daySection.appendChild(row);
      });

      if (tasks.length > 5) {
        const more = document.createElement('p');
        more.className = 'upcoming-more';
        more.textContent = `+${tasks.length - 5} more`;
        daySection.appendChild(more);
      }

      upcomingList.appendChild(daySection);
    });

    if (!anyTask) upcomingEmpty.classList.remove('hidden');
  }

  function escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // ── Init ──────────────────────────────────────────────────────────────────
  async function init() {
    try {
      await ensureMonthLoaded(selectedDateStr);
      loading.classList.add('hidden');
      updateDateNavigator();
      switchView('tasks');
    } catch (e) {
      console.error(e);
      loading.innerHTML = '<p class="loading-text">Error loading tasks. Check console.</p>';
    }
  }

  init();
});
