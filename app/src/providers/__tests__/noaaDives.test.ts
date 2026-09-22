import { describe, expect, it } from 'vitest';
import {
  annotationTimeToUnix,
  buildSegments,
  downsampleTrack,
  parseAnnotations,
  parseCsv,
  parseDiveSummary,
  parsePosition,
  parseSummaryPdf,
  parseTrack1Hz,
  segmentStartUnix,
} from '../noaaDives/parse';
import { dataOffset, locateCentralDirectory, parseCentralDirectory, readZip64Record } from '../noaaDives/zip';
import { groupFor } from '../../core/dives/groups';

// Excerpts of the real files, byte for byte where the shape matters.

const SUMMARY_2021 = `      Dive Summary:  EX2104_DIVE05
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
Dive Type:  Normal

In Water:   2021-07-08T12:29:21.504715
            35.81778540018143 ; -52.30410728377038

On Bottom:  2021-07-08T15:00:04.124572
            35.81691333537716 ; -52.30754403678888

Off Bottom: 2021-07-08T18:11:32.553007
            35.81920738090138 ; -52.30538648500032

Out Water:  2021-07-08T20:38:30.129788
            35.81329776889289 ; -52.31564047958076

Dive Duration:  8:9:8

Bottom Time:    3:11:28

Max Vehicle Depth:     4187.2 m

Min Seafloor Depth:    4095.6 m
`;

// 2014: degree-minute positions, "Max. depth", events out of order, latin-1 degree sign.
const SUMMARY_2014 = "\t  Dive Summary:\tEX1404L3_DIVE03\r\n^^^^^\r\nIn Water at:\t\t 2014-09-21T12:19:07.584000\r\n\t\t\t 39Â°, 42.414' N ; 071Â°, 35.914' W\r\n\r\nOut Water at:\t\t 2014-09-21T20:37:58.083000\r\n\t\t\t 39Â°, 41.882' N ; 071Â°, 35.468' W\r\n\r\nOff Bottom at:\t\t 2014-09-21T19:08:24.256000\r\n\t\t\t 39Â°, 42.072' N ; 071Â°, 35.787' W\r\n\r\nOn Bottom at:\t\t 2014-09-21T13:02:54.561000\r\n\t\t\t 39Â°, 42.414' N ; 071Â°, 35.914' W\r\n\r\nDive duration:\t\t 8:18:50\r\n\r\nBottom Time:\t\t 6:5:29\r\n\r\nMax. depth: \t\t 1358.2 m\r\n";

const TRACK_2021 = `DATE,TIME,UNIXTIME,DEPTH,ALT,LAT_DD,LON_DD
07/08/2021,12:20:06.456000,1625746806.456,0.4,,,
07/08/2021,12:20:07.421000,1625746807.421,0.4,,,
07/08/2021,17:53:24.446000,1625766804.446,-4121.3,1.6,35.81879263554854,-52.30587301918166
07/08/2021,17:53:25.454000,1625766805.4540002,-4121.3,1.6,35.81879030552705,-52.30587314181437
`;

const TRACK_2014 = `date(mm/dd/yyyy),time(HH:MM:SS.SSS),time (unix sec),lat (dec. deg.), lon (dec. deg.), depth (m), alt (m)
09/21/2014,12:22:35.000,1411302155.000,39.706214815097,-71.598381189462,  76.5,  nan
09/21/2014,12:22:36.000,1411302156.000,39.706214650738,-71.598381662281,  77.2,  nan
09/21/2014,16:32:34.000,1411317154.000,39.706885174679,-71.596915322513,1231.4, 14.9
`;

const PDF_LAYOUT = `ROV Dive Summary, EX-21-04, Dive 05, July
               8, 2021
General Location Map

Dive Information
  Site Name       Rockaway Seamount

   General Area   Corner Rise Seamounts
 Descriptor
   Science Team   Rhian Waller, Jason Chaytor, Kira Mizell
   Leads
   Expedition     Kasey Cantwell
   Coordinator
                                                                                         1
\f Mapping Lead          Shannon Hoy
Dive Purpose           Deep exploration of Rockaway Seamount to visualize the deep flank of this guyot, collect rock
                     samples for aging and composition, and document the biological community present.
Was the dive           No
restricted for
`;

const SEATUBE_HEADER = '"Dive ID","Dive Name","Cruise Name","Start Date","End Date","Annotation ID","Annotation Source","Modified Date","Resource Type ID","Resource ID","Creator First Name","Creator Last Name","Creator Email","Modifier First Name","Modifier Last Name","Modifier Email","To Be Reviewed","Comment","SBECTD9PLUSDEEPDISCOVERER_23978_Temperature","SBECTD9PLUSDEEPDISCOVERER_23978_Temperature Time","SBECTD9PLUSDEEPDISCOVERER_23978_Depth","SBECTD9PLUSDEEPDISCOVERER_23978_Depth Time","Taxonomy","Taxon","Taxon Common Names","Taxon Path","Taxonomy Attributes"';

function seatubeRow(time: string, comment: string, temp: string, depth: string, taxonomy: string, taxon: string, common: string, path: string): string {
  return `2283,"EX2104_DIVE05","EX2104","${time}","${time}",1,"",x,600,1,"Ann","Scientist","a@b.c","","","",false,"${comment.replace(/"/g, '""')}",${temp},x,${depth},x,"${taxonomy}","${taxon}","${common}","${path}",""`;
}

const SEATUBE = [
  '',
  'Logs for Dive 2283 [1]:',
  SEATUBE_HEADER,
  seatubeRow('20210708T122006.451Z', 'EX2104_DIVE05 ROV Launch', '', '', '', '', '', ''),
  seatubeRow('20210708T144103.010Z', '**SCF test', '2.39054', '3810.5224', '', '', '', ''),
  seatubeRow('20210708T150413.972Z', 'boulder formations with sediment in between', '2.25189', '4166.741', 'CMECS', 'Rock Substrate', '', ''),
  seatubeRow('20210708T150450.638Z', 'possible Bolosoma', '2.24793', '4166.9551', 'WoRMS', 'Euplectellidae', '', 'Biota / Animalia / Porifera / Hexactinellida / Hexasterophora / Lyssacinosida / Euplectellidae'),
  seatubeRow('20210708T150511.186Z', 'Lepidisis', '2.24968', '4166.5558', 'WoRMS', 'Isididae', 'bamboo corals', 'Biota / Animalia / Cnidaria / Anthozoa / Octocorallia / Alcyonacea / Calcaxonia / Isididae'),
  seatubeRow('20210708T150843.648Z', '', '2.25963', '4167.6563', 'WoRMS', 'Galatheidae', 'squat lobsters', 'Biota / Animalia / Arthropoda / Crustacea / Decapoda / Anomura / Galatheidae'),
  seatubeRow('20210708T150856.000Z', '', '2.25963', '4167.6563', 'WoRMS', 'Galatheidae', 'squat lobsters', 'Biota / Animalia / Arthropoda / Crustacea / Decapoda / Anomura / Galatheidae'),
  seatubeRow('20210708T152000.000Z', 'a "quoted", note', '2.2', '4170', 'WoRMS', 'Hexactinellida', 'glass sponges; hexactinellid sponges', 'Biota / Animalia / Porifera / Hexactinellida'),
].join('\n');

const LEGACY = `
Logs for Dive 1233 [1]:
"Observation Id","Time (UTC)","Description","Tags","Resource Name","Latitude","Longitude","Depth","Heading","Modified By","Last Modified (UTC)"
1560303,16-Jun-2018 21:06:37,"EX1806_DIVE03 ROV Recovery Complete","","","","","","","Someone",16-Jun-2018 21:06:37
1591084,16-Jun-2018 18:40:21,"Primary Unconsolidated Secondary Unconsolidated:","Substrate","","31.16588","-75.66326","3309.9","294.6","Someone",16-Jun-2018 18:40:28
1591054,16-Jun-2018 18:34:49,"Porifera Hexactinellida (Glass Sponge):","Bio Observation","","31.16574","-75.66304","3312.4","69.0","Someone",16-Jun-2018 18:34:56
1591055,16-Jun-2018 18:20:01,"Mollusca Cephalopoda Octopoda (Octopus): dumbo","Bio Observation","","31.1657","-75.663","3300.0","69.0","Someone",16-Jun-2018 18:34:56
1570134,16-Jun-2018 17:56:04,"Mollusca (Mollusc): Octopoda","Bio Observation","","26.37757","-84.76982","509.0","16.3","Someone",16-Jun-2018 17:56:28
`;

describe('dive summary', () => {
  it('reads the 2021 format: decimal positions and "Max Vehicle Depth"', () => {
    const s = parseDiveSummary(SUMMARY_2021);
    expect(s.events.map((e) => e.kind)).toEqual(['in_water', 'on_bottom', 'off_bottom', 'out_water']);
    expect(s.events[1].unix).toBeCloseTo(Date.UTC(2021, 6, 8, 15, 0, 4) / 1000 + 0.124572, 3);
    expect(s.events[1].lat).toBeCloseTo(35.8169, 4);
    expect(s.events[1].lon).toBeCloseTo(-52.3075, 4);
    expect(s.maxDepthMeters).toBe(4187.2);
    expect(s.bottomSeconds).toBe(3 * 3600 + 11 * 60 + 28);
  });

  it('reads the 2014 format: degree-minute positions, "Max. depth", and sorts events', () => {
    const s = parseDiveSummary(SUMMARY_2014);
    expect(s.events.map((e) => e.kind)).toEqual(['in_water', 'on_bottom', 'off_bottom', 'out_water']);
    expect(s.events[1].lat).toBeCloseTo(39 + 42.414 / 60, 5);
    expect(s.events[1].lon).toBeCloseTo(-(71 + 35.914 / 60), 5);
    expect(s.maxDepthMeters).toBe(1358.2);
  });

  it('parses both position spellings and rejects anything else', () => {
    expect(parsePosition('   35.81778540018143 ; -52.30410728377038')).toEqual({ lat: 35.81778540018143, lon: -52.30410728377038 });
    expect(parsePosition("25°, 40.790' N ; 084°, 37.331' W")!.lon).toBeCloseTo(-84.62218, 4);
    expect(parsePosition('N/A ; N/A')).toBeUndefined();
  });
});

describe('dive summary PDF', () => {
  it('reads site, area and a purpose that wraps', () => {
    const p = parseSummaryPdf(PDF_LAYOUT);
    expect(p.site).toBe('Rockaway Seamount');
    expect(p.area).toBe('Corner Rise Seamounts');
    expect(p.purpose).toBe('Deep exploration of Rockaway Seamount to visualize the deep flank of this guyot, collect rock samples for aging and composition, and document the biological community present.');
  });

  it('never picks up the science team', () => {
    expect(JSON.stringify(parseSummaryPdf(PDF_LAYOUT))).not.toContain('Waller');
  });
});

describe('1 Hz track', () => {
  it('reads the 2021 header, turns negative elevation into depth, and nulls missing positions', () => {
    const t = parseTrack1Hz(TRACK_2021);
    expect(t.unix).toHaveLength(4);
    expect(t.depth[2]).toBe(4121.3);
    expect(t.lat[0]).toBeNull();
    expect(t.lat[2]).toBeCloseTo(35.8188, 4);
  });

  it('reads the 2014 header with padded values and "nan"', () => {
    const t = parseTrack1Hz(TRACK_2014);
    expect(t.depth).toEqual([76.5, 77.2, 1231.4]);
    expect(t.lon[0]).toBeCloseTo(-71.59838, 5);
  });

  it('downsamples relative to the dive start and keeps the last sample', () => {
    const raw = { unix: [100, 101, 102, 130, 131, 175], depth: [1, 2, 3, 4, 5, 6.06], lat: [1, 1, 1, 1, 1, 1.123456], lon: [2, 2, 2, 2, null, 2] };
    const d = downsampleTrack(raw, 100, 30);
    expect(d.t).toEqual([0, 30, 75]);
    expect(d.depth).toEqual([1, 4, 6.1]);
    expect(d.lat[2]).toBe(1.12346);
  });
});

describe('video segments', () => {
  it('keeps the main camera continuous recording only', () => {
    expect(segmentStartUnix('EX2104_VID_20210708T150459Z_ROVHD_Low.mp4')).toBe(Date.UTC(2021, 6, 8, 15, 4, 59) / 1000);
    expect(segmentStartUnix('EX2104_VID_20210708T150459Z_CPHD_Low.mp4')).toBeUndefined();
    expect(segmentStartUnix('EX2104_VID_20210708T122052Z_ROVAFT_LAUNCH_Low.mp4')).toBeUndefined();
    expect(segmentStartUnix('EX1605L1_VID_20160422T205338Z_ROVHD_WATER_COLUMN_UNK_Low.mov')).toBeUndefined();
  });

  it('orders segments, derives lengths from the gaps, and reads the last from its size', () => {
    const start = Date.UTC(2021, 6, 8, 12, 20, 0) / 1000;
    const segs = buildSegments([
      { name: 'EX2104_DIVE05_20210708/Compressed/EX2104_VID_20210708T122459Z_ROVHD_Low.mp4', size: 68_881_847 },
      { name: 'EX2104_DIVE05_20210708/Compressed/EX2104_VID_20210708T122041Z_ROVHD_Low.mp4', size: 59_153_624 },
      { name: 'EX2104_DIVE05_20210708/Compressed/EX2104_VID_20210708T123000Z_ROVHD_Low.mp4', size: 23_000_000 },
      { name: 'EX2104_DIVE05_20210708/Compressed/EX2104_VID_20210708T123000Z_CPHD_Low.mp4', size: 1 },
    ], start);
    expect(segs.map((s) => s.t)).toEqual([41, 299, 600]);
    expect(segs.map((s) => s.duration)).toEqual([258, 300, 100]);
    expect(segs[0].file).toBe('EX2104_VID_20210708T122041Z_ROVHD_Low.mp4');
  });
});

describe('annotations', () => {
  const start = Date.UTC(2021, 6, 8, 12, 20, 6) / 1000;

  it('keeps living things from SeaTube exports, with depth and temperature, and drops the rest', () => {
    const s = parseAnnotations(SEATUBE, start);
    expect(s.map((x) => x.group)).toEqual(['Glass sponges', 'Bamboo corals', 'Squat lobsters', 'Glass sponges']);
    expect(s[0]).toMatchObject({ taxon: 'Euplectellidae', note: 'possible Bolosoma', depth: 4167, tempC: 2.25 });
    expect(s[1].common).toBe('bamboo corals');
    expect(s[3].common).toBe('glass sponges');
    expect(s[3].note).toBe('a "quoted", note');
    expect(s[0].t).toBeCloseTo(Date.UTC(2021, 6, 8, 15, 4, 50) / 1000 + 0.638 - start, 1);
  });

  it('collapses the same animal logged twice within 45 seconds', () => {
    const s = parseAnnotations(SEATUBE, start);
    expect(s.filter((x) => x.taxon === 'Galatheidae')).toHaveLength(1);
  });

  it('never carries a scientist\'s name through', () => {
    expect(JSON.stringify(parseAnnotations(SEATUBE, start))).not.toMatch(/Scientist|Ann\b|a@b/);
  });

  it('reads the 2018-19 exports, where the lineage and common name are in the description', () => {
    const s = parseAnnotations(LEGACY, Date.UTC(2018, 5, 16, 13, 0, 0) / 1000);
    expect(s).toHaveLength(3);
    // "Mollusca (Mollusc): Octopoda" is an octopus, named by the note, not a generic mollusc.
    expect(s[0]).toMatchObject({ group: 'Octopus', taxon: 'Octopoda', depth: 509 });
    expect(s[0].common).toBeUndefined();
    expect(s[1]).toMatchObject({ group: 'Octopus', common: 'octopus', taxon: 'Octopoda', depth: 3300, note: 'dumbo' });
    expect(s[2]).toMatchObject({ group: 'Glass sponges', common: 'glass sponge', taxon: 'Hexactinellida' });
    expect(JSON.stringify(s)).not.toContain('Someone');
  });

  it('parses both time spellings as UTC', () => {
    expect(annotationTimeToUnix('20210708T150450.638Z')).toBeCloseTo(Date.UTC(2021, 6, 8, 15, 4, 50) / 1000 + 0.638, 3);
    expect(annotationTimeToUnix('16-Jun-2018 18:34:49')).toBe(Date.UTC(2018, 5, 16, 18, 34, 49) / 1000);
  });

  it('reads quoted CSV with commas, doubled quotes and newlines', () => {
    expect(parseCsv('a,"b,c","d ""e""\nf"\n1,2,3')).toEqual([['a', 'b,c', 'd "e"\nf'], ['1', '2', '3']]);
  });
});

describe('taxon groups', () => {
  it('prefers the most specific group in the lineage', () => {
    expect(groupFor('Biota / Animalia / Mollusca / Cephalopoda / Octopoda / Opisthoteuthidae')!.slug).toBe('octopus');
    expect(groupFor('Biota / Animalia / Mollusca / Cephalopoda')!.slug).toBe('cephalopods');
    expect(groupFor('Biota / Animalia / Cnidaria / Hydrozoa / Siphonophorae')!.slug).toBe('siphonophores');
    expect(groupFor('Biota / Animalia / Echinodermata / Asterozoa / Asteroidea / Brisingida')!.slug).toBe('sea-stars');
    expect(groupFor('Biota / Animalia / Mollusca / Cephalopoda / Decapodiformes / Oegopsida')!.slug).toBe('squid');
  });

  it('does not match inside longer words', () => {
    expect(groupFor('Starfish')).toBeNull();
    expect(groupFor('Rock Substrate')).toBeNull();
  });
});

describe('zip reader', () => {
  function le32(n: number) { const b = new Uint8Array(4); new DataView(b.buffer).setUint32(0, n, true); return b; }
  function le16(n: number) { const b = new Uint8Array(2); new DataView(b.buffer).setUint16(0, n, true); return b; }
  function le64(n: number) { const b = new Uint8Array(8); new DataView(b.buffer).setBigUint64(0, BigInt(n), true); return b; }
  function cat(...parts: Uint8Array[]) { const out = new Uint8Array(parts.reduce((s, p) => s + p.length, 0)); let o = 0; for (const p of parts) { out.set(p, o); o += p.length; } return out; }

  const name = new TextEncoder().encode('D/EX2104_VID_20210708T150459Z_ROVHD_Low.mp4');
  // A ZIP64 central record: sizes and offset in the extra field.
  const extra = cat(le16(1), le16(24), le64(68_909_888), le64(68_739_845), le64(4_638_739_832));
  const central = cat(
    le32(0x02014b50), le16(45), le16(45), le16(0), le16(8), le16(0), le16(0), le32(0),
    le32(0xffffffff), le32(0xffffffff), le16(name.length), le16(extra.length), le16(0), le16(0), le16(0), le32(0), le32(0xffffffff),
    name, extra,
  );

  it('reads ZIP64 sizes and offsets from the extra field', () => {
    const [e] = parseCentralDirectory(central);
    expect(e).toEqual({ name: 'D/EX2104_VID_20210708T150459Z_ROVHD_Low.mp4', method: 8, size: 68_909_888, compressedSize: 68_739_845, offset: 4_638_739_832 });
  });

  it('finds the central directory through the ZIP64 locator', () => {
    const record = cat(le32(0x06064b50), le64(44), le16(45), le16(45), le32(0), le32(0), le64(236), le64(236), le64(21_000), le64(19_672_900_000));
    const locator = cat(le32(0x07064b50), le32(0), le64(19_672_921_000), le32(1));
    const eocd = cat(le32(0x06054b50), le16(0), le16(0), le16(0xffff), le16(0xffff), le32(0xffffffff), le32(0xffffffff), le16(0));
    const loc = locateCentralDirectory(cat(new Uint8Array(100), locator, eocd));
    expect(loc.zip64RecordOffset).toBe(19_672_921_000);
    expect(readZip64Record(record)).toEqual({ entries: 236, size: 21_000, offset: 19_672_900_000 });
  });

  it('computes where a member\'s data starts', () => {
    const local = cat(le32(0x04034b50), new Uint8Array(22), le16(10), le16(20));
    expect(dataOffset({ name: 'x', method: 8, size: 1, compressedSize: 1, offset: 1000 }, local)).toBe(1000 + 30 + 10 + 20);
  });
});

describe('place names', () => {
  it('drops people and depth notes that older summary layouts run into the site field', async () => {
    const { cleanPlaceName } = await import('../noaaDives/parse');
    expect(cleanPlaceName('North Wall of Perdido Canyon / AC 813 Daniel Wagner (Biology) Adam Skarke (Geology)')).toBe('North Wall of Perdido Canyon / AC 813');
    expect(cleanPlaceName('Southern West Florida Escarpment Ridge Daniel Wagner (Biology)')).toBe('Southern West Florida Escarpment Ridge');
    expect(cleanPlaceName('South coast of Tutuila Island, Nautilus exploration (250 – 500 m water depth)')).toBe('South coast of Tutuila Island, Nautilus exploration');
    expect(cleanPlaceName('“Leoso” seamount, ROV on bottom at 3770 m (-12.64986505, -167.27212505)')).toBe('"Leoso" seamount');
    expect(cleanPlaceName('Hydrographer Canyon – Shallow 2')).toBe('Hydrographer Canyon - Shallow 2');
    expect(cleanPlaceName('N/A')).toBeUndefined();
  });
});

describe('expedition titles', () => {
  it('reads NCEI\'s cruise index', async () => {
    const { parseLandingIndex } = await import('../../../tools/dives/crawl');
    const html = `<a href="https://www.ncei.noaa.gov/waf/okeanos-rov-cruises/ex2104"
                       title="Click to load the full details for EX2104">
                        <p style="font-size: 14px;font-weight: bold;text-align: center">Okeanos Explorer (EX2104): 2021 North Atlantic Stepping Stones: New England and Corner Rise Seamounts
                        </p>
                    </a>`;
    expect(parseLandingIndex(html).get('ex2104')).toBe('2021 North Atlantic Stepping Stones: New England and Corner Rise Seamounts');
  });
});

describe('place name labels', () => {
  it('drops a wrapped "Descriptor" label and trailing separators', async () => {
    const { cleanPlaceName } = await import('../noaaDives/parse');
    expect(cleanPlaceName('Descriptor Phoenix Islands Protected Area')).toBe('Phoenix Islands Protected Area');
    expect(cleanPlaceName('Northwest Atlantic Ocean;')).toBe('Northwest Atlantic Ocean');
    expect(cleanPlaceName('Dive 02 - East of Formigas Rift')).toBe('East of Formigas Rift');
  });
});

describe('stills', () => {
  it('keeps main-camera framegrabs in time order', async () => {
    const { buildStills } = await import('../noaaDives/parse');
    const start = Date.UTC(2021, 6, 8, 12, 20, 0) / 1000;
    expect(buildStills([
      'D/EX2104_IMG_20210708T122713Z_ROVHD.jpg',
      'D/EX2104_IMG_20210708T122309Z_ROVHD.jpg',
      'D/EX2104_IMG_20210708T122317Z_CPHD.jpg',
      'D/EX2104_IMG_20210708T122148Z_ROVAFT_LAUNCH.jpg',
    ], start)).toEqual([
      { t: 189, file: 'EX2104_IMG_20210708T122309Z_ROVHD.jpg' },
      { t: 433, file: 'EX2104_IMG_20210708T122713Z_ROVHD.jpg' },
    ]);
  });
});
