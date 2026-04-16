# Chatdemo DGX Design

## Goal

Build a company-branded AI chat demo with a separated Next.js frontend and FastAPI backend. The frontend provides a polished enterprise chat UI, while the backend proxies requests to an OpenAI-compatible `chat/completions` model endpoint running on DGX.

## Product Shape

- Single-page chat application
- Brandable shell with configurable product name, logo text, welcome copy, and suggestion cards
- Sidebar session history with local persistence
- Collapsible settings for `temperature`, `max_tokens`, and `system prompt`
- Streamed assistant responses with stop generation support
- Markdown and code block rendering

## Architecture

### Frontend

- Next.js App Router application in `frontend/`
- Server-independent SPA-style page using client components for chat state
- `fetch()` calls only target the local FastAPI backend URL exposed through a safe public env var
- Sessions are stored in browser `localStorage`
- UI theme values are centralized in CSS custom properties for easy brand tuning

### Backend

- FastAPI service in `backend/`
- `GET /api/health` for service availability and model metadata
- `POST /api/chat` accepts normalized chat messages plus generation settings
- Backend forwards to `MODEL_BASE_URL + /chat/completions` with `MODEL_API_KEY` and `MODEL_NAME`
- Streaming is relayed from upstream SSE-like chunks to the frontend as NDJSON lines to simplify client parsing

## Data Flow

1. Frontend loads health status from backend on page open.
2. User sends messages and current settings.
3. Backend validates request, forwards it upstream with `stream=true`, and transforms chunks to NDJSON events.
4. Frontend incrementally updates the latest assistant message as streamed text arrives.
5. Errors are returned as structured JSON or streamed `error` events so the UI can display them directly.

## Error Handling

- Reject empty message arrays and malformed roles with `400`
- Surface upstream timeout as `504`
- Surface connection errors / unavailable upstream as `502`
- Surface empty model response as `502`
- Preserve readable error messages for direct frontend display

## Testing Strategy

- Backend tests cover validation, health response, and stream transformation behavior
- Frontend tests cover local session helpers, stream parser, and key UI rendering interactions
- Final verification includes backend `pytest`, frontend `npm test`, and production builds where practical

## Assumptions

- A text placeholder logo block is sufficient for the first runnable version
- Recommended prompts and brand strings can ship with sensible defaults and later move to env/config
- The DGX endpoint follows common OpenAI-compatible streaming semantics with `data:` chunks and `[DONE]`
