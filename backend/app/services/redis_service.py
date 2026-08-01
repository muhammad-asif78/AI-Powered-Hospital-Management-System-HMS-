import json
import logging

try:
    import redis.asyncio as aioredis
except ImportError:
    aioredis = None

from app.config import settings

logger = logging.getLogger("linear_health.redis")


redis_client = None


async def init_redis():
    global redis_client
    if aioredis is None:
        logger.warning("Redis library not installed — caching disabled")
        redis_client = None
        return
    try:
        redis_client = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
        await redis_client.ping()  # type: ignore
        logger.info("Redis connected at %s", settings.REDIS_URL)
    except Exception as e:
        logger.warning("Redis unavailable (%s) — caching disabled", e)
        redis_client = None



async def close_redis():
    if redis_client:
        await redis_client.close()


async def get_cache(key: str):
    if not redis_client:
        return None
    try:
        return await redis_client.get(key)
    except Exception:
        return None


async def set_cache(key: str, value, ex: int = 300):
    if not redis_client:
        return
    try:
        data = json.dumps(value) if not isinstance(value, str) else value
        await redis_client.set(key, data, ex=ex)
    except Exception:
        pass


async def delete_cache(key: str):
    if not redis_client:
        return
    try:
        await redis_client.delete(key)
    except Exception:
        pass


async def invalidate_pattern(pattern: str):
    """Delete all keys matching a pattern (e.g. 'patients:*')."""
    if not redis_client:
        return
    try:
        async for key in redis_client.scan_iter(match=pattern):
            await redis_client.delete(key)
    except Exception:
        pass
