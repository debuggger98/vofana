# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Vofana is a voice-first strength-training app. Current phase: grow the **voice parser** and **workout state machine** one user capability at a time. `AGENTS.md` holds the general project rules. This file is the working reference.

## Commands

pnpm 10 workspace (`apps/*`, `packages/*`). TypeScript, ESM, NodeNext (relative imports in `src/` use `.js` extensions), vitest.

```bash
pnpm --filter "./packages/*" test               # all tests (root `pnpm test` FAILS: apps/cli has a placeholder `exit 1` test script)
pnpm typecheck                                   # all packages
pnpm --filter @vofana/workout-engine build       # REQUIRED after engine changes (see below)
pnpm --filter @vofana/voice-parser test
cd packages/voice-parser && pnpm vitest run tests/queries.test.ts   # single file
cd packages/voice-parser && pnpm vitest run -t "test name"          # single test
pnpm --filter cli voice:workout:text             # interactive loop with typed/piped transcripts
pnpm --filter cli voice:workout                  # mic → ElevenLabs realtime STT (needs .env key)
```

**Gotcha:** `voice-parser` depends on `@vofana/workout-engine` through `workspace:*`, and that package resolves to `packages/workout-engine/dist`. After changing engine types or behavior, run the engine `build` before running parser tests or typecheck. Otherwise the parser sees stale engine code. The CLI imports both packages' `src/` directly, so it is unaffected.

`apps/cli` has no tests. `apps/cli/stt_benchmarks/` holds ad-hoc STT provider experiments that are not part of the pipeline. `vofana-mobile/` and `benchmarks/` are empty placeholders.

## Architecture

```
transcript ─▶ parseVoiceCommand({ transcript, context }) ─▶ ParseResult
                         ▲                                    │
      workoutContextFromState(state)          PARSED ─▶ applyCommand(state, command) ─▶ CommandResult
                                              QUERY  ─▶ answerQuery(state, interpretation.intent) ─▶ string
                                              AMBIGUOUS / UNSUPPORTED / INVALID ─▶ no state change
```

**Boundary:** the parser answers "what is the user saying?" and the engine answers "given the state, what happens?". Keep workout logic out of the parser and language handling out of the engine. The parser only reads `WorkoutContext` and never mutates it.

### `packages/workout-engine`: pure reducer, no dependencies

- `engine.ts` `applyCommand(state, command, { timestamp? })` is a `switch` over the `WorkoutCommand` union (`commands.ts`) that dispatches to `handleX()` functions. The `default` branch has a `never` exhaustiveness check, so adding a command type forces a handler.
- Handlers follow this pattern: guard (`requireActive` / `requireActiveOrPaused`), validate (`validators.ts`), `cloneState`, optional `saveUndoSnapshot` for undoable commands, mutate the clone, then `createEvent(...)`, push effects, `bumpVersion`, and return `succeed(state, ctx)`. Normal failures use `fail(state, createError(code, msg), ctx)` and return `success: false` with the state unchanged. Do not throw for normal invalid commands.
- `CommandResult = { success, state, events, effects, recommendations, error? }`. Effects (e.g. `START_REST_TIMER`) describe timers and TTS, and the engine never runs them. Recommendations (`progression.ts`) never mutate state.
- Undo keeps a single-level `undoSnapshot` (only one step back). `commandId` gives idempotency through `processedCommandIds`. `version` is bumped on each mutation.
- Cursor logic lives in `helpers.ts`: `getCurrentExercise`, `getCurrentSet`, `findLastCompletedSet`, `describeNextAction`. Progression after set completion or skip lives in `engine.ts` (`advanceAfterSetAction`, `completeWorkoutIfDone`).
- `queries.ts` `answerQuery(state, intent)` is read-only. Intents: `WHAT_NEXT`, `SETS_REMAINING`, `LAST_WEIGHT`, `LAST_REPS`, `CURRENT_EXERCISE`, `CURRENT_SET`.
- The package must stay portable to Node and React Native: no fetch, timers, DB, or AI SDKs.

### `packages/voice-parser`: deterministic text → command, no LLM, no I/O

- `parser.ts` `parseVoiceCommand` → `deterministic/parser.ts` `parseDeterministic`:
  1. `normalize.ts`: lowercase, NFKC, strip punctuation (keeps decimals and contractions), unit aliases (`kilos` → `kg`), spoken numbers (`sixty five` → `65`, `twenty two point five` → `22.5`). The original transcript is preserved.
  2. Empty input returns `INVALID`.
  3. `queries.ts` `parseQuery` runs first. A match returns `QUERY` with `interpretation.intent` and no command.
  4. The `UNSUPPORTED_PATTERNS` out-of-scope gate (protein, calories, "how do I", ...) returns `UNSUPPORTED`.
  5. Matchers collect attempts in this order: undo → correction (`corrections.ts`) → navigation and skip (`navigation.ts`) → workout control and rest (`workout-control.ts`) → weight/reps change → complete-set (`complete-set.ts`).
  6. A single `PARSED` attempt wins. With several, the top attempt wins only if its confidence is ≥ `CONFIDENCE.CONTEXT_INFERRED` (0.92). Otherwise the result is `AMBIGUOUS` with `candidates`.
- `confidence.ts` holds the heuristic tiers: 0.99 explicit, 0.97 context-resolved, 0.92 inferred, 0.48 ambiguous, 0.10 unsupported.
- **Never invent data.** A missing weight with no context returns `AMBIGUOUS`. `EDIT_SET` needs `previousCompletedSet.id`. A bare "skip" returns both `SKIP_SET` and `SKIP_EXERCISE` as candidates. Output weight is always kg.
- The parser currently writes the resolved weight into `COMPLETE_SET` from context, even though the engine could resolve it. This is the existing boundary, so keep it.
- `from-state.ts` `workoutContextFromState` maps `WorkoutState` to `WorkoutContext`. `aliases.ts` provides a replaceable exercise alias resolver. The `VoiceInterpreter` interface is reserved for a future LLM or hybrid parser, which is not implemented.

### `apps/cli/voice_workout/session.ts`

Glue code for manual testing. It runs a hardcoded demo workout (Bench Press → Incline DB Press → Squat) and routes `QUERY`, `PARSED`, and other results as in the diagram above. Sample utterances are in `apps/cli/constants.ts`.

## Capability workflow

Build one end-to-end user capability at a time: parser → existing interface → engine → tests → docs. Capabilities 1–6 are done: set logging, progression, navigation, pause/resume, corrections, and queries. The next one is **7, contextual language** (more parser patterns only, no LLM).

For each capability:
1. **Reuse the existing `WorkoutCommand` union.** A new command type, package, interpreter, or dependency counts as an architecture change. Before implementing one, name the limitation, explain why the current design can't handle it, propose the smallest change, and wait for approval.
2. **Parser:** add patterns to the matching `deterministic/*.ts` file, keep the matcher order in mind, and add regressions for phrases that could now collide (e.g. "finish" → `END_WORKOUT` vs "finished 10" → `COMPLETE_SET`, "that was nine" → `EDIT_SET` vs "that was 10 with 40" → `COMPLETE_SET`).
3. **Engine:** change it only when the behavior needs it.
4. **Tests:** add unit tests in `tests/<area>.test.ts` and an end-to-end test in `packages/voice-parser/tests/e2e-<capability>.test.ts`. The e2e test builds a workout with `createWorkout`, runs `START_WORKOUT`, then for each transcript calls `parseVoiceCommand` with `workoutContextFromState(state)` and passes the result to `applyCommand` or `answerQuery`. Engine-only behavior goes in `packages/workout-engine/tests/` with shared builders from `tests/fixtures.ts`.
5. **Docs:** write `docs/capability-N-<name>.md` following the existing ones (Status, Depends on, Architecture, Goal, User behavior table, parser and engine changes, edge cases, tests, out of scope). Update the "Current Repository State", supported-commands table, and "Current limitations" sections of `docs/CAPABILITY_DEVELOPMENT.md`, plus the affected package `README.md`. Add new sample utterances to `apps/cli/constants.ts`.
6. **Validate:** build the engine, then run `pnpm --filter "./packages/*" test` and `pnpm typecheck`.
7. **Commit message:** `feat: capability N - <name>`.

`docs/CAPABILITY_DEVELOPMENT.md` is the source of truth for current behavior and known gaps. If a product behavior is unclear, raise it with the user instead of guessing.

## Codebase exploration: graphify

A graphify knowledge graph of the repo lives in `graphify-out/` (gitignored). Use it before broad Read, Grep, or Glob exploration, and include this rule in any subagent prompt that involves exploring code:

```bash
graphify query "<question>"        # scoped subgraph for a code/architecture question (add --budget N if truncated)
graphify explain "<symbol>"        # a node and all its connections, e.g. "parseDeterministic"
graphify path "<A>" "<B>"          # dependency path between two symbols
graphify update .                  # run after modifying code (AST-only, no API cost)
```

- Read and Grep directly once graphify has shown you where to look, or when `graphify-out/graph.json` doesn't exist.
- `graphify-out/GRAPH_REPORT.md` covers broad architecture: god nodes and communities. Its "Built from commit" line shows whether the graph is stale compared with `git rev-parse HEAD`.
- The most connected symbols are `applyCommand`, `createError`, `parseVoiceCommand`, `fail`, `createEvent`, `succeed`, `getCurrentExercise`, `bumpVersion`, and `parseDeterministic`.
