import { createContext } from 'react'

// J2 review H1: the product editor's leave question saves the shared form, but its rules (a required name, a regular
// price over the price) live in the section's form (react-hook-form in ProductDetatilsInformation). The section puts its validation
// in this ref while it is mounted; «Save and continue» runs it first and sends nothing when it fails, as the form's own Save does.
// The value is a ref `{ current: () => Promise<boolean> | boolean | null }`; no provider (another consumer of the form): null.
export const ProductFormValidationContext = createContext(null)
