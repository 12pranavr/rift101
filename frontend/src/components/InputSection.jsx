import { useState } from 'react'
import axios from 'axios'
import useAgentStore from '../store/agentStore'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export default function InputSection() {
    const { repoUrl, teamName, leaderName, setInput, setRunId, setStatus, status, reset } = useAgentStore()
    const [loading, setLoading] = useState(false)
    const isRunning = status === 'running'

    const handleRun = async () => {
        if (!repoUrl.trim() || !teamName.trim() || !leaderName.trim()) {
            alert('Please fill in all fields before running.')
            return
        }
        setLoading(true)
        reset()
        setStatus('running')
        try {
            const res = await axios.post(`${API}/api/run-agent`, {
                repo_url: repoUrl.trim(),
                team_name: teamName.trim(),
                leader_name: leaderName.trim(),
            })
            setRunId(res.data.run_id)
        } catch (err) {
            setStatus('error')
            alert('Failed to start agent: ' + (err?.response?.data?.detail || err.message))
        } finally {
            setLoading(false)
        }
    }

    const branchPreview = teamName && leaderName
        ? `${teamName.trim().toUpperCase().replace(/\s+/g, '_')}_${leaderName.trim().toUpperCase().replace(/\s+/g, '_')}_AI_Fix`
        : null

    return (
        <div className="panel animate-fade-in">
            {/* Header row */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
                <div>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.6rem', letterSpacing: '0.05em', lineHeight: 1 }}>
                        AGENT INPUT
                    </div>
                    <div className="tag-label" style={{ marginTop: '3px' }}>CONFIGURE · DEPLOY · EXECUTE</div>
                </div>
                <div style={{
                    background: isRunning ? 'var(--orange)' : 'var(--gray-mid)',
                    border: '1px solid var(--gray-border)',
                    padding: '0.25rem 0.6rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                }}>
                    <div style={{
                        width: 6, height: 6,
                        background: isRunning ? 'var(--black)' : '#444',
                        borderRadius: '50%',
                        animation: isRunning ? 'blink 1.2s step-end infinite' : 'none',
                    }} />
                    <span style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '0.6rem',
                        color: isRunning ? 'var(--black)' : '#444',
                        textTransform: 'uppercase',
                        letterSpacing: '0.08em',
                    }}>
                        {isRunning ? 'ACTIVE' : 'STANDBY'}
                    </span>
                </div>
            </div>

            {/* Divider */}
            <div style={{ height: '1px', background: 'var(--gray-border)', marginBottom: '1.25rem' }} />

            {/* Fields */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                <Field
                    id="repo-url"
                    label="GITHUB REPO URL"
                    placeholder="https://github.com/user/repo"
                    value={repoUrl}
                    onChange={v => setInput('repoUrl', v)}
                    disabled={isRunning}
                    type="url"
                />
                <Field
                    id="team-name"
                    label="TEAM NAME"
                    placeholder="e.g. RIFT ORGANISERS"
                    value={teamName}
                    onChange={v => setInput('teamName', v)}
                    disabled={isRunning}
                />
                <Field
                    id="leader-name"
                    label="TEAM LEADER"
                    placeholder="e.g. Saiyam Kumar"
                    value={leaderName}
                    onChange={v => setInput('leaderName', v)}
                    disabled={isRunning}
                />
            </div>

            {/* Branch preview */}
            {branchPreview && (
                <div style={{ marginTop: '0.85rem', padding: '0.6rem 0.75rem', background: 'var(--black)', border: '1px solid var(--gray-border)' }}>
                    <div className="tag-label" style={{ marginBottom: '4px' }}>BRANCH TARGET</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--orange)', wordBreak: 'break-all' }}>
                        {branchPreview}
                    </div>
                </div>
            )}

            {/* Run button */}
            <button
                id="run-agent-btn"
                onClick={handleRun}
                disabled={loading || isRunning}
                className="btn-primary"
                style={{ width: '100%', marginTop: '1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
            >
                {loading || isRunning ? (
                    <>
                        <div style={{ width: 16, height: 16, border: '2px solid var(--black)', borderTopColor: 'transparent', borderRadius: '50%' }} className="animate-spin" />
                        EXECUTING…
                    </>
                ) : (
                    <>▶&nbsp; DEPLOY AGENT</>
                )}
            </button>
        </div>
    )
}

function Field({ id, label, placeholder, value, onChange, disabled, type = 'text' }) {
    return (
        <div>
            <label className="tag-label" style={{ display: 'block', marginBottom: '5px' }}>{label}</label>
            <input
                id={id}
                type={type}
                className="input-field"
                placeholder={placeholder}
                value={value}
                onChange={e => onChange(e.target.value)}
                disabled={disabled}
            />
        </div>
    )
}
