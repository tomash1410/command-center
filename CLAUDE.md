# CLAUDE.md — Command Centre Project Bible

## Who I am
- Tom, developer and team lead at Imaginet, based in Cardiff, Wales
- Working primarily on the Transport for Wales (TfW) Rail app — a Capacitor-wrapped web app
- Also manage the TFWS support desk project
- Comfortable with development fundamentals, returning to the ecosystem after a gap
- Prefer a collaborative, conversational working style — talk through decisions before implementing

## What we're building
A hosted web dashboard ("Command Centre") that replicates and extends a Claude.ai artifact I've been using for workflow automation. The goal is to make it accessible anywhere, with scheduled automations that don't require me to manually trigger them via Claude.

### Core features (porting from existing artifact)
- **Daily Triage Summary** — fetches open TFWS Jira tickets, identifies: new today / needs our response / gone quiet 7+ days, posts to Slack
- **Weekly Digest** — counts tickets by status, identifies themes, posts to Slack
- **Weekly Sheets Update** — updates a Google Sheet with weekly ticket stats
- **Sprint Release Notes** — pulls done tickets from a TFW sprint, groups by type, formats for stakeholders
- **Log My Time** — logs time to Jira worklogs across multiple tickets with ADF comment format

### Nice-to-haves (phase 2)
- Scheduled/cron jobs so daily triage posts automatically at 9am without manual trigger
- Persistent logs of what's been posted and when
- Simple auth layer (it shouldn't be open to the world)

---

## Tech stack decisions
- **Framework**: Next.js (App Router)
- **Hosting**: Vercel (connected to GitHub, free tier)
- **Repo**: https://github.com/tomash1410/command-center
- **Styling**: Tailwind CSS
- **Language**: TypeScript

### Why Next.js
- API routes handle secret keys server-side (nothing leaks to the client)
- Same codebase for front and back end
- Vercel deployment is trivial

---

## APIs we're integrating

### Jira
- Instance: `imaginet.atlassian.net`
- Auth: API token (Basic auth with email + token)
- Key projects: `TFWS` (support desk), `TFW` (rail app), `TFWU` (uno)
- Already familiar with the REST endpoints from MCP automation work

### Slack
- Target channel: `#tfwr-support-desk-updates` (ID: `C0AJ2EP4FPE`)
- Auth: [PLACEHOLDER: Bot token or incoming webhook — TBD]
- Posts formatted triage summaries and weekly digests

### Anthropic API
- Model: `claude-sonnet-4-20250514`
- Used for: summarisation, formatting release notes, smart triage commentary
- Auth: API key (server-side only, never exposed to client)

### Google Sheets
- Sheet ID: `1GnvIPn1lppwNNcCs0pK8pI7_H8jOYCl9ZZP3BoQssyM`
- Sheet: `Sheet1`
- Auth: Google Service Account (same service account already in use for MCP automation)

---

## Environment variables (Vercel)
Store all secrets here — never commit to repo.

```
JIRA_BASE_URL=https://imaginet.atlassian.net
JIRA_EMAIL=[PLACEHOLDER]
JIRA_API_TOKEN=[PLACEHOLDER]
SLACK_BOT_TOKEN=[PLACEHOLDER]
ANTHROPIC_API_KEY=[PLACEHOLDER]
GOOGLE_SERVICE_ACCOUNT_EMAIL=[PLACEHOLDER]
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY=[PLACEHOLDER]
GOOGLE_SHEET_ID=1GnvIPn1lppwNNcCs0pK8pI7_H8jOYCl9ZZP3BoQssyM
```

---

## Jira field reference
- `customfield_10268` — Last Comment Author
- Internal team members (not customers): Tom, Bartek, Pawel, Rachel, Amadeusz, Kacper, Dafydd
- Note: Paweł's name may appear with Polish characters (Paweł) in Jira — always check both "Pawel" and "Paweł" in any name matching logic
- "Needs response" = last commenter is NOT one of the above (i.e. `accountType:customer`)
- "Gone quiet" = no update in 7+ days, exclude statuses: "Waiting for 3rd Party", "Open but Blocked"

## Time logging reference
- 7.5hrs/day, 09:00–16:30, logs stacked sequentially
- Ticket aliases:
  - `TFW-6662` = ceremonies → DEV
  - `TFW-6366` = pm → PM
  - `TFW-6364` = support → SUPPORT
  - `TFW-6363` = external meetings → PM
  - `TFW-6362` = internal meetings → PM
  - `TFWU-8` = uno internal meetings → PM
  - `TFWU-9` = uno external meetings → PM
  - `TFWU-10` = uno pm → PM
  - `TFWU-13` = uno ponty → PM
  - `TFWU-14` = uno travel → Travel

---

## Code conventions
- TypeScript throughout
- API routes live in `app/api/`
- Keep API logic server-side — client components only handle UI state
- Prefer `async/await` over `.then()` chains
- Error handling on every API call — surface errors clearly in the UI
- ESLint (default Next.js config)

---

## Project status

### Setup ✅
- [x] Concept defined and scoped
- [x] Stack decided
- [x] GitHub repo created — https://github.com/tomash1410/command-center
- [x] Next.js app scaffolded
- [x] Vercel connected — https://command-center-sepia-rho.vercel.app

### UI skeleton
- [ ] CLAUDE.md added to repo root
- [ ] Folder structure set up (app/api/, components/)
- [ ] Dark theme + layout shell (sidebar/tabs)
- [ ] Commands tab — static UI, no real data yet
- [ ] To-do tab — static UI
- [ ] Time Aliases tab — static UI
- [ ] Push to GitHub → confirm auto-deploy to Vercel works

### API integrations (one by one)
- [ ] Jira — fetch TFWS tickets
- [ ] Jira — post worklogs (time logging)
- [ ] Slack — post triage summary
- [ ] Google Sheets — weekly stats update
- [ ] Anthropic — summarisation / release notes

### Environment variables
- [ ] .env.local set up locally
- [ ] All keys added to Vercel dashboard

### Nice-to-haves
- [ ] Scheduled jobs (cron) for auto daily triage
- [ ] Persistent logs of what's been posted
- [ ] Auth layer
