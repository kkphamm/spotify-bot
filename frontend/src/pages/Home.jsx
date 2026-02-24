import Topbar from '../components/Topbar'
import VoiceAssistant from '../components/VoiceAssistant'
import FeatureGrid from '../components/FeatureGrid'

export default function Home() {
  return (
    <div className="min-h-full">
      <div className="bg-gradient-to-b from-[#1a3a2a] to-[#121212] pb-8">
        <Topbar title="Good evening" />

        {/* Voice Assistant */}
        <div className="px-8 mt-4">
          <VoiceAssistant />
        </div>

        {/* Feature status grid */}
        <div className="px-8 mt-6">
          <FeatureGrid />
        </div>
      </div>
    </div>
  )
}
