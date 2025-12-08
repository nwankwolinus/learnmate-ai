import { create } from 'zustand';
import { 
  Message, 
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
  generateVisualAid,
  generateSpeech
} from '../services/geminiService';

interface AppState {
  // --- Settings ---
  difficulty: DifficultyLevel;
  style: ExplanationStyle;
  setDifficulty: (level: DifficultyLevel) => void;
  setStyle: (style: ExplanationStyle) => void;

  // --- Chat ---
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

export const useStore = create<AppState>((set, get) => ({
  // Settings
  difficulty: DifficultyLevel.Beginner,
  style: ExplanationStyle.Standard,
  setDifficulty: (difficulty) => set({ difficulty }),
  setStyle: (style) => set({ style }),

  // Chat
  messages: [],
  isChatLoading: false,
  chatError: null,
  sendMessage: async (content, imageFile) => {
    const { messages, difficulty, style } = get();
    
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

    set({ 
      messages: [...messages, newUserMsg], 
      isChatLoading: true, 
      chatError: null 
    });

    try {
      const responseText = await chatWithLearnMate(
        content || "Analyze this image",
        messages, // Pass full history (which does NOT include newUserMsg yet inside chatWithLearnMate's context construction, but here we pass the OLD 'messages' array.
                  // Ideally, we should pass the new history.
                  // However, chatWithLearnMate logic appends the current message manually. 
                  // So passing 'messages' (the state before this update) is correct for that function signature.
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

      set((state) => ({ 
        messages: [...state.messages, aiMsg], 
        isChatLoading: false 
      }));
    } catch (error: any) {
      set({ 
        isChatLoading: false, 
        chatError: error.message || "Something went wrong." 
      });
    }
  },

  generateVisualForMessage: async (prompt) => {
    set({ isChatLoading: true });
    try {
      const imageUrl = await generateVisualAid(prompt);
      if (imageUrl) {
        set((state) => ({
          messages: [...state.messages, {
            id: Date.now().toString(),
            role: 'model',
            content: `Here is a visual aid for: ${prompt}`,
            type: 'image',
            imageUrl: imageUrl,
            timestamp: Date.now()
          }],
          isChatLoading: false
        }));
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