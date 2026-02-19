import useAgentStore from '../store/agentStore'

export default function ProgressBar() {
    const { status, progress, currentStep } = useAgentStore()

    if (status !== 'running') return null

    return (
        <div className="glass-card animate-fade-in gradient-border">
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-blue-400 animate-pulse" />
                    <span className="text-sm font-semibold text-white">Agent Running</span>
                </div>
                <span className="text-sm font-bold text-blue-400">{progress}%</span>
            </div>

            {/* Progress track */}
            <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden mb-3">
                <div
                    className="h-full rounded-full transition-all duration-700 ease-out"
                    style={{
                        width: `${progress}%`,
                        background: 'linear-gradient(90deg, #3b82f6, #8b5cf6)',
                        boxShadow: '0 0 12px rgba(139, 92, 246, 0.5)',
                    }}
                />
            </div>

            {/* Current step */}
            <p className="text-xs text-gray-400 font-mono truncate">
                ▶ {currentStep || 'Initializing…'}
            </p>

            {/* Step indicators */}
            <div className="flex items-center gap-1 mt-3">
                {['Clone', 'Analyze', 'Fix', 'Verify', 'Done'].map((step, i) => {
                    const stepProgress = (i + 1) * 20
                    const isActive = progress >= stepProgress - 20 && progress < stepProgress
                    const isDone = progress >= stepProgress
                    return (
                        <div key={step} className="flex-1 flex flex-col items-center gap-1">
                            <div
                                className={`w-full h-1 rounded-full transition-all duration-500 ${isDone
                                        ? 'bg-blue-500'
                                        : isActive
                                            ? 'bg-blue-500/50 animate-pulse'
                                            : 'bg-gray-700'
                                    }`}
                            />
                            <span className={`text-xs ${isDone ? 'text-blue-400' : isActive ? 'text-gray-300' : 'text-gray-600'}`}>
                                {step}
                            </span>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
