import { useState } from 'react'

const SECTIONS = [
    {
        id: 'overview',
        icon: '◈',
        title: 'OVERVIEW',
        content: (
            <>
                <p>The <strong>Autonomous DevOps Agent</strong> automatically detects bugs in any GitHub repository, generates AI-powered fixes, commits them to a dedicated branch, and opens a pull request — with no human intervention required.</p>
                <div className="manual-flow">
                    <span>CLONE</span><span className="arrow">→</span>
                    <span>ANALYZE</span><span className="arrow">→</span>
                    <span>FIX</span><span className="arrow">→</span>
                    <span>VERIFY</span><span className="arrow">→</span>
                    <span>PR</span>
                </div>
            </>
        ),
    },
    {
        id: 'quickstart',
        icon: '▶',
        title: 'QUICK START',
        content: (
            <ol className="manual-list">
                <li>Paste your <strong>GitHub repository URL</strong> into the Repo URL field</li>
                <li>Enter your <strong>Team Name</strong> (e.g. JARVIS)</li>
                <li>Enter the <strong>Team Leader</strong> name (e.g. Pranav)</li>
                <li>Click <strong>▶ DEPLOY AGENT</strong></li>
                <li>Watch the live progress bar as the agent clones, analyzes, and fixes your repo</li>
                <li>When complete, view the <strong>Run Summary</strong>, <strong>Fixes Table</strong>, and <strong>Score</strong></li>
                <li>Click the <strong>Pull Request link</strong> to review the AI's changes on GitHub</li>
            </ol>
        ),
    },
    {
        id: 'branch',
        icon: '⎇',
        title: 'BRANCH NAMING',
        content: (
            <>
                <p>The agent creates a branch with this exact format:</p>
                <div className="manual-code">TEAM_NAME_LEADER_NAME_AI_Fix</div>
                <table className="manual-table">
                    <thead><tr><th>Team Name</th><th>Leader</th><th>Branch</th></tr></thead>
                    <tbody>
                        <tr><td>JARVIS</td><td>Pranav</td><td>JARVIS_PRANAV_AI_Fix</td></tr>
                        <tr><td>CODE WARRIORS</td><td>John Doe</td><td>CODE_WARRIORS_JOHN_DOE_AI_Fix</td></tr>
                    </tbody>
                </table>
                <p style={{ marginTop: '0.75rem', fontSize: '0.7rem', color: 'var(--gray-text)' }}>Rules: ALL UPPERCASE · spaces → underscores · always ends with _AI_Fix</p>
            </>
        ),
    },
    {
        id: 'bugtypes',
        icon: '◉',
        title: 'BUG TYPES',
        content: (
            <table className="manual-table">
                <thead><tr><th>Type</th><th>Description</th><th>Detection</th></tr></thead>
                <tbody>
                    {[
                        ['LINTING', 'Code style violations', 'flake8 / eslint'],
                        ['SYNTAX', 'Invalid syntax', 'Parser / test runner'],
                        ['LOGIC', 'Wrong program logic', 'Test failures + AI'],
                        ['TYPE_ERROR', 'Type mismatches', 'mypy / runtime'],
                        ['IMPORT', 'Missing or circular imports', 'ImportError'],
                        ['INDENTATION', 'Indentation errors', 'autopep8'],
                        ['VULNERABILITY', 'Known CVEs in deps', 'pip-audit'],
                    ].map(([t, d, det]) => (
                        <tr key={t}>
                            <td><span className="manual-badge">{t}</span></td>
                            <td>{d}</td>
                            <td style={{ color: 'var(--gray-text)' }}>{det}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        ),
    },
    {
        id: 'score',
        icon: '◎',
        title: 'SCORING',
        content: (
            <>
                <div className="manual-formula">
                    <div className="formula-row"><span className="formula-label">BASE</span><span className="formula-value green">+100</span></div>
                    <div className="formula-row"><span className="formula-label">SPEED BONUS (run &lt; 5 min)</span><span className="formula-value orange">+10</span></div>
                    <div className="formula-row"><span className="formula-label">EFFICIENCY PENALTY (per commit over 20)</span><span className="formula-value red">−2 each</span></div>
                </div>
                <p style={{ marginTop: '0.75rem', fontSize: '0.7rem', color: 'var(--gray-text)' }}>
                    Example: 25 commits in 4 min → 100 + 10 − (5 × 2) = <strong style={{ color: 'var(--green)' }}>100</strong>
                </p>
            </>
        ),
    },
    {
        id: 'advanced',
        icon: '⚙',
        title: 'ADVANCED FEATURES',
        content: (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                <div className="manual-feature-block">
                    <div className="feature-title">🧠 Memory</div>
                    <p>When you run the agent on the same repo more than once, a <strong>MEMORY FOUND</strong> banner appears. Enable it to let the AI learn from previous failed fix attempts and try different approaches.</p>
                </div>
                <div className="manual-feature-block">
                    <div className="feature-title">⚡ Skills</div>
                    <p>Open <strong>Advanced Configuration → SKILL</strong> to choose a pre-defined fix strategy (Security Audit, PEP8 Format, Type Hints, etc.) or create your own. The active skill overrides the Custom Instructions field.</p>
                </div>
                <div className="manual-feature-block">
                    <div className="feature-title">⏰ Scheduler</div>
                    <p>Set the agent to run <strong>Daily</strong> or <strong>Weekly</strong> at a chosen time. Scheduled runs are persistent — they survive server restarts and are managed in the <strong>Scheduled Runs</strong> panel.</p>
                </div>
                <div className="manual-feature-block">
                    <div className="feature-title">🚫 Ignore Rules</div>
                    <p>List file paths or glob patterns (one per line) to skip during analysis. Useful for excluding legacy folders, test fixtures, or auto-generated files.</p>
                </div>
            </div>
        ),
    },
    {
        id: 'tips',
        icon: '⚑',
        title: 'TIPS & LIMITS',
        content: (
            <ul className="manual-list">
                <li>The backend (Render free tier) may take <strong>~30 seconds</strong> to wake up after inactivity — this is normal</li>
                <li>Repos with <strong>no test files</strong> will have 0 failures — tests must be written for the agent to detect bugs</li>
                <li>The agent retries up to <strong>5 times</strong> by default before giving up</li>
                <li>Large repos (&gt;500 files) may hit the 60-second sandbox timeout</li>
                <li>The agent works best on <strong>Python</strong> repos — it also supports JS, Ruby, Go, and Java</li>
                <li>Your GitHub token needs <strong>repo write access</strong> to push branches and create PRs</li>
            </ul>
        ),
    },
]

export default function UserManual({ onClose }) {
    const [active, setActive] = useState('overview')

    const section = SECTIONS.find(s => s.id === active)

    return (
        <div style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.85)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1.5rem',
        }} onClick={onClose}>
            <div
                onClick={e => e.stopPropagation()}
                className="animate-fade-in"
                style={{
                    background: 'var(--gray-dark)',
                    border: '1px solid var(--gray-border)',
                    width: '100%',
                    maxWidth: '860px',
                    maxHeight: '85vh',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                }}
            >
                {/* Header */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.9rem 1.25rem',
                    borderBottom: '1px solid var(--gray-border)',
                    background: 'var(--black)',
                    flexShrink: 0,
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{
                            background: 'var(--orange)', color: 'var(--black)',
                            padding: '0.15rem 0.45rem',
                            fontFamily: 'var(--font-display)', fontSize: '0.9rem',
                        }}>RIFT</div>
                        <div>
                            <div style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', letterSpacing: '0.06em' }}>USER MANUAL</div>
                            <div className="tag-label" style={{ marginTop: '1px' }}>AUTONOMOUS DEVOPS AGENT · v1.0</div>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        style={{
                            background: 'var(--gray-mid)', border: '1px solid var(--gray-border)',
                            color: 'var(--white)', width: 32, height: 32,
                            cursor: 'pointer', fontSize: '1rem', display: 'flex',
                            alignItems: 'center', justifyContent: 'center',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'var(--red)' }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'var(--gray-mid)' }}
                    >✕</button>
                </div>

                {/* Body */}
                <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
                    {/* Sidebar */}
                    <div style={{
                        width: '180px',
                        borderRight: '1px solid var(--gray-border)',
                        display: 'flex',
                        flexDirection: 'column',
                        flexShrink: 0,
                        overflowY: 'auto',
                    }}>
                        {SECTIONS.map(s => (
                            <button
                                key={s.id}
                                onClick={() => setActive(s.id)}
                                style={{
                                    background: active === s.id ? 'rgba(255,85,0,0.12)' : 'transparent',
                                    borderLeft: active === s.id ? '2px solid var(--orange)' : '2px solid transparent',
                                    border: 'none',
                                    borderLeft: active === s.id ? '2px solid var(--orange)' : '2px solid transparent',
                                    color: active === s.id ? 'var(--white)' : 'var(--gray-text)',
                                    padding: '0.65rem 1rem',
                                    textAlign: 'left',
                                    cursor: 'pointer',
                                    fontFamily: 'var(--font-mono)',
                                    fontSize: '0.65rem',
                                    letterSpacing: '0.06em',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem',
                                    transition: 'all 0.15s',
                                    width: '100%',
                                }}
                                onMouseEnter={e => { if (active !== s.id) e.currentTarget.style.color = 'var(--white)' }}
                                onMouseLeave={e => { if (active !== s.id) e.currentTarget.style.color = 'var(--gray-text)' }}
                            >
                                <span style={{ color: 'var(--orange)', width: '14px' }}>{s.icon}</span>
                                {s.title}
                            </button>
                        ))}
                    </div>

                    {/* Content */}
                    <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem 1.5rem' }}>
                        <div style={{
                            fontFamily: 'var(--font-display)',
                            fontSize: '1.1rem',
                            letterSpacing: '0.06em',
                            marginBottom: '1rem',
                            paddingBottom: '0.6rem',
                            borderBottom: '1px solid var(--gray-border)',
                            color: 'var(--orange)',
                        }}>
                            {section?.icon} {section?.title}
                        </div>
                        <div style={{
                            fontFamily: 'var(--font-mono)',
                            fontSize: '0.75rem',
                            lineHeight: 1.75,
                            color: 'var(--white)',
                        }}>
                            {section?.content}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div style={{
                    padding: '0.5rem 1.25rem',
                    borderTop: '1px solid var(--gray-border)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexShrink: 0,
                }}>
                    <span className="tag-label">TEAM JARVIS · PRANAV RAGHAVAN CM · SHRAVANI A GOWDA · POOJA K REDDY</span>
                    <span className="tag-label" style={{ color: 'var(--orange)' }}>rift101.vercel.app</span>
                </div>
            </div>

            <style>{`
                .manual-flow {
                    display: flex;
                    align-items: center;
                    gap: 0.4rem;
                    margin-top: 0.85rem;
                    flex-wrap: wrap;
                }
                .manual-flow span:not(.arrow) {
                    background: var(--gray-mid);
                    border: 1px solid var(--gray-border);
                    padding: 0.25rem 0.6rem;
                    font-size: 0.65rem;
                    letter-spacing: 0.06em;
                    color: var(--orange);
                }
                .manual-flow .arrow { color: var(--gray-text); font-size: 0.8rem; }
                .manual-list { padding-left: 1.25rem; display: flex; flex-direction: column; gap: 0.5rem; margin: 0; }
                .manual-list li { color: var(--white); }
                .manual-code {
                    background: var(--black);
                    border: 1px solid var(--orange);
                    padding: 0.5rem 0.85rem;
                    color: var(--orange);
                    font-family: var(--font-mono);
                    font-size: 0.8rem;
                    letter-spacing: 0.05em;
                    margin: 0.75rem 0;
                }
                .manual-table {
                    width: 100%;
                    border-collapse: collapse;
                    font-size: 0.7rem;
                }
                .manual-table th {
                    text-align: left;
                    padding: 0.4rem 0.6rem;
                    background: var(--black);
                    color: var(--gray-text);
                    letter-spacing: 0.05em;
                    font-size: 0.62rem;
                }
                .manual-table td {
                    padding: 0.4rem 0.6rem;
                    border-bottom: 1px solid var(--gray-border);
                }
                .manual-badge {
                    background: rgba(255,85,0,0.15);
                    border: 1px solid rgba(255,85,0,0.4);
                    color: var(--orange);
                    padding: 0.1rem 0.4rem;
                    font-size: 0.6rem;
                    letter-spacing: 0.04em;
                }
                .manual-formula { display: flex; flex-direction: column; gap: 0.5rem; }
                .formula-row {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 0.5rem 0.75rem;
                    background: var(--black);
                    border: 1px solid var(--gray-border);
                }
                .formula-label { color: var(--gray-text); font-size: 0.7rem; }
                .formula-value { font-weight: 700; font-size: 0.85rem; }
                .formula-value.green { color: var(--green); }
                .formula-value.orange { color: var(--orange); }
                .formula-value.red { color: var(--red); }
                .manual-feature-block {
                    padding: 0.75rem;
                    background: var(--black);
                    border: 1px solid var(--gray-border);
                    border-left: 2px solid var(--orange);
                }
                .feature-title {
                    font-family: var(--font-display);
                    font-size: 0.85rem;
                    letter-spacing: 0.04em;
                    margin-bottom: 0.35rem;
                    color: var(--white);
                }
                .manual-feature-block p { color: var(--gray-text); margin: 0; font-size: 0.7rem; line-height: 1.6; }
                .manual-feature-block strong { color: var(--white); }
            `}</style>
        </div>
    )
}
