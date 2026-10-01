import { describe, expect, it } from "vitest";
import { getProgressionRecommendation } from "../src/progression.js";
import type { WorkoutExercise } from "../src/types.js";

function makeExercise(overrides: Partial<WorkoutExercise> = {}): WorkoutExercise {
    return {
        exerciseId: "bench",
        name: "Bench Press",
        order: 0,
        target: { sets: 3, reps: { min: 8, max: 10 }, weightKg: 60 },
        sets: [],
        status: "IN_PROGRESS",
        ...overrides,
    };
}

describe("Progression", () => {
    it("recommends weight increase when hitting top of rep range", () => {
        const rec = getProgressionRecommendation({
            exercise: makeExercise(),
            actualWeightKg: 60,
            actualReps: 10,
        });

        expect(rec.type).toBe("INCREASE_WEIGHT");
        expect(rec.suggestedWeightKg).toBe(62.5);
        expect(rec.suggestedReps).toBe(8);
    });

    it("does not recommend increase when below minimum reps", () => {
        const rec = getProgressionRecommendation({
            exercise: makeExercise(),
            actualWeightKg: 60,
            actualReps: 6,
        });

        expect(rec.type).not.toBe("INCREASE_WEIGHT");
    });

    it("recommends repeat when within range but not at top", () => {
        const rec = getProgressionRecommendation({
            exercise: makeExercise(),
            actualWeightKg: 60,
            actualReps: 9,
        });

        expect(rec.type).toBe("REPEAT_WEIGHT");
        expect(rec.suggestedWeightKg).toBe(60);
    });

    it("recommends reduce when far below minimum", () => {
        const rec = getProgressionRecommendation({
            exercise: makeExercise(),
            actualWeightKg: 60,
            actualReps: 3,
        });

        expect(rec.type).toBe("REDUCE_WEIGHT");
        expect(rec.suggestedWeightKg).toBe(57.5);
    });

    it("maintains weight when no rep range defined", () => {
        const rec = getProgressionRecommendation({
            exercise: makeExercise({ target: { sets: 3, weightKg: 60 } }),
            actualWeightKg: 60,
            actualReps: 10,
        });

        expect(rec.type).toBe("REPEAT_WEIGHT");
    });
});
