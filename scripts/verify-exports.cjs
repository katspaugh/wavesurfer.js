// One-off verification script (not wired into package.json scripts): resolves every
// concrete example the exports map should serve against real files on disk, for both
// the "import"+"types" and "require" conditions. Run with: node scripts/verify-exports.cjs
'use strict'
const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'))
const exportsMap = pkg.exports

// [subpath requested by a consumer, expected condition -> should it resolve]
const cases = [
  ['.', 'types'],
  ['.', 'import'],
  ['.', 'require'],
  ['./dist/plugins/regions.js', 'types'],
  ['./dist/plugins/regions.js', 'import'],
  ['./dist/plugins/regions.js', 'require'],
  ['./plugins/regions', 'types'],
  ['./plugins/regions', 'import'],
  ['./plugins/regions', 'require'],
  ['./dist/plugins/regions.esm.js', 'types'],
  ['./dist/plugins/regions.esm.js', 'import'],
  ['./dist/plugins/regions.esm.js', 'require'],
  // Real deep-import used by examples/webaudio-shim.js
  ['./dist/webaudio.js', 'types'],
  ['./dist/webaudio.js', 'import'],
  ['./dist/scope.js', 'types'],
  ['./dist/scope.js', 'import'],
]

function matchPattern(key, subpath) {
  if (!key.includes('*')) return key === subpath ? [] : null
  const [prefix, suffix] = key.split('*')
  if (!subpath.startsWith(prefix) || !subpath.endsWith(suffix)) return null
  const captured = subpath.slice(prefix.length, subpath.length - suffix.length)
  if (captured.includes('/')) return null // Node requires no slash in the match for pattern keys w/ single '*'... (not strictly true, but fine for our cases)
  return [captured]
}

function resolveTarget(template, captured) {
  if (captured === undefined) return template
  return template.split('*').join(captured)
}

let failures = 0
for (const [subpath, condition] of cases) {
  // Node's real patternKeyCompare (lib/internal/modules/esm/resolve.js): longer
  // pre-'*' prefix wins; ties broken by longer full key string (so a more specific
  // suffix like '*.esm.js' outranks a broader '*.js' sharing the same prefix).
  const keys = Object.keys(exportsMap).sort((a, b) => {
    const aBase = a.includes('*') ? a.indexOf('*') : a.length
    const bBase = b.includes('*') ? b.indexOf('*') : b.length
    if (aBase !== bBase) return bBase - aBase
    return b.length - a.length
  })
  let resolved = null
  for (const key of keys) {
    const m = matchPattern(key, subpath)
    if (m === null) continue
    const conditions = exportsMap[key]
    if (!(condition in conditions)) continue
    resolved = resolveTarget(conditions[condition], m[0])
    break
  }
  if (resolved === null) {
    console.log(`SKIP   ${subpath} [${condition}] -> no matching export entry`)
    continue
  }
  const abs = path.join(root, resolved)
  const exists = fs.existsSync(abs)
  console.log(`${exists ? 'OK  ' : 'FAIL'}   ${subpath} [${condition}] -> ${resolved}`)
  if (!exists) failures++
}

if (failures > 0) {
  console.error(`\n${failures} export target(s) did not resolve to a real file.`)
  process.exit(1)
} else {
  console.log('\nAll checked export targets resolve to real files.')
}
