# ReguGuard
Lightweight, front-end regulatory compliance control room for extracting obligations, scoring risk, and practicing PDPA readiness and GRC workflows. Built as part of my personal data governance / cybersecurity series.

## Purpose
- Turn dense regulations into tangible obligations and actions: detect -> triage -> assign -> review.
- Practice profile-based applicability (size, industry, role, jurisdiction) and regulator-facing reporting without heavyweight tooling.
- Build a portfolio of GRC-focused utilities (this is project 1; next up is VendorGuard for vendor risk).

## What it does
- Regulation ingestion: Upload PDF/TXT and extract obligations using modal verbs and configurable detection rules.
- Risk scoring: Assign severity, score, and flags (penalty, mandatory, breach, enforcement) with a breakdown.
- Company profile filtering: Use industry, jurisdiction, roles, and size data to mark obligations as applicable, not applicable, or needs review.
- Feedback loop: Mark rules applicable/not applicable to update a lightweight Naive Bayes model per company.
- Workflow: Kanban board, action steps, assignees, due dates, and comments.
- Rule detail view: Plain-English action, scoring breakdown, and applicability reason.
- Reports: Export a PDF summary (WeasyPrint if installed, fallback PDF otherwise).
- Insights: KPI dashboards and stakeholder relevance scoring from document language.

## Tech stack
- Frontend: React + Vite, drag-and-drop via @hello-pangea/dnd.
- Backend: FastAPI, pypdf for PDF extraction.
- Storage: JSON files in server/app/data (company profiles, feedback, model). Profile draft cached in localStorage.
- Optional: WeasyPrint for richer PDF rendering.

## Quick start (local)
Backend
```bash
cd server
python -m venv .venv
.\.venv\Scripts\activate
pip install fastapi uvicorn pypdf python-multipart
python -m uvicorn app.main:app --reload --port 8000
```
Optional: `pip install weasyprint` for richer PDF rendering (otherwise a fallback PDF is used).

Frontend
```bash
cd client
npm install
npm run dev
```

Open http://localhost:5173 (API at http://localhost:8000).

## Using the app
- Set company profile: Fill the Company Profile form and save. This drives applicability filtering.
- Upload regulation: Upload 1670996860745_09 PDPA 2012.pdf (or any PDF/TXT).
- Tune detection: Adjust detection rules to match your framework vocabulary.
- Review obligations: Use Detected Rules and Rule Detail to inspect severity, reasons, and applicability.
- Add actions: Create action steps with status, priority, and due dates.
- Train the model: Click "Mark applicable" / "Mark not applicable" on a rule.
- Export: Use "Export PDF Report" for a shareable compliance summary.

## Data model
- Server-side JSON:
  - server/app/data/company_profiles.json
  - server/app/data/applicability_models.json
  - server/app/data/applicability_feedback.json
- Client-side state is in memory; company profile draft is cached in localStorage.

## How this supports data governance & GRC practice
- Forces explicit scoping via company profile (industry, role, jurisdiction, size).
- Documents applicability decisions with reasons and feedback history.
- Turns legal text into action steps with owners and deadlines.
- Produces regulator-ready exports for review and evidence.

## Roadmap (series)
- ReguGuard — regulatory obligation parsing and applicability (this repo).
- VendorGuard — vendor risk and third-party assurance (next build).
- Future ideas: richer NLP models, multi-user workflow, and database-backed persistence.

## Security & data hygiene
- No API keys, secrets, or live integrations are used.
- Data stays local (JSON files + browser localStorage).
- If you add a backend database, keep credentials in environment variables, not in the repo.

## Project structure
- client/ — React UI (App, components, styles, API client).
- server/ — FastAPI API (parser, applicability scoring, report generation).
- 1670996860745_09 PDPA 2012.pdf — sample regulation for testing.

## Contributing / feedback
This is a personal project; feedback and suggestions are welcome. If you adapt it, credit is appreciated. Feel free to fork and extend (e.g., add a database, auth, or additional frameworks).
