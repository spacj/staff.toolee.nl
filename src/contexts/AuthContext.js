'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  GoogleAuthProvider,
  signInWithPopup,
  linkWithPopup,
  updateProfile,
} from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { getUserProfile, createReferral, getUserByReferralCode } from '@/lib/firestore';
import { PROMO_WORKER_LIMIT } from '@/lib/pricing';

const PROMO_CODES = {
  'TOOLEE10': PROMO_WORKER_LIMIT,
  'STAFF10': PROMO_WORKER_LIMIT,
  'LAUNCH10': PROMO_WORKER_LIMIT,
};

const AuthContext = createContext({});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [organization, setOrganization] = useState(null);
  const [loading, setLoading] = useState(true);

  // ─── Load profile + org from Firestore ─────────────
  const loadProfile = useCallback(async (firebaseUser) => {
    if (!firebaseUser) {
      setUserProfile(null);
      setOrganization(null);
      return null;
    }
    const profileDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
    if (!profileDoc.exists()) return null;

    const profile = { id: profileDoc.id, ...profileDoc.data() };
    setUserProfile(profile);

    if (profile.orgId) {
      const orgDoc = await getDoc(doc(db, 'organizations', profile.orgId));
      if (orgDoc.exists()) {
        setOrganization({ id: orgDoc.id, ...orgDoc.data() });
      }
    }
    return profile;
  }, []);

  // ─── Auth state listener (login / logout / page refresh) ───
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        await loadProfile(firebaseUser);
      } else {
        setUserProfile(null);
        setOrganization(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [loadProfile]);

  // ─── Admin Registration ──────────────────────────────
  const registerAdmin = async (email, password, displayName, companyName, referralCode) => {
    // 1. Create Firebase Auth user
    const result = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(result.user, { displayName });

    // 2. Create organization
    const orgId = result.user.uid + '_org';
    const promoFreeLimit = referralCode ? PROMO_CODES[referralCode.toUpperCase()] : null;
    await setDoc(doc(db, 'organizations', orgId), {
      name: companyName,
      ownerId: result.user.uid,
      plan: 'free',
      freeWorkerLimit: promoFreeLimit || null,
      promoCode: promoFreeLimit ? referralCode.toUpperCase() : null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    // 3. Create admin user profile
    const genReferralCode = () => {
      const c = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      let s = '';
      for (let i = 0; i < 8; i++) s += c[Math.floor(Math.random() * c.length)];
      return s;
    };
    const profileData = {
      uid: result.user.uid,
      email,
      displayName,
      photoURL: '',
      role: 'admin',
      orgId,
      referralCode: genReferralCode(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    await setDoc(doc(db, 'users', result.user.uid), profileData);

    // Handle referral
    if (referralCode) {
      try {
        const referrer = await getUserByReferralCode(referralCode);
        if (referrer) {
          await createReferral({
            referrerId: referrer.uid,
            referredId: result.user.uid,
            orgId,
            referralCode: referralCode.toUpperCase(),
            createdAt: serverTimestamp(),
          });
        }
      } catch (e) {
        // Ignore referral errors
      }
    }

    // 4. Set state immediately so Layout doesn't redirect
    setUser(result.user);
    setUserProfile({ id: result.user.uid, ...profileData });
    setOrganization({ id: orgId, name: companyName, ownerId: result.user.uid, plan: 'free' });

    return result.user;
  };

  // ─── Worker Registration (via invite code) ───────────
  const registerWorker = async (email, password, displayName, invite) => {
    const result = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(result.user, { displayName });

    const profileData = {
      uid: result.user.uid,
      email,
      displayName,
      photoURL: '',
      role: invite.role || 'worker',
      orgId: invite.orgId,
      workerId: invite.workerId || null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    await setDoc(doc(db, 'users', result.user.uid), profileData);

    // Link to existing worker record if provided
    if (invite.workerId) {
      const { updateWorker } = await import('@/lib/firestore');
      await updateWorker(invite.workerId, { userId: result.user.uid, status: 'active' });
    }

    // Mark invite as used
    const { markInviteUsed } = await import('@/lib/firestore');
    await markInviteUsed(invite.id, result.user.uid);

    // Set state immediately
    setUser(result.user);
    setUserProfile({ id: result.user.uid, ...profileData });

    // Load org
    if (invite.orgId) {
      const orgDoc = await getDoc(doc(db, 'organizations', invite.orgId));
      if (orgDoc.exists()) {
        setOrganization({ id: orgDoc.id, ...orgDoc.data() });
      }
    }

    return result.user;
  };

  // ─── Sign In (email + password) ──────────────────────
  const signIn = async (email, password) => {
    const result = await signInWithEmailAndPassword(auth, email, password);
    // onAuthStateChanged will handle loading profile
    return result.user;
  };

  // ─── Sign In with Google ─────────────────────────────
  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(auth, provider);

    const profileDoc = await getDoc(doc(db, 'users', result.user.uid));
    if (!profileDoc.exists()) {
      // No profile → they haven't registered yet
      // Sign them out so they don't get stuck
      await firebaseSignOut(auth);
      throw new Error('NO_PROFILE');
    }

    // Update photo if Google provides one
    if (result.user.photoURL) {
      await updateDoc(doc(db, 'users', result.user.uid), {
        photoURL: result.user.photoURL,
        googleLinked: true,
        updatedAt: serverTimestamp(),
      });
    }

    return result.user;
  };

  // ─── Link Google Account (from Settings) ─────────────
  const linkGoogleAccount = async () => {
    if (!user) throw new Error('Not signed in');
    const provider = new GoogleAuthProvider();
    try {
      const result = await linkWithPopup(user, provider);
      await updateDoc(doc(db, 'users', user.uid), {
        photoURL: result.user.photoURL || userProfile?.photoURL || '',
        googleLinked: true,
        googleEmail: result.user.providerData.find(p => p.providerId === 'google.com')?.email || '',
        updatedAt: serverTimestamp(),
      });
      await loadProfile(user);
      return true;
    } catch (err) {
      if (err.code === 'auth/credential-already-in-use') {
        throw new Error('This Google account is already linked to another user.');
      }
      if (err.code === 'auth/provider-already-linked') {
        throw new Error('A Google account is already linked to your profile.');
      }
      throw err;
    }
  };

  // ─── Sign Out ────────────────────────────────────────
  const signOut = async () => {
    await firebaseSignOut(auth);
    setUser(null);
    setUserProfile(null);
    setOrganization(null);
  };

  const value = {
    user,
    userProfile,
    organization,
    loading,
    signIn,
    registerAdmin,
    registerWorker,
    signInWithGoogle,
    linkGoogleAccount,
    signOut,
    refreshProfile: () => loadProfile(user),
    isAdmin: userProfile?.role === 'admin',
    isManager: userProfile?.role === 'manager' || userProfile?.role === 'admin',
    isWorker: userProfile?.role === 'worker',
    isWebmaster: userProfile?.role === 'webmaster',
    role: userProfile?.role || 'worker',
    orgId: userProfile?.orgId || null,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}

export default AuthContext;
