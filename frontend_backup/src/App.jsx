import { useEffect, useRef } from 'react'
import axios from 'axios'
import useAgentStore from './store/agentStore'

// Components
import InputSection from './components/InputSection'
import ProgressBar from './components/ProgressBar'
import RunSummaryCard from './components/RunSummaryCard'
import ScoreBreakdownPanel from './components/ScoreBreakdownPanel'
import FixesAppliedTable from './components/FixesAppliedTable'
import CICDTimeline from './components/CICDTimeline'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'
const POLL_INTERVAL_MS = 2000
const POLL_TIMEOUT_COUNT = 150  // 150 × 2s = 5 min max

export default function App() {
  const { runId, status, results, setStatus, setProgress, setResults } = useAgentStore()
  const pollCountRef = useRef(0)

  // ── Polling loop ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!runId || status !== 'running') return

    pollCountRef.current = 0

    const poll = setInterval(async () => {
      pollCountRef.current += 1

      // 5-minute timeout safety net — prevents infinite spinner
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
          // Fetch results
          const { data: resultsData } = await axios.get(`${API}/api/results/${runId}`)
          setResults(resultsData)

        } else if (data.status === 'error') {
          clearInterval(poll)
          setStatus('error')
        }
      } catch (err) {
        console.error('Polling error:', err)
      }
    }, POLL_INTERVAL_MS)

    return () => clearInterval(poll)
  }, [runId, status])

  const hasResults = status === 'complete' && results

  return (
    <div className="min-h-screen bg-gray-950">
      {/* Ambient gradient background */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 80% 50% at 50% -10%, rgba(59,130,246,0.12) 0%, transparent 60%), ' +
            'radial-gradient(ellipse 60% 40% at 80% 100%, rgba(139,92,246,0.08) 0%, transparent 60%)',
        }}
      />

      <div className="relative max-w-7xl mx-auto px-4 py-8 md:py-12">
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <header className="text-center mb-10">
          <div className="inline-flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 rounded-full px-4 py-1.5 mb-4 text-xs text-blue-400 font-semibold">
            <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
            Powered by Gemini • LangGraph Multi-Agent
          </div>
          <h1 className="text-4xl md:text-5xl font-black tracking-tight">
            <span
              className="bg-clip-text text-transparent"
              style={{
                backgroundImage: 'linear-gradient(135deg, #60a5fa 0%, #a78bfa 50%, #34d399 100%)',
              }}
            >
              Autonomous DevOps Agent
            </span>
          </h1>
          <p className="text-gray-400 mt-3 text-base max-w-xl mx-auto">
            AI-powered bug detection &amp; auto-fix system. Clone → Analyze → Fix → Verify, fully automated.
          </p>
        </header>

        {/* ── Error banner ────────────────────────────────────────────────── */}
        {status === 'error' && (
          <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm flex items-center gap-3 animate-fade-in">
            <span className="text-xl">⚠️</span>
            <div>
              <p className="font-bold">Agent encountered an error</p>
              <p className="text-xs text-red-300 mt-0.5">
                Check the backend logs and ensure your GEMINI_API_KEY and GITHUB_TOKEN are set correctly.
              </p>
            </div>
          </div>
        )}

        {/* ── Main grid ───────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* LEFT column — Input + score */}
          <div className="lg:col-span-1 space-y-5">
            <InputSection />
            <ProgressBar />
            {hasResults && <ScoreBreakdownPanel score={results.score} />}
          </div>

          {/* RIGHT column — Results dashboard */}
          <div className="lg:col-span-2 space-y-5">
            {hasResults ? (
              <>
                <RunSummaryCard results={results} />
                <FixesAppliedTable fixes={results.fixes} />
                <CICDTimeline
                  timeline={results.cicd_timeline}
                  maxRetries={results.cicd_timeline?.length || 5}
                />
              </>
            ) : (
              /* Empty state while idle */
              status === 'idle' && (
                <div className="glass-card h-full flex flex-col items-center justify-center py-20 text-center">
                  <div className="text-6xl mb-4">🤖</div>
                  <h3 className="text-xl font-bold text-white mb-2">
                    Ready to Analyze
                  </h3>
                  <p className="text-gray-400 text-sm max-w-xs">
                    Enter a GitHub repository URL, your team name, and leader name — then hit{' '}
                    <span className="text-blue-400 font-semibold">Run Agent</span>.
                  </p>
                  <div className="mt-6 grid grid-cols-3 gap-4 text-center w-full max-w-sm">
                    {[
                      { icon: '🔍', label: 'Detect Bugs', desc: 'Auto-discover & classify' },
                      { icon: '🔧', label: 'Auto Fix', desc: 'Gemini-powered patches' },
                      { icon: '✅', label: 'Verify', desc: 'Re-run tests to confirm' },
                    ].map((item) => (
                      <div key={item.label} className="bg-gray-800/40 rounded-xl p-3 border border-gray-700/40">
                        <div className="text-2xl mb-1">{item.icon}</div>
                        <p className="text-xs font-bold text-white">{item.label}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{item.desc}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )
            )}
          </div>
        </div>

        {/* ── Footer ──────────────────────────────────────────────────────── */}
        <footer className="mt-12 text-center text-xs text-gray-600">
          Built for RIFT Hackathon • Autonomous DevOps Agent • Gemini 2.5 Pro + LangGraph
        </footer>
      </div>
    </div>
  )
}
