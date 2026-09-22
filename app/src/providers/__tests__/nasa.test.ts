import { describe, it, expect } from 'vitest';
import { nasaRights, nasaSafety, looksLikeRealFootage, nasaHasRightsMarker } from '../nasa/rights';
import { parseQuickTimeDuration, parseBitrate, parseXmpDuration, pickNasaRenditions, NasaAdapter } from '../nasa/adapter';
import { lookupOffEarth, lookupNasaFacility } from '../gazetteer';
import { rightsAreClear } from '../../core/types/rights';

const AT = '2026-09-21T00:00:00.000Z';

describe('NASA rights', () => {
  it('treats unmarked NASA media as a government work and credits the centre', () => {
    const r = nasaRights({ title: 'RS-25 Engine Test', description: 'A hot fire.', keywords: ['Stennis'], center: 'MSFC' }, AT);
    expect(r.classification).toBe('government_work');
    expect(r.attributionText).toBe('NASA/MSFC');
    expect(rightsAreClear(r)).toBe(true);
  });

  it('demotes third-party and licensed material', () => {
    expect(nasaRights({ title: 'A film', description: 'Courtesy of a studio.' }, AT).classification).toBe('unknown');
    expect(nasaRights({ title: 'A film', description: 'Music by someone.' }, AT).classification).toBe('unknown');
    expect(nasaRights({ title: 'A film', description: 'Copyright 2020 Someone.' }, AT).classification).toBe('unknown');
  });

  it.each(['getty', 'reuters', 'associated press', 'licensed from', '©'])('detects %s', (m) => {
    expect(nasaHasRightsMarker(`credit ${m} here`)).toBe(true);
  });

  it('credits plain NASA when the centre is not one we recognise', () => {
    expect(nasaRights({ title: 'x', center: 'SOMETHING' }, AT).attributionText).toBe('NASA');
  });
});

describe('NASA safety', () => {
  it('keeps people-formats out of the default feed', () => {
    for (const title of ['NASA Science Live: Something', 'Press Conference on Artemis', 'Administrator Town Hall', 'Educational Downlink']) {
      expect(nasaSafety({ title, description: '', keywords: [] }).identifiablePersons).toBe(true);
    }
  });

  it('leaves footage of a place alone', () => {
    expect(nasaSafety({ title: 'Earth Views from the International Space Station', description: '', keywords: [] }).identifiablePersons).toBe(false);
  });

  it('does not mistake a piece of spacecraft for a talking head', () => {
    // 'panel' used to be a bare cue, and this is real hardware footage.
    expect(nasaSafety({ title: 'Orion Crew Module Cone Panel', description: '', keywords: [] }).identifiablePersons).toBe(false);
    expect(nasaSafety({ title: 'Solar Panel Deployment Test', description: '', keywords: [] }).identifiablePersons).toBe(false);
  });

  it('still catches an actual panel discussion', () => {
    expect(nasaSafety({ title: 'Artemis Panel Discussion', description: '', keywords: [] }).identifiablePersons).toBe(true);
  });

  it('reads formats from the title, not from a passing mention in the caption', () => {
    // The caption says when the footage was released; the footage is a launch.
    expect(nasaSafety({
      title: 'Artemis I Launch',
      description: 'Footage shown during the post-launch town hall for employees.',
      keywords: [],
    }).identifiablePersons).toBe(false);
  });

  it('catches a press conference wherever it is named', () => {
    expect(nasaSafety({
      title: 'Mission Update',
      description: 'Highlights from the post-landing press conference.',
      keywords: [],
    }).identifiablePersons).toBe(true);
  });
});

describe('what counts as footage', () => {
  it('excludes synthetic imagery', () => {
    expect(looksLikeRealFootage('Mars animation flyover', '', [])).toBe(false);
    expect(looksLikeRealFootage('Data visualization of the launch', '', [])).toBe(false);
  });

  it('excludes produced explainer formats', () => {
    expect(looksLikeRealFootage('NASA ScienceCasts: Unlocking the Origins of the Universe', '', [])).toBe(false);
    expect(looksLikeRealFootage('This Week at NASA, October', '', [])).toBe(false);
  });

  it('requires a positive sign that something was recorded', () => {
    expect(looksLikeRealFootage('Welcome to the Ionosphere', 'An introduction.', [])).toBe(false);
    expect(looksLikeRealFootage('Earth Views from the Space Station', '', ['Earth Views'])).toBe(true);
    expect(looksLikeRealFootage('RS-25 Engine Test 4K Full Duration', '', [])).toBe(true);
  });
});

describe('technical metadata parsing', () => {
  it('reads QuickTime clock durations', () => {
    expect(parseQuickTimeDuration('0:52:34')).toBe(3154);
    expect(parseQuickTimeDuration('12:04')).toBe(724);
    expect(parseQuickTimeDuration('35.2 s')).toBe(35);
    expect(parseQuickTimeDuration(90)).toBe(90);
  });

  it('returns nothing for a value it cannot read', () => {
    expect(parseQuickTimeDuration('not a duration')).toBeUndefined();
    expect(parseQuickTimeDuration(undefined)).toBeUndefined();
  });

  it('reads the XMP rational form', () => {
    expect(parseXmpDuration({ Value: 283946880, Scale: 0.0000111111111111111 })).toBe(3155);
    expect(parseXmpDuration({ Value: 0, Scale: 1 })).toBeUndefined();
    expect(parseXmpDuration('nope')).toBeUndefined();
  });

  it('reads bitrates in every unit NASA writes', () => {
    expect(parseBitrate('41.2 Mbps')).toBe(41_200_000);
    expect(parseBitrate('2400 kbps')).toBe(2_400_000);
    expect(parseBitrate(1234)).toBe(1234);
    expect(parseBitrate('unknown')).toBeUndefined();
  });
});

describe('renditions', () => {
  const base = 'http://images-assets.nasa.gov/video/An Asset Name/An Asset Name';
  const assets = [`${base}~orig.mp4`, `${base}~large.mp4`, `${base}~medium.mp4`, `${base}~small.mp4`, `${base}~mobile.mp4`, `${base}.vtt`];

  it('prefers the medium rendition for a phone', () => {
    expect(pickNasaRenditions(assets).url).toContain('~medium.mp4');
  });

  it('upgrades http to https and percent-encodes the path', () => {
    const { url } = pickNasaRenditions(assets);
    expect(url!.startsWith('https://')).toBe(true);
    expect(url).not.toContain(' ');
    expect(url).toContain('%20');
  });

  it('offers a smaller fallback', () => {
    expect(pickNasaRenditions(assets).fallback).toContain('~small.mp4');
  });

  it('picks up published captions', () => {
    expect(pickNasaRenditions(assets).captions).toContain('.vtt');
  });

  it('returns nothing usable when there is no mp4', () => {
    expect(pickNasaRenditions([`${base}.srt`]).url).toBeUndefined();
  });
});

describe('gazetteer matching', () => {
  it('matches whole words only', () => {
    // The first live ingest filed a Stennis engine test as Low Earth Orbit
    // because `iss` is inside `mission`. This is that regression.
    expect(lookupOffEarth('A mission to test the engine')).toBeNull();
    expect(lookupOffEarth('Aboard the ISS')).toMatchObject({ type: 'earth_orbit' });
  });

  it('picks the entry whose matching token is longest', () => {
    // `international space station` must not outrank `mars` just by existing.
    expect(lookupOffEarth('What Mars looks like from orbit')).toMatchObject({ celestialBody: 'mars' });
  });

  it('never puts an off-Earth place on the Earth globe', () => {
    const moon = lookupOffEarth('Apollo 17 lunar surface');
    expect(moon?.latitude).toBeUndefined();
    expect(moon?.celestialBody).toBe('moon');
  });

  it('does not treat a centre acronym as a filming location', () => {
    expect(lookupNasaFacility('GSFC')).toBeNull();
    expect(lookupNasaFacility('Goddard Space Flight Center cleanroom')).toMatchObject({ regionName: 'Maryland' });
  });

  it('records a basis for every coordinate it hands out', () => {
    const stennis = lookupNasaFacility('Stennis Space Center test stand');
    expect(stennis?.coordinateSource).toBeTruthy();
    expect(stennis?.accuracy).toBe('approximate');
  });
});

describe('NASA normalisation', () => {
  const adapter = new NasaAdapter();
  const raw = {
    nasaId: 'test-asset', title: 'RS-25 Engine Test at Stennis Space Center',
    description: 'A full-duration hot fire.', keywords: ['Stennis', 'SLS'],
    center: 'MSFC', dateCreated: '2018-10-31T00:00:00Z',
    thumbnailUrl: 'https://images-assets.nasa.gov/thumb.jpg',
    channel: 'field_science' as const, queryTags: ['Propulsion'],
    streamUrl: 'https://images-assets.nasa.gov/video/test-asset/test-asset~medium.mp4',
    durationSeconds: 510, width: 3840, height: 2160, bitrate: 41_200_000,
    fetchedAt: AT,
  };

  it('produces a located, rights-clean item', () => {
    const item = adapter.normalize(raw as never)!;
    expect(item.location?.displayName).toBe('Stennis Space Center');
    expect(item.location?.accuracy).toBe('approximate');
    // A static fire is under test, not on the pad, even though it happens
    // outdoors at a launch-adjacent facility.
    expect(item.environment).toBe('laboratory');
    expect(adapter.validateRights(item)).toBe(true);
  });

  it('leaves the location unknown rather than guessing', () => {
    const item = adapter.normalize({ ...raw, title: 'Some footage' } as never)!;
    expect(item.location?.type).toBe('unknown');
    expect(item.subtitle).toBeUndefined();
  });

  it('only claims a mission when the location is mission-level', () => {
    const ground = adapter.normalize(raw as never)!;
    expect(ground.source.mission).toBeUndefined();
    const orbital = adapter.normalize({ ...raw, title: 'Earth Views from the International Space Station' } as never)!;
    expect(orbital.source.mission).toBe('International Space Station');
  });

  it('files pre-1990 material into Archives as well', () => {
    const old = adapter.normalize({ ...raw, dateCreated: '1972-12-11T00:00:00Z' } as never)!;
    expect(old.channels).toContain('archives');
  });
});

describe('rights evidence in asset filenames', () => {
  const adapter = new NasaAdapter();
  const base = {
    nasaId: 'x', title: 'Artemis I Core Stage Join', description: 'Sections joined.',
    keywords: ['Artemis'], center: 'MSFC', dateCreated: '2019-09-17T00:00:00Z',
    channel: 'space' as const, queryTags: [], durationSeconds: 120,
    width: 1920, height: 1080, fetchedAt: '2026-09-21T00:00:00.000Z',
  };

  it('reads a licensed-music marker out of the filename', () => {
    const item = adapter.normalize({
      ...base,
      streamUrl: 'https://images-assets.nasa.gov/video/MAF_20190917_Artemis%201%20ES%20Join_Music_Artemis%20logo/x~medium.mp4',
      thumbnailUrl: 'https://images-assets.nasa.gov/video/MAF_20190917_Artemis%201%20ES%20Join_Music_Artemis%20logo~large.jpg',
    } as never)!;
    expect(item.rights.classification).toBe('unknown');
    expect(adapter.validateRights(item)).toBe(false);
  });

  it('leaves an ordinary filename alone', () => {
    const item = adapter.normalize({
      ...base,
      streamUrl: 'https://images-assets.nasa.gov/video/MAF_20190917_Core_Stage_Join/x~medium.mp4',
      thumbnailUrl: 'https://images-assets.nasa.gov/video/MAF_20190917_Core_Stage_Join~large.jpg',
    } as never)!;
    expect(item.rights.classification).toBe('government_work');
  });
});

describe('NASA facility addresses', () => {
  const base = {
    nasaId: 'x', description: '', keywords: [] as string[], center: 'GSFC',
    dateCreated: '2020-01-01T00:00:00Z', channel: 'space' as const, queryTags: [] as string[],
    streamUrl: 'https://images-assets.nasa.gov/video/x/x~medium.mp4',
    thumbnailUrl: 'https://images-assets.nasa.gov/video/x/x~thumb.jpg',
    durationSeconds: 120, width: 1920, height: 1080, bitrate: 3_000_000,
    fetchedAt: '2026-09-22T00:00:00Z',
  };
  const adapter = new NasaAdapter();

  it('does not put orbital footage on the campus that filed it', () => {
    // AVAIL:Location names where the asset is HELD. Read literally it pinned
    // 296 items, Hubble servicing EVAs among them, to Greenbelt, Maryland.
    const item = adapter.normalize({
      ...base,
      title: 'Slow Look at HST 1',
      description: 'A spacewalk during the servicing mission.',
      metadataLocation: 'Goddard Space Flight Center',
    } as never);
    expect(item).not.toBeNull();
    expect(item!.environment).toBe('orbit');
    expect(item!.location?.type).toBe('earth_orbit');
    expect(item!.location?.latitude).toBeUndefined();
    expect(item!.location?.accuracy).toBe('mission');
    expect(item!.location?.coordinateSource).toMatch(/held/i);
  });

  it('does not pin Earth footage to the campus that filed it either', () => {
    // "Greenland Ice Flights" stamped Goddard: polar footage, Maryland pin.
    const item = adapter.normalize({
      ...base,
      title: 'Greenland Ice Flights',
      description: 'Airborne survey over the ice sheet.',
      metadataLocation: 'Goddard Space Flight Center',
      channel: 'wild_earth' as const,
    } as never);
    expect(item).not.toBeNull();
    expect(item!.environment).toBe('polar');
    expect(item!.location?.displayName).not.toBe('Goddard Space Flight Center');
    expect(item!.location?.latitude).toBeUndefined();
  });

  it('keeps the facility when the footage really is at the facility', () => {
    const item = adapter.normalize({
      ...base,
      title: 'RS-25 Engine Test',
      description: 'A hot fire on the test stand.',
      metadataLocation: 'Stennis Space Center',
      channel: 'field_science' as const,
    } as never);
    expect(item).not.toBeNull();
    expect(item!.environment).toBe('laboratory');
    expect(item!.location?.displayName).toBe('Stennis Space Center');
    expect(typeof item!.location?.latitude).toBe('number');
  });
});
