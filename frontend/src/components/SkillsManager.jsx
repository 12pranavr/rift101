import { useState, useEffect } from 'react'

const STORAGE_KEY = 'rift_skills'

const TAGS = ['General', 'Linting', 'Security', 'Testing', 'Performance']

const TAG_COLORS = {
    Linting: { bg: 'rgba(59,130,246,0.18)', border: '#3b82f6', text: '#93c5fd' },
    Security: { bg: 'rgba(239,68,68,0.18)', border: '#ef4444', text: '#fca5a5' },
    Testing: { bg: 'rgba(34,197,94,0.18)', border: '#22c55e', text: '#86efac' },
    Performance: { bg: 'rgba(234,179,8,0.18)', border: '#eab308', text: '#fde047' },
    General: { bg: 'rgba(107,114,128,0.18)', border: '#6b7280', text: '#d1d5db' },
}

// ── localStorage helpers ──────────────────────────────────────────────────────

function loadSkills() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY)
        return raw ? JSON.parse(raw) : []
    } catch {
        return []
    }
}

function saveSkills(skills) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(skills))
}

function genId() {
    return crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2)
}

// ── Tag badge ─────────────────────────────────────────────────────────────────

export function TagBadge({ tag, small }) {
    const c = TAG_COLORS[tag] || TAG_COLORS.General
    return (
        <span style={{
            display: 'inline-block',
            background: c.bg,
            border: `1px solid ${c.border}`,
            color: c.text,
            borderRadius: 2,
            padding: small ? '0 0.3rem' : '0.1rem 0.45rem',
            fontFamily: 'var(--font-mono)',
            fontSize: small ? '0.52rem' : '0.6rem',
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            lineHeight: 1.6,
            whiteSpace: 'nowrap',
        }}>{tag}</span>
    )
}

// ── Empty form ────────────────────────────────────────────────────────────────

const EMPTY_FORM = { name: '', tag: 'General', instructions: '' }

// ── Modal overlay style ───────────────────────────────────────────────────────

const OVERLAY = {
    position: 'fixed', inset: 0,
    background: 'rgba(0,0,0,0.75)',
    zIndex: 1000,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: '1rem',
}

// ── Main exported component ───────────────────────────────────────────────────

export default function SkillsManager({ onClose }) {
    const [skills, setSkills] = useState(loadSkills)
    const [form, setForm] = useState(EMPTY_FORM)
    const [editingId, setEditingId] = useState(null)
    const [formError, setFormError] = useState('')

    // Persist any change
    useEffect(() => { saveSkills(skills) }, [skills])

    // ── Form helpers ──────────────────────────────────────────────────────────

    const resetForm = () => { setForm(EMPTY_FORM); setEditingId(null); setFormError('') }

    const handleEdit = (skill) => {
        setEditingId(skill.id)
        setForm({ name: skill.name, tag: skill.tag, instructions: skill.instructions })
        setFormError('')
        // Scroll form into view
        document.getElementById('skill-form-name')?.focus()
    }

    const handleDelete = (id) => {
        if (!confirm('Delete this skill?')) return
        setSkills(prev => prev.filter(s => s.id !== id))
    }

    const handleSave = () => {
        if (!form.name.trim()) { setFormError('Skill name is required.'); return }
        if (!form.instructions.trim()) { setFormError('Instructions cannot be empty.'); return }
        setFormError('')

        const now = new Date().toISOString()
        if (editingId) {
            setSkills(prev => prev.map(s =>
                s.id === editingId
                    ? { ...s, name: form.name.trim(), tag: form.tag, instructions: form.instructions.trim(), updatedAt: now }
                    : s
            ))
        } else {
            setSkills(prev => [...prev, {
                id: genId(),
                name: form.name.trim(),
                tag: form.tag,
                instructions: form.instructions.trim(),
                createdAt: now,
                updatedAt: now,
            }])
        }
        resetForm()
    }

    // ── Render ────────────────────────────────────────────────────────────────

    return (
        <div style={OVERLAY} onClick={e => e.target === e.currentTarget && onClose()}>
            <div style={{
                background: 'var(--gray-dark)',
                border: '1px solid var(--gray-border)',
                width: '100%', maxWidth: 680,
                maxHeight: '90vh',
                display: 'flex', flexDirection: 'column',
                boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
            }}>
                {/* Modal header */}
                <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '0.9rem 1.25rem',
                    borderBottom: '1px solid var(--gray-border)',
                    flexShrink: 0,
                }}>
                    <div>
                        <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.3rem', letterSpacing: '0.05em', lineHeight: 1 }}>
                            SKILL MANAGER
                        </div>
                        <div className="tag-label" style={{ marginTop: '3px' }}>CREATE · EDIT · REUSE AGENT SKILLS</div>
                    </div>
                    <button
                        onClick={onClose}
                        style={{
                            background: 'transparent', border: '1px solid var(--gray-border)',
                            color: 'var(--gray-text)', width: 30, height: 30,
                            cursor: 'pointer', fontSize: '1rem', lineHeight: 1,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            flexShrink: 0,
                            transition: 'color 0.15s, border-color 0.15s',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.color = 'var(--white)'; e.currentTarget.style.borderColor = 'var(--white)' }}
                        onMouseLeave={e => { e.currentTarget.style.color = 'var(--gray-text)'; e.currentTarget.style.borderColor = 'var(--gray-border)' }}
                    >✕</button>
                </div>

                {/* Scrollable body */}
                <div style={{ overflowY: 'auto', flex: 1, padding: '1.25rem' }}>

                    {/* ── Add / Edit Form ── */}
                    <div style={{
                        background: 'var(--black)',
                        border: `1px solid ${editingId ? 'var(--orange)' : 'var(--gray-border)'}`,
                        padding: '1rem',
                        marginBottom: '1.5rem',
                    }}>
                        <div className="tag-label" style={{ marginBottom: '0.75rem', color: editingId ? 'var(--orange)' : undefined }}>
                            {editingId ? '✏ EDIT SKILL' : '+ ADD NEW SKILL'}
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                            {/* Name */}
                            <div>
                                <label className="tag-label" style={{ display: 'block', marginBottom: '4px' }}>SKILL NAME</label>
                                <input
                                    id="skill-form-name"
                                    type="text"
                                    className="input-field"
                                    placeholder='e.g. "Only fix syntax errors"'
                                    value={form.name}
                                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                                    style={{ width: '100%', boxSizing: 'border-box', fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}
                                />
                            </div>

                            {/* Tag */}
                            <div>
                                <label className="tag-label" style={{ display: 'block', marginBottom: '4px' }}>TAG / CATEGORY</label>
                                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                    {TAGS.map(t => (
                                        <button
                                            key={t}
                                            type="button"
                                            onClick={() => setForm(f => ({ ...f, tag: t }))}
                                            style={{
                                                background: form.tag === t ? TAG_COLORS[t].bg : 'transparent',
                                                border: `1px solid ${form.tag === t ? TAG_COLORS[t].border : 'var(--gray-border)'}`,
                                                color: form.tag === t ? TAG_COLORS[t].text : 'var(--gray-text)',
                                                padding: '0.2rem 0.6rem',
                                                fontFamily: 'var(--font-mono)',
                                                fontSize: '0.6rem',
                                                letterSpacing: '0.06em',
                                                textTransform: 'uppercase',
                                                cursor: 'pointer',
                                                transition: 'all 0.15s',
                                            }}
                                        >{t}</button>
                                    ))}
                                </div>
                            </div>

                            {/* Instructions */}
                            <div>
                                <label className="tag-label" style={{ display: 'block', marginBottom: '4px' }}>INSTRUCTIONS</label>
                                <textarea
                                    id="skill-form-instructions"
                                    className="input-field"
                                    placeholder="e.g. Only fix syntax errors. Ignore all test files. Do not touch type annotations."
                                    value={form.instructions}
                                    onChange={e => setForm(f => ({ ...f, instructions: e.target.value }))}
                                    rows={4}
                                    style={{
                                        width: '100%', boxSizing: 'border-box',
                                        resize: 'vertical',
                                        fontFamily: 'var(--font-mono)', fontSize: '0.73rem', lineHeight: 1.55,
                                    }}
                                />
                            </div>

                            {formError && (
                                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.62rem', color: '#ff667a', letterSpacing: '0.04em' }}>
                                    ⚠ {formError}
                                </div>
                            )}

                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <button
                                    onClick={handleSave}
                                    className="btn-primary"
                                    style={{ flex: 1, padding: '0.45rem' }}
                                >
                                    {editingId ? 'UPDATE SKILL' : 'SAVE SKILL'}
                                </button>
                                {editingId && (
                                    <button
                                        onClick={resetForm}
                                        style={{
                                            background: 'transparent',
                                            border: '1px solid var(--gray-border)',
                                            color: 'var(--gray-text)',
                                            padding: '0.45rem 0.85rem',
                                            fontFamily: 'var(--font-mono)',
                                            fontSize: '0.65rem',
                                            letterSpacing: '0.05em',
                                            cursor: 'pointer',
                                            transition: 'color 0.15s',
                                        }}
                                        onMouseEnter={e => e.currentTarget.style.color = 'var(--white)'}
                                        onMouseLeave={e => e.currentTarget.style.color = 'var(--gray-text)'}
                                    >CANCEL</button>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* ── Saved Skills List ── */}
                    <div className="tag-label" style={{ marginBottom: '0.6rem' }}>
                        SAVED SKILLS ({skills.length})
                    </div>

                    {skills.length === 0 ? (
                        <div style={{
                            textAlign: 'center', padding: '2rem',
                            fontFamily: 'var(--font-mono)', fontSize: '0.7rem',
                            color: 'var(--gray-text)', border: '1px dashed var(--gray-border)',
                        }}>
                            No skills yet — create one above.
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            {skills.map(skill => (
                                <div
                                    key={skill.id}
                                    style={{
                                        background: editingId === skill.id ? 'rgba(255,140,0,0.05)' : 'var(--black)',
                                        border: `1px solid ${editingId === skill.id ? 'var(--orange)' : 'var(--gray-border)'}`,
                                        padding: '0.75rem 0.9rem',
                                        display: 'flex', alignItems: 'flex-start', gap: '0.75rem',
                                    }}
                                >
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.3rem', flexWrap: 'wrap' }}>
                                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--white)', fontWeight: 600 }}>
                                                {skill.name}
                                            </span>
                                            <TagBadge tag={skill.tag} small />
                                        </div>
                                        <div style={{
                                            fontFamily: 'var(--font-mono)', fontSize: '0.67rem',
                                            color: 'var(--gray-text)', lineHeight: 1.5,
                                            overflow: 'hidden',
                                            display: '-webkit-box',
                                            WebkitLineClamp: 2,
                                            WebkitBoxOrient: 'vertical',
                                        }}>
                                            {skill.instructions}
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: '0.35rem', flexShrink: 0 }}>
                                        <SmallBtn
                                            label="EDIT"
                                            onClick={() => handleEdit(skill)}
                                            accent="var(--orange)"
                                        />
                                        <SmallBtn
                                            label="DEL"
                                            onClick={() => handleDelete(skill.id)}
                                            accent="#ff2244"
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Modal footer */}
                <div style={{
                    padding: '0.75rem 1.25rem',
                    borderTop: '1px solid var(--gray-border)',
                    display: 'flex', justifyContent: 'flex-end',
                    flexShrink: 0,
                }}>
                    <button
                        onClick={onClose}
                        className="btn-primary"
                        style={{ padding: '0.4rem 1.2rem' }}
                    >DONE</button>
                </div>
            </div>
        </div>
    )
}

// ── Tiny icon button ──────────────────────────────────────────────────────────

function SmallBtn({ label, onClick, accent }) {
    return (
        <button
            onClick={onClick}
            style={{
                background: 'transparent',
                border: `1px solid rgba(128,128,128,0.3)`,
                color: 'var(--gray-text)',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.55rem',
                letterSpacing: '0.05em',
                padding: '0.2rem 0.45rem',
                cursor: 'pointer',
                transition: 'all 0.15s',
            }}
            onMouseEnter={e => {
                e.currentTarget.style.borderColor = accent
                e.currentTarget.style.color = accent
            }}
            onMouseLeave={e => {
                e.currentTarget.style.borderColor = 'rgba(128,128,128,0.3)'
                e.currentTarget.style.color = 'var(--gray-text)'
            }}
        >{label}</button>
    )
}

// ── External helper: get current skills for the selector ──────────────────────

export { loadSkills, TAGS, TAG_COLORS }
