"""Core Avantis SDK client wrapper."""
import os
from typing import Optional
from avantis_trader_sdk import TraderClient  # Adjust import based on actual SDK
from avantis_trader_sdk.signers.local_signer import LocalSigner
from web3 import Web3
from web3 import AsyncWeb3
from eth_account import Account
from config import settings


class AvantisClient:
    """Wrapper for Avantis TraderClient.
    
    Supports two modes:
    1. With private key: Full read/write operations (traditional wallets)
    2. Address-only: Read-only operations (Base Accounts - no private key)
    """
    
    def __init__(self, private_key: Optional[str] = None, address: Optional[str] = None):
        """
        Initialize Avantis client for a user.
        
        Args:
            private_key: User's Ethereum private key (for traditional wallets)
                        Required for write operations, optional for read-only
            address: User's Ethereum address (for Base Accounts)
                    Required for read-only operations when no private key
        """
        # Validate inputs
        if not private_key and not address:
            raise ValueError(
                "Either private_key (for traditional wallets) or address (for Base Accounts) must be provided."
            )
        
        self.private_key = private_key
        self.is_base_account = not private_key and address is not None
        
        # Get address
        if private_key:
            # Validate private key format
            if not private_key.startswith("0x"):
                self.private_key = f"0x{private_key}"
            else:
                self.private_key = private_key
            
            # Get account from private key
            self.account = Account.from_key(self.private_key)
            self.address = self.account.address
        else:
            # Base Account mode - use provided address
            if not address:
                raise ValueError("Address is required when private_key is not provided")
            if not address.startswith("0x"):
                self.address = f"0x{address}"
            else:
                self.address = address
            self.account = None
        
        # Initialize Web3 provider
        rpc_url = settings.avantis_rpc_url or self._get_default_rpc_url()
        self.web3 = Web3(Web3.HTTPProvider(rpc_url))
        
        if not self.web3.is_connected():
            raise ConnectionError(f"Failed to connect to RPC: {rpc_url}")
        
        # Initialize async Web3
        async_web3 = AsyncWeb3(AsyncWeb3.AsyncHTTPProvider(rpc_url))
        
        # Initialize Avantis TraderClient
        try:
            if self.private_key:
                # Traditional wallet: create signer
                signer = LocalSigner(private_key=self.private_key, async_web3=async_web3)
                self.trader_client = TraderClient(
                    provider_url=rpc_url,
                    signer=signer
                )
            else:
                # Base Account: initialize without signer (read-only mode)
                # Note: TraderClient may require a signer, so we create a dummy signer or handle differently
                # For now, try to initialize without signer, or create a read-only client
                # This depends on TraderClient implementation
                try:
                    # Try without signer first
                    self.trader_client = TraderClient(provider_url=rpc_url)
                except TypeError:
                    # If signer is required, we may need to handle this differently
                    # For Base Accounts, read operations should work via contract calls with address
                    raise ValueError(
                        "TraderClient requires a signer. For Base Accounts, use address-based read operations only."
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
        """Get Ethereum address."""
        return self.address
    
    def get_client(self) -> TraderClient:
        """Get the underlying TraderClient instance."""
        return self.trader_client
    
    def can_write(self) -> bool:
        """Check if client can perform write operations (has private key)."""
        return self.private_key is not None


def get_avantis_client(
    private_key: Optional[str] = None,
    address: Optional[str] = None
) -> AvantisClient:
    """
    Create Avantis client instance for a user.
    
    Args:
        private_key: User's private key (for traditional wallets - enables write operations)
        address: User's address (for Base Accounts - read-only operations)
        
    Returns:
        AvantisClient instance
        
    Note:
        - For Base Accounts: provide address only (read-only operations)
        - For traditional wallets: provide private_key (full read/write operations)
        - For write operations with Base Accounts, use transaction preparation endpoints
    """
    return AvantisClient(private_key=private_key, address=address)

