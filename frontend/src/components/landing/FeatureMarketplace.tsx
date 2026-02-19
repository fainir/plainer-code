import { Store, LayoutGrid, FileText, MessageSquare, Download } from 'lucide-react';
import { useScrollReveal } from './useScrollReveal';

const tabs = [
  { label: 'Apps', active: true },
  { label: 'Templates', active: false },
  { label: 'Commands', active: false },
];

const items = [
  {
    icon: <LayoutGrid size={16} />,
    iconBg: 'bg-purple-100 text-purple-600',
    name: 'Timeline Chart',
    description: 'Gantt-style timeline visualization',
    installs: '2.4k',
  },
  {
    icon: <LayoutGrid size={16} />,
    iconBg: 'bg-blue-100 text-blue-600',
    name: 'Priority Matrix',
    description: 'Eisenhower decision matrix view',
    installs: '1.8k',
  },
  {
    icon: <FileText size={16} />,
    iconBg: 'bg-emerald-100 text-emerald-600',
    name: 'Project Starter',
    description: 'Full project folder with plan, tasks, and notes',
    installs: '3.1k',
  },
  {
    icon: <MessageSquare size={16} />,
    iconBg: 'bg-amber-100 text-amber-600',
    name: 'Weekly Report',
    description: 'Generate a status report from your files',
    installs: '1.2k',
  },
];

function MarketplaceMock() {
  return (
    <div className="bg-white rounded-2xl shadow-xl shadow-gray-200/50 border border-gray-200 overflow-hidden max-w-lg mx-auto">
      {/* Header */}
      <div className="px-5 py-4 border-b border-gray-100">
        <div className="flex items-center gap-2 mb-3">
          <Store size={18} className="text-indigo-600" />
          <span className="text-sm font-bold text-gray-900">Marketplace</span>
        </div>
        <div className="flex gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.label}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                tab.active
                  ? 'bg-indigo-50 text-indigo-700'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Items */}
      <div className="divide-y divide-gray-50">
        {items.map((item) => (
          <div key={item.name} className="px-5 py-3.5 flex items-center gap-3 hover:bg-gray-50 transition-colors">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${item.iconBg}`}>
              {item.icon}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-gray-900">{item.name}</div>
              <div className="text-xs text-gray-500 truncate">{item.description}</div>
            </div>
            <div className="flex items-center gap-1 text-xs text-gray-400">
              <Download size={11} />
              {item.installs}
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between">
        <span className="text-xs text-gray-400">Browse all community items</span>
        <button className="text-xs font-medium text-indigo-600 hover:text-indigo-700">
          + Create New
        </button>
      </div>
    </div>
  );
}

export default function FeatureMarketplace() {
  const { ref, isVisible } = useScrollReveal();

  return (
    <section className="py-24 bg-gradient-to-b from-gray-50 to-white">
      <div className="max-w-6xl mx-auto px-6">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Mockup (left on desktop) */}
          <div
            ref={ref}
            className={`transition-all duration-700 ${
              isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-8'
            }`}
          >
            <MarketplaceMock />
          </div>

          {/* Text (right on desktop) */}
          <div
            className={`transition-all duration-700 delay-100 ${
              isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
            }`}
          >
            <div className="text-sm font-semibold text-indigo-600 uppercase tracking-wider mb-3">
              Marketplace
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-5">
              A marketplace for how you see data
            </h2>
            <p className="text-lg text-gray-500 leading-relaxed mb-8">
              Browse community-built apps, file templates, folder structures, and AI commands.
              Install with one click, or publish your own creations.
            </p>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <LayoutGrid size={16} />
                </div>
                <div>
                  <span className="text-gray-800 font-medium">Custom Apps</span>
                  <span className="text-gray-500"> — Reusable visualizations for any data file</span>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <FileText size={16} />
                </div>
                <div>
                  <span className="text-gray-800 font-medium">Templates</span>
                  <span className="text-gray-500"> — Pre-built files and folder structures</span>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <MessageSquare size={16} />
                </div>
                <div>
                  <span className="text-gray-800 font-medium">Commands</span>
                  <span className="text-gray-500"> — AI prompts that automate common tasks</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
