import type { WorkoutCommand } from "@vofana/workout-engine";
import type { ExerciseAliasResolver } from "../types.js";
import type { WorkoutContext } from "../types.js";
import { defaultExerciseAliasResolver } from "../aliases.js";
import { CONFIDENCE } from "../confidence.js";
import { resolveWeight } from "../context.js";
import {
    extractReps,
    extractWeightKg,
    hasWeightUnit,
    mentionsSameWeight,
    parseNumberToken,
} from "../normalize.js";

export interface CompleteSetParseResult {
    command: Extract<WorkoutCommand, { type: "COMPLETE_SET" }>;
    confidence: number;
    interpretation: string;
}

export interface CompleteSetAmbiguity {
    confidence: number;
    reason: string;
    candidates?: Extract<WorkoutCommand, { type: "COMPLETE_SET" }>[];
}

export function parseCompleteSet(
    text: string,
    context: WorkoutContext,
    aliasResolver: ExerciseAliasResolver = defaultExerciseAliasResolver,
): CompleteSetParseResult | CompleteSetAmbiguity | null {
    if (!isCompleteSetCandidate(text)) {
        return null;
    }

    const units = context.units ?? "KG";
    const useSame = mentionsSameWeight(text);
    const spokenWeight = extractSpokenWeight(text, units);
    const reps = extractRepsFromPhrase(text);

    const weightResolution = resolveWeight(context, {
        useSame,
        spokenWeightKg: spokenWeight,
    });

    if (reps === undefined && !looksLikeWeightOnly(text)) {
        return null;
    }

    if (reps === undefined && looksLikeWeightOnly(text)) {
        return null;
    }

    if (reps !== undefined && weightResolution === undefined) {
        return {
            confidence: CONFIDENCE.AMBIGUOUS,
            reason: "Reps provided but weight could not be resolved from context",
        };
    }

    if (reps === undefined) {
        return null;
    }

    const command: Extract<WorkoutCommand, { type: "COMPLETE_SET" }> = {
        type: "COMPLETE_SET",
        weightKg: weightResolution!.weightKg,
        reps,
        source: "VOICE",
    };

    const exercisePhrase = extractExercisePhrase(text);
    if (exercisePhrase) {
        const resolution = aliasResolver.resolve(exercisePhrase, context);
        if (resolution.exerciseId && resolution.confidence >= 0.8) {
            // Exercise identification is informational only; CompleteSetCommand has no exerciseId.
        }
    }

    let confidence: number = CONFIDENCE.EXACT_PATTERN;
    if (spokenWeight !== undefined && reps !== undefined) {
        confidence = CONFIDENCE.EXACT_PATTERN;
    } else if (useSame) {
        confidence = CONFIDENCE.CONTEXT_RESOLVED;
    } else if (weightResolution!.source === "planned") {
        confidence = CONFIDENCE.CONTEXT_INFERRED;
    } else {
        confidence = CONFIDENCE.PARTIAL_CONTEXT;
    }

    return {
        command,
        confidence,
        interpretation: "COMPLETE_SET",
    };
}

function isCompleteSetCandidate(text: string): boolean {
    if (/\b(?:undo|skip|next|pause|resume|hold|wait|end|cancel|rest|actually|change|increase|decrease|reduce|what|meant|accidentally)\b/.test(text)) {
        return false;
    }

    // Bare "finish" / "finish workout" is workout control, not set logging.
    if (/^finish(?:\s+workout)?$/.test(text)) {
        return false;
    }

    if (mentionsSameWeight(text) && /\bfor\b/.test(text)) {
        return true;
    }

    if (/\b(?:for|reps?)\b/.test(text) && /\d/.test(text)) {
        return true;
    }

    if (/^\d+$/.test(text.trim())) {
        return true;
    }

    if (/\b\d+\s*(?:kg|lb)?\s+for\s+\d+\b/.test(text)) {
        return true;
    }

    if (/\b(?:i\s+)?(?:got|did)\s+\d+\b/.test(text)) {
        return true;
    }

    if (/\b(?:finished|completed|logged)\s+\d+\b/.test(text)) {
        return true;
    }

    if (/\b\d+\s+at\s+\d+\b/.test(text) || /\bat\s+\d+/.test(text)) {
        return true;
    }

    if (/\b\d+\s+with\s+\d+\b/.test(text) || /\bwith\s+\d+/.test(text)) {
        return true;
    }

    if (/\bthat\s+was\s+\d+\b/.test(text) && /\b(?:with|at|kg|lb)\b/.test(text)) {
        return true;
    }

    if (/\b\d+\s*(?:kg|lb)\s+\d+\b/.test(text)) {
        return true;
    }

    return false;
}

function extractSpokenWeight(text: string, units: "KG" | "LB"): number | undefined {
    const iDidAt = text.match(/\bi\s+did\s+(\d+(?:\.\d+)?)\s+(?:reps?\s+)?at\s+(\d+(?:\.\d+)?)\b/);
    if (iDidAt) {
        return extractWeightKg(`${iDidAt[2]} kg`, units);
    }

    const atPattern = text.match(/\b(\d+(?:\.\d+)?)\s+at\s+(\d+(?:\.\d+)?)\b/);
    if (atPattern) {
        return extractWeightKg(`${atPattern[2]} kg`, units);
    }

    const withPattern = text.match(/\b(\d+(?:\.\d+)?)\s+with\s+(\d+(?:\.\d+)?)\b/);
    if (withPattern) {
        return extractWeightKg(`${withPattern[2]} kg`, units);
    }

    const atWeight = text.match(/\bat\s+(\d+(?:\.\d+)?)\s*(?:kg|lb)?\b/);
    if (atWeight) {
        return extractWeightKg(atWeight[0], units);
    }

    const withWeight = text.match(/\bwith\s+(\d+(?:\.\d+)?)\s*(?:kg|lb)?\b/);
    if (withWeight) {
        return extractWeightKg(withWeight[0].replace(/\bwith\b/, ""), units);
    }

    const weightForReps = text.match(/\b(\d+(?:\.\d+)?)\s*(?:kg|lb)?\s+for\s+\d+\b/);
    if (weightForReps) {
        return extractWeightKg(weightForReps[0], units);
    }

    const commaPattern = text.match(/\b(\d+(?:\.\d+)?)\s*(?:kg|lb)?\s*,\s*\d+\b/);
    if (commaPattern) {
        return extractWeightKg(commaPattern[0], units);
    }

    const spacedPattern = text.match(/\b(\d+(?:\.\d+)?)\s*(?:kg|lb)\s+\d+\b/);
    if (spacedPattern) {
        return extractWeightKg(spacedPattern[0], units);
    }

    if (hasWeightUnit(text)) {
        return extractWeightKg(text, units);
    }

    if (/\bfor\b/.test(text)) {
        const leading = text.match(/^(\d+(?:\.\d+)?)\s+for\b/);
        if (leading) {
            return Number(leading[1]);
        }
    }

    return undefined;
}

function extractRepsFromPhrase(text: string): number | undefined {
    const iDidAt = text.match(/\bi\s+did\s+(\d+(?:\.\d+)?)\s+(?:reps?\s+)?at\s+(\d+(?:\.\d+)?)\b/);
    if (iDidAt) {
        return parseNumberToken(iDidAt[1]!);
    }

    const atPattern = text.match(/\b(\d+(?:\.\d+)?)\s+at\s+(\d+(?:\.\d+)?)\b/);
    if (atPattern) {
        return parseNumberToken(atPattern[1]!);
    }

    const withPattern = text.match(/\b(\d+(?:\.\d+)?)\s+with\s+(\d+(?:\.\d+)?)\b/);
    if (withPattern) {
        return parseNumberToken(withPattern[1]!);
    }

    const gotReps = text.match(/\b(?:i\s+)?(?:got|did)\s+(\d+)\b/);
    if (gotReps) {
        return Number(gotReps[1]);
    }

    const finishedReps = text.match(/\b(?:finished|completed|logged)\s+(\d+)\b/);
    if (finishedReps) {
        return Number(finishedReps[1]);
    }

    const commaPattern = text.match(/\b(\d+(?:\.\d+)?)\s*(?:kg|lb)?\s*,\s*(\d+)\b/);
    if (commaPattern) {
        return Number(commaPattern[2]);
    }

    const spacedPattern = text.match(/\b(\d+(?:\.\d+)?)\s*(?:kg|lb)\s+(\d+)\b/);
    if (spacedPattern) {
        return Number(spacedPattern[2]);
    }

    return extractReps(text);
}

function looksLikeWeightOnly(text: string): boolean {
    return /^\d+(?:\.\d+)?\s*(?:kg|lb)?$/.test(text.trim());
}

function extractExercisePhrase(text: string): string | undefined {
    const onMatch = text.match(/\bon\s+(.+)$/);
    return onMatch?.[1]?.trim();
}
