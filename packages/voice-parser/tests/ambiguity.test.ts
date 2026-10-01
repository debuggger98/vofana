import { describe, expect, it } from "vitest";
import { parseVoiceCommand } from "../src/parser.js";
import { benchContext, noWeightContext } from "./fixtures.js";

describe("ambiguity handling", () => {
    it.each([
        "make it better",
        "change that",
        "reduce it",
        "do it",
        "same",
    ])('returns ambiguous for vague phrase "%s"', (transcript) => {
        const result = parseVoiceCommand({ transcript, context: benchContext });
        expect(result.status).toBe("AMBIGUOUS");
        expect(result.confidence).toBeLessThan(0.6);
    });

    it("returns ambiguous for make it 60 without weight context", () => {
        const result = parseVoiceCommand({ transcript: "make it 60", context: noWeightContext });
        expect(result.status).toBe("AMBIGUOUS");
    });
});

describe("unsupported input", () => {
    it.each([
        "what is protein?",
        "tell me today's calories",
        "how do I bench?",
        "tell me a joke",
    ])('returns unsupported for "%s"', (transcript) => {
        const result = parseVoiceCommand({
            transcript,
            context: { workoutStatus: "ACTIVE" },
        });
        expect(result.status).toBe("UNSUPPORTED");
        expect(result.command).toBeUndefined();
    });
});

describe("confidence scoring", () => {
    it("assigns high confidence to explicit complete set phrases", () => {
        const result = parseVoiceCommand({ transcript: "60 for 10", context: benchContext });
        expect(result.confidence).toBeGreaterThanOrEqual(0.95);
    });

    it("assigns lower confidence to ambiguous phrases", () => {
        const result = parseVoiceCommand({ transcript: "same", context: benchContext });
        expect(result.confidence).toBeLessThan(0.6);
    });
});

describe("parser invariants", () => {
    it("does not mutate context", () => {
        const context = structuredClone(benchContext);
        parseVoiceCommand({ transcript: "same for ten", context });
        expect(context).toEqual(benchContext);
    });

    it("returns invalid for empty transcript", () => {
        const result = parseVoiceCommand({ transcript: "   ", context: benchContext });
        expect(result.status).toBe("INVALID");
    });
});
