import type { WorkoutState } from "@vofana/workout-engine";
import {
    findLastCompletedSet,
    getCurrentExercise,
    getCurrentSet,
    getNextExercise,
} from "@vofana/workout-engine";
import type { WorkoutContext } from "./types.js";

export function workoutContextFromState(
    state: WorkoutState,
    units: WorkoutContext["units"] = "KG",
): WorkoutContext {
    const currentExercise = getCurrentExercise(state);
    const currentSet = getCurrentSet(state);
    const lastCompleted = findLastCompletedSet(state);
    const nextExercise = getNextExercise(state);
    const remaining = state.exercises.slice(state.currentExerciseIndex + 1);

    return {
        workoutStatus: state.status,
        currentExercise: currentExercise
            ? {
                  id: currentExercise.exerciseId,
                  name: currentExercise.name,
              }
            : undefined,
        currentSet: currentSet
            ? {
                  id: currentSet.id,
                  setNumber: currentSet.setNumber,
                  plannedWeightKg: currentSet.plannedWeightKg,
                  plannedReps: currentSet.plannedReps,
                  previousWeightKg: lastCompleted?.set.actualWeightKg,
                  previousReps: lastCompleted?.set.actualReps,
              }
            : undefined,
        previousCompletedSet: lastCompleted
            ? {
                  id: lastCompleted.set.id,
                  exerciseId: lastCompleted.exercise.exerciseId,
                  weightKg: lastCompleted.set.actualWeightKg,
                  reps: lastCompleted.set.actualReps,
              }
            : undefined,
        nextExercise: nextExercise
            ? { id: nextExercise.exerciseId, name: nextExercise.name }
            : undefined,
        remainingExercises: remaining.map((exercise) => ({
            id: exercise.exerciseId,
            name: exercise.name,
        })),
        restState: {
            status: state.restState.status,
            durationSeconds: state.restState.durationSeconds,
        },
        defaultRestSeconds: state.defaultRestSeconds,
        units,
    };
}
