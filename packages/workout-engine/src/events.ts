import type { SetSource } from "./types.js";

interface BaseEvent {
    eventId: string;
    sessionId: string;
    timestamp: string;
    sequence: number;
}

export interface WorkoutStartedEvent extends BaseEvent {
    type: "WORKOUT_STARTED";
    workoutId: string;
}

export interface WorkoutPausedEvent extends BaseEvent {
    type: "WORKOUT_PAUSED";
}

export interface WorkoutResumedEvent extends BaseEvent {
    type: "WORKOUT_RESUMED";
}

export interface SetCompletedEvent extends BaseEvent {
    type: "SET_COMPLETED";
    exerciseId: string;
    setId: string;
    weightKg: number;
    reps: number;
    source?: SetSource;
}

export interface SetEditedEvent extends BaseEvent {
    type: "SET_EDITED";
    exerciseId: string;
    setId: string;
    weightKg: number;
    reps: number;
}

export interface SetUndoneEvent extends BaseEvent {
    type: "SET_UNDONE";
    exerciseId: string;
    setId: string;
}

export interface SetSkippedEvent extends BaseEvent {
    type: "SET_SKIPPED";
    exerciseId: string;
    setId: string;
}

export interface ExerciseSkippedEvent extends BaseEvent {
    type: "EXERCISE_SKIPPED";
    exerciseId: string;
}

export interface WeightChangedEvent extends BaseEvent {
    type: "WEIGHT_CHANGED";
    exerciseId: string;
    setId: string;
    weightKg: number;
}

export interface RepsChangedEvent extends BaseEvent {
    type: "REPS_CHANGED";
    exerciseId: string;
    setId: string;
    reps: number;
}

export interface RestStartedEvent extends BaseEvent {
    type: "REST_STARTED";
    durationSeconds: number;
}

export interface RestSkippedEvent extends BaseEvent {
    type: "REST_SKIPPED";
}

export interface ExerciseCompletedEvent extends BaseEvent {
    type: "EXERCISE_COMPLETED";
    exerciseId: string;
}

export interface ExerciseResumedEvent extends BaseEvent {
    type: "EXERCISE_RESUMED";
    exerciseId: string;
}

export interface WorkoutCompletedEvent extends BaseEvent {
    type: "WORKOUT_COMPLETED";
}

export interface WorkoutCancelledEvent extends BaseEvent {
    type: "WORKOUT_CANCELLED";
}

export type WorkoutEvent =
    | WorkoutStartedEvent
    | WorkoutPausedEvent
    | WorkoutResumedEvent
    | SetCompletedEvent
    | SetEditedEvent
    | SetUndoneEvent
    | SetSkippedEvent
    | ExerciseSkippedEvent
    | WeightChangedEvent
    | RepsChangedEvent
    | RestStartedEvent
    | RestSkippedEvent
    | ExerciseCompletedEvent
    | ExerciseResumedEvent
    | WorkoutCompletedEvent
    | WorkoutCancelledEvent;
