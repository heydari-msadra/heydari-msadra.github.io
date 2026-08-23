# The Econ Funding Ledger — periodic update task (Claude Code agent)

This file is the complete brief for a **Claude Code agent** that keeps
`apps/EconGradAlert/data/tracker.json` (and its generated `tracker.xlsx`
sibling) current. It runs inside `heydari-msadra.github.io`, the personal
academic site repo — **not** a standalone repo. The dashboard is one static
page among many on that site, living entirely under `apps/EconGradAlert/`.

Give this whole file to Claude Code as its task (see §5 for how). Everything
it needs is below.

**Hard boundary — read this first:** every step in this file operates
exclusively inside `apps/EconGradAlert/`. Never edit, stage, or commit any
file outside that folder (the rest of the site — `index.html`, `pages/`,
`includes/`, `styles.css`, etc. — is out of scope for this agent, always).
`apps/EconGradAlert/githide/` is git-ignored and holds working notes plus a
`config.json` with a Telegram bot token that is **not wired up yet** — leave
it alone; Telegram notifications are a future phase, not part of this task.

---

## 0. How this fits together

```
Your PC (Task Scheduler, every ~10 days)
   └─ runs Claude Code headlessly with this file as the prompt
        ├─ reads apps/EconGradAlert/data/tracker.json
        ├─ re-researches funded Economics programs (web search/fetch)
        ├─ rewrites apps/EconGradAlert/data/tracker.json
        ├─ regenerates apps/EconGradAlert/data/tracker.xlsx from the JSON
        ├─ git commit + push a branch  →  opens a PR against main
        └─ (no Telegram yet — that's a later phase)
```

`apps/EconGradAlert/index.html` never needs to change between runs — it's a
static shell that `fetch()`es `./data/tracker.json` at load time. Only the
data file (and its regenerated Excel sibling) changes, so every automated
commit is a small, mostly-readable diff (`tracker.xlsx` is binary and will
always show as a full-file diff — that's expected and fine).

---

## 1. Repository layout (relevant subset)

```
heydari-msadra.github.io/                 # the whole site repo — DO NOT touch outside apps/EconGradAlert/
└── apps/
    └── EconGradAlert/
        ├── index.html              # the dashboard — static, rarely changes
        ├── AGENT_TASK.md            # this file
        ├── data/
        │   ├── tracker.json         # the single source of truth — this is what changes every run
        │   └── tracker.xlsx         # generated from tracker.json — never hand-edit
        ├── scripts/
        │   └── build_excel.py       # regenerates tracker.xlsx from tracker.json
        └── githide/                 # git-ignored scratch area — leave alone (has a Telegram token for later)
```

---

## 2. Data schema — `data/tracker.json`

```json
{
  "meta": {
    "title": "Funded Economics Master's & PhD Programs Tracker",
    "last_full_update": "YYYY-MM-DD",
    "coverage_note": "Free text describing scope/coverage.",
    "repec_source": "https://ideas.repec.org/top/top.econdept.html",
    "repec_snapshot": "Month YYYY",
    "program_count": 24
  },
  "programs": [
    {
      "id": "EUR-01",
      "degree": "PhD",
      "name": "Program name",
      "uni": "University / institute name",
      "repec_rank": "#9  (or a free-text note for unranked/joint institutes)",
      "region": "Europe",
      "country": "Country",
      "city": "City",
      "link": "https://official-program-page",
      "ielts": "score or 'Not specified'",
      "toefl": "score or 'Not specified'",
      "gre": "requirement or 'Not required'",
      "other": "free text — other requirements",
      "start": "program start info",
      "deadline": "free-text deadline description (not a machine date — see urgency rules)",
      "refs": "number of reference letters, or 'Not specified'",
      "appfee": "amount or 'Not specified'",
      "progfee": "amount or 'Not specified'",
      "funding_status": "short funding status label",
      "funding_detail": "longer free text on what the funding covers",
      "urgency": "urgent | soon | later | tba | closed",
      "notified_30day": false,
      "notified_7day": false,
      "date_added": "YYYY-MM-DD",
      "last_updated": "YYYY-MM-DD",
      "last_change": "short description of the most recent change",
      "notes": "free text — caveats, verification status, etc."
    }
  ],
  "change_log": [
    {
      "date": "YYYY-MM-DD",
      "program_id": "EUR-01",
      "program_name": "Program name — University",
      "change_type": "Added (seed) | Added (new find) | Updated | Deadline reminder",
      "details": "one sentence describing what happened"
    }
  ]
}
```

**ID convention:** `EUR-NN` / `ASA-NN` / `AUS-NN`, numbered sequentially
within each region. When adding a program, use the next unused number for
its region — never reuse or renumber existing IDs (the change log and
`notified_*` flags are keyed to them staying stable).

**`urgency` values**, judged from the free-text `deadline` field against
*today's* date:
- `urgent` — a real deadline within ~4 weeks
- `soon` — within ~4–16 weeks
- `later` — further out, but a real date or recurring pattern is known
- `tba` — no reliable date found yet
- `closed` — the relevant deadline just passed and no next cycle is announced

The `notified_30day` / `notified_7day` flags exist in the schema already so
they're ready for the future Telegram phase — keep maintaining them per §4
below even though nothing consumes them yet.

---

## 3. `scripts/build_excel.py`

Already in the repo — regenerates `data/tracker.xlsx` (README / Programs /
Change Log sheets) from `data/tracker.json`. Run it after every edit to the
JSON:

```
python apps/EconGradAlert/scripts/build_excel.py
```

It requires only `openpyxl` (already used elsewhere in this environment).
Never hand-edit `tracker.xlsx` — it's fully derived and gets overwritten.

---

## 4. THE RECURRING TASK — what the agent does every run

*(Everything from here to the end of §4 is the actual task. If you're Claude
Code reading this file as your prompt: this is your job. Work through the
steps in order.)*

You are running a scheduled maintenance pass for a research tracker called
**The Econ Funding Ledger** — funded Economics Master's and PhD programs
across Europe, Asia, and Australia. You have no memory of any prior run;
everything you need is in `apps/EconGradAlert/` and this file. Start by
checking today's actual date — several judgment calls below depend on it.
Remember the hard boundary from the top of this file: nothing outside
`apps/EconGradAlert/` gets touched.

**Step 1 — Read current state**
Read `apps/EconGradAlert/data/tracker.json`. Parse it against the schema in
§2. If anything about the file doesn't match that schema, treat §2 as
authoritative and fix the file to match as part of this run.

**Step 2 — Re-research**
a. For every program with a placeholder value ("Not yet confirmed", "TBA",
   "Not specified", etc.), search the web and fetch its official page
   (`link`) to try to fill the gap.
b. For every program, check whether anything material has changed since
   `last_updated`: deadline, funding status/amount, requirements. Prioritize
   programs flagged `urgent`/`soon`/`closed`, and anything not checked in
   the last ~3 weeks.
c. Search for a handful of additional funded Economics Master's or PhD
   programs in Europe, Asia, or Australia not yet in the list. This is
   meant to grow gradually — don't attempt an exhaustive sweep every run.
   Only add programs with real funding (scholarship, stipend, tuition
   waiver, or paid assistantship); unfunded programs are out of scope.
d. If a tracked university's RePEc IDEAS rank is missing or clearly stale,
   look it up at https://ideas.repec.org/top/top.econdept.html (joint
   institutes without a standalone listing show their most relevant
   affiliated university's rank instead) and update `repec_rank`.

**Step 3 — Update the data**
For every program you added or changed:
- Update `last_updated` to today and set `last_change` to a short
  description.
- Append one `change_log` entry (date, program id/name, `change_type`,
  one-sentence `details`).
- New programs: next unused ID in that region's sequence, all fields filled
  in the same style as existing entries, `notified_30day`/`notified_7day`
  set to `false`, `date_added`/`last_updated` set to today, `last_change` =
  "Added (new find)".
- Re-assess `urgency` per the rules in §2, using today's date and your own
  judgment reading the free-text `deadline` field.
- Update `meta.last_full_update` and `meta.program_count`.

**Step 4 — Deadline reminder flags (no notification channel yet)**
For every program with a genuinely identifiable upcoming deadline: if it's
within 30 days of today and `notified_30day` is `false`, set it to `true`.
If within 7 days and `notified_7day` is `false`, set it to `true`. Never
re-notify once a flag is already `true` — unless the deadline materially
changes, in which case reset both flags to `false` for that program. (This
just keeps the flags accurate for whenever the Telegram phase is wired up
later — no message gets sent yet.)

**Step 5 — Regenerate the Excel file**
Validate the rewritten JSON actually parses, then run:
```
python apps/EconGradAlert/scripts/build_excel.py
```
Confirm it completes without error and `data/tracker.xlsx` is updated.

**Step 6 — Commit and publish**
- `git checkout -b econgrad-update-<YYYY-MM-DD>`
- `git add apps/EconGradAlert/data/tracker.json apps/EconGradAlert/data/tracker.xlsx`
  (stage nothing else — double-check `git status` shows only these two
  files before committing)
- `git commit -m "Econ ledger update <YYYY-MM-DD>: N added, M updated, K reminder flags"`
- `git push -u origin econgrad-update-<YYYY-MM-DD>`
- Open a pull request against `main` (e.g. `gh pr create --fill` if the
  `gh` CLI is available; otherwise leave the branch pushed and note the
  branch name in your final summary so the user can open the PR
  themselves).

Do **not** push straight to `main` and do **not** merge the PR yourself —
leave that for the user to review, at least for the first several runs (see
§6). Do not touch `apps/EconGradAlert/index.html`, `scripts/build_excel.py`,
or anything outside `apps/EconGradAlert/data/` unless explicitly asked to —
and never touch anything outside `apps/EconGradAlert/` at all.

**Step 7 — Finish**
Print a short summary of what you did (counts added/updated/reminder-flagged,
PR branch name if applicable) as your final output.

---

## 5. Running it manually (to test, before scheduling anything)

From the repo root (`heydari-msadra.github.io/`):
```
claude -p "$(cat apps/EconGradAlert/AGENT_TASK.md)"
```
Watch it work interactively the first few times before trusting it to run
unattended. Confirm: the JSON stays valid, `tracker.xlsx` regenerates
cleanly, the diff touches only `apps/EconGradAlert/data/*`, and the PR opens
(not a direct push).

For unattended runs you'll need to skip interactive permission prompts —
either a scoped permissions file (safer: allow-list exactly `git`,
`python`, web search/fetch, and edits within `apps/EconGradAlert/`) or,
more bluntly, `claude -p "..." --dangerously-skip-permissions`. Check
`claude --help` for current flag names before relying on either.

---

## 6. Safety notes — please read before automating this unattended

- **Start on the PR workflow, not auto-merge.** Step 6 above deliberately
  opens a pull request instead of pushing to `main`. Review each PR
  yourself for the first several cycles — a bad research pass (a
  hallucinated deadline, a broken link) should not go live on your public
  page unreviewed.
- **Scope stays narrow, always.** This agent's entire world is
  `apps/EconGradAlert/`. It should never need to read or write anything
  else in the site repo. If it ever proposes touching another file, that's
  a bug in the run — stop and investigate rather than approving it.
- **Secrets stay untouched.** `apps/EconGradAlert/githide/` is git-ignored
  and holds a Telegram bot token for a future phase. This task never reads
  or needs it — don't open, print, or reference its contents.
- **Telegram comes later.** When that phase starts, it'll extend §4/§6
  with an actual send step reading from `githide/config.json` (or a
  `.env`, following the same pattern) — not part of this task yet.
