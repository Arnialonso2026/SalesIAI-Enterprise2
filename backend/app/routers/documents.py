from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.database import get_db
from app.deps import require_roles
from app.models import Document, User
from app.schemas import DocumentOut

router = APIRouter(prefix="/documents", tags=["Documentos"])
allowed_extensions = {
    ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".txt",
    ".csv", ".jpg", ".jpeg", ".png", ".gif", ".webp",
}


def storage_path(filename: str) -> Path:
    backend_dir = Path(__file__).resolve().parents[2]
    upload_dir = backend_dir / settings.upload_dir
    upload_dir.mkdir(parents=True, exist_ok=True)
    return upload_dir / filename


@router.get("", response_model=list[DocumentOut])
def list_documents(
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("admin")),
) -> list[Document]:
    return list(db.scalars(
        select(Document)
        .where(Document.company_id == user.company_id)
        .order_by(Document.created_at.desc(), Document.id.desc())
    ).all())


@router.post("", response_model=DocumentOut, status_code=201)
def upload_document(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("admin")),
) -> Document:
    suffix = Path(file.filename or "").suffix.lower()
    if suffix not in allowed_extensions:
        raise HTTPException(status_code=400, detail="El formato del archivo no está permitido.")
    if file.size and file.size > 25 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="El archivo no puede superar los 25 MB.")

    stored_name = f"{uuid4().hex}{suffix}"
    destination = storage_path(stored_name)
    with destination.open("wb") as output:
        while chunk := file.file.read(1024 * 1024):
            output.write(chunk)

    document = Document(
        company_id=user.company_id,
        uploaded_by_id=user.id,
        title=Path(file.filename or "Sin título").stem,
        filename=stored_name,
        original_filename=file.filename or stored_name,
        mime_type=file.content_type or "application/octet-stream",
        size_bytes=destination.stat().st_size,
    )
    db.add(document)
    db.commit()
    db.refresh(document)
    return document


@router.get("/{document_id}/download")
def download_document(
    document_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("admin")),
) -> FileResponse:
    document = db.scalar(select(Document).where(Document.id == document_id, Document.company_id == user.company_id))
    if document is None:
        raise HTTPException(status_code=404, detail="Documento no encontrado.")
    path = storage_path(document.filename)
    if not path.is_file():
        raise HTTPException(status_code=404, detail="El archivo ya no está disponible.")
    return FileResponse(path, filename=document.original_filename, media_type=document.mime_type)


@router.delete("/{document_id}", response_model=dict[str, str])
def delete_document(
    document_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("admin")),
) -> dict[str, str]:
    document = db.scalar(select(Document).where(Document.id == document_id, Document.company_id == user.company_id))
    if document is None:
        raise HTTPException(status_code=404, detail="Documento no encontrado.")
    path = storage_path(document.filename)
    if path.exists():
        path.unlink()
    db.delete(document)
    db.commit()
    return {"message": "Documento eliminado."}
