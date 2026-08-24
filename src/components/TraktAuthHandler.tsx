import { useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";

import { useTraktAuthStore } from "@/stores/trakt/store";
import { traktService } from "@/utils/trakt";

export function TraktAuthHandler() {
  const [searchParams, setSearchParams] = useSearchParams();
  const code = searchParams.get("code");
  const processedRef = useRef(false);
  const setStatus = useTraktAuthStore((s) => s.setStatus);
  const setError = useTraktAuthStore((s) => s.setError);

  useEffect(() => {
    if (!code || processedRef.current) return;
    processedRef.current = true;

    const exchange = async () => {
      setStatus("syncing");
      setError(null);
      try {
        const success = await traktService.exchangeCodeForToken(code);
        if (success) {
          const newParams = new URLSearchParams(searchParams);
          newParams.delete("code");
          setSearchParams(newParams, { replace: true });
        } else {
          setError("Failed to connect to Trakt");
        }
      } catch (err: any) {
        console.error("Trakt auth failed", err);
        setError(err?.message ?? "Failed to connect to Trakt");
      } finally {
        setStatus("idle");
      }
    };

    exchange();
  }, [code, searchParams, setSearchParams, setStatus, setError]);

  return null;
}
