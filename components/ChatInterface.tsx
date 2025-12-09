
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  Send, Image as ImageIcon, Volume2, Loader2, Sparkles, X, AlertCircle, 
  MessageSquare, Plus, Trash2, Menu, ChevronLeft, Search, CloudOff, RefreshCw,
  Briefcase, Heart, HelpCircle, ShieldAlert, Coffee, Mic, Paperclip, FileText,
  StopCircle, Play, Pause, MoreVertical, Download, WifiOff
} from 'lucide-react';
import { useStore } from '../store/useStore';
import { generateSpeech, decodeAudioData } from '../services/geminiService';
import { exportChatToMarkdown, exportChatToPDF } from '../services/exportService';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { DifficultyLevel, ExplanationStyle, ChatSession, AIPersona } from '../types';

// Helper to check if URL is YouTube
const getYoutubeId = (url: string) => {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
};

// Custom Markdown Renderer for Video and Code
const MarkdownComponents = {
  code({ node, inline, className, children, ...props }: any) {
    const match = /language-(\w+)/.exec(className || '');
    return !inline && match ? (
      <div className="relative group">
        <SyntaxHighlighter
          style={vscDarkPlus}
          language={match[1]}
          PreTag="div"
          customStyle={{ borderRadius: '0.5rem', fontSize: '0.85rem' }}
          {...props}
        >
          {String(children).replace(/\n$/, '')}
        </SyntaxHighlighter>
      </div>
    ) : (
      <code className="bg-slate-100 px-1 py-0.5 rounded text-indigo-600 font-mono text-sm" {...props}>
        {children}
      </code>
    );
  },
  a({ node, children, href, ...props }: any) {
    // Check if link is YouTube
    const ytId = href ? getYoutubeId(href) : null;
    if (ytId) {
       return (
         <div className="my-4 rounded-xl overflow-hidden shadow-md max-w-full bg-black aspect-video">
           <iframe
             width="100%"
             height="100%"
             src={`https://www.youtube.com/embed/${ytId}`}
             title="YouTube video player"
             frameBorder="0"
             allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
             allowFullScreen
           />
         </div>
       );
    }
    return (
      <a href={href} className="text-blue-600 hover:underline break-words" target="_blank" rel="noopener noreferrer" {...props}>
        {children}
      </a>
    );
  }
};

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
    cloudError,
    retrySync,
    sendMessage, 
    generateVisualForMessage,
    clearChatError,
    difficulty,
    setDifficulty,
    style,
    setStyle,
    persona,
    setPersona,
    isOnline
  } = useStore();

  const [input, setInput] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [showSidebar, setShowSidebar] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isRetrying, setIsRetrying] = useState(false);
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const [showExportMenu, setShowExportMenu] = useState(false);
  
  // Audio Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<number | null>(null);

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

  // Audio Recording Logic
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        // Create a File object from Blob to allow easier handling downstream
        const audioFile = new File([audioBlob], `recording_${Date.now()}.webm`, { type: 'audio/webm' });
        setSelectedFile(audioFile);
        
        stream.getTracks().forEach(track => track.stop()); // Clean up
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      
      recordingTimerRef.current = window.setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

    } catch (err) {
      console.error("Error accessing microphone:", err);
      alert("Could not access microphone. Please check permissions.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
    }
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop(); // Stop stream
      // But don't save the file
      setIsRecording(false);
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
      setSelectedFile(null);
      audioChunksRef.current = [];
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const clearFile = () => {
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSend = async () => {
    if ((!input.trim() && !selectedFile) || isChatLoading) return;
    const msg = input;
    const file = selectedFile || undefined;
    
    setInput('');
    clearFile();
    
    await sendMessage(msg, file);
  };

  const handleRetrySync = async () => {
    setIsRetrying(true);
    await retrySync();
    setIsRetrying(false);
  };

  const handleAudio = async (text: string, msgId: string) => {
    if (playingAudioId === msgId) return; // Prevent spamming
    setPlayingAudioId(msgId);
    
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioContextClass({ sampleRate: 24000 });
      const base64 = await generateSpeech(text, persona); // Pass persona for voice selection
      if (base64) {
        const buffer = await decodeAudioData(base64, audioCtx);
        const source = audioCtx.createBufferSource();
        source.buffer = buffer;
        source.connect(audioCtx.destination);
        source.start();
        source.onended = () => setPlayingAudioId(null);
      } else {
        setPlayingAudioId(null);
      }
    } catch (e) {
      console.error("Audio playback error", e);
      setPlayingAudioId(null);
    }
  };

  const handleDeleteSession = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm("Are you sure you want to delete this chat?")) {
      deleteSession(id);
    }
  };

  const handleExport = (type: 'pdf' | 'md' | 'print') => {
    const session = sessions.find(s => s.id === currentSessionId);
    if (!session) return;

    if (type === 'print') {
      window.print();
    } else if (type === 'md') {
      const md = exportChatToMarkdown(session);
      const blob = new Blob([md], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${session.title || 'Chat'}.md`;
      a.click();
    } else if (type === 'pdf') {
      exportChatToPDF(session);
    }
    setShowExportMenu(false);
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

  // Icons mapping for Persona
  const PersonaIcons = {
    [AIPersona.Professional]: Briefcase,
    [AIPersona.Friend]: Sparkles,
    [AIPersona.Socratic]: HelpCircle,
    [AIPersona.Sergeant]: ShieldAlert,
    [AIPersona.Mentor]: Heart
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex h-[calc(100vh-100px)] max-w-6xl mx-auto bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-200">
      
      {/* Sidebar - Desktop: Always visible, Mobile: Toggleable */}
      <div className={`
        absolute inset-y-0 left-0 z-20 w-64 bg-slate-50 border-r border-slate-200 transform transition-transform duration-200 ease-in-out flex flex-col
        md:relative md:translate-x-0
        ${showSidebar ? 'translate-x-0 shadow-2xl' : '-translate-x-full'}
        print:hidden
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
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-white relative">
        
        {/* Header */}
        <div className="bg-white p-4 border-b border-slate-200 flex flex-wrap gap-4 items-center justify-between z-10 shadow-sm print:hidden">
          <div className="flex items-center gap-3 w-full md:w-auto">
            <button 
              onClick={() => setShowSidebar(true)} 
              className="md:hidden p-2 -ml-2 text-slate-500 hover:bg-slate-100 rounded-lg"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Persona Selector (Mobile Optimized) */}
            <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-lg border border-slate-200 overflow-x-auto max-w-full">
               {Object.values(AIPersona).map((p) => {
                 const Icon = PersonaIcons[p];
                 const isActive = persona === p;
                 return (
                   <button
                     key={p}
                     onClick={() => setPersona(p)}
                     className={`p-1.5 md:p-2 rounded-md transition-all flex items-center gap-2 ${
                       isActive 
                         ? 'bg-white text-indigo-600 shadow-sm ring-1 ring-indigo-100' 
                         : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
                     }`}
                     title={p}
                   >
                     <Icon className="w-4 h-4" />
                     {isActive && <span className="text-xs font-bold whitespace-nowrap hidden md:inline">{p.split(' ')[0]}</span>}
                   </button>
                 );
               })}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 ml-auto">
               <div className="flex items-center gap-2">
                 <select 
                   value={difficulty} 
                   onChange={(e) => setDifficulty(e.target.value as DifficultyLevel)}
                   className="text-xs md:text-sm py-1 pl-2 pr-8 border-slate-200 rounded-lg focus:border-indigo-500 focus:ring-indigo-500 bg-slate-50"
                 >
                   {Object.values(DifficultyLevel).map(l => <option key={l} value={l}>{l}</option>)}
                 </select>
               </div>
               
               {/* Export Menu */}
               <div className="relative">
                 <button 
                   onClick={() => setShowExportMenu(!showExportMenu)}
                   className="p-2 hover:bg-slate-100 rounded-lg text-slate-500"
                 >
                    <MoreVertical className="w-5 h-5" />
                 </button>
                 {showExportMenu && (
                   <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-xl border border-slate-100 py-1 z-50">
                      <button onClick={() => handleExport('pdf')} className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2">
                        <FileText className="w-4 h-4" /> Save as PDF
                      </button>
                      <button onClick={() => handleExport('md')} className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2">
                        <Download className="w-4 h-4" /> Save as Markdown
                      </button>
                      <button onClick={() => handleExport('print')} className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2">
                        <Paperclip className="w-4 h-4" /> Print Guide
                      </button>
                   </div>
                 )}
               </div>
          </div>
        </div>

        {/* Cloud Error Banner */}
        {cloudError && (
          <div className="bg-orange-50 p-3 border-b border-orange-100 flex items-center gap-3 text-orange-800 text-xs md:text-sm animate-fade-in print:hidden">
            <CloudOff className="w-4 h-4 shrink-0" />
            <div className="flex-1">
              <span className="font-bold">Sync Error: </span>
              {cloudError}
            </div>
            <button 
              onClick={handleRetrySync} 
              disabled={isRetrying}
              className="px-3 py-1 bg-white border border-orange-200 rounded-md text-orange-700 hover:bg-orange-50 font-medium flex items-center gap-1 transition-colors disabled:opacity-50"
            >
              {isRetrying ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
              Retry
            </button>
          </div>
        )}

        {/* Error Banner */}
        {chatError && (
          <div className="bg-red-50 p-3 flex justify-between items-center text-red-700 text-sm border-b border-red-100 print:hidden">
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
                 {/* Dynamic Icon based on Persona */}
                 {(() => {
                    const Icon = PersonaIcons[persona] || Sparkles;
                    return <Icon className="w-10 h-10 text-indigo-500" />;
                 })()}
              </div>
              <p className="text-lg font-medium text-slate-600">
                I'm your <span className="text-indigo-600 font-bold">{persona}</span>.
              </p>
              <p className="text-sm mt-2 max-w-md text-center">
                Ask me anything! Upload PDFs, images, or use the mic to talk.
              </p>
              {!isOnline && (
                 <div className="mt-4 flex items-center gap-2 bg-orange-100 text-orange-700 px-4 py-2 rounded-lg text-sm">
                    <WifiOff className="w-4 h-4" /> You are offline. AI Chat is disabled.
                 </div>
              )}
            </div>
          ) : (
            messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[90%] sm:max-w-[80%] rounded-2xl p-4 ${
                  msg.role === 'user' 
                    ? 'bg-indigo-600 text-white rounded-br-none shadow-md print:bg-slate-100 print:text-black print:border print:border-slate-300' 
                    : 'bg-white border border-slate-200 text-slate-800 rounded-bl-none shadow-sm'
                }`}>
                  {/* Image Content */}
                  {msg.imageUrl && (
                    <img src={msg.imageUrl} alt="Uploaded" className="max-w-full rounded-lg mb-3 border border-white/20" />
                  )}

                  {/* File Content */}
                  {msg.type === 'file' && (
                    <div className="flex items-center gap-3 bg-slate-100/10 p-3 rounded-lg border border-white/20 mb-3">
                      <div className="p-2 bg-white/20 rounded-lg">
                        <FileText className="w-6 h-6" />
                      </div>
                      <div className="overflow-hidden">
                        <p className="text-sm font-medium truncate">{msg.fileName || "Document"}</p>
                        <a 
                          href={msg.fileUrl} 
                          target="_blank" 
                          rel="noreferrer" 
                          className="text-xs opacity-70 hover:opacity-100 hover:underline"
                        >
                          View PDF
                        </a>
                      </div>
                    </div>
                  )}

                  {/* Audio Content */}
                  {msg.type === 'audio' && msg.audioUrl && (
                    <div className="mb-3">
                      <audio controls src={msg.audioUrl} className="w-full h-8" />
                    </div>
                  )}
                  
                  {/* Text Content with Markdown & Code support */}
                  <div className={`prose prose-sm sm:prose-base ${msg.role === 'user' ? 'prose-invert print:prose-slate' : 'prose-slate'} max-w-none`}>
                    <ReactMarkdown components={MarkdownComponents}>
                      {msg.content}
                    </ReactMarkdown>
                  </div>

                  {msg.role === 'model' && (
                    <div className="mt-3 flex gap-3 pt-3 border-t border-slate-100 print:hidden">
                       <button 
                         onClick={() => handleAudio(msg.content, msg.id)}
                         className="text-xs flex items-center gap-1.5 text-slate-500 hover:text-indigo-600 transition-colors font-medium"
                         title="Read Aloud"
                         disabled={playingAudioId !== null && playingAudioId !== msg.id}
                       >
                         {playingAudioId === msg.id ? (
                           <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600" />
                         ) : (
                           <Volume2 className="w-3.5 h-3.5" />
                         )}
                         {playingAudioId === msg.id ? 'Playing...' : 'Listen'}
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
        <div className="p-4 bg-white border-t border-slate-200 print:hidden">
          {/* File Previews */}
          {selectedFile && (
            <div className="mb-3 relative inline-flex items-center gap-3 bg-slate-50 p-2 pr-4 rounded-xl border border-slate-200 shadow-sm animate-in fade-in slide-in-from-bottom-2">
               {selectedFile.type.startsWith('image/') ? (
                 <img src={URL.createObjectURL(selectedFile)} alt="Preview" className="h-12 w-12 object-cover rounded-lg" />
               ) : (
                 <div className="h-12 w-12 bg-indigo-100 text-indigo-600 rounded-lg flex items-center justify-center">
                   {selectedFile.type.startsWith('audio/') ? <Volume2 className="w-6 h-6" /> : <FileText className="w-6 h-6" />}
                 </div>
               )}
               <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-700 truncate max-w-[200px]">{selectedFile.name}</p>
                  <p className="text-xs text-slate-400">{(selectedFile.size / 1024).toFixed(1)} KB</p>
               </div>
               <button 
                 onClick={clearFile}
                 className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-md hover:bg-red-600"
               >
                 <X className="w-3 h-3" />
               </button>
            </div>
          )}

          {/* Recording Indicator */}
          {isRecording && (
             <div className="mb-3 flex items-center gap-3 bg-red-50 text-red-600 p-3 rounded-xl border border-red-100 animate-pulse">
                <div className="w-2 h-2 bg-red-600 rounded-full animate-ping" />
                <span className="text-sm font-bold">Recording... {formatTime(recordingTime)}</span>
                <button 
                   onClick={stopRecording} 
                   className="ml-auto bg-white border border-red-200 rounded-full p-1 text-red-500 hover:text-red-700"
                   title="Stop & Attach"
                >
                   <StopCircle className="w-5 h-5" />
                </button>
                <button 
                   onClick={cancelRecording} 
                   className="text-xs text-red-400 hover:underline"
                >
                   Cancel
                </button>
             </div>
          )}

          <div className="flex gap-2">
            <input 
               type="file" 
               ref={fileInputRef}
               accept="image/*,application/pdf,audio/*"
               className="hidden"
               onChange={handleFileSelect}
               disabled={!isOnline}
            />
            
            {/* Attach Button */}
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="p-3 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all border border-transparent hover:border-indigo-100 disabled:opacity-50"
              title="Attach Image, PDF or Audio"
              disabled={!isOnline}
            >
              <Paperclip className="w-5 h-5" />
            </button>

            {/* Microphone Button */}
            <button 
               onClick={isRecording ? stopRecording : startRecording}
               disabled={!isOnline}
               className={`p-3 rounded-xl transition-all border border-transparent disabled:opacity-50 ${
                  isRecording 
                    ? 'bg-red-100 text-red-600 animate-pulse' 
                    : 'text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 hover:border-indigo-100'
               }`}
               title={isRecording ? "Stop Recording" : "Voice Note"}
            >
               <Mic className="w-5 h-5" />
            </button>

            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder={isOnline ? (isRecording ? "Recording..." : `Message your ${persona.split(' ')[1] || 'Tutor'}...`) : "You are offline..."}
              className="flex-1 border-slate-200 bg-slate-50 rounded-xl px-4 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:bg-white transition-all disabled:opacity-70 disabled:bg-slate-100"
              disabled={isChatLoading || isRecording || !isOnline}
            />
            <button 
              onClick={handleSend}
              disabled={(!input.trim() && !selectedFile) || isChatLoading || isRecording || !isOnline}
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
