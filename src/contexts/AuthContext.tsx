import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, type User, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { doc, setDoc, onSnapshot, serverTimestamp, updateDoc, increment } from 'firebase/firestore';
import { auth, db, toolDb } from '../lib/firebase';

interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  role: 'su' | 'admin' | 'member';
  credits?: number;
  subscription?: 'free' | 'pro' | 'standard';
  dailyRemaining?: number;
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
  masterData: null
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasConflict, setHasConflict] = useState(false);
  const [conflicts, setConflicts] = useState<string[]>([]);
  const [masterData, setMasterData] = useState<any>(null);

  useEffect(() => {
    let unsubscribeSPA: () => void = () => {};
    let unsubscribeTool: () => void = () => {};
    let unsubscribeCredits: () => void = () => {};

    const authUnsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      unsubscribeSPA();
      unsubscribeTool();
      unsubscribeCredits();

      setUser(currentUser);
      
      if (currentUser) {
        // 1. Sync & Listen to SPA-specific profile (STRICTLY Metadata & Role)
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
               isSynced: data.isSynced
             }));
           } else {
             setDoc(userRef, {
                uid: currentUser.uid,
                email: currentUser.email,
                displayName: currentUser.displayName,
                photoURL: currentUser.photoURL,
                role: 'member',
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
                isSynced: true
             });
           }
        });

        // 2. Listen to Ecosystem Master Status (Subscription & Role Authority)
        const toolUserRef = doc(toolDb, 'users', currentUser.uid);
        unsubscribeTool = onSnapshot(toolUserRef, (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            setMasterData(data);
            setProfile(prev => ({
              ...prev as UserProfile,
              subscription: data.subscription || 'free',
            }));
          }
        });

        // 3. Listen to Credits (THE EXCLUSIVE SOURCE OF TRUTH)
        const creditsRef = doc(toolDb, 'users', currentUser.uid, 'data', 'credits');
        unsubscribeCredits = onSnapshot(creditsRef, (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            const balance = data.balance || 0;
            const allowance = data.dailyAllowance || 0;
            const used = data.dailyAllowanceUsed || 0;
            const remainingDaily = Math.max(0, allowance - used);
            
            // Align with PromptTool's "Available Credits" logic
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
      }
      setLoading(false);
    });

    return () => {
        authUnsubscribe();
        unsubscribeSPA();
        unsubscribeTool();
        unsubscribeCredits();
    };
  }, []);

  // Conflict Detection Engine
  useEffect(() => {
    if (!profile || !masterData) return;

    const newConflicts: string[] = [];
    
    // Master Alignment Rules
    if (masterData.role && profile.role !== masterData.role) {
        newConflicts.push(`Role mismatch (Master: ${masterData.role} vs Local: ${profile.role})`);
    }
    if (masterData.displayName && profile.displayName !== masterData.displayName) {
        newConflicts.push('DisplayName mismatch');
    }

    setConflicts(newConflicts);
    setHasConflict(newConflicts.length > 0);
  }, [profile?.role, profile?.displayName, masterData]);

  const login = async () => {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  };

  const logout = async () => {
    await signOut(auth);
  };

  const syncWithMaster = async () => {
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
  };

  const topUpCredits = async (amount: number = 250) => {
    if (!user) return;
    try {
        const creditsRef = doc(toolDb, 'users', user.uid, 'data', 'credits');
        await updateDoc(creditsRef, {
            balance: increment(amount)
        });
    } catch (err: any) {
        console.error("Top-up failed", err);
    }
  };

  return (
    <AuthContext.Provider value={{ 
        user, profile, loading, login, logout, topUpCredits, syncWithMaster, hasConflict, conflicts, masterData 
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
