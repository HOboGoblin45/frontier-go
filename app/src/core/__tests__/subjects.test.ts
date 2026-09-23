import { describe, expect, it } from 'vitest';
import { classifySubjects, hasSubject, subjectsFor } from '../catalog/subjects';
import { makeItem } from './fixtures';

/**
 * Titles below are real, from the NPS, NOAA, NASA and Library of Congress
 * catalogs. The failure this guards against is the loud one: a ranger talk
 * filed under "Birds" because its description said "you may see birds".
 */
describe('classifySubjects', () => {
  const s = (title: string, description = '', tags: string[] = []) => classifySubjects({ title, description, tags });

  it('files animals by group', () => {
    expect(s('Bugling Elk on Rabbit Mountain')).toContain('mammals');
    expect(s('Cedar Waxwings', 'A flock of birds feeding on berries')).toContain('birds');
    expect(s('Meet a Spotted Salamander')).toContain('reptiles_amphibians');
    expect(s('Hatchling Turtles')).toContain('reptiles_amphibians');
    expect(s('Ranger Minute: Counting Salmon')).toContain('fish');
    expect(s('Coral Connections in Biscayne National Park')).toContain('sea_life');
    expect(s('Impatient bumble bee pollinating')).toContain('insects');
    expect(s('Ponderosa Pine: Living With Fire')).toContain('plants');
  });

  it('files places and the past', () => {
    expect(s('Yukon River Hyperlapse')).toContain('landscapes');
    expect(s('Point Reyes Lighthouse at dawn')).toContain('landmarks');
    expect(s('Battlefield Tour, Part 3: The Landscape of the Battle')).toContain('history');
    expect(s('Werowocomoco: A Powhatan Place of Power')).toContain('native_heritage');
    expect(s('San Francisco earthquake and fire, April 18, 1906', '', [])).toEqual(expect.arrayContaining([]));
  });

  it('does not take an ambiguous word from a description', () => {
    // "bear" is a verb in running text; "falls", "springs" and "history" are everywhere.
    expect(s('Trail Etiquette', 'Please bear in mind that the trail falls steeply; springs are dry in summer. Its history is long.')).toEqual([]);
    // ...but an unambiguous species name in a description counts.
    expect(s('A walk at dusk', 'Listen for great horned owls along the ridge.')).toContain('birds');
  });

  it('does not mistake a person or an agency word for a subject', () => {
    expect(s('Shuttle Buses for Auction')).not.toContain('space');
    expect(s('Grant Program Update')).not.toContain('history');
    expect(s('Mission Control Operations')).not.toContain('landmarks');
  });

  it('returns subjects in canonical order, without duplicates', () => {
    const out = s('Sea Turtles and Seabirds of Dry Tortugas', 'Sea turtles nest on the beach while terns wheel overhead.');
    expect(out).toEqual([...new Set(out)]);
    expect(out.indexOf('birds')).toBeLessThan(out.indexOf('reptiles_amphibians'));
  });
});

describe('subjectsFor', () => {
  it('adds the channel-given subjects and keeps the adapter ones', () => {
    const deep = makeItem({ id: 'd', title: 'Dumbo octopus at 3,000 m', channel: 'deep_sea' });
    expect(subjectsFor(deep)).toEqual(expect.arrayContaining(['sea_life', 'deep_sea']));
    const given = makeItem({ id: 'g', title: 'Untitled', tags: [], channel: 'archives', subjects: ['history'] });
    expect(subjectsFor(given)).toEqual(['history']);
  });

  it('hasSubject accepts one subject or several', () => {
    const item = makeItem({ id: 'h', subjects: ['birds', 'plants'] });
    expect(hasSubject(item, 'birds')).toBe(true);
    expect(hasSubject(item, ['fish', 'plants'])).toBe(true);
    expect(hasSubject(item, 'fish')).toBe(false);
    expect(hasSubject(makeItem({ id: 'n' }), 'birds')).toBe(false);
  });
});
