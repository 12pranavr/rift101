import { useEffect, useRef, useState } from 'react'
import axios from 'axios'
import useAgentStore from './store/agentStore'
import { saveRunToMemory } from './utils/memory'
import Memory from './pages/Memory'

import InputSection from './components/InputSection'
import ProgressBar from './components/ProgressBar'
import RunSummaryCard from './components/RunSummaryCard'
import ScoreBreakdownPanel from './components/ScoreBreakdownPanel'
import FixesAppliedTable from './components/FixesAppliedTable'
import CICDTimeline from './components/CICDTimeline'
import ScheduledRunsPanel from './components/ScheduledRunsPanel'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'
const POLL_INTERVAL_MS = 2000
const POLL_TIMEOUT_COUNT = 150

// Fake barcode bars for decoration
function Barcode({ bars = 18 }) {
  const heights = [100, 60, 80, 40, 100, 70, 50, 90, 100, 30, 80, 60, 100, 45, 75, 55, 100, 65]
  return (
    <div className="barcode">
      {Array.from({ length: bars }).map((_, i) => (
        <div
          key={i}
          className="barcode-bar"
          style={{ height: `${heights[i % heights.length]}%`, opacity: 0.5 }}
        />
      ))}
    </div>
  )
}

export default function App() {
  const { runId, status, errorMessage, results, nextRun, setStatus, setProgress, setResults } = useAgentStore()
  const pollCountRef = useRef(0)
  const [view, setView] = useState('agent') // 'agent' | 'memory'

  // ── Theme toggle ──────────────────────────────────────────────────────────
  const [theme, setTheme] = useState(() => localStorage.getItem('rift-theme') || 'dark')
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('rift-theme', theme)
  }, [theme])
  const toggleTheme = () => setTheme(t => (t === 'dark' ? 'light' : 'dark'))
  const isDark = theme === 'dark'

  useEffect(() => {
    if (!runId || status !== 'running') return
    pollCountRef.current = 0
    const poll = setInterval(async () => {
      pollCountRef.current += 1
      if (pollCountRef.current > POLL_TIMEOUT_COUNT) {
        clearInterval(poll)
        setStatus('error')
        return
      }
      try {
        const { data } = await axios.get(`${API}/api/status/${runId}`)
        setProgress(data.progress || 0, data.current_step || '')
        if (data.status === 'complete') {
          clearInterval(poll)
          setStatus('complete')
          const { data: resultsData } = await axios.get(`${API}/api/results/${runId}`)
          setResults(resultsData)
          if (resultsData.repo_url) {
            saveRunToMemory(resultsData.repo_url, resultsData)
          }
        } else if (data.status === 'error') {
          clearInterval(poll)
          setStatus('error', data.error || data.current_step || 'Unknown error')
        }
      } catch (err) {
        console.error('Polling error:', err)
      }
    }, POLL_INTERVAL_MS)
    return () => clearInterval(poll)
  }, [runId, status])

  const hasResults = status === 'complete' && results
  const isScheduled = status === 'scheduled'

  return (
    <div style={{ minHeight: '100vh', background: 'var(--black)', color: 'var(--white)' }}>

      {/* ── Top header bar ─────────────────────────────────────────────────── */}
      <header style={{
        borderBottom: '1px solid var(--gray-border)',
        padding: '0.6rem 2rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: 'var(--gray-dark)',
      }}>
        {/* Left: logo block */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{
            background: 'var(--orange)',
            padding: '0.2rem 0.5rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <span style={{
              fontFamily: 'var(--font-display)',
              fontSize: '1.1rem',
              color: 'var(--black)',
              letterSpacing: '0.05em',
            }}>RIFT</span>
          </div>
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', letterSpacing: '0.08em', color: 'var(--white)' }}>
              AUTONOMOUS DEVOPS AGENT
            </div>
            <div className="tag-label" style={{ marginTop: '2px' }}>GEMINI · LANGGRAPH · MULTI-AGENT</div>
          </div>
        </div>

        {/* Center: Navigation */}
        <div style={{ display: 'flex', gap: '1rem' }}>
          <NavButton label="AGENT" active={view === 'agent'} onClick={() => setView('agent')} />
          <NavButton label="MEMORY" active={view === 'memory'} onClick={() => setView('memory')} icon="🧠" />
        </div>

        {/* Right: status + theme toggle + barcode */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
          <div style={{ textAlign: 'right' }}>
            <div className="tag-label">SYSTEM STATUS</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '2px' }}>
              <div className="status-dot-pass animate-pulse" />
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--green)' }}>ONLINE</span>
            </div>
          </div>

          {/* Theme toggle button */}
          <button
            onClick={toggleTheme}
            title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            style={{
              background: 'var(--gray-mid)',
              border: '1px solid var(--gray-border)',
              color: 'var(--white)',
              width: 36,
              height: 36,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              fontSize: '1rem',
              transition: 'background 0.2s, box-shadow 0.2s',
              flexShrink: 0,
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--orange)'; e.currentTarget.style.color = 'var(--black)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'var(--gray-mid)'; e.currentTarget.style.color = 'var(--white)' }}
          >
            {isDark ? '☀' : '☾'}
          </button>

          <Barcode bars={20} />
        </div>
      </header>

      {/* ── Ticker ─────────────────────────────────────────────────────────── */}
      <div className="ticker-line" style={{ padding: '0.3rem 2rem' }}>
        <span style={{ opacity: 0.5, marginRight: '3rem' }}>
          RIFT HACKATHON · AUTONOMOUS BUG DETECTION & PATCH SYSTEM · POWERED BY TEAM JARVIS &nbsp;&nbsp;&nbsp;&nbsp;
          RIFT HACKATHON · AUTONOMOUS BUG DETECTION & PATCH SYSTEM · POWERED BY TEAM JARVIS
        </span>
      </div>

      {view === 'memory' ? (
        <Memory />
      ) : (
        <main style={{ padding: '1.5rem 2rem', maxWidth: '1400px', margin: '0 auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: '1.25rem', alignItems: 'start' }}>

            {/* LEFT column */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <InputSection />
              {isScheduled && <ScheduledRunsPanel />}
            </div>

            {/* RIGHT column */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <ProgressBar />

              {status === 'error' && (
                <div style={{
                  margin: '1rem 0 0',
                  padding: '1rem 1.25rem',
                  background: 'rgba(255,34,68,0.08)',
                  border: '1px solid rgba(255,34,68,0.3)',
                  borderLeft: '3px solid var(--red)',
                }} className="animate-fade-in">
                  <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                    <span style={{ color: 'var(--red)', fontFamily: 'var(--font-display)', fontSize: '1.2rem' }}>ERR</span>
                    <div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--red)', fontWeight: 700 }}>
                        AGENT ENCOUNTERED AN ERROR
                      </div>
                      {errorMessage && (
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: '#ff667a', marginTop: '0.35rem', wordBreak: 'break-all' }}>
                          {errorMessage}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {hasResults ? (
                <>
                  <RunSummaryCard results={results} />
                  <div style={{
                    display: 'grid', gridTemplateColumns: '2.5fr 1fr',
                    gap: '1.5rem', marginTop: '1.5rem'
                  }}>
                    <FixesAppliedTable fixes={results.fixes} />
                    <ScoreBreakdownPanel score={results.score} />
                  </div>
                  <div style={{ marginTop: '1.5rem' }}>
                    <CICDTimeline />
                  </div>
                </>
              ) : status === 'idle' && !isScheduled ? (
                <div className="panel animate-fade-in" style={{ minHeight: '420px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '2rem', textAlign: 'center' }}>
                  <div className="scan-overlay" />

                  {/* Big hero text */}
                  <div style={{ position: 'relative', zIndex: 1 }}>
                    <div style={{
                      fontFamily: 'var(--font-display)',
                      fontSize: 'clamp(5rem, 12vw, 9rem)',
                      lineHeight: '0.85',
                      color: 'var(--orange)',
                      letterSpacing: '0.02em',
                    }} className="glow-orange">
                      AI.
                    </div>
                    <div style={{
                      fontFamily: 'var(--font-display)',
                      fontSize: 'clamp(2rem, 5vw, 3.5rem)',
                      lineHeight: '1',
                      color: 'var(--white)',
                      letterSpacing: '0.08em',
                    }}>
                      AUTO-FIX
                    </div>
                    <div className="tag-label" style={{ marginTop: '0.75rem', color: 'var(--gray-text)' }}>
                      CYBERNETIC CODE REPAIR SYSTEM
                    </div>
                  </div>

                  {/* Three stat blocks */}
                  <div style={{ display: 'flex', gap: '1px', background: 'var(--gray-border)', position: 'relative', zIndex: 1 }}>
                    {[
                      { label: 'DETECT', sub: 'Auto-classify bugs', icon: '◈' },
                      { label: 'PATCH', sub: 'Gemini-powered fix', icon: '◉' },
                      { label: 'VERIFY', sub: 'Re-run test suite', icon: '◎' },
                    ].map(item => (
                      <div key={item.label} style={{
                        background: 'var(--gray-mid)',
                        padding: '1.25rem 1.5rem',
                        flex: 1,
                        textAlign: 'center',
                        borderTop: '2px solid var(--orange)',
                      }}>
                        <div style={{ fontSize: '1.5rem', color: 'var(--orange)', marginBottom: '0.4rem' }}>{item.icon}</div>
                        <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.3rem', letterSpacing: '0.08em' }}>{item.label}</div>
                        <div className="tag-label" style={{ marginTop: '0.2rem' }}>{item.sub}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </main>
      )}

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <footer style={{
        borderTop: '1px solid var(--gray-border)',
        padding: '0.6rem 2rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: 'var(--gray-dark)',
        marginTop: '2rem',
      }}>
        <span className="tag-label">RIFT HACKATHON · AUTONOMOUS DEVOPS AGENT</span>
        <div style={{ display: 'flex', gap: '2rem' }}>
          {['CLONE', 'ANALYZE', 'FIX', 'VERIFY'].map(s => (
            <span key={s} className="tag-label">{s}</span>
          ))}
        </div>
        <Barcode bars={12} />
      </footer>
    </div>
  )
}

function NavButton({ label, active, onClick, icon }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: 'none',
        border: 'none',
        borderBottom: active ? '2px solid var(--orange)' : '2px solid transparent',
        padding: '0.5rem 0.2rem',
        color: active ? 'var(--white)' : 'var(--gray-text)',
        fontFamily: 'var(--font-display)',
        fontSize: '0.85rem',
        letterSpacing: '0.05em',
        cursor: 'pointer',
        transition: 'all 0.2s',
        display: 'flex',
        alignItems: 'center',
        gap: '0.4rem',
      }}
    >
      {icon && <span>{icon}</span>}
      {label}
    </button>
  )
}
