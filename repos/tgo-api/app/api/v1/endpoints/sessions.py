"""Session management endpoints."""

from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session, joinedload

from app.core.database import get_db
from app.core.logging import get_logger
from app.core.security import get_current_active_user
from app.models import Staff, VisitorSession, SessionStatus, Visitor, AssignmentSource
from app.schemas.visitor_session import VisitorSessionResponse
from app.services.session_service import close_visitor_session
from app.services.transfer_service import transfer_to_staff
from app.services.wukongim_client import wukongim_client
from app.utils.encoding import build_visitor_channel_id
from app.utils.const import CHANNEL_TYPE_CUSTOMER_SERVICE

logger = get_logger("api.sessions")
router = APIRouter()


# ============================================================================
# Request/Response schemas
# ============================================================================

class TransferSessionRequest(BaseModel):
    """Request schema for session transfer."""
    
    target_staff_id: UUID = Field(..., description="ID of the staff to transfer the session to")
    reason: Optional[str] = Field(None, max_length=500, description="Reason for transfer")


class TransferSessionResponse(BaseModel):
    """Response schema for session transfer."""
    
    success: bool = Field(..., description="Whether the transfer was successful")
    message: str = Field(..., description="Status message")
    old_session_id: UUID = Field(..., description="ID of the closed session")
    new_session_id: Optional[UUID] = Field(None, description="ID of the new session")
    visitor_id: UUID = Field(..., description="Visitor ID")
    from_staff_id: UUID = Field(..., description="Original staff ID")
    to_staff_id: UUID = Field(..., description="Target staff ID")




@router.post(
    "/{session_id}/close",
    response_model=VisitorSessionResponse,
    summary="Close session by session ID",
    description="Close the given session, update its status and last-message info, and send a system notification.",
)
async def close_session_by_id(
    session_id: UUID,
    db: Session = Depends(get_db),
    current_user: Staff = Depends(get_current_active_user),
) -> VisitorSessionResponse:
    """
    Close a session by session ID.
    
    Only the session owner or an admin can close a session.
    """
    # Query session
    session = (
        db.query(VisitorSession)
        .filter(
            VisitorSession.id == session_id,
            VisitorSession.project_id == current_user.project_id,
        )
        .options(joinedload(VisitorSession.visitor))
        .first()
    )
    
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found"
        )
    
    # Check permission: only assigned staff or admin can close
    if session.staff_id != current_user.id and current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only close sessions assigned to you"
        )
    
    try:
        session = await close_visitor_session(
            db=db,
            session=session,
            closed_by_staff=current_user,
            send_notification=True,
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    
    return VisitorSessionResponse.model_validate(session)


@router.post(
    "/visitor/{visitor_id}/close",
    response_model=VisitorSessionResponse,
    summary="Close session by visitor ID",
    description="Close the visitor's current open session. If the visitor has several open sessions, the latest one is closed.",
)
async def close_session_by_visitor_id(
    visitor_id: UUID,
    db: Session = Depends(get_db),
    current_user: Staff = Depends(get_current_active_user),
) -> VisitorSessionResponse:
    """
    Close a session by visitor ID.
    
    Closes the visitor's current open (status=open) session.
    If the visitor has several open sessions, the most recently created one is closed.
    Only the session owner or an admin can close a session.
    """
    # Check visitor exists and belongs to project
    visitor = db.query(Visitor).filter(
        Visitor.id == visitor_id,
        Visitor.project_id == current_user.project_id,
    ).first()
    
    if not visitor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Visitor not found"
        )
    
    # Query the latest open session for this visitor
    session = (
        db.query(VisitorSession)
        .filter(
            VisitorSession.visitor_id == visitor_id,
            VisitorSession.project_id == current_user.project_id,
            VisitorSession.status == SessionStatus.OPEN.value,
        )
        .options(joinedload(VisitorSession.visitor))
        .order_by(VisitorSession.created_at.desc())
        .first()
    )
    
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No open session found for this visitor"
        )
    
    # Check permission: only assigned staff or admin can close
    if session.staff_id != current_user.id and current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only close sessions assigned to you"
        )
    
    try:
        session = await close_visitor_session(
            db=db,
            session=session,
            closed_by_staff=current_user,
            send_notification=True,
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    
    return VisitorSessionResponse.model_validate(session)


# ============================================================================
# Transfer and accept endpoints
# ============================================================================

@router.post(
    "/{session_id}/transfer",
    response_model=TransferSessionResponse,
    summary="Transfer session",
    description="Transfer the current session to another staff member.",
)
async def transfer_session(
    session_id: UUID,
    request: TransferSessionRequest,
    db: Session = Depends(get_db),
    current_user: Staff = Depends(get_current_active_user),
) -> TransferSessionResponse:
    """
    Transfer a session to another staff member.
    
    - Replace the session's staff member with the target staff member
    - Keep the session open
    - Send a notification
    
    Only the session owner or an admin can transfer a session.
    """
    # Query the session
    session = (
        db.query(VisitorSession)
        .filter(
            VisitorSession.id == session_id,
            VisitorSession.project_id == current_user.project_id,
        )
        .options(joinedload(VisitorSession.visitor))
        .first()
    )
    
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found"
        )
    
    if session.status != SessionStatus.OPEN.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Session is not open"
        )
    
    # Check permission: only assigned staff or admin can transfer
    if session.staff_id != current_user.id and current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only transfer sessions assigned to you"
        )
    
    # Check target staff exists and is available
    target_staff = db.query(Staff).filter(
        Staff.id == request.target_staff_id,
        Staff.project_id == current_user.project_id,
        Staff.deleted_at.is_(None),
    ).first()
    
    if not target_staff:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Target staff not found"
        )
    
    if target_staff.id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot transfer to yourself"
        )
    
    if not target_staff.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Target staff is not active"
        )
    
    if target_staff.service_paused:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Target staff has paused service"
        )
    
    session_id = session.id
    visitor_id = session.visitor_id
    from_staff_id = session.staff_id or current_user.id
    
    # Get original staff info for notification
    from_staff = db.query(Staff).filter(Staff.id == from_staff_id).first() if from_staff_id else None
    from_staff_name = from_staff.name or from_staff.username if from_staff else str(from_staff_id)
    to_staff_name = target_staff.name or target_staff.username
    
    # Transfer to target staff (reuse existing session, don't close, don't send notification)
    notes = f"Transferred from staff {current_user.id}"
    if request.reason:
        notes += f": {request.reason}"
    
    result = await transfer_to_staff(
        db=db,
        visitor_id=visitor_id,
        project_id=current_user.project_id,
        source=AssignmentSource.TRANSFER,
        assigned_by_staff_id=current_user.id,
        target_staff_id=request.target_staff_id,
        platform_id=session.platform_id,
        notes=notes,
        skip_queue_status_check=True,
        auto_commit=True,
        send_notification=False,
    )
    
    if not result.success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to transfer session: {result.message}"
        )
    
    # Send session transferred notification
    visitor_channel_id = build_visitor_channel_id(visitor_id)
    to_staff_uid = f"{request.target_staff_id}-staff"
    await wukongim_client.send_session_transferred_message(
        from_uid=to_staff_uid,
        channel_id=visitor_channel_id,
        channel_type=CHANNEL_TYPE_CUSTOMER_SERVICE,
        from_staff_uid=f"{from_staff_id}-staff",
        from_staff_name=from_staff_name,
        to_staff_uid=to_staff_uid,
        to_staff_name=to_staff_name,
    )
    
    logger.info(
        f"Session {session_id} transferred from staff {from_staff_id} to {request.target_staff_id}",
        extra={
            "session_id": str(session_id),
            "visitor_id": str(visitor_id),
            "from_staff_id": str(from_staff_id),
            "to_staff_id": str(request.target_staff_id),
            "reason": request.reason,
        },
    )
    
    return TransferSessionResponse(
        success=True,
        message="Session transferred successfully",
        old_session_id=session_id,
        new_session_id=result.session.id if result.session else session_id,
        visitor_id=visitor_id,
        from_staff_id=from_staff_id,
        to_staff_id=request.target_staff_id,
    )


@router.post(
    "/visitor/{visitor_id}/transfer",
    response_model=TransferSessionResponse,
    summary="Transfer session by visitor ID",
    description="Transfer the visitor's current session to another staff member.",
)
async def transfer_session_by_visitor_id(
    visitor_id: UUID,
    request: TransferSessionRequest,
    db: Session = Depends(get_db),
    current_user: Staff = Depends(get_current_active_user),
) -> TransferSessionResponse:
    """
    Transfer a session by visitor ID.
    
    - Find the visitor's current open session
    - Replace the session's staff member with the target staff member
    - Keep the session open
    
    Only the session owner or an admin can transfer a session.
    """
    # Check visitor exists
    visitor = db.query(Visitor).filter(
        Visitor.id == visitor_id,
        Visitor.project_id == current_user.project_id,
        Visitor.deleted_at.is_(None),
    ).first()
    
    if not visitor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Visitor not found"
        )
    
    # Query the latest open session for this visitor
    session = (
        db.query(VisitorSession)
        .filter(
            VisitorSession.visitor_id == visitor_id,
            VisitorSession.project_id == current_user.project_id,
            VisitorSession.status == SessionStatus.OPEN.value,
        )
        .options(joinedload(VisitorSession.visitor))
        .order_by(VisitorSession.created_at.desc())
        .first()
    )
    
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No open session found for this visitor"
        )
    
    # Check permission: only assigned staff or admin can transfer
    if session.staff_id != current_user.id and current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only transfer sessions assigned to you"
        )
    
    # Check target staff exists and is available
    target_staff = db.query(Staff).filter(
        Staff.id == request.target_staff_id,
        Staff.project_id == current_user.project_id,
        Staff.deleted_at.is_(None),
    ).first()
    
    if not target_staff:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Target staff not found"
        )
    
    if target_staff.id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot transfer to yourself"
        )
    
    if not target_staff.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Target staff is not active"
        )
    
    if target_staff.service_paused:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Target staff has paused service"
        )
    
    session_id = session.id
    from_staff_id = session.staff_id or current_user.id
    
    # Get original staff info for notification
    from_staff = db.query(Staff).filter(Staff.id == from_staff_id).first() if from_staff_id else None
    from_staff_name = from_staff.name or from_staff.username if from_staff else str(from_staff_id)
    to_staff_name = target_staff.name or target_staff.username
    
    # Transfer to target staff (reuse existing session, don't close, don't send notification)
    notes = f"Transferred from staff {current_user.id}"
    if request.reason:
        notes += f": {request.reason}"
    
    result = await transfer_to_staff(
        db=db,
        visitor_id=visitor_id,
        project_id=current_user.project_id,
        source=AssignmentSource.TRANSFER,
        assigned_by_staff_id=current_user.id,
        target_staff_id=request.target_staff_id,
        platform_id=session.platform_id,
        notes=notes,
        skip_queue_status_check=True,
        auto_commit=True,
        send_notification=False,
    )
    
    if not result.success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to transfer session: {result.message}"
        )
    
    # Send session transferred notification
    visitor_channel_id = build_visitor_channel_id(visitor_id)
    to_staff_uid = f"{request.target_staff_id}-staff"
    await wukongim_client.send_session_transferred_message(
        from_uid=to_staff_uid,
        channel_id=visitor_channel_id,
        channel_type=CHANNEL_TYPE_CUSTOMER_SERVICE,
        from_staff_uid=f"{from_staff_id}-staff",
        from_staff_name=from_staff_name,
        to_staff_uid=to_staff_uid,
        to_staff_name=to_staff_name,
    )
    
    logger.info(
        f"Session transferred via visitor_id {visitor_id} from staff {from_staff_id} to {request.target_staff_id}",
        extra={
            "session_id": str(session_id),
            "visitor_id": str(visitor_id),
            "from_staff_id": str(from_staff_id),
            "to_staff_id": str(request.target_staff_id),
            "reason": request.reason,
        },
    )
    
    return TransferSessionResponse(
        success=True,
        message="Session transferred successfully",
        old_session_id=session_id,
        new_session_id=result.session.id if result.session else session_id,
        visitor_id=visitor_id,
        from_staff_id=from_staff_id,
        to_staff_id=request.target_staff_id,
    )
