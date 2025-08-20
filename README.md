# README

## Overview

This repo contains a React frontend **and** a PHP backend (plus a database file). You’ll run the PHP built-in server for the backend and the React dev server for the frontend.

---

## Prerequisites

Install these on your machine:

* **Node.js** (LTS 18.x or 20.x)
  Includes **npm**.
* **PHP** (8.x recommended)

**PHP extensions** (enable via your PHP installation if not already):

* `pdo_sqlite` **or** `sqlite3` (required for the bundled DB file)
* `mbstring`
* `json` (usually built in)
* `curl` (only if your PHP scripts call external APIs)

---

## Clone the repository

```bash
git clone <REPO_URL>
cd <REPO_FOLDER>
```

---

## Install JavaScript dependencies

```bash
npm install
```

This pulls everything declared in `package.json`, including:

* `react`, `react-dom`
* `d3`
* `xlsx`
* `js-cookie`
* Tailwind toolchain: `tailwindcss`, `postcss`, `autoprefixer`
* Your build tool (e.g. `react-scripts` or `vite`) as defined in the repo

---

## Run the app (two terminals)

> Use the exact commands below.

### Terminal 1 — PHP server

```bash
cd lcoal-webroot
php -S 127.0.0.1:8000 -t .
```

### Terminal 2 — React dev server

From the repository root:

```bash
npm run start
```

---

## Notes

* Keep the PHP files **and** the database file in the PHP webroot you serve with `-t .` so the backend can find them.
* The exact frontend URL/port is whatever `npm run start` prints (commonly `http://localhost:3000/`).
* If you see PHP errors about SQLite, ensure `pdo_sqlite` or `sqlite3` is enabled.
* If your system blocks one of the ports, pick another free port and re-run the same commands with that port.
