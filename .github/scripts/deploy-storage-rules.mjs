import { readFile } from "node:fs/promises";
import { applicationDefault, initializeApp } from "firebase-admin/app";
import { getSecurityRules } from "firebase-admin/security-rules";

const projectId = process.env.FIREBASE_PROJECT_ID || "telalocal";
const storageBucket =
  process.env.FIREBASE_STORAGE_BUCKET || "telalocal.firebasestorage.app";

initializeApp({
  credential: applicationDefault(),
  projectId,
  storageBucket,
});

const source = await readFile("storage.rules");

const ruleset = await getSecurityRules().releaseStorageRulesetFromSource(
  source,
  storageBucket
);

console.log(
  `Storage rules deployed successfully to ${storageBucket}: ${ruleset.name}`
);
