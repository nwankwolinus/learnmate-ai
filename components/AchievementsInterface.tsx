import React from 'react';
import { useStore } from '../store/useStore';
import { RANKS, calculateNextLevelXp, XP_PER_LEVEL } from '../services/gamificationData';
import { Award, Lock, Zap, Target, Star, Crown, TrendingUp } from 'lucide-react';

export const AchievementsInterface: React.FC = () => {
  const { gamification, user } = useStore();
  
  const currentRank = RANKS.find(r => r.name === gamification.rank) || RANKS[0];
  const nextRank = RANKS.find(r => r.minLevel > gamification.level);
  
  const xpForCurrentLevel = (gamification.level - 1) * XP_PER_LEVEL;
  const xpForNextLevel = gamification.level * XP_PER_LEVEL;
  const progressInLevel = gamification.xp - xpForCurrentLevel;
  const percentage = Math.round((progressInLevel / XP_PER_LEVEL) * 100);

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-12">
      
      {/* Header / Stats Card */}
      <div className="bg-gradient-to-r from-indigo-900 to-purple-900 rounded-3xl p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-12 opacity-10">
           <Award className="w-64 h-64" />
        </div>
        
        <div className="relative z-10 flex flex-col md:flex-row items-center gap-8">
           <div className="w-32 h-32 bg-white/10 rounded-full flex items-center justify-center text-6xl shadow-inner border-4 border-white/20 backdrop-blur-sm">
              {currentRank.icon}
           </div>
           
           <div className="flex-1 text-center md:text-left">
              <h1 className="text-3xl font-black tracking-tight mb-2">
                 Level {gamification.level} <span className={currentRank.color}>{currentRank.name}</span>
              </h1>
              <p className="text-indigo-200 mb-6">
                 Total XP: <span className="text-white font-bold">{gamification.xp.toLocaleString()}</span>
              </p>
              
              <div className="relative h-6 bg-slate-900/50 rounded-full overflow-hidden backdrop-blur-sm border border-white/10">
                 <div 
                   className="absolute top-0 left-0 h-full bg-gradient-to-r from-green-400 to-emerald-500 transition-all duration-1000"
                   style={{ width: `${percentage}%` }}
                 />
                 <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white drop-shadow-md">
                    {progressInLevel} / {XP_PER_LEVEL} XP to Lvl {gamification.level + 1}
                 </div>
              </div>
           </div>

           {nextRank && (
             <div className="hidden md:flex flex-col items-center opacity-80">
                <div className="text-4xl mb-2 grayscale">{nextRank.icon}</div>
                <div className="text-xs uppercase tracking-wider font-bold">Next Rank</div>
                <div className="text-sm font-bold text-indigo-300">Lvl {nextRank.minLevel}</div>
             </div>
           )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
         
         {/* Daily Challenges */}
         <div className="md:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
               <Zap className="w-6 h-6 text-amber-500 fill-current" /> Daily Challenges
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
               {gamification.activeChallenges.map(challenge => (
                 <div key={challenge.id} className={`p-4 rounded-xl border-2 transition-all ${challenge.completed ? 'bg-green-50 border-green-200' : 'bg-slate-50 border-slate-100'}`}>
                    <div className="flex justify-between items-start mb-2">
                       <h3 className="font-bold text-slate-700">{challenge.title}</h3>
                       <span className="text-xs font-bold bg-amber-100 text-amber-700 px-2 py-1 rounded-full flex items-center gap-1">
                          <Star className="w-3 h-3 fill-current" /> +{challenge.rewardXP} XP
                       </span>
                    </div>
                    <div className="flex items-center gap-2 mt-4">
                       <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                          <div 
                             className={`h-full rounded-full ${challenge.completed ? 'bg-green-500' : 'bg-amber-500'}`}
                             style={{ width: `${Math.min((challenge.progress / challenge.goal) * 100, 100)}%` }}
                          />
                       </div>
                       <span className="text-xs font-bold text-slate-500">{challenge.progress}/{challenge.goal}</span>
                    </div>
                 </div>
               ))}
            </div>
         </div>

         {/* Mini Leaderboard (Mockup for now, or could query top users) */}
         <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
               <Crown className="w-6 h-6 text-yellow-500 fill-current" /> Leaderboard
            </h2>
            <div className="space-y-4">
               {/* Mock Data for visual structure */}
               <div className="flex items-center gap-3 p-2 rounded-lg bg-yellow-50 border border-yellow-100">
                  <div className="w-6 font-bold text-yellow-600 text-center">1</div>
                  <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center">👩‍🎓</div>
                  <div className="flex-1 font-bold text-slate-700">Sarah K.</div>
                  <div className="text-sm font-bold text-indigo-600">12,450</div>
               </div>
               <div className="flex items-center gap-3 p-2">
                  <div className="w-6 font-bold text-slate-400 text-center">2</div>
                  <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center">👨‍💻</div>
                  <div className="flex-1 font-medium text-slate-700">Alex M.</div>
                  <div className="text-sm font-bold text-slate-500">10,200</div>
               </div>
               <div className="flex items-center gap-3 p-2">
                  <div className="w-6 font-bold text-slate-400 text-center">3</div>
                  <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">🐣</div>
                  <div className="flex-1 font-medium text-slate-700">You</div>
                  <div className="text-sm font-bold text-slate-500">{gamification.xp}</div>
               </div>
            </div>
         </div>
      </div>

      {/* Achievements Grid */}
      <div>
         <h2 className="text-2xl font-bold text-slate-800 mb-6 flex items-center gap-2">
            <Target className="w-6 h-6 text-indigo-600" /> Achievements
         </h2>
         <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {gamification.achievements.map(ach => (
               <div key={ach.id} className={`relative p-6 rounded-2xl border-2 transition-all ${ach.isUnlocked ? 'bg-white border-indigo-100 shadow-sm' : 'bg-slate-50 border-slate-100 opacity-60'}`}>
                  {ach.isUnlocked ? (
                     <div className="absolute top-4 right-4 text-green-500 animate-bounce-slow">
                        <Award className="w-6 h-6" />
                     </div>
                  ) : (
                     <div className="absolute top-4 right-4 text-slate-300">
                        <Lock className="w-5 h-5" />
                     </div>
                  )}
                  
                  <div className="text-4xl mb-4">{ach.icon}</div>
                  <h3 className={`font-bold mb-1 ${ach.isUnlocked ? 'text-slate-800' : 'text-slate-500'}`}>{ach.title}</h3>
                  <p className="text-sm text-slate-500 mb-4 h-10">{ach.description}</p>
                  
                  <div className={`text-xs font-bold px-2 py-1 rounded inline-block ${ach.isUnlocked ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-200 text-slate-500'}`}>
                     +{ach.xpReward} XP
                  </div>
               </div>
            ))}
         </div>
      </div>

    </div>
  );
};