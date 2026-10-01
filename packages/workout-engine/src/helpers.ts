import type { WorkoutExercise, WorkoutSet, WorkoutState } from "./types.js";
import { generateId } from "./id.js";

export function getCurrentExercise(state: WorkoutState): WorkoutExercise | null {
    if (state.status === "COMPLETED" || state.status === "CANCELLED") {
        return null;
    }
    return state.exercises[state.currentExerciseIndex] ?? null;
}

export function getCurrentSet(state: WorkoutState): WorkoutSet | null {
    const exercise = getCurrentExercise(state);
    if (!exercise) {
        return null;
    }
    return exercise.sets[state.currentSetIndex] ?? null;
}

export function getNextExercise(state: WorkoutState): WorkoutExercise | null {
    const nextIndex = state.currentExerciseIndex + 1;
    if (nextIndex >= state.exercises.length) {
        return null;
    }
    return state.exercises[nextIndex] ?? null;
}

export function getNextSet(state: WorkoutState): WorkoutSet | null {
    const exercise = getCurrentExercise(state);
    if (!exercise) {
        return null;
    }
    const nextSetIndex = state.currentSetIndex + 1;
    if (nextSetIndex < exercise.sets.length) {
        return exercise.sets[nextSetIndex] ?? null;
    }
    const nextExercise = getNextExercise(state);
    return nextExercise?.sets[0] ?? null;
}

export function findSetById(
    state: WorkoutState,
    setId: string,
): { exercise: WorkoutExercise; set: WorkoutSet; exerciseIndex: number; setIndex: number } | null {
    for (let ei = 0; ei < state.exercises.length; ei++) {
        const exercise = state.exercises[ei]!;
        for (let si = 0; si < exercise.sets.length; si++) {
            const set = exercise.sets[si]!;
            if (set.id === setId) {
                return { exercise, set, exerciseIndex: ei, setIndex: si };
            }
        }
    }
    return null;
}

export function findLastCompletedSet(
    state: WorkoutState,
): { exercise: WorkoutExercise; set: WorkoutSet; exerciseIndex: number; setIndex: number } | null {
    for (let ei = state.exercises.length - 1; ei >= 0; ei--) {
        const exercise = state.exercises[ei]!;
        for (let si = exercise.sets.length - 1; si >= 0; si--) {
            const set = exercise.sets[si]!;
            if (set.status === "COMPLETED") {
                return { exercise, set, exerciseIndex: ei, setIndex: si };
            }
        }
    }
    return null;
}

export function cloneState(state: WorkoutState): WorkoutState {
    return JSON.parse(JSON.stringify(state)) as WorkoutState;
}

export function bumpVersion(state: WorkoutState): WorkoutState {
    return { ...state, version: state.version + 1 };
}

export function createSetsFromTarget(
    exerciseId: string,
    target: WorkoutExercise["target"],
): WorkoutSet[] {
    const sets: WorkoutSet[] = [];
    const defaultReps = target.reps?.min;
    for (let i = 0; i < target.sets; i++) {
        sets.push({
            id: generateId(`set_${exerciseId}`),
            setNumber: i + 1,
            plannedWeightKg: target.weightKg,
            plannedReps: defaultReps,
            status: "PENDING",
        });
    }
    return sets;
}

export function isWorkoutActive(state: WorkoutState): boolean {
    return state.status === "ACTIVE";
}

export function allSetsDone(exercise: WorkoutExercise): boolean {
    return exercise.sets.every((s) => s.status === "COMPLETED" || s.status === "SKIPPED");
}

export function isWorkoutFinished(state: WorkoutState): boolean {
    return state.exercises.every(
        (ex) => ex.status === "COMPLETED" || ex.status === "SKIPPED" || allSetsDone(ex),
    );
}

export function describeNextAction(state: WorkoutState): string {
    if (state.status === "NOT_STARTED") return 'Say "start workout".';
    if (state.status === "PAUSED") return 'Say "resume".';
    if (state.status === "COMPLETED") return "Workout complete.";
    if (state.status === "CANCELLED") return "Workout cancelled.";

    const exercise = getCurrentExercise(state);
    const set = getCurrentSet(state);
    if (!exercise || !set) return "No pending set.";

    const weight = set.plannedWeightKg === undefined ? "—" : `${set.plannedWeightKg} kg`;
    const reps = set.plannedReps ?? "?";
    return `${exercise.name} set ${set.setNumber}/${exercise.sets.length} — ${weight} × ${reps} reps`;
}
