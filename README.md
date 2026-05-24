# Sk Study Way — Tuition Management Portal

A professional, browser-based tuition management website for tracking **students, fees, attendance, and results**. Pure HTML / CSS / JavaScript with `localStorage` persistence — no backend, no build step, no dependencies.

## Features

### Dashboard
- At-a-glance stats: total students, fees collected, today's attendance %, results recorded
- Recent fee payments table
- Today's attendance breakdown (Present / Absent / Late)

### Students
- Add, edit, delete student records
- Search by name / roll / class / parent / phone
- Filter by class
- Track: roll no, name, class, section, parent, phone, address, monthly fee, status

### Fees
- Record payments with date, month, amount, mode (Cash / UPI / Bank / Card / Cheque)
- Auto-calculated stats: total collected, current month collection, pending dues
- Filter by student, month, or free-text search
- **Printable payment receipts**

### Attendance
- Daily mark Present / Absent / Late with one click
- Filter by class, mark-all shortcuts
- Live day-stats (P / A / L / Unmarked)
- **Date-range attendance report** with per-student attendance %

### Results
- Enter marks for any number of subjects per exam
- Auto-calculate total, percentage, grade
- Filter by student or exam name
- **Printable Report Cards** with per-subject grade breakdown

## Quick start

This is a static site — just open `index.html` in any modern browser, or host the folder on any static-hosting platform (GitHub Pages, Netlify, Vercel, etc.).

### Default login
| Username | Password   |
|----------|------------|
| `admin`  | `admin123` |

All data is stored in your browser's `localStorage` — clearing browser data will erase everything.

## Project structure

```
Myweb/
├── index.html          Login page
├── dashboard.html      Stats overview
├── students.html       Student CRUD
├── fees.html           Fee tracking + receipts
├── attendance.html     Daily attendance + reports
├── results.html        Marks entry + report cards
├── css/
│   └── style.css       Full theme (sidebar, cards, tables, modals, print styles)
└── js/
    ├── storage.js      localStorage data layer
    ├── auth.js         Login / logout / session guard
    ├── ui.js           Shared helpers (sidebar, modal, toast, formatting)
    ├── dashboard.js
    ├── students.js
    ├── fees.js
    ├── attendance.js
    └── results.js
```

## Grading scale

| % range | Grade |
|---------|-------|
| 90+     | A+    |
| 80–89   | A     |
| 70–79   | B+    |
| 60–69   | B     |
| 50–59   | C     |
| 40–49   | D     |
| < 40    | F     |

## Deploy to GitHub Pages

1. Push to your repo's `main` branch.
2. Go to **Settings → Pages**.
3. Source: **Deploy from branch** → `main` / `(root)`.
4. Save. Your site will be live at `https://<username>.github.io/<repo>/`.

## Roadmap ideas

- Export data to Excel / CSV
- Multi-user accounts with roles
- Backend sync (Firebase, Supabase) so data survives across devices
- SMS / WhatsApp notifications for fee due
- Bulk student import via CSV
