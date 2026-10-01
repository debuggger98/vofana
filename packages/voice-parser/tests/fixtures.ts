import type { WorkoutContext } from "../src/types.js";

export const benchContext: WorkoutContext = {
    workoutStatus: "ACTIVE",
    currentExercise: {
        id: "bench_press",
        name: "Bench Press",
        aliases: ["bench", "barbell bench"],
    },
    currentSet: {
        id: "set-2",
        setNumber: 2,
        plannedWeightKg: 60,
        plannedReps: 10,
    },
    previousCompletedSet: {
        id: "set-1",
        exerciseId: "bench_press",
        weightKg: 60,
        reps: 9,
    },
    units: "KG",
};

export const noWeightContext: WorkoutContext = {
    workoutStatus: "ACTIVE",
    currentExercise: {
        id: "bench_press",
        name: "Bench Press",
    },
    currentSet: {
        id: "set-1",
        setNumber: 1,
    },
    units: "KG",
};

export const afterSetContext: WorkoutContext = {
    workoutStatus: "ACTIVE",
    currentExercise: {
        id: "bench_press",
        name: "Bench Press",
    },
    currentSet: {
        id: "set-2",
        setNumber: 2,
        plannedWeightKg: 60,
    },
    previousCompletedSet: {
        id: "set-1",
        exerciseId: "bench_press",
        weightKg: 60,
        reps: 10,
    },
    units: "KG",
};
