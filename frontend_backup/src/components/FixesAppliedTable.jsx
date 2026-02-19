const BUG_COLORS = {
    LINTING: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', border: 'border-yellow-500/30' },
    SYNTAX: { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/30' },
    LOGIC: { bg: 'bg-orange-500/20', text: 'text-orange-400', border: 'border-orange-500/30' },
    TYPE_ERROR: { bg: 'bg-purple-500/20', text: 'text-purple-400', border: 'border-purple-500/30' },
    IMPORT: { bg: 'bg-blue-500/20', text: 'text-blue-400', border: 'border-blue-500/30' },
    INDENTATION: { bg: 'bg-gray-500/20', text: 'text-gray-300', border: 'border-gray-500/30' },
}

export default function FixesAppliedTable({ fixes }) {
    if (!fixes || fixes.length === 0) return null

    const fixedCount = fixes.filter((f) => f.status === 'FIXED').length

    return (
        <div className="glass-card animate-slide-up">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <span>🔧</span> Fixes Applied
                </h2>
                <div className="flex items-center gap-2">
                    <span className="badge bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                        {fixedCount} fixed
                    </span>
                    {fixes.length - fixedCount > 0 && (
                        <span className="badge bg-red-500/20 text-red-400 border border-red-500/30">
                            {fixes.length - fixedCount} failed
                        </span>
                    )}
                </div>
            </div>

            {/* Table — scrollable on mobile */}
            <div className="overflow-x-auto -mx-2 px-2">
                <table className="w-full text-sm min-w-[600px]">
                    <thead>
                        <tr className="border-b border-gray-800">
                            <th className="text-left py-2 pr-4 text-xs text-gray-400 uppercase tracking-wider font-semibold">
                                File
                            </th>
                            <th className="text-left py-2 pr-4 text-xs text-gray-400 uppercase tracking-wider font-semibold">
                                Bug Type
                            </th>
                            <th className="text-left py-2 pr-4 text-xs text-gray-400 uppercase tracking-wider font-semibold">
                                Line
                            </th>
                            <th className="text-left py-2 pr-4 text-xs text-gray-400 uppercase tracking-wider font-semibold">
                                Commit Message
                            </th>
                            <th className="text-left py-2 text-xs text-gray-400 uppercase tracking-wider font-semibold">
                                Status
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {fixes.map((fix, i) => {
                            const colors = BUG_COLORS[fix.bug_type] || BUG_COLORS.LOGIC
                            return (
                                <tr
                                    key={i}
                                    className="border-b border-gray-800/60 hover:bg-white/[0.02] transition-colors group"
                                >
                                    {/* File */}
                                    <td className="py-3 pr-4">
                                        <span className="font-mono text-xs text-blue-300 group-hover:text-blue-200 transition-colors">
                                            {fix.file}
                                        </span>
                                    </td>

                                    {/* Bug type badge */}
                                    <td className="py-3 pr-4">
                                        <span
                                            className={`badge border text-xs font-bold ${colors.bg} ${colors.text} ${colors.border}`}
                                        >
                                            {fix.bug_type}
                                        </span>
                                    </td>

                                    {/* Line number */}
                                    <td className="py-3 pr-4 text-gray-400 font-mono text-xs">
                                        {fix.line_number > 0 ? `L${fix.line_number}` : '—'}
                                    </td>

                                    {/* Commit message */}
                                    <td className="py-3 pr-4 max-w-xs">
                                        <span
                                            className="font-mono text-xs text-gray-400 block truncate"
                                            title={fix.commit_message}
                                        >
                                            {fix.commit_message}
                                        </span>
                                    </td>

                                    {/* Status */}
                                    <td className="py-3">
                                        {fix.status === 'FIXED' ? (
                                            <span className="flex items-center gap-1.5 text-emerald-400 font-bold text-xs">
                                                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                </svg>
                                                Fixed
                                            </span>
                                        ) : (
                                            <span className="flex items-center gap-1.5 text-red-400 font-bold text-xs">
                                                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                                                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                                </svg>
                                                Failed
                                            </span>
                                        )}
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
