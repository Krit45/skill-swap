import { useState } from 'react';
import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, addDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { motion } from 'motion/react';
import { X, Calendar as CalendarIcon, Clock, Check } from 'lucide-react';
import { globalSocket } from '../App';

interface BookingProps {
  matchId: string;
  otherUserId: string;
  onClose: () => void;
}

export default function Booking({ matchId, otherUserId, onClose }: BookingProps) {
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [duration, setDuration] = useState('60');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const handleSchedule = async () => {
    setLoading(true);

    const startTime = new Date(`${date}T${time}`);
    const endTime = new Date(startTime.getTime() + parseInt(duration) * 60000);

    try {
      await addDoc(collection(db, `matches/${matchId}/sessions`), {
        matchId,
        title,
        startTime: Timestamp.fromDate(startTime),
        endTime: Timestamp.fromDate(endTime),
        status: 'scheduled',
        createdAt: serverTimestamp(),
      });

      // Notify the other user
      globalSocket.current?.emit('notify-user', {
        receiverId: otherUserId,
        type: 'session',
        title: 'New Session Scheduled',
        message: `${auth.currentUser?.displayName} scheduled a session: ${title}`,
        matchId
      });

      setSuccess(true);
      setTimeout(onClose, 2000);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `matches/${matchId}/sessions`);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setConfirming(true);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden"
      >
        <div className="p-6 border-b border-neutral-100 flex items-center justify-between">
          <h2 className="text-xl font-bold tracking-tight">
            {confirming ? 'Confirm Session' : 'Schedule a Session'}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-neutral-100 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        {success ? (
          <div className="p-12 text-center">
            <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check size={32} />
            </div>
            <h3 className="text-xl font-bold mb-2">Session Scheduled!</h3>
            <p className="text-neutral-500">Your skill swap session has been added to the calendar.</p>
          </div>
        ) : confirming ? (
          <div className="p-8 space-y-6">
            <div className="bg-neutral-50 p-6 rounded-2xl space-y-4">
              <div className="flex items-start space-x-3">
                <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm text-neutral-400">
                  <CalendarIcon size={20} />
                </div>
                <div>
                  <p className="text-xs font-bold text-neutral-400 uppercase tracking-wider">Topic</p>
                  <p className="font-bold text-neutral-900">{title}</p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm text-neutral-400">
                  <Clock size={20} />
                </div>
                <div>
                  <p className="text-xs font-bold text-neutral-400 uppercase tracking-wider">Time & Duration</p>
                  <p className="font-bold text-neutral-900">
                    {new Date(`${date}T${time}`).toLocaleString([], { 
                      month: 'short', 
                      day: 'numeric', 
                      hour: '2-digit', 
                      minute: '2-digit' 
                    })}
                    <span className="text-neutral-400 font-medium ml-2">({duration} mins)</span>
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-col space-y-3">
              <button
                onClick={handleSchedule}
                disabled={loading}
                className="w-full bg-neutral-900 text-white py-4 rounded-2xl font-bold hover:bg-neutral-800 transition-all disabled:opacity-50 flex items-center justify-center space-x-2"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Check size={20} />
                    <span>CONFIRM & SCHEDULE</span>
                  </>
                )}
              </button>
              <button
                onClick={() => setConfirming(false)}
                disabled={loading}
                className="w-full py-4 rounded-2xl font-bold text-neutral-400 hover:text-neutral-900 transition-all"
              >
                Back to Edit
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-bold text-neutral-700 mb-1">Session Title</label>
              <input
                type="text"
                required
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="e.g., Intro to React Hooks"
                className="w-full p-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:border-neutral-900"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-neutral-700 mb-1">Date</label>
                <input
                  type="date"
                  required
                  value={date}
                  onChange={e => setDate(e.target.value)}
                  className="w-full p-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:border-neutral-900"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-neutral-700 mb-1">Time</label>
                <input
                  type="time"
                  required
                  value={time}
                  onChange={e => setTime(e.target.value)}
                  className="w-full p-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:border-neutral-900"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-neutral-700 mb-1">Duration (minutes)</label>
              <select
                value={duration}
                onChange={e => setDuration(e.target.value)}
                className="w-full p-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:border-neutral-900"
              >
                <option value="30">30 minutes</option>
                <option value="60">1 hour</option>
                <option value="90">1.5 hours</option>
                <option value="120">2 hours</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-neutral-900 text-white py-4 rounded-2xl font-bold hover:bg-neutral-800 transition-all disabled:opacity-50 mt-4"
            >
              {loading ? 'Scheduling...' : 'Confirm Session'}
            </button>
          </form>
        )}
      </motion.div>
    </motion.div>
  );
}
