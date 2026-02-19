export default function RunSummaryCard({ results }) {
    if (!results) return null

    const formatTime = (seconds) => {
        const m = Math.floor(seconds / 60)
        const s = Math.floor(seconds % 60)
        return `${m}m ${s}s`
    }

    const passed = results.final_status === 'PASSED'

    return (
        <div className="glass-card animate-slide-up">
            {/* Header */}
            <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <span>📊</span> Run Summary
                </h2>
                <span
                    className={`px-4 py-1.5 rounded-full text-sm font-bold ${passed
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : 'bg-red-500/20 text-red-400 border border-red-500/30'
                        }`}
                >
                    {passed ? '✅ PASSED' : '❌ FAILED'}
                </span>
            </div>

            {/* Info grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <InfoRow label="Repository" value={results.repo_url} mono truncate />
                <InfoRow
                    label="Branch Created"
                    value={results.branch_name}
                    mono
                    highlight
                />
                <InfoRow
                    label="Team / Leader"
                    value={`${results.team_name} / ${results.leader_name}`}
                />
                <InfoRow label="Time Taken" value={formatTime(results.total_time_seconds)} />

                {/* Stat badges */}
                <div>
                    <p className="text-xs text-gray-400 mb-1.5 uppercase tracking-wider font-semibold">
                        Failures Detected
                    </p>
                    <span className="badge bg-red-500/20 text-red-400 border border-red-500/30 text-sm font-bold px-3 py-1.5">
                        {results.total_failures_detected} bugs
                    </span>
                </div>
                <div>
                    <p className="text-xs text-gray-400 mb-1.5 uppercase tracking-wider font-semibold">
                        Fixes Applied
                    </p>
                    <span className="badge bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-sm font-bold px-3 py-1.5">
                        {results.total_fixes_applied} fixed
                    </span>
                </div>
            </div>

            {/* Run ID */}
            <div className="mt-4 pt-4 border-t border-gray-800">
                <p className="text-xs text-gray-500 font-mono">Run ID: {results.run_id}</p>
            </div>
        </div>
    )
}

function InfoRow({ label, value, mono, truncate, highlight }) {
    return (
        <div>
            <p className="text-xs text-gray-400 mb-1 uppercase tracking-wider font-semibold">
                {label}
            </p>
            <p
                className={`text-sm ${mono ? 'font-mono' : ''} ${highlight ? 'text-blue-400' : 'text-white'
                    } ${truncate ? 'truncate' : 'break-all'}`}
            >
                {value}
            </p>
        </div>
    )
}
