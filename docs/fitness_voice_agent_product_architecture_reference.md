**VOICE-FIRST FITNESS AGENT**

*Product, MVP & Real-Time System Architecture Reference*

Working reference for developers and AI coding agents • August 2026

**Purpose: preserve the product reasoning, constraints, decisions, architecture, MVP scope, risks, and implementation direction discussed so far.**

# **1\. Executive Summary**

We are building a voice-first fitness application whose primary value is not 'more fitness features'. The core problem is friction: people avoid logging, planning, interpreting, and acting on fitness data because those tasks require too much manual interaction. The product should make structured fitness tracking and the next decision nearly invisible.

The MVP focuses on strength training. During a workout, the user should be able to speak short natural commands such as 'leg curl, 40 kilos, 12', 'same again, 10', 'increase to 45', 'what's next?', or 'my shoulder hurts'. The system transcribes speech with low latency, resolves the command using workout context, updates structured workout state, and responds vocally when useful.

## **Product thesis**

User performs fitness activity

        ↓

Minimal voice / sensor input

        ↓

Automatic structured capture

        ↓

Persistent personal fitness state

        ↓

Analysis \+ deterministic decision logic

        ↓

Context-aware recommendation

        ↓

Less effort \+ better consistency \+ better outcomes

## **MVP one-line definition**

The fastest way to log and progress a strength workout: talk naturally while training, and the app records the workout, recommends the next set, manages rest, and adapts the program.

# **2\. Product Vision**

Long term, the application can become a fitness operating layer above existing health ecosystems rather than attempting to replace every sensor platform. It can combine strength history, activity, recovery, nutrition, equipment availability, goals, and user constraints into one persistent fitness model.

PERSONAL FITNESS MODEL

├── Body

│   ├── weight / measurements / body-composition trends

├── Strength

│   ├── exercise history / sets / reps / load / RPE-RIR / estimated 1RM

├── Activity

│   ├── steps / runs / cycling / cardio

├── Recovery

│   ├── sleep / resting HR / HRV / fatigue signals

├── Nutrition

│   ├── calories / protein / macros / weight response

└── Environment

    ├── current gym / equipment / time available / constraints

# **3\. Target User and Initial Market**

Initial market: India. The intended early customer is not every person who exercises. The strongest early user is someone who already spends meaningful money and attention on fitness and cares enough about progress to track it.

* Regular strength-training users, especially 4–6 sessions per week.  
* Upper-middle-income / affluent professionals with willingness to pay for convenience and results.  
* Users already using smartwatches, fitness apps, supplements, coaching, or premium gyms.  
* Quantified-self / performance-oriented early adopters.  
* Potential later B2B2C customer: personal trainers managing many clients.

Weak initial targets include casual gym users, users who exercise inconsistently, and people who do not care about progress metrics. For them, additional tracking has little value regardless of how sophisticated the product is.

# **4\. Core User Problem**

People do not primarily want to 'log fitness'. They want results. Logging is an intermediate chore. Existing apps often require opening screens, searching exercises, tapping fields, entering weights and reps, starting timers, and later interpreting charts. The product should remove as much of this interaction as possible.

Traditional:

Open app → Find exercise → Select set → Enter weight → Enter reps → Save → Start timer

Desired:

Lift → say "60 for 10" → continue training

# **5\. Competitive/Product Gaps We Care About**

| Gap | Why it matters | Our direction |
| :---- | :---- | :---- |
| Manual workout logging | Users stop tracking because input is tedious. | Voice-first, context-aware set capture. |
| Voice is secondary UI | Most fitness products remain form/screen driven. | Voice is a primary interaction surface during sessions. |
| Fragmented context | Strength, steps, sleep, nutrition and recovery live separately. | Long-term unified fitness model; integrate rather than replace ecosystems. |
| Weak real-time adaptation | Plans are generated but often static during a workout. | Stateful session engine that can change next actions. |
| Charts instead of decisions | Users see metrics but still must decide what to do. | Surface 'what should I do now?' recommendations. |
| Gym/equipment awareness | Programs may recommend unavailable exercises. | Gym profiles, user equipment data, later CV/crowdsourcing. |
| Corrections are cumbersome | Speech mistakes can corrupt progression data. | Fast confirmations, undo/correct commands, event history. |

# **6\. Important Product Constraints and Resolutions**

## **Users will not switch ecosystems**

Do not require a clean migration. Read/write through Apple Health and Android Health Connect where possible; later integrate Garmin/Strava/etc. The product becomes an intelligence and interaction layer.

## **People dislike logging**

Make logging disappear into the workout. Use short utterances, context, defaults, and automatic rest timers.

## **Gym audio is noisy**

Prefer push-to-talk / explicit listening windows for MVP, context-aware parsing, domain vocabulary, confidence scores, and one-tap correction.

## **Always-listening background app is unrealistic**

Use an explicit Workout Session. Keep realtime capabilities active only during the session and respect iOS/Android background/audio rules.

## **Battery/privacy**

Do not continuously upload raw audio. Use short audio windows, clear microphone state, optional on-device preprocessing, and discard raw audio by default unless explicitly needed.

## **Calorie-per-rep claims are unreliable**

Do not make false precision a feature. Prefer workload, volume, estimated 1RM, RPE/RIR, session energy ranges, and training load.

## **Protein should not oscillate per set**

Use body weight, goal, energy intake and weekly training load; adjust slowly rather than pretending each set changes protein requirements.

## **AI recommendations can be unsafe**

Use conservative progression rules, explain recommendations, allow user overrides, capture pain/injury flags, and avoid presenting uncertain estimates as medical facts.

## **Feature overload**

MVP \= strength session \+ voice logging \+ next-set assistance. Nutrition, steps, sleep, CV machine recognition and broad health intelligence come later.

# **7\. MVP Scope**

## **Must have**

* React Native mobile application.  
* Authentication and user profile.  
* Exercise catalog and workout/routine creation.  
* Manual workout logging as a reliable fallback.  
* Workout session state: current exercise, set, planned load/reps, completed sets, rest timer.  
* Push-to-talk low-latency speech capture during an active workout.  
* Streaming or near-streaming speech-to-text.  
* Context-aware command/intent parser.  
* Deterministic workout engine for set logging and basic progression.  
* Short text-to-speech responses.  
* Fast correction / undo / edit workflow.  
* Workout history and basic progression view.  
* Telemetry for latency, transcription confidence, parse failures and corrections.

## **Explicitly not MVP**

* Always-on 24/7 microphone.  
* Full diet planning and food logging.  
* Step/sleep/recovery intelligence.  
* Automatic gym machine computer vision.  
* Social feed.  
* Large gym-equipment database.  
* Advanced wearable integrations.  
* Per-rep calorie claims.  
* Kubernetes or complex microservice infrastructure.

# **8\. Key Voice UX**

The interaction must work with abbreviated speech because the system already knows the current workout context.

Coach: "Bench. Target 60 kilos for 9."

User:  \[finishes set\]

User:  "Ten."

System resolves: current exercise=bench, expected weight=60, reps=10

Coach: "Logged. Rest 2 minutes. Try 62.5 for 8."

User: "Same, got seven."

System resolves: same exercise/load, reps=7

User: "Actually that was eight."

System emits correction event and fixes previous set.

User: "What's next?"

System reads workout state and returns next planned exercise/set.

# **9\. High-Level Architecture**

┌─────────────────────────────────────────────────────────────┐

│                    React Native Mobile App                  │

│ Workout UI • Audio Capture • Local Session Cache • TTS Play │

└───────────────────────┬─────────────────────────────────────┘

                        │ HTTPS \+ WebSocket

             ┌──────────┴──────────┐

             │                     │

       Express REST API      Realtime Gateway

             │               (WebSocket)

             │                     │

             └──────────┬──────────┘

                        ▼

               Workout Session Service

                        │

       ┌────────────────┼─────────────────────────┐

       ▼                ▼                         ▼

 STT Adapter       Intent Parser            Workout Engine

       │                │                         │

 Provider API      Rules \+ Context          State \+ Progression

       │                │                         │

       └────────────────┴──────────┬──────────────┘

                                  ▼

                         Optional LLM Adapter

                                  │

                         ambiguous / complex intent

                                  │

                                  ▼

                              TTS Adapter

                                  │

                                  ▼

                            Voice Response

             MongoDB Atlas • Redis(optional) • S3(optional)

             Observability / logs / metrics / tracing

# **10\. Realtime Voice Pipeline**

1\. User enters active Workout Session.

2\. User presses/holds voice control (MVP).

3\. React Native captures small PCM/Opus audio chunks.

4\. Chunks travel over an authenticated WebSocket.

5\. Realtime service streams audio to configured STT provider.

6\. Provider returns partial and final transcript.

7\. Normalizer standardizes units/numbers/exercise aliases.

8\. Intent parser combines transcript \+ current workout state.

9\. High-confidence deterministic command executes immediately.

10\. Ambiguous/semantic request can be escalated to an LLM.

11\. Workout Engine emits a domain event and updates session state.

12\. State is persisted asynchronously/durably.

13\. Response text is generated.

14\. TTS adapter produces short speech, or device TTS speaks it.

15\. Mobile UI receives state update and voice response.

# **11\. Latency Budget**

Do not optimize for an abstract 'realtime' label. Instrument each stage. A short command should feel immediate. A reasonable engineering target for an MVP is roughly sub-second to \~1.5 seconds from end-of-utterance to useful feedback, with UI state updates arriving before or alongside TTS.

| Stage | Target direction | Notes |
| :---- | :---- | :---- |
| Audio chunking/uplink | \<100–200 ms chunks | Avoid waiting for a full recorded file. |
| STT endpoint/finalization | few hundred ms | Provider and endpointing strategy matter. |
| Parser/state lookup | \<10–50 ms | Keep hot session state local/in memory when possible. |
| LLM | avoid on common path | Can dominate latency; use only for ambiguous requests. |
| TTS first audio | few hundred ms | Keep responses short; device TTS is a valid MVP option. |

# **12\. Why the LLM Is Not the Core Runtime**

A common mistake would be sending every transcript to a general LLM. Most workout commands are structured and highly contextual. Deterministic parsing is cheaper, faster, easier to test, and more reliable.

"60 for 10"

      ↓

normalize()

      ↓

{ weightKg: 60, reps: 10 }

      ↓

current session says currentExercise \= bench

      ↓

SET\_COMPLETED event

No LLM required.

Use an LLM for requests such as:

* 'My elbow is bothering me; what can I do instead?'  
* 'I only have 25 minutes left, change the rest of today's workout.'  
* 'Why has my bench stopped progressing?'  
* Ambiguous utterances the deterministic parser cannot resolve confidently.

# **13\. Workout Engine: Core Product Logic**

The Workout Engine is the core domain component. Voice, chat, manual UI and future wearables should all modify the same workout state through the same commands/events.

WorkoutSession

├── sessionId / userId

├── status

├── gym/context

├── plannedWorkout

├── currentExerciseIndex

├── currentSetIndex

├── completedSets\[\]

├── restState

├── sessionStartedAt

├── constraints / pain flags

└── version

Initial deterministic responsibilities:

* Validate a set before committing it.  
* Resolve omitted values from context (e.g. 'ten' \= ten reps at expected load).  
* Start/cancel/update rest timers.  
* Advance current set/exercise.  
* Handle undo and correction.  
* Recommend conservative next-set changes.  
* Track progression and failed/completed targets.  
* Apply user overrides.  
* Emit auditable domain events.

# **14\. Event Model**

Use an event-oriented internal model even if MongoDB remains the primary database. It makes voice corrections, debugging and analytics much easier.

VOICE\_FINAL\_TRANSCRIPT

        ↓

INTENT\_PARSED

        ↓

SET\_COMPLETED

        ↓

WORKOUT\_STATE\_UPDATED

        ↓

REST\_STARTED

        ↓

RESPONSE\_REQUESTED

Example event:

{

  "type": "SET\_COMPLETED",

  "sessionId": "...",

  "exerciseId": "leg\_curl",

  "setIndex": 1,

  "weightKg": 40,

  "reps": 12,

  "source": "voice",

  "confidence": 0.97,

  "timestamp": "..."

}

# **15\. Suggested MongoDB Model**

* users — profile, units, goals, experience, preferences.  
* exercises — canonical exercises, aliases, muscle groups, equipment.  
* workoutTemplates — planned routines/programs.  
* workoutSessions — active/final session snapshot.  
* workoutEvents — append-oriented events for audit/correction/debugging.  
* gyms — later: gym/equipment profiles.  
* devices — mobile/watch capabilities and notification tokens.  
* integrations — later: Apple Health/Health Connect/provider metadata.  
* voiceDiagnostics — preferably metadata only: transcript confidence, parse path, latency; avoid retaining raw audio by default.

MongoDB is a reasonable MVP choice because the team already knows it well. The session snapshot and event documents fit naturally. Add indexes around userId \+ time, sessionId \+ sequence/time, and active session lookups. Do not introduce a second primary database until actual requirements justify it.

# **16\. Recommended MVP Technology Stack**

| Layer | Choice | Reason |
| :---- | :---- | :---- |
| Mobile | React Native \+ TypeScript | Existing skill; one codebase; native modules can be added where audio requires them. |
| API | Node.js \+ Express \+ TypeScript | Fastest development path given current expertise. |
| Realtime | WebSocket in Node/TypeScript | Sufficient for MVP voice events/audio streaming; separate logical service if useful. |
| Database | MongoDB Atlas | Existing expertise and managed operations. |
| Cache/session hot state | In-process first; Redis later | Avoid Redis until multi-instance/session routing requires it. |
| STT | Provider adapter (evaluate Deepgram/OpenAI/Google) | Streaming quality/latency and India/accent performance must be benchmarked. |
| LLM | Provider adapter | Keep replaceable; use off common path. |
| TTS | Device TTS first or provider adapter | Short coach responses do not initially require premium synthetic voice. |
| Storage | AWS S3 when needed | Media/object storage; raw workout audio should not be retained by default. |
| Compute | Simple managed container/VM first | Avoid EKS/Kubernetes for MVP. |
| Observability | CloudWatch \+ OpenTelemetry/Sentry-style error tracking | Latency and failure visibility are essential. |

# **17\. Provider Abstraction**

Business logic must never directly depend on a specific speech/LLM/TTS vendor.

interface SpeechToTextProvider {

  createStreamingSession(...): StreamingSTTSession

}

interface LanguageModelProvider {

  interpret(...): Promise\<StructuredIntent\>

  coach(...): Promise\<CoachResponse\>

}

interface TextToSpeechProvider {

  synthesize(text: string): Promise\<AudioStream\>

}

This permits latency/cost/quality routing later and avoids rewriting the workout engine when providers change.

# **18\. Suggested Monorepo Structure**

apps/

  mobile/                 \# React Native

services/

  api/                    \# Express REST API

  realtime/               \# WebSocket \+ streaming voice orchestration

packages/

  domain/                 \# domain types/events

  workout-engine/         \# deterministic state transitions

  voice-parser/           \# normalization \+ intent parsing

  ai-providers/           \# STT/LLM/TTS adapters

  db/                     \# Mongo models/repositories

  shared/                 \# schemas, utils, telemetry

# **19\. API / Realtime Boundary**

REST handles durable/non-live application operations:

POST /auth/...

POST /workouts/sessions

POST /workouts/sessions/:id/end

GET  /workouts/history

GET  /exercises

GET  /workout-templates

PATCH /users/preferences

WebSocket handles the active workout:

client → session.join

client → audio.start

client → audio.chunk

client → audio.end

server → transcript.partial

server → transcript.final

server → intent.resolved

server → workout.state

server → rest.started

server → voice.response

server → error.recoverable

# **20\. Reliability and Edge Cases**

* Network loss during a set: keep current session state cached locally and queue recoverable events.  
* Duplicate messages: every command/event needs an idempotency/event ID.  
* Out-of-order realtime events: include sequence/version numbers.  
* Wrong transcription: expose transcript \+ interpreted set briefly and support immediate 'undo'/'actually...' correction.  
* Bluetooth disconnect: fall back to phone microphone/speaker without destroying session.  
* App backgrounded/locked: session state must survive; design around platform-supported audio/background behavior.  
* Server restart: durable session snapshot \+ events allow recovery.  
* STT provider outage: manual UI must remain fully usable; optional fallback provider later.  
* LLM timeout: common set logging must continue because it does not depend on the LLM.  
* TTS failure: show text/haptic feedback and continue.

# **21\. Privacy and Security Principles**

* Microphone activation must be explicit and visible.  
* Do not implement covert/continuous listening.  
* Prefer ephemeral audio processing; do not store raw audio by default.  
* Encrypt transport with TLS/WSS and encrypt managed storage at rest.  
* Separate user identity from diagnostics where practical.  
* Provide delete/export controls for user fitness data.  
* Use least-privilege AWS IAM and a managed secret store.  
* Do not expose STT/LLM provider keys in the mobile application.  
* Treat health/fitness history as sensitive user data even when not formally medical data.  
* Never present uncertain fitness estimates as precise medical facts.

# **22\. Observability: What Must Be Measured**

The voice experience cannot be improved if only server errors are logged. Measure the entire path.

* audio\_start → first\_partial\_transcript  
* audio\_end → final\_transcript  
* final\_transcript → parsed\_intent  
* parsed\_intent → workout\_state\_update  
* response\_requested → first TTS audio  
* end-to-end voice command latency  
* STT confidence / no-speech / endpoint failures  
* parser confidence and deterministic vs LLM path  
* user correction rate after voice logs  
* manual fallback rate  
* workout completion rate  
* voice commands per workout  
* cost per active workout and per active user

# **23\. Cost Strategy**

Exact provider pricing changes and must be checked at implementation time. The architecture should minimize cost independently of any current price sheet.

* Do not stream microphone audio continuously throughout a one-hour workout.  
* Use explicit short speech windows for MVP.  
* Do not send ordinary numeric commands to an LLM.  
* Keep spoken responses short.  
* Use device TTS if quality is acceptable.  
* Store structured events, not unnecessary raw audio.  
* Instrument per-session provider usage from day one.  
* Benchmark providers on Indian accents, gym noise, latency and price before committing.

# **24\. AWS Direction**

Use AWS selectively; do not turn infrastructure learning into the MVP.

* S3 — object storage if/when needed.  
* CloudWatch — logs/metrics initially.  
* Secrets Manager / Parameter Store — server secrets.  
* ECR \+ ECS/Fargate or a simple EC2 deployment — reasonable compute evolution.  
* CloudFront — later for static/media distribution.  
* SNS is not required for normal mobile push; use platform push services / a suitable push layer.  
* Cognito is optional; existing JWT auth is fine for an MVP if implemented securely.  
* Do not start with EKS/Kubernetes.

# **25\. Development Sequence**

1. Build the domain model and manual strength workout flow first. If manual state transitions are unreliable, voice will only hide bugs.  
2. Implement Workout Engine as a standalone TypeScript package with unit tests.  
3. Add active-session persistence and local mobile cache.  
4. Add WebSocket session channel and mocked voice events.  
5. Integrate one streaming STT provider and push-to-talk audio.  
6. Build normalization \+ deterministic intent parser for the top workout commands.  
7. Add correction/undo and confidence handling before adding sophisticated coaching.  
8. Add short TTS responses and automatic rest flow.  
9. Add conservative progression recommendations.  
10. Only then add LLM interpretation for ambiguous/complex requests.  
11. Instrument latency, error rate, correction rate and provider cost.  
12. Dogfood heavily in real gyms before expanding scope.

# **26\. Initial Command Vocabulary**

| Utterance | Expected intent |
| :---- | :---- |
| '60 for 10' | Complete current set: weight=60, reps=10. |
| 'ten' | Complete current set using expected/current weight. |
| 'same for eight' | Reuse prior weight; reps=8. |
| 'increase to 62.5' | Update next/current planned load. |
| 'actually nine' | Correct most recent relevant rep count. |
| 'undo' | Revert most recent reversible workout event. |
| 'what's next?' | Read next action from workout state. |
| 'skip this' | Skip current exercise/set with confirmation rules. |
| 'my shoulder hurts' | Pain/constraint intent; avoid blind progression and route to safer logic/semantic handling. |
| 'end workout' | Finalize session. |

# **27\. Testing Strategy**

* Unit tests: every Workout Engine transition and parser rule.  
* Golden transcript tests: known utterance → expected structured intent.  
* Noise corpus: recordings from actual gyms with different Indian accents/languages where consent permits.  
* Property/idempotency tests for duplicate/out-of-order events.  
* Integration tests with mocked STT/LLM/TTS providers.  
* Latency tests at p50/p95/p99, not just averages.  
* Offline/network-flap tests on real Android/iPhone devices.  
* Dogfood test: complete full workouts without touching the phone except the intended voice control.

# **28\. Multilingual India Considerations**

The initial paying audience may use English comfortably, but Indian users frequently code-switch. Do not assume clean US-English gym speech. The parser should separate language recognition from canonical workout data.

* Canonical internal units and exercise IDs remain language-independent.  
* Maintain exercise aliases and common local pronunciations.  
* Benchmark Hinglish/code-switching before advertising multilingual support.  
* Numbers, decimal weights, kilograms, plates, 'same', 'done', and corrections deserve dedicated tests.  
* Provider selection should be based on real recordings from the target audience, not vendor demos.

# **29\. Long-Term Roadmap**

* Apple Health and Android Health Connect ingestion/write-back.  
* Wearable companion experience for even lower-friction logging.  
* Sleep/recovery/activity context.  
* Nutrition and adaptive calorie/protein guidance.  
* Gym profiles and crowdsourced equipment.  
* Computer-vision-assisted gym/equipment scan.  
* Personal trainer / coach dashboards.  
* Broader conversational fitness analysis.  
* Location-aware workout context where users explicitly opt in.  
* Provider routing between on-device and cloud speech models.  
* Offline command recognition for common workout vocabulary.

# **30\. Product Principles for AI Agents**

Any AI coding/product agent working on this repository should follow these rules unless a newer decision explicitly supersedes them:

13. Optimize for reducing user effort, not maximizing features.  
14. Voice is a primary interface during workouts, but manual UI is always a reliable fallback.  
15. The Workout Engine owns truth; STT, LLM and TTS providers do not.  
16. Do not put an LLM on the latency-critical path when deterministic context can solve the command.  
17. Keep external AI providers swappable behind adapters.  
18. Do not claim false precision for calories, recovery, protein, or injury risk.  
19. Do not build 24/7 covert listening; use explicit session/listening states.  
20. Prefer the simplest architecture that validates the product. React Native \+ TypeScript \+ Express \+ MongoDB is intentional for MVP.  
21. Do not introduce Redis, queues, Kubernetes, microservices or additional databases without a demonstrated requirement.  
22. Every realtime feature needs observability, failure handling, idempotency and correction UX.  
23. Protect raw audio and fitness data; retain only what is necessary.  
24. The core success metric is not transcription accuracy alone. It is whether a user can complete a workout with dramatically less interaction while retaining trustworthy structured data.

# **31\. Open Questions / Decisions Not Yet Final**

* Exact STT provider after real-world latency/accent/noise benchmark.  
* Cloud TTS versus device-native TTS for MVP.  
* Whether React Native audio requirements need a custom native module or an existing maintained library.  
* Exact iOS/Android locked-screen/background workout interaction design.  
* Pricing and subscription model in India.  
* Initial progression methodology and evidence base.  
* How much coaching is deterministic versus LLM-assisted.  
* Whether multilingual/Hinglish support is MVP or immediately post-MVP.  
* Health platform integrations and their launch priority.  
* Whether trainers become an early distribution channel.

# **32\. Definition of MVP Success**

The MVP succeeds if a serious gym user can complete repeated strength workouts with materially less phone interaction than conventional logging, trusts the recorded data, receives useful next-set guidance, and chooses to keep using the product because the voice workflow is faster than the alternatives.

Concrete validation signals:

* Most sets are logged by voice rather than manual entry.  
* Correction rate is low enough that voice saves time overall.  
* Users complete full sessions without repeatedly navigating the UI.  
* p95 voice command latency feels acceptable in real gyms.  
* Users return for multiple weeks and rely on previous-session context.  
* Users describe the benefit as 'I don't have to think about logging' or equivalent, not merely 'the AI is cool'.

# **33\. Current Status**

The project is at product/architecture definition stage. The core problem, initial user, MVP boundary, technical stack direction and realtime architecture are sufficiently defined to begin implementation. The next practical step is to create the repository/domain model and implement the manual Workout Engine before integrating speech.

**END OF WORKING REFERENCE**