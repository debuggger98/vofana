import { applyCommand } from "../src/engine.js";
import { resetIdCounter } from "../src/id.js";
import { createWorkout } from "../src/state.js";
import type { CreateWorkoutInput, WorkoutState } from "../src/types.js";

const FIXED_TIMESTAMP = "2026-01-15T10:00:00.000Z";

export { FIXED_TIMESTAMP };

export function createTestWorkout(overrides: Partial<CreateWorkoutInput> = {}): WorkoutState {
    resetIdCounter();
    return createWorkout({
        sessionId: "session-1",
        userId: "user-1",
        workoutId: "workout-1",
        defaultRestSeconds: 90,
        exercises: [
            {
                exerciseId: "bench",
                name: "Bench Press",
                order: 0,
                target: { sets: 3, reps: { min: 8, max: 10 }, weightKg: 60 },
            },
            {
                exerciseId: "incline",
                name: "Incline Dumbbell Press",
                order: 1,
                target: { sets: 3, reps: { min: 8, max: 10 }, weightKg: 22.5 },
            },
        ],
        ...overrides,
    });
}

export function createSingleExerciseWorkout(): WorkoutState {
    resetIdCounter();
    return createWorkout({
        sessionId: "session-1",
        userId: "user-1",
        workoutId: "workout-1",
        exercises: [
            {
                exerciseId: "squat",
                name: "Squat",
                order: 0,
                target: { sets: 3, reps: { min: 5, max: 5 }, weightKg: 100 },
            },
        ],
    });
}

export function createActiveWorkout(): WorkoutState {
    const state = createTestWorkout();
    const result = applyCommand(state, { type: "START_WORKOUT" }, { timestamp: FIXED_TIMESTAMP });
    if (!result.success) throw new Error("Failed to start workout in fixture");
    return result.state;
}

export function createWorkoutWithCompletedSet(): WorkoutState {
    let state = createActiveWorkout();
    const result = applyCommand(
        state,
        { type: "COMPLETE_SET", weightKg: 60, reps: 10, source: "VOICE" },
        { timestamp: FIXED_TIMESTAMP },
    );
    if (!result.success) throw new Error("Failed to complete set in fixture");
    return result.state;
}

export function apply(
    state: WorkoutState,
    command: Parameters<typeof applyCommand>[1],
): ReturnType<typeof applyCommand> {
    return applyCommand(state, command, { timestamp: FIXED_TIMESTAMP });
}
