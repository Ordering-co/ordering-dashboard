export const advanceBulkStatusQueue = (selectedOrderIds = []) => {
  const remainingOrderIds = selectedOrderIds.slice(1)
  return {
    remainingOrderIds,
    continueBatch: remainingOrderIds.length > 0
  }
}
