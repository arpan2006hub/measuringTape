/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import dotenv from 'dotenv';
dotenv.config();

const PINATA_JWT = process.env.PINATA_JWT;
const PINATA_API_KEY = process.env.PINATA_API_KEY;
const PINATA_API_SECRET = process.env.PINATA_API_SECRET;

export interface IssueMetadata {
  title: string;
  description: string;
  category: string;
  locality: string;
  latitude: number;
  longitude: number;
  imageCID: string;
}

/**
 * Uploads a base64 encoded image to Pinata IPFS.
 * Falls back to a simulated CID if Pinata credentials are not provided.
 */
export async function uploadImage(base64Data: string, filename: string = 'evidence.png'): Promise<string> {
  // If base64 has standard data URI prefix, parse it out
  let base64Clean = base64Data;
  let mimeType = 'image/png';
  
  if (base64Data.startsWith('data:')) {
    const parts = base64Data.split(';base64,');
    if (parts.length === 2) {
      mimeType = parts[0].replace('data:', '');
      base64Clean = parts[1];
    }
  }

  // If no credentials are found, log a warning and return a mock hash for frictionless UI testing
  if (!PINATA_JWT && !(PINATA_API_KEY && PINATA_API_SECRET)) {
    console.warn('[Pinata] No credentials found in environment variables. Simulating image upload...');
    // Create a fake stable-looking CID
    return `QmSimulatedImageCID${Math.random().toString(36).substring(2, 14)}`;
  }

  try {
    const buffer = Buffer.from(base64Clean, 'base64');
    const blob = new Blob([buffer], { type: mimeType });
    const formData = new FormData();
    formData.append('file', blob, filename);

    const headers: Record<string, string> = {};
    if (PINATA_JWT) {
      headers['Authorization'] = `Bearer ${PINATA_JWT}`;
    } else {
      headers['pinata_api_key'] = PINATA_API_KEY || '';
      headers['pinata_secret_api_key'] = PINATA_API_SECRET || '';
    }

    const response = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
      method: 'POST',
      headers,
      body: formData,
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Pinata upload failed (${response.status}): ${errText}`);
    }

    const result = await response.json() as { IpfsHash: string };
    return result.IpfsHash;
  } catch (error) {
    console.error('[Pinata] Error in uploadImage:', error);
    throw error;
  }
}

/**
 * Uploads structured metadata JSON to Pinata IPFS.
 * Falls back to a simulated CID if Pinata credentials are not provided.
 */
export async function uploadMetadata(metadata: any): Promise<string> {
  if (!PINATA_JWT && !(PINATA_API_KEY && PINATA_API_SECRET)) {
    console.warn('[Pinata] No credentials found in environment variables. Simulating metadata upload...');
    return `QmSimulatedMetadataCID${Math.random().toString(36).substring(2, 14)}`;
  }

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (PINATA_JWT) {
      headers['Authorization'] = `Bearer ${PINATA_JWT}`;
    } else {
      headers['pinata_api_key'] = PINATA_API_KEY || '';
      headers['pinata_secret_api_key'] = PINATA_API_SECRET || '';
    }

    const body = JSON.stringify({
      pinataContent: metadata,
      pinataMetadata: {
        name: `metadata-${Date.now()}.json`,
      },
    });

    const response = await fetch('https://api.pinata.cloud/pinning/pinJSONToIPFS', {
      method: 'POST',
      headers,
      body,
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Pinata metadata pinning failed (${response.status}): ${errText}`);
    }

    const result = await response.json() as { IpfsHash: string };
    return result.IpfsHash;
  } catch (error) {
    console.error('[Pinata] Error in uploadMetadata:', error);
    throw error;
  }
}
