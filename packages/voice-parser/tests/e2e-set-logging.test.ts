import { describe, expect, it } from "vitest";
import { applyCommand, createWorkout } from "@vofana/workout-engine";
import { parseVoiceCommand } from "../src/parser.js";
import { afterSetContext, benchContext } from "./fixtures.js";

function createActiveBenchWorkout() {
    const created = createWorkout({
        sessionId: "e2e-session",
        userId: "e2e-user",
        workoutId: "e2e-workout",
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
    const started = applyCommand(created, { type: "START_WORKOUT" });
    if (!started.success) {
        throw new Error(started.error?.message ?? "failed to start workout");
    }
    return started.state;
}

describe("robust set logging e2e", () => {
    it.each([
        ["I did 10 reps.", 60, 10],
        ["10 reps.", 60, 10],
        ["Finished 10.", 60, 10],
        ["I got 10.", 60, 10],
        ["I did 10 reps at 40 kilos.", 40, 10],
        ["Finished 10 at 40.", 40, 10],
        ["That was 10 with 40.", 40, 10],
    ])('logs current set from "%s"', (transcript, weightKg, reps) => {
        const state = createActiveBenchWorkout();
        const parsed = parseVoiceCommand({
            transcript,
            context: {
                workoutStatus: state.status,
                currentExercise: { id: "bench_press", name: "Bench Press" },
                currentSet: {
                    id: state.exercises[0]!.sets[0]!.id,
                    setNumber: 1,
                    plannedWeightKg: 60,
                    plannedReps: 8,
                },
                units: "KG",
            },
        });

        expect(parsed.status).toBe("PARSED");
        expect(parsed.command).toMatchObject({
            type: "COMPLETE_SET",
            weightKg,
            reps,
            source: "VOICE",
        });

        const result = applyCommand(state, parsed.command!);
        expect(result.success).toBe(true);
        expect(result.state.exercises[0]!.sets[0]!.status).toBe("COMPLETED");
        expect(result.state.exercises[0]!.sets[0]!.actualWeightKg).toBe(weightKg);
        expect(result.state.exercises[0]!.sets[0]!.actualReps).toBe(reps);
        expect(result.state.currentSetIndex).toBe(1);
        expect(result.state.completedSets).toHaveLength(1);
    });

    it("does not invent weight when context has none", () => {
        const parsed = parseVoiceCommand({
            transcript: "Finished 10.",
            context: {
                workoutStatus: "ACTIVE",
                currentSet: { id: "set-1", setNumber: 1 },
                units: "KG",
            },
        });
        expect(parsed.status).toBe("AMBIGUOUS");
        expect(parsed.command).toBeUndefined();
    });

    it("keeps finish workout as END_WORKOUT", () => {
        const parsed = parseVoiceCommand({
            transcript: "finish workout",
            context: benchContext,
        });
        expect(parsed.command).toEqual({ type: "END_WORKOUT" });
    });

    it("keeps that was nine as a correction when a previous set exists", () => {
        const parsed = parseVoiceCommand({
            transcript: "that was nine",
            context: afterSetContext,
        });
        expect(parsed.command).toEqual({
            type: "EDIT_SET",
            setId: "set-1",
            reps: 9,
        });
    });
});
