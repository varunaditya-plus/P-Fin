export type SeerrMediaType = "movie" | "tv";

export interface SeerrUser {
  id: number;
  displayName?: string;
  username?: string;
  jellyfinUsername?: string;
  jellyfinUserId?: string;
  permissions: number;
}

export interface SeerrRequest {
  id: number;
  status: number;
  type: SeerrMediaType;
  is4k?: boolean;
  seasons?: { seasonNumber: number; status: number }[];
}

export interface SeerrMediaInfo {
  status: number;
  status4k?: number;
  requests?: SeerrRequest[];
  seasons?: { seasonNumber: number; status: number; status4k?: number }[];
}

export interface SeerrMedia {
  id: number;
  mediaType: SeerrMediaType;
  title?: string;
  name?: string;
  overview?: string;
  posterPath?: string | null;
  backdropPath?: string | null;
  releaseDate?: string;
  firstAirDate?: string;
  voteAverage?: number;
  mediaInfo?: SeerrMediaInfo;
}

export interface SeerrDetails extends SeerrMedia {
  runtime?: number;
  episodeRunTime?: number[];
  originalLanguage?: string;
  genres?: { id: number; name: string }[];
  seasons?: {
    id: number;
    name: string;
    seasonNumber: number;
    episodeCount: number;
    posterPath?: string | null;
    airDate?: string;
  }[];
  credits?: {
    cast?: {
      id: number;
      name: string;
      character?: string;
      profilePath?: string | null;
    }[];
  };
}

export interface SeerrPage {
  page: number;
  totalPages: number;
  totalResults: number;
  results: SeerrMedia[];
}

export interface SeerrQuota {
  movie: {
    limit: number;
    used: number;
    remaining?: number;
    restricted: boolean;
  };
  tv: { limit: number; used: number; remaining?: number; restricted: boolean };
}

export interface SeerrSettings {
  partialRequestsEnabled: boolean;
  enableSpecialEpisodes: boolean;
}
