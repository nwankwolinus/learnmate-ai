import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { 
  Message, 
  ChatSession,
  DifficultyLevel, 
  ExplanationStyle, 
  QuizQuestion, 
  QuizResult, 
  StudyPlan,
  UserProfile
} from '../types';
import { 
  chatWithLearnMate, 
  generateQuiz, 
  generateStudyPlan,
  generateVisualAid,
  generateChatTitle
} from '../services/geminiService';
import { db } from '../services/firebase';
import { doc, setDoc, getDoc, collection, getDocs, writeBatch, deleteDoc } from 'firebase/firestore';

interface AppState {
  // --- Auth ---
  user: UserProfile | null;
  isAuthModalOpen: boolean;
  cloudError: string | null;
  setUser: (user: UserProfile | null) => void;
  openAuthModal: () => void;
  closeAuthModal: () => void;
  syncUserSessions: (user: UserProfile | null) => Promise<void>;
  retrySync: () => Promise<void>;

  // --- Settings ---
  difficulty: DifficultyLevel;
  style: ExplanationStyle;
  setDifficulty: (level: DifficultyLevel) => void;
  setStyle: (style: ExplanationStyle) => void;

  // --- Chat Sessions ---
  sessions: ChatSession[];
  currentSessionId: string | null;
  createSession: () => void;
  selectSession: (sessionId: string) => void;
  deleteSession: (sessionId: string) => void;
  
  // --- Chat ---
  // messages is a computed view of the current session
  messages: Message[]; 
  isChatLoading: boolean;
  chatError: string | null;
  sendMessage: (content: string, imageFile?: File) => Promise<void>;
  generateVisualForMessage: (prompt: string) => Promise<void>;
  clearChatError: () => void;

  // --- Quiz ---
  quizTopic: string;
  setQuizTopic: (topic: string) => void;
  quizQuestions: QuizQuestion[];
  quizResults: QuizResult[];
  isQuizGenerating: boolean;
  quizError: string | null;
  generateQuizAction: (topic: string) => Promise<void>;
  saveQuizResult: (result: QuizResult) => void;
  clearQuiz: () => void;

  // --- Plan ---
  currentPlan: StudyPlan | null;
  isPlanLoading: boolean;
  planError: string | null;
  createPlan: (topic: string, duration: string) => Promise<void>;
  resetPlan: () => void;
}

const fileToBase64 = (file: File): Promise<string> => {
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

// Firestore does not support 'undefined' values.
// This helper strips undefined keys from objects by serializing/deserializing.
const cleanDataForFirestore = (data: any): any => {
  return JSON.parse(JSON.stringify(data));
};

const saveSessionToDb = async (uid: string, session: ChatSession) => {
  if (!db) return;
  try {
    const cleanSession = cleanDataForFirestore(session);
    await setDoc(doc(db, 'users', uid, 'sessions', session.id), cleanSession);
  } catch (e) {
    // We suppress individual save errors to avoid spamming the console if the API is down,
    // as the main sync error will be caught and displayed by syncUserSessions.
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

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      // Auth
      user: null,
      isAuthModalOpen: false,
      cloudError: null,
      setUser: (user) => set({ user }),
      openAuthModal: () => set({ isAuthModalOpen: true }),
      closeAuthModal: () => set({ isAuthModalOpen: false }),

      syncUserSessions: async (user) => {
        set({ cloudError: null }); // Clear previous errors to show we are trying
        
        if (!user || !db) {
          return;
        }

        try {
          const sessionsRef = collection(db, 'users', user.uid, 'sessions');
          const snapshot = await getDocs(sessionsRef);
          
          const cloudSessions: ChatSession[] = [];
          snapshot.forEach(doc => {
            cloudSessions.push(doc.data() as ChatSession);
          });

          // Merge: If we have local sessions (guest mode) that are NOT in cloud, upload them.
          const { sessions: localSessions } = get();
          
          const batch = writeBatch(db);
          let hasUpdates = false;

          const mergedSessions = [...cloudSessions];

          for (const local of localSessions) {
            const exists = cloudSessions.find(c => c.id === local.id);
            if (!exists) {
              // It's a new guest session, upload it
              const ref = doc(db, 'users', user.uid, 'sessions', local.id);
              // Clean data before adding to batch to prevent 'undefined' errors
              batch.set(ref, cleanDataForFirestore(local));
              mergedSessions.push(local);
              hasUpdates = true;
            }
          }

          if (hasUpdates) {
            await batch.commit();
          }

          // Sort by creation time desc
          mergedSessions.sort((a, b) => b.createdAt - a.createdAt);

          set({ sessions: mergedSessions, cloudError: null });
          
          // Restore messages if current session is selected
          const { currentSessionId } = get();
          if (currentSessionId) {
             const found = mergedSessions.find(s => s.id === currentSessionId);
             if (found) {
               set({ messages: found.messages });
             } else if (mergedSessions.length > 0) {
               set({ currentSessionId: mergedSessions[0].id, messages: mergedSessions[0].messages });
             }
          } else if (mergedSessions.length > 0) {
             set({ currentSessionId: mergedSessions[0].id, messages: mergedSessions[0].messages });
          }

        } catch (e: any) {
          console.error("Sync failed:", e);
          let errorMessage = "Could not sync with the cloud. Working in offline mode.";
          
          const code = e.code || '';
          const msg = e.message || '';

          if (code === 'permission-denied') {
             if (msg.includes('Cloud Firestore API')) {
                errorMessage = "The Cloud Firestore API is not enabled. Please enable it in Google Cloud Console.";
             } else {
                errorMessage = "Access denied. Please check your Firestore Security Rules in Firebase Console (set to 'allow read, write').";
             }
          } else if (code === 'not-found' || msg.includes('not-found') || msg.includes('database')) {
             // Specific instruction for the common "default database" missing error
             errorMessage = "Database not found. Please create a Firestore database (named '(default)') in your Firebase Console.";
          } else if (code === 'unavailable') {
             errorMessage = "Network Error: Firestore is unreachable. You are offline.";
          }
          
          set({ cloudError: errorMessage });
        }
      },

      retrySync: async () => {
        const { user, syncUserSessions } = get();
        if (user) {
          await syncUserSessions(user);
        }
      },

      // Settings
      difficulty: DifficultyLevel.Beginner,
      style: ExplanationStyle.Standard,
      setDifficulty: (difficulty) => set({ difficulty }),
      setStyle: (style) => set({ style }),

      // Chat Sessions
      sessions: [],
      currentSessionId: null,
      
      createSession: () => {
        const newSession: ChatSession = {
          id: Date.now().toString(),
          title: 'New Chat',
          messages: [],
          createdAt: Date.now()
        };
        
        set((state) => {
          const updatedSessions = [newSession, ...state.sessions];
          return { 
            sessions: updatedSessions, 
            currentSessionId: newSession.id,
            messages: [] 
          };
        });
      },

      selectSession: (sessionId) => {
        const session = get().sessions.find(s => s.id === sessionId);
        if (session) {
          set({ 
            currentSessionId: sessionId, 
            messages: session.messages 
          });
        }
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
        
        set({ 
          sessions: updatedSessions, 
          currentSessionId: newCurrentId, 
          messages: newMessages 
        });

        // Only delete from DB if logged in AND no cloud error
        if (user && !cloudError) {
          deleteSessionFromDb(user.uid, sessionId);
        }
      },

      // Chat
      messages: [],
      isChatLoading: false,
      chatError: null,
      sendMessage: async (content, imageFile) => {
        let { sessions, currentSessionId, difficulty, style, user } = get();
        
        // Ensure a session exists
        if (!currentSessionId) {
          get().createSession();
          currentSessionId = get().currentSessionId;
          sessions = get().sessions;
        }

        if (!currentSessionId) return;

        // Create User Message
        const userMsgId = Date.now().toString();
        
        // Build message object carefully to avoid 'undefined'
        const newUserMsg: Message = {
          id: userMsgId,
          role: 'user',
          content,
          timestamp: Date.now(),
        };

        if (imageFile) {
          newUserMsg.imageUrl = URL.createObjectURL(imageFile);
        }

        let imagePart = undefined;
        if (imageFile) {
          try {
            const base64 = await fileToBase64(imageFile);
            newUserMsg.imageData = {
              mimeType: imageFile.type,
              data: base64
            };
            imagePart = { inlineData: { data: base64, mimeType: imageFile.type } };
          } catch (e) {
            set({ chatError: "Failed to process image." });
            return;
          }
        }

        // Update Session with User Message
        const sessionIndex = sessions.findIndex(s => s.id === currentSessionId);
        if (sessionIndex === -1) return;

        const updatedSessions = [...sessions];
        const currentSession = { ...updatedSessions[sessionIndex] };
        
        const isFirstMessage = currentSession.messages.length === 0;
        
        // Auto-title placeholder
        if (isFirstMessage) {
          currentSession.title = content.slice(0, 30) + (content.length > 30 ? '...' : '');
        }
        
        currentSession.messages = [...currentSession.messages, newUserMsg];
        updatedSessions[sessionIndex] = currentSession;
        
        set({ 
          sessions: updatedSessions, 
          messages: currentSession.messages,
          isChatLoading: true, 
          chatError: null 
        });

        // Save to DB immediately if user is logged in AND cloud is healthy
        // This check prevents repeatedly trying to hit a non-existent DB
        if (user && !get().cloudError) {
           saveSessionToDb(user.uid, currentSession);
        }

        // Generate Smart Title asynchronously if first message
        if (isFirstMessage) {
          generateChatTitle(content).then((title) => {
            set((state) => {
              const sList = [...state.sessions];
              const sIdx = sList.findIndex(s => s.id === currentSessionId);
              if (sIdx !== -1) {
                sList[sIdx] = { ...sList[sIdx], title };
                
                // Sync title update to DB if healthy
                if (user && !state.cloudError) {
                   saveSessionToDb(user.uid, sList[sIdx]);
                }
                
                return { sessions: sList };
              }
              return {};
            });
          });
        }

        try {
          const responseText = await chatWithLearnMate(
            content || "Analyze this image",
            currentSession.messages.slice(0, -1),
            difficulty,
            style,
            imagePart
          );

          const aiMsg: Message = {
            id: (Date.now() + 1).toString(),
            role: 'model',
            content: responseText,
            timestamp: Date.now()
          };

          // Update Session with AI Message
          set((state) => {
            const sessionsAfterAi = [...state.sessions]; 
            const idx = sessionsAfterAi.findIndex(s => s.id === currentSessionId);
            if (idx !== -1) {
              const sess = { ...sessionsAfterAi[idx] };
              sess.messages = [...sess.messages, aiMsg];
              sessionsAfterAi[idx] = sess;
              
              // Sync to DB if healthy
              if (user && !state.cloudError) {
                saveSessionToDb(user.uid, sess);
              }

              return { 
                sessions: sessionsAfterAi, 
                messages: sess.messages, 
                isChatLoading: false 
              };
            }
            return { isChatLoading: false };
          });
        } catch (error: any) {
          set({ 
            isChatLoading: false, 
            chatError: error.message || "Something went wrong." 
          });
        }
      },

      generateVisualForMessage: async (prompt) => {
        const { currentSessionId, user } = get();
        if (!currentSessionId) return;

        set({ isChatLoading: true });
        try {
          const imageUrl = await generateVisualAid(prompt);
          if (imageUrl) {
            const visualMsg: Message = {
                id: Date.now().toString(),
                role: 'model',
                content: `Here is a visual aid for: ${prompt}`,
                type: 'image',
                imageUrl: imageUrl,
                timestamp: Date.now()
            };

            set((state) => {
                const updatedSessions = [...state.sessions];
                const idx = updatedSessions.findIndex(s => s.id === currentSessionId);
                if (idx !== -1) {
                  const sess = { ...updatedSessions[idx] };
                  sess.messages = [...sess.messages, visualMsg];
                  updatedSessions[idx] = sess;

                  if (user && !state.cloudError) {
                    saveSessionToDb(user.uid, sess);
                  }
                  
                  return {
                    sessions: updatedSessions,
                    messages: sess.messages,
                    isChatLoading: false
                  };
                }
                return { isChatLoading: false };
            });
          } else {
            set({ isChatLoading: false, chatError: "Could not generate image." });
          }
        } catch (e) {
          set({ isChatLoading: false, chatError: "Failed to generate visual aid." });
        }
      },
      
      clearChatError: () => set({ chatError: null }),

      // Quiz
      quizTopic: '',
      setQuizTopic: (quizTopic) => set({ quizTopic }),
      quizQuestions: [],
      quizResults: [],
      isQuizGenerating: false,
      quizError: null,
      
      generateQuizAction: async (topic) => {
        set({ isQuizGenerating: true, quizError: null, quizQuestions: [] });
        try {
          const questions = await generateQuiz(topic);
          set({ quizQuestions: questions, isQuizGenerating: false });
        } catch (error: any) {
          set({ 
            isQuizGenerating: false, 
            quizError: error.message || "Failed to generate quiz." 
          });
        }
      },

      saveQuizResult: (result) => {
        set((state) => ({ quizResults: [...state.quizResults, result] }));
      },

      clearQuiz: () => set({ quizQuestions: [], quizTopic: '', quizError: null }),

      // Plan
      currentPlan: null,
      isPlanLoading: false,
      planError: null,
      createPlan: async (topic, duration) => {
        set({ isPlanLoading: true, planError: null });
        try {
          const plan = await generateStudyPlan(topic, duration);
          set({ currentPlan: plan, isPlanLoading: false });
        } catch (error: any) {
          set({ 
            isPlanLoading: false, 
            planError: error.message || "Failed to create plan." 
          });
        }
      },
      resetPlan: () => set({ currentPlan: null, planError: null }),
    }),
    {
      name: 'learnmate-storage',
      partialize: (state) => ({
        // Only persist if NOT logged in, or persist basic settings?
        // Actually, persist works fine. We will overwrite 'sessions' when logging in.
        sessions: state.sessions,
        currentSessionId: state.currentSessionId,
        quizResults: state.quizResults,
        difficulty: state.difficulty,
        style: state.style,
        user: state.user
      }),
      onRehydrateStorage: () => (state) => {
        if (state && state.currentSessionId && state.sessions) {
           const session = state.sessions.find(s => s.id === state.currentSessionId);
           if (session) {
             state.messages = session.messages;
           }
        }
      }
    }
  )
);
