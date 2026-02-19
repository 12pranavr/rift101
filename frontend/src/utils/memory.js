export const MEMORY_KEY = 'rift_memory'

export function getAllMemories() {
    try {
        const raw = localStorage.getItem(MEMORY_KEY)
        return raw ? JSON.parse(raw) : {}
    } catch (e) {
        console.error("Failed to load rift_memory", e)
        return {}
    }
}

export function getRepoMemory(repoUrl) {
    const memories = getAllMemories()
    return memories[repoUrl] || null
}

export function saveRunToMemory(repoUrl, runData) {
    if (!repoUrl || !runData) return
    const memories = getAllMemories()

    const existing = memories[repoUrl] || {
        repoUrl,
        runs: [],
        lastRanAt: null,
        totalRunCount: 0,
        totalFixesEverApplied: 0
    }

    // Aggregate bug types from fixes
    const bugTypes = {}
    const fixes = runData.fixes || []
    fixes.forEach(f => {
        const type = f.bug_type || 'UNKNOWN'
        bugTypes[type] = (bugTypes[type] || 0) + 1
    })

    // Construct run object
    const newRun = {
        runId: runData.run_id,
        teamName: runData.team_name,
        leaderName: runData.leader_name,
        ranAt: runData.end_time || new Date().toISOString(),
        score: runData.score?.total || 0,
        status: runData.final_status,
        analysisSummary: {
            totalBugsFound: runData.total_failures_detected || fixes.length,
            bugTypes
        },
        fixesApplied: fixes.map(f => ({
            file: f.file,
            line: f.line_number,
            bugType: f.bug_type,
            commitMessage: f.commit_message,
            status: f.status
        })),
        timeline: (runData.cicd_timeline || []).map(t => ({
            iteration: t.iteration,
            timestamp: t.timestamp,
            status: t.status,
            failuresRemaining: t.failures_remaining
        }))
    }

    existing.runs.push(newRun)
    existing.lastRanAt = newRun.ranAt
    existing.totalRunCount += 1
    existing.totalFixesEverApplied += newRun.fixesApplied.filter(f => f.status === 'FIXED').length

    memories[repoUrl] = existing
    localStorage.setItem(MEMORY_KEY, JSON.stringify(memories))
}

export function formatMemoryContext(memory) {
    if (!memory || !memory.runs || memory.runs.length === 0) return ""

    // Take last 3 runs
    const recentRuns = memory.runs.slice(-3).reverse()

    return recentRuns.map((run, i) => {
        const bugs = run.analysisSummary.bugTypes || {}
        const bugSummary = Object.entries(bugs).map(([k, v]) => `${k}: ${v}`).join(", ")
        const keyFixes = run.fixesApplied.slice(0, 5).map(f => `- ${f.file} (${f.bugType}): ${f.commitMessage}`).join("\n")

        return `RUN #${memory.runs.length - i} (${new Date(run.ranAt).toLocaleDateString()}):
Score: ${run.score} | Status: ${run.status}
Bugs Found: ${run.analysisSummary.totalBugsFound} [${bugSummary}]
Key Fixes Applied:
${keyFixes}
...`
    }).join("\n\n")
}

export function deleteRepoMemory(repoUrl) {
    const memories = getAllMemories()
    if (memories[repoUrl]) {
        delete memories[repoUrl]
        localStorage.setItem(MEMORY_KEY, JSON.stringify(memories))
    }
}

export function clearAllMemories() {
    localStorage.removeItem(MEMORY_KEY)
}
