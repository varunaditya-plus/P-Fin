import { MakeSlice } from "@/stores/player/slices/types";
import {
  SourceQuality,
  SourceSliceSource,
  selectQuality,
} from "@/stores/player/utils/qualities";
import { useQualityStore } from "@/stores/quality";
import { ValuesOf } from "@/utils/typeguard";

export const playerStatus = {
  IDLE: "idle",
  PLAYING: "playing",
  PLAYBACK_ERROR: "playbackError",
} as const;
export type PlayerStatus = ValuesOf<typeof playerStatus>;

export interface PlayerMetaEpisode {
  number: number;
  title: string;
  overview?: string;
}

export interface PlayerMeta {
  jellyfinItemId: string;
  jellyfinSeriesId?: string;
  jellyfinGenres?: string[];
  jellyfinRating?: number;
  type: "movie" | "show";
  title: string;
  releaseYear: number;
  poster?: string;
  logo?: string;
  overview?: string;
  episode?: PlayerMetaEpisode;
  season?: { number: number; title: string };
}

export interface Caption {
  type?: string;
  id: string;
  language: string;
  url?: string;
  srtData: string;
}

export interface CaptionListItem {
  id: string;
  language: string;
  url: string;
  type?: string;
  display?: string;
  isHearingImpaired?: boolean;
  source?: string;
  encoding?: string;
}

export interface SourceSlice {
  status: PlayerStatus;
  source: SourceSliceSource | null;
  qualities: SourceQuality[];
  currentQuality: SourceQuality | null;
  captionList: CaptionListItem[];
  caption: { selected: Caption | null; asTrack: boolean };
  meta: PlayerMeta | null;
  setStatus(status: PlayerStatus): void;
  setSource(
    stream: SourceSliceSource,
    captions: CaptionListItem[],
    startAt: number,
    autoplay?: boolean,
  ): void;
  setMeta(meta: PlayerMeta, status?: PlayerStatus): void;
  setCaption(caption: Caption | null): void;
  redisplaySource(startAt: number, autoplay?: boolean): void;
  setCaptionAsTrack(asTrack: boolean): void;
}

export const createSourceSlice: MakeSlice<SourceSlice> = (set, get) => ({
  source: null,
  qualities: [],
  captionList: [],
  currentQuality: null,
  meta: null,
  status: playerStatus.IDLE,
  caption: { selected: null, asTrack: false },
  setStatus(status) {
    set((state) => {
      state.status = status;
    });
  },
  setMeta(meta, status) {
    set((state) => {
      state.meta = meta;
      if (status) state.status = status;
    });
  },
  setCaption(caption) {
    set((state) => {
      state.caption.selected = caption;
    });
  },
  setSource(
    stream: SourceSliceSource,
    captions: CaptionListItem[],
    startAt: number,
    autoplay?: boolean,
  ) {
    let qualities: string[] = [];
    if (stream.type === "file") qualities = Object.keys(stream.qualities);
    const qualityPreferences = useQualityStore.getState();
    const loadableStream = selectQuality(stream, qualityPreferences.quality);

    set((s) => {
      s.source = stream;
      s.qualities = qualities as SourceQuality[];
      s.currentQuality = loadableStream.quality;
      s.captionList = captions;
      s.interface.error = undefined;
      s.status = playerStatus.PLAYING;
    });
    const store = get();
    store.redisplaySource(startAt, autoplay);
  },
  redisplaySource(startAt: number, autoplay?: boolean) {
    const store = get();
    if (!store.source) return;
    const qualityPreferences = useQualityStore.getState();
    const loadableStream = selectQuality(store.source, {
      automaticQuality: qualityPreferences.quality.automaticQuality,
      lastChosenQuality: qualityPreferences.quality.lastChosenQuality,
    });
    set((s) => {
      s.interface.error = undefined;
      s.status = playerStatus.PLAYING;
    });
    store.display?.load({
      source: loadableStream.stream,
      startAt,
      autoplay,
      automaticQuality: qualityPreferences.quality.automaticQuality,
      preferredQuality: qualityPreferences.quality.lastChosenQuality,
    });
  },
  setCaptionAsTrack(asTrack: boolean) {
    set((s) => {
      s.caption.asTrack = asTrack;
    });
  },
});
