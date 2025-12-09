import React, { useState } from 'react';
import { useStore } from '../store/useStore';
import { CheckCircle, XCircle, Brain, Loader2, ArrowRight, AlertTriangle, X } from 'lucide-react';

export const QuizInterface: React.FC = () => {
  const { 
    quizTopic, 
    setQuizTopic, 
    quizQuestions, 
    isQuizGenerating, 
    quizError,
    generateQuizAction,
    saveQuizResult,
    clearQuiz,
    addQuizToSRS
  } = useStore();

  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [score, setScore] = useState(0);
  const [quizComplete, setQuizComplete] = useState(false);
  const [userAnswers, setUserAnswers] = useState<(number | null)[]>([]);

  const handleGenerate = () => {
    if (quizTopic.trim()) {
      setQuizComplete(false);
      setCurrentQuestionIndex(0);
      setScore(0);
      setUserAnswers([]);
      generateQuizAction(quizTopic);
    }
  };

  const handleAnswer = (index: number) => {
    if (showFeedback) return;
    setSelectedAnswer(index);
    setShowFeedback(true);
    
    // Track answer for SRS
    const newAnswers = [...userAnswers];
    newAnswers[currentQuestionIndex] = index;
    setUserAnswers(newAnswers);

    if (index === quizQuestions[currentQuestionIndex].correctAnswer) {
      setScore(prev => prev + 1);
    }
  };

  const handleNext = () => {
    setSelectedAnswer(null);
    setShowFeedback(false);
    
    if (currentQuestionIndex < quizQuestions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
    } else {
      setQuizComplete(true);
      
      const result = {
        score: score + (selectedAnswer === quizQuestions[currentQuestionIndex].correctAnswer ? 0 : 0),
        total: quizQuestions.length,
        date: new Date().toISOString(),
        topic: quizTopic
      };
      
      saveQuizResult(result);
      
      // Auto-add to Spaced Repetition System
      addQuizToSRS(quizQuestions, userAnswers, quizTopic);
    }
  };

  const resetLocal = () => {
    clearQuiz();
    setScore(0);
    setQuizComplete(false);
    setCurrentQuestionIndex(0);
    setSelectedAnswer(null);
    setShowFeedback(false);
    setUserAnswers([]);
  };

  if (isQuizGenerating) {
    return (
      <div className="flex flex-col items-center justify-center h-96 text-slate-500">
        <Loader2 className="w-12 h-12 mb-4 animate-spin text-indigo-600" />
        <p className="text-lg">Generating a smart quiz about "{quizTopic}"...</p>
      </div>
    );
  }

  if (quizError) {
    return (
      <div className="flex flex-col items-center justify-center h-96 text-red-500">
        <AlertTriangle className="w-12 h-12 mb-4" />
        <p className="text-lg font-semibold">{quizError}</p>
        <button onClick={resetLocal} className="mt-4 text-indigo-600 hover:underline">Try Again</button>
      </div>
    );
  }

  if (quizQuestions.length === 0 && !quizComplete) {
    return (
      <div className="max-w-md mx-auto mt-10 p-6 bg-white rounded-2xl shadow-lg text-center">
        <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
           <Brain className="w-8 h-8 text-indigo-600" />
        </div>
        <h2 className="text-2xl font-bold text-slate-800 mb-2">Quiz Generator</h2>
        <p className="text-slate-500 mb-6">Enter a topic to generate a personalized practice quiz.</p>
        
        <input 
          type="text"
          value={quizTopic}
          onChange={(e) => setQuizTopic(e.target.value)}
          placeholder="e.g. Photosynthesis, World War II"
          className="w-full mb-4 px-4 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
        />
        <button 
          onClick={handleGenerate}
          disabled={!quizTopic.trim()}
          className="w-full bg-indigo-600 text-white py-3 rounded-xl font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-50"
        >
          Generate Quiz
        </button>
      </div>
    );
  }

  if (quizComplete) {
    const percentage = Math.round((score / quizQuestions.length) * 100);
    return (
      <div className="max-w-md mx-auto mt-10 p-8 bg-white rounded-2xl shadow-lg text-center">
        <h2 className="text-3xl font-bold text-slate-800 mb-2">Quiz Complete!</h2>
        <div className="text-6xl font-black text-indigo-600 my-6">{percentage}%</div>
        <p className="text-slate-600 mb-2">You got {score} out of {quizQuestions.length} questions correct.</p>
        
        <div className="bg-green-50 text-green-700 p-3 rounded-lg text-sm mb-8 flex items-center justify-center gap-2">
          <CheckCircle className="w-4 h-4" /> Questions added to Smart Review
        </div>

        <button 
          onClick={resetLocal}
          className="bg-slate-900 text-white px-8 py-3 rounded-xl font-semibold hover:bg-slate-800 transition-colors"
        >
          Take Another Quiz
        </button>
      </div>
    );
  }

  const currentQ = quizQuestions[currentQuestionIndex];

  return (
    <div className="max-w-2xl mx-auto mt-6">
      <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
        {/* Progress Bar */}
        <div className="h-2 bg-slate-100">
           <div 
             className="h-full bg-indigo-500 transition-all duration-300" 
             style={{ width: `${((currentQuestionIndex) / quizQuestions.length) * 100}%` }}
           />
        </div>

        <div className="p-8">
           <div className="flex justify-between items-center mb-6">
             <div className="flex items-center gap-3">
               <span className="text-sm font-semibold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full">
                 Question {currentQuestionIndex + 1} / {quizQuestions.length}
               </span>
               <span className="text-slate-400 text-sm hidden sm:inline">Topic: {quizTopic}</span>
             </div>
             
             <button 
               onClick={resetLocal}
               className="text-slate-400 hover:text-red-500 transition-colors flex items-center gap-1 text-xs uppercase font-bold tracking-wider"
               title="Exit Quiz"
             >
               Exit <X className="w-4 h-4" />
             </button>
           </div>

           <h3 className="text-xl font-bold text-slate-800 mb-6 leading-relaxed">
             {currentQ.question}
           </h3>

           <div className="space-y-3">
             {currentQ.options.map((option, idx) => {
               let btnClass = "w-full text-left p-4 rounded-xl border-2 transition-all ";
               
               if (showFeedback) {
                  if (idx === currentQ.correctAnswer) {
                     btnClass += "border-green-500 bg-green-50 text-green-800";
                  } else if (idx === selectedAnswer) {
                     btnClass += "border-red-500 bg-red-50 text-red-800";
                  } else {
                     btnClass += "border-slate-100 opacity-50";
                  }
               } else {
                  btnClass += "border-slate-200 hover:border-indigo-400 hover:bg-indigo-50 text-slate-700";
               }

               return (
                 <button 
                   key={idx}
                   onClick={() => handleAnswer(idx)}
                   disabled={showFeedback}
                   className={btnClass}
                 >
                   <div className="flex items-center justify-between">
                      <span>{option}</span>
                      {showFeedback && idx === currentQ.correctAnswer && <CheckCircle className="w-5 h-5 text-green-600" />}
                      {showFeedback && idx === selectedAnswer && idx !== currentQ.correctAnswer && <XCircle className="w-5 h-5 text-red-600" />}
                   </div>
                 </button>
               );
             })}
           </div>

           {showFeedback && (
             <div className="mt-6 p-4 bg-blue-50 border border-blue-100 rounded-xl text-blue-800 animate-in fade-in slide-in-from-bottom-2">
               <span className="font-bold">Explanation:</span> {currentQ.explanation}
               <div className="mt-4 flex justify-end">
                 <button 
                   onClick={handleNext}
                   className="flex items-center gap-2 bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
                 >
                   {currentQuestionIndex === quizQuestions.length - 1 ? "Finish" : "Next Question"} <ArrowRight className="w-4 h-4" />
                 </button>
               </div>
             </div>
           )}
        </div>
      </div>
    </div>
  );
};