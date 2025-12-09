import React, { useState, useMemo } from 'react';
import { useStore } from '../store/useStore';
import { Brain, Check, Clock, Calendar, BarChart2, RefreshCcw, Smile, Meh, Frown, ThumbsUp } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';

export const ReviewInterface: React.FC = () => {
  const { srsItems, submitReview } = useStore();
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

  // Stats
  const stats = useMemo(() => {
    const total = srsItems.length;
    const mastered = srsItems.filter(i => i.interval > 21).length; // > 3 weeks = mastered
    const learning = srsItems.filter(i => i.interval <= 3).length;
    const reviewing = total - mastered - learning;
    return { total, mastered, learning, reviewing };
  }, [srsItems]);

  const chartData = [
    { name: 'New/Learning', value: stats.learning, color: '#fbbf24' }, // Amber
    { name: 'Reviewing', value: stats.reviewing, color: '#6366f1' },   // Indigo
    { name: 'Mastered', value: stats.mastered, color: '#10b981' }      // Emerald
  ];

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

  if (srsItems.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center p-8 bg-white rounded-2xl shadow-sm border border-slate-200">
        <div className="w-20 h-20 bg-indigo-50 rounded-full flex items-center justify-center mb-6">
          <Brain className="w-10 h-10 text-indigo-500" />
        </div>
        <h2 className="text-2xl font-bold text-slate-800 mb-2">Start Your Knowledge Journey</h2>
        <p className="text-slate-500 max-w-md mb-6">
          Take quizzes to add questions to your spaced repetition deck. We'll remind you to review them just as you're about to forget!
        </p>
      </div>
    );
  }

  if (!currentItem) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center p-8 bg-white rounded-2xl shadow-sm border border-slate-200">
        <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mb-6 animate-bounce">
          <Check className="w-10 h-10 text-green-500" />
        </div>
        <h2 className="text-2xl font-bold text-slate-800 mb-2">All Caught Up!</h2>
        <p className="text-slate-500 max-w-md mb-8">
          You've reviewed all your due cards for now. Great job keeping your memory sharp!
        </p>
        
        <div className="w-full max-w-md bg-slate-50 rounded-xl p-6 border border-slate-100">
          <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wide mb-4">Deck Statistics</h3>
          <div className="flex justify-around items-center">
             <div className="text-center">
                <div className="text-2xl font-bold text-emerald-500">{stats.mastered}</div>
                <div className="text-xs text-slate-500">Mastered</div>
             </div>
             <div className="text-center">
                <div className="text-2xl font-bold text-indigo-500">{stats.reviewing}</div>
                <div className="text-xs text-slate-500">Reviewing</div>
             </div>
             <div className="text-center">
                <div className="text-2xl font-bold text-amber-500">{stats.learning}</div>
                <div className="text-xs text-slate-500">Learning</div>
             </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row gap-6">
        
        {/* Main Flashcard Area */}
        <div className="flex-1">
          <div className="flex justify-between items-center mb-4">
             <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
               <RefreshCcw className="w-5 h-5 text-indigo-600" /> Review Session
             </h2>
             <span className="bg-indigo-100 text-indigo-700 text-xs font-bold px-3 py-1 rounded-full">
               {dueItems.length} Due
             </span>
          </div>

          <div className="relative perspective-1000 h-[400px]">
            <div className={`relative w-full h-full transition-all duration-500 transform-style-3d ${isFlipped ? 'rotate-y-180' : ''}`}>
              
              {/* Front of Card */}
              <div className="absolute inset-0 backface-hidden bg-white rounded-2xl shadow-xl border border-slate-200 p-8 flex flex-col justify-between">
                <div>
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                    Topic: {currentItem.topic}
                  </div>
                  <h3 className="text-xl font-medium text-slate-800 leading-relaxed">
                    {currentItem.question.question}
                  </h3>
                  <div className="mt-6 space-y-2">
                    {currentItem.question.options.map((opt, idx) => (
                      <div key={idx} className="p-3 border border-slate-100 rounded-lg text-slate-500 text-sm">
                        {opt}
                      </div>
                    ))}
                  </div>
                </div>
                
                <button 
                  onClick={() => { setIsFlipped(true); setShowAnswer(true); }}
                  className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 transition-colors shadow-md mt-4"
                >
                  Show Answer
                </button>
              </div>

              {/* Back of Card */}
              <div className="absolute inset-0 backface-hidden rotate-y-180 bg-slate-900 text-white rounded-2xl shadow-xl p-8 flex flex-col justify-between">
                <div className="overflow-y-auto pr-2 custom-scrollbar">
                  <div className="text-xs font-bold text-indigo-300 uppercase tracking-wider mb-2">Answer</div>
                  <div className="text-lg font-bold mb-4 text-white">
                    {currentItem.question.options[currentItem.question.correctAnswer]}
                  </div>
                  
                  <div className="h-px bg-slate-700 my-4"></div>
                  
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Explanation</div>
                  <div className="prose prose-invert prose-sm">
                    <ReactMarkdown>{currentItem.question.explanation}</ReactMarkdown>
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-2 mt-6">
                  <button 
                    onClick={() => handleRating('again')}
                    className="flex flex-col items-center justify-center p-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/50 transition-all"
                  >
                    <Frown className="w-5 h-5 mb-1" />
                    <span className="text-xs font-bold">Again</span>
                    <span className="text-[10px] opacity-70">1m</span>
                  </button>
                  <button 
                    onClick={() => handleRating('hard')}
                    className="flex flex-col items-center justify-center p-2 rounded-lg bg-orange-500/20 hover:bg-orange-500/30 text-orange-300 border border-orange-500/50 transition-all"
                  >
                    <Meh className="w-5 h-5 mb-1" />
                    <span className="text-xs font-bold">Hard</span>
                    <span className="text-[10px] opacity-70">2d</span>
                  </button>
                  <button 
                    onClick={() => handleRating('good')}
                    className="flex flex-col items-center justify-center p-2 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 border border-blue-500/50 transition-all"
                  >
                    <Smile className="w-5 h-5 mb-1" />
                    <span className="text-xs font-bold">Good</span>
                    <span className="text-[10px] opacity-70">3d</span>
                  </button>
                  <button 
                    onClick={() => handleRating('easy')}
                    className="flex flex-col items-center justify-center p-2 rounded-lg bg-green-500/20 hover:bg-green-500/30 text-green-300 border border-green-500/50 transition-all"
                  >
                    <ThumbsUp className="w-5 h-5 mb-1" />
                    <span className="text-xs font-bold">Easy</span>
                    <span className="text-[10px] opacity-70">7d</span>
                  </button>
                </div>
              </div>

            </div>
          </div>
        </div>

        {/* Sidebar Stats (Desktop) */}
        <div className="w-full md:w-80 space-y-6">
           <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
              <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
                <BarChart2 className="w-4 h-4 text-indigo-500" /> Retention Stats
              </h3>
              
              <div className="h-48 w-full relative">
                 <ResponsiveContainer width="100%" height="100%">
                   <PieChart>
                     <Pie
                       data={chartData}
                       cx="50%"
                       cy="50%"
                       innerRadius={60}
                       outerRadius={80}
                       paddingAngle={5}
                       dataKey="value"
                     >
                       {chartData.map((entry, index) => (
                         <Cell key={`cell-${index}`} fill={entry.color} />
                       ))}
                     </Pie>
                     <Tooltip />
                   </PieChart>
                 </ResponsiveContainer>
                 <div className="absolute inset-0 flex items-center justify-center flex-col pointer-events-none">
                    <span className="text-2xl font-bold text-slate-800">{stats.total}</span>
                    <span className="text-xs text-slate-400 uppercase">Cards</span>
                 </div>
              </div>
              
              <div className="space-y-2 mt-2">
                 {chartData.map((d, i) => (
                   <div key={i} className="flex justify-between items-center text-sm">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{backgroundColor: d.color}}></div>
                        <span className="text-slate-600">{d.name}</span>
                      </div>
                      <span className="font-medium text-slate-800">{d.value}</span>
                   </div>
                 ))}
              </div>
           </div>

           <div className="bg-indigo-900 text-white rounded-2xl p-6 shadow-lg relative overflow-hidden">
              <div className="absolute -right-4 -top-4 opacity-10">
                <Clock className="w-32 h-32" />
              </div>
              <h3 className="font-bold text-lg mb-1">Keep it up!</h3>
              <p className="text-indigo-200 text-sm mb-4">
                Reviewing daily increases long-term retention by up to 80%.
              </p>
              <div className="flex items-center gap-2 text-xs font-medium bg-indigo-800/50 p-2 rounded-lg inline-block">
                <Calendar className="w-3 h-3" /> Next Review: {dueItems.length > 1 ? 'Now' : 'Tomorrow'}
              </div>
           </div>
        </div>
      </div>
    </div>
  );
};