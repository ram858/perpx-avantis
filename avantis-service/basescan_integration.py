"""
BaseScan Integration Utility

This module provides utilities to:
1. Parse and analyze BaseScan transaction data
2. Extract contract call parameters from BaseScan examples
3. Validate our contract calls against BaseScan examples
4. Help integrate BaseScan transaction patterns into the trading platform
"""

import json
import logging
from typing import Any, Dict, List, Optional, Tuple
from dataclasses import dataclass

from web3 import Web3
from web3.types import HexBytes

from config import settings

logger = logging.getLogger(__name__)

# BaseScan API base URL
BASESCAN_API_BASE = "https://api.basescan.org/api"
BASESCAN_EXPLORER_BASE = "https://basescan.org"


@dataclass
class BaseScanTransaction:
    """Parsed BaseScan transaction data."""
    tx_hash: str
    block_number: int
    from_address: str
    to_address: str
    value: int
    gas_used: int
    gas_price: int
    input_data: str
    function_name: Optional[str] = None
    function_params: Optional[Dict[str, Any]] = None
    status: Optional[str] = None


@dataclass
class BaseScanContractCall:
    """Parsed contract call from BaseScan transaction."""
    contract_address: str
    function_signature: str
    function_name: Optional[str]
    parameters: Dict[str, Any]
    decoded: bool


class BaseScanParser:
    """Parser for BaseScan transaction data."""

    def __init__(self, rpc_url: Optional[str] = None):
        self.rpc_url = rpc_url or getattr(settings, "avantis_rpc_url", None) or "https://mainnet.base.org"
        self.web3 = Web3(Web3.HTTPProvider(self.rpc_url))
        if not self.web3.is_connected():
            raise RuntimeError(f"Web3 provider not reachable: {self.rpc_url}")

    def parse_transaction_hash(self, tx_hash: str) -> BaseScanTransaction:
        """
        Parse a transaction hash from BaseScan.
        
        Args:
            tx_hash: Transaction hash (with or without 0x prefix)
            
        Returns:
            BaseScanTransaction object with parsed data
        """
        if not tx_hash.startswith("0x"):
            tx_hash = f"0x{tx_hash}"
        
        tx_hash_bytes = HexBytes(tx_hash) if isinstance(tx_hash, str) else tx_hash
        
        try:
            tx = self.web3.eth.get_transaction(tx_hash_bytes)
            receipt = self.web3.eth.get_transaction_receipt(tx_hash_bytes)
            
            return BaseScanTransaction(
                tx_hash=tx_hash,
                block_number=receipt.get("blockNumber", 0),
                from_address=tx.get("from", ""),
                to_address=tx.get("to", ""),
                value=int(tx.get("value", 0)),
                gas_used=int(receipt.get("gasUsed", 0)),
                gas_price=int(tx.get("gasPrice", 0)),
                input_data=tx.get("input", "0x"),
                status="success" if receipt.get("status") == 1 else "failed",
            )
        except Exception as e:
            logger.error(f"Failed to parse transaction {tx_hash}: {e}")
            raise

    def decode_contract_call(
        self,
        contract_address: str,
        input_data: str,
        abi: Optional[List[Dict[str, Any]]] = None,
    ) -> BaseScanContractCall:
        """
        Decode a contract call from transaction input data.
        
        Args:
            contract_address: Contract address
            input_data: Transaction input data (hex string)
            abi: Optional ABI for decoding (uses Trading ABI if not provided)
            
        Returns:
            BaseScanContractCall with decoded parameters
        """
        if not input_data or input_data == "0x":
            return BaseScanContractCall(
                contract_address=contract_address,
                function_signature="",
                function_name=None,
                parameters={},
                decoded=False,
            )

        try:
            # Load ABI if not provided
            if abi is None:
                import os
                abi_path = os.path.join(
                    os.path.dirname(__file__), "contracts", "trading_abi.json"
                )
                if os.path.exists(abi_path):
                    with open(abi_path, "r") as f:
                        abi = json.load(f)
                else:
                    abi = []

            contract = self.web3.eth.contract(
                address=Web3.to_checksum_address(contract_address),
                abi=abi,
            )

            # Decode function call
            func_obj, func_params = contract.decode_function_input(input_data)

            return BaseScanContractCall(
                contract_address=contract_address,
                function_signature=func_obj.fn_name,
                function_name=func_obj.fn_name,
                parameters=func_params,
                decoded=True,
            )
        except Exception as e:
            logger.warning(f"Failed to decode contract call: {e}")
            # Return partial data with function signature
            func_sig = input_data[:10] if len(input_data) >= 10 else input_data
            return BaseScanContractCall(
                contract_address=contract_address,
                function_signature=func_sig,
                function_name=None,
                parameters={},
                decoded=False,
            )

    def analyze_trading_transaction(
        self, tx_hash: str
    ) -> Dict[str, Any]:
        """
        Analyze a trading transaction from BaseScan.
        Extracts all relevant information for integration.
        
        Args:
            tx_hash: Transaction hash from BaseScan
            
        Returns:
            Dictionary with analysis results
        """
        tx = self.parse_transaction_hash(tx_hash)
        
        result = {
            "tx_hash": tx.tx_hash,
            "block_number": tx.block_number,
            "from": tx.from_address,
            "to": tx.to_address,
            "value_wei": tx.value,
            "value_eth": float(tx.value) / 1e18,
            "gas_used": tx.gas_used,
            "gas_price": tx.gas_price,
            "status": tx.status,
            "basescan_url": f"{BASESCAN_EXPLORER_BASE}/tx/{tx_hash}",
            "function_calls": [],
        }

        # Check if this is a call to Avantis Trading contract
        trading_contract = settings.avantis_trading_contract_address
        if tx.to_address and tx.to_address.lower() == trading_contract.lower():
            call = self.decode_contract_call(trading_contract, tx.input_data)
            result["function_calls"].append({
                "contract": trading_contract,
                "function": call.function_name or call.function_signature,
                "parameters": call.parameters,
                "decoded": call.decoded,
            })
            
            # Extract specific trading parameters if available
            if call.decoded and call.parameters:
                result["trading_params"] = self._extract_trading_params(call.parameters)

        return result

    def _extract_trading_params(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """Extract human-readable trading parameters from decoded function params."""
        extracted = {}
        
        # openTrade parameters
        if "t" in params:  # Trade struct
            trade = params["t"]
            extracted["pair_index"] = int(trade.get("pairIndex", 0))
            extracted["collateral_usdc"] = float(trade.get("positionSizeUSDC", 0)) / 1e6
            extracted["leverage"] = int(trade.get("leverage", 0))
            extracted["is_long"] = bool(trade.get("buy", False))
            extracted["open_price"] = float(trade.get("openPrice", 0)) / 1e10 if trade.get("openPrice", 0) > 0 else 0
            extracted["tp"] = float(trade.get("tp", 0)) / 1e10 if trade.get("tp", 0) > 0 else 0
            extracted["sl"] = float(trade.get("sl", 0)) / 1e10 if trade.get("sl", 0) > 0 else 0
        
        if "_type" in params:
            extracted["order_type"] = int(params["_type"])
        
        if "_slippageP" in params:
            extracted["slippage_percentage"] = float(params["_slippageP"]) / 1e8
        
        # closeTradeMarket parameters
        if "_pairIndex" in params:
            extracted["pair_index"] = int(params["_pairIndex"])
        if "_index" in params:
            extracted["trade_index"] = int(params["_index"])
        if "_amount" in params:
            extracted["close_amount_usdc"] = float(params["_amount"]) / 1e6
        
        # updateTpAndSl parameters
        if "_newTp" in params:
            extracted["new_tp"] = float(params["_newTp"]) / 1e10 if params["_newTp"] > 0 else 0
        if "_newSl" in params:
            extracted["new_sl"] = float(params["_newSl"]) / 1e10 if params["_newSl"] > 0 else 0
        
        return extracted

    def compare_with_our_implementation(
        self,
        basescan_tx_hash: str,
        our_params: Dict[str, Any],
    ) -> Dict[str, Any]:
        """
        Compare BaseScan transaction with our implementation parameters.
        Useful for validating our contract calls match real BaseScan examples.
        
        Args:
            basescan_tx_hash: Transaction hash from BaseScan
            our_params: Our implementation parameters (from contract_operations)
            
        Returns:
            Comparison results
        """
        analysis = self.analyze_trading_transaction(basescan_tx_hash)
        
        comparison = {
            "basescan_tx": analysis,
            "our_params": our_params,
            "matches": {},
            "differences": [],
        }
        
        if "trading_params" in analysis:
            bs_params = analysis["trading_params"]
            
            # Compare key parameters
            for key in ["pair_index", "leverage", "is_long", "collateral_usdc"]:
                if key in bs_params and key in our_params:
                    bs_val = bs_params[key]
                    our_val = our_params[key]
                    
                    # Allow small floating point differences
                    if isinstance(bs_val, float) and isinstance(our_val, float):
                        match = abs(bs_val - our_val) < 0.01
                    else:
                        match = bs_val == our_val
                    
                    comparison["matches"][key] = match
                    if not match:
                        comparison["differences"].append({
                            "parameter": key,
                            "basescan": bs_val,
                            "ours": our_val,
                        })
        
        return comparison

    def generate_contract_call_from_basescan(
        self,
        tx_hash: str,
    ) -> Dict[str, Any]:
        """
        Generate a contract call configuration from a BaseScan transaction.
        This can be used to replicate the exact call from BaseScan.
        
        Args:
            tx_hash: Transaction hash from BaseScan
            
        Returns:
            Dictionary with contract call configuration
        """
        analysis = self.analyze_trading_transaction(tx_hash)
        
        if not analysis.get("function_calls"):
            raise ValueError("No function calls found in transaction")
        
        call = analysis["function_calls"][0]
        
        config = {
            "contract_address": call["contract"],
            "function_name": call["function"],
            "parameters": call["parameters"],
            "value_wei": analysis["value_wei"],
            "gas_limit": analysis["gas_used"] * 2,  # Use 2x for safety
            "gas_price": analysis["gas_price"],
        }
        
        return config


def validate_against_basescan_example(
    basescan_tx_hash: str,
    our_function_call: Dict[str, Any],
) -> Tuple[bool, List[str]]:
    """
    Validate our function call against a BaseScan example.
    
    Args:
        basescan_tx_hash: Transaction hash from BaseScan
        our_function_call: Our function call configuration
        
    Returns:
        Tuple of (is_valid, list_of_warnings)
    """
    parser = BaseScanParser()
    comparison = parser.compare_with_our_implementation(
        basescan_tx_hash,
        our_function_call,
    )
    
    warnings = []
    is_valid = True
    
    if comparison["differences"]:
        is_valid = False
        for diff in comparison["differences"]:
            warnings.append(
                f"Parameter '{diff['parameter']}' differs: "
                f"BaseScan={diff['basescan']}, Ours={diff['ours']}"
            )
    
    return is_valid, warnings


def get_basescan_link(tx_hash: str) -> str:
    """Get BaseScan explorer link for a transaction."""
    if not tx_hash.startswith("0x"):
        tx_hash = f"0x{tx_hash}"
    return f"{BASESCAN_EXPLORER_BASE}/tx/{tx_hash}"


def get_basescan_contract_link(contract_address: str) -> str:
    """Get BaseScan explorer link for a contract."""
    return f"{BASESCAN_EXPLORER_BASE}/address/{contract_address}"


# Example usage functions
async def analyze_basescan_example(tx_hash: str) -> None:
    """
    Analyze a BaseScan transaction example and print results.
    Useful for understanding how transactions are structured on BaseScan.
    """
    parser = BaseScanParser()
    analysis = parser.analyze_trading_transaction(tx_hash)
    
    print("\n" + "=" * 80)
    print("BaseScan Transaction Analysis")
    print("=" * 80)
    print(f"Transaction Hash: {analysis['tx_hash']}")
    print(f"Status: {analysis['status']}")
    print(f"Block: {analysis['block_number']}")
    print(f"From: {analysis['from']}")
    print(f"To: {analysis['to']}")
    print(f"Value: {analysis['value_eth']:.6f} ETH ({analysis['value_wei']} wei)")
    print(f"Gas Used: {analysis['gas_used']:,}")
    print(f"\nBaseScan Link: {analysis['basescan_url']}")
    
    if analysis.get("function_calls"):
        print("\nFunction Calls:")
        for call in analysis["function_calls"]:
            print(f"  Contract: {call['contract']}")
            print(f"  Function: {call['function']}")
            if call["decoded"]:
                print("  Parameters:")
                for key, value in call["parameters"].items():
                    print(f"    {key}: {value}")
    
    if analysis.get("trading_params"):
        print("\nTrading Parameters:")
        for key, value in analysis["trading_params"].items():
            print(f"  {key}: {value}")
    
    print("=" * 80 + "\n")


if __name__ == "__main__":
    import asyncio
    
    # Example: Analyze a transaction from BaseScan
    # Replace with actual BaseScan transaction hash
    example_tx = "0x6d76f5c9d6f6183935195f7f72d890d3c7cdd9f653bb3d6a5cbdbf32c6d25fdf"
    
    asyncio.run(analyze_basescan_example(example_tx))
