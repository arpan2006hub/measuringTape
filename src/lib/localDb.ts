/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore, collection, doc, setDoc, getDocs } from "firebase/firestore";

export interface UserDB {
  username: string;
  passwordHash: string;
  role: 'CITIZEN' | 'AUTHORITY';
  subscribedLocalities: Array<{
    id: string;
    name: string;
    centerLocation: { latitude: number; longitude: number };
    boundaryRadiusMeters: number;
  }>;
  reputationPoints: number;
  walletAddress: string;
  createdAt: string;
  updatedAt: string;
}

export interface IssueDB {
  id: string;
  title: string;
  description: string;
  category: string;
  locality: string; // The selected locality ID
  location: { latitude: number; longitude: number };
  imageCid: string;
  reporterAddress: string;
  status: string; // IssueStatus
  metadataCid: string;
  supportCount: number;
  reputationPoints: number;
  createdAt: string;
  updatedAt: string;
  blockchainTxHash?: string;
  onChainId?: number;
  assignedTo?: string;
  resolution?: {
    notes: string;
    imageCid: string;
    resolvedAt: string;
    resolverAddress: string;
  };
}

export interface VoteDB {
  id: string;
  issueId: string;
  voterAddress: string;
  type: 'VERIFICATION' | 'RESOLUTION';
  choice: string;
  reputationWeight: number;
  timestamp: string;
}

export interface LocalDatabaseSchema {
  users: Record<string, UserDB>;
  issues: Record<string, IssueDB>;
  votes: VoteDB[];
}

const DB_FILE = path.join(process.cwd(), 'local_db.json');

// Initialize memory cache
let dbCache: LocalDatabaseSchema = {
  users: {},
  issues: {},
  votes: [],
};

// Initialize Firebase Client SDK (run in Node context using API key)
let firebaseDb: any = null;

try {
  const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
  if (fs.existsSync(configPath)) {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    if (config.projectId) {
      const app = getApps().length === 0 
        ? initializeApp({
            apiKey: config.apiKey,
            authDomain: config.authDomain,
            projectId: config.projectId,
            storageBucket: config.storageBucket,
            messagingSenderId: config.messagingSenderId,
            appId: config.appId,
          })
        : getApp();
      
      firebaseDb = config.firestoreDatabaseId 
        ? getFirestore(app, config.firestoreDatabaseId)
        : getFirestore(app);
      console.log('[Firebase] Client SDK initialized successfully with project:', config.projectId);
    }
  } else {
    console.log('[Firebase] firebase-applet-config.json not found, skipping firestore initialization.');
  }
} catch (error) {
  console.error('[Firebase] Failed to initialize firebase:', error);
}

// Save database cache to Firestore
export async function saveDbToFirestore(db: LocalDatabaseSchema): Promise<void> {
  if (!firebaseDb) return;
  try {
    // Sync users
    for (const [username, user] of Object.entries(db.users)) {
      await setDoc(doc(firebaseDb, 'users', username.toLowerCase()), user);
    }
    // Sync issues
    for (const [issueId, issue] of Object.entries(db.issues)) {
      await setDoc(doc(firebaseDb, 'issues', issueId), issue);
    }
    // Sync votes
    for (const vote of db.votes) {
      await setDoc(doc(firebaseDb, 'votes', vote.id), vote);
    }
    console.log('[Firebase] Successfully synchronized state with Firestore');
  } catch (error) {
    console.error('[Firebase] Error synchronizing state with Firestore:', error);
  }
}

// Initialize database (called on server startup)
export async function initDb(): Promise<void> {
  // 1. Load from local file first as fallback base
  try {
    if (fs.existsSync(DB_FILE)) {
      const data = fs.readFileSync(DB_FILE, 'utf-8');
      dbCache = JSON.parse(data) as LocalDatabaseSchema;
    }
  } catch (error) {
    console.error('[Database] Error loading fallback DB file:', error);
  }

  if (!firebaseDb) {
    console.log('[Firebase] Firestore not configured. Operating in local mode.');
    return;
  }

  // 2. Hydrate from Firestore
  try {
    console.log('[Firebase] Hydrating in-memory database from Firestore...');
    
    // Fetch users
    const usersSnap = await getDocs(collection(firebaseDb, 'users'));
    const users: Record<string, UserDB> = {};
    usersSnap.forEach((doc: any) => {
      users[doc.id] = doc.data() as UserDB;
    });

    // Fetch issues
    const issuesSnap = await getDocs(collection(firebaseDb, 'issues'));
    const issues: Record<string, IssueDB> = {};
    issuesSnap.forEach((doc: any) => {
      issues[doc.id] = doc.data() as IssueDB;
    });

    // Fetch votes
    const votesSnap = await getDocs(collection(firebaseDb, 'votes'));
    const votes: VoteDB[] = [];
    votesSnap.forEach((doc: any) => {
      votes.push(doc.data() as VoteDB);
    });

    if (Object.keys(users).length > 0 || Object.keys(issues).length > 0 || votes.length > 0) {
      dbCache = { users, issues, votes };
      console.log(`[Firebase] Loaded ${Object.keys(users).length} users, ${Object.keys(issues).length} issues, ${votes.length} votes from Firestore.`);
      
      // Sync to local_db.json backup
      try {
        fs.writeFileSync(DB_FILE, JSON.stringify(dbCache, null, 2), 'utf-8');
      } catch (err) {
        console.error('[Database] Failed to write local DB backup:', err);
      }
    } else {
      console.log('[Firebase] Firestore is currently empty. Seeding from local backup if it has content.');
      if (Object.keys(dbCache.users).length > 0) {
        await saveDbToFirestore(dbCache);
      }
    }
  } catch (error) {
    console.error('[Firebase] Error hydrating state from Firestore:', error);
  }
}

// Helper to load db
export function loadDb(): LocalDatabaseSchema {
  return dbCache;
}

// Helper to save db (both local and Firebase)
export function saveDb(db: LocalDatabaseSchema): void {
  dbCache = db;
  // Save local file backup
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf-8');
  } catch (error) {
    console.error('[Database] Error saving DB file:', error);
  }

  // Asynchronously synchronize with Firestore
  if (firebaseDb) {
    saveDbToFirestore(db).catch(err => {
      console.error('[Firebase] Async save to Firestore failed:', err);
    });
  }
}

// Hash password helper using node's native crypto
export function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex');
}
