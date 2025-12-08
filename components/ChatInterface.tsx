import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  Send, Image as ImageIcon, Volume2, Loader2, Sparkles, X, AlertCircle, 
  MessageSquare, Plus, Trash2, Menu, ChevronLeft, Search 
} from 'lucide-react';
import { useStore } from '../store/useStore';
import { generateSpeech, decodeAudioData } from '../services/geminiService';
import ReactMarkdown from 'react-markdown';
import { DifficultyLevel, ExplanationStyle, ChatSession } from '../types';

export const ChatInterface: React.FC = () => {
  const { 
    messages, 
    sessions,
    currentSessionId,
    createSession,
    selectSession,
    deleteSession,
    isChatLoading, 
    chatError, 
    sendMessage, 
    generateVisualForMessage,
    clearChatError,
    difficulty,
    setDifficulty,
    style,
    setStyle
  } = useStore();

  const [input, setInput] = useState('');
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [showSidebar, setShowSidebar] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize a session if none exists
  useEffect(() => {
    if (!currentSessionId && sessions.length === 0) {
      createSession();
    } else if (!currentSessionId && sessions.length > 0) {
      selectSession(sessions[0].id);
    }
  }, [currentSessionId, sessions.length, createSession, selectSession]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isChatLoading]);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedImage(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const clearImage = () => {
    setSelectedImage(null);
    setPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSend = async () => {
    if ((!input.trim() && !selectedImage) || isChatLoading) return;
    const msg = input;
    const img = selectedImage || undefined;
    
    setInput('');
    clearImage();
    
    await sendMessage(msg, img);
  };

  const handleAudio = async (text: string) => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioContextClass({ sampleRate: 24000 });
      const base64 = await generateSpeech(text);
      if (base64) {
        const buffer = await decodeAudioData(base64, audioCtx);
        const source = audioCtx.createBufferSource();
        source.buffer = buffer;
        source.connect(audioCtx.destination);
        source.start();
      }
    } catch (e) {
      console.error("Audio playback error", e);
    }
  };

  const handleDeleteSession = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm("Are you sure you want to delete this chat?")) {
      deleteSession(id);
    }
  };

  const filteredSessions = useMemo(() => {
    if (!searchQuery.trim()) return sessions;
    const lowerQuery = searchQuery.toLowerCase();
    return sessions.filter(s => 
      (s.title || '').toLowerCase().includes(lowerQuery) ||
      s.messages.some(m => m.content.toLowerCase().includes(lowerQuery))
    );
  }, [sessions, searchQuery]);

  const groupedSessions = useMemo(() => {
    const groups: { [key: string]: ChatSession[] } = {
      'Today': [],
      'Yesterday': [],
      'Previous 7 Days': [],
      'Older': []
    };
    
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const yesterdayStart = todayStart - 86400000;
    const weekStart = todayStart - 7 * 86400000;

    filteredSessions.forEach(session => {
       const date = session.createdAt;
       if (date >= todayStart) groups['Today'].push(session);
       else if (date >= yesterdayStart) groups['Yesterday'].push(session);
       else if (date >= weekStart) groups['Previous 7 Days'].push(session);
       else groups['Older'].push(session);
    });
    
    return groups;
  }, [filteredSessions]);

  return (
    <div className="flex h-[calc(100vh-100px)] max-w-6xl mx-auto bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-200">
      
      {/* Sidebar - Desktop: Always visible, Mobile: Toggleable */}
      <div className={`
        absolute inset-y-0 left-0 z-20 w-64 bg-slate-50 border-r border-slate-200 transform transition-transform duration-200 ease-in-out flex flex-col
        md:relative md:translate-x-0
        ${showSidebar ? 'translate-x-0 shadow-2xl' : '-translate-x-full'}
      `}>
        <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-white">
          <h2 className="font-bold text-slate-700 flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-indigo-600" /> History
          </h2>
          <button 
            onClick={() => setShowSidebar(false)} 
            className="md:hidden text-slate-400 hover:text-slate-600"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        </div>

        <div className="p-3 space-y-3">
          <button 
            onClick={() => { createSession(); setShowSidebar(false); setSearchQuery(''); }}
            className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white py-2.5 rounded-xl font-medium hover:bg-indigo-700 transition-all shadow-sm"
          >
            <Plus className="w-4 h-4" /> New Chat
          </button>
          
          <div className="relative">
            <input 
              type="text"
              placeholder="Search chats..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-4 custom-scrollbar">
          {Object.entries(groupedSessions).map(([label, sessions]) => {
            const groupSessions = sessions as ChatSession[];
            return (
              groupSessions.length > 0 && (
                <div key={label}>
                   <h3 className="px-3 text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 mt-2">{label}</h3>
                   <div className="space-y-1">
                     {groupSessions.map((session) => (
                      <div 
                        key={session.id}
                        onClick={() => { selectSession(session.id); setShowSidebar(false); }}
                        className={`group flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all border ${
                          currentSessionId === session.id 
                            ? 'bg-white border-indigo-200 shadow-sm ring-1 ring-indigo-50' 
                            : 'border-transparent hover:bg-slate-200/50 hover:border-slate-200'
                        }`}
                      >
                        <div className="flex-1 min-w-0 pr-2">
                          <p className={`text-sm font-medium truncate ${currentSessionId === session.id ? 'text-indigo-900' : 'text-slate-700'}`}>
                            {session.title || "New Chat"}
                          </p>
                        </div>
                        <button 
                          onClick={(e) => handleDeleteSession(e, session.id)}
                          className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                          title="Delete Chat"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                   </div>
                </div>
              )
            );
          })}
          {sessions.length === 0 && (
            <div className="text-center text-slate-400 text-sm py-8 italic">
              No history yet.
            </div>
          )}
          {sessions.length > 0 && filteredSessions.length === 0 && (
             <div className="text-center text-slate-400 text-sm py-8 italic">
               No matches found.
             </div>
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-white relative">
        
        {/* Header */}
        <div className="bg-white p-4 border-b border-slate-200 flex flex-wrap gap-4 items-center justify-between z-10 shadow-sm">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setShowSidebar(true)} 
              className="md:hidden p-2 -ml-2 text-slate-500 hover:bg-slate-100 rounded-lg"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex flex-wrap items-center gap-3">
               <div className="flex items-center gap-2">
                 <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Level</span>
                 <select 
                   value={difficulty} 
                   onChange={(e) => setDifficulty(e.target.value as DifficultyLevel)}
                   className="text-sm py-1 pl-2 pr-8 border-slate-200 rounded-lg focus:border-indigo-500 focus:ring-indigo-500 bg-slate-50"
                 >
                   {Object.values(DifficultyLevel).map(l => <option key={l} value={l}>{l}</option>)}
                 </select>
               </div>
               <div className="h-4 w-px bg-slate-200 hidden sm:block"></div>
               <div className="flex items-center gap-2">
                 <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Style</span>
                 <select 
                   value={style} 
                   onChange={(e) => setStyle(e.target.value as ExplanationStyle)}
                   className="text-sm py-1 pl-2 pr-8 border-slate-200 rounded-lg focus:border-indigo-500 focus:ring-indigo-500 bg-slate-50"
                 >
                   {Object.values(ExplanationStyle).map(s => <option key={s} value={s}>{s}</option>)}
                 </select>
               </div>
            </div>
          </div>
        </div>

        {/* Error Banner */}
        {chatError && (
          <div className="bg-red-50 p-3 flex justify-between items-center text-red-700 text-sm border-b border-red-100">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              {chatError}
            </div>
            <button onClick={clearChatError} className="hover:text-red-900"><X className="w-4 h-4" /></button>
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6 bg-slate-50/30">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-400">
              <div className="bg-indigo-50 p-6 rounded-full mb-6">
                <Sparkles className="w-10 h-10 text-indigo-500" />
              </div>
              <p className="text-lg font-medium text-slate-600">How can I help you learn today?</p>
              <p className="text-sm mt-2 max-w-md text-center">Ask me to explain a concept, quiz you on a topic, or create a study plan.</p>
            </div>
          ) : (
            messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] sm:max-w-[75%] rounded-2xl p-4 ${
                  msg.role === 'user' 
                    ? 'bg-indigo-600 text-white rounded-br-none shadow-md' 
                    : 'bg-white border border-slate-200 text-slate-800 rounded-bl-none shadow-sm'
                }`}>
                  {msg.imageUrl && (
                    <img src={msg.imageUrl} alt="Content" className="max-w-full rounded-lg mb-3 border border-white/20" />
                  )}
                  
                  {msg.type !== 'image' && (
                      <div className={`prose prose-sm sm:prose-base ${msg.role === 'user' ? 'prose-invert' : 'prose-slate'} max-w-none`}>
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                      </div>
                  )}

                  {msg.role === 'model' && (
                    <div className="mt-3 flex gap-3 pt-3 border-t border-slate-100">
                       <button 
                         onClick={() => handleAudio(msg.content)}
                         className="text-xs flex items-center gap-1.5 text-slate-500 hover:text-indigo-600 transition-colors font-medium"
                         title="Read Aloud"
                       >
                         <Volume2 className="w-3.5 h-3.5" /> Listen
                       </button>
                       <button 
                         onClick={() => generateVisualForMessage(msg.content.slice(0, 100))}
                         className="text-xs flex items-center gap-1.5 text-slate-500 hover:text-indigo-600 transition-colors font-medium"
                         title="Generate visual aid"
                       >
                         <ImageIcon className="w-3.5 h-3.5" /> Visual Aid
                       </button>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
          {isChatLoading && (
            <div className="flex justify-start animate-pulse">
              <div className="bg-white p-4 rounded-2xl rounded-bl-none shadow-sm border border-slate-200 flex items-center gap-3">
                <Loader2 className="w-5 h-5 animate-spin text-indigo-500" />
                <span className="text-sm text-slate-500">Thinking...</span>
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-4 bg-white border-t border-slate-200">
          {previewUrl && (
            <div className="mb-3 relative inline-block">
               <img src={previewUrl} alt="Preview" className="h-24 rounded-xl border border-slate-200 shadow-sm" />
               <button 
                 onClick={clearImage}
                 className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-md hover:bg-red-600"
               >
                 <X className="w-3 h-3" />
               </button>
            </div>
          )}
          <div className="flex gap-2">
            <input 
               type="file" 
               ref={fileInputRef}
               accept="image/*"
               className="hidden"
               onChange={handleImageSelect}
            />
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="p-3 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all border border-transparent hover:border-indigo-100"
              title="Upload Image"
            >
              <ImageIcon className="w-6 h-6" />
            </button>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Ask a question or topic..."
              className="flex-1 border-slate-200 bg-slate-50 rounded-xl px-4 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:bg-white transition-all"
              disabled={isChatLoading}
            />
            <button 
              onClick={handleSend}
              disabled={(!input.trim() && !selectedImage) || isChatLoading}
              className="p-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg transform active:scale-95"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};