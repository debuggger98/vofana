import { describe, expect, it } from "vitest";
import {
    applyCommand,
    createWorkout,
    describeNextAction,
    answerQuery,
    getCurrentExercise,
    getCurrentSet,
    getNextExercise,
    getNextSet,
} from "../src/index.js";
import { resetIdCounter } from "../src/id.js";
import {
    apply,
    createActiveWorkout,
    createSingleExerciseWorkout,
    createTestWorkout,
    createWorkoutWithCompletedSet,
    FIXED_TIMESTAMP,
} from "./fixtures.js";

describe("Initial State", () => {
    it("creates a new workout in NOT_STARTED status", () => {
        resetIdCounter();
        const state = createTestWorkout();
        expect(state.status).toBe("NOT_STARTED");
        expect(state.version).toBe(0);
        expect(state.exercises).toHaveLength(2);
        expect(state.completedSets).toHaveLength(0);
        expect(state.currentExerciseIndex).toBe(0);
        expect(state.currentSetIndex).toBe(0);
    });
});

describe("Start Workout", () => {
    it("transitions NOT_STARTED to ACTIVE", () => {
        const state = createTestWorkout();
        const result = apply(state, { type: "START_WORKOUT" });

        expect(result.success).toBe(true);
        expect(result.state.status).toBe("ACTIVE");
        expect(result.state.startedAt).toBe(FIXED_TIMESTAMP);
        expect(result.state.currentExerciseIndex).toBe(0);
        expect(result.state.currentSetIndex).toBe(0);
        expect(result.state.version).toBe(1);
        expect(result.events).toHaveLength(1);
        expect(result.events[0]?.type).toBe("WORKOUT_STARTED");

        const exercise = getCurrentExercise(result.state);
        expect(exercise?.name).toBe("Bench Press");
        expect(exercise?.status).toBe("IN_PROGRESS");

        const set = getCurrentSet(result.state);
        expect(set?.setNumber).toBe(1);
        expect(set?.status).toBe("PENDING");
    });
});

describe("Complete Set", () => {
    it("completes set 1 and advances to set 2", () => {
        const state = createActiveWorkout();
        const result = apply(state, {
            type: "COMPLETE_SET",
            weightKg: 60,
            reps: 10,
            source: "VOICE",
        });

        expect(result.success).toBe(true);

        const exercise = state.exercises[0]!;
        const set1 = exercise.sets[0]!;
        const completedSet = result.state.exercises[0]!.sets[0]!;

        expect(completedSet.status).toBe("COMPLETED");
        expect(completedSet.actualWeightKg).toBe(60);
        expect(completedSet.actualReps).toBe(10);
        expect(completedSet.source).toBe("VOICE");
        expect(completedSet.id).toBe(set1.id);

        expect(result.state.currentSetIndex).toBe(1);
        expect(getCurrentSet(result.state)?.setNumber).toBe(2);
        expect(result.state.completedSets).toHaveLength(1);
        expect(result.events.some((e) => e.type === "SET_COMPLETED")).toBe(true);
    });

    it("resolves weight from context when omitted", () => {
        const state = createActiveWorkout();
        const result = apply(state, { type: "COMPLETE_SET", reps: 10 });

        expect(result.success).toBe(true);
        expect(result.state.exercises[0]!.sets[0]!.actualWeightKg).toBe(60);
    });
});

describe("Multiple Sets", () => {
    it("tracks three completed sets correctly", () => {
        let state = createActiveWorkout();

        const sets = [
            { weightKg: 60, reps: 10 },
            { weightKg: 60, reps: 9 },
            { weightKg: 62.5, reps: 8 },
        ];

        for (const s of sets) {
            const result = apply(state, { type: "COMPLETE_SET", ...s });
            expect(result.success).toBe(true);
            state = result.state;
        }

        const bench = state.exercises[0]!;
        expect(bench.sets[0]!.actualWeightKg).toBe(60);
        expect(bench.sets[0]!.actualReps).toBe(10);
        expect(bench.sets[1]!.actualReps).toBe(9);
        expect(bench.sets[2]!.actualWeightKg).toBe(62.5);
        expect(state.completedSets).toHaveLength(3);
    });
});

describe("Exercise Advancement", () => {
    it("advances to next exercise after final set", () => {
        let state = createActiveWorkout();
        let lastResult;

        for (let i = 0; i < 3; i++) {
            lastResult = apply(state, { type: "COMPLETE_SET", weightKg: 60, reps: 10 });
            state = lastResult.state;
        }

        expect(state.currentExerciseIndex).toBe(1);
        expect(state.currentSetIndex).toBe(0);
        expect(state.exercises[0]!.status).toBe("COMPLETED");
        expect(getCurrentExercise(state)?.name).toBe("Incline Dumbbell Press");
        expect(lastResult!.events.some((e) => e.type === "EXERCISE_COMPLETED")).toBe(true);
    });
});

describe("Workout Completion", () => {
    it("completes workout after final set of final exercise", () => {
        let state = createActiveWorkout();

        for (let ex = 0; ex < 2; ex++) {
            for (let set = 0; set < 3; set++) {
                const weight = ex === 0 ? 60 : 22.5;
                const result = apply(state, { type: "COMPLETE_SET", weightKg: weight, reps: 10 - set });
                state = result.state;
            }
        }

        expect(state.status).toBe("COMPLETED");
        expect(state.endedAt).toBe(FIXED_TIMESTAMP);
        expect(getCurrentExercise(state)).toBeNull();
        expect(getCurrentSet(state)).toBeNull();
    });
});

describe("Invalid Values", () => {
    it.each([
        { weightKg: -10, reps: 10, label: "negative weight" },
        { weightKg: 60, reps: 0, label: "zero reps" },
        { weightKg: 60, reps: -1, label: "negative reps" },
        { weightKg: NaN, reps: 10, label: "NaN weight" },
        { weightKg: 60, reps: NaN, label: "NaN reps" },
        { weightKg: Infinity, reps: 10, label: "Infinity weight" },
    ])("rejects $label", ({ weightKg, reps }) => {
        const state = createActiveWorkout();
        const result = apply(state, { type: "COMPLETE_SET", weightKg, reps });
        expect(result.success).toBe(false);
        expect(result.error?.code).toBe("INVALID_SET_DATA");
    });
});

describe("Skip Set", () => {
    it("marks set as SKIPPED and advances", () => {
        const state = createActiveWorkout();
        const result = apply(state, { type: "SKIP_SET" });

        expect(result.success).toBe(true);
        expect(result.state.exercises[0]!.sets[0]!.status).toBe("SKIPPED");
        expect(result.state.currentSetIndex).toBe(1);
        expect(result.events.some((e) => e.type === "SET_SKIPPED")).toBe(true);
    });
});

describe("Skip Exercise", () => {
    it("skips exercise and moves to next", () => {
        const state = createActiveWorkout();
        const result = apply(state, { type: "SKIP_EXERCISE" });

        expect(result.success).toBe(true);
        expect(result.state.exercises[0]!.status).toBe("SKIPPED");
        expect(result.state.currentExerciseIndex).toBe(1);
        expect(result.events.some((e) => e.type === "EXERCISE_SKIPPED")).toBe(true);
    });
});

describe("Undo", () => {
    it("undoes the most recent set completion", () => {
        const state = createWorkoutWithCompletedSet();
        const result = apply(state, { type: "UNDO" });

        expect(result.success).toBe(true);
        expect(result.state.exercises[0]!.sets[0]!.status).toBe("PENDING");
        expect(result.state.currentSetIndex).toBe(0);
        expect(result.state.completedSets).toHaveLength(0);
        expect(result.events.some((e) => e.type === "SET_UNDONE")).toBe(true);
    });

    it("only undoes the most recent operation", () => {
        let state = createActiveWorkout();
        state = apply(state, { type: "COMPLETE_SET", weightKg: 60, reps: 10 }).state;
        state = apply(state, { type: "COMPLETE_SET", weightKg: 60, reps: 9 }).state;

        const result = apply(state, { type: "UNDO" });

        expect(result.success).toBe(true);
        expect(result.state.exercises[0]!.sets[1]!.status).toBe("PENDING");
        expect(result.state.exercises[0]!.sets[0]!.status).toBe("COMPLETED");
        expect(result.state.currentSetIndex).toBe(1);
    });
});

describe("Rest", () => {
    it("emits START_REST_TIMER effect after completing a set", () => {
        const state = createActiveWorkout();
        const result = apply(state, { type: "COMPLETE_SET", weightKg: 60, reps: 10 });

        expect(result.effects).toContainEqual({ type: "START_REST_TIMER", durationSeconds: 90 });
        expect(result.state.restState.status).toBe("RUNNING");
    });

    it("skips rest and stops timer", () => {
        let state = createWorkoutWithCompletedSet();
        const result = apply(state, { type: "SKIP_REST" });

        expect(result.success).toBe(true);
        expect(result.effects).toContainEqual({ type: "STOP_REST_TIMER" });
        expect(result.state.restState.status).toBe("IDLE");
    });
});

describe("Pause and resume", () => {
    it("pauses an active workout and stops a running rest timer", () => {
        const state = createWorkoutWithCompletedSet();
        expect(state.restState.status).toBe("RUNNING");
        const result = apply(state, { type: "PAUSE_WORKOUT" });
        expect(result.success).toBe(true);
        expect(result.state.status).toBe("PAUSED");
        expect(result.effects).toContainEqual({ type: "STOP_REST_TIMER" });
        expect(result.state.restState.status).toBe("RUNNING");
        expect(result.events.some((event) => event.type === "WORKOUT_PAUSED")).toBe(true);
    });

    it("resumes a paused workout and restarts rest if it was running", () => {
        let state = createWorkoutWithCompletedSet();
        state = apply(state, { type: "PAUSE_WORKOUT" }).state;
        const result = apply(state, { type: "RESUME_WORKOUT" });
        expect(result.success).toBe(true);
        expect(result.state.status).toBe("ACTIVE");
        expect(result.effects).toContainEqual({ type: "START_REST_TIMER", durationSeconds: 90 });
        expect(result.events.some((event) => event.type === "WORKOUT_RESUMED")).toBe(true);
    });

    it("treats a second pause as a no-op", () => {
        let state = createActiveWorkout();
        state = apply(state, { type: "PAUSE_WORKOUT" }).state;
        const version = state.version;
        const result = apply(state, { type: "PAUSE_WORKOUT" });
        expect(result.success).toBe(true);
        expect(result.state.status).toBe("PAUSED");
        expect(result.state.version).toBe(version);
        expect(result.events).toHaveLength(0);
    });

    it("rejects pause when the workout has not started", () => {
        const state = createTestWorkout();
        const result = apply(state, { type: "PAUSE_WORKOUT" });
        expect(result.success).toBe(false);
        expect(result.error?.code).toBe("INVALID_STATE_TRANSITION");
        expect(result.state.status).toBe("NOT_STARTED");
    });
});

describe("Next and previous exercise", () => {
    it("NEXT_EXERCISE skips remaining sets and advances", () => {
        const state = createActiveWorkout();
        const result = apply(state, { type: "NEXT_EXERCISE" });

        expect(result.success).toBe(true);
        expect(result.state.exercises[0]!.status).toBe("COMPLETED");
        expect(result.state.exercises[0]!.sets.every((set) => set.status === "SKIPPED")).toBe(true);
        expect(result.state.currentExerciseIndex).toBe(1);
        expect(result.state.currentSetIndex).toBe(0);
        expect(result.events.some((event) => event.type === "EXERCISE_COMPLETED")).toBe(true);
    });

    it("PREVIOUS_EXERCISE reopens the prior exercise on the first pending set", () => {
        let state = createActiveWorkout();
        state = apply(state, { type: "COMPLETE_SET", weightKg: 60, reps: 10 }).state;
        state = apply(state, { type: "NEXT_EXERCISE" }).state;

        const result = apply(state, { type: "PREVIOUS_EXERCISE" });
        expect(result.success).toBe(true);
        expect(result.state.currentExerciseIndex).toBe(0);
        expect(result.state.exercises[0]!.status).toBe("IN_PROGRESS");
        expect(result.state.exercises[0]!.sets[0]!.status).toBe("COMPLETED");
        expect(result.state.exercises[0]!.sets[1]!.status).toBe("PENDING");
        expect(result.state.currentSetIndex).toBe(1);
        expect(result.events.some((event) => event.type === "EXERCISE_RESUMED")).toBe(true);
    });

    it("rejects PREVIOUS_EXERCISE on the first exercise", () => {
        const state = createActiveWorkout();
        const result = apply(state, { type: "PREVIOUS_EXERCISE" });
        expect(result.success).toBe(false);
        expect(result.error?.code).toBe("INVALID_COMMAND");
        expect(result.state.currentExerciseIndex).toBe(0);
    });

    it("undoes PREVIOUS_EXERCISE", () => {
        let state = createActiveWorkout();
        state = apply(state, { type: "NEXT_EXERCISE" }).state;
        state = apply(state, { type: "PREVIOUS_EXERCISE" }).state;
        const result = apply(state, { type: "UNDO" });
        expect(result.success).toBe(true);
        expect(result.state.currentExerciseIndex).toBe(1);
    });
});

describe("describeNextAction", () => {
    it("describes the current pending set on an active workout", () => {
        const state = createActiveWorkout();
        expect(describeNextAction(state)).toContain("Bench Press set 1/");
    });

    it("describes not started and completed workouts", () => {
        expect(describeNextAction(createTestWorkout())).toBe('Say "start workout".');
        let state = createSingleExerciseWorkout();
        state = apply(state, { type: "START_WORKOUT" }).state;
        state = apply(state, { type: "COMPLETE_SET", weightKg: 100, reps: 5 }).state;
        state = apply(state, { type: "COMPLETE_SET", weightKg: 100, reps: 5 }).state;
        state = apply(state, { type: "COMPLETE_SET", weightKg: 100, reps: 5 }).state;
        expect(describeNextAction(state)).toBe("Workout complete.");
    });
});

describe("answerQuery", () => {
    it("answers remaining sets, current exercise, and current set without mutating", () => {
        const state = createActiveWorkout();
        const version = state.version;

        expect(answerQuery(state, "SETS_REMAINING")).toBe("3 sets left on Bench Press, 6 sets in the workout.");
        expect(answerQuery(state, "CURRENT_EXERCISE")).toBe("Bench Press");
        expect(answerQuery(state, "CURRENT_SET")).toBe("Bench Press set 1/3");
        expect(answerQuery(state, "WHAT_NEXT")).toBe(describeNextAction(state));
        expect(state.version).toBe(version);
    });

    it("answers last weight and reps from the completed set", () => {
        const state = createWorkoutWithCompletedSet();
        expect(answerQuery(state, "LAST_WEIGHT")).toBe("60 kg");
        expect(answerQuery(state, "LAST_REPS")).toBe("10 reps");
        expect(answerQuery(state, "SETS_REMAINING")).toBe("2 sets left on Bench Press, 5 sets in the workout.");
    });

    it("says when no set has been logged yet", () => {
        const state = createActiveWorkout();
        expect(answerQuery(state, "LAST_WEIGHT")).toBe("No completed set yet.");
        expect(answerQuery(state, "LAST_REPS")).toBe("No completed set yet.");
    });
});

describe("Invalid State Transitions", () => {
    it("rejects COMPLETE_SET when NOT_STARTED", () => {
        const state = createTestWorkout();
        const result = apply(state, { type: "COMPLETE_SET", weightKg: 60, reps: 10 });
        expect(result.success).toBe(false);
        expect(result.error?.code).toBe("WORKOUT_NOT_ACTIVE");
    });

    it("rejects START_WORKOUT when COMPLETED", () => {
        let state = createSingleExerciseWorkout();
        state = apply(state, { type: "START_WORKOUT" }).state;
        state = apply(state, { type: "COMPLETE_SET", weightKg: 100, reps: 5 }).state;
        state = apply(state, { type: "COMPLETE_SET", weightKg: 100, reps: 5 }).state;
        state = apply(state, { type: "COMPLETE_SET", weightKg: 100, reps: 5 }).state;

        const result = apply(state, { type: "START_WORKOUT" });
        expect(result.success).toBe(false);
        expect(result.error?.code).toBe("INVALID_STATE_TRANSITION");
    });

    it("rejects COMPLETE_SET when CANCELLED", () => {
        let state = createActiveWorkout();
        state = apply(state, { type: "CANCEL_WORKOUT" }).state;
        const result = apply(state, { type: "COMPLETE_SET", weightKg: 60, reps: 10 });
        expect(result.success).toBe(false);
    });
});

describe("Idempotency", () => {
    it("does not duplicate state mutations for same commandId", () => {
        const state = createActiveWorkout();
        const command = {
            type: "COMPLETE_SET" as const,
            weightKg: 60,
            reps: 10,
            commandId: "cmd-abc",
        };

        const first = apply(state, command);
        const second = apply(first.state, command);

        expect(first.success).toBe(true);
        expect(second.success).toBe(true);
        expect(second.state.version).toBe(first.state.version);
        expect(second.events).toHaveLength(0);
    });
});

describe("Determinism", () => {
    it("produces equivalent results for same state and command", () => {
        resetIdCounter();
        const state1 = createActiveWorkout();
        resetIdCounter();
        const state2 = createActiveWorkout();

        const cmd = { type: "COMPLETE_SET" as const, weightKg: 60, reps: 10 };
        const r1 = applyCommand(state1, cmd, { timestamp: FIXED_TIMESTAMP });
        const r2 = applyCommand(state2, cmd, { timestamp: FIXED_TIMESTAMP });

        expect(r1.state.status).toBe(r2.state.status);
        expect(r1.state.currentSetIndex).toBe(r2.state.currentSetIndex);
        expect(r1.state.exercises[0]!.sets[0]!.actualReps).toBe(
            r2.state.exercises[0]!.sets[0]!.actualReps,
        );
    });
});

describe("Helpers", () => {
    it("getNextSet returns next pending set", () => {
        const state = createActiveWorkout();
        const next = getNextSet(state);
        expect(next?.setNumber).toBe(2);
    });

    it("getNextExercise returns second exercise", () => {
        const state = createActiveWorkout();
        const next = getNextExercise(state);
        expect(next?.name).toBe("Incline Dumbbell Press");
    });
});