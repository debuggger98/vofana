import { describe, expect, it } from "vitest";
import { getProgressionRecommendation } from "../src/index.js";
import { apply, createActiveWorkout, createTestWorkout } from "./fixtures.js";

describe("Scenario: Normal 2-exercise workout", () => {
    it("completes bench and incline then ends", () => {
        let state = createTestWorkout();
        state = apply(state, { type: "START_WORKOUT" }).state;

        // Bench: 60×10, 60×9, 60×8
        for (const reps of [10, 9, 8]) {
            state = apply(state, { type: "COMPLETE_SET", weightKg: 60, reps }).state;
        }

        // Incline: 22.5×10, 22.5×9, 22.5×8
        for (const reps of [10, 9, 8]) {
            state = apply(state, { type: "COMPLETE_SET", weightKg: 22.5, reps }).state;
        }

        expect(state.status).toBe("COMPLETED");
        expect(state.completedSets).toHaveLength(6);
        expect(state.exercises[0]!.sets.every((s) => s.status === "COMPLETED")).toBe(true);
        expect(state.exercises[1]!.sets.every((s) => s.status === "COMPLETED")).toBe(true);
    });
});

describe("Scenario: Workout with skipped set", () => {
    it("skips one set and continues", () => {
        let state = createActiveWorkout();
        state = apply(state, { type: "COMPLETE_SET", weightKg: 60, reps: 10 }).state;
        state = apply(state, { type: "SKIP_SET" }).state;
        state = apply(state, { type: "COMPLETE_SET", weightKg: 60, reps: 8 }).state;

        const bench = state.exercises[0]!;
        expect(bench.sets[0]!.status).toBe("COMPLETED");
        expect(bench.sets[1]!.status).toBe("SKIPPED");
        expect(bench.sets[2]!.status).toBe("COMPLETED");
        expect(state.currentExerciseIndex).toBe(1);
    });
});

describe("Scenario: Workout with skipped exercise", () => {
    it("skips first exercise entirely", () => {
        let state = createActiveWorkout();
        state = apply(state, { type: "SKIP_EXERCISE" }).state;

        expect(state.exercises[0]!.status).toBe("SKIPPED");
        expect(state.currentExerciseIndex).toBe(1);
        expect(getCurrentExerciseName(state)).toBe("Incline Dumbbell Press");
    });
});

describe("Scenario: Workout with correction", () => {
    it("corrects reps after completion", () => {
        let state = createActiveWorkout();
        state = apply(state, { type: "COMPLETE_SET", weightKg: 60, reps: 10 }).state;

        const setId = state.exercises[0]!.sets[0]!.id;
        state = apply(state, { type: "EDIT_SET", setId, reps: 9 }).state;

        expect(state.exercises[0]!.sets[0]!.actualReps).toBe(9);
        expect(state.exercises[0]!.sets[0]!.actualWeightKg).toBe(60);
    });
});

describe("Scenario: Workout with undo", () => {
    it("undoes a mistaken set entry", () => {
        let state = createActiveWorkout();
        state = apply(state, { type: "COMPLETE_SET", weightKg: 60, reps: 10 }).state;
        state = apply(state, { type: "UNDO" }).state;

        expect(state.exercises[0]!.sets[0]!.status).toBe("PENDING");
        expect(state.currentSetIndex).toBe(0);
        expect(state.completedSets).toHaveLength(0);
    });
});

describe("Scenario: Progression recommendation", () => {
    it("suggests increase after hitting top of range", () => {
        let state = createActiveWorkout();
        const result = apply(state, { type: "COMPLETE_SET", weightKg: 60, reps: 10 });

        expect(result.recommendations).toHaveLength(1);
        expect(result.recommendations[0]!.type).toBe("INCREASE_WEIGHT");
        expect(result.recommendations[0]!.suggestedWeightKg).toBe(62.5);
    });

    it("does not suggest increase for low reps", () => {
        const exercise = createActiveWorkout().exercises[0]!;
        const rec = getProgressionRecommendation({
            exercise,
            actualWeightKg: 60,
            actualReps: 6,
        });
        expect(rec.type).not.toBe("INCREASE_WEIGHT");
    });
});

function getCurrentExerciseName(state: { exercises: Array<{ name: string }>; currentExerciseIndex: number }) {
    return state.exercises[state.currentExerciseIndex]?.name;
}
