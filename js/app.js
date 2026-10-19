(() => {
  "use strict";

  const TASKS_KEY = "taskflow.tasks.v1";
  const THEME_KEY = "taskflow.theme";
  const VIEW_KEY = "taskflow.view";
  const CATEGORIES_KEY = "taskflow.categories";
  const STATUSES = ["To Do", "In Progress", "Completed"];
  const PRIORITIES = ["Low", "Medium", "High"];
  const DEFAULT_CATEGORIES = ["Work", "Personal", "Study", "Programming", "Health"];
  const CATEGORY_COLORS = ["#6659e8", "#e6a339", "#5389e8", "#22a780", "#df6672", "#bd69b6", "#38a8b5"];
  const sampleTasks = [
    { id: "sample-1", title: "Complete JavaScript DOM practice", description: "Review event delegation and build a small interactive component.", status: "In Progress", priority: "High", category: "Programming", createdAt: daysAgo(2), dueDate: daysFromNow(0), completed: false },
    { id: "sample-2", title: "Build the TaskFlow dashboard", description: "Polish the overview cards and validate responsive layouts.", status: "To Do", priority: "High", category: "Work", createdAt: daysAgo(1), dueDate: daysFromNow(2), completed: false },
    { id: "sample-3", title: "Review university lecture notes", description: "Summarize the latest lecture and list open questions.", status: "To Do", priority: "Medium", category: "Study", createdAt: daysAgo(3), dueDate: daysFromNow(4), completed: false },
    { id: "sample-4", title: "Finish responsive CSS design", description: "Check tablet and mobile breakpoints before the final review.", status: "Completed", priority: "Medium", category: "Programming", createdAt: daysAgo(5), dueDate: daysAgo(1), completed: true },
    { id: "sample-5", title: "Upload projects to GitHub", description: "Add clear README files and organize repository topics.", status: "To Do", priority: "Low", category: "Personal", createdAt: daysAgo(1), dueDate: daysFromNow(6), completed: false }
  ];

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const els = {
    taskList: $("#task-list"), board: $("#kanban-board"), categoryLinks: $("#category-links"),
    categoryFilter: $("#category-filter"), categoryOptions: $("#category-options"),
    taskDialog: $("#task-dialog"), taskForm: $("#task-form"), detailsDialog: $("#details-dialog"),
    search: $("#search-input"), statusFilter: $("#status-filter"), priorityFilter: $("#priority-filter"),
    sort: $("#sort-select"), dashboardPage: $("#dashboard-page"), settingsPage: $("#settings-page"),
    toastRegion: $("#toast-region")
  };

  let tasks = loadTasks();
  let activeFilter = "all";
  let activeCategory = "";
  let activeNavKey = "dashboard";
  let activePage = "dashboard";
  let preferredView = localStorageValue(VIEW_KEY) === "board" ? "board" : "list";
  let customCategories = loadCustomCategories();
  let draggedTaskId = null;
  let detailsTaskId = null;

  function localStorageValue(key) {
    try { return window.localStorage.getItem(key); }
    catch (error) { console.error(`Unable to read ${key} from local storage.`, error); return null; }
  }

  function localToday(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function daysFromNow(offset) {
    const date = new Date();
    date.setDate(date.getDate() + offset);
    return localToday(date);
  }

  function daysAgo(offset) { return daysFromNow(-offset); }

  function loadTasks() {
    try {
      const saved = window.localStorage.getItem(TASKS_KEY);
      if (saved === null) {
        const initial = sampleTasks.map(task => ({ ...task }));
        window.localStorage.setItem(TASKS_KEY, JSON.stringify(initial));
        return initial;
      }
      const parsed = JSON.parse(saved);
      if (!Array.isArray(parsed) || !parsed.every(isValidTask)) throw new Error("Saved task data has an invalid structure.");
      if (new Set(parsed.map(task => task.id)).size !== parsed.length) throw new Error("Saved task data contains duplicate IDs.");
      return parsed.map(normalizeTask);
    } catch (error) {
      console.error("Task data could not be restored; starting with sample tasks.", error);
      try { window.localStorage.setItem(TASKS_KEY, JSON.stringify(sampleTasks)); }
      catch (storageError) { console.error("Unable to initialize task storage.", storageError); }
      return sampleTasks.map(task => ({ ...task }));
    }
  }

  function isValidTask(task) {
    return task && typeof task === "object" && typeof task.id === "string" && task.id.length > 0 &&
      typeof task.title === "string" && task.title.trim().length > 0 && task.title.length <= 120 &&
      STATUSES.includes(task.status) && PRIORITIES.includes(task.priority) &&
      typeof task.category === "string" && task.category.length <= 40 && isValidDate(task.createdAt) &&
      (task.description === undefined || (typeof task.description === "string" && task.description.length <= 1000)) &&
      (task.completed === undefined || typeof task.completed === "boolean") &&
      (task.dueDate === "" || isValidDate(task.dueDate));
  }

  function isValidDate(value) {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const [year, month, day] = value.split("-").map(Number);
    const date = new Date(year, month - 1, day);
    return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
  }

  function normalizeTask(task) {
    return { ...task, description: typeof task.description === "string" ? task.description : "", completed: task.status === "Completed" };
  }

  function loadCustomCategories() {
    try {
      const stored = window.localStorage.getItem(CATEGORIES_KEY);
      if (stored === null) return [];
      const parsed = JSON.parse(stored);
      if (!Array.isArray(parsed) || !parsed.every(category => typeof category === "string" && category.trim())) throw new Error("Saved categories have an invalid structure.");
      return [...new Set(parsed.map(category => category.trim()))];
    } catch (error) {
      console.error("Saved categories could not be restored.", error);
      return [];
    }
  }

  function saveTasks() {
    try {
      window.localStorage.setItem(TASKS_KEY, JSON.stringify(tasks));
      return true;
    } catch (error) {
      console.error("Unable to save tasks to local storage.", error);
      showToast("Your changes could not be saved in this browser.", true);
      return false;
    }
  }

  function createTask(data) {
    const task = { id: crypto.randomUUID ? crypto.randomUUID() : `task-${Date.now()}-${Math.random().toString(16).slice(2)}`, ...data, createdAt: localToday(), completed: data.status === "Completed" };
    tasks.unshift(task);
    if (!saveTasks()) {
      tasks = tasks.filter(savedTask => savedTask.id !== task.id);
      return null;
    }
    return task;
  }

  function updateTask(id, changes) {
    const task = getTaskById(id);
    if (!task) return null;
    const previous = { ...task };
    Object.assign(task, changes, { completed: changes.status === "Completed" });
    if (!saveTasks()) {
      Object.assign(task, previous);
      return false;
    }
    return task;
  }

  function deleteTask(id) {
    const previous = tasks;
    tasks = tasks.filter(task => task.id !== id);
    if (tasks.length === previous.length) return false;
    if (!saveTasks()) {
      tasks = previous;
      return false;
    }
    return true;
  }

  function getTaskById(id) { return tasks.find(task => task.id === id) || null; }

  function todayTasks() { return tasks.filter(task => task.dueDate === localToday() && task.status !== "Completed"); }
  function upcomingTasks() { return tasks.filter(task => task.dueDate > localToday() && task.status !== "Completed"); }
  function overdueTasks() { return tasks.filter(task => task.dueDate && task.dueDate < localToday() && task.status !== "Completed"); }

  function getVisibleTasks() {
    const query = els.search.value.trim().toLowerCase();
    let result = tasks.filter(task => {
      if (activeFilter === "today" && !(task.dueDate === localToday() && task.status !== "Completed")) return false;
      if (activeFilter === "upcoming" && !(task.dueDate > localToday() && task.status !== "Completed")) return false;
      if (activeFilter === "important" && task.priority !== "High") return false;
      if (activeFilter === "completed" && task.status !== "Completed") return false;
      if (activeFilter === "overdue" && !(task.dueDate && task.dueDate < localToday() && task.status !== "Completed")) return false;
      if (activeFilter === "status" && task.status !== activeCategory) return false;
      if (activeFilter === "category" && task.category !== activeCategory) return false;
      if (els.statusFilter.value !== "all" && task.status !== els.statusFilter.value) return false;
      if (els.priorityFilter.value !== "all" && task.priority !== els.priorityFilter.value) return false;
      if (els.categoryFilter.value !== "all" && task.category !== els.categoryFilter.value) return false;
      return !query || [task.title, task.description, task.category]
        .some(value => String(value || "").toLowerCase().includes(query));
    });
    const priorityRank = { High: 0, Medium: 1, Low: 2 };
    result = [...result].sort((first, second) => {
      if (els.sort.value === "priority") return priorityRank[first.priority] - priorityRank[second.priority];
      if (els.sort.value === "created") return second.createdAt.localeCompare(first.createdAt);
      if (els.sort.value === "alphabetical") return first.title.localeCompare(second.title);
      return (first.dueDate || "9999-12-31").localeCompare(second.dueDate || "9999-12-31");
    });
    return result;
  }

  function formatDate(dateString, options = { month: "short", day: "numeric" }) {
    if (!dateString) return "No due date";
    const [year, month, day] = dateString.split("-").map(Number);
    return new Intl.DateTimeFormat(undefined, options).format(new Date(year, month - 1, day));
  }

  function categoryNames() {
    return [...new Set([...DEFAULT_CATEGORIES, ...customCategories, ...tasks.map(task => task.category.trim()).filter(Boolean)])].sort((a, b) => a.localeCompare(b));
  }

  function renderCategories() {
    const categories = categoryNames();
    els.categoryLinks.replaceChildren();
    els.categoryFilter.replaceChildren(new Option("All categories", "all"));
    els.categoryOptions.replaceChildren();
    categories.forEach((category, index) => {
      const count = tasks.filter(task => task.category === category).length;
      const button = document.createElement("button");
      button.type = "button";
      button.className = `nav-link category-link${activeFilter === "category" && activeCategory === category ? " active" : ""}`;
      button.dataset.category = category;
      const dot = document.createElement("span");
      dot.className = "category-dot";
      dot.style.setProperty("--category-color", CATEGORY_COLORS[index % CATEGORY_COLORS.length]);
      const name = document.createElement("span");
      name.textContent = category;
      const number = document.createElement("span");
      number.className = "nav-count";
      number.textContent = count;
      button.append(dot, name, number);
      els.categoryLinks.append(button);
      els.categoryFilter.add(new Option(category, category));
      els.categoryOptions.append(new Option(category, category));
    });
  }

  function renderStats() {
    $("#stat-total").textContent = tasks.length;
    $("#stat-progress").textContent = tasks.filter(task => task.status === "In Progress").length;
    $("#stat-completed").textContent = tasks.filter(task => task.status === "Completed").length;
    $("#stat-overdue").textContent = overdueTasks().length;
    $("#my-task-count").textContent = tasks.filter(task => task.status !== "Completed").length;
    $("#settings-task-count").textContent = tasks.length;
    $("#settings-category-count").textContent = new Set(tasks.map(task => task.category).filter(Boolean)).size;
    const completeCount = tasks.filter(task => task.status === "Completed").length;
    const percentage = tasks.length ? Math.round(completeCount / tasks.length * 100) : 0;
    const analytics = $("#analytics-content");
    analytics.replaceChildren();
    if (!tasks.length) {
      analytics.innerHTML = '<p class="analytics-empty">Add a task to see your productivity progress.</p>';
    } else {
      const ring = document.createElement("div");
      ring.className = "progress-ring";
      ring.style.setProperty("--progress", `${percentage}%`);
      const ringValue = document.createElement("strong");
      ringValue.textContent = `${percentage}%`;
      ring.append(ringValue);
      const copy = document.createElement("div");
      copy.className = "progress-copy";
      const title = document.createElement("strong");
      title.textContent = `${completeCount} of ${tasks.length} tasks completed`;
      const description = document.createElement("p");
      description.textContent = `${tasks.length - completeCount} tasks left to complete`;
      const meter = document.createElement("div");
      meter.className = "mini-progress";
      const meterFill = document.createElement("span");
      meterFill.style.width = `${percentage}%`;
      meter.append(meterFill);
      copy.append(title, description, meter);
      analytics.append(ring, copy);
    }
    const priorityContent = $("#priority-content");
    priorityContent.replaceChildren();
    if (!tasks.length) {
      priorityContent.innerHTML = '<p class="analytics-empty">Priority insights will appear when you add tasks.</p>';
    } else {
      PRIORITIES.slice().reverse().forEach(priority => {
        const count = tasks.filter(task => task.priority === priority).length;
        const row = document.createElement("div");
        row.className = "priority-row";
        const label = document.createElement("span");
        label.textContent = priority;
        const meter = document.createElement("div");
        meter.className = "priority-meter";
        const fill = document.createElement("span");
        fill.className = `priority-${priority.toLowerCase()}`;
        fill.style.width = `${tasks.length ? count / tasks.length * 100 : 0}%`;
        meter.append(fill);
        const number = document.createElement("span");
        number.className = "priority-number";
        number.textContent = count;
        row.append(label, meter, number);
        priorityContent.append(row);
      });
    }
  }

  function renderTaskWorkspace() {
    const visible = getVisibleTasks();
    $("#view-title").textContent = activeFilter === "category" ? activeCategory : filterTitles[activeFilter] || (activeFilter === "status" ? activeCategory : "My tasks");
    $("#view-description").textContent = activeFilter === "today" ? "Tasks due today, all in one place." : activeFilter === "overdue" ? "These tasks are past their due date." : activeFilter === "category" ? `Tasks filed under ${activeCategory}.` : "Keep your day moving forward.";
    $("#breadcrumb-current").textContent = activePage === "settings" ? "Settings" :
      activeNavKey === "dashboard" ? "Dashboard" :
      activeNavKey === "mytasks" ? "My Tasks" : $("#view-title").textContent;
    const isBoard = preferredView === "board";
    els.taskList.hidden = isBoard;
    els.board.hidden = !isBoard;
    $$(".view-option").forEach(button => {
      const active = button.dataset.view === preferredView;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    });
    renderTaskList(visible);
    renderBoard(visible);
  }

  const filterTitles = { all: "My tasks", today: "Today", upcoming: "Upcoming", important: "Important", completed: "Completed", overdue: "Overdue" };

  function createEmptyState() {
    const state = document.createElement("div");
    state.className = "empty-state";
    const image = document.createElement("div");
    image.className = "empty-illustration";
    image.textContent = "✦";
    const title = document.createElement("h3");
    title.textContent = tasks.length ? "No tasks match these filters" : "Your workspace is clear";
    const message = document.createElement("p");
    message.textContent = tasks.length ? "Try adjusting your search or filters." : "Create a task to get your plans moving.";
    state.append(image, title, message);
    if (!tasks.length) {
      const button = document.createElement("button");
      button.className = "primary-button";
      button.type = "button";
      button.dataset.action = "new";
      button.textContent = "Create your first task";
      state.append(button);
    }
    return state;
  }

  function renderTaskList(visible) {
    els.taskList.replaceChildren();
    if (!visible.length) {
      els.taskList.append(createEmptyState());
      return;
    }
    visible.forEach(task => {
      const row = document.createElement("article");
      row.className = "task-row";
      row.dataset.id = task.id;
      const check = document.createElement("button");
      check.type = "button";
      check.className = `task-check${task.status === "Completed" ? " is-complete" : ""}`;
      check.dataset.action = "toggle";
      check.setAttribute("aria-label", task.status === "Completed" ? `Reopen ${task.title}` : `Complete ${task.title}`);
      check.textContent = task.status === "Completed" ? "✓" : "";
      const main = document.createElement("div");
      main.className = "task-main";
      main.dataset.action = "details";
      const title = document.createElement("span");
      title.className = `task-title${task.status === "Completed" ? " completed-title" : ""}`;
      title.textContent = task.title;
      main.append(title);
      if (task.description) {
        const description = document.createElement("span");
        description.className = "task-description-preview";
        description.textContent = task.description;
        main.append(description);
      }
      const status = document.createElement("span");
      status.className = `task-status ${statusClass(task.status)}`;
      status.textContent = task.status;
      const priority = document.createElement("span");
      priority.className = `priority-badge priority-${task.priority.toLowerCase()}-badge`;
      priority.textContent = task.priority;
      const category = document.createElement("span");
      category.className = "category-badge";
      category.textContent = task.category || "Uncategorized";
      const due = document.createElement("span");
      due.className = `task-due${task.dueDate && task.dueDate < localToday() && task.status !== "Completed" ? " overdue" : ""}${task.dueDate === localToday() ? " today-due" : ""}`;
      due.textContent = task.dueDate ? formatDate(task.dueDate) : "No date";
      const actions = createActions();
      row.append(check, main, status, priority, category, due, actions);
      els.taskList.append(row);
    });
  }

  function statusClass(status) {
    return status === "Completed" ? "status-completed" : status === "In Progress" ? "status-progress" : "status-todo";
  }

  function createActions() {
    const actions = document.createElement("div");
    actions.className = "row-actions";
    const edit = document.createElement("button");
    edit.className = "row-action";
    edit.type = "button";
    edit.dataset.action = "edit";
    edit.setAttribute("aria-label", "Edit task");
    edit.title = "Edit";
    edit.textContent = "✎";
    const remove = document.createElement("button");
    remove.className = "row-action delete";
    remove.type = "button";
    remove.dataset.action = "delete";
    remove.setAttribute("aria-label", "Delete task");
    remove.title = "Delete";
    remove.textContent = "×";
    actions.append(edit, remove);
    return actions;
  }

  function renderBoard(visible) {
    els.board.replaceChildren();
    if (!visible.length) {
      els.board.append(createEmptyState());
      return;
    }
    STATUSES.forEach(status => {
      const column = document.createElement("section");
      column.className = `kanban-column ${status === "To Do" ? "column-todo" : status === "In Progress" ? "column-progress" : "column-completed"}`;
      column.dataset.status = status;
      const columnTasks = visible.filter(task => task.status === status);
      const heading = document.createElement("div");
      heading.className = "column-heading";
      const dot = document.createElement("span");
      dot.className = "column-dot";
      const name = document.createElement("span");
      name.textContent = status;
      const count = document.createElement("span");
      count.className = "column-count";
      count.textContent = columnTasks.length;
      heading.append(dot, name, count);
      const cardList = document.createElement("div");
      cardList.className = "kanban-cards";
      cardList.dataset.status = status;
      if (!columnTasks.length) {
        const empty = document.createElement("div");
        empty.className = "empty-state";
        empty.style.padding = "19px 5px";
        const message = document.createElement("p");
        message.textContent = "Nothing here yet";
        empty.append(message);
        cardList.append(empty);
      }
      columnTasks.forEach(task => cardList.append(createKanbanCard(task)));
      column.append(heading, cardList);
      els.board.append(column);
    });
  }

  function createKanbanCard(task) {
    const card = document.createElement("article");
    card.className = "kanban-card";
    card.draggable = true;
    card.dataset.id = task.id;
    card.tabIndex = 0;
    card.setAttribute("aria-label", `${task.title}, ${task.status}. Use the task actions to edit or delete.`);
    const title = document.createElement("h3");
    title.textContent = task.title;
    card.append(title);
    if (task.description) {
      const description = document.createElement("p");
      description.textContent = task.description;
      card.append(description);
    }
    const badges = document.createElement("div");
    badges.className = "kanban-badges";
    const priority = document.createElement("span");
    priority.className = `priority-badge priority-${task.priority.toLowerCase()}-badge`;
    priority.textContent = task.priority;
    badges.append(priority);
    if (task.category) {
      const category = document.createElement("span");
      category.className = "category-badge";
      category.textContent = task.category;
      badges.append(category);
    }
    card.append(badges);
    if (task.dueDate) {
      const due = document.createElement("div");
      due.className = "kanban-due";
      due.textContent = `Due ${formatDate(task.dueDate)}`;
      card.append(due);
    }
    const actions = document.createElement("div");
    actions.className = "kanban-actions";
    const edit = document.createElement("button");
    edit.className = "row-action";
    edit.type = "button";
    edit.dataset.action = "edit";
    edit.setAttribute("aria-label", "Edit task");
    edit.textContent = "✎";
    const remove = document.createElement("button");
    remove.className = "row-action delete";
    remove.type = "button";
    remove.dataset.action = "delete";
    remove.setAttribute("aria-label", "Delete task");
    remove.textContent = "×";
    actions.append(edit, remove);
    card.append(actions);
    return card;
  }

  function renderAll() {
    renderCategories();
    renderStats();
    renderTaskWorkspace();
    $("#settings-theme").value = document.body.dataset.theme || "light";
    $("#settings-view").value = preferredView;
  }

  function openTaskDialog(task = null) {
    els.taskForm.reset();
    $("#task-id").value = task ? task.id : "";
    $("#task-title").value = task ? task.title : "";
    $("#task-description").value = task ? task.description : "";
    $("#task-priority").value = task ? task.priority : "Medium";
    $("#task-status").value = task ? task.status : "To Do";
    $("#task-category").value = task ? task.category : "";
    $("#task-due").value = task ? task.dueDate : "";
    $("#task-dialog-title").textContent = task ? "Edit task" : "Create a task";
    $("#save-task-button").textContent = task ? "Save changes" : "Create task";
    $("#title-error").textContent = "";
    $("#form-error").textContent = "";
    els.taskDialog.showModal();
    $("#task-title").focus();
  }

  function handleTaskSubmit(event) {
    event.preventDefault();
    const title = $("#task-title").value.trim();
    $("#title-error").textContent = title ? "" : "Please enter a task title.";
    $("#form-error").textContent = "";
    if (!title) { $("#task-title").focus(); return; }
    const dueDate = $("#task-due").value;
    if (dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
      $("#form-error").textContent = "Please choose a valid due date.";
      return;
    }
    const id = $("#task-id").value;
    const data = {
      title,
      description: $("#task-description").value.trim(),
      priority: $("#task-priority").value,
      status: $("#task-status").value,
      category: $("#task-category").value.trim() || "Personal",
      dueDate
    };
    if (id) {
      const updated = updateTask(id, data);
      if (!updated) {
        $("#form-error").textContent = getTaskById(id) ? "Your changes could not be saved. Please try again." : "This task is no longer available. Close the form and try again.";
        return;
      }
      showToast("Task updated successfully.");
    } else {
      if (!createTask(data)) return;
      showToast("Task created successfully.");
    }
    els.taskDialog.close();
    renderAll();
  }

  function toggleTask(task) {
    const newStatus = task.status === "Completed" ? "To Do" : "Completed";
    if (!updateTask(task.id, { ...task, status: newStatus })) return;
    showToast(newStatus === "Completed" ? "Task marked as completed." : "Task reopened.");
    renderAll();
  }

  function confirmDelete(task) {
    if (!window.confirm(`Delete "${task.title}"? This cannot be undone.`)) return;
    if (!deleteTask(task.id)) return;
    showToast("Task deleted successfully.");
    renderAll();
  }

  function showTaskDetails(task) {
    detailsTaskId = task.id;
    $("#details-title").textContent = task.title;
    $("#details-description").textContent = task.description || "No description provided.";
    const meta = $("#details-meta");
    meta.replaceChildren();
    [
      ["Priority", task.priority],
      ["Status", task.status],
      ["Category", task.category || "Uncategorized"],
      ["Created", formatDate(task.createdAt, { year: "numeric", month: "short", day: "numeric" })],
      ["Due date", task.dueDate ? formatDate(task.dueDate, { year: "numeric", month: "short", day: "numeric" }) : "No due date"]
    ].forEach(([label, value]) => {
      const item = document.createElement("div");
      item.className = "meta-item";
      const key = document.createElement("span");
      key.textContent = label;
      const text = document.createElement("strong");
      text.textContent = value;
      item.append(key, text);
      meta.append(item);
    });
    els.detailsDialog.showModal();
  }

  function showToast(message, isError = false) {
    const toast = document.createElement("div");
    toast.className = `toast${isError ? " error" : ""}`;
    toast.setAttribute("role", isError ? "alert" : "status");
    toast.textContent = message;
    els.toastRegion.append(toast);
    window.setTimeout(() => toast.remove(), 3400);
  }

  function setTheme(theme, persist = true) {
    document.body.dataset.theme = theme;
    $("#theme-toggle").setAttribute("aria-label", theme === "dark" ? "Switch to light mode" : "Switch to dark mode");
    $("#theme-toggle").textContent = theme === "dark" ? "☼" : "◐";
    if (persist) {
      try { localStorage.setItem(THEME_KEY, theme); }
      catch (error) { console.error("Unable to save theme preference.", error); showToast("Theme preference could not be saved.", true); }
    }
  }

  function setPage(page) {
    activePage = page;
    els.dashboardPage.hidden = page !== "dashboard";
    els.settingsPage.hidden = page !== "settings";
    $("#breadcrumb-current").textContent = page === "settings" ? "Settings" : $("#view-title").textContent;
    $$(".settings-link").forEach(link => link.classList.toggle("active", page === "settings"));
    closeMobileSidebar();
  }

  function setFilter(filter, category = "", navKey = filter === "all" ? "dashboard" : filter) {
    activeFilter = filter;
    activeCategory = category;
    activeNavKey = category ? "" : navKey;
    activePage = "dashboard";
    setPage("dashboard");
    renderCategories();
    renderTaskWorkspace();
    $$(".nav-link[data-filter]").forEach(button => button.classList.toggle("active", button.dataset.navKey === activeNavKey || (!button.dataset.navKey && button.dataset.filter === filter && !category)));
    $$(".category-link").forEach(button => button.classList.toggle("active", button.dataset.category === category));
  }

  function closeMobileSidebar() {
    $("#sidebar").classList.remove("mobile-open");
    $("#mobile-scrim").classList.remove("visible");
  }

  function addCategory() {
    const category = window.prompt("Name your new category:");
    if (category === null) return;
    const name = category.trim();
    if (!name) { showToast("Category name cannot be empty.", true); return; }
    if (name.length > 40) { showToast("Category names must be 40 characters or fewer.", true); return; }
    if (!categoryNames().some(existing => existing.toLocaleLowerCase() === name.toLocaleLowerCase())) {
      customCategories.push(name);
      try { localStorage.setItem(CATEGORIES_KEY, JSON.stringify(customCategories)); }
      catch (error) {
        customCategories = customCategories.filter(category => category !== name);
        console.error("Unable to save category.", error);
        showToast("The new category could not be saved.", true);
        return;
      }
      showToast(`${name} category added.`);
      renderAll();
      setFilter("category", name);
    } else {
      setFilter("category", categoryNames().find(existing => existing.toLocaleLowerCase() === name.toLocaleLowerCase()));
    }
  }

  function exportTasks() {
    const blob = new Blob([JSON.stringify(tasks, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `taskflow-tasks-${localToday()}.json`;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast("Tasks exported to JSON.");
  }

  function validateImportedTasks(value) {
    if (!Array.isArray(value)) throw new Error("The JSON file must contain an array of tasks.");
    const ids = new Set();
    return value.map((task, index) => {
      if (!isValidTask(task)) throw new Error(`Task ${index + 1} is missing required fields or has invalid values.`);
      if (ids.has(task.id)) throw new Error(`Task ${index + 1} has a duplicate ID.`);
      ids.add(task.id);
      if (task.description !== undefined && typeof task.description !== "string") throw new Error(`Task ${index + 1} has an invalid description.`);
      if (task.dueDate && !isValidDate(task.dueDate)) throw new Error(`Task ${index + 1} has an invalid due date.`);
      return normalizeTask({ ...task, description: task.description || "" });
    });
  }

  async function importTasks(file) {
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      const imported = validateImportedTasks(parsed);
      if (!window.confirm(`Replace your ${tasks.length} current task${tasks.length === 1 ? "" : "s"} with ${imported.length} imported task${imported.length === 1 ? "" : "s"}? This cannot be undone.`)) return;
      const previous = tasks;
      tasks = imported;
      if (!saveTasks()) { tasks = previous; return; }
      showToast(`${imported.length} tasks imported successfully.`);
      renderAll();
    } catch (error) {
      console.error("Unable to import tasks.", error);
      showToast(error instanceof SyntaxError ? "That file is not valid JSON." : error.message || "Unable to import this file.", true);
    } finally {
      $("#import-file").value = "";
    }
  }

  function handleTaskAction(event) {
    const control = event.target.closest("[data-action]");
    if (!control) return;
    const action = control.dataset.action;
    if (action === "new") { openTaskDialog(); return; }
    const taskElement = control.closest("[data-id]");
    if (!taskElement) return;
    const task = getTaskById(taskElement.dataset.id);
    if (!task) return;
    if (action === "toggle") toggleTask(task);
    if (action === "edit") openTaskDialog(task);
    if (action === "delete") confirmDelete(task);
    if (action === "details") showTaskDetails(task);
  }

  function bindEvents() {
    els.taskForm.addEventListener("submit", handleTaskSubmit);
    $("#add-task-sidebar").addEventListener("click", () => openTaskDialog());
    $("#add-task-top").addEventListener("click", () => openTaskDialog());
    $("#add-task-heading").addEventListener("click", () => openTaskDialog());
    $("#add-category").addEventListener("click", addCategory);
    els.taskList.addEventListener("click", handleTaskAction);
    els.board.addEventListener("click", handleTaskAction);
    $("#details-edit").addEventListener("click", () => {
      const task = getTaskById(detailsTaskId);
      if (!task) return;
      els.detailsDialog.close();
      openTaskDialog(task);
    });
    $$("[data-close-dialog]").forEach(button => button.addEventListener("click", () => button.closest("dialog").close()));
    [els.taskDialog, els.detailsDialog].forEach(dialog => dialog.addEventListener("click", event => {
      if (event.target === dialog) dialog.close();
    }));
    $$(".nav-link[data-filter]").forEach(button => button.addEventListener("click", () => setFilter(button.dataset.filter, "", button.dataset.navKey)));
    els.categoryLinks.addEventListener("click", event => {
      const button = event.target.closest("[data-category]");
      if (button) setFilter("category", button.dataset.category);
    });
    $$(".settings-link").forEach(button => button.addEventListener("click", () => setPage("settings")));
    $$(".view-option").forEach(button => button.addEventListener("click", () => {
      preferredView = button.dataset.view;
      try { localStorage.setItem(VIEW_KEY, preferredView); }
      catch (error) { console.error("Unable to save task view preference.", error); showToast("View preference could not be saved.", true); }
      renderTaskWorkspace();
    }));
    [els.statusFilter, els.priorityFilter, els.categoryFilter, els.sort].forEach(control => control.addEventListener("change", renderTaskWorkspace));
    els.search.addEventListener("input", renderTaskWorkspace);
    $("#theme-toggle").addEventListener("click", () => setTheme(document.body.dataset.theme === "dark" ? "light" : "dark"));
    $("#settings-theme").addEventListener("change", event => setTheme(event.target.value));
    $("#settings-view").addEventListener("change", event => {
      preferredView = event.target.value;
      try { localStorage.setItem(VIEW_KEY, preferredView); }
      catch (error) { console.error("Unable to save task view preference.", error); showToast("View preference could not be saved.", true); }
      renderTaskWorkspace();
    });
    $("#export-tasks").addEventListener("click", exportTasks);
    $("#import-trigger").addEventListener("click", () => $("#import-file").click());
    $("#import-file").addEventListener("change", event => importTasks(event.target.files[0]));
    $("#clear-tasks").addEventListener("click", () => {
      if (!tasks.length || !window.confirm("Permanently delete all tasks? This cannot be undone.")) return;
      const previous = tasks;
      tasks = [];
      if (!saveTasks()) { tasks = previous; return; }
      showToast("All tasks cleared.");
      renderAll();
    });
    $("#open-sidebar").addEventListener("click", () => {
      $("#sidebar").classList.add("mobile-open");
      $("#mobile-scrim").classList.add("visible");
    });
    $("#close-sidebar").addEventListener("click", closeMobileSidebar);
    $("#mobile-scrim").addEventListener("click", closeMobileSidebar);
    $(".brand").addEventListener("click", event => {
      event.preventDefault();
      setFilter("all", "", "dashboard");
    });
    $("#collapse-sidebar").addEventListener("click", () => {
      document.body.classList.toggle("sidebar-collapsed");
      const collapsed = document.body.classList.contains("sidebar-collapsed");
      $("#collapse-sidebar").setAttribute("aria-label", collapsed ? "Expand sidebar" : "Collapse sidebar");
      $("#collapse-sidebar").title = collapsed ? "Expand sidebar" : "Collapse sidebar";
      $("#collapse-sidebar").textContent = collapsed ? "›" : "‹";
      try { localStorage.setItem("taskflow.sidebar-collapsed", String(collapsed)); }
      catch (error) { console.error("Unable to save sidebar preference.", error); showToast("Sidebar preference could not be saved.", true); }
    });
    $("#notification-button").addEventListener("click", () => {
      const overdueCount = overdueTasks().length;
      showToast(overdueCount ? `You have ${overdueCount} overdue task${overdueCount === 1 ? "" : "s"} to review.` : "You're all caught up. No new notifications.");
    });
    $("#theme-toggle").addEventListener("keydown", event => { if (event.key === "Enter") event.currentTarget.click(); });
    document.addEventListener("keydown", event => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        els.search.focus();
      }
      if (event.key.toLowerCase() === "n" && !event.ctrlKey && !event.metaKey && !["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement.tagName) && !els.taskDialog.open && !els.detailsDialog.open) openTaskDialog();
    });
    els.board.addEventListener("dragstart", event => {
      const card = event.target.closest(".kanban-card");
      if (!card || event.target.closest("[data-action]")) return;
      draggedTaskId = card.dataset.id;
      card.classList.add("dragging");
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", draggedTaskId);
      event.dataTransfer.setData("application/x-taskflow-task-id", draggedTaskId);
    });
    els.board.addEventListener("dragend", event => {
      const card = event.target.closest(".kanban-card");
      if (card) card.classList.remove("dragging");
      draggedTaskId = null;
      $$(".kanban-column").forEach(column => column.classList.remove("drag-over"));
    });
    els.board.addEventListener("dragenter", event => {
      const column = event.target.closest(".kanban-column");
      if (!column || !draggedTaskId) return;
      event.preventDefault();
      column.classList.add("drag-over");
    });
    els.board.addEventListener("dragover", event => {
      const column = event.target.closest(".kanban-column");
      if (!column || !draggedTaskId || !STATUSES.includes(column.dataset.status)) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      column.classList.add("drag-over");
    });
    els.board.addEventListener("dragleave", event => {
      const column = event.target.closest(".kanban-column");
      if (column && !column.contains(event.relatedTarget)) column.classList.remove("drag-over");
    });
    els.board.addEventListener("drop", event => {
      const column = event.target.closest(".kanban-column");
      if (!column || !STATUSES.includes(column.dataset.status)) return;
      event.preventDefault();
      const taskId = draggedTaskId ||
        event.dataTransfer.getData("application/x-taskflow-task-id") ||
        event.dataTransfer.getData("text/plain");
      try {
        const task = getTaskById(taskId);
        if (task && task.status !== column.dataset.status) {
          if (updateTask(task.id, { ...task, status: column.dataset.status })) {
            showToast(`Task moved to ${column.dataset.status}.`);
            renderAll();
          }
        }
      } finally {
        draggedTaskId = null;
        $$(".kanban-column").forEach(item => item.classList.remove("drag-over"));
      }
    });
  }

  function initialize() {
    const savedTheme = localStorageValue(THEME_KEY);
    setTheme(savedTheme === "dark" ? "dark" : "light", false);
    if (localStorageValue("taskflow.sidebar-collapsed") === "true") {
      document.body.classList.add("sidebar-collapsed");
      $("#collapse-sidebar").setAttribute("aria-label", "Expand sidebar");
      $("#collapse-sidebar").title = "Expand sidebar";
      $("#collapse-sidebar").textContent = "›";
    }
    $("#current-date").textContent = new Intl.DateTimeFormat(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" }).format(new Date()).toUpperCase();
    const hour = new Date().getHours();
    $("#greeting").firstChild.textContent = `Good ${hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening"}, Alex `;
    bindEvents();
    renderAll();
  }

  initialize();
})();
