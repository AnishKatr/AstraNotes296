// Client-side export utilities. No new library dependencies.

function slugify(title) {
  return (title || 'note')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    || 'note'
}

function escapeHtml(str) {
  return (str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

const PRINT_CSS = `
  * { box-sizing: border-box; }
  body { font-family: Georgia, 'Times New Roman', serif; max-width: 680px; margin: 2cm auto; padding: 0; line-height: 1.75; color: #111; font-size: 11pt; }
  h1 { font-size: 2em; font-weight: 700; margin: 0 0 0.6em; line-height: 1.2; }
  h2 { font-size: 1.5em; font-weight: 600; margin: 1.5em 0 0.4em; }
  h3 { font-size: 1.25em; font-weight: 600; margin: 1.2em 0 0.3em; }
  h4 { font-size: 1em; font-weight: 600; margin: 1em 0 0.3em; }
  p { margin: 0 0 0.9em; }
  ul, ol { margin: 0 0 0.9em; padding-left: 1.5em; }
  li { margin: 0.15em 0; }
  blockquote { border-left: 3px solid #ccc; margin: 1em 0; padding: 0.2em 0 0.2em 1em; color: #555; }
  pre { background: #f6f8fa; border: 1px solid #e1e4e8; border-radius: 4px; padding: 12px; overflow-x: auto; font-size: 9pt; }
  code { font-family: 'Courier New', monospace; font-size: 9pt; background: #f6f8fa; padding: 2px 4px; border-radius: 2px; }
  pre code { background: none; padding: 0; }
  table { border-collapse: collapse; width: 100%; margin: 0.9em 0; font-size: 10pt; }
  th, td { border: 1px solid #ddd; padding: 6px 10px; text-align: left; }
  th { background: #f6f8fa; font-weight: 600; }
  hr { border: none; border-top: 1px solid #e1e4e8; margin: 1.5em 0; }
  a { color: #0366d6; }
  del { color: #999; }
  img { max-width: 100%; }
  @media print { body { margin: 0; } }
`

export function exportMarkdown(title, body) {
  const content = `# ${title || 'Untitled'}\n\n${body || ''}`
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = slugify(title) + '.md'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export function exportPdf(title, bodyHtml) {
  const win = window.open('', '_blank')
  if (!win) return
  win.document.write(
    `<!DOCTYPE html><html lang="en"><head>` +
    `<meta charset="utf-8"><title>${escapeHtml(title || 'Note')}</title>` +
    `<style>${PRINT_CSS}</style>` +
    `</head><body>` +
    `<h1>${escapeHtml(title || 'Untitled')}</h1>` +
    `<div>${bodyHtml}</div>` +
    `</body></html>`
  )
  win.document.close()
  win.focus()
  win.print()
}
