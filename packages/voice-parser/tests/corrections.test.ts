import { describe, expect, it } from "vitest";
import { parseVoiceCommand } from "../src/parser.js";
import { afterSetContext } from "./fixtures.js";

describe("correction parsing", () => {
    it.each([
        "actually nine",
        "actually 9",
        "that was nine",
        "no, nine",
        "change that to nine",
        "make that 9",
        "actually that was 8",
        "I meant 8",
        "I meant 8 reps",
    ])('parses "%s" as EDIT_SET reps', (transcript) => {
        const result = parseVoiceCommand({ transcript, context: afterSetContext });
        expect(result.status).toBe("PARSED");
        expect(result.command).toMatchObject({
            type: "EDIT_SET",
            setId: "set-1",
            reps: transcript.includes("8") ? 8 : 9,
        });
        expect(result.command).not.toHaveProperty("weightKg");
    });

    it.each(["I meant 40", "I meant 40 kilos", "change that to 45 kilos", "meant 40"])(
        'parses "%s" as EDIT_SET weight',
        (transcript) => {
            const result = parseVoiceCommand({ transcript, context: afterSetContext });
            expect(result.status).toBe("PARSED");
            expect(result.command).toEqual({
                type: "EDIT_SET",
                setId: "set-1",
                weightKg: transcript.includes("45") ? 45 : 40,
            });
        },
    );

    it("returns ambiguous without previous completed set", () => {
        const result = parseVoiceCommand({
            transcript: "actually nine",
            context: {
                workoutStatus: "ACTIVE",
                currentSet: { id: "set-1", setNumber: 1 },
            },
        });
        expect(result.status).toBe("AMBIGUOUS");
    });

    it("returns ambiguous when I meant has no previous set", () => {
        const result = parseVoiceCommand({
            transcript: "I meant 40",
            context: {
                workoutStatus: "ACTIVE",
                currentSet: { id: "set-1", setNumber: 1, plannedWeightKg: 60, plannedReps: 8 },
            },
        });
        expect(result.status).toBe("AMBIGUOUS");
    });
});

describe("undo parsing", () => {
    it.each([
        "undo",
        "undo that",
        "cancel that",
        "I accidentally logged that twice",
        "logged that twice",
        "I logged that twice",
    ])('parses "%s"', (transcript) => {
        const result = parseVoiceCommand({
            transcript,
            context: { workoutStatus: "ACTIVE" },
        });
        expect(result.status).toBe("PARSED");
        expect(result.command).toEqual({ type: "UNDO" });
    });
});
