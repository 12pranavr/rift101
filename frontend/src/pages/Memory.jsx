import { useState, useMemo } from 'react'
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    BarChart, Bar
} from 'recharts'
import { getAllMemories, deleteRepoMemory, clearAllMemories } from '../utils/memory' // Adjust path if needed

const BUG_COLORS = {
    SYNTAX: '#FF6B6B',
    LOGIC: '#4ECDC4',
    IMPORT: '#FFE66D',
    LINTING: '#FF9F43',
    VULNERABILITY: '#FF0000',
    UNKNOWN: '#CCCCCC'
}

export default function Memory() {
    const [memories, setMemories] = useState(getAllMemories())
    const [selectedRepo, setSelectedRepo] = useState(null) // repoUrl string
    const [search, setSearch] = useState('')

    const filteredRepos = Object.values(memories)
        .filter(m => m.repoUrl.toLowerCase().includes(search.toLowerCase()))
        .sort((a, b) => new Date(b.lastRanAt) - new Date(a.lastRanAt))

    const activeMemory = selectedRepo ? memories[selectedRepo] : null

    const handleDelete = (repoUrl, e) => {
        e.stopPropagation()
        if (confirm(`Delete memory for ${repoUrl}?`)) {
            deleteRepoMemory(repoUrl)
            setMemories(getAllMemories())
            if (activeMemory && activeMemory.repoUrl === repoUrl) setSelectedRepo(null)
        }
    }

    const handleClearAll = () => {
        if (confirm("Clear ALL memories? This cannot be undone.")) {
            clearAllMemories()
            setMemories({})
            setSelectedRepo(null)
        }
    }

    // Prepare data for selected repo
    const chartData = useMemo(() => {
        if (!activeMemory) return []
        return activeMemory.runs.map((run, i) => {
            // Reconstruct passing/failing from last timeline entry?
            // Or just use bugs found? "X axis run number, Y axis tests passing vs failing"
            // We have `timeline` array in run. We can take the LAST entry of timeline.
            const finalState = run.timeline && run.timeline.length > 0
                ? run.timeline[run.timeline.length - 1]
                : { testsPassing: 0, failuresRemaining: run.analysisSummary?.totalBugsFound || 0 }

            // Wait, timeline entry has `failuresRemaining`. Passing?
            // `sandbox_result` has `passed`. But we don't store it explicitly in run.timeline?
            // `runData` passed to saveRunToMemory had `cicd_timeline`.

            return {
                name: `Run ${i + 1}`,
                bugs: run.analysisSummary.totalBugsFound,
                score: run.score
            }
        })
    }, [activeMemory])

    // Aggregate bug types for Bar Chart
    const bugTypeData = useMemo(() => {
        if (!activeMemory) return []
        const totalCounts = {}
        activeMemory.runs.forEach(run => {
            const types = run.analysisSummary.bugTypes || {}
            Object.entries(types).forEach(([k, v]) => {
                totalCounts[k] = (totalCounts[k] || 0) + v
            })
        })
        return Object.entries(totalCounts).map(([name, value]) => ({ name, value }))
    }, [activeMemory])

    // Flat list of all fixes
    const allFixes = useMemo(() => {
        if (!activeMemory) return []
        const list = []
        activeMemory.runs.forEach(run => {
            (run.fixesApplied || []).forEach(fix => {
                list.push({ ...fix, date: run.ranAt, runId: run.runId })
            })
        })
        return list.reverse() // Most recent first
    }, [activeMemory])

    return (
        <div style={{ padding: '2rem', height: '100%', overflowY: 'auto', background: 'var(--black)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2rem' }}>
                <h1 style={{ fontFamily: 'var(--font-display)', margin: 0 }}>🧠 MEMORY BANK</h1>
                <div style={{ display: 'flex', gap: '1rem' }}>
                    <input
                        className="input-field"
                        placeholder="Search repos..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        style={{ width: 250 }}
                    />
                    <button className="btn btn-secondary" onClick={handleClearAll} style={{ background: '#330000', borderColor: '#550000', color: '#ff6b6b' }}>
                        CLEAR ALL
                    </button>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '2rem', height: 'calc(100vh - 150px)' }}>
                {/* Repo List */}
                <div style={{ overflowY: 'auto', paddingRight: '0.5rem' }}>
                    {filteredRepos.map(repo => (
                        <div
                            key={repo.repoUrl}
                            onClick={() => setSelectedRepo(repo.repoUrl)}
                            className="panel"
                            style={{
                                marginBottom: '1rem',
                                cursor: 'pointer',
                                borderLeft: `4px solid ${repo.runs[repo.runs.length - 1]?.status === 'PASSED' ? '#4ECDC4' : '#FF6B6B'}`,
                                background: selectedRepo === repo.repoUrl ? 'var(--gray-mid)' : 'var(--gray-dark)'
                            }}
                        >
                            <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.3rem', wordBreak: 'break-all' }}>
                                {repo.repoUrl.replace('https://github.com/', '')}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--gray-text)', display: 'flex', justifyContent: 'space-between' }}>
                                <span>{repo.totalRunCount} Runs</span>
                                <span>{new Date(repo.lastRanAt).toLocaleDateString()}</span>
                            </div>
                            <button
                                onClick={(e) => handleDelete(repo.repoUrl, e)}
                                style={{
                                    background: 'none', border: 'none', color: '#666',
                                    fontSize: '0.7rem', marginTop: '0.5rem', cursor: 'pointer',
                                    padding: 0
                                }}
                            >
                                Delete
                            </button>
                        </div>
                    ))}
                    {filteredRepos.length === 0 && (
                        <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--gray-text)' }}>
                            No memories found.
                        </div>
                    )}
                </div>

                {/* Detail View */}
                <div style={{ overflowY: 'auto', paddingRight: '1rem' }}>
                    {activeMemory ? (
                        <div className="animate-fade-in">
                            <h2 style={{ fontFamily: 'var(--font-mono)', marginBottom: '1.5rem', borderBottom: '1px solid var(--gray-border)', paddingBottom: '0.5rem' }}>
                                {activeMemory.repoUrl}
                            </h2>

                            {/* Stats Grid */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '2rem' }}>
                                <StatCard label="Total Runs" value={activeMemory.totalRunCount} />
                                <StatCard label="Total Fixes" value={activeMemory.totalFixesEverApplied} />
                                <StatCard label="Avg Score" value={Math.round(activeMemory.runs.reduce((a, b) => a + (b.score || 0), 0) / activeMemory.runs.length)} />
                                <StatCard label="Latest Status" value={activeMemory.runs[activeMemory.runs.length - 1].status} />
                            </div>

                            {/* Charts Row */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginBottom: '2rem' }}>
                                <div className="panel">
                                    <h3 className="section-title">Analysis Summary (Bug Types)</h3>
                                    <div style={{ height: 200, width: '100%' }}>
                                        <ResponsiveContainer>
                                            <BarChart data={bugTypeData}>
                                                <XAxis dataKey="name" stroke="#666" fontSize={10} />
                                                <YAxis stroke="#666" fontSize={10} />
                                                <Tooltip contentStyle={{ background: '#333', border: '1px solid #555' }} />
                                                <Bar dataKey="value" fill="#4ECDC4" />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                                <div className="panel">
                                    <h3 className="section-title">Improvement Timeline</h3>
                                    <div style={{ height: 200, width: '100%' }}>
                                        <ResponsiveContainer>
                                            <LineChart data={chartData}>
                                                <XAxis dataKey="name" stroke="#666" fontSize={10} />
                                                <YAxis stroke="#666" fontSize={10} />
                                                <Tooltip contentStyle={{ background: '#333', border: '1px solid #555' }} />
                                                <Line type="monotone" dataKey="score" stroke="#ffe66d" strokeWidth={2} dot={{ r: 4 }} />
                                                <Line type="monotone" dataKey="bugs" stroke="#ff6b6b" strokeWidth={2} dot={{ r: 4 }} />
                                                <Legend />
                                            </LineChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                            </div>

                            {/* Fixes List */}
                            <div className="panel">
                                <h3 className="section-title">All Fixes Ever Applied</h3>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                                    <thead style={{ textAlign: 'left', borderBottom: '1px solid var(--gray-mid)' }}>
                                        <tr>
                                            <th style={{ padding: '0.5rem' }}>Date</th>
                                            <th style={{ padding: '0.5rem' }}>File</th>
                                            <th style={{ padding: '0.5rem' }}>Type</th>
                                            <th style={{ padding: '0.5rem' }}>Message</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {allFixes.map((fix, i) => (
                                            <tr key={i} style={{ borderBottom: '1px solid var(--gray-border)' }}>
                                                <td style={{ padding: '0.5rem', color: 'var(--gray-text)' }}>
                                                    {new Date(fix.date).toLocaleDateString()}
                                                </td>
                                                <td style={{ padding: '0.5rem', fontFamily: 'var(--font-mono)' }}>{fix.file}</td>
                                                <td style={{ padding: '0.5rem' }}>
                                                    <span style={{
                                                        color: BUG_COLORS[fix.bugType] || '#fff',
                                                        fontSize: '0.75rem',
                                                        border: `1px solid ${BUG_COLORS[fix.bugType] || '#555'}`,
                                                        padding: '2px 6px',
                                                        borderRadius: 4
                                                    }}>
                                                        {fix.bugType}
                                                    </span>
                                                </td>
                                                <td style={{ padding: '0.5rem', color: 'var(--gray-text)' }}>{fix.commitMessage}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                        </div>
                    ) : (
                        <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', opacity: 0.3 }}>
                            SELECT A REPO TO VIEW MEMORY
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

function StatCard({ label, value }) {
    return (
        <div className="panel" style={{ padding: '1rem', textAlign: 'center' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--gray-text)', textTransform: 'uppercase' }}>{label}</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, marginTop: '0.25rem' }}>{value}</div>
        </div>
    )
}
