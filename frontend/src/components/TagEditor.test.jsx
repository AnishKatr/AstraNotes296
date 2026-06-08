import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as notesService from '../services/notes'
import TagEditor from './TagEditor'

vi.mock('../services/notes')

beforeEach(() => {
  vi.clearAllMocks()
  notesService.getTags.mockResolvedValue({ tags: [] })
})

function renderEditor(tags = [], setTags = vi.fn(), disabled = false) {
  return render(<TagEditor tags={tags} setTags={setTags} disabled={disabled} />)
}

describe('TagEditor — render', () => {
  it('renders existing tags as chips', async () => {
    renderEditor(['python', 'web'])
    await waitFor(() => expect(notesService.getTags).toHaveBeenCalled())
    expect(screen.getByText('python')).toBeInTheDocument()
    expect(screen.getByText('web')).toBeInTheDocument()
  })

  it('renders the add tag input when not disabled', async () => {
    renderEditor()
    await waitFor(() => expect(notesService.getTags).toHaveBeenCalled())
    expect(screen.getByRole('textbox', { name: /add tag/i })).toBeInTheDocument()
  })

  it('hides the input when disabled', async () => {
    renderEditor([], vi.fn(), true)
    await waitFor(() => expect(notesService.getTags).toHaveBeenCalled())
    expect(screen.queryByRole('textbox', { name: /add tag/i })).not.toBeInTheDocument()
  })
})

describe('TagEditor — adding tags', () => {
  it('adds a tag on Enter', async () => {
    const setTags = vi.fn()
    renderEditor([], setTags)
    await waitFor(() => expect(notesService.getTags).toHaveBeenCalled())
    const input = screen.getByRole('textbox', { name: /add tag/i })
    await userEvent.type(input, 'react{Enter}')
    expect(setTags).toHaveBeenCalledWith(['react'])
  })

  it('adds a tag on comma', async () => {
    const setTags = vi.fn()
    renderEditor([], setTags)
    await waitFor(() => expect(notesService.getTags).toHaveBeenCalled())
    const input = screen.getByRole('textbox', { name: /add tag/i })
    await userEvent.type(input, 'vue,')
    expect(setTags).toHaveBeenCalledWith(['vue'])
  })

  it('does not add duplicate tags', async () => {
    const setTags = vi.fn()
    renderEditor(['python'], setTags)
    await waitFor(() => expect(notesService.getTags).toHaveBeenCalled())
    const input = screen.getByRole('textbox', { name: /add tag/i })
    await userEvent.type(input, 'python{Enter}')
    expect(setTags).not.toHaveBeenCalled()
  })

  it('hides the input when max tags reached', async () => {
    const tenTags = Array.from({ length: 10 }, (_, i) => `tag${i}`)
    renderEditor(tenTags)
    await waitFor(() => expect(notesService.getTags).toHaveBeenCalled())
    expect(screen.queryByRole('textbox', { name: /add tag/i })).not.toBeInTheDocument()
  })
})

describe('TagEditor — removing tags', () => {
  it('removes a tag via the X button', async () => {
    const setTags = vi.fn()
    renderEditor(['python', 'web'], setTags)
    await waitFor(() => expect(notesService.getTags).toHaveBeenCalled())
    await userEvent.click(screen.getByRole('button', { name: /remove tag python/i }))
    expect(setTags).toHaveBeenCalledWith(['web'])
  })

  it('removes the last tag on Backspace when input is empty', async () => {
    const setTags = vi.fn()
    renderEditor(['python', 'web'], setTags)
    await waitFor(() => expect(notesService.getTags).toHaveBeenCalled())
    const input = screen.getByRole('textbox', { name: /add tag/i })
    await userEvent.click(input)
    await userEvent.keyboard('{Backspace}')
    expect(setTags).toHaveBeenCalledWith(['python'])
  })
})

describe('TagEditor — autocomplete', () => {
  it('shows matching suggestions from getTags', async () => {
    notesService.getTags.mockResolvedValue({ tags: [{ tag: 'python', count: 3 }, { tag: 'pytest', count: 1 }] })
    renderEditor()
    await waitFor(() => expect(notesService.getTags).toHaveBeenCalled())
    const input = screen.getByRole('textbox', { name: /add tag/i })
    await userEvent.type(input, 'py')
    await waitFor(() => expect(screen.getByRole('listbox')).toBeInTheDocument())
    expect(screen.getByText('python')).toBeInTheDocument()
    expect(screen.getByText('pytest')).toBeInTheDocument()
  })

  it('adds a tag when a suggestion is clicked', async () => {
    notesService.getTags.mockResolvedValue({ tags: [{ tag: 'python', count: 2 }] })
    const setTags = vi.fn()
    renderEditor([], setTags)
    await waitFor(() => expect(notesService.getTags).toHaveBeenCalled())
    const input = screen.getByRole('textbox', { name: /add tag/i })
    await userEvent.type(input, 'py')
    await waitFor(() => expect(screen.getByRole('listbox')).toBeInTheDocument())
    await userEvent.click(screen.getByText('python'))
    expect(setTags).toHaveBeenCalledWith(['python'])
  })
})
