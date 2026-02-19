import { Sparkles } from 'lucide-react';
import { useScrollReveal } from './useScrollReveal';

const apps = [
  {
    name: 'Life Dashboard',
    prompt: '"Show my fitness, finances, reading goals, and habits in one view"',
    image: '/images/life-dashboard-2.png',
  },
  {
    name: 'Company Dashboard',
    prompt: '"Build a dashboard with MRR, users, sprint progress, and team overview"',
    image: '/images/company-dashboard.png',
  },
  {
    name: 'OKR Tracker',
    prompt: '"Create an OKR tracker with objectives, key results, and progress bars"',
    image: '/images/okr-tracker.png',
  },
  {
    name: 'Reading List Board',
    prompt: '"Organize my books into a kanban board by reading status"',
    image: '/images/reading-board.png',
  },
];

export default function FeatureCustomApps() {
  const { ref, isVisible } = useScrollReveal();

  return (
    <section className="py-24 bg-white overflow-hidden">
      <div className="max-w-6xl mx-auto px-6">
        <div
          ref={ref}
          className={`text-center mb-6 transition-all duration-700 ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
          }`}
        >
          <div className="text-sm font-semibold text-purple-600 uppercase tracking-wider mb-3">
            Custom Apps & Views
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
            Describe it. See it. Use it.
          </h2>
          <p className="text-lg text-gray-500 max-w-3xl mx-auto leading-relaxed">
            Tell the AI what you want to see and it builds a custom mini app from your data.
            Dashboards, charts, matrices, timelines — each one is a self-contained HTML view
            you can reuse, customize, or share.
          </p>
        </div>

        {/* "Vibe views" tagline */}
        <div className={`text-center mb-14 transition-all duration-700 delay-100 ${isVisible ? 'opacity-100' : 'opacity-0'}`}>
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-purple-50 border border-purple-100 text-purple-700 text-sm font-medium">
            <Sparkles size={14} />
            Like vibe coding — but for data visualization
          </span>
        </div>

        {/* App gallery with real screenshots */}
        <div className="grid md:grid-cols-2 gap-6">
          {apps.map((app, i) => {
            const { ref: cardRef, isVisible: cardVisible } = useScrollReveal(0.05);
            return (
              <div
                key={app.name}
                ref={cardRef}
                className={`bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-lg transition-all duration-700 overflow-hidden ${
                  cardVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
                }`}
                style={{ transitionDelay: `${i * 80}ms` }}
              >
                {/* App header */}
                <div className="px-5 py-3.5 border-b border-gray-100 flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-purple-50 text-purple-500">
                    <Sparkles size={14} />
                  </div>
                  <span className="text-sm font-semibold text-gray-900">{app.name}</span>
                  <span className="ml-auto text-[10px] text-purple-500 bg-purple-50 px-2 py-0.5 rounded font-medium">
                    Custom App
                  </span>
                </div>

                {/* Prompt that created it */}
                <div className="px-5 py-2.5 bg-gray-50 border-b border-gray-100 flex items-center gap-2">
                  <Sparkles size={11} className="text-indigo-400 flex-shrink-0" />
                  <span className="text-xs text-gray-500 italic">{app.prompt}</span>
                </div>

                {/* Real screenshot */}
                <div className="overflow-hidden">
                  <img
                    src={app.image}
                    alt={`${app.name} - custom app built with AI`}
                    className="w-full h-auto"
                    loading="lazy"
                  />
                </div>
              </div>
            );
          })}
        </div>

        <div
          className={`text-center mt-10 transition-all duration-700 delay-300 ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}
        >
          <p className="text-sm text-gray-500">
            Every custom view becomes a reusable app — apply it to any data file, or share it in the marketplace.
          </p>
        </div>
      </div>
    </section>
  );
}
