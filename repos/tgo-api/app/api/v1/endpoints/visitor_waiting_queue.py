"""Visitor Waiting Queue endpoints."""

from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session, joinedload

from app.core.database import get_db
from app.core.logging import get_logger
from app.core.security import require_permission
from app.models import (
    Staff,
    Visitor,
    VisitorWaitingQueue,
    WaitingStatus,
    AssignmentSource,
)
from app.schemas.visitor_waiting_queue import (
    WaitingQueueListResponse,
    WaitingQueueDetailResponse,
    WaitingQueueListParams,
    AcceptVisitorRequest,
    AcceptVisitorResponse,
    VisitorBriefResponse,
    StaffBriefResponse,
    WaitingStatusEnum,
    QueueSourceEnum,
    QueueUrgencyEnum,
)
from app.services.transfer_service import transfer_to_staff
from app.utils.encoding import build_visitor_channel_id
from app.utils.const import CHANNEL_TYPE_CUSTOMER_SERVICE

logger = get_logger("api.visitor_waiting_queue")

router = APIRouter()


def _build_visitor_brief(visitor: Visitor) -> VisitorBriefResponse:
    """Build visitor brief response."""
    return VisitorBriefResponse(
        id=visitor.id,
        name=visitor.name,
        nickname=visitor.nickname,
        avatar_url=visitor.avatar_url,
        platform_open_id=visitor.platform_open_id,
    )


def _build_staff_brief(staff: Staff) -> StaffBriefResponse:
    """Build staff brief response."""
    return StaffBriefResponse(
        id=staff.id,
        name=staff.name,
        username=staff.username,
        avatar_url=staff.avatar_url,
    )


def _build_queue_detail_response(entry: VisitorWaitingQueue) -> WaitingQueueDetailResponse:
    """Build detailed queue response from model."""
    visitor_brief = None
    staff_brief = None
    
    if entry.visitor:
        visitor_brief = _build_visitor_brief(entry.visitor)
    if entry.assigned_staff:
        staff_brief = _build_staff_brief(entry.assigned_staff)
    
    return WaitingQueueDetailResponse(
        id=entry.id,
        project_id=entry.project_id,
        visitor_id=entry.visitor_id,
        session_id=entry.session_id,
        assigned_staff_id=entry.assigned_staff_id,
        source=entry.source,
        urgency=entry.urgency,
        position=entry.position,
        priority=entry.priority,
        status=entry.status,
        visitor_message=entry.visitor_message,
        reason=entry.reason,
        channel_id=entry.channel_id,
        channel_type=entry.channel_type,
        retry_count=entry.retry_count,
        wait_duration_seconds=entry.wait_duration_seconds,
        entered_at=entry.entered_at,
        assigned_at=entry.assigned_at,
        exited_at=entry.exited_at,
        created_at=entry.created_at,
        updated_at=entry.updated_at,
        visitor=visitor_brief,
        assigned_staff=staff_brief,
        extra_metadata=entry.extra_metadata,
    )


@router.get(
    "",
    response_model=WaitingQueueListResponse,
    summary="List waiting queue",
    description="List the project's visitor waiting queue, with pagination and filtering.",
)
async def list_waiting_queue(
    status: Optional[WaitingStatusEnum] = Query(
        None, description="Filter by status"
    ),
    source: Optional[QueueSourceEnum] = Query(
        None, description="Filter by source"
    ),
    urgency: Optional[QueueUrgencyEnum] = Query(
        None, description="Filter by urgency"
    ),
    visitor_id: Optional[UUID] = Query(
        None, description="Filter by visitor ID"
    ),
    limit: int = Query(20, ge=1, le=100, description="Items per page"),
    offset: int = Query(0, ge=0, description="Number of items to skip"),
    db: Session = Depends(get_db),
    current_user: Staff = Depends(require_permission("visitors:read")),
) -> WaitingQueueListResponse:
    """
    List the waiting queue.
    
    - Sorted by priority descending, then position ascending (higher priority and earlier entries first)
    - Supports filtering by status, source, urgency and visitor ID
    - Returns brief visitor and staff info
    """
    # Build query
    query = db.query(VisitorWaitingQueue).filter(
        VisitorWaitingQueue.project_id == current_user.project_id,
    )
    
    # Apply filters
    if status:
        query = query.filter(VisitorWaitingQueue.status == status.value)
    if source:
        query = query.filter(VisitorWaitingQueue.source == source.value)
    if urgency:
        query = query.filter(VisitorWaitingQueue.urgency == urgency.value)
    if visitor_id:
        query = query.filter(VisitorWaitingQueue.visitor_id == visitor_id)
    
    # Get total count
    total = query.count()
    
    # Apply ordering and pagination
    entries = (
        query
        .options(
            joinedload(VisitorWaitingQueue.visitor),
            joinedload(VisitorWaitingQueue.assigned_staff),
        )
        .order_by(
            VisitorWaitingQueue.priority.desc(),
            VisitorWaitingQueue.position.asc(),
        )
        .offset(offset)
        .limit(limit)
        .all()
    )
    
    # Build response
    items = [_build_queue_detail_response(entry) for entry in entries]
    
    return WaitingQueueListResponse(
        items=items,
        pagination={
            "total": total,
            "limit": limit,
            "offset": offset,
            "has_next": offset + limit < total,
            "has_prev": offset > 0,
        },
    )


@router.get(
    "/waiting",
    response_model=WaitingQueueListResponse,
    summary="Get waiting queue entries",
    description="Shortcut endpoint: returns only queue entries whose status is waiting.",
)
async def list_waiting_only(
    urgency: Optional[QueueUrgencyEnum] = Query(
        None, description="Filter by urgency"
    ),
    limit: int = Query(20, ge=1, le=100, description="Items per page"),
    offset: int = Query(0, ge=0, description="Number of items to skip"),
    db: Session = Depends(get_db),
    current_user: Staff = Depends(require_permission("visitors:read")),
) -> WaitingQueueListResponse:
    """
    Get waiting queue entries (waiting status only).
    
    A shortcut endpoint dedicated to staff viewing the list of visitors awaiting pickup.
    """
    query = db.query(VisitorWaitingQueue).filter(
        VisitorWaitingQueue.project_id == current_user.project_id,
        VisitorWaitingQueue.status == WaitingStatus.WAITING.value,
    )
    
    if urgency:
        query = query.filter(VisitorWaitingQueue.urgency == urgency.value)
    
    total = query.count()
    
    entries = (
        query
        .options(
            joinedload(VisitorWaitingQueue.visitor),
        )
        .order_by(
            VisitorWaitingQueue.priority.desc(),
            VisitorWaitingQueue.position.asc(),
        )
        .offset(offset)
        .limit(limit)
        .all()
    )
    
    items = [_build_queue_detail_response(entry) for entry in entries]
    
    return WaitingQueueListResponse(
        items=items,
        pagination={
            "total": total,
            "limit": limit,
            "offset": offset,
            "has_next": offset + limit < total,
            "has_prev": offset > 0,
        },
    )


@router.get(
    "/count",
    summary="Get waiting queue count",
    description="Get the number of waiting visitors in the current project.",
)
async def get_waiting_count(
    db: Session = Depends(get_db),
    current_user: Staff = Depends(require_permission("visitors:read")),
) -> dict:
    """
    Get waiting queue count statistics.
    
    Returns the count for each status.
    """
    project_id = current_user.project_id
    
    waiting_count = db.query(VisitorWaitingQueue).filter(
        VisitorWaitingQueue.project_id == project_id,
        VisitorWaitingQueue.status == WaitingStatus.WAITING.value,
    ).count()
    
    assigned_count = db.query(VisitorWaitingQueue).filter(
        VisitorWaitingQueue.project_id == project_id,
        VisitorWaitingQueue.status == WaitingStatus.ASSIGNED.value,
    ).count()
    
    return {
        "waiting": waiting_count,
        "assigned": assigned_count,
        "total": waiting_count + assigned_count,
    }


@router.get(
    "/{entry_id}",
    response_model=WaitingQueueDetailResponse,
    summary="Get queue entry details",
    description="Get the details of a single queue entry by ID.",
)
async def get_queue_entry(
    entry_id: UUID,
    db: Session = Depends(get_db),
    current_user: Staff = Depends(require_permission("visitors:read")),
) -> WaitingQueueDetailResponse:
    """Get the details of a single queue entry."""
    entry = (
        db.query(VisitorWaitingQueue)
        .options(
            joinedload(VisitorWaitingQueue.visitor),
            joinedload(VisitorWaitingQueue.assigned_staff),
        )
        .filter(
            VisitorWaitingQueue.id == entry_id,
            VisitorWaitingQueue.project_id == current_user.project_id,
        )
        .first()
    )
    
    if not entry:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Queue entry not found",
        )
    
    return _build_queue_detail_response(entry)


@router.post(
    "/accept",
    response_model=AcceptVisitorResponse,
    summary="Accept visitor",
    description="Staff accepts a visitor from the waiting queue. (Use the /visitors/{visitor_id}/accept endpoint instead.)",
)
async def accept_visitor(
    request: AcceptVisitorRequest,
    db: Session = Depends(get_db),
    current_user: Staff = Depends(require_permission("visitors:update")),
) -> AcceptVisitorResponse:
    """
    Staff accepts a visitor.
    
    - Accept the given visitor from the waiting queue
    - Call transfer_to_staff to complete the assignment
    - Update the queue status to assigned
    """
    # Find the queue entry by visitor_id (get the latest waiting entry)
    entry = (
        db.query(VisitorWaitingQueue)
        .options(joinedload(VisitorWaitingQueue.visitor))
        .filter(
            VisitorWaitingQueue.visitor_id == request.visitor_id,
            VisitorWaitingQueue.project_id == current_user.project_id,
            VisitorWaitingQueue.status == WaitingStatus.WAITING.value,
        )
        .order_by(VisitorWaitingQueue.entered_at.desc())
        .first()
    )
    
    if not entry:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No waiting queue entry found for this visitor",
        )
    
    # Calculate wait duration before transfer
    wait_duration = entry.wait_duration_seconds
    visitor = entry.visitor
    
    # Call transfer_to_staff service with target_staff_id
    result = await transfer_to_staff(
        db=db,
        visitor_id=entry.visitor_id,
        project_id=entry.project_id,
        source=AssignmentSource.MANUAL,
        visitor_message=entry.visitor_message,
        assigned_by_staff_id=current_user.id,
        target_staff_id=current_user.id,  # Direct assignment to current staff
        session_id=entry.session_id,
        platform_id=visitor.platform_id if visitor else None,
        ai_disabled=entry.ai_disabled,
        add_to_queue_if_no_staff=False,
        notes=f"Accepted from waiting queue. {request.notes or ''}".strip(),
    )
    
    if not result.success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=result.message,
        )
    
    # Update queue entry status to assigned
    entry.assign_to_staff(current_user.id)
    db.commit()
    
    # Determine channel_id
    channel_id = entry.channel_id
    if not channel_id and visitor:
        channel_id = build_visitor_channel_id(visitor.id)
    
    channel_type = entry.channel_type or CHANNEL_TYPE_CUSTOMER_SERVICE
    
    logger.info(
        f"Staff {current_user.id} accepted visitor {request.visitor_id} from queue",
        extra={
            "staff_id": str(current_user.id),
            "visitor_id": str(request.visitor_id),
            "entry_id": str(entry.id),
            "wait_duration_seconds": wait_duration,
        },
    )
    
    return AcceptVisitorResponse(
        success=True,
        message="Visitor accepted successfully",
        entry_id=entry.id,
        visitor_id=entry.visitor_id,
        staff_id=current_user.id,
        session_id=result.session.id if result.session else None,
        channel_id=channel_id,
        channel_type=channel_type,
        wait_duration_seconds=wait_duration,
    )


@router.post(
    "/{entry_id}/cancel",
    summary="Cancel queue entry",
    description="Cancel an entry in the waiting queue (visitor left or another reason).",
)
async def cancel_queue_entry(
    entry_id: UUID,
    reason: Optional[str] = Query(None, max_length=255, description="Cancellation reason"),
    db: Session = Depends(get_db),
    current_user: Staff = Depends(require_permission("visitors:update")),
) -> dict:
    """
    Cancel a queue entry.
    
    Used when a visitor leaves or the wait needs to be cancelled for another reason.
    """
    entry = db.query(VisitorWaitingQueue).filter(
        VisitorWaitingQueue.id == entry_id,
        VisitorWaitingQueue.project_id == current_user.project_id,
    ).first()
    
    if not entry:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Queue entry not found",
        )
    
    if entry.status != WaitingStatus.WAITING.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Queue entry is not in waiting status (current: {entry.status})",
        )
    
    # Update status
    entry.cancel()
    if reason:
        entry.reason = f"{entry.reason or ''} | Cancelled: {reason}".strip(" |")
    
    db.commit()
    
    logger.info(
        f"Queue entry {entry_id} cancelled",
        extra={
            "entry_id": str(entry_id),
            "cancelled_by": str(current_user.id),
            "reason": reason,
        },
    )
    
    return {
        "success": True,
        "message": "Queue entry cancelled",
        "entry_id": str(entry_id),
    }
