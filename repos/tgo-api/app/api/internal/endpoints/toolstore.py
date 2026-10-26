from typing import Any, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import select

from app.core.database import get_db
from app.models.store_credential import StoreCredential
from app.utils.crypto import decrypt_str

router = APIRouter()


@router.get("/{project_id}/credential")
def get_project_credential(
    project_id: UUID,
    db: Session = Depends(get_db),
) -> Any:
    """Get the store credentials bound to the project (internal API; includes the decrypted API key)."""
    credential = db.scalar(
        select(StoreCredential).where(StoreCredential.project_id == project_id)
    )
    if not credential:
        return None
    
    return {
        "api_key": decrypt_str(credential.api_key_encrypted),
        "store_user_id": credential.store_user_id,
        "store_email": credential.store_email
    }
