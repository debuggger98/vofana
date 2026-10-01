# Voice-First Fitness Agent --- Proof-of-Work Execution Plan

**Status:** Active execution plan  
**Primary objective:** Prove the low-latency real-time voice workout
interaction before investing heavily in CRUD, polished UI,
infrastructure, nutrition, health integrations, or broader fitness
features.

## 1. Current Product Priority

The hardest and most differentiated part is the real-time voice
interaction system.

The immediate question is:

> Can someone in a real, noisy gym speak naturally and have the correct
> structured workout action happen quickly and reliably enough that it
> is genuinely easier than typing?

That is the first proof of work. Optimize for learning speed, not
completeness.

## 2. First Proof-of-Work Target

Do not begin with React Native, MongoDB, AWS, authentication, or
polished UI.

```text
Laptop microphone
      ↓
Streaming speech-to-text
      ↓
Transcript
      ↓
Contextual command parser
      ↓
Workout state machine
      ↓
Structured event
      ↓
Terminal output
```

Example: user says `Leg curl, 40 kilos, 12.` and the terminal should
immediately show the structured exercise, weight, reps, and latency.
`Same for ten` should reuse context. `Actually eleven` should correct
the previous set.

# Phase 0 --- Define the Voice Command Surface

Start with a small command vocabulary:

- `START_EXERCISE`
- `COMPLETE_SET`
- `CHANGE_WEIGHT`
- `CHANGE_REPS`
- `CORRECT_LAST_SET`
- `UNDO`
- `NEXT_SET`
- `NEXT_EXERCISE`
- `PREVIOUS_EXERCISE`
- `SKIP_SET`
- `SKIP_EXERCISE`
- `START_REST`
- `CHANGE_REST`
- `WHAT_NEXT`
- `END_WORKOUT`

Representative utterances: `Bench press`, `60 for 10`, `Ten`,
`Same for eight`, `Increase to 65`, `Actually nine`, `Undo that`,
`What's next?`, `Skip this`.

Do not support arbitrary fitness conversation yet.

# Phase 1 --- Build the STT Benchmark

Build a small TypeScript/Node.js program:

```text
Microphone → audio chunks → streaming STT → partial transcript → final transcript
```

Evaluate multiple providers before committing.

Record audio-start time, first-partial time, final-transcript time,
expected sentence, and actual transcript.

Measure first-partial latency, final latency, word accuracy, number
accuracy, weight accuracy, rep accuracy, and failure rate.

Numeric accuracy matters more than conventional word error rate.
`60 for 10 → 50 for 10` is a serious failure even though only one token
changed.

# Phase 2 --- Test STT in the Real Environment

Move quickly from quiet-room tests to:

```text
Quiet room/laptop mic
→ room with music
→ real gym/phone mic
→ real gym/Bluetooth earbuds
```

Collect roughly 100--200 representative commands. Test gym music, nearby
conversations, heavy breathing, microphone distance, Indian English
accents, fast speech, decimal weights such as 22.5, and very short
commands.

# Phase 3 --- Build the Workout State Machine

Build an independent TypeScript package representing:

- current exercise
- current exercise index
- current set
- expected weight
- expected reps
- completed sets
- rest state
- event/history state

The workout engine must know nothing about microphones or STT. Voice is
only one command source.

# Phase 4 --- Build the Contextual Voice Parser

Connect:

```text
STT → transcript → contextual parser → workout engine
```

If current state says Bench Press at 60 kg and the user says `Ten`,
resolve it to `COMPLETE_SET(weight=60,reps=10)`. `Same for eight` reuses
the relevant weight. `Actually nine` corrects the recent set.

Do not force complete sentences. Context should carry most of the
information.

# Phase 5 --- Instrument End-to-End Latency

Expose per-command timing:

```text
Speech: "same for ten"
First partial: 143 ms
Final STT:     391 ms
Parser:          2 ms
Workout engine:  1 ms
Total:         395 ms
Result: Bench Press — 60 kg × 10
```

Track p50, p95, and p99, plus command success, numeric accuracy,
correction rate, parser confidence, and fallback rate.

# Phase 6 --- Introduce Ambiguity

Deliberately test messy speech:

- `Sixty... actually sixty-five... got eight.`
- `I think that was nine.`
- `Same.`
- `No no, undo that.`
- `I did eight, but reduce the next one.`

Use deterministic parsing when confidence is high. Only then introduce
an LLM as structured fallback for ambiguous/semantic requests. The LLM
should not be the default parser.

# Phase 7 --- Add Vocal Response / TTS

Add short responses such as `Logged. Rest 90 seconds.` and
`Ready. 62.5 for eight.`

Device/system TTS is sufficient initially. Measure end-of-user-speech to
first response audio, because perceived latency matters more than STT
latency alone.

# Phase 8 --- Build the Minimal iPhone Prototype

After the terminal system works, move to React Native.

The first UI only needs:

- current exercise
- current set
- target weight/reps
- completed sets
- large talk control
- transcript/debug information
- latency
- next action

Hardcode a workout if necessary. Do not build Home, Profile, Login,
Progress, Charts, Settings, or a Workout Builder yet.

# Phase 9 --- Test the Complete System in a Real Gym

Use the iPhone and earbuds for a real 45--60 minute workout. Attempt to
log the entire workout without typing or secretly repairing state.

Example sequence:

`Starting bench` → `60 for ten` → `Same for nine` → `62.5 for seven` →
`Actually eight` → `What's next?`

This is the first serious product proof.

# Phase 10 --- Optimize Voice UX

Real use should determine whether the best interaction is tap-to-speak,
hold-to-speak, earbud-triggered speech, a workout wake phrase, or a
short automatic listening window.

Watch for push-to-talk fatigue, overly verbose commands, annoying TTS,
Bluetooth problems, listening-state confusion, and slow correction
flows.

# Phase 11 --- Add Persistence

Only after the interaction works, introduce MongoDB for Users,
Exercises, Routines, WorkoutSessions, and WorkoutEvents.

Until then, in-memory state or local JSON is acceptable. MongoDB does
not prove the product thesis.

# Phase 12 --- Build the Actual MVP UI

Once voice interaction is validated, build the real shell:

```text
Onboarding → Home → Workout selection → Active Workout → Summary → History → Progress
```

CRUD now supports a validated core interaction rather than distracting
from it.

# Phase 13 --- Test With 5 Real Users

Start with approximately five serious strength-training users. Observe
what they naturally say, when they prefer touch, what fails, whether
they trust logs, whether TTS helps, how often they correct the system,
and whether voice actually saves effort.

Then expand roughly from 5 → 20 → 50 users.

Do not build major secondary features such as nutrition before this
interaction survives real-user testing.

# Phase 14 --- Productize

After repeated use validates the experience, add normal product
requirements: authentication, onboarding, settings, durable profiles,
exercise library, workout creation, analytics, crash reporting,
payments, and deployment hardening.

# Phase 15 --- Expand the Fitness System

Later expansion can include Apple Health, Health Connect, watches,
activity, sleep/recovery, nutrition, gym equipment profiles, computer
vision, trainer tools, and richer AI coaching.

## Execution Order Summary

---

Order Build What it proves

---

1 Node/TS microphone → Can speech be fast and
streaming STT accurate?

2 Real-gym STT benchmark Does speech work in
reality?

3 Workout state machine Can workout context be
represented reliably?

4 Deterministic command Can short speech become
parser structured actions?

5 Parser + state Does contextual voice
integration logging work?

6 Correction / undo Can users trust the
data?

7 LLM fallback Can messy language be
handled?

8 TTS Does two-way voice feel
useful?

9 Minimal React Native Does it work on the
screen target phone?

10 iPhone + earbuds + real **Actual proof of
gym concept**

11 Voice UX iteration Is it actually better
than typing?

12 MongoDB persistence Make validated sessions
durable

13 Real MVP UI Turn proof into product

14 5--20 gym users Validate behavior and
retention

15 Productization Prepare for broader use

16 Health integrations Expand context

17 Nutrition/recovery/etc. Move toward the larger
vision

---
