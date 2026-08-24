import { ofetch } from "ofetch";
import slugify from "slugify";

import { conf } from "@/setup/config";
import { useTraktAuthStore } from "@/stores/trakt/store";
import {
  TraktContentData,
  TraktHistoryItem,
  TraktList,
  TraktListItem,
  TraktScrobbleResponse,
  TraktUser,
  TraktWatchedItem,
  TraktWatchlistItem,
} from "@/utils/traktTypes";

// Storage keys
export const TRAKT_API_URL = "https://api.trakt.tv";

export class TraktService {
  // eslint-disable-next-line no-use-before-define -- self-reference for singleton
  private static instance: TraktService;

  private readonly MIN_API_INTERVAL = 500;

  private lastApiCall: number = 0;

  private requestQueue: Array<() => Promise<any>> = [];

  private isProcessingQueue: boolean = false;

  public static getInstance(): TraktService {
    if (!TraktService.instance) {
      TraktService.instance = new TraktService();
    }
    return TraktService.instance;
  }

  // eslint-disable-next-line class-methods-use-this -- part of instance API
  public getAuthUrl(): string {
    const config = conf();
    if (!config.TRAKT_CLIENT_ID || !config.TRAKT_REDIRECT_URI) return "";
    return `${TRAKT_API_URL}/oauth/authorize?response_type=code&client_id=${
      config.TRAKT_CLIENT_ID
    }&redirect_uri=${encodeURIComponent(config.TRAKT_REDIRECT_URI)}`;
  }

  public async exchangeCodeForToken(code: string): Promise<boolean> {
    const config = conf();
    if (
      !config.TRAKT_CLIENT_ID ||
      !config.TRAKT_CLIENT_SECRET ||
      !config.TRAKT_REDIRECT_URI
    )
      throw new Error("Missing Trakt config");

    try {
      const data = await ofetch(`${TRAKT_API_URL}/oauth/token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: {
          code,
          client_id: config.TRAKT_CLIENT_ID,
          client_secret: config.TRAKT_CLIENT_SECRET,
          redirect_uri: config.TRAKT_REDIRECT_URI,
          grant_type: "authorization_code",
        },
      });

      const expiresAt = Date.now() + data.expires_in * 1000;
      useTraktAuthStore
        .getState()
        .setTokens(data.access_token, data.refresh_token, expiresAt);

      // Fetch user profile immediately
      await this.getUserProfile();

      return true;
    } catch (error: any) {
      const msg =
        error?.data?.message ?? error?.message ?? "Failed to exchange code";
      const status = error?.response?.status;
      console.error(
        "[TraktService] Failed to exchange code:",
        status ? `${status} - ${msg}` : msg,
      );
      throw new Error(msg);
    }
  }

  // eslint-disable-next-line class-methods-use-this -- called as this.refreshToken from apiRequest
  public async refreshToken(): Promise<void> {
    const config = conf();
    const { refreshToken } = useTraktAuthStore.getState();
    if (
      !refreshToken ||
      !config.TRAKT_CLIENT_ID ||
      !config.TRAKT_CLIENT_SECRET ||
      !config.TRAKT_REDIRECT_URI
    )
      throw new Error("Missing refresh token or config");

    try {
      const data = await ofetch(`${TRAKT_API_URL}/oauth/token`, {
        method: "POST",
        body: {
          refresh_token: refreshToken,
          client_id: config.TRAKT_CLIENT_ID,
          client_secret: config.TRAKT_CLIENT_SECRET,
          redirect_uri: config.TRAKT_REDIRECT_URI,
          grant_type: "refresh_token",
        },
      });

      const expiresAt = Date.now() + data.expires_in * 1000;
      useTraktAuthStore
        .getState()
        .setTokens(data.access_token, data.refresh_token, expiresAt);
    } catch (error: any) {
      const msg =
        error?.data?.message ?? error?.message ?? "Failed to refresh token";
      const status = error?.response?.status;
      console.error(
        "[TraktService] Failed to refresh token:",
        status ? `${status} - ${msg}` : msg,
      );
      useTraktAuthStore.getState().clear();
      throw error;
    }
  }

  private async apiRequest<T>(
    endpoint: string,
    method: "GET" | "POST" | "PUT" | "DELETE" = "GET",
    body: any = undefined,
    retryCount = 0,
  ): Promise<T> {
    const config = conf();
    const { expiresAt } = useTraktAuthStore.getState();

    if (!config.TRAKT_CLIENT_ID) throw new Error("Missing Trakt Client ID");

    // Rate limiting
    const now = Date.now();
    const timeSinceLastCall = now - this.lastApiCall;
    if (timeSinceLastCall < this.MIN_API_INTERVAL) {
      await new Promise((resolve) => {
        setTimeout(resolve, this.MIN_API_INTERVAL - timeSinceLastCall);
      });
    }
    this.lastApiCall = Date.now();

    // Refresh token if needed
    if (expiresAt && expiresAt < Date.now() + 60000) {
      await this.refreshToken();
    }
    // Get fresh token after potential refresh
    const freshAccessToken = useTraktAuthStore.getState().accessToken;

    if (!freshAccessToken) throw new Error("Not authenticated");

    try {
      const response = await ofetch(`${TRAKT_API_URL}${endpoint}`, {
        method,
        headers: {
          "Content-Type": "application/json",
          "trakt-api-version": "2",
          "trakt-api-key": config.TRAKT_CLIENT_ID,
          Authorization: `Bearer ${freshAccessToken}`,
        },
        body,
        retry: 0, // We handle retries manually for 429
      });
      return response as T;
    } catch (error: any) {
      if (error.response?.status === 429 && retryCount < 3) {
        const retryAfter = error.response.headers.get("Retry-After");
        const delay = retryAfter
          ? parseInt(retryAfter, 10) * 1000
          : 1000 * 2 ** retryCount;
        await new Promise((resolve) => {
          setTimeout(resolve, delay);
        });
        return this.apiRequest<T>(endpoint, method, body, retryCount + 1);
      }

      // Handle 404 (Not Found) gracefully
      if (error.response?.status === 404) {
        console.warn(`[TraktService] 404 Not Found: ${endpoint}`);
        throw error;
      }

      // Handle 409 (Conflict) - usually means already scrobbled/watched
      if (error.response?.status === 409) {
        console.warn(`[TraktService] 409 Conflict: ${endpoint}`);
        return error.response._data; // Return the data anyway
      }

      throw error;
    }
  }

  private async queueRequest<T>(request: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.requestQueue.push(async () => {
        try {
          const result = await request();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
      this.processQueue();
    });
  }

  private async processQueue() {
    if (this.isProcessingQueue) return;
    this.isProcessingQueue = true;

    while (this.requestQueue.length > 0) {
      const request = this.requestQueue.shift();
      if (request) {
        await request();
        // Minimum interval between requests in queue
        if (this.requestQueue.length > 0) {
          await new Promise((resolve) => {
            setTimeout(resolve, this.MIN_API_INTERVAL);
          });
        }
      }
    }

    this.isProcessingQueue = false;
  }

  // User Profile
  public async getUserProfile(): Promise<TraktUser> {
    const profile = await this.apiRequest<TraktUser>(
      "/users/me?extended=full,images",
    );
    useTraktAuthStore.getState().setUser(profile);
    return profile;
  }

  // Watchlist - fetch movies and shows separately for reliability
  public async getWatchlist(): Promise<TraktWatchlistItem[]> {
    const limit = 100;
    const q = `extended=full,images`;
    const allItems: TraktWatchlistItem[] = [];

    for (const type of ["movies", "shows"] as const) {
      for (let page = 1; ; page += 1) {
        const results = await this.apiRequest<TraktWatchlistItem[]>(
          `/sync/watchlist/${type}/rank/asc?${q}&page=${page}&limit=${limit}`,
        );
        allItems.push(...results);
        if (results.length < limit) break;
      }
    }

    return allItems;
  }

  public async addToWatchlist(item: TraktContentData): Promise<void> {
    const payload = this.buildSyncPayload(item);
    await this.apiRequest("/sync/watchlist", "POST", payload);
  }

  public async removeFromWatchlist(item: TraktContentData): Promise<void> {
    const payload = this.buildSyncPayload(item);
    await this.apiRequest("/sync/watchlist/remove", "POST", payload);
  }

  // Personal Lists (for groups/collections sync)
  public async getLists(username: string): Promise<TraktList[]> {
    const results = await this.apiRequest<TraktList[]>(
      `/users/${username}/lists`,
    );
    return Array.isArray(results) ? results : [];
  }

  public async createList(username: string, name: string): Promise<TraktList> {
    return this.apiRequest<TraktList>(`/users/${username}/lists`, "POST", {
      name,
      privacy: "private",
    });
  }

  public async getListItems(
    username: string,
    listId: string,
  ): Promise<TraktListItem[]> {
    const limit = 100;
    const allItems: TraktListItem[] = [];
    for (let page = 1; ; page += 1) {
      const results = await this.apiRequest<TraktListItem[]>(
        `/users/${username}/lists/${listId}/items?page=${page}&limit=${limit}`,
      );
      const arr = Array.isArray(results) ? results : [];
      allItems.push(...arr);
      if (arr.length < limit) break;
    }
    return allItems;
  }

  public async addToList(
    username: string,
    listId: string,
    items: TraktContentData[],
  ): Promise<void> {
    const payload = this.buildListPayload(items);
    if (Object.keys(payload).length === 0) return;
    await this.apiRequest(
      `/users/${username}/lists/${listId}/items`,
      "POST",
      payload,
    );
  }

  public async removeFromList(
    username: string,
    listId: string,
    items: TraktContentData[],
  ): Promise<void> {
    const payload = this.buildListPayload(items);
    if (Object.keys(payload).length === 0) return;
    await this.apiRequest(
      `/users/${username}/lists/${listId}/items/remove`,
      "POST",
      payload,
    );
  }

  private buildListPayload(items: TraktContentData[]): any {
    const movies: any[] = [];
    const shows: any[] = [];
    for (const item of items) {
      if (item.type === "movie") {
        const ids = this.buildIds(item);
        movies.push({ ids, title: item.title, year: item.year });
      } else if (item.type === "show" || item.type === "episode") {
        const ids = {
          tmdb: item.showTmdbId
            ? parseInt(item.showTmdbId, 10)
            : item.tmdbId
              ? parseInt(item.tmdbId, 10)
              : undefined,
        };
        shows.push({
          ids,
          title: item.showTitle ?? item.title,
          year: item.showYear ?? item.year,
        });
      }
    }
    const payload: any = {};
    if (movies.length) payload.movies = movies;
    if (shows.length) payload.shows = shows;
    return payload;
  }

  public static groupToSlug(groupName: string): string {
    return slugify(groupName, { lower: true, strict: true }) || "list";
  }

  // Scrobble (report what we're watching to Trakt - shows in Trakt app)
  public async startWatching(
    item: TraktContentData,
    progress: number,
  ): Promise<TraktScrobbleResponse> {
    const payload = this.buildScrobblePayload(item, progress);
    return this.queueRequest(() =>
      this.apiRequest<TraktScrobbleResponse>(
        "/scrobble/start",
        "POST",
        payload,
      ),
    );
  }

  public async pauseWatching(
    item: TraktContentData,
    progress: number,
  ): Promise<TraktScrobbleResponse> {
    const payload = this.buildScrobblePayload(item, progress);
    return this.queueRequest(() =>
      this.apiRequest<TraktScrobbleResponse>(
        "/scrobble/pause",
        "POST",
        payload,
      ),
    );
  }

  public async stopWatching(
    item: TraktContentData,
    progress: number,
  ): Promise<TraktScrobbleResponse> {
    const payload = this.buildScrobblePayload(item, progress);
    return this.queueRequest(() =>
      this.apiRequest<TraktScrobbleResponse>("/scrobble/stop", "POST", payload),
    );
  }

  /**
   * Fire-and-forget stop for page unload. Uses fetch keepalive so the request
   * can complete even after the tab closes.
   */
  public stopWatchingOnUnload(item: TraktContentData, progress: number): void {
    const config = conf();
    const { accessToken } = useTraktAuthStore.getState();
    if (!accessToken || !config.TRAKT_CLIENT_ID) return;

    const payload = this.buildScrobblePayload(item, progress);
    const url = `${TRAKT_API_URL}/scrobble/stop`;
    fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "trakt-api-version": "2",
        "trakt-api-key": config.TRAKT_CLIENT_ID,
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch(() => {});
  }

  // History (Watched) - aggregated view
  public async getHistory(): Promise<TraktWatchedItem[]> {
    const limit = 100;
    const fetchAll = async (endpoint: string) => {
      let page = 1;
      const items: TraktWatchedItem[] = [];
      // eslint-disable-next-line no-constant-condition -- pagination loop
      while (true) {
        const results = await this.apiRequest<TraktWatchedItem[]>(
          `${endpoint}?extended=full,images&page=${page}&limit=${limit}`,
        );
        items.push(...results);
        if (results.length < limit) break;
        page += 1;
      }
      return items;
    };
    const [movies, shows] = await Promise.all([
      fetchAll("/sync/watched/movies"),
      fetchAll("/sync/watched/shows"),
    ]);
    return [...movies, ...shows];
  }

  // History (full list with episodes) - for importing into app
  public async getHistoryItems(): Promise<TraktHistoryItem[]> {
    const limit = 100;
    const all: TraktHistoryItem[] = [];
    for (const type of ["movies", "episodes"] as const) {
      for (let page = 1; ; page += 1) {
        const results = await this.apiRequest<TraktHistoryItem[]>(
          `/sync/history/${type}?extended=full&page=${page}&limit=${limit}`,
        );
        const arr = Array.isArray(results) ? results : [];
        all.push(...arr);
        if (arr.length < limit) break;
      }
    }
    return all;
  }

  public async addToHistory(
    item: TraktContentData,
    watchedAt?: string,
  ): Promise<void> {
    const payload = this.buildSyncPayload(item);
    if (watchedAt) {
      if (payload.movies)
        payload.movies.forEach((m: any) => {
          m.watched_at = watchedAt;
        });
      if (payload.episodes)
        payload.episodes.forEach((e: any) => {
          e.watched_at = watchedAt;
        });
    }
    await this.apiRequest("/sync/history", "POST", payload);
  }

  public async removeFromHistory(item: TraktContentData): Promise<void> {
    const payload = this.buildSyncPayload(item);
    await this.apiRequest("/sync/history/remove", "POST", payload);
  }

  // Helpers
  private buildSyncPayload(item: TraktContentData): any {
    const ids = this.buildIds(item);
    if (item.type === "movie") {
      return { movies: [{ ...item, ids }] };
    }
    if (item.type === "show") {
      return { shows: [{ ...item, ids }] };
    }
    if (item.type === "episode") {
      return { episodes: [{ ids }] };
    }
    return {};
  }

  private buildScrobblePayload(item: TraktContentData, progress: number): any {
    const ids = this.buildIds(item);
    const progressFixed = Math.min(
      100,
      Math.max(0, parseFloat(progress.toFixed(2))),
    );

    if (item.type === "movie") {
      return {
        movie: {
          title: item.title,
          year: item.year,
          ids,
        },
        progress: progressFixed,
      };
    }

    if (item.type === "episode") {
      return {
        show: {
          title: item.showTitle,
          year: item.showYear,
          ids: {
            imdb: item.showImdbId,
            tmdb: item.showTmdbId ? parseInt(item.showTmdbId, 10) : undefined,
          },
        },
        episode: {
          season: item.season,
          number: item.episode,
        },
        progress: progressFixed,
      };
    }
    return {};
  }

  // eslint-disable-next-line class-methods-use-this -- part of payload builder chain
  private buildIds(item: TraktContentData): any {
    const ids: any = {};
    if (item.imdbId) ids.imdb = item.imdbId;
    if (item.tmdbId) ids.tmdb = parseInt(item.tmdbId, 10);
    return ids;
  }
}

export const traktService = TraktService.getInstance();
