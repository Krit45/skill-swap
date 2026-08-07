import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { logout, db, auth } from '../lib/firebase';
import { UserProfile } from '../types';
import { LogOut, User, Search, MessageSquare, LayoutDashboard, Sparkles, Bell, Star, ArrowLeftRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { collection, query, where, orderBy, limit, onSnapshot, updateDoc, doc } from 'firebase/firestore';

interface NavbarProps {
  profile: UserProfile | null;
}

export default function Navbar({ profile }: NavbarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);

  useEffect(() => {
    if (!auth.currentUser) return;
    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', auth.currentUser.uid),
      orderBy('createdAt', 'desc'),
      limit(10)
    );

    return onSnapshot(q, (snapshot) => {
      setNotifications(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
  }, []);

  const markAllAsRead = async () => {
    if (!auth.currentUser) return;
    const unread = notifications.filter(n => !n.read);
    for (const n of unread) {
      await updateDoc(doc(db, 'notifications', n.id), { read: true });
    }
    setShowNotifications(false);
  };

  const navItems = [
    { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/discovery', icon: Sparkles, label: 'Discovery' },
    { path: '/search', icon: Search, label: 'Find Skills' },
    { path: '/chat', icon: MessageSquare, label: 'Messages' },
    { path: '/profile', icon: User, label: 'Profile' },
  ];

  return (
    <nav className="sticky top-0 z-[100] px-4 sm:px-6 py-4 bg-[#faf8f5]/45 backdrop-blur-lg border-b border-neutral-200/40">
      <div className="max-w-7xl mx-auto flex items-center justify-between h-14">
        {/* Editorial Logo Anchor */}
        <Link to="/" className="flex items-center space-x-3 group relative">
          <div className="w-10 h-10 bg-neutral-950 rounded-2xl flex items-center justify-center group-hover:scale-105 group-hover:-rotate-12 transition-all duration-500 shadow-md">
            <ArrowLeftRight size={16} className="text-white" />
          </div>
          <div className="flex flex-col">
            <span className="font-serif italic text-2xl font-black tracking-tight text-neutral-950 leading-none">skillswap</span>
            <span className="hidden sm:block text-[8px] font-black text-neutral-400 uppercase tracking-[0.35em] mt-1">Curated Peer Node</span>
          </div>
        </Link>

        {/* Desktop Custom Capsule Navigation Deck */}
        <div className="hidden md:flex items-center space-x-1.5 bg-white border border-neutral-200/60 p-1.5 rounded-full shadow-sm">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`relative flex items-center space-x-1.5 px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-wider transition-all duration-300 ${
                  isActive 
                    ? 'text-neutral-950' 
                    : 'text-neutral-400 hover:text-neutral-950'
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="desktop-active-pill"
                    className="absolute inset-0 bg-[#faf8f5] rounded-full border border-neutral-200/80 z-0 shadow-sm"
                    transition={{ type: "spring", stiffness: 420, damping: 28 }}
                  />
                )}
                <item.icon size={13} className={`relative z-10 ${isActive ? 'text-neutral-950' : 'text-neutral-400'}`} />
                <span className="relative z-10">{item.label}</span>
              </Link>
            );
          })}
        </div>

        {/* Tactical User/Notification Controls */}
        <div className="flex items-center space-x-3">
          {/* Custom Notification Trigger */}
          <div className="relative">
            <button 
              onClick={() => setShowNotifications(!showNotifications)}
              className="w-11 h-11 flex items-center justify-center text-neutral-500 hover:text-neutral-950 hover:bg-white border border-transparent hover:border-neutral-200/80 rounded-2xl transition-all relative"
            >
              <Bell size={18} />
              {notifications.some(n => !n.read) && (
                <span className="absolute top-2 right-2 w-2 h-2 bg-amber-500 rounded-full border-2 border-[#faf8f5]" />
              )}
            </button>

            <AnimatePresence>
              {showNotifications && (
                <motion.div
                  initial={{ opacity: 0, y: 15, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 15, scale: 0.98 }}
                  className="absolute right-[-40px] sm:right-0 mt-3 w-[calc(100vw-32px)] sm:w-80 bg-white rounded-[28px] shadow-2xl border border-neutral-200/80 overflow-hidden z-50"
                >
                  <div className="p-5 border-b border-neutral-100 flex items-center justify-between bg-neutral-50/50">
                    <h3 className="font-black text-[9px] uppercase tracking-widest text-neutral-400">Registry Alerts</h3>
                    <button 
                      onClick={markAllAsRead}
                      className="text-[9px] font-black uppercase tracking-widest text-neutral-950 hover:underline"
                    >
                      Clear All
                    </button>
                  </div>
                  <div className="max-h-96 overflow-y-auto p-2.5 space-y-1.5 no-scrollbar">
                    {notifications.length === 0 ? (
                      <div className="p-10 text-center space-y-2">
                        <Bell size={24} className="mx-auto text-neutral-300" />
                        <p className="text-[9px] font-black uppercase tracking-widest text-neutral-400">All Nodes Stable</p>
                      </div>
                    ) : (
                      notifications.map(n => (
                        <div 
                          key={n.id} 
                          className={`p-3.5 rounded-2xl transition-all cursor-pointer border ${n.read ? 'opacity-40 border-transparent' : 'bg-[#faf8f5] border-neutral-200 hover:bg-neutral-100'}`}
                          onClick={() => {
                            if (n.matchId) navigate(`/chat/${n.matchId}`);
                            setShowNotifications(false);
                          }}
                        >
                          <div className="flex items-start space-x-3">
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-serif font-black leading-tight text-neutral-950">{n.title}</p>
                              <p className="text-[10px] font-semibold text-neutral-500 leading-relaxed mt-1 line-clamp-2">{n.message}</p>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {profile && (
            <Link to="/profile" className="flex items-center space-x-2.5 p-1 pr-3 bg-white hover:bg-[#faf8f5] rounded-2xl border border-neutral-200/60 shadow-sm transition-all">
              <img
                src={profile.photoURL || `https://ui-avatars.com/api/?name=${profile.displayName}`}
                alt={profile.displayName}
                className="w-8 h-8 rounded-xl border border-neutral-100 object-cover shadow-xs"
                referrerPolicy="no-referrer"
              />
              <div className="hidden sm:flex flex-col text-left">
                <span className="text-[9px] font-black text-neutral-950 uppercase tracking-tight truncate max-w-[80px]">{profile.displayName}</span>
                <div className="flex items-center space-x-1 mt-0.5">
                  <Star size={8} className="fill-amber-400 text-amber-400" />
                  <span className="text-[8px] font-black text-neutral-400">{profile.rating ? profile.rating.toFixed(1) : '5.0'}</span>
                </div>
              </div>
            </Link>
          )}
          
          <button
            onClick={logout}
            className="w-11 h-11 flex items-center justify-center text-neutral-400 hover:text-red-500 hover:bg-red-50 rounded-2xl border border-transparent hover:border-red-100 transition-all"
            title="Disconnect Node"
          >
            <LogOut size={18} />
          </button>
        </div>
      </div>
    </nav>
  );
}
