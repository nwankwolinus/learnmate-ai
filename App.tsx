import React, { useEffect, useState } from 'react';
import { HashRouter, Routes, Route, NavLink, Navigate } from 'react-router-dom';
import { BookOpen, Brain, Calendar, BarChart3, GraduationCap, LogIn, User as UserIcon, LogOut, AlertTriangle, RefreshCw } from 'lucide-react';
import { ChatInterface } from './components/ChatInterface';
import { QuizInterface } from './components/QuizInterface';
import { PlanInterface } from './components/PlanInterface';
import { ProgressDashboard } from './components/ProgressDashboard';
import { AuthModal } from './components/AuthModal';
import { useStore } from './store/useStore';
import { auth } from './services/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';

function App() {
  const { user, setUser, openAuthModal, syncUserSessions, cloudError, retrySync } = useStore();
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);

  useEffect(() => {
    // If auth is not initialized (e.g. missing API keys), do not try to listen
    if (!auth) return;

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const userProfile = {
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          displayName: firebaseUser.displayName,
          photoURL: firebaseUser.photoURL
        };
        setUser(userProfile);
        // Sync sessions from Firestore
        await syncUserSessions(userProfile);
      } else {
        setUser(null);
        // Clear sessions or handle logout state if needed
        // Note: useStore logic could clear sessions here if strict privacy is needed
      }
    });
    return () => unsubscribe();
  }, [setUser, syncUserSessions]);

  const handleSignOut = async () => {
    if (!auth) return;
    try {
      await signOut(auth);
      setShowProfileMenu(false);
      // Optional: Clear persisted storage or reset store state here
      // window.location.reload(); // Simple way to clear state
    } catch (error) {
      console.error("Sign out error", error);
    }
  };

  const handleGlobalRetry = async () => {
    setIsRetrying(true);
    await retrySync();
    setIsRetrying(false);
  };

  return (
    <HashRouter>
      <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
        
        {/* Auth Modal */}
        <AuthModal />

        {/* Navigation Sidebar (Desktop) / Bottom Bar (Mobile) could be implemented here. 
            For simplicity in this layout, we'll use a Top Navigation Bar. */}
        <nav className="bg-white border-b border-slate-200 sticky top-0 z-50">
          <div className="max-w-6xl mx-auto px-4">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
                   <GraduationCap className="text-white w-5 h-5" />
                </div>
                <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600">
                  LearnMate AI
                </span>
              </div>
              
              <div className="hidden md:flex space-x-1">
                <NavLink to="/learn" className={({isActive}) => `px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${isActive ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:text-indigo-600 hover:bg-slate-50'}`}>
                   <BookOpen className="w-4 h-4" /> Learn
                </NavLink>
                <NavLink to="/quiz" className={({isActive}) => `px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${isActive ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:text-indigo-600 hover:bg-slate-50'}`}>
                   <Brain className="w-4 h-4" /> Quiz
                </NavLink>
                <NavLink to="/plan" className={({isActive}) => `px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${isActive ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:text-indigo-600 hover:bg-slate-50'}`}>
                   <Calendar className="w-4 h-4" /> Study Plan
                </NavLink>
                <NavLink to="/progress" className={({isActive}) => `px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${isActive ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:text-indigo-600 hover:bg-slate-50'}`}>
                   <BarChart3 className="w-4 h-4" /> Progress
                </NavLink>
              </div>

              {/* User Profile / Sign In Block */}
              <div className="relative">
                {user ? (
                  <div className="relative">
                    <button 
                      onClick={() => setShowProfileMenu(!showProfileMenu)}
                      className={`flex items-center gap-2 p-1.5 pr-3 rounded-full border transition-colors ${cloudError ? 'border-orange-300 bg-orange-50' : 'border-slate-200 hover:bg-slate-50'}`}
                      title={cloudError || "User Profile"}
                    >
                      {user.photoURL ? (
                        <img src={user.photoURL} alt="Profile" className="w-8 h-8 rounded-full" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold">
                          {user.displayName ? user.displayName[0].toUpperCase() : 'U'}
                        </div>
                      )}
                      
                      {cloudError && <AlertTriangle className="w-4 h-4 text-orange-500 animate-pulse" />}

                      <span className="text-sm font-medium text-slate-700 hidden sm:block max-w-[100px] truncate">
                        {user.displayName || 'User'}
                      </span>
                    </button>

                    {showProfileMenu && (
                      <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-slate-100 py-2 z-50 animate-fade-in">
                        <div className="px-4 py-2 border-b border-slate-100 mb-1">
                          <p className="text-sm font-bold text-slate-800 truncate">{user.displayName || 'User'}</p>
                          <p className="text-xs text-slate-500 truncate">{user.email}</p>
                        </div>
                        
                        {cloudError && (
                          <div className="px-4 py-2 bg-orange-50 text-xs text-orange-800 border-b border-orange-100">
                             <p className="font-bold mb-1 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Sync Issue</p>
                             <p className="mb-2 opacity-90">{cloudError}</p>
                             <button 
                               onClick={handleGlobalRetry}
                               disabled={isRetrying}
                               className="w-full text-center py-1 bg-white border border-orange-200 rounded text-orange-700 font-medium hover:bg-orange-100 transition-colors flex items-center justify-center gap-1"
                             >
                               <RefreshCw className={`w-3 h-3 ${isRetrying ? 'animate-spin' : ''}`} /> Retry Sync
                             </button>
                          </div>
                        )}

                        <button 
                          onClick={handleSignOut}
                          className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                        >
                          <LogOut className="w-4 h-4" /> Sign Out
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <button 
                    onClick={openAuthModal}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800 transition-colors shadow-sm"
                  >
                    <LogIn className="w-4 h-4" /> <span className="hidden sm:inline">Sign In</span>
                  </button>
                )}
              </div>
            </div>
          </div>
          
          {/* Mobile Nav */}
          <div className="md:hidden border-t border-slate-100 flex justify-around p-2 bg-white">
             <NavLink to="/learn" className={({isActive}) => `p-2 rounded-lg ${isActive ? 'text-indigo-600' : 'text-slate-400'}`}><BookOpen className="w-6 h-6" /></NavLink>
             <NavLink to="/quiz" className={({isActive}) => `p-2 rounded-lg ${isActive ? 'text-indigo-600' : 'text-slate-400'}`}><Brain className="w-6 h-6" /></NavLink>
             <NavLink to="/plan" className={({isActive}) => `p-2 rounded-lg ${isActive ? 'text-indigo-600' : 'text-slate-400'}`}><Calendar className="w-6 h-6" /></NavLink>
             <NavLink to="/progress" className={({isActive}) => `p-2 rounded-lg ${isActive ? 'text-indigo-600' : 'text-slate-400'}`}><BarChart3 className="w-6 h-6" /></NavLink>
          </div>
        </nav>

        <main className="max-w-6xl mx-auto p-4 md:p-6 lg:p-8">
          <Routes>
            <Route path="/" element={<Navigate to="/learn" replace />} />
            <Route path="/learn" element={<ChatInterface />} />
            <Route path="/quiz" element={<QuizInterface />} />
            <Route path="/plan" element={<PlanInterface />} />
            <Route path="/progress" element={<ProgressDashboard />} />
          </Routes>
        </main>
      </div>
    </HashRouter>
  );
}

export default App;