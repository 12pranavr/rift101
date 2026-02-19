import { useState, useEffect } from 'react'
import axios from 'axios'
import useAgentStore from '../store/agentStore'
import SkillsManager, { TagBadge, loadSkills } from './SkillsManager'
import { getRepoMemory, formatMemoryContext } from '../utils/memory'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']

export default function InputSection() {
    const {
        repoUrl, teamName, leaderName,
        setInput, setRunId, setStatus, setNextRun, status, reset,
        ignoreRules, setIgnoreRules,
        schedule, setSchedule,
        activeSkill, setActiveSkill,
    } = useAgentStore()

    const [loading, setLoading] = useState(false)
    const [customPrompt, setCustomPrompt] = useState('')
    const [advOpen, setAdvOpen] = useState(false)
    const [skillsOpen, setSkillsOpen] = useState(false)
    const [skills, setSkills] = useState(loadSkills)
    const [memory, setMemory] = useState(null)
    const [useMemory, setUseMemory] = useState(false)
    const isRunning = status === 'running'

    // Check for existing memory when URL changes
    useEffect(() => {
        const mem = getRepoMemory(repoUrl.trim())
        setMemory(mem)
        // Auto-enable if memory exists? User requested off by default.
        setUseMemory(false)
    }, [repoUrl])

    const handleRun = async () => {
        if (!repoUrl.trim() || !teamName.trim() || !leaderName.trim()) {
            alert('Please fill in all required fields before running.')
            return
        }
        setLoading(true)
        reset()  // status → 'idle'; DON'T set 'running' yet — wait for API response
        try {
            // Parse ignore rules — split by newline, drop blanks
            const parsedRules = ignoreRules
                .split('\n')
                .map(r => r.trim())
                .filter(Boolean)

            // Only send schedule if not "once"
            const schedulePayload = schedule.frequency !== 'once' ? schedule : null

            // Skill instructions override manual custom prompt
            const finalPrompt = activeSkill
                ? activeSkill.instructions
                : (customPrompt.trim() || null)

            // Memory context
            const memoryContext = (memory && useMemory) ? formatMemoryContext(memory) : null

            const res = await axios.post(`${API}/api/run-agent`, {
                repo_url: repoUrl.trim(),
                team_name: teamName.trim(),
                leader_name: leaderName.trim(),
                custom_prompt: finalPrompt,
                ignore_rules: parsedRules,
                schedule: schedulePayload,
                memory_context: memoryContext,
            })

            if (res.data.status === 'scheduled') {
                // Scheduled path — set status to 'scheduled' so polling never starts
                setRunId(res.data.run_id)
                setNextRun(res.data.next_run)
                setStatus('scheduled')
            } else {
                // Immediate run — only NOW set 'running' so polling kicks in
                setStatus('running')
                setRunId(res.data.run_id)
            }
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

    const handleCloseSkillsManager = () => {
        setSkillsOpen(false)
        const fresh = loadSkills()
        setSkills(fresh)
        // If the active skill was edited, sync it
        if (activeSkill) {
            const updated = fresh.find(s => s.id === activeSkill.id)
            setActiveSkill(updated || null)
        }
    }

    return (
        <>
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

                {/* Required fields */}
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

                    {/* Memory Banner */}
                    {memory && (
                        <div className="animate-slide-up" style={{
                            marginTop: '-0.5rem',
                            marginBottom: '0.5rem',
                            background: 'rgba(0, 207, 255, 0.08)',
                            border: '1px solid rgba(0, 207, 255, 0.3)',
                            padding: '0.6rem 0.8rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '1rem',
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <span style={{ fontSize: '1.2rem' }}>🧠</span>
                                <div>
                                    <div style={{ fontFamily: 'var(--font-display)', fontSize: '0.85rem', color: 'var(--white)', letterSpacing: '0.04em' }}>
                                        MEMORY FOUND
                                    </div>
                                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--gray-text)' }}>
                                        {memory.runs.length} previous runs on this repo
                                    </div>
                                </div>
                            </div>

                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: useMemory ? 'var(--white)' : 'var(--gray-text)', transition: 'color 0.2s' }}>
                                    USE MEMORY
                                </span>
                                <div style={{
                                    width: 32, height: 18,
                                    background: useMemory ? 'var(--blue)' : 'var(--gray-mid)',
                                    borderRadius: 99,
                                    position: 'relative',
                                    transition: 'background 0.2s',
                                }}>
                                    <div style={{
                                        width: 14, height: 14,
                                        background: 'white',
                                        borderRadius: '50%',
                                        position: 'absolute',
                                        top: 2,
                                        left: useMemory ? 16 : 2,
                                        transition: 'left 0.2s',
                                        boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                                    }} />
                                </div>
                                <input
                                    type="checkbox"
                                    checked={useMemory}
                                    onChange={e => setUseMemory(e.target.checked)}
                                    style={{ display: 'none' }}
                                />
                            </label>
                        </div>
                    )}
                    <Field
                        id="team-name"
                        label="TEAM NAME"
                        placeholder="e.g. JARVIS"
                        value={teamName}
                        onChange={v => setInput('teamName', v)}
                        disabled={isRunning}
                    />
                    <Field
                        id="leader-name"
                        label="TEAM LEADER"
                        placeholder="e.g. Pranav"
                        value={leaderName}
                        onChange={v => setInput('leaderName', v)}
                        disabled={isRunning}
                    />

                    {/* Custom Instructions — optional, overridden by active skill */}
                    <div>
                        <label className="tag-label" style={{ display: 'block', marginBottom: '5px' }}>
                            CUSTOM INSTRUCTIONS{' '}
                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.55rem', color: '#555', letterSpacing: '0.05em' }}>
                                OPTIONAL
                            </span>
                        </label>
                        <textarea
                            id="custom-prompt"
                            className="input-field"
                            placeholder="e.g. only fix syntax errors, ignore test files in /legacy folder"
                            value={customPrompt}
                            onChange={e => setCustomPrompt(e.target.value)}
                            disabled={isRunning || !!activeSkill}
                            rows={3}
                            style={{
                                width: '100%',
                                resize: 'vertical',
                                fontFamily: 'var(--font-mono)',
                                fontSize: '0.75rem',
                                lineHeight: 1.5,
                                boxSizing: 'border-box',
                                opacity: activeSkill ? 0.45 : 1,
                            }}
                        />
                        {(customPrompt.trim() && !activeSkill) && (
                            <div style={{
                                marginTop: '4px',
                                fontFamily: 'var(--font-mono)',
                                fontSize: '0.6rem',
                                color: 'var(--orange)',
                                letterSpacing: '0.05em',
                            }}>
                                ⚡ CUSTOM INSTRUCTIONS ACTIVE
                            </div>
                        )}
                        {activeSkill && (
                            <div style={{
                                marginTop: '4px',
                                fontFamily: 'var(--font-mono)',
                                fontSize: '0.6rem',
                                color: '#888',
                                letterSpacing: '0.05em',
                            }}>
                                ↑ Overridden by active skill
                            </div>
                        )}
                    </div>
                </div>

                {/* ── Advanced Configuration (collapsible) ── */}
                <div style={{ marginTop: '1rem' }}>
                    <button
                        type="button"
                        onClick={() => setAdvOpen(o => !o)}
                        disabled={isRunning}
                        style={{
                            width: '100%',
                            background: 'var(--gray-mid)',
                            border: '1px solid var(--gray-border)',
                            color: 'var(--gray-text)',
                            padding: '0.4rem 0.75rem',
                            textAlign: 'left',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            fontFamily: 'var(--font-mono)',
                            fontSize: '0.65rem',
                            letterSpacing: '0.08em',
                            transition: 'background 0.15s',
                        }}
                    >
                        <span style={{
                            display: 'inline-block',
                            transform: advOpen ? 'rotate(90deg)' : 'rotate(0deg)',
                            transition: 'transform 0.2s',
                            color: 'var(--orange)',
                        }}>▶</span>
                        ADVANCED CONFIGURATION
                        {(ignoreRules.trim() || schedule.frequency !== 'once' || activeSkill) && (
                            <span style={{
                                marginLeft: 'auto',
                                background: 'var(--orange)',
                                color: 'var(--black)',
                                padding: '0 0.4rem',
                                fontSize: '0.55rem',
                                letterSpacing: '0.05em',
                            }}>ACTIVE</span>
                        )}
                    </button>

                    {advOpen && (
                        <div style={{
                            border: '1px solid var(--gray-border)',
                            borderTop: 'none',
                            padding: '0.85rem',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.85rem',
                            background: 'rgba(0,0,0,0.2)',
                        }}>
                            {/* ── Skills ── */}
                            <div>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '5px' }}>
                                    <label className="tag-label">SKILL</label>
                                    <button
                                        type="button"
                                        onClick={() => { setSkills(loadSkills()); setSkillsOpen(true) }}
                                        disabled={isRunning}
                                        style={{
                                            background: 'transparent',
                                            border: '1px solid var(--gray-border)',
                                            color: 'var(--gray-text)',
                                            fontFamily: 'var(--font-mono)',
                                            fontSize: '0.58rem',
                                            letterSpacing: '0.05em',
                                            padding: '0.15rem 0.5rem',
                                            cursor: 'pointer',
                                            transition: 'color 0.15s, border-color 0.15s',
                                        }}
                                        onMouseEnter={e => { e.currentTarget.style.color = 'var(--orange)'; e.currentTarget.style.borderColor = 'var(--orange)' }}
                                        onMouseLeave={e => { e.currentTarget.style.color = 'var(--gray-text)'; e.currentTarget.style.borderColor = 'var(--gray-border)' }}
                                    >⚙ MANAGE SKILLS</button>
                                </div>

                                {/* Skill selector dropdown */}
                                <select
                                    id="skill-selector"
                                    className="input-field"
                                    value={activeSkill?.id || ''}
                                    onChange={e => {
                                        const chosen = skills.find(s => s.id === e.target.value) || null
                                        setActiveSkill(chosen)
                                    }}
                                    disabled={isRunning}
                                    style={{ width: '100%', fontFamily: 'var(--font-mono)', fontSize: '0.72rem', cursor: 'pointer', boxSizing: 'border-box' }}
                                >
                                    <option value="">— None —</option>
                                    {skills.map(s => (
                                        <option key={s.id} value={s.id}>[{s.tag}] {s.name}</option>
                                    ))}
                                </select>

                                {/* Active skill preview card */}
                                {activeSkill && (
                                    <div style={{
                                        marginTop: '0.4rem',
                                        padding: '0.5rem 0.65rem',
                                        background: 'rgba(0,0,0,0.35)',
                                        border: '1px solid var(--gray-border)',
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.25rem' }}>
                                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--white)', fontWeight: 600 }}>
                                                {activeSkill.name}
                                            </span>
                                            <TagBadge tag={activeSkill.tag} small />
                                        </div>
                                        <div style={{
                                            fontFamily: 'var(--font-mono)', fontSize: '0.62rem',
                                            color: 'var(--gray-text)', lineHeight: 1.5,
                                            overflow: 'hidden',
                                            display: '-webkit-box',
                                            WebkitLineClamp: 2,
                                            WebkitBoxOrient: 'vertical',
                                        }}>
                                            {activeSkill.instructions}
                                        </div>
                                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.57rem', color: 'var(--orange)', marginTop: '0.25rem', letterSpacing: '0.04em' }}>
                                            ⚡ SKILL ACTIVE — instructions will override custom prompt
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Ignore Rules */}
                            <div>
                                <label className="tag-label" style={{ display: 'block', marginBottom: '5px' }}>
                                    IGNORE RULES
                                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.5rem', color: '#555', marginLeft: '0.5rem' }}>
                                        one per line · glob supported
                                    </span>
                                </label>
                                <textarea
                                    id="ignore-rules"
                                    className="input-field"
                                    placeholder={`/legacy\n*.test.js\nfixtures/`}
                                    value={ignoreRules}
                                    onChange={e => setIgnoreRules(e.target.value)}
                                    disabled={isRunning}
                                    rows={4}
                                    style={{
                                        width: '100%',
                                        resize: 'vertical',
                                        fontFamily: 'var(--font-mono)',
                                        fontSize: '0.72rem',
                                        lineHeight: 1.6,
                                        boxSizing: 'border-box',
                                    }}
                                />
                            </div>

                            {/* Schedule */}
                            <div>
                                <label className="tag-label" style={{ display: 'block', marginBottom: '5px' }}>SCHEDULE</label>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                    <select
                                        id="schedule-frequency"
                                        className="input-field"
                                        value={schedule.frequency}
                                        onChange={e => setSchedule({ frequency: e.target.value })}
                                        disabled={isRunning}
                                        style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', cursor: 'pointer' }}
                                    >
                                        <option value="once">Run Once (immediate)</option>
                                        <option value="daily">Daily</option>
                                        <option value="weekly">Weekly</option>
                                    </select>

                                    {schedule.frequency !== 'once' && (
                                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                            <label className="tag-label" style={{ whiteSpace: 'nowrap' }}>AT</label>
                                            <input
                                                id="schedule-time"
                                                type="time"
                                                className="input-field"
                                                value={schedule.time}
                                                onChange={e => setSchedule({ time: e.target.value })}
                                                disabled={isRunning}
                                                style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', flex: 1 }}
                                            />
                                        </div>
                                    )}

                                    {schedule.frequency === 'weekly' && (
                                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                            <label className="tag-label" style={{ whiteSpace: 'nowrap' }}>ON</label>
                                            <select
                                                id="schedule-day"
                                                className="input-field"
                                                value={schedule.day}
                                                onChange={e => setSchedule({ day: e.target.value })}
                                                disabled={isRunning}
                                                style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', flex: 1, cursor: 'pointer' }}
                                            >
                                                {DAYS.map(d => (
                                                    <option key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1) + 'day'.slice(d.length > 3 ? 1 : 0)}</option>
                                                ))}
                                            </select>
                                        </div>
                                    )}

                                    {schedule.frequency !== 'once' && (
                                        <div style={{
                                            fontFamily: 'var(--font-mono)',
                                            fontSize: '0.6rem',
                                            color: 'var(--orange)',
                                            letterSpacing: '0.05em',
                                        }}>
                                            ⏰ SCHEDULE ACTIVE — agent will run {schedule.frequency}{schedule.frequency === 'weekly' ? ` on ${schedule.day}` : ''} at {schedule.time}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
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
                            {schedule.frequency !== 'once' && !isRunning ? 'SCHEDULING…' : 'EXECUTING…'}
                        </>
                    ) : (
                        <>{schedule.frequency !== 'once' ? '⏰\u00a0 SCHEDULE AGENT' : '▶\u00a0 DEPLOY AGENT'}</>
                    )}
                </button>
            </div>

            {/* SkillsManager modal — rendered outside the panel so it overlays the full screen */}
            {skillsOpen && (
                <SkillsManager onClose={handleCloseSkillsManager} />
            )}
        </>
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
