import React, { useState, useRef, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { 
  GitGraph, Plus, Loader2, Lock, CheckCircle, Circle, 
  Map, Printer, Share2, Trash2, ArrowRight, MousePointer2 
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
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [showConfetti, setShowConfetti] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);

  const activePath = learningPaths.find(p => p.id === activePathId);

  const handleGenerate = async () => {
    if (!goal.trim()) return;
    await generatePathAction(goal);
    setGoal('');
  };

  const handleNodeClick = async (node: any) => {
    if (node.status === 'locked') return;
    
    // Navigate to chat with context
    const prompt = `I want to learn about "${node.label}" from my learning path titled "${activePath?.title}". ${node.description}`;
    await sendMessage(prompt);
    navigate('/learn');
  };

  const handleCompleteNode = async (e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation();
    if (!activePathId) return;
    await completePathNode(activePathId, nodeId);
    // Trigger celebration
    setShowConfetti(true);
    setTimeout(() => setShowConfetti(false), 3000);
  };

  const handleMouseDown = (e: React.MouseEvent, nodeId: string) => {
    if (e.button !== 0) return; // Only left click
    e.stopPropagation();
    setDraggedNode({ id: nodeId, startX: e.clientX, startY: e.clientY });
    
    // Calculate offset of mouse relative to node center
    const node = activePath?.nodes.find(n => n.id === nodeId);
    if (node && svgRef.current) {
       const CTM = svgRef.current.getScreenCTM();
       if (CTM) {
          const mouseX = (e.clientX - CTM.e) / CTM.a;
          const mouseY = (e.clientY - CTM.f) / CTM.d;
          setOffset({ x: mouseX - node.x, y: mouseY - node.y });
       }
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!draggedNode || !activePathId || !svgRef.current) return;
    
    const CTM = svgRef.current.getScreenCTM();
    if (!CTM) return;

    const x = (e.clientX - CTM.e) / CTM.a - offset.x;
    const y = (e.clientY - CTM.f) / CTM.d - offset.y;

    updatePathNodePosition(activePathId, draggedNode.id, x, y);
  };

  const handleMouseUp = () => {
    setDraggedNode(null);
  };

  const printPath = () => {
    window.print();
  };

  // --- SVG Layout ---
  
  const renderConnections = () => {
    if (!activePath) return null;
    return activePath.nodes.flatMap(node => 
      node.prerequisites.map(parentId => {
        const parent = activePath.nodes.find(n => n.id === parentId);
        if (!parent) return null;
        
        // Bezier curve
        const d = `M ${parent.x} ${parent.y} C ${parent.x + 50} ${parent.y}, ${node.x - 50} ${node.y}, ${node.x} ${node.y}`;
        
        const isUnlocked = node.status !== 'locked';
        
        return (
          <path 
            key={`${parent.id}-${node.id}`}
            d={d}
            stroke={isUnlocked ? "#6366f1" : "#cbd5e1"}
            strokeWidth="2"
            fill="none"
            markerEnd={isUnlocked ? "url(#arrow-active)" : "url(#arrow-locked)"}
          />
        );
      })
    );
  };

  return (
    <div className="h-[calc(100vh-100px)] flex flex-col md:flex-row gap-4 max-w-7xl mx-auto p-4" onMouseUp={handleMouseUp} onMouseMove={handleMouseMove}>
      
      {/* Sidebar */}
      <div className="w-full md:w-80 flex flex-col gap-4 bg-white rounded-2xl shadow-sm border border-slate-200 p-4 shrink-0 overflow-y-auto print:hidden">
        <div>
           <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2 mb-4">
             <GitGraph className="w-6 h-6 text-indigo-600" /> Learning Paths
           </h2>
           
           <div className="space-y-2 mb-6">
             <input 
               type="text" 
               value={goal}
               onChange={(e) => setGoal(e.target.value)}
               placeholder="Enter a learning goal..."
               className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
             />
             <button 
               onClick={handleGenerate}
               disabled={isPathGenerating || !goal.trim()}
               className="w-full bg-indigo-600 text-white py-2 rounded-lg font-medium text-sm hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
             >
               {isPathGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
               Generate Path
             </button>
           </div>
        </div>

        <div className="space-y-2 flex-1">
          {learningPaths.length === 0 && (
            <p className="text-center text-slate-400 text-sm py-4">No paths yet. Create one!</p>
          )}
          {learningPaths.map(path => (
            <div 
              key={path.id}
              onClick={() => selectPath(path.id)}
              className={`p-3 rounded-xl border cursor-pointer transition-all group ${
                activePathId === path.id ? 'bg-indigo-50 border-indigo-200 ring-1 ring-indigo-200' : 'bg-white border-slate-100 hover:border-indigo-100'
              }`}
            >
              <div className="flex justify-between items-start mb-1">
                 <h3 className={`font-semibold text-sm ${activePathId === path.id ? 'text-indigo-900' : 'text-slate-700'}`}>
                   {path.title}
                 </h3>
                 <button 
                   onClick={(e) => { e.stopPropagation(); deletePath(path.id); }}
                   className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 p-1"
                 >
                   <Trash2 className="w-3 h-3" />
                 </button>
              </div>
              
              <div className="flex items-center gap-2 mt-2">
                 <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-indigo-500 rounded-full transition-all duration-500"
                      style={{ width: `${path.progress}%` }}
                    />
                 </div>
                 <span className="text-xs font-bold text-slate-500">{path.progress}%</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Main Graph Area */}
      <div className="flex-1 bg-slate-50 rounded-2xl border border-slate-200 shadow-inner overflow-hidden relative print:bg-white print:border-none">
        {activePath ? (
          <>
            {/* Toolbar */}
            <div className="absolute top-4 left-4 z-10 flex gap-2 print:hidden">
               <div className="bg-white/90 backdrop-blur px-4 py-2 rounded-lg shadow-sm border border-slate-200">
                  <h1 className="font-bold text-slate-800">{activePath.title}</h1>
               </div>
            </div>
            
            <div className="absolute top-4 right-4 z-10 flex gap-2 print:hidden">
              <button onClick={printPath} className="p-2 bg-white rounded-lg shadow-sm border border-slate-200 text-slate-600 hover:text-indigo-600">
                 <Printer className="w-5 h-5" />
              </button>
            </div>

            {/* Achievement Toast */}
            {showConfetti && (
               <div className="absolute top-20 left-1/2 transform -translate-x-1/2 z-50 animate-bounce">
                  <div className="bg-gradient-to-r from-yellow-400 to-orange-500 text-white px-6 py-3 rounded-full shadow-lg font-bold flex items-center gap-2">
                     <Trophy className="w-6 h-6" /> Milestone Reached!
                  </div>
               </div>
            )}

            {/* SVG Graph */}
            <svg 
              ref={svgRef}
              className="w-full h-full cursor-grab active:cursor-grabbing"
              style={{ minHeight: '600px' }}
            >
              <defs>
                <marker id="arrow-active" markerWidth="10" markerHeight="7" refX="28" refY="3.5" orient="auto">
                  <polygon points="0 0, 10 3.5, 0 7" fill="#6366f1" />
                </marker>
                <marker id="arrow-locked" markerWidth="10" markerHeight="7" refX="28" refY="3.5" orient="auto">
                  <polygon points="0 0, 10 3.5, 0 7" fill="#cbd5e1" />
                </marker>
              </defs>
              
              {renderConnections()}

              {activePath.nodes.map(node => {
                const isLocked = node.status === 'locked';
                const isCompleted = node.status === 'completed';
                
                return (
                  <g 
                    key={node.id} 
                    transform={`translate(${node.x},${node.y})`}
                    className="transition-transform duration-75"
                    style={{ cursor: isLocked ? 'not-allowed' : 'pointer' }}
                  >
                    {/* Node Circle */}
                    <circle 
                      r="25" 
                      className={`
                        ${isCompleted ? 'fill-green-100 stroke-green-500' : isLocked ? 'fill-slate-100 stroke-slate-300' : 'fill-white stroke-indigo-500'}
                      `}
                      strokeWidth="3"
                      onMouseDown={(e) => handleMouseDown(e, node.id)}
                    />

                    {/* Icon */}
                    <foreignObject x="-12" y="-12" width="24" height="24" className="pointer-events-none">
                       <div className="flex items-center justify-center w-full h-full">
                         {isCompleted ? <CheckCircle className="w-6 h-6 text-green-600" /> :
                          isLocked ? <Lock className="w-6 h-6 text-slate-400" /> :
                          <Circle className="w-6 h-6 text-indigo-600" />}
                       </div>
                    </foreignObject>

                    {/* Label */}
                    <foreignObject x="-75" y="35" width="150" height="100">
                      <div className="text-center">
                        <p className={`text-xs font-bold mb-1 ${isLocked ? 'text-slate-400' : 'text-slate-800'}`}>
                          {node.label}
                        </p>
                        
                        {/* Actions */}
                        {!isLocked && (
                          <div className="flex justify-center gap-1 opacity-0 hover:opacity-100 transition-opacity bg-white/80 rounded px-1 py-1">
                             <button 
                               onClick={() => handleNodeClick(node)}
                               className="bg-indigo-600 text-white p-1 rounded hover:bg-indigo-700" 
                               title="Start Learning"
                             >
                               <ArrowRight className="w-3 h-3" />
                             </button>
                             {!isCompleted && (
                               <button 
                                 onClick={(e) => handleCompleteNode(e, node.id)}
                                 className="bg-green-600 text-white p-1 rounded hover:bg-green-700"
                                 title="Mark Complete"
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
            </svg>
            
            <div className="absolute bottom-4 right-4 bg-white/80 backdrop-blur p-2 rounded-lg text-xs text-slate-500 print:hidden">
               Drag nodes to rearrange • Click arrow to learn
            </div>
          </>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-slate-400">
             <Map className="w-16 h-16 mb-4 opacity-50" />
             <p className="text-lg">Select or generate a learning path to begin.</p>
          </div>
        )}
      </div>
    </div>
  );
};

// Simple trophy component helper not strictly needed if we use Lucide, included in line.
function Trophy({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>
  )
}
