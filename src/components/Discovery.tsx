import { useState, useEffect } from 'react';
import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, query, where, getDocs, limit, addDoc, serverTimestamp, updateDoc, doc, onSnapshot, setDoc } from 'firebase/firestore';
import { UserProfile, UserPrivate, Match } from '../types';
import { motion, AnimatePresence, useMotionValue, useTransform, PanInfo } from 'motion/react';
import { X, Heart, Star, MapPin, Info, Zap, Compass, RefreshCw, Trophy, Sparkles } from 'lucide-react';
import { getMatchRecommendations } from '../lib/ai';
import { Link } from 'react-router-dom';
import { globalSocket } from '../App';
import { awardPoints, POINT_VALUES } from '../lib/gamification';
import { toast } from 'sonner';
import { fireSuccessConfetti } from '../lib/confetti';

interface DiscoveryProps {
  profile: (UserProfile & UserPrivate) | null;
}

export default function Discovery({ profile }: DiscoveryProps) {
  const [cards, setCards] = useState<{ user: UserProfile, reason: string }[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [direction, setDirection] = useState<null | 'left' | 'right'>(null);
  const [showMatchModal, setShowMatchModal] = useState<UserProfile | null>(null);
  const [currentUserData, setCurrentUserData] = useState<UserProfile | null>(null);
  const [isSeeding, setIsSeeding] = useState(false);
  const [isFallback, setIsFallback] = useState(false);

  const seedMockUsers = async () => {
    if (!profile) return;
    setIsSeeding(true);
    try {
      const mockUsers = [
        {
          uid: '',
          displayName: "Sarah Chen",
          skillsOffered: ["UI/UX Design", "Figma", "React"],
          skillsWanted: ["Python", "Backend Development"],
          bio: "Product designer with 5 years of experience. Looking to transition into full-stack development.",
          location: "San Francisco, CA",
          communicationStyle: "Remote",
          rating: 4.9,
          reviewCount: 12,
          isOnline: true,
          level: 5,
          points: 4500,
          matchCount: 8,
          sessionCount: 15,
          isMock: true,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        },
        {
          uid: '',
          displayName: "Marcus Miller",
          skillsOffered: ["Python", "Data Science", "SQL"],
          skillsWanted: ["UI/UX Design", "Public Speaking"],
          bio: "Data scientist at a fintech startup. I love teaching complex concepts in simple ways.",
          location: "New York, NY",
          communicationStyle: "Hybrid",
          rating: 4.7,
          reviewCount: 24,
          isOnline: false,
          level: 8,
          points: 7200,
          matchCount: 15,
          sessionCount: 30,
          isMock: true,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        },
        {
          uid: '',
          displayName: "Elena Rodriguez",
          skillsOffered: ["Public Speaking", "Leadership", "Marketing"],
          skillsWanted: ["React", "TypeScript"],
          bio: "Marketing director by day, aspiring coder by night. Let's swap some knowledge!",
          location: "Austin, TX",
          communicationStyle: "In-person",
          rating: 5.0,
          reviewCount: 5,
          isOnline: true,
          level: 3,
          points: 2100,
          matchCount: 4,
          sessionCount: 6,
          isMock: true,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        }
      ];

      for (const mock of mockUsers) {
        const userRef = await addDoc(collection(db, 'users'), mock);
        await setDoc(doc(db, 'users', userRef.id), {
          uid: userRef.id
        }, { merge: true });
      }
      toast.success("Mock users added! Refreshing...");
      setTimeout(() => window.location.reload(), 1500);
    } catch (error) {
      console.error("Seeding error:", error);
      toast.error("Failed to seed mock users.");
    } finally {
      setIsSeeding(false);
    }
  };

  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-25, 25]);
  const opacity = useTransform(x, [-200, -150, 0, 150, 200], [0, 1, 1, 1, 0]);
  
  const likeOpacity = useTransform(x, [50, 150], [0, 1]);
  const nopeOpacity = useTransform(x, [-150, -50], [1, 0]);

  useEffect(() => {
    if (!profile) return;

    let unsubscribe: (() => void) | undefined;
    let timeoutId: NodeJS.Timeout;

    const setupDiscovery = async () => {
      setLoading(true);
      console.log("[Discovery] Setting up discovery...");
      try {
        const snapshot = await getDocs(query(collection(db, 'users'), limit(50)));
        const allUsers = snapshot.docs
          .map(doc => doc.data() as UserProfile)
          .filter(u => u.uid !== profile.uid);
        
        const matchResult = await getMatchRecommendations(profile, allUsers);
        setIsFallback(matchResult.isFallback);
        
        if (matchResult.isFallback) {
          console.warn(`[Discovery] AI matching fell back: ${matchResult.error}`);
          toast.info("Using keyword matching. AI is offline.", {
            description: matchResult.error === "AI Quota Exceeded" ? "Daily AI quota reached." : "Falling back to basic matching."
          });
        }
        
        const recs = matchResult.recommendations.map((rec: any) => ({
          user: allUsers.find(u => u.uid === rec.uid)!,
          reason: rec.reason
        })).filter((r: any) => r.user);

        setCards(recs);
      } catch (error) {
        console.error("[Discovery] Error during setup:", error);
        toast.error("Failed to load discovery matches.");
      } finally {
        setLoading(false);
      }
    };

    setupDiscovery();

    return () => {
      if (unsubscribe) unsubscribe();
      clearTimeout(timeoutId);
    };
  }, [profile?.uid, JSON.stringify(profile?.skillsOffered || []), JSON.stringify(profile?.skillsWanted || [])]);

  // Listen to the current card's user for real-time status
  useEffect(() => {
    if (currentIndex >= cards.length) {
      setCurrentUserData(null);
      return;
    }

    const targetUser = cards[currentIndex].user;
    const unsubscribe = onSnapshot(doc(db, 'users', targetUser.uid), (docSnap) => {
      if (docSnap.exists()) {
        setCurrentUserData(docSnap.data() as UserProfile);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `users/${targetUser.uid}`);
    });

    return () => unsubscribe();
  }, [currentIndex, cards]);

  const handleSwipe = async (dir: 'left' | 'right') => {
    if (currentIndex >= cards.length) return;
    
    setDirection(dir);
    const targetUser = cards[currentIndex].user;

    if (dir === 'right') {
      try {
        const q = query(
          collection(db, 'matches'),
          where('users', '==', [profile!.uid, targetUser.uid].sort())
        );
        
        const existingMatchSnap = await getDocs(q);
        const matchDoc = existingMatchSnap.docs.find(d => {
          const data = d.data() as Match;
          return data.status === 'pending' && data.requesterId === targetUser.uid;
        });
        
        if (matchDoc) {
          await updateDoc(doc(db, 'matches', matchDoc.id), {
            status: 'accepted',
            updatedAt: serverTimestamp()
          });
          
          globalSocket.current?.emit('notify-user', {
            receiverId: targetUser.uid,
            type: 'match',
            title: "It's a Match!",
            message: `${profile?.displayName} accepted your skill swap request!`,
            matchId: matchDoc.id
          });

          await addDoc(collection(db, 'notifications'), {
            userId: targetUser.uid,
            type: 'match',
            title: "It's a Match!",
            message: `${profile?.displayName} accepted your skill swap request!`,
            matchId: matchDoc.id,
            read: false,
            createdAt: serverTimestamp()
          });

          await awardPoints(profile!.uid, POINT_VALUES.MAKE_MATCH, { matchCountIncrement: 1 });
          await awardPoints(targetUser.uid, POINT_VALUES.MAKE_MATCH, { matchCountIncrement: 1 });

          fireSuccessConfetti();
          setShowMatchModal(targetUser);
        } else {
          const matchRef = await addDoc(collection(db, 'matches'), {
            users: [profile!.uid, targetUser.uid].sort(),
            status: 'pending',
            requesterId: profile!.uid,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });

          globalSocket.current?.emit('notify-user', {
            receiverId: targetUser.uid,
            type: 'match',
            title: 'New Match Request',
            message: `${profile?.displayName} wants to swap skills with you!`,
            matchId: matchRef.id
          });

          await addDoc(collection(db, 'notifications'), {
            userId: targetUser.uid,
            type: 'match',
            title: 'New Match Request',
            message: `${profile?.displayName} wants to swap skills with you!`,
            matchId: matchRef.id,
            read: false,
            createdAt: serverTimestamp()
          });
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, 'matches');
      }
    }

    setTimeout(() => {
      setCurrentIndex(prev => prev + 1);
      setDirection(null);
      x.set(0);
    }, 200);
  };

  const handleDragEnd = (_: any, info: PanInfo) => {
    if (info.offset.x > 100) {
      handleSwipe('right');
    } else if (info.offset.x < -100) {
      handleSwipe('left');
    } else {
      x.set(0);
    }
  };

  if (!profile) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8">
        <div className="max-w-md bg-white p-8 rounded-[32px] border border-neutral-200/60 shadow-lg space-y-6">
          <div className="w-16 h-16 bg-neutral-100 rounded-2xl flex items-center justify-center mx-auto text-neutral-400">
            <Compass size={28} />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-serif font-bold text-neutral-900">Setup Discovery Profile</h2>
            <p className="text-sm text-neutral-500 leading-relaxed">
              You must add skills to your profile to find other community members offering and requesting knowledge swaps.
            </p>
          </div>
          <Link 
            to="/profile" 
            className="block w-full text-center bg-neutral-900 text-white py-3 rounded-xl font-semibold hover:bg-neutral-800 transition-all text-sm cursor-pointer"
          >
            Edit Skills Profile
          </Link>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[65vh]">
        <motion.div
          animate={{ scale: [1, 1.1, 1], rotate: [0, 180, 360] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          className="w-16 h-16 bg-neutral-950 rounded-2xl flex items-center justify-center mb-6 shadow-md"
        >
          <Compass className="text-white animate-pulse" size={24} />
        </motion.div>
        <p className="text-neutral-500 font-bold text-xs uppercase tracking-widest">Compiling Recommendations...</p>
      </div>
    );
  }

  if (currentIndex >= cards.length) {
    return (
      <div className="flex flex-col items-center justify-center h-[65vh] text-center px-4">
        <div className="w-16 h-16 bg-white border border-neutral-200/60 rounded-3xl flex items-center justify-center mb-6 shadow-sm">
          <RefreshCw className="text-neutral-400" size={24} />
        </div>
        <h2 className="text-2xl font-serif font-bold text-neutral-950 mb-2">Discovery Completed</h2>
        <p className="text-neutral-500 max-w-sm text-sm leading-relaxed">
          You've explored all recommended matching members in this cohort. Come back soon for updated selections!
        </p>
        <div className="flex flex-wrap gap-4 mt-8 justify-center">
          <button 
            onClick={() => window.location.reload()}
            className="bg-neutral-900 text-white px-8 py-3.5 rounded-full text-xs font-bold hover:bg-neutral-800 transition-all shadow-sm cursor-pointer"
          >
            Refresh Deck
          </button>
          <button 
            onClick={seedMockUsers}
            disabled={isSeeding}
            className="bg-white text-neutral-800 border border-neutral-200 px-8 py-3.5 rounded-full text-xs font-bold hover:bg-neutral-50 transition-all disabled:opacity-50 shadow-sm cursor-pointer"
          >
            {isSeeding ? "Seeding..." : "Seed Mock Users"}
          </button>
        </div>
      </div>
    );
  }

  const currentCard = cards[currentIndex];
  const displayUser = currentUserData || currentCard.user;

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -30 }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      className="max-w-7xl mx-auto relative h-[calc(100vh-140px)] sm:h-[calc(100vh-180px)] flex flex-col lg:flex-row lg:items-stretch lg:gap-16 pb-4 px-4"
    >
      {/* Decorative bespoke grid & radial orb behind matching desk */}
      <div className="absolute inset-0 opacity-[0.02] bg-[radial-gradient(#000_1px,transparent_1px)] bg-[size:16px_16px] pointer-events-none" />
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-neutral-900/[0.02] rounded-full blur-3xl pointer-events-none" />

      {isFallback && (
        <div className="absolute top-[-20px] left-0 right-0 flex justify-center z-20 pointer-events-none">
          <span className="text-[8px] font-black text-amber-700 uppercase tracking-[0.25em] flex items-center bg-amber-500/10 px-4 py-1.5 rounded-full border border-amber-500/20 shadow-xs backdrop-blur-md">
            <Zap size={9} className="mr-1.5 fill-current text-amber-500" /> Basic peer search activated
          </span>
        </div>
      )}

      {/* Bespoke Card Swipe Stage with stacked card preview behind it */}
      <div className="flex-1 relative min-h-[420px] sm:min-h-[500px] mb-6 sm:mb-8 lg:mb-0 lg:w-[480px] lg:flex-shrink-0 flex items-center justify-center">
        {/* Visual stack effect simulating cards underneath */}
        <div className="absolute inset-0 bg-neutral-900/5 rounded-[40px] transform rotate-[-2deg] scale-[0.97] pointer-events-none" />
        <div className="absolute inset-0 bg-neutral-900/[0.02] rounded-[40px] transform rotate-[1.5deg] scale-[0.985] pointer-events-none" />

        <AnimatePresence mode="popLayout">
          <motion.div
            key={displayUser.uid}
            style={{ x, rotate, opacity }}
            drag="x"
            onDragEnd={handleDragEnd}
            initial={{ scale: 0.94, opacity: 0, rotate: -4 }}
            animate={{ scale: 1, opacity: 1, rotate: 0 }}
            exit={{ 
              x: direction === 'left' ? -520 : direction === 'right' ? 520 : x.get(),
              opacity: 0,
              rotate: direction === 'left' ? -18 : direction === 'right' ? 18 : rotate.get(),
              scale: 0.94
            }}
            transition={{ type: 'spring', damping: 28, stiffness: 140 }}
            className="absolute inset-0 bg-white rounded-[44px] shadow-[0_30px_70px_rgba(0,0,0,0.03)] border border-neutral-200/80 overflow-hidden flex flex-col cursor-grab active:cursor-grabbing interactive-card"
          >
            {/* Elegant swipe feedback overlay */}
            <motion.div 
              style={{ opacity: likeOpacity }}
              className="absolute top-8 left-8 z-20 border border-neutral-950 rounded-full px-5 py-2 rotate-[-8deg] bg-neutral-950 text-white pointer-events-none shadow-md flex items-center space-x-2"
            >
              <Heart size={12} className="fill-current text-rose-400" />
              <span className="text-xs font-black tracking-[0.2em] uppercase">CONNECT</span>
            </motion.div>
            <motion.div 
              style={{ opacity: nopeOpacity }}
              className="absolute top-8 right-8 z-20 border border-neutral-300 rounded-full px-5 py-2 rotate-[8deg] bg-white text-neutral-950 pointer-events-none shadow-sm flex items-center space-x-2"
            >
              <X size={12} className="text-neutral-400" />
              <span className="text-xs font-black tracking-[0.2em] uppercase text-neutral-400">SKIP</span>
            </motion.div>

            {/* Immersive Profile Cover */}
            <div className="relative h-[50%] sm:h-[54%] flex-shrink-0 overflow-hidden">
              <img
                src={displayUser.photoURL || `https://ui-avatars.com/api/?name=${displayUser.displayName}&size=512`}
                alt={displayUser.displayName}
                className="w-full h-full object-cover select-none pointer-events-none transition-transform duration-[2s] hover:scale-105"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-neutral-950/80 via-neutral-950/20 to-transparent" />
              
              <div className="absolute top-6 right-6">
                {displayUser.isOnline && (
                  <div className="bg-white/10 backdrop-blur-md px-3.5 py-1 rounded-full border border-white/10 flex items-center space-x-2">
                    <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-ping" />
                    <span className="text-[8px] font-black text-white uppercase tracking-widest">Live Node</span>
                  </div>
                )}
              </div>

              <div className="absolute bottom-6 left-8 right-8 text-white">
                <div className="flex items-baseline justify-between gap-4">
                  <h2 className="text-3xl font-serif font-semibold tracking-tight text-glow">{displayUser.displayName}</h2>
                  <div className="flex items-center bg-white/15 backdrop-blur-md px-3 py-1 rounded-xl border border-white/10 shrink-0">
                    <Star size={10} className="fill-amber-400 text-amber-400 mr-1" />
                    <span className="text-[10px] font-black tracking-tight">{displayUser.rating ? displayUser.rating.toFixed(1) : '5.0'}</span>
                  </div>
                </div>
                <div className="flex items-center text-white/70 text-[10px] gap-2.5 font-bold uppercase tracking-widest mt-1.5">
                  <span className="flex items-center gap-1"><MapPin size={11} className="text-neutral-300" />{displayUser.location || "Remote"}</span>
                  <span className="opacity-30">•</span>
                  <span>{displayUser.communicationStyle || "Hybrid"}</span>
                </div>
              </div>
            </div>

            {/* Structured Editorial Body */}
            <div className="flex-1 p-8 overflow-y-auto space-y-7 no-scrollbar bg-white">
              {/* Asymmetrical Quote Bio */}
              <div className="space-y-2">
                <span className="text-[8px] font-black text-neutral-400 uppercase tracking-[0.25em] block">PHILOSOPHY</span>
                <p className="text-xs text-neutral-600 leading-relaxed font-semibold italic border-l-2 border-neutral-950 pl-4">
                  "{displayUser.bio || "Exchanging perspectives and mastering peer trades."}"
                </p>
              </div>

              {/* Dynamic Synergy callout */}
              <div className="bg-[#faf8f5] border border-neutral-200/80 p-5 rounded-[24px] space-y-2">
                <p className="text-[8px] font-black text-neutral-400 uppercase tracking-widest flex items-center">
                  <Sparkles size={11} className="mr-1.5 text-neutral-950 animate-spin" style={{ animationDuration: '6s' }} /> Matching Insight
                </p>
                <p className="text-xs text-neutral-600 font-medium leading-relaxed">"{currentCard.reason}"</p>
              </div>

              {/* Custom asymmetrical skill grids */}
              <div className="grid grid-cols-2 gap-6 pt-1">
                <div className="space-y-3">
                  <span className="text-[8px] font-black text-neutral-400 uppercase tracking-widest block">SHARES</span>
                  <div className="flex flex-wrap gap-1.5">
                    {displayUser.skillsOffered?.map(s => (
                      <span key={s} className="bg-neutral-950 text-white px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider shadow-xs">
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="space-y-3">
                  <span className="text-[8px] font-black text-neutral-400 uppercase tracking-widest block">WANTS</span>
                  <div className="flex flex-wrap gap-1.5">
                    {displayUser.skillsWanted?.map(s => (
                      <span key={s} className="bg-neutral-50 text-neutral-800 border border-neutral-200 px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider">
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Desktop Split-Screen Editorial Blueprint Panel */}
      <div className="hidden lg:flex flex-1 flex-col bg-white border border-neutral-200/60 rounded-[44px] overflow-hidden shadow-[0_30px_80px_rgba(0,0,0,0.015)] interactive-card">
        <div className="p-10 overflow-y-auto no-scrollbar space-y-10 flex-1 flex flex-col justify-between">
          <div className="space-y-8">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[8px] font-black text-neutral-400 uppercase tracking-[0.3em] block mb-1">COHORT MATRIX</span>
                <h2 className="text-3xl font-serif text-neutral-950 font-black tracking-tight leading-none">Synergy Blueprint</h2>
              </div>
              <div className="flex items-center space-x-2 bg-[#faf8f5] border border-neutral-200/80 px-4 py-2 rounded-full">
                <span className="w-2 h-2 bg-neutral-950 rounded-full animate-pulse" />
                <span className="text-[9px] font-black text-neutral-950 uppercase tracking-wider">
                  {Math.round((displayUser.rating || 5.0) * 20)}% Matching
                </span>
              </div>
            </div>

            <section className="space-y-3">
              <span className="text-[8px] font-black text-neutral-400 uppercase tracking-[0.3em] block">THE STATEMENT</span>
              <p className="text-xl font-serif text-neutral-850 leading-relaxed font-light italic">
                "{displayUser.bio || "No public bio compiled yet. Connect to initiate trade."}"
              </p>
            </section>

            <div className="grid grid-cols-2 gap-8 pt-4">
              <section className="space-y-4">
                <span className="text-[8px] font-black text-neutral-400 uppercase tracking-[0.3em] block">SKILLS OFFERED</span>
                <div className="flex flex-wrap gap-1.5">
                  {displayUser.skillsOffered?.map(s => (
                    <span key={s} className="bg-neutral-950 text-white px-3.5 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider shadow-sm">
                      {s}
                    </span>
                  ))}
                </div>
              </section>
              <section className="space-y-4">
                <span className="text-[8px] font-black text-neutral-400 uppercase tracking-[0.3em] block">SKILLS REQUESTED</span>
                <div className="flex flex-wrap gap-1.5">
                  {displayUser.skillsWanted?.map(s => (
                    <span key={s} className="bg-[#faf8f5] text-neutral-800 px-3.5 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider border border-neutral-200/60 shadow-xs">
                      {s}
                    </span>
                  ))}
                </div>
              </section>
            </div>

            <section className="bg-neutral-950 text-white p-6 rounded-[28px] space-y-2 shadow-lg relative overflow-hidden">
              <div className="absolute inset-0 opacity-[0.03] bg-[linear-gradient(to_right,#fff_1px,transparent_1px),linear-gradient(to_bottom,#fff_1px,transparent_1px)] bg-[size:16px_16px]" />
              <span className="text-[8px] font-black text-neutral-400 uppercase tracking-[0.3em] block flex items-center relative z-10">
                <Sparkles size={11} className="mr-2 text-amber-400 animate-pulse" /> Curated Collaboration Rationale
              </span>
              <p className="text-xs text-neutral-200 leading-relaxed font-semibold relative z-10">
                "{currentCard.reason}"
              </p>
            </section>
          </div>

          <div className="grid grid-cols-3 gap-6 pt-8 border-t border-neutral-150">
            <div className="bg-[#faf8f5] p-5 rounded-2xl border border-neutral-200/60 text-center">
              <span className="text-[8px] font-black text-neutral-400 uppercase tracking-widest block mb-1">REPUTATION</span>
              <p className="text-xl font-serif font-black text-neutral-950">{displayUser.rating || 5.0} ★</p>
            </div>
            <div className="bg-[#faf8f5] p-5 rounded-2xl border border-neutral-200/60 text-center">
              <span className="text-[8px] font-black text-neutral-400 uppercase tracking-widest block mb-1">MATCHED COHORTS</span>
              <p className="text-xl font-serif font-black text-neutral-950">{displayUser.matchCount || 0}</p>
            </div>
            <div className="bg-[#faf8f5] p-5 rounded-2xl border border-neutral-200/60 text-center">
              <span className="text-[8px] font-black text-neutral-400 uppercase tracking-widest block mb-1">NODE POWER</span>
              <p className="text-xl font-serif font-black text-neutral-950">Lv {displayUser.level || 1}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Control Actions Side Dock - Handcrafted Tactile Floating Elements */}
      <div className="flex items-center justify-center space-x-6 flex-shrink-0 mt-4 sm:mt-6 lg:mt-0 lg:flex-col lg:space-x-0 lg:space-y-6 lg:justify-start lg:pt-12">
        <motion.button
          whileHover={{ scale: 1.1, rotate: -4 }}
          whileTap={{ scale: 0.92 }}
          onClick={() => handleSwipe('left')}
          className="w-14 h-14 sm:w-16 sm:h-16 bg-white rounded-2xl shadow-sm border border-neutral-200 flex items-center justify-center text-neutral-400 hover:text-neutral-950 hover:border-neutral-950 transition-all cursor-pointer"
          title="Pass"
        >
          <X size={18} />
        </motion.button>
        <motion.button
          whileHover={{ scale: 1.15, rotate: 6 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => handleSwipe('right')}
          className="w-18 h-18 sm:w-22 sm:h-22 bg-neutral-950 rounded-[28px] shadow-[0_20px_40px_rgba(0,0,0,0.18)] flex items-center justify-center text-white transition-all cursor-pointer border border-neutral-950 hover:bg-[#faf8f5] hover:text-neutral-950"
          title="Connect"
        >
          <Heart size={28} className="fill-current text-rose-500 hover:text-rose-600" />
        </motion.button>
        <motion.button
          whileHover={{ scale: 1.1, rotate: -4 }}
          whileTap={{ scale: 0.92 }}
          onClick={() => {
            const el = document.querySelector('.overflow-y-auto');
            if (el) el.scrollBy({ top: 260, behavior: 'smooth' });
          }}
          className="w-14 h-14 sm:w-16 sm:h-16 bg-white rounded-2xl shadow-sm border border-neutral-200 flex items-center justify-center text-neutral-400 hover:text-neutral-950 hover:border-neutral-950 transition-all cursor-pointer"
          title="Profile Details"
        >
          <Info size={18} />
        </motion.button>
      </div>

      {/* Gamified Match Successful Alert Overlay Modal */}
      <AnimatePresence>
        {showMatchModal && (
          <motion.div
            key="match-modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-neutral-950/80 backdrop-blur-md flex items-center justify-center p-6"
          >
            <motion.div
              initial={{ scale: 0.92, y: 30 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.92, y: 30 }}
              className="bg-white max-w-sm w-full rounded-[44px] p-10 border border-neutral-200/80 shadow-2xl text-center space-y-7 relative overflow-hidden"
            >
              <div className="absolute inset-0 opacity-[0.01] bg-[radial-gradient(#000_1px,transparent_1px)] bg-[size:12px_12px] pointer-events-none" />
              
              <span className="text-[8px] font-black text-neutral-950 uppercase tracking-[0.25em] bg-neutral-50 border border-neutral-200/80 px-4 py-1.5 rounded-full">Synergy Established</span>
              
              <div className="space-y-3">
                <h2 className="text-4xl font-serif font-black text-neutral-950 tracking-tight leading-none">Mutual Swap!</h2>
                <p className="text-xs text-neutral-400 leading-relaxed font-semibold">You have unlocked a matching expertise portal.</p>
              </div>

              <div className="flex items-center justify-center -space-x-4 py-4">
                <img
                  src={profile?.photoURL || `https://ui-avatars.com/api/?name=${profile?.displayName}`}
                  className="w-22 h-22 rounded-[28px] border-4 border-white shadow-lg object-cover"
                  alt="You"
                />
                <img
                  src={showMatchModal.photoURL || `https://ui-avatars.com/api/?name=${showMatchModal.displayName}`}
                  className="w-22 h-22 rounded-[28px] border-4 border-white shadow-lg object-cover"
                  alt={showMatchModal.displayName}
                />
              </div>

              <p className="text-xs text-neutral-500 leading-relaxed font-semibold max-w-[240px] mx-auto">
                Introduce yourself, trade resources, schedule calendar sessions, and level up your XP together.
              </p>

              <div className="space-y-3 pt-4">
                <Link
                  to="/chat"
                  className="w-full block text-center bg-neutral-950 text-white py-3.5 rounded-xl font-black uppercase tracking-wider text-xs hover:bg-neutral-800 transition-all shadow-md cursor-pointer"
                >
                  Message Exchanger
                </Link>
                <button
                  onClick={() => setShowMatchModal(null)}
                  className="w-full text-center py-2 text-[9px] font-black uppercase tracking-widest text-neutral-400 hover:text-neutral-950 transition-all cursor-pointer underline underline-offset-4"
                >
                  Keep Discovering
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
