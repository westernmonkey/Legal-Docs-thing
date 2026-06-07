import FounderInput from './components/FounderInput.jsx'
import RagPipelineView from './components/RagPipelineView.jsx'
import { useFoundrAnalysis } from './hooks/useFoundrAnalysis.js'

export default function App() {
  const {
    situation,
    setSituation,
    displaySituation,
    isAnalyzing,
    feedLines,
    highlights,
    showHighlights,
    summary,
    analyze,
    resetAll,
    vizKeywords,
    vizResults,
    vizHud,
    vizCylinder,
    vizRunEpoch,
    analysisProgress,
  } = useFoundrAnalysis()

  const showReset = Boolean(summary) && !isAnalyzing

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#060608]">
      <header className="flex h-11 shrink-0 items-center justify-between border-b border-[#111] bg-black px-4">
        <div className="font-mono text-xs tracking-[0.2em] text-white">FOUNDR</div>
        <div
          className={`font-mono text-[9px] tracking-[0.15em] ${
            isAnalyzing ? 'text-[#ff6b00]' : 'text-[#333]'
          }`}
        >
          {isAnalyzing ? 'PIPELINE ACTIVE' : 'STANDBY'}
        </div>
      </header>

      <main className="grid h-full min-h-0 flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[minmax(240px,26%)_minmax(0,1fr)]">
        <section className="flex h-full min-h-0 flex-col overflow-hidden border-b border-[#111] lg:border-b-0 lg:border-r lg:border-[#111]">
          <FounderInput
            situation={situation}
            setSituation={setSituation}
            onAnalyze={analyze}
            disabled={isAnalyzing}
            highlights={highlights}
            showHighlights={showHighlights}
            displaySituation={displaySituation}
          />
        </section>

        <section className="relative flex h-full min-h-0 min-w-0 flex-col">
          <RagPipelineView
            key={vizRunEpoch}
            feedLines={feedLines}
            vizHud={vizHud}
            vizKeywords={vizKeywords}
            vizResults={vizResults}
            vizCylinder={vizCylinder}
            vizRunEpoch={vizRunEpoch}
            analysisProgress={analysisProgress}
            summary={summary}
            onReset={resetAll}
            showReset={showReset}
          />
        </section>
      </main>
    </div>
  )
}
