import { describe, expect, it } from 'vitest';
import { locAdapter, locEnvironment, tidyHeading, LibraryOfCongressAdapter, type LocResult } from '../loc/adapter';
import { isFederalProduction, locIsFootage, locRights, locSafety, publishedInUnitedStates, yearOf } from '../loc/rights';
import { rightsAreClear } from '../../core/types/rights';
import { evaluateEligibility } from '../../core/catalog/eligibility';
import type { FrontierLocation } from '../../core/types/location';

const AT = '2026-09-23T00:00:00.000Z';
const SF: FrontierLocation = {
  type: 'earth_surface', celestialBody: 'earth', latitude: 37.7407, longitude: -122.4598,
  displayName: 'San Francisco, California', regionName: 'California', accuracy: 'region',
  coordinateSource: 'Natural Earth populated place "San Francisco" (United States of America): a reference point for the place, not the filming position',
};

/** Shaped like a National Screening Room search result, trimmed. */
function result(over: Partial<LocResult> = {}, item: Partial<NonNullable<LocResult['item']>> = {}): LocResult {
  return {
    id: 'http://www.loc.gov/item/00694408/',
    url: 'https://www.loc.gov/item/00694408/',
    title: 'San Francisco earthquake and fire, April 18, 1906',
    date: '1906',
    location: ['california', 'san francisco'],
    number_lccn: ['00694408'],
    access_restricted: false,
    resources: [{
      video: 'https://tile.loc.gov/storage-services/service/mbrs/ntscrm/00694408/00694408.mp4',
      video_stream: 'https://tile.loc.gov/streaming-services/iiif/service:mbrs:ntscrm:00694408:00694408/full/full/0/full/default.m3u8',
      poster: 'https://tile.loc.gov/storage-services/service/mbrs/ntscrm/00694408/00694408.gif',
      duration: 190, width: 1440, height: 1080,
    }],
    item: {
      title: 'San Francisco earthquake and fire, April 18, 1906',
      date: '1906',
      contributors: ['Edison Manufacturing Co.'],
      created_published: ['United States : Edison Manufacturing Co., 1906.'],
      genre: ['Actualities (Motion pictures)', 'Nonfiction films', 'Short films', 'Silent films'],
      subjects: ['San Francisco Earthquake and Fire, Calif., 1906', 'Buildings--Earthquake effects--California--San Francisco', 'Dewey, George,--1837-1917'],
      summary: ['Ruins of the city after the earthquake and fire.'],
      notes: ['Copyright: Thomas A. Edison; 1906.', 'H79071 U.S. Copyright Office'],
      ...item,
    },
    ...over,
  };
}

describe('LoC rights, from the item record', () => {
  it('clears a U.S. Government production', () => {
    const r = locRights({ date: '1939', contributors: ['United States. Department of Agriculture. Motion Picture Service'] }, AT);
    expect(r.classification).toBe('government_work');
    expect(rightsAreClear(r)).toBe(true);
    expect(isFederalProduction({ sourceCollection: ['U.S. Government Films Collection (Library of Congress)'] })).toBe(true);
  });

  it('clears a U.S. publication of 1930 or earlier, and a registration note is not a restriction', () => {
    const r = locRights({ date: '1906', createdPublished: ['United States : Edison Manufacturing Co., 1906.'], notes: ['H79071 U.S. Copyright Office'] }, AT);
    expect(r.classification).toBe('public_domain');
    expect(r.basis).toBe('loc:us-publication-1906-term-expired');
    expect(r.attributionText).toMatch(/Library of Congress/);
  });

  it('rejects a later film, a foreign film, an undated one and a restricted one', () => {
    expect(locRights({ date: '1945', createdPublished: ['United States : Paramount, 1945.'] }, AT).classification).toBe('unknown');
    expect(locRights({ date: '1897', createdPublished: ['France : La Société Lumière, 1897.'] }, AT).classification).toBe('unknown');
    expect(locRights({ createdPublished: ['United States'] }, AT).basis).toBe('loc:no-date');
    expect(locRights({ date: '1910', createdPublished: ['United States'], notes: ['Shown by special permission.'] }, AT).basis).toBe('loc:record-notes-a-restriction');
    expect(locRights({ date: '1910', createdPublished: ['[United States?]'] }, AT).classification).toBe('unknown');
  });

  it('reads years and places of publication', () => {
    expect(yearOf('[between 1936 and 1937]')).toBe(1936);
    expect(yearOf(undefined)).toBeUndefined();
    expect(publishedInUnitedStates({ createdPublished: ['[United States : Edison Manufacturing Co., 1898]'] })).toBe(true);
  });
});

describe('LoC editorial and safety filters', () => {
  it('keeps actualities and newsreels, drops fiction and performance', () => {
    expect(locIsFootage(['Actualities (Motion pictures)', 'Short films'])).toBe(true);
    expect(locIsFootage(['Newsreels'])).toBe(true);
    expect(locIsFootage(['Fiction films', 'Short films'])).toBe(false);
    expect(locIsFootage(['Nonfiction films', 'Filmed vaudeville acts'])).toBe(false);
    expect(locIsFootage(['Short films', 'Silent films'])).toBe(false);
  });

  it('flags slurs and the catalog\'s own headings for caricature and violence', () => {
    expect(locSafety('Watermelon contest', ['African Americans--Caricatures and cartoons'], []).disturbingContent).toBe(true);
    expect(locSafety('A pickaninny dance', [], []).disturbingContent).toBe(true);
    expect(locSafety('Execution of Czolgosz', ['Executions and executioners'], []).disturbingContent).toBe(true);
    expect(locSafety('Panoramic view of Monte Carlo', ['Monte Carlo (Monaco)'], []).disturbingContent).toBe(false);
  });

  it('tidies subject headings and drops the ones that name people', () => {
    expect(tidyHeading('hurricanes--texas--galveston')).toBe('Hurricanes, Texas, Galveston');
    expect(tidyHeading('Dewey, George,--1837-1917')).toBe('');
    expect(tidyHeading('stevens, george,--1904-1975,--depicted')).toBe('');
  });

  it('decides the kind of place from the words', () => {
    expect(locEnvironment('Yacht race in New York harbor')).toBe('coast');
    expect(locEnvironment('Niagara Falls in winter')).toBe('freshwater');
    expect(locEnvironment('President McKinley\'s inauguration')).toBe('historic_site');
  });
});

describe('locAdapter.normalize', () => {
  it('produces an eligible HLS item, placed by name, filed as history', () => {
    const item = locAdapter.normalize({ result: result(), place: SF, fetchedAt: AT })!;
    expect(item.id).toBe('loc:00694408');
    expect(item.stream.type).toBe('hls');
    expect(item.stream.url).toMatch(/default\.m3u8$/);
    expect(item.stream.fallbackUrl).toMatch(/\.mp4$/);
    expect(item.subtitle).toBe('1906');
    expect(item.temporal.capturedAt).toBeUndefined();
    expect(item.subjects).toContain('history');
    expect(item.channel).toBe('archives');
    expect(item.location?.accuracy).toBe('region');
    expect(item.tags).toContain('1900s');
    expect(item.tags.join(' ')).not.toMatch(/Dewey/);
    expect(evaluateEligibility(item)).toEqual({ eligible: true, reasons: [] });
  });

  it('drops fiction, unplaced and restricted records', () => {
    expect(locAdapter.normalize({ result: result({}, { genre: ['Fiction films'] }), place: SF, fetchedAt: AT })).toBeNull();
    expect(locAdapter.normalize({ result: result(), place: null, fetchedAt: AT })).toBeNull();
    expect(locAdapter.normalize({ result: result({ access_restricted: true }), place: SF, fetchedAt: AT })).toBeNull();
  });

  it('skips a page that keeps failing and carries on with the next', async () => {
    const adapter = new LibraryOfCongressAdapter(async () => null);
    const fake = (async (url: string) => {
      const page = Number(new URL(url).searchParams.get('sp'));
      if (page === 2) return new Response('not found', { status: 404 });
      const r = result({ number_lccn: [`p${page}`] });
      return new Response(JSON.stringify({ results: [r], pagination: { next: page < 3 ? 'more' : null } }));
    }) as unknown as typeof fetch;
    const raws = await adapter.fetchItems({ fetchImpl: fake });
    expect(raws.map((x) => x.result.number_lccn?.[0])).toEqual(['p1', 'p3']);
  });

  it('pages the collection and resolves places with the injected gazetteer', async () => {
    const adapter = new LibraryOfCongressAdapter(async () => ({
      source: 't',
      cities: [['San Francisco', 'California', 'United States of America', 37.7407, -122.4598, 3450000]],
      admin1: [['California', 'United States of America', 36.7496, -119.591]],
      countries: [],
    }));
    const fake = (async () => new Response(JSON.stringify({ results: [result()], pagination: { next: null } }))) as unknown as typeof fetch;
    const raws = await adapter.fetchItems({ fetchImpl: fake });
    expect(raws).toHaveLength(1);
    expect(raws[0].place?.displayName).toBe('San Francisco, California');
  });
});
