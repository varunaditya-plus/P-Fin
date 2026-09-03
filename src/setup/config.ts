interface RuntimeConfig {
  BANNER_MESSAGE: string | null;
  BANNER_ID: string | null;
}

/** Optional instance notices; service addresses come from server-config.json. */
export function conf(): RuntimeConfig {
  return {
    BANNER_MESSAGE: import.meta.env.VITE_BANNER_MESSAGE || null,
    BANNER_ID: import.meta.env.VITE_BANNER_ID || null,
  };
}
