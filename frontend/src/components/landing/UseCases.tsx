import {
  Globe,
  UtensilsCrossed,
  BarChart3,
  Kanban,
  TrendingUp,
  CalendarDays,
} from 'lucide-react';
import { useScrollReveal } from './useScrollReveal';

const personal = [
  {
    icon: <Globe size={20} />,
    title: 'Plan a trip',
    description:
      'Create itineraries, budgets, and packing lists. View your budget as a table or your schedule as a calendar.',
  },
  {
    icon: <UtensilsCrossed size={20} />,
    title: 'Organize recipes',
    description:
      'Store recipes as documents, create a meal calendar, and build a custom grocery list view.',
  },
  {
    icon: <BarChart3 size={20} />,
    title: 'Track habits',
    description:
      'Log daily habits in a spreadsheet, visualize streaks on a calendar, and get AI-generated weekly summaries.',
  },
];

const professional = [
  {
    icon: <Kanban size={20} />,
    title: 'Manage projects',
    description:
      'Track tasks on a kanban board, deadlines on a calendar, and let AI generate status reports.',
  },
  {
    icon: <TrendingUp size={20} />,
    title: 'Sales pipeline',
    description:
      'CSV data viewed as a table, board by deal stage, or a custom dashboard with charts.',
  },
  {
    icon: <CalendarDays size={20} />,
    title: 'Content calendar',
    description:
      'Plan posts across platforms with board and calendar views, use AI to draft copy.',
  },
];

export default function UseCases() {
  const { ref, isVisible } = useScrollReveal();

  return (
    <section className="py-24 bg-white" id="use-cases">
      <div className="max-w-6xl mx-auto px-6">
        <div
          ref={ref}
          className={`text-center mb-16 transition-all duration-700 ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
          }`}
        >
          <div className="text-sm font-semibold text-indigo-600 uppercase tracking-wider mb-3">
            Use Cases
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">
            For the way you work
          </h2>
        </div>

        <div className="grid lg:grid-cols-2 gap-12">
          {/* Personal */}
          <div>
            <div className="flex items-center gap-2 mb-6">
              <div className="w-2 h-2 rounded-full bg-purple-500" />
              <span className="text-sm font-semibold text-purple-600 uppercase tracking-wider">
                Personal
              </span>
            </div>
            <div className="space-y-6">
              {personal.map((item, i) => {
                const { ref: cardRef, isVisible: cardVisible } = useScrollReveal(0.1);
                return (
                  <div
                    key={item.title}
                    ref={cardRef}
                    className={`flex gap-4 p-5 rounded-xl border border-gray-100 hover:border-purple-100 hover:bg-purple-50/30 transition-all duration-700 ${
                      cardVisible ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4'
                    }`}
                    style={{ transitionDelay: `${i * 80}ms` }}
                  >
                    <div className="w-10 h-10 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center flex-shrink-0">
                      {item.icon}
                    </div>
                    <div>
                      <h3 className="text-base font-semibold text-gray-900 mb-1">{item.title}</h3>
                      <p className="text-sm text-gray-500 leading-relaxed">{item.description}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Professional */}
          <div>
            <div className="flex items-center gap-2 mb-6">
              <div className="w-2 h-2 rounded-full bg-indigo-500" />
              <span className="text-sm font-semibold text-indigo-600 uppercase tracking-wider">
                Professional
              </span>
            </div>
            <div className="space-y-6">
              {professional.map((item, i) => {
                const { ref: cardRef, isVisible: cardVisible } = useScrollReveal(0.1);
                return (
                  <div
                    key={item.title}
                    ref={cardRef}
                    className={`flex gap-4 p-5 rounded-xl border border-gray-100 hover:border-indigo-100 hover:bg-indigo-50/30 transition-all duration-700 ${
                      cardVisible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-4'
                    }`}
                    style={{ transitionDelay: `${i * 80}ms` }}
                  >
                    <div className="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center flex-shrink-0">
                      {item.icon}
                    </div>
                    <div>
                      <h3 className="text-base font-semibold text-gray-900 mb-1">{item.title}</h3>
                      <p className="text-sm text-gray-500 leading-relaxed">{item.description}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
