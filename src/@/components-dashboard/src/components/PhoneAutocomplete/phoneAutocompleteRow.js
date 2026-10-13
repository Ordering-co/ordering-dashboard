export const fillPhoneAutocompleteRow = (row, { cellphone, name, query }) => {
  const phone = cellphone == null ? '' : String(cellphone)
  const customerName = name == null ? '' : String(name)
  const prefixLength = query == null ? 0 : String(query).length
  const prefix = phone.slice(0, prefixLength)
  const rest = phone.slice(prefixLength)

  const strong = row.ownerDocument.createElement('strong')
  strong.textContent = prefix
  row.appendChild(strong)
  row.appendChild(row.ownerDocument.createTextNode(rest + ' (' + customerName + ')'))

  const hidden = row.ownerDocument.createElement('input')
  hidden.type = 'hidden'
  hidden.value = phone
  row.appendChild(hidden)

  return row
}

export const fillCreateCustomerRow = (row, label) => {
  const text = label == null ? '' : String(label)
  const strong = row.ownerDocument.createElement('strong')
  strong.textContent = text
  row.appendChild(strong)

  const hidden = row.ownerDocument.createElement('input')
  hidden.type = 'hidden'
  hidden.value = text
  row.appendChild(hidden)

  return row
}
