# Session Order OS

A discipline management system for tutoring sessions. Helps tutors maintain order with AI-assisted incident analysis, grade-appropriate discipline workflows, and real-time session monitoring.

## Features

- **Session Control Panel** — Timer, student context, quick incident logging, discipline state analysis
- **AI-Powered Analysis** — Incident analysis via DeepSeek with deterministic fallback for offline use
- **Grade-Appropriate Discipline** — 5 grade bands (A–E) with scripted consequences, restorative steps, and parent escalation
- **Rules Viewer** — Grade-specific behavioral standards and session procedures
- **Methodology Editor** — Configure grade bands, thresholds, and consequence logic
- **Incident History** — Filterable log with severity badges, pagination, and CSV export
- **Reports Dashboard** — Statistics, bar charts, category distribution, and time patterns
- **Settings** — AI configuration, worker endpoint, data export/import, privacy controls
- **Dark Mode** — Full dark theme support

## Architecture

```
frontend/           Static web app (HTML + CSS + JS — no build step)
├── index.html      Single-page application shell
├── styles.css      Vanilla CSS design system
├── app.js          SPA router + view renderers
├── db.js           IndexedDB storage layer
├── methodology.js  Discipline model + deterministic logic
├── session.js      Session lifecycle + timer
├── incidents.js    Incident CRUD + analysis
├── ai.js           DeepSeek AI proxy client
├── export.js       JSON/CSV export + import
├── utils.js        Utility helpers
└── validate.js     JSON schema validation

worker/             Cloudflare Worker proxy
├── worker.js       CORS + rate limiting + DeepSeek API
├── wrangler.toml   Worker configuration
└── README.md       Deployment guide
```

## Quick Start

### Frontend (no build step needed)

```bash
# Option 1: Open directly
open frontend/index.html

# Option 2: Local server
cd frontend && python3 -m http.server 8080
# Then visit http://localhost:8080
```

The app seeds demo data automatically on first load.

### AI Proxy (optional)

See [worker/README.md](worker/README.md) for the complete Cloudflare Worker setup guide.

The app works fully offline without the worker — it uses deterministic discipline logic as a fallback.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Vanilla HTML/CSS/JS |
| Storage | IndexedDB (offline-first) |
| Icons | Material Symbols Outlined |
| Font | Inter (Google Fonts) |
| AI Backend | Cloudflare Workers + DeepSeek |

## Data Storage

All data lives in the browser's IndexedDB:

| Store | Contents |
|-------|----------|
| `students` | Student profiles (name, grade, streak, points) |
| `sessions` | Session records (start/end, goals, state) |
| `incidents` | Logged incidents with AI analysis |
| `methodology` | Discipline configuration |
| `preferences` | App settings (theme, worker URL, AI config) |

Use **Settings → Export** to back up, and **Import** to restore.

## License

MIT
