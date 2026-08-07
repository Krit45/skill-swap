export interface NotificationPreferences {
  matchAlerts: boolean;
  messageNotifications: boolean;
  sessionReminders: boolean;
}

export interface Badge {
  id: string;
  name: string;
  icon: string;
  description: string;
  unlockedAt: any;
}

export interface UserProfile {
  uid: string;
  displayName: string;
  photoURL?: string;
  bio?: string;
  skillsOffered: string[];
  skillsWanted: string[];
  experience?: string;
  rating?: number;
  reviewCount?: number;
  matchCount?: number;
  sessionCount?: number;
  location?: string;
  communicationStyle?: 'In-person' | 'Remote' | 'Hybrid';
  points?: number;
  level?: number;
  badges?: Badge[];
  isOnline?: boolean;
  lastLoginAt?: any;
  createdAt: any;
  updatedAt?: any;
}

export interface UserPrivate {
  email: string;
  notificationPreferences?: NotificationPreferences;
}

export interface Match {
  id: string;
  users: string[];
  status: 'pending' | 'accepted' | 'rejected';
  requesterId: string;
  createdAt: any;
  updatedAt: any;
}

export interface Message {
  id: string;
  matchId: string;
  senderId: string;
  text: string;
  fileUrl?: string;
  fileName?: string;
  fileType?: string;
  createdAt: any;
}

export interface Session {
  id: string;
  matchId: string;
  title: string;
  startTime: any;
  endTime: any;
  status: 'scheduled' | 'completed' | 'cancelled';
  ratedBy?: string[]; // Array of UIDs who have rated this session
  createdAt: any;
}

export interface Review {
  id: string;
  matchId: string;
  sessionId: string;
  reviewerId: string;
  revieweeId: string;
  rating: number;
  comment: string;
  createdAt: any;
}
