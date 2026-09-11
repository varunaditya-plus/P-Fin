import {
  JellyfinItem,
  JellyfinItems,
  getJellyfinSession,
  jellyfinRequest,
} from "@/backend/jellyfin/client";
import { homePreferenceScope } from "@/stores/jellyfin/home";

export function integrationIdentity() {
  const session = getJellyfinSession();
  return { scope: homePreferenceScope(session), token: session.accessToken };
}

export function requireIntegrationIdentity(
  identity: ReturnType<typeof integrationIdentity>,
) {
  const current = integrationIdentity();
  if (current.scope !== identity.scope || current.token !== identity.token)
    throw new Error("Your Jellyfin account changed. Start the import again.");
}

export async function integrationLibrary(types: string, signal?: AbortSignal) {
  const identity = integrationIdentity();
  const session = getJellyfinSession();
  const items = new Map<string, JellyfinItem>();
  let start = 0;
  while (true) {
    signal?.throwIfAborted();
    requireIntegrationIdentity(identity);
    const page = await jellyfinRequest<JellyfinItems>(
      `Users/${session.userId}/Items`,
      { signal },
      {
        Recursive: true,
        IncludeItemTypes: types,
        Fields: "ProviderIds,UserData",
        EnableImages: false,
        ExcludeLocationTypes: "Virtual",
        IsMissing: false,
        StartIndex: start,
        Limit: 500,
      },
    );
    page.Items.filter((item) => !item.IsMissing && !item.IsVirtualItem).forEach(
      (item) => items.set(item.Id, item),
    );
    start += page.Items.length;
    if (
      !page.Items.length ||
      start >= (page.TotalRecordCount ?? Infinity) ||
      page.Items.length < 500
    )
      break;
  }
  requireIntegrationIdentity(identity);
  return [...items.values()];
}

export function providerId(item: JellyfinItem, provider: string) {
  return Object.entries(item.ProviderIds ?? {}).find(
    ([key]) => key.toLowerCase() === provider.toLowerCase(),
  )?.[1];
}
