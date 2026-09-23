import type { FrontierMediaItem } from '../types/media';
import type { FrontierSubject } from '../types/subjects';
import { ALL_SUBJECTS } from '../types/subjects';

/**
 * Subject classification, from the provider's own words.
 *
 * Two kinds of evidence. A clip's TITLE and keywords say what it is about, so
 * any cue there counts. Its DESCRIPTION also mentions things in passing ("a
 * trail where you may see bears", "bear in mind"), so only unambiguous names
 * count there: species and group names, not words that are also verbs or
 * place names. Every pattern below was chosen against real titles from the
 * NPS, NOAA, NASA and Library of Congress catalogs; add to them the same way.
 *
 * Deliberately conservative: a clip with no subject is fine (it still plays,
 * still sits on the globe), while a wrong subject puts a ranger talk in
 * "Birds". When in doubt a cue belongs in `titleOnly`.
 */

interface SubjectRule {
  subject: FrontierSubject;
  /** Unambiguous: counts in the title, keywords or description. */
  anywhere?: RegExp;
  /** Ambiguous in running text: counts only in the title or keywords. */
  titleOnly?: RegExp;
}

const RULES: SubjectRule[] = [
  {
    subject: 'mammals',
    anywhere: /\b(mammals?|bison|elk|moose|caribou|pronghorns?|bighorns?|bighorn sheep|mountain goats?|grizzl(y|ies)|black bears?|brown bears?|polar bears?|wol(f|ves)|coyotes?|foxes|bobcats?|cougars?|mountain lions?|lynx|wolverines?|badgers?|beavers?|river otters?|sea otters?|otters?|marmots?|pikas?|prairie dogs?|squirrels?|chipmunks?|porcupines?|raccoons?|opossums?|armadillos?|manatees?|walrus(es)?|sea lions?|elephant seals?|harbor seals?|fur seals?|whales?|dolphins?|porpoises?|orcas?|bats|wild horses|feral horses|burros|javelinas?|monkeys?|primates?)\b/i,
    titleOnly: /\b(bears?|deer|horses?|mustangs?|seals?|bat|cattle|livestock|mules?|buffalo)\b/i,
  },
  {
    subject: 'birds',
    anywhere: /\b(birds?|birding|bird[- ]?watching|bald eagles?|golden eagles?|eagles|hawks?|falcons?|peregrines?|kestrels?|ospreys?|owls?|condors?|vultures?|herons?|egrets?|sandhill cranes?|whooping cranes?|pelicans?|cormorants?|gulls?|terns?|puffins?|albatross(es)?|penguins?|loons?|grebes?|ducks?|geese|swans?|warblers?|songbirds?|sparrows?|wrens?|hummingbirds?|woodpeckers?|ravens?|magpies?|sage[- ]grouse|grouse|ptarmigans?|wild turkeys?|roadrunners?|shorebirds?|sandpipers?|plovers?|seabirds?|waterfowl|raptors?|migratory birds|fledglings?)\b/i,
    titleOnly: /\b(eagle|crows?|jays?|turkeys?|quail|cranes|nest(s|ing)?)\b/i,
  },
  {
    subject: 'reptiles_amphibians',
    anywhere: /\b(reptiles?|amphibians?|herpetolog\w*|snakes?|rattlesnakes?|pythons?|lizards?|geckos?|iguanas?|chuckwallas?|gila monsters?|horned lizards?|skinks?|tortoises?|sea turtles?|turtles?|alligators?|crocodiles?|caimans?|frogs?|toads?|tadpoles?|salamanders?|newts?|hellbenders?)\b/i,
  },
  {
    subject: 'fish',
    anywhere: /\b(fish(es)?|fisheries|salmon|trout|steelhead|sturgeons?|paddlefish|pupfish|minnows?|catfish|sharks?|stingrays?|manta rays?|eels?|anglerfish|grenadiers?|rattails?|lanternfish|halibut|tuna|swordfish|groupers?|snappers?|parrotfish|damselfish|clownfish|seahorses?|fish ladders?|fish hatcher(y|ies))\b/i,
    titleOnly: /\b(bass|cod|carp|rays?|spawning|hatcher(y|ies))\b/i,
  },
  {
    subject: 'sea_life',
    anywhere: /\b(marine life|sea life|ocean life|marine mammals?|corals?|coral reefs?|kelp|seagrass|sea ?stars?|starfish|brittle ?stars?|sea urchins?|sea cucumbers?|anemones?|jellies|jellyfish|siphonophores?|ctenophores?|medusae|octop(us|uses|i)|squids?|cuttlefish|nautilus|crabs?|lobsters?|shrimps?|krill|barnacles?|mussels?|oysters?|clams?|sponges?|sea pens?|nudibranchs?|tunicates?|salps?|plankton|tide ?pools?|intertidal|whales?|dolphins?|porpoises?|orcas?|sea lions?|sea otters?|sea turtles?|manatees?|walrus(es)?)\b/i,
    titleOnly: /\b(reefs?|urchins?|seals?|jelly|underwater)\b/i,
  },
  {
    subject: 'insects',
    anywhere: /\b(insects?|butterfl(y|ies)|moths?|caterpillars?|monarch butterfl(y|ies)|bumble ?bees?|honey ?bees?|native bees|wasps?|hornets?|beetles?|ladybugs?|dragonfl(y|ies)|damselfl(y|ies)|fireflies|firefly|lightning bugs?|cicadas?|crickets?|grasshoppers?|locusts?|mosquito(es)?|termites?|spiders?|tarantulas?|scorpions?|arachnids?|pollinators?)\b/i,
    titleOnly: /\b(bugs?|bees?|ants|monarchs?)\b/i,
  },
  {
    subject: 'plants',
    anywhere: /\b(botan\w*|wildflowers?|flowers?|blooms?|blooming|blossoms?|trees|redwoods?|sequoias?|bristlecones?|aspens?|mangroves?|cact(us|i)|saguaros?|joshua trees?|yuccas?|agaves?|ferns?|mosses|lichens?|fung(us|i)|mushrooms?|seedlings?|fall colou?rs?|autumn leaves|foliage|old[- ]growth|native plants?|invasive plants?|rare plants?|plant species|plant life|algae|seaweed|kelp forests?)\b/i,
    titleOnly: /\b(plants?|tree|forests?|woodlands?|pines?|oaks?|maples?|cypress|grasses|seeds?|leaves)\b/i,
  },
  {
    subject: 'landscapes',
    anywhere: /\b(time[- ]?lapse|scenic|scenery|panoram(a|ic)|landscapes?|vistas?|geysers?|geyser basins?|hot springs|glaciers?|ice ?fields?|icebergs?|waterfalls?|sand dunes?|badlands|hoodoos?|caverns?|stalactites?|stalagmites?|karst|lava flows?|calderas?|night sky|milky way|aurora|northern lights|rock formations?)\b/i,
    titleOnly: /\b(canyons?|gorges?|mesas?|buttes?|arches|natural bridges?|mountains?|peaks?|summits?|ridges?|falls|rivers?|creeks?|streams?|lakes?|ponds?|springs?|volcan(o|oes|ic)|lava|craters?|deserts?|dunes?|prairies?|grasslands?|meadows?|valleys?|wetlands?|marsh(es)?|swamps?|bayous?|everglades|coast(line)?s?|beach(es)?|shorelines?|seashores?|cliffs?|islands?|caves?|sunrise|sunset|stars|storms?|snow|geolog\w*|fossils?)\b/i,
  },
  {
    subject: 'landmarks',
    anywhere: /\b(statue of liberty|mount rushmore|golden gate bridge|brooklyn bridge|lincoln memorial|washington monument|jefferson memorial|united states capitol|u\.s\. capitol|white house|old faithful|half dome|el capitan|devils tower|delicate arch|liberty bell|independence hall|gateway arch|eiffel tower|tour eiffel|panama canal|ellis island|alcatraz|cliff dwellings?|lighthouses?|light ?stations?)\b/i,
    titleOnly: /\b(memorials?|monuments?|statues?|cathedrals?|castles?|forts?|fortress|spanish missions?|mission church|pueblos?|landmarks?|capitol|courthouses?|mansions?|bridges?|domes?|arch)\b/i,
  },
  {
    subject: 'history',
    anywhere: /\b(civil war|revolutionary war|american revolution|war of 1812|world war (i|ii|one|two|1|2)\b|first world war|second world war|wwi+|spanish-american war|mexican-american war|battlefields?|soldiers|regiments?|colonial|colonists?|pioneers?|homestead(ers?|ing)|westward expansion|oregon trail|santa fe trail|pony express|gold rush|klondike|underground railroad|enslaved|enslavement|slavery|abolition\w*|emancipation|reconstruction era|civil rights|suffrage|suffragists?|segregation|immigrants?|immigration|industrial revolution|railroads?|railways?|steamboats?|shipwrecks?|archaeolog\w*|archeolog\w*|artifacts?|excavations?|ancient|prehistoric|petroglyphs?|pictographs?|18\d0s|19[0-5]0s|newsreels?|world'?s fair|exposition universelle|pan-american exposition|inaugurations?|presidents?)\b/i,
    titleOnly: /\b(histor(y|ic|ical)|heritage|battles?|war|forts?|century|centuries|mills?|canals?|parades?|funerals?|founding|lincoln|jefferson|roosevelt|douglass|tubman)\b/i,
  },
  {
    subject: 'native_heritage',
    anywhere: /\b(native americans?|american indians?|indigenous|tribal|first nations|alaska natives?|native hawaiians?|ancestral puebloans?|pueblo people|navajo|din[eé] people|hopi|zuni|lakota|cherokee nation|choctaw|muscogee|ojibwe|anishinaabe|chippewa|nez perce|blackfeet|shoshone|comanche|kiowa|arapaho|pawnee|mandan|hidatsa|tlingit|haida|yup'?ik|inupiat?|unangan|wampanoag|powhatan|haudenosaunee|iroquois|mound builders|petroglyphs?|pictographs?)\b/i,
    titleOnly: /\b(tribes?|apache|cherokee|seminole|osage|cheyenne|ute|crow|mohawk|seneca|paiute|dakota|sioux)\b/i,
  },
  {
    subject: 'deep_sea',
    anywhere: /\b(deep[- ]sea|deep ocean|seafloor|sea ?floor|abyss\w*|hadal|seamounts?|hydrothermal vents?|cold seeps?|brine pools?|remotely operated vehicle)\b/i,
  },
  {
    subject: 'space',
    anywhere: /\b(spacecraft|space station|spacewalks?|astronauts?|cosmonauts?|in orbit|orbital|orbiting|rockets?|liftoff|lunar|moonwalk|martian|mars rover|asteroids?|comets?|planets?|galax(y|ies)|nebula[e]?|space telescopes?)\b/i,
    titleOnly: /\b(mars|moon|apollo|artemis|gemini|skylab|space shuttle|launch|rover|telescopes?)\b/i,
  },
];

export interface SubjectEvidence {
  title: string;
  description?: string;
  tags?: readonly string[];
  /** Catalog subject headings or topics that describe THIS clip, not its site. */
  headings?: readonly string[];
}

export function classifySubjects(e: SubjectEvidence): FrontierSubject[] {
  const strong = [e.title, ...(e.tags || []), ...(e.headings || [])].join(' • ');
  const weak = e.description || '';
  const found = new Set<FrontierSubject>();
  for (const rule of RULES) {
    if (rule.anywhere && (rule.anywhere.test(strong) || rule.anywhere.test(weak))) found.add(rule.subject);
    else if (rule.titleOnly && rule.titleOnly.test(strong)) found.add(rule.subject);
  }
  return ALL_SUBJECTS.filter((s) => found.has(s));
}

/**
 * What the pipeline stores: the adapter's own subjects (from structured
 * provider data, such as a channel that is space by construction) plus what
 * the words support, in canonical order.
 */
export function subjectsFor(item: Pick<FrontierMediaItem, 'title' | 'description' | 'tags' | 'subjects' | 'channel' | 'channels'>): FrontierSubject[] {
  const found = new Set<FrontierSubject>([
    ...(item.subjects || []),
    ...classifySubjects({ title: item.title, description: item.description, tags: item.tags }),
  ]);
  if (item.channel === 'deep_sea') found.add('deep_sea');
  if (item.channel === 'space') found.add('space');
  // The History channel is history by construction: a historic site, an
  // archive film, Apollo.
  if (item.channel === 'archives') found.add('history');
  return ALL_SUBJECTS.filter((s) => found.has(s));
}

export function hasSubject(item: Pick<FrontierMediaItem, 'subjects'>, subject: FrontierSubject | ReadonlyArray<FrontierSubject>): boolean {
  const list = item.subjects;
  if (!list || list.length === 0) return false;
  return Array.isArray(subject) ? subject.some((s) => list.includes(s)) : list.includes(subject as FrontierSubject);
}
