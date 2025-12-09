
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
  GroupQuizSession,
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
  addDoc, query, where, onSnapshot, updateDoc, arrayUnion, serverTimestamp 
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
  cachedQuestions: QuizQuestion[]; // For offline mode
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
  activePathId: string | null;
  isPathGenerating: boolean;
  pathError: string | null;
  
  generatePathAction: (goal: string) => Promise<void>;
  selectPath: (id: string) => void;
  deletePath: (id: string) => void;
  completePathNode: (pathId: string, nodeId: string) => Promise<void>;
  updatePathNodePosition: (pathId: string, nodeId: string, x: number, y: number) => void;
  syncPaths: (user: UserProfile) => Promise<void>;

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

// Robust function to clean data for Firestore/Storage and remove circular references
const cleanDataForFirestore = (data: any): any => {
  const seen = new WeakSet();
  const safeJson = JSON.stringify(data, (key, value) => {
    if (typeof value === 'object' && value !== null) {
      if (seen.has(value)) {
        return; // Remove circular reference
      }
      seen.add(value);
    }
    return value;
  });
  return JSON.parse(safeJson);
};

const saveSessionToDb = async (uid: string, session: ChatSession) => {
  if (!db) return;
  try {
    const cleanSession = cleanDataForFirestore(session);
    await setDoc(doc(db, 'users', uid, 'sessions', session.id), cleanSession);
  } catch (e) {
    console.warn("Failed to save session to cloud:", e);
  }
};

const deleteSessionFromDb = async (uid: string, sessionId: string) => {
  if (!db) return;
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

// --- Date Helpers ---
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

      // ... (Previous State Init) ...
      user: null,
      isAuthModalOpen: false,
      cloudError: null,
      setUser: (user) => set({ user }),
      openAuthModal: () => set({ isAuthModalOpen: true }),
      closeAuthModal: () => set({ isAuthModalOpen: false }),

      // --- Settings & Consistency Defaults ---
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
        timeLeft: 25 * 60, // 25 mins
        cyclesCompleted: 0
      },

      // --- GAMIFICATION DEFAULTS ---
      gamification: {
        xp: 0,
        level: 1,
        rank: 'Novice',
        achievements: INITIAL_ACHIEVEMENTS,
        activeChallenges: generateDailyChallenges(),
        showLevelUp: false
      },

      addXP: async (amount: number, reason?: string) => {
        const { gamification, user, cloudError } = get();
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

        // Check level-based achievements? (handled in checkAchievements)
        get().checkAchievements();

        if (user && !cloudError && db) {
           try {
              await setDoc(doc(db, 'users', user.uid, 'settings', 'gamification'), cleanDataForFirestore(newState));
           } catch (e) { console.warn("XP Sync Error", e); }
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
            // Grant XP for achievement
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
            // Check expiry
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
         if (!user || !db) return;
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
        const { user, cloudError } = get();
        if (user && !cloudError && db) {
           try {
             await setDoc(doc(db, 'users', user.uid, 'settings', 'preferences'), updated);
           } catch (e) { console.warn("Failed to save settings", e); }
        }
      },

      updateStudyTime: async (minutes) => {
         const today = getTodayDateString();
         const { streak, user, cloudError } = get();
         
         const currentHistory = { ...streak.activityHistory };
         currentHistory[today] = (currentHistory[today] || 0) + minutes;
         
         // Gamification Hook: Challenge Progress
         get().updateChallengeProgress('chat', minutes);

         const updatedStreakData = {
            ...streak,
            activityHistory: currentHistory
         };
         
         set({ streak: updatedStreakData });
         get().checkStreak(); // Recalculate streak based on new activity
         
         if (user && !cloudError && db) {
            try {
               await setDoc(doc(db, 'users', user.uid, 'settings', 'streak'), cleanDataForFirestore(updatedStreakData));
            } catch (e) { console.warn("Failed to save streak", e); }
         }
      },

      checkStreak: async () => {
        const { streak, user, cloudError } = get();
        const today = getTodayDateString();
        const lastDate = streak.lastStudyDate;
        
        // If already studied today, just ensure date matches
        if (lastDate === today) return;

        let newCurrentStreak = streak.currentStreak;
        let newMaxStreak = streak.maxStreak;
        
        if (lastDate) {
          const last = new Date(lastDate);
          const now = new Date(today);
          const diffTime = Math.abs(now.getTime() - last.getTime());
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
          
          if (diffDays === 1) {
            // Consecutive day
            newCurrentStreak += 1;
            get().addXP(25, "Streak Bonus"); // XP Reward
          } else if (diffDays > 1) {
            // Streak broken
            newCurrentStreak = 1; // Reset to 1 for today
          }
        } else {
          // First time ever
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
        get().checkAchievements(); // Check streak achievements
        
        if (user && !cloudError && db) {
           try {
              await setDoc(doc(db, 'users', user.uid, 'settings', 'streak'), cleanDataForFirestore(updatedStreak));
           } catch (e) { console.warn("Streak sync error", e); }
        }
      },
      
      // Pomodoro Actions
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
        if (!user || !db) return;
        try {
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

          // Sync Settings & Streak
          try {
             const settingsSnap = await getDoc(doc(db, 'users', user.uid, 'settings', 'preferences'));
             if (settingsSnap.exists()) set({ settings: settingsSnap.data() as UserSettings });
             
             const streakSnap = await getDoc(doc(db, 'users', user.uid, 'settings', 'streak'));
             if (streakSnap.exists()) set({ streak: streakSnap.data() as StreakData });
             
             // Check streak on login
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
          console.error("Sync failed:", e);
          let errorMessage = "Could not sync with the cloud.";
          if (e.code === 'permission-denied') errorMessage = "Cloud Firestore API not enabled or permissions denied.";
          if (e.code === 'not-found') errorMessage = "Database not found. Please create '(default)' database in Firebase.";
          if (!window.navigator.onLine) errorMessage = "You are currently offline. Changes will sync when online.";
          set({ cloudError: errorMessage });
        }
      },

      retrySync: async () => {
        const { user, syncUserSessions } = get();
        if (user) await syncUserSessions(user);
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
        const { sessions, currentSessionId, user, cloudError } = get();
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
        if (user && !cloudError) deleteSessionFromDb(user.uid, sessionId);
      },

      messages: [],
      isChatLoading: false,
      chatError: null,
      sendMessage: async (content, file, mimeType) => {
        // Prevent sending if offline (unless we implement local AI, which we don't have)
        if (!get().isOnline) {
          set({ chatError: "You are offline. Please check your internet connection to chat with AI." });
          return;
        }

        let { sessions, currentSessionId, difficulty, style, persona, user } = get();
        if (!currentSessionId) {
          get().createSession();
          currentSessionId = get().currentSessionId;
          sessions = get().sessions;
        }
        if (!currentSessionId) return;

        // Gamification Hook: Message XP
        get().addXP(5, "Message Sent");
        get().updateChallengeProgress('chat', 1); // rough approx (not precise mins here but count)

        const newUserMsg: Message = {
          id: Date.now().toString(),
          role: 'user',
          content: content || (file ? `Attached file: ${file.name || 'media'}` : ''),
          timestamp: Date.now(),
        };

        // Track "Study Time" roughly - 1 message = 1 minute of engagement
        get().updateStudyTime(1);

        let mediaPart = undefined;
        
        if (file) {
          try {
            const base64 = await fileToBase64(file);
            const type = mimeType || file.type;
            
            newUserMsg.attachmentData = { mimeType: type, data: base64 };
            
            // Set display properties based on type
            if (type.startsWith('image/')) {
              newUserMsg.type = 'image';
              newUserMsg.imageUrl = URL.createObjectURL(file);
            } else if (type.startsWith('audio/')) {
              newUserMsg.type = 'audio';
              newUserMsg.audioUrl = URL.createObjectURL(file);
            } else if (type === 'application/pdf') {
              newUserMsg.type = 'file';
              newUserMsg.fileUrl = URL.createObjectURL(file);
              newUserMsg.fileName = (file as File).name;
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
        if (user && !get().cloudError) saveSessionToDb(user.uid, currentSession);

        if (isFirstMessage && content) {
           generateChatTitle(content).then(title => {
              set(s => {
                 const list = [...s.sessions];
                 const idx = list.findIndex(i => i.id === currentSessionId);
                 if (idx !== -1) {
                    list[idx] = { ...list[idx], title };
                    if (user && !s.cloudError) saveSessionToDb(user.uid, list[idx]);
                    return { sessions: list };
                 }
                 return {};
              });
           });
        }

        try {
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
                if (user && !state.cloudError) saveSessionToDb(user.uid, sess);
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

        const { currentSessionId, sessions, user, cloudError } = get();
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

           if (user && !cloudError) {
              saveSessionToDb(user.uid, currentSession);
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
          // Simulate generation using cached questions
          setTimeout(() => {
            const { cachedQuestions } = get();
            if (cachedQuestions.length >= 5) {
               // Get 5 random questions
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

        // --- Online Generation ---
        try {
          const questions = await generateQuiz(topic);
          set(state => ({ 
            quizQuestions: questions, 
            isQuizGenerating: false,
            // Cache these questions for offline use (avoid duplicates)
            cachedQuestions: [...state.cachedQuestions, ...questions.filter(q => !state.cachedQuestions.some(cq => cq.question === q.question))].slice(-50) // Keep last 50
          }));
        } catch (error: any) {
          set({ isQuizGenerating: false, quizError: error.message || "Failed to generate quiz." });
        }
      },
      saveQuizResult: (result) => {
        set(state => ({ quizResults: [...state.quizResults, result] }));
        
        // Gamification Hook: Quiz XP
        const xp = Math.round((result.score / result.total) * 100); // Max 100 XP per quiz
        get().addXP(xp, "Quiz Complete");
        get().updateChallengeProgress('quiz', 1);
        get().updateStudyTime(5); // 5 mins avg per quiz
      },
      clearQuiz: () => set({ quizQuestions: [], quizTopic: '', quizError: null }),

      srsItems: [],
      syncSRSItems: async (user) => {
        if (!user || !db) return;
        try {
           const ref = collection(db, 'users', user.uid, 'srs_items');
           const snap = await getDocs(ref);
           const items: SRSItem[] = [];
           snap.forEach(d => items.push(d.data() as SRSItem));
           set({ srsItems: items });
        } catch (e) { console.warn("SRS Sync failed", e); }
      },
      addQuizToSRS: async (questions, userAnswers, topic) => {
        const { user, cloudError } = get();
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
        if (user && !cloudError && db) {
           const batch = writeBatch(db);
           newItems.forEach(item => {
              batch.set(doc(db, 'users', user.uid, 'srs_items', item.id), cleanDataForFirestore(item));
           });
           await batch.commit().catch(e => console.warn("SRS Save failed", e));
        }
      },
      submitReview: async (itemId, rating) => {
         const { srsItems, user, cloudError } = get();
         const idx = srsItems.findIndex(i => i.id === itemId);
         if (idx === -1) return;
         const item = srsItems[idx];
         const { nextInterval, nextRepetitions, nextEF } = calculateNextReview(rating, item.interval, item.repetitions, item.easeFactor);
         const now = Date.now();
         const updated: SRSItem = { ...item, interval: nextInterval, repetitions: nextRepetitions, easeFactor: nextEF, lastReviewed: now, nextReviewDate: now + (nextInterval * 86400000) };
         const list = [...srsItems];
         list[idx] = updated;
         set({ srsItems: list });
         
         // Gamification Hook: Review XP
         get().addXP(10, "Card Reviewed");
         // Assume 1 min study time for review
         get().updateStudyTime(1);

         if (user && !cloudError && db) {
            setDoc(doc(db, 'users', user.uid, 'srs_items', item.id), cleanDataForFirestore(updated)).catch(e => console.warn("SRS Update failed", e));
         }
      },

      currentPlan: null,
      isPlanLoading: false,
      planError: null,
      createPlan: async (topic, duration) => {
         // Offline check
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
        // ... (Same as before)
        const { user } = get();
        if (!user || !db) return;
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
              displayName: user.displayName || 'Leader',
              photoURL: user.photoURL,
              joinedAt: Date.now(),
              lastActive: Date.now(),
              role: 'leader',
              stats: { messagesSent: 0, quizzesTaken: 0 }
           };
           await setDoc(doc(db, 'groups', docRef.id, 'members', user.uid), member);
           
           set({ groupLoading: false });
           get().joinGroup(code); 
        } catch (e: any) {
           set({ groupLoading: false, groupError: e.message });
        }
      },

      joinGroup: async (code) => {
        // ... (Same as before)
        const { user, unsubscribeGroup } = get();
        if (!user || !db) return;
        set({ groupLoading: true, groupError: null });

        if (unsubscribeGroup) unsubscribeGroup();

        try {
           const q = query(collection(db, 'groups'), where('code', '==', code));
           const snapshot = await getDocs(q);
           
           if (snapshot.empty) {
              set({ groupLoading: false, groupError: "Invalid group code." });
              return;
           }

           const groupDoc = snapshot.docs[0];
           const groupId = groupDoc.id;
           const groupData = groupDoc.data() as StudyGroup;

           const memberRef = doc(db, 'groups', groupId, 'members', user.uid);
           const memberSnap = await getDoc(memberRef);
           
           if (!memberSnap.exists()) {
             const newMember: GroupMember = {
               uid: user.uid,
               displayName: user.displayName || 'Member',
               photoURL: user.photoURL,
               joinedAt: Date.now(),
               lastActive: Date.now(),
               role: 'member',
               stats: { messagesSent: 0, quizzesTaken: 0 }
             };
             await setDoc(memberRef, newMember);
           } else {
             await updateDoc(memberRef, { lastActive: Date.now() });
           }

           const unsubGroup = onSnapshot(doc(db, 'groups', groupId), (doc) => {
              if (doc.exists()) {
                 set({ currentGroup: doc.data() as StudyGroup });
              } else {
                 get().leaveGroup();
              }
           });

           const unsubMembers = onSnapshot(collection(db, 'groups', groupId, 'members'), (snap) => {
              const members: GroupMember[] = [];
              snap.forEach(d => members.push(d.data() as GroupMember));
              set({ groupMembers: members });
           });

           const unsubMessages = onSnapshot(collection(db, 'groups', groupId, 'messages'), (snap) => {
              const msgs: GroupMessage[] = [];
              snap.forEach(d => msgs.push(d.data() as GroupMessage));
              msgs.sort((a, b) => a.timestamp - b.timestamp);
              set({ groupMessages: msgs });
           });

           set({
              currentGroup: groupData,
              groupLoading: false,
              unsubscribeGroup: () => {
                 unsubGroup();
                 unsubMembers();
                 unsubMessages();
              }
           });

        } catch (e: any) {
           set({ groupLoading: false, groupError: e.message });
        }
      },

      leaveGroup: async () => {
         const { unsubscribeGroup } = get();
         if (unsubscribeGroup) unsubscribeGroup();
         set({ currentGroup: null, groupMembers: [], groupMessages: [], unsubscribeGroup: null });
      },

      sendGroupMessage: async (content) => {
         const { currentGroup, user } = get();
         if (!currentGroup || !user || !db) return;
         
         const msg: GroupMessage = {
            id: Date.now().toString(),
            senderId: user.uid,
            senderName: user.displayName || 'User',
            senderPhoto: user.photoURL,
            content,
            timestamp: Date.now(),
            type: 'text'
         };

         try {
            await addDoc(collection(db, 'groups', currentGroup.id, 'messages'), msg);
         } catch (e) {
            console.error("Failed to send group message", e);
         }
      },

      startGroupQuiz: async (topic) => {
         const { currentGroup } = get();
         if (!currentGroup || !db) return;

         try {
            const questions = await generateQuiz(topic, 5);
            
            const newQuizSession: GroupQuizSession = {
               isActive: true,
               topic,
               questions,
               currentQuestionIndex: 0,
               status: 'waiting',
               participants: {}
            };

            await updateDoc(doc(db, 'groups', currentGroup.id), {
               activeQuiz: cleanDataForFirestore(newQuizSession)
            });
         } catch (e) {
            console.error("Failed to start group quiz", e);
         }
      },

      submitGroupQuizAnswer: async (qIndex, aIndex) => {
         const { currentGroup, user } = get();
         if (!currentGroup || !currentGroup.activeQuiz || !user || !db) return;

         const quizRef = doc(db, 'groups', currentGroup.id);
         const currentQuiz = { ...currentGroup.activeQuiz };
         if (!currentQuiz.participants[user.uid]) {
            currentQuiz.participants[user.uid] = { score: 0, answers: [] };
         }
         
         const pData = currentQuiz.participants[user.uid];
         if (pData.answers.length <= qIndex) {
            pData.answers.push(aIndex);
            if (currentQuiz.questions[qIndex].correctAnswer === aIndex) {
               pData.score += 1;
            }
         }

         await updateDoc(quizRef, { activeQuiz: cleanDataForFirestore(currentQuiz) });
      },

      nextGroupQuizQuestion: async () => {
         const { currentGroup } = get();
         if (!currentGroup || !currentGroup.activeQuiz || !db) return;
         
         const nextIdx = currentGroup.activeQuiz.currentQuestionIndex + 1;
         const isFinished = nextIdx >= currentGroup.activeQuiz.questions.length;
         
         await updateDoc(doc(db, 'groups', currentGroup.id), {
            'activeQuiz.currentQuestionIndex': nextIdx,
            'activeQuiz.status': isFinished ? 'completed' : 'in-progress'
         });
      },

      endGroupQuiz: async () => {
         const { currentGroup } = get();
         if (!currentGroup || !db) return;
         await updateDoc(doc(db, 'groups', currentGroup.id), { activeQuiz: null });
      },

      // --- LEARNING PATHS ---
      learningPaths: [],
      activePathId: null,
      isPathGenerating: false,
      pathError: null,

      generatePathAction: async (goal) => {
        // Offline check
        if (!get().isOnline) {
          set({ pathError: "Generating learning paths requires an internet connection." });
          return;
        }

        set({ isPathGenerating: true, pathError: null });
        try {
          const newPath = await generateLearningPath(goal);
          const { user, cloudError } = get();
          if (user) newPath.userId = user.uid;

          set(state => ({ 
            learningPaths: [newPath, ...state.learningPaths],
            activePathId: newPath.id,
            isPathGenerating: false
          }));

          if (user && !cloudError && db) {
            await setDoc(doc(db, 'users', user.uid, 'paths', newPath.id), cleanDataForFirestore(newPath));
          }
        } catch (e: any) {
          set({ isPathGenerating: false, pathError: e.message || "Failed to generate learning path." });
        }
      },

      selectPath: (id) => set({ activePathId: id }),
      
      deletePath: (id) => {
        const { learningPaths, activePathId, user, cloudError } = get();
        const updated = learningPaths.filter(p => p.id !== id);
        set({ learningPaths: updated, activePathId: activePathId === id ? null : activePathId });
        
        if (user && !cloudError && db) {
           deleteDoc(doc(db, 'users', user.uid, 'paths', id));
        }
      },

      completePathNode: async (pathId, nodeId) => {
        const { learningPaths, user, cloudError } = get();
        const pathIndex = learningPaths.findIndex(p => p.id === pathId);
        if (pathIndex === -1) return;

        const path = { ...learningPaths[pathIndex] };
        const nodeIndex = path.nodes.findIndex(n => n.id === nodeId);
        if (nodeIndex === -1) return;

        const updatedNodes = [...path.nodes];
        updatedNodes[nodeIndex] = { ...updatedNodes[nodeIndex], status: 'completed' };

        updatedNodes.forEach((node, idx) => {
          if (node.status === 'locked' && node.prerequisites.includes(nodeId)) {
            const allPrereqsDone = node.prerequisites.every(pid => {
               const pNode = updatedNodes.find(n => n.id === pid);
               return pNode && pNode.status === 'completed';
            });
            if (allPrereqsDone) {
               updatedNodes[idx] = { ...node, status: 'unlocked' };
            }
          }
        });

        const completedCount = updatedNodes.filter(n => n.status === 'completed').length;
        path.progress = Math.round((completedCount / updatedNodes.length) * 100);
        path.nodes = updatedNodes;

        const newPaths = [...learningPaths];
        newPaths[pathIndex] = path;
        set({ learningPaths: newPaths });
        
        // Approx study time for completing a node
        get().updateStudyTime(15);
        // Gamification: Path Node Bonus
        get().addXP(50, "Node Completed");

        if (user && !cloudError && db) {
          await setDoc(doc(db, 'users', user.uid, 'paths', pathId), cleanDataForFirestore(path));
        }
      },

      updatePathNodePosition: async (pathId, nodeId, x, y) => {
         const { learningPaths, user, cloudError } = get();
         const pathIndex = learningPaths.findIndex(p => p.id === pathId);
         if (pathIndex === -1) return;

         const path = { ...learningPaths[pathIndex] };
         const nodeIndex = path.nodes.findIndex(n => n.id === nodeId);
         if (nodeIndex === -1) return;
         
         path.nodes[nodeIndex] = { ...path.nodes[nodeIndex], x, y };
         const newPaths = [...learningPaths];
         newPaths[pathIndex] = path;
         
         set({ learningPaths: newPaths });
         
         if (user && !cloudError && db) {
            await setDoc(doc(db, 'users', user.uid, 'paths', pathId), cleanDataForFirestore(path));
         }
      },

      syncPaths: async (user) => {
         if (!user || !db) return;
         try {
            const ref = collection(db, 'users', user.uid, 'paths');
            const snap = await getDocs(ref);
            const paths: LearningPath[] = [];
            snap.forEach(d => paths.push(d.data() as LearningPath));
            set({ learningPaths: paths });
         } catch (e) { console.warn("Paths Sync failed", e); }
      },

      // --- PORTFOLIO & CERTIFICATES ---
      certificates: [],
      portfolio: {
        bio: '',
        isPublic: false,
        showStreaks: true,
        showCertificates: true
      },

      issueCertificate: async (topic) => {
         const { user, cloudError, certificates } = get();
         const newCert: Certificate = {
            id: `CERT-${Date.now()}`,
            title: `Certificate of Mastery`,
            topic,
            date: new Date().toLocaleDateString(),
            userName: user?.displayName || 'Learner'
         };
         
         const updated = [...certificates, newCert];
         set({ certificates: updated });
         
         // Gamification: Certificate Bonus
         get().addXP(500, "Certificate Earned");
         
         if (user && !cloudError && db) {
            try {
               await setDoc(doc(db, 'users', user.uid, 'certificates', newCert.id), newCert);
            } catch (e) { console.warn("Cert Save Error", e); }
         }
      },

      updatePortfolio: async (updates) => {
        const { user, cloudError, portfolio } = get();
        const updated = { ...portfolio, ...updates };
        set({ portfolio: updated });
        if (user && !cloudError && db) {
           await setDoc(doc(db, 'users', user.uid, 'settings', 'portfolio'), updated);
        }
      },

      syncPortfolio: async (user) => {
         if (!user || !db) return;
         try {
            // Portfolio Settings
            const pDoc = await getDoc(doc(db, 'users', user.uid, 'settings', 'portfolio'));
            if (pDoc.exists()) set({ portfolio: pDoc.data() as PortfolioProfile });
            
            // Certificates
            const cSnap = await getDocs(collection(db, 'users', user.uid, 'certificates'));
            const certs: Certificate[] = [];
            cSnap.forEach(d => certs.push(d.data() as Certificate));
            set({ certificates: certs });
         } catch (e) { console.warn("Portfolio sync error", e); }
      }

    }),
    {
      name: 'learnmate-storage',
      partialize: (state) => cleanDataForFirestore({
        sessions: state.sessions,
        currentSessionId: state.currentSessionId,
        quizResults: state.quizResults,
        cachedQuestions: state.cachedQuestions, // Persist cached questions
        difficulty: state.difficulty,
        style: state.style,
        persona: state.persona,
        user: state.user,
        srsItems: state.srsItems,
        learningPaths: state.learningPaths,
        settings: state.settings,
        streak: state.streak,
        pomodoro: state.pomodoro,
        certificates: state.certificates,
        portfolio: state.portfolio,
        gamification: state.gamification
      }),
    }
  )
);
