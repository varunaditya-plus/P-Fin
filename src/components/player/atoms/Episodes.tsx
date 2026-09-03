import { useEffect } from "react";
import { useTranslation } from "react-i18next";

import { Icons } from "@/components/Icon";
import { OverlayAnchor } from "@/components/overlays/OverlayAnchor";
import { VideoPlayerButton } from "@/components/player/internals/Button";
import { useOverlayRouter } from "@/hooks/useOverlayRouter";
import { usePlayerStore } from "@/stores/player/store";

export function Episodes() {
  const { t } = useTranslation();
  const router = useOverlayRouter("episodes");
  const setHasOpenOverlay = usePlayerStore((s) => s.setHasOpenOverlay);
  const type = usePlayerStore((s) => s.meta?.type);

  useEffect(() => {
    setHasOpenOverlay(router.isRouterActive);
  }, [setHasOpenOverlay, router.isRouterActive]);
  if (type !== "show") return null;

  return (
    <OverlayAnchor id={router.id}>
      <VideoPlayerButton
        onClick={() => router.open("/episodes")}
        icon={Icons.EPISODES}
      >
        {t("player.menus.episodes.button")}
      </VideoPlayerButton>
    </OverlayAnchor>
  );
}
