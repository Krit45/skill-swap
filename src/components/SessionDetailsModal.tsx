import { Session } from '../types';
import { motion } from 'motion/react';
import { X, Calendar, Clock, CheckCircle2, AlertCircle } from 'lucide-react';

interface SessionDetailsModalProps {
  session: Session;
  onClose: () => void;
  onComplete: (sessionId: string) => void;
}

export default function SessionDetailsModal({ session, onClose, onComplete }: SessionDetailsModalProps) {
  const isCompleted = session.status === 'completed';
  const isCancelled = session.status === 'cancelled';
  
  const startTime = session.startTime.toDate();
  const endTime = session.endTime.toDate();
  const duration = Math.round((endTime.getTime() - startTime.getTime()) / 60000);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        className="bg-white w-full max-w-md rounded-[32px] shadow-2xl overflow-hidden"
      >
        <div className="p-6 border-b border-neutral-100 flex items-center justify-between bg-neutral-50/50">
          <h2 className="text-xl font-black tracking-tight uppercase italic">Session Details</h2>
          <button onClick={onClose} className="p-2 hover:bg-neutral-100 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-8 space-y-8">
          {/* Status Badge */}
          <div className="flex justify-center">
            <div className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center space-x-2 ${
              isCompleted ? 'bg-green-100 text-green-700' : 
              isCancelled ? 'bg-red-100 text-red-700' : 
              'bg-blue-100 text-blue-700'
            }`}>
              {isCompleted ? <CheckCircle2 size={12} /> : isCancelled ? <AlertCircle size={12} /> : <Clock size={12} />}
              <span>{session.status}</span>
            </div>
          </div>

          <div className="space-y-6">
            <div className="flex items-start space-x-4">
              <div className="w-12 h-12 bg-neutral-100 rounded-2xl flex items-center justify-center flex-shrink-0 text-neutral-400">
                <Calendar size={24} />
              </div>
              <div>
                <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-1">Topic</p>
                <h3 className="text-xl font-bold text-neutral-900 leading-tight">{session.title}</h3>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div className="flex items-start space-x-4">
                <div className="w-12 h-12 bg-neutral-100 rounded-2xl flex items-center justify-center flex-shrink-0 text-neutral-400">
                  <Clock size={24} />
                </div>
                <div>
                  <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-1">Start Time</p>
                  <p className="font-bold text-neutral-900">
                    {startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                  <p className="text-xs text-neutral-500 font-medium">
                    {startTime.toLocaleDateString([], { month: 'short', day: 'numeric' })}
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-4">
                <div className="w-12 h-12 bg-neutral-100 rounded-2xl flex items-center justify-center flex-shrink-0 text-neutral-400">
                  <Clock size={24} />
                </div>
                <div>
                  <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-1">End Time</p>
                  <p className="font-bold text-neutral-900">
                    {endTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                  <p className="text-xs text-neutral-500 font-medium">
                    {endTime.toLocaleDateString([], { month: 'short', day: 'numeric' })}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-neutral-50 p-4 rounded-2xl flex items-center justify-between">
              <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider">Duration</span>
              <span className="font-black text-neutral-900">{duration} Minutes</span>
            </div>
          </div>

          {!isCompleted && !isCancelled && (
            <button
              onClick={() => {
                onComplete(session.id);
                onClose();
              }}
              className="w-full bg-neutral-900 text-white py-4 rounded-2xl font-black text-sm hover:bg-neutral-800 transition-all flex items-center justify-center space-x-2 shadow-xl shadow-neutral-900/20"
            >
              <CheckCircle2 size={20} />
              <span>MARK AS COMPLETED</span>
            </button>
          )}

          {isCompleted && (
             <div className="text-center p-4 bg-green-50 rounded-2xl border border-green-100">
                <p className="text-xs font-bold text-green-700">This session has been successfully completed!</p>
             </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
