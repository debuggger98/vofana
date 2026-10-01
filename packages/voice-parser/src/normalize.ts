import type { NormalizedTranscript } from "./types.js";

const WORD_TO_NUMBER: Record<string, number> = {
    zero: 0,
    one: 1,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
    six: 6,
    seven: 7,
    eight: 8,
    nine: 9,
    ten: 10,
    eleven: 11,
    twelve: 12,
    thirteen: 13,
    fourteen: 14,
    fifteen: 15,
    sixteen: 16,
    seventeen: 17,
    eighteen: 18,
    nineteen: 19,
    twenty: 20,
    thirty: 30,
    forty: 40,
    fifty: 50,
    sixty: 60,
    seventy: 70,
    eighty: 80,
    ninety: 90,
    hundred: 100,
};

const TENS_WORDS = new Set(["twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"]);

const FILLER_WORDS = /\b(um|uh|er|ah|like|please|thanks|thank you|okay|ok|yeah)\b/gi;

const UNIT_ALIASES: Array<[RegExp, string]> = [
    [/\b(kgs?|kilos?|kilograms?)\b/gi, "kg"],
    [/\b(lbs?|pounds?)\b/gi, "lb"],
];

const NON_DECIMAL_PUNCTUATION = /[\u3000-\u303F\uFF01-\uFF0D\uFF0F\uFF1A-\uFF1F\uFF3B-\uFF40\uFF5B-\uFF65，。、！？；：「」『』«»…—–]/g;

export function normalizeTranscript(transcript: string): NormalizedTranscript {
    const original = transcript.trim();
    let text = original.normalize("NFKC").toLowerCase();

    text = text.replace(/['']/g, "'");
    text = text.replace(NON_DECIMAL_PUNCTUATION, " ");
    text = text.replace(/[,!?;:]/g, " ");
    text = text.replace(/\.(?!\d)/g, " ");
    text = text.replace(/\s+/g, " ").trim();

    for (const [pattern, replacement] of UNIT_ALIASES) {
        text = text.replace(pattern, replacement);
    }

    text = normalizeDecimalPhrases(text);
    text = normalizeSpokenNumbers(text);
    text = text.replace(FILLER_WORDS, " ");
    text = text.replace(/\s+/g, " ").trim();

    return { original, normalized: text };
}

function normalizeDecimalPhrases(text: string): string {
    return text.replace(
        /\b(\d+|(?:twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)(?:\s*[- ]?\s*(?:one|two|three|four|five|six|seven|eight|nine))?|(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen))\s+point\s+(\d+|one|two|three|four|five|six|seven|eight|nine)\b/gi,
        (_match, whole: string, fraction: string) => {
            const wholeNum = parseNumberToken(whole);
            const fractionStr = parseFractionDigits(fraction);
            if (wholeNum === undefined || fractionStr === undefined) return _match;
            return `${wholeNum}.${fractionStr}`;
        },
    );
}

function parseFractionDigits(token: string): string | undefined {
    if (/^\d+$/.test(token)) return token;
    const digits: string[] = [];
    for (const part of token.trim().split(/\s+/)) {
        const value = WORD_TO_NUMBER[part.toLowerCase()];
        if (value === undefined || value > 9) return undefined;
        digits.push(String(value));
    }
    return digits.join("");
}

function stripTokenPunctuation(token: string): string {
    return token.replace(/^[^\p{L}\p{N}.]+|[^\p{L}\p{N}.]+$/gu, "");
}

function normalizeSpokenNumbers(text: string): string {
    const tokens = text.split(" ").map(stripTokenPunctuation).filter(Boolean);
    const result: string[] = [];
    let i = 0;

    while (i < tokens.length) {
        const compound = tryParseCompoundNumber(tokens, i);
        if (compound) {
            result.push(String(compound.value));
            i = compound.nextIndex;
            continue;
        }

        const single = WORD_TO_NUMBER[tokens[i]!];
        if (single !== undefined && !TENS_WORDS.has(tokens[i]!)) {
            result.push(String(single));
            i += 1;
            continue;
        }

        result.push(tokens[i]!);
        i += 1;
    }

    return result.join(" ");
}

function tryParseCompoundNumber(tokens: string[], start: number): { value: number; nextIndex: number } | null {
    const first = tokens[start];
    if (!first) return null;

    const tens = TENS_WORDS.has(first) ? WORD_TO_NUMBER[first] : undefined;
    if (tens !== undefined) {
        const second = tokens[start + 1];
        const ones = second ? WORD_TO_NUMBER[second] : undefined;
        if (ones !== undefined && ones < 10) {
            return { value: tens + ones, nextIndex: start + 2 };
        }
        return { value: tens, nextIndex: start + 1 };
    }

    return null;
}

export function parseNumberToken(token: string): number | undefined {
    const trimmed = token.trim().toLowerCase();
    if (!trimmed) return undefined;

    if (/^\d+(\.\d+)?$/.test(trimmed)) {
        const value = Number(trimmed);
        return Number.isFinite(value) ? value : undefined;
    }

    const compoundParts = trimmed.split(/[\s-]+/);
    if (compoundParts.length === 2) {
        const tens = WORD_TO_NUMBER[compoundParts[0]!];
        const ones = WORD_TO_NUMBER[compoundParts[1]!];
        if (tens !== undefined && TENS_WORDS.has(compoundParts[0]!) && ones !== undefined && ones < 10) {
            return tens + ones;
        }
    }

    const single = WORD_TO_NUMBER[trimmed];
    return single;
}

export function extractWeightKg(text: string, units: "KG" | "LB" = "KG"): number | undefined {
    const decimalMatch = text.match(
        /\b(\d+|(?:twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)(?:[- ](?:one|two|three|four|five|six|seven|eight|nine))?|(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen))\s+point\s+(\d+|one|two|three|four|five|six|seven|eight|nine)\s*(?:kg|lb)?\b/i,
    );
    if (decimalMatch) {
        const whole = parseNumberToken(decimalMatch[1]!);
        const fractionDigits = parseFractionDigits(decimalMatch[2]!);
        if (whole !== undefined && fractionDigits !== undefined) {
            return Number(`${whole}.${fractionDigits}`);
        }
    }

    const weightMatch = text.match(/\b(\d+(?:\.\d+)?)\s*(?:kg|lb)?\b/);
    if (!weightMatch) return undefined;

    const value = Number(weightMatch[1]);
    if (!Number.isFinite(value)) return undefined;

    const unitToken = weightMatch[0]!.includes("lb") ? "LB" : units;
    if (unitToken === "LB") {
        return Math.round((value * 0.453592) * 100) / 100;
    }
    return value;
}

export function extractReps(text: string): number | undefined {
    const afterFor = text.match(/\bfor\s+(\d+(?:\.\d+)?)\b/);
    if (afterFor) {
        const value = Number(afterFor[1]);
        return Number.isInteger(value) && value > 0 ? value : undefined;
    }

    const repsSuffix = text.match(/\b(\d+)\s*reps?\b/);
    if (repsSuffix) {
        return Number(repsSuffix[1]);
    }

    const loneNumber = text.match(/^\s*(\d+)\s*$/);
    if (loneNumber) {
        const value = Number(loneNumber[1]);
        return value > 0 && value <= 100 ? value : undefined;
    }

    const trailingNumber = text.match(/\b(\d+)\s*$/);
    if (trailingNumber && !/\b\d+\s*(?:kg|lb)\b/.test(text)) {
        const value = Number(trailingNumber[1]);
        return value > 0 && value <= 100 ? value : undefined;
    }

    return undefined;
}

export function hasWeightUnit(text: string): boolean {
    return /\b\d+(?:\.\d+)?\s*(?:kg|lb)\b/.test(text) || /\b\d+(?:\.\d+)?\s+kg\b/.test(text);
}

export function mentionsSameWeight(text: string): boolean {
    return /\b(?:same|repeat)\b/.test(text) && !/\b(?:same\s+reps?|same\s+weight\s+reps?)\b/.test(text);
}
