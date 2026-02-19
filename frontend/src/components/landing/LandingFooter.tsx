import { Link } from 'react-router';

export default function LandingFooter() {
  return (
    <footer className="bg-gray-50 border-t border-gray-100">
      <div className="max-w-6xl mx-auto px-6 py-12">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-2.5 mb-2">
              <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center">
                <span className="text-white font-extrabold text-xs">P</span>
              </div>
              <span className="text-base font-bold text-gray-900">Plainer</span>
            </div>
            <p className="text-sm text-gray-400">Your AI-powered drive</p>
          </div>

          {/* Links */}
          <div className="flex gap-8">
            <div className="space-y-2">
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Product</div>
              <a href="#features" className="block text-sm text-gray-600 hover:text-gray-900">Features</a>
              <a href="#use-cases" className="block text-sm text-gray-600 hover:text-gray-900">Use Cases</a>
            </div>
            <div className="space-y-2">
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Account</div>
              <Link to="/login" className="block text-sm text-gray-600 hover:text-gray-900">Sign in</Link>
              <Link to="/register" className="block text-sm text-gray-600 hover:text-gray-900">Sign up</Link>
            </div>
            <div className="space-y-2">
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Legal</div>
              <Link to="/privacy" className="block text-sm text-gray-600 hover:text-gray-900">Privacy Policy</Link>
              <Link to="/terms" className="block text-sm text-gray-600 hover:text-gray-900">Terms of Service</Link>
              <Link to="/cookies" className="block text-sm text-gray-600 hover:text-gray-900">Cookie Policy</Link>
              <Link to="/acceptable-use" className="block text-sm text-gray-600 hover:text-gray-900">Acceptable Use</Link>
            </div>
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-400">
          <span>&copy; {new Date().getFullYear()} Plainer. All rights reserved.</span>
          <div className="flex gap-4">
            <Link to="/privacy" className="hover:text-gray-600 transition-colors">Privacy</Link>
            <Link to="/terms" className="hover:text-gray-600 transition-colors">Terms</Link>
            <Link to="/cookies" className="hover:text-gray-600 transition-colors">Cookies</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
