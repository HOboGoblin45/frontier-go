import { describe, expect, it } from 'vitest';
import { cleanDescription, cleanTitle, decodeEntities, stripEmoji, MAX_TITLE } from '../catalog/text';

// Every input below is a real title or description from the shipped catalog.
describe('cleanTitle', () => {
  it('turns agency file names into titles', () => {
    expect(cleanTitle('Apollo_11_Intro_720p')).toBe('Apollo 11 Intro');
    expect(cleanTitle('iss060m262481254_Hurricane_Dorian_Live_Views_Sept_5_2019_0905')).toBe('Hurricane Dorian Live Views Sept 5');
    expect(cleanTitle('jsc2020m000166_DM-2_Docking_200531')).toBe('DM-2 Docking');
    expect(cleanTitle('JPL-20220811-Europa Clipper Arrives in its New Home-UHD_wMetadata')).toBe('Europa Clipper Arrives in its New Home');
    expect(cleanTitle('JPL-20190326-TECHf-0001-Mars Helicopter VF')).toBe('Mars Helicopter');
    expect(cleanTitle('NTV Video File-Soyuz MS-19 Landing')).toBe('Soyuz MS-19 Landing');
    expect(cleanTitle('jsc2021m000213_Crew-3_Training_Resource_Reel-UHD_2110121')).toBe('Crew-3 Training Resource Reel');
  });

  it('drops durations and date stamps but keeps a real year', () => {
    expect(cleanTitle('35sec Green Run Clip 03182021 - with Test Conductor Audio')).toBe('Green Run Clip - with Test Conductor Audio');
    expect(cleanTitle('jscm001441_Top_20_Earth_Images_of_2020-4kMP4')).toBe('Top 20 Earth Images of 2020');
  });

  it('separates joined words without breaking mission names', () => {
    expect(cleanTitle('OSIRIS-REx_flight_operations_BeauBierhaus')).toBe('OSIRIS-REx flight operations Beau Bierhaus');
    expect(cleanTitle('jsc2019m000372_Preparing America for DeepSpace_Episode21_ Backbone of Lunar Exploration'))
      .toBe('Preparing America for Deep Space Episode 21 Backbone of Lunar Exploration');
  });

  it('stops shouting and keeps acronyms', () => {
    expect(cleanTitle('HURRICANE IDALIA IS SEEN FROM THE INTERNATIONAL SPACE STATION AFTER LANDFALL'))
      .toBe('Hurricane Idalia Is Seen from the International Space Station After Landfall');
    expect(cleanTitle('SPACE STATION CAMERAS PROVIDE VIEWS OF HURRICANE ZETA')).toBe('Space Station Cameras Provide Views of Hurricane Zeta');
    expect(cleanTitle('ISS CREW WATCHES A CME')).toBe('ISS Crew Watches a CME');
  });

  it('unwraps a title quoted whole, but not a nickname inside one', () => {
    expect(cleanTitle('"Cock-Eye Squid"')).toBe('Cock-Eye Squid');
    expect(cleanTitle('“Casper” Octopus')).toBe('“Casper” Octopus');
    expect(cleanTitle('"Big Red" Jelly')).toBe('"Big Red" Jelly');
  });

  it('cuts a description that was glued onto the title', () => {
    const glued = "Perseverance Rover's Mastcam-Z Captures Ingenuity's Third FlightNASA’s Ingenuity Mars Helicopter takes off and lands in this video captured on April 25, 2021, by Mastcam-Z, an imager aboard NASA’s Perseverance Mars rover.";
    expect(cleanTitle(glued)).toBe("Perseverance Rover's Mastcam-Z Captures Ingenuity's Third Flight");
  });

  it('never returns more than a screen can carry', () => {
    const long = `Descent ${'through the midwater '.repeat(20)}`;
    expect(cleanTitle(long).length).toBeLessThanOrEqual(MAX_TITLE);
  });

  it('leaves an ordinary title exactly as it was', () => {
    for (const t of ['Swipe of the Sword', 'Dumbo Octopus', 'RS-25 Engine Test', 'Artemis II Rollout to Pad 39B', 'NASA’s OCO-3: A New View of Carbon (mission overview)']) {
      expect(cleanTitle(t)).toBe(t);
    }
  });
});

describe('text hygiene', () => {
  it('decodes the entities WordPress leaves in excerpts', () => {
    expect(decodeEntities('offers scientists unique&#8230;')).toBe('offers scientists unique…');
    expect(decodeEntities('&#8216;quoted&#8217; &amp; more &hellip;')).toBe('‘quoted’ & more …');
    expect(decodeEntities('&bogus; stays')).toBe('&bogus; stays');
  });

  it('removes emoji but keeps typographic symbols', () => {
    expect(stripEmoji('what a find \u{1F60D} today')).toBe('what a find today');
    expect(stripEmoji('4°C · 3,000 m → surface…')).toBe('4°C · 3,000 m → surface…');
  });

  it('cleans a description without inventing one', () => {
    expect(cleanDescription(undefined)).toBeUndefined();
    expect(cleanDescription('   ')).toBeUndefined();
    expect(cleanDescription('A rare encounter with a swordfish feeding. Feeding events like this are unique&#8230;'))
      .toBe('A rare encounter with a swordfish feeding. Feeding events like this are unique…');
  });
});
