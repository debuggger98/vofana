export type WorkoutErrorCode =
    | "INVALID_STATE_TRANSITION"
    | "INVALID_SET_DATA"
    | "INVALID_COMMAND"
    | "SET_NOT_FOUND"
    | "EXERCISE_NOT_FOUND"
    | "NOTHING_TO_UNDO"
    | "WORKOUT_NOT_ACTIVE"
    | "NO_CURRENT_SET"
    | "DUPLICATE_COMMAND";

export interface WorkoutError {
    code: WorkoutErrorCode;
    message: string;
    details?: Record<string, unknown>;
}

export function createError(
    code: WorkoutErrorCode,
    message: string,
    details?: Record<string, unknown>,
): WorkoutError {
    return { code, message, details };
}
