"""FastAPI main application for Avantis trading service."""
import logging
from contextlib import asynccontextmanager
from typing import Optional
from fastapi import FastAPI, HTTPException, status, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from config import settings

# Import operation modules
from trade_operations import open_position, close_position, close_all_positions
from position_queries import (
    get_positions,
    get_balance,
    get_total_pnl,
    get_usdc_allowance,
    approve_usdc
)
from symbols import SymbolNotFoundError, get_all_supported_symbols
from utils import map_exception_to_http_status
from transaction_preparation import (
    prepare_open_position_transaction,
    prepare_close_position_transaction,
    prepare_approve_usdc_transaction
)

# Configure logging
logging.basicConfig(
    level=logging.DEBUG if settings.debug else logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


# Request/Response models
class OpenPositionRequest(BaseModel):
    symbol: str = Field(..., description="Trading symbol (e.g., BTC, ETH)")
    collateral: float = Field(..., gt=0, description="Collateral amount in USDC")
    leverage: int = Field(..., ge=1, le=50, description="Leverage multiplier")
    is_long: bool = Field(..., description="True for long, False for short")
    tp: Optional[float] = Field(None, description="Take profit price")
    sl: Optional[float] = Field(None, description="Stop loss price")
    private_key: str = Field(..., description="User's private key (required - each user provides their own)")


class ClosePositionRequest(BaseModel):
    pair_index: int = Field(..., description="Avantis pair index")
    private_key: str = Field(..., description="User's private key (required - each user provides their own)")


class CloseAllPositionsRequest(BaseModel):
    private_key: str = Field(..., description="User's private key (required - each user provides their own)")


class ApproveUSDCRequest(BaseModel):
    amount: float = Field(..., ge=0, description="Amount to approve (0 for unlimited)")
    private_key: str = Field(..., description="User's private key (required - each user provides their own)")


class PrepareOpenPositionRequest(BaseModel):
    symbol: str = Field(..., description="Trading symbol (e.g., BTC, ETH)")
    collateral: float = Field(..., gt=0, description="Collateral amount in USDC")
    leverage: int = Field(..., ge=1, le=50, description="Leverage multiplier")
    is_long: bool = Field(..., description="True for long, False for short")
    address: str = Field(..., description="Base Account address (required for Base Accounts)")
    tp: Optional[float] = Field(None, description="Take profit price")
    sl: Optional[float] = Field(None, description="Stop loss price")


class PrepareClosePositionRequest(BaseModel):
    pair_index: int = Field(..., description="Avantis pair index")
    address: str = Field(..., description="Base Account address (required for Base Accounts)")


class PrepareApproveUSDCRequest(BaseModel):
    amount: float = Field(..., ge=0, description="Amount to approve (0 for unlimited)")
    address: str = Field(..., description="Base Account address (required for Base Accounts)")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan events."""
    logger.info("Starting Avantis Trading Service...")
    logger.info(f"Network: {settings.avantis_network}")
    logger.info(f"Supported symbols: {', '.join(get_all_supported_symbols())}")
    yield
    logger.info("Shutting down Avantis Trading Service...")


# Create FastAPI app
app = FastAPI(
    title="Avantis Trading Service",
    description="FastAPI microservice for Avantis trading operations",
    version="1.0.0",
    lifespan=lifespan
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.get_cors_origins_list(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Health check endpoint
@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "service": "avantis-trading-service",
        "network": settings.avantis_network
    }


# Trading operations endpoints
@app.post("/api/open-position")
async def api_open_position(request: OpenPositionRequest):
    """
    Open a trading position.
    """
    try:
        result = await open_position(
            symbol=request.symbol,
            collateral=request.collateral,
            leverage=request.leverage,
            is_long=request.is_long,
            tp=request.tp,
            sl=request.sl,
            private_key=request.private_key
        )
        return result
    except SymbolNotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Symbol not supported: {str(e)}"
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Error in open_position: {e}", exc_info=True)
        http_status = map_exception_to_http_status(e)
        raise HTTPException(
            status_code=http_status,
            detail=f"Failed to open position: {str(e)}"
        )


@app.post("/api/close-position")
async def api_close_position(request: ClosePositionRequest):
    """
    Close a specific position by pair index.
    """
    try:
        result = await close_position(
            pair_index=request.pair_index,
            private_key=request.private_key
        )
        return result
    except Exception as e:
        logger.error(f"Error in close_position: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to close position: {str(e)}"
        )


@app.post("/api/close-all-positions")
async def api_close_all_positions(request: CloseAllPositionsRequest):
    """
    Close all open positions.
    """
    try:
        result = await close_all_positions(
            private_key=request.private_key
        )
        return result
    except Exception as e:
        logger.error(f"Error in close_all_positions: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to close all positions: {str(e)}"
        )


# Query endpoints
@app.get("/api/positions")
async def api_get_positions(
    private_key: Optional[str] = Query(None, description="User's private key (for traditional wallets)"),
    address: Optional[str] = Query(None, description="User's address (for Base Accounts)")
):
    """
    Get all open positions for a user.
    
    For Base Accounts: provide address (no private key needed for read operations)
    For traditional wallets: provide private_key
    """
    if not private_key and not address:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Either private_key (traditional wallets) or address (Base Accounts) must be provided"
        )
    try:
        positions = await get_positions(private_key=private_key, address=address)
        return {"positions": positions, "count": len(positions)}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in get_positions: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get positions: {str(e)}"
        )


@app.get("/api/balance")
async def api_get_balance(
    private_key: Optional[str] = Query(None, description="User's private key (for traditional wallets)"),
    address: Optional[str] = Query(None, description="User's address (for Base Accounts)")
):
    """
    Get account balance information for a user.
    
    For Base Accounts: provide address (no private key needed for read operations)
    For traditional wallets: provide private_key
    """
    if not private_key and not address:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Either private_key (traditional wallets) or address (Base Accounts) must be provided"
        )
    try:
        balance = await get_balance(private_key=private_key, address=address)
        return balance
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in get_balance: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get balance: {str(e)}"
        )


@app.get("/api/total-pnl")
async def api_get_total_pnl(
    private_key: Optional[str] = Query(None, description="User's private key (for traditional wallets)"),
    address: Optional[str] = Query(None, description="User's address (for Base Accounts)")
):
    """
    Get total unrealized PnL for a user.
    
    For Base Accounts: provide address (no private key needed for read operations)
    For traditional wallets: provide private_key
    """
    if not private_key and not address:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Either private_key (traditional wallets) or address (Base Accounts) must be provided"
        )
    try:
        total_pnl = await get_total_pnl(private_key=private_key, address=address)
        return {"total_pnl": total_pnl}
    except Exception as e:
        logger.error(f"Error in get_total_pnl: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get total PnL: {str(e)}"
        )


@app.get("/api/usdc-allowance")
async def api_get_usdc_allowance(
    private_key: Optional[str] = Query(None, description="User's private key (for traditional wallets)"),
    address: Optional[str] = Query(None, description="User's address (for Base Accounts)")
):
    """
    Get current USDC allowance for a user.
    
    For Base Accounts: provide address (no private key needed for read operations)
    For traditional wallets: provide private_key
    """
    if not private_key and not address:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Either private_key (traditional wallets) or address (Base Accounts) must be provided"
        )
    try:
        allowance = await get_usdc_allowance(private_key=private_key, address=address)
        return {"allowance": allowance}
    except Exception as e:
        logger.error(f"Error in get_usdc_allowance: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get USDC allowance: {str(e)}"
        )


@app.post("/api/approve-usdc")
async def api_approve_usdc(request: ApproveUSDCRequest):
    """
    Approve USDC for trading.
    """
    try:
        result = await approve_usdc(
            amount=request.amount,
            private_key=request.private_key
        )
        return result
    except Exception as e:
        logger.error(f"Error in approve_usdc: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to approve USDC: {str(e)}"
        )


# Transaction preparation endpoints (for Base Accounts)
@app.post("/api/prepare/open-position")
async def api_prepare_open_position(request: PrepareOpenPositionRequest):
    """
    Prepare transaction data for opening a position (Base Account).
    
    Returns transaction data that the frontend should sign via Base Account SDK.
    """
    try:
        result = await prepare_open_position_transaction(
            symbol=request.symbol,
            collateral=request.collateral,
            leverage=request.leverage,
            is_long=request.is_long,
            address=request.address,
            tp=request.tp,
            sl=request.sl
        )
        return result
    except SymbolNotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Symbol not supported: {str(e)}"
        )
    except Exception as e:
        logger.error(f"Error preparing open position transaction: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to prepare transaction: {str(e)}"
        )


@app.post("/api/prepare/close-position")
async def api_prepare_close_position(request: PrepareClosePositionRequest):
    """
    Prepare transaction data for closing a position (Base Account).
    
    Returns transaction data that the frontend should sign via Base Account SDK.
    """
    try:
        result = await prepare_close_position_transaction(
            pair_index=request.pair_index,
            address=request.address
        )
        return result
    except Exception as e:
        logger.error(f"Error preparing close position transaction: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to prepare transaction: {str(e)}"
        )


@app.post("/api/prepare/approve-usdc")
async def api_prepare_approve_usdc(request: PrepareApproveUSDCRequest):
    """
    Prepare transaction data for USDC approval (Base Account).
    
    Returns transaction data that the frontend should sign via Base Account SDK.
    """
    try:
        result = await prepare_approve_usdc_transaction(
            amount=request.amount,
            address=request.address
        )
        return result
    except Exception as e:
        logger.error(f"Error preparing approve USDC transaction: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to prepare transaction: {str(e)}"
        )


# Utility endpoints
@app.get("/api/symbols")
async def api_get_symbols():
    """
    Get all supported trading symbols.
    """
    symbols = get_all_supported_symbols()
    return {"symbols": symbols, "count": len(symbols)}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.debug
    )

