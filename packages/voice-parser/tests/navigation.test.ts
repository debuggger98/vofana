import { describe, expect, it } from "vitest";
import { parseVoiceCommand } from "../src/parser.js";

describe("navigation parsing", () => {
    it.each(["next", "next exercise", "go to the next one", "next one"])(
        'parses "%s" as NEXT_EXERCISE',
        (transcript) => {
            const result = parseVoiceCommand({
                transcript,
                context: { workoutStatus: "ACTIVE" },
            });
            expect(result.status).toBe("PARSED");
            expect(result.command).toEqual({ type: "NEXT_EXERCISE" });
        },
    );

    it.each(["previous exercise", "go back", "previous"])(
        'parses "%s" as PREVIOUS_EXERCISE',
        (transcript) => {
            const result = parseVoiceCommand({
                transcript,
                context: { workoutStatus: "ACTIVE" },
            });
            expect(result.status).toBe("PARSED");
            expect(result.command).toEqual({ type: "PREVIOUS_EXERCISE" });
        },
    );

    it.each(["what's next?", "what do I do next?"])(
        'parses "%s" as WHAT_NEXT query intent',
        (transcript) => {
            const result = parseVoiceCommand({
                transcript,
                context: { workoutStatus: "ACTIVE" },
            });
            expect(result.status).toBe("QUERY");
            expect(result.interpretation?.intent).toBe("WHAT_NEXT");
            expect(result.command).toBeUndefined();
        },
    );
});

describe("skip parsing", () => {
    it("parses skip this set", () => {
        const result = parseVoiceCommand({
            transcript: "skip this set",
            context: { workoutStatus: "ACTIVE" },
        });
        expect(result.command).toEqual({ type: "SKIP_SET" });
    });

    it('parses "next set" as SKIP_SET', () => {
        const result = parseVoiceCommand({
            transcript: "next set",
            context: { workoutStatus: "ACTIVE" },
        });
        expect(result.command).toEqual({ type: "SKIP_SET" });
    });

    it("parses skip exercise", () => {
        const result = parseVoiceCommand({
            transcript: "skip exercise",
            context: { workoutStatus: "ACTIVE" },
        });
        expect(result.command).toEqual({ type: "SKIP_EXERCISE" });
    });

    it.each(["skip", "skip this"])('returns ambiguous for "%s"', (transcript) => {
        const result = parseVoiceCommand({
            transcript,
            context: { workoutStatus: "ACTIVE" },
        });
        expect(result.status).toBe("AMBIGUOUS");
        expect(result.candidates?.length).toBeGreaterThanOrEqual(2);
    });
});
