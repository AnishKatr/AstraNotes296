import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import MarkdownPreview from './MarkdownPreview'

describe('MarkdownPreview', () => {
  it('renders an h1 heading', () => {
    render(<MarkdownPreview content="# Hello world" />)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Hello world')
  })

  it('renders an h2 heading', () => {
    render(<MarkdownPreview content="## Section" />)
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Section')
  })

  it('renders bold text as strong', () => {
    const { container } = render(<MarkdownPreview content="**bold text**" />)
    expect(container.querySelector('strong')).toHaveTextContent('bold text')
  })

  it('renders an unordered list', () => {
    render(<MarkdownPreview content={'- apple\n- banana\n- cherry'} />)
    const items = screen.getAllByRole('listitem')
    expect(items).toHaveLength(3)
    expect(items[0]).toHaveTextContent('apple')
  })

  it('renders an inline code span', () => {
    const { container } = render(<MarkdownPreview content="use `console.log`" />)
    expect(container.querySelector('code')).toHaveTextContent('console.log')
  })

  it('renders a fenced code block', () => {
    const { container } = render(<MarkdownPreview content={'```\nconst x = 1\n```'} />)
    expect(container.querySelector('pre')).toBeInTheDocument()
    expect(container.querySelector('code')).toHaveTextContent('const x = 1')
  })

  it('renders plain text without crashing', () => {
    render(<MarkdownPreview content="just plain text" />)
    expect(screen.getByText('just plain text')).toBeInTheDocument()
  })

  it('renders empty content without crashing', () => {
    const { container } = render(<MarkdownPreview content="" />)
    expect(container.firstChild).toBeInTheDocument()
  })

  it('renders GFM strikethrough', () => {
    const { container } = render(<MarkdownPreview content="~~deleted~~" />)
    expect(container.querySelector('del')).toHaveTextContent('deleted')
  })

  it('renders a GFM table', () => {
    const md = '| Name | Age |\n|------|-----|\n| Alice | 30 |'
    const { container } = render(<MarkdownPreview content={md} />)
    expect(container.querySelector('table')).toBeInTheDocument()
    expect(screen.getByText('Alice')).toBeInTheDocument()
  })
})
