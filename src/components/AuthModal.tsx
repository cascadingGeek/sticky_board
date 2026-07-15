import React, { useState, useEffect } from 'react';
import { useStickyBoard } from '../lib/StickyBoardContext';
import { Eye, EyeOff, KeyRound, Mail, Sparkles, User, ArrowRight, Github } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose }) => {
  const { login, register, startDemo, loginWithOAuthToken } = useStickyBoard();
  const [isSignUp, setIsSignUp] = useState<boolean>(false);
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [name, setName] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [isMobile, setIsMobile] = useState<boolean>(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Password strength calculation
  const getPasswordStrength = () => {
    if (!password) return 0;
    let strength = 0;
    if (password.length >= 6) strength += 1;
    if (/[A-Z]/.test(password)) strength += 1;
    if (/[0-9]/.test(password)) strength += 1;
    if (/[^A-Za-z0-9]/.test(password)) strength += 1;
    return strength;
  };

  const strengthLabels = ['Weak', 'Fair', 'Good', 'Strong'];
  const strengthColors = ['bg-rose-500', 'bg-amber-500', 'bg-blue-500', 'bg-emerald-500'];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (isSignUp) {
        if (password.length < 6) {
          setError('Password must be at least 6 characters long');
          setLoading(false);
          return;
        }
        const success = await register(email, password, name);
        if (success) onClose();
        else setError('Email registration failed. The email may already exist.');
      } else {
        const success = await login(email, password);
        if (success) onClose();
        else setError('Invalid email or password. Please try again.');
      }
    } catch (err) {
      setError('Connection failure. Please verify the backend status.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError(null);
    setLoading(true);
    try {
      const response = await fetch(`/api/auth/google/url?origin=${encodeURIComponent(window.location.origin)}`);
      if (!response.ok) {
        throw new Error('Failed to generate Google login link');
      }
      const { url } = await response.json();

      // Open the Google authorization URL directly in a popup window
      const width = 500;
      const height = 655;
      const left = window.screen.width / 2 - width / 2;
      const top = window.screen.height / 2 - height / 2;

      const popup = window.open(
        url,
        'google_oauth_popup',
        `width=${width},height=${height},top=${top},left=${left},resizable=yes,scrollbars=yes,status=yes`
      );

      if (!popup) {
        setError('Popup blocked! Please enable popups for this site to sign in with Google.');
      }
    } catch (err: any) {
      console.error('Google login initiating failed:', err);
      setError(err.message || 'Failed to initialize Google Sign In');
    } finally {
      setLoading(false);
    }
  };

  const handleGithubLogin = async () => {
    setError(null);
    setLoading(true);
    try {
      const response = await fetch(`/api/auth/github/url?origin=${encodeURIComponent(window.location.origin)}`);
      if (!response.ok) {
        throw new Error('Failed to generate GitHub login link');
      }
      const { url } = await response.json();

      // Open the GitHub authorization URL directly in a popup window
      const width = 500;
      const height = 655;
      const left = window.screen.width / 2 - width / 2;
      const top = window.screen.height / 2 - height / 2;

      const popup = window.open(
        url,
        'github_oauth_popup',
        `width=${width},height=${height},top=${top},left=${left},resizable=yes,scrollbars=yes,status=yes`
      );

      if (!popup) {
        setError('Popup blocked! Please enable popups for this site to sign in with GitHub.');
      }
    } catch (err: any) {
      console.error('GitHub login initiating failed:', err);
      setError(err.message || 'Failed to initialize GitHub Sign In');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    const handleMessage = (event: MessageEvent) => {
      const origin = event.origin;
      if (!origin.endsWith('.run.app') && !origin.includes('localhost') && !origin.includes('127.0.0.1')) {
        return;
      }
      if (event.data?.type === 'OAUTH_AUTH_SUCCESS') {
        const token = event.data.token;
        if (token) {
          loginWithOAuthToken(token);
          onClose();
        }
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [isOpen, loginWithOAuthToken, onClose]);

  if (!isOpen) return null;

  const containerVariants = isMobile 
    ? {
        initial: { y: "100%", opacity: 1 },
        animate: { y: 0, opacity: 1, transition: { type: 'spring', damping: 25, stiffness: 220 } },
        exit: { y: "100%", opacity: 1, transition: { duration: 0.2, ease: 'easeIn' } }
      }
    : {
        initial: { scale: 0.95, opacity: 0, y: 15 },
        animate: { scale: 1, opacity: 1, y: 0, transition: { type: 'spring', damping: 25, stiffness: 350 } },
        exit: { scale: 0.95, opacity: 0, y: 15, transition: { duration: 0.15 } }
      };

  const containerClass = isMobile
    ? "relative w-full rounded-t-[2rem] border-t border-white/10 bg-[#16161b] p-6 pb-12 shadow-2xl z-50 flex flex-col focus:outline-none"
    : "relative w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-[#16161b]/90 p-8 shadow-2xl backdrop-blur-sticky";

  return (
    <div className={`fixed inset-0 z-50 flex ${isMobile ? 'items-end' : 'items-center justify-center'} p-0 md:p-4`}>
      {/* Backdrop blur */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-[#09090b]/80 backdrop-blur-md"
      />

      <motion.div 
        variants={containerVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        className={containerClass}
      >
        {isMobile && (
          <div className="flex justify-center w-full pb-4">
            <div className="h-1.5 w-12 rounded-full bg-zinc-700/60" />
          </div>
        )}

        {/* Glow Effects (hidden on mobile for performance/clean design) */}
        {!isMobile && (
          <>
            <div className="absolute -top-10 -right-10 h-32 w-32 rounded-full bg-rose-500/20 blur-3xl" />
            <div className="absolute -bottom-10 -left-10 h-32 w-32 rounded-full bg-blue-500/20 blur-3xl" />
          </>
        )}

        <div className="relative z-10 flex flex-col items-center">
          {/* Logo Icon */}
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-rose-500/10 text-rose-500">
            <Sparkles className="h-6 w-6" />
          </div>

          <h2 className="font-display text-2xl font-semibold tracking-tight text-white text-center">
            {isSignUp ? 'Create your Board' : 'Welcome back to StickyBoard'}
          </h2>
          <p className="mt-1 text-center text-sm text-zinc-400">
            {isSignUp 
              ? 'Get your permanent corkboard and unlock AI scheduling' 
              : 'Sign in to access your synchronized daily workspaces'}
          </p>

          <form onSubmit={handleSubmit} className="mt-6 w-full space-y-4">
            {isSignUp && (
              <div className="space-y-1">
                <label className="text-xs font-medium text-zinc-400">Display Name</label>
                <div className="relative">
                  <User className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Sarah Miller"
                    className="w-full rounded-xl border border-white/10 bg-zinc-900/50 py-2.5 pr-4 pl-10 text-sm text-white placeholder-zinc-500 outline-none transition-all focus:border-rose-500 focus:ring-1 focus:ring-rose-500"
                  />
                </div>
              </div>
            )}

            <div className="space-y-1">
              <label className="text-xs font-medium text-zinc-400">Email Address</label>
              <div className="relative">
                <Mail className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@domain.com"
                  className="w-full rounded-xl border border-white/10 bg-zinc-900/50 py-2.5 pr-4 pl-10 text-sm text-white placeholder-zinc-500 outline-none transition-all focus:border-rose-500 focus:ring-1 focus:ring-rose-500"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-zinc-400">Password</label>
              <div className="relative">
                <KeyRound className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-white/10 bg-zinc-900/50 py-2.5 pr-10 pl-10 text-sm text-white placeholder-zinc-500 outline-none transition-all focus:border-rose-500 focus:ring-1 focus:ring-rose-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute top-1/2 right-3 -translate-y-1/2 text-zinc-500 hover:text-white"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>

              {/* Password Strength Meter */}
              {isSignUp && password && (
                <div className="mt-2 space-y-1">
                  <div className="flex justify-between text-[10px]">
                    <span className="text-zinc-500">Complexity:</span>
                    <span className="font-semibold text-zinc-400">
                      {strengthLabels[getPasswordStrength() - 1] || 'Very Weak'}
                    </span>
                  </div>
                  <div className="flex h-1 gap-1 overflow-hidden rounded-full bg-zinc-800">
                    {[1, 2, 3, 4].map((step) => (
                      <div
                        key={step}
                        className={`h-full flex-1 transition-all ${
                          step <= getPasswordStrength() ? strengthColors[getPasswordStrength() - 1] : ''
                        }`}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>

            {error && (
              <div className="rounded-xl border border-rose-500/15 bg-rose-500/5 p-3 text-center text-xs font-medium text-rose-400">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="group flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-rose-500 to-rose-600 py-2.5 font-display text-sm font-semibold text-white shadow-lg shadow-rose-500/20 transition-all hover:brightness-110 active:scale-98 disabled:opacity-50"
            >
              {loading ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                <>
                  {isSignUp ? 'Launch Workspace' : 'Unlock Board'}
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </>
              )}
            </button>

            <div className="flex items-center gap-3 py-1">
              <div className="h-px flex-1 bg-white/5" />
              <span className="text-[10px] uppercase tracking-wider text-zinc-500">or</span>
              <div className="h-px flex-1 bg-white/5" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full">
              <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={loading}
                className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-white/10 bg-[#16161b] hover:bg-zinc-900/80 py-2.5 font-display text-sm font-semibold text-white shadow-md transition-all active:scale-98 disabled:opacity-50"
              >
                <span className="flex h-5 w-5 items-center justify-center rounded bg-white font-sans text-xs font-bold text-[#4285F4]">
                  G
                </span>
                <span>Google</span>
              </button>

              <button
                type="button"
                onClick={handleGithubLogin}
                disabled={loading}
                className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-white/10 bg-[#16161b] hover:bg-zinc-900/80 py-2.5 font-display text-sm font-semibold text-white shadow-md transition-all active:scale-98 disabled:opacity-50"
              >
                <Github className="h-5 w-5 text-white" />
                <span>GitHub</span>
              </button>
            </div>
          </form>

          {/* Social login divider */}
          <div className="mt-6 flex w-full items-center gap-3">
            <div className="h-px flex-1 bg-white/5" />
            <span className="text-[10px] uppercase tracking-wider text-zinc-500">Or skip credentials</span>
            <div className="h-px flex-1 bg-white/5" />
          </div>

          <button
            onClick={() => {
              startDemo();
              onClose();
            }}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-white/5 bg-white/5 py-2.5 font-display text-sm text-zinc-300 hover:bg-white/10 hover:text-white"
          >
            Launch Interactive Guest Demo
          </button>

          <p className="mt-6 text-xs text-zinc-400">
            {isSignUp ? 'Already have a board?' : 'Want isolated cloud boards?'}
            <button
              type="button"
              onClick={() => {
                setIsSignUp(!isSignUp);
                setError(null);
              }}
              className="ml-1.5 font-semibold text-rose-500 hover:underline"
            >
              {isSignUp ? 'Sign In' : 'Create Account'}
            </button>
          </p>
        </div>
      </motion.div>
    </div>
  );
};
