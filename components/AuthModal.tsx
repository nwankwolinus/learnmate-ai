
import React, { useState } from 'react';
import { useStore } from '../store/useStore';
import { auth, googleProvider } from '../services/firebase';
import { 
  signInWithPopup, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword,
  updateProfile 
} from 'firebase/auth';
import { X, Loader2, AlertCircle, Lock, UserCircle, ArrowRight, Mail, User } from 'lucide-react';

export const AuthModal: React.FC = () => {
  const { isAuthModalOpen, closeAuthModal, setUser } = useStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showGuestRecommend, setShowGuestRecommend] = useState(false);

  // Email Auth State
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');

  if (!isAuthModalOpen) return null;

  const resetForm = () => {
    setEmail('');
    setPassword('');
    setDisplayName('');
    setError(null);
    setLoading(false);
  };

  const toggleMode = () => {
    setIsSignUp(!isSignUp);
    setError(null);
  };

  const handleGoogleSignIn = async () => {
    if (!auth || !googleProvider) {
      setError("Authentication service is not configured. Please check your Firebase settings.");
      return;
    }
    setLoading(true);
    setError(null);
    setShowGuestRecommend(false);

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
      console.error("Auth Error:", err);
      if (err.code === 'auth/popup-closed-by-user') {
        setError("Sign-in was cancelled.");
      } else if (err.code === 'auth/network-request-failed') {
        setError("Network error. Please check your internet connection.");
      } else if (err.code === 'auth/unauthorized-domain' || err.code === 'auth/operation-not-allowed') {
        setError("Preview Environment Detected: Google Sign-In is restricted on this domain.");
        setShowGuestRecommend(true);
      } else {
        setError(err.message || "Unable to sign in. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth) {
      setError("Authentication service is not configured.");
      return;
    }
    
    if (!email || !password) {
      setError("Please enter both email and password.");
      return;
    }

    if (isSignUp && !displayName) {
      setError("Please enter your name.");
      return;
    }

    setLoading(true);
    setError(null);
    setShowGuestRecommend(false);

    try {
      let userCredential;
      if (isSignUp) {
        userCredential = await createUserWithEmailAndPassword(auth, email, password);
        if (userCredential.user && displayName) {
          await updateProfile(userCredential.user, { displayName });
        }
      } else {
        userCredential = await signInWithEmailAndPassword(auth, email, password);
      }

      // Force refresh user to get display name if just updated
      const currentUser = userCredential.user;
      
      setUser({
        uid: currentUser.uid,
        email: currentUser.email,
        displayName: displayName || currentUser.displayName || 'User',
        photoURL: currentUser.photoURL
      });
      
      closeAuthModal();
      resetForm();
    } catch (err: any) {
      console.error("Email Auth Error:", err);
      if (err.code === 'auth/email-already-in-use') {
        setError("Account already exists. Switching to Sign In...");
        setIsSignUp(false); // Auto-switch to Sign In
        // We don't clear email/password so user can just click Sign In again
      } else if (err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') {
        setError("Invalid email or password.");
      } else if (err.code === 'auth/weak-password') {
        setError("Password should be at least 6 characters.");
      } else {
        setError(err.message || "Authentication failed.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGuestLogin = () => {
    setUser({
      uid: 'guest',
      email: 'guest@demo.com',
      displayName: 'Guest User',
      photoURL: null
    });
    closeAuthModal();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden relative my-8">
        <button 
          onClick={closeAuthModal}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors p-2 hover:bg-slate-50 rounded-full z-10"
        >
          <X className="w-5 h-5" />
        </button>
        
        <div className="p-8 flex flex-col items-center">
          <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mb-4">
             <Lock className="w-7 h-7" />
          </div>

          <h2 className="text-2xl font-bold text-slate-800 mb-2">
            {isSignUp ? "Create Account" : "Welcome Back"}
          </h2>
          <p className="text-slate-500 mb-6 text-sm text-center">
            {isSignUp ? "Join LearnMate to start your journey." : "Sign in to access your learning paths."}
          </p>

          {error && (
            <div className={`w-full p-3 rounded-xl text-sm mb-6 flex flex-col items-start gap-2 text-left animate-in fade-in slide-in-from-top-2 border ${showGuestRecommend ? 'bg-amber-50 text-amber-800 border-amber-200' : 'bg-red-50 text-red-600 border-red-100'}`}>
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span className="font-bold">{showGuestRecommend ? "Access Restriction" : "Error"}</span>
              </div>
              <span>{error}</span>
              {showGuestRecommend && (
                <div className="w-full mt-2 pt-2 border-t border-amber-200/50">
                   <p className="text-xs mb-2 opacity-90">Please use Guest Mode to continue testing.</p>
                </div>
              )}
            </div>
          )}

          {/* Social / Guest Login */}
          <div className="space-y-3 w-full mb-6">
            <button
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 bg-white border-2 border-slate-100 p-3 rounded-xl text-slate-700 font-bold hover:bg-slate-50 hover:border-slate-200 transition-all transform active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {loading && !email ? (
                <Loader2 className="w-5 h-5 animate-spin text-indigo-600" />
              ) : (
                <>
                  <div className="w-5 h-5 relative">
                    <img 
                        src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" 
                        alt="Google" 
                        className="w-full h-full"
                    />
                  </div>
                  <span>Google</span>
                </>
              )}
            </button>

            <button
              onClick={handleGuestLogin}
              disabled={loading}
              className={`w-full flex items-center justify-center gap-2 border-2 p-3 rounded-xl font-bold transition-all active:scale-[0.98] ${
                showGuestRecommend 
                  ? 'bg-indigo-600 text-white border-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-200' 
                  : 'bg-slate-50 border-transparent text-slate-600 hover:bg-slate-100'
              }`}
            >
              <UserCircle className={`w-5 h-5 ${showGuestRecommend ? 'text-indigo-200' : 'text-slate-400'}`} />
              <span>Guest Mode</span>
              {showGuestRecommend && <ArrowRight className="w-4 h-4 ml-1" />}
            </button>
          </div>

          <div className="w-full flex items-center gap-4 mb-6">
            <div className="h-px bg-slate-200 flex-1"></div>
            <span className="text-xs text-slate-400 font-bold uppercase">Or with Email</span>
            <div className="h-px bg-slate-200 flex-1"></div>
          </div>

          {/* Email Form */}
          <form onSubmit={handleEmailAuth} className="w-full space-y-4">
            {isSignUp && (
              <div className="relative">
                <User className="w-5 h-5 text-slate-400 absolute left-3 top-3.5" />
                <input 
                  type="text" 
                  placeholder="Full Name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all outline-none text-sm"
                  required={isSignUp}
                />
              </div>
            )}
            
            <div className="relative">
              <Mail className="w-5 h-5 text-slate-400 absolute left-3 top-3.5" />
              <input 
                type="email" 
                placeholder="Email Address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all outline-none text-sm"
                required
              />
            </div>

            <div className="relative">
              <Lock className="w-5 h-5 text-slate-400 absolute left-3 top-3.5" />
              <input 
                type="password" 
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all outline-none text-sm"
                required
                minLength={6}
              />
            </div>

            <button 
              type="submit"
              disabled={loading}
              className="w-full bg-slate-900 text-white py-3 rounded-xl font-bold hover:bg-slate-800 transition-all flex items-center justify-center gap-2 shadow-lg shadow-slate-200"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (isSignUp ? "Create Account" : "Sign In")}
            </button>
          </form>

          <p className="mt-6 text-sm text-slate-500">
            {isSignUp ? "Already have an account?" : "Don't have an account?"}
            <button 
              onClick={toggleMode}
              className="ml-1 text-indigo-600 font-bold hover:underline focus:outline-none"
            >
              {isSignUp ? "Sign In" : "Sign Up"}
            </button>
          </p>

        </div>
      </div>
    </div>
  );
};
