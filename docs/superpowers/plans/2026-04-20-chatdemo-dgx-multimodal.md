# Chatdemo DGX Multimodal Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add image upload and multimodal chat support so users can send up to 4 images with a message through the existing FastAPI proxy to an OpenAI-compatible vLLM model.

**Architecture:** The frontend uploads images to the backend first, keeps returned attachment references in local chat state, and then sends `upload_id` references through the existing chat request. The backend stores temporary files under a local uploads directory, serves preview URLs, and converts those files into OpenAI-compatible `image_url` parts when forwarding the chat request upstream.

**Tech Stack:** Next.js, React, TypeScript, FastAPI, Pydantic, httpx, local filesystem temp storage, Vitest, pytest

---

## Chunk 1: Backend Upload Plumbing

### Task 1: Add failing backend tests for upload and preview endpoints

**Files:**
- Create: `backend/tests/test_uploads.py`
- Reference: `backend/tests/test_chat.py`
- Reference: `backend/app/main.py`

- [ ] **Step 1: Write the failing test for successful image upload**

```python
def test_upload_image_returns_metadata(client):
    response = client.post(
        "/api/uploads",
        files={"files": ("chart.png", b"fake-png", "image/png")},
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["files"][0]["upload_id"]
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && pytest tests/test_uploads.py::test_upload_image_returns_metadata -v`
Expected: FAIL because `/api/uploads` does not exist yet

- [ ] **Step 3: Write the failing test for preview endpoint**

```python
def test_preview_endpoint_returns_uploaded_file(client):
    ...
```

- [ ] **Step 4: Run test to verify it fails**

Run: `cd backend && pytest tests/test_uploads.py::test_preview_endpoint_returns_uploaded_file -v`
Expected: FAIL with `404` or missing route

- [ ] **Step 5: Commit**

```bash
git add backend/tests/test_uploads.py
git commit -m "test: add upload endpoint coverage"
```

### Task 2: Implement temporary upload storage and preview serving

**Files:**
- Create: `backend/app/uploads.py`
- Modify: `backend/app/main.py`
- Modify: `backend/app/config.py`
- Modify: `backend/app/models.py`
- Test: `backend/tests/test_uploads.py`

- [ ] **Step 1: Write minimal upload storage helpers**

Include helpers for:
- creating the uploads directory
- validating file type and size
- generating `upload_id`
- saving the file
- resolving preview paths

- [ ] **Step 2: Add upload response models**

Include:
- `UploadFileInfo`
- `UploadResponse`

- [ ] **Step 3: Add `POST /api/uploads` route**

Implement:
- `multipart/form-data` handling
- max file count check
- MIME type and size validation
- structured JSON response

- [ ] **Step 4: Add `GET /api/uploads/{upload_id}/preview` route**

Return:
- file content for valid `upload_id`
- `404` if missing

- [ ] **Step 5: Run backend upload tests**

Run: `cd backend && pytest tests/test_uploads.py -v`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add backend/app/uploads.py backend/app/main.py backend/app/config.py backend/app/models.py backend/tests/test_uploads.py
git commit -m "feat: add temporary image upload endpoints"
```

## Chunk 2: Multimodal Chat Transformation

### Task 3: Add failing backend tests for multimodal chat payload transformation

**Files:**
- Modify: `backend/tests/test_chat.py`
- Reference: `backend/app/services/openai_compat.py`

- [ ] **Step 1: Write failing test for user message with attachments**

```python
def test_chat_builds_multimodal_user_message(...):
    assert upstream_payload["messages"][0]["content"][1]["type"] == "image_url"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && pytest tests/test_chat.py::test_chat_builds_multimodal_user_message -v`
Expected: FAIL because attachments are not supported yet

- [ ] **Step 3: Write failing test for missing attachment ID**

```python
def test_chat_rejects_missing_attachment(client):
    ...
```

- [ ] **Step 4: Run test to verify it fails**

Run: `cd backend && pytest tests/test_chat.py::test_chat_rejects_missing_attachment -v`
Expected: FAIL because request validation does not cover attachments yet

- [ ] **Step 5: Commit**

```bash
git add backend/tests/test_chat.py
git commit -m "test: add multimodal chat transformation coverage"
```

### Task 4: Extend backend chat models and upstream conversion for attachments

**Files:**
- Modify: `backend/app/models.py`
- Modify: `backend/app/services/openai_compat.py`
- Modify: `backend/app/main.py`
- Modify: `backend/app/uploads.py`
- Test: `backend/tests/test_chat.py`

- [ ] **Step 1: Extend backend chat request models**

Add optional attachment IDs on chat messages:

```python
class ChatMessage(BaseModel):
    role: MessageRole
    content: str = ""
    attachments: list[str] = []
```

- [ ] **Step 2: Add helper to load stored uploads and convert them**

Implement helper logic to:
- resolve `upload_id`
- read file bytes
- base64 encode content
- return `image_url` blocks

- [ ] **Step 3: Update upstream message builder**

Rules:
- plain user messages stay string-based
- user messages with attachments become `content` arrays
- assistant messages stay text-only

- [ ] **Step 4: Reject missing or expired attachment references**

Return clear `400` error text:
- `附件不存在或已失效，请重新上传`

- [ ] **Step 5: Run targeted backend tests**

Run: `cd backend && pytest tests/test_chat.py tests/test_uploads.py -v`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add backend/app/models.py backend/app/services/openai_compat.py backend/app/main.py backend/app/uploads.py backend/tests/test_chat.py
git commit -m "feat: add multimodal chat payload support"
```

## Chunk 3: Frontend Attachment State and Upload UI

### Task 5: Add failing frontend tests for attachment selection and rendering

**Files:**
- Modify: `frontend/src/components/chat-shell.test.tsx`
- Modify: `frontend/src/lib/chat-store.test.ts`
- Reference: `frontend/src/components/chat-shell.tsx`
- Reference: `frontend/src/lib/types.ts`

- [ ] **Step 1: Write failing test for showing selected image thumbnails**

```tsx
it("shows uploaded image previews before sending", async () => {
  ...
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npm test -- chat-shell.test.tsx`
Expected: FAIL because attachment UI is missing

- [ ] **Step 3: Write failing test for message payload including attachments**

```tsx
it("sends attachment upload ids with the user message", async () => {
  ...
})
```

- [ ] **Step 4: Run test to verify it fails**

Run: `cd frontend && npm test -- chat-shell.test.tsx`
Expected: FAIL because chat payload does not include attachments

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/chat-shell.test.tsx frontend/src/lib/chat-store.test.ts
git commit -m "test: add frontend multimodal composer coverage"
```

### Task 6: Implement frontend attachment models and upload workflow

**Files:**
- Modify: `frontend/src/lib/types.ts`
- Modify: `frontend/src/lib/chat-store.ts`
- Modify: `frontend/src/components/chat-shell.tsx`
- Modify: `frontend/src/app/globals.css`
- Test: `frontend/src/components/chat-shell.test.tsx`

- [ ] **Step 1: Add attachment types**

Add:
- `ChatAttachment`
- optional `attachments` on `ChatMessage`

- [ ] **Step 2: Add composer state for pending attachments**

Track:
- uploaded files
- upload status
- remove action

- [ ] **Step 3: Add upload button and hidden file input**

Support:
- up to 4 images
- per-image removal
- error display for invalid selections

- [ ] **Step 4: Call `POST /api/uploads` before message send**

Store backend response metadata in composer state.

- [ ] **Step 5: Include `attachments` in chat payload**

Send `uploadId` references with the message body.

- [ ] **Step 6: Show message attachments in user bubbles**

Render thumbnail grid with preview links.

- [ ] **Step 7: Run targeted frontend tests**

Run: `cd frontend && npm test -- chat-shell.test.tsx`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add frontend/src/lib/types.ts frontend/src/lib/chat-store.ts frontend/src/components/chat-shell.tsx frontend/src/app/globals.css frontend/src/components/chat-shell.test.tsx
git commit -m "feat: add frontend image upload composer"
```

## Chunk 4: End-to-End Regression and Documentation

### Task 7: Add regression coverage for plain-text chat and finalize docs

**Files:**
- Modify: `backend/tests/test_chat.py`
- Modify: `frontend/src/lib/streaming.test.ts`
- Modify: `README.md`

- [ ] **Step 1: Re-run and update plain-text regression tests only if needed**

Ensure text-only chat still works with no attachments.

- [ ] **Step 2: Update README**

Document:
- multimodal support
- upload constraints
- local development topology
- later intranet deployment notes

- [ ] **Step 3: Run backend test suite**

Run: `cd backend && pytest`
Expected: PASS

- [ ] **Step 4: Run frontend test suite**

Run: `cd frontend && npm test`
Expected: PASS

- [ ] **Step 5: Run frontend production build**

Run: `cd frontend && npm run build`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add backend/tests/test_chat.py frontend/src/lib/streaming.test.ts README.md
git commit -m "docs: describe multimodal chat workflow"
```
