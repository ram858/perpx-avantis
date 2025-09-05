// symbols/updateSymbolRegistry.ts

import { PublicClient } from "@nktkas/hyperliquid";
import fs from "fs";
import path from "path";
import { publicClient } from "../hyperliquid";

async function updateSymbolRegistry() {
  try {
    const meta = await publicClient.meta();
    const universe = meta.universe;

    const registry: Record<string, { hl: string; binance: string }> = {};
    for (const asset of universe) {
      const upper = asset.name.toUpperCase();
      registry[upper] = {
        hl: asset.name,
        binance: `${upper}USDT`
      };
    }

    const filePath = path.join(__dirname, "symbolRegistry.json");
    fs.writeFileSync(filePath, JSON.stringify(registry, null, 2));
    console.log(`✅ symbolRegistry.json updated with ${Object.keys(registry).length} assets.`);
  } catch (err) {
    console.error("❌ Failed to fetch meta().universe:", err);
  }
}

updateSymbolRegistry();
