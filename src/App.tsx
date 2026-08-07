import { useState, useEffect, useRef } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { auth, db, handleFirestoreError, OperationType } from './lib/firebase';
import { doc, getDoc, onSnapshot, updateDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { UserProfile, UserPrivate } from './types';
import Navbar from './components/Navbar';
import BottomNav from './components/BottomNav';
import Auth from './components/Auth';
import Profile from './components/Profile';
import Search from './components/Search';
import Chat from './components/Chat';
import Dashboard from './components/Dashboard';
import Discovery from './components/Discovery';
import AnimatedBackground from './components/AnimatedBackground';
import PremiumEffects from './components/PremiumEffects';
import { motion, AnimatePresence } from 'motion/react';
import { Toaster, toast } from 'sonner';
import { io, Socket } from 'socket.io-client';
import { Bell, Zap, Mail } from 'lucide-react';
import { awardPoints, POINT_VALUES } from './lib/gamification';
import { fireConfetti, fireSuccessConfetti } from './lib/confetti';

export const globalSocket = {
  current: null as Socket | null
};

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<(UserProfile & UserPrivate) | null>(null);
  const [loading, setLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const navigate = useNavigate();
  const location = useLocation();

  // Helper to keep ref in sync with state
  function useStateRef<T>(value: T) {
    const ref = useRef<T>(value);
    useEffect(() => {
      ref.current = value;
    }, [value]);
    return ref;
  }

  const profileRef = useStateRef(profile);
  const prevLevelRef = useRef<number | undefined>(undefined);
  const prevBadgesRef = useRef<string[]>([]);

  useEffect(() => {
    if (!profile) {
      prevLevelRef.current = undefined;
      prevBadgesRef.current = [];
      return;
    }

    // Initialize refs on first profile load
    if (prevLevelRef.current === undefined) {
      prevLevelRef.current = profile.level;
      prevBadgesRef.current = profile.badges?.map(b => b.id) || [];
      return;
    }

    // Level Up Notification
    if (profile.level > prevLevelRef.current) {
      fireConfetti();
      toast.success(`Level Up! You reached Level ${profile.level}! ⚡`, {
        icon: <Zap className="text-amber-400 fill-current" />
      });
    }
    prevLevelRef.current = profile.level;

    // New Badge Notification
    const currentBadgeIds = profile.badges?.map(b => b.id) || [];
    const newBadges = profile.badges?.filter(b => !prevBadgesRef.current.includes(b.id)) || [];
    
    if (newBadges.length > 0) {
      newBadges.forEach(badge => {
        toast.success(`Badge Unlocked: ${badge.name} ${badge.icon}`, {
          description: badge.description
        });
      });
    }
    prevBadgesRef.current = currentBadgeIds;
  }, [profile?.level, JSON.stringify(profile?.badges?.map(b => b.id) || [])]);

  useEffect(() => {
    if (!user) return;

    // Set online status
    const userRef = doc(db, 'users', user.uid);
    setDoc(userRef, { 
      isOnline: true, 
      updatedAt: serverTimestamp(),
      uid: user.uid,
      displayName: user.displayName || 'New User',
      photoURL: user.photoURL || ''
    }, { merge: true }).catch(e => {
      handleFirestoreError(e, OperationType.WRITE, `users/${user.uid}`);
    });

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        updateDoc(userRef, { isOnline: false, updatedAt: serverTimestamp() }).catch(() => {});
      } else {
        updateDoc(userRef, { isOnline: true, updatedAt: serverTimestamp() }).catch(() => {});
      }
    };

    const handleUnload = () => {
      // Use navigator.sendBeacon or a synchronous update if possible, 
      // but for Firestore, we'll just try to fire it off.
      updateDoc(userRef, { isOnline: false, updatedAt: serverTimestamp() }).catch(() => {});
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleUnload);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleUnload);
      updateDoc(userRef, { isOnline: false, updatedAt: serverTimestamp() }).catch(() => {});
    };
  }, [user?.uid]);

  useEffect(() => {
    if (!user) {
      if (globalSocket.current) {
        globalSocket.current.disconnect();
        globalSocket.current = null;
      }
      return;
    }

    if (!globalSocket.current) {
      globalSocket.current = io();
      
      globalSocket.current.on('connect', () => {
        console.log('Socket connected, registering user:', user.uid);
        globalSocket.current?.emit('register-user', user.uid);
      });

      // Register immediately if already connected
      if (globalSocket.current.connected) {
        globalSocket.current.emit('register-user', user.uid);
      }
    }

    // Always re-attach or update the notification listener to use latest profile
    globalSocket.current.off('notification');
    globalSocket.current.on('notification', (data: any) => {
      // Check user preferences from ref to avoid stale closure
      const currentProfile = profileRef.current;
      if (currentProfile?.notificationPreferences) {
        const prefs = currentProfile.notificationPreferences;
        if (data.type === 'message' && !prefs.messageNotifications) return;
        if (data.type === 'match' && !prefs.matchAlerts) return;
        if (data.type === 'session' && !prefs.sessionReminders) return;
      }

      toast(data.title, {
        description: data.message,
        icon: <Bell className="text-neutral-900" size={16} />,
        action: data.matchId ? {
          label: 'View',
          onClick: () => navigate(`/chat/${data.matchId}`)
        } : undefined
      });
    });

    return () => {
      // Don't disconnect on every re-render, only on logout
    };
  }, [user?.uid, profile]);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      if (!firebaseUser) {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    if (!user) return;

    // Fetch or listen to public profile
    const profileRef = doc(db, 'users', user.uid);
    const privateRef = doc(db, 'users_private', user.uid);
    
    const unsubscribeProfile = onSnapshot(profileRef, (docSnap) => {
      if (docSnap.exists()) {
        const publicData = docSnap.data() as UserProfile;
        setProfile(prev => ({ ...prev, ...publicData } as any));
      } else {
        setProfile(null);
      }
      setLoading(false);
    }, (error) => {
      if (auth.currentUser) {
        handleFirestoreError(error, OperationType.GET, `users/${user.uid}`);
      }
      setLoading(false);
    });

    const unsubscribePrivate = onSnapshot(privateRef, (docSnap) => {
      if (docSnap.exists()) {
        const privateData = docSnap.data() as UserPrivate;
        setProfile(prev => ({ ...prev, ...privateData } as any));
      }
    }, (error) => {
      if (auth.currentUser) {
        handleFirestoreError(error, OperationType.GET, `users_private/${user.uid}`);
      }
    });

    return () => {
      unsubscribeProfile();
      unsubscribePrivate();
    };
  }, [user?.uid]);

  useEffect(() => {
    if (!user || !profile) return;

    const checkDailyLogin = async () => {
      const today = new Date().toDateString();
      const lastLogin = profile.lastLoginAt?.toDate ? profile.lastLoginAt.toDate().toDateString() : null;

      if (today !== lastLogin) {
        // It's a new day! Award points
        await awardPoints(user.uid, POINT_VALUES.DAILY_LOGIN);
        
        // Update lastLoginAt
        await setDoc(doc(db, 'users', user.uid), {
          lastLoginAt: serverTimestamp()
        }, { merge: true });

        fireSuccessConfetti();
        toast.success("Daily Login Reward! +10 XP earned.");
      }
    };

    checkDailyLogin();
  }, [user?.uid, profile?.lastLoginAt]);

  useEffect(() => {
    if (!user || !profile) return;
    // Update last active every 5 minutes
    const updateLastActive = async () => {
      try {
        const userRef = doc(db, 'users', user.uid);
        await setDoc(userRef, {
          updatedAt: serverTimestamp()
        }, { merge: true });
      } catch (e) {
        handleFirestoreError(e, OperationType.WRITE, `users/${user.uid}`);
      }
    };
    updateLastActive();
    const interval = setInterval(updateLastActive, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [user?.uid, !!profile]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-neutral-50">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full"
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen text-neutral-900 font-sans relative overflow-x-hidden">
      <AnimatedBackground />
      <PremiumEffects />
      <Toaster position="top-right" expand={true} richColors />
      <AnimatePresence>
        {isOffline && (
          <motion.div
            key="offline-banner"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-amber-500 text-white text-center py-2 text-xs font-black uppercase tracking-widest sticky top-0 z-[100]"
          >
            You are offline. Viewing cached data.
          </motion.div>
        )}
      </AnimatePresence>
      {user && <Navbar profile={profile} />}
      <main className={`container mx-auto max-w-7xl px-4 py-6 sm:py-8 ${user ? 'pb-24 md:pb-8' : 'py-8'}`}>
        <AnimatePresence mode="wait">
          <Routes location={location} key={location.pathname}>
            <Route
              path="/"
              element={user ? <Dashboard profile={profile} /> : <Navigate to="/auth" />}
            />
            <Route
              path="/discovery"
              element={user ? <Discovery profile={profile} /> : <Navigate to="/auth" />}
            />
            <Route
              path="/auth"
              element={!user ? <Auth /> : <Navigate to="/" />}
            />
            <Route
              path="/profile"
              element={user ? <Profile profile={profile} /> : <Navigate to="/auth" />}
            />
            <Route
              path="/search"
              element={user ? <Search profile={profile} /> : <Navigate to="/auth" />}
            />
            <Route
              path="/chat/:matchId"
              element={user ? <Chat profile={profile} /> : <Navigate to="/auth" />}
            />
            <Route
              path="/chat"
              element={user ? <Chat profile={profile} /> : <Navigate to="/auth" />}
            />
          </Routes>
        </AnimatePresence>
      </main>
      {user && <BottomNav />}
    </div>
  );
}
