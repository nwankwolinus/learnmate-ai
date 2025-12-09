import jsPDF from 'jspdf';
import { ChatSession, Certificate, UserProfile, StreakData, AIProgressInsights } from '../types';

// --- Chat Exports ---

export const exportChatToMarkdown = (session: ChatSession): string => {
  let md = `# ${session.title || 'Chat Session'}\n\n`;
  md += `Date: ${new Date(session.createdAt).toLocaleDateString()}\n\n`;
  
  session.messages.forEach(msg => {
    const role = msg.role === 'user' ? 'User' : 'LearnMate';
    md += `### ${role}\n${msg.content}\n\n`;
  });
  
  return md;
};

export const exportChatToPDF = (session: ChatSession) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;
  const margin = 20;
  const maxLineWidth = pageWidth - margin * 2;
  
  doc.setFontSize(20);
  doc.text(session.title || 'Chat Session', margin, 20);
  
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`Date: ${new Date(session.createdAt).toLocaleDateString()}`, margin, 30);
  
  let y = 40;
  
  session.messages.forEach(msg => {
    if (y > 270) {
      doc.addPage();
      y = 20;
    }
    
    const role = msg.role === 'user' ? 'You' : 'LearnMate';
    doc.setFontSize(12);
    doc.setTextColor(msg.role === 'user' ? '#4f46e5' : '#000000'); // Indigo for user
    doc.setFont('helvetica', 'bold');
    doc.text(role, margin, y);
    y += 7;
    
    doc.setFontSize(11);
    doc.setTextColor(50);
    doc.setFont('helvetica', 'normal');
    
    // Clean text to avoid PDF errors with special chars if font doesn't support
    const cleanContent = msg.content.replace(/[^\x00-\x7F]/g, ""); 
    
    const lines = doc.splitTextToSize(cleanContent, maxLineWidth);
    doc.text(lines, margin, y);
    
    y += lines.length * 7 + 10;
  });
  
  doc.save(`${session.title || 'chat-export'}.pdf`);
};

// --- Data Exports ---

export const downloadJSON = (data: any, filename: string) => {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

export const downloadCSV = (data: any[], filename: string) => {
  if (!data || data.length === 0) {
    alert("No data to export");
    return;
  }
  
  // Get headers from first object
  const headers = Object.keys(data[0]);
  
  // Create CSV content
  const csvContent = [
    headers.join(','), // Header row
    ...data.map(row => 
      headers.map(fieldName => {
        let val = row[fieldName];
        // Handle strings with commas or quotes
        if (typeof val === 'string') {
          val = `"${val.replace(/"/g, '""')}"`;
        }
        // Handle objects/arrays roughly
        if (typeof val === 'object' && val !== null) {
          val = `"${JSON.stringify(val).replace(/"/g, '""')}"`;
        }
        return val;
      }).join(',')
    )
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

export const convertSessionsToCSV = (sessions: ChatSession[]): any[] => {
  const rows: any[] = [];
  sessions.forEach(session => {
    session.messages.forEach(msg => {
      rows.push({
        SessionDate: new Date(session.createdAt).toLocaleDateString(),
        SessionTitle: session.title,
        MessageTime: new Date(msg.timestamp).toLocaleTimeString(),
        Role: msg.role,
        Content: msg.content.replace(/\n/g, ' ').replace(/"/g, '""') // Clean for CSV
      });
    });
  });
  return rows;
};

// --- Certificate Generation ---

export const generateCertificatePDF = (cert: Certificate) => {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4'
  });
  
  // Background
  doc.setFillColor(248, 250, 252); // Slate-50
  doc.rect(0, 0, 297, 210, 'F');
  
  // Border
  doc.setDrawColor(99, 102, 241); // Indigo-500
  doc.setLineWidth(2);
  doc.rect(10, 10, 277, 190);
  
  doc.setDrawColor(79, 70, 229); // Indigo-600
  doc.setLineWidth(1);
  doc.rect(15, 15, 267, 180);

  // Header
  doc.setFont('times', 'bold');
  doc.setFontSize(40);
  doc.setTextColor(30, 41, 59);
  doc.text('Certificate of Achievement', 148.5, 50, { align: 'center' });
  
  // Subheader
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(16);
  doc.setTextColor(100);
  doc.text('This certifies that', 148.5, 75, { align: 'center' });
  
  // Name
  doc.setFont('times', 'bolditalic');
  doc.setFontSize(36);
  doc.setTextColor(79, 70, 229);
  doc.text(cert.userName, 148.5, 95, { align: 'center' });
  
  doc.setDrawColor(203, 213, 225);
  doc.line(70, 100, 227, 100); // Underline name

  // Text
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(16);
  doc.setTextColor(100);
  doc.text('has successfully demonstrated mastery in', 148.5, 120, { align: 'center' });
  
  // Topic
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(24);
  doc.setTextColor(30, 41, 59);
  doc.text(cert.topic, 148.5, 135, { align: 'center' });
  
  // Footer
  doc.setFontSize(12);
  doc.setTextColor(150);
  doc.text(`Issued by LearnMate AI on ${cert.date}`, 148.5, 170, { align: 'center' });
  doc.text(`Certificate ID: ${cert.id}`, 148.5, 178, { align: 'center' });

  // Badge
  doc.setFillColor(255, 215, 0);
  doc.circle(250, 160, 15, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  doc.text('VERIFIED', 250, 160, { align: 'center' });

  doc.save(`Certificate_${cert.id}.pdf`);
};

// --- Progress Report ---

export const generateProgressReportPDF = (
    user: UserProfile | null,
    streak: StreakData, 
    insights: AIProgressInsights
) => {
    const doc = new jsPDF();
    const margin = 20;
    
    // Header
    doc.setFontSize(24);
    doc.setTextColor(79, 70, 229); // Indigo
    doc.text('LearnMate Progress Report', margin, 25);
    
    doc.setFontSize(12);
    doc.setTextColor(100);
    doc.text(`Student: ${user?.displayName || 'Student'}`, margin, 35);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, margin, 42);

    // Summary Section
    doc.setDrawColor(200);
    doc.line(margin, 50, 190, 50);

    doc.setFontSize(16);
    doc.setTextColor(0);
    doc.text('Executive Summary', margin, 65);
    
    doc.setFontSize(11);
    doc.setTextColor(60);
    // Sanitize text
    const cleanSummary = insights.summary.replace(/[^\x00-\x7F]/g, "");
    const summaryLines = doc.splitTextToSize(cleanSummary, 170);
    doc.text(summaryLines, margin, 75);

    let y = 75 + (summaryLines.length * 7) + 10;

    // Key Metrics Box
    doc.setFillColor(240, 249, 255); // AliceBlue
    doc.rect(margin, y, 170, 30, 'F');
    
    doc.setTextColor(70);
    doc.setFontSize(10);
    doc.text('Current Streak', margin + 10, y + 10);
    doc.setTextColor(0);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(`${streak.currentStreak} Days`, margin + 10, y + 20);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(70);
    doc.text('Total Study Time', margin + 70, y + 10);
    doc.setFontSize(14);
    doc.setTextColor(0);
    doc.setFont('helvetica', 'bold');
    
    const totalMins = Object.values(streak.activityHistory).reduce((a: number, b: number) => a + b, 0);
    doc.text(`${totalMins} Mins`, margin + 70, y + 20);

    y += 45;

    // Recommendations
    doc.setFontSize(16);
    doc.setTextColor(0);
    doc.setFont('helvetica', 'bold');
    doc.text('Recommendations & Tips', margin, y);
    y += 10;
    
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(60);
    insights.tips.forEach((tip: string) => {
        const cleanTip = tip.replace(/[^\x00-\x7F]/g, "");
        doc.text(`• ${cleanTip}`, margin + 5, y);
        y += 8;
    });

    y += 10;

    // Weak Areas
    if (insights.weakAreas.length > 0) {
        doc.setFontSize(16);
        doc.setTextColor(0);
        doc.setFont('helvetica', 'bold');
        doc.text('Focus Areas', margin, y);
        y += 10;

        doc.setFontSize(11);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(180, 50, 50); // Red-ish
        insights.weakAreas.forEach((area: string) => {
            const cleanArea = area.replace(/[^\x00-\x7F]/g, "");
            doc.text(`• ${cleanArea}`, margin + 5, y);
            y += 8;
        });
    }

    doc.save('Progress_Report.pdf');
};