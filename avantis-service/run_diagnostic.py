"""Run Avantis position diagnostic."""

import asyncio
import sys
import os

# Add your project directory to path if needed
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from check_pending_orders import full_diagnostic

async def main():
    # Replace these values
    PRIVATE_KEY = "0xab9c15526fc4e452fb4daf4a11b3a705734461781d6e5fb9a1de1961aceec29e"
    TX_HASH = "0x6d76f5c9d6f6183935195f7f72d890d3c7cdd9f653bb3d6a5cbdbf32c6d25fdf"  # Actual transaction hash from BaseScan
    
    print("Starting Avantis diagnostic...")
    print(f"Address: 0x1412C18d693bb2ab22aa7F18e6eCb0CFC7049ef4")
    if TX_HASH:
        print(f"Transaction: {TX_HASH}")
    print()
    
    await full_diagnostic(
        private_key=PRIVATE_KEY,
        tx_hash=TX_HASH
    )

if __name__ == "__main__":
    asyncio.run(main())

