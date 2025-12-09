
import React, { useState, useRef, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { 
  GitGraph, Plus, Loader2, Lock, CheckCircle, Circle, 
  Map, Printer, Trash2, ArrowRight, Star, AlertTriangle, Zap,
  Layout, ZoomIn, ZoomOut, Move
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const PathInterface: React.FC = () => {
  const navigate = useNavigate();
  const { 
    learningPaths, 
    activePathId, 
    isPathGenerating, 
    generatePathAction,
    selectPath,
    deletePath,
    completePathNode,
    updatePathNodePosition,
    sendMessage
  } = useStore();

  const [goal, setGoal] = useState('');
  const [draggedNode, setDraggedNode] = useState<{ id: string, startX: number, startY: number } | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  
  // View State (Zoom/Pan)
  const [viewTransform, setViewTransform] = useState({ x: 0, y: 0, scale: 1 });

  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [showConfetti, setShowConfetti] = useState(false);
  const [toast, setToast] = useState<{ msg: string, type: 'neutral' | 'error' | 'success' } | null>(null);
  
  const svgRef = useRef<SVGSVGElement>(null);

  const activePath = learningPaths.find(p => p.id === activePathId);

  // Clear toast automatically
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const handleGenerate = async () => {
    if (!goal.trim()) return;
    await generatePathAction(goal);
    setGoal('');
    // Reset view when new path is generated
    setViewTransform({ x: 0, y: 0, scale: 1 });
  };

  const getNodeLabel = (id: string) => activePath?.nodes.find(n => n.id === id)?.label || "Unknown Topic";

  const handleNodeClick = async (node: any) => {
    if (node.status === 'locked') {
      const prerequisites = node.prerequisites.map((id: string) => getNodeLabel(id)).join(', ');
      setToast({ 
        msg: `Locked! Complete these first: ${prerequisites}`, 
        type: 'error' 
      });
      return;
    }
    
    // Navigate to chat with context
    const prompt = `I want to learn about "${node.label}" from my learning path titled "${activePath?.title}". ${node.description}. Please act as my tutor for this specific topic.`;
    await sendMessage(prompt);
    navigate('/learn');
  };

  const handleCompleteNode = async (e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation();
    if (!activePathId) return;
    
    await completePathNode(activePathId, nodeId);
    
    // Trigger celebration
    setShowConfetti(true);
    setToast({ msg: "Topic Mastered! Checking for unlocked topics...", type: 'success' });
    setTimeout(() => setShowConfetti(false), 3000);
  };

  const handleMouseDown = (e: React.MouseEvent, nodeId: string) => {
    if (e.button !== 0) return; // Only left click
    e.stopPropagation();
    
    setDraggedNode({ id: nodeId, startX: e.clientX, startY: e.clientY });
    
    // Calculate offset of mouse relative to node center in SVG coords
    const node = activePath?.nodes.find(n => n.id === nodeId);
    if (node && svgRef.current) {
        // We need to account for the viewTransform (pan/zoom)
        // Screen -> SVG transformation involves removing pan/zoom
        const svgRect = svgRef.current.getBoundingClientRect();
        const mouseXInSvg = (e.clientX - svgRect.left - viewTransform.x) / viewTransform.scale;
        const mouseYInSvg = (e.clientY - svgRect.top - viewTransform.y) / viewTransform.scale;
        
        setOffset({ x: mouseXInSvg - node.x, y: mouseYInSvg - node.y });
    }
  };

  const handleBgMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    setIsPanning(true);
    setPanStart({ x: e.clientX - viewTransform.x, y: e.clientY - viewTransform.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
        setViewTransform(prev => ({
            ...prev,
            x: e.clientX - panStart.x,
            y: e.clientY - panStart.y
        }));
        return;
    }

    if (!draggedNode || !activePathId || !svgRef.current) return;
    
    const svgRect = svgRef.current.getBoundingClientRect();
    const x = ((e.clientX - svgRect.left - viewTransform.x) / viewTransform.scale) - offset.x;
    const y = ((e.clientY - svgRect.top - viewTransform.y) / viewTransform.scale) - offset.y;

    updatePathNodePosition(activePathId, draggedNode.id, x, y);
  };

  const handleMouseUp = () => {
    setDraggedNode(null);
    setIsPanning(false);
  };

  const printPath = () => {
    window.print();
  };

  const handleZoom = (delta: number) => {
    setViewTransform(prev => ({
        ...prev,
        scale: Math.max(0.2, Math.min(3, prev.scale + delta))
    }));
  };

  const handleResetView = () => {
    setViewTransform({ x: 0, y: 0, scale: 1 });
  };

  // --- Render Logic ---
  
  const renderConnections = () => {
    if (!activePath) return null;
    return activePath.nodes.flatMap(node => 
      node.prerequisites.map(parentId => {
        const parent = activePath.nodes.find(n => n.id === parentId);
        if (!parent) return null;
        
        // Smoother Bezier curve calculation
        const dist = Math.abs(node.x - parent.x);
        const cpOffset = Math.max(dist * 0.5, 80); // Increased min curve for elegance
        
        const d = `M ${parent.x} ${parent.y} C ${parent.x + cpOffset} ${parent.y}, ${node.x - cpOffset} ${node.y}, ${node.x} ${node.y}`;
        const isUnlocked = node.status !== 'locked';
        
        return (
          <path 
            key={`${parent.id}-${node.id}`}
            d={d}
            stroke={isUnlocked ? "#6366f1" : "#e2e8f0"}
            strokeWidth={2} // Consistent width
            fill="none"
            className="transition-colors duration-500"
            markerEnd={isUnlocked ? "url(#arrow-active)" : "url(#arrow-locked)"}
          />
        );
      })
    );
  };

  return (
    <div 
      className="h-[calc(100vh-100px)] flex flex-col md:flex-row gap-4 max-w-7xl mx-auto p-4" 
      onMouseUp={handleMouseUp} 
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseUp}
    >
      <style>{`
        @keyframes popIn {
          0% { transform: scale(0); opacity: 0; }
          60% { transform: scale(1.1); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes pulse-unlock {
          0% { stroke-width: 3; }
          50% { stroke-width: 6; stroke: #818cf8; }
          100% { stroke-width: 3; }
        }
      `}</style>

      {/* Sidebar */}
      <div className="w-full md:w-80 flex flex-col gap-4 bg-white rounded-2xl shadow-sm border border-slate-200 p-4 shrink-0 overflow-y-auto print:hidden z-20">
        <div>
           <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2 mb-4">
             <GitGraph className="w-6 h-6 text-indigo-600" /> Learning Paths
           </h2>
           
           <div className="space-y-2 mb-6">
             <label className="text-xs font-bold text-slate-400 uppercase">Create New Path</label>
             <input 
               type="text" 
               value={goal}
               onChange={(e) => setGoal(e.target.value)}
               placeholder="e.g. Learn Web Development"
               className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-shadow"
             />
             <button 
               onClick={handleGenerate}
               disabled={isPathGenerating || !goal.trim()}
               className="w-full bg-indigo-600 text-white py-2.5 rounded-lg font-bold text-sm hover:bg-indigo-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm"
             >
               {isPathGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
               Generate AI Path
             </button>
           </div>
        </div>

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
                activePathId === path.id ? 'bg-indigo-50 border-indigo-200 shadow-sm' : 'bg-white border-slate-100 hover:border-indigo-100 hover:bg-slate-50'
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
                 <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
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
      </div>

      {/* Main Graph Area */}
      <div className="flex-1 bg-slate-50 rounded-2xl border border-slate-200 shadow-inner overflow-hidden relative print:bg-white print:border-none">
        
        {/* Toast Notification */}
        {toast && (
          <div className={`absolute top-20 left-1/2 transform -translate-x-1/2 z-50 animate-in fade-in slide-in-from-top-4 flex items-center gap-2 px-4 py-2 rounded-full shadow-lg font-medium text-sm ${
             toast.type === 'error' ? 'bg-red-500 text-white' : 
             toast.type === 'success' ? 'bg-green-500 text-white' : 'bg-slate-800 text-white'
          }`}>
             {toast.type === 'error' ? <AlertTriangle className="w-4 h-4"/> : <CheckCircle className="w-4 h-4"/>}
             {toast.msg}
          </div>
        )}

        {activePath ? (
          <>
            {/* Toolbar */}
            <div className="absolute top-4 left-4 z-10 flex flex-wrap gap-2 print:hidden pointer-events-none">
               <div className="bg-white/90 backdrop-blur px-4 py-2 rounded-lg shadow-sm border border-slate-200 pointer-events-auto">
                  <h1 className="font-bold text-slate-800 flex items-center gap-2">
                     <GitGraph className="w-5 h-5 text-indigo-600"/> {activePath.title}
                  </h1>
               </div>
            </div>
            
            <div className="absolute top-4 right-4 z-10 flex gap-2 print:hidden">
              <div className="bg-white rounded-lg shadow-sm border border-slate-200 flex items-center overflow-hidden">
                 <button onClick={() => handleZoom(-0.1)} className="p-2 hover:bg-slate-50 text-slate-600" title="Zoom Out"><ZoomOut className="w-5 h-5"/></button>
                 <span className="text-xs font-mono w-12 text-center text-slate-400">{Math.round(viewTransform.scale * 100)}%</span>
                 <button onClick={() => handleZoom(0.1)} className="p-2 hover:bg-slate-50 text-slate-600" title="Zoom In"><ZoomIn className="w-5 h-5"/></button>
              </div>
              
              <button 
                 onClick={handleResetView}
                 className="p-2 bg-white rounded-lg shadow-sm border border-slate-200 text-slate-600 hover:text-indigo-600 transition-colors"
                 title="Reset View"
              >
                 <Layout className="w-5 h-5" />
              </button>

              <button 
                 onClick={printPath} 
                 className="p-2 bg-white rounded-lg shadow-sm border border-slate-200 text-slate-600 hover:text-indigo-600 transition-colors"
                 title="Print Path"
              >
                 <Printer className="w-5 h-5" />
              </button>
            </div>

            {/* Achievement Celebration */}
            {showConfetti && (
               <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50 pointer-events-none">
                  <div className="bg-gradient-to-r from-yellow-400 to-orange-500 text-white px-8 py-4 rounded-full shadow-2xl font-black text-xl flex items-center gap-2 animate-bounce">
                     <Trophy className="w-8 h-8" /> Milestone Reached!
                  </div>
               </div>
            )}

            {/* SVG Graph */}
            <svg 
              ref={svgRef}
              className={`w-full h-full ${isPanning ? 'cursor-move' : 'cursor-grab'}`}
              onMouseDown={handleBgMouseDown}
            >
              <defs>
                <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                  <circle cx="2" cy="2" r="1.5" fill="#cbd5e1" opacity="0.6" />
                </pattern>
                
                {/* 
                   Marker Logic:
                   refX=39: Aligns 39 units along marker X axis with the node center.
                   Arrow tip is at x=12. 
                   Distance from center = 39 - 12 = 27.
                   Node radius = 28.
                   Result: Arrow tip is 1px inside the node circle.
                */}
                <marker id="arrow-active" markerWidth="12" markerHeight="12" refX="39" refY="6" orient="auto" markerUnits="userSpaceOnUse">
                  <path d="M0,0 L12,6 L0,12" fill="#6366f1" />
                </marker>
                <marker id="arrow-locked" markerWidth="12" markerHeight="12" refX="39" refY="6" orient="auto" markerUnits="userSpaceOnUse">
                  <path d="M0,0 L12,6 L0,12" fill="#cbd5e1" />
                </marker>
                
                <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
                  <feDropShadow dx="0" dy="4" stdDeviation="4" floodOpacity="0.1"/>
                </filter>
              </defs>
              
              {/* Grid Background */}
              <rect width="100%" height="100%" fill="url(#grid)" />

              <g transform={`translate(${viewTransform.x}, ${viewTransform.y}) scale(${viewTransform.scale})`}>
                {renderConnections()}

                {activePath.nodes.map((node, index) => {
                  const isLocked = node.status === 'locked';
                  const isCompleted = node.status === 'completed';
                  const isUnlocked = node.status === 'unlocked';
                  
                  return (
                    <g 
                      key={node.id} 
                      transform={`translate(${node.x},${node.y})`}
                      className="transition-transform duration-200"
                      style={{ 
                        cursor: isLocked ? 'not-allowed' : 'pointer',
                        animation: `popIn 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards`,
                        animationDelay: `${index * 100}ms`,
                        opacity: 0, // Initial state for animation
                        transformOrigin: 'center'
                      }}
                    >
                      {/* Node Circle */}
                      <circle 
                        r="28" 
                        className={`
                          transition-all duration-500 ease-in-out
                          ${isCompleted ? 'fill-green-50 stroke-green-500' : 
                            isLocked ? 'fill-slate-100 stroke-slate-300' : 
                            'fill-white stroke-indigo-600'}
                        `}
                        strokeWidth={isUnlocked ? '3' : '2'}
                        style={{
                           filter: 'url(#shadow)',
                           animation: isUnlocked ? 'pulse-unlock 2s infinite' : 'none'
                        }}
                        onMouseDown={(e) => handleMouseDown(e, node.id)}
                      />

                      {/* Icon */}
                      <foreignObject x="-12" y="-12" width="24" height="24" className="pointer-events-none">
                         <div className="flex items-center justify-center w-full h-full">
                           {isCompleted ? <CheckCircle className="w-6 h-6 text-green-600" /> :
                            isLocked ? <Lock className="w-5 h-5 text-slate-400" /> :
                            <Zap className="w-6 h-6 text-indigo-600 fill-indigo-100" />}
                         </div>
                      </foreignObject>

                      {/* Label & Controls */}
                      <foreignObject x="-100" y="38" width="200" height="120">
                        <div className="text-center flex flex-col items-center">
                          <p className={`text-xs font-bold mb-1 px-3 py-1 rounded-full transition-colors shadow-sm border inline-block max-w-full truncate ${
                               isLocked ? 'text-slate-500 bg-slate-50 border-slate-200' : 
                               isCompleted ? 'text-green-700 bg-green-50 border-green-200' : 
                               'text-indigo-700 bg-indigo-50 border-indigo-200'
                             }`}>
                            {node.label}
                          </p>
                          
                          {/* Interactive Buttons */}
                          {!isLocked && (
                            <div className="flex justify-center gap-1 opacity-0 hover:opacity-100 transition-opacity bg-white/90 shadow-sm rounded-full p-1 mt-1 border border-slate-100 scale-90 hover:scale-100">
                               <button 
                                 onClick={() => handleNodeClick(node)}
                                 className="bg-indigo-600 text-white p-1.5 rounded-full hover:bg-indigo-700 transition-transform hover:scale-110" 
                                 title="Start Learning Topic"
                               >
                                 <ArrowRight className="w-3 h-3" />
                               </button>
                               {!isCompleted && (
                                 <button 
                                   onClick={(e) => handleCompleteNode(e, node.id)}
                                   className="bg-green-600 text-white p-1.5 rounded-full hover:bg-green-700 transition-transform hover:scale-110"
                                   title="Mark as Completed"
                                 >
                                   <CheckCircle className="w-3 h-3" />
                                 </button>
                               )}
                            </div>
                          )}
                        </div>
                      </foreignObject>
                    </g>
                  );
                })}
              </g>
            </svg>
            
            <div className="absolute bottom-4 right-4 bg-white/90 backdrop-blur px-3 py-2 rounded-xl text-xs font-medium text-slate-500 print:hidden shadow-sm border border-slate-100 flex items-center gap-2">
               <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-green-500"></div>Completed</span>
               <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-indigo-500"></div>Available</span>
               <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-slate-300"></div>Locked</span>
            </div>
            
            {/* Quick Helper for Panning */}
            {!isPanning && (
               <div className="absolute bottom-4 left-4 text-slate-400 text-xs flex items-center gap-1 pointer-events-none opacity-50">
                  <Move className="w-3 h-3"/> Drag background to pan
               </div>
            )}
          </>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 bg-slate-50/50">
             <div className="bg-white p-8 rounded-full shadow-lg mb-6 border border-slate-100">
                <Map className="w-16 h-16 text-indigo-200" />
             </div>
             <h3 className="text-xl font-bold text-slate-700 mb-2">Start Your Journey</h3>
             <p className="max-w-xs text-center text-slate-500">
               Enter a learning goal in the sidebar (e.g. "Master React", "Learn Spanish") to generate a custom path.
             </p>
          </div>
        )}
      </div>
    </div>
  );
};

// Trophy Component
function Trophy({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>
  )
}
