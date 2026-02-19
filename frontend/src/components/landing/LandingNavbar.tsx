import { useState, useEffect } from 'react';
import { Link } from 'react-router';

export default function LandingNavbar() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'bg-white/90 backdrop-blur-md shadow-sm border-b border-gray-100'
          : 'bg-transparent'
      }`}
    >
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
            <span className="text-white font-extrabold text-sm">P</span>
          </div>
          <span className={`text-lg font-bold transition-colors ${scrolled ? 'text-gray-900' : 'text-white'}`}>
            Plainer
          </span>
        </Link>

        {/* Nav links */}
        <div className="hidden md:flex items-center gap-8">
          <a
            href="#features"
            className={`text-sm font-medium transition-colors ${
              scrolled ? 'text-gray-600 hover:text-gray-900' : 'text-white/70 hover:text-white'
            }`}
          >
            Features
          </a>
          <a
            href="#use-cases"
            className={`text-sm font-medium transition-colors ${
              scrolled ? 'text-gray-600 hover:text-gray-900' : 'text-white/70 hover:text-white'
            }`}
          >
            Use Cases
          </a>
        </div>

        {/* Auth buttons */}
        <div className="flex items-center gap-3">
          <Link
            to="/login"
            className={`text-sm font-medium px-4 py-2 rounded-lg transition-colors ${
              scrolled ? 'text-gray-700 hover:text-gray-900' : 'text-white/80 hover:text-white'
            }`}
          >
            Sign in
          </Link>
          <Link
            to="/register"
            className="text-sm font-medium px-4 py-2 rounded-lg bg-white text-indigo-600 hover:bg-gray-50 transition-colors shadow-sm"
          >
            Get Started Free
          </Link>
        </div>
      </div>
    </nav>
  );
}
