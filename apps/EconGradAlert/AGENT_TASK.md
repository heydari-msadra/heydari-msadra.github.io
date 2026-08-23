# The Econ Funding Ledger — periodic update task (Claude Code agent)

This file is the complete brief for a **Claude Code agent** that keeps
`apps/EconGradAlert/data/tracker.json` (and its generated `tracker.xlsx`
sibling) current, processes community requests in `data/alertqueue.json`,
and announces changes on the `@EconGradAlerts` Telegram channel. It runs
inside `heydari-msadra.github.io`, the personal academic site repo — **not**
a standalone repo. The dashboard is one static page among many on that
site, living entirely under `apps/EconGradAlert/`.

Give this whole file to Claude Code as its task (see §6 for how). Everything
it needs is below.

**Hard boundary — read this first:** every step in this file operates
exclusively inside `apps/EconGradAlert/`. Never edit, stage, or commit any
file outside that folder (the rest of the site — `index.html`, `pages/`,
`includes/`, `styles.css`, etc. — is out of scope for this agent, always).
`apps/EconGradAlert/githide/` is git-ignored and holds working notes plus
`config.json` (the Telegram bot token + chat ID). `scripts/telegram_sync.py`
reads that file to send messages — that's its job — but you (the agent)
should never open, print, or otherwise surface its contents yourself. If
you need to write any scratch/working file of your own (e.g. a before/after
snapshot for diffing), put it under `githide/` — it's git-ignored, so it
won't show up in `git status` and doesn't need cleaning up afterward. Don't
leave loose files elsewhere in `apps/EconGradAlert/`.

---

## 0. How this fits together

```
Your PC (Task Scheduler, every ~10 days)
   └─ runs Claude Code headlessly with this file as the prompt
        ├─ reads apps/EconGradAlert/data/tracker.json + data/alertqueue.json
        ├─ processes any pending alertqueue.json requests (research + add)
        ├─ re-researches funded Economics programs (web search/fetch)
        ├─ rewrites apps/EconGradAlert/data/tracker.json + alertqueue.json
        ├─ regenerates apps/EconGradAlert/data/tracker.xlsx from the JSON
        ├─ runs scripts/telegram_sync.py — posts new programs, replies with
        │  updates/reminders on existing threads in @EconGradAlerts
        └─ git commit + push a branch  →  opens a PR against main
```

`apps/EconGradAlert/index.html` never needs to change between runs — it's a
static shell that `fetch()`es `./data/tracker.json` at load time. Only the
data files (and the regenerated Excel sibling) change, so every automated
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
        │   ├── tracker.xlsx         # generated from tracker.json — never hand-edit
        │   └── alertqueue.json      # community "please track this program" requests — git-tracked, PR-able
        ├── scripts/
        │   ├── build_excel.py       # regenerates tracker.xlsx from tracker.json
        │   └── telegram_sync.py     # posts/replies to the @EconGradAlerts channel from tracker.json state
        └── githide/                 # git-ignored scratch area — holds the Telegram bot token, leave the file itself alone
```

---

## 2. Data schemas

### 2.1 `data/tracker.json`

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
      "notes": "free text — caveats, verification status, etc.",
      "telegram_message_id": null,
      "telegram_notified_30day": false,
      "telegram_notified_7day": false
    }
  ],
  "change_log": [
    {
      "date": "YYYY-MM-DD",
      "program_id": "EUR-01",
      "program_name": "Program name — University",
      "change_type": "Added (seed) | Added (new find) | Added (requested) | Updated | Deadline reminder",
      "details": "one sentence describing what happened",
      "notified_telegram": false
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

**Telegram fields** (`telegram_message_id`, `telegram_notified_30day`,
`telegram_notified_7day` on each program; `notified_telegram` on each
change_log entry) are state owned by `scripts/telegram_sync.py` — you set up
the *inputs* it reads (new programs, new change_log entries, the
`notified_30day`/`notified_7day` flags) but the script itself is what flips
these fields once a message actually sends. Never hand-set
`telegram_message_id` or `notified_telegram` to `true` yourself.

### 2.2 `data/alertqueue.json`

```json
{
  "instructions": "...",
  "queue": [
    {
      "link": "https://official-program-page",
      "note": "optional context from whoever submitted it",
      "submitted_by": "optional name/handle",
      "submitted_date": "YYYY-MM-DD",
      "status": "pending"
    }
  ]
}
```

Anyone (including via a PR from someone other than the site owner) can add
an entry with just a `link` — this is the community-facing "please track
this program" inbox. See Step 2 below for how you process it.

---

## 3. Scripts already in the repo

### 3.1 `scripts/build_excel.py`

Regenerates `data/tracker.xlsx` (README / Programs / Change Log sheets)
from `data/tracker.json`. Run after every edit to the JSON:
```
python apps/EconGradAlert/scripts/build_excel.py
```
Requires only `openpyxl`. Never hand-edit `tracker.xlsx` — it's fully
derived and gets overwritten.

### 3.2 `scripts/telegram_sync.py`

Reads `data/tracker.json` and, for the `@EconGradAlerts` channel:
- posts a new message for any program with `telegram_message_id: null`,
  saving the returned message ID back into that field;
- for programs that already have a post, replies into that message's thread
  with a bundled summary of any `change_log` entries where
  `notified_telegram` is still `false`;
- replies into the thread when `notified_30day` / `notified_7day` just
  tripped `true` and hasn't been announced yet (`telegram_notified_30day` /
  `telegram_notified_7day` still `false`).

It saves `tracker.json` after every message it sends (so a crash or rate
limit mid-run loses no progress — just re-run it) and paces sends to avoid
Telegram's rate limits. Run it after Step 6 (Excel regen) and before Step 7
(commit), so the message-ID/notified state it writes gets committed:
```
python apps/EconGradAlert/scripts/telegram_sync.py
```
Reads the bot token + chat ID from `githide/config.json` — don't print or
otherwise surface that file's contents. `--dry-run` prints what would be
sent without calling the API or touching `tracker.json`; useful if you want
to sanity-check formatting for an unusual entry before it actually
publishes to the channel.

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
Read `apps/EconGradAlert/data/tracker.json` and `data/alertqueue.json`.
Parse `tracker.json` against the schema in §2.1. If anything about the file
doesn't match that schema, treat §2.1 as authoritative and fix the file to
match as part of this run.

**Step 2 — Process the alert queue**
For each entry in `alertqueue.json` with `status: "pending"` (or no
`status` field at all, which counts as pending):
- Fetch the `link`. Judge whether it's a genuine funded Economics Master's
  or PhD program (scholarship, stipend, tuition waiver, or paid
  assistantship — same bar as Step 3c below) that isn't already tracked
  (check existing `programs[].link` and name/university for duplicates).
- **If it qualifies:** research it fully and add it to `tracker.json`
  following the same process as Step 4's "new programs" rules, with
  `change_type: "Added (requested)"` in its change_log entry, and mention
  in `notes` that it was requested (credit `submitted_by` if given, e.g.
  "Requested via alertqueue.json by Jane on 2026-08-20."). Then **remove
  the entry from `alertqueue.json`'s `queue` array** — the tracker entry
  and change_log are now the permanent record of it.
- **If it doesn't qualify** (unfunded, wrong field, page unreachable,
  already tracked, etc.): leave the entry in the queue but set
  `"status": "needs-review"` and add an `"agent_note"` field with a short
  reason, so a human can follow up. Don't delete entries you can't resolve.
- If the queue is empty, skip this step.

**Step 3 — Re-research**
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

**Step 4 — Update the data**
For every program you added or changed (in Step 2 or Step 3):
- Update `last_updated` to today and set `last_change` to a short
  description.
- Append one `change_log` entry (date, program id/name, `change_type`,
  one-sentence `details`, `notified_telegram: false`).
- New programs: next unused ID in that region's sequence, all fields filled
  in the same style as existing entries, `notified_30day`/`notified_7day`/
  `telegram_notified_30day`/`telegram_notified_7day` set to `false`,
  `telegram_message_id` set to `null`, `date_added`/`last_updated` set to
  today, `last_change` = "Added (new find)" or "Added (requested)" as
  applicable.
- Re-assess `urgency` per the rules in §2.1, using today's date and your own
  judgment reading the free-text `deadline` field.
- Update `meta.last_full_update` and `meta.program_count`.

**Step 5 — Deadline reminder flags**
For every program with a genuinely identifiable upcoming deadline: if it's
within 30 days of today and `notified_30day` is `false`, set it to `true`.
If within 7 days and `notified_7day` is `false`, set it to `true`. Never
re-notify once a flag is already `true` — unless the deadline materially
changes, in which case reset both flags to `false` for that program. (Only
set `notified_30day`/`notified_7day` here — leave the `telegram_notified_*`
counterparts alone; `telegram_sync.py` owns those.)

**Step 6 — Regenerate the Excel file**
Validate the rewritten JSON actually parses, then run:
```
python apps/EconGradAlert/scripts/build_excel.py
```
Confirm it completes without error and `data/tracker.xlsx` is updated.

**Step 7 — Sync to Telegram**
Run:
```
python apps/EconGradAlert/scripts/telegram_sync.py
```
This posts new programs and replies with updates/reminders on
`@EconGradAlerts`, and rewrites `tracker.json` with the resulting
`telegram_message_id` / `notified_telegram` / `telegram_notified_*` state.
Confirm it exits cleanly. If it errors partway (e.g. a network blip), it's
safe to just re-run — already-sent messages are never re-sent.

**Step 8 — Commit and publish**
- `git checkout -b econgrad-update-<YYYY-MM-DD>`
- `git add apps/EconGradAlert/data/tracker.json apps/EconGradAlert/data/tracker.xlsx apps/EconGradAlert/data/alertqueue.json`
  (stage nothing else — double-check `git status` shows only these three
  files before committing)
- `git commit -m "Econ ledger update <YYYY-MM-DD>: N added, M updated, K reminder flags"`
- `git push -u origin econgrad-update-<YYYY-MM-DD>`
- Open a pull request against `main` (e.g. `gh pr create --fill` if the
  `gh` CLI is available; otherwise leave the branch pushed and note the
  branch name in your final summary so the user can open the PR
  themselves).

Do **not** push straight to `main` and do **not** merge the PR yourself —
leave that for the user to review, at least for the first several runs (see
§7). Do not touch `apps/EconGradAlert/index.html` or the `scripts/` folder,
or anything outside `apps/EconGradAlert/data/` unless explicitly asked to —
and never touch anything outside `apps/EconGradAlert/` at all. Note that by
this point `telegram_sync.py` has already sent real messages to a real
channel — that already happened in Step 7 regardless of whether this PR
gets merged, so don't treat "PR not yet merged" as a reason to redo or skip
Step 7 next run; it's idempotent per-program, not per-PR.

**Step 9 — Finish**
Print a short summary of what you did (queue entries processed, counts
added/updated/reminder-flagged, Telegram messages sent, PR branch name if
applicable) as your final output.

---

## 5. Telegram message formats (for reference — `telegram_sync.py` implements these)

- **New program post:** program name, university/city/country, degree,
  region, deadline, funding status + detail, requirements (IELTS/TOEFL/GRE/
  refs), RePEc rank, notes, and a link to the official page. This is the
  root message of that program's thread.
- **Update reply:** bundles all pending `change_log` entries for that
  program since its last Telegram sync into one reply, each as a bullet
  with its `change_type` and `details`.
- **Reminder reply:** a short "N-day deadline reminder" message with the
  program name, university, and deadline text.

---

## 6. Running it manually (to test, before scheduling anything)

From the repo root (`heydari-msadra.github.io/`):
```
claude -p "$(cat apps/EconGradAlert/AGENT_TASK.md)"
```
Watch it work interactively the first few times before trusting it to run
unattended. Confirm: the JSON stays valid, `tracker.xlsx` regenerates
cleanly, the diff touches only `apps/EconGradAlert/data/*`, Telegram
messages land correctly on the channel, and the PR opens (not a direct
push).

For unattended runs you'll need to skip interactive permission prompts —
either a scoped permissions file (safer: allow-list exactly `git`,
`python`, web search/fetch, and edits within `apps/EconGradAlert/` — see
`agent-settings.json` in this folder, already set up this way) or, more
bluntly, `claude -p "..." --dangerously-skip-permissions`. Check
`claude --help` for current flag names before relying on either.

---

## 7. Safety notes — please read before automating this unattended

- **Start on the PR workflow, not auto-merge.** Step 8 above deliberately
  opens a pull request instead of pushing to `main`. Review each PR
  yourself for the first several cycles — a bad research pass (a
  hallucinated deadline, a broken link) should not go live on your public
  page unreviewed. Note this only gates the *data file* going live on the
  dashboard — Telegram messages (Step 7) already went out to a live
  audience before the PR exists, so mistakes there aren't undone by
  withholding the merge.
- **Scope stays narrow, always.** This agent's entire world is
  `apps/EconGradAlert/`. It should never need to read or write anything
  else in the site repo. If it ever proposes touching another file, that's
  a bug in the run — stop and investigate rather than approving it.
- **Secrets stay untouched.** `apps/EconGradAlert/githide/config.json` is
  git-ignored and holds the live Telegram bot token + chat ID. Only
  `telegram_sync.py` reads it programmatically — never open, print, or
  otherwise surface its contents yourself.
- **Telegram sends are real and public immediately.** Unlike the data file
  (gated behind a PR review), `telegram_sync.py` posts straight to a real
  channel with real subscribers, no review step. Don't invent test/dummy
  change_log entries to "see what a reply looks like" — that sends a real
  message. If you genuinely need to sanity-check formatting, use
  `telegram_sync.py --dry-run` instead.
