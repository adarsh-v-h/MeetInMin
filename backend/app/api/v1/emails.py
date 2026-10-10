import asyncio
import logging
from typing import Annotated, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.deps import CurrentUser
from app.core.config import settings
from app.db.database import get_db
from app.schemas.email import (
    PendingEmailResponse,
    EmailClassificationEnum,
    EmailDraftRequest,
    EmailDraftResponse,
    SendEmailReplyRequest,
    SendEmailReplyResponse
)
from app.services.gmail.client import (
    GmailClientError,
    get_gmail_access_token,
    get_message_details,
    get_thread_details,
    search_gmail_messages,
    search_gmail_threads,
    send_gmail_reply,
)

from app.services.email.classifier import classify_email_with_zoho_glm
from app.services.email.drafter import generate_reply_draft_with_zoho_glm


logger = logging.getLogger(__name__)
DbSession = Annotated[Session, Depends(get_db)]

router = APIRouter()

@router.get("/pending-replies", response_model=List[PendingEmailResponse])
async def list_pending_email_replies(
    current_user: CurrentUser,
    db: DbSession,
    classification_filter: Optional[EmailClassificationEnum] = Query(
        default=None,
        description="Filter emails by classification status (NEEDS_REPLY, NO_REPLY_NEEDED, UNCLEAR)"
    ),
    limit: int = Query(default=15, ge=1, le=50)
):
    """
    Retrieves recent inbox emails for the authenticated user and classifies them
    into NEEDS_REPLY, NO_REPLY_NEEDED, or UNCLEAR.
    """
    if not current_user.google_refresh_token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Google account not connected. Please connect Google in Settings."
        )

    import httpx

    try:
        access_token = await get_gmail_access_token(
            current_user.google_refresh_token,
            settings.GOOGLE_CLIENT_ID,
            settings.GOOGLE_CLIENT_SECRET
        )
    except GmailClientError as e:
        logger.error(f"Failed to obtain Gmail access token for user {current_user.id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not authenticate with Gmail. Please reconnect your Google account in Settings."
        )

    async with httpx.AsyncClient() as client:
        # STEP 1: Fetch thread stubs from inbox in 1 API request
        try:
            threads = await search_gmail_threads(
                access_token,
                query="label:INBOX",
                max_results=limit,
                client=client
            )
        except GmailClientError as e:
            logger.error(f"Gmail inbox thread search failed for user {current_user.id}: {e}")
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Failed to query Gmail inbox threads."
            )

        if not threads:
            return []

        # Extract unique thread IDs
        unique_thread_ids = [t["id"] for t in threads if isinstance(t, dict) and "id" in t]

        # STEP 2: Fetch all full threads concurrently in parallel (no N+1 sequential loop)
        thread_tasks = [get_thread_details(access_token, tid, client=client) for tid in unique_thread_ids]
        raw_threads = await asyncio.gather(*thread_tasks, return_exceptions=True)

        valid_thread_items = []
        for thread_msgs in raw_threads:
            if isinstance(thread_msgs, list) and len(thread_msgs) > 0:
                latest_email = thread_msgs[-1]
                thread_history = thread_msgs[:-1]
                valid_thread_items.append((latest_email, thread_history))

        if not valid_thread_items:
            return []

        # STEP 3: Classify all retrieved emails concurrently in parallel with Zoho GLM
        cls_tasks = [
            classify_email_with_zoho_glm(email_details=latest_email, thread_messages=history, client=client)
            for latest_email, history in valid_thread_items
        ]
        classification_results = await asyncio.gather(*cls_tasks, return_exceptions=True)

    # Build structured response list
    classified_results = []
    for (latest_email, _), cls_res in zip(valid_thread_items, classification_results):
        if not isinstance(cls_res, dict):
            cls_res = {
                "classification": EmailClassificationEnum.UNCLEAR,
                "reasoning": "Could not complete classification."
            }

        email_resp = PendingEmailResponse(
            gmail_message_id=latest_email["gmail_message_id"],
            thread_id=latest_email.get("thread_id", ""),
            subject=latest_email.get("subject", "(no subject)"),
            sender=latest_email.get("sender", "(unknown)"),
            recipient=latest_email.get("recipient", ""),
            snippet=latest_email.get("snippet", ""),
            body_text=latest_email.get("body_text", ""),
            received_at=latest_email.get("received_at"),
            classification=cls_res["classification"],
            reasoning=cls_res["reasoning"]
        )

        if classification_filter is None or email_resp.classification == classification_filter:
            classified_results.append(email_resp)

    return classified_results



@router.post("/{message_id}/draft-reply", response_model=EmailDraftResponse)
async def generate_email_reply_draft(
    message_id: str,
    current_user: CurrentUser,
    body: Optional[EmailDraftRequest] = None,
):
    """
    Generates an AI contextual reply draft for a given Gmail message ID.
    Does NOT send the email. Returns recipient, subject, thread_id, and body_text.
    """
    if not current_user.google_refresh_token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Google account not connected. Please connect Google in Settings."
        )

    try:
        access_token = await get_gmail_access_token(
            current_user.google_refresh_token,
            settings.GOOGLE_CLIENT_ID,
            settings.GOOGLE_CLIENT_SECRET
        )
    except GmailClientError as e:
        logger.error(f"Failed to obtain Gmail access token for user {current_user.id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not authenticate with Gmail. Please reconnect your Google account in Settings."
        )

    email_details = await get_message_details(access_token, message_id)
    if not email_details:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Email message with ID '{message_id}' not found."
        )

    thread_messages = None
    if email_details.get("thread_id"):
        thread_messages = await get_thread_details(access_token, email_details["thread_id"])

    user_instructions = body.user_instructions if body else None
    draft_body = await generate_reply_draft_with_zoho_glm(
        email_details=email_details,
        thread_messages=thread_messages,
        user_instructions=user_instructions
    )

    orig_subject = email_details.get("subject", "(no subject)")
    reply_subject = orig_subject if orig_subject.lower().startswith("re:") else f"Re: {orig_subject}"
    recipient = email_details.get("sender", "")

    return EmailDraftResponse(
        gmail_message_id=message_id,
        thread_id=email_details.get("thread_id", ""),
        recipient=recipient,
        subject=reply_subject,
        body_text=draft_body,
        in_reply_to_message_id=email_details.get("message_id_header")
    )


@router.post("/send-reply", response_model=SendEmailReplyResponse)
async def send_email_reply(
    payload: SendEmailReplyRequest,
    current_user: CurrentUser,
):
    """
    Sends the user-reviewed reply email via Gmail API using the user's connected Google account.
    Returns success confirmation and the sent message ID.
    """
    if not current_user.google_refresh_token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Google account not connected. Please connect Google in Settings."
        )

    try:
        access_token = await get_gmail_access_token(
            current_user.google_refresh_token,
            settings.GOOGLE_CLIENT_ID,
            settings.GOOGLE_CLIENT_SECRET
        )
    except GmailClientError as e:
        logger.error(f"Failed to obtain Gmail access token for user {current_user.id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not authenticate with Gmail. Please reconnect your Google account in Settings."
        )

    try:
        sent_result = await send_gmail_reply(
            access_token=access_token,
            recipient=payload.recipient,
            subject=payload.subject,
            body_text=payload.body_text,
            thread_id=payload.thread_id,
            in_reply_to_message_id=payload.in_reply_to_message_id
        )

        sent_msg_id = sent_result.get("id", "")
        sent_thread_id = sent_result.get("threadId", payload.thread_id)

        return SendEmailReplyResponse(
            success=True,
            sent_message_id=sent_msg_id,
            thread_id=sent_thread_id,
            detail="Email reply sent successfully!"
        )
    except GmailClientError as e:
        logger.error(f"Failed to send email reply for user {current_user.id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Gmail sending failed: {e}"
        )


