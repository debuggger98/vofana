import type { ParseResult, VoiceParseInput } from "./types.js";
import { parseDeterministic, type DeterministicParserOptions } from "./deterministic/parser.js";

export function parseVoiceCommand(
    input: VoiceParseInput,
    options?: DeterministicParserOptions,
): ParseResult {
    return parseDeterministic(input, options);
}

export async function parseVoiceCommandAsync(
    input: VoiceParseInput,
    options?: DeterministicParserOptions,
): Promise<ParseResult> {
    return parseVoiceCommand(input, options);
}
