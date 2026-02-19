export default function CICDTimeline({ timeline, maxRetries = 5 }) {
    if (!timeline || timeline.length === 0) return null

    return (
        <div className="glass-card animate-slide-up">
            {/* Header */}
            <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <span>⚡</span> CI/CD Timeline
                </h2>
                <span className="text-xs text-gray-400 bg-gray-800 rounded-lg px-3 py-1 border border-gray-700">
                    {timeline.length} / {maxRetries} iterations
                </span>
            </div>

            {/* Timeline */}
            <div className="relative">
                {/* Vertical line */}
                <div className="absolute left-4 top-2 bottom-2 w-px bg-gradient-to-b from-blue-500/50 via-gray-700 to-gray-800" />

                <div className="space-y-4">
                    {timeline.map((run, i) => {
                        const passed = run.status === 'PASSED'
                        const isLast = i === timeline.length - 1

                        return (
                            <div key={i} className="relative pl-10">
                                {/* Timeline dot */}
                                <div
                                    className={`absolute left-2.5 top-3 -translate-x-1/2 w-3 h-3 rounded-full border-2 border-gray-900 transition-all ${passed ? 'status-dot-pass' : 'status-dot-fail'
                                        }`}
                                />

                                {/* Card */}
                                <div
                                    className={`rounded-xl p-3 border transition-all ${isLast
                                            ? passed
                                                ? 'bg-emerald-500/10 border-emerald-500/30'
                                                : 'bg-red-500/10 border-red-500/30'
                                            : 'bg-gray-800/60 border-gray-700/60'
                                        }`}
                                >
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-bold text-white">
                                                Iteration {run.iteration}
                                            </span>
                                            {isLast && (
                                                <span className="text-xs text-gray-400 bg-gray-700/50 rounded px-2 py-0.5">
                                                    latest
                                                </span>
                                            )}
                                        </div>

                                        <span
                                            className={`px-3 py-1 rounded-full text-xs font-bold ${passed
                                                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                                    : 'bg-red-500/20 text-red-400 border border-red-500/30'
                                                }`}
                                        >
                                            {passed ? '✅ PASSED' : '❌ FAILED'}
                                        </span>
                                    </div>

                                    {/* Timestamp */}
                                    <p className="text-xs text-gray-500 mt-1.5 font-mono">
                                        {new Date(run.timestamp).toLocaleTimeString()} UTC
                                    </p>

                                    {/* Failures remaining */}
                                    {run.failures_remaining > 0 && (
                                        <div className="mt-2 flex items-center gap-1.5">
                                            <div className="w-1.5 h-1.5 rounded-full bg-yellow-500" />
                                            <p className="text-xs text-yellow-400">
                                                {run.failures_remaining} failure{run.failures_remaining !== 1 ? 's' : ''} remaining
                                            </p>
                                        </div>
                                    )}
                                    {run.failures_remaining === 0 && passed && (
                                        <div className="mt-2 flex items-center gap-1.5">
                                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                            <p className="text-xs text-emerald-400">All tests passing 🎉</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>
        </div>
    )
}
