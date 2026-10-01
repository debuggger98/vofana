**VOICE-FIRST FITNESS APP — UI PRODUCT SPEC**

*UI/UX reference for an AI agent building the mobile application*

Working product reference • August 2026

Scope: this document describes only what the application should look like, what screens exist, what users can do on them, and how the voice-first workout experience should behave. It intentionally contains no backend, database, API or system architecture.

# **1\. Overall UI Direction**

* Mobile-first fitness product for serious gym users.  
* Clean, premium, modern and performance-oriented rather than playful.  
* Dark mode should be treated as a first-class experience because gym environments often have low/variable lighting.  
* Large typography and controls during an active workout; users may be tired, moving and using the phone one-handed.  
* Avoid information-dense dashboards during the workout.  
* The active workout screen is the hero experience of the entire product.  
* Voice must feel native to the product, not like a chatbot tab bolted onto a tracker.  
* Prefer cards, strong hierarchy, clear numbers and generous spacing.  
* Use subtle motion/haptics for confirmation rather than excessive animation.  
* Accessibility: adequate contrast, large touch targets, scalable text and no meaning communicated only through color.

# **2\. Primary Navigation**

Recommended bottom navigation outside an active workout:

Home        Workouts        Progress        Profile

Do not add a permanent generic 'AI Chat' tab for the MVP. Voice intelligence should appear contextually where the user needs it.

# **3\. Screen Map**

Launch / Authentication

        ↓

Onboarding

        ↓

Home

├── Start Today's Workout

├── Resume Active Workout

├── Recent Performance

└── Quick Voice Entry (optional)

        ↓

Workouts

├── Routines

├── Routine Detail

├── Exercise Library

└── Exercise Detail

        ↓

Active Workout  ← HERO SCREEN

├── Current Exercise

├── Current / Previous Sets

├── Voice Control

├── Rest Timer

├── Exercise Switch

└── Finish Workout

        ↓

Workout Summary

Progress

├── Workout History

├── Exercise Progress

└── Basic Trends

Profile / Settings

├── Goals & Units

├── Voice Preferences

└── App Preferences

# **4\. Authentication**

* Minimal sign-in screen with product name/mark, one clear primary action and secondary login option.  
* Do not overload the first screen with product explanations.  
* After authentication, move directly into short onboarding.

# **5\. Onboarding**

Keep onboarding short and concrete. The user should reach a usable workout quickly.

1. Goal: build muscle / get stronger / lose fat while training / general fitness.  
2. Experience: beginner / intermediate / advanced.  
3. Typical training days per week.  
4. Preferred units: kg/lb.  
5. Optional current body weight.  
6. Voice introduction: demonstrate a command such as “60 for 10”.  
7. Microphone permission should be requested with clear context, not immediately on app launch.

Avoid long medical-style questionnaires in MVP.

# **6\. Home Screen**

The Home screen answers one question: “What should I do now?”

* Top greeting / date kept visually small.  
* Large primary card: Today's Workout or Resume Workout.  
* Show workout name, approximate duration, exercise count and current status.  
* Primary CTA: Start Workout.  
* If there is an active session, Resume Workout becomes the dominant CTA.  
* Small recent-performance section: last workout / recent PR / consistency.  
* Optional compact recommendation card, never a long AI essay.  
* Avoid calorie rings, dozens of health metrics and unrelated cards in MVP.

# **7\. Workouts Screen**

* List saved routines with name, training focus, number of exercises and approximate duration.  
* Clear CTA to create/edit a routine.  
* Routine cards should be scannable, not decorative.  
* Selecting a routine opens Routine Detail.

# **8\. Routine Detail / Editor**

* Routine title and optional training-day label.  
* Ordered list of exercises.  
* Each exercise row: exercise name, equipment, target sets × reps, optional target load.  
* Drag/reorder if practical.  
* Add Exercise CTA.  
* Tap exercise to edit targets or replace it.  
* Primary CTA: Start Workout.

# **9\. Exercise Library**

* Search bar at top.  
* Filters: muscle group and equipment; keep filter count small.  
* Exercise rows/cards show exercise name, primary muscle and equipment.  
* Recent/frequently used exercises can appear before the full list.  
* Selecting an exercise opens Exercise Detail or adds it when invoked from a routine.

# **10\. Exercise Detail**

* Exercise name and simple visual placeholder/illustration area.  
* Primary muscles and equipment.  
* Short technique notes only; no wall of text.  
* Recent performance: last session's sets and best recent result.  
* Basic progress view when accessed from Progress.  
* Replace/add action when opened from a workout context.

# **11\. Active Workout — Most Important Screen**

This screen should be designed for one-handed, low-attention use. The user should understand the current exercise, target and voice state within one glance.

┌───────────────────────────────────┐

│  Push Day                 32:14   │

│  Exercise 2 of 6                  │

│                                   │

│  INCLINE DUMBBELL PRESS           │

│  Target: 22.5 kg × 8–10           │

│                                   │

│  Previous                         │

│  Set 1    22.5 × 10       ✓       │

│  Set 2    22.5 × 9        ✓       │

│  Set 3    —                NOW     │

│                                   │

│       \[ large voice control \]     │

│       Hold / tap to speak         │

│                                   │

│  “22.5 for 8”                     │

│                                   │

│  Rest / Next target area          │

│                                   │

│  Exercise list     •••            │

└───────────────────────────────────┘

## **Active workout requirements**

* Workout name and elapsed time.  
* Current exercise position (e.g. 2 of 6).  
* Large exercise name.  
* Prominent current target: weight and rep range.  
* Previous/completed sets immediately visible.  
* Current set visually obvious.  
* Large voice control within thumb reach.  
* Manual add/edit set action always available.  
* Easy exercise switch/skip.  
* Finish Workout available but visually secondary.  
* Do not show unrelated navigation while the user is actively training if it causes accidental exits.

# **12\. Voice Interaction States**

The voice control needs explicit visual states:

| State | UI behavior | Example text |
| :---- | :---- | :---- |
| Idle | Large microphone/voice button; calm state. | Tap to speak |
| Listening | Strong visual listening indicator / waveform; cancel available. | Listening… |
| Processing | Short non-blocking progress state. | Got it… |
| Success | Brief confirmation card/haptic, then return to workout. | 60 kg × 10 logged |
| Uncertain | Show what was heard and fast choices/edit. | Did you mean 60 kg × 10? |
| Error | Simple retry/manual fallback. | Couldn't hear that. Try again. |

# **13\. Voice Confirmation Philosophy**

* Do not verbally confirm every obvious action with a long sentence.  
* Use a brief visual confirmation and haptic for high-confidence logs.  
* Use spoken feedback when it provides value: rest finished, next target, ambiguity, important change.  
* If confidence is low, ask before committing potentially damaging workout data.  
* Display the interpreted command briefly so users build trust in the system.

# **14\. Rest Timer UI**

* Automatically appears after a completed set.  
* Large remaining time, but should not obscure the workout.  
* Controls: \+15 sec / skip rest / pause if needed.  
* Show next-set target during rest.  
* When rest ends, use haptic \+ optional short voice prompt.  
* User must still be able to log/correct a set while the timer runs.

# **15\. Manual Set Logging**

Voice is primary, but manual logging must be excellent.

* Tap current set row or Add Set.  
* Weight and reps use large numeric controls/keypad.  
* Pre-fill previous/expected weight.  
* Save should require minimal taps.  
* Long-press/swipe or menu for edit/delete where discoverable.  
* Manual and voice-created sets should look identical after they are saved.

# **16\. Correction / Undo UX**

* Immediately after a voice log, show a small undo action for several seconds.  
* Voice correction such as “actually nine” should visibly update the last set.  
* Edited values should animate subtly so the user sees what changed.  
* Never force the user through a long form just to fix one rep.  
* If the correction target is ambiguous, show the relevant recent sets to choose from.

# **17\. Exercise Switch / Skip**

* Bottom sheet or full-screen selector listing remaining exercises and alternatives.  
* Current exercise clearly marked.  
* Skip action should be quick.  
* Replace action can show similar exercises/equipment alternatives later.  
* Returning to the workout should preserve all existing set data.

# **18\. Workout Summary**

* Workout name, duration, exercises completed, total sets and useful volume summary.  
* Highlight meaningful achievements: PR, more reps at same load, increased load, completed target.  
* List exercises with final sets.  
* Allow corrections before final dismissal.  
* One short insight/recommendation is better than a page of generated prose.  
* Primary CTA: Done.

# **19\. Progress Screen**

Keep MVP progress simple and actionable.

* Recent workout history.  
* Exercise-level progress selector.  
* Simple strength/load/reps trend.  
* Recent best / estimated 1RM if used.  
* Training volume trend only if presented clearly.  
* No fake precision or overly complicated readiness/calorie dashboards.

# **20\. Workout History**

* Chronological list grouped by date.  
* Each row/card: workout name, duration, exercise count and small achievement summary.  
* Tap to open full workout details.  
* Workout detail shows all exercises and sets and supports correction where appropriate.

# **21\. Profile / Settings**

* Goal.  
* Experience level.  
* Weight and unit preferences.  
* Voice response toggle.  
* Voice volume / response style only if needed.  
* Rest timer defaults.  
* App appearance: system/light/dark if supported.  
* Privacy/microphone explanation.  
* Account/data controls.

# **22\. Empty, Loading and Error States**

* No routines: explain in one sentence and show Create Routine.  
* No history: direct user toward first workout.  
* No progress data: explain that trends appear after repeated sessions.  
* Voice unavailable: keep workout fully usable manually.  
* Permission denied: explain why microphone is useful and provide a clear path to settings.  
* Avoid skeleton/loading UI that blocks an active workout unnecessarily.

# **23\. Notification / Lock-Screen Direction**

For MVP UI design, assume the user may leave the app during a workout. Provide a clear active-workout state when they return. If lock-screen/live activity surfaces are implemented later, they should expose only the current exercise, rest state and a fast way back into the session.

# **24\. Visual Design Language**

* Premium athletic feel; avoid cartoon gym imagery.  
* Typography: strong numeric hierarchy for weight, reps and timers.  
* Use one primary accent color consistently; neutral backgrounds/surfaces elsewhere.  
* Rounded cards/buttons are acceptable but avoid making every element a floating card.  
* Icons should be familiar and minimal.  
* Charts should be simple and legible.  
* During workout, prioritize function over decorative visuals.  
* Animations should communicate state: listening, saved, corrected, timer finished.

# **25\. Copy / Voice Tone**

* Short, clear and confident.  
* Avoid excessive motivational language.  
* Do not praise every set.  
* Prefer “Logged. Rest 90 seconds.” over a paragraph.  
* Recommendations should explain important changes briefly: “You hit 10 last time. Try 62.5 kg for 8.”  
* Errors should be neutral: “I heard 16 kg. Is that right?”

# **26\. UI Priorities for the AI Builder**

8. Build the complete manual workout flow first.  
9. Make Active Workout the highest-quality screen.  
10. Then add the visual voice states and simulated voice interactions.  
11. Ensure every voice action has an equivalent manual interaction.  
12. Build correction and undo early; do not treat them as edge-case polish.  
13. Keep Home and Progress intentionally simple.  
14. Do not invent nutrition, social, health-monitoring or broad AI-chat screens for MVP.  
15. Use realistic gym data in prototypes so spacing works for long exercise names, decimals and multiple sets.  
16. Test key screens at small phone sizes and with one-handed reach in mind.

# **27\. Suggested Prototype Data**

Today's Workout: Push Day

1\. Barbell Bench Press       3 × 8–10

2\. Incline Dumbbell Press   3 × 8–10

3\. Cable Fly                3 × 10–12

4\. Shoulder Press           3 × 8–10

5\. Lateral Raise            3 × 12–15

6\. Triceps Pushdown         3 × 10–12

Current:

Incline Dumbbell Press

Set 1: 22.5 kg × 10

Set 2: 22.5 kg × 9

Set 3: target 22.5 kg × 8–10

# **28\. UI Definition of Done**

* A new user can understand how to start a workout without explanation.  
* During a workout, current exercise and target are understandable within one glance.  
* Logging a manual set is fast.  
* Starting voice input is obvious and reachable.  
* Listening/processing/success/error states cannot be confused.  
* A wrong voice log can be corrected immediately.  
* Rest timing and next-set target are obvious.  
* Finishing a workout produces a useful but concise summary.  
* No MVP screen depends on architecture knowledge or exposes technical implementation concepts.