import React, { useEffect, useState } from 'react';
import { useStore } from '../store/useStore';
import { Play, Pause, RotateCcw, Coffee, Brain, X, Maximize2, Minimize2 } from 'lucide-react';

export const PomodoroTimer: React.FC = () => {
  const { pomodoro, setPomodoroStatus, tickPomodoro, switchPomodoroMode, resetPomodoro, updateStudyTime, settings } = useStore();
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    let interval: number | null = null;
    if (pomodoro.isActive) {
      interval = window.setInterval(() => {
        tickPomodoro();
      }, 1000);
    } else if (interval) {
      clearInterval(interval);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [pomodoro.isActive, tickPomodoro]);

  // Handle Timer Finish
  useEffect(() => {
    if (pomodoro.timeLeft === 0 && !pomodoro.isActive) {
      // Logic when timer hits 0
      const isFocus = pomodoro.mode === 'focus';
      
      if (settings.notificationsEnabled && Notification.permission === 'granted') {
         new Notification("LearnMate Timer", {
            body: isFocus ? "Time for a break! Good work." : "Break over! Time to focus.",
            icon: "/favicon.ico"
         });
      }

      // If finished a focus session, add to stats
      if (isFocus) {
         updateStudyTime(25);
      }
    }
  }, [pomodoro.timeLeft, pomodoro.isActive, pomodoro.mode, settings.notificationsEnabled, updateStudyTime]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getProgress = () => {
     const total = pomodoro.mode === 'focus' ? 25 * 60 : (pomodoro.mode === 'shortBreak' ? 5 * 60 : 15 * 60);
     return ((total - pomodoro.timeLeft) / total) * 100;
  };

  if (!isExpanded) {
    return (
      <div 
        className="fixed bottom-20 right-4 z-40 bg-white rounded-full shadow-xl border border-slate-200 p-1 cursor-pointer hover:scale-105 transition-transform flex items-center gap-2 pr-4 group"
        onClick={() => setIsExpanded(true)}
      >
        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white shadow-sm ${pomodoro.isActive ? 'bg-indigo-600 animate-pulse' : 'bg-slate-800'}`}>
           <ClockIcon mode={pomodoro.mode} />
        </div>
        <div className="flex flex-col">
           <span className="text-xs font-bold text-slate-700">{formatTime(pomodoro.timeLeft)}</span>
           <span className="text-[10px] text-slate-500 uppercase">{pomodoro.mode.replace(/([A-Z])/g, ' $1').trim()}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed bottom-20 right-4 z-40 bg-white rounded-2xl shadow-2xl border border-slate-200 w-72 overflow-hidden animate-fade-in">
       {/* Header */}
       <div className={`p-4 flex justify-between items-center text-white ${pomodoro.mode === 'focus' ? 'bg-indigo-600' : 'bg-emerald-600'}`}>
          <div className="flex items-center gap-2">
             <ClockIcon mode={pomodoro.mode} />
             <span className="font-bold capitalize">{pomodoro.mode.replace(/([A-Z])/g, ' $1')}</span>
          </div>
          <button onClick={() => setIsExpanded(false)} className="hover:bg-white/20 rounded p-1">
             <Minimize2 className="w-4 h-4" />
          </button>
       </div>

       {/* Timer Body */}
       <div className="p-6 text-center">
          <div className="text-5xl font-black text-slate-800 font-mono mb-6 tracking-tight">
             {formatTime(pomodoro.timeLeft)}
          </div>

          {/* Progress Bar */}
          <div className="h-2 bg-slate-100 rounded-full mb-6 overflow-hidden">
             <div 
               className={`h-full transition-all duration-1000 ${pomodoro.mode === 'focus' ? 'bg-indigo-500' : 'bg-emerald-500'}`}
               style={{ width: `${getProgress()}%` }}
             />
          </div>

          {/* Controls */}
          <div className="flex justify-center gap-4 mb-6">
             <button 
               onClick={() => setPomodoroStatus(!pomodoro.isActive)}
               className={`p-4 rounded-full text-white shadow-lg transition-transform hover:scale-110 active:scale-95 ${pomodoro.isActive ? 'bg-orange-500' : 'bg-slate-900'}`}
             >
               {pomodoro.isActive ? <Pause className="fill-current" /> : <Play className="fill-current ml-1" />}
             </button>
             <button 
               onClick={resetPomodoro}
               className="p-4 rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 transition-transform"
             >
               <RotateCcw className="w-6 h-6" />
             </button>
          </div>

          {/* Mode Switcher */}
          <div className="flex justify-center gap-2 text-xs">
             <button 
               onClick={() => switchPomodoroMode('focus')}
               className={`px-3 py-1 rounded-full border ${pomodoro.mode === 'focus' ? 'bg-indigo-50 border-indigo-200 text-indigo-700 font-bold' : 'text-slate-500 border-transparent hover:bg-slate-50'}`}
             >
               Focus
             </button>
             <button 
               onClick={() => switchPomodoroMode('shortBreak')}
               className={`px-3 py-1 rounded-full border ${pomodoro.mode === 'shortBreak' ? 'bg-emerald-50 border-emerald-200 text-emerald-700 font-bold' : 'text-slate-500 border-transparent hover:bg-slate-50'}`}
             >
               Short
             </button>
             <button 
               onClick={() => switchPomodoroMode('longBreak')}
               className={`px-3 py-1 rounded-full border ${pomodoro.mode === 'longBreak' ? 'bg-emerald-50 border-emerald-200 text-emerald-700 font-bold' : 'text-slate-500 border-transparent hover:bg-slate-50'}`}
             >
               Long
             </button>
          </div>
       </div>
    </div>
  );
};

const ClockIcon = ({ mode }: { mode: string }) => {
  if (mode === 'focus') return <Brain className="w-5 h-5" />;
  return <Coffee className="w-5 h-5" />;
};
