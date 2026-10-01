export { applyCommand, workoutEngine } from "./engine.js";
export type { ApplyCommandOptions } from "./engine.js";

export { createWorkout } from "./state.js";

export {
    getCurrentExercise,
    getCurrentSet,
    getNextExercise,
    getNextSet,
    findSetById,
    findLastCompletedSet,
    describeNextAction,
} from "./helpers.js";

export { answerQuery, isWorkoutQueryIntent } from "./queries.js";
export type { WorkoutQueryIntent } from "./queries.js";

export { getProgressionRecommendation } from "./progression.js";
export type { ProgressionInput } from "./progression.js";

export type {
    WorkoutState,
    WorkoutStatus,
    WorkoutExercise,
    WorkoutSet,
    SetStatus,
    SetSource,
    ExerciseStatus,
    ExerciseTarget,
    RepRange,
    RestState,
    RestStatus,
    CompletedSetRecord,
    CreateWorkoutInput,
    WorkoutRecommendation,
    CommandResult,
} from "./types.js";

export type { WorkoutCommand } from "./commands.js";
export type { WorkoutEvent } from "./events.js";
export type { WorkoutEffect } from "./effects.js";
export type { WorkoutError, WorkoutErrorCode } from "./errors.js";

export { createError } from "./errors.js";
