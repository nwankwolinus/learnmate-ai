import React, { useState } from 'react';
import { useStore } from '../store/useStore';
import { Calendar, Clock, BookOpen, Loader2, AlertCircle } from 'lucide-react';

export const PlanInterface: React.FC = () => {
  const [topic, setTopic] = useState('');
  const [duration, setDuration] = useState('2 hours');
  
  const { 
    currentPlan, 
    isPlanLoading, 
    planError, 
    createPlan, 
    resetPlan 
  } = useStore();

  const handleCreatePlan = () => {
    if (topic) createPlan(topic, duration);
  };

  return (
    <div className="max-w-4xl mx-auto">
      {!currentPlan && (
        <div className="bg-white rounded-2xl shadow-xl p-8 mb-6">
           <h2 className="text-2xl font-bold text-slate-800 mb-6 flex items-center gap-2">
             <Calendar className="w-6 h-6 text-indigo-600" /> Study Plan Generator
           </h2>
           
           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
             <div>
               <label className="block text-sm font-medium text-slate-700 mb-2">Subject / Topic</label>
               <input 
                 type="text" 
                 value={topic}
                 onChange={(e) => setTopic(e.target.value)}
                 className="w-full rounded-xl border-slate-300 focus:ring-indigo-500 focus:border-indigo-500"
                 placeholder="e.g. Introduction to Calculus"
               />
             </div>
             <div>
               <label className="block text-sm font-medium text-slate-700 mb-2">Available Time</label>
               <select 
                 value={duration}
                 onChange={(e) => setDuration(e.target.value)}
                 className="w-full rounded-xl border-slate-300 focus:ring-indigo-500 focus:border-indigo-500"
               >
                 <option>30 minutes</option>
                 <option>1 hour</option>
                 <option>2 hours</option>
                 <option>4 hours</option>
                 <option>1 day</option>
                 <option>1 week</option>
               </select>
             </div>
           </div>

           {planError && (
             <div className="mt-4 p-3 bg-red-50 text-red-700 text-sm rounded-lg flex items-center gap-2">
               <AlertCircle className="w-4 h-4" /> {planError}
             </div>
           )}

           <button 
             onClick={handleCreatePlan}
             disabled={isPlanLoading || !topic}
             className="mt-6 w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 transition-colors flex justify-center items-center gap-2 disabled:opacity-50"
           >
             {isPlanLoading ? <Loader2 className="animate-spin" /> : "Create Personalized Plan"}
           </button>
        </div>
      )}

      {currentPlan && (
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
           <div className="bg-indigo-600 p-8 text-white">
             <h1 className="text-3xl font-bold mb-2">{currentPlan.topic}</h1>
             <div className="flex items-center gap-2 opacity-90">
               <Clock className="w-4 h-4" /> Total Duration: {currentPlan.totalDuration}
             </div>
             <button 
               onClick={resetPlan}
               className="mt-4 text-xs bg-indigo-500 hover:bg-indigo-400 px-3 py-1 rounded-full transition-colors"
             >
               Create New Plan
             </button>
           </div>
           
           <div className="p-8">
             <div className="relative border-l-2 border-indigo-100 ml-4 space-y-10">
                {currentPlan.items.map((item, idx) => (
                  <div key={idx} className="relative pl-8">
                    <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-indigo-600 border-4 border-white shadow-sm" />
                    
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-2">
                      <h3 className="text-lg font-bold text-slate-800">{item.title}</h3>
                      <span className="text-xs font-semibold bg-slate-100 text-slate-500 px-2 py-1 rounded">
                        {item.duration}
                      </span>
                    </div>
                    
                    <p className="text-slate-600 mb-3">{item.description}</p>
                    
                    {item.resources && item.resources.length > 0 && (
                      <div className="bg-slate-50 p-3 rounded-lg">
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2 flex items-center gap-1">
                          <BookOpen className="w-3 h-3" /> Recommended Resources
                        </h4>
                        <ul className="text-sm text-indigo-600 space-y-1">
                          {item.resources.map((res, i) => (
                            <li key={i} className="hover:underline cursor-pointer">{res}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ))}
             </div>
           </div>
        </div>
      )}
    </div>
  );
};
