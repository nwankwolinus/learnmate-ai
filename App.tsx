
import React, { useEffect, useState, useMemo } from 'react';
import { HashRouter, Routes, Route, NavLink, Navigate } from 'react-router-dom';
import { BookOpen, Brain, Calendar, BarChart3, GraduationCap, LogIn, User as UserIcon, LogOut, AlertTriangle, RefreshCw, Repeat, Users, Map, Settings as SettingsIcon, Award, Star, Zap, Wifi, WifiOff } from 'lucide-react';
import { ChatInterface } from './components/ChatInterface';
import { QuizInterface } from './components/QuizInterface';
import { PlanInterface } from './components/PlanInterface';
import { ProgressDashboard } from './components/ProgressDashboard';
import { ReviewInterface } from './components/ReviewInterface';
import { GroupInterface } from './components/GroupInterface';
import { PathInterface } from './components/PathInterface';
import { SettingsInterface } from './components/SettingsInterface';
import { PortfolioInterface } from './components/PortfolioInterface';
import { AchievementsInterface } from './components/AchievementsInterface';
import { AuthModal } from './components/AuthModal';
import { PomodoroTimer } from './components/PomodoroTimer';
import { useStore } from './store/useStore';
import { auth } from './services/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { XP_PER_LEVEL } from './services/gamificationData';

function App() {
  const { 
    user, setUser, openAuthModal, syncUserSessions, cloudError, retrySync, srsItems, 
    gamification, closeLevelUpModal, isOnline, initializeNetworkListeners
  } = useStore();
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);

  useEffect(() => {
    initializeNetworkListeners();
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
  }, [setUser, syncUserSessions, initializeNetworkListeners]);

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

  // Calc due items count
  const dueCount = useMemo(() => {
    const now = Date.now();
    return srsItems.filter(i => i.nextReviewDate <= now).length;
  }, [srsItems]);

  // XP Progress for Header
  const xpForCurrentLevel = (gamification.level - 1) * XP_PER_LEVEL;
  const progressInLevel = gamification.xp - xpForCurrentLevel;
  const levelProgress = Math.min((progressInLevel / XP_PER_LEVEL) * 100, 100);

  return (
    <HashRouter>
      <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
        
        {/* Auth Modal */}
        <AuthModal />
        
        {/* Floating Pomodoro Widget */}
        <PomodoroTimer />

        {/* Level Up Modal Overlay */}
        {gamification.showLevelUp && (
           <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in" onClick={closeLevelUpModal}>
              <div className="bg-white rounded-3xl p-8 max-w-sm w-full text-center relative overflow-hidden shadow-2xl animate-bounce-slow" onClick={e => e.stopPropagation()}>
                 <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-yellow-400 to-orange-500"></div>
                 <div className="text-6xl mb-4">🎉</div>
                 <h2 className="text-3xl font-black text-slate-800 mb-2">LEVEL UP!</h2>
                 <p className="text-slate-500 mb-6">You are now Level <span className="text-indigo-600 font-bold text-xl">{gamification.level}</span></p>
                 <div className="bg-indigo-50 rounded-xl p-4 mb-6">
                    <p className="font-bold text-indigo-800">{gamification.rank}</p>
                    <p className="text-xs text-indigo-400 uppercase tracking-widest">Current Rank</p>
                 </div>
                 <button onClick={closeLevelUpModal} className="w-full bg-slate-900 text-white py-3 rounded-xl font-bold hover:scale-105 transition-transform">
                    Awesome!
                 </button>
              </div>
           </div>
        )}

        {/* Navigation Sidebar (Desktop) / Bottom Bar (Mobile) could be implemented here. 
            For simplicity in this layout, we'll use a Top Navigation Bar. */}
        <nav className="bg-white border-b border-slate-200 sticky top-0 z-50 print:hidden">
          <div className="max-w-7xl mx-auto px-4">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
                   <GraduationCap className="text-white w-5 h-5" />
                </div>
                <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600 hidden sm:inline">
                  LearnMate AI
                </span>
                
                {/* Offline Indicator */}
                {!isOnline && (
                  <span className="ml-2 flex items-center gap-1 text-xs font-bold text-orange-600 bg-orange-50 border border-orange-200 px-2 py-0.5 rounded-full">
                    <WifiOff className="w-3 h-3" /> Offline
                  </span>
                )}
              </div>
              
              <div className="hidden md:flex space-x-1">
                <NavLink to="/learn" className={({isActive}) => `px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${isActive ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:text-indigo-600 hover:bg-slate-50'}`}>
                   <BookOpen className="w-4 h-4" /> Learn
                </NavLink>
                <NavLink to="/paths" className={({isActive}) => `px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${isActive ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:text-indigo-600 hover:bg-slate-50'}`}>
                   <Map className="w-4 h-4" /> Paths
                </NavLink>
                <NavLink to="/groups" className={({isActive}) => `px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${isActive ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:text-indigo-600 hover:bg-slate-50'}`}>
                   <Users className="w-4 h-4" /> Groups
                </NavLink>
                <NavLink to="/quiz" className={({isActive}) => `px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${isActive ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:text-indigo-600 hover:bg-slate-50'}`}>
                   <Brain className="w-4 h-4" /> Quiz
                </NavLink>
                <NavLink to="/review" className={({isActive}) => `px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${isActive ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:text-indigo-600 hover:bg-slate-50'}`}>
                   <div className="relative">
                     <Repeat className="w-4 h-4" />
                     {dueCount > 0 && (
                       <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] w-4 h-4 flex items-center justify-center rounded-full font-bold">
                         {dueCount > 9 ? '9+' : dueCount}
                       </span>
                     )}
                   </div>
                   Review
                </NavLink>
                <NavLink to="/achievements" className={({isActive}) => `px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${isActive ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:text-indigo-600 hover:bg-slate-50'}`}>
                   <Award className="w-4 h-4" /> Achievements
                </NavLink>
                <NavLink to="/portfolio" className={({isActive}) => `px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${isActive ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:text-indigo-600 hover:bg-slate-50'}`}>
                   <UserIcon className="w-4 h-4" /> Portfolio
                </NavLink>
              </div>

              {/* User Profile / XP Block */}
              <div className="flex items-center gap-3">
                {/* XP Indicator */}
                <div className="hidden sm:flex flex-col items-end mr-2">
                   <div className="flex items-center gap-1 text-xs font-bold text-slate-700">
                      <Zap className="w-3 h-3 text-amber-500 fill-current" />
                      <span>Lvl {gamification.level}</span>
                   </div>
                   <div className="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden mt-0.5">
                      <div className="h-full bg-gradient-to-r from-green-400 to-emerald-500" style={{ width: `${levelProgress}%` }}></div>
                   </div>
                </div>

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
                          
                          {/* Sync Status / Offline Status */}
                          {(!isOnline || cloudError) && (
                            <div className="px-4 py-2 bg-orange-50 text-xs text-orange-800 border-b border-orange-100">
                              <p className="font-bold mb-1 flex items-center gap-1">
                                {isOnline ? <AlertTriangle className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
                                {isOnline ? 'Sync Issue' : 'You are Offline'}
                              </p>
                              <p className="mb-2 opacity-90">
                                {isOnline ? cloudError : 'Changes saved locally. Syncing when online.'}
                              </p>
                              {isOnline && (
                                <button 
                                  onClick={handleGlobalRetry}
                                  disabled={isRetrying}
                                  className="w-full text-center py-1 bg-white border border-orange-200 rounded text-orange-700 font-medium hover:bg-orange-100 transition-colors flex items-center justify-center gap-1"
                                >
                                  <RefreshCw className={`w-3 h-3 ${isRetrying ? 'animate-spin' : ''}`} /> Retry Sync
                                </button>
                              )}
                            </div>
                          )}

                          <NavLink 
                            to="/portfolio"
                            onClick={() => setShowProfileMenu(false)}
                            className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                          >
                            <UserIcon className="w-4 h-4" /> Portfolio
                          </NavLink>

                          <NavLink 
                            to="/settings"
                            onClick={() => setShowProfileMenu(false)}
                            className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                          >
                            <SettingsIcon className="w-4 h-4" /> Settings
                          </NavLink>

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
          </div>
          
          {/* Mobile Nav */}
          <div className="md:hidden border-t border-slate-100 flex justify-around p-2 bg-white overflow-x-auto print:hidden">
             <NavLink to="/learn" className={({isActive}) => `p-2 rounded-lg shrink-0 ${isActive ? 'text-indigo-600' : 'text-slate-400'}`}><BookOpen className="w-6 h-6" /></NavLink>
             <NavLink to="/paths" className={({isActive}) => `p-2 rounded-lg shrink-0 ${isActive ? 'text-indigo-600' : 'text-slate-400'}`}><Map className="w-6 h-6" /></NavLink>
             <NavLink to="/quiz" className={({isActive}) => `p-2 rounded-lg shrink-0 ${isActive ? 'text-indigo-600' : 'text-slate-400'}`}><Brain className="w-6 h-6" /></NavLink>
             <NavLink to="/achievements" className={({isActive}) => `p-2 rounded-lg shrink-0 ${isActive ? 'text-indigo-600' : 'text-slate-400'}`}><Award className="w-6 h-6" /></NavLink>
             <NavLink to="/portfolio" className={({isActive}) => `p-2 rounded-lg shrink-0 ${isActive ? 'text-indigo-600' : 'text-slate-400'}`}><UserIcon className="w-6 h-6" /></NavLink>
          </div>
        </nav>

        <main className="max-w-7xl mx-auto p-4 md:p-6 lg:p-8">
          <Routes>
            <Route path="/" element={<Navigate to="/learn" replace />} />
            <Route path="/learn" element={<ChatInterface />} />
            <Route path="/paths" element={<PathInterface />} />
            <Route path="/groups" element={<GroupInterface />} />
            <Route path="/quiz" element={<QuizInterface />} />
            <Route path="/review" element={<ReviewInterface />} />
            <Route path="/plan" element={<PlanInterface />} />
            <Route path="/portfolio" element={<PortfolioInterface />} />
            <Route path="/progress" element={<ProgressDashboard />} />
            <Route path="/achievements" element={<AchievementsInterface />} />
            <Route path="/settings" element={<SettingsInterface />} />
          </Routes>
        </main>
      </div>
    </HashRouter>
  );
}

export default App;
