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

export enum AIPersona {
  Professional = "Professional Tutor",
  Friend = "Enthusiastic Friend",
  Socratic = "Socratic Philosopher",
  Sergeant = "Drill Sergeant",
  Mentor = "Gentle Mentor"
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
  type?: 'text' | 'image' | 'audio' | 'file';
  // Multimedia Content
  imageUrl?: string;
  audioUrl?: string; // For recording playback
  fileUrl?: string; // For PDF download/view
  fileName?: string; // For display
  
  // Data for AI Context (History)
  attachmentData?: {
    mimeType: string;
    data: string; // base64
  };
  
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

// --- Spaced Repetition System Types ---

export interface SRSItem {
  id: string;
  userId: string;
  question: QuizQuestion;
  topic: string;
  
  // SM-2 Algorithm Metadata
  easeFactor: number; // Default 2.5
  interval: number;   // Days until next review
  repetitions: number; // Consecutive successful recalls
  
  // Dates (timestamps)
  createdAt: number;
  lastReviewed: number;
  nextReviewDate: number;
}

export type ReviewRating = 'again' | 'hard' | 'good' | 'easy';

// --- Study Groups Types ---

export interface GroupMember {
  uid: string;
  displayName: string;
  photoURL: string | null;
  joinedAt: number;
  lastActive: number;
  role: 'leader' | 'member';
  stats: {
    messagesSent: number;
    quizzesTaken: number;
  };
}

export interface GroupMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderPhoto: string | null;
  content: string;
  timestamp: number;
  type: 'text' | 'system';
}

export interface GroupQuizSession {
  isActive: boolean;
  topic: string;
  questions: QuizQuestion[];
  currentQuestionIndex: number;
  status: 'waiting' | 'in-progress' | 'completed';
  participants: {
    [uid: string]: {
      score: number;
      answers: number[]; // Index of answer per question
    }
  };
}

export interface StudyGroup {
  id: string;
  name: string;
  code: string; // Unique 6-char invite code
  description: string;
  createdBy: string;
  createdAt: number;
  isPublic: boolean;
  activeQuiz: GroupQuizSession | null;
  sharedPlan: StudyPlan | null;
}

// --- Learning Path Types ---

export interface PathNode {
  id: string;
  label: string;
  description: string;
  status: 'locked' | 'unlocked' | 'completed';
  prerequisites: string[]; // Array of node IDs
  x: number; // For visual graph
  y: number;
}

export interface LearningPath {
  id: string;
  userId: string;
  title: string;
  description: string;
  nodes: PathNode[];
  progress: number; // 0-100
  createdAt: number;
  isPublic: boolean;
}

// --- Settings & Consistency Types ---

export interface UserSettings {
  dailyGoalMinutes: number; // e.g., 30
  weeklyGoalQuizzes: number; // e.g., 5
  notificationsEnabled: boolean;
  reminderTime: string; // "18:00"
}

export interface StreakData {
  currentStreak: number;
  maxStreak: number;
  lastStudyDate: string; // YYYY-MM-DD
  activityHistory: { [date: string]: number }; // Date -> Minutes Studied
}

export interface PomodoroState {
  isActive: boolean;
  mode: 'focus' | 'shortBreak' | 'longBreak';
  timeLeft: number; // seconds
  cyclesCompleted: number;
}

// --- Export & Portfolio Types ---

export interface Certificate {
  id: string;
  title: string; // e.g., "Mastery of World War II"
  topic: string;
  date: string;
  userName: string;
}

export interface PortfolioProfile {
  bio: string;
  isPublic: boolean;
  showStreaks: boolean;
  showCertificates: boolean;
  linkedInUrl?: string;
  websiteUrl?: string;
}

// --- Gamification Types ---

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string; // Lucide icon name or emoji
  type: 'quiz' | 'streak' | 'session' | 'mastery';
  condition: number; // Threshold to unlock
  xpReward: number;
  isUnlocked: boolean;
  unlockedAt?: number;
}

export interface UserRank {
  name: string;
  minLevel: number;
  icon: string; // Emoji
  color: string;
}

export interface Challenge {
  id: string;
  title: string;
  type: 'daily' | 'weekly';
  goal: number;
  progress: number;
  completed: boolean;
  rewardXP: number;
  expiresAt: number;
}

export interface GamificationState {
  xp: number;
  level: number;
  rank: string;
  achievements: Achievement[];
  activeChallenges: Challenge[];
  showLevelUp: boolean; // Triggers modal
}

// --- AI Insights Types ---

export interface AIProgressInsights {
  summary: string;
  weakAreas: string[];
  tips: string[];
  prediction: string;
}