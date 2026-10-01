# Capability 3 — Workout Navigation

**Status:** Implemented and tested.  
**Depends on:** Capability 2 — done. See `docs/capability-2-set-completion-progression.md`.  
**Architecture:** Transcript → `parseVoiceCommand` → `WorkoutCommand` → `applyCommand`. Queries emit no command.

The parser answers what the user said. The engine performs the move. New engine commands are allowed when the current command union cannot express the user action.

---

## Goal

The user can ask where they are, skip a set, skip or jump to the next exercise, and go back to the previous exercise — without logging reps.

Logging still advances the cursor (capability 2). Navigation is the explicit path when they are not reporting a set.

---

## User behavior

| Utterance | Parser | Engine |
|-----------|--------|--------|
| `"What's next?"` | `WHAT_NEXT`, no command | No mutation. `describeNextAction(state)` answers from current position. |
| `"Next exercise."` / `"Go to the next one."` / `"next"` | `NEXT_EXERCISE` | Remaining pending sets on this exercise skipped; next exercise current. Fails on last exercise. |
| `"Next set."` | `SKIP_SET` | Current set skipped; cursor to next set (or next exercise). **Change from today**, where `"next set"` was `NEXT_EXERCISE`. |
| `"Skip this set."` | `SKIP_SET` | Same as above. |
| `"Skip exercise."` | `SKIP_EXERCISE` | Current exercise skipped; next exercise or workout complete. |
| `"Skip this."` / `"Skip."` | `AMBIGUOUS` | Do not apply. |
| `"Previous exercise."` / `"Go back."` | `PREVIOUS_EXERCISE` | New command. Move to previous exercise. Completed sets stay completed. Sets skipped while leaving (or otherwise skipped) become `PENDING` again so the user can continue. Cursor is the first pending set. Fails on the first exercise. |

`"Repeat that."` stays out of scope (ambiguous between undo and re-log). Capability 5.

---

## Engine changes

1. **`PREVIOUS_EXERCISE` command** — required; the union cannot go backward today.
2. **`describeNextAction(state)`** on the engine — single source for “what’s next” used by CLI and tests. No voice knowledge.
3. **Undo** — `PREVIOUS_EXERCISE` is undoable (same snapshot pattern as `NEXT_EXERCISE`).
4. **Event** — `EXERCISE_RESUMED` with `exerciseId` when going back.

Skip/rest coupling is unchanged.

---

## Parser changes

- `"go to the next one"`, `"next one"` → `NEXT_EXERCISE`
- `"next set"` → `SKIP_SET` (not `NEXT_EXERCISE`)
- `"previous exercise"`, `"go back"`, `"previous"` → `PREVIOUS_EXERCISE`
- `"skip this exercise"` → `SKIP_EXERCISE`
- Keep `"what's next?"` as a non-mutating intent
- Keep bare `"skip"` / `"skip this"` ambiguous

---

## Tests

**Engine:** `PREVIOUS_EXERCISE` from exercise 2; fail on exercise 1; undo restores; `describeNextAction` for not started / active set / completed.

**Parser:** phrase table including the `"next set"` mapping change.

**E2E:** transcript → `workoutContextFromState` → command → `applyCommand` for what’s next, next exercise, next set, skip exercise, go back, last-exercise next fails, skip this stays ambiguous.

---

## Out of scope

- Full query suite (sets left, last weight) — capability 6
- Pause / resume — capability 4
- Repeat that / corrections — capability 5
- Un-skipping is only for `PREVIOUS_EXERCISE` (so leftover skipped sets can be trained). Explicit skip of a set on the current exercise is unchanged until the user goes away and back.

---

## What was implemented

- Engine: `PREVIOUS_EXERCISE`, `EXERCISE_RESUMED`, `describeNextAction`
- Parser: next-one / go-to-the-next-one, next set → `SKIP_SET`, go back / previous exercise
- CLI uses engine `describeNextAction`
- Tests: engine, parser, `e2e-navigation.test.ts`

`"one"` is normalized to `1`, so next-one patterns also match `next 1`.

## Definition of done

- In-scope phrases parse and apply
- `PREVIOUS_EXERCISE` exists and is tested
- `"next set"` skips a set, `"next exercise"` skips the rest of the exercise
- What’s next does not mutate
- Docs updated
