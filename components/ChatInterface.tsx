import React, { useState, useRef, useEffect } from 'react';
import { Send, Image as ImageIcon, Volume2, Loader2, Sparkles, X } from 'lucide-react';
import { Message, DifficultyLevel, ExplanationStyle } from '../types';
import { chatWithLearnMate, generateVisualAid, generateSpeech, decodeAudioData } from '../services/geminiService';
import ReactMarkdown from 'react-markdown';

export const ChatInterface: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [difficulty, setDifficulty] = useState<DifficultyLevel>(DifficultyLevel.Beginner);
  const [style, setStyle] = useState<ExplanationStyle>(ExplanationStyle.Standard);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedImage(file);
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    }
  };

  const clearImage = () => {
    setSelectedImage(null);
    setPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // Remove data URL prefix
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const playAudio = async (base64Audio: string) => {
    try {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        const audioCtx = new AudioContextClass({ sampleRate: 24000 });
        const buffer = await decodeAudioData(base64Audio, audioCtx);
        const source = audioCtx.createBufferSource();
        source.buffer = buffer;
        source.connect(audioCtx.destination);
        source.start();
    } catch (e) {
        console.error("Audio playback failed", e);
    }
  };

  const handleSend = async () => {
    if ((!input.trim() && !selectedImage) || isLoading) return;

    const userMsgId = Date.now().toString();
    const newUserMsg: Message = {
      id: userMsgId,
      role: 'user',
      content: input,
      imageUrl: previewUrl || undefined,
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, newUserMsg]);
    setInput('');
    setIsLoading(true);

    try {
      let imagePart = undefined;
      if (selectedImage) {
        const base64Data = await fileToBase64(selectedImage);
        imagePart = {
          inlineData: {
            data: base64Data,
            mimeType: selectedImage.type
          }
        };
      }

      // Clear image selection after sending
      clearImage();

      const responseText = await chatWithLearnMate(
        newUserMsg.content || "Explain this image", 
        [], // History logic simplified
        difficulty, 
        style,
        imagePart
      );

      const aiMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        content: responseText,
        timestamp: Date.now()
      };

      setMessages(prev => [...prev, aiMsg]);
    } catch (error) {
      console.error(error);
      const errorMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        content: "Sorry, I encountered an error processing your request.",
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateVisual = async (prompt: string) => {
    setIsLoading(true);
    try {
      const imageUrl = await generateVisualAid(prompt);
      if (imageUrl) {
         setMessages(prev => [...prev, {
            id: Date.now().toString(),
            role: 'model',
            content: `Here is a visual aid for: ${prompt}`,
            type: 'image',
            imageUrl: imageUrl,
            timestamp: Date.now()
         }]);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateAudio = async (text: string) => {
      // Don't block UI too much for audio
      try {
          const audioBase64 = await generateSpeech(text);
          if (audioBase64) {
              await playAudio(audioBase64);
          }
      } catch (e) {
          console.error(e);
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
                <img src={msg.imageUrl} alt="Uploaded or Generated" className="max-w-full rounded-lg mb-3" />
              )}
              
              {msg.type !== 'image' && (
                  <div className={`prose ${msg.role === 'user' ? 'prose-invert' : 'prose-slate'} max-w-none`}>
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
              )}

              {msg.role === 'model' && (
                <div className="mt-3 flex gap-2 pt-2 border-t border-slate-100">
                   <button 
                     onClick={() => handleGenerateAudio(msg.content)}
                     className="text-xs flex items-center gap-1 text-slate-500 hover:text-indigo-600 transition-colors"
                     title="Read Aloud"
                   >
                     <Volume2 className="w-4 h-4" /> Listen
                   </button>
                   <button 
                     onClick={() => handleGenerateVisual(msg.content.slice(0, 100))}
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
        {isLoading && (
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
            disabled={isLoading}
          />
          <button 
            onClick={handleSend}
            disabled={(!input.trim() && !selectedImage) || isLoading}
            className="p-3 bg-indigo-600 text-white rounded-full hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};
