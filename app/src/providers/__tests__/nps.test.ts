import { describe, expect, it } from 'vitest';
import { npsAdapter, npsEnvironment, npsLocation, pickVersions, posterFromPage, usStates, type NpsRawItem, type NpsVideo } from '../nps/adapter';
import { npsIsFootage, npsRights, npsSafety } from '../nps/rights';
import { rightsAreClear } from '../../core/types/rights';
import { safetyIsClear } from '../../core/types/safety';
import { evaluateEligibility } from '../../core/catalog/eligibility';

const AT = '2026-09-23T00:00:00.000Z';

/** Shaped like a real record from /multimedia/videos, trimmed. */
function video(over: Partial<NpsVideo> = {}): NpsVideo {
  return {
    id: '4CA31BE6-BB6C-47CB-88AA-080B2BCEE3A1',
    title: 'Bugling Elk on Rabbit Mountain',
    description: 'Bull elk bugle across a meadow in Rocky Mountain National Park during the fall rut.',
    permalinkUrl: 'https://www.nps.gov/media/video/view.htm?id=4CA31BE6-BB6C-47CB-88AA-080B2BCEE3A1',
    splashImage: { url: 'https://www.nps.gov/nps-audiovideo/thumbnail/234498ee.jpg' },
    relatedParks: [{ parkCode: 'romo', fullName: 'Rocky Mountain National Park', designation: 'National Park', states: 'CO' }],
    tags: [],
    latitude: null,
    longitude: null,
    durationMs: 95_500,
    credit: 'NPS/Neal Herbert',
    isBRoll: true,
    captionFiles: [{ url: 'https://www.nps.gov/nps-audiovideo/closed-caption/x.vtt', fileType: 'text/vtt', language: 'english' }],
    versions: [
      { url: 'https://www.nps.gov/nps-audiovideo/audiovideo/x360p.mp4', fileType: 'video/mp4', heightPixels: 360, widthPixels: 640 },
      { url: 'https://www.nps.gov/nps-audiovideo/audiovideo/x1080p.mp4', fileType: 'video/mp4', heightPixels: 1080, widthPixels: 1920 },
      { url: 'https://www.nps.gov/nps-audiovideo/audiovideo/x2160p.mp4', fileType: 'video/mp4', heightPixels: 2160, widthPixels: 3840 },
    ],
    ...over,
  };
}
const PARK = { parkCode: 'romo', fullName: 'Rocky Mountain National Park', designation: 'National Park', states: 'CO', latitude: '40.3556924', longitude: '-105.6972879' };
const raw = (v: NpsVideo, park: NpsRawItem['park'] = PARK): NpsRawItem => ({ video: v, park, fetchedAt: AT });

describe('NPS rights, from the credit line', () => {
  it('treats no credit as NPS material, per the NPS disclaimer', () => {
    const r = npsRights('', AT);
    expect(r.classification).toBe('government_work');
    expect(r.attributionText).toBe('National Park Service');
    expect(rightsAreClear(r)).toBe(true);
  });

  it('accepts the NPS, an NPS staff credit, a park, or another federal bureau', () => {
    for (const c of ['NPS', 'National Park Service', 'NPS/Neal Herbert', 'NPS / Jacob W. Frank', 'NPS Video: Richard Burton', 'Glacier National Park', 'Stonewall National Monument', 'USGS']) {
      expect(npsRights(c, AT).classification, c).toBe('government_work');
    }
  });

  it('rejects a third party the NPS is crediting', () => {
    for (const c of ['Kevin Bryant', 'NPS/Argentine Productions', 'Ploeger ASL Interpreting, LLC/NPS', 'National Archives',
      'Cobra EAST with Hot Springs National Park', 'Video by Sam Mallon, Friends of Acadia', 'Smokies Life / Robin Pyle', 'SNP']) {
      const r = npsRights(c, AT);
      expect(r.classification, c).toBe('unknown');
      expect(rightsAreClear(r), c).toBe(false);
    }
  });

  it('reads a Creative Commons credit, and rejects ND and NC', () => {
    const nd = npsRights('Yosemite Conservancy. This work is licensed under a <a href="http://creativecommons.org/licenses/by-nd/4.0/">Creative Commons Attribution-NoDerivatives 4.0 International License</a>.', AT);
    expect(nd.classification).toBe('unknown');
    const by = npsRights('Jane Doe. Licensed under <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>', AT);
    expect(by.classification).toBe('cc_by');
    expect(by.attributionRequired).toBe(true);
    expect(rightsAreClear(by)).toBe(true);
  });
});

describe('NPS editorial and safety filters', () => {
  it('drops accessibility duplicates, meetings and announcements', () => {
    for (const t of ['Roadrunner - ASL / Audio Description', 'Cape Cod Advisory Committee Meeting: 7/1/2024', 'Shifting Species Webinar',
      'Fort Davis Park Introductory Video Open Captioned', 'Passport Stamp #401 of 401', 'Happy Birthday National Park Service!', 'Riverfront Songs with Ranger Don of Gateway Arch National Park']) {
      expect(npsIsFootage(t), t).toBe(false);
    }
    expect(npsIsFootage('Bugling Elk on Rabbit Mountain')).toBe(true);
  });

  it('flags interviews and oral histories, and events that should not be shuffled into', () => {
    expect(npsSafety('Rose Bighorse Interview - Navajo Weaver', '').identifiablePersons).toBe(true);
    expect(npsSafety('Investigation - Cockpit Voice Recorder', '').disturbingContent).toBe(true);
    expect(safetyIsClear(npsSafety('Bugling Elk on Rabbit Mountain', 'Bull elk bugle.'))).toBe(true);
  });
});

describe('NPS places and kinds of place', () => {
  it('uses the video\'s own point as approximate, else the park reference point as region', () => {
    const own = npsLocation(video({ latitude: 40.4, longitude: -105.6 }), PARK, 'mountain')!;
    expect(own.accuracy).toBe('approximate');
    expect(own.coordinateSource).toMatch(/multimedia record/);
    const park = npsLocation(video(), PARK, 'mountain')!;
    expect(park.accuracy).toBe('region');
    expect(park.latitude).toBeCloseTo(40.356, 3);
    expect(park.coordinateSource).toMatch(/park, not the filming position/);
    expect(park.regionName).toBe('Colorado');
    expect(npsLocation(video({ relatedParks: [] }), undefined, 'wilderness')).toBeNull();
  });

  it('decides the kind of place from the title first, then the site', () => {
    expect(npsEnvironment('Coral Connections in Biscayne', '', 'National Park')).toBe('shallow_ocean');
    expect(npsEnvironment('Old Faithful Erupts', '', 'National Park')).toBe('wilderness');
    expect(npsEnvironment('Grand Prismatic hot springs', '', 'National Park')).toBe('volcanic');
    expect(npsEnvironment('Kwanzaa Celebration', 'On the river bank', 'National Historic Site')).toBe('historic_site');
    expect(npsEnvironment('Evening program', 'Deep in the redwoods', 'National Park')).toBe('forest');
  });

  it('spells out state codes', () => {
    expect(usStates('ID,MT,WY')).toBe('Idaho, Montana, Wyoming');
    expect(usStates('XX')).toBe('XX');
  });
});

describe('NPS renditions and posters', () => {
  it('plays the largest MP4 at 1080p or below, with a smaller fallback', () => {
    const { best, fallback } = pickVersions(video().versions);
    expect(best?.heightPixels).toBe(1080);
    expect(fallback?.heightPixels).toBe(360);
  });

  it('takes a poster from the video page only when it is an nps.gov image', () => {
    expect(posterFromPage('<meta property="og:image" content="https://www.nps.gov/nps-audiovideo/legacy/pevi/x_splash.jpg" />'))
      .toBe('https://www.nps.gov/nps-audiovideo/legacy/pevi/x_splash.jpg');
    expect(posterFromPage('<video poster="/nps-audiovideo/legacy/x.jpg">')).toBe('https://www.nps.gov/nps-audiovideo/legacy/x.jpg');
    expect(posterFromPage('<meta property="og:image" content="https://evil.example/x.jpg" />')).toBeUndefined();
    expect(posterFromPage('<p>nothing</p>')).toBeUndefined();
  });
});

describe('npsAdapter.normalize', () => {
  it('produces an eligible, placed, rights-clean item', () => {
    const item = npsAdapter.normalize(raw(video()))!;
    expect(item.id).toBe('nps:4CA31BE6-BB6C-47CB-88AA-080B2BCEE3A1');
    expect(item.stream.url).toMatch(/1080p\.mp4$/);
    expect(item.stream.durationSeconds).toBe(95.5);
    expect(item.channel).toBe('wild_earth');
    expect(item.subjects).toContain('mammals');
    expect(item.tags).toContain('B-roll');
    expect(item.source.site).toBe('Rocky Mountain National Park');
    expect(item.captionsUrl).toMatch(/\.vtt$/);
    expect(evaluateEligibility(item)).toEqual({ eligible: true, reasons: [] });
  });

  it('files a historic site under History, with the history subject', () => {
    const item = npsAdapter.normalize(raw(
      video({ title: 'Kwanzaa at the Douglass Home', description: 'A family gathering.', isBRoll: false, relatedParks: [{ parkCode: 'frdo', fullName: 'Frederick Douglass National Historic Site', designation: 'National Historic Site', states: 'DC' }] }),
      { parkCode: 'frdo', fullName: 'Frederick Douglass National Historic Site', designation: 'National Historic Site', states: 'DC', latitude: '38.863', longitude: '-76.985' },
    ))!;
    expect(item.channel).toBe('archives');
    expect(item.subjects).toContain('history');
    expect(item.environment).toBe('historic_site');
  });

  it('drops what is not footage, and what has no place', () => {
    expect(npsAdapter.normalize(raw(video({ title: 'Elk - ASL' })))).toBeNull();
    expect(npsAdapter.normalize({ video: video({ relatedParks: [] }), park: undefined, fetchedAt: AT })).toBeNull();
    expect(npsAdapter.normalize(raw(video({ versions: [] })))).toBeNull();
  });

  it('fetches parks and pages with an injected fetch, and recovers missing posters', async () => {
    const calls: string[] = [];
    const fake = (async (url: string) => {
      calls.push(url);
      if (url.includes('/parks')) return new Response(JSON.stringify({ data: [PARK] }));
      if (url.includes('/multimedia/videos')) return new Response(JSON.stringify({ total: '2', data: [video(), video({ id: 'B', splashImage: { url: '' } })] }));
      return new Response('<meta property="og:image" content="https://www.nps.gov/nps-audiovideo/legacy/b.jpg" />');
    }) as unknown as typeof fetch;
    const raws = await npsAdapter.fetchItems({ fetchImpl: fake });
    expect(raws).toHaveLength(2);
    expect(raws[0].park?.fullName).toBe('Rocky Mountain National Park');
    expect(raws[1].video.splashImage?.url).toBe('https://www.nps.gov/nps-audiovideo/legacy/b.jpg');
    expect(calls.filter((u) => u.includes('/multimedia/videos'))).toHaveLength(1);
    expect(calls.every((u) => !u.includes('developer.nps.gov') || u.includes('api_key='))).toBe(true);
  });
});
