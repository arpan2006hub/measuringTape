# measuringTape - Data Flow Sequences

This document outlines the step-by-step technical sequences and communications mapping out the platform's core functional behaviors.

---

## 1. Issue Reporting Sequence

This flow illustrates how a Citizen reports a public defect, detailing how the Web App handles duplicate queries, uploads assets to IPFS, and executes gasless transactions on the blockchain.

```
 Citizen            Web UI            NextJS API           IPFS (Pinata)        Blockchain
   |                  |                    |                     |                   |
   |--- Submit ------>|                    |                     |                   |
   |    Report        |                    |                     |                   |
   |                  |--- Get Issues ---->|                     |                   |
   |                  |<-- Active List ----|                     |                   |
   |                  |                    |                     |                   |
   |                  |-- [Duplicate Check]|                     |                   |
   |                  |   (Haversine < 20m)|                     |                   |
   |                  |                    |                     |                   |
   |                  |--- Upload Image ------------------------>|                   |
   |                  |<-- Image CID ----------------------------|                   |
   |                  |                    |                     |                   |
   |                  |--- Create & Upload Metadata ------------>|                   |
   |                  |<-- Metadata CID -------------------------|                   |
   |                  |                    |                     |                   |
   |                  |------------------- Dispatch ------------>|                   |
   |                  |                    Tx(CID, Category)     |                   |
   |                  |                    |                     |--- Sign & Tx ---->|
   |                  |                    |                     |    (Custodial)    |
   |                  |                    |<-- Tx Hash -----------------------------|
   |                  |<-- Report Success -|                     |                   |
   v                  v                    v                     v                   v
```

### Flow Details
1. **Reporting Input:** Citizen provides details (title, description, category, coordinates, and image file) in the dashboard.
2. **Deterministic Duplicate Search:** The client uses the Haversine formula (from `useIssueStore`) to compare the reported GPS coordinates with existing unresolved issues of the same category. If an existing issue is found within 20 meters, the citizen is warned and prompted to either "Support existing issue" or "Proceed with caution".
3. **Decentralized asset anchoring:**
   - The raw image is pinned to Pinata, returning the `imageCid`.
   - A standardized metadata JSON containing coordinates and details is constructed and pinned to Pinata, returning the `metadataCid`.
4. **Gasless Blockchain Dispatch:** The client calls the custodial endpoint `/api/issues/create`. The server signs a transaction using the custodial platform wallet and invokes `createIssue(metadataCID, category, reporterAddress)` on the smart contract.
5. **Ledger Registry:** The smart contract indexes the new issue, sets its state to `REPORTED`, and emits a public event containing the global sequential Issue ID.

---

## 2. Locality Subscription & Verification Flow

This sequence shows how only localized citizens are exposed to reports, cast voting weight, and trigger community consensus updates.

```
 Citizen          User Store         Issue Store       Verification Store       Blockchain
   |                  |                   |                     |                    |
   |-- Subscribe ---->|                   |                     |                    |
   |   "Ward A"       |                   |                     |                    |
   |                  |                   |                     |                    |
   |-- View Feed ---->|--- Get Subbed --->|                     |                    |
   |                  |    Localities     |                     |                    |
   |                  |                   |-- Filtered Issues ->|                    |
   |                  |<-- Local Feed --------------------------|                    |
   |                  |                   |                     |                    |
   |-- Cast Vote ---------------------------------------------->|                    |
   |   (EXISTS)       |                   |                     |--- Gasless Call -->|
   |                  |                   |                     |    voteVerify()    |
   |                  |                   |                     |<-- Update Emitted -|
   |                  |                   |<-- Status changed --|                    |
   |                  |                   |    (VERIFIED)       |                    |
   |                  |<-- Reward +5 -----|                     |                    |
   |                  |    Reputation     |                     |                    |
   v                  v                   v                     v                    v
```

### Flow Details
1. **Locality Ingestion:** Citizens subscribe to areas they frequent (e.g. `WARD_A`). This lists them as verifiers for that locality.
2. **Dashboard Querying:** `useIssueStore` returns only issues flagged as `REPORTED` within the citizen's subscribed localities.
3. **Audit Weight Attribution:** When the citizen casts a verification vote (`EXISTS` or `DOES_NOT_EXIST`), the transaction queries the citizen's current on-chain voting weight.
4. **Consensus Resolution:** The smart contract stores the vote.
   - If cumulative votes are $< 5$, status remains `REPORTED`.
   - If votes $\ge 5$ and $\ge 70\%$ agree on `EXISTS`, the contract triggers `status = VERIFIED` and issues a +5 reputation reward to all voters in the winning consensus group.
   - If $\ge 70\%$ agree on `DOES_NOT_EXIST`, the issue is marked as debunked, and misaligned reporters are penalized.
