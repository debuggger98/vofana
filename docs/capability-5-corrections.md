# Capability 5 — Corrections

**Status:** Implemented and tested.  
**Depends on:** Capability 1 (logging vs correction).  
**Architecture:** Transcript → `parseVoiceCommand` → `EDIT_SET` / `UNDO` → `applyCommand`.

Parser and engine are improved together. No new command types: the union already expresses “fix the last logged set” and “undo the last undoable action.”

---

## Goal

The user can fix a **recent** logged set (wrong reps or weight) or take back a set they logged by accident — without a general correction framework.

---

## User behavior

| Utterance | Parser | Engine |
|-----------|--------|--------|
| `"Actually, that was 8."` / `"that was nine"` / `"no, nine"` | `EDIT_SET` last completed set, reps | Update actuals; identity unchanged; undoable |
| `"Change that to 45 kilos."` | `EDIT_SET` last set, weight | Same |
| `"I meant 40."` | `EDIT_SET` last set; unitless number is weight or reps by closeness to last actuals | Same |
| `"I meant 8."` (last set was e.g. 60×10) | `EDIT_SET` reps | Same |
| `"I accidentally logged that twice."` / `"logged that twice"` | `UNDO` | Restore last undoable snapshot (typically the last `COMPLETE_SET`) |
| `"undo"` / `"undo that"` | `UNDO` (unchanged) | Unchanged |
| Correction with no previous completed set | `AMBIGUOUS`, no command | No mutation |
| `"that was 10 with 40"` | Still `COMPLETE_SET` (capability 1) | Log current pending set |
| `"repeat that"` | Still unmapped | — |

---

## Engine

Existing: `EDIT_SET` on a completed set; `UNDO` restores `undoSnapshot`.

This capability:

- `EDIT_SET` is allowed while `ACTIVE` or `PAUSED` (fixing a log is not a new set). Still rejected from `NOT_STARTED` / `COMPLETED` / `CANCELLED`.
- `UNDO` already works while paused; unchanged.
- No new events or commands.

Limitation: `UNDO` reverts the most recent **undoable** mutation, which may be a skip or planned-weight change if that happened after the log. After an `EDIT_SET`, `"logged that twice"` undoes that edit, not the original log. Double-log speech maps to the same `UNDO`, not a dedicated “undo last set only” command.

---

## Parser

- Aliases: `i meant …`, `meant …`
- Undo aliases: `i accidentally logged that twice`, `logged that twice`, `i logged that twice`
- Unitless correction value: compare to `previousCompletedSet` weight vs reps; closer field wins; equal distance → `AMBIGUOUS`
- Explicit `kg`/`lb` → weight; `reps` → reps
- Exclude `meant` / `accidentally` from complete-set candidates so they do not log a new set

---

## Tests

Engine: edit while paused; edit still rejected on pending sets.

Parser: roadmap phrases; unitless 40 vs 8; no previous set; twice-logged → `UNDO`.

E2E: log then correct reps/weight; log then undo via twice-logged phrase; logging phrase `"that was 10 with 40"` unchanged.

---

## Out of scope

- `"repeat that"` (undo vs re-log)
- `"Actually, I messed that up"` without a value (capability 7)
- Editing an arbitrary older set by ordinal (`"my second set"`)
- Generalized multi-step correction dialogue
