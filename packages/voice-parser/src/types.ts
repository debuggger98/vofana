import type { WorkoutCommand, WorkoutStatus } from "@vofana/workout-engine";
import type { ParserError } from "./errors.js";

export interface WorkoutContext {
    workoutStatus: WorkoutStatus;

    currentExercise?: {
        id: string;
        name: string;
        aliases?: string[];
    };

    currentSet?: {
        id: string;
        setNumber: number;
        plannedWeightKg?: number;
        plannedReps?: number;
        previousWeightKg?: number;
        previousReps?: number;
    };

    previousCompletedSet?: {
        id: string;
        exerciseId: string;
        weightKg?: number;
        reps?: number;
    };

    nextExercise?: {
        id: string;
        name: string;
    };

    remainingExercises?: Array<{
        id: string;
        name: string;
    }>;

    restState?: {
        status: "IDLE" | "RUNNING" | "COMPLETED";
        durationSeconds?: number;
    };

    defaultRestSeconds?: number;

    units?: "KG" | "LB";
}

export interface VoiceParseInput {
    transcript: string;
    context: WorkoutContext;
    metadata?: {
        language?: string;
        confidence?: number;
        timestamp?: string;
    };
}

export type ParseStatus = "PARSED" | "QUERY" | "AMBIGUOUS" | "UNSUPPORTED" | "INVALID";

export interface ParseCandidate {
    command: WorkoutCommand;
    confidence: number;
}

export interface ParseInterpretation {
    intent: string;
    explanation?: string;
}

export interface ParseResult {
    status: ParseStatus;
    command?: WorkoutCommand;
    confidence: number;
    originalTranscript: string;
    normalizedTranscript: string;
    interpretation?: ParseInterpretation;
    candidates?: ParseCandidate[];
    error?: ParserError;
}

export interface VoiceInterpreter {
    parse(input: VoiceParseInput): Promise<ParseResult>;
}

export interface ExerciseResolution {
    exerciseId?: string;
    name?: string;
    confidence: number;
}

export interface ExerciseAliasResolver {
    resolve(phrase: string, context: WorkoutContext): ExerciseResolution;
}

export interface NormalizedTranscript {
    original: string;
    normalized: string;
}
