import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, orderBy, doc, getDoc, updateDoc } from 'firebase/firestore';
import { Message, Match, UserProfile, Session } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { Send, Calendar, ChevronLeft, MessageSquare, Clock, Info, MoreVertical, Paperclip, File as FileIcon, Download, Sparkles, CheckCircle2, Star, Trophy, ArrowRight } from 'lucide-react';
import axios from 'axios';
import { io, Socket } from 'socket.io-client';
import { globalSocket } from '../App';
import Booking from './Booking';
import ReviewModal from './ReviewModal';
import SessionDetailsModal from './SessionDetailsModal';
import { awardPoints, POINT_VALUES } from '../lib/gamification';
import { toast } from 'sonner';

interface ChatProps {
  profile: UserProfile | null;
}

interface ChatListItemProps {
  match: Match & { otherUser: UserProfile };
  isActive: boolean;
  onClick: () => void;
}

function ChatListItem({ match, isActive, onClick }: ChatListItemProps) {
  const [otherUser, setOtherUser] = useState<UserProfile>(match.otherUser);

  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, 'users', match.otherUser.uid), (docSnap) => {
      if (docSnap.exists()) {
        setOtherUser(docSnap.data() as UserProfile);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `users/${match.otherUser.uid}`);
    });

    return () => unsubscribe();
  }, [match.otherUser.uid]);

  return (
    <button
      onClick={onClick}
      className={`w-full p-4 flex items-center space-x-3.5 rounded-2xl transition-all border ${
        isActive 
          ? 'bg-neutral-900 text-white border-neutral-950 shadow-[0_8px_24px_rgba(0,0,0,0.12)]' 
          : 'hover:bg-neutral-50 bg-white border-transparent'
      }`}
    >
      <div className="relative shrink-0">
        <img
          src={otherUser.photoURL || `https://ui-avatars.com/api/?name=${otherUser.displayName}`}
          alt={otherUser.displayName}
          className={`w-11 h-11 rounded-xl object-cover border ${isActive ? 'border-white/20' : 'border-neutral-100'}`}
          referrerPolicy="no-referrer"
        />
        <span className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 border-2 border-white rounded-full ${otherUser.isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-neutral-300'}`} />
      </div>
      <div className="text-left flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <h3 className={`font-serif font-bold text-sm truncate ${isActive ? 'text-white' : 'text-neutral-900'}`}>
            {otherUser.displayName}
          </h3>
          {otherUser.isOnline && !isActive && (
            <span className="flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
          )}
        </div>
        <p className={`text-[10px] font-semibold truncate mt-0.5 ${isActive ? 'text-white/60' : 'text-neutral-400'}`}>
          {otherUser.isOnline ? 'Active now' : 'Offline'}
        </p>
      </div>
    </button>
  );
}

interface PendingMatchItemProps {
  match: Match & { otherUser: UserProfile };
  onClick: () => void;
}

function PendingMatchItem({ match, onClick }: PendingMatchItemProps) {
  const [otherUser, setOtherUser] = useState<UserProfile>(match.otherUser);

  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, 'users', match.otherUser.uid), (docSnap) => {
      if (docSnap.exists()) {
        setOtherUser(docSnap.data() as UserProfile);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `users/${match.otherUser.uid}`);
    });

    return () => unsubscribe();
  }, [match.otherUser.uid]);

  return (
    <button
      onClick={onClick}
      className="flex-shrink-0 group relative focus:outline-none"
    >
      <div className="relative">
        <img
          src={otherUser.photoURL || `https://ui-avatars.com/api/?name=${otherUser.displayName}`}
          alt={otherUser.displayName}
          className="w-12 h-12 rounded-xl border border-neutral-200 object-cover group-hover:scale-105 transition-all duration-300 shadow-sm"
          referrerPolicy="no-referrer"
        />
        <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-neutral-950 rounded-full flex items-center justify-center">
          <span className={`w-1 h-1 rounded-full ${otherUser.isOnline ? 'bg-emerald-400' : 'bg-white'}`} />
        </span>
      </div>
      <p className="text-[9px] font-black text-center mt-1.5 truncate w-12 text-neutral-500">{otherUser.displayName.split(' ')[0]}</p>
    </button>
  );
}

export default function Chat({ profile }: ChatProps) {
  const { matchId } = useParams<{ matchId: string }>();
  const navigate = useNavigate();
  const [matches, setMatches] = useState<(Match & { otherUser: UserProfile })[]>([]);
  const [currentMatch, setCurrentMatch] = useState<(Match & { otherUser: UserProfile }) | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isOtherUserTyping, setIsOtherUserTyping] = useState(false);
  const [showBooking, setShowBooking] = useState(false);
  const [showReview, setShowReview] = useState<Session | null>(null);
  const [showSessionDetails, setShowSessionDetails] = useState<Session | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!auth.currentUser) return;

    const q = query(
      collection(db, 'matches'),
      where('users', 'array-contains', auth.currentUser.uid)
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const matchData: (Match & { otherUser: UserProfile })[] = [];
      for (const docSnap of snapshot.docs) {
        const data = docSnap.data() as Match;
        const otherUserId = data.users.find(uid => uid !== auth.currentUser?.uid);
        if (otherUserId) {
          try {
            const userDoc = await getDoc(doc(db, 'users', otherUserId));
            if (userDoc.exists()) {
              matchData.push({ ...data, id: docSnap.id, otherUser: userDoc.data() as UserProfile });
            }
          } catch (error) {
            handleFirestoreError(error, OperationType.GET, `users/${otherUserId}`);
          }
        }
      }
      setMatches(matchData);
      if (matchId) {
        const current = matchData.find(m => m.id === matchId);
        if (current) setCurrentMatch(current);
      }
    }, (error) => {
      if (auth.currentUser) {
        handleFirestoreError(error, OperationType.LIST, 'matches');
      }
    });

    return () => unsubscribe();
  }, [matchId]);

  useEffect(() => {
    if (!currentMatch?.otherUser.uid) return;

    const otherUserRef = doc(db, 'users', currentMatch.otherUser.uid);
    const unsubscribe = onSnapshot(otherUserRef, (docSnap) => {
      if (docSnap.exists()) {
        const userData = docSnap.data() as UserProfile;
        setCurrentMatch(prev => prev ? { ...prev, otherUser: userData } : null);
        
        setMatches(prev => prev.map(m => 
          m.otherUser.uid === userData.uid ? { ...m, otherUser: userData } : m
        ));
      }
    });

    return () => unsubscribe();
  }, [currentMatch?.otherUser.uid]);

  useEffect(() => {
    if (!matchId) return;

    const socket = globalSocket.current || io();
    if (!globalSocket.current) globalSocket.current = socket;
    
    socket.emit('join-room', matchId);

    socket.on('user-typing', (data: { userId: string, isTyping: boolean }) => {
      if (data.userId !== auth.currentUser?.uid) {
        setIsOtherUserTyping(data.isTyping);
      }
    });

    const q = query(
      collection(db, `matches/${matchId}/messages`),
      orderBy('createdAt', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Message));
      setMessages(msgs);
    }, (error) => {
      if (auth.currentUser) {
        handleFirestoreError(error, OperationType.LIST, `matches/${matchId}/messages`);
      }
    });

    const sessionsQ = query(
      collection(db, `matches/${matchId}/sessions`),
      orderBy('startTime', 'asc')
    );
    const unsubscribeSessions = onSnapshot(sessionsQ, (snapshot) => {
      const sess = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Session));
      setSessions(sess);
    }, (error) => {
      if (auth.currentUser) {
        handleFirestoreError(error, OperationType.LIST, `matches/${matchId}/sessions`);
      }
    });

    return () => {
      unsubscribe();
      unsubscribeSessions();
      socket.off('user-typing');
    };
  }, [matchId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isOtherUserTyping]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !matchId || !auth.currentUser || !currentMatch) return;

    const socket = globalSocket.current;
    socket?.emit('typing', { matchId, userId: auth.currentUser.uid, isTyping: false });

    const messageData = {
      matchId,
      senderId: auth.currentUser.uid,
      text: newMessage.trim(),
      createdAt: serverTimestamp(),
    };

    try {
      await addDoc(collection(db, `matches/${matchId}/messages`), messageData);
      socket?.emit('send-message', { 
        ...messageData, 
        createdAt: new Date().toISOString(),
        receiverId: currentMatch.otherUser.uid
      });

      await addDoc(collection(db, 'notifications'), {
        userId: currentMatch.otherUser.uid,
        type: 'message',
        title: `New Message from ${profile?.displayName || 'SkillSwapper'}`,
        message: newMessage.trim(),
        matchId,
        read: false,
        createdAt: serverTimestamp()
      });

      setNewMessage('');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `matches/${matchId}/messages`);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !matchId || !auth.currentUser || !currentMatch) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await axios.post('/api/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      const { fileUrl, fileName, fileType } = response.data;

      const messageData = {
        matchId,
        senderId: auth.currentUser.uid,
        text: `Shared a file: ${fileName}`,
        fileUrl,
        fileName,
        fileType,
        createdAt: serverTimestamp(),
      };

      await addDoc(collection(db, `matches/${matchId}/messages`), messageData);
      
      globalSocket.current?.emit('send-message', {
        ...messageData,
        createdAt: new Date().toISOString(),
        receiverId: currentMatch.otherUser.uid
      });

      await addDoc(collection(db, 'notifications'), {
        userId: currentMatch.otherUser.uid,
        type: 'message',
        title: `New File from ${profile?.displayName || 'SkillSwapper'}`,
        message: `Shared a file: ${fileName}`,
        matchId,
        read: false,
        createdAt: serverTimestamp()
      });

    } catch (error) {
      console.error('File upload failed:', error);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const acceptMatch = async (mId: string) => {
    if (!currentMatch) return;
    try {
      await updateDoc(doc(db, 'matches', mId), {
        status: 'accepted',
        updatedAt: serverTimestamp(),
      });
      
      globalSocket.current?.emit('notify-user', {
        receiverId: currentMatch.requesterId,
        type: 'match',
        title: 'Match Accepted!',
        message: `${auth.currentUser?.displayName} accepted your skill swap request!`,
        matchId: mId
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `matches/${mId}`);
    }
  };

  const completeSession = async (sessionId: string) => {
    if (!matchId || !currentMatch || !auth.currentUser) return;
    try {
      await updateDoc(doc(db, `matches/${matchId}/sessions`, sessionId), {
        status: 'completed',
        updatedAt: serverTimestamp(),
      });

      await awardPoints(auth.currentUser.uid, POINT_VALUES.COMPLETE_SESSION, { sessionCountIncrement: 1 });
      await awardPoints(currentMatch.otherUser.uid, POINT_VALUES.COMPLETE_SESSION, { sessionCountIncrement: 1 });

      toast.success("Session marked as completed! +100 XP earned.");
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `matches/${matchId}/sessions/${sessionId}`);
    }
  };

  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const handleTyping = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewMessage(e.target.value);
    if (!matchId || !auth.currentUser) return;

    globalSocket.current?.emit('typing', { matchId, userId: auth.currentUser.uid, isTyping: true });

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

    typingTimeoutRef.current = setTimeout(() => {
      globalSocket.current?.emit('typing', { matchId, userId: auth.currentUser.uid, isTyping: false });
    }, 2000);
  };

  const pendingMatches = matches.filter(m => m.status === 'pending' && m.requesterId !== auth.currentUser?.uid);
  const activeMatches = matches.filter(m => m.status === 'accepted');

  const quickReplies = [
    "Hey! 👋",
    "Love your skills! 🚀",
    "When are you free? 🗓️",
    "Let's swap! 🤝",
    "Thanks! ✨"
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      transition={{ duration: 0.3 }}
      className="flex h-[calc(100vh-140px)] sm:h-[calc(100vh-160px)] bg-white rounded-[40px] border border-neutral-200/60 shadow-sm overflow-hidden relative max-w-7xl mx-auto"
    >
      {/* Sidebar - Conversations and Pendings */}
      <div className={`w-full md:w-[320px] lg:w-[380px] shrink-0 border-r border-neutral-100 flex flex-col bg-white ${matchId ? 'hidden md:flex' : 'flex'}`}>
        <div className="p-8 pb-4">
          <h2 className="text-2xl font-serif font-bold text-neutral-950 tracking-tight">Swap Inbox</h2>
        </div>
        
        <div className="flex-1 overflow-y-auto px-6 space-y-6 pb-8 no-scrollbar">
          {/* New Match Requests section */}
          {pendingMatches.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-[9px] font-black text-neutral-400 uppercase tracking-widest block">Requests</h3>
              <div className="flex space-x-3.5 overflow-x-auto pb-1.5 no-scrollbar">
                {pendingMatches.map((m) => (
                  <PendingMatchItem
                    key={m.id}
                    match={m}
                    onClick={() => navigate(`/chat/${m.id}`)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Active Chats list */}
          <div className="space-y-1.5">
            <h3 className="text-[9px] font-black text-neutral-400 uppercase tracking-widest block">Conversations</h3>
            {activeMatches.map((m) => (
              <ChatListItem
                key={m.id}
                match={m}
                isActive={matchId === m.id}
                onClick={() => navigate(`/chat/${m.id}`)}
              />
            ))}
            {activeMatches.length === 0 && pendingMatches.length === 0 && (
              <div className="text-center py-14 space-y-4">
                <div className="w-12 h-12 bg-neutral-100 rounded-2xl flex items-center justify-center mx-auto text-neutral-400">
                  <MessageSquare size={18} />
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-bold text-neutral-800">Inbox empty</p>
                  <Link to="/discovery" className="text-[10px] font-black text-neutral-400 uppercase tracking-widest hover:text-neutral-900 transition-all flex items-center justify-center gap-1">
                    Start Swiping <ArrowRight size={10} />
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Primary Message Stream Workspace */}
      <div className={`flex-1 flex flex-col ${!matchId ? 'hidden md:flex items-center justify-center bg-neutral-50/20' : 'flex bg-white'}`}>
        {!matchId ? (
          <div className="text-center max-w-xs space-y-4">
            <div className="w-16 h-16 bg-white border border-neutral-200/60 rounded-3xl shadow-sm flex items-center justify-center mx-auto text-neutral-400">
              <MessageSquare size={24} />
            </div>
            <div className="space-y-1">
              <h3 className="font-serif font-bold text-lg text-neutral-950">Active Trade</h3>
              <p className="text-xs text-neutral-400 font-medium leading-relaxed">
                Choose an active skill-swapping companion from your left inbox stream to start exchanging modules.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Header section with real-time detail highlights */}
            <div className="px-6 py-4 sm:py-5 border-b border-neutral-100 flex items-center justify-between bg-white sticky top-0 z-10">
              <div className="flex items-center space-x-3.5 min-w-0">
                <button onClick={() => navigate('/chat')} className="md:hidden p-1.5 -ml-1 text-neutral-500 hover:bg-neutral-50 rounded-lg transition-all shrink-0">
                  <ChevronLeft size={20} />
                </button>
                <div className="relative shrink-0">
                  <img
                    src={currentMatch?.otherUser.photoURL || `https://ui-avatars.com/api/?name=${currentMatch?.otherUser.displayName}`}
                    alt={currentMatch?.otherUser.displayName}
                    className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl object-cover border border-neutral-100"
                    referrerPolicy="no-referrer"
                  />
                  <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 border-2 border-white rounded-full ${currentMatch?.otherUser.isOnline ? 'bg-emerald-500' : 'bg-neutral-300'}`} />
                </div>
                <div className="min-w-0">
                  <h3 className="font-serif font-bold text-base text-neutral-900 truncate leading-none">{currentMatch?.otherUser.displayName}</h3>
                  <div className="flex items-center space-x-1.5 mt-1.5">
                    <span className={`w-1.5 h-1.5 rounded-full ${currentMatch?.otherUser.isOnline ? 'bg-emerald-500' : 'bg-neutral-300'}`} />
                    <span className="text-[9px] font-black text-neutral-400 uppercase tracking-widest leading-none">
                      {currentMatch?.otherUser.isOnline ? 'Online now' : 'Offline'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Utility actions dock */}
              <div className="flex items-center space-x-1.5">
                <button
                  onClick={() => setShowBooking(true)}
                  className="w-9 h-9 flex items-center justify-center text-neutral-400 hover:bg-neutral-900 hover:text-white rounded-xl transition-all cursor-pointer"
                  title="Schedule Session"
                >
                  <Calendar size={16} />
                </button>
                <button 
                  onClick={() => {
                    if (currentMatch) {
                      toast.info(`Sharing: ${currentMatch.otherUser.skillsOffered.join(', ')}`);
                    }
                  }}
                  className="w-9 h-9 flex items-center justify-center text-neutral-400 hover:bg-neutral-50 rounded-xl transition-all cursor-pointer"
                  title="Details Panel"
                >
                  <Info size={16} />
                </button>
              </div>
            </div>

            {/* Accept Request Banner */}
            {currentMatch?.status === 'pending' && currentMatch.requesterId !== auth.currentUser?.uid && (
              <motion.div 
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                className="bg-neutral-950 text-white px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-neutral-950"
              >
                <div className="flex items-center space-x-3">
                  <Sparkles size={16} className="text-amber-400 shrink-0" />
                  <p className="text-xs font-bold leading-tight">
                    {currentMatch.otherUser.displayName} wants to swap with you!
                    <span className="block text-neutral-400 font-semibold text-[10px] mt-0.5">Accept to swap credentials and schedule times.</span>
                  </p>
                </div>
                <div className="flex space-x-2 shrink-0">
                  <button
                    onClick={() => acceptMatch(currentMatch.id)}
                    className="bg-white text-neutral-950 px-5 py-2 rounded-lg text-[10px] font-black tracking-wider hover:bg-neutral-100 transition-all cursor-pointer"
                  >
                    ACCEPT
                  </button>
                </div>
              </motion.div>
            )}

            {/* Message Stream Scroll */}
            <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-6 bg-neutral-50/30 no-scrollbar">
              {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 text-center space-y-3">
                  <div className="w-14 h-14 bg-white rounded-2xl border border-neutral-100 shadow-sm flex items-center justify-center text-neutral-300">
                    <MessageSquare size={18} />
                  </div>
                  <p className="text-xs text-neutral-400 font-bold uppercase tracking-widest">Connect and start swap chats...</p>
                </div>
              )}

              {messages.map((msg, i) => {
                const isMe = msg.senderId === auth.currentUser?.uid;
                const showAvatar = i === 0 || messages[i-1].senderId !== msg.senderId;
                
                return (
                  <div
                    key={msg.id}
                    className={`flex items-end space-x-2.5 ${isMe ? 'justify-end' : 'justify-start'}`}
                  >
                    {!isMe && (
                      <div className="w-7 h-7 shrink-0">
                        {showAvatar && (
                          <img
                            src={currentMatch?.otherUser.photoURL || `https://ui-avatars.com/api/?name=${currentMatch?.otherUser.displayName}`}
                            alt={currentMatch?.otherUser.displayName}
                            className="w-7 h-7 rounded-lg object-cover border border-neutral-100"
                            referrerPolicy="no-referrer"
                          />
                        )}
                      </div>
                    )}
                    <div
                      className={`max-w-[80%] sm:max-w-[70%] px-4 py-3 rounded-2xl text-xs font-semibold shadow-[0_2px_8px_rgba(0,0,0,0.015)] space-y-1.5 ${
                        isMe
                          ? 'bg-neutral-900 text-white rounded-br-none'
                          : 'bg-white text-neutral-900 border border-neutral-150 rounded-bl-none'
                      }`}
                    >
                      {msg.fileUrl && (
                        <div className="mb-2">
                          {msg.fileType?.startsWith('image/') ? (
                            <img 
                              src={msg.fileUrl} 
                              alt={msg.fileName} 
                              className="rounded-xl max-h-52 w-full object-cover cursor-pointer hover:opacity-90 transition-opacity border border-neutral-200/10"
                              onClick={() => window.open(msg.fileUrl, '_blank')}
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <div className={`flex items-center space-x-3 p-3 rounded-xl border ${
                              isMe ? 'bg-white/10 border-white/20 text-white' : 'bg-neutral-50 border-neutral-200/50 text-neutral-900'
                            }`}>
                              <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                                isMe ? 'bg-white/20' : 'bg-white shadow-sm'
                              }`}>
                                <FileIcon size={16} className={isMe ? 'text-white' : 'text-neutral-400'} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-[10px] font-black uppercase tracking-wider truncate">{msg.fileName}</p>
                                <p className={`text-[9px] font-bold uppercase ${isMe ? 'text-white/40' : 'text-neutral-400'}`}>
                                  {msg.fileType?.split('/')[1]?.toUpperCase() || 'FILE'}
                                </p>
                              </div>
                              <a 
                                href={msg.fileUrl} 
                                download={msg.fileName}
                                className={`p-1.5 rounded-lg transition-all ${
                                  isMe ? 'hover:bg-white/25 text-white' : 'hover:bg-neutral-200 text-neutral-500'
                                }`}
                              >
                                <Download size={13} />
                              </a>
                            </div>
                          )}
                        </div>
                      )}
                      
                      <p className="leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                      
                      <div className={`flex items-center space-x-1 opacity-45 text-[9px] font-bold ${isMe ? 'justify-end text-neutral-300' : 'justify-start text-neutral-400'}`}>
                        <Clock size={9} />
                        <span>
                          {msg.createdAt?.toDate ? msg.createdAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Pending'}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}

              {isOtherUserTyping && (
                <div className="flex items-center space-x-2.5 text-neutral-400">
                  <div className="w-7 h-7 shrink-0">
                    <img
                      src={currentMatch?.otherUser.photoURL || `https://ui-avatars.com/api/?name=${currentMatch?.otherUser.displayName}`}
                      alt={currentMatch?.otherUser.displayName}
                      className="w-7 h-7 rounded-lg object-cover border border-neutral-100"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  <div className="bg-white border border-neutral-200/50 px-3 py-2 rounded-xl rounded-bl-none flex items-center space-x-1.5">
                    <span className="w-1 h-1 bg-neutral-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1 h-1 bg-neutral-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1 h-1 bg-neutral-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Scheduled Swap Sessions Strip */}
            {sessions.length > 0 && (
              <div className="px-6 py-3.5 bg-white border-t border-neutral-100 flex items-center space-x-4 overflow-x-auto no-scrollbar">
                <span className="text-[9px] font-black text-neutral-400 uppercase tracking-widest whitespace-nowrap">Sessions</span>
                {sessions.map(session => {
                  const isCompleted = session.status === 'completed';
                  const hasRated = session.ratedBy?.includes(auth.currentUser?.uid || '');
                  
                  return (
                    <div 
                      key={session.id} 
                      onClick={() => setShowSessionDetails(session)}
                      className={`flex items-center space-x-3 px-3.5 py-1.5 rounded-xl border transition-all whitespace-nowrap group cursor-pointer ${
                        isCompleted 
                          ? 'bg-emerald-500/[0.03] border-emerald-500/20 text-emerald-700' 
                          : 'bg-neutral-50/50 border-neutral-200/40 hover:bg-neutral-900 hover:text-white'
                      }`}
                    >
                      {isCompleted ? <CheckCircle2 size={13} className="text-emerald-600" /> : <Calendar size={13} className="text-neutral-400 group-hover:text-white/60" />}
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold leading-none">{session.title}</span>
                        <span className={`text-[8px] font-bold mt-1 uppercase tracking-tight ${isCompleted ? 'text-emerald-600/50' : 'text-neutral-400 group-hover:text-white/45'}`}>
                          {new Date(session.startTime.toDate()).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </span>
                      </div>
                      
                      {!isCompleted && (
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            completeSession(session.id);
                          }}
                          className="ml-1.5 p-1 hover:bg-neutral-200 rounded-lg transition-all text-neutral-400 hover:text-neutral-900 group-hover:hover:bg-white/20 group-hover:hover:text-white"
                          title="Complete Swap"
                        >
                          <CheckCircle2 size={13} />
                        </button>
                      )}
                      
                      {isCompleted && !hasRated && (
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowReview(session);
                          }}
                          className="ml-1.5 px-2 py-0.5 bg-neutral-900 text-white text-[8px] font-black rounded-md hover:bg-neutral-800 transition-all flex items-center space-x-1 cursor-pointer"
                        >
                          <Star size={9} className="fill-white" />
                          <span>RATE</span>
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Inputs & Quick Replies controller */}
            <form onSubmit={sendMessage} className="p-4 sm:p-6 bg-white border-t border-neutral-100">
              {/* Horizontal Bento Chips for Quick Replies */}
              <div className="flex items-center space-x-2 overflow-x-auto no-scrollbar mb-3 sm:mb-4">
                {quickReplies.map((reply) => (
                  <button
                    key={reply}
                    type="button"
                    onClick={() => setNewMessage(reply)}
                    className="shrink-0 px-3.5 py-1.5 bg-neutral-50 hover:bg-neutral-100 rounded-full text-[10px] sm:text-xs font-bold text-neutral-600 transition-all border border-neutral-200/40 cursor-pointer"
                  >
                    {reply}
                  </button>
                ))}
              </div>

              <div className="flex items-center space-x-2 bg-neutral-50 rounded-[24px] sm:rounded-[28px] p-1.5 border border-neutral-200 focus-within:border-neutral-900 focus-within:bg-white transition-all">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center text-neutral-400 hover:bg-neutral-900 hover:text-white rounded-xl transition-all disabled:opacity-20 shrink-0 cursor-pointer"
                >
                  {isUploading ? (
                    <div className="w-4 h-4 border-2 border-neutral-400 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Paperclip size={16} />
                  )}
                </button>
                <input
                  type="text"
                  value={newMessage}
                  onChange={handleTyping}
                  placeholder={`Write message to ${currentMatch?.otherUser.displayName.split(' ')[0]}...`}
                  className="flex-1 bg-transparent border-none focus:outline-none px-2 py-2 text-xs font-semibold"
                />
                <button
                  type="submit"
                  disabled={!newMessage.trim()}
                  className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center bg-neutral-950 text-white rounded-xl hover:bg-neutral-800 transition-all disabled:opacity-20 disabled:cursor-not-allowed shrink-0 cursor-pointer shadow-sm"
                >
                  <Send size={15} />
                </button>
              </div>
            </form>
          </div>
        )}
      </div>

      {/* Booking and Review Modal overlays */}
      <AnimatePresence>
        {showBooking && matchId && currentMatch && (
          <Booking 
            key="booking-modal"
            matchId={matchId} 
            otherUserId={currentMatch.otherUser.uid}
            onClose={() => setShowBooking(false)} 
          />
        )}
        {showReview && currentMatch && (
          <ReviewModal 
            key="review-modal"
            session={showReview} 
            otherUser={currentMatch.otherUser} 
            onClose={() => setShowReview(null)} 
          />
        )}
        {showSessionDetails && (
          <SessionDetailsModal
            key="session-details-modal"
            session={showSessionDetails}
            onClose={() => setShowSessionDetails(null)}
            onComplete={completeSession}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}
