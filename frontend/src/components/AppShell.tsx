import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ChevronRight, Moon, Plus, Search, Sun, SunMoon } from 'lucide-react'
import { CommandPalette } from './CommandPalette'
import { Kbd } from './ui'
import versionFile from '../../../VERSION?raw'

const VERSION = versionFile.trim()

type Theme = 'light' | 'dark' | 'system'
const NEXT: Record<Theme, Theme> = { system: 'dark', dark: 'light', light: 'system' }

function readTheme(): Theme {
  try {
    return (localStorage.getItem('mrm-theme') as Theme) || 'system'
  } catch {
    return 'system'
  }
}

/** One top bar, no sidebar: Home › current reconciliation, search, theme and "New". */
export function AppShell({ children, trail }: { children: ReactNode; trail?: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(readTheme)
  const [palette, setPalette] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    const root = document.documentElement
    if (theme === 'system') root.removeAttribute('data-theme')
    else root.setAttribute('data-theme', theme)
    try { localStorage.setItem('mrm-theme', theme) } catch { /* private mode */ }
  }, [theme])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setPalette((p) => !p) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="app">
      <header className="appbar">
        <Link to="/" className="logo">
          <span className="logo-mark" aria-hidden>
            <svg viewBox="0 0 32 32" width="17" height="17"><path d="M12 22.5a3 3 0 1 1-2-2.83V9.5l11-2.5v12.5a3 3 0 1 1-2-2.83V10.6l-7 1.6z" fill="currentColor" /></svg>
          </span>
          <strong>MRM</strong><span className="logo-sub">Reconcile</span>
        </Link>
        {trail && <><ChevronRight size={16} className="muted trail-sep" /><div className="trail">{trail}</div></>}
        <div className="appbar-right">
          <button type="button" className="search-trigger" onClick={() => setPalette(true)} aria-label="Search">
            <Search size={15} /><span>Search…</span><Kbd>Ctrl K</Kbd>
          </button>
          <button type="button" className="icon-btn" onClick={() => setTheme(NEXT[theme])} aria-label={`Theme: ${theme}`} title={`Theme: ${theme}`}>
            {theme === 'light' ? <Sun size={18} /> : theme === 'dark' ? <Moon size={18} /> : <SunMoon size={18} />}
          </button>
          <button type="button" className="btn primary" onClick={() => navigate('/clients/new')}><Plus size={15} /><span className="hide-sm">Add client</span></button>
        </div>
      </header>
      <main className="page">{children}</main>
      <footer className="app-footer"><b>MRM</b><span>Music Rights Management</span><span>·</span><span>v{VERSION}</span></footer>
      <CommandPalette open={palette} onClose={() => setPalette(false)} />
    </div>
  )
}
