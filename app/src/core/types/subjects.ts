/**
 * What a clip is OF, as distinct from where it was shot (location) and what
 * kind of place that is (environment).
 *
 * Subjects are how someone finds "birds", "reptiles" or "the Civil War"
 * anywhere on the globe, and how the globe narrows to one kind of thing. They
 * are derived only from words the provider published about the clip (title,
 * description, keywords, catalog subject headings); nothing is inferred from
 * the pixels, and a clip may have none.
 */
export type FrontierSubject =
  | 'mammals'
  | 'birds'
  | 'reptiles_amphibians'
  | 'fish'
  | 'sea_life'
  | 'insects'
  | 'plants'
  | 'landscapes'
  | 'landmarks'
  | 'history'
  | 'native_heritage'
  | 'deep_sea'
  | 'space';

export const ALL_SUBJECTS: ReadonlyArray<FrontierSubject> = [
  'mammals', 'birds', 'reptiles_amphibians', 'fish', 'sea_life', 'insects', 'plants',
  'landscapes', 'landmarks', 'history', 'native_heritage', 'deep_sea', 'space',
];

export const SUBJECT_LABELS: Readonly<Record<FrontierSubject, string>> = Object.freeze({
  mammals: 'Mammals',
  birds: 'Birds',
  reptiles_amphibians: 'Reptiles and amphibians',
  fish: 'Fish',
  sea_life: 'Sea life',
  insects: 'Insects and spiders',
  plants: 'Plants and fungi',
  landscapes: 'Landscapes',
  landmarks: 'Landmarks',
  history: 'Human history',
  native_heritage: 'Native heritage',
  deep_sea: 'Deep sea',
  space: 'Space',
});

/** The subjects that together make "Animals". */
export const ANIMAL_SUBJECTS: ReadonlyArray<FrontierSubject> = [
  'mammals', 'birds', 'reptiles_amphibians', 'fish', 'sea_life', 'insects',
];

export function isSubject(value: unknown): value is FrontierSubject {
  return typeof value === 'string' && (ALL_SUBJECTS as readonly string[]).includes(value);
}
