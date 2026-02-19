export default function RunSummaryCard({ results }) {
    if (!results) return null

    const formatTime = (seconds) => {
        const m = Math.floor(seconds / 60)
        const s = Math.floor(seconds % 60)
        return `${m}m ${s}s`
    }

    const passed = results.final_status === 'PASSED'

    return (
        <div className="panel animate-slide-up">
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.6rem', letterSpacing: '0.05em', lineHeight: 1 }}>
                    RUN SUMMARY
                </div>
                <div style={{
                    padding: '0.3rem 0.8rem',
                    background: passed ? 'rgba(57,255,20,0.1)' : 'rgba(255,34,68,0.1)',
                    border: `1px solid ${passed ? 'rgba(57,255,20,0.4)' : 'rgba(255,34,68,0.4)'}`,
                    fontFamily: 'var(--font-display)',
                    fontSize: '0.9rem',
                    letterSpacing: '0.08em',
                    color: passed ? 'var(--green)' : 'var(--red)',
                }}>
                    {passed ? '◉ PASSED' : '◈ FAILED'}
                </div>
            </div>

            <div style={{ height: '1px', background: 'var(--gray-border)', marginBottom: '1.25rem' }} />

            {/* Info grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <DataRow label="REPOSITORY" value={results.repo_url} mono truncate />
                <DataRow label="BRANCH CREATED" value={results.branch_name} mono highlight />
                <DataRow label="TEAM / LEADER" value={`${results.team_name} / ${results.leader_name}`} />
                <DataRow label="TIME ELAPSED" value={formatTime(results.total_time_seconds)} mono big />

                {/* Counts */}
                <div>
                    <div className="tag-label" style={{ marginBottom: '6px' }}>BUGS DETECTED</div>
                    <div style={{
                        fontFamily: 'var(--font-display)',
                        fontSize: '2.5rem',
                        lineHeight: 1,
                        color: 'var(--red)',
                    }} className="glow-red">{results.total_failures_detected}</div>
                </div>
                <div>
                    <div className="tag-label" style={{ marginBottom: '6px' }}>FIXES APPLIED</div>
                    <div style={{
                        fontFamily: 'var(--font-display)',
                        fontSize: '2.5rem',
                        lineHeight: 1,
                        color: 'var(--green)',
                    }} className="glow-green">{results.total_fixes_applied}</div>
                </div>
            </div>

            {/* Run ID footer */}
            <div style={{ marginTop: '1.25rem', paddingTop: '0.75rem', borderTop: '1px solid var(--gray-border)' }}>
                <div className="tag-label">RUN ID</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: '#555', marginTop: '3px' }}>
                    {results.run_id}
                </div>
            </div>
        </div>
    )
}

function DataRow({ label, value, mono, truncate, highlight, big }) {
    return (
        <div>
            <div className="tag-label" style={{ marginBottom: '4px' }}>{label}</div>
            <div style={{
                fontFamily: mono ? 'var(--font-mono)' : 'var(--font-body)',
                fontSize: big ? '1.5rem' : '0.8rem',
                fontFamily: big ? 'var(--font-display)' : mono ? 'var(--font-mono)' : 'var(--font-body)',
                color: highlight ? 'var(--orange)' : 'var(--white)',
                overflow: truncate ? 'hidden' : '',
                textOverflow: truncate ? 'ellipsis' : '',
                whiteSpace: truncate ? 'nowrap' : '',
                wordBreak: !truncate ? 'break-all' : '',
                letterSpacing: big ? '0.04em' : '',
            }}>
                {value}
            </div>
        </div>
    )
}
