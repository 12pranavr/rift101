import { useEffect, useState } from 'react'
import axios from 'axios'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export default function ScheduledRunsPanel() {
    const [schedules, setSchedules] = useState([])
    const [loading, setLoading] = useState(true)

    const fetchSchedules = async () => {
        try {
            const { data } = await axios.get(`${API}/api/schedules`)
            setSchedules(Array.isArray(data) ? data : [])
        } catch (e) {
            console.error('Could not fetch schedules:', e)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchSchedules()
        const interval = setInterval(fetchSchedules, 15_000)
        return () => clearInterval(interval)
    }, [])

    const handleCancel = async (schedule_id) => {
        if (!confirm('Cancel this scheduled run?')) return
        try {
            await axios.delete(`${API}/api/schedules/${schedule_id}`)
            setSchedules(prev => prev.filter(s => s.schedule_id !== schedule_id))
        } catch (e) {
            alert('Failed to cancel: ' + (e?.response?.data?.detail || e.message))
        }
    }

    return (
        <div className="panel animate-fade-in">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <div>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', letterSpacing: '0.05em', lineHeight: 1 }}>
                        SCHEDULED RUNS
                    </div>
                    <div className="tag-label" style={{ marginTop: '3px' }}>ACTIVE CRON JOBS</div>
                </div>
                <div style={{
                    background: 'var(--orange)',
                    color: 'var(--black)',
                    padding: '0.2rem 0.55rem',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.65rem',
                    letterSpacing: '0.08em',
                }}>
                    {schedules.length} ACTIVE
                </div>
            </div>

            <div style={{ height: '1px', background: 'var(--gray-border)', marginBottom: '0.85rem' }} />

            {loading ? (
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--gray-text)', textAlign: 'center', padding: '1.5rem 0' }}>
                    LOADING…
                </div>
            ) : schedules.length === 0 ? (
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--gray-text)', textAlign: 'center', padding: '1.5rem 0' }}>
                    NO SCHEDULED RUNS
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                    {schedules.map(s => (
                        <div key={s.schedule_id} style={{
                            background: 'var(--gray-dark)',
                            border: '1px solid var(--gray-border)',
                            borderLeft: '3px solid var(--orange)',
                            padding: '0.65rem 0.85rem',
                            display: 'flex',
                            alignItems: 'flex-start',
                            justifyContent: 'space-between',
                            gap: '0.75rem',
                        }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{
                                    fontFamily: 'var(--font-mono)',
                                    fontSize: '0.68rem',
                                    color: 'var(--white)',
                                    wordBreak: 'break-all',
                                    marginBottom: '0.3rem',
                                }}>
                                    {s.payload?.repo_url || '—'}
                                </div>
                                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                                    <Tag label="FREQ" value={(s.schedule?.frequency || 'once').toUpperCase()} />
                                    {s.schedule?.frequency === 'weekly' && (
                                        <Tag label="DAY" value={(s.schedule?.day || '').toUpperCase()} />
                                    )}
                                    {s.schedule?.time && (
                                        <Tag label="AT" value={s.schedule.time} />
                                    )}
                                    {s.next_run && (
                                        <Tag label="NEXT" value={fmt(s.next_run)} orange />
                                    )}
                                </div>
                            </div>
                            <button
                                onClick={() => handleCancel(s.schedule_id)}
                                style={{
                                    background: 'transparent',
                                    border: '1px solid rgba(255,34,68,0.4)',
                                    color: 'var(--red, #ff2244)',
                                    fontFamily: 'var(--font-mono)',
                                    fontSize: '0.6rem',
                                    letterSpacing: '0.05em',
                                    padding: '0.25rem 0.5rem',
                                    cursor: 'pointer',
                                    flexShrink: 0,
                                    transition: 'background 0.15s',
                                }}
                                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,34,68,0.15)'}
                                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                            >
                                CANCEL
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}

function Tag({ label, value, orange }) {
    return (
        <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '0.58rem',
            letterSpacing: '0.05em',
            color: orange ? 'var(--orange)' : 'var(--gray-text)',
        }}>
            {label}: <strong style={{ color: orange ? 'var(--orange)' : 'var(--white)' }}>{value}</strong>
        </span>
    )
}

function fmt(iso) {
    try {
        return new Date(iso).toLocaleString(undefined, {
            month: 'short', day: 'numeric',
            hour: '2-digit', minute: '2-digit',
        })
    } catch {
        return iso
    }
}
