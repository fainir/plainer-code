import {
  FileText,
  Pencil,
  HelpCircle,
  Sparkles,
  LayoutGrid,
  FolderOpen,
} from 'lucide-react';
import { useScrollReveal } from './useScrollReveal';

const capabilities = [
  {
    icon: <FileText size={18} />,
    iconColor: 'text-blue-600 bg-blue-50',
    prompt: '"Create a project plan for Q2 launch"',
    result: 'Generates a full Markdown document with phases, milestones, and deadlines',
    tag: 'Create',
    tagColor: 'text-blue-600 bg-blue-50',
  },
  {
    icon: <Pencil size={18} />,
    iconColor: 'text-amber-600 bg-amber-50',
    prompt: '"Add a budget column to my expenses spreadsheet"',
    result: 'Reads your CSV, adds the column with calculated values, saves the update',
    tag: 'Edit',
    tagColor: 'text-amber-600 bg-amber-50',
  },
  {
    icon: <HelpCircle size={18} />,
    iconColor: 'text-emerald-600 bg-emerald-50',
    prompt: '"Which tasks are overdue based on my data?"',
    result: 'Reads your files, compares dates, responds with a detailed answer',
    tag: 'Ask',
    tagColor: 'text-emerald-600 bg-emerald-50',
  },
  {
    icon: <Sparkles size={18} />,
    iconColor: 'text-purple-600 bg-purple-50',
    prompt: '"Build a sales dashboard with charts from my revenue CSV"',
    result: 'Generates a custom HTML app with interactive charts pulling from your data',
    tag: 'Custom App',
    tagColor: 'text-purple-600 bg-purple-50',
  },
  {
    icon: <LayoutGrid size={18} />,
    iconColor: 'text-indigo-600 bg-indigo-50',
    prompt: '"Show my tasks as a timeline grouped by assignee"',
    result: 'Creates a custom Gantt-style timeline view connected to your spreadsheet',
    tag: 'Custom View',
    tagColor: 'text-indigo-600 bg-indigo-50',
  },
  {
    icon: <FolderOpen size={18} />,
    iconColor: 'text-rose-600 bg-rose-50',
    prompt: '"Set up a project folder with a plan, tasks, and meeting notes"',
    result: 'Creates the folder structure with pre-filled template files, ready to use',
    tag: 'Organize',
    tagColor: 'text-rose-600 bg-rose-50',
  },
];

export default function AICapabilities() {
  const { ref, isVisible } = useScrollReveal();

  return (
    <section className="py-24 bg-white">
      <div className="max-w-6xl mx-auto px-6">
        <div
          ref={ref}
          className={`text-center mb-16 transition-all duration-700 ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
          }`}
        >
          <div className="text-sm font-semibold text-indigo-600 uppercase tracking-wider mb-3">
            AI That Takes Action
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
            Say it. It's done.
          </h2>
          <p className="text-lg text-gray-500 max-w-2xl mx-auto leading-relaxed">
            The AI doesn't just answer — it creates files, edits data, builds custom apps,
            and organizes your workspace. Here's what a single prompt can do.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {capabilities.map((cap, i) => {
            const { ref: cardRef, isVisible: cardVisible } = useScrollReveal(0.05);
            return (
              <div
                key={cap.prompt}
                ref={cardRef}
                className={`group p-6 rounded-2xl border border-gray-100 hover:border-indigo-100 hover:shadow-lg transition-all duration-700 bg-white ${
                  cardVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
                }`}
                style={{ transitionDelay: `${i * 60}ms` }}
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${cap.iconColor}`}>
                    {cap.icon}
                  </div>
                  <span className={`text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-md ${cap.tagColor}`}>
                    {cap.tag}
                  </span>
                </div>

                {/* Prompt */}
                <div className="bg-indigo-600 text-white text-sm px-3.5 py-2 rounded-xl rounded-br-sm mb-3 leading-relaxed">
                  {cap.prompt}
                </div>

                {/* Result */}
                <p className="text-sm text-gray-500 leading-relaxed">
                  {cap.result}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
