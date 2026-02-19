import { useState, useEffect } from 'react';
import { Link } from 'react-router';
import { Sparkles } from 'lucide-react';
import { Player } from '@remotion/player';
import { PlainerDemo } from '../../../remotion/PlainerDemo';

const PRELOAD_IMAGES = [
  '/images/life-dashboard.png',
  '/images/reading-board.png',
  '/images/company-dashboard.png',
  '/images/okr-tracker.png',
];

export default function HeroSection() {
  const [imagesReady, setImagesReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all(
      PRELOAD_IMAGES.map(
        (src) =>
          new Promise<void>((resolve) => {
            const img = new Image();
            img.onload = () => resolve();
            img.onerror = () => resolve(); // don't block on error
            img.src = src;
          }),
      ),
    ).then(() => {
      if (!cancelled) setImagesReady(true);
    });
    return () => { cancelled = true; };
  }, []);

  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden bg-gradient-to-b from-[#1e1b4b] via-[#312e81] to-indigo-600 pt-16">
      {/* Floating orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute w-96 h-96 rounded-full bg-indigo-400/10 blur-3xl -top-20 -left-20" />
        <div className="absolute w-80 h-80 rounded-full bg-purple-400/10 blur-3xl top-1/3 right-10" />
        <div className="absolute w-72 h-72 rounded-full bg-blue-400/10 blur-3xl bottom-20 left-1/3" />
      </div>

      {/* Content */}
      <div className="relative z-10 text-center px-6 mb-12 mt-8">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/15 text-white/70 text-xs font-medium mb-6 backdrop-blur-sm">
          <Sparkles size={12} />
          Vibe coding, but for files and views
        </div>

        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white tracking-tight mb-6 leading-tight">
          Describe it. The AI
          <br />
          <span className="bg-gradient-to-r from-indigo-200 to-purple-200 bg-clip-text text-transparent">
            builds it.
          </span>
        </h1>

        <p className="text-lg sm:text-xl text-white/60 max-w-2xl mx-auto mb-8 leading-relaxed">
          An AI-powered drive that creates files, edits documents, answers questions about your data,
          and builds custom mini apps and views — all from natural language.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            to="/register"
            className="px-8 py-3 rounded-xl bg-white text-indigo-700 font-semibold text-sm hover:bg-gray-50 transition-colors shadow-lg shadow-indigo-500/20"
          >
            Get Started Free
          </Link>
          <a
            href="#features"
            className="px-8 py-3 rounded-xl bg-white/10 text-white font-medium text-sm hover:bg-white/15 transition-colors border border-white/15 backdrop-blur-sm"
          >
            See how it works
          </a>
        </div>
      </div>

      {/* Remotion Demo Video */}
      <div className="relative z-10 w-full max-w-5xl px-6 pb-16 animate-[fadeInUp_0.8s_ease-out_0.3s_both]">
        <div className="rounded-2xl overflow-hidden shadow-2xl shadow-black/30 border border-white/10">
          {imagesReady ? (
            <Player
              component={PlainerDemo}
              compositionWidth={1920}
              compositionHeight={1080}
              durationInFrames={900}
              fps={30}
              autoPlay
              loop
              style={{ width: '100%', aspectRatio: '16 / 9' }}
              controls
              allowFullscreen
              inputProps={{}}
            />
          ) : (
            <div
              className="w-full flex items-center justify-center bg-[#0f0e2a]"
              style={{ aspectRatio: '16 / 9' }}
            >
              <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-2 border-white/20 border-t-white/70 rounded-full animate-spin" />
                <span className="text-white/40 text-sm">Loading demo...</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Fade to white */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-white to-transparent" />
    </section>
  );
}
