import { doc, runTransaction, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db } from './firebase';
import { UserProfile, Badge } from '../types';

export interface AwardPointsOptions {
  matchCountIncrement?: number;
  sessionCountIncrement?: number;
  reviewCountIncrement?: number;
}

export const getLevel = (points: number) => Math.floor(points / 100) + 1;
export const getPointsForLevel = (level: number) => (level - 1) * 100;

export const awardPoints = async (userId: string, amount: number, options: AwardPointsOptions = {}) => {
  const userRef = doc(db, 'users', userId);
  
  try {
    const result = await runTransaction(db, async (transaction) => {
      const userSnap = await transaction.get(userRef);
      if (!userSnap.exists()) return null;

      const data = userSnap.data() as UserProfile;
      const currentPoints = data.points || 0;
      const newPoints = currentPoints + amount;
      const currentLevel = data.level || 1;
      const newLevel = getLevel(newPoints);
      
      // Handle count increments
      const newMatchCount = (data.matchCount || 0) + (options.matchCountIncrement || 0);
      const newSessionCount = (data.sessionCount || 0) + (options.sessionCountIncrement || 0);
      const newReviewCount = (data.reviewCount || 0) + (options.reviewCountIncrement || 0);

      const updates: any = {
        points: newPoints,
        level: newLevel,
        matchCount: newMatchCount,
        sessionCount: newSessionCount,
        reviewCount: newReviewCount,
        updatedAt: serverTimestamp()
      };
      
      // Check for badges
      const currentBadges = data.badges || [];
      const newBadges = [...currentBadges];
      
      const checkAndAddBadge = (badge: Omit<Badge, 'unlockedAt'>) => {
        if (!newBadges.find(b => b.id === badge.id)) {
          newBadges.push({ ...badge, unlockedAt: Timestamp.now() });
          return true;
        }
        return false;
      };

      // Milestone badges (Level based)
      if (newLevel >= 5) checkAndAddBadge({ id: 'rising_star', name: 'Rising Star', icon: '✨', description: 'Reached Level 5!' });
      if (newLevel >= 10) checkAndAddBadge({ id: 'skill_master', name: 'Skill Master', icon: '🎓', description: 'Reached Level 10!' });

      // Activity badges
      if (newMatchCount >= 1) checkAndAddBadge({ id: 'first_step', name: 'First Step', icon: '👣', description: 'Made your first match!' });
      if (newMatchCount >= 5) checkAndAddBadge({ id: 'match_maker', name: 'Match Maker', icon: '💘', description: 'Made 5+ matches!' });
      if (newMatchCount >= 10) checkAndAddBadge({ id: 'networker', name: 'Networker', icon: '🌐', description: 'Made 10+ matches!' });

      if (newSessionCount >= 5) checkAndAddBadge({ id: 'session_pro', name: 'Session Pro', icon: '⚡', description: 'Completed 5+ sessions!' });

      if (newBadges.length > currentBadges.length) {
        updates.badges = newBadges;
      }
      
      transaction.update(userRef, updates);
      
      return { 
        newPoints, 
        newLevel, 
        levelUp: newLevel > currentLevel,
        newBadges: newBadges.filter(nb => !currentBadges.find(cb => cb.id === nb.id))
      };
    });
    return result;
  } catch (e) {
    console.error("Error awarding points:", e);
    return null;
  }
};

export const POINT_VALUES = {
  COMPLETE_SESSION: 100,
  RECEIVE_REVIEW: 30,
  GIVE_REVIEW: 20,
  MAKE_MATCH: 50,
  DAILY_LOGIN: 10
};
