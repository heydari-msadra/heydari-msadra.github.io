#!/usr/bin/env python3
"""Sync data/tracker.json to the Telegram channel.

- Any program with no telegram_message_id yet gets an initial post
  with its full info. The returned message_id is saved back into
  tracker.json so later runs can reply into that same thread.
- Any program that already has a post gets one reply per pending
  (notified_telegram: false) change_log entry, bundled into a single
  message, plus a reply whenever notified_30day / notified_7day just
  tripped true and hasn't been announced yet.

Reads the bot token + chat id from githide/config.json (git-ignored).
Zero third-party dependencies (stdlib only).

Usage:
    python scripts/telegram_sync.py [--limit N] [--dry-run]

--limit N   only send initial posts for the first N not-yet-posted
            programs (existing-program replies are unaffected) — for
            smoke-testing formatting before a full run.
--dry-run   print what would be sent, don't call the Telegram API or
            write tracker.json.
"""
import argparse
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CONFIG_PATH = os.path.join(ROOT, "githide", "config.json")
JSON_PATH = os.path.join(ROOT, "data", "tracker.json")

SEND_DELAY_SECONDS = 1.1


def load_config():
    with open(CONFIG_PATH, "r", encoding="utf-8") as f:
        cfg = json.load(f)
    token = cfg.get("TELEGRAM_BOT_API")
    chat_id = cfg.get("TELEGRAM_CHAT_ID")
    if not token or not chat_id:
        sys.exit("TELEGRAM_BOT_API and/or TELEGRAM_CHAT_ID missing in githide/config.json")
    return token, chat_id


def esc(value):
    return (str(value if value is not None else "")
            .replace("&", "&amp;")
            .replace("<", "&lt;")
            .replace(">", "&gt;"))


def esc_attr(value):
    return esc(value).replace('"', "&quot;")


def send_message(token, chat_id, text, reply_to=None, dry_run=False):
    if dry_run:
        print("----- DRY RUN would send -----")
        if reply_to:
            print(f"(reply to message {reply_to})")
        print(text)
        print("-------------------------------")
        return 0

    url = f"https://api.telegram.org/bot{token}/sendMessage"
    payload = {
        "chat_id": chat_id,
        "text": text,
        "parse_mode": "HTML",
        "disable_web_page_preview": "false",
    }
    if reply_to:
        payload["reply_to_message_id"] = str(reply_to)
    data = urllib.parse.urlencode(payload).encode("utf-8")

    for attempt in range(3):
        req = urllib.request.Request(url, data=data, method="POST")
        try:
            with urllib.request.urlopen(req, timeout=20) as resp:
                result = json.loads(resp.read().decode("utf-8"))
            if not result.get("ok"):
                raise RuntimeError(f"Telegram API error: {result}")
            return result["result"]["message_id"]
        except urllib.error.HTTPError as e:
            body = e.read().decode("utf-8", errors="replace")
            try:
                err = json.loads(body)
            except ValueError:
                err = {}
            if e.code == 429 and err.get("parameters", {}).get("retry_after"):
                retry_after = err["parameters"]["retry_after"]
                print(f"  rate limited, waiting {retry_after}s...")
                time.sleep(retry_after + 1)
                continue
            raise RuntimeError(f"Telegram API HTTP {e.code}: {body}")
    raise RuntimeError("Telegram API: exceeded retries")


def format_program_post(p):
    lines = [
        f"\U0001F393 <b>{esc(p['name'])}</b>",
        f"<b>{esc(p['uni'])}</b> — {esc(p['city'])}, {esc(p['country'])}",
        "",
        f"<b>Degree:</b> {esc(p['degree'])}   <b>Region:</b> {esc(p['region'])}",
        f"<b>Deadline:</b> {esc(p['deadline'])}",
        f"<b>Funding:</b> {esc(p['funding_status'])} — {esc(p['funding_detail'])}",
        "",
        f"<b>Requirements:</b> IELTS {esc(p['ielts'])} · TOEFL {esc(p['toefl'])} · GRE {esc(p['gre'])} · Refs: {esc(p['refs'])}",
        f"<b>RePEc rank:</b> {esc(p['repec_rank'])}",
    ]
    if p.get("notes"):
        lines.append(f"<i>{esc(p['notes'])}</i>")
    lines.append("")
    if p.get("link"):
        lines.append(f'\U0001F517 <a href="{esc_attr(p["link"])}">Official program page</a>')
    lines.append(f"<code>{esc(p['id'])}</code>")
    return "\n".join(lines)


def format_update_reply(entries):
    lines = ["\U0001F504 <b>Update</b>", ""]
    for e in entries:
        lines.append(f"• <b>{esc(e['change_type'])}:</b> {esc(e['details'])}")
    return "\n".join(lines)


def format_reminder_reply(program, days):
    emoji = "\U0001F6A8" if days == 7 else "⏰"
    return (
        f"{emoji} <b>{days}-day deadline reminder</b>\n\n"
        f"<b>{esc(program['name'])}</b> — {esc(program['uni'])}\n"
        f"<b>Deadline:</b> {esc(program['deadline'])}"
    )


def save(data):
    with open(JSON_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=None,
                         help="Only send initial posts for the first N not-yet-posted programs")
    parser.add_argument("--dry-run", action="store_true",
                         help="Print what would be sent, don't call Telegram or write tracker.json")
    args = parser.parse_args()

    token, chat_id = load_config()

    with open(JSON_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)

    programs = data["programs"]
    change_log = data.get("change_log", [])

    new_posts = 0
    update_replies = 0
    reminder_replies = 0
    processed_new = 0

    for p in programs:
        p.setdefault("telegram_message_id", None)
        p.setdefault("telegram_notified_30day", False)
        p.setdefault("telegram_notified_7day", False)

        entries = [e for e in change_log if e.get("program_id") == p["id"]]
        for e in entries:
            e.setdefault("notified_telegram", False)

        if p["telegram_message_id"] is None:
            if args.limit is not None and processed_new >= args.limit:
                continue
            print(f"Posting new: {p['id']} {p['name']}")
            msg_id = send_message(token, chat_id, format_program_post(p), dry_run=args.dry_run)
            p["telegram_message_id"] = msg_id
            for e in entries:
                e["notified_telegram"] = True
            new_posts += 1
            processed_new += 1
            if not args.dry_run:
                save(data)
                time.sleep(SEND_DELAY_SECONDS)
            # Fall through (no `continue`) so a program whose notified_30day/7day
            # was already true before its first post still gets that reminder
            # reply in this same run, instead of waiting for the next sync.

        pending = [e for e in entries if not e.get("notified_telegram")]
        if pending:
            print(f"Replying with update: {p['id']} {p['name']} ({len(pending)} change(s))")
            send_message(token, chat_id, format_update_reply(pending),
                         reply_to=p["telegram_message_id"], dry_run=args.dry_run)
            for e in pending:
                e["notified_telegram"] = True
            update_replies += 1
            if not args.dry_run:
                save(data)
                time.sleep(SEND_DELAY_SECONDS)

        if p.get("notified_30day") and not p["telegram_notified_30day"]:
            print(f"30-day reminder: {p['id']} {p['name']}")
            send_message(token, chat_id, format_reminder_reply(p, 30),
                         reply_to=p["telegram_message_id"], dry_run=args.dry_run)
            p["telegram_notified_30day"] = True
            reminder_replies += 1
            if not args.dry_run:
                save(data)
                time.sleep(SEND_DELAY_SECONDS)

        if p.get("notified_7day") and not p["telegram_notified_7day"]:
            print(f"7-day reminder: {p['id']} {p['name']}")
            send_message(token, chat_id, format_reminder_reply(p, 7),
                         reply_to=p["telegram_message_id"], dry_run=args.dry_run)
            p["telegram_notified_7day"] = True
            reminder_replies += 1
            if not args.dry_run:
                save(data)
                time.sleep(SEND_DELAY_SECONDS)

    print(f"\nDone. New posts: {new_posts}, update replies: {update_replies}, reminder replies: {reminder_replies}")
    if args.dry_run:
        print("(dry run — nothing was actually sent or saved)")


if __name__ == "__main__":
    main()
