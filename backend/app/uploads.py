from __future__ import annotations

import json
import secrets
from pathlib import Path

from fastapi import HTTPException, UploadFile


ALLOWED_IMAGE_TYPES = {
    "image/png",
    "image/jpeg",
    "image/webp",
}
MAX_FILES_PER_REQUEST = 4
MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024


def ensure_uploads_dir(uploads_dir: str | Path) -> Path:
    path = Path(uploads_dir)
    path.mkdir(parents=True, exist_ok=True)
    return path


def _metadata_path(uploads_dir: Path, upload_id: str) -> Path:
    return uploads_dir / f"{upload_id}.json"


def _binary_path(uploads_dir: Path, upload_id: str) -> Path:
    return uploads_dir / f"{upload_id}.bin"


def save_upload_file(upload: UploadFile, uploads_dir: str | Path) -> dict[str, str | int]:
    if upload.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(status_code=400, detail="仅支持 PNG/JPG/JPEG/WEBP 图片")

    raw_bytes = upload.file.read()
    if not raw_bytes:
        raise HTTPException(status_code=400, detail="上传图片不能为空")

    if len(raw_bytes) > MAX_FILE_SIZE_BYTES:
        raise HTTPException(status_code=400, detail="单张图片大小不能超过 10MB")

    uploads_path = ensure_uploads_dir(uploads_dir)
    upload_id = f"upl_{secrets.token_hex(8)}"
    binary_path = _binary_path(uploads_path, upload_id)
    metadata_path = _metadata_path(uploads_path, upload_id)

    binary_path.write_bytes(raw_bytes)
    metadata_path.write_text(
        json.dumps(
            {
                "upload_id": upload_id,
                "name": upload.filename or "image",
                "mime_type": upload.content_type,
                "size": len(raw_bytes),
            }
        ),
        encoding="utf-8",
    )

    return {
        "upload_id": upload_id,
        "name": upload.filename or "image",
        "mime_type": upload.content_type,
        "size": len(raw_bytes),
        "preview_url": f"/api/uploads/{upload_id}/preview",
    }


def resolve_upload(upload_id: str, uploads_dir: str | Path) -> tuple[dict[str, str | int], Path]:
    uploads_path = ensure_uploads_dir(uploads_dir)
    metadata_path = _metadata_path(uploads_path, upload_id)
    binary_path = _binary_path(uploads_path, upload_id)

    if not metadata_path.exists() or not binary_path.exists():
        raise HTTPException(status_code=404, detail="附件不存在或已失效，请重新上传")

    metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
    return metadata, binary_path
