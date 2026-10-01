# @vofana/workout-engine

Pure, deterministic TypeScript domain package for managing active strength-training workout state.

This package is the core state machine underneath the voice-first fitness app. It has **no dependencies** on voice, UI, databases, or network services.

## Architecture

```
Voice / UI / API / Watch
         │
         ▼
   Workout Command
         │
         ▼
   applyCommand(state, command)
         │
         ▼
   { state, events, effects, recommendations }
```

The engine is a pure reducer:

- **State** — what is true right now
- **Commands** — what someone wants to do
- **Events** — what actually happened (for persistence/analytics)
- **Effects** — side effects to execute externally (timers, TTS, etc.)
- **Recommendations** — progression suggestions (do not mutate state)

## State Model

`WorkoutState` includes:

- Session/workout identifiers (`sessionId`, `userId`, `workoutId`)
- `status`: `NOT_STARTED` | `ACTIVE` | `PAUSED` | `COMPLETED` | `CANCELLED`
- Current position (`currentExerciseIndex`, `currentSetIndex`)
- `exercises[]` with planned targets and per-set actuals
- `completedSets[]` denormalized log of completed work
- `restState` (engine does not run timers)
- `version` for optimistic sync / debugging
- `processedCommandIds` for idempotency

## Commands

| Command | Description |
|---------|-------------|
| `START_WORKOUT` | Begin an active session |
| `PAUSE_WORKOUT` / `RESUME_WORKOUT` | Pause/resume |
| `COMPLETE_SET` | Log weight/reps for current set |
| `EDIT_SET` | Correct a completed set (`ACTIVE` or `PAUSED`) |
| `UNDO` | Revert most recent undoable mutation |
| `SKIP_SET` / `SKIP_EXERCISE` | Skip without completing |
| `CHANGE_WEIGHT` / `CHANGE_REPS` | Update planned targets for current pending set |
| `START_REST` / `SKIP_REST` / `CHANGE_REST` | Rest timer effects |
| `NEXT_EXERCISE` | Manually advance, skipping remaining pending sets |
| `PREVIOUS_EXERCISE` | Return to the previous exercise at its first pending set |
| `END_WORKOUT` / `CANCEL_WORKOUT` | Finish or abort |

## Undoable Operations

The engine keeps a single-level undo snapshot for:

- `COMPLETE_SET`
- `SKIP_SET`
- `SKIP_EXERCISE`
- `EDIT_SET`
- `CHANGE_WEIGHT`
- `CHANGE_REPS`
- `NEXT_EXERCISE`
- `PREVIOUS_EXERCISE`

`UNDO` restores the snapshot from before the most recent undoable command.

## Queries

`answerQuery(state, intent)` returns a string from current state. It does not mutate. Intents: `WHAT_NEXT`, `SETS_REMAINING`, `LAST_WEIGHT`, `LAST_REPS`, `CURRENT_EXERCISE`, `CURRENT_SET`. `describeNextAction` is the `WHAT_NEXT` answer.

## Example Usage

```typescript
import {
  createWorkout,
  applyCommand,
  getCurrentExercise,
  getCurrentSet,
} from "@vofana/workout-engine";

const state = createWorkout({
  sessionId: "sess-1",
  userId: "user-1",
  workoutId: "wo-1",
  exercises: [
    {
      exerciseId: "bench",
      name: "Bench Press",
      order: 0,
      target: { sets: 3, reps: { min: 8, max: 10 }, weightKg: 60 },
    },
  ],
});

let result = applyCommand(state, { type: "START_WORKOUT" });
result = applyCommand(result.state, {
  type: "COMPLETE_SET",
  weightKg: 60,
  reps: 10,
  source: "VOICE",
});

console.log(result.state);
console.log(result.events);   // SET_COMPLETED, REST_STARTED, ...
console.log(result.effects);  // [{ type: "START_REST_TIMER", durationSeconds: 90 }]
console.log(result.recommendations); // [{ type: "INCREASE_WEIGHT", ... }]
```

## Progression

`getProgressionRecommendation()` in `progression.ts` implements a conservative MVP rule:

- Hit top of rep range → suggest +2.5 kg next session
- Far below minimum → suggest reducing load
- Otherwise → maintain current weight

Recommendations are returned from `COMPLETE_SET` but do not change workout state.

## Testing

```bash
pnpm test
pnpm typecheck
```

Tests cover unit transitions, invalid inputs, idempotency, determinism, and realistic workout scenarios.

## Design Constraints

- Pure functions, immutable state transitions
- No `fetch`, timers, DB, Express, React Native, or AI SDKs
- Typed domain errors (no thrown exceptions for normal invalid commands)
- Portable to Node.js and React Native
