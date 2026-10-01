export type WorkoutStatus =
    | "NOT_STARTED"
    | "ACTIVE"
    | "PAUSED"
    | "COMPLETED"
    | "CANCELLED";

export type SetStatus = "PENDING" | "COMPLETED" | "SKIPPED";

export type ExerciseStatus = "PENDING" | "IN_PROGRESS" | "COMPLETED" | "SKIPPED";

export type SetSource = "VOICE" | "MANUAL" | "SYSTEM";

export type RestStatus = "IDLE" | "RUNNING" | "COMPLETED";

export interface RepRange {
    min: number;
    max: number;
}

export interface ExerciseTarget {
    sets: number;
    reps?: RepRange;
    weightKg?: number;
}

export interface WorkoutSet {
    id: string;
    setNumber: number;
    plannedWeightKg?: number;
    plannedReps?: number;
    actualWeightKg?: number;
    actualReps?: number;
    status: SetStatus;
    source?: SetSource;
    completedAt?: string;
}

export interface WorkoutExercise {
    exerciseId: string;
    name: string;
    order: number;
    target: ExerciseTarget;
    sets: WorkoutSet[];
    status: ExerciseStatus;
}

export interface CompletedSetRecord {
    exerciseId: string;
    setId: string;
    setNumber: number;
    weightKg: number;
    reps: number;
    completedAt: string;
    source?: SetSource;
}

export interface RestState {
    status: RestStatus;
    startedAt?: string;
    durationSeconds?: number;
}

export interface WorkoutState {
    sessionId: string;
    userId: string;
    workoutId: string;
    status: WorkoutStatus;
    startedAt?: string;
    endedAt?: string;
    currentExerciseIndex: number;
    currentSetIndex: number;
    exercises: WorkoutExercise[];
    completedSets: CompletedSetRecord[];
    restState: RestState;
    defaultRestSeconds: number;
    version: number;
    processedCommandIds: string[];
    /** Snapshot of state before the most recent undoable mutation */
    undoSnapshot?: WorkoutState;
}

export interface CreateWorkoutInput {
    sessionId: string;
    userId: string;
    workoutId: string;
    exercises: Array<{
        exerciseId: string;
        name: string;
        order: number;
        target: ExerciseTarget;
    }>;
    defaultRestSeconds?: number;
}

export interface WorkoutRecommendation {
    type: "INCREASE_WEIGHT" | "REPEAT_WEIGHT" | "REDUCE_WEIGHT";
    exerciseId: string;
    suggestedWeightKg?: number;
    suggestedReps?: number;
    reason: string;
}

export interface CommandResult {
    success: boolean;
    state: WorkoutState;
    events: import("./events.js").WorkoutEvent[];
    effects: import("./effects.js").WorkoutEffect[];
    recommendations: WorkoutRecommendation[];
    error?: import("./errors.js").WorkoutError;
}
