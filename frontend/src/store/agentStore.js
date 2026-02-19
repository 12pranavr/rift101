import { create } from 'zustand'

const useAgentStore = create((set) => ({
    // ── Input state ──────────────────────────────────────────────────────────
    repoUrl: '',
    teamName: '',
    leaderName: '',

    // ── Advanced config ───────────────────────────────────────────────────────
    ignoreRules: '',                                  // raw textarea — one rule per line
    schedule: { frequency: 'once', time: '09:00', day: 'mon' },
    activeSkill: null,                                // full skill object or null

    // ── Run state ─────────────────────────────────────────────────────────────
    runId: null,
    status: 'idle',   // idle | running | complete | error | scheduled
    nextRun: null,    // ISO string (scheduled only)
    progress: 0,
    currentStep: '',
    errorMessage: '',

    // ── Results ───────────────────────────────────────────────────────────────
    results: null,

    // ── Actions ───────────────────────────────────────────────────────────────
    setInput: (field, value) => set({ [field]: value }),
    setRunId: (runId) => set({ runId }),
    setStatus: (status, errorMessage = '') => set({ status, errorMessage }),
    setProgress: (progress, currentStep) => set({ progress, currentStep }),
    setResults: (results) => set({ results }),
    setIgnoreRules: (ignoreRules) => set({ ignoreRules }),
    setSchedule: (patch) => set((s) => ({ schedule: { ...s.schedule, ...patch } })),
    setNextRun: (nextRun) => set({ nextRun }),
    setActiveSkill: (skill) => set({ activeSkill: skill }),   // skill object or null
    reset: () => set({
        runId: null,
        status: 'idle',
        nextRun: null,
        progress: 0,
        currentStep: '',
        results: null,
        errorMessage: '',
    }),
}))

export default useAgentStore
