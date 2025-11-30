# avantis-service/avantis_client.py
import logging
from typing import Optional

from eth_account import Account
from web3 import Web3

from config import settings

logger = logging.getLogger(__name__)


class AvantisClient:
    """
    Lightweight Web3-based client (no Avantis SDK).

    - With private_key: full read/write
    - With address only: read-only (for Base account, etc.)
    """

    def __init__(self, private_key: Optional[str] = None, address: Optional[str] = None):
        if not private_key and not address:
            raise ValueError("Either private_key or address must be provided")

        rpc_url = getattr(settings, "avantis_rpc_url", None) or "https://mainnet.base.org"
        self.web3 = Web3(Web3.HTTPProvider(rpc_url))
        self.chain_id = self.web3.eth.chain_id

        self.private_key: Optional[str] = None
        self.account: Optional[Account] = None
        self.address: str

        if private_key:
            if not private_key.startswith("0x"):
                private_key = f"0x{private_key}"
            self.private_key = private_key
            account = Account.from_key(private_key)
            self.account = account
            self.address = account.address
        else:
            # At this point, address cannot be None because we checked above
            assert address is not None, "address must be provided when private_key is None"
            if not Web3.is_address(address):
                raise ValueError(f"Invalid Ethereum address: {address}")
            self.address = Web3.to_checksum_address(address)

    # ---- Compat & helpers ------------------------------------------------

    def get_address(self) -> str:
        return self.address

    def has_signer(self) -> bool:
        return self.private_key is not None

    def get_web3(self) -> Web3:
        return self.web3

    # Backwards compatibility: some legacy code expects get_client()
    def get_client(self) -> "AvantisClient":
        return self


def get_avantis_client(private_key: Optional[str] = None, address: Optional[str] = None) -> AvantisClient:
    """
    Factory used throughout the codebase. Keep this name stable so callers don't break.
    """
    return AvantisClient(private_key=private_key, address=address)
