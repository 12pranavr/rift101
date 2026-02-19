import {
    BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts'

const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
        const val = payload[0].value
        return (
            <div style={{ background: 'var(--gray-mid)', border: '1px solid var(--gray-border)', padding: '0.5rem 0.75rem' }}>
                <div className="tag-label">{label}</div>
                <div style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: '1.2rem',
                    color: val >= 0 ? 'var(--green)' : 'var(--red)',
                }}>
                    {val >= 0 ? '+' : ''}{val} PTS
                </div>
            </div>
        )
    }
    return null
}

export default function ScoreBreakdownPanel({ score }) {
    if (!score) return null

    const data = [
        { name: 'BASE', value: score.base, color: '#39FF14' },
        { name: 'SPEED', value: score.speed_bonus, color: '#FF5500' },
        { name: 'PENALTY', value: -score.efficiency_penalty, color: '#FF2244' },
    ]

    const totalColor = score.total >= 100
        ? 'var(--green)'
        : score.total >= 80
            ? '#FFD600'
            : 'var(--red)'

    return (
        <div className="panel animate-slide-up">
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.6rem', letterSpacing: '0.05em', marginBottom: '1rem', lineHeight: 1 }}>
                SCORE BREAKDOWN
            </div>

            <div style={{ height: '1px', background: 'var(--gray-border)', marginBottom: '1rem' }} />

            {/* Big score */}
            <div style={{ textAlign: 'center', padding: '1rem 0' }}>
                <div style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: '6rem',
                    lineHeight: 0.9,
                    color: totalColor,
                    textShadow: `0 0 30px ${totalColor}88`,
                    letterSpacing: '0.02em',
                }}>
                    {score.total}
                </div>
                <div className="tag-label" style={{ marginTop: '0.5rem' }}>TOTAL SCORE</div>
            </div>

            {/* Score pills */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '2px', margin: '1rem 0' }}>
                {[
                    {
                        label: 'BASE',
                        value: `+${score.base}`,
                        sub: 'always',
                        color: 'var(--green)',
                    },
                    {
                        label: 'SPEED BONUS',
                        value: score.speed_bonus > 0 ? `+${score.speed_bonus}` : '0',
                        sub: score.speed_tier ?? (score.speed_bonus > 0 ? '< 5 min' : '≥ 5 min'),
                        color: 'var(--orange)',
                    },
                    {
                        label: 'EFFICIENCY',
                        value: `-${score.efficiency_penalty}`,
                        sub: score.excess_commits > 0
                            ? `${score.excess_commits} extra commits`
                            : `${score.total_commits ?? 0} commits`,
                        color: 'var(--red)',
                    },
                ].map(p => (
                    <div key={p.label} style={{
                        background: 'var(--black)',
                        border: '1px solid var(--gray-border)',
                        padding: '0.5rem',
                        textAlign: 'center',
                        borderTop: `2px solid ${p.color}`,
                    }}>
                        <div className="tag-label">{p.label}</div>
                        <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', color: p.color, marginTop: '2px' }}>
                            {p.value}
                        </div>
                        <div style={{ fontSize: '0.65rem', color: '#555', marginTop: '2px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            {p.sub}
                        </div>
                    </div>
                ))}
            </div>

            {/* Formula legend */}
            <div style={{
                fontSize: '0.7rem',
                color: '#555',
                fontFamily: 'var(--font-mono, monospace)',
                lineHeight: 1.8,
                borderTop: '1px solid var(--gray-border)',
                paddingTop: '0.75rem',
                marginTop: '0.5rem',
            }}>
                <span style={{ color: '#39FF14' }}>Base: 100 pts</span>
                {'  ·  '}
                <span style={{ color: '#FF5500' }}>Speed: +10 if &lt; 5 min</span>
                {'  ·  '}
                <span style={{ color: '#FF2244' }}>Penalty: −2 per commit over 20</span>
            </div>

            {/* Bar chart */}
            <ResponsiveContainer width="100%" height={110}>
                <BarChart data={data} layout="vertical" margin={{ left: 0, right: 8 }}>
                    <XAxis type="number" stroke="#2a2a2a" tick={{ fill: '#555', fontSize: 10, fontFamily: 'JetBrains Mono' }} />
                    <YAxis type="category" dataKey="name" stroke="#2a2a2a" tick={{ fill: '#888', fontSize: 10, fontFamily: 'JetBrains Mono' }} width={64} />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,85,0,0.05)' }} />
                    <Bar dataKey="value" radius={0}>
                        {data.map((entry, index) => (
                            <Cell key={index} fill={entry.color} />
                        ))}
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
        </div>
    )
}
