export type TasteType = "movie" | "tv";
export type TasteRating = "loved" | "liked" | "okay" | "disliked" | "hated";
export interface TasteMedia {
  key: string;
  type: TasteType;
  title: string;
  year?: number;
  jellyfinId?: string;
  tmdbId?: number;
  imageTag?: string;
  posterPath?: string;
  genres: string[];
  studios: string[];
}
export interface RatedTasteMedia extends TasteMedia {
  rating: TasteRating;
  ratedAt: number;
}
export interface TastePreferences {
  favoriteGenres: string[];
  moods: string[];
  franchises: string[];
  completedQuiz: boolean;
}
export interface TasteProfile {
  ratings: Record<string, RatedTasteMedia>;
  preferences: TastePreferences;
}
export interface TasteCandidate {
  media: TasteMedia;
  watched?: boolean;
  favourite?: boolean;
  progress?: boolean;
  lastPlayedAt?: number;
  quality?: number;
  voteCount?: number;
  popularity?: number;
  relatedSeeds?: { key: string; weight: number }[];
}

export const GENRES = [
  "Action",
  "Adventure",
  "Animation",
  "Comedy",
  "Crime",
  "Documentary",
  "Drama",
  "Family",
  "Fantasy",
  "History",
  "Horror",
  "Music",
  "Mystery",
  "Romance",
  "Science Fiction",
  "Thriller",
  "War",
  "Western",
  "Reality",
  "News",
  "Talk",
];
export const MOODS = [
  {
    id: "mindblowing",
    label: "Mind-blowing stories",
    genres: ["Science Fiction", "Mystery", "Thriller"],
  },
  { id: "action", label: "Action-packed", genres: ["Action", "Adventure"] },
  {
    id: "emotional",
    label: "Emotional and moving",
    genres: ["Drama", "Romance"],
  },
  { id: "horror", label: "Horror and scares", genres: ["Horror"] },
  {
    id: "suspense",
    label: "Suspense and mystery",
    genres: ["Mystery", "Thriller", "Crime"],
  },
  { id: "laughs", label: "Comedy and laughs", genres: ["Comedy"] },
  {
    id: "feelgood",
    label: "Feel-good and family",
    genres: ["Family", "Animation", "Comedy"],
  },
  {
    id: "epic",
    label: "Epic adventures and fantasy",
    genres: ["Fantasy", "Adventure", "History"],
  },
];
export const FRANCHISES = [
  {
    id: "marvel",
    label: "Marvel",
    patterns: [
      "marvel",
      "avengers",
      "iron man",
      "captain america",
      "thor",
      "spider-man",
      "spider man",
      "guardians of the galaxy",
      "black panther",
      "x-men",
      "deadpool",
    ],
  },
  {
    id: "dc",
    label: "DC",
    patterns: [
      "dc entertainment",
      "dc comics",
      "dc films",
      "batman",
      "superman",
      "wonder woman",
      "justice league",
      "aquaman",
    ],
  },
  {
    id: "starwars",
    label: "Star Wars",
    patterns: ["star wars", "lucasfilm", "mandalorian", "andor", "ahsoka"],
  },
  {
    id: "harrypotter",
    label: "Harry Potter",
    patterns: ["harry potter", "fantastic beasts"],
  },
  {
    id: "lotr",
    label: "Lord of the Rings",
    patterns: ["lord of the rings", "the hobbit", "rings of power"],
  },
  {
    id: "bond",
    label: "James Bond",
    patterns: ["james bond", "eon productions"],
  },
  {
    id: "fastfurious",
    label: "Fast & Furious",
    patterns: [
      "fast & furious",
      "fast and furious",
      "fast five",
      "fast x",
      "fast 9",
      "furious 7",
    ],
  },
  {
    id: "missionimpossible",
    label: "Mission: Impossible",
    patterns: ["mission: impossible", "mission impossible"],
  },
  {
    id: "jurassic",
    label: "Jurassic Park",
    patterns: ["jurassic park", "jurassic world"],
  },
  { id: "pixar", label: "Pixar", patterns: ["pixar"] },
];
const genreIds: Record<number, string[]> = {
  28: ["Action"],
  12: ["Adventure"],
  16: ["Animation"],
  35: ["Comedy"],
  80: ["Crime"],
  99: ["Documentary"],
  18: ["Drama"],
  10751: ["Family"],
  14: ["Fantasy"],
  36: ["History"],
  27: ["Horror"],
  10402: ["Music"],
  9648: ["Mystery"],
  10749: ["Romance"],
  878: ["Science Fiction"],
  53: ["Thriller"],
  10752: ["War"],
  37: ["Western"],
  10759: ["Action", "Adventure"],
  10762: ["Family"],
  10765: ["Science Fiction", "Fantasy"],
  10766: ["Drama"],
  10768: ["War"],
  10763: ["News"],
  10764: ["Reality"],
  10767: ["Talk"],
};
export function normaliseGenres(values: (string | number)[]) {
  return [
    ...new Set(
      values
        .flatMap((value) => {
          if (typeof value === "number") return genreIds[value] ?? [];
          const lower = value.toLowerCase();
          if (["sci-fi", "sci fi", "science-fiction"].includes(lower))
            return ["Science Fiction"];
          if (lower === "sci-fi & fantasy")
            return ["Science Fiction", "Fantasy"];
          if (lower === "action & adventure") return ["Action", "Adventure"];
          if (lower === "kids") return ["Family"];
          if (lower === "war & politics") return ["War"];
          return [
            GENRES.find((genre) => genre.toLowerCase() === lower) ??
              value.trim(),
          ];
        })
        .filter(Boolean),
    ),
  ];
}

export function seerrGenreId(genre: string, type: TasteType) {
  if (type === "tv") {
    if (["Action", "Adventure"].includes(genre)) return 10759;
    if (["Science Fiction", "Fantasy"].includes(genre)) return 10765;
    if (genre === "Family") return 10762;
    if (genre === "War") return 10768;
  }
  return (
    Number(
      Object.entries(genreIds).find(
        ([, names]) => names.length === 1 && names[0] === genre,
      )?.[0],
    ) || undefined
  );
}
