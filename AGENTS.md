# AGENTS.md

## Project

This is a voice-first fitness application.

The application is being developed incrementally. Agents should prioritize correctness, simplicity, maintainability, and user experience over rapid expansion or speculative engineering.

## General Rules

- Read this file before making changes.
- Inspect the existing code and architecture before making assumptions.
- Preserve the existing architecture unless explicitly instructed otherwise.
- Do not introduce major architectural changes, frameworks, abstractions, or dependencies without a clear requirement.
- Keep changes focused on the current task.
- Avoid unrelated refactors and scope creep.
- Prefer simple, explicit implementations over premature abstractions.
- Reuse existing patterns and interfaces where appropriate.
- Do not silently change existing behavior that is unrelated to the task.
- Add or update tests when changing behavior.
- Validate changes before considering a task complete.
- Keep project documentation accurate and update it when implementation or important decisions change.
- Record significant technical decisions and their rationale.
- Do not claim functionality exists unless it has actually been implemented and verified.

## Architecture Changes

The existing architecture should be treated as the default.

If a task appears to require an architectural change:

1. Identify the specific limitation.
2. Explain why the existing architecture cannot satisfy the requirement.
3. Propose the smallest reasonable change.
4. Do not implement the architectural change without approval unless explicitly authorized.

## Product Scope

The application consists of multiple areas, including but not limited to:

- speech-to-text
- voice processing
- voice/language parsing
- workout state and logic
- responses
- application/UI
- backend and data
- integrations and infrastructure

Agents may work on any of these areas when instructed.

The current development focus is defined by the relevant project documentation and the active task, not by this file.

## Working Style

Work incrementally.

Understand → plan → implement → test → validate → document.

When uncertain about product behavior or an architectural decision, surface the uncertainty instead of inventing a solution.
