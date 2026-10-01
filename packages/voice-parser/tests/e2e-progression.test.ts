import { describe, expect, it } from "vitest";
import {
    applyCommand,
    createWorkout,
    getCurrentExercise,
    getCurrentSet,
    type CommandResult,
    type WorkoutState,
} from "@vofana/workout-engine";
import { parseVoiceCommand } from "../src/parser.js";
import { workoutContextFromState } from "../src/from-state.js";

function createProgressionWorkout(): WorkoutState {
    return createWorkout({
        sessionId: "progression-session",
        userId: "progression-user",
        workoutId: "progression-workout",
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

function logTranscript(state: WorkoutState, transcript: string): CommandResult {
    const parsed = parseVoiceCommand({
        transcript,
        context: workoutContextFromState(state),
    });
    expect(parsed.status).toBe("PARSED");
    expect(parsed.command?.type).toBe("COMPLETE_SET");
    return applyCommand(state, parsed.command!);
}

describe("set completion and workout progression e2e", () => {
    it("advances to set 2 using refreshed context after the first log", () => {
        let state = startWorkout(createProgressionWorkout());

        const first = logTranscript(state, "Finished 10.");
        expect(first.success).toBe(true);
        state = first.state;

        const context = workoutContextFromState(state);
        expect(context.currentSet?.setNumber).toBe(2);
        expect(context.previousCompletedSet?.reps).toBe(10);
        expect(context.previousCompletedSet?.weightKg).toBe(60);

        const second = logTranscript(state, "Finished 10.");
        expect(second.success).toBe(true);
        expect(second.state.exercises[0]!.sets[1]!.status).toBe("COMPLETED");
        expect(second.state.exercises[0]!.sets[0]!.status).toBe("COMPLETED");
        expect(second.state.currentExerciseIndex).toBe(0);
        expect(second.state.currentSetIndex).toBe(2);
        expect(second.state.completedSets).toHaveLength(2);
    });

    it("starts rest after a non-final set and keeps the same exercise", () => {
        const state = startWorkout(createProgressionWorkout());
        const result = logTranscript(state, "I did 10 reps.");

        expect(result.success).toBe(true);
        expect(result.state.status).toBe("ACTIVE");
        expect(result.state.currentExerciseIndex).toBe(0);
        expect(result.state.currentSetIndex).toBe(1);
        expect(result.state.restState.status).toBe("RUNNING");
        expect(result.effects).toContainEqual({ type: "START_REST_TIMER", durationSeconds: 90 });
        expect(result.events.some((event) => event.type === "SET_COMPLETED")).toBe(true);
        expect(result.events.some((event) => event.type === "EXERCISE_COMPLETED")).toBe(false);
    });

    it("moves to the next exercise after the last set of exercise 1", () => {
        let state = startWorkout(createProgressionWorkout());
        const phrases = ["Finished 10.", "I did 8.", "10 reps."];
        let last: CommandResult | undefined;

        for (const phrase of phrases) {
            last = logTranscript(state, phrase);
            expect(last.success).toBe(true);
            state = last.state;
        }

        expect(state.exercises[0]!.status).toBe("COMPLETED");
        expect(state.exercises[0]!.sets.every((set) => set.status === "COMPLETED")).toBe(true);
        expect(state.currentExerciseIndex).toBe(1);
        expect(state.currentSetIndex).toBe(0);
        expect(getCurrentExercise(state)?.name).toBe("Squat");
        expect(getCurrentSet(state)?.setNumber).toBe(1);
        expect(state.status).toBe("ACTIVE");
        expect(last!.events.some((event) => event.type === "EXERCISE_COMPLETED")).toBe(true);
        expect(last!.effects).toContainEqual({ type: "START_REST_TIMER", durationSeconds: 90 });
        expect(last!.events.some((event) => event.type === "WORKOUT_COMPLETED")).toBe(false);
    });

    it("completes the workout on the last set and does not start rest", () => {
        let state = startWorkout(createProgressionWorkout());
        const phrases = ["Finished 10.", "I did 8.", "10 reps.", "Finished 5.", "I did 5."];
        let last: CommandResult | undefined;

        for (const phrase of phrases) {
            last = logTranscript(state, phrase);
            expect(last.success).toBe(true);
            state = last.state;
        }

        expect(state.status).toBe("COMPLETED");
        expect(state.exercises[1]!.status).toBe("COMPLETED");
        expect(getCurrentExercise(state)).toBeNull();
        expect(getCurrentSet(state)).toBeNull();
        expect(last!.events.some((event) => event.type === "WORKOUT_COMPLETED")).toBe(true);
        expect(last!.effects.some((effect) => effect.type === "START_REST_TIMER")).toBe(false);
    });

    it("restores the cursor when undoing a log that advanced a set", () => {
        let state = startWorkout(createProgressionWorkout());
        state = logTranscript(state, "Finished 10.").state;

        const undoParsed = parseVoiceCommand({
            transcript: "undo that",
            context: workoutContextFromState(state),
        });
        expect(undoParsed.command).toEqual({ type: "UNDO" });

        const undone = applyCommand(state, undoParsed.command!);
        expect(undone.success).toBe(true);
        expect(undone.state.exercises[0]!.sets[0]!.status).toBe("PENDING");
        expect(undone.state.currentSetIndex).toBe(0);
        expect(undone.state.completedSets).toHaveLength(0);
    });

    it("does not complete a set when the workout has not started", () => {
        const state = createProgressionWorkout();
        const parsed = parseVoiceCommand({
            transcript: "Finished 10.",
            context: workoutContextFromState(state),
        });
        expect(parsed.status).toBe("PARSED");
        const result = applyCommand(state, parsed.command!);
        expect(result.success).toBe(false);
        expect(result.error?.code).toBe("WORKOUT_NOT_ACTIVE");
        expect(result.state.status).toBe("NOT_STARTED");
        expect(result.state.currentSetIndex).toBe(0);
        expect(result.state.completedSets).toHaveLength(0);
    });

    it("does not log after the workout is already completed", () => {
        let state = startWorkout(createProgressionWorkout());
        for (const phrase of ["Finished 10.", "I did 8.", "10 reps.", "Finished 5.", "I did 5."]) {
            state = logTranscript(state, phrase).state;
        }
        expect(state.status).toBe("COMPLETED");

        const parsed = parseVoiceCommand({
            transcript: "Finished 10.",
            context: workoutContextFromState(state),
        });
        expect(parsed.status).toBe("PARSED");
        const result = applyCommand(state, parsed.command!);
        expect(result.success).toBe(false);
        expect(result.error?.code).toBe("WORKOUT_NOT_ACTIVE");
        expect(result.state.status).toBe("COMPLETED");
        expect(result.state.completedSets).toHaveLength(5);
    });
});
