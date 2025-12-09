import React, { useMemo, useState, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, CartesianGrid, AreaChart, Area, 
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Legend, ComposedChart, Line 
} from 'recharts';
import { 
  Trophy, Target, Book, Flame, Calendar as CalendarIcon, Clock, TrendingUp, 
  Download, Sparkles, Brain, AlertCircle, BarChart2
} from 'lucide-react';
import { 
  processActivityTrends, 
  processTopicMastery, 
  processHourlyPerformance, 
  processLearningVelocity,
  processWeeklyComparison
} from '../services/analyticsUtils';
import { generateProgressInsights } from '../services/geminiService';
import { generateProgressReportPDF } from '../services/exportService';
import { AIProgressInsights } from '../types';

export const ProgressDashboard: React.FC = () => {
  const { quizResults, streak, settings, user } = useStore();
  const [insights, setInsights] = useState<AIProgressInsights | null>(null);
  const [isLoadingInsights, setIsLoadingInsights] = useState(false);
  const [timeRange, setTimeRange] = useState<30 | 7 | 90>(30);

  // --- Data Processing ---
  const activityData = useMemo(() => processActivityTrends(streak.activityHistory, timeRange), [streak.activityHistory, timeRange]);
  const masteryData = useMemo(() => processTopicMastery(quizResults), [quizResults]);
  const hourlyData = useMemo(() => processHourlyPerformance(quizResults), [quizResults]);
  const velocityData = useMemo(() => processLearningVelocity(quizResults), [quizResults]);
  const weeklyComparisonData = useMemo(() => processWeeklyComparison(streak.activityHistory), [streak.activityHistory]);

  const totalQuizzes = quizResults.length;
  const avgScore = totalQuizzes > 0 
    ? Math.round(quizResults.reduce((acc, curr) => acc + (curr.score / curr.total) * 100, 0) / totalQuizzes)
    : 0;

  // --- AI Insights Generation ---
  useEffect(() => {
    const fetchInsights = async () => {
       if (totalQuizzes < 3 && Object.keys(streak.activityHistory).length < 3) return; // Need some data
       setIsLoadingInsights(true);
       try {
         const stats = {
            avgScore,
            totalQuizzes,
            recentActivity: activityData.slice(-7),
            mastery: masteryData
         };
         const result = await generateProgressInsights(stats);
         setInsights(result);
       } catch (e) {
         console.error("Failed to generate insights", e);
       } finally {
         setIsLoadingInsights(false);
       }
    };
    fetchInsights();
  }, [totalQuizzes, avgScore]); // Only regenerate if core stats change significantly

  const handleExportPDF = () => {
     if (!insights) return;
     generateProgressReportPDF(user, streak, insights);
  };

  // Helper for Heatmap
  const getHeatmapColor = (minutes: number) => {
    if (minutes === 0) return 'bg-slate-100';
    if (minutes < 15) return 'bg-indigo-200';
    if (minutes < 30) return 'bg-indigo-400';
    if (minutes < 60) return 'bg-indigo-600';
    return 'bg-indigo-800';
  };

  const heatmapDays = useMemo(() => {
    const days = [];
    const today = new Date();
    // Show last ~3 months roughly
    for (let i = 84; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      days.push({
        date: d,
        dateStr,
        minutes: streak.activityHistory[dateStr] || 0
      });
    }
    return days;
  }, [streak.activityHistory]);

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-20">
       
       {/* Header Controls */}
       <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-2">
          <div>
            <h2 className="text-3xl font-bold text-slate-800">Analytics & Insights</h2>
            <p className="text-slate-500">Track your knowledge growth and optimization metrics.</p>
          </div>
          
          <div className="flex items-center gap-3">
             <div className="bg-white rounded-lg border border-slate-200 p-1 flex">
                <button 
                  onClick={() => setTimeRange(7)}
                  className={`px-3 py-1 text-sm font-medium rounded-md transition-all ${timeRange === 7 ? 'bg-indigo-100 text-indigo-700' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  7 Days
                </button>
                <button 
                  onClick={() => setTimeRange(30)}
                  className={`px-3 py-1 text-sm font-medium rounded-md transition-all ${timeRange === 30 ? 'bg-indigo-100 text-indigo-700' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  30 Days
                </button>
                <button 
                  onClick={() => setTimeRange(90)}
                  className={`px-3 py-1 text-sm font-medium rounded-md transition-all ${timeRange === 90 ? 'bg-indigo-100 text-indigo-700' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  3 Months
                </button>
             </div>
             <button 
               onClick={handleExportPDF}
               disabled={!insights}
               className="bg-slate-900 text-white px-4 py-2 rounded-lg font-medium hover:bg-slate-800 flex items-center gap-2 disabled:opacity-50"
             >
               <Download className="w-4 h-4" /> Export Report
             </button>
          </div>
       </div>

       {/* AI Insights Card */}
       <div className="bg-gradient-to-br from-indigo-900 to-purple-900 rounded-3xl p-8 text-white shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-10">
             <Sparkles className="w-64 h-64" />
          </div>
          
          <h3 className="text-xl font-bold mb-6 flex items-center gap-2 relative z-10">
             <Brain className="w-6 h-6 text-indigo-300" /> AI Performance Analysis
          </h3>

          {isLoadingInsights ? (
             <div className="animate-pulse space-y-4 max-w-2xl">
                <div className="h-4 bg-white/20 rounded w-3/4"></div>
                <div className="h-4 bg-white/20 rounded w-1/2"></div>
                <div className="h-4 bg-white/20 rounded w-5/6"></div>
             </div>
          ) : insights ? (
             <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative z-10">
                <div className="space-y-6">
                   <div>
                      <h4 className="text-indigo-300 text-sm font-bold uppercase tracking-wider mb-2">Executive Summary</h4>
                      <p className="text-lg leading-relaxed text-indigo-50 font-medium">
                         {insights.summary}
                      </p>
                   </div>
                   
                   <div>
                      <h4 className="text-indigo-300 text-sm font-bold uppercase tracking-wider mb-2">Predicted Mastery</h4>
                      <div className="flex items-center gap-3 bg-white/10 p-4 rounded-xl border border-white/10">
                         <TrendingUp className="w-8 h-8 text-green-400" />
                         <p className="font-bold">{insights.prediction}</p>
                      </div>
                   </div>
                </div>

                <div className="space-y-6">
                   <div className="bg-red-500/20 border border-red-500/30 p-4 rounded-xl">
                      <h4 className="text-red-200 text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-2">
                         <AlertCircle className="w-4 h-4" /> Focus Areas
                      </h4>
                      <div className="flex flex-wrap gap-2">
                         {insights.weakAreas.length > 0 ? insights.weakAreas.map(area => (
                            <span key={area} className="bg-red-500/30 px-3 py-1 rounded-full text-sm font-medium">
                               {area}
                            </span>
                         )) : <span className="text-white/80">No significant weak areas detected!</span>}
                      </div>
                   </div>

                   <div className="bg-indigo-500/20 border border-indigo-400/30 p-4 rounded-xl">
                      <h4 className="text-indigo-200 text-xs font-bold uppercase tracking-wider mb-2">
                         Recommended Actions
                      </h4>
                      <ul className="space-y-2">
                         {insights.tips.map((tip, idx) => (
                            <li key={idx} className="flex items-start gap-2 text-sm">
                               <span className="text-indigo-400 mt-1">•</span> {tip}
                            </li>
                         ))}
                      </ul>
                   </div>
                </div>
             </div>
          ) : (
             <p className="text-indigo-200">
               Complete at least 3 quizzes to unlock personalized AI insights and predictions.
             </p>
          )}
       </div>

       {/* Metric Cards Grid */}
       <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
         <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <div className="flex items-center gap-3 mb-2">
               <div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><Clock className="w-5 h-5"/></div>
               <span className="text-slate-500 text-sm font-medium">Total Study Time</span>
            </div>
            <p className="text-2xl font-bold text-slate-800">
               {(Object.values(streak.activityHistory) as number[]).reduce((a, b) => a + b, 0)} <span className="text-sm font-normal text-slate-400">min</span>
            </p>
         </div>
         <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <div className="flex items-center gap-3 mb-2">
               <div className="p-2 bg-green-50 text-green-600 rounded-lg"><Trophy className="w-5 h-5"/></div>
               <span className="text-slate-500 text-sm font-medium">Avg Accuracy</span>
            </div>
            <p className="text-2xl font-bold text-slate-800">
               {avgScore}%
            </p>
         </div>
         <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <div className="flex items-center gap-3 mb-2">
               <div className="p-2 bg-orange-50 text-orange-600 rounded-lg"><Flame className="w-5 h-5"/></div>
               <span className="text-slate-500 text-sm font-medium">Current Streak</span>
            </div>
            <p className="text-2xl font-bold text-slate-800">
               {streak.currentStreak} <span className="text-sm font-normal text-slate-400">days</span>
            </p>
         </div>
         <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <div className="flex items-center gap-3 mb-2">
               <div className="p-2 bg-purple-50 text-purple-600 rounded-lg"><Target className="w-5 h-5"/></div>
               <span className="text-slate-500 text-sm font-medium">Quizzes Taken</span>
            </div>
            <p className="text-2xl font-bold text-slate-800">{totalQuizzes}</p>
         </div>
       </div>

       {/* Consistency Heatmap */}
       <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
         <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2">
           <CalendarIcon className="w-5 h-5 text-indigo-500" /> Study Consistency (Last 3 Months)
         </h3>
         <div className="flex flex-wrap gap-1 md:gap-2 justify-center">
            {heatmapDays.map((day, i) => (
              <div 
                key={i}
                className={`w-3 h-3 md:w-4 md:h-4 rounded-sm ${getHeatmapColor(day.minutes)} transition-colors hover:ring-2 hover:ring-offset-1 hover:ring-indigo-400 cursor-help`}
                title={`${day.date.toDateString()}: ${day.minutes} mins`}
              />
            ))}
         </div>
         <div className="flex items-center justify-end gap-2 mt-4 text-xs text-slate-400">
            <span>Less</span>
            <div className="flex gap-1">
              <div className="w-3 h-3 bg-slate-100 rounded-sm"></div>
              <div className="w-3 h-3 bg-indigo-200 rounded-sm"></div>
              <div className="w-3 h-3 bg-indigo-400 rounded-sm"></div>
              <div className="w-3 h-3 bg-indigo-600 rounded-sm"></div>
              <div className="w-3 h-3 bg-indigo-800 rounded-sm"></div>
            </div>
            <span>More</span>
         </div>
       </div>

       {/* Charts Layout */}
       <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Study Trends (Area Chart) */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
             <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-indigo-500" /> Study Activity Trend
             </h3>
             <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                   <AreaChart data={activityData}>
                      <defs>
                        <linearGradient id="colorMins" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#94a3b8'}} />
                      <YAxis axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#94a3b8'}} />
                      <RechartsTooltip 
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                      />
                      <Area type="monotone" dataKey="minutes" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorMins)" />
                   </AreaChart>
                </ResponsiveContainer>
             </div>
          </div>

          {/* Weekly Comparison (Bar Chart) */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
             <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2">
                <BarChart2 className="w-5 h-5 text-purple-500" /> This Week vs Last Week
             </h3>
             <div className="h-72">
               <ResponsiveContainer width="100%" height="100%">
                 <BarChart data={weeklyComparisonData} barGap={8}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#94a3b8'}} />
                    <YAxis axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#94a3b8'}} />
                    <RechartsTooltip contentStyle={{ borderRadius: '12px' }} cursor={{fill: 'transparent'}} />
                    <Legend iconType="circle" />
                    <Bar dataKey="thisWeek" name="This Week" fill="#8b5cf6" radius={[4, 4, 0, 0]} barSize={20} />
                    <Bar dataKey="lastWeek" name="Last Week" fill="#e2e8f0" radius={[4, 4, 0, 0]} barSize={20} />
                 </BarChart>
               </ResponsiveContainer>
             </div>
          </div>

          {/* Topic Mastery (Radar Chart) */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
             <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2">
                <Target className="w-5 h-5 text-emerald-500" /> Topic Mastery
             </h3>
             {masteryData.length > 2 ? (
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                     <RadarChart cx="50%" cy="50%" outerRadius="80%" data={masteryData}>
                        <PolarGrid stroke="#e2e8f0" />
                        <PolarAngleAxis dataKey="subject" tick={{ fill: '#64748b', fontSize: 11 }} />
                        <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                        <Radar name="Mastery" dataKey="score" stroke="#10b981" strokeWidth={2} fill="#10b981" fillOpacity={0.4} />
                        <RechartsTooltip contentStyle={{ borderRadius: '12px' }} />
                     </RadarChart>
                  </ResponsiveContainer>
                </div>
             ) : (
                <div className="h-72 flex items-center justify-center text-slate-400 text-sm text-center px-8">
                   Take quizzes in at least 3 different topics to unlock the mastery radar.
                </div>
             )}
          </div>

          {/* Learning Velocity (Composed) */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 lg:col-span-2">
             <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-orange-500" /> Learning Velocity (Topics vs Accuracy)
             </h3>
             <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                   <ComposedChart data={velocityData}>
                      <CartesianGrid stroke="#f1f5f9" vertical={false} />
                      <XAxis dataKey="date" scale="point" padding={{ left: 20, right: 20 }} tickLine={false} axisLine={false} tick={{fontSize: 12, fill: '#94a3b8'}} />
                      <YAxis yAxisId="left" orientation="left" stroke="#f97316" tickLine={false} axisLine={false} tick={{fontSize: 12}} />
                      <YAxis yAxisId="right" orientation="right" stroke="#6366f1" tickLine={false} axisLine={false} tick={{fontSize: 12}} />
                      <RechartsTooltip contentStyle={{ borderRadius: '12px' }} />
                      <Legend />
                      <Bar yAxisId="left" dataKey="topicsCovered" name="Topics Covered" barSize={20} fill="#f97316" radius={[4, 4, 0, 0]} />
                      <Line yAxisId="right" type="monotone" dataKey="avgAccuracy" name="Avg Accuracy %" stroke="#6366f1" strokeWidth={3} dot={{r: 4}} />
                   </ComposedChart>
                </ResponsiveContainer>
             </div>
          </div>

          {/* Hourly Performance (Bar Chart) */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 lg:col-span-2">
             <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2">
                <Clock className="w-5 h-5 text-blue-500" /> Hourly Performance
             </h3>
             <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                   <BarChart data={hourlyData.filter(h => h.quizzes > 0)}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#94a3b8'}} />
                      <YAxis axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#94a3b8'}} />
                      <RechartsTooltip contentStyle={{ borderRadius: '12px' }} />
                      <Bar dataKey="score" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Avg Score %" />
                   </BarChart>
                </ResponsiveContainer>
             </div>
             <p className="text-xs text-center text-slate-400 mt-2">Shows your average quiz score based on the time of day you studied.</p>
          </div>

       </div>

    </div>
  );
};