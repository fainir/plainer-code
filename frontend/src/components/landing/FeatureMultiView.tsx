import { useScrollReveal } from './useScrollReveal';

export default function FeatureMultiView() {
  const { ref, isVisible } = useScrollReveal();

  return (
    <section className="py-24 bg-gray-50">
      <div className="max-w-6xl mx-auto px-6">
        <div
          ref={ref}
          className={`text-center mb-16 transition-all duration-700 ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
          }`}
        >
          <div className="text-sm font-semibold text-purple-600 uppercase tracking-wider mb-3">
            Multi-View System
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
            One file. Infinite views.
          </h2>
          <p className="text-lg text-gray-500 max-w-2xl mx-auto leading-relaxed">
            Your data isn't locked into one format. A single file can be a sortable table,
            a kanban board, a calendar, or a custom app — simultaneously. Switch views with a click.
          </p>
        </div>

        {/* Real product screenshot showing multi-view tabs */}
        <div
          className={`transition-all duration-700 delay-200 ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
          }`}
        >
          <div className="rounded-2xl overflow-hidden shadow-2xl shadow-gray-300/50 border border-gray-200 bg-white">
            <img
              src="/images/reading-board.png"
              alt="Plainer multi-view system showing a reading list as a kanban board with Table, Board, Text Editor, and Custom view tabs"
              className="w-full h-auto"
              loading="lazy"
            />
          </div>
          <div className="flex items-center justify-center gap-6 mt-8">
            {['Board', 'Table', 'Text Editor', 'Custom'].map((view) => (
              <div key={view} className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${
                  view === 'Board' ? 'bg-purple-400' :
                  view === 'Table' ? 'bg-emerald-400' :
                  view === 'Text Editor' ? 'bg-blue-400' :
                  'bg-amber-400'
                }`} />
                <span className="text-sm text-gray-500 font-medium">{view}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="text-center mt-8">
          <p className="text-sm text-gray-400">
            Same data file — shown as a kanban board with one-click access to Table, Text Editor, and Custom views
          </p>
        </div>
      </div>
    </section>
  );
}
