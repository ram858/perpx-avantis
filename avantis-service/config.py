"""Configuration management for Avantis service."""
import os
from typing import Optional
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings."""
    
    # Server configuration
    host: str = "0.0.0.0"
    port: int = 8000
    debug: bool = False
    
    # Avantis configuration
    avantis_network: str = "base-testnet"  # base-testnet or base-mainnet
    avantis_private_key: Optional[str] = None
    avantis_rpc_url: Optional[str] = None
    
    # USDC token address (Base network)
    usdc_token_address: str = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"  # Base mainnet
    # For testnet: "0x036CbD53842c5426634e7929541eC2318f3dCF7e"
    
    # Retry configuration
    max_retries: int = 3
    retry_delay: float = 1.0  # seconds
    
    # CORS configuration
    cors_origins: list[str] = ["http://localhost:3000", "http://localhost:3001"]
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = False


# Global settings instance
settings = Settings()

# Override USDC address based on network
if settings.avantis_network == "base-testnet":
    settings.usdc_token_address = "0x036CbD53842c5426634e7929541eC2318f3dCF7e"

