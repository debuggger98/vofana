import { describe, expect, it } from "vitest";
import {
    applyCommand,
    createWorkout,
    describeNextAction,
    getCurrentExercise,
    type WorkoutState,
} from "@vofana/workout-engine";
import { parseVoiceCommand } from "../src/parser.js";
import { workoutContextFromState } from "../src/from-state.js";

function createNavigationWorkout(): WorkoutState {
    return createWorkout({
        sessionId: "nav-session",
        userId: "nav-user",
        workoutId: "nav-workout",
        defaultRestSeconds: 90,
        exercises: [
            {
                exerciseId: "bench_press",
                name: "Bench Press",
                order: 0,
                target: { sets: 3, reps: { min: 8, max: 10 }, weightKg: 60 },
            },
            {
                exerciseId: "squat",
                name: "Squat",
                order: 1,
                target: { sets: 2, reps: { min: 5, max: 5 }, weightKg: 100 },
            },
        ],
    });
}

function startWorkout(state: WorkoutState): WorkoutState {
    const started = applyCommand(state, { type: "START_WORKOUT" });
    if (!started.success) {
        throw new Error(started.error?.message ?? "failed to start workout");
    }
    return started.state;
}

function applyTranscript(state: WorkoutState, transcript: string) {
    const parsed = parseVoiceCommand({
        transcript,
        context: workoutContextFromState(state),
    });
    return { parsed, result: parsed.command ? applyCommand(state, parsed.command) : undefined };
}

describe("workout navigation e2e", () => {
    it("what's next does not mutate state", () => {
        const state = startWorkout(createNavigationWorkout());
        const { parsed, result } = applyTranscript(state, "what's next?");
        expect(parsed.interpretation?.intent).toBe("WHAT_NEXT");
        expect(parsed.status).toBe("QUERY");
        expect(parsed.command).toBeUndefined();
        expect(result).toBeUndefined();
        expect(state.version).toBe(1);
        expect(describeNextAction(state)).toContain("Bench Press set 1/");
    });

    it("next exercise skips remaining sets and moves on", () => {
        const state = startWorkout(createNavigationWorkout());
        const { parsed, result } = applyTranscript(state, "go to the next one");
        expect(parsed.command).toEqual({ type: "NEXT_EXERCISE" });
        expect(result?.success).toBe(true);
        expect(result!.state.currentExerciseIndex).toBe(1);
        expect(result!.state.exercises[0]!.sets.every((set) => set.status === "SKIPPED")).toBe(true);
        expect(getCurrentExercise(result!.state)?.name).toBe("Squat");
    });

    it("next set skips only the current set", () => {
        const state = startWorkout(createNavigationWorkout());
        const { parsed, result } = applyTranscript(state, "next set");
        expect(parsed.command).toEqual({ type: "SKIP_SET" });
        expect(result?.success).toBe(true);
        expect(result!.state.exercises[0]!.sets[0]!.status).toBe("SKIPPED");
        expect(result!.state.currentExerciseIndex).toBe(0);
        expect(result!.state.currentSetIndex).toBe(1);
    });

    it("skip exercise moves to the next exercise", () => {
        const state = startWorkout(createNavigationWorkout());
        const { result } = applyTranscript(state, "skip this exercise");
        expect(result?.success).toBe(true);
        expect(result!.state.exercises[0]!.status).toBe("SKIPPED");
        expect(result!.state.currentExerciseIndex).toBe(1);
    });

    it("go back returns to the previous exercise", () => {
        let state = startWorkout(createNavigationWorkout());
        state = applyTranscript(state, "next exercise").result!.state;
        const { parsed, result } = applyTranscript(state, "go back");
        expect(parsed.command).toEqual({ type: "PREVIOUS_EXERCISE" });
        expect(result?.success).toBe(true);
        expect(result!.state.currentExerciseIndex).toBe(0);
        expect(result!.state.exercises[0]!.status).toBe("IN_PROGRESS");
    });

    it("next exercise on the last exercise does not mutate", () => {
        let state = startWorkout(createNavigationWorkout());
        state = applyTranscript(state, "next exercise").result!.state;
        const { result } = applyTranscript(state, "next exercise");
        expect(result?.success).toBe(false);
        expect(result!.state.currentExerciseIndex).toBe(1);
    });

    it("skip this does not apply a command", () => {
        const state = startWorkout(createNavigationWorkout());
        const { parsed, result } = applyTranscript(state, "skip this");
        expect(parsed.status).toBe("AMBIGUOUS");
        expect(result).toBeUndefined();
    });
});
