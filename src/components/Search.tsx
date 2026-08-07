import { useState, useEffect } from 'react';
import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, query, where, getDocs, addDoc, serverTimestamp, onSnapshot, doc } from 'firebase/firestore';
import { UserProfile, UserPrivate } from '../types';
import { motion } from 'motion/react';
import { Search as SearchIcon, UserPlus, Star, MapPin, Compass, Zap, HelpCircle } from 'lucide-react';
import { globalSocket } from '../App';

interface SearchProps {
  profile: (UserProfile & UserPrivate) | null;
}

interface UserCardProps {
  user: UserProfile;
  profile: (UserProfile & UserPrivate) | null;
}

function UserCard({ user: initialUser, profile }: UserCardProps) {
  const [user, setUser] = useState<UserProfile>(initialUser);
  const [requesting, setRequesting] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, 'users', initialUser.uid), (docSnap) => {
      if (docSnap.exists()) {
        setUser(docSnap.data() as UserProfile);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `users/${initialUser.uid}`);
    });

    return () => unsubscribe();
  }, [initialUser.uid]);

  const sendMatchRequest = async () => {
    if (!auth.currentUser) return;
    setRequesting(true);
    try {
      const matchRef = await addDoc(collection(db, 'matches'), {
        users: [auth.currentUser.uid, user.uid].sort(),
        status: 'pending',
        requesterId: auth.currentUser.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // Notify the target user
      globalSocket.current?.emit('notify-user', {
        receiverId: user.uid,
        type: 'match',
        title: 'New Match Request',
        message: `${profile?.displayName} wants to swap skills with you!`,
        matchId: matchRef.id
      });

      setSent(true);
    } catch (error) {
      if (auth.currentUser) {
        handleFirestoreError(error, OperationType.WRITE, 'matches');
      }
    } finally {
      setRequesting(false);
    }
  };

  return (
    <motion.div
      whileHover={{ y: -8, rotate: 0.5, boxShadow: "0 30px 60px rgba(0,0,0,0.025)" }}
      className="bg-white rounded-[36px] border border-neutral-200 p-8 hover:border-neutral-950 transition-all duration-500 flex flex-col justify-between relative overflow-hidden"
    >
      {/* Micro Grid details inside each card */}
      <div className="absolute inset-0 opacity-[0.015] bg-[linear-gradient(to_right,#000_1px,transparent_1px),linear-gradient(to_bottom,#000_1px,transparent_1px)] bg-[size:16px_16px] pointer-events-none" />

      <div className="space-y-6 relative z-10">
        {/* User Card Header */}
        <div className="flex items-center space-x-4">
          <div className="relative shrink-0">
            <img
              src={user.photoURL || `https://ui-avatars.com/api/?name=${user.displayName}`}
              alt={user.displayName}
              className="w-14 h-14 rounded-2xl object-cover border border-neutral-150 shadow-xs"
              referrerPolicy="no-referrer"
            />
            <span className={`absolute -bottom-1 -right-1 w-4 h-4 border-2 border-white rounded-full ${user.isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-neutral-350'}`} />
          </div>
          <div className="min-w-0 flex-1 text-left">
            <div className="flex items-baseline space-x-2">
              <h3 className="font-serif font-semibold text-lg text-neutral-950 truncate leading-none">{user.displayName}</h3>
              <span className="text-[8px] text-neutral-400 font-black uppercase tracking-widest">Lv.{user.level || 1}</span>
            </div>
            <p className="text-[9px] text-neutral-400 mt-1.5 flex items-center gap-1 font-black uppercase tracking-wider">
              <MapPin size={10} className="text-neutral-300" />
              <span>{user.location || 'Remote'}</span>
            </p>
          </div>
          <div className="flex items-center space-x-1 bg-[#faf8f5] px-2.5 py-1 rounded-xl border border-neutral-200/60 shrink-0">
            <Star size={9} className="fill-amber-400 text-amber-400" />
            <span className="text-[10px] font-black text-neutral-800">{user.rating ? user.rating.toFixed(1) : '5.0'}</span>
          </div>
        </div>

        {/* Bio summary */}
        <p className="text-xs text-neutral-600 font-medium leading-relaxed italic pl-4 border-l-2 border-neutral-950">
          "{user.bio || "Exchanging expertise and driving mutual knowledge peer growth."}"
        </p>

        {/* Offers / Wants badge grids */}
        <div className="space-y-4 pt-1">
          <div>
            <span className="text-[8px] font-black text-neutral-400 uppercase tracking-widest block mb-2">Skills Offered</span>
            <div className="flex flex-wrap gap-1.5">
              {user.skillsOffered?.slice(0, 3).map((s, i) => (
                <span key={`${s}-${i}`} className="bg-neutral-950 text-white px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider">
                  {s}
                </span>
              ))}
            </div>
          </div>
          <div>
            <span className="text-[8px] font-black text-neutral-400 uppercase tracking-widest block mb-2">Skills Wanted</span>
            <div className="flex flex-wrap gap-1.5">
              {user.skillsWanted?.slice(0, 3).map((s, i) => (
                <span key={`${s}-${i}`} className="bg-[#faf8f5] text-neutral-800 px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider border border-neutral-200/60">
                  {s}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Action triggers */}
      <div className="pt-6 mt-6 border-t border-neutral-100 relative z-10">
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={sendMatchRequest}
          disabled={requesting || sent}
          className={`w-full flex items-center justify-center space-x-2 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
            sent 
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              : 'bg-neutral-950 text-white hover:bg-neutral-850 disabled:opacity-50 shadow-sm'
          }`}
        >
          <UserPlus size={12} />
          <span>{requesting ? 'Connecting...' : sent ? 'Connection Sent!' : 'Request Swap'}</span>
        </motion.button>
      </div>
    </motion.div>
  );
}

export default function Search({ profile }: SearchProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const searchUsers = async () => {
    if (!searchTerm.trim()) return;
    setLoading(true);
    setSearched(true);
    try {
      const q = query(
        collection(db, 'users'),
        where('skillsOffered', 'array-contains-any', [searchTerm.trim()])
      );
      const querySnapshot = await getDocs(q);
      const results: UserProfile[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data() as UserProfile;
        if (data.uid !== auth.currentUser?.uid) {
          results.push(data);
        }
      });
      setUsers(results);
    } catch (error) {
      if (auth.currentUser) {
        handleFirestoreError(error, OperationType.LIST, 'users');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -30 }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      className="max-w-6xl mx-auto px-4 pb-20 space-y-14 relative"
    >
      {/* Decorative backdrop patterns */}
      <div className="absolute inset-0 opacity-[0.02] bg-[radial-gradient(#000_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />

      {/* Search Header */}
      <div className="text-center space-y-4 relative z-10 pt-4">
        <div className="inline-flex items-center space-x-2 bg-neutral-950 text-white px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border border-neutral-950/10">
          <Compass size={11} className="text-amber-400 animate-spin" style={{ animationDuration: '8s' }} />
          <span>Global Peer Directory</span>
        </div>
        <h1 className="text-4xl sm:text-5xl font-serif font-semibold tracking-tight text-neutral-950 leading-tight">
          Query the Collective
        </h1>
        <p className="text-neutral-500 max-w-xl mx-auto text-xs sm:text-sm leading-relaxed font-semibold">
          Locate peer members offering targeted expertise in production coding, creative visual design, linguistic trades, or marketing swaps.
        </p>
      </div>

      {/* Floating Query Command Bar */}
      <div className="relative max-w-xl mx-auto relative z-10">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center bg-white border border-neutral-250 rounded-[24px] p-2 shadow-[0_30px_60px_rgba(0,0,0,0.015)] gap-2 sm:gap-0">
          <div className="flex items-center flex-1 px-3">
            <SearchIcon className="text-neutral-400 ml-1" size={16} />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              onKeyPress={e => e.key === 'Enter' && searchUsers()}
              placeholder="Search e.g. UI/UX, Python, React..."
              className="flex-1 bg-transparent border-none focus:outline-none px-4 py-3 text-xs font-semibold text-neutral-800 placeholder-neutral-400"
            />
          </div>
          <button
            onClick={searchUsers}
            disabled={loading}
            className="bg-neutral-950 text-white px-8 py-3.5 rounded-xl font-black uppercase tracking-wider text-[10px] hover:bg-neutral-850 transition-all disabled:opacity-50 cursor-pointer shadow-sm"
          >
            {loading ? 'Searching...' : 'Search Registry'}
          </button>
        </div>
        
        {/* Suggestion tags */}
        <div className="flex flex-wrap items-center justify-center gap-2 mt-5 text-[9px] font-black text-neutral-400 uppercase tracking-[0.25em]">
          <span>RECOMMENDED NODES:</span>
          {["UI/UX Design", "Python", "React", "Public Speaking"].map((tag) => (
            <button
              key={tag}
              onClick={() => {
                setSearchTerm(tag);
                setTimeout(() => {
                  const el = document.querySelector('input');
                  if (el) {
                    el.value = tag;
                    el.dispatchEvent(new Event('input', { bubbles: true }));
                  }
                }, 0);
              }}
              className="bg-white hover:bg-neutral-950 hover:text-white text-neutral-700 px-3 py-1.5 rounded-lg border border-neutral-200 transition-all cursor-pointer"
            >
              {tag}
            </button>
          ))}
        </div>
      </div>

      {/* Grid containing result cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 relative z-10">
        {users.map((user) => (
          <UserCard key={user.uid} user={user} profile={profile} />
        ))}
      </div>

      {/* Fallback Empty state */}
      {!loading && users.length === 0 && searched && (
        <div className="text-center py-20 bg-white border border-neutral-200/80 rounded-[40px] max-w-md mx-auto space-y-6 relative z-10 shadow-sm">
          <div className="w-14 h-14 bg-neutral-50 border border-neutral-100 rounded-2xl flex items-center justify-center mx-auto text-neutral-400">
            <HelpCircle size={22} />
          </div>
          <div className="space-y-2">
            <h3 className="font-serif font-bold text-xl text-neutral-950">Node Not Detected</h3>
            <p className="text-xs text-neutral-400 max-w-xs mx-auto leading-relaxed font-semibold">
              No active exchanger currently registers "{searchTerm}" under their offered expertise. Try general queries like "Design" or "React".
            </p>
          </div>
        </div>
      )}
    </motion.div>
  );
}
