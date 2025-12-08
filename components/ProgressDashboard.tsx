import React from 'react';
import { useStore } from '../store/useStore';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Trophy, Target, Book } from 'lucide-react';

export const ProgressDashboard: React.FC = () => {
  const { quizResults: results } = useStore();

  const totalQuizzes = results.length;
  const avgScore = results.length > 0 
    ? Math.round((results.reduce((acc, curr) => acc + (curr.score / curr.total) * 100, 0) / totalQuizzes))
    : 0;
  
  const uniqueTopics = new Set(results.map(r => r.topic)).size;

  // Prepare data for chart (Last 7 quizzes)
  const chartData = results.slice(-7).map((r, i) => ({
    name: r.topic.length > 10 ? r.topic.substring(0, 10) + '...' : r.topic,
    score: Math.round((r.score / r.total) * 100)
  }));

  return (
    <div className="max-w-4xl mx-auto space-y-6">
       <h2 className="text-2xl font-bold text-slate-800 mb-6">Your Learning Progress</h2>
       
       <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
         <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl p-6 text-white shadow-lg">
            <div className="flex items-center gap-4 mb-2">
               <div className="p-3 bg-white/20 rounded-lg"><Trophy className="w-6 h-6" /></div>
               <div>
                 <p className="text-sm opacity-80">Average Score</p>
                 <p className="text-2xl font-bold">{avgScore}%</p>
               </div>
            </div>
         </div>
         
         <div className="bg-white rounded-2xl p-6 shadow-lg border border-slate-100">
            <div className="flex items-center gap-4 mb-2">
               <div className="p-3 bg-indigo-50 text-indigo-600 rounded-lg"><Target className="w-6 h-6" /></div>
               <div>
                 <p className="text-sm text-slate-500">Quizzes Taken</p>
                 <p className="text-2xl font-bold text-slate-800">{totalQuizzes}</p>
               </div>
            </div>
         </div>

         <div className="bg-white rounded-2xl p-6 shadow-lg border border-slate-100">
            <div className="flex items-center gap-4 mb-2">
               <div className="p-3 bg-green-50 text-green-600 rounded-lg"><Book className="w-6 h-6" /></div>
               <div>
                 <p className="text-sm text-slate-500">Topics Covered</p>
                 <p className="text-2xl font-bold text-slate-800">{uniqueTopics}</p>
               </div>
            </div>
         </div>
       </div>

       <div className="bg-white rounded-2xl p-8 shadow-lg border border-slate-100">
          <h3 className="text-lg font-bold text-slate-800 mb-6">Recent Performance</h3>
          {results.length > 0 ? (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                   <CartesianGrid strokeDasharray="3 3" vertical={false} />
                   <XAxis dataKey="name" axisLine={false} tickLine={false} />
                   <YAxis hide />
                   <Tooltip 
                     contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                   />
                   <Bar dataKey="score" fill="#6366f1" radius={[6, 6, 0, 0]} barSize={40} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-40 flex items-center justify-center text-slate-400">
              No quiz data yet. Take a quiz to see your stats!
            </div>
          )}
       </div>

       <div className="bg-white rounded-2xl p-8 shadow-lg border border-slate-100">
          <h3 className="text-lg font-bold text-slate-800 mb-4">Learning History</h3>
          <div className="divide-y divide-slate-100">
            {results.slice().reverse().map((r, idx) => (
              <div key={idx} className="py-4 flex justify-between items-center">
                 <div>
                   <p className="font-semibold text-slate-800">{r.topic}</p>
                   <p className="text-xs text-slate-500">{new Date(r.date).toLocaleDateString()}</p>
                 </div>
                 <div className={`px-3 py-1 rounded-full text-sm font-bold ${
                   (r.score / r.total) >= 0.8 ? 'bg-green-100 text-green-700' :
                   (r.score / r.total) >= 0.5 ? 'bg-yellow-100 text-yellow-700' :
                   'bg-red-100 text-red-700'
                 }`}>
                   {r.score}/{r.total}
                 </div>
              </div>
            ))}
            {results.length === 0 && <p className="text-slate-400">No history available.</p>}
          </div>
       </div>
    </div>
  );
};
