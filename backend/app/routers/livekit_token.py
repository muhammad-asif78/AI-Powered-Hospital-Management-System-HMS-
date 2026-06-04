"""LiveKit token generation + room creation with agent dispatch."""

import logging
from fastapi import APIRouter, Depends
from pydantic import BaseModel
# pyrefly: ignore [missing-import]
from livekit import api as lk_api
from app.config import settings
from app.security import get_current_user

logger = logging.getLogger("linear_health.livekit")
router = APIRouter(prefix="/api/livekit", tags=["LiveKit"])


class TokenRequest(BaseModel):
    room_name: str = "contact-center"
    participant_name: str = "patient"


_dispatched_rooms = set()

@router.post("/token")
async def create_livekit_token(req: TokenRequest):
    """Create a LiveKit room with agent dispatch, then return a participant token."""

    try:
        # 1. Create the room via LiveKit Server API and request agent dispatch
        async with lk_api.LiveKitAPI(
            settings.LIVEKIT_URL,
            settings.LIVEKIT_API_KEY,
            settings.LIVEKIT_API_SECRET,
        ) as lk:
            # Create room
            await lk.room.create_room(
                lk_api.CreateRoomRequest(
                    name=req.room_name,
                    empty_timeout=60,       # close room 60s after last participant leaves
                    max_participants=2,      # patient + agent
                )
            )
            
            # Explicitly request agent dispatch only ONCE per room
            if req.room_name not in _dispatched_rooms:
                await lk.agent_dispatch.create_dispatch(
                    lk_api.CreateAgentDispatchRequest(
                        agent_name="linear-health-agent",
                        room=req.room_name,
                    )
                )
                _dispatched_rooms.add(req.room_name)
                logger.info("Room '%s' created with agent dispatch", req.room_name)
    except Exception as e:
        # Room might already exist or other API error, log it but still return token
        logger.error("Room creation or dispatch error: %s", repr(e))

    # 2. Generate participant token for the frontend user
    token = lk_api.AccessToken(
        settings.LIVEKIT_API_KEY,
        settings.LIVEKIT_API_SECRET,
    )
    token.with_identity(req.participant_name)
    token.with_name(req.participant_name)
    token.with_grants(
        lk_api.VideoGrants(room_join=True, room=req.room_name)
    )

    return {"token": token.to_jwt(), "url": settings.LIVEKIT_URL}
