import React, { useState, useRef, useEffect } from 'react';
import { Send, Image as ImageIcon, Volume2, Loader2, Sparkles, X, AlertCircle } from 'lucide-react';
import { useStore } from '../store/useStore';
import { generateSpeech, decodeAudioData } from '../services/geminiService';
import ReactMarkdown from 'react-markdown';
import { DifficultyLevel, ExplanationStyle } from '../types';

export const ChatInterface: React.FC = () => {
  const { 
    messages, 
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
  
  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  return (
    <div className="flex flex-col h-[calc(100vh-100px)] max-w-4xl mx-auto bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-200">
      
      {/* Header / Config */}
      <div className="bg-slate-50 p-4 border-b border-slate-200 flex flex-wrap gap-4 items-center justify-between">
        <div className="flex items-center gap-2">
           <span className="text-sm font-semibold text-slate-600">Level:</span>
           <select 
             value={difficulty} 
             onChange={(e) => setDifficulty(e.target.value as DifficultyLevel)}
             className="text-sm border-slate-300 rounded-md shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
           >
             {Object.values(DifficultyLevel).map(l => <option key={l} value={l}>{l}</option>)}
           </select>
        </div>
        <div className="flex items-center gap-2">
           <span className="text-sm font-semibold text-slate-600">Style:</span>
           <select 
             value={style} 
             onChange={(e) => setStyle(e.target.value as ExplanationStyle)}
             className="text-sm border-slate-300 rounded-md shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
           >
             {Object.values(ExplanationStyle).map(s => <option key={s} value={s}>{s}</option>)}
           </select>
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

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6 bg-slate-50/50">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-slate-400">
            <Sparkles className="w-12 h-12 mb-4 text-indigo-300" />
            <p className="text-lg">Ask me anything or upload a note!</p>
          </div>
        )}
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-2xl p-4 ${
              msg.role === 'user' 
                ? 'bg-indigo-600 text-white rounded-br-none' 
                : 'bg-white border border-slate-200 text-slate-800 rounded-bl-none shadow-sm'
            }`}>
              {msg.imageUrl && (
                <img src={msg.imageUrl} alt="Content" className="max-w-full rounded-lg mb-3" />
              )}
              
              {msg.type !== 'image' && (
                  <div className={`prose ${msg.role === 'user' ? 'prose-invert' : 'prose-slate'} max-w-none`}>
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
              )}

              {msg.role === 'model' && (
                <div className="mt-3 flex gap-2 pt-2 border-t border-slate-100">
                   <button 
                     onClick={() => handleAudio(msg.content)}
                     className="text-xs flex items-center gap-1 text-slate-500 hover:text-indigo-600 transition-colors"
                     title="Read Aloud"
                   >
                     <Volume2 className="w-4 h-4" /> Listen
                   </button>
                   <button 
                     onClick={() => generateVisualForMessage(msg.content.slice(0, 100))}
                     className="text-xs flex items-center gap-1 text-slate-500 hover:text-indigo-600 transition-colors"
                     title="Generate visual aid"
                   >
                     <ImageIcon className="w-4 h-4" /> Visual Aid
                   </button>
                </div>
              )}
            </div>
          </div>
        ))}
        {isChatLoading && (
          <div className="flex justify-start">
            <div className="bg-white p-4 rounded-2xl rounded-bl-none shadow-sm border border-slate-200">
              <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 bg-white border-t border-slate-200">
        {previewUrl && (
          <div className="mb-2 relative inline-block">
             <img src={previewUrl} alt="Preview" className="h-20 rounded-lg border border-slate-200" />
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
            className="p-3 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-full transition-all"
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
            className="flex-1 border-slate-200 rounded-full px-6 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            disabled={isChatLoading}
          />
          <button 
            onClick={handleSend}
            disabled={(!input.trim() && !selectedImage) || isChatLoading}
            className="p-3 bg-indigo-600 text-white rounded-full hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};
