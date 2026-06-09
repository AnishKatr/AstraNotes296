// Stable per-tag color derived from tag name via djb2 hash.
// Both tailwind class pairs and solid hex colors for sidebar dots.

const _PALETTES = [
  { bg: 'bg-sky-100 dark:bg-sky-900/40',     text: 'text-sky-700 dark:text-sky-300',     dot: '#0ea5e9' },
  { bg: 'bg-violet-100 dark:bg-violet-900/40', text: 'text-violet-700 dark:text-violet-300', dot: '#8b5cf6' },
  { bg: 'bg-emerald-100 dark:bg-emerald-900/40', text: 'text-emerald-700 dark:text-emerald-300', dot: '#10b981' },
  { bg: 'bg-amber-100 dark:bg-amber-900/40',  text: 'text-amber-700 dark:text-amber-300',  dot: '#f59e0b' },
  { bg: 'bg-rose-100 dark:bg-rose-900/40',    text: 'text-rose-700 dark:text-rose-300',    dot: '#f43f5e' },
  { bg: 'bg-cyan-100 dark:bg-cyan-900/40',    text: 'text-cyan-700 dark:text-cyan-300',    dot: '#06b6d4' },
  { bg: 'bg-fuchsia-100 dark:bg-fuchsia-900/40', text: 'text-fuchsia-700 dark:text-fuchsia-300', dot: '#d946ef' },
  { bg: 'bg-lime-100 dark:bg-lime-900/40',    text: 'text-lime-700 dark:text-lime-300',    dot: '#84cc16' },
  { bg: 'bg-orange-100 dark:bg-orange-900/40', text: 'text-orange-700 dark:text-orange-300', dot: '#f97316' },
  { bg: 'bg-indigo-100 dark:bg-indigo-900/40', text: 'text-indigo-700 dark:text-indigo-300', dot: '#6366f1' },
]

function djb2(str) {
  let hash = 5381
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i)
    hash = hash >>> 0
  }
  return hash
}

function palette(tag) {
  return _PALETTES[djb2(tag) % _PALETTES.length]
}

export function tagColorClasses(tag) {
  const p = palette(tag)
  return { bg: p.bg, text: p.text }
}

export function tagDotColor(tag) {
  return palette(tag).dot
}
