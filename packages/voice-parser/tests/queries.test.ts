import { describe, expect, it } from "vitest";
import { parseVoiceCommand } from "../src/parser.js";

describe("workout query parsing", () => {
    it.each([
        ["what's next?", "WHAT_NEXT"],
        ["what do I do next?", "WHAT_NEXT"],
        ["How many sets are left?", "SETS_REMAINING"],
        ["how many sets left", "SETS_REMAINING"],
        ["What weight did I use?", "LAST_WEIGHT"],
        ["last weight", "LAST_WEIGHT"],
        ["How many reps did I do?", "LAST_REPS"],
        ["What exercise am I on?", "CURRENT_EXERCISE"],
        ["what am I doing?", "CURRENT_EXERCISE"],
        ["Which set am I on?", "CURRENT_SET"],
    ])('parses "%s" as %s query', (transcript, intent) => {
        const result = parseVoiceCommand({
            transcript,
            context: { workoutStatus: "ACTIVE" },
        });
        expect(result.status).toBe("QUERY");
        expect(result.interpretation?.intent).toBe(intent);
        expect(result.command).toBeUndefined();
    });

    it("keeps what am I doing next as WHAT_NEXT", () => {
        const result = parseVoiceCommand({
            transcript: "what am I doing next?",
            context: { workoutStatus: "ACTIVE" },
        });
        expect(result.status).toBe("QUERY");
        expect(result.interpretation?.intent).toBe("WHAT_NEXT");
    });
});
