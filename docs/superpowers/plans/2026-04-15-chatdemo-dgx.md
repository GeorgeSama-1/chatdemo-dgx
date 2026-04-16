# Chatdemo DGX Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a runnable company-branded AI chat demo with Next.js frontend and FastAPI backend connected to an OpenAI-compatible DGX model service.

**Architecture:** Use a two-app structure with `frontend/` for the branded chat UI and `backend/` for a secure proxy layer. Stream assistant output from FastAPI to the browser using NDJSON so the frontend can render incremental updates with straightforward parsing and cancellation.

**Tech Stack:** Next.js, React, TypeScript, FastAPI, httpx, pytest, Vitest, Testing Library

---

## Chunk 1: Repository Foundations

### Task 1: Create the base repository structure and shared docs

**Files:**
- Create: `frontend/`
- Create: `backend/`
- Create: `.gitignore`
- Create: `.env.example`
- Modify: `README.md`

- [ ] Step 1: Create the directory structure and base config files.
- [ ] Step 2: Document shared environment variables and startup commands.
- [ ] Step 3: Ensure the repo root clearly explains the separated frontend/backend setup.

## Chunk 2: Backend Proxy Service

### Task 2: Add failing backend tests for health, validation, and streaming

**Files:**
- Create: `backend/tests/test_health.py`
- Create: `backend/tests/test_chat.py`
- Create: `backend/pytest.ini`
- Create: `backend/requirements-dev.txt`

- [ ] Step 1: Write tests for `/api/health` and `/api/chat`.
- [ ] Step 2: Run `pytest` to verify the tests fail for the expected missing-app reasons.
- [ ] Step 3: Add minimal FastAPI implementation to satisfy the tests.
- [ ] Step 4: Re-run backend tests until green.

### Task 3: Implement upstream client and stream transformation

**Files:**
- Create: `backend/app/main.py`
- Create: `backend/app/config.py`
- Create: `backend/app/models.py`
- Create: `backend/app/services/openai_compat.py`

- [ ] Step 1: Model request/response payloads with clear validation.
- [ ] Step 2: Implement health endpoint and chat endpoint.
- [ ] Step 3: Relay OpenAI-compatible stream chunks into NDJSON events.
- [ ] Step 4: Add clear error handling and comments around non-obvious logic.

## Chunk 3: Frontend UI Shell

### Task 4: Add failing frontend tests for helpers and page rendering

**Files:**
- Create: `frontend/src/lib/chat-store.test.ts`
- Create: `frontend/src/lib/streaming.test.ts`
- Create: `frontend/src/components/chat-shell.test.tsx`

- [ ] Step 1: Write tests around session persistence, stream parsing, and the initial branded shell.
- [ ] Step 2: Run `npm test` to verify they fail before implementation.
- [ ] Step 3: Add the minimal code for helpers and components.
- [ ] Step 4: Re-run tests until green.

### Task 5: Build the branded chat experience

**Files:**
- Create: `frontend/src/app/page.tsx`
- Create: `frontend/src/app/layout.tsx`
- Create: `frontend/src/app/globals.css`
- Create: `frontend/src/components/chat-shell.tsx`
- Create: `frontend/src/components/message-bubble.tsx`
- Create: `frontend/src/components/settings-panel.tsx`
- Create: `frontend/src/lib/chat-store.ts`
- Create: `frontend/src/lib/streaming.ts`
- Create: `frontend/src/lib/types.ts`

- [ ] Step 1: Implement layout, top bar, sidebar, welcome area, cards, messages, and composer.
- [ ] Step 2: Add markdown/code block rendering and enterprise styling.
- [ ] Step 3: Add collapsible settings and local session management.
- [ ] Step 4: Keep theme values centralized in CSS variables.

## Chunk 4: Integration and Docs

### Task 6: Connect frontend to backend with streaming and cancellation

**Files:**
- Modify: `frontend/src/components/chat-shell.tsx`
- Modify: `frontend/src/lib/streaming.ts`
- Modify: `backend/app/main.py`

- [ ] Step 1: Wire health checks and chat submission.
- [ ] Step 2: Stream assistant tokens into the current session.
- [ ] Step 3: Support stop generation with `AbortController`.
- [ ] Step 4: Surface backend errors cleanly in the UI.

### Task 7: Finish docs and run verification

**Files:**
- Modify: `README.md`
- Modify: `.env.example`

- [ ] Step 1: Document install, env setup, frontend startup, backend startup, and future improvements.
- [ ] Step 2: Run backend tests, frontend tests, and build commands.
- [ ] Step 3: Fix obvious issues found during verification.
