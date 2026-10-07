// Mirrors backend normalize.same_party so the UI groups people the same way the engine does.
const CORP = new Set(['ltd', 'limited', 'pvt', 'private', 'co', 'company', 'the', 'inc', 'llc', 'industries', 'india',
  'entertainment', 'entertainments', 'records', 'music'])

function tokens(name: string) {
  const all = (name.toLowerCase().match(/[a-z0-9]+/g) ?? [])
  const meaningful = all.filter((t) => !CORP.has(t))
  return meaningful.length ? meaningful : all
}

function covers(small: string[], big: string[]) {
  const match = (x: string, y: string) => x === y || (x.length === 1 && y.startsWith(x)) || (y.length === 1 && x.startsWith(y))
  return small.every((x) => big.some((y) => match(x, y)))
}

const digits = (ipi: string) => ipi.replace(/\D/g, '').padStart(11, '0')

export function samePerson(a: string, b: string, ipiA = '', ipiB = '') {
  if (ipiA && ipiB && digits(ipiA) === digits(ipiB)) return true
  const x = tokens(a), y = tokens(b)
  if (!x.length || !y.length) return false
  return covers(x, y) || covers(y, x)
}

export function displayName(name: string) {
  const parts = name.split(',').map((p) => p.trim())
  const text = parts.length === 2 ? `${parts[1]} ${parts[0]}` : name
  return text.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())
}
