/**
 * Dives: whole ROV dives from NOAA Ship Okeanos Explorer, replayed as they
 * happened.
 *
 * A clip in the catalog is somebody's edit. A dive is the record itself: the
 * vehicle's camera from launch to recovery, the vehicle's own position and
 * depth every second, and the time-stamped observations the science team
 * logged while it was happening. frontier go lines the three up, so the
 * picture, the instruments and the naming of what is on screen all run on one
 * clock.
 *
 * Every field here traces to a file NOAA publishes for the dive:
 *   - `DIVExx.txt` / the ROV dive summary PDF  -> times, site, maximum depth
 *   - `RovTrack1Hz.csv`                        -> track (depth, position)
 *   - `DIVExx_ANNOTATIONS.csv` (SeaTube)       -> sightings
 *   - `DIVExx-videos.zip` central directory    -> the camera segments
 */

export type DiveId = string; // "EX2104-DIVE05"

/** One entry in the dive index. Small enough to load every dive at once. */
export interface DiveSummary {
  id: DiveId;
  cruise: string;             // "EX2104"
  dive: number;               // 5
  /** UTC date the vehicle went in the water, YYYY-MM-DD. */
  date: string;
  /** The science team's name for the place, from the dive summary. */
  site?: string;
  /** The wider area, from the dive summary ("Corner Rise Seamounts"). */
  area?: string;
  /** The expedition this dive belonged to, as NOAA titles it. */
  expedition?: string;
  /** Where the vehicle reached the bottom (or the deepest point of the track). */
  latitude: number;
  longitude: number;
  maxDepthMeters: number;
  durationSeconds: number;
  bottomSeconds?: number;
  sightingCount: number;
  /** Plain-language groups seen on the dive, most-sighted first. */
  groups: string[];
  /** Seconds of main-camera video in the archive for this dive. */
  videoSeconds: number;
  /** True when frontier go serves this dive's camera footage, so it can be replayed. */
  replay?: boolean;
  /** The dive's cover still on the frontier go website (absolute URL), when one was published. */
  cover?: string;
}

/**
 * The vehicle's track, column-oriented to keep the files small.
 * `t` is seconds since `DiveDetail.startUnix`.
 */
export interface DiveTrack {
  t: number[];
  depth: number[];
  lat: (number | null)[];
  lon: (number | null)[];
}

export interface DiveSighting {
  /** Seconds since `DiveDetail.startUnix`. */
  t: number;
  /** Scientific name as logged ("Munidopsis"), when the log names one. */
  taxon?: string;
  /** The logged common name, when there is one ("squat lobsters"). */
  common?: string;
  /** frontier go's plain-language group ("Squat lobsters and crabs"). */
  group: string;
  /** The scientist's free-text note, trimmed. */
  note?: string;
  depth?: number;
  /** Water temperature at the vehicle, degrees C, when logged. */
  tempC?: number;
}

/** One camera recording segment (NOAA splits the recording every five minutes). */
export interface DiveSegment {
  /** Seconds since `DiveDetail.startUnix` at which this segment begins. */
  t: number;
  /** Length in seconds (the gap to the next segment, capped). */
  duration: number;
  /** File name inside the NOAA archive, e.g. EX2104_VID_20210708T150459Z_ROVHD_Low.mp4 */
  file: string;
  bytes: number;
  /** True once the mirror has published this segment under `DiveDetail.videoBase`. */
  mirrored?: boolean;
}

/** A still the ROV's main camera saved during the dive (NOAA's framegrabs). */
export interface DiveStill {
  /** Seconds since `DiveDetail.startUnix`. */
  t: number;
  /** File name inside the NOAA images archive, e.g. EX2104_IMG_20210708T150502Z_ROVHD.jpg */
  file: string;
}

export interface DiveEvent {
  t: number;
  kind: 'in_water' | 'on_bottom' | 'off_bottom' | 'out_water';
}

export interface DiveDetail extends DiveSummary {
  /** Unix seconds at t = 0: the first track sample. */
  startUnix: number;
  purpose?: string;
  events: DiveEvent[];
  track: DiveTrack;
  sightings: DiveSighting[];
  segments: DiveSegment[];
  stills: DiveStill[];
  /** Base URL the mirrored segments are served from (the file name is appended). */
  videoBase?: string;
  /** Framegrabs published on the website for this dive: sighting time -> absolute URL. */
  photos?: { t: number; url: string }[];
  source: {
    /** NOAA's landing page for the cruise's archived data. */
    landingPage: string;
    credit: string;
  };
}

export interface DiveIndex {
  version: 1;
  generatedAt: string;
  dives: DiveSummary[];
}

export const DIVE_CREDIT = 'NOAA Ocean Exploration';
