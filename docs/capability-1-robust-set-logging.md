# Capability 1 — Robust Set Logging

**Status:** Implemented and tested.  
**Depends on:** nothing.  
**Architecture:** Unchanged. Transcript → `parseVoiceCommand` → `WorkoutCommand` → `applyCommand`.

Follow-on: `docs/capability-2-set-completion-progression.md`.

---

## Goal

Let the user log the **current pending set** with natural gym phrasing, not only `"60 for 10"`.

The parser turns the transcript into `COMPLETE_SET`. The engine already applies that command. This capability did not add workout states, transitions, or command types.

---

## User behavior (in scope)

| Utterance | Result |
|-----------|--------|
| `"I did 10 reps."` / `"10 reps."` / `"Finished 10."` / `"I got 10."` | `COMPLETE_SET` with spoken reps; weight from planned/previous context |
| `"I did 10 reps at 40 kilos."` / `"Finished 10 at 40."` | Spoken weight **overrides** planned weight; reps from the phrase |
| `"That was 10 with 40."` | Logging: reps 10, weight 40 kg |
| `"60 for 10"`, `"same for eight"`, `"ten"` | Unchanged from before this capability |

If reps are present and weight cannot be resolved from speech **or** context → `AMBIGUOUS`, no command, no state change.

---

## Out of scope (other capabilities)

- Cursor after a log (next set / next exercise / workout complete) — capability 2
- `"What's next?"`, skip, go back — capability 3
- `"that was nine"` as a **correction** of a previous set — already existed; kept as `EDIT_SET`
- `"I meant 40"`, `"logged that twice"` — capability 5
- `"just finished my second set"` (ordinals) — capability 7

---

## Why only the complete-set parser changed

Reporting a set is “what I just did on the current set.” That is already `COMPLETE_SET`.

The engine already:

- completes the pending set
- fills omitted weight/reps from planned values
- advances the cursor (not the focus of this capability)

The gap was phrases that never became `COMPLETE_SET` (`finished`, `I did N reps`, `at` with words in between, `N with M`). Workout control, corrections, and the reducer were the right shape; expanding them would have been a different capability.

---

## What existed before

Supported: `"60 for 10"`, spoken numbers, `"ten"` with planned weight, `"same for eight"`, `"I did 10 at 60"`, `"60 kilos, got 10"`, CJK punctuation stripping.

Failed or unreliable:

- `"Finished 10."` — not a complete-set candidate (`finished N` was missing; bare `"finish"` is `END_WORKOUT`)
- `"I did 10 reps at 40 kilos."` — `at` required the number immediately before `at`
- `"That was 10 with 40."` — `with` not treated as weight; `"that was …"` was only a correction pattern

---

## What was implemented

### Parser — `packages/voice-parser/src/deterministic/complete-set.ts`

- Candidates: `finished` / `completed` / `logged N`, `did`/`got N`, `at`/`with` weight, `"that was N"` only when `with`/`at`/unit is also present
- Bare `"finish"` / `"finish workout"` excluded so they stay `END_WORKOUT`
- Weight extractors: `at N`, `with N`, `I did N reps at M`
- Reps extractors: `did`/`got`/`finished`/`completed`/`logged`, `N with M` (N = reps, M = weight)

### Normalize — `packages/voice-parser/src/normalize.ts`

- Trailing sentence periods after integers (`"Finished 10."` → `finished 10`) without breaking decimals (`22.5`)
- CJK/fullwidth punctuation stripping (from the STT follow-up, kept)

### State machine

Unchanged. `COMPLETE_SET` + `resolveSetValues` already apply the log.

### CLI

No new commands. Voice/text session already applies `PARSED` `COMPLETE_SET` commands.

---

## Decisions

1. **Existing boundary kept:** the parser still writes resolved `weightKg` onto `COMPLETE_SET` (planned/previous) instead of omitting it for the engine. The engine can resolve omitted weight; changing that would have been a boundary change, not required for the phrases.
2. **`"that was N with M"` = log; `"that was N"` with a previous set = `EDIT_SET`.** Both can match; explicit weight+reps logging wins on confidence (`0.99` vs `0.97`).
3. **`"finish"` vs `"finished 10"`:** past-tense logging vs exact workout-control phrases. `finished` is not matched by `\bfinish\b`.
4. **No new `WorkoutCommand` types.**

---

## Tests

| File | What it covers |
|------|----------------|
| `packages/voice-parser/tests/complete-set.test.ts` | Roadmap phrases + existing `"60 for 10"` / `"same for eight"` |
| `packages/voice-parser/tests/e2e-set-logging.test.ts` | Transcript → `applyCommand` on an active workout; no invented weight; `"finish workout"`; `"that was nine"` |
| `packages/voice-parser/tests/normalize.test.ts` | `"Finished 10."` vs `"22.5 kilos."` |
| `packages/voice-parser/tests/corrections.test.ts` | `"that was nine"` still `EDIT_SET` (regression) |
| `packages/voice-parser/tests/workout-control.test.ts` | `"finish"` / `"end workout"` (regression) |

CLI smoke: piped phrases through `pnpm --filter cli voice:workout:text`.

---

## Limitations (actual)

- Set ordinals are not understood (`"my second set"`).
- `"with"` still needs a reps number in the phrase (or another reps extractor).
- Weight-only utterances are not complete-set.
- Parser still fills planned weight into the command (see decisions).
- Progression after the log (which set is current next) was not the acceptance bar here — that is capability 2. E2E logging tests only assert the **first** set of the first exercise.

---

## Definition of done (met)

- Defined user behavior for the roadmap logging phrases
- Parser support with realistic variations
- Engine support via existing `COMPLETE_SET`
- Edge cases: missing weight, `finish` vs `finished`, correction vs `that was N with M`
- Automated parser + transcript→engine tests
- Documented in `docs/CAPABILITY_DEVELOPMENT.md` Progress
