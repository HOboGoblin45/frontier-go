/**
 * Plain-language animal groups from the scientists' taxonomy.
 *
 * SeaTube logs a WoRMS name and its full lineage ("Biota / Animalia /
 * Mollusca / Cephalopoda / Octopoda / ..."); the older 2018-19 logs write the
 * lineage into the description ("Porifera Hexactinellida (Glass Sponge):").
 * Either way the clade names are there, and a clade name is a fact: the group
 * is read from them, most specific rule first, never guessed from a picture.
 *
 * Each group has a stable slug, because groups are also pages on the website
 * and collections in the app.
 */

export interface TaxonGroup {
  slug: string;
  name: string;
  /** Clade names, matched as whole words anywhere in the lineage or description. */
  clades: string[];
}

export const TAXON_GROUPS: TaxonGroup[] = [
  { slug: 'octopus', name: 'Octopus', clades: ['Octopoda', 'Octopodidae', 'Cirrata', 'Grimpoteuthis', 'Opisthoteuthidae', 'Incirrata'] },
  { slug: 'squid', name: 'Squid', clades: ['Oegopsida', 'Myopsida', 'Teuthida', 'Decapodiformes', 'Vampyroteuthis', 'Vampyromorphida'] },
  { slug: 'cephalopods', name: 'Octopus and squid', clades: ['Cephalopoda'] },
  { slug: 'sharks-rays', name: 'Sharks, rays and chimaeras', clades: ['Elasmobranchii', 'Selachii', 'Batoidea', 'Holocephali', 'Chimaeriformes', 'Chondrichthyes'] },
  { slug: 'anglerfish', name: 'Anglerfish', clades: ['Lophiiformes', 'Ogcocephalidae', 'Ceratioidei'] },
  { slug: 'fish', name: 'Fish', clades: ['Actinopterygii', 'Teleostei', 'Pisces', 'Myxini', 'Actinopteri', 'Fish'] },
  { slug: 'glass-sponges', name: 'Glass sponges', clades: ['Hexactinellida'] },
  { slug: 'sponges', name: 'Sponges', clades: ['Porifera', 'Demospongiae'] },
  { slug: 'black-corals', name: 'Black corals', clades: ['Antipatharia'] },
  { slug: 'stony-corals', name: 'Stony corals', clades: ['Scleractinia'] },
  { slug: 'bamboo-corals', name: 'Bamboo corals', clades: ['Isididae', 'Keratoisididae'] },
  { slug: 'soft-corals', name: 'Soft corals and sea fans', clades: ['Octocorallia', 'Alcyonacea', 'Gorgonacea', 'Pennatulacea', 'Malacalcyonacea', 'Scleralcyonacea'] },
  { slug: 'anemones', name: 'Anemones', clades: ['Actiniaria', 'Ceriantharia', 'Corallimorpharia', 'Zoantharia'] },
  { slug: 'corals-anemones', name: 'Other corals and anemones', clades: ['Hexacorallia', 'Anthozoa'] },
  { slug: 'siphonophores', name: 'Siphonophores', clades: ['Siphonophorae', 'Siphonophora'] },
  { slug: 'jellyfish', name: 'Jellyfish', clades: ['Scyphozoa', 'Hydromedusae', 'Trachymedusae', 'Narcomedusae', 'Cubozoa', 'Leptothecata', 'Anthoathecata'] },
  { slug: 'hydroids', name: 'Hydroids', clades: ['Hydrozoa'] },
  { slug: 'comb-jellies', name: 'Comb jellies', clades: ['Ctenophora'] },
  { slug: 'sea-stars', name: 'Sea stars', clades: ['Asteroidea', 'Brisingida'] },
  { slug: 'brittle-stars', name: 'Brittle stars', clades: ['Ophiuroidea', 'Euryalida'] },
  { slug: 'sea-cucumbers', name: 'Sea cucumbers', clades: ['Holothuroidea'] },
  { slug: 'sea-urchins', name: 'Sea urchins', clades: ['Echinoidea'] },
  { slug: 'sea-lilies', name: 'Sea lilies and feather stars', clades: ['Crinoidea'] },
  { slug: 'echinoderms', name: 'Other echinoderms', clades: ['Echinodermata', 'Echinozoa', 'Asterozoa'] },
  { slug: 'crabs', name: 'Crabs', clades: ['Brachyura', 'Lithodidae', 'Chirostyloidea', 'Chirostylidae'] },
  { slug: 'squat-lobsters', name: 'Squat lobsters', clades: ['Galatheidae', 'Munidopsidae', 'Munidopsis', 'Munididae', 'Galatheoidea'] },
  { slug: 'shrimp', name: 'Shrimp and prawns', clades: ['Caridea', 'Dendrobranchiata', 'Penaeoidea', 'Stenopodidea'] },
  { slug: 'lobsters', name: 'Lobsters', clades: ['Nephropidae', 'Polychelidae', 'Achelata', 'Astacidea'] },
  { slug: 'sea-spiders', name: 'Sea spiders', clades: ['Pycnogonida'] },
  { slug: 'crustaceans', name: 'Other crustaceans', clades: ['Amphipoda', 'Isopoda', 'Mysida', 'Euphausiacea', 'Thecostraca', 'Copepoda', 'Crustacea', 'Decapoda'] },
  { slug: 'snails-clams', name: 'Snails, clams and other molluscs', clades: ['Gastropoda', 'Bivalvia', 'Polyplacophora', 'Scaphopoda', 'Nudibranchia', 'Mollusca'] },
  { slug: 'worms', name: 'Worms', clades: ['Polychaeta', 'Annelida', 'Enteropneusta', 'Sipuncula', 'Echiura', 'Nemertea'] },
  { slug: 'tunicates', name: 'Sea squirts and salps', clades: ['Tunicata', 'Ascidiacea', 'Thaliacea', 'Appendicularia', 'Larvacea', 'Pyrosomatida'] },
  { slug: 'lace-corals', name: 'Lace corals', clades: ['Bryozoa'] },
  { slug: 'lamp-shells', name: 'Lamp shells', clades: ['Brachiopoda'] },
  { slug: 'forams', name: 'Giant single-celled forams', clades: ['Foraminifera', 'Xenophyophorea'] },
];

export const OTHER_LIFE: TaxonGroup = { slug: 'other-life', name: 'Other life', clades: [] };

const byWord = TAXON_GROUPS.map((g) => ({
  group: g,
  re: new RegExp(`\\b(${g.clades.join('|')})\\b`, 'i'),
}));

/**
 * The group for a lineage or free-text description. Rules are tried in the
 * order above, so "Cephalopoda / Octopoda" is Octopus, not the broader group.
 * Returns null when nothing matches, so non-living observations stay out.
 */
export function groupFor(text: string | undefined): TaxonGroup | null {
  if (!text) return null;
  for (const { group, re } of byWord) if (re.test(text)) return group;
  return null;
}

export function groupBySlug(slug: string): TaxonGroup | undefined {
  return slug === OTHER_LIFE.slug ? OTHER_LIFE : TAXON_GROUPS.find((g) => g.slug === slug);
}
