import type { ExerciseAliasResolver, ParseResult, VoiceParseInput, WorkoutContext } from "../types.js";
import { defaultExerciseAliasResolver } from "../aliases.js";
import { CONFIDENCE } from "../confidence.js";
import { createParserError } from "../errors.js";
import { normalizeTranscript } from "../normalize.js";
import { parseCompleteSet } from "./complete-set.js";
import { parseCorrection } from "./corrections.js";
import { parseNavigation, parseSkip } from "./navigation.js";
import { parseQuery } from "./queries.js";
import {
    parseRestControl,
    parseUndo,
    parseWeightChange,
    parseWorkoutControl,
} from "./workout-control.js";

const UNSUPPORTED_PATTERNS: RegExp[] = [
    /\bprotein\b/,
    /\bcalories?\b/,
    /\bjoke\b/,
    /\bhow\s+do\s+i\b/,
    /\btell\s+me\b/,
    /\bwhat\s+is\b/,
    /\bweather\b/,
];

export interface DeterministicParserOptions {
    aliasResolver?: ExerciseAliasResolver;
}

export function parseDeterministic(
    input: VoiceParseInput,
    options: DeterministicParserOptions = {},
): ParseResult {
    const aliasResolver = options.aliasResolver ?? defaultExerciseAliasResolver;
    const { original, normalized } = normalizeTranscript(input.transcript);

    if (!original) {
        return {
            status: "INVALID",
            confidence: 0,
            originalTranscript: original,
            normalizedTranscript: normalized,
            error: createParserError("EMPTY_TRANSCRIPT", "Transcript is empty"),
        };
    }

    const query = parseQuery(normalized);
    if (query) {
        return {
            status: "QUERY",
            confidence: query.confidence,
            originalTranscript: original,
            normalizedTranscript: normalized,
            interpretation: { intent: query.intent },
        };
    }

    if (isUnsupportedQuery(normalized)) {
        return {
            status: "UNSUPPORTED",
            confidence: CONFIDENCE.UNSUPPORTED,
            originalTranscript: original,
            normalizedTranscript: normalized,
            interpretation: { intent: "OUT_OF_SCOPE" },
            error: createParserError("UNSUPPORTED_INTENT", "Transcript is outside workout command vocabulary"),
        };
    }

    const attempts: ParseResult[] = [];

    const undo = parseUndo(normalized);
    if (undo) {
        attempts.push(toParsed(original, normalized, undo.command, undo.confidence, undo.interpretation));
    }

    const correction = parseCorrection(normalized, input.context);
    if (correction && "command" in correction) {
        attempts.push(toParsed(original, normalized, correction.command, correction.confidence, correction.interpretation));
    } else if (correction) {
        attempts.push(toAmbiguous(original, normalized, correction.confidence, correction.reason, correction.error));
    }

    const navigation = parseNavigation(normalized, input.context);
    if (navigation && "candidates" in navigation) {
        attempts.push({
            status: "AMBIGUOUS",
            confidence: navigation.confidence,
            originalTranscript: original,
            normalizedTranscript: normalized,
            candidates: navigation.candidates,
            error: createParserError("AMBIGUOUS_INTENT", navigation.reason),
        });
    } else if (navigation) {
        attempts.push(toParsed(original, normalized, navigation.command, navigation.confidence, navigation.interpretation));
    }

    const skip = parseSkip(normalized, input.context);
    if (skip && "command" in skip) {
        attempts.push(toParsed(original, normalized, skip.command, skip.confidence, skip.interpretation));
    } else if (skip) {
        attempts.push({
            status: "AMBIGUOUS",
            confidence: skip.confidence,
            originalTranscript: original,
            normalizedTranscript: normalized,
            candidates: skip.candidates,
            error: createParserError("AMBIGUOUS_INTENT", skip.reason),
        });
    }

    const workoutControl = parseWorkoutControl(normalized);
    if (workoutControl) {
        attempts.push(toParsed(original, normalized, workoutControl.command, workoutControl.confidence, workoutControl.interpretation));
    }

    const restControl = parseRestControl(normalized, input.context);
    if (restControl && "command" in restControl) {
        attempts.push(toParsed(original, normalized, restControl.command, restControl.confidence, restControl.interpretation));
    } else if (restControl) {
        attempts.push(toAmbiguous(original, normalized, restControl.confidence, restControl.reason));
    }

    const weightChange = parseWeightChange(normalized, input.context);
    if (weightChange && "command" in weightChange) {
        attempts.push(toParsed(original, normalized, weightChange.command, weightChange.confidence, weightChange.interpretation));
    } else if (weightChange) {
        attempts.push(toAmbiguous(original, normalized, weightChange.confidence, weightChange.reason));
    }

    const completeSet = parseCompleteSet(normalized, input.context, aliasResolver);
    if (completeSet && "command" in completeSet) {
        attempts.push(toParsed(original, normalized, completeSet.command, completeSet.confidence, completeSet.interpretation));
    } else if (completeSet) {
        attempts.push({
            status: "AMBIGUOUS",
            confidence: completeSet.confidence,
            originalTranscript: original,
            normalizedTranscript: normalized,
            error: createParserError("MISSING_WEIGHT", completeSet.reason),
        });
    }

    if (attempts.length === 0) {
        if (isVaguePhrase(normalized)) {
            return toAmbiguous(original, normalized, CONFIDENCE.AMBIGUOUS, "Phrase is too vague to interpret safely");
        }
        return {
            status: "UNSUPPORTED",
            confidence: CONFIDENCE.UNSUPPORTED,
            originalTranscript: original,
            normalizedTranscript: normalized,
            interpretation: { intent: "UNKNOWN" },
            error: createParserError("UNSUPPORTED_INTENT", "No matching workout command pattern"),
        };
    }

    const parsed = attempts.filter((a) => a.status === "PARSED");
    if (parsed.length === 1) {
        return parsed[0]!;
    }

    if (parsed.length > 1) {
        const best = parsed.sort((a, b) => b.confidence - a.confidence)[0]!;
        if (best.confidence >= CONFIDENCE.CONTEXT_INFERRED) {
            return best;
        }
        return {
            status: "AMBIGUOUS",
            confidence: CONFIDENCE.AMBIGUOUS,
            originalTranscript: original,
            normalizedTranscript: normalized,
            candidates: parsed.map((p) => ({
                command: p.command!,
                confidence: p.confidence,
            })),
            error: createParserError("AMBIGUOUS_INTENT", "Multiple possible command interpretations"),
        };
    }

    const ambiguous = attempts.find((a) => a.status === "AMBIGUOUS");
    if (ambiguous) {
        return ambiguous;
    }

    return attempts[0]!;
}

function isUnsupportedQuery(text: string): boolean {
    return UNSUPPORTED_PATTERNS.some((pattern) => pattern.test(text));
}

function isVaguePhrase(text: string): boolean {
    const vague = [/^same$/, /^change\s+that$/, /^do\s+it$/, /^reduce\s+it$/, /^make\s+it\s+better$/];
    return vague.some((p) => p.test(text));
}

function toParsed(
    original: string,
    normalized: string,
    command: ParseResult["command"] & object,
    confidence: number,
    intent: string,
): ParseResult {
    return {
        status: "PARSED",
        command,
        confidence,
        originalTranscript: original,
        normalizedTranscript: normalized,
        interpretation: { intent },
    };
}

function toAmbiguous(
    original: string,
    normalized: string,
    confidence: number,
    reason: string,
    error?: ReturnType<typeof createParserError>,
): ParseResult {
    return {
        status: "AMBIGUOUS",
        confidence,
        originalTranscript: original,
        normalizedTranscript: normalized,
        error: error ?? createParserError("AMBIGUOUS_INTENT", reason),
    };
}

export function buildDefaultContext(overrides: Partial<WorkoutContext> = {}): WorkoutContext {
    return {
        workoutStatus: "ACTIVE",
        ...overrides,
    };
}
