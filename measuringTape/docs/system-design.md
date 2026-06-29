# measuringTape - System Design

## Project Overview

measuringTape is a decentralized civic issue reporting platform that enables citizens to report public infrastructure issues while ensuring transparency through blockchain.

The application combines Web2 usability with Web3 transparency.

Users are not required to own crypto wallets. All blockchain transactions are executed by a platform custodial wallet.

---

# Technology Stack

Frontend
- Next.js 15
- TypeScript
- TailwindCSS
- shadcn/ui
- Zustand

Maps
- React Leaflet
- OpenStreetMap

Storage
- Pinata IPFS

Blockchain
- Solidity
- Ethereum Sepolia
- Remix IDE
- ethers.js

Backend
- Next.js API Routes

---

# User Roles

## Citizen

Can:

- Report issue
- View issues
- Subscribe to localities
- Verify issues
- Verify resolutions

---

## Authority

Can:

- View verified issues
- Assign issues
- Update issue status
- Upload proof of resolution
- Close issues

---

# Issue Categories

- Pothole
- Water Leakage
- Garbage Dump
- Broken Streetlight
- Damaged Road
- Other

---

# Issue Lifecycle

REPORTED

↓

VERIFIED

↓

ASSIGNED

↓

IN_PROGRESS

↓

RESOLVED

↓

CLOSED

---

# Reporting Flow

Citizen submits:

- title
- description
- category
- locality
- image
- map location

↓

Image uploaded to IPFS

↓

Metadata JSON created

↓

Metadata uploaded to IPFS

↓

metadataCID returned

↓

Backend creates blockchain transaction

↓

Issue stored on chain

↓

Issue becomes REPORTED

---

# Duplicate Detection

Duplicate detection is deterministic.

Conditions:

- Same category
- Distance less than 20 meters

Use Haversine distance.

If duplicate exists:

Allow:

- Support Existing Issue

OR

- Continue Anyway

---

# Locality Verification

Users subscribe to one or more localities.

Example:

Ward A

Ward B

Ward C

Only issues inside subscribed localities appear in the verification dashboard.

---

# Verification Consensus

Verification requires:

Minimum 5 votes

AND

70% agreement

Votes:

- Exists
- Does Not Exist

If consensus succeeds:

Issue becomes VERIFIED.

---

# Resolution Verification

Authority uploads:

- Resolution image
- Resolution notes

Community votes:

- Resolved
- Not Resolved

Rules:

Minimum 5 votes

70% agreement

If passed:

Status = CLOSED

Otherwise:

Status = IN_PROGRESS

---

# Reputation System

Each verifier has a reputation score.

Initial reputation:

0

Correct verification:

+5

Correct resolution verification:

+10

Incorrect verification:

-3

Failed challenge:

-5

Voting weight:

max(1, reputation / 20)

---

# Blockchain Responsibilities

Blockchain stores only immutable audit data.

Stored:

- Issue ID
- metadataCID
- resolutionCID
- status
- timestamps
- reputation
- support count

Blockchain DOES NOT store:

- Images
- Descriptions
- GPS coordinates
- Metadata JSON

---

# IPFS Responsibilities

Store:

Images

Metadata JSON

Resolution images

Resolution metadata

---

# Frontend Pages

/

Citizen Dashboard

/report

Report Issue

/issues/[id]

Issue Details

/verify

Verification Dashboard

/authority

Authority Dashboard

---

# Backend Responsibilities

Backend performs:

- Pinata upload
- Blockchain interaction
- Duplicate detection
- Consensus calculation
- Reputation calculation

Backend uses a custodial wallet.

Citizens never interact with MetaMask.

---

# Smart Contract

Single contract:

measuringTape.sol

Responsibilities:

- Create issue
- Support issue
- Verify issue
- Update status
- Attach resolution
- Update reputation

Deploy using Remix IDE.

---

# Design Principles

- Mobile-first UI
- Strong typing
- Modular components
- Reusable business logic
- Minimal blockchain storage
- Immutable audit trail
- No AI categorization
- No token staking
- Locality-based verification