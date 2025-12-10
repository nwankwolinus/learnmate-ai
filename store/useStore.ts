
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { 
  Message, 
  ChatSession,
  DifficultyLevel, 
  ExplanationStyle,
  AIPersona,
  QuizQuestion, 
  QuizResult, 
  StudyPlan,
  UserProfile,
  SRSItem,
  ReviewRating,
  StudyGroup,
  GroupMember,
  GroupMessage,
  LearningPath,
  PathNode,
  UserSettings,
  StreakData,
  PomodoroState,
  Certificate,
  PortfolioProfile,
  GamificationState,
  Achievement,
  Challenge,
  UserRank
} from '../types';
import { 
  chatWithLearnMate, 
  generateQuiz, 
  generateStudyPlan,
  generateVisualAid,
  generateChatTitle,
  generateLearningPath
} from '../services/geminiService';
import { db } from '../services/firebase';
import { 
  doc, setDoc, getDoc, collection, getDocs, writeBatch, deleteDoc, 
  addDoc, query, where, updateDoc, onSnapshot, orderBy, arrayUnion
} from 'firebase/firestore';
import { 
  RANKS, 
  XP_PER_LEVEL, 
  calculateLevel, 
  INITIAL_ACHIEVEMENTS, 
  generateDailyChallenges 
} from '../services/gamificationData';
import confetti from 'canvas-confetti';

interface AppState {
  // --- Network State ---
  isOnline: boolean;
  initializeNetworkListeners: () => void;

  // --- Auth ---
  user: UserProfile | null;
  isAuthModalOpen: boolean;
  cloudError: string | null;
  isDbAvailable: boolean; 
  setUser: (user: UserProfile | null) => void;
  openAuthModal: () => void;
  closeAuthModal: () => void;
  syncUserSessions: (user: UserProfile | null) => Promise<void>;
  retrySync: () => Promise<void>;

  // --- Settings & Consistency ---
  settings: UserSettings;
  streak: StreakData;
  updateSettings: (newSettings: Partial<UserSettings>) => Promise<void>;
  updateStudyTime: (minutes: number) => Promise<void>;
  checkStreak: () => Promise<void>;
  
  // --- Pomodoro ---
  pomodoro: PomodoroState;
  setPomodoroStatus: (isActive: boolean) => void;
  tickPomodoro: () => void;
  switchPomodoroMode: (mode: 'focus' | 'shortBreak' | 'longBreak') => void;
  resetPomodoro: () => void;

  // --- Gamification ---
  gamification: GamificationState;
  addXP: (amount: number, reason?: string) => Promise<void>;
  checkAchievements: () => void;
  updateChallengeProgress: (type: 'quiz' | 'chat', amount: number) => void;
  closeLevelUpModal: () => void;
  syncGamification: (user: UserProfile) => Promise<void>;

  // --- Settings ---
  difficulty: DifficultyLevel;
  style: ExplanationStyle;
  persona: AIPersona;
  setDifficulty: (level: DifficultyLevel) => void;
  setStyle: (style: ExplanationStyle) => void;
  setPersona: (persona: AIPersona) => void;

  // --- Chat Sessions ---
  sessions: ChatSession[];
  currentSessionId: string | null;
  createSession: () => void;
  selectSession: (sessionId: string) => void;
  deleteSession: (sessionId: string) => void;
  
  // --- Chat ---
  messages: Message[]; 
  isChatLoading: boolean;
  chatError: string | null;
  sendMessage: (content: string, file?: File | Blob, mimeType?: string) => Promise<void>;
  generateVisualForMessage: (prompt: string) => Promise<void>;
  clearChatError: () => void;

  // --- Quiz ---
  quizTopic: string;
  setQuizTopic: (topic: string) => void;
  quizQuestions: QuizQuestion[];
  quizResults: QuizResult[];
  cachedQuestions: QuizQuestion[]; 
  isQuizGenerating: boolean;
  quizError: string | null;
  generateQuizAction: (topic: string) => Promise<void>;
  saveQuizResult: (result: QuizResult) => void;
  clearQuiz: () => void;
  
  // --- SRS Integration ---
  srsItems: SRSItem[];
  addQuizToSRS: (questions: QuizQuestion[], userAnswers: (number | null)[], topic: string) => Promise<void>;
  submitReview: (itemId: string, rating: ReviewRating) => Promise<void>;
  syncSRSItems: (user: UserProfile) => Promise<void>;

  // --- Plan ---
  currentPlan: StudyPlan | null;
  isPlanLoading: boolean;
  planError: string | null;
  createPlan: (topic: string, duration: string) => Promise<void>;
  resetPlan: () => void;

  // --- Study Groups ---
  currentGroup: StudyGroup | null;
  groupMembers: GroupMember[];
  groupMessages: GroupMessage[];
  groupLoading: boolean;
  groupError: string | null;
  
  createGroup: (name: string, description: string, isPublic: boolean) => Promise<void>;
  joinGroup: (code: string) => Promise<void>;
  leaveGroup: () => Promise<void>;
  sendGroupMessage: (content: string) => Promise<void>;
  
  // Group Quiz Actions
  startGroupQuiz: (topic: string) => Promise<void>;
  submitGroupQuizAnswer: (questionIndex: number, answerIndex: number) => Promise<void>;
  nextGroupQuizQuestion: () => Promise<void>;
  endGroupQuiz: () => Promise<void>;
  
  // Real-time listeners cleanup
  unsubscribeGroup: (() => void) | null;

  // --- Learning Paths ---
  learningPaths: LearningPath[];
  communityPaths: LearningPath[];
  activePathId: string | null;
  isPathGenerating: boolean;
  pathError: string | null;
  
  generatePathAction: (goal: string) => Promise<void>;
  selectPath: (id: string) => void;
  deletePath: (id: string) => void;
  completePathNode: (pathId: string, nodeId: string) => Promise<void>;
  updatePathNodePosition: (pathId: string, nodeId: string, x: number, y: number) => void;
  syncPaths: (user: UserProfile) => Promise<void>;
  
  // Community Path Actions
  fetchCommunityPaths: () => Promise<void>;
  publishPath: (pathId: string) => Promise<void>;
  clonePath: (path: LearningPath) => Promise<void>;

  // --- Portfolio & Certificates ---
  certificates: Certificate[];
  portfolio: PortfolioProfile;
  issueCertificate: (topic: string) => void;
  updatePortfolio: (updates: Partial<PortfolioProfile>) => void;
  syncPortfolio: (user: UserProfile) => Promise<void>;
}

const fileToBase64 = (file: File | Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

const cleanDataForFirestore = (data: any): any => {
  const seen = new WeakSet();
  const safeJson = JSON.stringify(data, (key, value) => {
    if (typeof value === 'object' && value !== null) {
      if (seen.has(value)) {
        return; 
      }
      seen.add(value);
    }
    return value;
  });
  return JSON.parse(safeJson);
};

const saveSessionToDb = async (uid: string, session: ChatSession, isDbAvailable: boolean) => {
  if (!db || !isDbAvailable || uid === 'guest') return;
  try {
    const cleanSession = cleanDataForFirestore(session);
    await setDoc(doc(db, 'users', uid, 'sessions', session.id), cleanSession);
  } catch (e) {
    console.warn("Failed to save session to cloud (using local):", e);
  }
};

const deleteSessionFromDb = async (uid: string, sessionId: string, isDbAvailable: boolean) => {
  if (!db || !isDbAvailable || uid === 'guest') return;
  try {
    await deleteDoc(doc(db, 'users', uid, 'sessions', sessionId));
  } catch (e) {
    console.warn("Failed to delete session from cloud:", e);
  }
};

// --- SM-2 Logic ---
const calculateNextReview = (
  rating: ReviewRating, 
  currentInterval: number, 
  currentRepetitions: number, 
  currentEF: number
) => {
  let nextInterval: number;
  let nextRepetitions: number;
  let nextEF: number;

  let q = 0;
  if (rating === 'again') q = 0;
  else if (rating === 'hard') q = 3;
  else if (rating === 'good') q = 4;
  else if (rating === 'easy') q = 5;

  if (q < 3) {
    nextRepetitions = 0;
    nextInterval = 1;
    nextEF = currentEF;
  } else {
    if (currentRepetitions === 0) {
      nextInterval = 1;
    } else if (currentRepetitions === 1) {
      nextInterval = 6;
    } else {
      nextInterval = Math.round(currentInterval * currentEF);
    }
    nextRepetitions = currentRepetitions + 1;
    nextEF = currentEF + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));
    if (nextEF < 1.3) nextEF = 1.3;
  }
  return { nextInterval, nextRepetitions, nextEF };
};

const generateGroupCode = () => {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
};

const getTodayDateString = () => {
  return new Date().toISOString().split('T')[0];
};

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      // --- Network State ---
      isOnline: navigator.onLine,
      initializeNetworkListeners: () => {
        window.addEventListener('online', () => set({ isOnline: true }));
        window.addEventListener('offline', () => set({ isOnline: false }));
      },

      user: null,
      isAuthModalOpen: false,
      cloudError: null,
      isDbAvailable: true, 
      setUser: (user) => set({ user }),
      openAuthModal: () => set({ isAuthModalOpen: true }),
      closeAuthModal: () => set({ isAuthModalOpen: false }),

      settings: {
        dailyGoalMinutes: 30,
        weeklyGoalQuizzes: 5,
        notificationsEnabled: false,
        reminderTime: "18:00"
      },
      streak: {
        currentStreak: 0,
        maxStreak: 0,
        lastStudyDate: '',
        activityHistory: {}
      },
      pomodoro: {
        isActive: false,
        mode: 'focus',
        timeLeft: 25 * 60,
        cyclesCompleted: 0
      },

      gamification: {
        xp: 0,
        level: 1,
        rank: 'Novice',
        achievements: INITIAL_ACHIEVEMENTS,
        activeChallenges: generateDailyChallenges(),
        showLevelUp: false
      },

      addXP: async (amount: number, reason?: string) => {
        const { gamification, user, isDbAvailable } = get();
        const newXP = gamification.xp + amount;
        const newLevel: number = calculateLevel(newXP);
        const didLevelUp = newLevel > gamification.level;
        
        const rankObj = RANKS.slice().reverse().find((r: UserRank) => newLevel >= r.minLevel) || RANKS[0];

        const newState = {
           ...gamification,
           xp: newXP,
           level: newLevel,
           rank: rankObj.name,
           showLevelUp: didLevelUp
        };

        if (didLevelUp) {
           confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
        }

        set({ gamification: newState });

        get().checkAchievements();

        if (user && user.uid !== 'guest' && isDbAvailable && db) {
           try {
              await setDoc(doc(db, 'users', user.uid, 'settings', 'gamification'), cleanDataForFirestore(newState));
           } catch (e) { console.warn("XP Sync Error (Local only)", e); }
        }
      },

      checkAchievements: () => {
        const { gamification, quizResults, streak, messages } = get();
        let updatedAchievements = [...gamification.achievements];
        let changed = false;

        const totalStudyMinutes = (Object.values(streak.activityHistory) as number[]).reduce((a: number, b: number) => a + b, 0);

        updatedAchievements = updatedAchievements.map(ach => {
          if (ach.isUnlocked) return ach;
          
          let unlocked = false;
          
          if (ach.id === 'first_steps' && messages.length > 0) unlocked = true;
          if (ach.id === 'quiz_novice' && quizResults.length >= 5) unlocked = true;
          if (ach.id === 'quiz_master' && quizResults.some(r => r.score === r.total)) unlocked = true;
          if (ach.id === 'streak_week' && streak.currentStreak >= 7) unlocked = true;
          if (ach.id === 'dedicated_learner' && totalStudyMinutes >= 1000) unlocked = true;

          if (unlocked) {
            changed = true;
            setTimeout(() => get().addXP(ach.xpReward, `Achievement: ${ach.title}`), 0);
            return { ...ach, isUnlocked: true, unlockedAt: Date.now() };
          }
          return ach;
        });

        if (changed) {
           set({ gamification: { ...gamification, achievements: updatedAchievements } });
        }
      },

      updateChallengeProgress: (type, amount) => {
         const { gamification } = get();
         const now = Date.now();
         
         const updatedChallenges = gamification.activeChallenges.map(ch => {
            if (ch.expiresAt < now) return ch; 
            
            if (ch.completed) return ch;
            if (ch.type === 'daily' && ch.title.toLowerCase().includes(type)) {
               const newProgress = Math.min(ch.progress + amount, ch.goal);
               const isComplete = newProgress >= ch.goal;
               
               if (isComplete && !ch.completed) {
                  setTimeout(() => get().addXP(ch.rewardXP, `Challenge: ${ch.title}`), 0);
               }
               
               return { ...ch, progress: newProgress, completed: isComplete };
            }
            return ch;
         });

         set({ gamification: { ...gamification, activeChallenges: updatedChallenges } });
      },

      closeLevelUpModal: () => set(s => ({ gamification: { ...s.gamification, showLevelUp: false } })),

      syncGamification: async (user) => {
         if (!user || !db || !get().isDbAvailable || user.uid === 'guest') return;
         try {
            const docRef = doc(db, 'users', user.uid, 'settings', 'gamification');
            const snap = await getDoc(docRef);
            if (snap.exists()) {
               const data = snap.data() as GamificationState;
               set({ gamification: data });
            }
         } catch (e) { console.warn("Game Sync Error", e); }
      },

      updateSettings: async (newSettings) => {
        const updated = { ...get().settings, ...newSettings };
        set({ settings: updated });
        const { user, isDbAvailable } = get();
        if (user && user.uid !== 'guest' && isDbAvailable && db) {
           try {
             await setDoc(doc(db, 'users', user.uid, 'settings', 'preferences'), updated);
           } catch (e) { console.warn("Failed to save settings", e); }
        }
      },

      updateStudyTime: async (minutes) => {
         const today = getTodayDateString();
         const { streak, user, isDbAvailable } = get();
         
         const currentHistory = { ...streak.activityHistory };
         currentHistory[today] = (currentHistory[today] || 0) + minutes;
         
         get().updateChallengeProgress('chat', minutes);

         const updatedStreakData = {
            ...streak,
            activityHistory: currentHistory
         };
         
         set({ streak: updatedStreakData });
         get().checkStreak(); 
         
         if (user && user.uid !== 'guest' && isDbAvailable && db) {
            try {
               await setDoc(doc(db, 'users', user.uid, 'settings', 'streak'), cleanDataForFirestore(updatedStreakData));
            } catch (e) { console.warn("Failed to save streak", e); }
         }
      },

      checkStreak: async () => {
        const { streak, user, isDbAvailable } = get();
        const today = getTodayDateString();
        const lastDate = streak.lastStudyDate;
        
        if (lastDate === today) return;

        let newCurrentStreak = streak.currentStreak;
        let newMaxStreak = streak.maxStreak;
        
        if (lastDate) {
          const last = new Date(lastDate);
          const now = new Date(today);
          const diffTime = Math.abs(now.getTime() - last.getTime());
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
          
          if (diffDays === 1) {
            newCurrentStreak += 1;
            get().addXP(25, "Streak Bonus"); 
          } else if (diffDays > 1) {
            newCurrentStreak = 1; 
          }
        } else {
          newCurrentStreak = 1;
        }

        if (newCurrentStreak > newMaxStreak) newMaxStreak = newCurrentStreak;

        const updatedStreak = {
           ...streak,
           currentStreak: newCurrentStreak,
           maxStreak: newMaxStreak,
           lastStudyDate: today
        };

        set({ streak: updatedStreak });
        get().checkAchievements(); 
        
        if (user && user.uid !== 'guest' && isDbAvailable && db) {
           try {
              await setDoc(doc(db, 'users', user.uid, 'settings', 'streak'), cleanDataForFirestore(updatedStreak));
           } catch (e) { console.warn("Streak sync error", e); }
        }
      },
      
      setPomodoroStatus: (isActive) => set(s => ({ pomodoro: { ...s.pomodoro, isActive } })),
      tickPomodoro: () => set(s => {
         if (!s.pomodoro.isActive) return {};
         if (s.pomodoro.timeLeft <= 0) {
            return { pomodoro: { ...s.pomodoro, isActive: false } };
         }
         return { pomodoro: { ...s.pomodoro, timeLeft: s.pomodoro.timeLeft - 1 } };
      }),
      switchPomodoroMode: (mode) => {
         let time = 25 * 60;
         if (mode === 'shortBreak') time = 5 * 60;
         if (mode === 'longBreak') time = 15 * 60;
         set(s => ({ pomodoro: { ...s.pomodoro, mode, timeLeft: time, isActive: false } }));
      },
      resetPomodoro: () => {
         const { mode } = get().pomodoro;
         get().switchPomodoroMode(mode);
      },

      syncUserSessions: async (user) => {
        set({ cloudError: null });
        
        // Critical: Check isDbAvailable first to prevent persistent connection retries
        // if the DB doesn't exist.
        if (!user || !db || user.uid === 'guest' || !get().isDbAvailable) return;

        try {
          // Check if DB is actually reachable by doing a lightweight fetch
          const settingsRef = doc(db, 'users', user.uid, 'settings', 'preferences');
          const settingsSnap = await getDoc(settingsRef);

          if (settingsSnap.exists()) set({ settings: settingsSnap.data() as UserSettings });

          const sessionsRef = collection(db, 'users', user.uid, 'sessions');
          const snapshot = await getDocs(sessionsRef);
          const cloudSessions: ChatSession[] = [];
          snapshot.forEach(doc => cloudSessions.push(doc.data() as ChatSession));

          const { sessions: localSessions } = get();
          const batch = writeBatch(db);
          let hasUpdates = false;
          const mergedSessions = [...cloudSessions];

          for (const local of localSessions) {
            const exists = cloudSessions.find(c => c.id === local.id);
            if (!exists) {
              const ref = doc(db, 'users', user.uid, 'sessions', local.id);
              batch.set(ref, cleanDataForFirestore(local));
              mergedSessions.push(local);
              hasUpdates = true;
            }
          }

          const { syncSRSItems, syncPaths, syncPortfolio, syncGamification } = get();
          await syncSRSItems(user);
          await syncPaths(user);
          await syncPortfolio(user);
          await syncGamification(user);

          try {
             const streakSnap = await getDoc(doc(db, 'users', user.uid, 'settings', 'streak'));
             if (streakSnap.exists()) set({ streak: streakSnap.data() as StreakData });
             
             get().checkStreak();
          } catch (e) { console.warn("Settings sync error", e); }

          if (hasUpdates) await batch.commit();
          mergedSessions.sort((a, b) => b.createdAt - a.createdAt);
          set({ sessions: mergedSessions, cloudError: null });
          
          if (mergedSessions.length > 0) {
            const { currentSessionId } = get();
            if (!currentSessionId || !mergedSessions.find(s => s.id === currentSessionId)) {
               set({ currentSessionId: mergedSessions[0].id, messages: mergedSessions[0].messages });
            }
          }
        } catch (e: any) {
          // Explicitly check for offline/network errors
          if (e.message?.includes('offline') || e.code === 'unavailable') {
             console.log("Sync skipped: Client is offline");
             set({ cloudError: "You are offline." });
             // We keep isDbAvailable=true to ensure local persistence queues writes
             return;
          }

          console.error("Sync failed, falling back to local mode:", e);
          
          if (e.code === 'not-found' || e.message?.includes('database') || e.message?.includes('project')) {
             set({ isDbAvailable: false, cloudError: "Database not configured. Local mode only." });
          } else {
             set({ cloudError: "Sync issue. Working offline." });
          }
        }
      },

      retrySync: async () => {
        const { user, syncUserSessions, isDbAvailable } = get();
        // Allow retry only if we haven't permanently disabled DB access
        if (user && isDbAvailable) await syncUserSessions(user);
      },

      difficulty: DifficultyLevel.Beginner,
      style: ExplanationStyle.Standard,
      persona: AIPersona.Professional,
      setDifficulty: (difficulty) => set({ difficulty }),
      setStyle: (style) => set({ style }),
      setPersona: (persona) => set({ persona }),

      sessions: [],
      currentSessionId: null,
      createSession: () => {
        const newSession: ChatSession = {
          id: Date.now().toString(),
          title: 'New Chat',
          messages: [],
          createdAt: Date.now()
        };
        set((state) => ({ 
          sessions: [newSession, ...state.sessions], 
          currentSessionId: newSession.id, 
          messages: [] 
        }));
      },
      selectSession: (sessionId) => {
        const session = get().sessions.find(s => s.id === sessionId);
        if (session) set({ currentSessionId: sessionId, messages: session.messages });
      },
      deleteSession: (sessionId) => {
        const { sessions, currentSessionId, user, isDbAvailable } = get();
        const updatedSessions = sessions.filter(s => s.id !== sessionId);
        let newCurrentId = currentSessionId;
        let newMessages = get().messages;

        if (currentSessionId === sessionId) {
          if (updatedSessions.length > 0) {
            newCurrentId = updatedSessions[0].id;
            newMessages = updatedSessions[0].messages;
          } else {
            newCurrentId = null;
            newMessages = [];
          }
        }
        set({ sessions: updatedSessions, currentSessionId: newCurrentId, messages: newMessages });
        if (user && user.uid !== 'guest' && isDbAvailable) deleteSessionFromDb(user.uid, sessionId, isDbAvailable);
      },

      messages: [],
      isChatLoading: false,
      chatError: null,
      sendMessage: async (content, file, mimeType) => {
        if (!get().isOnline) {
          set({ chatError: "You are offline. Please check your internet connection to chat with AI." });
          return;
        }

        let { sessions, currentSessionId, difficulty, style, persona, user, isDbAvailable } = get();
        if (!currentSessionId) {
          get().createSession();
          currentSessionId = get().currentSessionId;
          sessions = get().sessions;
        }
        if (!currentSessionId) return;

        get().addXP(5, "Message Sent");
        get().updateChallengeProgress('chat', 1);

        const newUserMsg: Message = {
          id: Date.now().toString(),
          role: 'user',
          content: content || (file ? `Attached file: ${(file instanceof File ? file.name : 'media')}` : ''),
          timestamp: Date.now(),
        };

        get().updateStudyTime(1);

        let mediaPart = undefined;
        
        if (file) {
          try {
            const base64 = await fileToBase64(file);
            const type = mimeType || file.type;
            
            newUserMsg.attachmentData = { mimeType: type, data: base64 };
            
            if (type.startsWith('image/')) {
              newUserMsg.type = 'image';
              newUserMsg.imageUrl = URL.createObjectURL(file);
            } else if (type.startsWith('audio/')) {
              newUserMsg.type = 'audio';
              newUserMsg.audioUrl = URL.createObjectURL(file);
            } else if (type === 'application/pdf') {
              newUserMsg.type = 'file';
              newUserMsg.fileUrl = URL.createObjectURL(file);
              // Safe cast because file must be File object here, or we use fallback
              newUserMsg.fileName = (file instanceof File) ? file.name : 'Document';
            }

            mediaPart = { inlineData: { data: base64, mimeType: type } };
          } catch (e) {
            set({ chatError: "Failed to process file." });
            return;
          }
        }

        const sessionIndex = sessions.findIndex(s => s.id === currentSessionId);
        if (sessionIndex === -1) return;

        const updatedSessions = [...sessions];
        const currentSession = { ...updatedSessions[sessionIndex] };
        
        const isFirstMessage = currentSession.messages.length === 0;
        if (isFirstMessage) {
          currentSession.title = content.slice(0, 30) + (content.length > 30 ? '...' : 'Media Upload');
        }
        currentSession.messages = [...currentSession.messages, newUserMsg];
        updatedSessions[sessionIndex] = currentSession;
        
        set({ sessions: updatedSessions, messages: currentSession.messages, isChatLoading: true, chatError: null });
        if (user && user.uid !== 'guest') saveSessionToDb(user.uid, currentSession, isDbAvailable);

        if (isFirstMessage && content) {
           generateChatTitle(content).then(title => {
              set(s => {
                 const list = [...s.sessions];
                 const idx = list.findIndex(i => i.id === currentSessionId);
                 if (idx !== -1) {
                    list[idx] = { ...list[idx], title };
                    if (user && user.uid !== 'guest') saveSessionToDb(user.uid, list[idx], isDbAvailable);
                    return { sessions: list };
                 }
                 return {};
              });
           });
        }

        try {
          // Update the content line to use safe cast
          if (!newUserMsg.content && file) {
            newUserMsg.content = `Attached file: ${(file instanceof File) ? file.name : 'media'}`;
          }

          const responseText = await chatWithLearnMate(
            content || "Please analyze this attachment.",
            currentSession.messages.slice(0, -1),
            difficulty,
            style,
            persona,
            mediaPart
          );
          const aiMsg: Message = {
            id: (Date.now() + 1).toString(),
            role: 'model',
            content: responseText,
            timestamp: Date.now()
          };
          set(state => {
             const list = [...state.sessions];
             const idx = list.findIndex(i => i.id === currentSessionId);
             if (idx !== -1) {
                const sess = { ...list[idx] };
                sess.messages = [...sess.messages, aiMsg];
                list[idx] = sess;
                if (user && user.uid !== 'guest') saveSessionToDb(user.uid, sess, isDbAvailable);
                return { sessions: list, messages: sess.messages, isChatLoading: false };
             }
             return { isChatLoading: false };
          });
        } catch (error: any) {
          set({ isChatLoading: false, chatError: error.message || "Something went wrong." });
        }
      },
      generateVisualForMessage: async (prompt) => {
        if (!get().isOnline) {
          set({ chatError: "Image generation requires an internet connection." });
          return;
        }

        const { currentSessionId, sessions, user, isDbAvailable } = get();
        if (!currentSessionId) return;
        
        set({ isChatLoading: true });

        try {
           const imageDatUri = await generateVisualAid(prompt);
           
           if (!imageDatUri) {
             throw new Error("Failed to generate image data");
           }

           const newMessage: Message = {
             id: Date.now().toString(),
             role: 'model',
             content: "I've generated a visual aid to help explain this concept:",
             type: 'image',
             imageUrl: imageDatUri,
             timestamp: Date.now()
           };

           const sessionIndex = sessions.findIndex(s => s.id === currentSessionId);
           if (sessionIndex === -1) {
             set({ isChatLoading: false });
             return;
           }

           const updatedSessions = [...sessions];
           const currentSession = { ...updatedSessions[sessionIndex] };
           currentSession.messages = [...currentSession.messages, newMessage];
           updatedSessions[sessionIndex] = currentSession;

           set({ 
             sessions: updatedSessions, 
             messages: currentSession.messages, 
             isChatLoading: false 
           });

           if (user && user.uid !== 'guest') {
              saveSessionToDb(user.uid, currentSession, isDbAvailable);
           }

        } catch (e: any) {
           set({ isChatLoading: false, chatError: "Could not generate visual aid. Please try again." });
           console.error(e);
        }
      },
      clearChatError: () => set({ chatError: null }),

      quizTopic: '',
      setQuizTopic: (quizTopic) => set({ quizTopic }),
      quizQuestions: [],
      quizResults: [],
      cachedQuestions: [],
      isQuizGenerating: false,
      quizError: null,
      generateQuizAction: async (topic) => {
        set({ isQuizGenerating: true, quizError: null, quizQuestions: [] });
        
        // --- Offline Fallback ---
        if (!get().isOnline) {
          setTimeout(() => {
            const { cachedQuestions } = get();
            if (cachedQuestions.length >= 5) {
               const shuffled = [...cachedQuestions].sort(() => 0.5 - Math.random());
               set({ quizQuestions: shuffled.slice(0, 5), isQuizGenerating: false });
            } else {
               set({ 
                 isQuizGenerating: false, 
                 quizError: "You are offline and we don't have enough cached questions. Connect to the internet to generate new quizzes." 
               });
            }
          }, 1500);
          return;
        }

        try {
          const questions = await generateQuiz(topic);
          set(state => ({ 
            quizQuestions: questions, 
            isQuizGenerating: false,
            cachedQuestions: [...state.cachedQuestions, ...questions.filter(q => !state.cachedQuestions.some(cq => cq.question === q.question))].slice(-50)
          }));
        } catch (error: any) {
          set({ isQuizGenerating: false, quizError: error.message || "Failed to generate quiz." });
        }
      },
      saveQuizResult: (result) => {
        set(state => ({ quizResults: [...state.quizResults, result] }));
        const xp = Math.round((result.score / result.total) * 100); 
        get().addXP(xp, "Quiz Complete");
        get().updateChallengeProgress('quiz', 1);
        get().updateStudyTime(5); 
      },
      clearQuiz: () => set({ quizQuestions: [], quizTopic: '', quizError: null }),

      srsItems: [],
      syncSRSItems: async (user) => {
        if (!user || !db || !get().isDbAvailable || user.uid === 'guest') return;
        try {
           const ref = collection(db, 'users', user.uid, 'srs_items');
           const snap = await getDocs(ref);
           const items: SRSItem[] = [];
           snap.forEach(d => items.push(d.data() as SRSItem));
           set({ srsItems: items });
        } catch (e) { console.warn("SRS Sync failed", e); }
      },
      addQuizToSRS: async (questions, userAnswers, topic) => {
        const { user, isDbAvailable } = get();
        const newItems: SRSItem[] = [];
        const timestamp = Date.now();
        questions.forEach((q, idx) => {
           const isCorrect = userAnswers[idx] === q.correctAnswer;
           const initialInterval = isCorrect ? 3 : 1;
           const newItem: SRSItem = {
              id: `srs_${timestamp}_${idx}`,
              userId: user ? user.uid : 'guest',
              question: q,
              topic,
              easeFactor: 2.5,
              interval: initialInterval,
              repetitions: isCorrect ? 1 : 0,
              createdAt: timestamp,
              lastReviewed: timestamp,
              nextReviewDate: timestamp + (initialInterval * 86400000)
           };
           newItems.push(newItem);
        });
        set(s => ({ srsItems: [...s.srsItems, ...newItems] }));
        if (user && user.uid !== 'guest' && isDbAvailable && db) {
           const batch = writeBatch(db);
           newItems.forEach(item => {
              batch.set(doc(db, 'users', user.uid, 'srs_items', item.id), cleanDataForFirestore(item));
           });
           await batch.commit().catch(e => console.warn("SRS Save failed", e));
        }
      },
      submitReview: async (itemId, rating) => {
         const { srsItems, user, isDbAvailable } = get();
         const idx = srsItems.findIndex(i => i.id === itemId);
         if (idx === -1) return;
         const item = srsItems[idx];
         const { nextInterval, nextRepetitions, nextEF } = calculateNextReview(rating, item.interval, item.repetitions, item.easeFactor);
         const now = Date.now();
         const updated: SRSItem = { ...item, interval: nextInterval, repetitions: nextRepetitions, easeFactor: nextEF, lastReviewed: now, nextReviewDate: now + (nextInterval * 86400000) };
         const list = [...srsItems];
         list[idx] = updated;
         set({ srsItems: list });
         
         get().addXP(10, "Card Reviewed");
         get().updateStudyTime(1);

         if (user && user.uid !== 'guest' && isDbAvailable && db) {
            setDoc(doc(db, 'users', user.uid, 'srs_items', item.id), cleanDataForFirestore(updated)).catch(e => console.warn("SRS Update failed", e));
         }
      },

      currentPlan: null,
      isPlanLoading: false,
      planError: null,
      createPlan: async (topic, duration) => {
         if (!get().isOnline) {
           set({ planError: "Plan generation requires internet connection." });
           return;
         }

         set({ isPlanLoading: true, planError: null });
         try {
            const plan = await generateStudyPlan(topic, duration);
            set({ currentPlan: plan, isPlanLoading: false });
         } catch (e: any) {
            set({ isPlanLoading: false, planError: e.message || "Failed to create plan" });
         }
      },
      resetPlan: () => set({ currentPlan: null, planError: null }),

      // --- STUDY GROUP IMPLEMENTATION ---
      currentGroup: null,
      groupMembers: [],
      groupMessages: [],
      groupLoading: false,
      groupError: null,
      unsubscribeGroup: null,

      createGroup: async (name, description, isPublic) => {
        const { user, isDbAvailable } = get();
        if (!user || !db || !isDbAvailable || user.uid === 'guest') {
           set({ groupError: "Online account required to create groups. Please sign in." });
           return;
        }
        set({ groupLoading: true, groupError: null });
        
        try {
           const code = generateGroupCode();
           const newGroup: StudyGroup = {
              id: '',
              name,
              description,
              code,
              createdBy: user.uid,
              createdAt: Date.now(),
              isPublic,
              activeQuiz: null,
              sharedPlan: null
           };
           
           const docRef = await addDoc(collection(db, 'groups'), cleanDataForFirestore({ ...newGroup, id: 'temp' }));
           await updateDoc(docRef, { id: docRef.id });
           
           const member: GroupMember = {
              uid: user.uid,
              displayName: user.displayName || 'User',
              photoURL: user.photoURL,
              joinedAt: Date.now(),
              lastActive: Date.now(),
              role: 'leader',
              stats: { messagesSent: 0, quizzesTaken: 0 }
           };
           
           await setDoc(doc(db, 'groups', docRef.id, 'members', user.uid), member);
           set({ groupLoading: false, currentGroup: { ...newGroup, id: docRef.id } });
           
           get().joinGroup(code); // Trigger subscription
        } catch (e: any) {
           set({ groupLoading: false, groupError: e.message || "Failed to create group" });
        }
      },

      joinGroup: async (code) => {
         const { user, isDbAvailable, unsubscribeGroup } = get();
         if (!user || !db || !isDbAvailable || user.uid === 'guest') {
             set({ groupError: "Online account required for groups." });
             return;
         }
         
         set({ groupLoading: true, groupError: null });
         if (unsubscribeGroup) unsubscribeGroup();

         try {
             // Find group by code
             const q = query(collection(db, 'groups'), where('code', '==', code));
             const snapshot = await getDocs(q);
             
             if (snapshot.empty) {
                 set({ groupLoading: false, groupError: "Invalid group code." });
                 return;
             }
             
             const groupDoc = snapshot.docs[0];
             const groupId = groupDoc.id;
             const groupData = groupDoc.data() as StudyGroup;
             
             // Add user to members if not present
             const memberRef = doc(db, 'groups', groupId, 'members', user.uid);
             const memberSnap = await getDoc(memberRef);
             
             if (!memberSnap.exists()) {
                 const newMember: GroupMember = {
                     uid: user.uid,
                     displayName: user.displayName || 'User',
                     photoURL: user.photoURL,
                     joinedAt: Date.now(),
                     lastActive: Date.now(),
                     role: 'member',
                     stats: { messagesSent: 0, quizzesTaken: 0 }
                 };
                 await setDoc(memberRef, newMember);
             }

             // Subscribe to Group Data
             const unsubGroup = onSnapshot(doc(db, 'groups', groupId), (doc) => {
                 set({ currentGroup: doc.data() as StudyGroup });
             });

             // Subscribe to Members
             const unsubMembers = onSnapshot(collection(db, 'groups', groupId, 'members'), (snap) => {
                 const members: GroupMember[] = [];
                 snap.forEach(d => members.push(d.data() as GroupMember));
                 set({ groupMembers: members });
             });

             // Subscribe to Messages
             const msgQuery = query(collection(db, 'groups', groupId, 'messages'), orderBy('timestamp', 'asc'));
             const unsubMessages = onSnapshot(msgQuery, (snap) => {
                 const msgs: GroupMessage[] = [];
                 snap.forEach(d => msgs.push(d.data() as GroupMessage));
                 set({ groupMessages: msgs });
             });

             // Cleanup function
             set({ 
                 groupLoading: false, 
                 currentGroup: { ...groupData, id: groupId },
                 unsubscribeGroup: () => {
                     unsubGroup();
                     unsubMembers();
                     unsubMessages();
                 }
             });

         } catch (e: any) {
             set({ groupLoading: false, groupError: e.message || "Failed to join group" });
         }
      },
      
      leaveGroup: async () => {
         const { currentGroup, user, unsubscribeGroup, isDbAvailable } = get();
         if (!currentGroup || !user || !db || !isDbAvailable || user.uid === 'guest') return;
         
         if (unsubscribeGroup) unsubscribeGroup();
         
         try {
             await deleteDoc(doc(db, 'groups', currentGroup.id, 'members', user.uid));
             set({ currentGroup: null, groupMembers: [], groupMessages: [], unsubscribeGroup: null });
         } catch(e) { console.warn("Leave group error", e); }
      },

      sendGroupMessage: async (content) => {
         const { currentGroup, user, isDbAvailable } = get();
         if (!currentGroup || !user || !db || !isDbAvailable || user.uid === 'guest') return;
         
         try {
             const newMsg: GroupMessage = {
                 id: Date.now().toString(),
                 senderId: user.uid,
                 senderName: user.displayName || 'User',
                 senderPhoto: user.photoURL,
                 content,
                 timestamp: Date.now(),
                 type: 'text'
             };
             await addDoc(collection(db, 'groups', currentGroup.id, 'messages'), newMsg);
         } catch(e) { console.warn("Send msg error", e); }
      },

      startGroupQuiz: async (topic) => {
          const { currentGroup, user, isDbAvailable } = get();
          if (!currentGroup || !user || !db || !isDbAvailable || user.uid === 'guest') return;
          
          try {
             const questions = await generateQuiz(topic, 5);
             const quizSession = {
                 isActive: true,
                 topic,
                 questions,
                 currentQuestionIndex: 0,
                 status: 'in-progress',
                 participants: {}
             };
             
             await updateDoc(doc(db, 'groups', currentGroup.id), { activeQuiz: quizSession });
          } catch(e) { console.warn("Start quiz error", e); }
      },

      submitGroupQuizAnswer: async (qIndex, aIndex) => {
          const { currentGroup, user, isDbAvailable } = get();
          if (!currentGroup || !currentGroup.activeQuiz || !user || !db || !isDbAvailable || user.uid === 'guest') return;

          try {
              const quiz = currentGroup.activeQuiz;
              const isCorrect = quiz.questions[qIndex].correctAnswer === aIndex;
              const points = isCorrect ? 100 : 0;
              
              // Firestore update for nested map field is tricky, usually needs dot notation
              // `activeQuiz.participants.${user.uid}`
              const userKey = `activeQuiz.participants.${user.uid}`;
              
              // We need to fetch current participant data first or assume structure
              const currentScore = quiz.participants[user.uid]?.score || 0;
              const currentAnswers = quiz.participants[user.uid]?.answers || [];
              
              const newAnswers = [...currentAnswers];
              newAnswers[qIndex] = aIndex;

              await updateDoc(doc(db, 'groups', currentGroup.id), {
                  [`${userKey}.score`]: currentScore + points,
                  [`${userKey}.answers`]: newAnswers
              });
          } catch(e) { console.warn("Submit answer error", e); }
      },

      nextGroupQuizQuestion: async () => {
          const { currentGroup, isDbAvailable } = get();
          if (!currentGroup?.activeQuiz || !db || !isDbAvailable) return;
          
          const nextIdx = currentGroup.activeQuiz.currentQuestionIndex + 1;
          if (nextIdx < currentGroup.activeQuiz.questions.length) {
              await updateDoc(doc(db, 'groups', currentGroup.id), {
                  'activeQuiz.currentQuestionIndex': nextIdx
              });
          } else {
              await updateDoc(doc(db, 'groups', currentGroup.id), {
                  'activeQuiz.status': 'completed'
              });
          }
      },

      endGroupQuiz: async () => {
          const { currentGroup, isDbAvailable } = get();
          if (!currentGroup || !db || !isDbAvailable) return;
          await updateDoc(doc(db, 'groups', currentGroup.id), { activeQuiz: null });
      },

      // --- LEARNING PATHS ---
      learningPaths: [],
      communityPaths: [],
      activePathId: null,
      isPathGenerating: false,
      pathError: null,

      generatePathAction: async (goal) => {
        set({ isPathGenerating: true, pathError: null });
        try {
          const path = await generateLearningPath(goal);
          const { user, isDbAvailable } = get();
          
          // 1. UPDATE LOCAL STATE IMMEDIATELY (Bypass backend for UI)
          const newPath = { ...path, userId: user ? user.uid : 'guest' };
          const updatedPaths = [...get().learningPaths, newPath];
          set({ learningPaths: updatedPaths, activePathId: newPath.id, isPathGenerating: false });
          
          // 2. Try to sync to Firestore in background (if available)
          if (user && db && isDbAvailable && user.uid !== 'guest') {
             try {
               const pathRef = doc(db, 'paths', newPath.id);
               await setDoc(pathRef, { 
                  id: newPath.id,
                  userId: user.uid,
                  title: newPath.title,
                  description: newPath.description,
                  isPublic: false,
                  createdAt: newPath.createdAt,
                  progress: 0,
                  authorName: user.displayName || 'Anonymous'
               });
               
               // Save nodes as subcollection
               const batch = writeBatch(db);
               newPath.nodes.forEach(node => {
                  const nodeRef = doc(db, 'paths', newPath.id, 'nodes', node.id);
                  batch.set(nodeRef, node);
               });
               await batch.commit();
             } catch (e) {
               console.warn("Firestore sync failed for path, keeping local.", e);
             }
          }

        } catch (e: any) {
          set({ isPathGenerating: false, pathError: e.message || "Failed to generate path" });
        }
      },

      selectPath: (id) => set({ activePathId: id }),
      
      deletePath: (id) => {
        const { learningPaths, user, isDbAvailable } = get();
        set({ learningPaths: learningPaths.filter(p => p.id !== id), activePathId: null });
        if (user && db && isDbAvailable && user.uid !== 'guest') {
           deleteDoc(doc(db, 'paths', id)).catch(console.warn);
        }
      },

      completePathNode: async (pathId, nodeId) => {
        const { learningPaths, user, isDbAvailable } = get();
        const pathIndex = learningPaths.findIndex(p => p.id === pathId);
        if (pathIndex === -1) return;

        const updatedPath = { ...learningPaths[pathIndex] };
        const nodeIndex = updatedPath.nodes.findIndex(n => n.id === nodeId);
        if (nodeIndex === -1) return;

        // Update Node Status Local
        const updatedNode = { ...updatedPath.nodes[nodeIndex], status: 'completed' as const };
        updatedPath.nodes[nodeIndex] = updatedNode;

        // Unlock next nodes Local
        updatedPath.nodes.forEach(n => {
           if (n.prerequisites.includes(nodeId) && n.status === 'locked') {
              // Check if ALL prereqs are done
              const allPrereqsDone = n.prerequisites.every(pid => {
                 const parent = updatedPath.nodes.find(pn => pn.id === pid);
                 return parent?.status === 'completed';
              });
              if (allPrereqsDone) n.status = 'unlocked';
           }
        });

        // Calculate Progress Local
        const completedCount = updatedPath.nodes.filter(n => n.status === 'completed').length;
        updatedPath.progress = Math.round((completedCount / updatedPath.nodes.length) * 100);

        const newPaths = [...learningPaths];
        newPaths[pathIndex] = updatedPath;
        set({ learningPaths: newPaths });
        get().addXP(50, "Topic Mastered");
        get().checkAchievements();

        // Sync Update Background
        if (user && db && isDbAvailable && user.uid !== 'guest') {
           try {
             const batch = writeBatch(db);
             // Update node
             batch.update(doc(db, 'paths', pathId, 'nodes', nodeId), { status: 'completed' });
             // Update unlocked nodes
             updatedPath.nodes.forEach(n => {
                if (n.status === 'unlocked') {
                   batch.update(doc(db, 'paths', pathId, 'nodes', n.id), { status: 'unlocked' });
                }
             });
             // Update path progress
             batch.update(doc(db, 'paths', pathId), { progress: updatedPath.progress });
             await batch.commit();
           } catch(e) { console.warn("Sync completion failed", e); }
        }
      },

      updatePathNodePosition: (pathId, nodeId, x, y) => {
         const { learningPaths } = get();
         const pathIdx = learningPaths.findIndex(p => p.id === pathId);
         if (pathIdx === -1) return;
         
         const newPaths = [...learningPaths];
         const nodeIdx = newPaths[pathIdx].nodes.findIndex(n => n.id === nodeId);
         if (nodeIdx !== -1) {
            newPaths[pathIdx].nodes[nodeIdx] = { ...newPaths[pathIdx].nodes[nodeIdx], x, y };
            set({ learningPaths: newPaths });
         }
      },

      syncPaths: async (user) => {
         if (!user || !db || !get().isDbAvailable || user.uid === 'guest') return;
         try {
            // Query root paths collection by userId
            const q = query(collection(db, 'paths'), where('userId', '==', user.uid));
            const snapshot = await getDocs(q);
            
            const paths: LearningPath[] = [];
            
            // For each path, fetch its nodes subcollection
            for (const docSnap of snapshot.docs) {
               const pathData = docSnap.data();
               const nodesSnap = await getDocs(collection(db, 'paths', docSnap.id, 'nodes'));
               const nodes = nodesSnap.docs.map(d => d.data() as PathNode);
               
               paths.push({
                  ...pathData,
                  id: docSnap.id,
                  nodes
               } as LearningPath);
            }
            
            set({ learningPaths: paths });
         } catch (e) { console.warn("Path Sync Error", e); }
      },

      fetchCommunityPaths: async () => {
         if (!db || !get().isDbAvailable) return;
         try {
            const q = query(collection(db, 'paths'), where('isPublic', '==', true));
            const snapshot = await getDocs(q);
            
            const paths: LearningPath[] = [];
            for (const docSnap of snapshot.docs) {
               const pathData = docSnap.data();
               const nodesSnap = await getDocs(collection(db, 'paths', docSnap.id, 'nodes'));
               const nodes = nodesSnap.docs.map(d => d.data() as PathNode);
               
               paths.push({ ...pathData, id: docSnap.id, nodes } as LearningPath);
            }
            set({ communityPaths: paths });
         } catch (e) { console.warn("Community Fetch Error", e); }
      },

      publishPath: async (pathId) => {
         const { user, isDbAvailable } = get();
         if (!user || !db || !isDbAvailable || user.uid === 'guest') return;
         
         try {
            await updateDoc(doc(db, 'paths', pathId), { isPublic: true });
            get().addXP(200, "Contributor Badge");
         } catch (e) { console.warn("Publish Error", e); }
      },

      clonePath: async (path) => {
         const { user, learningPaths, isDbAvailable } = get();
         const newId = `clone_${Date.now()}`;
         
         const newPath: LearningPath = {
            ...path,
            id: newId,
            userId: user ? user.uid : 'guest',
            title: `${path.title} (Copy)`,
            progress: 0,
            isPublic: false,
            forkedFrom: path.id,
            nodes: path.nodes.map(n => ({ ...n, status: n.prerequisites.length === 0 ? 'unlocked' : 'locked' }))
         };

         set({ learningPaths: [...learningPaths, newPath], activePathId: newId });

         if (user && db && isDbAvailable && user.uid !== 'guest') {
             const pathRef = doc(db, 'paths', newId);
             await setDoc(pathRef, { 
                ...newPath,
                nodes: [] // Nodes saved separately
             });
             
             const batch = writeBatch(db);
             newPath.nodes.forEach(node => {
                const nodeRef = doc(db, 'paths', newId, 'nodes', node.id);
                batch.set(nodeRef, node);
             });
             await batch.commit();
         }
      },

      certificates: [],
      issueCertificate: (topic) => set(s => ({ 
        certificates: [...s.certificates, { id: Date.now().toString(), title: "Certificate of Mastery", topic, date: getTodayDateString(), userName: s.user?.displayName || 'Learner' }] 
      })),

      portfolio: { bio: '', isPublic: false, showStreaks: true, showCertificates: true },
      updatePortfolio: (updates) => set(s => ({ portfolio: { ...s.portfolio, ...updates } })),
      syncPortfolio: async (user) => { /* ... implementation ... */ }
    }),
    {
      name: 'learnmate-storage',
      partialize: (state) => ({ 
        settings: state.settings,
        streak: state.streak,
        gamification: state.gamification,
        sessions: state.sessions, 
        currentSessionId: state.currentSessionId,
        learningPaths: state.learningPaths,
        certificates: state.certificates,
        portfolio: state.portfolio
      })
    }
  )
);
