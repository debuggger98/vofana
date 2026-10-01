# Capability 6 — Workout Queries

**Status:** Implemented and tested.  
**Depends on:** Capability 2 (accurate cursor / last completed set).  
**Architecture:** Transcript → `parseVoiceCommand` (no `WorkoutCommand`) → `answerQuery(state, intent)`.

Parser and engine are improved together. Queries never call `applyCommand`.

---

## Goal

The user can ask where they are and what they just logged. Answers come from workout state, not from guessing.

---

## User behavior

| Utterance | Intent | Answer source |
|-----------|--------|----------------|
| `"What's next?"` | `WHAT_NEXT` | Existing `describeNextAction` (paused → resume, etc.) |
| `"How many sets are left?"` | `SETS_REMAINING` | Pending sets on the current exercise, plus workout total when different |
| `"What weight did I use?"` | `LAST_WEIGHT` | Last completed set actual weight |
| `"How many reps did I do?"` | `LAST_REPS` | Last completed set actual reps |
| `"What exercise am I on?"` | `CURRENT_EXERCISE` | Current exercise name |
| `"Which set am I on?"` | `CURRENT_SET` | Current exercise + set number |

No completed set → last weight/reps say so. No pending sets → sets remaining says none. State version and cursor unchanged.

Out of scope: calories, form cues, `"how do I bench?"` (still `UNSUPPORTED`).

---

## Parser

- New status `QUERY` (replaces using `UNSUPPORTED` for `"what's next?"`).
- No command. `interpretation.intent` is the query id.
- Query patterns run **before** the out-of-scope gate so `"what is …"` workout questions are not swallowed.
- `"what am I doing next?"` stays `WHAT_NEXT`; `"what am I doing?"` is `CURRENT_EXERCISE`.

---

## Engine

- `answerQuery(state, intent)` — strings only; no events, effects, or version bump.
- `describeNextAction` remains the `WHAT_NEXT` answer (CLI position line unchanged).

---

## Tests

Engine: each intent on an active workout; last-weight with no log; sets remaining after a log; query does not change state.

Parser: roadmap phrases → `QUERY` + intent; `"what's next?"` status is `QUERY`; protein/joke still `UNSUPPORTED`.

E2E: transcript → query → `answerQuery`; `applyCommand` not used; version unchanged.

---

## Out of scope

- `"How long have I been resting?"` / rest remaining
- Planned vs last weight (`"what should I use?"`)
- Capability 7 loose phrasing
