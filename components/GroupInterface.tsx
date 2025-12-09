import React, { useState, useEffect, useRef } from 'react';
import { useStore } from '../store/useStore';
import { 
  Users, Plus, LogIn, MessageSquare, ClipboardList, Trophy, 
  Send, Brain, Crown, X, Copy, Check, Loader2, ArrowRight
} from 'lucide-react';

export const GroupInterface: React.FC = () => {
  const { 
    user, openAuthModal, 
    currentGroup, groupMembers, groupMessages, 
    groupLoading, groupError,
    createGroup, joinGroup, leaveGroup, sendGroupMessage,
    startGroupQuiz, submitGroupQuizAnswer, nextGroupQuizQuestion, endGroupQuiz
  } = useStore();

  const [activeTab, setActiveTab] = useState<'chat' | 'quiz' | 'plan'>('chat');
  
  // Dashboard State
  const [mode, setMode] = useState<'view' | 'create' | 'join'>('view');
  const [newGroupName, setNewGroupName] = useState('');
  const [joinCode, setJoinCode] = useState('');

  // Chat State
  const [messageInput, setMessageInput] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Quiz State
  const [quizTopic, setQuizTopic] = useState('');
  
  // Copy Code State
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [groupMessages, activeTab]);

  const handleCreate = async () => {
    if (newGroupName.trim()) {
      await createGroup(newGroupName, "Study Group", true);
    }
  };

  const handleJoin = async () => {
    if (joinCode.trim()) {
      await joinGroup(joinCode.toUpperCase());
    }
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (messageInput.trim()) {
      await sendGroupMessage(messageInput);
      setMessageInput('');
    }
  };

  const copyCode = () => {
    if (currentGroup) {
      navigator.clipboard.writeText(currentGroup.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center p-8">
        <div className="w-20 h-20 bg-indigo-50 rounded-full flex items-center justify-center mb-6">
          <Users className="w-10 h-10 text-indigo-600" />
        </div>
        <h2 className="text-2xl font-bold text-slate-800 mb-2">Collaborative Study Groups</h2>
        <p className="text-slate-500 max-w-md mb-6">
          Sign in to join study groups, chat with peers, compete in live quizzes, and share study plans.
        </p>
        <button 
          onClick={openAuthModal}
          className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-indigo-700 transition-colors flex items-center gap-2"
        >
          <LogIn className="w-5 h-5" /> Sign In to Start
        </button>
      </div>
    );
  }

  // --- DASHBOARD VIEW ---
  if (!currentGroup) {
    return (
      <div className="max-w-4xl mx-auto py-8">
        <h1 className="text-2xl font-bold text-slate-800 mb-8 flex items-center gap-2">
          <Users className="w-7 h-7 text-indigo-600" /> Study Groups
        </h1>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Join Group Card */}
          <div className="bg-white p-8 rounded-2xl shadow-lg border border-slate-100 flex flex-col items-center text-center">
            <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mb-4">
              <LogIn className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold text-slate-800 mb-2">Join a Group</h2>
            <p className="text-slate-500 mb-6 text-sm">Enter an invite code to join an existing study circle.</p>
            
            <div className="w-full max-w-xs space-y-3">
              <input 
                type="text" 
                placeholder="Enter 6-digit Code"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                className="w-full text-center tracking-widest font-mono text-lg p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none uppercase"
                maxLength={6}
              />
              <button 
                onClick={handleJoin}
                disabled={groupLoading || joinCode.length < 6}
                className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {groupLoading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : "Join Group"}
              </button>
            </div>
            {groupError && <p className="text-red-500 text-sm mt-3">{groupError}</p>}
          </div>

          {/* Create Group Card */}
          <div className="bg-white p-8 rounded-2xl shadow-lg border border-slate-100 flex flex-col items-center text-center">
            <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mb-4">
              <Plus className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold text-slate-800 mb-2">Create New Group</h2>
            <p className="text-slate-500 mb-6 text-sm">Start a new study group and invite your friends.</p>
            
            <div className="w-full max-w-xs space-y-3">
              <input 
                type="text" 
                placeholder="Group Name"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
              />
              <button 
                onClick={handleCreate}
                disabled={groupLoading || !newGroupName.trim()}
                className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 transition-colors disabled:opacity-50"
              >
                 {groupLoading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : "Create Group"}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --- ACTIVE GROUP VIEW ---

  const isLeader = currentGroup.createdBy === user.uid;
  const activeQuiz = currentGroup.activeQuiz;

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col md:flex-row gap-4 max-w-6xl mx-auto">
      
      {/* Sidebar: Members */}
      <div className="w-full md:w-64 bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col shrink-0">
        <div className="p-4 border-b border-slate-100">
          <h2 className="font-bold text-slate-800 truncate" title={currentGroup.name}>{currentGroup.name}</h2>
          <div className="flex items-center gap-2 mt-2 bg-slate-50 p-2 rounded-lg border border-slate-200">
            <span className="text-xs font-mono text-slate-500 flex-1 text-center select-all">{currentGroup.code}</span>
            <button onClick={copyCode} className="text-slate-400 hover:text-indigo-600">
              {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
           <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Members ({groupMembers.length})</h3>
           {groupMembers.map(member => (
             <div key={member.uid} className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50">
                {member.photoURL ? (
                  <img src={member.photoURL} alt={member.displayName} className="w-8 h-8 rounded-full" />
                ) : (
                  <div className="w-8 h-8 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center font-bold text-xs">
                    {member.displayName[0]}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1">
                    <p className="text-sm font-medium text-slate-700 truncate">{member.displayName}</p>
                    {member.role === 'leader' && <Crown className="w-3 h-3 text-amber-500" />}
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-slate-400">
                     <span>{member.stats.quizzesTaken} Quizzes</span>
                  </div>
                </div>
             </div>
           ))}
        </div>

        <div className="p-3 border-t border-slate-100">
          <button 
            onClick={() => leaveGroup()}
            className="w-full flex items-center justify-center gap-2 text-red-500 hover:bg-red-50 p-2 rounded-lg transition-colors text-sm font-medium"
          >
            <X className="w-4 h-4" /> Leave Group
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col min-w-0">
        
        {/* Tabs */}
        <div className="flex border-b border-slate-200">
          <button 
            onClick={() => setActiveTab('chat')}
            className={`flex-1 py-4 text-sm font-bold flex items-center justify-center gap-2 border-b-2 transition-colors ${activeTab === 'chat' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
          >
            <MessageSquare className="w-4 h-4" /> Group Chat
          </button>
          <button 
             onClick={() => setActiveTab('quiz')}
             className={`flex-1 py-4 text-sm font-bold flex items-center justify-center gap-2 border-b-2 transition-colors relative ${activeTab === 'quiz' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
          >
            <Trophy className="w-4 h-4" /> 
            Live Quiz
            {activeQuiz && activeQuiz.isActive && (
              <span className="absolute top-2 right-4 w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
            )}
          </button>
          {/* <button 
             onClick={() => setActiveTab('plan')}
             className={`flex-1 py-4 text-sm font-bold flex items-center justify-center gap-2 border-b-2 transition-colors ${activeTab === 'plan' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
          >
            <ClipboardList className="w-4 h-4" /> Shared Plan
          </button> */}
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-hidden relative">
          
          {/* --- CHAT TAB --- */}
          {activeTab === 'chat' && (
            <div className="absolute inset-0 flex flex-col bg-slate-50/50">
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {groupMessages.map(msg => {
                   const isMe = msg.senderId === user.uid;
                   return (
                     <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                       <div className={`flex flex-col max-w-[80%] ${isMe ? 'items-end' : 'items-start'}`}>
                         {!isMe && <span className="text-[10px] text-slate-400 ml-1 mb-1">{msg.senderName}</span>}
                         <div className={`p-3 rounded-2xl text-sm ${
                           isMe ? 'bg-indigo-600 text-white rounded-br-none' : 'bg-white border border-slate-200 text-slate-800 rounded-bl-none shadow-sm'
                         }`}>
                           {msg.content}
                         </div>
                       </div>
                     </div>
                   );
                })}
                <div ref={chatEndRef} />
              </div>
              <form onSubmit={handleSendMessage} className="p-3 bg-white border-t border-slate-200 flex gap-2">
                <input 
                  type="text"
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  placeholder="Type a message..."
                  className="flex-1 border-slate-200 bg-slate-50 rounded-xl px-4 focus:ring-2 focus:ring-indigo-500 outline-none"
                />
                <button type="submit" disabled={!messageInput.trim()} className="p-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50">
                  <Send className="w-5 h-5" />
                </button>
              </form>
            </div>
          )}

          {/* --- QUIZ TAB --- */}
          {activeTab === 'quiz' && (
            <div className="absolute inset-0 overflow-y-auto p-6 flex flex-col">
              {!activeQuiz || !activeQuiz.isActive ? (
                // No Active Quiz State
                <div className="flex-1 flex flex-col items-center justify-center text-center">
                  <div className="w-20 h-20 bg-indigo-50 rounded-full flex items-center justify-center mb-6">
                    <Trophy className="w-10 h-10 text-indigo-500" />
                  </div>
                  <h3 className="text-2xl font-bold text-slate-800 mb-2">Group Quiz Challenge</h3>
                  <p className="text-slate-500 max-w-md mb-8">
                    Compete with your study group in real-time. Leaderboards update instantly as you answer!
                  </p>
                  
                  {isLeader ? (
                    <div className="w-full max-w-sm space-y-3">
                      <input 
                        type="text"
                        placeholder="Enter quiz topic..."
                        value={quizTopic}
                        onChange={(e) => setQuizTopic(e.target.value)}
                        className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500"
                      />
                      <button 
                        onClick={() => startGroupQuiz(quizTopic)}
                        disabled={!quizTopic.trim()}
                        className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 transition-colors disabled:opacity-50"
                      >
                        Start Live Quiz
                      </button>
                    </div>
                  ) : (
                    <div className="bg-amber-50 text-amber-800 px-4 py-2 rounded-lg text-sm font-medium animate-pulse">
                      Waiting for group leader to start a quiz...
                    </div>
                  )}
                </div>
              ) : (
                // Active Quiz State
                <div className="max-w-2xl mx-auto w-full">
                  
                  {/* Status Bar */}
                  <div className="flex justify-between items-center mb-6 bg-slate-50 p-3 rounded-xl border border-slate-100">
                     <span className="font-bold text-indigo-600">Q{activeQuiz.currentQuestionIndex + 1} / {activeQuiz.questions.length}</span>
                     <span className="text-sm font-medium text-slate-500">{activeQuiz.topic}</span>
                     {isLeader && (
                       <button 
                         onClick={endGroupQuiz} 
                         className="text-xs bg-red-100 text-red-600 px-2 py-1 rounded hover:bg-red-200"
                       >
                         End Quiz
                       </button>
                     )}
                  </div>
                  
                  {activeQuiz.status === 'completed' ? (
                    // Leaderboard View
                    <div className="bg-white rounded-xl shadow-lg border border-slate-100 p-6 text-center">
                       <h2 className="text-2xl font-bold text-slate-800 mb-6">Quiz Results</h2>
                       <div className="space-y-3">
                         {groupMembers
                           .map(m => ({ 
                              ...m, 
                              score: activeQuiz.participants[m.uid]?.score || 0 
                           }))
                           .sort((a, b) => b.score - a.score)
                           .map((m, idx) => (
                             <div key={m.uid} className={`flex items-center justify-between p-3 rounded-xl ${idx === 0 ? 'bg-amber-50 border border-amber-200' : 'bg-slate-50'}`}>
                                <div className="flex items-center gap-3">
                                   <div className="font-bold text-lg text-slate-400 w-6">#{idx + 1}</div>
                                   {m.photoURL ? <img src={m.photoURL} className="w-8 h-8 rounded-full"/> : <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center font-bold text-xs">{m.displayName[0]}</div>}
                                   <span className="font-medium text-slate-700">{m.displayName}</span>
                                </div>
                                <div className="font-bold text-indigo-600">{m.score} pts</div>
                             </div>
                           ))
                         }
                       </div>
                    </div>
                  ) : (
                    // Question View
                    <div>
                      <div className="bg-white rounded-2xl shadow-lg border border-slate-100 p-6 mb-6">
                        <h3 className="text-xl font-bold text-slate-800 mb-6">{activeQuiz.questions[activeQuiz.currentQuestionIndex].question}</h3>
                        <div className="space-y-3">
                          {activeQuiz.questions[activeQuiz.currentQuestionIndex].options.map((opt, idx) => {
                             const hasAnswered = activeQuiz.participants[user.uid]?.answers.length > activeQuiz.currentQuestionIndex;
                             const myAnswer = activeQuiz.participants[user.uid]?.answers[activeQuiz.currentQuestionIndex];
                             
                             let btnClass = "w-full text-left p-4 rounded-xl border-2 transition-all ";
                             if (hasAnswered) {
                                if (myAnswer === idx) btnClass += "bg-indigo-50 border-indigo-500 text-indigo-700";
                                else btnClass += "border-slate-100 opacity-50";
                             } else {
                                btnClass += "border-slate-200 hover:border-indigo-400 hover:bg-indigo-50";
                             }

                             return (
                               <button 
                                 key={idx}
                                 onClick={() => !hasAnswered && submitGroupQuizAnswer(activeQuiz.currentQuestionIndex, idx)}
                                 disabled={hasAnswered}
                                 className={btnClass}
                               >
                                 {opt}
                               </button>
                             )
                          })}
                        </div>
                      </div>
                      
                      {/* Admin Controls */}
                      {isLeader && (
                         <div className="flex justify-end">
                            <button 
                              onClick={nextGroupQuizQuestion}
                              className="bg-slate-800 text-white px-6 py-2 rounded-lg hover:bg-slate-900 transition-colors flex items-center gap-2"
                            >
                              {activeQuiz.currentQuestionIndex < activeQuiz.questions.length - 1 ? "Next Question" : "Show Results"} <ArrowRight className="w-4 h-4" />
                            </button>
                         </div>
                      )}
                      
                      {/* Waiting Indicator for Members */}
                      {!isLeader && activeQuiz.participants[user.uid]?.answers.length > activeQuiz.currentQuestionIndex && (
                        <div className="text-center text-slate-500 animate-pulse mt-4">
                           Waiting for leader to advance...
                        </div>
                      )}
                    </div>
                  )}

                </div>
              )}
            </div>
          )}

          {/* --- PLAN TAB (Placeholder for brevity) --- */}
          {activeTab === 'plan' && (
             <div className="flex flex-col items-center justify-center h-full text-slate-400">
               <ClipboardList className="w-12 h-12 mb-4 opacity-50" />
               <p>Shared study plans coming soon!</p>
             </div>
          )}
        </div>
      </div>
    </div>
  );
};
