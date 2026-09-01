import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import { findItemByProviderId } from "@/backend/jellyfin/client";
import { SeerrMedia } from "@/backend/seerr/types";
import { Icon, Icons } from "@/components/Icon";
import {
  ContextMenuDivider,
  ContextMenuItem,
} from "@/components/utils/ContextMenu";

export function SeerrCardMenu({
  media,
  onShowDetails,
  close,
}: {
  media: SeerrMedia;
  onShowDetails: (item: SeerrMedia) => void;
  close: () => void;
}) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  const details = () => {
    close();
    onShowDetails(media);
  };
  const available = [4, 5].includes(media.mediaInfo?.status ?? 0);
  const openLibrary = async () => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const item = await findItemByProviderId(media.id, media.mediaType);
      if (!active.current) return;
      if (!item)
        throw new Error(
          "This title is not available to your Jellyfin account.",
        );
      close();
      navigate(`/?item=${encodeURIComponent(item.Id)}`);
    } catch (reason) {
      if (active.current)
        setError(
          reason instanceof Error
            ? reason.message
            : "Could not open your library.",
        );
    } finally {
      if (active.current) setBusy(false);
    }
  };
  return (
    <>
      <ContextMenuItem onClick={details}>
        <Icon icon={Icons.CIRCLE_EXCLAMATION} className="text-lg w-5" />
        <span className="flex-1">More info</span>
      </ContextMenuItem>
      <ContextMenuDivider />
      {available ? (
        <ContextMenuItem disabled={busy} onClick={openLibrary}>
          <Icon icon={Icons.PLAY} className="text-lg w-5" />
          <span className="flex-1">Open in library</span>
        </ContextMenuItem>
      ) : null}
      <ContextMenuItem onClick={details}>
        <Icon icon={Icons.PLUS} className="text-lg w-5" />
        <span className="flex-1">
          {(media.mediaInfo?.status ?? 0) > 1
            ? "View request options"
            : "Request content"}
        </span>
      </ContextMenuItem>
      {busy ? (
        <p role="status" className="px-4 py-2 text-xs text-white/50">
          Finding this title…
        </p>
      ) : null}
      {error ? (
        <p
          role="alert"
          className="max-w-[260px] px-4 py-2 text-xs text-red-400"
        >
          {error}
        </p>
      ) : null}
    </>
  );
}
