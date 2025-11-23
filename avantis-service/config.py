"""Configuration management for Avantis service."""
import os
import logging
from typing import Optional
from pydantic_settings import BaseSettings

logger = logging.getLogger(__name__)


class Settings(BaseSettings):
    """Application settings."""
    
    # Server configuration
    host: str = "0.0.0.0"
    port: int = 8000
    debug: bool = False
    
    # Avantis configuration
    avantis_network: str = "base-mainnet"  # base-mainnet only (Avantis doesn't support testnet)
    # Note: No global private key - each user provides their own via API (Base Accounts use address only)
    avantis_rpc_url: Optional[str] = None
    
    # Avantis trading contract address (configure based on your deployment)
    avantis_trading_contract_address: Optional[str] = None
    
    # USDC token address (Base network)
    usdc_token_address: str = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"  # Base mainnet
    # For testnet: "0x036CbD53842c5426634e7929541eC2318f3dCF7e"
    
    # Testnet contract addresses (override SDK mainnet addresses)
    # Set these via environment variables or leave None to use SDK defaults
    # Format: JSON string with contract addresses
    # Example: '{"Trading":"0x...","TradingStorage":"0x...",...}'
    avantis_testnet_contract_addresses: Optional[str] = None
    
    def is_testnet(self) -> bool:
        """Check if running on testnet."""
        return self.avantis_network == "base-testnet"
    
    def is_mainnet(self) -> bool:
        """Check if running on mainnet."""
        return self.avantis_network == "base-mainnet"
    
    def get_network_name(self) -> str:
        """Get human-readable network name."""
        if self.is_testnet():
            return "Base Sepolia Testnet"
        return "Base Mainnet"
    
    def get_block_explorer_url(self) -> str:
        """Get block explorer URL for current network."""
        if self.is_testnet():
            return "https://sepolia.basescan.org"
        return "https://basescan.org"
    
    # Retry configuration
    max_retries: int = 3
    retry_delay: float = 1.0  # seconds
    
    # CORS configuration (comma-separated string, will be split into list)
    cors_origins: str = "http://localhost:3000,http://localhost:3001,https://avantis.superapp.gg"
    
    def get_cors_origins_list(self) -> list[str]:
        """Parse comma-separated CORS origins string into list."""
        if not self.cors_origins:
            return ["http://localhost:3000", "http://localhost:3001"]
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = False


# Global settings instance - lazy initialization at runtime
_settings_instance: Optional[Settings] = None

def get_settings() -> Settings:
    """Get settings instance (lazy initialization at runtime)."""
    global _settings_instance
    if _settings_instance is None:
        _settings_instance = Settings()
        
        # Validate network setting at runtime
        if _settings_instance.avantis_network not in ["base-testnet", "base-mainnet"]:
            raise ValueError(
                f"Invalid AVANTIS_NETWORK: {_settings_instance.avantis_network}. "
                "Must be 'base-testnet' or 'base-mainnet'"
            )
        
        # Override USDC address based on network
        if _settings_instance.avantis_network == "base-testnet":
            _settings_instance.usdc_token_address = "0x036CbD53842c5426634e7929541eC2318f3dCF7e"
    
    return _settings_instance

# For backward compatibility, create settings on first access
settings = get_settings()

