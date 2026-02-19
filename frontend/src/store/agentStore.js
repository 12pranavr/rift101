import { create } from 'zustand'

const useAgentStore = create((set) => ({
    // ── Input state ──────────────────────────────────────────────────────────
    repoUrl: '',
    teamName: '',
    leaderName: '',

    // ── Run state ─────────────────────────────────────────────────────────────
    runId: null,
    status: 'idle',   // idle | running | complete | error
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
    reset: () => set({
        runId: null,
        status: 'idle',
        progress: 0,
        currentStep: '',
        results: null,
        errorMessage: '',
    }),
}))

export default useAgentStore
