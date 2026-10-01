import type { WorkoutCommand } from "@vofana/workout-engine";
import type { WorkoutContext } from "../types.js";
import { CONFIDENCE } from "../confidence.js";
import { getLastCompletedSetId } from "../context.js";
import { createParserError } from "../errors.js";
import { extractReps, extractWeightKg, parseNumberToken } from "../normalize.js";

export interface CorrectionParseResult {
    command: Extract<WorkoutCommand, { type: "EDIT_SET" }>;
    confidence: number;
    interpretation: string;
}

export interface CorrectionAmbiguity {
    confidence: number;
    reason: string;
    error?: ReturnType<typeof createParserError>;
}

const CORRECTION_PATTERNS: RegExp[] = [
    /^actually\s+(.+)$/,
    /^that\s+was\s+(.+)$/,
    /^no\s*,?\s*(.+)$/,
    /^change\s+that\s+to\s+(.+)$/,
    /^make\s+that\s+(.+)$/,
    /^change\s+it\s+to\s+(.+)$/,
    /^i\s+meant\s+(.+)$/,
    /^meant\s+(.+)$/,
];

export function parseCorrection(
    text: string,
    context: WorkoutContext,
): CorrectionParseResult | CorrectionAmbiguity | null {
    if (!/\b(?:actually|that was|no\b|change that|make that|change it to|i meant|meant)\b/.test(text)) {
        return null;
    }

    let valuePhrase: string | undefined;
    for (const pattern of CORRECTION_PATTERNS) {
        const match = text.match(pattern);
        if (match?.[1]) {
            valuePhrase = match[1].trim();
            break;
        }
    }

    if (!valuePhrase) {
        return {
            confidence: CONFIDENCE.AMBIGUOUS,
            reason: "Correction phrase detected but target value is missing",
            error: createParserError("AMBIGUOUS_INTENT", "Could not determine correction value"),
        };
    }

    // "that was 10 with 40" is set logging, not a correction of the previous set.
    if (/\b(?:with|at)\b/.test(valuePhrase) && /\d/.test(valuePhrase)) {
        return null;
    }

    const setId = getLastCompletedSetId(context);
    if (!setId) {
        return {
            confidence: CONFIDENCE.AMBIGUOUS,
            reason: "No completed set available to correct",
            error: createParserError("MISSING_SET_ID", "No previous completed set in context"),
        };
    }

    const units = context.units ?? "KG";
    const values = interpretCorrectionValue(valuePhrase, context, units);
    if (values === "ambiguous") {
        return {
            confidence: CONFIDENCE.AMBIGUOUS,
            reason: "Correction value is equally close to last weight and last reps",
            error: createParserError("AMBIGUOUS_INTENT", "Could not determine whether to correct weight or reps"),
        };
    }

    if (!values || (values.weightKg === undefined && values.reps === undefined)) {
        return {
            confidence: CONFIDENCE.AMBIGUOUS,
            reason: "Could not parse correction value",
            error: createParserError("AMBIGUOUS_INTENT", "Could not determine correction value"),
        };
    }

    return {
        command: {
            type: "EDIT_SET",
            setId,
            ...(values.weightKg !== undefined ? { weightKg: values.weightKg } : {}),
            ...(values.reps !== undefined ? { reps: values.reps } : {}),
        },
        confidence: CONFIDENCE.CONTEXT_RESOLVED,
        interpretation: "EDIT_SET",
    };
}

function interpretCorrectionValue(
    valuePhrase: string,
    context: WorkoutContext,
    units: "KG" | "LB",
): { weightKg?: number; reps?: number } | "ambiguous" | undefined {
    const hasWeightUnit = /\b(?:kg|lb)\b/.test(valuePhrase);
    const hasRepsWord = /\breps?\b/.test(valuePhrase);

    if (hasWeightUnit && hasRepsWord) {
        const weightKg = extractWeightKg(valuePhrase, units);
        const reps = extractReps(valuePhrase);
        if (weightKg === undefined && reps === undefined) return undefined;
        return { weightKg, reps };
    }

    if (hasWeightUnit) {
        const weightKg = extractWeightKg(valuePhrase, units);
        return weightKg === undefined ? undefined : { weightKg };
    }

    if (hasRepsWord) {
        const reps = extractReps(valuePhrase);
        return reps === undefined ? undefined : { reps };
    }

    const n =
        extractReps(valuePhrase) ??
        parseNumberToken(valuePhrase) ??
        parseNumberToken(valuePhrase.split(/\s+/)[0] ?? "");

    if (n === undefined) return undefined;

    const previous = context.previousCompletedSet;
    if (previous?.weightKg !== undefined && previous.reps !== undefined) {
        const distanceToWeight = Math.abs(n - previous.weightKg);
        const distanceToReps = Math.abs(n - previous.reps);
        if (distanceToWeight < distanceToReps) return { weightKg: n };
        if (distanceToReps < distanceToWeight) return { reps: n };
        return "ambiguous";
    }

    return { reps: n };
}
