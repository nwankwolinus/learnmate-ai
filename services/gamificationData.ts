import { Achievement, UserRank, Challenge } from '../types';

export const RANKS: UserRank[] = [
  { name: 'Novice', minLevel: 1, icon: '🌱', color: 'text-green-500' },
  { name: 'Apprentice', minLevel: 5, icon: '📘', color: 'text-blue-500' },
  { name: 'Scholar', minLevel: 10, icon: '🎓', color: 'text-indigo-500' },
  { name: 'Sage', minLevel: 20, icon: '🔮', color: 'text-purple-500' },
  { name: 'Luminary', minLevel: 30, icon: '✨', color: 'text-amber-500' },
  { name: 'Grandmaster', minLevel: 50, icon: '👑', color: 'text-red-500' }
];

export const XP_PER_LEVEL = 500; // Linear leveling for simplicity, or could be quadratic

export const calculateLevel = (xp: number) => Math.floor(xp / XP_PER_LEVEL) + 1;
export const calculateNextLevelXp = (level: number) => level * XP_PER_LEVEL;

export const INITIAL_ACHIEVEMENTS: Achievement[] = [
  {
    id: 'first_steps',
    title: 'First Steps',
    description: 'Complete your first chat session.',
    icon: '💬',
    type: 'session',
    condition: 1,
    xpReward: 50,
    isUnlocked: false
  },
  {
    id: 'quiz_novice',
    title: 'Quiz Novice',
    description: 'Complete 5 quizzes.',
    icon: '📝',
    type: 'quiz',
    condition: 5,
    xpReward: 100,
    isUnlocked: false
  },
  {
    id: 'quiz_master',
    title: 'Quiz Master',
    description: 'Score 100% on a quiz.',
    icon: '🏆',
    type: 'mastery',
    condition: 1, // Special logic handled in store
    xpReward: 200,
    isUnlocked: false
  },
  {
    id: 'streak_week',
    title: 'Week Warrior',
    description: 'Reach a 7-day study streak.',
    icon: '🔥',
    type: 'streak',
    condition: 7,
    xpReward: 500,
    isUnlocked: false
  },
  {
    id: 'dedicated_learner',
    title: 'Dedicated Learner',
    description: 'Study for 1000 minutes total.',
    icon: '⏱️',
    type: 'session',
    condition: 1000,
    xpReward: 1000,
    isUnlocked: false
  }
];

export const generateDailyChallenges = (): Challenge[] => {
  const tomorrow = new Date();
  tomorrow.setHours(24, 0, 0, 0);
  
  return [
    {
      id: `daily_quiz_${Date.now()}`,
      title: 'Complete 3 Quizzes',
      type: 'daily',
      goal: 3,
      progress: 0,
      completed: false,
      rewardXP: 100,
      expiresAt: tomorrow.getTime()
    },
    {
      id: `daily_chat_${Date.now()}`,
      title: 'Chat for 15 mins',
      type: 'daily',
      goal: 15,
      progress: 0,
      completed: false,
      rewardXP: 50,
      expiresAt: tomorrow.getTime()
    }
  ];
};