// School catalog values (mirror of the backend enums).

// AllergenEnum
export const SCHOOL_ALLERGENS = [
  { value: 'nuts', name: 'Nuts' },
  { value: 'peanuts', name: 'Peanuts' },
  { value: 'dairy', name: 'Dairy' },
  { value: 'gluten', name: 'Gluten' },
  { value: 'eggs', name: 'Eggs' },
  { value: 'soy', name: 'Soy' },
  { value: 'fish', name: 'Fish' },
  { value: 'shellfish', name: 'Shellfish' },
  { value: 'sesame', name: 'Sesame' },
  { value: 'wheat', name: 'Wheat' }
]

// DietaryTagEnum
export const SCHOOL_DIETARY_TAGS = [
  { value: 'vegan', name: 'Vegan' },
  { value: 'vegetarian', name: 'Vegetarian' },
  { value: 'gluten_free', name: 'Gluten free' },
  { value: 'dairy_free', name: 'Dairy free' },
  { value: 'nut_free', name: 'Nut free' },
  { value: 'halal', name: 'Halal' },
  { value: 'kosher', name: 'Kosher' },
  { value: 'low_sugar', name: 'Low sugar' }
]

// GradeEnum (pre_k, k, g1..g12)
export const SCHOOL_GRADE_CODES = [
  { value: 'pre_k', name: 'Pre-K' },
  { value: 'k', name: 'Kindergarten' },
  ...Array.from({ length: 12 }, (_, i) => ({ value: `g${i + 1}`, name: `Grade ${i + 1}` }))
]

// preparation_day_of_week (0 = Sunday … 6 = Saturday)
export const SCHOOL_WEEKDAYS = [
  { value: 0, name: 'Sunday' },
  { value: 1, name: 'Monday' },
  { value: 2, name: 'Tuesday' },
  { value: 3, name: 'Wednesday' },
  { value: 4, name: 'Thursday' },
  { value: 5, name: 'Friday' },
  { value: 6, name: 'Saturday' }
]

// Business vertical values
export const BUSINESS_VERTICALS = [
  { value: 'store', name: 'Store' },
  { value: 'school', name: 'School' }
]

export const SCHOOL_VERTICAL = 'school'
