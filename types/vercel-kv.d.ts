declare module '@vercel/kv' {
  // Minimal declaration to satisfy optional dynamic import.
  export const kv: {
    set: (key: string, value: string) => Promise<void>;
    get: (key: string) => Promise<string | null>;
    del: (key: string) => Promise<void>;
  };
}

