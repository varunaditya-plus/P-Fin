import { useCallback, useEffect, useRef, useState } from "react";
import { useInterval } from "react-use";

import { getPosterForMedia } from "@/backend/metadata/tmdb";
import { useBookmarkStore } from "@/stores/bookmarks";
import { useTraktAuthStore } from "@/stores/trakt/store";
import { traktService } from "@/utils/trakt";
import { TraktContentData } from "@/utils/traktTypes";

const TRAKT_SYNC_INTERVAL_MS = 5 * 60 * 1000; // 5 min
const INITIAL_SYNC_DELAY_MS = 2000; // Re-sync after backend restore
const QUEUE_RETRY_DELAY_MS = 5000; // Retry failed queue items after 5s

// Collections/groups sync disabled for now - bookmarks only sync to watchlist
// import { modifyBookmarks } from "@/utils/bookmarkModifications";
// import { TraktList } from "@/utils/traktTypes";
// function listId(list: TraktList): string {
//   return list.ids.slug ?? String(list.ids.trakt);
// }
// async function findListByName(
//   username: string,
//   groupName: string,
// ): Promise<TraktList | null> {
//   const lists = await traktService.getLists(username);
//   return lists.find((l) => l.name === groupName) ?? null;
// }
// async function ensureListExists(
//   username: string,
//   groupName: string,
// ): Promise<TraktList | null> {
//   const existing = await findListByName(username, groupName);
//   if (existing) return existing;
//   try {
//     return await traktService.createList(username, groupName);
//   } catch {
//     return null;
//   }
// }

export function TraktBookmarkSyncer() {
  const { traktUpdateQueue, removeTraktUpdateItem, replaceBookmarks } =
    useBookmarkStore();
  const { accessToken } = useTraktAuthStore();
  const isSyncingRef = useRef(false);
  const [hydrated, setHydrated] = useState(false);
  const [retryTrigger, setRetryTrigger] = useState(0);

  // Sync from Local to Trakt (only remove from queue after API success; retry on failure)
  useEffect(() => {
    if (!accessToken) return;

    let retryTimeoutId: ReturnType<typeof setTimeout> | undefined;

    const processQueue = async () => {
      const queue = [...traktUpdateQueue];
      if (queue.length === 0) return;

      for (const item of queue) {
        try {
          const contentData: TraktContentData = {
            title: item.title ?? "",
            year: item.year,
            tmdbId: item.tmdbId,
            type: (item.type === "movie" ? "movie" : "show") as
              | "movie"
              | "show"
              | "episode",
          };

          if (item.action === "add") {
            await traktService.addToWatchlist(contentData);
            // Collections sync disabled - bookmarks only sync to watchlist
            // if (hasLists) {
            //   const newGroups = item.group ?? [];
            //   const prevGroups = item.previousGroup ?? [];

            //   // Remove from Trakt lists that the bookmark no longer belongs to
            //   const groupsToRemove = prevGroups.filter(
            //     (g) => !newGroups.includes(g),
            //   );
            //   for (const groupName of groupsToRemove) {
            //     const list = await findListByName(slug!, groupName);
            //     if (list) {
            //       await traktService.removeFromList(slug!, listId(list), [
            //         contentData,
            //       ]);
            //     }
            //   }

            //   // Add to Trakt lists that are new
            //   const groupsToAdd = newGroups.filter(
            //     (g) => !prevGroups.includes(g),
            //   );
            //   for (const groupName of groupsToAdd) {
            //     const list = await ensureListExists(slug!, groupName);
            //     if (list) {
            //       await traktService.addToList(slug!, listId(list), [
            //         contentData,
            //       ]);
            //     }
            //   }
            // }
          } else if (item.action === "delete") {
            await traktService.removeFromWatchlist(contentData);
            // Collections sync disabled - bookmarks only sync to watchlist
            // if (hasLists && item.group?.length) {
            //   for (const groupName of item.group) {
            //     const list = await findListByName(slug!, groupName);
            //     if (list) {
            //       await traktService.removeFromList(slug!, listId(list), [
            //         contentData,
            //       ]);
            //     }
            //   }
            // }
          }

          removeTraktUpdateItem(item.id);
        } catch (error) {
          console.error("Failed to sync bookmark to Trakt", error);
          if (!retryTimeoutId) {
            retryTimeoutId = setTimeout(
              () => setRetryTrigger((n) => n + 1),
              QUEUE_RETRY_DELAY_MS,
            );
          }
        }
      }
    };

    processQueue();
    return () => {
      if (retryTimeoutId) clearTimeout(retryTimeoutId);
    };
  }, [accessToken, traktUpdateQueue, removeTraktUpdateItem, retryTrigger]);

  // Push local bookmarks to Trakt watchlist (TODO implement collections/groups sync)
  const syncBookmarksToTrakt = useCallback(async () => {
    if (!accessToken || isSyncingRef.current) return;
    // const slug = useTraktAuthStore.getState().user?.ids?.slug;
    // if (!slug) return;
    isSyncingRef.current = true;
    try {
      if (!useTraktAuthStore.getState().user) {
        await traktService.getUserProfile();
      }
      const bookmarks = useBookmarkStore.getState().bookmarks;

      for (const [tmdbId, b] of Object.entries(bookmarks)) {
        try {
          const contentData: TraktContentData = {
            tmdbId,
            title: b.title,
            year: b.year,
            type: b.type === "movie" ? "movie" : "show",
          };
          await traktService.addToWatchlist(contentData);
          // Collections sync disabled - bookmarks only sync to watchlist
          // if (b.group?.length) {
          //   for (const groupName of b.group) {
          //     const list = await ensureListExists(slug, groupName);
          //     if (list) {
          //       await traktService.addToList(slug, listId(list), [contentData]);
          //     }
          //   }
          // }
        } catch (err) {
          console.warn("Failed to push bookmark to Trakt:", tmdbId, err);
        }
      }
    } finally {
      isSyncingRef.current = false;
    }
  }, [accessToken]);

  const syncWatchlistFromTrakt = useCallback(async () => {
    if (!accessToken || isSyncingRef.current) return;
    isSyncingRef.current = true;
    try {
      if (!useTraktAuthStore.getState().user) {
        await traktService.getUserProfile();
      }
      const watchlist = await traktService.getWatchlist();
      const store = useBookmarkStore.getState();
      const merged = { ...store.bookmarks };

      for (const item of watchlist) {
        const type = item.movie ? "movie" : "show";
        const media = item.movie || item.show;
        if (!media) continue;

        const tmdbId = media.ids.tmdb?.toString();
        if (!tmdbId) continue;

        if (!merged[tmdbId]) {
          const poster = await getPosterForMedia(tmdbId, type);
          merged[tmdbId] = {
            type: type as "movie" | "show",
            title: media.title,
            year: media.year,
            poster,
            updatedAt: Date.now(),
          };
        }
      }

      replaceBookmarks(merged);

      // Collections sync disabled - only watchlist is synced, no Trakt lists
      // const slug = useTraktAuthStore.getState().user?.ids?.slug;
      // if (slug) {
      //   try {
      //     const lists = await traktService.getLists(slug);
      //     const currentBookmarks = useBookmarkStore.getState().bookmarks;
      //     let modifiedBookmarks = { ...currentBookmarks };

      //     for (const list of lists) {
      //       const listTitle = list.name;
      //       const items = await traktService.getListItems(slug, listId(list));
      //       for (const li of items) {
      //         const media = li.movie || li.show;
      //         if (!media?.ids?.tmdb) continue;

      //         const tmdbId = media.ids.tmdb.toString();
      //         const type = li.movie ? "movie" : "show";
      //         const bookmark = modifiedBookmarks[tmdbId];

      //         if (!bookmark) {
      //           const poster = await getPosterForMedia(tmdbId, type);
      //           modifiedBookmarks[tmdbId] = {
      //             type: type as "movie" | "show",
      //             title: media.title,
      //             year: media.year,
      //             poster,
      //             updatedAt: Date.now(),
      //             group: [listTitle],
      //           };
      //         } else {
      //           const groups = bookmark.group ?? [];
      //           if (!groups.includes(listTitle)) {
      //             const { modifiedBookmarks: next } = modifyBookmarks(
      //               modifiedBookmarks,
      //               [tmdbId],
      //               { addGroups: [listTitle] },
      //             );
      //             modifiedBookmarks = next;
      //           }
      //         }
      //       }
      //     }

      //     const hasNewBookmarks =
      //       Object.keys(modifiedBookmarks).length !==
      //       Object.keys(currentBookmarks).length;
      //     const hasGroupChanges = Object.keys(modifiedBookmarks).some(
      //       (id) =>
      //         JSON.stringify(modifiedBookmarks[id]?.group ?? []) !==
      //         JSON.stringify(currentBookmarks[id]?.group ?? []),
      //     );
      //     if (hasNewBookmarks || hasGroupChanges) {
      //       replaceBookmarks(modifiedBookmarks);
      //     }
      //   } catch (listError) {
      //     console.warn("Failed to sync Trakt lists (groups)", listError);
      //   }
      // }
    } catch (error) {
      console.error("Failed to sync Trakt watchlist to local", error);
    } finally {
      isSyncingRef.current = false;
    }
  }, [accessToken, replaceBookmarks]);

  const fullSync = useCallback(async () => {
    // Push local → Trakt first so our changes reach Trakt before we pull
    await syncBookmarksToTrakt();
    await syncWatchlistFromTrakt(); // Then pull Trakt → local, merge
  }, [syncWatchlistFromTrakt, syncBookmarksToTrakt]);

  // Wait for Trakt auth store to rehydrate from persist (accessToken may be null on first render)
  useEffect(() => {
    const check = () => {
      if (useTraktAuthStore.persist?.hasHydrated?.()) {
        setHydrated(true);
        return true;
      }
      return false;
    };
    if (check()) return;
    const unsub = useTraktAuthStore.persist?.onFinishHydration?.(() => {
      setHydrated(true);
    });
    const t = setTimeout(() => setHydrated(true), 500);
    return () => {
      unsub?.();
      clearTimeout(t);
    };
  }, []);

  // On mount (after hydration): full sync (push then pull)
  useEffect(() => {
    if (!hydrated || !accessToken) return;
    const t = setTimeout(fullSync, INITIAL_SYNC_DELAY_MS);
    return () => clearTimeout(t);
  }, [hydrated, accessToken, fullSync]);

  // Periodic full sync (pull + push)
  useInterval(fullSync, TRAKT_SYNC_INTERVAL_MS);

  return null;
}
