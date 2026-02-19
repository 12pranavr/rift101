import useAgentStore from '../store/agentStore'

const STEPS = ['CLONE', 'ANALYZE', 'FIX', 'VERIFY', 'DONE']
const STEP_THRESHOLDS = [20, 40, 60, 80, 100]

export default function ProgressBar() {
    const { status, progress, currentStep } = useAgentStore()
    if (status !== 'running') return null

    return (
        <div className="panel animate-fade-in" style={{ padding: '1.25rem' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{ width: 8, height: 8, background: 'var(--orange)', animation: 'blink 1.2s step-end infinite' }} />
                    <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', letterSpacing: '0.05em' }}>
                        AGENT RUNNING
                    </span>
                </div>
                <span style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: '2rem',
                    color: 'var(--orange)',
                    lineHeight: 1,
                }} className="glow-orange">{progress}<span style={{ fontSize: '1rem', opacity: 0.6 }}>%</span></span>
            </div>

            {/* Progress track — segmented */}
            <div style={{ display: 'flex', gap: '2px', height: '4px', marginBottom: '0.6rem' }}>
                {STEP_THRESHOLDS.map((threshold, i) => {
                    const filled = progress >= threshold
                    const active = progress >= threshold - 20 && progress < threshold
                    return (
                        <div
                            key={i}
                            style={{
                                flex: 1,
                                background: filled
                                    ? 'var(--orange)'
                                    : active
                                        ? 'rgba(255,85,0,0.4)'
                                        : 'var(--gray-border)',
                                transition: 'background 0.5s',
                                boxShadow: filled ? '0 0 6px var(--orange-glow)' : 'none',
                            }}
                        />
                    )
                })}
            </div>

            {/* Step labels */}
            <div style={{ display: 'flex', gap: '2px', marginBottom: '1rem' }}>
                {STEPS.map((step, i) => {
                    const isDone = progress >= STEP_THRESHOLDS[i]
                    const isActive = progress >= STEP_THRESHOLDS[i] - 20 && progress < STEP_THRESHOLDS[i]
                    return (
                        <div key={step} style={{ flex: 1, textAlign: 'center' }}>
                            <span style={{
                                fontFamily: 'var(--font-mono)',
                                fontSize: '0.55rem',
                                textTransform: 'uppercase',
                                letterSpacing: '0.06em',
                                color: isDone ? 'var(--orange)' : isActive ? 'var(--white)' : 'var(--gray-text)',
                                transition: 'color 0.3s',
                            }}>
                                {step}
                            </span>
                        </div>
                    )
                })}
            </div>

            {/* Current step */}
            <div style={{
                background: 'var(--black)',
                border: '1px solid var(--gray-border)',
                padding: '0.5rem 0.75rem',
                display: 'flex',
                gap: '0.5rem',
                alignItems: 'center',
            }}>
                <span style={{ color: 'var(--orange)', fontFamily: 'var(--font-mono)', fontSize: '0.65rem' }}>▶</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: '#aaa', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {currentStep || 'Initializing…'}
                </span>
            </div>
        </div>
    )
}
