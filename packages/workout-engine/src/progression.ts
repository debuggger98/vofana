import type { WorkoutExercise, WorkoutRecommendation } from "./types.js";

const WEIGHT_INCREMENT_KG = 2.5;

export interface ProgressionInput {
    exercise: WorkoutExercise;
    actualWeightKg: number;
    actualReps: number;
}

/**
 * Conservative deterministic progression for MVP.
 *
 * - Hit top of rep range → suggest small weight increase next session
 * - Below minimum reps → do not increase (suggest repeat or reduce if far below)
 * - Otherwise → maintain current target
 */
export function getProgressionRecommendation(input: ProgressionInput): WorkoutRecommendation {
    const { exercise, actualWeightKg, actualReps } = input;
    const target = exercise.target;
    const repRange = target.reps;

    if (!repRange) {
        return {
            type: "REPEAT_WEIGHT",
            exerciseId: exercise.exerciseId,
            suggestedWeightKg: actualWeightKg,
            reason: "No rep range defined; maintain current weight",
        };
    }

    if (actualReps >= repRange.max) {
        const suggestedWeight = roundToIncrement(actualWeightKg + WEIGHT_INCREMENT_KG);
        return {
            type: "INCREASE_WEIGHT",
            exerciseId: exercise.exerciseId,
            suggestedWeightKg: suggestedWeight,
            suggestedReps: repRange.min,
            reason: `Completed ${actualReps} reps (top of ${repRange.min}–${repRange.max} range); increase load`,
        };
    }

    if (actualReps < repRange.min) {
        const deficit = repRange.min - actualReps;
        if (deficit >= 3) {
            const suggestedWeight = roundToIncrement(Math.max(0, actualWeightKg - WEIGHT_INCREMENT_KG));
            return {
                type: "REDUCE_WEIGHT",
                exerciseId: exercise.exerciseId,
                suggestedWeightKg: suggestedWeight,
                suggestedReps: repRange.min,
                reason: `Only ${actualReps} reps (below minimum ${repRange.min}); consider reducing load`,
            };
        }
        return {
            type: "REPEAT_WEIGHT",
            exerciseId: exercise.exerciseId,
            suggestedWeightKg: actualWeightKg,
            suggestedReps: repRange.min,
            reason: `Below target minimum (${actualReps} < ${repRange.min}); repeat current weight`,
        };
    }

    return {
        type: "REPEAT_WEIGHT",
        exerciseId: exercise.exerciseId,
        suggestedWeightKg: actualWeightKg,
        suggestedReps: actualReps,
        reason: `Within target range (${repRange.min}–${repRange.max}); maintain current weight`,
    };
}

function roundToIncrement(kg: number, increment = WEIGHT_INCREMENT_KG): number {
    return Math.round(kg / increment) * increment;
}
