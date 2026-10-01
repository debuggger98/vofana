import type { WorkoutExercise, WorkoutState } from "./types.js";
import {
    describeNextAction,
    findLastCompletedSet,
    getCurrentExercise,
    getCurrentSet,
} from "./helpers.js";

export type WorkoutQueryIntent =
    | "WHAT_NEXT"
    | "SETS_REMAINING"
    | "LAST_WEIGHT"
    | "LAST_REPS"
    | "CURRENT_EXERCISE"
    | "CURRENT_SET";

const QUERY_INTENTS = new Set<WorkoutQueryIntent>([
    "WHAT_NEXT",
    "SETS_REMAINING",
    "LAST_WEIGHT",
    "LAST_REPS",
    "CURRENT_EXERCISE",
    "CURRENT_SET",
]);

export function isWorkoutQueryIntent(value: string): value is WorkoutQueryIntent {
    return QUERY_INTENTS.has(value as WorkoutQueryIntent);
}

export function answerQuery(state: WorkoutState, intent: string): string {
    switch (intent) {
        case "WHAT_NEXT":
            return describeNextAction(state);
        case "SETS_REMAINING":
            return describeSetsRemaining(state);
        case "LAST_WEIGHT":
            return describeLastWeight(state);
        case "LAST_REPS":
            return describeLastReps(state);
        case "CURRENT_EXERCISE":
            return describeCurrentExercise(state);
        case "CURRENT_SET":
            return describeCurrentSet(state);
        default:
            return "I cannot answer that.";
    }
}

function pendingSetCount(exercise: WorkoutExercise): number {
    return exercise.sets.filter((set) => set.status === "PENDING").length;
}

function describeSetsRemaining(state: WorkoutState): string {
    if (state.status === "COMPLETED") return "No sets left. Workout complete.";
    if (state.status === "CANCELLED") return "Workout cancelled.";
    if (state.status === "NOT_STARTED") return 'Say "start workout".';

    const exercise = getCurrentExercise(state);
    const onExercise = exercise ? pendingSetCount(exercise) : 0;
    const inWorkout = state.exercises.reduce((sum, item) => sum + pendingSetCount(item), 0);

    if (inWorkout === 0) return "No sets left.";
    if (!exercise) return `${pluralSets(inWorkout)} left in the workout.`;
    if (onExercise === inWorkout) {
        return `${pluralSets(onExercise)} left on ${exercise.name}.`;
    }
    return `${pluralSets(onExercise)} left on ${exercise.name}, ${pluralSets(inWorkout)} in the workout.`;
}

function describeLastWeight(state: WorkoutState): string {
    const last = findLastCompletedSet(state);
    if (!last || last.set.actualWeightKg === undefined) return "No completed set yet.";
    return `${last.set.actualWeightKg} kg`;
}

function describeLastReps(state: WorkoutState): string {
    const last = findLastCompletedSet(state);
    if (!last || last.set.actualReps === undefined) return "No completed set yet.";
    const reps = last.set.actualReps;
    return reps === 1 ? "1 rep" : `${reps} reps`;
}

function describeCurrentExercise(state: WorkoutState): string {
    if (state.status === "NOT_STARTED") return 'Say "start workout".';
    if (state.status === "COMPLETED") return "Workout complete.";
    if (state.status === "CANCELLED") return "Workout cancelled.";
    const exercise = getCurrentExercise(state);
    return exercise?.name ?? "No current exercise.";
}

function describeCurrentSet(state: WorkoutState): string {
    if (state.status === "NOT_STARTED") return 'Say "start workout".';
    if (state.status === "COMPLETED") return "Workout complete.";
    if (state.status === "CANCELLED") return "Workout cancelled.";
    const exercise = getCurrentExercise(state);
    const set = getCurrentSet(state);
    if (!exercise || !set) return "No pending set.";
    return `${exercise.name} set ${set.setNumber}/${exercise.sets.length}`;
}

function pluralSets(count: number): string {
    return count === 1 ? "1 set" : `${count} sets`;
}
