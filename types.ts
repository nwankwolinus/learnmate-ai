export interface Message {
  id: string;
  role: 'user' | 'model';
  content: string;
  type?: 'text' | 'image' | 'audio';
  imageUrl?: string;
  audioData?: string; // base64
  timestamp: number;
}

export interface QuizQuestion {
  id: number;
  question: string;
  options: string[];
  correctAnswer: number; // Index of the correct option
  explanation: string;
}

export interface QuizResult {
  score: number;
  total: number;
  date: string;
  topic: string;
}

export interface StudyPlanItem {
  step: number;
  title: string;
  duration: string;
  description: string;
  resources: string[];
}

export interface StudyPlan {
  topic: string;
  totalDuration: string;
  items: StudyPlanItem[];
}

export enum DifficultyLevel {
  Beginner = "Beginner",
  Intermediate = "Intermediate",
  Advanced = "Advanced"
}

export enum ExplanationStyle {
  Standard = "Standard",
  ELI5 = "Explain like I'm 5",
  Analogy = "Use Analogies",
  Socratic = "Socratic Method"
}

export interface ProgressStats {
  topicsLearned: number;
  quizzesTaken: number;
  averageScore: number;
  recentTopics: string[];
}
