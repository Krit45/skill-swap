import { useState } from 'react';
import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, addDoc, serverTimestamp, doc, updateDoc, getDoc, runTransaction } from 'firebase/firestore';
import { Session, UserProfile } from '../types';
import { motion } from 'motion/react';
import { Star, X, Loader2, MessageSquare, Zap } from 'lucide-react';
import { awardPoints, POINT_VALUES } from '../lib/gamification';
import { toast } from 'sonner';

interface ReviewModalProps {
  session: Session;
  otherUser: UserProfile;
  onClose: () => void;
}

export default function ReviewModal({ session, otherUser, onClose }: ReviewModalProps) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [hoveredRating, setHoveredRating] = useState(0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser || rating === 0) return;

    setSubmitting(true);
    try {
      await runTransaction(db, async (transaction) => {
        // 1. Perform all READS first
        const sessionRef = doc(db, `matches/${session.matchId}/sessions`, session.id);
        const sessionSnap = await transaction.get(sessionRef);
        
        const userRef = doc(db, 'users', otherUser.uid);
        const userSnap = await transaction.get(userRef);

        // 2. Perform all WRITES second
        const reviewRef = doc(collection(db, 'reviews'));
        transaction.set(reviewRef, {
          matchId: session.matchId,
          sessionId: session.id,
          reviewerId: auth.currentUser?.uid,
          revieweeId: otherUser.uid,
          rating,
          comment: comment.trim(),
          createdAt: serverTimestamp(),
        });

        if (sessionSnap.exists()) {
          const currentRatedBy = sessionSnap.data().ratedBy || [];
          transaction.update(sessionRef, {
            ratedBy: [...currentRatedBy, auth.currentUser?.uid]
          });
        }

        if (userSnap.exists()) {
          const userData = userSnap.data() as UserProfile;
          const oldCount = userData.reviewCount || 0;
          const oldRating = userData.rating || 0;
          const newCount = oldCount + 1;
          const newRating = (oldRating * oldCount + rating) / newCount;
          
          transaction.update(userRef, {
            rating: newRating,
            reviewCount: newCount,
            updatedAt: serverTimestamp(),
          });
        }
      });

      // Award points after successful transaction
      await awardPoints(auth.currentUser.uid, POINT_VALUES.GIVE_REVIEW);
      await awardPoints(otherUser.uid, POINT_VALUES.RECEIVE_REVIEW);

      toast.success("Review submitted successfully! +20 XP earned.");
      onClose();
    } catch (error) {
      console.error("Review submission error:", error);
      handleFirestoreError(error, OperationType.WRITE, 'reviews');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-neutral-900/40 backdrop-blur-sm">
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        className="bg-white w-full max-w-md rounded-[40px] shadow-2xl overflow-hidden"
      >
        <div className="p-8">
          <div className="flex justify-between items-center mb-8">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-neutral-900 rounded-2xl flex items-center justify-center">
                <Star className="text-white" size={24} />
              </div>
              <div>
                <h2 className="text-2xl font-black italic uppercase tracking-tighter">Rate Session</h2>
                <p className="text-xs text-neutral-400 font-bold uppercase tracking-widest">{session.title}</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-neutral-50 rounded-xl transition-all">
              <X size={24} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-8">
            <div className="text-center space-y-4">
              <p className="text-sm font-bold text-neutral-500">How was your session with {otherUser.displayName}?</p>
              <div className="flex justify-center space-x-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onMouseEnter={() => setHoveredRating(star)}
                    onMouseLeave={() => setHoveredRating(0)}
                    onClick={() => setRating(star)}
                    className="p-1 transition-transform hover:scale-110 active:scale-95"
                  >
                    <Star
                      size={40}
                      className={`${
                        star <= (hoveredRating || rating)
                          ? 'fill-neutral-900 text-neutral-900'
                          : 'text-neutral-200'
                      } transition-colors`}
                    />
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest ml-4">
                Your Review
              </label>
              <div className="relative">
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Share a short note about what you learned..."
                  className="w-full bg-neutral-50 border-2 border-neutral-100 rounded-3xl p-6 text-sm font-medium focus:outline-none focus:border-neutral-900 transition-all min-h-[120px] resize-none"
                />
                <MessageSquare className="absolute bottom-6 right-6 text-neutral-200" size={20} />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting || rating === 0}
              className="w-full bg-neutral-900 text-white py-5 rounded-3xl font-black text-sm tracking-widest uppercase hover:bg-neutral-800 transition-all disabled:opacity-20 flex items-center justify-center space-x-3 shadow-xl shadow-neutral-900/20"
            >
              {submitting ? (
                <>
                  <Loader2 className="animate-spin" size={20} />
                  <span>Submitting...</span>
                </>
              ) : (
                <span>Submit Review</span>
              )}
            </button>
          </form>
        </div>
      </motion.div>
    </div>
  );
}
