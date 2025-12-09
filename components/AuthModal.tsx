import React, { useState, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { auth, googleProvider } from '../services/firebase';
import { 
  signInWithPopup, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword,
  sendPasswordResetEmail
} from 'firebase/auth';
import { X, Loader2, AlertCircle, ArrowLeft, CheckCircle } from 'lucide-react';

type AuthView = 'login' | 'signup' | 'reset';

export const AuthModal: React.FC = () => {
  const { isAuthModalOpen, closeAuthModal, setUser } = useStore();
  const [view, setView] = useState<AuthView>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetSuccess, setResetSuccess] = useState(false);

  // Reset state when modal opens
  useEffect(() => {
    if (isAuthModalOpen) {
      setView('login');
      setError(null);
      setResetSuccess(false);
      setEmail('');
      setPassword('');
    }
  }, [isAuthModalOpen]);

  if (!isAuthModalOpen) return null;

  const getFriendlyErrorMessage = (err: any) => {
    console.error("Auth Error Details:", err);
    
    const code = err.code || '';
    const message = err.message || '';

    // Configuration & Setup Errors
    if (code === 'auth/unauthorized-domain' || message.includes('unauthorized-domain')) {
      const domain = window.location.hostname;
      return `Domain Not Authorized (${domain}).
      
      Firebase has blocked this request because the current domain is not whitelisted.
      
      To fix this:
      1. Go to Firebase Console > Authentication > Settings > Authorized Domains.
      2. Add "${domain}" to the list.
      
      If you are using the demo config, you must update "services/firebase.ts" with your own Firebase project credentials.`;
    }
    
    if (code === 'auth/operation-not-allowed' || message.includes('operation-not-allowed')) {
      return "Login Method Error: Email/Password or Google Sign-in is not enabled in the Firebase Console.";
    }

    if (code === 'auth/api-key-not-valid' || message.includes('api-key-not-valid')) {
      return "Configuration Error: Invalid Firebase API Key. Please check your settings in services/firebase.ts.";
    }

    // User Input Errors
    if (
      code === 'auth/invalid-credential' || 
      message.includes('invalid-credential') || 
      code === 'auth/wrong-password' || 
      code === 'auth/user-not-found'
    ) {
      return "Invalid email or password. Please check your credentials and try again.";
    }
    
    if (code === 'auth/email-already-in-use' || message.includes('email-already-in-use')) {
      return "This email is already registered. Please sign in instead.";
    }
    
    if (code === 'auth/weak-password' || message.includes('weak-password')) {
      return "Password is too weak. Please use at least 6 characters.";
    }
    
    if (code === 'auth/invalid-email') {
      return "Please enter a valid email address.";
    }

    if (code === 'auth/popup-closed-by-user' || message.includes('popup-closed-by-user')) {
      return "Sign-in cancelled.";
    }

    if (code === 'auth/network-request-failed') {
      return "Network error. Please check your internet connection.";
    }
    
    if (code === 'auth/too-many-requests') {
       return "Too many attempts. Please try again later.";
    }
    
    // Fallback
    return message || 'Authentication failed. Please try again.';
  };

  const handleGoogleSignIn = async () => {
    if (!auth || !googleProvider) {
      setError("Authentication service is not configured. Please add valid Firebase API keys in services/firebase.ts");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      setUser({
        uid: result.user.uid,
        email: result.user.email,
        displayName: result.user.displayName,
        photoURL: result.user.photoURL
      });
      closeAuthModal();
    } catch (err: any) {
      setError(getFriendlyErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth) {
      setError("Authentication service is not configured. Please add valid Firebase API keys.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      let result;
      if (view === 'login') {
        result = await signInWithEmailAndPassword(auth, email, password);
      } else {
        result = await createUserWithEmailAndPassword(auth, email, password);
      }
      setUser({
        uid: result.user.uid,
        email: result.user.email,
        displayName: result.user.displayName || email.split('@')[0],
        photoURL: result.user.photoURL
      });
      closeAuthModal();
    } catch (err: any) {
      setError(getFriendlyErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth) {
      setError("Authentication service is not configured.");
      return;
    }
    if (!email) {
      setError("Please enter your email address first.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await sendPasswordResetEmail(auth, email);
      setResetSuccess(true);
    } catch (err: any) {
      setError(getFriendlyErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const toggleView = (newView: AuthView) => {
    setView(newView);
    setError(null);
    setResetSuccess(false);
  };

  const renderResetPassword = () => (
    <div className="space-y-4">
      {resetSuccess ? (
        <div className="text-center space-y-4 py-4">
          <div className="mx-auto w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
            <CheckCircle className="w-6 h-6 text-green-600" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-800">Check your email</h3>
            <p className="text-sm text-slate-500 mt-2">
              We've sent a password reset link to <span className="font-semibold text-slate-700">{email}</span>
            </p>
          </div>
          <button
            onClick={() => toggleView('login')}
            className="w-full bg-slate-900 text-white p-3 rounded-xl font-medium hover:bg-slate-800 transition-all"
          >
            Back to Sign In
          </button>
        </div>
      ) : (
        <form onSubmit={handlePasswordReset} className="space-y-4">
          <p className="text-sm text-slate-600 mb-4">
            Enter your email address and we'll send you a link to reset your password.
          </p>
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Email Address</label>
            <input 
              type="email" 
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
              placeholder="name@example.com"
              disabled={loading}
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 text-white p-3 rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-md flex justify-center items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Send Reset Link'}
          </button>
          <button
            type="button"
            onClick={() => toggleView('login')}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 text-slate-500 hover:text-slate-800 p-2 text-sm font-medium transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Sign In
          </button>
        </form>
      )}
    </div>
  );

  const renderAuthForm = () => (
    <div className="space-y-4">
      <button
        onClick={handleGoogleSignIn}
        disabled={loading}
        className="w-full flex items-center justify-center gap-3 bg-white border border-slate-200 p-3 rounded-xl text-slate-700 font-medium hover:bg-slate-50 transition-colors shadow-sm disabled:opacity-70 disabled:cursor-not-allowed"
      >
        <img src="https://www.google.com/favicon.ico" alt="Google" className="w-5 h-5" />
        Sign in with Google
      </button>

      <div className="relative flex py-2 items-center">
        <div className="flex-grow border-t border-slate-200"></div>
        <span className="flex-shrink-0 mx-4 text-slate-400 text-xs uppercase">Or continue with email</span>
        <div className="flex-grow border-t border-slate-200"></div>
      </div>

      <form onSubmit={handleEmailAuth} className="space-y-3">
        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Email Address</label>
          <input 
            type="email" 
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
            placeholder="name@example.com"
            disabled={loading}
          />
        </div>
        <div>
          <div className="flex justify-between items-center mb-1">
            <label className="block text-xs font-semibold text-slate-500 uppercase">Password</label>
            {view === 'login' && (
              <button 
                type="button"
                onClick={() => toggleView('reset')}
                className="text-xs text-indigo-600 hover:text-indigo-800 font-medium hover:underline"
              >
                Forgot password?
              </button>
            )}
          </div>
          <input 
            type="password" 
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
            placeholder="••••••••"
            disabled={loading}
            minLength={6}
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-indigo-600 text-white p-3 rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-md mt-2 flex justify-center items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
        >
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (view === 'login' ? 'Sign In' : 'Create Account')}
        </button>
      </form>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden relative">
        <button 
          onClick={closeAuthModal}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
        
        <div className="p-8">
          <h2 className="text-2xl font-bold text-center text-slate-800 mb-2">
            {view === 'login' && 'Welcome Back'}
            {view === 'signup' && 'Create Account'}
            {view === 'reset' && 'Reset Password'}
          </h2>
          <p className="text-center text-slate-500 mb-6 text-sm">
            {view === 'login' && 'Sign in to sync your progress'}
            {view === 'signup' && 'Join LearnMate today'}
            {view === 'reset' && 'Get back access to your account'}
          </p>

          {error && (
            <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm mb-4 flex items-start gap-2 animate-in fade-in slide-in-from-top-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="flex-1 break-words whitespace-pre-line">{error}</div>
            </div>
          )}

          {view === 'reset' ? renderResetPassword() : renderAuthForm()}
        </div>
        
        {view !== 'reset' && (
          <div className="bg-slate-50 p-4 text-center text-sm text-slate-600 border-t border-slate-100">
            {view === 'login' ? "Don't have an account? " : "Already have an account? "}
            <button 
              onClick={() => toggleView(view === 'login' ? 'signup' : 'login')}
              className="text-indigo-600 font-semibold hover:underline"
              disabled={loading}
            >
              {view === 'login' ? 'Sign up' : 'Sign in'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
