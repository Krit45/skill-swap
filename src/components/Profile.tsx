import { useState, useEffect } from 'react';
import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { UserProfile, UserPrivate } from '../types';
import { motion } from 'motion/react';
import { Save, Plus, X, Mail, BookOpen, Award, Camera, Star, Bell, CheckCircle2, Trophy, ShieldAlert, Sparkles, MapPin, Compass } from 'lucide-react';
import { toast } from 'sonner';

interface ProfileProps {
  profile: (UserProfile & UserPrivate) | null;
}

interface ProfileFormData extends Partial<UserProfile & UserPrivate> {
}

export default function Profile({ profile }: ProfileProps) {
  const [editing, setEditing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<ProfileFormData>({
    displayName: '',
    email: '',
    photoURL: '',
    bio: '',
    skillsOffered: [],
    skillsWanted: [],
    experience: '',
    location: '',
    communicationStyle: 'Remote',
    notificationPreferences: {
      matchAlerts: true,
      messageNotifications: true,
      sessionReminders: true,
    },
  });
  const [newSkillOffered, setNewSkillOffered] = useState('');
  const [newSkillWanted, setNewSkillWanted] = useState('');

  useEffect(() => {
    if (profile) {
      if (!editing) {
        setFormData(profile as ProfileFormData);
      }
    } else {
      if (!editing && !saving) {
        setEditing(true);
        setFormData({
          displayName: auth.currentUser?.displayName || '',
          email: auth.currentUser?.email || '',
          photoURL: auth.currentUser?.photoURL || '',
          bio: '',
          skillsOffered: [],
          skillsWanted: [],
          experience: '',
          location: '',
          communicationStyle: 'Remote',
          notificationPreferences: {
            matchAlerts: true,
            messageNotifications: true,
            sessionReminders: true,
          },
        });
      }
    }
  }, [profile, editing, saving]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 512000) {
      toast.error("Image is too large. Please select an image under 500KB.");
      return;
    }

    setUploading(true);
    const reader = new FileReader();
    reader.onloadend = () => {
      setFormData(prev => ({ ...prev, photoURL: reader.result as string }));
      setUploading(false);
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    if (!auth.currentUser || uploading) return;
    setSaving(true);

    if (!formData.displayName?.trim()) {
      toast.error("Please enter your name.");
      setSaving(false);
      return;
    }

    if (!formData.email?.trim()) {
      toast.error("Email is required.");
      setSaving(false);
      return;
    }

    const publicData: any = {
      uid: auth.currentUser.uid,
      displayName: formData.displayName,
      photoURL: formData.photoURL,
      bio: formData.bio,
      skillsOffered: formData.skillsOffered,
      skillsWanted: formData.skillsWanted,
      experience: formData.experience,
      location: formData.location,
      communicationStyle: formData.communicationStyle,
      updatedAt: serverTimestamp(),
    };

    if (!profile?.createdAt) {
      publicData.createdAt = serverTimestamp();
    }

    const privateData = {
      email: formData.email,
      notificationPreferences: formData.notificationPreferences || {
        matchAlerts: true,
        messageNotifications: true,
        sessionReminders: true,
      },
    };

    try {
      await setDoc(doc(db, 'users', auth.currentUser.uid), publicData, { merge: true });
      await setDoc(doc(db, 'users_private', auth.currentUser.uid), privateData, { merge: true });
      setEditing(false);
      toast.success("Profile updated successfully!");
    } catch (error: any) {
      console.error("Profile save error:", error);
      let errorMessage = "Failed to save profile. Please try again.";
      if (error.code === 'permission-denied') {
        errorMessage = "Permission denied. Please check your connection.";
      } else if (error.message?.includes('too large') || formData.photoURL?.length! > 1000000) {
        errorMessage = "Profile picture is too large. Please use a smaller image.";
      }
      toast.error(errorMessage);
      handleFirestoreError(error, OperationType.WRITE, `users/${auth.currentUser.uid}`);
    } finally {
      setSaving(false);
    }
  };

  const addSkill = (type: 'offered' | 'wanted') => {
    const skill = type === 'offered' ? newSkillOffered : newSkillWanted;
    if (!skill.trim()) return;

    const key = type === 'offered' ? 'skillsOffered' : 'skillsWanted';
    setFormData(prev => ({
      ...prev,
      [key]: [...(prev[key] || []), skill.trim()]
    }));

    if (type === 'offered') setNewSkillOffered('');
    else setNewSkillWanted('');
  };

  const toggleNotification = async (key: keyof NonNullable<ProfileFormData['notificationPreferences']>) => {
    if (!auth.currentUser) return;

    const currentPrefs = formData.notificationPreferences || {
      matchAlerts: true,
      messageNotifications: true,
      sessionReminders: true,
    };

    const newPrefs = {
      ...currentPrefs,
      [key]: !currentPrefs[key]
    };

    setFormData(prev => ({
      ...prev,
      notificationPreferences: newPrefs
    }));

    if (!editing) {
      try {
        await setDoc(doc(db, 'users_private', auth.currentUser.uid), {
          email: formData.email,
          notificationPreferences: newPrefs
        }, { merge: true });
      } catch (error: any) {
        console.error("Failed to update notification preferences:", error);
        handleFirestoreError(error, OperationType.WRITE, `users_private/${auth.currentUser.uid}`);
      }
    }
  };

  const removeSkill = (type: 'offered' | 'wanted', index: number) => {
    const key = type === 'offered' ? 'skillsOffered' : 'skillsWanted';
    setFormData(prev => ({
      ...prev,
      [key]: (prev[key] || []).filter((_, i) => i !== index)
    }));
  };

  const calculateCompleteness = () => {
    const fields = [
      { name: 'Display Name', value: formData.displayName, weight: 10 },
      { name: 'Profile Photo', value: formData.photoURL, weight: 15 },
      { name: 'Bio', value: formData.bio && formData.bio.length > 20, weight: 20 },
      { name: 'Skills Offered', value: formData.skillsOffered && formData.skillsOffered.length > 0, weight: 15 },
      { name: 'Skills Wanted', value: formData.skillsWanted && formData.skillsWanted.length > 0, weight: 15 },
      { name: 'Experience', value: formData.experience && formData.experience.length > 10, weight: 10 },
      { name: 'Location', value: formData.location, weight: 10 },
      { name: 'Communication Style', value: formData.communicationStyle, weight: 5 },
    ];

    const totalWeight = fields.reduce((acc, f) => acc + f.weight, 0);
    const completedWeight = fields.reduce((acc, f) => acc + (f.value ? f.weight : 0), 0);
    const percentage = Math.round((completedWeight / totalWeight) * 100);

    const suggestions = fields
      .filter(f => !f.value)
      .map(f => {
        if (f.name === 'Bio') return 'Write a detailed bio (at least 20 characters)';
        if (f.name === 'Experience') return 'Add more details about your experience';
        if (f.name === 'Skills Offered') return 'List at least one skill you can teach';
        if (f.name === 'Skills Wanted') return 'List at least one skill you want to learn';
        return `Add your ${f.name.toLowerCase()}`;
      });

    return { percentage, suggestions };
  };

  const { percentage, suggestions } = calculateCompleteness();

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      transition={{ duration: 0.3 }}
      className="max-w-5xl mx-auto space-y-12 pb-16 px-4"
    >
      {/* Profile Container Board */}
      <motion.div
        className="bg-white rounded-[40px] shadow-sm border border-neutral-200/60 overflow-hidden"
      >
        {/* Abstract Minimal Header Banner */}
        <div className="h-44 bg-neutral-100 border-b border-neutral-200/50 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-tr from-neutral-200/20 via-transparent to-transparent" />
          <div className="absolute top-6 left-8 bg-white/80 backdrop-blur-md px-3 py-1 rounded-full border border-neutral-200/20 text-[9px] font-black uppercase tracking-widest text-neutral-500">
            Profile Settings
          </div>
        </div>

        <div className="px-6 sm:px-12 pb-12">
          {/* Avatar and Main CTAs Dock */}
          <div className="relative -mt-16 sm:-mt-20 mb-8 flex items-end justify-between flex-wrap gap-6">
            <div className="relative group shrink-0">
              <img
                src={formData.photoURL || `https://ui-avatars.com/api/?name=${formData.displayName}`}
                alt={formData.displayName}
                className="w-28 h-28 sm:w-36 sm:h-36 rounded-3xl border-4 border-white shadow-md bg-white object-cover"
                referrerPolicy="no-referrer"
              />
              {editing && (
                <label className="absolute inset-0 flex items-center justify-center bg-neutral-950/40 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 cursor-pointer">
                  {uploading ? (
                    <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Camera className="text-white" size={22} />
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </label>
              )}
            </div>

            {editing ? (
              <button
                onClick={handleSave}
                disabled={uploading || saving}
                className="flex items-center space-x-2 bg-neutral-900 text-white px-7 py-3 rounded-full font-bold hover:bg-neutral-800 transition-all disabled:opacity-50 text-xs shadow-sm cursor-pointer"
              >
                {saving ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Save size={14} />
                )}
                <span>{saving ? 'Saving Changes...' : 'Save Profile'}</span>
              </button>
            ) : (
              <button
                onClick={() => setEditing(true)}
                className="flex items-center space-x-2 bg-white border border-neutral-200 text-neutral-800 px-7 py-3 rounded-full font-bold hover:bg-neutral-50 hover:border-neutral-300 transition-all text-xs shadow-sm cursor-pointer"
              >
                <span>Edit Profile Settings</span>
              </button>
            )}
          </div>

          {/* Profile Completeness Ring/Indicator */}
          {percentage < 100 && (
            <div className="mb-10 bg-neutral-50/50 border border-neutral-200/60 p-6 rounded-3xl">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-2.5">
                  <span className="w-8 h-8 bg-neutral-950 text-white rounded-lg flex items-center justify-center text-[10px] font-black italic">
                    {percentage}%
                  </span>
                  <h3 className="font-bold text-[10px] text-neutral-800 uppercase tracking-widest">Completeness Index</h3>
                </div>
                {!editing && (
                  <button 
                    onClick={() => setEditing(true)}
                    className="text-[10px] font-bold uppercase tracking-widest text-neutral-400 hover:text-neutral-900 transition-colors"
                  >
                    Improve Profile
                  </button>
                )}
              </div>
              <div className="w-full bg-neutral-200/60 h-1.5 rounded-full overflow-hidden mb-4">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${percentage}%` }}
                  transition={{ duration: 1, ease: "easeOut" }}
                  className="h-full bg-neutral-950 rounded-full"
                />
              </div>
              {suggestions.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[9px] font-bold uppercase tracking-widest text-neutral-400">Recommended Steps:</p>
                  <div className="flex flex-wrap gap-2">
                    {suggestions.slice(0, 2).map((tip, i) => (
                      <div key={`tip-${i}`} className="flex items-center space-x-1.5 bg-white border border-neutral-200/50 px-3 py-1 rounded-lg">
                        <CheckCircle2 size={11} className="text-neutral-300" />
                        <span className="text-[10px] font-bold text-neutral-600">{tip}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 3-Column Split Form Area */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-10 items-stretch">
            
            {/* Left/Middle Part: Main Information Form */}
            <div className="md:col-span-8 space-y-8">
              <div className="space-y-3">
                {editing ? (
                  <input
                    type="text"
                    value={formData.displayName}
                    onChange={e => setFormData({ ...formData, displayName: e.target.value })}
                    className="text-3xl font-serif font-bold tracking-tight w-full border-b border-neutral-200 focus:outline-none focus:border-neutral-900 pb-1.5"
                    placeholder="Your Full Name"
                  />
                ) : (
                  <h1 className="text-3xl sm:text-4xl font-serif font-bold text-neutral-900 tracking-tight">{formData.displayName}</h1>
                )}
                <div className="flex flex-wrap items-center text-neutral-500 gap-4 text-xs font-semibold">
                  <div className="flex items-center space-x-1">
                    <Mail size={13} className="text-neutral-400" />
                    <span>{formData.email}</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <Star size={13} className="fill-amber-400 text-amber-400" />
                    <span className="text-neutral-800 font-extrabold">{profile?.rating ? profile.rating.toFixed(1) : '5.0'}</span>
                    <span className="text-neutral-400">({profile?.reviewCount || 0} reviews)</span>
                  </div>
                </div>
              </div>

              {/* Gamification Stats */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-neutral-50/50 border border-neutral-200/50 p-5 rounded-2xl flex items-center space-x-4">
                  <div className="w-10 h-10 bg-neutral-900 text-white rounded-xl flex items-center justify-center text-sm">
                    ⚡
                  </div>
                  <div>
                    <span className="text-[8px] text-neutral-400 font-black uppercase tracking-widest block leading-none">Level {profile?.level || 1}</span>
                    <p className="text-base font-serif font-black text-neutral-900 mt-1">{profile?.points || 0} XP Total</p>
                  </div>
                </div>
                <div className="bg-amber-500/[0.03] border border-amber-500/20 p-5 rounded-2xl flex items-center space-x-4">
                  <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center text-sm">
                    🏆
                  </div>
                  <div>
                    <span className="text-[8px] text-amber-800 font-black uppercase tracking-widest block leading-none">Unlocked Trophies</span>
                    <p className="text-base font-serif font-black text-amber-900 mt-1">{profile?.badges?.length || 0} Badges</p>
                  </div>
                </div>
              </div>

              {/* Badges Trophy Room Showcase */}
              {profile?.badges && profile.badges.length > 0 && (
                <div className="space-y-4 pt-1">
                  <h3 className="text-[9px] font-black uppercase tracking-widest text-neutral-400 flex items-center">
                    <Trophy size={13} className="mr-1.5 text-indigo-500 animate-pulse" /> Showcase Trophy Room
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {profile.badges.map(badge => (
                      <motion.div
                        key={badge.id}
                        whileHover={{ y: -4, boxShadow: "0 8px 20px rgba(0,0,0,0.02)" }}
                        className="bg-white border border-neutral-200/50 p-4 rounded-2xl text-center shadow-sm"
                      >
                        <div className="text-2xl mb-1.5">{badge.icon}</div>
                        <p className="text-[11px] font-bold text-neutral-900">{badge.name}</p>
                        <p className="text-[9px] text-neutral-400 mt-1 leading-relaxed font-semibold">{badge.description}</p>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}

              {/* Geographic and Communication options */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <h3 className="text-[9px] font-black uppercase tracking-widest text-neutral-400">Current Location</h3>
                  {editing ? (
                    <div className="relative">
                      <input
                        type="text"
                        value={formData.location}
                        onChange={e => setFormData({ ...formData, location: e.target.value })}
                        className="w-full p-3.5 bg-neutral-50/50 rounded-xl border border-neutral-200 focus:outline-none focus:border-neutral-900 text-xs font-bold"
                        placeholder="e.g. San Francisco, CA"
                      />
                    </div>
                  ) : (
                    <p className="text-xs font-bold text-neutral-700 flex items-center gap-1">
                      <MapPin size={12} className="text-neutral-400" />
                      <span>{formData.location || "Earth (Remote)"}</span>
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <h3 className="text-[9px] font-black uppercase tracking-widest text-neutral-400">Exchange Style</h3>
                  {editing ? (
                    <select
                      value={formData.communicationStyle}
                      onChange={e => setFormData({ ...formData, communicationStyle: e.target.value as any })}
                      className="w-full p-3.5 bg-neutral-50/50 rounded-xl border border-neutral-200 focus:outline-none focus:border-neutral-900 text-xs font-bold"
                    >
                      <option value="Remote">Remote</option>
                      <option value="In-person">In-person</option>
                      <option value="Hybrid">Hybrid</option>
                    </select>
                  ) : (
                    <p className="text-xs font-bold text-neutral-700 flex items-center gap-1">
                      <Compass size={12} className="text-neutral-400" />
                      <span>{formData.communicationStyle || "Remote"} Mode</span>
                    </p>
                  )}
                </div>
              </div>

              {/* Personal Bio */}
              <div className="space-y-2">
                <h3 className="text-[9px] font-black uppercase tracking-widest text-neutral-400">Bio & Exchanger Philosophy</h3>
                {editing ? (
                  <textarea
                    value={formData.bio}
                    onChange={e => setFormData({ ...formData, bio: e.target.value })}
                    className="w-full p-4 bg-neutral-50/50 rounded-xl border border-neutral-200 focus:outline-none focus:border-neutral-900 min-h-[120px] text-xs font-semibold leading-relaxed"
                    placeholder="Tell our matchmaking AI details about your interests..."
                  />
                ) : (
                  <p className="text-xs text-neutral-600 leading-relaxed font-semibold italic pl-4 border-l-2 border-neutral-200">
                    "{formData.bio || "This exchanger has not compiled an introduction bio yet."}"
                  </p>
                )}
              </div>

              {/* Work/School Experience */}
              <div className="space-y-2">
                <h3 className="text-[9px] font-black uppercase tracking-widest text-neutral-400">Experience & Credentials</h3>
                {editing ? (
                  <textarea
                    value={formData.experience}
                    onChange={e => setFormData({ ...formData, experience: e.target.value })}
                    className="w-full p-4 bg-neutral-50/50 rounded-xl border border-neutral-200 focus:outline-none focus:border-neutral-900 min-h-[100px] text-xs font-semibold leading-relaxed"
                    placeholder="Describe your credentials, work background or courses..."
                  />
                ) : (
                  <p className="text-xs text-neutral-600 leading-relaxed font-semibold">
                    {formData.experience || "No background experience compiled yet."}
                  </p>
                )}
              </div>

              {/* Notification Toggles Panel */}
              <div className="pt-6 border-t border-neutral-100 space-y-4">
                <div className="flex items-center space-x-2">
                  <Bell className="text-neutral-900" size={16} />
                  <h3 className="text-sm font-serif font-bold text-neutral-900">Communication Alerts</h3>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-4 bg-neutral-50/50 rounded-2xl border border-neutral-200/50">
                    <div className="pr-4">
                      <p className="text-xs font-bold text-neutral-800">Match Requests</p>
                      <p className="text-[9px] text-neutral-400 font-bold mt-0.5">Notify when people initiate knowledge trades.</p>
                    </div>
                    <button
                      onClick={() => toggleNotification('matchAlerts')}
                      className={`w-10 h-5.5 rounded-full transition-all relative flex items-center flex-shrink-0 cursor-pointer ${formData.notificationPreferences?.matchAlerts ? 'bg-neutral-900' : 'bg-neutral-200'}`}
                    >
                      <div className={`w-4 h-4 bg-white rounded-full transition-all shadow-sm ${formData.notificationPreferences?.matchAlerts ? 'translate-x-5' : 'translate-x-1'}`} />
                    </button>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-neutral-50/50 rounded-2xl border border-neutral-200/50">
                    <div className="pr-4">
                      <p className="text-xs font-bold text-neutral-800">Chat & Messages</p>
                      <p className="text-[9px] text-neutral-400 font-bold mt-0.5">Notify when active partners send message streams.</p>
                    </div>
                    <button
                      onClick={() => toggleNotification('messageNotifications')}
                      className={`w-10 h-5.5 rounded-full transition-all relative flex items-center flex-shrink-0 cursor-pointer ${formData.notificationPreferences?.messageNotifications ? 'bg-neutral-900' : 'bg-neutral-200'}`}
                    >
                      <div className={`w-4 h-4 bg-white rounded-full transition-all shadow-sm ${formData.notificationPreferences?.messageNotifications ? 'translate-x-5' : 'translate-x-1'}`} />
                    </button>
                  </div>
                </div>
              </div>

            </div>

            {/* Right Part: Skills Tags Side board (Offered & Wanted) */}
            <div className="md:col-span-4 space-y-6">
              
              {/* Skills Offered Card */}
              <div className="bg-white border border-neutral-200/60 p-5 rounded-3xl space-y-4 shadow-sm">
                <div className="flex items-center space-x-2">
                  <Award className="text-neutral-900" size={15} />
                  <h3 className="text-[9px] font-black text-neutral-800 uppercase tracking-widest">Skills Offered</h3>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {formData.skillsOffered?.map((skill, i) => (
                    <span
                      key={`${skill}-${i}`}
                      className="bg-neutral-900 text-white px-2.5 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1.5"
                    >
                      <span>{skill}</span>
                      {editing && (
                        <button onClick={() => removeSkill('offered', i)} className="hover:text-rose-400 ml-0.5 cursor-pointer">
                          <X size={10} />
                        </button>
                      )}
                    </span>
                  ))}
                  {(!formData.skillsOffered || formData.skillsOffered.length === 0) && (
                    <span className="text-xs text-neutral-400 italic">No offer tags listed.</span>
                  )}
                </div>
                {editing && (
                  <div className="flex gap-1.5 pt-2">
                    <input
                      type="text"
                      value={newSkillOffered}
                      onChange={e => setNewSkillOffered(e.target.value)}
                      onKeyPress={e => e.key === 'Enter' && addSkill('offered')}
                      className="flex-1 bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-1.5 text-xs font-semibold focus:outline-none focus:border-neutral-400"
                      placeholder="Add offer tag..."
                    />
                    <button
                      onClick={() => addSkill('offered')}
                      className="p-2 bg-neutral-900 hover:bg-neutral-800 text-white rounded-lg transition-colors cursor-pointer"
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                )}
              </div>

              {/* Skills Wanted Card */}
              <div className="bg-white border border-neutral-200/60 p-5 rounded-3xl space-y-4 shadow-sm">
                <div className="flex items-center space-x-2">
                  <BookOpen className="text-neutral-900" size={15} />
                  <h3 className="text-[9px] font-black text-neutral-800 uppercase tracking-widest">Skills Wanted</h3>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {formData.skillsWanted?.map((skill, i) => (
                    <span
                      key={`${skill}-${i}`}
                      className="bg-neutral-50 text-neutral-800 border border-neutral-200 px-2.5 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1.5"
                    >
                      <span>{skill}</span>
                      {editing && (
                        <button onClick={() => removeSkill('wanted', i)} className="hover:text-rose-500 ml-0.5 cursor-pointer">
                          <X size={10} />
                        </button>
                      )}
                    </span>
                  ))}
                  {(!formData.skillsWanted || formData.skillsWanted.length === 0) && (
                    <span className="text-xs text-neutral-400 italic">No requested tags listed.</span>
                  )}
                </div>
                {editing && (
                  <div className="flex gap-1.5 pt-2">
                    <input
                      type="text"
                      value={newSkillWanted}
                      onChange={e => setNewSkillWanted(e.target.value)}
                      onKeyPress={e => e.key === 'Enter' && addSkill('wanted')}
                      className="flex-1 bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-1.5 text-xs font-semibold focus:outline-none focus:border-neutral-400"
                      placeholder="Add request tag..."
                    />
                    <button
                      onClick={() => addSkill('wanted')}
                      className="p-2 bg-neutral-900 hover:bg-neutral-800 text-white rounded-lg transition-colors cursor-pointer"
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                )}
              </div>

            </div>

          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
