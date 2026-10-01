# Capability Development

## Purpose

The current development phase is focused on improving the existing:

- Voice Parser
- Workout State Machine

The goal is to improve the user's ability to interact with the workout through natural voice, while keeping the existing architecture intact.

This document defines the current development strategy and capability roadmap.

It should be updated as capabilities are completed, changed, or reprioritized.

---

## Current Pipeline

The current end-to-end flow is:

```text
User Speech
    ↓
STT
    ↓
Committed Transcript
    ↓
Voice Parser
    ↓
Workout State Machine
    ↓
Output
```

The current pipeline already works for a small finite set of commands.

The objective of this phase is to progressively expand the behavior of the Voice Parser and Workout State Machine.

---

## Current Repository State

This section describes what actually exists. It is not a plan.

### Packages

| Package | Role |
|---------|------|
| `@vofana/voice-parser` | Deterministic transcript → `WorkoutCommand` |
| `@vofana/workout-engine` | Pure reducer: `applyCommand(state, command)` |
| `apps/cli/voice_workout/session.ts` | Mic/text → ElevenLabs STT (voice) or stdin (text) → parser → engine → terminal |

The parser does not mutate workout state. The engine does not interpret natural language. The CLI maps `WorkoutState` into the parser's `WorkoutContext` and applies `PARSED` commands only.

### How the Voice Parser works

1. `parseVoiceCommand({ transcript, context })` in `packages/voice-parser/src/parser.ts`.
2. `normalizeTranscript` lowercases, NFKC-normalizes, strips CJK/fullwidth/ASCII punctuation (keeps decimal points and contractions), maps unit aliases (`kilos` → `kg`), and converts spoken numbers (`fifty six` → `56`).
3. `parseDeterministic` tries query patterns first, then the out-of-scope gate, then undo, correction, navigation, skip, workout control, rest, weight/reps change, complete set.
4. If exactly one matcher returns `PARSED`, that result is used. If several `PARSED` results exist, the highest confidence wins when it is at least `CONTEXT_INFERRED` (0.92).
5. Otherwise the result is `QUERY`, `AMBIGUOUS`, `UNSUPPORTED`, or `INVALID`.

Parser output (`ParseResult`):

- `status`: `PARSED` | `QUERY` | `AMBIGUOUS` | `UNSUPPORTED` | `INVALID`
- `command?`: a `WorkoutCommand` from the workout engine
- `confidence`, `originalTranscript`, `normalizedTranscript`
- `interpretation?` (intent label; queries use this with no command)
- `candidates?` when ambiguous
- `error?`

The parser fills omitted complete-set weight from `WorkoutContext` (planned or previous completed set). It does not invent weight when context has none (`AMBIGUOUS` / `MISSING_WEIGHT`).

### Commands the parser currently supports

| Intent | Example utterances | Command |
|--------|--------------------|---------|
| Complete set | `"60 for 10"`, `"ten"`, `"same for eight"`, `"I did 10 at 60"`, `"60 kilos, got 10"` | `COMPLETE_SET` |
| Correction | `"actually nine"`, `"that was nine"`, `"no, nine"` | `EDIT_SET` (needs `previousCompletedSet.id`) |
| Undo | `"undo"`, `"undo that"` | `UNDO` |
| Next exercise | `"next"`, `"next exercise"` | `NEXT_EXERCISE` |
| What's next / queries | `"what's next?"`, `"how many sets are left?"`, `"what weight did I use?"` | No command; `status = QUERY` |
| Skip set / exercise | `"skip this set"`, `"skip exercise"` | `SKIP_SET` / `SKIP_EXERCISE` |
| Bare skip | `"skip"`, `"skip this"` | `AMBIGUOUS` with both candidates |
| Weight / reps change | `"increase to 65"`, `"make it 65"`, `"change reps to 8"` | `CHANGE_WEIGHT` / `CHANGE_REPS` |
| Rest | `"start rest"`, `"skip rest"`, `"add 30 seconds"` | `START_REST` / `SKIP_REST` / `CHANGE_REST` |
| Workout control | `"start workout"`, `"pause"`, `"resume"`, `"end workout"`, `"finish"` | matching control commands |

### How output reaches the Workout State Machine

`apps/cli/voice_workout/session.ts`:

1. Build a demo workout and `START_WORKOUT`.
2. On each transcript, `parseVoiceCommand` with context derived from current `WorkoutState`.
3. If `status === "QUERY"`, print `answerQuery(state, intent)`; do not call `applyCommand`.
4. If `status === "PARSED"` and `command` is present, `applyCommand(state, command)`.
5. Ambiguous / unsupported / invalid transcripts do not mutate state.

There is no automated transcript → engine test file yet. Engine tests feed structured commands directly. Parser tests stop at `ParseResult`.

### Workout states

`WorkoutStatus`: `NOT_STARTED` | `ACTIVE` | `PAUSED` | `COMPLETED` | `CANCELLED`

Per exercise: `PENDING` | `IN_PROGRESS` | `COMPLETED` | `SKIPPED`  
Per set: `PENDING` | `COMPLETED` | `SKIPPED`  
Rest: `IDLE` | `RUNNING` | `COMPLETED`

### Transitions that exist

`applyCommand` in `packages/workout-engine/src/engine.ts`:

| Command | Effect (when valid) |
|---------|---------------------|
| `START_WORKOUT` | `NOT_STARTED` → `ACTIVE` |
| `PAUSE_WORKOUT` / `RESUME_WORKOUT` | `ACTIVE` ↔ `PAUSED` |
| `COMPLETE_SET` | Completes current pending set; resolves omitted weight/reps from planned values; advances set or exercise; may complete workout; starts rest timer effect |
| `EDIT_SET` | Mutates a completed set by id |
| `UNDO` | Restores last undo snapshot |
| `SKIP_SET` / `SKIP_EXERCISE` | Skip and advance |
| `CHANGE_WEIGHT` / `CHANGE_REPS` | Update planned values on current pending set |
| `START_REST` / `SKIP_REST` / `CHANGE_REST` | Rest state + timer effects |
| `NEXT_EXERCISE` | Advance exercise |
| `END_WORKOUT` / `CANCEL_WORKOUT` | `COMPLETED` / `CANCELLED` |

Invalid transitions return `success: false` and leave state unchanged (typed `WorkoutError`).

### Tests that exist

Voice parser (`packages/voice-parser/tests/`): normalize, complete-set, corrections, navigation, workout-control, ambiguity, parser/weight extraction.

Workout engine (`packages/workout-engine/tests/`): engine unit transitions, commands, corrections, progression, multi-exercise scenarios.

CLI: no automated tests; `pnpm --filter cli voice:workout` (STT) and `voice:workout:text` (typed/piped transcripts).

### Current end-to-end behavior

A hardcoded demo workout (Bench Press → Incline DB Press → Squat) starts `ACTIVE`. Spoken or typed transcripts in the supported set log sets, change weight, correct the last set, undo, skip, and end the workout. ElevenLabs commits are filtered for empty/`undefined` text and English `languageCode` is set.

### Current limitations (relevant to this phase)

- Complete-set logging covers the capability-1 phrases (`Finished 10`, `I did 10 reps at 40 kilos`, `That was 10 with 40`, and similar). Remaining gaps are ordinal/contextual phrasing (`"just finished my second set"`) and weight-only utterances.
- `"next"` / `"next exercise"` skip remaining sets of the current exercise. `"next set"` skips only the current set.
- `"what's next?"`, remaining sets, last weight/reps, current exercise/set are read-only queries. Rest remaining and "what should I use?" are out of scope.
- `"skip this"` is always ambiguous.
- `"hold on"` / `"wait"` pause the workout. `"keep going"` resumes. `"finish"` / `"finish workout"` still end the workout; `"finished 10"` logs a set.
- `"I meant 40"` / `"change that to 45 kilos"` edit the last completed set. `"I accidentally logged that twice"` is `UNDO`. `"repeat that"` is still unmapped.
- Parser still writes resolved weight into `COMPLETE_SET` rather than leaving optional fields to the engine (the engine can already resolve omitted weight/reps). This is the existing boundary and is preserved unless a later capability changes it.
- Completing the last set of the workout does not start a new rest timer, but `restState` may remain `RUNNING` from the previous set. Skip does not start or stop rest.

---

## Development Method

Build **one user capability end-to-end at a time**.

Do not build the entire parser first and then the entire state machine.

For each capability:

```text
User Capability
    ↓
Voice Parser
    ↓
Existing Interface
    ↓
Workout State Machine
    ↓
Output
    ↓
Tests
    ↓
Documentation
```

A capability should be useful from the user's perspective, not merely represent an internal code change.

### Example

User:

> "I did 10 reps at 40 kilos."

The complete capability should allow the system to:

1. understand the utterance,
2. produce the appropriate structured representation,
3. apply it to the current workout state,
4. update the workout correctly,
5. produce the appropriate result.

---

## Parser and State Machine Responsibilities

### Voice Parser

The parser answers:

> What does the user appear to be saying?

It converts the transcript into the structured representation expected by the existing architecture.

### Workout State Machine

The state machine answers:

> Given the parsed information and current workout state, what should happen?

The state machine should not be responsible for interpreting raw natural language.

The parser should not contain unnecessary workout-state logic that belongs to the state machine.

The exact boundary must follow the existing implementation.

---

## Context

Voice commands may depend on workout context.

For example:

> "I did ten."

may be sufficient when the current exercise clearly expects repetitions.

When implementing a capability, consider:

- information in the transcript,
- information in the current workout state,
- what the parser should determine,
- what the state machine should determine,
- whether the utterance is ambiguous,
- whether clarification is required.

Do not invent information when the system cannot determine it reliably.

Correctness is more important than pretending to understand.

---

# Capability Roadmap

The initial roadmap is:

---

## Implementation Plan

Architecture stays: transcript → `parseVoiceCommand` → `WorkoutCommand` → `applyCommand`. No new packages, interpreters, or command types unless a capability cannot be expressed with the existing `WorkoutCommand` union.

### 1. Robust Set Logging — **first to implement**

**User behavior:** Log the current set with natural phrasing. Reps-only uses planned/previous weight. Explicit weight overrides planned weight. Do not invent weight.

**Parser:** Expand complete-set candidates and extractors for `finished` / `completed` / `I did N reps` / `got` / `at` / `with`, including words between reps and weight. Keep `"that was 8"` as `EDIT_SET` when it is a single value and a previous set exists. Treat `"that was 10 with 40"` as `COMPLETE_SET`.

**State machine:** No new commands. Existing `COMPLETE_SET` + `resolveSetValues` already apply and advance.

**Tests:** Parser variations for the roadmap phrases; keep existing `"60 for 10"` / `"ten"` / `"same for eight"`; e2e transcript → `applyCommand` on an active workout. Regression: `"finish"` / `"finish workout"` still `END_WORKOUT`; `"that was nine"` still `EDIT_SET`.

**Edge cases:** No weight in context → `AMBIGUOUS`. Weight-only → not a complete set. `"finish"` vs `"finished 10"`. Correction vs logging for `"that was …"`.

**Depends on:** nothing.

### 2. Set Completion and Workout Progression

**User behavior:** After a logged set, the next pending set (or next exercise, or completed workout) is current.

**Parser:** None required if logging already emits `COMPLETE_SET`.

**State machine:** Already implemented (`advanceAfterSetAction`, `completeWorkoutIfDone`, rest effects). This capability is mostly validation and documenting remaining gaps (e.g. rest still `RUNNING` after skip).

**Tests:** Extend engine/e2e coverage for last set of an exercise and last set of the workout via parsed transcripts.

**Depends on:** 1.

### 3. Workout Navigation

**User behavior:** `"What's next?"`, `"Next exercise."`, `"Go to the next one."`, `"Skip this."`, `"Go back."`, `"Previous exercise."`, `"Repeat that."`

**Parser:** Broader navigation/skip phrasing. `"What's next?"` already a non-mutating intent. `"next set"` maps to `SKIP_SET`.

**State machine:** `NEXT_EXERCISE`, `SKIP_*`, `PREVIOUS_EXERCISE`, `UNDO`. `describeNextAction` answers queries.

**Depends on:** 2 for valid positions.

### 4. Pause and Resume

**User behavior:** `"Pause."`, `"Hold on."`, `"Resume."`, `"Continue."` Redundant pause while paused is a no-op (voice-safe). Invalid statuses still fail.

**Parser:** Add aliases (`hold on`, `wait`, `keep going`). Engine pause/resume also stop/restart a running rest timer.

**Depends on:** none strictly; can follow 1.

### 5. Corrections

**User behavior:** `"Actually, that was 8."`, `"Change that to 45 kilos."`, `"I meant 40."`, `"I accidentally logged that twice."`

**Parser:** Broader correction phrasing. Unitless numbers use last-set closeness. `"logged that twice"` → `UNDO`.

**State machine:** `EDIT_SET` allowed while paused. `UNDO` already exists.

**Depends on:** 1 so logging vs correction can be distinguished.

### 6. Workout Queries

**User behavior:** Read-only questions about next action, remaining sets, last weight/reps, current exercise/set.

**Parser:** Return `QUERY` + `interpretation.intent`. Do not emit mutating commands.

**State machine:** `answerQuery(state, intent)` reads state. No mutation.

**Depends on:** 2 for accurate “what's next”.

### 7. Contextual Language

**User behavior:** Looser gym phrasing after 1–6 are reliable.

**Parser:** Additional patterns only; no LLM.

**Depends on:** 1–6.

---

# Capability Roadmap (original list)

The initial roadmap is:

### 1. Robust Set Logging

Allow natural variations of set logging.

Examples:

- "I did 10 reps."
- "10 reps."
- "Finished 10."
- "I got 10."
- "I did 10 reps at 40 kilos."
- "Finished 10 at 40."
- "That was 10 with 40."

The parser should extract only information actually provided.

The state machine should apply that information correctly to the current workout.

---

### 2. Set Completion and Workout Progression

Correctly handle what happens after a set is completed.

Examples:

- completing a set,
- moving to the next set,
- completing an exercise,
- moving to the next exercise,
- completing the workout.

The exact behavior must follow the existing workout model.

---

### 3. Workout Navigation

Support natural-language navigation such as:

- "What's next?"
- "Next exercise."
- "Go to the next one."
- "Skip this."
- "Go back."
- "Previous exercise."
- "Repeat that."

Consider valid and invalid transitions for the existing state model.

---

### 4. Pause and Resume

Support:

- "Pause."
- "Pause the workout."
- "Hold on."
- "Resume."
- "Continue."

Handle redundant or invalid transitions appropriately.

---

### 5. Corrections

Support finite, useful corrections such as:

- "Actually, that was 8."
- "Change that to 45 kilos."
- "I meant 40."
- "I accidentally logged that twice."

Initially focus on correcting recent workout actions rather than designing a generalized correction framework.

---

### 6. Workout Queries

Support read-only questions such as:

- "What's next?"
- "How many sets are left?"
- "What weight did I use?"
- "How many reps did I do?"
- "What exercise am I on?"
- "Which set am I on?"

Queries should not mutate workout state unless explicitly required.

---

### 7. Contextual Language

After explicit capabilities are reliable, improve contextual understanding.

Examples:

- "Just finished my second set."
- "I got eight this time."
- "Let's do the next one."
- "Can we skip this?"
- "Actually, I messed that up."

Do not attempt to create a general conversational AI system.

The target is domain-specific workout language understanding.

---

# Capability Definition of Done

A capability is complete when it has:

- defined user behavior,
- parser support,
- state-machine support,
- realistic language variations,
- relevant edge-case handling,
- automated tests,
- end-to-end validation where practical,
- documented behavior,
- documented limitations.

One successful example is not sufficient.

---

# Testing

Use the appropriate level of testing for each capability.

### Parser

Test multiple natural-language expressions representing the same meaning.

### State Machine

Test state transitions from structured inputs.

### End-to-End

Where practical:

```text
Transcript
    ↓
Parser
    ↓
State Machine
    ↓
Result
```

Every completed capability should leave the codebase with appropriate automated coverage.

---

# Documentation

Maintain a progress section in this document or a linked project progress document containing:

- completed capabilities,
- current capability,
- implementation status,
- tests,
- known limitations,
- important decisions,
- next recommended capability.

Documentation must describe what actually exists in the repository.

Do not document planned behavior as implemented behavior.

If implementation differs from the original plan, update the documentation.

---

# Progress

## Completed

### 1. Robust Set Logging

**Status:** Implemented and tested.

Doc: `docs/capability-1-robust-set-logging.md`

**User behavior:** Natural set-logging phrases complete the current pending set. Reps-only uses planned/previous weight from parser context. Spoken `at` / `with` weight overrides planned weight.

**Parser:** `packages/voice-parser/src/deterministic/complete-set.ts` accepts `finished` / `completed` / `logged`, `I did N reps`, `got`, `at` with intervening words, and `N with M`. `"that was 10 with 40"` is `COMPLETE_SET`. `"that was nine"` remains `EDIT_SET`. `"finish"` / `"finish workout"` remain `END_WORKOUT`.

**State machine:** Unchanged. Existing `COMPLETE_SET` applies values, advances the current set, and may start rest.

**Tests:** Additional cases in `complete-set.test.ts`. New `e2e-set-logging.test.ts` runs transcript → parser → `applyCommand`.

**Decisions:** Parser still embeds resolved weight in `COMPLETE_SET` (existing boundary). `"that was N with M"` is logging; `"that was N"` with a previous set is a correction.

**Limitations:** Does not interpret set ordinals (`"my second set"`). `"with"` without a leading reps number still needs a parseable reps source. No new engine commands.

### 2. Set Completion and Workout Progression

**Status:** Implemented and tested.

Doc: `docs/capability-2-set-completion-progression.md`

**User behavior:** Logging a set advances to the next pending set, then the next exercise, then `COMPLETED`. The user does not say “next set” after a log.

**Parser:** Unchanged intents. CLI/tests share `workoutContextFromState` so each log sees the updated cursor.

**State machine:** Unchanged. Existing `COMPLETE_SET` path already advances and may complete the workout.

**Tests:** `packages/voice-parser/tests/e2e-progression.test.ts` (transcript → parser → engine, context refreshed each turn). CLI full demo workout via logging phrases.

**Decisions:** Do not add parser status gating for `COMPLETED`/`NOT_STARTED`; the engine rejects those. Do not clear leftover rest on workout complete in this capability.

**Limitations:** Rest may stay `RUNNING` after the workout completes (no *new* timer). Skip/rest coupling and `CHANGE_WEIGHT` inheritance are unchanged.

### 3. Workout Navigation

**Status:** Implemented and tested.

Doc: `docs/capability-3-workout-navigation.md`

**User behavior:** `"what's next?"` does not mutate. `"next set"` skips the current set. `"next exercise"` / `"go to the next one"` skip remaining sets and advance. `"go back"` / `"previous exercise"` reopen the previous exercise. Bare `"skip"` stays ambiguous.

**Parser:** Navigation/skip phrase expansion in `navigation.ts`. `"next set"` is `SKIP_SET`. `"one"` normalizes to `1`, so `"next one"` matches `next 1`.

**State machine:** New `PREVIOUS_EXERCISE` (undoable, `EXERCISE_RESUMED`). Skipped sets on the previous exercise become `PENDING` again. `describeNextAction(state)` lives on the engine.

**Tests:** Engine next/previous/describeNextAction. Parser phrase table. `e2e-navigation.test.ts`.

**Limitations:** `"repeat that"` not mapped. Skip still does not start/stop rest. Going back un-skips skipped sets on that exercise (completed sets stay completed).

### 4. Pause and Resume

**Status:** Implemented and tested.

Doc: `docs/capability-4-pause-and-resume.md`

**User behavior:** `"pause"` / `"hold on"` / `"wait"` pause. `"resume"` / `"keep going"` / `"continue"` resume. Logging while paused is rejected until resume.

**Parser:** Aliases in `workout-control.ts`.

**State machine:** Idempotent pause/resume. Pause stops a running rest timer effect; resume restarts it if rest was still `RUNNING`. Invalid from `NOT_STARTED` / `COMPLETED` / `CANCELLED`.

**Tests:** Engine pause/resume + rest effects. Parser phrases. `e2e-pause-resume.test.ts`.

**Limitations:** Rest status stays `RUNNING` while paused (timer effect is stopped). Pause/resume are not undoable.

### 5. Corrections

**Status:** Implemented and tested.

Doc: `docs/capability-5-corrections.md`

**User behavior:** `"actually that was 8"` / `"I meant 8"` correct last-set reps. `"I meant 40"` / `"change that to 45 kilos"` correct last-set weight. `"I accidentally logged that twice"` undoes the last undoable action.

**Parser:** `i meant` aliases; twice-logged → `UNDO`; unitless value vs last weight/reps.

**State machine:** `EDIT_SET` allowed while `PAUSED`. No new commands.

**Tests:** Engine edit-while-paused. Parser phrase table. `e2e-corrections.test.ts`.

**Limitations:** `UNDO` is last undoable mutation, not always last set. Equal distance to last weight and reps is `AMBIGUOUS`. `"repeat that"` still unmapped.

### 6. Workout Queries

**Status:** Implemented and tested.

Doc: `docs/capability-6-workout-queries.md`

**User behavior:** `"what's next?"`, `"how many sets are left?"`, `"what weight did I use?"`, `"how many reps did I do?"`, `"what exercise am I on?"`, `"which set am I on?"` do not mutate.

**Parser:** `status = QUERY` with `interpretation.intent`. Patterns run before the out-of-scope gate.

**State machine:** `answerQuery(state, intent)`. `describeNextAction` remains the `WHAT_NEXT` answer.

**Tests:** Engine `answerQuery`. Parser phrase table. `e2e-queries.test.ts`.

**Limitations:** Rest remaining and planned-weight questions (`"what should I use?"`) are out of scope.

## Current capability

None in progress.

## Next recommended capability

**7. Contextual Language** — looser gym phrasing after 1–6.

---

# Scope Control

During a capability implementation:

- fix issues required for the capability,
- avoid unrelated refactors,
- record useful future work instead of automatically implementing it,
- do not redesign the architecture to solve hypothetical future requirements.

If an architectural change appears necessary, stop and request a decision.

---

# Evolution

This roadmap is not permanent.

Capabilities may be reordered or replaced based on what is learned during implementation.

The overall development principle remains:

> Build small, useful, end-to-end capabilities and validate them before expanding the system further.
