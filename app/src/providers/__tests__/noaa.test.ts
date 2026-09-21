import { describe, it, expect } from 'vitest';
import { noaaRights, noaaSafety, hasCopyrightMarker } from '../noaa/rights';
import { extractDepthMeters, resolveNoaaLocation, resolveNoaaEnvironment } from '../noaa/geo';
import { pickBestRendition, NoaaOceanExplorationAdapter } from '../noaa/adapter';
import { rightsAreClear } from '../../core/types/rights';

const AT = '2026-09-21T00:00:00.000Z';

describe('NOAA rights', () => {
  it('treats unmarked Ocean Exploration media as a government work', () => {
    const r = noaaRights('NOAA Ocean Exploration, 2026 Cook Islands ROV Exploration', 'A cusk eel at depth.', AT);
    expect(r.classification).toBe('government_work');
    expect(rightsAreClear(r)).toBe(true);
  });

  it('demotes anything NOAA marked as copyrighted', () => {
    const r = noaaRights('Copyright 2024 Example Institute', 'Footage of a vent.', AT);
    expect(r.classification).toBe('unknown');
    expect(rightsAreClear(r)).toBe(false);
  });

  it.each(['copyright', '© 2020', 'All Rights Reserved', 'Courtesy of Someone', 'used with permission'])(
    'detects the marker %s wherever it appears',
    (marker) => { expect(hasCopyrightMarker(`Credit line ${marker} here`)).toBe(true); },
  );

  it('falls back to the organisation when no credit line was published', () => {
    expect(noaaRights(undefined, 'A dive.', AT).attributionText).toBe('NOAA Ocean Exploration');
  });

  it('never claims media may be cached locally', () => {
    expect(noaaRights('NOAA', 'x', AT).cachingAllowed).toBe(false);
  });
});

describe('NOAA safety', () => {
  it('flags pieces that are fundamentally a person on camera', () => {
    expect(noaaSafety('Meet the mission team member', '', []).identifiablePersons).toBe(true);
    expect(noaaSafety('Interview with the chief scientist', '', []).identifiablePersons).toBe(true);
  });

  it('leaves ordinary dive footage alone', () => {
    expect(noaaSafety('Dumbo Octopus', 'An octopus on the seafloor.', ['Invertebrates']).identifiablePersons).toBe(false);
  });
});

describe('depth extraction', () => {
  it('reads a stated depth', () => {
    expect(extractDepthMeters('Observed at a depth of 2,940 meters.')).toBe(2940);
    expect(extractDepthMeters('This vent field lies 1500 metres below the sea surface.')).toBe(1500);
  });

  it('ignores a measurement that is not a depth', () => {
    expect(extractDepthMeters('The ridge runs for 50 meters across the seafloor.')).toBeUndefined();
    expect(extractDepthMeters('A 3 meter long shark.')).toBeUndefined();
  });

  it('rejects a value deeper than the ocean', () => {
    expect(extractDepthMeters('at a depth of 45000 meters')).toBeUndefined();
  });

  it('returns nothing rather than a guess when no depth was written down', () => {
    expect(extractDepthMeters('A beautiful coral garden.')).toBeUndefined();
    expect(extractDepthMeters(undefined)).toBeUndefined();
  });
});

describe('NOAA location', () => {
  it('prefers a named operating area over the ocean basin', () => {
    const loc = resolveNoaaLocation({
      expeditionTitle: '2026 Cook Islands ROV Exploration (EX2605)',
      multimediaTitle: 'Cusk Eel',
      description: 'Seen at a depth of 2,100 meters.',
      oceanBasinNames: ['Pacific Ocean'],
    });
    expect(loc.displayName).toBe('Cook Islands');
    expect(loc.accuracy).toBe('region');
    expect(loc.depthMeters).toBe(2100);
  });

  it('falls back to the basin NOAA tagged', () => {
    const loc = resolveNoaaLocation({
      expeditionTitle: 'An expedition with no place in its name',
      multimediaTitle: 'A fish',
      description: '',
      oceanBasinNames: ['Atlantic Ocean'],
    });
    expect(loc.regionName).toBe('Atlantic Ocean');
  });

  it('returns unknown rather than a guess when there is nothing to go on', () => {
    const loc = resolveNoaaLocation({ multimediaTitle: 'A fish', description: '', oceanBasinNames: [] });
    expect(loc.type).toBe('unknown');
    expect(loc.latitude).toBeUndefined();
  });

  it('always records where a coordinate came from', () => {
    const loc = resolveNoaaLocation({
      expeditionTitle: 'Mariana Region expedition', multimediaTitle: 'Vent', description: '', oceanBasinNames: [],
    });
    expect(loc.coordinateSource).toBeTruthy();
  });
});

describe('NOAA environment', () => {
  it('reads depth as deep or shallow', () => {
    expect(resolveNoaaEnvironment(3000, 'Fish', '', [])).toBe('deep_ocean');
    expect(resolveNoaaEnvironment(40, 'Reef', '', [])).toBe('shallow_ocean');
  });

  it('recognises a vent field', () => {
    expect(resolveNoaaEnvironment(2400, 'Hydrothermal Vent Field', '', ['Hydrothermal Vents'])).toBe('volcanic');
  });
});

describe('rendition choice', () => {
  const media = (id: number, width: number, height: number, bitrate = 3_000_000) => ({
    id, post: 1, date: '', mime_type: 'video/mp4',
    source_url: `https://oceanexplorer.noaa.gov/${id}.mp4`,
    media_details: { width, height, bitrate },
  });

  it('prefers 1080p over 720p', () => {
    expect(pickBestRendition([media(1, 1280, 720), media(2, 1920, 1080)])?.id).toBe(2);
  });

  it('does not reach past 1080p for a phone', () => {
    expect(pickBestRendition([media(1, 1920, 1080), media(2, 3840, 2160)])?.id).toBe(1);
  });

  it('rejects anything below SD', () => {
    expect(pickBestRendition([media(1, 320, 180)])).toBeNull();
  });

  it('returns null rather than throwing on an empty group', () => {
    expect(pickBestRendition([])).toBeNull();
  });
});

describe('NOAA normalisation', () => {
  const adapter = new NoaaOceanExplorationAdapter();

  const raw = {
    media: {
      id: 29864, post: 29763, date: '2026-09-16T10:00:00', mime_type: 'video/mp4',
      source_url: 'https://oceanexplorer.noaa.gov/wp-content/uploads/2026/09/cuskeel.mp4',
      media_details: { width: 1920, height: 1080, bitrate: 2_889_360, length: 123 },
    },
    siblings: [],
    post: {
      id: 29763, date: '2026-09-16T10:00:00', link: 'https://oceanexplorer.noaa.gov/multimedia/cusk-eel-3/',
      featured_media: 1, title: { rendered: 'Cusk Eel' },
      excerpt: { rendered: '<p>A cusk eel observed at a depth of 2,100 meters.</p>' },
      acf: { type: 'video', credit: 'NOAA Ocean Exploration, 2026 Cook Islands ROV Exploration' },
    },
    expedition: { id: 28073, slug: 'ex2605', link: 'https://oceanexplorer.noaa.gov/expedition/ex2605/', title: { rendered: '2026 Cook Islands ROV Exploration (EX2605)' }, location: [51] },
    topicNames: ['Fish'], diveNames: ['Dive 06 (EX2605)'], oceanBasinNames: ['Pacific Ocean'],
    posterUrl: 'https://oceanexplorer.noaa.gov/poster.jpg',
    captionsUrl: 'https://oceanexplorer.noaa.gov/cuskeel.vtt',
    fetchedAt: AT,
  };

  it('produces a complete, rights-clean item', () => {
    const item = adapter.normalize(raw as never);
    expect(item).toBeTruthy();
    expect(item!.title).toBe('Cusk Eel');
    expect(item!.stream.durationSeconds).toBe(123);
    expect(item!.location?.displayName).toBe('Cook Islands');
    expect(item!.location?.depthMeters).toBe(2100);
    expect(item!.source.vessel).toBeUndefined();
    expect(item!.captionsUrl).toContain('.vtt');
    expect(adapter.validateRights(item!)).toBe(true);
  });

  it('names the vessel only when the provider named it', () => {
    const named = { ...raw, expedition: { ...raw.expedition, title: { rendered: 'Okeanos Explorer 2026 Cook Islands (EX2605)' } } };
    expect(adapter.normalize(named as never)!.source.vessel).toBe('NOAA Ship Okeanos Explorer');
  });

  it('refuses to normalise a record with no parent post or no stream', () => {
    expect(adapter.normalize({ ...raw, post: null } as never)).toBeNull();
    expect(adapter.normalize({ ...raw, media: { ...raw.media, source_url: '' } } as never)).toBeNull();
  });

  it('carries the copyright marker through to a failed rights gate', () => {
    const marked = { ...raw, post: { ...raw.post, acf: { ...raw.post.acf, credit: 'Copyright 2024 Someone Else' } } };
    const item = adapter.normalize(marked as never);
    expect(adapter.validateRights(item!)).toBe(false);
  });
});
