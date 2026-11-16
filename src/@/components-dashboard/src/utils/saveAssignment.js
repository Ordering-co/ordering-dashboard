/**
 * adds (`assign`, POST) or removes (DELETE) one assignment, such as `business/7/owners/3`, and answers the API
 * body (`{ error, result }`). Unlike saving the whole list, it leaves alone what someone else assigned meanwhile.
 * Needs api-core with these routes (#3623): their 404 arrives without CORS headers, so a fallback on 404 would never run.
 */
export const saveAssignment = async (ordering, token, path, assign) => {
  const response = await fetch(`${ordering.root}/${path}`, {
    method: assign ? 'POST' : 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    }
  })
  return response.json()
}
