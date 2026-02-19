const BUG_COLORS = {
    LINTING: { color: '#FFD600', bg: 'rgba(255,214,0,0.08)', border: 'rgba(255,214,0,0.25)' },
    SYNTAX: { color: '#FF2244', bg: 'rgba(255,34,68,0.08)', border: 'rgba(255,34,68,0.25)' },
    LOGIC: { color: '#FF5500', bg: 'rgba(255,85,0,0.08)', border: 'rgba(255,85,0,0.25)' },
    TYPE_ERROR: { color: '#BF7FFF', bg: 'rgba(191,127,255,0.08)', border: 'rgba(191,127,255,0.25)' },
    IMPORT: { color: '#00CFFF', bg: 'rgba(0,207,255,0.08)', border: 'rgba(0,207,255,0.25)' },
    INDENTATION: { color: '#888888', bg: 'rgba(136,136,136,0.08)', border: 'rgba(136,136,136,0.25)' },
}

export default function FixesAppliedTable({ fixes }) {
    if (!fixes || fixes.length === 0) return null

    // Filter out SKIPPED items (ignored by skill) so they don't clutter the UI
    const visibleFixes = fixes.filter(f => f.status !== 'SKIPPED')

    if (visibleFixes.length === 0) return null

    const fixedCount = visibleFixes.filter(f => f.status === 'FIXED').length
    const failedCount = visibleFixes.length - fixedCount

    return (
        <div className="panel animate-slide-up">
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.6rem', letterSpacing: '0.05em', lineHeight: 1 }}>
                    FIXES APPLIED
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <Chip value={fixedCount} label="FIXED" color="var(--green)" />
                    {failedCount > 0 && <Chip value={failedCount} label="FAILED" color="var(--red)" />}
                </div>
            </div>

            <div style={{ height: '1px', background: 'var(--gray-border)', marginBottom: '0.75rem' }} />

            {/* Table */}
            <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 560 }}>
                    <thead>
                        <tr>
                            {['FILE', 'TYPE', 'LINE', 'COMMIT', 'STATUS'].map(h => (
                                <th key={h} style={{
                                    textAlign: 'left',
                                    padding: '0.4rem 0.75rem',
                                    fontFamily: 'var(--font-mono)',
                                    fontSize: '0.6rem',
                                    letterSpacing: '0.1em',
                                    color: 'var(--gray-text)',
                                    borderBottom: '1px solid var(--gray-border)',
                                }}>
                                    {h}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {visibleFixes.map((fix, i) => {
                            const c = BUG_COLORS[fix.bug_type] || BUG_COLORS.LOGIC
                            const isFix = fix.status === 'FIXED'
                            return (
                                <tr key={i} style={{
                                    borderBottom: '1px solid var(--gray-border)',
                                    transition: 'background 0.15s',
                                }}
                                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,85,0,0.04)')}
                                    onMouseLeave={e => (e.currentTarget.style.background = '')}
                                >
                                    {/* File */}
                                    <td style={{ padding: '0.6rem 0.75rem' }}>
                                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--orange)' }}>
                                            {fix.file}
                                        </span>
                                    </td>

                                    {/* Bug type */}
                                    <td style={{ padding: '0.6rem 0.75rem' }}>
                                        <span style={{
                                            fontFamily: 'var(--font-mono)',
                                            fontSize: '0.6rem',
                                            letterSpacing: '0.08em',
                                            color: c.color,
                                            background: c.bg,
                                            border: `1px solid ${c.border}`,
                                            padding: '0.15rem 0.4rem',
                                        }}>
                                            {fix.bug_type}
                                        </span>
                                    </td>

                                    {/* Line */}
                                    <td style={{ padding: '0.6rem 0.75rem', fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--gray-text)' }}>
                                        {fix.line_number > 0 ? `L${fix.line_number}` : '—'}
                                    </td>

                                    {/* Commit */}
                                    <td style={{ padding: '0.6rem 0.75rem', maxWidth: '240px' }}>
                                        <span style={{
                                            fontFamily: 'var(--font-mono)',
                                            fontSize: '0.65rem',
                                            color: '#666',
                                            display: 'block',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            whiteSpace: 'nowrap',
                                        }} title={fix.commit_message}>
                                            {fix.commit_message}
                                        </span>
                                    </td>

                                    {/* Status */}
                                    <td style={{ padding: '0.6rem 0.75rem' }}>
                                        <span style={{
                                            fontFamily: 'var(--font-display)',
                                            fontSize: '0.8rem',
                                            letterSpacing: '0.06em',
                                            color: isFix ? 'var(--green)' : 'var(--red)',
                                        }}>
                                            {isFix ? '◉ FIXED' : '◈ FAILED'}
                                        </span>
                                    </td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    )
}

function Chip({ value, label, color }) {
    return (
        <div style={{
            background: `${color}12`,
            border: `1px solid ${color}44`,
            padding: '0.2rem 0.6rem',
            display: 'flex',
            gap: '0.35rem',
            alignItems: 'center',
        }}>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', color, lineHeight: 1 }}>{value}</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.55rem', color, opacity: 0.7, letterSpacing: '0.1em' }}>{label}</span>
        </div>
    )
}
