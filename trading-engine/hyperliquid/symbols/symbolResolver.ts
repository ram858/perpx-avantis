import registry from './symbolRegistry.json';

export function resolveToHLName(symbol: string): string {
  const key = symbol.toUpperCase() as keyof typeof registry;
  return registry[key]?.hl ?? symbol;
}

export function resolveToBinancePair(symbol: string): string {
  const key = symbol.toUpperCase() as keyof typeof registry;
  return registry[key]?.binance ?? `${symbol.toUpperCase()}USDT`;
}

export function getAllKnownSymbols(): string[] {
  return Object.keys(registry);
}
