# Capability 2 — Set Completion and Workout Progression

**Status:** Implemented and tested.  
**Depends on:** Capability 1 (robust set logging) — done. See `docs/capability-1-robust-set-logging.md`.  
**Architecture:** Unchanged. Transcript → `parseVoiceCommand` → `WorkoutCommand` → `applyCommand`.

---

## Goal

After the user logs a set by voice, the workout cursor must be correct:

1. next pending set of the same exercise, or
2. first set of the next exercise, or
3. workout `COMPLETED` when nothing remains.

The user should not have to say “next set” after a successful log. Logging **is** completion.

---

## User behavior (in scope)

| Situation | After a successful log |
|-----------|------------------------|
| More sets left on this exercise | Current position is the next pending set |
| Last set of this exercise, more exercises remain | This exercise is `COMPLETED`; next exercise is `IN_PROGRESS`, set 1 |
| Last set of the last exercise | Workout status is `COMPLETED`; no current set |
| Mid-workout log | Rest timer effect starts (existing complete-set behavior) |
| Log that finishes the workout | Rest timer does **not** start |

Out of scope for this capability (belongs to 3 / 4 / 5):

- `"What's next?"`, `"next exercise"`, `"skip this"`, `"go back"`
- Pause / resume
- Corrections / undo as the primary action (undo must still restore cursor if we touch progression)

---

## What already exists

The state machine already implements this path. Capability 1 only made more transcripts emit `COMPLETE_SET`. Progression itself lives in the engine:

```text
COMPLETE_SET
  → resolve weight/reps
  → mark current set COMPLETED
  → advanceAfterSetAction()
      → next set index, or
      → EXERCISE_COMPLETED + next exercise, or
      → stay on last exercise
  → completeWorkoutIfDone()
  → START_REST_TIMER if workout still ACTIVE
```

Covered today with **structured** commands (`packages/workout-engine/tests/`):

- complete set 1 → set 2
- last set of exercise 1 → incline, set 1, `EXERCISE_COMPLETED`
- last set of last exercise → `COMPLETED`
- skip set / skip exercise also call `advanceAfterSetAction`

**Gap:** transcript → parser → engine is only asserted for **the first set of the first exercise** (`e2e-set-logging.test.ts`). Multi-set, exercise boundary, and workout-complete via voice are not proven.

---

## Observed gaps (do not “redesign” around these)

1. **E2E hole** — logging phrases are not tested through a full 3-set exercise or a full workout.
2. **CLI context** — `session.ts` rebuilds `WorkoutContext` from `WorkoutState` after each command. That should already track the cursor; it needs an automated check so the *second* `"Finished 10"` hits set 2, not set 1.
3. **Skip vs rest** — `COMPLETE_SET` starts rest; `SKIP_SET` advances but does not start or stop rest. If rest was already `RUNNING`, it stays `RUNNING` after skip. Treat as existing model unless tests show it breaks logging progression. Do not change skip/rest in this capability unless a progression test cannot pass without it.
4. **`CHANGE_WEIGHT` is per current pending set** — the next set still has the original planned weight. That is not progression; leave it.
5. **Parser** — no new intent. `"next"` / `"next set"` still map to `NEXT_EXERCISE` (capability 3). Do not teach the parser a separate “set completed” command.

---

## Parser vs state machine

| Layer | Role for this capability |
|-------|--------------------------|
| Parser | Unchanged except if an in-scope logging phrase fails to emit `COMPLETE_SET` (regression of capability 1). |
| Engine | Source of truth for cursor, exercise status, workout status, events, rest-on-complete. Change only if a real progression bug is found. |
| CLI | Must pass **updated** context into the parser after every successful command. No new architecture. |

The parser must not decide “move to next exercise.” `COMPLETE_SET` already means “this set is done”; the engine moves the cursor.

---

## Plan of work

### Step 1 — Write the contract as tests (first)

Add transcript → parser → `applyCommand` (loop, updating context from the new state) for:

1. Three logs on a 3-set exercise → `currentExerciseIndex` unchanged until the third; after the third, next exercise, set 0, previous exercise `COMPLETED`, `EXERCISE_COMPLETED` event.
2. Continue until the last set of the last exercise → `status === "COMPLETED"`, `WORKOUT_COMPLETED`, no `START_REST_TIMER` on that last command.
3. Mixed phrases from capability 1 (`"Finished 10."`, `"I did 8."`, `"10 reps."`) so progression is not tied to one utterance shape.
4. After set 1, a second log uses context from **updated** state (`currentSet.setNumber === 2`, `previousCompletedSet` present).

Prefer extending `packages/voice-parser/tests/` (parser already depends on the engine) or a dedicated `e2e-progression.test.ts`. Keep engine unit tests as the structured-command baseline; do not duplicate every engine case in the parser package.

### Step 2 — Fix only failures those tests expose

Likely outcomes:

- **Tests pass with no engine change** — capability is validation + docs. That is a valid completion.
- **Context mapping bug in CLI/helpers** — fix `toWorkoutContext` (or share a small mapper used by tests and CLI) so `previousCompletedSet` / `currentSet` match engine position.
- **Engine cursor bug** — smallest fix in `advanceAfterSetAction` / `completeWorkoutIfDone` only. Do not add commands.

### Step 3 — Rest on the completion path only

Assert:

- Non-final `COMPLETE_SET` → `restState.status === "RUNNING"` and `START_REST_TIMER`.
- Workout-completing `COMPLETE_SET` → no new rest timer.

Do not implement skip-rest coupling here.

### Step 4 — CLI / human check

Pipe a short workout through `pnpm --filter cli voice:workout:text` and confirm the printed `position` line moves set → exercise → `Workout complete.`

### Step 5 — Document

Update `docs/CAPABILITY_DEVELOPMENT.md` Progress: what was verified, what was fixed (if anything), remaining limitations. Mark this plan doc as done.

---

## Explicit non-goals

- New `WorkoutCommand` types
- Parser support for `"what's next?"` beyond the existing query intent
- Previous exercise / go back
- Auto-inheriting changed weight onto later sets
- LLM / contextual “I just finished my second set”
- Changing skip to start rest

---

## Edge cases to cover

| Case | Expected |
|------|----------|
| Log when `NOT_STARTED` | Engine fails `WORKOUT_NOT_ACTIVE`; state unchanged |
| Log when already `COMPLETED` | Fail; no cursor move |
| Last set of exercise 1 | Next exercise, set 1, rest starts |
| Last set of workout | `COMPLETED`, rest idle / not started |
| Undo after a log that advanced the cursor | Cursor and set status restored (existing undo); add an assertion if missing from e2e |
| Second log without refreshing parser context | Would log the wrong set — tests must refresh context from `result.state` |

---

## Definition of done

- Multi-set and multi-exercise progression proven from transcripts, not only from raw commands
- Workout-complete via logging proven
- Rest behavior on complete vs workout-complete asserted
- No architecture change
- `docs/CAPABILITY_DEVELOPMENT.md` updated with actual results
- Known limitations recorded (skip/rest, `CHANGE_WEIGHT` not propagating, navigation still capability 3)

---

## What was implemented

No parser intent and no engine transition changes. Progression already lived in `advanceAfterSetAction` / `completeWorkoutIfDone`.

Shared `workoutContextFromState` (`packages/voice-parser/src/from-state.ts`) so tests and the CLI rebuild parser context from the latest `WorkoutState` after every command.

Tests: `packages/voice-parser/tests/e2e-progression.test.ts`

- Second `"Finished 10."` uses set 2 context (`previousCompletedSet` present)
- Mixed phrases across a 3-set exercise → next exercise, `EXERCISE_COMPLETED`, rest starts
- Full workout via logs → `COMPLETED`, `WORKOUT_COMPLETED`, no `START_REST_TIMER` on the last command
- Undo restores cursor after a log
- `NOT_STARTED` / already `COMPLETED`: engine rejects (`WORKOUT_NOT_ACTIVE`); state unchanged. The parser may still emit `COMPLETE_SET` (it does not gate on workout status).

CLI text loop: Bench 1→2→3 → Incline → Squat → `Workout complete.`

**Engine not changed.** Leftover `restState.status === "RUNNING"` after workout complete is unchanged (no new rest timer is started). Skip still does not start/stop rest. `CHANGE_WEIGHT` still applies only to the current pending set.

---

## Recommended implementation order

1. Tests (step 1)  
2. Fixes only if red (step 2–3)  
3. CLI smoke (step 4)  
4. Docs (step 5)  

Do not start capability 3 until this is green and documented.
