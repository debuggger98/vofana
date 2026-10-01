import type { SetSource } from "./types.js";

interface BaseCommand {
    commandId?: string;
}

export interface StartWorkoutCommand extends BaseCommand {
    type: "START_WORKOUT";
}

export interface PauseWorkoutCommand extends BaseCommand {
    type: "PAUSE_WORKOUT";
}

export interface ResumeWorkoutCommand extends BaseCommand {
    type: "RESUME_WORKOUT";
}

export interface CompleteSetCommand extends BaseCommand {
    type: "COMPLETE_SET";
    weightKg?: number;
    reps?: number;
    source?: SetSource;
}

export interface EditSetCommand extends BaseCommand {
    type: "EDIT_SET";
    setId: string;
    weightKg?: number;
    reps?: number;
}

export interface UndoCommand extends BaseCommand {
    type: "UNDO";
}

export interface SkipSetCommand extends BaseCommand {
    type: "SKIP_SET";
}

export interface SkipExerciseCommand extends BaseCommand {
    type: "SKIP_EXERCISE";
}

export interface ChangeWeightCommand extends BaseCommand {
    type: "CHANGE_WEIGHT";
    weightKg: number;
}

export interface ChangeRepsCommand extends BaseCommand {
    type: "CHANGE_REPS";
    reps: number;
}

export interface StartRestCommand extends BaseCommand {
    type: "START_REST";
    durationSeconds?: number;
}

export interface SkipRestCommand extends BaseCommand {
    type: "SKIP_REST";
}

export interface ChangeRestCommand extends BaseCommand {
    type: "CHANGE_REST";
    durationSeconds: number;
}

export interface NextExerciseCommand extends BaseCommand {
    type: "NEXT_EXERCISE";
}

export interface PreviousExerciseCommand extends BaseCommand {
    type: "PREVIOUS_EXERCISE";
}

export interface EndWorkoutCommand extends BaseCommand {
    type: "END_WORKOUT";
}

export interface CancelWorkoutCommand extends BaseCommand {
    type: "CANCEL_WORKOUT";
}

export type WorkoutCommand =
    | StartWorkoutCommand
    | PauseWorkoutCommand
    | ResumeWorkoutCommand
    | CompleteSetCommand
    | EditSetCommand
    | UndoCommand
    | SkipSetCommand
    | SkipExerciseCommand
    | ChangeWeightCommand
    | ChangeRepsCommand
    | StartRestCommand
    | SkipRestCommand
    | ChangeRestCommand
    | NextExerciseCommand
    | PreviousExerciseCommand
    | EndWorkoutCommand
    | CancelWorkoutCommand;
