import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { onAuthStateChanged, type User, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { doc, setDoc, onSnapshot, serverTimestamp, updateDoc, increment } from 'firebase/firestore';
import { auth, db, toolDb, resourcesDb } from '../lib/firebase';

interface UserProfile {
  uid: string;
  email: string | null;
  username?: string;
  displayName: string | null;
  photoURL: string | null;
  role: 'su' | 'admin' | 'member';
  credits?: number;
  audienceMode?: 'casual' | 'professional';
  subscription?: 'free' | 'pro' | 'standard' | {
    bundleId: string;
    activeSuites: string[];
    status: string;
  };
  dailyRemaining?: number;
  
  // Suite Entitlements (Shared across ecosystem)
  subscriptionMetadata?: {
    bundleId: string;
    activeSuites: string[];
    status: 'active' | 'past_due' | 'canceled' | 'incomplete';
    expiresAt?: any;
  };
  suiteSubscription?: {
    bundleId: string;
    activeSuites: string[];
    status: 'active' | 'past_due' | 'canceled' | 'incomplete';
  };

  // Conflict Metadata
  isSynced?: boolean;
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  topUpCredits: (amount?: number) => Promise<void>;
  syncWithMaster: () => Promise<void>;
  hasConflict: boolean;
  conflicts: string[];
  masterData: any;
  updateProfile: (data: Partial<UserProfile>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({ 
  user: null, 
  profile: null, 
  loading: true,
  login: async () => {},
  logout: async () => {},
  topUpCredits: async () => {},
  syncWithMaster: async () => {},
  hasConflict: false,
  conflicts: [],
  masterData: null,
  updateProfile: async () => {}
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasConflict, setHasConflict] = useState(false);
  const [conflicts, setConflicts] = useState<string[]>([]);
  const [masterData, setMasterData] = useState<any>(null);

  // 1. Memoized Actions (Declared before usage in Effects)
  const syncWithMaster = useCallback(async () => {
    if (!user || !masterData) return;
    const userRef = doc(db, 'users', user.uid);
    await updateDoc(userRef, {
        role: masterData.role || 'member',
        displayName: masterData.displayName || profile?.displayName,
        updatedAt: serverTimestamp(),
        isSynced: true
    });
    setHasConflict(false);
    setConflicts([]);
  }, [user, masterData, profile?.displayName]);

  const login = useCallback(async () => {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  }, []);

  const logout = useCallback(async () => {
    await signOut(auth);
  }, []);

  const topUpCredits = useCallback(async (amount: number = 250) => {
    if (!user) return;
    try {
        const creditsRef = doc(toolDb, 'users', user.uid, 'data', 'credits');
        await updateDoc(creditsRef, {
            balance: increment(amount)
        });
    } catch (err: any) {
        console.error("Top-up failed", err);
    }
  }, [user]);

  const updateProfile = useCallback(async (data: Partial<UserProfile>) => {
    if (!user) return;
    try {
        const localRef = doc(db, 'users', user.uid);
        const masterRef = doc(toolDb, 'users', user.uid);
        
        const updates = {
            ...data,
            updatedAt: serverTimestamp()
        };

        await Promise.all([
            updateDoc(localRef, updates),
            updateDoc(masterRef, updates)
        ]);
        console.log('[AuthContext] Profile synchronized across ecosystem');
    } catch (err) {
        console.error("Profile update failed", err);
        throw err;
    }
  }, [user]);

  // 2. Conflict Detection Engine
  useEffect(() => {
    if (!profile || !masterData || !user) return;

    const newConflicts: string[] = [];
    let autoHealPossible = true;
    
    // Master Alignment Rules
    if (masterData.role && profile.role !== masterData.role) {
        newConflicts.push(`Role mismatch (Master: ${masterData.role} vs Local: ${profile.role})`);
        autoHealPossible = false; // Role changes require explicit manual sync
    }
    
    const hasDisplayNameConflict = masterData.displayName && profile.displayName !== masterData.displayName;
    const hasPhotoConflict = masterData.photoURL && profile.photoURL !== masterData.photoURL;

    if (hasDisplayNameConflict) newConflicts.push('DisplayName mismatch');
    if (hasPhotoConflict) newConflicts.push('PhotoURL mismatch');

    setConflicts(newConflicts);
    setHasConflict(newConflicts.length > 0);

    // Auto-Healing Logic
    if (newConflicts.length > 0 && autoHealPossible && !profile.isSynced) {
        console.log('[Sovereign Heartbeat] Auto-reconciling identity metadata drift...');
        syncWithMaster();
    }
  }, [profile?.role, profile?.displayName, profile?.photoURL, profile?.isSynced, masterData, user, syncWithMaster]);

  // 3. Heartbeat Listeners
  useEffect(() => {
    let unsubscribeSPA: () => void = () => {};
    let unsubscribeTool: () => void = () => {};
    let unsubscribeCredits: () => void = () => {};

    const authUnsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      
      if (currentUser) {
        // Listen to SPA-specific profile
        const userRef = doc(db, 'users', currentUser.uid);
        unsubscribeSPA = onSnapshot(userRef, (docSnap) => {
           if (docSnap.exists()) {
             const data = docSnap.data();
              setProfile(prev => ({ 
                ...prev as UserProfile, 
                uid: data.uid,
                email: data.email,
                displayName: data.displayName,
                photoURL: data.photoURL,
                role: data.role || 'member',
                subscriptionMetadata: data.subscriptionMetadata,
                suiteSubscription: data.suiteSubscription,
                subscription: data.subscription,
                isSynced: data.isSynced
              }));
           } else {
             const providerPhoto = currentUser.providerData.find(p => p.photoURL)?.photoURL;
             setDoc(userRef, {
                uid: currentUser.uid,
                email: currentUser.email,
                displayName: currentUser.displayName,
                photoURL: currentUser.photoURL || providerPhoto || null,
                role: 'member',
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
                isSynced: true
             });
           }
           setLoading(false);
        });

        // Listen to Ecosystem Master
        const toolUserRef = doc(toolDb, 'users', currentUser.uid);
        unsubscribeTool = onSnapshot(toolUserRef, (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            setMasterData(data);
          }
        });

        // Listen to Credits
        const creditsRef = doc(toolDb, 'users', currentUser.uid, 'data', 'credits');
        unsubscribeCredits = onSnapshot(creditsRef, (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            const balance = data.balance || 0;
            const allowance = data.dailyAllowance || 0;
            const used = data.dailyAllowanceUsed || 0;
            const remainingDaily = Math.max(0, allowance - used);
            
            setProfile(prev => ({
              ...prev as UserProfile,
              credits: balance + remainingDaily,
              dailyRemaining: remainingDaily
            }));
          }
        });

      } else {
        setProfile(null);
        setHasConflict(false);
        setConflicts([]);
        setLoading(false);
      }
    });

    return () => {
        authUnsubscribe();
        unsubscribeSPA();
        unsubscribeTool();
        unsubscribeCredits();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ 
        user, profile, loading, login, logout, topUpCredits, syncWithMaster, hasConflict, conflicts, masterData, updateProfile 
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
