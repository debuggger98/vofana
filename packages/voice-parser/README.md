# @vofana/voice-parser

Deterministic, context-aware transcript parser that converts gym voice utterances into structured `WorkoutCommand` objects for `@vofana/workout-engine`.

This package interprets text only. It does not capture audio, call STT providers, mutate workout state, persist data, or execute commands.

## Architecture

```
Future STT Provider
        │
        ▼
   transcript (text)
        │
        ▼
  Voice Parser  ←── WorkoutContext
        │
        ▼
  WorkoutCommand
        │
        ▼
  Workout Engine (applyCommand)
        │
        ▼
   Updated WorkoutState
```

Boundaries:

| Layer | Responsibility |
|-------|----------------|
| STT | Speech recognition |
| Voice Parser | Interpret transcript |
| Workout Engine | Apply structured command |
| Persistence | Store state/events |

## Public API

```typescript
import { parseVoiceCommand, type WorkoutContext } from "@vofana/voice-parser";

const result = parseVoiceCommand({
  transcript: "same for ten",
  context: {
    workoutStatus: "ACTIVE",
    currentExercise: { id: "bench_press", name: "Bench Press" },
    currentSet: { id: "set-2", setNumber: 2, plannedWeightKg: 60 },
    previousCompletedSet: {
      id: "set-1",
      exerciseId: "bench_press",
      weightKg: 60,
      reps: 9,
    },
    units: "KG",
  },
});
```

### Input: `VoiceParseInput`

| Field | Description |
|-------|-------------|
| `transcript` | Raw text from any STT provider |
| `context` | Lightweight workout snapshot for disambiguation |
| `metadata?` | Optional STT metadata (not used by deterministic parser) |

### Output: `ParseResult`

| Field | Description |
|-------|-------------|
| `status` | `PARSED` \| `QUERY` \| `AMBIGUOUS` \| `UNSUPPORTED` \| `INVALID` |
| `command?` | Structured `WorkoutCommand` from workout-engine |
| `confidence` | Heuristic score 0–1 |
| `originalTranscript` | Unmodified input |
| `normalizedTranscript` | Lowercased, number/unit normalized form |
| `interpretation?` | Intent label and optional explanation |
| `candidates?` | Alternative commands when ambiguous |
| `error?` | Parser error details |

## Context Model

The parser needs enough context to resolve abbreviated speech like `"ten"` or `"same for eight"`:

- `workoutStatus` — current session status
- `currentExercise` — active exercise id/name/aliases
- `currentSet` — planned weight/reps for the pending set
- `previousCompletedSet` — last logged set (for corrections and "same weight")
- `nextExercise` / `remainingExercises` — optional navigation hints
- `restState` / `defaultRestSeconds` — for rest timer commands
- `units` — `KG` or `LB` (canonical output is always kg)

The parser reads context only; it never mutates it.

## Supported Intents

Maps to existing `@vofana/workout-engine` commands:

| Intent | Example utterances | Command |
|--------|-------------------|---------|
| Complete set | `"60 for 10"`, `"ten"`, `"same for eight"` | `COMPLETE_SET` |
| Correction | `"actually nine"`, `"I meant 40"`, `"change that to 45 kilos"` | `EDIT_SET` |
| Undo | `"undo that"`, `"I accidentally logged that twice"` | `UNDO` |
| Navigation | `"next"`, `"next exercise"`, `"go to the next one"` | `NEXT_EXERCISE` |
| Next set | `"next set"` | `SKIP_SET` |
| Previous | `"go back"`, `"previous exercise"` | `PREVIOUS_EXERCISE` |
| Query | `"what's next?"`, `"how many sets are left?"`, `"what weight did I use?"` | No command — `status = QUERY` |
| Skip set | `"skip this set"` | `SKIP_SET` |
| Skip exercise | `"skip exercise"` | `SKIP_EXERCISE` |
| Weight change | `"increase to 65"`, `"make it 65"` | `CHANGE_WEIGHT` |
| Reps change | `"change reps to 8"` | `CHANGE_REPS` |
| Rest | `"start rest"`, `"skip rest"` | `START_REST` / `SKIP_REST` |
| Workout control | `"pause"`, `"hold on"`, `"keep going"`, `"end workout"` | `PAUSE_WORKOUT`, `RESUME_WORKOUT`, etc. |

## Context Resolution Rules

1. **Explicit weight** — `"60 for 10"` uses spoken weight 60.
2. **Omitted weight** — `"10"` uses `currentSet.plannedWeightKg` when available.
3. **"Same" weight** — `"same for 8"` uses `previousCompletedSet.weightKg` or current planned weight.
4. **No known weight** — `"10"` without weight context returns `AMBIGUOUS` (never invents a weight).
5. **Corrections** — require `previousCompletedSet.id` for `EDIT_SET.setId`. A unitless number is assigned to weight or reps by closeness to the last actuals. `"logged that twice"` is `UNDO`.
6. **Ambiguous skip** — bare `"skip"` returns candidates for both `SKIP_SET` and `SKIP_EXERCISE`.

## Normalization

The normalization layer:

- Lowercases and trims input
- Converts unit aliases (`kilos`, `kilograms` → `kg`)
- Converts spoken numbers (`ten` → `10`, `sixty five` → `65`)
- Handles decimal weights (`twenty two point five` → `22.5`)
- Preserves the original transcript for debugging

Normalization is conservative — it does not strip semantically important words like `for` or `at`.

## Confidence

Confidence is a deterministic heuristic, not a calibrated probability:

| Score | Meaning |
|-------|---------|
| 0.99 | Explicit pattern (e.g. `"60 for 10"`) |
| 0.97 | Context-resolved (e.g. `"same for ten"`) |
| 0.92 | Inferred from planned values |
| 0.48 | Ambiguous — multiple or incomplete interpretations |
| 0.10 | Unsupported / out of scope |

The orchestration layer decides whether to execute, confirm, or reject based on confidence thresholds.

## Ambiguity Behavior

The parser is conservative. When intent cannot be resolved safely:

```typescript
{
  status: "AMBIGUOUS",
  confidence: 0.48,
  candidates: [
    { command: { type: "SKIP_SET" }, confidence: 0.5 },
    { command: { type: "SKIP_EXERCISE" }, confidence: 0.45 },
  ],
}
```

It never guesses missing workout data.

## Exercise Aliases

A replaceable `ExerciseAliasResolver` maps spoken exercise names to ids. The default resolver checks current exercise aliases and a small built-in alias table. This can later be backed by a full exercise catalog.

## Future LLM Adapter

The `VoiceInterpreter` interface supports future implementations:

```
DeterministicVoiceParser  ← current
LLMVoiceParser            ← future
HybridVoiceParser         ← future (deterministic first, LLM fallback)
```

No LLM integration is included in this phase.

## Testing

```bash
pnpm --filter @vofana/voice-parser test
pnpm --filter @vofana/voice-parser typecheck
```

Tests cover normalization, complete-set parsing, corrections, navigation, workout control, ambiguity, confidence, golden cases, and unsupported input.

## Non-Responsibilities

This package does **not**:

- Capture or process audio
- Call STT, TTS, LLM, or external APIs
- Execute `WorkoutCommand` or call `applyCommand`
- Mutate workout state or context
- Persist to database or filesystem
- Handle HTTP, WebSockets, or React Native concerns

## Example: End-to-End Flow

```typescript
import { parseVoiceCommand } from "@vofana/voice-parser";
import { applyCommand } from "@vofana/workout-engine";

const parseResult = parseVoiceCommand({ transcript, context });

if (parseResult.status === "PARSED" && parseResult.command) {
  const engineResult = applyCommand(workoutState, parseResult.command);
  // persist engineResult.state, emit events, etc.
}
```
