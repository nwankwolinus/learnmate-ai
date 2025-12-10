import React, { useState, useEffect, useMemo } from 'react';
import { useStore } from '../store/useStore';
import { 
  Plus, Loader2, Lock, CheckCircle, 
  Map, Trash2, ArrowRight, Star, AlertTriangle, Zap,
  Globe, Share2, Copy, FileText, ChevronDown, ChevronRight, BookOpen,
  LayoutList, Clock
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { generateLearningPathPDF } from '../services/exportService';

export const PathInterface: React.FC = () => {
  const navigate = useNavigate();
  const { 
    learningPaths, 
    communityPaths,
    activePathId, 
    isPathGenerating, 
    generatePathAction,
    selectPath,
    deletePath,
    completePathNode,
    sendMessage,
    fetchCommunityPaths,
    publishPath,
    clonePath,
    user
  } = useStore();

  const [goal, setGoal] = useState('');
  const [viewMode, setViewMode] = useState<'mine' | 'community'>('mine');
  const [showConfetti, setShowConfetti] = useState(false);
  const [toast, setToast] = useState<{ msg: string, type: 'neutral' | 'error' | 'success' } | null>(null);
  
  // Roadmap State: Track expanded phases
  const [expandedPhases, setExpandedPhases] = useState<Record<number, boolean>>({});

  const activePath = learningPaths.find(p => p.id === activePathId);

  // Clear toast automatically
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Load Community Paths when tab switched
  useEffect(() => {
    if (viewMode === 'community') {
       fetchCommunityPaths();
    }
  }, [viewMode, fetchCommunityPaths]);

  // --- SYLLABUS LOGIC ---
  // Group Nodes into "Phases" based on their X coordinate (which represents topological level from the AI service)
  const roadmapPhases = useMemo(() => {
    if (!activePath) return [];

    // 1. Get all unique X coordinates (Levels) and sort them
    const nodes = activePath.nodes;
    const uniqueX = Array.from(new Set(nodes.map(n => n.x))).sort((a: number, b: number) => a - b);
    
    // 2. Map levels to Phases
    return uniqueX.map((xVal, index) => {
       // Determine Phase Title
       let title = `Level ${index + 1}`;
       if (index === 0) title = "Phase 1: Foundations";
       else if (index === uniqueX.length - 1 && uniqueX.length > 2) title = "Final Phase: Mastery";
       else title = `Phase ${index + 1}: ${index === 1 ? 'Core Concepts' : 'Advanced Topics'}`;

       return {
         phaseIndex: index,
         title: title,
         // Filter nodes belonging to this level and sort by Y (order within level)
         nodes: nodes.filter(n => n.x === xVal).sort((a: any, b: any) => a.y - b.y)
       };
    });
  }, [activePath]);

  // Expand all phases by default when a new path is selected
  useEffect(() => {
    if (roadmapPhases.length > 0) {
       const defaults: Record<number, boolean> = {};
       roadmapPhases.forEach(p => defaults[p.phaseIndex] = true);
       setExpandedPhases(defaults);
    }
  }, [activePathId, roadmapPhases.length]);

  const togglePhase = (index: number) => {
    setExpandedPhases(prev => ({ ...prev, [index]: !prev[index] }));
  };

  const handleGenerate = async () => {
    if (!goal.trim()) return;
    await generatePathAction(goal);
    setGoal('');
  };

  const getNodeLabel = (id: string) => activePath?.nodes.find(n => n.id === id)?.label || "Unknown Topic";

  const handleNodeClick = async (node: any) => {
    if (node.status === 'locked') {
      const prerequisites = node.prerequisites.map((id: string) => getNodeLabel(id)).join(', ');
      setToast({ 
        msg: `Locked! Complete prerequisites first: ${prerequisites}`, 
        type: 'error' 
      });
      return;
    }
    
    // Navigate to chat with context
    const prompt = `I want to learn about "${node.label}" from my learning path titled "${activePath?.title}". ${node.description}. Please act as my tutor for this specific topic and teach me.`;
    await sendMessage(prompt);
    navigate('/learn');
  };

  const handleCompleteNode = async (e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation();
    if (!activePathId) return;
    
    await completePathNode(activePathId, nodeId);
    
    // Trigger celebration
    setShowConfetti(true);
    setToast({ msg: "Topic Mastered! Progress updated.", type: 'success' });
    setTimeout(() => setShowConfetti(false), 3000);
  };

  const handlePublish = async () => {
    if (activePathId) {
       await publishPath(activePathId);
       setToast({ msg: "Path published to community!", type: 'success' });
    }
  };

  const handleClone = async (path: any) => {
    await clonePath(path);
    setViewMode('mine');
    setToast({ msg: "Path cloned successfully!", type: 'success' });
  };

  const handleExportPDF = () => {
     if (activePath) {
        generateLearningPathPDF(activePath);
     }
  };

  return (
    <div className="h-[calc(100vh-100px)] flex flex-col md:flex-row gap-6 max-w-7xl mx-auto p-4">
      
      {/* Sidebar: Path List */}
      <div className="w-full md:w-80 flex flex-col gap-4 bg-white rounded-2xl shadow-sm border border-slate-200 p-4 shrink-0 overflow-y-auto print:hidden z-20 h-full">
        <div>
           <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2 mb-4">
             <LayoutList className="w-6 h-6 text-indigo-600" /> Learning Paths
           </h2>

           <div className="flex bg-slate-100 p-1 rounded-lg mb-4">
              <button 
                onClick={() => setViewMode('mine')}
                className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${viewMode === 'mine' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                My Paths
              </button>
              <button 
                onClick={() => setViewMode('community')}
                className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all flex items-center justify-center gap-1 ${viewMode === 'community' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Community <Globe className="w-3 h-3"/>
              </button>
           </div>
           
           {viewMode === 'mine' && (
             <div className="space-y-2 mb-6">
               <label className="text-xs font-bold text-slate-400 uppercase">Create New Curriculum</label>
               <input 
                 type="text" 
                 value={goal}
                 onChange={(e) => setGoal(e.target.value)}
                 placeholder="e.g. Master React, Learn Spanish"
                 className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-shadow"
                 disabled={isPathGenerating}
               />
               <button 
                 onClick={handleGenerate}
                 disabled={isPathGenerating || !goal.trim()}
                 className="w-full bg-indigo-600 text-white py-2.5 rounded-lg font-bold text-sm hover:bg-indigo-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm"
               >
                 {isPathGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                 Generate Syllabus
               </button>
             </div>
           )}
        </div>

        {viewMode === 'mine' ? (
          <div className="space-y-3 flex-1">
            {learningPaths.length === 0 && (
              <div className="text-center text-slate-400 text-sm py-8 border-2 border-dashed border-slate-100 rounded-xl">
                 <Map className="w-8 h-8 mx-auto mb-2 opacity-30" />
                 No paths yet.<br/>Type a goal above!
              </div>
            )}
            {learningPaths.map(path => (
              <div 
                key={path.id}
                onClick={() => selectPath(path.id)}
                className={`p-3 rounded-xl border cursor-pointer transition-all group relative ${
                  activePathId === path.id ? 'bg-indigo-50 border-indigo-200 shadow-sm ring-1 ring-indigo-200' : 'bg-white border-slate-100 hover:border-indigo-100 hover:bg-slate-50'
                }`}
              >
                <div className="flex justify-between items-start mb-1">
                   <h3 className={`font-bold text-sm line-clamp-1 ${activePathId === path.id ? 'text-indigo-900' : 'text-slate-700'}`}>
                     {path.title}
                   </h3>
                   <button 
                     onClick={(e) => { e.stopPropagation(); deletePath(path.id); }}
                     className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 p-1 transition-opacity absolute top-2 right-2"
                   >
                     <Trash2 className="w-3 h-3" />
                   </button>
                </div>
                
                <div className="flex items-center gap-2 mt-3">
                   <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-indigo-500 rounded-full transition-all duration-500 ease-out"
                        style={{ width: `${path.progress}%` }}
                      />
                   </div>
                   <span className="text-xs font-bold text-slate-500 min-w-[30px] text-right">{path.progress}%</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-3 flex-1 text-sm text-slate-500 text-center pt-10">
             <Globe className="w-8 h-8 mx-auto mb-2 opacity-30" />
             Select a path from the main view to clone.
          </div>
        )}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden relative print:bg-white print:border-none flex flex-col">
        
        {/* Toast Notification */}
        {toast && (
          <div className={`absolute top-4 left-1/2 transform -translate-x-1/2 z-50 animate-in fade-in slide-in-from-top-4 flex items-center gap-2 px-4 py-2 rounded-full shadow-lg font-medium text-sm ${
             toast.type === 'error' ? 'bg-red-500 text-white' : 
             toast.type === 'success' ? 'bg-green-500 text-white' : 'bg-slate-800 text-white'
          }`}>
             {toast.type === 'error' ? <AlertTriangle className="w-4 h-4"/> : <CheckCircle className="w-4 h-4"/>}
             {toast.msg}
          </div>
        )}

        {/* Confetti Celebration */}
        {showConfetti && (
           <div className="absolute top-10 left-1/2 transform -translate-x-1/2 z-50 pointer-events-none">
              <div className="bg-gradient-to-r from-yellow-400 to-orange-500 text-white px-8 py-4 rounded-full shadow-2xl font-black text-xl flex items-center gap-2 animate-bounce">
                 <Trophy className="w-8 h-8" /> Milestone Reached!
              </div>
           </div>
        )}

        {/* View Content */}
        {viewMode === 'community' ? (
           <div className="w-full h-full overflow-y-auto p-8 custom-scrollbar bg-slate-50">
              <h2 className="text-2xl font-bold text-slate-800 mb-6 flex items-center gap-2">
                 <Globe className="w-6 h-6 text-indigo-600" /> Community Library
              </h2>
              {communityPaths.length === 0 ? (
                 <div className="text-center py-20 text-slate-400">
                    <Loader2 className="w-10 h-10 animate-spin mx-auto mb-4 opacity-50" />
                    <p>Loading community paths...</p>
                 </div>
              ) : (
                 <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {communityPaths.map(path => (
                       <div key={path.id} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 hover:shadow-md transition-shadow flex flex-col">
                          <h3 className="font-bold text-lg text-slate-800 mb-2">{path.title}</h3>
                          <p className="text-sm text-slate-500 mb-4 line-clamp-2">{path.description}</p>
                          <div className="flex items-center gap-2 text-xs text-slate-400 mb-6">
                             <div className="flex items-center gap-1"><Zap className="w-3 h-3"/> {path.nodes.length} Topics</div>
                             <div className="flex items-center gap-1"><Star className="w-3 h-3"/> By {path.authorName}</div>
                          </div>
                          <button 
                            onClick={() => handleClone(path)}
                            className="mt-auto w-full py-2 bg-indigo-50 text-indigo-600 rounded-lg font-bold text-sm hover:bg-indigo-100 flex items-center justify-center gap-2"
                          >
                             <Copy className="w-4 h-4" /> Clone Path
                          </button>
                       </div>
                    ))}
                 </div>
              )}
           </div>
        ) : activePath ? (
          <div className="w-full h-full flex flex-col bg-slate-50">
            
            {/* Header / Actions */}
            <div className="bg-white p-6 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4 sticky top-0 z-10 shadow-sm">
               <div>
                  <h1 className="text-2xl font-bold text-slate-800">{activePath.title}</h1>
                  <div className="flex items-center gap-2 text-slate-500 text-sm mt-1">
                     <Clock className="w-3 h-3" />
                     <span>{activePath.nodes.length} Modules</span>
                     <span>•</span>
                     <span>{activePath.progress}% Complete</span>
                  </div>
               </div>
               
               <div className="flex items-center gap-2">
                  <button 
                     onClick={handleExportPDF} 
                     className="p-2 bg-slate-100 rounded-lg text-slate-600 hover:text-indigo-600 hover:bg-slate-200 transition-colors"
                     title="Export Syllabus PDF"
                  >
                     <FileText className="w-5 h-5" />
                  </button>

                  <button 
                     onClick={handlePublish}
                     disabled={!user || activePath.isPublic}
                     className="p-2 bg-slate-100 rounded-lg text-slate-600 hover:text-indigo-600 hover:bg-slate-200 transition-colors disabled:opacity-50"
                     title={activePath.isPublic ? "Already Published" : "Share to Community"}
                  >
                     <Share2 className="w-5 h-5" />
                  </button>
               </div>
            </div>

            {/* Syllabus Roadmap Timeline */}
            <div className="flex-1 overflow-y-auto p-6 md:p-8 custom-scrollbar">
               <div className="max-w-4xl mx-auto pb-20">
                  
                  {roadmapPhases.map((phase, i) => (
                    <div key={phase.phaseIndex} className="mb-6 last:mb-0 animate-in fade-in slide-in-from-bottom-2" style={{ animationDelay: `${i * 100}ms` }}>
                       
                       {/* Phase Header */}
                       <div 
                         className="flex items-center gap-4 mb-4 cursor-pointer group select-none sticky top-0 bg-slate-50/95 py-2 z-10 backdrop-blur-sm"
                         onClick={() => togglePhase(phase.phaseIndex)}
                       >
                          <div className={`
                             w-8 h-8 rounded-full flex items-center justify-center border-2 transition-colors
                             ${expandedPhases[phase.phaseIndex] ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-slate-300 text-slate-400'}
                          `}>
                             {expandedPhases[phase.phaseIndex] ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                          </div>
                          
                          <div className="flex-1">
                             <h3 className={`font-bold text-sm uppercase tracking-wider ${expandedPhases[phase.phaseIndex] ? 'text-indigo-900' : 'text-slate-500'}`}>
                                {phase.title}
                             </h3>
                          </div>
                          
                          <div className="h-px bg-slate-200 w-16 group-hover:w-24 transition-all"></div>
                       </div>

                       {/* Nodes in Phase */}
                       {expandedPhases[phase.phaseIndex] && (
                         <div className="relative pl-4 md:pl-10 space-y-4">
                            {/* Connector Line */}
                            <div className="absolute left-[15px] top-0 bottom-0 w-px bg-slate-200 border-l border-dashed border-slate-300" style={{ display: i === roadmapPhases.length - 1 ? 'none' : 'block' }}></div>

                            {phase.nodes.map((node) => {
                               const isLocked = node.status === 'locked';
                               const isCompleted = node.status === 'completed';
                               
                               return (
                                  <div 
                                    key={node.id} 
                                    className={`
                                       relative p-5 rounded-xl border-2 transition-all duration-200 group
                                       ${isLocked ? 'bg-slate-100 border-slate-200 opacity-70 grayscale' : 
                                         isCompleted ? 'bg-white border-green-200 shadow-sm' : 
                                         'bg-white border-indigo-100 hover:border-indigo-300 hover:shadow-md cursor-pointer'}
                                    `}
                                    onClick={() => !isLocked && handleNodeClick(node)}
                                  >
                                     {/* Left Icon */}
                                     <div className={`
                                        absolute top-6 -left-[30px] md:-left-[54px] w-8 h-8 rounded-full flex items-center justify-center border-2 z-10
                                        ${isCompleted ? 'bg-green-100 border-green-500 text-green-600' : 
                                          isLocked ? 'bg-slate-200 border-slate-300 text-slate-400' : 
                                          'bg-indigo-100 border-indigo-500 text-indigo-600'}
                                     `}>
                                        {isCompleted ? <CheckCircle className="w-4 h-4" /> : 
                                         isLocked ? <Lock className="w-4 h-4" /> : 
                                         <BookOpen className="w-4 h-4" />}
                                     </div>

                                     <div className="flex justify-between items-start gap-4">
                                        <div className="flex-1">
                                           <h4 className={`font-bold text-lg ${isLocked ? 'text-slate-500' : 'text-slate-800'}`}>
                                              {node.label}
                                           </h4>
                                           <p className="text-sm text-slate-500 mt-1 leading-relaxed">
                                              {node.description}
                                           </p>
                                        </div>

                                        {!isLocked && (
                                           <div className="flex flex-col gap-2 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                              <button 
                                                onClick={(e) => { e.stopPropagation(); handleNodeClick(node); }}
                                                className="p-2 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100"
                                                title="Start Learning Chat"
                                              >
                                                 <ArrowRight className="w-4 h-4" />
                                              </button>
                                              {!isCompleted && (
                                                <button 
                                                  onClick={(e) => handleCompleteNode(e, node.id)}
                                                  className="p-2 bg-green-50 text-green-600 rounded-lg hover:bg-green-100"
                                                  title="Mark as Mastered"
                                                >
                                                   <CheckCircle className="w-4 h-4" />
                                                </button>
                                              )}
                                           </div>
                                        )}
                                     </div>
                                  </div>
                               );
                            })}
                         </div>
                       )}
                    </div>
                  ))}
                  
                  {/* End of Path */}
                  <div className="pl-4 md:pl-10 pt-8 pb-4">
                     <div className="bg-slate-100 rounded-2xl p-6 text-center border-2 border-slate-200 border-dashed text-slate-400 flex flex-col items-center">
                        <Star className="w-8 h-8 mb-2 text-yellow-400 fill-current" />
                        <p className="font-bold text-sm uppercase tracking-wide">Curriculum Complete</p>
                        <p className="text-xs mt-1">Great job mastering this path!</p>
                     </div>
                  </div>

               </div>
            </div>
          </div>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 bg-slate-50">
             <div className="bg-white p-8 rounded-full shadow-sm mb-6 border border-slate-100">
                <Map className="w-16 h-16 text-indigo-200" />
             </div>
             <h3 className="text-xl font-bold text-slate-700 mb-2">Select a Path</h3>
             <p className="max-w-xs text-center text-slate-500">
               Choose a curriculum from the sidebar or generate a new one to start learning.
             </p>
          </div>
        )}
      </div>
    </div>
  );
};

// Trophy Component Helper
function Trophy({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>
  )
}