// redesign SC-B1 (M-SC05): the words of the school catalog values (C/constants/school.js). `main` painted the raw value
// (`gluten_free`) and built the grade keys by hand; the i18n scanner does not see a key that is built, so every key here is a
// LITERAL `t()` call in a map (i18n flow §5, D-22). A value the map does not know is shown as it came, never undefined or empty.

const has = (map, value) => Object.prototype.hasOwnProperty.call(map, value)

// a value that is nothing to show
const isBlank = (value) => value === null || value === undefined || value === ''

const labelFrom = (map) => (t, value) => {
  if (isBlank(value)) return ''
  return has(map, value) ? map[value](t) : String(value)
}

const ALLERGENS = {
  nuts: (t) => t('SCHOOL_ALLERGEN_NUTS', 'Nuts'),
  peanuts: (t) => t('SCHOOL_ALLERGEN_PEANUTS', 'Peanuts'),
  dairy: (t) => t('SCHOOL_ALLERGEN_DAIRY', 'Dairy'),
  gluten: (t) => t('SCHOOL_ALLERGEN_GLUTEN', 'Gluten'),
  eggs: (t) => t('SCHOOL_ALLERGEN_EGGS', 'Eggs'),
  soy: (t) => t('SCHOOL_ALLERGEN_SOY', 'Soy'),
  fish: (t) => t('SCHOOL_ALLERGEN_FISH', 'Fish'),
  shellfish: (t) => t('SCHOOL_ALLERGEN_SHELLFISH', 'Shellfish'),
  sesame: (t) => t('SCHOOL_ALLERGEN_SESAME', 'Sesame'),
  wheat: (t) => t('SCHOOL_ALLERGEN_WHEAT', 'Wheat')
}

const DIETARY_TAGS = {
  vegan: (t) => t('SCHOOL_DIETARY_VEGAN', 'Vegan'),
  vegetarian: (t) => t('SCHOOL_DIETARY_VEGETARIAN', 'Vegetarian'),
  gluten_free: (t) => t('SCHOOL_DIETARY_GLUTEN_FREE', 'Gluten free'),
  dairy_free: (t) => t('SCHOOL_DIETARY_DAIRY_FREE', 'Dairy free'),
  nut_free: (t) => t('SCHOOL_DIETARY_NUT_FREE', 'Nut free'),
  halal: (t) => t('SCHOOL_DIETARY_HALAL', 'Halal'),
  kosher: (t) => t('SCHOOL_DIETARY_KOSHER', 'Kosher'),
  low_sugar: (t) => t('SCHOOL_DIETARY_LOW_SUGAR', 'Low sugar')
}

// the keys and texts main built in S/SchoolGrades/index.js (`SCHOOL_GRADE_${code.toUpperCase()}`)
const GRADE_CODES = {
  pre_k: (t) => t('SCHOOL_GRADE_PRE_K', 'Pre-K'),
  k: (t) => t('SCHOOL_GRADE_K', 'Kindergarten'),
  g1: (t) => t('SCHOOL_GRADE_G1', 'Grade 1'),
  g2: (t) => t('SCHOOL_GRADE_G2', 'Grade 2'),
  g3: (t) => t('SCHOOL_GRADE_G3', 'Grade 3'),
  g4: (t) => t('SCHOOL_GRADE_G4', 'Grade 4'),
  g5: (t) => t('SCHOOL_GRADE_G5', 'Grade 5'),
  g6: (t) => t('SCHOOL_GRADE_G6', 'Grade 6'),
  g7: (t) => t('SCHOOL_GRADE_G7', 'Grade 7'),
  g8: (t) => t('SCHOOL_GRADE_G8', 'Grade 8'),
  g9: (t) => t('SCHOOL_GRADE_G9', 'Grade 9'),
  g10: (t) => t('SCHOOL_GRADE_G10', 'Grade 10'),
  g11: (t) => t('SCHOOL_GRADE_G11', 'Grade 11'),
  g12: (t) => t('SCHOOL_GRADE_G12', 'Grade 12')
}

export const allergenLabel = labelFrom(ALLERGENS)
export const dietaryLabel = labelFrom(DIETARY_TAGS)
export const gradeCodeLabel = labelFrom(GRADE_CODES)

/** The grade codes as select options, in the order of the catalog. */
export const gradeCodeOptions = (t) => Object.keys(GRADE_CODES).map((value) => ({ value, content: gradeCodeLabel(t, value) }))

/** A person's full name; a missing part leaves no stray space. */
export const personName = (person) => `${person?.name ?? ''} ${person?.lastname ?? ''}`.trim()

/** The label template of the print tab as main wrote it (`avery_5160` → `Avery 5160`). */
export const labelTemplateName = (template) => (template || '').replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase())
