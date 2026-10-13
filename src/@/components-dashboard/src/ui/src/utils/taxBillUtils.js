export const getTaxAmount = (tax) => tax?.summary?.tax_after_discount ?? tax?.summary?.tax ?? 0

export const getTaxesByTarget = (taxes, target) => {
  if (!taxes?.length) return []
  return taxes.filter(tax => tax?.target === target)
}

export const getTaxKey = (tax, index) => `${tax?.target ?? 'tax'}-${tax?.id ?? 'null'}-${tax?.name ?? index}-${index}`

export const shouldShowTaxRate = (tax) => tax?.rate > 0

export const shouldShowTaxItem = (tax) => parseFloat(getTaxAmount(tax)) !== 0

export const shouldShowTaxBillRow = (tax) => shouldShowTaxItem(tax) && tax?.type !== 1
