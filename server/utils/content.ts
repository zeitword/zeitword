export function mergeWithFallback(defaultObj: any, requestedObj: any) {
  if (!defaultObj) return requestedObj
  if (!requestedObj) return defaultObj

  const result = { ...defaultObj }

  for (const key in requestedObj) {
    if (typeof requestedObj[key] === "object" && requestedObj[key] !== null) {
      result[key] = mergeWithFallback(defaultObj[key] || {}, requestedObj[key])
    } else if (requestedObj[key] !== null && requestedObj[key] !== "") {
      result[key] = requestedObj[key]
    }
  }

  return result
}
