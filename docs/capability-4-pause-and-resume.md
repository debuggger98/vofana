# Capability 4 — Pause and Resume

**Status:** Implemented and tested.  
**Depends on:** none strictly.  
**Architecture:** Transcript → `parseVoiceCommand` → `PAUSE_WORKOUT` / `RESUME_WORKOUT` → `applyCommand`.

Parser and engine are improved together.

---

## Goal

The user can pause the session (phone call, rest beyond the timer, spotting someone) and continue later without losing cursor or logs.

---

## User behavior

| Utterance | Result |
|-----------|--------|
| `"Pause."` / `"Pause the workout."` / `"Hold on."` / `"Wait."` | `PAUSE_WORKOUT` |
| `"Resume."` / `"Continue."` / `"Keep going."` | `RESUME_WORKOUT` |
| Pause while already paused | Success, no-op (voice-safe; state unchanged) |
| Resume while already active | Success, no-op |
| Pause/resume when not started, completed, or cancelled | Fail; state unchanged |
| Log a set while paused | Parser may emit `COMPLETE_SET`; engine rejects `WORKOUT_NOT_ACTIVE` |
| `"What's next?"` while paused | No mutation; `describeNextAction` tells the user to resume |

---

## Engine

Existing: `ACTIVE` → `PAUSED` → `ACTIVE`, events `WORKOUT_PAUSED` / `WORKOUT_RESUMED`. Invalid transitions failed.

This capability:

- Idempotent pause/resume (redundant voice repeats do not error or bump version)
- Pause while rest is `RUNNING` emits `STOP_REST_TIMER` (timer should not run while paused)
- Resume while rest is still `RUNNING` in state emits `START_REST_TIMER` again
- Rest status is left `RUNNING` across pause so resume knows to restart the timer
- Pause/resume are not undoable (session control, not a set edit)

---

## Parser

Add aliases: `hold on`, `wait`, `wait a second`, `pause please`, `keep going`, `let's continue`.

`continue` already mapped. Do not treat `"wait"` as a complete-set phrase (no digits).

---

## Tests

Engine: pause/resume happy path, idempotent repeats, rest timer effects, reject from `NOT_STARTED`.

Parser: phrase table.

E2E: transcript pause → log fails → resume → log succeeds; what's next while paused.

---

## Out of scope

- Pausing a single set vs the workout
- Backgrounding the app
- `"take five"` as rest vs pause
