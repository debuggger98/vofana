import { describe, expect, it } from "vitest";
import { parseVoiceCommand } from "../src/parser.js";
import { afterSetContext, benchContext, noWeightContext } from "./fixtures.js";

describe("complete set parsing", () => {
    it.each([
        ["60 for 10", 60, 10],
        ["60 kg for 10", 60, 10],
        ["60 kilos, 10 reps", 60, 10],
        ["sixty for ten", 60, 10],
        ["sixty kilos for ten", 60, 10],
        ["60 for ten", 60, 10],
        ["60 kilo for 10", 60, 10],
        ["60 kilos, got 10", 60, 10],
        ["Fifty six for eight。", 56, 8],
        ["Fifty six kilos，got nine。", 56, 9],
        ["I did 10 reps.", 60, 10],
        ["10 reps.", 60, 10],
        ["Finished 10.", 60, 10],
        ["I got 10.", 60, 10],
        ["I did 10 reps at 40 kilos.", 40, 10],
        ["Finished 10 at 40.", 40, 10],
        ["That was 10 with 40.", 40, 10],
        ["completed 8", 60, 8],
        ["I finished 10 reps", 60, 10],
    ])('parses "%s"', (transcript, weightKg, reps) => {
        const result = parseVoiceCommand({ transcript, context: benchContext });
        expect(result.status).toBe("PARSED");
        expect(result.command).toEqual({
            type: "COMPLETE_SET",
            weightKg,
            reps,
            source: "VOICE",
        });
        expect(result.confidence).toBeGreaterThanOrEqual(0.9);
    });

    it("parses reps-only with planned weight from context", () => {
        const result = parseVoiceCommand({ transcript: "ten", context: benchContext });
        expect(result.status).toBe("PARSED");
        expect(result.command).toEqual({
            type: "COMPLETE_SET",
            weightKg: 60,
            reps: 10,
            source: "VOICE",
        });
    });

    it("parses numeric reps-only", () => {
        const result = parseVoiceCommand({ transcript: "10", context: benchContext });
        expect(result.status).toBe("PARSED");
        expect(result.command?.type).toBe("COMPLETE_SET");
        expect(result.command).toMatchObject({ weightKg: 60, reps: 10 });
    });

    it("parses same-weight phrases", () => {
        const result = parseVoiceCommand({ transcript: "same for 8", context: afterSetContext });
        expect(result.status).toBe("PARSED");
        expect(result.command).toEqual({
            type: "COMPLETE_SET",
            weightKg: 60,
            reps: 8,
            source: "VOICE",
        });
        expect(result.confidence).toBeGreaterThanOrEqual(0.95);
    });

    it("parses same for eight", () => {
        const result = parseVoiceCommand({ transcript: "same for eight", context: afterSetContext });
        expect(result.status).toBe("PARSED");
        expect(result.command).toMatchObject({ weightKg: 60, reps: 8 });
    });

    it("parses natural logging phrases", () => {
        const result = parseVoiceCommand({ transcript: "I did 10 at 60", context: benchContext });
        expect(result.status).toBe("PARSED");
        expect(result.command).toMatchObject({ weightKg: 60, reps: 10 });
    });

    it("returns ambiguous when reps given without weight context", () => {
        const result = parseVoiceCommand({ transcript: "ten", context: noWeightContext });
        expect(result.status).toBe("AMBIGUOUS");
        expect(result.command).toBeUndefined();
    });
});

describe("golden cases", () => {
    it("same for ten with previous set context", () => {
        const result = parseVoiceCommand({
            transcript: "same for ten",
            context: {
                workoutStatus: "ACTIVE",
                currentExercise: { id: "bench", name: "Bench Press" },
                currentSet: { id: "set-2", setNumber: 2, plannedWeightKg: 60 },
                previousCompletedSet: {
                    id: "set-1",
                    exerciseId: "bench",
                    weightKg: 60,
                    reps: 9,
                },
                units: "KG",
            },
        });

        expect(result.status).toBe("PARSED");
        expect(result.command).toEqual({
            type: "COMPLETE_SET",
            weightKg: 60,
            reps: 10,
            source: "VOICE",
        });
        expect(result.normalizedTranscript).toBe("same for 10");
    });
});
