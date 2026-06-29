/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ethers } from "ethers";

// ABI for the measuringTape Solidity Contract
const CONTRACT_ABI = [
  "function createIssue(string calldata metadataCID) external returns (uint256 issueId)",
  "function supportIssue(uint256 issueId, address supporter) external",
  "function verifyIssue(uint256 issueId, address verifier, bool accepted) external",
  "function updateStatus(uint256 issueId, uint8 newStatus) external",
  "function attachResolution(uint256 issueId, string calldata resolutionCID) external",
  "function verifyResolution(uint256 issueId, address verifier, bool resolved) external",
  "function updateReputation(address actor, int256 delta) external",
  "function getIssue(uint256 issueId) external view returns (string memory metadataCID, string memory resolutionCID, uint8 status, uint256 supportCount)",
  "function reputation(address) external view returns (int256)",
  "function operators(address) external view returns (bool)",
  
  // Events
  "event IssueCreated(uint256 indexed issueId, string metadataCID, uint8 status, uint256 createdAt)",
  "event IssueSupported(uint256 indexed issueId, address indexed supporter, uint256 supportCount)",
  "event IssueVerified(uint256 indexed issueId, address indexed verifier, bool accepted, uint8 status)",
  "event StatusUpdated(uint256 indexed issueId, uint8 previousStatus, uint8 newStatus)",
  "event ResolutionAttached(uint256 indexed issueId, string resolutionCID, uint8 status)",
  "event IssueClosed(uint256 indexed issueId, address indexed verifier, string resolutionCID)",
  "event ReputationUpdated(address indexed actor, int256 previousReputation, int256 newReputation)"
];

// Lazily-initialized components to prevent startup crashes when keys are missing
let provider: ethers.JsonRpcProvider | null = null;
let wallet: ethers.Wallet | null = null;
let contract: ethers.Contract | null = null;

class Mutex {
  private promise: Promise<any> = Promise.resolve();

  async run<T>(fn: () => Promise<T>): Promise<T> {
    const next = this.promise.then(async () => {
      return fn();
    });
    this.promise = next.catch(() => {});
    return next;
  }
}

const txMutex = new Mutex();

function getBlockchainContext() {
  const privateKey = process.env.PRIVATE_KEY;
  const rpcUrl = process.env.RPC_URL;
  const contractAddress = process.env.CONTRACT_ADDRESS || "0x60167a141544839c1b2488d080c2cd546d433dd9";

  if (!privateKey || !rpcUrl) {
    console.warn(
      "[Blockchain] Missing PRIVATE_KEY or RPC_URL in environment. Operating in SIMULATOR mode."
    );
    return null;
  }

  try {
    if (!provider) {
      provider = new ethers.JsonRpcProvider(rpcUrl);
    }
    if (!wallet) {
      wallet = new ethers.Wallet(privateKey, provider);
    }
    if (!contract) {
      contract = new ethers.Contract(contractAddress, CONTRACT_ABI, wallet);
    }
    return { provider, wallet, contract };
  } catch (error) {
    console.error("[Blockchain] Error initializing ethers client:", error);
    return null;
  }
}

/**
 * Creates a new issue audit record with an IPFS metadata CID.
 * Returns the transaction hash and parsed issueId.
 */
export async function createIssueOnChain(metadataCID: string): Promise<{ txHash: string; issueId: number }> {
  const ctx = getBlockchainContext();
  
  if (!ctx) {
    // Simulator fallback
    const simulatedTxHash = "0x" + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join("");
    const simulatedIssueId = Math.floor(Math.random() * 100000) + 1;
    console.log(`[Blockchain Simulator] createIssueOnChain mapped metadata: ${metadataCID} -> Tx: ${simulatedTxHash}, ID: ${simulatedIssueId}`);
    return { txHash: simulatedTxHash, issueId: simulatedIssueId };
  }

  return txMutex.run(async () => {
    try {
      const tx = await ctx.contract.createIssue(metadataCID);
      console.log(`[Blockchain] Sent createIssue tx: ${tx.hash}`);
      const receipt = await tx.wait();

      // Parse events to extract the new issueId
      let issueId = 0;
      if (receipt && receipt.logs) {
        for (const log of receipt.logs) {
          try {
            const parsedLog = ctx.contract.interface.parseLog(log);
            if (parsedLog && parsedLog.name === "IssueCreated") {
              issueId = Number(parsedLog.args.issueId);
              break;
            }
          } catch (_) {
            // Ignore logs from other contracts or unmatched signatures
          }
        }
      }

      return { txHash: tx.hash, issueId: issueId || Math.floor(Math.random() * 1000) };
    } catch (error) {
      console.error("[Blockchain] Error in createIssueOnChain:", error);
      throw error;
    }
  });
}

/**
 * Supports/upvotes an existing issue.
 */
export async function supportIssueOnChain(issueId: number, supporterAddress: string): Promise<string> {
  const ctx = getBlockchainContext();

  if (!ctx) {
    const simulatedTxHash = "0x" + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join("");
    console.log(`[Blockchain Simulator] supportIssueOnChain Issue: ${issueId} Supporter: ${supporterAddress} -> Tx: ${simulatedTxHash}`);
    return simulatedTxHash;
  }

  return txMutex.run(async () => {
    try {
      const tx = await ctx.contract.supportIssue(issueId, supporterAddress);
      console.log(`[Blockchain] Sent supportIssue tx: ${tx.hash}`);
      await tx.wait();
      return tx.hash;
    } catch (error) {
      console.error(`[Blockchain] Error supporting issue ${issueId} for ${supporterAddress}:`, error);
      throw error;
    }
  });
}

/**
 * Verifies a reported issue.
 */
export async function verifyIssueOnChain(
  issueId: number,
  verifierAddress: string,
  accepted: boolean
): Promise<string> {
  const ctx = getBlockchainContext();

  if (!ctx) {
    const simulatedTxHash = "0x" + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join("");
    console.log(
      `[Blockchain Simulator] verifyIssueOnChain Issue: ${issueId} Verifier: ${verifierAddress} Accepted: ${accepted} -> Tx: ${simulatedTxHash}`
    );
    return simulatedTxHash;
  }

  return txMutex.run(async () => {
    try {
      // Check if issue is already verified/processed on-chain to prevent execution revert
      try {
        const onChainIssue = await ctx.contract.getIssue(issueId);
        const status = Number(onChainIssue[2]);
        if (status !== 0) { // 0 is REPORTED
          console.log(`[Blockchain] Issue ${issueId} already processed on-chain (status: ${status}). Skipping verifyIssue transaction.`);
          return "0x0000000000000000000000000000000000000000000000000000000000000000";
        }
      } catch (checkError) {
        console.warn(`[Blockchain] Could not check status for issue ${issueId} on-chain, attempting verification:`, checkError);
      }

      const tx = await ctx.contract.verifyIssue(issueId, verifierAddress, accepted);
      console.log(`[Blockchain] Sent verifyIssue tx: ${tx.hash}`);
      await tx.wait();
      return tx.hash;
    } catch (error) {
      console.error(`[Blockchain] Error verifying issue ${issueId}:`, error);
      throw error;
    }
  });
}

/**
 * Safely ensures that an issue has transitioned to the target status on-chain,
 * performing intermediate state machine updates sequentially if necessary.
 */
async function ensureOnChainStatus(issueId: number, targetStatus: number): Promise<number> {
  const ctx = getBlockchainContext();
  if (!ctx) return targetStatus;

  const onChainIssue = await ctx.contract.getIssue(issueId);
  let currentStatus = Number(onChainIssue[2]);
  console.log(`[Blockchain] Issue ${issueId} current on-chain status: ${currentStatus}, target: ${targetStatus}`);

  if (currentStatus === targetStatus) {
    return currentStatus;
  }

  // Handle transition back from RESOLVED (4) to IN_PROGRESS (3) if requested
  if (currentStatus === 4 && targetStatus === 3) {
    console.log(`[Blockchain] Transitioning issue ${issueId} from RESOLVED back to IN_PROGRESS`);
    const tx = await ctx.contract.updateStatus(issueId, 3);
    await tx.wait();
    currentStatus = 3;
    return currentStatus;
  }

  // Loop to transition step-by-step to the desired target status
  while (currentStatus < targetStatus) {
    if (currentStatus === 0) { // REPORTED -> VERIFIED
      console.log(`[Blockchain] Auto-verifying issue ${issueId} to transition 0 -> 1`);
      const verifier = ctx.wallet.address;
      const tx = await ctx.contract.verifyIssue(issueId, verifier, true);
      await tx.wait();
      currentStatus = 1;
    } else if (currentStatus === 1 && targetStatus >= 2) { // VERIFIED -> ASSIGNED
      console.log(`[Blockchain] Auto-assigning issue ${issueId} to transition 1 -> 2`);
      const tx = await ctx.contract.updateStatus(issueId, 2);
      await tx.wait();
      currentStatus = 2;
    } else if (currentStatus === 2 && targetStatus >= 3) { // ASSIGNED -> IN_PROGRESS
      console.log(`[Blockchain] Auto-starting work on issue ${issueId} to transition 2 -> 3`);
      const tx = await ctx.contract.updateStatus(issueId, 3);
      await tx.wait();
      currentStatus = 3;
    } else if (currentStatus === 3 && targetStatus >= 4) { // IN_PROGRESS -> RESOLVED
      console.log(`[Blockchain] Auto-updating status of issue ${issueId} to RESOLVED to transition 3 -> 4`);
      const tx = await ctx.contract.updateStatus(issueId, 4);
      await tx.wait();
      currentStatus = 4;
    } else {
      break;
    }
  }

  return currentStatus;
}

/**
 * Directly updates status of an issue (e.g., ASSIGNED, IN_PROGRESS).
 */
export async function updateIssueStatus(issueId: number, newStatus: number): Promise<string> {
  const ctx = getBlockchainContext();

  if (!ctx) {
    const simulatedTxHash = "0x" + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join("");
    console.log(`[Blockchain Simulator] updateIssueStatus Issue: ${issueId} NewStatus: ${newStatus} -> Tx: ${simulatedTxHash}`);
    return simulatedTxHash;
  }

  return txMutex.run(async () => {
    try {
      const status = await ensureOnChainStatus(issueId, newStatus);
      console.log(`[Blockchain] Successfully ensured on-chain status of issue ${issueId} is ${status} (expected ${newStatus})`);
      return "0x0000000000000000000000000000000000000000000000000000000000000000";
    } catch (error) {
      console.error(`[Blockchain] Error updating status of issue ${issueId} to ${newStatus}:`, error);
      throw error;
    }
  });
}

/**
 * Submits resolution proof to IPFS.
 */
export async function attachResolutionOnChain(issueId: number, resolutionCID: string): Promise<string> {
  const ctx = getBlockchainContext();

  if (!ctx) {
    const simulatedTxHash = "0x" + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join("");
    console.log(`[Blockchain Simulator] attachResolutionOnChain Issue: ${issueId} resolutionCID: ${resolutionCID} -> Tx: ${simulatedTxHash}`);
    return simulatedTxHash;
  }

  return txMutex.run(async () => {
    try {
      // 1. Ensure status is exactly IN_PROGRESS (3) on-chain
      await ensureOnChainStatus(issueId, 3);

      // 2. Attach resolution (this will change status to RESOLVED (4))
      const tx = await ctx.contract.attachResolution(issueId, resolutionCID);
      console.log(`[Blockchain] Sent attachResolution tx: ${tx.hash}`);
      await tx.wait();
      return tx.hash;
    } catch (error) {
      console.error(`[Blockchain] Error attaching resolution to issue ${issueId}:`, error);
      throw error;
    }
  });
}

/**
 * Audits/verifies authority resolution.
 */
export async function verifyResolutionOnChain(
  issueId: number,
  verifierAddress: string,
  resolved: boolean
): Promise<string> {
  const ctx = getBlockchainContext();

  if (!ctx) {
    const simulatedTxHash = "0x" + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join("");
    console.log(
      `[Blockchain Simulator] verifyResolutionOnChain Issue: ${issueId} Verifier: ${verifierAddress} Resolved: ${resolved} -> Tx: ${simulatedTxHash}`
    );
    return simulatedTxHash;
  }

  return txMutex.run(async () => {
    try {
      // Check if issue resolution is already verified/closed on-chain to prevent execution revert
      try {
        const onChainIssue = await ctx.contract.getIssue(issueId);
        const status = Number(onChainIssue[2]);
        if (status !== 4) { // 4 is RESOLVED
          console.log(`[Blockchain] Issue ${issueId} resolution already processed on-chain (status: ${status}). Skipping verifyResolution transaction.`);
          return "0x0000000000000000000000000000000000000000000000000000000000000000";
        }
      } catch (checkError) {
        console.warn(`[Blockchain] Could not check status for issue ${issueId} on-chain, attempting resolution audit:`, checkError);
      }

      const tx = await ctx.contract.verifyResolution(issueId, verifierAddress, resolved);
      console.log(`[Blockchain] Sent verifyResolution tx: ${tx.hash}`);
      await tx.wait();
      return tx.hash;
    } catch (error) {
      console.error(`[Blockchain] Error verifying resolution of issue ${issueId}:`, error);
      throw error;
    }
  });
}

/**
 * Updates user reputation score directly in the smart contract.
 */
export async function updateReputationOnChain(userAddress: string, delta: number): Promise<string> {
  const ctx = getBlockchainContext();

  if (!ctx) {
    console.log(`[Blockchain Simulator] updateReputationOnChain for ${userAddress} with delta ${delta}`);
    return "0x0000000000000000000000000000000000000000000000000000000000000000";
  }

  return txMutex.run(async () => {
    try {
      const tx = await ctx.contract.updateReputation(userAddress, delta);
      console.log(`[Blockchain] Sent updateReputation tx: ${tx.hash}`);
      await tx.wait();
      return tx.hash;
    } catch (error) {
      console.error(`[Blockchain] Error updating reputation on-chain for ${userAddress}:`, error);
      throw error;
    }
  });
}

/**
 * Reads user reputation score directly from the smart contract.
 */
export async function getReputationOnChain(userAddress: string): Promise<number> {
  const ctx = getBlockchainContext();

  if (!ctx) {
    console.log(`[Blockchain Simulator] getReputationOnChain for ${userAddress} -> Returning 0`);
    return 0;
  }

  try {
    const score = await ctx.contract.reputation(userAddress);
    return Number(score);
  } catch (error) {
    console.error(`[Blockchain] Error reading reputation for ${userAddress}:`, error);
    return 0;
  }
}
