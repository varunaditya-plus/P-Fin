export interface TraktUser {
  username: string;
  name?: string;
  private: boolean;
  vip: boolean;
  joined_at: string;
  ids: { slug: string };
  images?: {
    avatar: {
      full: string;
    };
  };
}

export interface TraktImages {
  poster?: {
    full: string;
    medium: string;
    thumb: string;
  };
  fanart?: {
    full: string;
    medium: string;
    thumb: string;
  };
}

export interface TraktHistoryItem {
  id: number;
  watched_at: string;
  action: string;
  type: "movie" | "episode";
  movie?: {
    title: string;
    year: number;
    ids: { trakt: number; tmdb: number };
  };
  episode?: {
    season: number;
    number: number;
    title: string;
    ids: { trakt: number; tmdb?: number };
  };
  show?: {
    title: string;
    year: number;
    ids: { trakt: number; tmdb: number };
  };
}

export interface TraktWatchedItem {
  movie?: {
    title: string;
    year: number;
    ids: { trakt: number; slug: string; imdb: string; tmdb: number };
    runtime?: number;
    images?: TraktImages;
  };
  show?: {
    title: string;
    year: number;
    ids: { trakt: number; slug: string; imdb: string; tmdb: number };
    runtime?: number;
    images?: TraktImages;
  };
  plays: number;
  last_watched_at: string;
  last_updated_at?: string;
  seasons?: {
    number: number;
    episodes: {
      number: number;
      plays: number;
      last_watched_at: string;
    }[];
  }[];
}

export interface TraktWatchlistItem {
  movie?: {
    title: string;
    year: number;
    ids: { trakt: number; slug: string; imdb: string; tmdb: number };
    images?: TraktImages;
  };
  show?: {
    title: string;
    year: number;
    ids: { trakt: number; slug: string; imdb: string; tmdb: number };
    images?: TraktImages;
  };
  listed_at: string;
  id: number;
}

export interface TraktPlaybackItem {
  progress: number;
  paused_at: string;
  id: number;
  type: "movie" | "episode";
  movie?: {
    title: string;
    year: number;
    ids: { trakt: number; slug: string; imdb: string; tmdb: number };
    runtime?: number;
    images?: TraktImages;
  };
  episode?: {
    season: number;
    number: number;
    title: string;
    ids: { trakt: number; tvdb?: number; imdb?: string; tmdb?: number };
    runtime?: number;
    images?: TraktImages;
  };
  show?: {
    title: string;
    year: number;
    ids: {
      trakt: number;
      slug: string;
      tvdb?: number;
      imdb: string;
      tmdb: number;
    };
    images?: TraktImages;
  };
}

export interface TraktScrobbleResponse {
  id: number;
  action: "start" | "pause" | "scrobble" | "conflict";
  progress: number;
  movie?: {
    title: string;
    year: number;
    ids: { trakt: number; slug: string; imdb: string; tmdb: number };
  };
  episode?: {
    season: number;
    number: number;
    title: string;
    ids: { trakt: number; tvdb?: number; imdb?: string; tmdb?: number };
  };
  show?: {
    title: string;
    year: number;
    ids: {
      trakt: number;
      slug: string;
      tvdb?: number;
      imdb: string;
      tmdb: number;
    };
  };
}

export interface TraktContentData {
  type: "movie" | "episode" | "show";
  imdbId?: string;
  tmdbId?: string;
  title: string;
  year?: number;
  season?: number;
  episode?: number;
  showTitle?: string;
  showYear?: number;
  showImdbId?: string;
  showTmdbId?: string;
}

export interface TraktList {
  name: string;
  ids: { trakt: number; slug: string | null };
  item_count: number;
}

export interface TraktListItem {
  type: "movie" | "show" | "season" | "episode";
  movie?: { title: string; year: number; ids: { tmdb: number } };
  show?: { title: string; year: number; ids: { tmdb: number } };
}

export interface TraktHistoryRemovePayload {
  movies?: Array<{
    ids: { trakt?: number; slug?: string; imdb?: string; tmdb?: number };
  }>;
  shows?: Array<{
    ids: {
      trakt?: number;
      slug?: string;
      tvdb?: number;
      imdb?: string;
      tmdb?: number;
    };
    seasons?: Array<{ number: number; episodes?: Array<{ number: number }> }>;
  }>;
  episodes?: Array<{
    ids: { trakt?: number; tvdb?: number; imdb?: string; tmdb?: number };
  }>;
  ids?: number[];
}
