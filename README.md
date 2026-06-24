# Trios® — Offline School Management System

Trios® is a **100% offline, server-free school management system** for schools. It runs
as a native Windows desktop app (Electron) or in any modern browser, storing all data
locally in the browser's IndexedDB via [Dexie](https://dexie.org/). There is no backend,
no cloud, and no internet connection required — making it ideal for schools with limited
or unreliable connectivity.

> Built for Sri Lankan schools (GCE O/L subject lists, local grading system, term
> structure) but adaptable to any institution.

---

## ✨ Features

- **Role-based access** — four roles with tailored dashboards and permissions:
  - **Admin** — full control over the whole system
  - **Principal** — school-wide oversight and management
  - **Teacher** — manage their own class, enter marks, view timetables
  - **Student** — view personal marks, exams, timetable, and announcements
- **Student management** — admissions, profiles, class assignment, auto-generated login accounts
- **Teacher management** — staff records, subject/class assignments, auto-generated login accounts
- **Classes & subjects** — organize grades, classes, and the official GCE O/L subject catalog
- **Exams & marks** — create exams, bulk mark entry, per-student and per-exam views
- **Mark Analyzer** — charts and statistics on student/class performance (powered by Recharts)
- **Timetable** — class and teacher schedules
- **ID cards** — printable student/teacher ID cards with QR codes
- **QR codes** — class and student QR codes for quick lookup
- **Announcements & events** — school-wide and role-targeted notices
- **Excel import/export** — bulk data via `.xlsx` files (powered by SheetJS)
- **Search** — global search across the portal
- **Settings** — school name, type, academic year, term, grading system
- **Light / dark theme**
- **Fully offline** — your data never leaves the device

---

## 🛠 Tech Stack

| Layer        | Technology |
|--------------|------------|
| UI           | [React 19](https://react.dev/) + [React Router 7](https://reactrouter.com/) |
| Build tool   | [Vite 8](https://vite.dev/) |
| Styling      | [Tailwind CSS 4](https://tailwindcss.com/) |
| Icons        | [Lucide React](https://lucide.dev/) |
| Local DB     | [Dexie 4](https://dexie.org/) (IndexedDB wrapper) |
| Charts       | [Recharts](https://recharts.org/) |
| Spreadsheets | [SheetJS / xlsx](https://sheetjs.com/) |
| QR codes     | [react-qr-code](https://www.npmjs.com/package/react-qr-code) |
| Desktop      | [Electron 41](https://www.electronjs.org/) + [electron-builder](https://www.electron.build/) |
| Linting      | ESLint 9 |

---

## 🚀 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) 18+ and npm

### Install
```bash
git clone https://github.com/dlmacro/Trios.git
cd Trios
npm install
```

### Run in the browser (development)
```bash
npm run dev
```
Then open the URL Vite prints (default <http://localhost:5173>).

### Run as a desktop app (development)
```bash
npm run electron:dev
```
Launches Vite and opens the Electron window once the dev server is ready.

---

## 🔑 Default Login Accounts

On first run the app seeds two administrative accounts. Teacher and student accounts
are **generated automatically** when you add teachers/students.

| Role      | Username    | Password        |
|-----------|-------------|-----------------|
| Admin     | `admin`     | `admin123`      |
| Principal | `principal` | `principal123`  |
| Teacher   | *(employee ID, lowercase)* | `teacher@123` |
| Student   | *(admission no, lowercase)* | `student@123` |

> ⚠️ **These are demo defaults.** Change them before any real deployment — anyone with
> the source can read them. Passwords are stored locally in IndexedDB.

---

## 📦 Building

### Web build
```bash
npm run build      # outputs to dist/
npm run preview    # preview the production build locally
```

### Windows desktop installer
```bash
npm run electron:build:win
```
Produces an NSIS installer in `release/` (`Trios® Setup 1.0.0.exe`).

---

## 📁 Project Structure

```
school-portal/
├── electron/            # Electron main process, preload, packaging entry
│   ├── main.js          # Window creation, security hardening, app lifecycle
│   └── preload.js
├── src/
│   ├── pages/           # Route-level views (Dashboard, Students, Marks, …)
│   ├── components/      # Reusable UI (Layout, Sidebar, ID card / QR modals, …)
│   ├── context/         # AuthContext (login/roles) + ThemeContext (light/dark)
│   ├── db/              # Dexie databases & helpers (split by domain)
│   │   ├── database.js  #   main DB + schema migrations + seed data
│   │   ├── academic.js  #   students, teachers, classes
│   │   ├── subjects.js  #   subject catalog
│   │   ├── curriculum.js#   courses, exams, marks
│   │   ├── resources.js #   buildings, resources, attendance
│   │   └── index.js     #   barrel that wires everything together
│   ├── hooks/
│   ├── App.jsx          # Routes + role-protected route guards
│   └── main.jsx         # React entry point
├── landing/             # Standalone offline marketing/landing page
├── public/              # Static assets (icons, favicon)
├── index.html
├── vite.config.js
└── package.json
```

---

## 🗄 Data & Storage

All data lives in the browser's **IndexedDB** (via Dexie). Nothing is sent to any
server. The schema is organized into domain databases (academic, subjects, curriculum,
resources) plus a main database for users, settings, notifications, and announcements.
Dexie's versioned migrations handle schema upgrades and seeding automatically.

Because data is per-device/per-browser, clearing browser data or moving to another
machine starts fresh. Use the built-in Excel import/export for backups and transfers.

---

## 📜 Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start the Vite dev server |
| `npm run build` | Production web build → `dist/` |
| `npm run preview` | Preview the production build |
| `npm run lint` | Run ESLint |
| `npm run electron:dev` | Run the desktop app in development |
| `npm run electron:build` | Build the desktop app (current platform) |
| `npm run electron:build:win` | Build the Windows installer |
| `npm run og` | Generate the landing-page social/OG preview image |

---

## 📄 License

Copyright © 2025 TRIOS. All rights reserved.
