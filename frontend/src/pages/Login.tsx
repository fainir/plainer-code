import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { login } from '../api/auth';
import { useAuthStore } from '../stores/authStore';
import { HardDrive, LayoutGrid, Bot, ArrowRight } from 'lucide-react';
import { track } from '../lib/analytics';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const authLogin = useAuthStore((s) => s.login);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const tokens = await login(email, password);
      authLogin(tokens.access_token, tokens.refresh_token);
      track('User Logged In');
      navigate('/private');
    } catch {
      setError('Invalid email or password');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex relative overflow-hidden bg-gradient-to-br from-[#1e1b4b] via-[#312e81] to-indigo-600">
      {/* Background orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute w-[500px] h-[500px] rounded-full bg-indigo-400/8 blur-3xl -top-40 -right-40" />
        <div className="absolute w-96 h-96 rounded-full bg-purple-400/8 blur-3xl bottom-0 -left-20" />
        <div className="absolute w-72 h-72 rounded-full bg-blue-400/8 blur-3xl top-1/2 left-1/2" />
      </div>

      {/* Left side — branding (hidden on mobile) */}
      <div className="hidden lg:flex flex-1 flex-col justify-center px-16 xl:px-24 relative z-10">
        <Link to="/" className="flex items-center gap-3 mb-10">
          <div className="w-10 h-10 rounded-xl bg-white/15 border border-white/20 flex items-center justify-center backdrop-blur-sm">
            <span className="text-xl font-extrabold text-white">P</span>
          </div>
          <span className="text-2xl font-bold text-white">Plainer</span>
        </Link>

        <h1 className="text-4xl xl:text-5xl font-extrabold text-white tracking-tight leading-tight mb-4">
          Welcome back to
          <br />
          <span className="bg-gradient-to-r from-indigo-200 to-purple-200 bg-clip-text text-transparent">
            your workspace
          </span>
        </h1>

        <p className="text-lg text-white/50 max-w-md leading-relaxed mb-10">
          Your files, views, and AI assistant are right where you left them.
        </p>

        <div className="space-y-3">
          {[
            { icon: <HardDrive size={16} />, text: 'All your files in one place' },
            { icon: <LayoutGrid size={16} />, text: 'Multiple views of the same data' },
            { icon: <Bot size={16} />, text: 'AI that reads, writes, and organizes' },
          ].map((item) => (
            <div key={item.text} className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-white/10 border border-white/10 flex items-center justify-center text-white/60">
                {item.icon}
              </div>
              <span className="text-sm text-white/50">{item.text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Right side — form */}
      <div className="flex-1 flex items-center justify-center px-6 py-12 relative z-10">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="lg:hidden flex justify-center mb-8">
            <Link to="/" className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-white/15 border border-white/20 flex items-center justify-center backdrop-blur-sm">
                <span className="text-lg font-extrabold text-white">P</span>
              </div>
              <span className="text-xl font-bold text-white">Plainer</span>
            </Link>
          </div>

          {/* Card */}
          <div className="bg-white/[0.07] backdrop-blur-xl rounded-2xl border border-white/10 p-8 shadow-2xl shadow-black/20">
            <div className="mb-7">
              <h2 className="text-2xl font-bold text-white mb-1">Sign in</h2>
              <p className="text-sm text-white/40">Enter your credentials to access your drive</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="bg-red-500/15 border border-red-400/20 text-red-300 text-sm p-3 rounded-xl">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-white/60 mb-1.5">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full px-4 py-3 bg-white/[0.07] border border-white/10 rounded-xl text-white placeholder-white/25 focus:ring-2 focus:ring-indigo-400/50 focus:border-indigo-400/50 outline-none transition text-sm"
                  placeholder="you@example.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-white/60 mb-1.5">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full px-4 py-3 bg-white/[0.07] border border-white/10 rounded-xl text-white placeholder-white/25 focus:ring-2 focus:ring-indigo-400/50 focus:border-indigo-400/50 outline-none transition text-sm"
                  placeholder="Enter your password"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-white text-indigo-700 rounded-xl font-semibold text-sm hover:bg-gray-100 transition disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-black/10 mt-2"
              >
                {loading ? 'Signing in...' : (
                  <>Sign in <ArrowRight size={15} /></>
                )}
              </button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-sm text-white/30">
                Don't have an account?{' '}
                <Link to="/register" className="text-indigo-300 hover:text-indigo-200 font-medium transition-colors">
                  Create one
                </Link>
              </p>
            </div>
          </div>

          <div className="mt-6 text-center">
            <Link to="/" className="text-xs text-white/20 hover:text-white/40 transition-colors">
              &larr; Back to home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
