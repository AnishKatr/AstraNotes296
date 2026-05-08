import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

const components = {
  h1: ({ children }) => (
    <h1 className="text-3xl font-bold text-gray-900 mt-8 mb-3 leading-tight">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-2xl font-semibold text-gray-900 mt-7 mb-2 leading-tight">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-xl font-semibold text-gray-800 mt-6 mb-2">{children}</h3>
  ),
  h4: ({ children }) => (
    <h4 className="text-base font-semibold text-gray-800 mt-4 mb-1">{children}</h4>
  ),
  p: ({ children }) => (
    <p className="text-gray-700 leading-7 mb-4">{children}</p>
  ),
  strong: ({ children }) => (
    <strong className="font-semibold text-gray-900">{children}</strong>
  ),
  em: ({ children }) => (
    <em className="italic text-gray-700">{children}</em>
  ),
  ul: ({ children }) => (
    <ul className="list-disc list-outside pl-6 mb-4 space-y-1">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="list-decimal list-outside pl-6 mb-4 space-y-1">{children}</ol>
  ),
  li: ({ children }) => (
    <li className="text-gray-700 leading-7">{children}</li>
  ),
  blockquote: ({ children }) => (
    <blockquote className="border-l-4 border-indigo-300 pl-4 my-4 text-gray-500">
      {children}
    </blockquote>
  ),
  a: ({ href, children }) => (
    <a href={href} className="text-indigo-600 hover:underline" target="_blank" rel="noreferrer">
      {children}
    </a>
  ),
  hr: () => <hr className="my-6 border-gray-200" />,
  pre: ({ children }) => (
    <pre className="bg-gray-900 text-gray-100 rounded-lg p-4 my-4 overflow-x-auto text-sm font-mono">
      {children}
    </pre>
  ),
  code: ({ children, className }) => {
    if (className?.startsWith('language-')) {
      return <code className="text-gray-100 font-mono text-sm">{children}</code>
    }
    return (
      <code className="bg-gray-100 text-gray-800 text-sm font-mono rounded px-1.5 py-0.5">
        {children}
      </code>
    )
  },
  table: ({ children }) => (
    <div className="overflow-x-auto my-4">
      <table className="w-full border-collapse text-sm">{children}</table>
    </div>
  ),
  th: ({ children }) => (
    <th className="border border-gray-200 px-4 py-2 bg-gray-50 text-left font-semibold text-gray-900">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="border border-gray-200 px-4 py-2 text-gray-700">{children}</td>
  ),
  del: ({ children }) => (
    <del className="line-through text-gray-400">{children}</del>
  ),
}

export default function MarkdownPreview({ content }) {
  return (
    <div className="text-base">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content || ''}
      </ReactMarkdown>
    </div>
  )
}
