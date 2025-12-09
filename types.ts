import { z } from 'zod';

// Enums
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

// Zod Schemas
export const QuizQuestionSchema = z.object({
  id: z.number(),
  question: z.string(),
  options: z.array(z.string()),
  correctAnswer: z.number(),
  explanation: z.string()
});

export const QuizResultSchema = z.object({
  score: z.number(),
  total: z.number(),
  date: z.string(),
  topic: z.string()
});

export const StudyPlanItemSchema = z.object({
  step: z.number(),
  title: z.string(),
  duration: z.string(),
  description: z.string(),
  resources: z.array(z.string()).optional().default([])
});

export const StudyPlanSchema = z.object({
  topic: z.string(),
  totalDuration: z.string(),
  items: z.array(StudyPlanItemSchema)
});

// Derived Types
export type QuizQuestion = z.infer<typeof QuizQuestionSchema>;
export type QuizResult = z.infer<typeof QuizResultSchema>;
export type StudyPlanItem = z.infer<typeof StudyPlanItemSchema>;
export type StudyPlan = z.infer<typeof StudyPlanSchema>;

export interface Message {
  id: string;
  role: 'user' | 'model';
  content: string;
  type?: 'text' | 'image' | 'audio';
  imageUrl?: string;
  // For history context preservation (store base64 without prefix if needed, or full data url)
  imageData?: {
    mimeType: string;
    data: string; // base64
  };
  audioData?: string; // base64
  timestamp: number;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
}

export interface ProgressStats {
  topicsLearned: number;
  quizzesTaken: number;
  averageScore: number;
  recentTopics: string[];
}

export interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}