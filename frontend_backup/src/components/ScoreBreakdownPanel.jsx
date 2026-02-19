import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    Tooltip,
    ResponsiveContainer,
    Cell,
} from 'recharts'

const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
        const val = payload[0].value
        return (
            <div className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm">
                <p className="text-gray-300">{label}</p>
                <p className={`font-bold ${val >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {val >= 0 ? '+' : ''}{val} pts
                </p>
            </div>
        )
    }
    return null
}

export default function ScoreBreakdownPanel({ score }) {
    if (!score) return null

    const data = [
        { name: 'Base Score', value: score.base, color: '#22c55e' },
        { name: 'Speed Bonus', value: score.speed_bonus, color: '#3b82f6' },
        { name: 'Penalty', value: -score.efficiency_penalty, color: '#ef4444' },
    ]

    const totalColor =
        score.total >= 100
            ? 'text-emerald-400'
            : score.total >= 80
                ? 'text-yellow-400'
                : 'text-red-400'

    return (
        <div className="glass-card animate-slide-up">
            <h2 className="text-lg font-bold text-white mb-1 flex items-center gap-2">
                <span>🏆</span> Score Breakdown
            </h2>

            {/* Big score number */}
            <div className="text-center my-4">
                <p className={`text-7xl font-black tracking-tight ${totalColor} glow-blue`}>
                    {score.total}
                </p>
                <p className="text-sm text-gray-400 mt-1">Total Score</p>
            </div>

            {/* Score breakdown pills */}
            <div className="grid grid-cols-3 gap-2 mb-5">
                <ScorePill label="Base" value={`+${score.base}`} color="emerald" />
                <ScorePill label="Speed" value={`+${score.speed_bonus}`} color="blue" />
                <ScorePill
                    label="Penalty"
                    value={`-${score.efficiency_penalty}`}
                    color="red"
                />
            </div>

            {/* Bar chart */}
            <ResponsiveContainer width="100%" height={130}>
                <BarChart data={data} layout="vertical" margin={{ left: 0, right: 10 }}>
                    <XAxis type="number" stroke="#374151" tick={{ fill: '#6b7280', fontSize: 11 }} />
                    <YAxis
                        type="category"
                        dataKey="name"
                        stroke="#374151"
                        tick={{ fill: '#9ca3af', fontSize: 11 }}
                        width={90}
                    />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                        {data.map((entry, index) => (
                            <Cell key={index} fill={entry.color} />
                        ))}
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
        </div>
    )
}

function ScorePill({ label, value, color }) {
    const colors = {
        emerald: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
        blue: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
        red: 'bg-red-500/10 text-red-400 border-red-500/20',
    }
    return (
        <div className={`border rounded-xl p-2 text-center ${colors[color]}`}>
            <p className="text-lg font-bold">{value}</p>
            <p className="text-xs opacity-70">{label}</p>
        </div>
    )
}
