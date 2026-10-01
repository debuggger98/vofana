import { createError } from "./errors.js";

const MAX_WEIGHT_KG = 1000;
const MAX_REPS = 500;

export function validateWeight(weightKg: number): { valid: true } | { valid: false; error: ReturnType<typeof createError> } {
    if (typeof weightKg !== "number" || Number.isNaN(weightKg) || !Number.isFinite(weightKg)) {
        return {
            valid: false,
            error: createError("INVALID_SET_DATA", "Weight must be a finite number", { weightKg }),
        };
    }
    if (weightKg < 0) {
        return {
            valid: false,
            error: createError("INVALID_SET_DATA", "Weight cannot be negative", { weightKg }),
        };
    }
    if (weightKg > MAX_WEIGHT_KG) {
        return {
            valid: false,
            error: createError("INVALID_SET_DATA", `Weight cannot exceed ${MAX_WEIGHT_KG} kg`, { weightKg }),
        };
    }
    return { valid: true };
}

export function validateReps(reps: number): { valid: true } | { valid: false; error: ReturnType<typeof createError> } {
    if (typeof reps !== "number" || Number.isNaN(reps) || !Number.isFinite(reps)) {
        return {
            valid: false,
            error: createError("INVALID_SET_DATA", "Reps must be a finite number", { reps }),
        };
    }
    if (reps <= 0) {
        return {
            valid: false,
            error: createError("INVALID_SET_DATA", "Reps must be greater than zero", { reps }),
        };
    }
    if (!Number.isInteger(reps)) {
        return {
            valid: false,
            error: createError("INVALID_SET_DATA", "Reps must be a whole number", { reps }),
        };
    }
    if (reps > MAX_REPS) {
        return {
            valid: false,
            error: createError("INVALID_SET_DATA", `Reps cannot exceed ${MAX_REPS}`, { reps }),
        };
    }
    return { valid: true };
}

export function validateRestDuration(
    durationSeconds: number,
): { valid: true } | { valid: false; error: ReturnType<typeof createError> } {
    if (
        typeof durationSeconds !== "number" ||
        Number.isNaN(durationSeconds) ||
        !Number.isFinite(durationSeconds)
    ) {
        return {
            valid: false,
            error: createError("INVALID_COMMAND", "Rest duration must be a finite number", {
                durationSeconds,
            }),
        };
    }
    if (durationSeconds <= 0) {
        return {
            valid: false,
            error: createError("INVALID_COMMAND", "Rest duration must be greater than zero", {
                durationSeconds,
            }),
        };
    }
    return { valid: true };
}
