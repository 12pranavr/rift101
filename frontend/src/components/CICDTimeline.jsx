export default function CICDTimeline({ timeline, maxRetries = 5 }) {
    if (!timeline || timeline.length === 0) return null

    return (
        <div className="panel animate-slide-up">
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.6rem', letterSpacing: '0.05em', lineHeight: 1 }}>
                    CI/CD TIMELINE
                </div>
                <div style={{
                    background: 'var(--black)',
                    border: '1px solid var(--gray-border)',
                    padding: '0.2rem 0.6rem',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.65rem',
                    color: 'var(--gray-text)',
                    letterSpacing: '0.08em',
                }}>
                    {timeline.length}/{maxRetries} ITERATIONS
                </div>
            </div>

            <div style={{ height: '1px', background: 'var(--gray-border)', marginBottom: '1rem' }} />

            {/* Timeline rows */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', position: 'relative' }}>
                {/* Vertical rail */}
                <div style={{
                    position: 'absolute',
                    left: '13px',
                    top: '8px',
                    bottom: '8px',
                    width: '1px',
                    background: 'linear-gradient(to bottom, var(--orange), var(--gray-border))',
                }} />

                {timeline.map((run, i) => {
                    const passed = run.status === 'PASSED'
                    const isLast = i === timeline.length - 1

                    return (
                        <div key={i} style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start', paddingLeft: '2rem', position: 'relative' }}>
                            {/* Dot */}
                            <div style={{
                                position: 'absolute',
                                left: '8px',
                                top: '12px',
                                width: '10px',
                                height: '10px',
                                background: passed ? 'var(--green)' : 'var(--red)',
                                boxShadow: passed ? '0 0 8px rgba(57,255,20,0.7)' : '0 0 8px rgba(255,34,68,0.7)',
                            }} />

                            {/* Card */}
                            <div style={{
                                flex: 1,
                                background: isLast
                                    ? passed
                                        ? 'rgba(57,255,20,0.04)'
                                        : 'rgba(255,34,68,0.04)'
                                    : 'var(--black)',
                                border: `1px solid ${isLast
                                    ? passed
                                        ? 'rgba(57,255,20,0.2)'
                                        : 'rgba(255,34,68,0.2)'
                                    : 'var(--gray-border)'}`,
                                padding: '0.65rem 0.85rem',
                                transition: 'background 0.2s',
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                        <span style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', letterSpacing: '0.05em', color: 'var(--white)' }}>
                                            ITER {run.iteration}
                                        </span>
                                        {isLast && (
                                            <span style={{
                                                fontFamily: 'var(--font-mono)',
                                                fontSize: '0.55rem',
                                                letterSpacing: '0.1em',
                                                color: 'var(--orange)',
                                                background: 'rgba(255,85,0,0.1)',
                                                border: '1px solid rgba(255,85,0,0.3)',
                                                padding: '0.1rem 0.3rem',
                                            }}>LATEST</span>
                                        )}
                                    </div>

                                    <span style={{
                                        fontFamily: 'var(--font-display)',
                                        fontSize: '0.85rem',
                                        letterSpacing: '0.06em',
                                        color: passed ? 'var(--green)' : 'var(--red)',
                                    }}>
                                        {passed ? '◉ PASSED' : '◈ FAILED'}
                                    </span>
                                </div>

                                {/* Timestamp */}
                                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: 'var(--gray-text)', marginTop: '0.3rem' }}>
                                    {new Date(run.timestamp).toLocaleTimeString()} · UTC
                                </div>

                                {/* Remaining failures */}
                                {run.failures_remaining > 0 && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.4rem' }}>
                                        <div style={{ width: 5, height: 5, background: '#FFD600', flexShrink: 0 }} />
                                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: '#FFD600' }}>
                                            {run.failures_remaining} FAILURE{run.failures_remaining !== 1 ? 'S' : ''} REMAINING
                                        </span>
                                    </div>
                                )}
                                {run.failures_remaining === 0 && passed && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.4rem' }}>
                                        <div style={{ width: 5, height: 5, background: 'var(--green)' }} />
                                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--green)' }}>
                                            ALL TESTS PASSING
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
