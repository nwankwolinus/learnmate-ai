import React, { useState } from 'react';
import { useStore } from '../store/useStore';
import { Bell, Clock, Target, Check, AlertCircle, Save } from 'lucide-react';

export const SettingsInterface: React.FC = () => {
  const { settings, updateSettings } = useStore();
  const [formData, setFormData] = useState(settings);
  const [isSaved, setIsSaved] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    }));
  };

  const handleNotificationRequest = async () => {
    if (!("Notification" in window)) {
      alert("This browser does not support desktop notifications");
      return;
    }

    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      setFormData(prev => ({ ...prev, notificationsEnabled: true }));
    } else {
      setFormData(prev => ({ ...prev, notificationsEnabled: false }));
      alert("Permission denied. Please enable notifications in your browser settings.");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateSettings({
        ...formData,
        dailyGoalMinutes: Number(formData.dailyGoalMinutes),
        weeklyGoalQuizzes: Number(formData.weeklyGoalQuizzes)
    });
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h2 className="text-2xl font-bold text-slate-800 mb-6 flex items-center gap-2">
        <Target className="w-6 h-6 text-indigo-600" /> Study Settings
      </h2>

      <form onSubmit={handleSubmit} className="space-y-6">
        
        {/* Study Goals Section */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5 text-indigo-500" /> Daily & Weekly Goals
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Daily Study Goal (Minutes)
              </label>
              <input 
                type="number"
                name="dailyGoalMinutes"
                value={formData.dailyGoalMinutes}
                onChange={handleChange}
                min="5"
                max="480"
                className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
              <p className="text-xs text-slate-500 mt-1">Recommended: 30 minutes</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Weekly Quiz Goal
              </label>
              <input 
                type="number"
                name="weeklyGoalQuizzes"
                value={formData.weeklyGoalQuizzes}
                onChange={handleChange}
                min="1"
                max="50"
                className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
              <p className="text-xs text-slate-500 mt-1">Recommended: 5 quizzes</p>
            </div>
          </div>
        </div>

        {/* Notifications Section */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
            <Bell className="w-5 h-5 text-indigo-500" /> Notifications
          </h3>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
              <div>
                <p className="font-medium text-slate-800">Browser Notifications</p>
                <p className="text-sm text-slate-500">Get reminders to study and Pomodoro alerts.</p>
              </div>
              
              {formData.notificationsEnabled ? (
                 <button 
                   type="button"
                   onClick={() => setFormData(p => ({...p, notificationsEnabled: false}))}
                   className="px-4 py-2 bg-green-100 text-green-700 rounded-lg text-sm font-bold flex items-center gap-2"
                 >
                   <Check className="w-4 h-4" /> Enabled
                 </button>
              ) : (
                 <button 
                   type="button"
                   onClick={handleNotificationRequest}
                   className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700"
                 >
                   Enable
                 </button>
              )}
            </div>

            <div>
               <label className="block text-sm font-medium text-slate-700 mb-2">
                 Daily Reminder Time
               </label>
               <input 
                 type="time"
                 name="reminderTime"
                 value={formData.reminderTime}
                 onChange={handleChange}
                 className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
               />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-4">
           {isSaved && (
             <span className="text-green-600 flex items-center gap-1 text-sm font-bold animate-fade-in">
               <Check className="w-4 h-4" /> Settings Saved
             </span>
           )}
           <button 
             type="submit"
             className="px-6 py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-all flex items-center gap-2"
           >
             <Save className="w-4 h-4" /> Save Changes
           </button>
        </div>

      </form>
    </div>
  );
};