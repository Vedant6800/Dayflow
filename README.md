<div align="center">
  <img alt="Dayflow Logo" src="logos/logo2-removebg-preview.png" width="120" height="120">
  <h1 align="center">Dayflow</h1>
  <p align="center">
    <strong>A calm, minimalist life tracker completely powered by the GitHub REST API.</strong>
  </p>
  <p align="center">
    <img alt="Vanilla JS" src="https://img.shields.io/badge/Vanilla%20JS-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black" />
    <img alt="CSS3" src="https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css3&logoColor=white" />
    <img alt="GitHub API Backend" src="https://img.shields.io/badge/GitHub_API-Backend-181717?style=for-the-badge&logo=github&logoColor=white" />
    <img alt="License MIT" src="https://img.shields.io/badge/License-MIT-blue?style=for-the-badge" />
  </p>
</div>

<br />

## 📖 Overview

**Dayflow** is an intention-driven, lightweight personal tracking application designed for focus. Most life trackers are plagued by feature bloat, heavy analytics, and gamification, locking your private data into proprietary clouds. 

Dayflow flips the paradigm. It acts as a beautiful, strictly client-side frontend that bridges directly to your private GitHub repository via securely authenticated REST API calls. Your data is stored elegantly as JSON, ensuring **100% data ownership**, infinite history retention, and complete privacy.

---

## ✨ Core Modules

Dayflow is intentionally constrained to four highly-curated modules to foster mindfulness and organization.

### 📅 Habits Tracker: The Dashboard
A lightning-fast checklist natively tracking daily rituals through an advanced configuration engine. 
- **Smart Completion**: Mark habits complete with rewarding visual feedback spanning dynamically built monthly histories.
- **Layered Dashboard**: Access a lightweight overview of your overall completion rates and current daily streaks, elegantly structured alongside an interactive "Habit Explorer".
- **Detailed Analytics**: Use the Explorer to natively pull up an all-time consistency percentage and full chronological archive of individual `✔` or `✖` days for any habit (active or deleted).
- **True Archiving (Soft Deletion)**: Removing a habit organically sweeps it off the active UI while preserving its exact historical logs indefinitely across old months.
- **Time-Aware Behavior**: Newly added rituals behave intelligently—meaning they'll rarely populate as failures in history prior to their creation date.

### 💡 Ideas Logger: The Inbox
A clean, card-based Kanban-lite capture system for sparks of inspiration. 
- **Frictionless Capture**: Add ideas as fast as you can type them.
- **State Organization**: Organizes entries instantly into **Idea**, **In Progress**, or **Completed** statuses without convoluted column drag-and-drops. 
- **Sleek Interface**: Utilizes robust CSS-grid structures so you never lose track of a fleeting thought.

### 🧾 Daily Journal: The Unstructured Canvas
A quiet, distraction-free environment purely dedicated to daily brain dumps.
- **Zero Constraints**: Just sit, select your date, and type. No complex rich-text editors.
- **Explicit Saving**: Deliberate, manual action ensures your private entries are committed to GitHub exactly when you finalize your thoughts.
- **Monthly Navigation**: Navigate through a calm, chronological archive of previous days and months seamlessly mapped to GitHub.

### ✅ Tasks: Date-Based Task Management
A feature-rich, action-oriented space for planning and tracking tasks for any given day.
- **Date Navigation**: Seamlessly plan for today, past dates, or any future date without restrictions.
- **Priority Grouping**: Tasks are visually sorted by priority (High, Medium, Low) for quick assessment.
- **Manual Save Workflow**: Accumulate changes in memory and explicitly save only the affected months to GitHub, preventing accidental overwrites.
- **Upcoming View**: Scan the next 30 days to see all planned tasks grouped elegantly by date.
- **Inline Editing & Moving**: Quickly edit task text, adjust priority, or shift a task to an entirely different date.

---

## 🛠️ System Architecture & Data Schema

Dayflow inherently requires zero custom servers. The architectural philosophy relies on reading, caching, and writing directly to `fetch` endpoints wrapped within an in-memory execution queue to avoid remote race conditions.

<details>
<summary><b>Click to expand the precise Repository File Structure</b></summary>

```text
📁 /dayflow-repository
 ├── 📁 data          
 │    ├── 📄 ideas.json               # Aggregated array of idea models
 │    │
 │    ├── 📁 habits      
 │    │    ├── 📄 config.json         # Array of { id, name, createdAt, isActive, deletedAt }
 │    │    └── 📁 YYYY     
 │    │         └── 📄 MM.json        # Maps exact YYYY-MM-DD -> Array of Completed Habit ID strings
 │    │
 │    ├── 📁 journal   
 │         └── 📁 YYYY    
 │              └── 📄 MM.json        # Maps exact YYYY-MM-DD -> Array of freeform Journal strings
 │
 │    └── 📁 todos
 │         └── 📁 YYYY
 │              └── 📄 MM.json        # Maps exact YYYY-MM-DD -> Array of Task objects
```

</details>

---

## 🚀 Getting Started Guide

Deploying Dayflow takes roughly 2 minutes and requires zero command-line expertise.

### 1. Initialize Your Data Repository
You must have a **private** repository specifically named `Dayflow` explicitly created on your GitHub account (`Vedant6800`). This isolated environment is where all structured JSON payloads will be securely pushed.

### 2. Configure Authentication Token
You must instruct Dayflow how to securely authenticate with GitHub API as you. 
1. Go to [GitHub Developer Settings](https://github.com/settings/tokens/new)
2. Generate a Personal Access Token (PAT).
    * **Standard Choice (Classic Token)**: Tick the `repo` scope. 
    * **Secure Choice (Fine-Grained)**: Explicitly target the `Dayflow` repository and assign **Read and write** permissions uniquely to **Contents**.

### 3. Serve the Application
Because Dayflow is pure JavaScript/CSS/HTML, there is no build step! 
Serve the folder on a local localhost port (`127.0.0.1:5500`) using Live Server in VSCode or `python -m http.server`.

### 4. Direct Connect
Enter `index.html` in your browser. A browser-native prompt will instantly intercept you. Paste your generated GitHub token here. 
> *Dayflow will natively test the token with GitHub behind the scenes, and upon returning a verified `200 OK`, securely lock it into the browser's persistent `localStorage` cache.*

---

## 🎨 Design Philosophy

We believe productivity systems fail when they become cluttered task-masters. Dayflow's technical choices echo this philosophy:
* **Beautiful Vanilla UI**: Advanced CSS utilizing CSS variable tokens directly for fluid **Light/Dark modes**, exact micro-transitions, and calm spacing rules.
* **Serverless Safety**: Never worry about subscriptions, server outages, or a service shutting down and holding your habits hostage. Your GitHub repository outlives businesses. 
* **Optimized API Polling**: Multi-month timelines compute asynchronously over cached memory, reducing rate-limiting issues strictly encountered in basic REST projects.

<br />

<div align="center">
  <p><i>Enjoy your quiet, daily space.</i></p>
  <hr style="width:50%; margin-top:2rem;" />
</div>
