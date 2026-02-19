import { FileText, FolderOpen, Pencil, Sparkles, LayoutGrid, MessageSquare } from 'lucide-react';
import { useScrollReveal } from './useScrollReveal';

const bullets = [
  { icon: <FileText size={16} />, text: 'Create files from prompts — docs, spreadsheets, code, images' },
  { icon: <Pencil size={16} />, text: 'Edit and update existing files through conversation' },
  { icon: <MessageSquare size={16} />, text: 'Ask questions about your data — get instant answers' },
  { icon: <Sparkles size={16} />, text: 'Generate custom views and mini apps from a description' },
  { icon: <FolderOpen size={16} />, text: 'Organize files into folders, rename, move, delete' },
  { icon: <LayoutGrid size={16} />, text: 'AI knows your full workspace context before responding' },
];

export default function FeatureAIDrive() {
  const { ref, isVisible } = useScrollReveal();

  return (
    <section className="py-24 bg-gradient-to-b from-white to-gray-50">
      <div
        ref={ref}
        className={`max-w-6xl mx-auto px-6 transition-all duration-700 ${
          isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
        }`}
      >
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Text */}
          <div>
            <div className="text-sm font-semibold text-emerald-600 uppercase tracking-wider mb-3">
              AI Agent
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-5">
              An AI that actually does things
            </h2>
            <p className="text-lg text-gray-500 leading-relaxed mb-8">
              Not just chat — Plainer's AI agent reads your files, answers questions about your data,
              creates new documents, edits existing ones, and builds custom views and apps.
              It sees your entire workspace and takes action.
            </p>
            <div className="grid sm:grid-cols-2 gap-3">
              {bullets.map((b) => (
                <div key={b.text} className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                    {b.icon}
                  </div>
                  <span className="text-sm text-gray-600 leading-relaxed">{b.text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Real product screenshot */}
          <div className="flex justify-center lg:justify-end">
            <div className="rounded-2xl overflow-hidden shadow-2xl shadow-gray-300/50 border border-gray-200 max-w-lg">
              <img
                src="/images/life-dashboard.png"
                alt="Plainer AI-powered dashboard with chat agent, file management, and custom views"
                className="w-full h-auto"
                loading="lazy"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
