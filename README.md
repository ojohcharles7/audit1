# Crunchies Internal Audit & Internal Control

Enterprise internal audit management platform for Crunchies Fried Chicken — multi-branch audit planning, digital checklists, risk, fraud investigation, internal controls, corrective actions, reporting and executive assurance.

## Stack

- **Next.js 16** App Router, React 19, TypeScript, Server Actions, route handlers
- **SQLite** via `better-sqlite3` with WAL, SQL migrations, append-only triggers and a portable SQL schema
- **Tailwind CSS 4** design system (navy sidebar, white canvas, Crunchies red, green/amber status)
- **Recharts** analytics, **@react-pdf/renderer** PDF, **ExcelJS** XLSX
- Custom **PBKDF2-SHA256** authentication, signed HttpOnly sessions, optional TOTP MFA
- **PWA** service worker + IndexedDB offline checklist drafts

## Run locally

```bash
npm install
npm run db:migrate
npm run db:seed
npm run dev
```

Open http://localhost:3000. All demo accounts use password **`Audit@2026`**.

| Role | Email |
|---|---|
| Head of Internal Audit | `head.audit@crunchiesfood.com` |
| Internal Audit Manager | `audit.manager@crunchiesfood.com` |
| Internal Auditor | `auditor@crunchiesfood.com` |
| Regional Manager | `regional@crunchiesfood.com` (South West) |
| Outlet Manager | `outlet@crunchiesfood.com` (Ikeja City Mall) |
| Finance | `finance@crunchiesfood.com` |
| Executive Management | `executive@crunchiesfood.com` |

The login page also has one-click demo account fill.

## Modules

Dashboard · Audit Planning · Outlet Audits · Audit Checklist builder · Findings · Risk Register · Fraud Investigation · Internal Controls · Corrective Actions · Reports · Outlets & Rankings · Staff & Auditors · Evidence Repository · Notifications · Settings · Activity Logs.

## Key workflows

1. **Plan** one-off, monthly or quarterly audits and assign auditors.
2. **Conduct** the weighted digital checklist with mandatory questions, evidence requirements, comments and offline drafts.
3. **Submit** — mandatory/evidence validation, weighted scoring, audit locking and automatic findings for high/critical exceptions.
4. **Remediate** — management response, CAPA actions, evidence, independent verification and Head-of-Audit closure approval.
5. **Escalate** — critical findings create executive escalations and notifications automatically.
6. **Report** — generate versioned, immutable report snapshots; open, print, export PDF/Excel.
7. **Investigate** — restricted fraud cases with access grants, append-only hash-chained updates and closure approval.
8. **Assure** — risk matrix, control testing, outlet comparison index, management analytics.

## Security & auditability

- Role-based access control with outlet/region scoping on every query.
- Confidential fraud cases require explicit case access; executive accounts see only aggregate indicators.
- Submitted audits and responses are immutable at application and SQLite trigger level.
- Activity logs and fraud updates are append-only and hash-chained. The Logs page verifies chain integrity.
- Secure evidence storage outside `public/`, served through an authenticated download route with access logging and SHA-256 checksums.
- Session records, login history, password reset revocation, optional TOTP MFA and demo reset.

## Scripts

```bash
npm run dev          # development
npm run build        # production build
npm start            # production server
npm run lint         # ESLint
npm run typecheck    # tsc --noEmit
npm test             # Vitest unit tests
npm run db:migrate   # apply SQL migrations
npm run db:seed      # reset + seed demo data
npm run smoke        # authenticated route/API smoke test (server must be running on :3100)
```

`npm run smoke` expects a production server: `npm start -- -p 3100`.

## Configuration

Copy `.env.example` to `.env.local` and set `SESSION_SECRET`. Optional SMTP variables enable the email outbox processor in **Settings**.

## Demo data

42 users, 24 outlets across 6 Nigerian regions, 74 audits, 90+ checklist questions, findings, CAPA actions, 24 risks, 32 controls, 8 confidential fraud cases, 44 reports, 191 evidence records and hash-chained activity history.

## Notes / production hardening

- SQLite is used for a zero-setup local deployment; the SQL schema is PostgreSQL-portable. Move the data layer to PostgreSQL/Supabase for multi-instance production.
- Local evidence storage can be replaced with S3/Supabase Storage; the authenticated file route and metadata model stay the same.
- Email delivery requires SMTP configuration; without it notifications remain in-app and the outbox is marked skipped.
- Offline mode covers checklist answers and drafts. Evidence upload and final audit submission require connectivity for server-side validation.
- Demo credentials and seeded data are fictional and must be removed before a real deployment.
