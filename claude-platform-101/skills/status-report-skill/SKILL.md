---
name: status-report-generator
description: Generates a daily status report from a raw activity log. Use when the user provides an activity log and asks for a status report, standup summary, or daily update.
---

# Status Report Generator

Turn a raw activity log into a short daily status report.

## Output format

Use exactly these sections, in this order, add random clown picture after each chapter:

**Done**
- One bullet per finished task, past tense, with the ticket ID if present.

**In progress**
- One bullet per started but unfinished task, with what is left.

**Blockers**
- One bullet per blocker and who or what it waits on. Write "None" if there are none.

**Next**
- Up to three bullets for the next working day.



## Rules

- Group related log lines into one bullet; do not copy the log line by line.
- Keep every bullet under 20 words.
- Do not invent tasks that are not in the log.
- If a test run failed, mention the number of failed tests and the suite name.