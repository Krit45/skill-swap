import { useState, useEffect } from 'react';
import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, query, where, getDocs, limit, onSnapshot, doc, getDoc, orderBy, addDoc, updateDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { UserProfile, UserPrivate, Match } from '../types';
import { motion } from 'motion/react';
import { Sparkles, ArrowRight, MessageSquare, Star, Clock, Heart, Search, MapPin, User, Trophy, Zap, Award, Activity, Rocket, Flame, Target, Compass } from 'lucide-react';
import { getMatchRecommendations } from '../lib/ai';
import { getLevel, getPointsForLevel } from '../lib/gamification';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

interface DashboardProps {
  profile: (UserProfile & UserPrivate) | null;
}

interface MatchCardProps {
  match: Match;
  currentUserId: string;
}

function MatchCard({ match, currentUserId }: MatchCardProps) {
  const [otherUser, setOtherUser] = useState<UserProfile | null>(null);

  useEffect(() => {
    const otherUserId = match.users.find(uid => uid !== currentUserId);
    if (!otherUserId) return;

    const unsubscribe = onSnapshot(doc(db, 'users', otherUserId), (docSnap) => {
      if (docSnap.exists()) {
        setOtherUser(docSnap.data() as UserProfile);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `users/${otherUserId}`);
    });

    return () => unsubscribe();
  }, [match.id, currentUserId]);

  if (!otherUser) return null;

  return (
    <motion.div
      whileHover={{ x: 4, scale: 1.01 }}
      className="w-full"
    >
      <Link
        to={`/chat/${match.id}`}
        className="flex items-center space-x-4 bg-white/60 hover:bg-white backdrop-blur-md p-4 rounded-2xl border border-neutral-200/50 hover:shadow-[0_8px_30px_rgba(0,0,0,0.03)] transition-all duration-300 group"
      >
        <div className="relative">
          <img
            src={otherUser.photoURL || `https://ui-avatars.com/api/?name=${otherUser.displayName}`}
            alt={otherUser.displayName}
            className="w-12 h-12 rounded-xl border border-white shadow-sm object-cover"
            referrerPolicy="no-referrer"
          />
          <span className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 border-2 border-white rounded-full ${otherUser.isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-neutral-300'}`} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-xs text-neutral-800 truncate group-hover:text-neutral-950 leading-none">{otherUser.displayName}</h3>
          <p className="text-[10px] text-neutral-400 mt-1 uppercase font-black tracking-widest">
            {otherUser.isOnline ? 'Active' : 'Offline'}
          </p>
        </div>
        <div className="w-9 h-9 bg-neutral-100 rounded-lg flex items-center justify-center text-neutral-400 group-hover:bg-neutral-900 group-hover:text-white transition-all duration-300">
          <MessageSquare size={15} />
        </div>
      </Link>
    </motion.div>
  );
}

export default function Dashboard({ profile }: DashboardProps) {
  const navigate = useNavigate();
  const currentPoints = profile?.points || 0;
  const currentLevel = getLevel(currentPoints);
  const nextLevelPoints = getPointsForLevel(currentLevel + 1);
  const currentLevelPoints = getPointsForLevel(currentLevel);
  const progressInLevel = ((currentPoints - currentLevelPoints) / (nextLevelPoints - currentLevelPoints)) * 100;
  const pointsToNext = nextLevelPoints - currentPoints;

  const [recommendations, setRecommendations] = useState<{ user: UserProfile, reason: string }[]>([]);
  const [activeMatches, setActiveMatches] = useState<Match[]>([]);
  const [leaderboard, setLeaderboard] = useState<UserProfile[]>([]);
  const [recentActivity, setRecentActivity] = useState<{ id: string, user: string, action: string, time: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastEvaluatedSkills, setLastEvaluatedSkills] = useState<string>('');
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
      toast.success("Mock users added! Refreshing dashboard...");
      setTimeout(() => window.location.reload(), 1500);
    } catch (error) {
      console.error("Seeding error:", error);
      toast.error("Failed to seed mock users.");
    } finally {
      setIsSeeding(false);
    }
  };

  useEffect(() => {
    // Mock recent activity for "Live Pulse"
    const activities = [
      { id: '1', user: 'Alex', action: 'swapped Python tips', time: '2m ago' },
      { id: '2', user: 'Sarah', action: 'reached Level 5!', time: '5m ago' },
      { id: '3', user: 'Marcus', action: 'shared Figma assets', time: '12m ago' },
      { id: '4', user: 'Elena', action: 'joined peer chat', time: '15m ago' },
    ];
    setRecentActivity(activities);
  }, []);

  useEffect(() => {
    if (!profile) return;

    // Create a stable string representation of skills to detect meaningful changes
    const currentSkills = JSON.stringify({
      offered: profile.skillsOffered || [],
      wanted: profile.skillsWanted || []
    });

    let unsubscribeMatches: (() => void) | undefined;

    const fetchDashboardData = async () => {
      setLoading(true);
      try {
        const leaderboardQuery = query(
          collection(db, 'users'),
          orderBy('points', 'desc'),
          limit(5)
        );

        const matchesQuery = query(
          collection(db, 'matches'),
          where('users', 'array-contains', profile.uid),
          where('status', '==', 'accepted')
        );

        const usersQuery = query(collection(db, 'users'), limit(50));

        const [leaderboardSnap, usersSnap] = await Promise.all([
          getDocs(leaderboardQuery),
          getDocs(usersQuery)
        ]);

        setLeaderboard(leaderboardSnap.docs.map(doc => doc.data() as UserProfile));

        unsubscribeMatches = onSnapshot(matchesQuery, (snapshot) => {
          const matchData: Match[] = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Match));
          setActiveMatches(matchData);
        }, (error) => {
          if (auth.currentUser) handleFirestoreError(error, OperationType.LIST, 'matches');
        });

        const allUsers = usersSnap.docs.map(doc => doc.data() as UserProfile);
        console.log(`[Dashboard] Found ${allUsers.length} users. Calling AI recommendations...`);
        
        const matchResult = await getMatchRecommendations(profile, allUsers);
        setIsFallback(matchResult.isFallback);
        
        if (matchResult.isFallback) {
          console.warn(`[Dashboard] AI matching fell back: ${matchResult.error}`);
          toast.info("Using keyword matching. AI is currently offline.", {
            description: matchResult.error === "AI Quota Exceeded" ? "Daily AI quota reached." : "Falling back to basic matching."
          });
        }
        
        const recUsers = matchResult.recommendations.map((rec: any) => ({
          user: allUsers.find(u => u.uid === rec.uid)!,
          reason: rec.reason
        })).filter((r: any) => r.user);
        
        setRecommendations(recUsers);
        setLastEvaluatedSkills(currentSkills);
        setLoading(false);

      } catch (error) {
        console.error("Dashboard error:", error);
        setLoading(false);
      }
    };

    fetchDashboardData();

    return () => {
      if (unsubscribeMatches) unsubscribeMatches();
    };
  }, [profile?.uid, JSON.stringify(profile?.skillsOffered || []), JSON.stringify(profile?.skillsWanted || [])]);

  if (!profile) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md bg-white p-8 rounded-[32px] border border-neutral-200/60 shadow-lg space-y-6"
        >
          <div className="w-16 h-16 bg-neutral-100 rounded-2xl flex items-center justify-center mx-auto text-neutral-400">
            <User size={28} />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-serif font-bold text-neutral-900">Configure Your Profile</h2>
            <p className="text-sm text-neutral-500 leading-relaxed">
              Complete your skills offered and skills wanted to unlock personalized peer recommendations on your portal.
            </p>
          </div>
          <Link 
            to="/profile" 
            className="block w-full text-center bg-neutral-900 text-white py-3 rounded-xl font-semibold hover:bg-neutral-800 transition-all text-sm cursor-pointer"
          >
            Go to Profile
          </Link>
        </motion.div>
      </div>
    );
  }

  // Animation layout variants
  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.08
      }
    }
  };

  const itemVariants: any = {
    hidden: { opacity: 0, y: 15 },
    show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } }
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="space-y-16 max-w-7xl mx-auto px-4 sm:px-6 pb-20 relative"
    >
      {/* Visual Anchor Decorator Lines */}
      <div className="absolute top-[180px] left-0 w-[2px] h-[300px] bg-gradient-to-b from-neutral-300/40 to-transparent hidden xl:block" />
      <div className="absolute top-[180px] right-0 w-[2px] h-[300px] bg-gradient-to-b from-neutral-300/40 to-transparent hidden xl:block" />

      {/* 1. HERO CANVAS: Curated Editorial Masterpiece */}
      <motion.section 
        variants={itemVariants}
        className="relative bg-white/30 backdrop-blur-xl border border-neutral-200/80 rounded-[40px] p-8 sm:p-14 md:p-20 overflow-hidden shadow-[0_24px_60px_rgba(0,0,0,0.015)] group"
      >
        {/* Subtle grid accent inside card */}
        <div className="absolute inset-0 opacity-[0.03] bg-[linear-gradient(to_right,#121211_1px,transparent_1px),linear-gradient(to_bottom,#121211_1px,transparent_1px)] bg-[size:28px_28px] pointer-events-none" />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center relative z-10">
          <div className="lg:col-span-8 space-y-8">
            <div className="inline-flex items-center space-x-2.5 bg-neutral-950 text-white px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-[0.2em] border border-neutral-950/20 shadow-sm">
              <Sparkles size={11} className="text-amber-400 animate-pulse fill-current" />
              <span>SkillSwap Curator Node</span>
            </div>
            
            <h1 className="text-5xl sm:text-7xl font-serif text-neutral-950 tracking-tight leading-[0.95] font-semibold">
              Exchange what you <span className="font-sans italic font-light text-neutral-400">know</span>. <br />
              Absorb what you <span className="font-sans italic font-bold text-neutral-900 underline decoration-amber-400/40 decoration-4 underline-offset-4">seek</span>.
            </h1>
            
            <p className="text-neutral-500 text-xs sm:text-sm max-w-lg leading-relaxed font-semibold">
              Welcome back, <span className="font-bold text-neutral-900">{profile.displayName}</span>. 
              Your personalized network recommends active exchanges in <span className="underline decoration-amber-400/60 decoration-2 underline-offset-4 font-bold text-neutral-950">{profile.skillsWanted?.[0] || 'your core domains'}</span> today.
            </p>
            
            <div className="flex flex-wrap gap-4 pt-2">
              <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.98 }} className="relative">
                <Link
                  to="/discovery"
                  className="relative z-10 inline-flex items-center space-x-3 bg-neutral-950 text-white px-8 py-4 rounded-full text-xs font-black uppercase tracking-wider hover:bg-neutral-800 transition-all shadow-[0_10px_30px_rgba(18,18,17,0.15)] cursor-pointer"
                >
                  <Heart size={13} className="fill-current text-rose-500 animate-pulse" />
                  <span>Start Exchanging</span>
                </Link>
                <div className="absolute inset-0 bg-neutral-950/10 blur-xl rounded-full translate-y-2 pointer-events-none" />
              </motion.div>
              
              <Link
                to="/profile"
                className="inline-flex items-center space-x-2 bg-white/90 backdrop-blur-md text-neutral-800 border border-neutral-200 hover:border-neutral-900 px-8 py-4 rounded-full text-xs font-black uppercase tracking-wider transition-all shadow-sm cursor-pointer"
              >
                <User size={13} />
                <span>Exchange Config</span>
              </Link>
            </div>
          </div>
          
          <div className="lg:col-span-4 hidden lg:block relative">
            {/* Elegant Floating Metrics Block with Offset Angle */}
            <motion.div 
              whileHover={{ rotate: 1, y: -4 }}
              className="bg-white/80 border border-neutral-200 p-8 rounded-[32px] space-y-6 shadow-sm rotate-[-2deg] relative z-10"
            >
              <div className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-neutral-150 border border-neutral-200 flex items-center justify-center text-[10px] font-black text-neutral-500">
                ★
              </div>
              <h4 className="font-serif italic text-2xl text-neutral-950 font-bold">Exchange Matrix</h4>
              <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest leading-none">Your registry profile</p>
              
              <div className="space-y-4 pt-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="w-2 h-2 bg-neutral-950 rounded-full" />
                    <span className="text-[10px] text-neutral-500 font-black uppercase tracking-widest">Offered Assets</span>
                  </div>
                  <span className="text-[10px] font-black text-neutral-950 bg-neutral-100 px-2.5 py-1 rounded-md border border-neutral-200">{profile.skillsOffered?.length || 0} Domains</span>
                </div>
                <div className="h-px bg-neutral-100" />
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="w-2 h-2 bg-neutral-400 rounded-full animate-pulse" />
                    <span className="text-[10px] text-neutral-500 font-black uppercase tracking-widest">Wanted Assets</span>
                  </div>
                  <span className="text-[10px] font-black text-neutral-950 bg-neutral-100 px-2.5 py-1 rounded-md border border-neutral-200">{profile.skillsWanted?.length || 0} Targets</span>
                </div>
              </div>
            </motion.div>
            
            {/* Background design ornaments */}
            <div className="absolute inset-0 bg-gradient-to-tr from-amber-200/20 to-indigo-200/10 rounded-[32px] blur-xl -z-10 translate-x-4 translate-y-4" />
          </div>
        </div>
        
        {/* Decorative subtle abstract lines */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-radial-gradient(ellipse_at_top_right,rgba(18,18,17,0.02),transparent) pointer-events-none" />
      </motion.section>

      {/* 2. DYNAMIC QUICK HUB: Asymmetrical Bento Grid */}
      <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {[
          { icon: Rocket, label: 'Magic Match', desc: 'AI Peer Deck Finder', gridSpan: 'md:col-span-4', hoverBg: 'hover:bg-neutral-900 hover:text-white', iconColor: 'text-neutral-900', path: '/discovery' },
          { icon: Compass, label: 'Discovery Deck', desc: 'Browse Swaps', gridSpan: 'md:col-span-3', hoverBg: 'hover:bg-neutral-900 hover:text-white', iconColor: 'text-neutral-900', path: '/discovery' },
          { icon: Target, label: 'Find Mentors', desc: 'Surgically Search registry', gridSpan: 'md:col-span-5', hoverBg: 'hover:bg-neutral-900 hover:text-white', iconColor: 'text-neutral-900', path: '/search' },
        ].map((action, i) => (
          <motion.button
            key={action.label}
            whileHover={{ y: -6, rotate: i % 2 === 0 ? 0.5 : -0.5, boxShadow: "0 16px 32px rgba(0,0,0,0.03)" }}
            whileTap={{ scale: 0.98 }}
            onClick={() => navigate(action.path)}
            className={`flex items-center justify-between p-6 rounded-[28px] bg-white border border-neutral-200/80 ${action.hoverBg} transition-all duration-300 cursor-pointer group text-left ${action.gridSpan} relative overflow-hidden`}
          >
            <div className="space-y-1.5 relative z-10">
              <span className="text-[9px] font-black uppercase tracking-widest text-neutral-400 group-hover:text-neutral-300 transition-colors">{action.desc}</span>
              <h3 className="font-serif font-bold text-lg tracking-tight text-neutral-900 group-hover:text-white transition-colors">{action.label}</h3>
            </div>
            <div className="w-11 h-11 rounded-2xl bg-neutral-50 flex items-center justify-center border border-neutral-100 shadow-sm shrink-0 group-hover:bg-white/10 group-hover:border-white/10 transition-all duration-300">
              <action.icon size={18} className={`${action.iconColor} group-hover:text-white transition-all duration-300`} />
            </div>
          </motion.button>
        ))}
      </motion.div>

      {/* 3. PRIMARY ASYMMETRICAL STORY WORKSPACE */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-stretch">
        
        {/* Left 8-cols: Match of the Day (Curated Portrait Layout) */}
        <motion.div variants={itemVariants} className="lg:col-span-8 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-8">
            <div className="flex flex-col">
              <span className="text-[10px] font-black text-neutral-400 uppercase tracking-[0.25em] mb-1">Peer Spotlight</span>
              <h2 className="text-3xl sm:text-4xl font-serif text-neutral-950 tracking-tight font-bold">
                Match of the Day
              </h2>
            </div>
            <span className="px-3.5 py-1.5 bg-neutral-950 text-white border border-neutral-950 rounded-full text-[9px] font-black uppercase tracking-widest">
              ★ OPTIMAL MATCH
            </span>
          </div>
          
          {recommendations.length > 0 ? (
            <motion.div
              whileHover={{ y: -4 }}
              className="bg-white border border-neutral-200/80 rounded-[36px] overflow-hidden group shadow-[0_12px_45px_rgba(0,0,0,0.015)] p-6 sm:p-10 flex-1 flex flex-col justify-between relative"
            >
              <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
                <div className="md:col-span-5 rounded-[28px] overflow-hidden relative shrink-0 min-h-[260px] rotate-[-1.5deg] border-4 border-white shadow-xl hover:rotate-0 transition-transform duration-500">
                  <img 
                    src={recommendations[0].user.photoURL || `https://ui-avatars.com/api/?name=${recommendations[0].user.displayName}`}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                    alt="Match of the Day"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute top-4 left-4 bg-neutral-950/90 backdrop-blur-md px-3 py-1 rounded-full flex items-center space-x-1.5 border border-white/10 shadow-md">
                    <Star size={11} className="fill-amber-400 text-amber-400" />
                    <span className="text-[9px] font-black text-white">{recommendations[0].user.rating || 5.0}</span>
                  </div>
                  {recommendations[0].user.isOnline && (
                    <div className="absolute bottom-4 left-4 bg-emerald-500 text-white px-3 py-1 rounded-full flex items-center space-x-1.5 text-[9px] font-black uppercase tracking-widest shadow-md">
                      <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                      <span>ONLINE</span>
                    </div>
                  )}
                </div>

                <div className="md:col-span-7 flex flex-col justify-between space-y-6">
                  <div>
                    <span className="text-[9px] font-black text-neutral-400 uppercase tracking-widest block mb-1">Recommended Partner</span>
                    <h3 className="text-3xl font-serif text-neutral-950 font-bold tracking-tight">
                      {recommendations[0].user.displayName}
                    </h3>
                    <p className="text-[10px] text-neutral-400 mt-1.5 flex items-center gap-1 font-bold uppercase tracking-wider">
                      <MapPin size={11} />
                      <span>{recommendations[0].user.location || 'Remote Node'}</span>
                    </p>
                  </div>

                  <p className="text-neutral-500 text-xs sm:text-sm leading-relaxed italic border-l-2 border-neutral-900 pl-4 py-1">
                    "{recommendations[0].reason}"
                  </p>

                  <div className="space-y-2.5">
                    <span className="text-[9px] font-black text-neutral-400 uppercase tracking-widest block">Core Skills To Swap</span>
                    <div className="flex flex-wrap gap-1.5">
                      {recommendations[0].user.skillsOffered?.map(skill => (
                        <span key={skill} className="bg-neutral-100 text-neutral-900 px-3 py-1 rounded-lg text-xs font-bold border border-neutral-200">
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="pt-2">
                    <Link
                      to="/discovery"
                      className="inline-flex items-center space-x-2 bg-neutral-950 text-white px-8 py-3.5 rounded-full text-xs font-black uppercase tracking-widest hover:bg-neutral-800 transition-all duration-300 shadow-md cursor-pointer"
                    >
                      <Heart size={12} className="fill-current text-rose-500" />
                      <span>View Full Profile</span>
                    </Link>
                  </div>
                </div>
              </div>
            </motion.div>
          ) : (
            <div className="flex-1 bg-white border border-neutral-200/80 rounded-[36px] flex flex-col items-center justify-center text-center p-8 sm:p-14 min-h-[380px] relative">
              <div className="w-16 h-16 bg-neutral-50 rounded-2xl shadow-sm flex items-center justify-center mb-4 text-neutral-300 border border-neutral-100">
                <Sparkles size={24} className="animate-spin text-neutral-400" style={{ animationDuration: '6s' }} />
              </div>
              <h3 className="text-xl font-serif font-bold text-neutral-950 mb-2">
                {loading ? "Composing Exchange Match..." : "No Matches Configured"}
              </h3>
              <p className="text-xs text-neutral-400 max-w-sm leading-relaxed font-semibold mb-8">
                {loading 
                  ? "We are currently scanning the global peer database to identify matches for your listed skills."
                  : "We couldn't locate matched exchangers. Try broadening your Skills Wanted on your profile canvas."}
              </p>
              {!loading && (
                <div className="flex gap-3">
                  <button
                    onClick={() => navigate('/profile')}
                    className="bg-white text-neutral-950 border border-neutral-200 px-6 py-3 rounded-full font-black text-[10px] uppercase tracking-wider hover:bg-neutral-50 transition-all shadow-sm cursor-pointer"
                  >
                    Configure Skills
                  </button>
                  <button
                    onClick={seedMockUsers}
                    disabled={isSeeding}
                    className="bg-neutral-950 text-white px-6 py-3 rounded-full font-black text-[10px] uppercase tracking-wider hover:bg-neutral-800 transition-all disabled:opacity-50 shadow-sm cursor-pointer"
                  >
                    {isSeeding ? "Seeding..." : "Seed Mock Users"}
                  </button>
                </div>
              )}
            </div>
          )}
        </motion.div>

        {/* Right 4-cols: Progress tracker bento (Rich layout differences) */}
        <motion.div variants={itemVariants} className="lg:col-span-4 space-y-8 flex flex-col justify-between">
          <div className="flex flex-col">
            <span className="text-[10px] font-black text-neutral-400 uppercase tracking-[0.25em] mb-1">Growth Engine</span>
            <h2 className="text-2xl font-serif text-neutral-950 tracking-tight font-bold">Your Progress</h2>
          </div>
          
          <div className="space-y-6 flex-1 flex flex-col justify-between pt-1">
            {/* XP progress block */}
            <div className="bg-white border border-neutral-200/80 p-6 rounded-[32px] relative overflow-hidden shadow-sm flex-1 flex flex-col justify-between">
              <div className="space-y-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-neutral-950 rounded-xl flex items-center justify-center text-white text-base font-serif italic font-bold">
                      {currentLevel}
                    </div>
                    <div>
                      <p className="text-[9px] font-black text-neutral-400 uppercase tracking-widest leading-none">LEVEL STATUS</p>
                      <p className="text-xs font-black text-neutral-900 mt-1">Level {currentLevel}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-1.5 bg-neutral-100 text-neutral-900 px-3 py-1 rounded-full border border-neutral-200">
                    <Flame size={12} className="fill-current text-neutral-950" />
                    <span className="text-[9px] font-black uppercase tracking-widest">3 DAY STREAK</span>
                  </div>
                </div>
                
                <div className="space-y-2.5">
                  <div className="flex items-baseline justify-between">
                    <h4 className="text-4xl font-serif text-neutral-950 tracking-tight font-bold">
                      {currentPoints} <span className="text-xs text-neutral-400 font-sans font-bold">XP</span>
                    </h4>
                    <p className="text-[9px] font-black text-neutral-400 uppercase tracking-wide">
                      {pointsToNext} XP to Level {currentLevel + 1}
                    </p>
                  </div>
                  <div className="w-full bg-neutral-100 h-2.5 rounded-full overflow-hidden border border-neutral-200/20">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${progressInLevel}%` }}
                      transition={{ duration: 1.2, ease: "easeOut" }}
                      className="bg-neutral-950 h-full rounded-full"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div className="bg-neutral-50/50 p-4 rounded-2xl border border-neutral-200/50">
                    <span className="text-[8px] font-black text-neutral-400 uppercase tracking-widest">Badges</span>
                    <p className="text-xl font-serif font-black text-neutral-950 mt-1">{profile.badges?.length || 0}</p>
                  </div>
                  <div className="bg-neutral-50/50 p-4 rounded-2xl border border-neutral-200/50">
                    <span className="text-[8px] font-black text-neutral-400 uppercase tracking-widest">Global Rank</span>
                    <p className="text-xl font-serif font-black text-neutral-950 mt-1">#12</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Trophy Room block with curved offset and asymmetrical placement */}
            <div className="bg-[#faf8f5] border border-neutral-200 p-6 rounded-[32px] relative overflow-hidden flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <p className="text-[9px] font-black text-neutral-400 uppercase tracking-widest">Trophy Room</p>
                  <Trophy size={14} className="text-neutral-900" />
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3.5">
                    <h4 className="text-4xl font-serif text-neutral-950 font-bold leading-none">{profile.badges?.length || 0}</h4>
                    <p className="text-[10px] font-black text-neutral-400 leading-tight uppercase tracking-wider">Unlocked<br/>Badges</p>
                  </div>
                  <div className="flex -space-x-2">
                    {profile.badges?.slice(0, 3).map((badge) => (
                      <div key={badge.id} className="w-8 h-8 bg-white rounded-xl border border-neutral-200 flex items-center justify-center text-sm shadow-sm relative z-10 hover:z-20 transition-all cursor-pointer" title={badge.name}>
                        {badge.icon}
                      </div>
                    ))}
                    {(profile.badges?.length || 0) > 3 && (
                      <div className="w-8 h-8 bg-neutral-950 rounded-xl border border-neutral-950 flex items-center justify-center text-[9px] font-black text-white shadow-sm relative z-20">
                        +{profile.badges!.length - 3}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="pt-4 mt-4 border-t border-neutral-200">
                <Link to="/profile" className="inline-flex items-center text-[9px] font-black uppercase tracking-widest text-neutral-900 hover:underline group">
                  <span>Showcase Board</span>
                  <ArrowRight size={11} className="ml-1.5 transition-transform group-hover:translate-x-1" />
                </Link>
              </div>
            </div>

          </div>
        </motion.div>
      </div>

      {/* 4. ASYMMETRICAL STORY ROW: Top Recommendations (Left) + Community Board Podiums (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-stretch pt-6">
        
        {/* Left Column: Top Recommendations (Varying asymmetrical layout styles) */}
        <div className="lg:col-span-8 space-y-8">
          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-[10px] font-black text-neutral-400 uppercase tracking-[0.25em] mb-1">Global Match Deck</span>
              <h2 className="text-2xl font-serif text-neutral-950 tracking-tight font-bold">Top Recommendations</h2>
            </div>
            <Link to="/discovery" className="text-xs font-black uppercase tracking-wider text-neutral-400 hover:text-neutral-950 transition-all">Launch Deck</Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {recommendations.slice(1, 5).map((rec, i) => (
              <motion.div
                key={rec.user.uid}
                whileHover={{ y: -8, rotate: i % 2 === 0 ? -0.5 : 0.5, boxShadow: "0 20px 40px rgba(0,0,0,0.03)" }}
                className="group bg-white rounded-[32px] border border-neutral-200/80 transition-all duration-300 overflow-hidden flex flex-col h-full shadow-sm"
              >
                <div className="relative h-48 shrink-0">
                  <img
                    src={rec.user.photoURL || `https://ui-avatars.com/api/?name=${rec.user.displayName}`}
                    alt={rec.user.displayName}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-transparent to-transparent" />
                  <div className="absolute bottom-5 left-5 right-5 flex items-end justify-between text-white">
                    <div>
                      <h3 className="font-serif font-bold text-lg leading-none tracking-tight">{rec.user.displayName}</h3>
                      <p className="text-[9px] text-neutral-200 mt-2 flex items-center gap-0.5 font-bold uppercase tracking-widest"><MapPin size={9} />{rec.user.location || 'Remote'}</p>
                    </div>
                    <div className="bg-white/95 backdrop-blur-md px-2.5 py-1 rounded-lg flex items-center space-x-1 text-neutral-800 border border-neutral-200/10 shadow-sm shrink-0">
                      <Star size={9} className="fill-amber-400 text-amber-400" />
                      <span className="text-[9px] font-black">{rec.user.rating || 5.0}</span>
                    </div>
                  </div>
                </div>
                <div className="p-6 space-y-5 flex-1 flex flex-col justify-between bg-white">
                  <p className="text-xs text-neutral-400 line-clamp-2 italic leading-relaxed pl-3 border-l-2 border-neutral-100">"{rec.reason}"</p>
                  <div className="space-y-4">
                    <div className="flex flex-wrap gap-1">
                      {rec.user.skillsOffered?.slice(0, 2).map(s => (
                        <span key={s} className="bg-neutral-50 text-neutral-600 px-2.5 py-1 rounded-md text-[9px] font-black uppercase tracking-wider border border-neutral-200/50">{s}</span>
                      ))}
                    </div>
                    <Link
                      to="/discovery"
                      className="w-full flex items-center justify-center space-x-1.5 bg-neutral-950 text-white py-3 rounded-xl text-xs font-black uppercase tracking-wider hover:bg-neutral-800 transition-all duration-300 shadow-sm cursor-pointer"
                    >
                      <Heart size={11} className="fill-current text-rose-500" />
                      <span>View Profile</span>
                    </Link>
                  </div>
                </div>
              </motion.div>
            ))}
            {recommendations.length <= 1 && !loading && (
              <div className="col-span-2 p-14 text-center bg-white rounded-[32px] border border-dashed border-neutral-200/80 flex flex-col items-center justify-center min-h-[250px]">
                <Trophy size={20} className="text-neutral-300 mb-2" />
                <p className="text-xs text-neutral-400 font-bold">Configure your profile details to see more recommendations.</p>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Dynamic Podium Leaderboard & Connections */}
        <div className="lg:col-span-4 space-y-12">
          
          {/* Active Matches list */}
          <div className="space-y-6">
            <div className="flex flex-col">
              <span className="text-[10px] font-black text-neutral-400 uppercase tracking-[0.25em] mb-1">Active Exchanges</span>
              <h2 className="text-2xl font-serif text-neutral-950 tracking-tight font-bold">Connections</h2>
            </div>
            <div className="space-y-4">
              {activeMatches.map((match) => (
                <MatchCard key={match.id} match={match} currentUserId={profile.uid} />
              ))}
              {activeMatches.length === 0 && (
                <div className="p-8 text-center bg-white/60 backdrop-blur-md border border-neutral-200/50 rounded-2xl">
                  <p className="text-xs text-neutral-400 font-semibold leading-relaxed">No active trades. Use discovery or registry search to establish peers.</p>
                </div>
              )}
            </div>
          </div>

          {/* Gamified Leaderboard Podium (Crafted layout element replacing generic lists!) */}
          <div className="space-y-6">
            <div className="flex flex-col">
              <span className="text-[10px] font-black text-neutral-400 uppercase tracking-[0.25em] mb-1">Peer Ranking</span>
              <h2 className="text-2xl font-serif text-neutral-950 tracking-tight font-bold">Community Board</h2>
            </div>
            
            <div className="bg-white border border-neutral-200/80 rounded-[32px] p-6 shadow-sm space-y-6">
              
              {/* Podium Visual for Top 3 */}
              {leaderboard.length >= 3 && (
                <div className="flex items-end justify-center pt-8 pb-4 border-b border-neutral-100 gap-2">
                  
                  {/* 2nd place */}
                  <div className="flex flex-col items-center flex-1">
                    <div className="relative">
                      <img
                        src={leaderboard[1].photoURL || `https://ui-avatars.com/api/?name=${leaderboard[1].displayName}`}
                        alt={leaderboard[1].displayName}
                        className="w-11 h-11 rounded-full object-cover border-2 border-neutral-300"
                        referrerPolicy="no-referrer"
                      />
                      <span className="absolute -top-2 -right-1 w-5 h-5 bg-neutral-100 rounded-full flex items-center justify-center text-[9px] font-black text-neutral-600 border border-neutral-200">2</span>
                    </div>
                    <span className="text-[9px] font-black text-neutral-800 truncate w-16 text-center mt-2">{leaderboard[1].displayName.split(' ')[0]}</span>
                    <span className="text-[8px] font-bold text-neutral-400">{leaderboard[1].points} XP</span>
                    <div className="w-16 h-10 bg-neutral-50 border border-neutral-200/50 rounded-t-lg mt-3" />
                  </div>

                  {/* 1st place */}
                  <div className="flex flex-col items-center flex-1 -translate-y-4">
                    <div className="relative">
                      <img
                        src={leaderboard[0].photoURL || `https://ui-avatars.com/api/?name=${leaderboard[0].displayName}`}
                        alt={leaderboard[0].displayName}
                        className="w-14 h-14 rounded-full object-cover border-2 border-amber-400 shadow-lg"
                        referrerPolicy="no-referrer"
                      />
                      <span className="absolute -top-2 -right-1 w-6 h-6 bg-amber-400 rounded-full flex items-center justify-center text-[10px] font-black text-amber-950 shadow-sm border border-white">👑</span>
                    </div>
                    <span className="text-[10px] font-black text-neutral-900 truncate w-20 text-center mt-2">{leaderboard[0].displayName.split(' ')[0]}</span>
                    <span className="text-[9px] font-black text-amber-700">{leaderboard[0].points} XP</span>
                    <div className="w-20 h-16 bg-neutral-900 rounded-t-xl mt-3 flex items-center justify-center">
                      <span className="text-white font-serif italic text-sm font-bold">1st</span>
                    </div>
                  </div>

                  {/* 3rd place */}
                  <div className="flex flex-col items-center flex-1">
                    <div className="relative">
                      <img
                        src={leaderboard[2].photoURL || `https://ui-avatars.com/api/?name=${leaderboard[2].displayName}`}
                        alt={leaderboard[2].displayName}
                        className="w-10 h-10 rounded-full object-cover border-2 border-amber-600/30"
                        referrerPolicy="no-referrer"
                      />
                      <span className="absolute -top-2 -right-1 w-5 h-5 bg-amber-50 rounded-full flex items-center justify-center text-[9px] font-black text-amber-800 border border-amber-100">3</span>
                    </div>
                    <span className="text-[9px] font-black text-neutral-800 truncate w-16 text-center mt-2">{leaderboard[2].displayName.split(' ')[0]}</span>
                    <span className="text-[8px] font-bold text-neutral-400">{leaderboard[2].points} XP</span>
                    <div className="w-16 h-8 bg-neutral-50 border border-neutral-200/50 rounded-t-lg mt-3" />
                  </div>

                </div>
              )}

              {/* Remainder list */}
              <div className="space-y-4">
                {leaderboard.slice(3, 5).map((user, i) => (
                  <div key={user.uid} className="flex items-center space-x-3.5">
                    <div className="w-6 h-6 rounded-md flex items-center justify-center font-bold text-[10px] text-neutral-400 border border-neutral-100">
                      {i + 4}
                    </div>
                    <img
                      src={user.photoURL || `https://ui-avatars.com/api/?name=${user.displayName}`}
                      alt={user.displayName}
                      className="w-8 h-8 rounded-xl border border-neutral-150 object-cover"
                      referrerPolicy="no-referrer"
                    />
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-xs text-neutral-800 truncate leading-none">{user.displayName}</h3>
                      <p className="text-[9px] text-neutral-400 mt-1 uppercase font-black tracking-widest">Level {user.level || 1}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-black text-xs text-neutral-800 leading-none">{user.points || 0}</p>
                      <p className="text-[7px] text-neutral-400 mt-0.5 uppercase font-bold tracking-widest">XP</p>
                    </div>
                  </div>
                ))}
                {leaderboard.length === 0 && (
                  <p className="text-center text-neutral-400 text-xs py-4">Compiling board data...</p>
                )}
              </div>
            </div>
          </div>

        </div>

      </div>
    </motion.div>
  );
}

