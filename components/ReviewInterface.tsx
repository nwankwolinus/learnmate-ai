
import React, { useState, useMemo } from 'react';
import { useStore } from '../store/useStore';
import { Brain, Check, Clock, Calendar, BarChart2, RefreshCcw, Smile, Meh, Frown, ThumbsUp, TrendingUp, Layers } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { 
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip, BarChart, Bar, XAxis, YAxis 
} from 'recharts';

export const ReviewInterface: React.FC = () => {
  const { srsItems, submitReview, streak } = useStore();
  const [isFlipped, setIsFlipped] = useState(false);
  const [showAnswer, setShowAnswer] = useState(false);

  // Filter due items
  const now = Date.now();
  const dueItems = useMemo(() => {
    return srsItems
      .filter(item => item.nextReviewDate <= now)
      .sort((a, b) => a.nextReviewDate - b.nextReviewDate); // Oldest first
  }, [srsItems, now]);

  const currentItem = dueItems.length > 0 ? dueItems[0] : null;

  // --- Stats Calculation ---

  // 1. Retention Distribution (Pie)
  const stats = useMemo(() => {
    const total = srsItems.length;
    const mastered = srsItems.filter(i => i.interval > 21).length; // > 3 weeks = mastered
    const learning = srsItems.filter(i => i.interval <= 3).length;
    const reviewing = total - mastered - learning;
    return { total, mastered, learning, reviewing };
  }, [srsItems]);

  const pieData = [
    { name: 'Learning', value: stats.learning, color: '#fbbf24' }, // Amber
    { name: 'Reviewing', value: stats.reviewing, color: '#6366f1' },   // Indigo
    { name: 'Mastered', value: stats.mastered, color: '#10b981' }      // Emerald
  ];

  // 2. Future Retention Forecast (Bar Chart)
  const forecastData = useMemo(() => {
    const days: { [key: string]: number } = {};
    const today = new Date();
    
    // Initialize next 7 days
    for(let i=1; i<=7; i++) {
        const d = new Date(today);
        d.setDate(d.getDate() + i);
        days[d.toLocaleDateString(undefined, { weekday: 'short' })] = 0;
    }

    srsItems.forEach(item => {
        if (item.nextReviewDate > now) {
            const date = new Date(item.nextReviewDate);
            const dayStr = date.toLocaleDateString(undefined, { weekday: 'short' });
            if (days[dayStr] !== undefined) {
                days[dayStr]++;
            }
        }
    });

    return Object.entries(days).map(([day, count]) => ({ day, count }));
  }, [srsItems, now]);

  const handleRating = async (rating: 'again' | 'hard' | 'good' | 'easy') => {
    if (!currentItem) return;
    
    // Animate flip back
    setIsFlipped(false);
    setShowAnswer(false);
    
    // Small delay to allow flip animation to finish before switching content
    setTimeout(async () => {
       await submitReview(currentItem.id, rating);
    }, 200);
  };

  // --- Empty State (No Deck) ---
  if (srsItems.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8 bg-white rounded-3xl shadow-lg border border-slate-100">
        <div className="w-24 h-24 bg-indigo-50 rounded-full flex items-center justify-center mb-6 animate-pulse">
          <Brain className="w-12 h-12 text-indigo-500" />
        </div>
        <h2 className="text-3xl font-bold text-slate-800 mb-3">Start Your Knowledge Journey</h2>
        <p className="text-slate-500 max-w-md mb-8 text-lg leading-relaxed">
          Your brain graph is empty! Take some quizzes to add cards to your spaced repetition deck. We'll remind you exactly when to review.
        </p>
        <div className="flex gap-4 text-sm font-medium text-slate-400">
           <span className="flex items-center gap-1"><Check className="w-4 h-4"/> Smart Scheduling</span>
           <span className="flex items-center gap-1"><TrendingUp className="w-4 h-4"/> Long-term Retention</span>
        </div>
      </div>
    );
  }

  // --- Done State (No Due Cards) ---
  if (!currentItem) {
    return (
      <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8 items-center min-h-[60vh]">
        <div className="flex flex-col items-center text-center p-8 bg-white rounded-3xl shadow-lg border border-slate-100 h-full justify-center">
            <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mb-6 animate-bounce">
              <Check className="w-12 h-12 text-green-600" />
            </div>
            <h2 className="text-3xl font-bold text-slate-800 mb-2">All Caught Up!</h2>
            <p className="text-slate-500 max-w-md mb-8 text-lg">
              You've reviewed all your due cards. Great job keeping your memory sharp!
            </p>
            <div className="w-full bg-slate-50 p-4 rounded-xl">
               <div className="flex justify-between text-sm text-slate-600 mb-2">
                 <span>Total Cards</span>
                 <span className="font-bold">{stats.total}</span>
               </div>
               <div className="flex justify-between text-sm text-slate-600">
                 <span>Mastered</span>
                 <span className="font-bold text-green-600">{stats.mastered}</span>
               </div>
            </div>
        </div>

        {/* Forecast Graph on Empty State */}
        <div className="bg-white rounded-3xl p-8 shadow-lg border border-slate-100 h-full flex flex-col">
            <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
               <Calendar className="w-5 h-5 text-indigo-600" /> Upcoming Reviews
            </h3>
            <div className="flex-1 w-full min-h-[200px]">
               <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={forecastData}>
                     <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#94a3b8'}} />
                     <Tooltip 
                        cursor={{fill: '#f1f5f9'}}
                        contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}}
                     />
                     <Bar dataKey="count" fill="#818cf8" radius={[4, 4, 0, 0]} barSize={30} />
                  </BarChart>
               </ResponsiveContainer>
            </div>
            <p className="text-center text-slate-400 text-sm mt-4">
               Estimated cards due over the next 7 days
            </p>
        </div>
      </div>
    );
  }

  // --- Active Review Interface ---
  return (
    <div className="max-w-6xl mx-auto space-y-6">
      
      {/* Header */}
      <div className="flex items-center justify-between">
         <div>
            <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
               <Layers className="w-6 h-6 text-indigo-600" /> Flashcard Review
            </h1>
            <p className="text-slate-500 text-sm">Spaced Repetition System (SM-2)</p>
         </div>
         <div className="flex items-center gap-3">
             <div className="bg-orange-100 text-orange-700 px-4 py-2 rounded-xl font-bold flex items-center gap-2 shadow-sm animate-pulse">
                <Clock className="w-4 h-4" />
                {dueItems.length} Due Now
             </div>
         </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        
        {/* Main Flashcard Area */}
        <div className="flex-1">
          <div className="relative perspective-1000 h-[500px]">
            <div className={`relative w-full h-full transition-transform duration-700 transform-style-3d cursor-pointer ${isFlipped ? 'rotate-y-180' : ''}`}>
              
              {/* --- FRONT OF CARD --- */}
              <div 
                 className="absolute inset-0 backface-hidden bg-white rounded-3xl shadow-xl border border-slate-200 p-8 flex flex-col justify-between"
              >
                <div>
                  <div className="flex justify-between items-start mb-6">
                     <span className="text-xs font-bold bg-slate-100 text-slate-500 px-3 py-1 rounded-full uppercase tracking-wider">
                       Topic: {currentItem.topic}
                     </span>
                     <div className="flex gap-1">
                        <div className="w-2 h-2 rounded-full bg-red-400"></div>
                        <div className="w-2 h-2 rounded-full bg-yellow-400"></div>
                        <div className="w-2 h-2 rounded-full bg-green-400"></div>
                     </div>
                  </div>
                  
                  <h3 className="text-2xl md:text-3xl font-medium text-slate-800 leading-relaxed text-center mt-12">
                    {currentItem.question.question}
                  </h3>

                  <div className="mt-12 space-y-3 max-w-md mx-auto opacity-50 blur-[2px] select-none">
                     <div className="h-4 bg-slate-100 rounded w-3/4 mx-auto"></div>
                     <div className="h-4 bg-slate-100 rounded w-1/2 mx-auto"></div>
                     <div className="h-4 bg-slate-100 rounded w-5/6 mx-auto"></div>
                  </div>
                </div>
                
                <button 
                  onClick={() => { setIsFlipped(true); setShowAnswer(true); }}
                  className="w-full bg-indigo-600 text-white py-4 rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg hover:shadow-indigo-500/30 flex items-center justify-center gap-2 group"
                >
                  Show Answer <ArrowRightIcon className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </button>
              </div>

              {/* --- BACK OF CARD --- */}
              <div className="absolute inset-0 backface-hidden rotate-y-180 bg-slate-900 text-white rounded-3xl shadow-2xl p-8 flex flex-col justify-between border border-slate-700">
                <div className="overflow-y-auto pr-2 custom-scrollbar">
                  <div className="flex items-center gap-2 mb-4">
                     <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center">
                        <Check className="w-5 h-5 text-white" />
                     </div>
                     <span className="text-xs font-bold text-green-400 uppercase tracking-wider">Correct Answer</span>
                  </div>
                  
                  <div className="text-xl md:text-2xl font-bold mb-6 text-white bg-slate-800 p-4 rounded-xl border border-slate-700">
                    {currentItem.question.options[currentItem.question.correctAnswer]}
                  </div>
                  
                  <div className="h-px bg-slate-700 my-6"></div>
                  
                  <div className="flex items-center gap-2 mb-2">
                     <Brain className="w-4 h-4 text-indigo-400" />
                     <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider">Explanation</span>
                  </div>
                  <div className="prose prose-invert prose-sm max-w-none text-slate-300">
                    <ReactMarkdown>{currentItem.question.explanation}</ReactMarkdown>
                  </div>
                </div>

                {/* Rating Controls */}
                <div>
                   <p className="text-center text-slate-400 text-xs uppercase font-bold tracking-widest mb-3">
                      How well did you know this?
                   </p>
                   <div className="grid grid-cols-4 gap-3">
                     <RatingButton 
                        label="Again" 
                        subLabel="< 1m" 
                        color="red" 
                        icon={Frown} 
                        onClick={() => handleRating('again')} 
                     />
                     <RatingButton 
                        label="Hard" 
                        subLabel="2d" 
                        color="orange" 
                        icon={Meh} 
                        onClick={() => handleRating('hard')} 
                     />
                     <RatingButton 
                        label="Good" 
                        subLabel="3d" 
                        color="blue" 
                        icon={Smile} 
                        onClick={() => handleRating('good')} 
                     />
                     <RatingButton 
                        label="Easy" 
                        subLabel="7d" 
                        color="green" 
                        icon={ThumbsUp} 
                        onClick={() => handleRating('easy')} 
                     />
                   </div>
                </div>
              </div>

            </div>
          </div>
        </div>

        {/* Sidebar Stats */}
        <div className="w-full lg:w-80 space-y-6">
           
           {/* Retention Heatmap / Forecast */}
           <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
              <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-indigo-500" /> Future Workload
              </h3>
              
              <div className="h-40 w-full">
                 <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={forecastData}>
                       <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#94a3b8'}} />
                       <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '8px', fontSize: '12px'}} />
                       <Bar dataKey="count" fill="#6366f1" radius={[2, 2, 0, 0]} />
                    </BarChart>
                 </ResponsiveContainer>
              </div>
              <p className="text-xs text-center text-slate-400 mt-2">Cards due next 7 days</p>
           </div>

           {/* Deck Distribution */}
           <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
              <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
                <BarChart2 className="w-4 h-4 text-emerald-500" /> Deck Mastery
              </h3>
              
              <div className="h-40 w-full relative">
                 <ResponsiveContainer width="100%" height="100%">
                   <PieChart>
                     <Pie
                       data={pieData}
                       cx="50%"
                       cy="50%"
                       innerRadius={40}
                       outerRadius={60}
                       paddingAngle={5}
                       dataKey="value"
                     >
                       {pieData.map((entry, index) => (
                         <Cell key={`cell-${index}`} fill={entry.color} />
                       ))}
                     </Pie>
                     <Tooltip />
                   </PieChart>
                 </ResponsiveContainer>
                 {/* Center Stats */}
                 <div className="absolute inset-0 flex items-center justify-center flex-col pointer-events-none">
                    <span className="text-xl font-bold text-slate-800">{stats.total}</span>
                    <span className="text-[10px] text-slate-400 uppercase">Cards</span>
                 </div>
              </div>

              <div className="space-y-2 mt-2">
                 {pieData.map((d, i) => (
                   <div key={i} className="flex justify-between items-center text-xs">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{backgroundColor: d.color}}></div>
                        <span className="text-slate-600">{d.name}</span>
                      </div>
                      <span className="font-bold text-slate-800">{d.value}</span>
                   </div>
                 ))}
              </div>
           </div>

        </div>
      </div>
    </div>
  );
};

// Helper Components

const RatingButton = ({ label, subLabel, color, icon: Icon, onClick }: any) => {
  const colorClasses: any = {
    red: 'bg-red-500/20 hover:bg-red-500/30 text-red-300 border-red-500/50',
    orange: 'bg-orange-500/20 hover:bg-orange-500/30 text-orange-300 border-orange-500/50',
    blue: 'bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 border-blue-500/50',
    green: 'bg-green-500/20 hover:bg-green-500/30 text-green-300 border-green-500/50'
  };

  return (
    <button 
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all transform active:scale-95 ${colorClasses[color]}`}
    >
      <Icon className="w-5 h-5 mb-1" />
      <span className="text-sm font-bold">{label}</span>
      <span className="text-[10px] opacity-70 font-mono">{subLabel}</span>
    </button>
  );
}

function ArrowRightIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
  )
}
