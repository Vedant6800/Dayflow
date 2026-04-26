<div align="center">
  <h1>🌿 Dayflow</h1>
  <p><b>Your quiet daily space.</b></p>
  <p><i>Track habits, capture ideas, and write freely — all securely stored in your own GitHub repository.</i></p>

  <p>
    <img alt="Vanilla JS" src="https://img.shields.io/badge/Vanilla%20JS-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black" />
    <img alt="CSS" src="https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css3&logoColor=white" />
    <img alt="Serverless" src="https://img.shields.io/badge/Serverless-GitHub_API-black?style=for-the-badge&logo=github&logoColor=white" />
  </p>
</div>

<br />

> **Dayflow** is a minimalist, personal life tracker that gives you a distraction-free environment to record your daily rituals, log your ideas, and maintain a private journal. It is intentionally simple, free of analytics bloat, and requires zero servers.

Instead of storing your personal data in a black-box cloud, Dayflow bridges directly to GitHub via its REST API, acting as a beautiful frontend while keeping your data **100% privately owned and accessible**.

---

## ✨ Features

Dayflow is split into three core modules, each designed with extreme simplicity and modern aesthetics in mind.

### 📅 Habits Tracker
A lightning-fast checklist designed for your daily rituals. 
- Mark habits as complete with satisfying visual feedback.
- Tracks daily completion logs and lightweight streak continuity.
- Add or modify rituals on the fly.

### 💡 Ideas Logger
A quick-capture inbox for tasks and sparks of inspiration. 
- Organizes entries instantly into **Idea**, **In Progress**, or **Completed** statuses.
- Clean card-based layout so you'll never lose track of a project again.

### 🧾 Daily Journal
A quiet, completely unstructured textarea purely dedicated to daily thoughts.
- Zero forced constraints. Just sit and type.
- Explicit save button ensures your entries are written to GitHub exactly when you are ready.
- Navigate a calm, chronological archive of previous days and months.

---

## 🚀 Getting Started

Since Dayflow connects securely to your private GitHub to function as your database, getting started requires setting up an access token. 

### 1. Ensure You Have the Data Repository
You must have a **private** repository specifically named `Dayflow` explicitly created on your GitHub account (`Vedant6800`). This completely isolated space is where all tracking JSON files will be cleanly managed.

### 2. Generate an Access Token
Go to [GitHub Developer Settings](https://github.com/settings/tokens/new) and generate a new Personal Access Token (PAT).
* **If Classic Token:** Check the `repo` scope.
* **If Fine-Grained Token:** Explicitly select access for the `Dayflow` repository, and grant **Read and write** permissions under the **Contents** dropdown. 

### 3. Open Dayflow
Serve the target folder via any generic local HTTP server (such as VSCode's *Live Server* or Python's HTTP module). Navigate to `index.html`.

### 4. Connect
A native browser prompt will automatically greet you requesting your Personal Access Token. Paste it in. Dayflow validates the token securely against the GitHub API and automatically retains it locally in your browser's trusted storage!

---

## 📂 Directory Structure

Under the hood, all actions are pushed into your remote repository via Base64 JSON payloads, following incredibly organized patterns:

```text
├── data/
│   ├── ideas.json                   # List of your ideas and ongoing projects
│   ├── habits/
│   │   ├── config.json              # Schema logic holding active habits
│   │   ├── 2026/                    # Year mapping
│   │   │   └── 04.json              # Monthly tracking (dates mapped to completed habits) 
│   ├── journal/
│   │   ├── 2026/                    # Year mapping
│   │   │   └── 04.json              # Unstructured daily text entries mapped to dates
```

---

## 🛠️ Tech Stack & Philosophy

Dayflow believes less is more.

* **Beautiful UI:** Custom CSS utilizing variable logic for fluid, dynamic **Light/Dark themes**, smooth transitions, and a muted, calm typography space.
* **Fast & Client-Side:** Written in strictly Vanilla ES6+. It operates as a local utility needing no npm install or framework hydration processes.
* **Smart Concurrency:** All network logic uses `Promise` queues to guarantee fast multi-action clicks never overwrite files accidentally.

<br />

<div align="center">
  <i>Enjoy your daily calm.</i>
</div>
