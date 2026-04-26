# Dayflow

Dayflow is a minimalist, personal life tracker that gives you a quiet space to record your daily rituals, log your ideas, and maintain a private journal. It is intentionally simple, distraction-free, and requires zero servers.

Instead of storing your personal data in a black-box cloud, Dayflow stores everything as standard JSON files directly in a private GitHub repository of your choice.

## Philosophy

* **Calm & Quiet**: No notifications, no overwhelming analytics dashboards, and no ads. Just essential tracking features.
* **Serverless Architecture**: Dayflow operates purely on client-side Vanilla JavaScript. It uses the GitHub REST API to read and write your data.
* **Private & Owned**: You own your data. Every habit tracked, every idea logged, and every journal typed is safely pushed directly to a private GitHub repository you control.

## Features

Dayflow is split into three core modules:

1. 📅 **Habits**: Daily habit tracking. Define your rituals, simply check them off for the day, and let them persist.
2. 💡 **Ideas**: A quick-capture inbox for tasks and sparks of inspiration. Categorize them into Idea, In Progress, or Completed.
3. 🧾 **Journal**: A clean, unstructured textarea dedicated for daily thoughts and reflection, archived seamlessly by month and year.

## Getting Started

1. **Create a Data Repository**
   Create a new **private** repository on GitHub (e.g., `dayflow-data`). This is where all your tracking files will be saved.

2. **Generate a GitHub Personal Access Token (PAT)**
   Go to [GitHub Developer Settings](https://github.com/settings/tokens/new) and generate a new classic Token. Give it the `repo` scope so it has permission to read and write to your private repositories.

3. **Open Dayflow**
   Serve the target folder via a simple local HTTP server (such as Live Server or Python's HTTP module). Navigate to the `index.html` page.

4. **Connect**
   A prompt will ask you for your configuration details (Token, Username, Repository). It securely saves this locally to your browser's LocalStorage and handles the rest!

## Directory Structure

Under the hood, all inputs are saved cleanly formatted in your GitHub repository following this pattern:

```text
├── data/
│   ├── ideas.json                   # List of your ideas and ongoing projects
│   ├── habits/
│   │   ├── config.json              # Schema logic holding active habits
│   │   ├── 2026/                    # Year
│   │   │   └── 04.json              # Monthly tracking mapping dates to completed habits 
│   ├── journal/
│   │   ├── 2026/                    # Year
│   │   │   └── 04.json              # Unstructured daily text entries mapped to dates
```

## Tech Stack

* **HTML/CSS**: semantic structure with modern CSS features (CSS custom properties, specific Flexbox/Grid usage, smooth system light/dark theme transition).
* **Vanilla ES6+ JavaScript**: Lightweight custom implementations for DOM reactivity without any bulky runtime.
* **GitHub Repository API**: Uses `fetch` APIs coupled with asynchronous queue control (`Promise` chaining) to stop duplicate payload overwrites and race conditions.

---

*Enjoy your daily calm.*
