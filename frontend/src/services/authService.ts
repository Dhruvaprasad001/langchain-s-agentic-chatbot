import {
  signInWithPopup,
  signOut,
  type UserCredential,
} from "firebase/auth";
import { auth, googleProvider } from "@/src/services/firebase";
import type { User } from "@/src/types";

export async function signInWithGoogle(): Promise<User> {
  const result: UserCredential = await signInWithPopup(auth, googleProvider);
  const { uid, email, displayName } = result.user;
  return { uid, email, displayName };
}

export async function signOutUser(): Promise<void> {
  await signOut(auth);
}

export async function getIdToken(): Promise<string> {
  // auth.authStateReady() resolves once Firebase has rehydrated the session
  // from storage. Without this, auth.currentUser is null on hard refresh.
  await auth.authStateReady();
  const user = auth.currentUser;
  if (!user) {
    throw new Error("No authenticated user");
  }
  return user.getIdToken();
}
