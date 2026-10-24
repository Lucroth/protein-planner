import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut, type User } from "firebase/auth";
import {
  collection,
  deleteDoc,
  doc,
  documentId,
  getDocs,
  getFirestore,
  query,
  serverTimestamp,
  setDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import type { Day, Product, Products, Recipe } from "./model";
import type { Store } from "./store";

const app = initializeApp({
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
});

const db = getFirestore(app);
const auth = getAuth(app);

export const onUser = (f: (u: User | null) => void) => onAuthStateChanged(auth, f);

export async function signIn(): Promise<void> {
  const { user } = await signInWithPopup(auth, new GoogleAuthProvider());
  // The reminder job emails this address; the rules only accept the account's own.
  await setDoc(doc(db, "users", user.uid), { email: user.email, name: user.displayName, updatedAt: serverTimestamp() }, { merge: true });
}

export const logOut = () => signOut(auth);

export function firestoreStore(uid: string): Store {
  const col = (name: string) => collection(db, "users", uid, name);
  return {
    async days(from, to) {
      const snap = await getDocs(query(col("days"), where(documentId(), ">=", from), where(documentId(), "<=", to)));
      return Object.fromEntries(snap.docs.map((d) => [d.id, d.data() as Day]));
    },
    async saveDays(days) {
      const batch = writeBatch(db);
      for (const [k, v] of Object.entries(days)) batch.set(doc(col("days"), k), v);
      await batch.commit();
    },
    recipes: async () => (await getDocs(col("recipes"))).docs.map((d) => d.data() as Recipe),
    saveRecipe: (r) => setDoc(doc(col("recipes"), r.id), r),
    deleteRecipe: (id) => deleteDoc(doc(col("recipes"), id)),
    products: async () => Object.fromEntries((await getDocs(col("products"))).docs.map((d) => [d.id, d.data() as Product])) as Products,
    saveProduct: (id, p) => setDoc(doc(col("products"), id), p),
  };
}
