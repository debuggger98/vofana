export type ParserErrorCode =
    | "EMPTY_TRANSCRIPT"
    | "MISSING_CONTEXT"
    | "AMBIGUOUS_INTENT"
    | "UNSUPPORTED_INTENT"
    | "MISSING_SET_ID"
    | "MISSING_WEIGHT"
    | "MISSING_REPS";

export interface ParserError {
    code: ParserErrorCode;
    message: string;
}

export function createParserError(code: ParserErrorCode, message: string): ParserError {
    return { code, message };
}
