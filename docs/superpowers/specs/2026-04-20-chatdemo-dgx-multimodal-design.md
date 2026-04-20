# Chatdemo DGX Multimodal Design

## Goal

Extend the existing branded chat demo so a local developer can upload up to 4 images per user message, preview them in the UI, and send text-plus-image prompts through the FastAPI proxy to an OpenAI-compatible multimodal model served by vLLM. The same architecture should scale cleanly to a later intranet deployment.

## Product Shape

- Keep the existing enterprise chat shell and streamed assistant responses
- Add image upload support near the message input
- Show selected image thumbnails before send
- Show uploaded images inside user message history
- Keep assistant replies text-first with existing Markdown and code block rendering
- Store uploaded images as temporary backend files for the current development session

## Deployment Assumptions

- Current phase is local development:
  - frontend runs on the developer machine
  - backend runs on the developer machine
  - multimodal vLLM model runs on another reachable server
- Later phase is company intranet deployment:
  - frontend and backend can move to an internal server without changing the core API contract
- The upstream multimodal service supports OpenAI-compatible `chat/completions` with user `content` arrays containing `text` and `image_url`

## Architecture

### Frontend

- Keep Next.js App Router structure in `frontend/`
- Extend the chat state model so user messages can include attachments
- Add an upload workflow:
  1. user selects up to 4 images
  2. frontend uploads them to backend via `multipart/form-data`
  3. backend returns `upload_id` plus preview metadata
  4. frontend stores the returned attachment references in pending composer state
- When sending a message, frontend sends:
  - message text
  - attachment `upload_id` references
  - existing generation settings
- Continue to parse assistant output via streamed NDJSON

### Backend

- Keep FastAPI service in `backend/`
- Add a lightweight upload layer for temporary image storage
- Add a preview endpoint so frontend can display thumbnails and history images
- Extend `POST /api/chat` request schema so user messages may include attachment IDs
- Convert attachment IDs into `data:image/...;base64,...` payloads when preparing the upstream multimodal request
- Keep model URL, key, and model name hidden behind backend config

## Data Model

### Frontend Attachment Shape

Each attachment stored in chat state should include:

- `id`: frontend-local attachment ID
- `uploadId`: backend-issued upload identifier
- `name`: original filename
- `mimeType`: validated content type
- `size`: file size in bytes
- `previewUrl`: backend preview URL

### Frontend Message Shape

- Keep `role`, `createdAt`, and text `content`
- Add optional `attachments` array on messages
- Only user messages will carry attachments in the first version

### Backend Upload Metadata

Each uploaded file should track:

- `upload_id`
- original filename
- mime type
- size
- stored file path
- created timestamp

No database is needed for the first version. Metadata can be derived from filenames plus filesystem state.

## API Design

### `POST /api/uploads`

Purpose:
- accept one or more image files from the frontend before chat submission

Rules:
- accept up to 4 files per request
- allow `image/png`, `image/jpeg`, `image/webp`
- reject files larger than 10 MB each
- return structured upload metadata for successful files

Response shape:

```json
{
  "files": [
    {
      "upload_id": "upl_abc123",
      "name": "chart.png",
      "mime_type": "image/png",
      "size": 182233,
      "preview_url": "/api/uploads/upl_abc123/preview"
    }
  ]
}
```

### `GET /api/uploads/{upload_id}/preview`

Purpose:
- serve the temporary uploaded image back to the frontend for thumbnail and history rendering

Rules:
- return `404` if the file is missing or expired

### `POST /api/chat`

Purpose:
- accept chat messages and generation settings
- support user messages with attachment references
- transform them into OpenAI-compatible multimodal upstream messages

Extended user message example:

```json
{
  "role": "user",
  "content": "请分析这几张图",
  "attachments": ["upl_abc123", "upl_def456"]
}
```

Upstream transformed message example:

```json
{
  "role": "user",
  "content": [
    { "type": "text", "text": "请分析这几张图" },
    { "type": "image_url", "image_url": { "url": "data:image/png;base64,..." } },
    { "type": "image_url", "image_url": { "url": "data:image/jpeg;base64,..." } }
  ]
}
```

## UI Behavior

### Composer

- Add an image upload button in the input actions area
- Show selected image thumbnails above the text input
- Allow per-image removal before send
- Allow image-only messages as long as at least one attachment exists
- Clear pending uploads from the composer after successful send

### Message History

- Show user-uploaded images in a compact thumbnail grid inside the user message bubble
- Preserve assistant rendering as text-only Markdown
- If an old preview file no longer exists, the UI may show a broken image or fallback state in the first version

### Errors

Frontend should directly surface backend messages for:

- unsupported file type
- file too large
- more than 4 images
- missing or expired attachment
- model service unavailable
- multimodal upstream rejection

## Temporary Storage Strategy

- Store files under `backend/.uploads/`
- Create the directory on demand at service startup or first upload
- Do not implement long-term persistence in the first version
- Service restart may invalidate old previews and attachment references
- Do not add background cleanup yet; this can be a later intranet hardening step

## Security and Intranet Readiness

- Frontend never calls the model service directly
- All file validation happens in the backend
- Preview URLs are local backend routes rather than raw filesystem paths
- For later intranet deployment, the same design can be upgraded with:
  - persistent storage
  - auth or access control
  - scheduled upload cleanup
  - reverse proxy routing

## Error Handling

- `400` for invalid upload requests or bad attachment references
- `404` for missing preview files
- `502` or streamed error event for upstream model failures
- clear user-facing messages such as:
  - `仅支持 PNG/JPG/JPEG/WEBP 图片`
  - `单张图片大小不能超过 10MB`
  - `单次最多上传 4 张图片`
  - `附件不存在或已失效，请重新上传`

## Testing Strategy

### Backend

- upload validation tests
- preview endpoint tests
- multimodal message transformation tests
- regression coverage for plain-text chat requests

### Frontend

- composer attachment state tests
- upload/remove UI interaction tests
- send-message payload tests with attachments
- regression coverage for plain-text only chat behavior

## Assumptions

- The upstream vLLM service accepts OpenAI-compatible multimodal payloads with `image_url`
- Temporary local files are acceptable during development
- Multi-user persistent media management is out of scope for the first version
