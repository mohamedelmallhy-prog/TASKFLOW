# TaskFlow

TaskFlow is a responsive, browser-only task management dashboard built with HTML, CSS, and vanilla JavaScript.

## Run locally

Open `index.html` with VS Code Live Server, or start any static file server from this folder, for example:

```powershell
python -m http.server 8000
```

Then visit `http://localhost:8000`.

## Features

- Create, edit, inspect, complete, reopen, and delete tasks
- List and draggable Kanban board views
- Search, status/priority/category filters, and sorting
- Dashboard statistics and data-driven productivity indicators
- Light/dark themes, responsive navigation, and keyboard shortcuts (`N`, `Ctrl/Cmd + K`)
- JSON import/export, with validation and confirmation before replacing or clearing data
- LocalStorage persistence; first launch creates a small editable sample collection

Task and preference data stays in the current browser profile. Clearing browser site data removes it.
