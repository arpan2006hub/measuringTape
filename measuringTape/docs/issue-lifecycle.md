# measuringTape - Issue Lifecycle Specification

This document defines the strict sequential state-machine lifecycle governing civic issues reported on the measuringTape platform.

---

## 1. Lifecycle State Machine Diagram

```
 [ REPORTED ] (Initial citizen report; coordinates and category registered)
      |
      |  Consensus: Min 5 votes + 70% EXISTS agreement
      v
 [ VERIFIED ] (Confirmed genuine defect; ready for municipal attention)
      |
      |  Action: Authority assigns the issue to a specialized department
      v
 [ ASSIGNED ] (Department assigned; planning and logistics set)
      |
      |  Action: Department logs construction/repair commencement
      v
 [ IN_PROGRESS ] (Active repair work underway on-site)
      |
      |  Action: Authority uploads proof of resolution (images + text CIDs)
      v
 [ RESOLVED ] (Audited status; under public citizen review)
      |
      |-- [Consensus Passed]: Min 5 votes + 70% RESOLVED agreement
      |   |
      |   +---> [ CLOSED ] (Immutable resolution archived; reputation rewarded)
      |
      +-- [Consensus Failed]: Min 5 votes + 70% NOT_RESOLVED agreement
          |
          +---> [ IN_PROGRESS ] (Reverts back; repair crew must re-execute)
```

---

## 2. State Rules and Operations

### 2.1. REPORTED
- **Creation:** Initiated by any citizen. Requires metadata IPFS CID (containing images and GPS coordinates).
- **Voter Access:** Active for verification voting. Open to all citizens subscribed to the issue's locality.
- **Allowed Transitions:** To `VERIFIED` (if verification consensus succeeds) or `CLOSED` / Deleted (if consensus decides the report is fraudulent or does not exist).
- **Core Stores affected:** `useIssueStore` and `useVerificationStore`.

### 2.2. VERIFIED
- **Condition:** Achieved when $\ge 5$ community votes are cast, and $\ge 70\%$ confirm `EXISTS`.
- **Voter Access:** Closed for verification voting.
- **Authority Access:** Exposing this issue on the municipal administrative dashboard as a prioritized item.
- **Allowed Transitions:** To `ASSIGNED` by authorized administration wallets.

### 2.3. ASSIGNED
- **Condition:** Triggered when an authority links an issue to a specialized contractor or municipal work department.
- **Voter Access:** Read-only. Citizens can view which contractor is assigned.
- **Allowed Transitions:** To `IN_PROGRESS` when work is physically started on-site.

### 2.4. IN_PROGRESS
- **Condition:** Triggered when the assigned repair crew signals construction or repair commencement.
- **Voter Access:** Read-only. Citizens can track work durations.
- **Allowed Transitions:** To `RESOLVED` when the contractor submits evidence of completion.

### 2.5. RESOLVED
- **Condition:** Achieved when the contractor uploads completing proof: images (pinned to IPFS) and descriptive notes.
- **Voter Access:** Active for resolution verification voting. Open to subscribed local citizens to confirm if the physical site matches the uploaded proof.
- **Allowed Transitions:**
  - To `CLOSED` (if community voting confirms successful resolution).
  - Reverts to `IN_PROGRESS` (if community voting rejects the resolution proof, signalling incomplete or sloppy work).

### 2.6. CLOSED
- **Condition:** Final terminal state. Community has audited and approved the physical resolution.
- **Voter Access:** Read-only archive.
- **Rewards Distribution:** Automated release of final reputation awards to all auditing citizens who aligned with the consensus.
- **Allowed Transitions:** None. This is an immutable end state representing public service completion.
