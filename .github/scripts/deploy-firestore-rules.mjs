import { readFile } from "node:fs/promises";
import { applicationDefault, initializeApp } from "firebase-admin/app";
import { getSecurityRules } from "firebase-admin/security-rules";

const projectId = process.env.FIREBASE_PROJECT_ID || "telalocal";

initializeApp({
  credential: applicationDefault(),
  projectId,
});

const source = await readFile("firestore.rules");

const ruleset = await getSecurityRules().releaseFirestoreRulesetFromSource(source);

console.log(`Firestore rules deployed successfully: ${ruleset.name}`);
