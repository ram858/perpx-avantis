# Avantis Service Setup Notes

## ⚠️ Important Notes

### SDK Integration
The code structure assumes the Avantis SDK has the following interface:
- `TraderClient(private_key, network, rpc_url)` - Client initialization
- `trader_client.open_position(pair_index, collateral_amount, leverage, is_long, take_profit, stop_loss)`
- `trader_client.close_position(pair_index)`
- `trader_client.close_all_positions()`
- `trader_client.get_positions()`
- `trader_client.get_balance()`
- `trader_client.get_usdc_allowance()`
- `trader_client.approve_usdc(amount)`

**You will need to adjust these method calls based on the actual Avantis SDK API.**

### Symbol Registry
The symbol registry in `symbols/symbol_registry.py` contains placeholder pair indices (0-15). 

**You need to:**
1. Fetch actual pair indices from Avantis API or documentation
2. Update `SYMBOL_TO_PAIR_INDEX` dictionary with real values
3. Or implement a dynamic lookup function that queries Avantis for available pairs

### USDC Token Addresses
- **Base Mainnet**: `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`
- **Base Testnet**: `0x036CbD53842c5426634e7929541eC2318f3dCF7e`

These are configured in `config.py` and should be verified.

### Environment Variables
Create a `.env` file based on `.env.example`:
```bash
AVANTIS_NETWORK=base-testnet
AVANTIS_PK=0x_your_private_key_here
AVANTIS_RPC_URL=https://sepolia.base.org
```

### Testing the Service

1. **Start the service:**
   ```bash
   python main.py
   # Or with uvicorn:
   uvicorn main:app --host 0.0.0.0 --port 8000 --reload
   ```

2. **Test health endpoint:**
   ```bash
   curl http://localhost:8000/health
   ```

3. **Test with Docker:**
   ```bash
   docker-compose up -d
   ```

### Next Steps

1. Install actual Avantis SDK: `pip install avantis-trader-sdk`
2. Review Avantis SDK documentation for actual API
3. Update `avantis_client.py` with correct SDK initialization
4. Update `trade_operations.py` and `position_queries.py` with actual SDK method calls
5. Fetch and update symbol registry with real pair indices
6. Test with testnet credentials
7. Integrate with TypeScript client (Phase 2)

