import { Link } from 'react-router';
import { ArrowLeft } from 'lucide-react';

export default function LegalLayout({
  title,
  lastUpdated,
  children,
}: {
  title: string;
  lastUpdated: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#1e1b4b] via-[#312e81] to-indigo-600">
      {/* Background orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute w-[500px] h-[500px] rounded-full bg-indigo-400/8 blur-3xl -top-40 -right-40" />
        <div className="absolute w-96 h-96 rounded-full bg-purple-400/8 blur-3xl bottom-40 -left-20" />
      </div>

      {/* Nav */}
      <nav className="relative z-10 max-w-4xl mx-auto px-6 pt-8 pb-12">
        <div className="flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-white/15 border border-white/20 flex items-center justify-center backdrop-blur-sm">
              <span className="text-white font-extrabold text-sm">P</span>
            </div>
            <span className="text-lg font-bold text-white">Plainer</span>
          </Link>
          <Link
            to="/"
            className="flex items-center gap-1.5 text-sm text-white/40 hover:text-white/70 transition-colors"
          >
            <ArrowLeft size={14} />
            Back to home
          </Link>
        </div>
      </nav>

      {/* Header */}
      <div className="relative z-10 max-w-4xl mx-auto px-6 pb-12">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight mb-2">
          {title}
        </h1>
        <p className="text-sm text-white/30">Last updated: {lastUpdated}</p>
      </div>

      {/* Content card */}
      <div className="relative z-10 min-h-[60vh]">
        <div className="bg-white rounded-t-3xl">
          <div className="max-w-4xl mx-auto px-6 py-12 sm:px-12">
            <div className="prose prose-gray max-w-none prose-headings:font-bold prose-headings:text-gray-900 prose-h2:text-xl prose-h2:mt-10 prose-h2:mb-4 prose-h3:text-lg prose-h3:mt-8 prose-h3:mb-3 prose-p:text-gray-600 prose-p:leading-relaxed prose-li:text-gray-600 prose-a:text-indigo-600 prose-a:no-underline hover:prose-a:underline prose-strong:text-gray-800">
              {children}
            </div>
          </div>

          {/* Footer */}
          <div className="border-t border-gray-100">
            <div className="max-w-4xl mx-auto px-6 sm:px-12 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-md bg-indigo-600 flex items-center justify-center">
                  <span className="text-white font-extrabold text-[9px]">P</span>
                </div>
                <span className="text-sm font-semibold text-gray-700">Plainer</span>
              </div>
              <div className="flex gap-6 text-sm text-gray-400">
                <Link to="/privacy" className="hover:text-gray-600 transition-colors">Privacy</Link>
                <Link to="/terms" className="hover:text-gray-600 transition-colors">Terms</Link>
                <Link to="/cookies" className="hover:text-gray-600 transition-colors">Cookies</Link>
                <Link to="/acceptable-use" className="hover:text-gray-600 transition-colors">Acceptable Use</Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
