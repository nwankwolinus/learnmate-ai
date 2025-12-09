import { QuizResult, StreakData } from '../types';

// Process Daily Activity for Area Chart
export const processActivityTrends = (activityHistory: { [date: string]: number }, days: number) => {
  const data = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    const displayDate = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    
    data.push({
      date: displayDate,
      fullDate: dateStr,
      minutes: activityHistory[dateStr] || 0
    });
  }
  return data;
};

// Process Quiz Results for Topic Mastery (Radar Chart)
export const processTopicMastery = (results: QuizResult[]) => {
  const topicStats: { [topic: string]: { totalScore: number; count: number } } = {};

  results.forEach(r => {
    // Normalize topic name slightly
    const topic = r.topic.length > 15 ? r.topic.substring(0, 15) + '...' : r.topic;
    if (!topicStats[topic]) {
      topicStats[topic] = { totalScore: 0, count: 0 };
    }
    const percentage = (r.score / r.total) * 100;
    topicStats[topic].totalScore += percentage;
    topicStats[topic].count += 1;
  });

  // Convert to array and take top 6 most practiced topics for cleaner radar chart
  return Object.entries(topicStats)
    .map(([subject, stats]) => ({
      subject,
      score: Math.round(stats.totalScore / stats.count),
      fullMark: 100
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);
};

// Process Hourly Performance (Bar Chart)
export const processHourlyPerformance = (results: QuizResult[]) => {
  const hours = Array(24).fill(0).map((_, i) => ({ hour: i, totalScore: 0, count: 0 }));

  results.forEach(r => {
    const date = new Date(r.date);
    const hour = date.getHours();
    const percentage = (r.score / r.total) * 100;
    
    hours[hour].totalScore += percentage;
    hours[hour].count += 1;
  });

  // Filter out hours with no data or format for display
  return hours.map(h => ({
    time: `${h.hour}:00`,
    score: h.count > 0 ? Math.round(h.totalScore / h.count) : 0,
    quizzes: h.count
  }));
};

// Process Learning Velocity (Composed Chart - Topics vs Accuracy over time)
// Group by Week or Day depending on range
export const processLearningVelocity = (results: QuizResult[]) => {
  const grouped: { [key: string]: { topics: Set<string>, totalScore: number, count: number, date: Date } } = {};

  // Sort results by date asc
  const sorted = [...results].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  sorted.forEach(r => {
    const d = new Date(r.date);
    // Group by Week (Simple approx: start of week)
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
    const monday = new Date(d);
    monday.setDate(diff);
    monday.setHours(0, 0, 0, 0);
    const key = monday.toISOString().split('T')[0];

    if (!grouped[key]) {
      grouped[key] = { topics: new Set(), totalScore: 0, count: 0, date: monday };
    }
    grouped[key].topics.add(r.topic);
    grouped[key].totalScore += (r.score / r.total) * 100;
    grouped[key].count += 1;
  });

  return Object.entries(grouped)
    .map(([key, data]) => ({
      date: data.date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      topicsCovered: data.topics.size,
      avgAccuracy: Math.round(data.totalScore / data.count)
    }))
    .slice(-8); // Last 8 weeks
};

// Process Weekly Comparison (This Week vs Last Week)
export const processWeeklyComparison = (activityHistory: { [date: string]: number }) => {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const data = days.map(day => ({ day, thisWeek: 0, lastWeek: 0 }));
  
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0 (Sun) - 6 (Sat)
  const diffToMon = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  
  const thisMonday = new Date(today);
  thisMonday.setDate(today.getDate() + diffToMon);
  thisMonday.setHours(0,0,0,0);
  
  const lastMonday = new Date(thisMonday);
  lastMonday.setDate(thisMonday.getDate() - 7);

  // Helper to format date key
  const fmt = (d: Date) => d.toISOString().split('T')[0];

  data.forEach((item, index) => {
    // This Week Date
    const d1 = new Date(thisMonday);
    d1.setDate(thisMonday.getDate() + index);
    const k1 = fmt(d1);
    
    // Last Week Date
    const d2 = new Date(lastMonday);
    d2.setDate(lastMonday.getDate() + index);
    const k2 = fmt(d2);

    item.thisWeek = activityHistory[k1] || 0;
    item.lastWeek = activityHistory[k2] || 0;
  });

  return data;
};