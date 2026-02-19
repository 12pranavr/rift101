import { useState } from 'react'
import axios from 'axios'
import useAgentStore from '../store/agentStore'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export default function InputSection() {
    const { repoUrl, teamName, leaderName, setInput, setRunId, setStatus, status, reset } =
        useAgentStore()
    const [loading, setLoading] = useState(false)

    const isRunning = status === 'running'

    const handleRun = async () => {
        if (!repoUrl.trim() || !teamName.trim() || !leaderName.trim()) {
            alert('Please fill in all three fields before running the agent.')
            return
        }

        setLoading(true)
        reset()
        setStatus('running')

        try {
            const res = await axios.post(`${API}/api/run-agent`, {
                repo_url: repoUrl.trim(),
                team_name: teamName.trim(),
                leader_name: leaderName.trim(),
            })
            setRunId(res.data.run_id)
        } catch (err) {
            setStatus('error')
            alert('Failed to start agent: ' + (err?.response?.data?.detail || err.message))
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="glass-card animate-fade-in">
            {/* Header */}
            <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center text-xl shadow-lg shadow-blue-900/40">
                    🤖
                </div>
                <div>
                    <h2 className="text-lg font-bold text-white">DevOps Agent</h2>
                    <p className="text-xs text-gray-400">Powered by Gemini • LangGraph</p>
                </div>
            </div>

            {/* Form */}
            <div className="space-y-3">
                <div>
                    <label className="block text-xs font-semibold text-gray-400 mb-1 uppercase tracking-wider">
                        GitHub Repository URL
                    </label>
                    <input
                        id="repo-url"
                        type="url"
                        placeholder="https://github.com/user/repo"
                        value={repoUrl}
                        onChange={(e) => setInput('repoUrl', e.target.value)}
                        disabled={isRunning}
                        className="input-field disabled:opacity-50"
                    />
                </div>

                <div>
                    <label className="block text-xs font-semibold text-gray-400 mb-1 uppercase tracking-wider">
                        Team Name
                    </label>
                    <input
                        id="team-name"
                        type="text"
                        placeholder="e.g. RIFT ORGANISERS"
                        value={teamName}
                        onChange={(e) => setInput('teamName', e.target.value)}
                        disabled={isRunning}
                        className="input-field disabled:opacity-50"
                    />
                </div>

                <div>
                    <label className="block text-xs font-semibold text-gray-400 mb-1 uppercase tracking-wider">
                        Team Leader Name
                    </label>
                    <input
                        id="leader-name"
                        type="text"
                        placeholder="e.g. Saiyam Kumar"
                        value={leaderName}
                        onChange={(e) => setInput('leaderName', e.target.value)}
                        disabled={isRunning}
                        className="input-field disabled:opacity-50"
                    />
                </div>

                <button
                    id="run-agent-btn"
                    onClick={handleRun}
                    disabled={loading || isRunning}
                    className="btn-primary w-full flex items-center justify-center gap-2 mt-2"
                >
                    {loading || isRunning ? (
                        <>
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            <span>Agent Running…</span>
                        </>
                    ) : (
                        <>
                            <span>🚀</span>
                            <span>Run Agent</span>
                        </>
                    )}
                </button>
            </div>

            {/* Branch name preview */}
            {teamName && leaderName && (
                <div className="mt-4 p-3 rounded-xl bg-gray-800/60 border border-gray-700/60">
                    <p className="text-xs text-gray-400 mb-1">Branch will be created:</p>
                    <p className="text-xs font-mono text-blue-300 break-all">
                        {teamName.trim().toUpperCase().replace(/\s+/g, '_')}_
                        {leaderName.trim().toUpperCase().replace(/\s+/g, '_')}_AI_Fix
                    </p>
                </div>
            )}
        </div>
    )
}
