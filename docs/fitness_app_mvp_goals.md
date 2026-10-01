**VOICE-FIRST FITNESS APP — MVP GOALS**

*A concise definition of what we are building and what the first product must prove*

Working product reference • August 2026

# **1\. MVP Mission**

Build a strength-training app that removes most of the effort involved in workout logging and basic workout decisions. During a gym session, a user should be able to train normally, speak short natural commands, and have the app reliably record the workout and guide the immediate next action.

# **2\. Core Product Promise**

The MVP should make structured strength tracking feel substantially easier than conventional workout logging apps.

Lift

  ↓

Speak naturally

  ↓

Workout is recorded correctly

  ↓

Rest / next set is handled

  ↓

User continues training

# **3\. What the MVP Must Prove**

1. Voice can genuinely reduce workout-logging friction in a real gym, not just work in a quiet demo.  
2. A user can log most of a strength workout without repeatedly navigating forms or typing.  
3. The app can understand abbreviated, context-dependent commands such as “ten”, “same for eight”, or “increase to 45”.  
4. Voice-created workout data is trustworthy enough that users are willing to rely on it for progression.  
5. Corrections are fast enough that an occasional speech mistake does not destroy the benefit of voice.  
6. Immediate guidance—rest timing, next set, next exercise and basic progression—makes the product more useful than voice transcription alone.  
7. Serious gym users return for repeated workouts because the product saves effort.

# **4\. Primary MVP User**

* Regular strength-training user, ideally training 4–6 times per week.  
* Cares about progressive overload, workout history and improving performance.  
* Currently logs workouts, has tried to log them, or wants the benefits of logging but dislikes the effort.  
* Comfortable using a smartphone/earbuds in the gym.  
* Initial commercial focus: paying consumers in India with meaningful fitness spend and willingness to pay for convenience/results.

# **5\. Core MVP User Journey**

Open app

  ↓

Choose / start today's workout

  ↓

See current exercise \+ target set

  ↓

Perform set

  ↓

Speak: "60 for 10"

  ↓

App records the set

  ↓

Rest timer begins

  ↓

App shows/speaks next target

  ↓

Repeat

  ↓

End workout

  ↓

Workout history and progress are saved

# **6\. Required MVP Capabilities**

* Account/profile and basic fitness preferences.  
* Exercise library.  
* Create/select a workout routine.  
* Start, pause/resume and end a workout session.  
* Manual set logging as a complete fallback.  
* Voice logging during an active workout.  
* Short commands and contextual commands.  
* Display current exercise, target weight/reps and completed sets.  
* Automatic rest timer after a completed set.  
* Immediate undo/correction/edit flow.  
* Basic next-set recommendation / progressive overload assistance.  
* Next-exercise guidance.  
* Workout history.  
* Basic progress information such as volume, load/reps history and estimated progression.  
* Clear voice/listening state so the user always knows when the app is listening.

# **7\. Minimum Voice Commands**

| User says | Expected behavior |
| :---- | :---- |
| “60 for 10” | Log current set at 60 kg × 10\. |
| “Ten” | Use current/expected weight and log 10 reps. |
| “Same for eight” | Reuse previous weight and log 8 reps. |
| “Increase to 45” | Set the relevant next/current target to 45 kg. |
| “Actually nine” | Correct the most recent relevant set. |
| “Undo” | Undo the latest reversible workout action. |
| “What’s next?” | Show/speak the next set or exercise. |
| “Skip this” | Skip current set/exercise through a safe confirmation flow. |
| “End workout” | Finish and save the workout. |

# **8\. What Is NOT an MVP Goal**

* A complete one-stop fitness platform on day one.  
* 24/7 always-listening microphone.  
* Full nutrition/food tracking and meal planning.  
* Automatic daily protein/calorie changes after every individual set.  
* Step, sleep, HRV and recovery intelligence.  
* Apple Health / Health Connect / Garmin / WHOOP / Strava integration unless needed for a small validation experiment.  
* Computer vision for automatically identifying gym machines.  
* A complete gym equipment database.  
* Social/community features.  
* Personal-trainer dashboards.  
* Advanced AI coaching for every fitness question.  
* Per-rep calorie estimates or other false-precision metrics.

# **9\. Product Principles**

8. Reduce effort before adding features.  
9. The user should spend more attention on lifting and less attention on the phone.  
10. Voice is the primary differentiator during the workout, not a novelty added to a conventional tracker.  
11. Manual interaction must remain available whenever voice is inconvenient.  
12. Do not force users to speak full sentences; context should do most of the work.  
13. A wrong log is worse than a slightly slower log. Trust matters.  
14. Recommendations should be understandable and conservative.  
15. Do not promise fitness measurements that cannot be estimated reliably.

# **10\. MVP Success Criteria**

* A user can complete a full real-world strength session with most sets logged by voice.  
* Voice saves time overall after accounting for corrections.  
* The user rarely needs to search for an exercise or repeatedly type weights/reps during the session.  
* Voice mistakes can be corrected in seconds.  
* The product remembers prior performance and uses it meaningfully in later sessions.  
* The user understands what to do next without needing to interpret complex dashboards.  
* Early users voluntarily use the product for multiple weeks.  
* Users describe the benefit as reduced logging/decision effort, not merely as an impressive voice demo.

# **11\. Current MVP Position**

We are intentionally starting with strength workouts rather than attempting the complete long-term fitness vision. If the voice-first workout experience is not significantly better than manual logging, the larger product thesis is not yet validated. The immediate goal is therefore to build and test this single experience extremely well.