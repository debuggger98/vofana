import { describe, expect, it } from "vitest";
import { normalizeTranscript, parseNumberToken } from "../src/normalize.js";

describe("normalizeTranscript", () => {
    it("lowercases and normalizes spoken numbers", () => {
        const result = normalizeTranscript("60 KILOS FOR TEN");
        expect(result.normalized).toBe("60 kg for 10");
    });

    it("normalizes kilograms and reps phrasing", () => {
        const result = normalizeTranscript("60 kilograms for ten reps");
        expect(result.normalized).toBe("60 kg for 10 reps");
    });

    it("normalizes decimal point phrases", () => {
        const result = normalizeTranscript("twenty two point five");
        expect(result.normalized).toBe("22.5");
    });

    it("preserves decimal weights with units", () => {
        const result = normalizeTranscript("22.5 kg");
        expect(result.normalized).toBe("22.5 kg");
    });

    it("normalizes compound spoken numbers", () => {
        const result = normalizeTranscript("sixty five for ten");
        expect(result.normalized).toBe("65 for 10");
    });

    it("strips CJK and fullwidth STT punctuation", () => {
        expect(normalizeTranscript("Fifty six for eight。").normalized).toBe("56 for 8");
        expect(normalizeTranscript("Fifty six kilos，got nine。").normalized).toBe("56 kg got 9");
    });

    it("keeps decimal points while stripping sentence periods", () => {
        expect(normalizeTranscript("22.5 kilos.").normalized).toBe("22.5 kg");
        expect(normalizeTranscript("Finished 10.").normalized).toBe("finished 10");
    });

    it("preserves contractions", () => {
        expect(normalizeTranscript("what's next?").normalized).toBe("what's next");
        expect(normalizeTranscript("let's go to 65").normalized).toBe("let's go to 65");
    });
});

describe("parseNumberToken", () => {
    it("parses digits and spoken numbers", () => {
        expect(parseNumberToken("10")).toBe(10);
        expect(parseNumberToken("nine")).toBe(9);
        expect(parseNumberToken("twenty five")).toBe(25);
        expect(parseNumberToken("forty five")).toBe(45);
        expect(parseNumberToken("sixty five")).toBe(65);
    });
});
