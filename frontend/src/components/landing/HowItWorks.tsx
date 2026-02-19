import { Sparkles, LayoutGrid, Puzzle } from 'lucide-react';
import { useScrollReveal } from './useScrollReveal';

const steps = [
  {
    icon: <Sparkles size={28} />,
    title: 'Tell the AI what you need',
    description:
      'Create files, edit documents, ask questions about your data, or describe a view you want — the AI handles it all.',
    color: 'text-indigo-600 bg-indigo-50 border-indigo-100',
  },
  {
    icon: <LayoutGrid size={28} />,
    title: 'See your data any way you want',
    description:
      'Every file can be viewed as a table, kanban board, calendar, or a custom mini app that the AI builds just for you.',
    color: 'text-purple-600 bg-purple-50 border-purple-100',
  },
  {
    icon: <Puzzle size={28} />,
    title: 'Reuse and share your apps',
    description:
      'Custom views become reusable apps you can apply to any data file. Share them in the marketplace for others to use.',
    color: 'text-emerald-600 bg-emerald-50 border-emerald-100',
  },
];

export default function HowItWorks() {
  const { ref, isVisible } = useScrollReveal();

  return (
    <section className="py-24 bg-white" id="features">
      <div className="max-w-6xl mx-auto px-6">
        <div
          ref={ref}
          className={`text-center mb-16 transition-all duration-700 ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
          }`}
        >
          <div className="text-sm font-semibold text-indigo-600 uppercase tracking-wider mb-3">
            How Plainer Works
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">
            Three steps to a smarter workspace
          </h2>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {steps.map((step, i) => {
            const { ref: cardRef, isVisible: cardVisible } = useScrollReveal(0.1);
            return (
              <div
                key={step.title}
                ref={cardRef}
                className={`p-8 rounded-2xl border bg-white hover:shadow-lg transition-all duration-700 ${
                  cardVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
                }`}
                style={{ transitionDelay: `${i * 100}ms` }}
              >
                <div
                  className={`w-14 h-14 rounded-xl flex items-center justify-center mb-5 border ${step.color}`}
                >
                  {step.icon}
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">{step.title}</h3>
                <p className="text-gray-500 leading-relaxed">{step.description}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
