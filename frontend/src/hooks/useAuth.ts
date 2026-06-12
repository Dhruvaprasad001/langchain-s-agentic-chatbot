"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/src/services/firebase";
import { signInWithGoogle, signOutUser } from "@/src/services/authService";
import type { User } from "@/src/types";

interface UseAuthReturn {
  user: User | null;
  loading: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
}

export function useAuth(): UseAuthReturn {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        setUser({
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          displayName: firebaseUser.displayName,
        });
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  async function signIn(): Promise<void> {
    await signInWithGoogle();
  }

  async function signOut(): Promise<void> {
    await signOutUser();
  }

  return { user, loading, signIn, signOut };
}
