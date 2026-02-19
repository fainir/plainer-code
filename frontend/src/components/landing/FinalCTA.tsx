import { Link } from 'react-router';
import { HardDrive, LayoutGrid, Bot, Users } from 'lucide-react';
import { useScrollReveal } from './useScrollReveal';

const features = [
  { icon: <HardDrive size={14} />, label: 'Drive-like file system', color: 'text-blue-300' },
  { icon: <LayoutGrid size={14} />, label: 'Multi-view data', color: 'text-purple-300' },
  { icon: <Bot size={14} />, label: 'AI agent assistant', color: 'text-emerald-300' },
  { icon: <Users size={14} />, label: 'Real-time collaboration', color: 'text-amber-300' },
];

export default function FinalCTA() {
  const { ref, isVisible } = useScrollReveal();

  return (
    <section className="relative py-32 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#1e1b4b] via-[#312e81] to-indigo-600" />
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute w-96 h-96 rounded-full bg-indigo-400/10 blur-3xl -top-20 right-20" />
        <div className="absolute w-80 h-80 rounded-full bg-purple-400/10 blur-3xl bottom-10 -left-20" />
      </div>

      <div
        ref={ref}
        className={`relative z-10 max-w-3xl mx-auto px-6 text-center transition-all duration-700 ${
          isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
        }`}
      >
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center backdrop-blur-sm">
            <span className="text-3xl font-extrabold text-white">P</span>
          </div>
        </div>

        <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight mb-5">
          Your workspace, reimagined
        </h2>
        <p className="text-lg text-white/50 mb-10 max-w-xl mx-auto leading-relaxed">
          Start creating, viewing, and extending your files with AI.
        </p>

        {/* Feature pills */}
        <div className="flex flex-wrap justify-center gap-3 mb-10">
          {features.map((f) => (
            <div
              key={f.label}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 border border-white/15 backdrop-blur-sm"
            >
              <span className={f.color}>{f.icon}</span>
              <span className="text-sm text-white/80 font-medium">{f.label}</span>
            </div>
          ))}
        </div>

        <Link
          to="/register"
          className="inline-block px-10 py-4 rounded-xl bg-white text-indigo-700 font-bold text-base hover:bg-gray-50 transition-colors shadow-lg shadow-indigo-500/20"
        >
          Get Started Free
        </Link>
        <p className="text-sm text-white/30 mt-4">No credit card required</p>
      </div>
    </section>
  );
}
