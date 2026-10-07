"use client";

import {
  createUserWithEmailAndPassword,
  deleteUser,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  updateProfile,
} from "firebase/auth";
import { collection, doc, serverTimestamp, writeBatch } from "firebase/firestore";
import { auth, db } from "./client";

export type PublicAccountType = "host" | "advertiser";

export type RegisterAccountInput = {
  displayName: string;
  companyName: string;
  email: string;
  password: string;
  phone: string;
  accountType: PublicAccountType;
};

export async function registerAccount(input: RegisterAccountInput) {
  let createdUser = null;

  try {
    const credential = await createUserWithEmailAndPassword(
      auth,
      input.email.trim().toLowerCase(),
      input.password
    );
    createdUser = credential.user;

    await updateProfile(createdUser, { displayName: input.displayName.trim() });

    const tenantRef = doc(collection(db, "tenants"));
    const userRef = doc(db, "users", createdUser.uid);
    const batch = writeBatch(db);

    batch.set(tenantRef, {
      name: input.companyName.trim(),
      ownerUid: createdUser.uid,
      accountType: input.accountType,
      status: "active",
      plan: "pilot",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    batch.set(userRef, {
      uid: createdUser.uid,
      email: createdUser.email,
      displayName: input.displayName.trim(),
      phone: input.phone.trim(),
      tenantId: tenantRef.id,
      role: "owner",
      accountType: input.accountType,
      status: "active",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    await batch.commit();
    return { user: createdUser, tenantId: tenantRef.id };
  } catch (error) {
    if (createdUser) {
      try { await deleteUser(createdUser); } catch {}
    }
    throw error;
  }
}

export function loginAccount(email: string, password: string) {
  return signInWithEmailAndPassword(auth, email.trim().toLowerCase(), password);
}

export function logoutAccount() {
  return signOut(auth);
}


export async function requestPasswordReset(email: string) {
  const normalized = email.trim().toLowerCase();
  if (!normalized) {
    throw Object.assign(new Error("Informe seu e-mail para recuperar a senha."), {
      code: "auth/missing-email",
    });
  }

  await sendPasswordResetEmail(auth, normalized);
}
