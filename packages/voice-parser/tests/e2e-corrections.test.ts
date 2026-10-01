import { describe, expect, it } from "vitest";
import { applyCommand, createWorkout, type WorkoutState } from "@vofana/workout-engine";
import { parseVoiceCommand } from "../src/parser.js";
import { workoutContextFromState } from "../src/from-state.js";

function createCorrectionWorkout(): WorkoutState {
    const created = createWorkout({
        sessionId: "corr-session",
        userId: "corr-user",
        workoutId: "corr-workout",
        defaultRestSeconds: 90,
        exercises: [
            {
                exerciseId: "bench_press",
                name: "Bench Press",
                order: 0,
                target: { sets: 3, reps: { min: 8, max: 10 }, weightKg: 60 },
            },
        ],
    });
    const started = applyCommand(created, { type: "START_WORKOUT" });
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

function logFirstSet(state: WorkoutState): WorkoutState {
    const logged = applyTranscript(state, "Finished 10.");
    expect(logged.result?.success).toBe(true);
    return logged.result!.state;
}

describe("corrections e2e", () => {
    it("corrects last-set reps from actually that was 8", () => {
        let state = logFirstSet(createCorrectionWorkout());
        const setId = state.exercises[0]!.sets[0]!.id;

        const corrected = applyTranscript(state, "Actually, that was 8.");
        expect(corrected.parsed.command).toEqual({ type: "EDIT_SET", setId, reps: 8 });
        expect(corrected.result?.success).toBe(true);
        state = corrected.result!.state;

        expect(state.exercises[0]!.sets[0]!.actualReps).toBe(8);
        expect(state.exercises[0]!.sets[0]!.actualWeightKg).toBe(60);
        expect(state.exercises[0]!.sets[0]!.status).toBe("COMPLETED");
        expect(state.currentSetIndex).toBe(1);
    });

    it("corrects last-set weight from I meant 40", () => {
        let state = logFirstSet(createCorrectionWorkout());
        const setId = state.exercises[0]!.sets[0]!.id;

        const corrected = applyTranscript(state, "I meant 40.");
        expect(corrected.parsed.command).toEqual({ type: "EDIT_SET", setId, weightKg: 40 });
        expect(corrected.result?.success).toBe(true);
        state = corrected.result!.state;

        expect(state.exercises[0]!.sets[0]!.actualWeightKg).toBe(40);
        expect(state.exercises[0]!.sets[0]!.actualReps).toBe(10);
        expect(state.currentSetIndex).toBe(1);
    });

    it("corrects last-set weight from change that to 45 kilos", () => {
        const state = logFirstSet(createCorrectionWorkout());
        const setId = state.exercises[0]!.sets[0]!.id;

        const corrected = applyTranscript(state, "Change that to 45 kilos.");
        expect(corrected.parsed.command).toEqual({ type: "EDIT_SET", setId, weightKg: 45 });
        expect(corrected.result?.success).toBe(true);
        expect(corrected.result!.state.exercises[0]!.sets[0]!.actualWeightKg).toBe(45);
    });

    it("undoes the last log from accidentally logged that twice", () => {
        const state = logFirstSet(createCorrectionWorkout());

        const undone = applyTranscript(state, "I accidentally logged that twice.");
        expect(undone.parsed.command).toEqual({ type: "UNDO" });
        expect(undone.result?.success).toBe(true);
        expect(undone.result!.state.exercises[0]!.sets[0]!.status).toBe("PENDING");
        expect(undone.result!.state.completedSets).toHaveLength(0);
        expect(undone.result!.state.currentSetIndex).toBe(0);
    });

    it("keeps that was 10 with 40 as logging not a correction", () => {
        const state = createCorrectionWorkout();
        const logged = applyTranscript(state, "That was 10 with 40.");
        expect(logged.parsed.command).toMatchObject({
            type: "COMPLETE_SET",
            weightKg: 40,
            reps: 10,
        });
        expect(logged.result?.success).toBe(true);
        expect(logged.result!.state.exercises[0]!.sets[0]!.actualWeightKg).toBe(40);
    });
});
