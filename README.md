# README

## Overview

This repo contains a React frontend **and** a PHP backend (plus a database file). You’ll run the PHP built-in server for the backend and the React dev server for the frontend.

---

## Prerequisites

Install these on your machine:

* **Node.js** (LTS 18.x or 20.x)
  Includes **npm**.
* **PHP** (8.x recommended)

**PHP extensions** (enable via PHP installation if not already):

* `pdo_sqlite` **or** `sqlite3` (required for the bundled DB file)
* `mbstring`
* `json` 

---

## Clone the repository

```bash
git clone https://github.com/julia-weppler-1/fossil-fuel-ref-calculator.git
cd fossil-fuel-ref-calculator
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

### Usage

There is a json file in /public called "PARAM TEST SET.json". This contains 2 testing sets to import and play around with. The dashboards can be used without this saved test set, but the playground will not work without it.

## Notes

* This repository is still in development. Not all features work yet or are thoroughly tested. More updates coming soon.
* The exact frontend URL/port is whatever `npm run start` prints (commonly `http://localhost:3000/`).
* If you see PHP errors about SQLite, ensure `pdo_sqlite` or `sqlite3` is enabled.
* If your system blocks one of the ports, pick another free port and re-run the same commands with that port.
