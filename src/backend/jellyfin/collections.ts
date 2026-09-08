import {
  JellyfinItem,
  JellyfinItems,
  getJellyfinSession,
  jellyfinRequest,
} from "@/backend/jellyfin/client";
import {
  addContentToContainer,
  getContentPolicy,
  getPlaylistEditPermission,
  removeContentFromContainer,
} from "@/backend/jellyfin/content";

export type ContainerType = "BoxSet" | "Playlist";
export const libraryDragType = "application/x-moviefin-library-items";

function identity() {
  const session = getJellyfinSession();
  return JSON.stringify([
    session.serverUrl,
    session.userId,
    session.accessToken,
  ]);
}

function requireSameAccount(captured: string) {
  if (identity() !== captured)
    throw new Error("Your Jellyfin account changed. Open the library again.");
}

async function requireContainerPermission(type: ContainerType, id?: string) {
  if (type === "BoxSet") {
    const policy = await getContentPolicy();
    if (!policy.IsAdministrator && !policy.EnableCollectionManagement)
      throw new Error("Your Jellyfin account cannot manage collections.");
  } else if (id && !(await getPlaylistEditPermission(id)).CanEdit) {
    throw new Error("You cannot edit this playlist.");
  }
}

export function parseLibraryDrop(value: string): string[] {
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed) || parsed.length > 200) return [];
    return [
      ...new Set(
        parsed.filter(
          (id): id is string =>
            typeof id === "string" && /^[a-f\d]{32}$/i.test(id),
        ),
      ),
    ];
  } catch {
    return [];
  }
}

export async function getContainerItemIds(
  type: ContainerType,
  id: string,
  signal?: AbortSignal,
) {
  const captured = identity();
  const session = getJellyfinSession();
  const ids = new Set<string>();
  let start = 0;
  while (!signal?.aborted) {
    signal?.throwIfAborted();
    requireSameAccount(captured);
    const page = await jellyfinRequest<JellyfinItems>(
      type === "Playlist"
        ? `Playlists/${encodeURIComponent(id)}/Items`
        : `Users/${session.userId}/Items`,
      { signal },
      {
        UserId: session.userId,
        ParentId: type === "BoxSet" ? id : undefined,
        Recursive: false,
        StartIndex: start,
        Limit: 200,
        EnableImages: false,
        EnableUserData: false,
      },
    );
    page.Items.forEach((item) => ids.add(item.Id));
    start += page.Items.length;
    if (
      !page.Items.length ||
      start >= (page.TotalRecordCount ?? Infinity) ||
      page.Items.length < 200
    )
      break;
  }
  signal?.throwIfAborted();
  requireSameAccount(captured);
  return ids;
}

export async function createEmptyContainer(type: ContainerType, name: string) {
  if (!name.trim()) throw new Error("Enter a name.");
  const captured = identity();
  await requireContainerPermission(type);
  requireSameAccount(captured);
  return type === "BoxSet"
    ? jellyfinRequest<{ Id: string }>(
        "Collections",
        { method: "POST" },
        { name: name.trim(), isLocked: false },
      )
    : jellyfinRequest<{ Id: string }>("Playlists", {
        method: "POST",
        body: JSON.stringify({
          Name: name.trim(),
          Ids: [],
          UserId: getJellyfinSession().userId,
          MediaType: "Video",
          IsPublic: false,
        }),
      });
}

export async function addUniqueContainerItems(
  type: ContainerType,
  id: string,
  requestedIds: string[],
) {
  const captured = identity();
  await requireContainerPermission(type, id);
  requireSameAccount(captured);
  const existing = await getContainerItemIds(type, id);
  const ids = [...new Set(requestedIds)].filter(
    (itemId) => itemId !== id && !existing.has(itemId),
  );
  if (!ids.length) return 0;
  requireSameAccount(captured);
  await addContentToContainer(type, id, ids.join(","));
  return ids.length;
}

export async function getCollectionMemberships(
  itemId: string,
  collections: JellyfinItem[],
  signal?: AbortSignal,
) {
  const memberships: string[] = [];
  // Bound requests for accounts with large collection lists.
  for (let offset = 0; offset < collections.length; offset += 4) {
    const chunk = collections.slice(offset, offset + 4);
    const matches = await Promise.all(
      chunk.map(async (collection) =>
        (await getContainerItemIds("BoxSet", collection.Id, signal)).has(itemId)
          ? collection.Id
          : undefined,
      ),
    );
    memberships.push(...matches.filter((id): id is string => Boolean(id)));
  }
  return memberships;
}

export async function saveCollectionMemberships(
  itemId: string,
  previous: string[],
  next: string[],
) {
  const captured = identity();
  await requireContainerPermission("BoxSet");
  const additions = [...new Set(next)].filter(
    (id) => !previous.includes(id) && id !== itemId,
  );
  const removals = [...new Set(previous)].filter((id) => !next.includes(id));
  for (const id of additions) {
    requireSameAccount(captured);
    await addUniqueContainerItems("BoxSet", id, [itemId]);
  }
  for (const id of removals) {
    requireSameAccount(captured);
    await removeContentFromContainer("BoxSet", id, itemId);
  }
}

export async function getContainerPresentation(
  type: ContainerType,
  id: string,
  signal?: AbortSignal,
) {
  const page = await jellyfinRequest<JellyfinItems>(
    type === "Playlist"
      ? `Playlists/${encodeURIComponent(id)}/Items`
      : `Users/${getJellyfinSession().userId}/Items`,
    { signal },
    {
      UserId: getJellyfinSession().userId,
      ParentId: type === "BoxSet" ? id : undefined,
      Recursive: false,
      StartIndex: 0,
      Limit: 4,
      Fields: "PrimaryImageAspectRatio",
      EnableUserData: false,
    },
  );
  return {
    count: page.TotalRecordCount ?? page.Items.length,
    items: page.Items.filter((item) => !item.IsMissing && !item.IsVirtualItem),
  };
}
