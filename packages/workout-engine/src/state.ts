import type { CreateWorkoutInput, WorkoutExercise, WorkoutState } from "./types.js";
import { createSetsFromTarget } from "./helpers.js";

export function createWorkout(input: CreateWorkoutInput): WorkoutState {
    const exercises: WorkoutExercise[] = input.exercises
        .slice()
        .sort((a, b) => a.order - b.order)
        .map((ex) => ({
            exerciseId: ex.exerciseId,
            name: ex.name,
            order: ex.order,
            target: ex.target,
            sets: createSetsFromTarget(ex.exerciseId, ex.target),
            status: "PENDING" as const,
        }));

    return {
        sessionId: input.sessionId,
        userId: input.userId,
        workoutId: input.workoutId,
        status: "NOT_STARTED",
        currentExerciseIndex: 0,
        currentSetIndex: 0,
        exercises,
        completedSets: [],
        restState: { status: "IDLE" },
        defaultRestSeconds: input.defaultRestSeconds ?? 90,
        version: 0,
        processedCommandIds: [],
    };
}
