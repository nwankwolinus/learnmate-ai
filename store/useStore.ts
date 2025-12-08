import { create } from 'zustand';
import { 
  Message, 
  ChatSession,
  DifficultyLevel, 
  ExplanationStyle, 
  QuizQuestion, 
  QuizResult, 
  StudyPlan 
} from '../types';
import { 
  chatWithLearnMate, 
  generateQuiz, 
  generateStudyPlan,
  generateVisualAid
} from '../services/geminiService';

interface AppState {
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

const getSavedResults = (): QuizResult[] => {
  try {
    const saved = localStorage.getItem('learnmate_results');
    return saved ? JSON.parse(saved) : [];
  } catch (e) {
    console.error("Failed to parse saved results", e);
    return [];
  }
};

const getSavedSessions = (): ChatSession[] => {
  try {
    const saved = localStorage.getItem('learnmate_sessions');
    return saved ? JSON.parse(saved) : [];
  } catch (e) {
    console.error("Failed to parse saved sessions", e);
    return [];
  }
};

const saveSessions = (sessions: ChatSession[]) => {
  localStorage.setItem('learnmate_sessions', JSON.stringify(sessions));
};

export const useStore = create<AppState>((set, get) => ({
  // Settings
  difficulty: DifficultyLevel.Beginner,
  style: ExplanationStyle.Standard,
  setDifficulty: (difficulty) => set({ difficulty }),
  setStyle: (style) => set({ style }),

  // Chat Sessions
  sessions: getSavedSessions(),
  currentSessionId: null,
  
  createSession: () => {
    const newSession: ChatSession = {
      id: Date.now().toString(),
      title: 'New Chat',
      messages: [],
      createdAt: Date.now()
    };
    const updatedSessions = [newSession, ...get().sessions];
    saveSessions(updatedSessions);
    set({ 
      sessions: updatedSessions, 
      currentSessionId: newSession.id,
      messages: [] 
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
    const { sessions, currentSessionId } = get();
    const updatedSessions = sessions.filter(s => s.id !== sessionId);
    saveSessions(updatedSessions);
    
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
  },

  // Chat
  messages: [],
  isChatLoading: false,
  chatError: null,
  sendMessage: async (content, imageFile) => {
    let { sessions, currentSessionId, difficulty, style } = get();
    
    // Ensure a session exists
    if (!currentSessionId) {
      get().createSession();
      // Update local vars after state change
      currentSessionId = get().currentSessionId;
      sessions = get().sessions;
    }

    if (!currentSessionId) return; // Should not happen

    // Create User Message
    const userMsgId = Date.now().toString();
    const newUserMsg: Message = {
      id: userMsgId,
      role: 'user',
      content,
      timestamp: Date.now(),
      imageUrl: imageFile ? URL.createObjectURL(imageFile) : undefined,
    };

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
    
    // Auto-title if it's the first message
    if (currentSession.messages.length === 0) {
      currentSession.title = content.slice(0, 30) + (content.length > 30 ? '...' : '');
    }
    
    currentSession.messages = [...currentSession.messages, newUserMsg];
    updatedSessions[sessionIndex] = currentSession;
    
    saveSessions(updatedSessions);
    set({ 
      sessions: updatedSessions, 
      messages: currentSession.messages,
      isChatLoading: true, 
      chatError: null 
    });

    try {
      const responseText = await chatWithLearnMate(
        content || "Analyze this image",
        currentSession.messages.slice(0, -1), // Pass history excluding current (handled by service usually, but here we follow service logic)
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
      const sessionsAfterAi = [...get().sessions]; // re-get latest state
      const idx = sessionsAfterAi.findIndex(s => s.id === currentSessionId);
      if (idx !== -1) {
        const sess = { ...sessionsAfterAi[idx] };
        sess.messages = [...sess.messages, aiMsg];
        sessionsAfterAi[idx] = sess;
        
        saveSessions(sessionsAfterAi);
        set({ 
          sessions: sessionsAfterAi, 
          messages: sess.messages,
          isChatLoading: false 
        });
      }
    } catch (error: any) {
      set({ 
        isChatLoading: false, 
        chatError: error.message || "Something went wrong." 
      });
    }
  },

  generateVisualForMessage: async (prompt) => {
    const { currentSessionId, sessions } = get();
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

        const updatedSessions = [...sessions];
        const idx = updatedSessions.findIndex(s => s.id === currentSessionId);
        if (idx !== -1) {
          const sess = { ...updatedSessions[idx] };
          sess.messages = [...sess.messages, visualMsg];
          updatedSessions[idx] = sess;
          
          saveSessions(updatedSessions);
          set({
            sessions: updatedSessions,
            messages: sess.messages,
            isChatLoading: false
          });
        }
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
  quizResults: getSavedResults(),
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
    set((state) => {
      const newResults = [...state.quizResults, result];
      localStorage.setItem('learnmate_results', JSON.stringify(newResults));
      return { quizResults: newResults };
    });
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
}));