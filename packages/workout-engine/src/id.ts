let idCounter = 0;

export function generateId(prefix = "id"): string {
    idCounter += 1;
    return `${prefix}_${Date.now()}_${idCounter}`;
}

/** Reset counter for deterministic tests */
export function resetIdCounter(): void {
    idCounter = 0;
}

export function setIdCounter(value: number): void {
    idCounter = value;
}
