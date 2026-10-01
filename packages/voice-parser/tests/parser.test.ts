import { describe, expect, it } from "vitest";
import { extractWeightKg } from "../src/normalize.js";
import { parseVoiceCommand } from "../src/parser.js";

describe("weight extraction", () => {
    it.each([
        ["60", 60],
        ["60 kg", 60],
        ["60 kilos", 60],
        ["60 kilograms", 60],
        ["62.5", 62.5],
        ["22.5", 22.5],
        ["22 point 5", 22.5],
    ])('extracts weight from "%s"', (phrase, expected) => {
        const weight = extractWeightKg(phrase, "KG");
        expect(weight).toBe(expected);
    });
});

describe("weight in commands", () => {
    it("parses decimal weight complete set", () => {
        const result = parseVoiceCommand({
            transcript: "22.5 for 12",
            context: {
                workoutStatus: "ACTIVE",
                currentSet: { id: "s1", setNumber: 1 },
                units: "KG",
            },
        });
        expect(result.command).toMatchObject({ weightKg: 22.5, reps: 12 });
    });

    it("parses spoken decimal weight", () => {
        const result = parseVoiceCommand({
            transcript: "twenty two point five for 12",
            context: {
                workoutStatus: "ACTIVE",
                currentSet: { id: "s1", setNumber: 1 },
                units: "KG",
            },
        });
        expect(result.command).toMatchObject({ weightKg: 22.5, reps: 12 });
    });
});
