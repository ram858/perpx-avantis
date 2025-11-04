"""Core Avantis SDK client wrapper."""
import os
from typing import Optional
from avantis_trader_sdk import TraderClient  # Adjust import based on actual SDK
from web3 import Web3
from eth_account import Account
from config import settings


class AvantisClient:
    """Wrapper for Avantis TraderClient."""
    
    def __init__(self, private_key: Optional[str] = None):
        """
        Initialize Avantis client.
        
        Args:
            private_key: Ethereum private key (hex string with 0x prefix)
                        If None, uses AVANTIS_PK from environment
        """
        self.private_key = private_key or settings.avantis_private_key
        if not self.private_key:
            raise ValueError("Private key is required. Set AVANTIS_PK environment variable or pass private_key parameter.")
        
        # Validate private key format
        if not self.private_key.startswith("0x"):
            self.private_key = f"0x{self.private_key}"
        
        # Get account from private key
        self.account = Account.from_key(self.private_key)
        self.address = self.account.address
        
        # Determine network based on settings
        is_testnet = settings.avantis_network == "base-testnet"
        
        # Initialize Web3 provider
        rpc_url = settings.avantis_rpc_url or self._get_default_rpc_url()
        self.web3 = Web3(Web3.HTTPProvider(rpc_url))
        
        if not self.web3.is_connected():
            raise ConnectionError(f"Failed to connect to RPC: {rpc_url}")
        
        # Initialize Avantis TraderClient
        # Note: Adjust initialization based on actual SDK API
        try:
            self.trader_client = TraderClient(
                private_key=self.private_key,
                network=settings.avantis_network,
                rpc_url=rpc_url
            )
        except Exception as e:
            raise ValueError(f"Failed to initialize Avantis TraderClient: {str(e)}")
    
    def _get_default_rpc_url(self) -> str:
        """Get default RPC URL based on network."""
        if settings.avantis_network == "base-testnet":
            return "https://sepolia.base.org"  # Base Sepolia testnet
        else:
            return "https://mainnet.base.org"  # Base mainnet
    
    def get_address(self) -> str:
        """Get Ethereum address from private key."""
        return self.address
    
    def get_client(self) -> TraderClient:
        """Get the underlying TraderClient instance."""
        return self.trader_client


# Global client instance (lazy initialization)
_client_instance: Optional[AvantisClient] = None


def get_avantis_client(private_key: Optional[str] = None) -> AvantisClient:
    """
    Get or create Avantis client instance.
    
    Args:
        private_key: Optional private key to use (creates new client)
        
    Returns:
        AvantisClient instance
    """
    global _client_instance
    
    if private_key:
        # Create new client with provided private key
        return AvantisClient(private_key=private_key)
    
    if _client_instance is None:
        _client_instance = AvantisClient()
    
    return _client_instance

