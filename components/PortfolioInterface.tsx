import React, { useMemo, useState } from 'react';
import { useStore } from '../store/useStore';
import { 
  User, Share2, Award, Download, FileText, Database, Shield, Globe, 
  Linkedin, Star, CheckCircle, Copy, Check, MessageSquare
} from 'lucide-react';
import { generateCertificatePDF, downloadJSON, downloadCSV, convertSessionsToCSV } from '../services/exportService';

export const PortfolioInterface: React.FC = () => {
  const { user, quizResults, certificates, portfolio, updatePortfolio, streak, sessions, issueCertificate } = useStore();
  const [copiedLink, setCopiedLink] = useState(false);

  // Aggregate Skills from Quiz Results
  const skills = useMemo(() => {
    const skillMap: { [topic: string]: { total: number, score: number, count: number } } = {};
    quizResults.forEach(r => {
      if (!skillMap[r.topic]) skillMap[r.topic] = { total: 0, score: 0, count: 0 };
      skillMap[r.topic].total += r.total;
      skillMap[r.topic].score += r.score;
      skillMap[r.topic].count += 1;
    });
    
    return Object.entries(skillMap).map(([topic, data]) => ({
      topic,
      mastery: Math.round((data.score / data.total) * 100),
      quizzes: data.count,
      isEligibleForCert: (data.score / data.total) >= 0.9 && data.count >= 3
    })).sort((a, b) => b.mastery - a.mastery);
  }, [quizResults]);

  const handleExportDataJSON = () => {
    const data = {
      userProfile: user,
      portfolio,
      stats: streak,
      skills,
      certificates,
      sessions,
      quizResults
    };
    downloadJSON(data, `LearnMate_Data_${new Date().toISOString().split('T')[0]}.json`);
  };

  const handleExportDataCSV = () => {
    const csvData = quizResults.map(r => ({
      Date: new Date(r.date).toLocaleDateString(),
      Topic: r.topic,
      Score: r.score,
      Total: r.total,
      Percentage: `${Math.round((r.score/r.total)*100)}%`
    }));
    downloadCSV(csvData, `LearnMate_Quiz_Results.csv`);
  };

  const handleExportSessionsCSV = () => {
    const csvData = convertSessionsToCSV(sessions);
    downloadCSV(csvData, `LearnMate_Chat_Sessions.csv`);
  };

  const handleIssueCert = (topic: string) => {
    if (certificates.some(c => c.topic === topic)) return; // Already exists
    issueCertificate(topic);
  };

  const copyPublicLink = () => {
    if (user) {
       // Simulate a public link
       const dummyLink = `https://learnmate.ai/u/${user.uid.slice(0, 8)}`;
       navigator.clipboard.writeText(dummyLink);
       setCopiedLink(true);
       setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-12">
      
      {/* Header Profile Card */}
      <div className="bg-white rounded-2xl shadow-lg border border-slate-100 overflow-hidden">
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 h-32 relative">
          <div className="absolute -bottom-12 left-8">
            {user?.photoURL ? (
              <img src={user.photoURL} alt="Profile" className="w-24 h-24 rounded-full border-4 border-white shadow-md object-cover" />
            ) : (
              <div className="w-24 h-24 rounded-full bg-white flex items-center justify-center border-4 border-indigo-50 shadow-md">
                 <User className="w-12 h-12 text-indigo-300" />
              </div>
            )}
          </div>
        </div>
        
        <div className="pt-16 pb-6 px-8 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
           <div>
              <h1 className="text-2xl font-bold text-slate-800">{user?.displayName || 'Learner'}</h1>
              <p className="text-slate-500">{user?.email}</p>
              {portfolio.bio && <p className="mt-2 text-slate-600 max-w-lg">{portfolio.bio}</p>}
           </div>

           <div className="flex flex-wrap gap-3">
              <button 
                onClick={() => updatePortfolio({ isPublic: !portfolio.isPublic })}
                className={`px-4 py-2 rounded-lg font-medium text-sm flex items-center gap-2 transition-colors ${portfolio.isPublic ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
              >
                {portfolio.isPublic ? <Globe className="w-4 h-4" /> : <Shield className="w-4 h-4" />}
                {portfolio.isPublic ? 'Public Profile Active' : 'Private Profile'}
              </button>

              {portfolio.isPublic && (
                <button 
                  onClick={copyPublicLink}
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg font-medium text-sm hover:bg-slate-200 flex items-center gap-2 transition-colors"
                >
                  {copiedLink ? <Check className="w-4 h-4 text-green-600" /> : <Share2 className="w-4 h-4" />}
                  {copiedLink ? 'Link Copied' : 'Share'}
                </button>
              )}
              
              <div className="flex gap-2">
                 <button 
                    onClick={handleExportDataJSON}
                    className="px-4 py-2 bg-slate-900 text-white rounded-lg font-medium text-sm hover:bg-slate-800 flex items-center gap-2 transition-colors"
                    title="Export Full Data (JSON)"
                 >
                    <Database className="w-4 h-4" /> Backup
                 </button>
                 <button 
                    onClick={handleExportDataCSV}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium text-sm hover:bg-indigo-700 flex items-center gap-2 transition-colors"
                    title="Export Quiz Results (CSV)"
                 >
                    <FileText className="w-4 h-4" /> Quizzes
                 </button>
                 <button 
                    onClick={handleExportSessionsCSV}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium text-sm hover:bg-indigo-700 flex items-center gap-2 transition-colors"
                    title="Export Chat History (CSV)"
                 >
                    <MessageSquare className="w-4 h-4" /> Chats
                 </button>
              </div>
           </div>
        </div>

        {/* Portfolio Settings */}
        <div className="px-8 pb-6 border-t border-slate-100 pt-6">
           <div className="flex items-center gap-4 text-sm text-slate-500 select-none">
             <label className="flex items-center gap-2 cursor-pointer hover:text-indigo-600 transition-colors">
               <input 
                 type="checkbox" 
                 checked={portfolio.showStreaks} 
                 onChange={(e) => updatePortfolio({ showStreaks: e.target.checked })}
                 className="rounded text-indigo-600 focus:ring-indigo-500"
               />
               Show Streak Stats on Profile
             </label>
             <label className="flex items-center gap-2 cursor-pointer hover:text-indigo-600 transition-colors">
               <input 
                 type="checkbox" 
                 checked={portfolio.showCertificates} 
                 onChange={(e) => updatePortfolio({ showCertificates: e.target.checked })}
                 className="rounded text-indigo-600 focus:ring-indigo-500"
               />
               Show Certificates on Profile
             </label>
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        
        {/* Skills Matrix */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col">
           <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
             <Star className="w-5 h-5 text-indigo-600" /> Skill Endorsements
           </h2>
           
           <div className="space-y-4 max-h-[400px] overflow-y-auto custom-scrollbar pr-2 flex-1">
             {skills.length === 0 && (
                <div className="text-center py-10 text-slate-400 flex flex-col items-center">
                   <Award className="w-12 h-12 mb-2 opacity-30" />
                   <p>No skills detected yet.</p>
                   <p className="text-xs">Complete quizzes to demonstrate mastery.</p>
                </div>
             )}
             {skills.map(skill => (
               <div key={skill.topic} className="p-4 rounded-xl bg-slate-50 border border-slate-100 transition-colors hover:border-indigo-100">
                  <div className="flex justify-between items-center mb-2">
                     <span className="font-bold text-slate-700 truncate max-w-[150px]" title={skill.topic}>{skill.topic}</span>
                     <span className={`px-2 py-0.5 rounded text-xs font-bold ${skill.mastery >= 90 ? 'bg-green-100 text-green-700' : 'bg-indigo-100 text-indigo-700'}`}>
                       {skill.mastery}% Mastery
                     </span>
                  </div>
                  <div className="h-2 bg-slate-200 rounded-full overflow-hidden mb-2">
                     <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${skill.mastery}%` }} />
                  </div>
                  <div className="flex justify-between items-center mt-3">
                     <span className="text-xs text-slate-400">{skill.quizzes} Quizzes Taken</span>
                     {skill.isEligibleForCert && (
                        <button 
                          onClick={() => handleIssueCert(skill.topic)}
                          disabled={certificates.some(c => c.topic === skill.topic)}
                          className="text-xs flex items-center gap-1 text-indigo-600 hover:text-indigo-800 font-medium disabled:opacity-50 disabled:cursor-default transition-colors"
                        >
                          {certificates.some(c => c.topic === skill.topic) ? (
                            <><CheckCircle className="w-3 h-3" /> Certified</>
                          ) : (
                            <><Award className="w-3 h-3" /> Claim Certificate</>
                          )}
                        </button>
                     )}
                  </div>
               </div>
             ))}
           </div>
        </div>

        {/* Certificates */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col">
           <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
             <Award className="w-5 h-5 text-indigo-600" /> Certificates
           </h2>
           
           <div className="space-y-4 max-h-[400px] overflow-y-auto custom-scrollbar pr-2 flex-1">
              {certificates.length === 0 && (
                <div className="text-center py-10 border-2 border-dashed border-slate-100 rounded-xl">
                   <Award className="w-12 h-12 text-slate-300 mx-auto mb-2" />
                   <p className="text-slate-500 font-medium">No certificates yet.</p>
                   <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">Achieve 90% mastery in 3+ quizzes for a topic to earn a certificate.</p>
                </div>
              )}
              {certificates.map(cert => (
                <div key={cert.id} className="flex items-center p-4 bg-gradient-to-r from-indigo-50 to-white border border-indigo-100 rounded-xl transition-transform hover:scale-[1.02]">
                   <div className="p-3 bg-white rounded-full shadow-sm mr-4 shrink-0">
                      <Award className="w-6 h-6 text-indigo-600" />
                   </div>
                   <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-slate-800 truncate">{cert.title}</h3>
                      <p className="text-sm text-slate-600 truncate">{cert.topic}</p>
                      <p className="text-xs text-slate-400 mt-0.5">Issued: {cert.date}</p>
                   </div>
                   <button 
                     onClick={() => generateCertificatePDF(cert)}
                     className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-white rounded-lg transition-colors"
                     title="Download PDF"
                   >
                     <Download className="w-5 h-5" />
                   </button>
                </div>
              ))}
           </div>
        </div>
      </div>

    </div>
  );
};