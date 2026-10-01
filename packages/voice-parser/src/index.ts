export { parseVoiceCommand, parseVoiceCommandAsync } from "./parser.js";
export { normalizeTranscript, parseNumberToken, extractWeightKg, extractReps } from "./normalize.js";
export { DefaultExerciseAliasResolver, defaultExerciseAliasResolver } from "./aliases.js";
export { CONFIDENCE } from "./confidence.js";
export { createParserError } from "./errors.js";
export { workoutContextFromState } from "./from-state.js";

export type {
    VoiceParseInput,
    ParseResult,
    ParseStatus,
    ParseCandidate,
    ParseInterpretation,
    WorkoutContext,
    VoiceInterpreter,
    ExerciseAliasResolver,
    ExerciseResolution,
    NormalizedTranscript,
} from "./types.js";

export type { ParserError, ParserErrorCode } from "./errors.js";

export type { WorkoutCommand } from "@vofana/workout-engine";
