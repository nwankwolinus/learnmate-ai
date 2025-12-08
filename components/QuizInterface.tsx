import React, { useState } from 'react';
import { QuizQuestion, QuizResult } from '../types';
import { generateQuiz } from '../services/geminiService';
import { CheckCircle, XCircle, Brain, Loader2, ArrowRight } from 'lucide-react';

export const QuizInterface: React.FC<{ onSaveResult: (result: QuizResult) => void }> = ({ onSaveResult }) => {
  const [topic, setTopic] = useState('');
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [score, setScore] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [quizComplete, setQuizComplete] = useState(false);

  const handleGenerate = async () => {
    if (!topic.trim()) return;
    setIsGenerating(true);
    setQuizComplete(false);
    setCurrentQuestionIndex(0);
    setScore(0);
    setQuestions([]);
    
    const quiz = await generateQuiz(topic);
    setQuestions(quiz);
    setIsGenerating(false);
  };

  const handleAnswer = (index: number) => {
    if (showFeedback) return;
    setSelectedAnswer(index);
    setShowFeedback(true);
    
    if (index === questions[currentQuestionIndex].correctAnswer) {
      setScore(prev => prev + 1);
    }
  };

  const handleNext = () => {
    setSelectedAnswer(null);
    setShowFeedback(false);
    
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
    } else {
      setQuizComplete(true);
      onSaveResult({
        score: score + (selectedAnswer === questions[currentQuestionIndex].correctAnswer ? 0 : 0), // Already added above
        total: questions.length,
        date: new Date().toISOString(),
        topic
      });
    }
  };

  if (isGenerating) {
    return (
      <div className="flex flex-col items-center justify-center h-96 text-slate-500">
        <Loader2 className="w-12 h-12 mb-4 animate-spin text-indigo-600" />
        <p className="text-lg">Generating a smart quiz about "{topic}"...</p>
      </div>
    );
  }

  if (questions.length === 0 && !quizComplete) {
    return (
      <div className="max-w-md mx-auto mt-10 p-6 bg-white rounded-2xl shadow-lg text-center">
        <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
           <Brain className="w-8 h-8 text-indigo-600" />
        </div>
        <h2 className="text-2xl font-bold text-slate-800 mb-2">Quiz Generator</h2>
        <p className="text-slate-500 mb-6">Enter a topic to generate a personalized practice quiz.</p>
        
        <input 
          type="text"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="e.g. Photosynthesis, World War II, React Hooks"
          className="w-full mb-4 px-4 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
        />
        <button 
          onClick={handleGenerate}
          disabled={!topic.trim()}
          className="w-full bg-indigo-600 text-white py-3 rounded-xl font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-50"
        >
          Generate Quiz
        </button>
      </div>
    );
  }

  if (quizComplete) {
    const percentage = Math.round((score / questions.length) * 100);
    return (
      <div className="max-w-md mx-auto mt-10 p-8 bg-white rounded-2xl shadow-lg text-center">
        <h2 className="text-3xl font-bold text-slate-800 mb-2">Quiz Complete!</h2>
        <div className="text-6xl font-black text-indigo-600 my-6">{percentage}%</div>
        <p className="text-slate-600 mb-8">You got {score} out of {questions.length} questions correct.</p>
        <button 
          onClick={() => { setQuestions([]); setTopic(''); }}
          className="bg-slate-900 text-white px-8 py-3 rounded-xl font-semibold hover:bg-slate-800"
        >
          Take Another Quiz
        </button>
      </div>
    );
  }

  const currentQ = questions[currentQuestionIndex];

  return (
    <div className="max-w-2xl mx-auto mt-6">
      <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
        {/* Progress Bar */}
        <div className="h-2 bg-slate-100">
           <div 
             className="h-full bg-indigo-500 transition-all duration-300" 
             style={{ width: `${((currentQuestionIndex) / questions.length) * 100}%` }}
           />
        </div>

        <div className="p-8">
           <div className="flex justify-between items-center mb-6">
             <span className="text-sm font-semibold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full">
               Question {currentQuestionIndex + 1} / {questions.length}
             </span>
             <span className="text-slate-400 text-sm">Topic: {topic}</span>
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
                   {currentQuestionIndex === questions.length - 1 ? "Finish" : "Next Question"} <ArrowRight className="w-4 h-4" />
                 </button>
               </div>
             </div>
           )}
        </div>
      </div>
    </div>
  );
};
