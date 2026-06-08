import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ThemeProvider, useTheme } from './ThemeProvider'

function mockMatchMedia(prefersDark = false) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation(query => ({
      matches: prefersDark && query === '(prefers-color-scheme: dark)',
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  })
}

function Consumer() {
  const { theme, setTheme } = useTheme()
  return (
    <>
      <span data-testid="theme">{theme}</span>
      <button onClick={() => setTheme('light')}>light</button>
      <button onClick={() => setTheme('dark')}>dark</button>
      <button onClick={() => setTheme('system')}>system</button>
    </>
  )
}

beforeEach(() => {
  localStorage.clear()
  document.documentElement.classList.remove('light', 'dark')
  mockMatchMedia(false)
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('ThemeProvider', () => {
  it('applies light class to document root in light mode', () => {
    render(<ThemeProvider defaultTheme="light"><div /></ThemeProvider>)
    expect(document.documentElement.classList.contains('light')).toBe(true)
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })

  it('applies dark class to document root in dark mode', () => {
    render(<ThemeProvider defaultTheme="dark"><div /></ThemeProvider>)
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(document.documentElement.classList.contains('light')).toBe(false)
  })

  it('applies dark class in system mode when OS prefers dark', () => {
    mockMatchMedia(true)
    render(<ThemeProvider defaultTheme="system"><div /></ThemeProvider>)
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  it('applies light class in system mode when OS prefers light', () => {
    mockMatchMedia(false)
    render(<ThemeProvider defaultTheme="system"><div /></ThemeProvider>)
    expect(document.documentElement.classList.contains('light')).toBe(true)
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })

  it('persists theme to localStorage when setTheme is called', () => {
    render(<ThemeProvider defaultTheme="light"><Consumer /></ThemeProvider>)
    fireEvent.click(screen.getByText('dark'))
    expect(localStorage.getItem('astranotes-theme')).toBe('dark')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  it('restores theme from localStorage on mount', () => {
    localStorage.setItem('astranotes-theme', 'dark')
    render(<ThemeProvider><div /></ThemeProvider>)
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })
})
