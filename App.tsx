import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, NavLink, Navigate } from 'react-router-dom';
import { BookOpen, Brain, Calendar, BarChart3, GraduationCap } from 'lucide-react';
import { ChatInterface } from './components/ChatInterface';
import { QuizInterface } from './components/QuizInterface';
import { PlanInterface } from './components/PlanInterface';
import { ProgressDashboard } from './components/ProgressDashboard';
import { QuizResult } from './types';

function App() {
  // Simple local storage persistence for progress
  const [results, setResults] = useState<QuizResult[]>(() => {
    const saved = localStorage.getItem('learnmate_results');
    return saved ? JSON.parse(saved) : [];
  });

  const saveResult = (result: QuizResult) => {
    const newResults = [...results, result];
    setResults(newResults);
    localStorage.setItem('learnmate_results', JSON.stringify(newResults));
  };

  return (
    <HashRouter>
      <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
        
        {/* Navigation Sidebar (Desktop) / Bottom Bar (Mobile) could be implemented here. 
            For simplicity in this layout, we'll use a Top Navigation Bar. */}
        <nav className="bg-white border-b border-slate-200 sticky top-0 z-50">
          <div className="max-w-6xl mx-auto px-4">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
                   <GraduationCap className="text-white w-5 h-5" />
                </div>
                <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600">
                  LearnMate AI
                </span>
              </div>
              
              <div className="hidden md:flex space-x-1">
                <NavLink to="/learn" className={({isActive}) => `px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${isActive ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:text-indigo-600 hover:bg-slate-50'}`}>
                   <BookOpen className="w-4 h-4" /> Learn
                </NavLink>
                <NavLink to="/quiz" className={({isActive}) => `px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${isActive ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:text-indigo-600 hover:bg-slate-50'}`}>
                   <Brain className="w-4 h-4" /> Quiz
                </NavLink>
                <NavLink to="/plan" className={({isActive}) => `px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${isActive ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:text-indigo-600 hover:bg-slate-50'}`}>
                   <Calendar className="w-4 h-4" /> Study Plan
                </NavLink>
                <NavLink to="/progress" className={({isActive}) => `px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${isActive ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:text-indigo-600 hover:bg-slate-50'}`}>
                   <BarChart3 className="w-4 h-4" /> Progress
                </NavLink>
              </div>
            </div>
          </div>
          
          {/* Mobile Nav */}
          <div className="md:hidden border-t border-slate-100 flex justify-around p-2 bg-white">
             <NavLink to="/learn" className={({isActive}) => `p-2 rounded-lg ${isActive ? 'text-indigo-600' : 'text-slate-400'}`}><BookOpen className="w-6 h-6" /></NavLink>
             <NavLink to="/quiz" className={({isActive}) => `p-2 rounded-lg ${isActive ? 'text-indigo-600' : 'text-slate-400'}`}><Brain className="w-6 h-6" /></NavLink>
             <NavLink to="/plan" className={({isActive}) => `p-2 rounded-lg ${isActive ? 'text-indigo-600' : 'text-slate-400'}`}><Calendar className="w-6 h-6" /></NavLink>
             <NavLink to="/progress" className={({isActive}) => `p-2 rounded-lg ${isActive ? 'text-indigo-600' : 'text-slate-400'}`}><BarChart3 className="w-6 h-6" /></NavLink>
          </div>
        </nav>

        <main className="max-w-6xl mx-auto p-4 md:p-6 lg:p-8">
          <Routes>
            <Route path="/" element={<Navigate to="/learn" replace />} />
            <Route path="/learn" element={<ChatInterface />} />
            <Route path="/quiz" element={<QuizInterface onSaveResult={saveResult} />} />
            <Route path="/plan" element={<PlanInterface />} />
            <Route path="/progress" element={<ProgressDashboard results={results} />} />
          </Routes>
        </main>
      </div>
    </HashRouter>
  );
}

export default App;
