"""Utility functions for error handling and retries."""
import asyncio
import logging
from typing import Callable, TypeVar, Any, Optional, Union, Coroutine, Awaitable
from functools import wraps
from config import settings

logger = logging.getLogger(__name__)

T = TypeVar('T')


def is_network_error(error: Exception) -> bool:
    """
    Check if an error is a network-related error.
    
    Args:
        error: Exception to check
        
    Returns:
        True if network error, False otherwise
    """
    network_error_types = (
        ConnectionError,
        TimeoutError,
        OSError,
    )
    
    error_str = str(error).lower()
    network_keywords = [
        "connection",
        "timeout",
        "network",
        "dns",
        "refused",
        "unreachable",
        "socket",
    ]
    
    return (
        isinstance(error, network_error_types) or
        any(keyword in error_str for keyword in network_keywords)
    )


def retry_on_network_error(
    max_retries: Optional[int] = None,
    delay: Optional[float] = None,
    backoff: float = 2.0
) -> Callable:
    """
    Decorator to retry function on network errors.
    
    Args:
        max_retries: Maximum number of retries (default: from settings)
        delay: Initial delay between retries in seconds (default: from settings)
        backoff: Backoff multiplier (default: 2.0)
        
    Returns:
        Decorated function
    """
    max_retries_val = max_retries if max_retries is not None else settings.max_retries
    delay_val = delay if delay is not None else settings.retry_delay
    
    def decorator(func: Callable[..., Union[T, Awaitable[T]]]) -> Callable[..., Union[T, Awaitable[T]]]:
        @wraps(func)
        async def async_wrapper(*args: Any, **kwargs: Any) -> T:
            last_error: Optional[Exception] = None
            current_delay = delay_val
            
            for attempt in range(max_retries_val + 1):
                try:
                    result = func(*args, **kwargs)
                    if asyncio.iscoroutine(result):
                        return await result
                    else:
                        return result  # type: ignore[return-value]
                except Exception as e:
                    last_error = e
                    
                    if not is_network_error(e):
                        # Not a network error, don't retry
                        raise
                    
                    if attempt < max_retries_val:
                        logger.warning(
                            f"Network error on attempt {attempt + 1}/{max_retries_val + 1}: {e}. "
                            f"Retrying in {current_delay}s..."
                        )
                        await asyncio.sleep(current_delay)
                        current_delay *= backoff
                    else:
                        logger.error(f"Max retries ({max_retries_val}) exceeded for {func.__name__}")
                        raise
            
            # This should never be reached, but type checker needs it
            if last_error:
                raise last_error
            raise RuntimeError("Unexpected error in retry decorator")
        
        @wraps(func)
        def sync_wrapper(*args: Any, **kwargs: Any) -> T:
            last_error: Optional[Exception] = None
            current_delay = delay_val
            
            for attempt in range(max_retries_val + 1):
                try:
                    result = func(*args, **kwargs)
                    return result  # type: ignore[return-value]
                except Exception as e:
                    last_error = e
                    
                    if not is_network_error(e):
                        raise
                    
                    if attempt < max_retries_val:
                        logger.warning(
                            f"Network error on attempt {attempt + 1}/{max_retries_val + 1}: {e}. "
                            f"Retrying in {current_delay}s..."
                        )
                        import time
                        time.sleep(current_delay)
                        current_delay *= backoff
                    else:
                        logger.error(f"Max retries ({max_retries_val}) exceeded for {func.__name__}")
                        raise
            
            # This should never be reached, but type checker needs it
            if last_error:
                raise last_error
            raise RuntimeError("Unexpected error in retry decorator")
        
        # Return appropriate wrapper based on function type
        import inspect
        if inspect.iscoroutinefunction(func):
            return async_wrapper  # type: ignore[return-value]
        else:
            return sync_wrapper  # type: ignore[return-value]
    
    return decorator


def map_exception_to_http_status(error: Exception) -> int:
    """
    Map Python exception to HTTP status code.
    
    Args:
        error: Exception to map
        
    Returns:
        HTTP status code
    """
    from symbols import SymbolNotFoundError
    
    if isinstance(error, (ValueError, SymbolNotFoundError)):
        return 400  # Bad Request
    elif isinstance(error, ConnectionError):
        return 503  # Service Unavailable
    elif isinstance(error, TimeoutError):
        return 504  # Gateway Timeout
    elif isinstance(error, PermissionError):
        return 403  # Forbidden
    elif isinstance(error, FileNotFoundError):
        return 404  # Not Found
    else:
        return 500  # Internal Server Error

