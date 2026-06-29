/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { uploadImage, uploadMetadata } from "./src/lib/pinata";
import {
  createIssueOnChain,
  supportIssueOnChain,
  verifyIssueOnChain,
  updateIssueStatus,
  attachResolutionOnChain,
  verifyResolutionOnChain,
  getReputationOnChain,
  updateReputationOnChain,
} from "./src/lib/blockchain";
import { loadDb, saveDb, hashPassword, initDb, UserDB, IssueDB, VoteDB } from "./src/lib/localDb";
import { CITIES } from "./src/utils/cities";

async function startServer() {
  await initDb();

  // Automatically migrate municipality1234 to Haldia if empty or not set
  try {
    const db = loadDb();
    let updated = false;
    if (db.users["municipality1234"]) {
      const muniUser = db.users["municipality1234"];
      if (!muniUser.subscribedLocalities || muniUser.subscribedLocalities.length === 0 || muniUser.subscribedLocalities[0]?.id !== "city_haldia") {
        console.log('[Database] Migrating municipality1234 locality subscription to Haldia...');
        muniUser.subscribedLocalities = [
          {
            id: "city_haldia",
            name: "Haldia Municipal Area",
            centerLocation: {
              latitude: 22.0352,
              longitude: 88.0573
            },
            boundaryRadiusMeters: 50000
          }
        ];
        muniUser.updatedAt = new Date().toISOString();
        db.users["municipality1234"] = muniUser;
        updated = true;
      }
    }
    if (updated) {
      saveDb(db);
    }
  } catch (err) {
    console.error('[Database] Failed to migrate default municipality1234:', err);
  }

  const app = reportApp();
  const PORT = 3000;

  function reportApp() {
    const expressApp = express();
    // Configure JSON parser with a 10MB limit for base64 image uploads
    expressApp.use(express.json({ limit: "10mb" }));
    expressApp.use(express.urlencoded({ limit: "10mb", extended: true }));
    return expressApp;
  }

  // --- Local Database Auth & Issues Endpoints ---

  // User signup
  app.post("/api/auth/signup", async (req, res) => {
    try {
      const { username, password, role, subscribedLocalities, walletAddress } = req.body;
      if (!username || !password || !role || !subscribedLocalities || !walletAddress) {
        return res.status(400).json({ error: "Missing required signup fields" });
      }

      const db = loadDb();
      if (db.users[username.toLowerCase()]) {
        return res.status(400).json({ error: "Username already exists" });
      }

      const passHash = hashPassword(password);
      const newUser: UserDB = {
        username: username.toLowerCase(),
        passwordHash: passHash,
        role,
        subscribedLocalities,
        reputationPoints: 0,
        walletAddress,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      db.users[username.toLowerCase()] = newUser;
      saveDb(db);

      // Return user details without password hash
      const { passwordHash: _, ...userResponse } = newUser;
      return res.json({ success: true, user: userResponse });
    } catch (error: any) {
      console.error("[API Auth] Error during signup:", error);
      return res.status(500).json({ error: error.message || "Failed to sign up" });
    }
  });

  // User login
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { username, password } = req.body;
      if (!username || !password) {
        return res.status(400).json({ error: "Username and password are required" });
      }

      const db = loadDb();
      const user = db.users[username.toLowerCase()];
      if (!user) {
        return res.status(401).json({ error: "Invalid username or password" });
      }

      const passHash = hashPassword(password);
      if (user.passwordHash !== passHash) {
        return res.status(401).json({ error: "Invalid username or password" });
      }

      // Check if logged-in user is an authority and has no subscribed localities or is municipality1234
      if (user.role === "AUTHORITY" && (!user.subscribedLocalities || user.subscribedLocalities.length === 0 || user.username.toLowerCase() === "municipality1234")) {
        user.subscribedLocalities = [
          {
            id: "city_haldia",
            name: "Haldia Municipal Area",
            centerLocation: {
              latitude: 22.0352,
              longitude: 88.0573
            },
            boundaryRadiusMeters: 50000
          }
        ];
        user.updatedAt = new Date().toISOString();
        db.users[username.toLowerCase()] = user;
        saveDb(db);
      }

      const { passwordHash: _, ...userResponse } = user;
      return res.json({ success: true, user: userResponse });
    } catch (error: any) {
      console.error("[API Auth] Error during login:", error);
      return res.status(500).json({ error: error.message || "Failed to log in" });
    }
  });

  // Update subscribed locations
  app.post("/api/auth/update-subscriptions", async (req, res) => {
    try {
      const { username, subscribedLocalities } = req.body;
      if (!username || !subscribedLocalities) {
        return res.status(400).json({ error: "Username and subscribedLocalities are required" });
      }

      const db = loadDb();
      const user = db.users[username.toLowerCase()];
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      user.subscribedLocalities = subscribedLocalities;
      user.updatedAt = new Date().toISOString();
      db.users[username.toLowerCase()] = user;
      saveDb(db);

      const { passwordHash: _, ...userResponse } = user;
      return res.json({ success: true, user: userResponse });
    } catch (error: any) {
      console.error("[API Auth] Error updating subscriptions:", error);
      return res.status(500).json({ error: error.message || "Failed to update subscriptions" });
    }
  });

  // Update reputation points
  app.post("/api/auth/update-reputation", async (req, res) => {
    try {
      const { username, address, reputationPoints } = req.body;
      if ((!username && !address) || reputationPoints === undefined) {
        return res.status(400).json({ error: "Username or address, and reputationPoints adjustment are required" });
      }

      const db = loadDb();
      let user;
      let userKey = "";

      if (username) {
        userKey = username.toLowerCase();
        user = db.users[userKey];
      } else if (address) {
        const found = Object.entries(db.users).find(
          ([_, u]) => u.walletAddress?.toLowerCase() === address.toLowerCase()
        );
        if (found) {
          userKey = found[0];
          user = found[1];
        }
      }

      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const adjustment = Number(reputationPoints);
      user.reputationPoints = (user.reputationPoints || 0) + adjustment;
      user.updatedAt = new Date().toISOString();
      db.users[userKey] = user;
      saveDb(db);

      // Also trigger on-chain reputation update if address is configured
      if (user.walletAddress) {
        try {
          await updateReputationOnChain(user.walletAddress, adjustment);
        } catch (chainError) {
          console.warn(`[API Auth] Failed to update on-chain reputation for ${user.walletAddress}:`, chainError);
        }
      }

      const { passwordHash: _, ...userResponse } = user;
      return res.json({ success: true, user: userResponse });
    } catch (error: any) {
      console.error("[API Auth] Error updating reputation:", error);
      return res.status(500).json({ error: error.message || "Failed to update reputation" });
    }
  });

  // Get all issues
  app.get("/api/db/issues", async (req, res) => {
    try {
      const db = loadDb();
      return res.json({ success: true, issues: Object.values(db.issues) });
    } catch (error: any) {
      console.error("[API DB] Error fetching issues:", error);
      return res.status(500).json({ error: "Failed to fetch issues" });
    }
  });

  // Report new issue
  app.post("/api/db/issues/report", async (req, res) => {
    try {
      const {
        title,
        description,
        category,
        locality,
        location,
        imageCid,
        reporterAddress,
        status,
        metadataCid,
        blockchainTxHash,
        onChainId,
      } = req.body;

      if (!title || !description || !category || !locality || !location || !reporterAddress) {
        return res.status(400).json({ error: "Missing required fields for reporting issue" });
      }

      const db = loadDb();
      const issueId = `issue_${onChainId || Date.now()}`;
      const newIssue: IssueDB = {
        id: issueId,
        title,
        description,
        category,
        locality,
        location,
        imageCid: imageCid || "",
        reporterAddress,
        status: status || "REPORTED",
        metadataCid: metadataCid || "",
        supportCount: 1,
        reputationPoints: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        blockchainTxHash,
        onChainId: onChainId ? Number(onChainId) : undefined,
      };

      db.issues[issueId] = newIssue;
      saveDb(db);

      return res.json({ success: true, issue: newIssue });
    } catch (error: any) {
      console.error("[API DB] Error reporting issue:", error);
      return res.status(500).json({ error: "Failed to report issue" });
    }
  });

  // Cast vote on issue
  app.post("/api/db/issues/vote", async (req, res) => {
    try {
      const { issueId, voterAddress, type, choice, reputationWeight } = req.body;
      if (!issueId || !voterAddress || !type || !choice) {
        return res.status(400).json({ error: "Missing required voting fields" });
      }

      const db = loadDb();
      
      // Add or update vote
      const voteId = `vote_${type}_${issueId}_${voterAddress.toLowerCase()}`;
      const existingVoteIndex = db.votes.findIndex(v => v.issueId === issueId && v.voterAddress.toLowerCase() === voterAddress.toLowerCase() && v.type === type);
      
      const newVote: VoteDB = {
        id: voteId,
        issueId,
        voterAddress,
        type,
        choice,
        reputationWeight: reputationWeight || 1,
        timestamp: new Date().toISOString(),
      };

      if (existingVoteIndex >= 0) {
        db.votes[existingVoteIndex] = newVote;
      } else {
        db.votes.push(newVote);
      }

      // If it's a supportive verification vote, increment the supportCount on the issue
      if (type === 'VERIFICATION' && choice === 'EXISTS' && db.issues[issueId]) {
        const existsCount = db.votes.filter(v => v.issueId === issueId && v.type === 'VERIFICATION' && v.choice === 'EXISTS').length;
        db.issues[issueId].supportCount = Math.max(1, existsCount);
      }

      saveDb(db);
      
      const filteredVotes = db.votes.filter(v => v.issueId === issueId);
      return res.json({ success: true, votes: filteredVotes });
    } catch (error: any) {
      console.error("[API DB] Error voting on issue:", error);
      return res.status(500).json({ error: "Failed to cast vote" });
    }
  });

  // Get votes for an issue
  app.get("/api/db/votes/:issueId", async (req, res) => {
    try {
      const { issueId } = req.params;
      const db = loadDb();
      const filteredVotes = db.votes.filter(v => v.issueId === issueId);
      return res.json({ success: true, votes: filteredVotes });
    } catch (error: any) {
      console.error("[API DB] Error fetching votes:", error);
      return res.status(500).json({ error: "Failed to fetch votes" });
    }
  });

  // Update issue status/assignment/resolution
  app.post("/api/db/issues/update", async (req, res) => {
    try {
      const { id, status, assignedTo, resolution } = req.body;
      if (!id) {
        return res.status(400).json({ error: "Issue ID is required for update" });
      }

      const db = loadDb();
      const issue = db.issues[id];
      if (!issue) {
        return res.status(404).json({ error: "Issue not found in database" });
      }

      if (status) issue.status = status;
      if (assignedTo) issue.assignedTo = assignedTo;
      if (resolution) issue.resolution = resolution;
      issue.updatedAt = new Date().toISOString();

      db.issues[id] = issue;
      saveDb(db);

      return res.json({ success: true, issue });
    } catch (error: any) {
      console.error("[API DB] Error updating issue:", error);
      return res.status(500).json({ error: "Failed to update issue" });
    }
  });

  // API route to handle IPFS uploading via Pinata
  app.post("/api/ipfs/upload", async (req, res) => {
    try {
      const { title, description, category, locality, latitude, longitude, image } = req.body;

      if (!image) {
        return res.status(400).json({ error: "Image data is required" });
      }
      if (!title || !description || !category || !locality || latitude === undefined || longitude === undefined) {
        return res.status(400).json({ error: "Missing required metadata fields" });
      }

      console.log(`[API] Received IPFS upload request for: "${title}"`);

      // 1. Upload base64 image to IPFS via Pinata
      const imageCID = await uploadImage(image, `evidence-${Date.now()}.png`);
      console.log(`[API] Image pinned successfully. CID: ${imageCID}`);

      // 2. Upload structured JSON metadata to IPFS via Pinata
      const metadataCID = await uploadMetadata({
        title,
        description,
        category,
        locality,
        latitude: Number(latitude),
        longitude: Number(longitude),
        imageCID,
      });
      console.log(`[API] Metadata pinned successfully. CID: ${metadataCID}`);

      // 3. Return both CIDs
      return res.json({
        success: true,
        imageCID,
        metadataCID,
      });
    } catch (error: any) {
      console.error("[API] Error processing IPFS upload:", error);
      return res.status(500).json({
        error: error.message || "Failed to pin assets to IPFS",
      });
    }
  });

  // API route to handle IPFS uploading of resolution proof via Pinata
  app.post("/api/ipfs/upload-resolution", async (req, res) => {
    try {
      const { image, notes, resolverAddress } = req.body;

      if (!image) {
        return res.status(400).json({ error: "Image data is required" });
      }
      if (!notes || !resolverAddress) {
        return res.status(400).json({ error: "notes and resolverAddress are required" });
      }

      console.log(`[API] Received IPFS upload request for resolution`);

      // 1. Upload base64 image to IPFS via Pinata
      const imageCID = await uploadImage(image, `resolution-${Date.now()}.png`);
      console.log(`[API] Resolution image pinned successfully. CID: ${imageCID}`);

      // 2. Create and upload structured JSON metadata to IPFS via Pinata
      const resolutionCID = await uploadMetadata({
        notes,
        imageCid: imageCID,
        resolvedAt: new Date().toISOString(),
        resolverAddress,
      });
      console.log(`[API] Resolution metadata pinned successfully. CID: ${resolutionCID}`);

      // 3. Return both CIDs
      return res.json({
        success: true,
        imageCID,
        resolutionCID,
      });
    } catch (error: any) {
      console.error("[API] Error processing IPFS resolution upload:", error);
      return res.status(500).json({
        error: error.message || "Failed to pin resolution assets to IPFS",
      });
    }
  });

  // --- Geocoding Proxies for OpenStreetMap Nominatim with Robust Offline Fallbacks ---
  app.get("/api/geocode", async (req, res) => {
    try {
      const q = req.query.q;
      if (!q || typeof q !== "string") {
        return res.status(400).json({ error: "Query parameter 'q' is required" });
      }

      console.log(`[Geocode Proxy] Searching for: "${q}"`);

      let results: any[] = [];
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=5`,
          {
            headers: {
              "User-Agent": "MeasuringTapeCivicApp/1.0 (contact: admin@measuringtape.example.com)",
              "Referer": "https://measuringtape.example.com",
            },
          }
        );
        if (response.ok) {
          results = await response.json();
          console.log(`[Geocode Proxy] Nominatim returned ${results.length} results.`);
        } else {
          console.warn(`[Geocode Proxy] Nominatim search failed with status: ${response.status}`);
        }
      } catch (err) {
        console.error("[Geocode Proxy] Nominatim fetch error:", err);
      }

      // Fallback: If Nominatim returns nothing, use our offline city database for matching!
      if (!results || results.length === 0) {
        console.log(`[Geocode Proxy] Falling back to offline CITIES database for "${q}"`);
        const searchLower = q.toLowerCase();
        
        // Custom short-circuit match for Haldia if needed
        let fallbackCities = [];
        if (searchLower.includes("haldia")) {
          fallbackCities.push({
            name: "Haldia",
            state: "West Bengal",
            latitude: 22.0352,
            longitude: 88.0573
          });
        }

        // Filter standard CITIES
        const matched = CITIES.filter(
          (c) =>
            c.name.toLowerCase().includes(searchLower) ||
            c.state.toLowerCase().includes(searchLower)
        ).slice(0, 5);

        const combined = [...fallbackCities, ...matched];
        // Deduplicate by name
        const seen = new Set();
        const unique = combined.filter(c => {
          const key = `${c.name}-${c.state}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        }).slice(0, 5);

        results = unique.map((city, idx) => ({
          place_id: 1000000 + idx,
          display_name: `${city.name}, ${city.state}, India`,
          lat: String(city.latitude),
          lon: String(city.longitude),
          name: city.name,
        }));
        
        console.log(`[Geocode Proxy] Local search matched ${results.length} offline results.`);
      }

      return res.json(results);
    } catch (error: any) {
      console.error("[Geocode Proxy] Endpoint error:", error);
      return res.status(500).json({ error: "Failed to geocode location" });
    }
  });

  app.get("/api/reverse-geocode", async (req, res) => {
    try {
      const { lat, lon } = req.query;
      if (!lat || !lon) {
        return res.status(400).json({ error: "Parameters 'lat' and 'lon' are required" });
      }

      console.log(`[Reverse Geocode Proxy] Querying coordinates: ${lat}, ${lon}`);

      let data: any = null;
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`,
          {
            headers: {
              "User-Agent": "MeasuringTapeCivicApp/1.0 (contact: admin@measuringtape.example.com)",
              "Referer": "https://measuringtape.example.com",
            },
          }
        );
        if (response.ok) {
          data = await response.json();
        } else {
          console.warn(`[Reverse Geocode Proxy] Nominatim reverse failed with status: ${response.status}`);
        }
      } catch (err) {
        console.error("[Reverse Geocode Proxy] Nominatim fetch error:", err);
      }

      // Fallback if reverse geocode fails or is offline
      if (!data) {
        console.log(`[Reverse Geocode Proxy] Reverse geocode failed, providing offline reverse coordinates fallback`);
        // Find closest offline city!
        const latNum = Number(lat);
        const lonNum = Number(lon);
        let closestCity = CITIES[0] || { name: "Kolkata", state: "West Bengal", latitude: 22.5726, longitude: 88.3639 };
        let minDistance = Infinity;

        // Haldia special check
        const dHaldia = Math.pow(latNum - 22.0352, 2) + Math.pow(lonNum - 88.0573, 2);
        if (dHaldia < 0.05) {
          closestCity = { name: "Haldia", state: "West Bengal", latitude: 22.0352, longitude: 88.0573 };
        } else {
          for (const city of CITIES) {
            const dist = Math.pow(city.latitude - latNum, 2) + Math.pow(city.longitude - lonNum, 2);
            if (dist < minDistance) {
              minDistance = dist;
              closestCity = city;
            }
          }
        }

        data = {
          display_name: `${closestCity.name}, ${closestCity.state}, India`,
          address: {
            suburb: `${closestCity.name} Ward`,
            city: closestCity.name,
            state: closestCity.state,
            country: "India",
          },
        };
      }

      return res.json(data);
    } catch (error: any) {
      console.error("[Reverse Geocode Proxy] Endpoint error:", error);
      return res.status(500).json({ error: "Failed to reverse geocode" });
    }
  });

  // --- Blockchain API Routes (Custodial Relayer Pattern) ---

  // Helper to identify and bypass actual blockchain interactions for local mock issues
  const isMockIssueId = (id: any): boolean => {
    if (id === undefined || id === null) return false;
    const str = String(id).trim();
    return str.startsWith('00') || str.startsWith('issue_00');
  };

  const getMockTxHash = (): string => {
    return "0x" + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join("");
  };

  // Create Issue on chain
  app.post("/api/blockchain/create-issue", async (req, res) => {
    try {
      const { metadataCID } = req.body;
      if (!metadataCID) {
        return res.status(400).json({ error: "metadataCID is required" });
      }

      console.log(`[API Blockchain] Requesting on-chain issue creation for CID: ${metadataCID}`);
      const result = await createIssueOnChain(metadataCID);
      return res.json({
        success: true,
        txHash: result.txHash,
        issueId: result.issueId,
      });
    } catch (error: any) {
      console.error("[API Blockchain] Error creating issue on-chain:", error);
      return res.status(500).json({ error: error.message || "On-chain transaction failed" });
    }
  });

  // Support / Upvote an issue on chain
  app.post("/api/blockchain/support-issue", async (req, res) => {
    try {
      const { issueId, supporterAddress } = req.body;
      if (issueId === undefined || !supporterAddress) {
        return res.status(400).json({ error: "issueId and supporterAddress are required" });
      }

      if (isMockIssueId(issueId)) {
        console.log(`[API Blockchain] Mock issue #${issueId} detected. Simulating support transaction.`);
        return res.json({ success: true, txHash: getMockTxHash() });
      }

      console.log(`[API Blockchain] Requesting on-chain support for issue #${issueId} by ${supporterAddress}`);
      const txHash = await supportIssueOnChain(Number(issueId), supporterAddress);
      return res.json({ success: true, txHash });
    } catch (error: any) {
      console.error("[API Blockchain] Error supporting issue on-chain:", error);
      return res.status(500).json({ error: error.message || "On-chain transaction failed" });
    }
  });

  // Verify an issue on chain
  app.post("/api/blockchain/verify-issue", async (req, res) => {
    try {
      const { issueId, verifierAddress, accepted } = req.body;
      if (issueId === undefined || !verifierAddress || accepted === undefined) {
        return res.status(400).json({ error: "issueId, verifierAddress, and accepted are required" });
      }

      if (isMockIssueId(issueId)) {
        console.log(`[API Blockchain] Mock issue #${issueId} detected. Simulating verification transaction.`);
        return res.json({ success: true, txHash: getMockTxHash() });
      }

      console.log(`[API Blockchain] Requesting on-chain verification for issue #${issueId} (accepted: ${accepted})`);
      const txHash = await verifyIssueOnChain(Number(issueId), verifierAddress, !!accepted);
      return res.json({ success: true, txHash });
    } catch (error: any) {
      console.error("[API Blockchain] Error verifying issue on-chain:", error);
      return res.status(500).json({ error: error.message || "On-chain transaction failed" });
    }
  });

  // Update status of an issue on chain (e.g., Assigned, In Progress, etc.)
  app.post("/api/blockchain/update-status", async (req, res) => {
    try {
      const { issueId, newStatus } = req.body;
      if (issueId === undefined || newStatus === undefined) {
        return res.status(400).json({ error: "issueId and newStatus are required" });
      }

      if (isMockIssueId(issueId)) {
        console.log(`[API Blockchain] Mock issue #${issueId} detected. Simulating status update transaction to ${newStatus}.`);
        return res.json({ success: true, txHash: getMockTxHash() });
      }

      console.log(`[API Blockchain] Requesting on-chain status update for issue #${issueId} to status: ${newStatus}`);
      const txHash = await updateIssueStatus(Number(issueId), Number(newStatus));
      return res.json({ success: true, txHash });
    } catch (error: any) {
      console.error("[API Blockchain] Error updating issue status on-chain:", error);
      return res.status(500).json({ error: error.message || "On-chain transaction failed" });
    }
  });

  // Attach resolution metadata CID to issue on chain
  app.post("/api/blockchain/attach-resolution", async (req, res) => {
    try {
      const { issueId, resolutionCID } = req.body;
      if (issueId === undefined || !resolutionCID) {
        return res.status(400).json({ error: "issueId and resolutionCID are required" });
      }

      if (isMockIssueId(issueId)) {
        console.log(`[API Blockchain] Mock issue #${issueId} detected. Simulating resolution attachment transaction.`);
        return res.json({ success: true, txHash: getMockTxHash() });
      }

      console.log(`[API Blockchain] Requesting on-chain resolution attachment for issue #${issueId} to CID: ${resolutionCID}`);
      const txHash = await attachResolutionOnChain(Number(issueId), resolutionCID);
      return res.json({ success: true, txHash });
    } catch (error: any) {
      console.error("[API Blockchain] Error attaching resolution on-chain:", error);
      return res.status(500).json({ error: error.message || "On-chain transaction failed" });
    }
  });

  // Verify resolution of an issue on chain
  app.post("/api/blockchain/verify-resolution", async (req, res) => {
    try {
      const { issueId, verifierAddress, resolved } = req.body;
      if (issueId === undefined || !verifierAddress || resolved === undefined) {
        return res.status(400).json({ error: "issueId, verifierAddress, and resolved are required" });
      }

      if (isMockIssueId(issueId)) {
        console.log(`[API Blockchain] Mock issue #${issueId} detected. Simulating resolution audit transaction.`);
        return res.json({ success: true, txHash: getMockTxHash() });
      }

      console.log(`[API Blockchain] Requesting on-chain resolution audit for issue #${issueId} (resolved: ${resolved})`);
      const txHash = await verifyResolutionOnChain(Number(issueId), verifierAddress, !!resolved);
      return res.json({ success: true, txHash });
    } catch (error: any) {
      console.error("[API Blockchain] Error verifying resolution on-chain:", error);
      return res.status(500).json({ error: error.message || "On-chain transaction failed" });
    }
  });

  // Get user reputation from chain
  app.get("/api/blockchain/reputation/:address", async (req, res) => {
    try {
      const userAddress = req.params.address;
      if (!userAddress) {
        return res.status(400).json({ error: "userAddress parameter is required" });
      }

      const reputation = await getReputationOnChain(userAddress);
      return res.json({ success: true, reputation });
    } catch (error: any) {
      console.error("[API Blockchain] Error reading reputation from chain:", error);
      return res.status(500).json({ error: error.message || "On-chain request failed" });
    }
  });

  // Health check endpoint
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Vite middleware setup for assets serving
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Server] running on http://localhost:${PORT}`);
  });
}

startServer();

