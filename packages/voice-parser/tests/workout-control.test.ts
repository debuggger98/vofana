import { describe, expect, it } from "vitest";
import { parseVoiceCommand } from "../src/parser.js";
import { benchContext } from "./fixtures.js";

describe("workout control parsing", () => {
    it.each([
        ["start workout", "START_WORKOUT"],
        ["pause", "PAUSE_WORKOUT"],
        ["pause the workout", "PAUSE_WORKOUT"],
        ["hold on", "PAUSE_WORKOUT"],
        ["wait", "PAUSE_WORKOUT"],
        ["resume", "RESUME_WORKOUT"],
        ["keep going", "RESUME_WORKOUT"],
        ["continue", "RESUME_WORKOUT"],
        ["end workout", "END_WORKOUT"],
        ["finish workout", "END_WORKOUT"],
        ["cancel workout", "CANCEL_WORKOUT"],
    ] as const)('parses "%s"', (transcript, type) => {
        const result = parseVoiceCommand({
            transcript,
            context: { workoutStatus: "ACTIVE" },
        });
        expect(result.status).toBe("PARSED");
        expect(result.command?.type).toBe(type);
    });
});

describe("rest control parsing", () => {
    it("parses start rest", () => {
        const result = parseVoiceCommand({
            transcript: "start rest",
            context: { workoutStatus: "ACTIVE" },
        });
        expect(result.command).toEqual({ type: "START_REST" });
    });

    it("parses timed rest", () => {
        const result = parseVoiceCommand({
            transcript: "start a 90 second rest",
            context: { workoutStatus: "ACTIVE" },
        });
        expect(result.command).toEqual({ type: "START_REST", durationSeconds: 90 });
    });

    it("parses skip rest", () => {
        const result = parseVoiceCommand({
            transcript: "skip rest",
            context: { workoutStatus: "ACTIVE" },
        });
        expect(result.command).toEqual({ type: "SKIP_REST" });
    });

    it("parses add seconds with rest context", () => {
        const result = parseVoiceCommand({
            transcript: "add 15 seconds",
            context: {
                workoutStatus: "ACTIVE",
                restState: { status: "RUNNING", durationSeconds: 90 },
            },
        });
        expect(result.command).toEqual({ type: "CHANGE_REST", durationSeconds: 105 });
    });
});

describe("weight change parsing", () => {
    it("parses increase to weight", () => {
        const result = parseVoiceCommand({
            transcript: "increase to 65",
            context: benchContext,
        });
        expect(result.command).toEqual({ type: "CHANGE_WEIGHT", weightKg: 65 });
    });

    it("parses make it weight", () => {
        const result = parseVoiceCommand({
            transcript: "make it 65",
            context: benchContext,
        });
        expect(result.command).toEqual({ type: "CHANGE_WEIGHT", weightKg: 65 });
    });

    it("parses lets go to weight", () => {
        const result = parseVoiceCommand({
            transcript: "let's go to 65",
            context: benchContext,
        });
        expect(result.command).toEqual({ type: "CHANGE_WEIGHT", weightKg: 65 });
    });
});
