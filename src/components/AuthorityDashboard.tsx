/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { useIssueStore } from '@/measuringTape/src/store/useIssueStore';
import { useAuthorityStore } from '@/measuringTape/src/store/useAuthorityStore';
import { useUserStore } from '@/measuringTape/src/store/useUserStore';
import { IssueStatus, Issue } from '@/measuringTape/src/types/issue';
import { calculateDistance } from '@/measuringTape/src/utils/haversine';
import ImageUploader from './ImageUploader';
import { 
  Building2, 
  MapPin, 
  UserCheck, 
  Wrench, 
  CheckCircle, 
  AlertCircle, 
  Clock, 
  ChevronRight, 
  UploadCloud, 
  Loader2,
  Inbox,
  Lock,
  ArrowRight,
  ThumbsUp,
  Calendar,
  X,
  FileCheck2
} from 'lucide-react';

export default function AuthorityDashboard() {
  const { issues, fetchIssues, updateIssueStatusLocal } = useIssueStore();
  const { 
    actions, 
    assignIssue, 
    startWork, 
    submitResolution, 
    fetchActionsForIssue,
    isLoading: storeLoading 
  } = useAuthorityStore();

  const { currentUser } = useUserStore();

  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);
  const [assignedToInput, setAssignedToInput] = useState('0xContractor_' + Math.floor(Math.random() * 9000 + 1000));
  const [notesInput, setNotesInput] = useState('');
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [resolutionImage, setResolutionImage] = useState<string | undefined>(undefined);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Authority Admin Address
  const authorityAddress = currentUser?.address || '0xMunicipalAdminAddress';

  useEffect(() => {
    fetchIssues();
  }, [fetchIssues]);

  useEffect(() => {
    if (selectedIssueId) {
      fetchActionsForIssue(selectedIssueId);
    }
    setError(null);
    setSuccessMsg(null);
  }, [selectedIssueId, fetchActionsForIssue]);

  const allIssues = Object.values(issues);

  // Filter issues based on the authority's registered region
  const filteredIssuesByRegion = allIssues.filter(issue => {
    // If no subscribed localities or not an authority, show all
    if (!currentUser || currentUser.role !== 'AUTHORITY' || !currentUser.subscribedLocalities || currentUser.subscribedLocalities.length === 0) {
      return true;
    }
    
    // Check if the issue falls within any of the municipality's subscribed localities
    return currentUser.subscribedLocalities.some(locality => {
      if (!locality.centerLocation || !issue.location) return false;
      const distance = calculateDistance(issue.location, locality.centerLocation);
      // Extend the boundary radius by 10km (10000m) to include outskirt regions!
      const extendedRadius = (locality.boundaryRadiusMeters || 50000) + 10000;
      return distance <= extendedRadius;
    });
  });

  // Filter issues for the 4 lifecycle stages using filtered issues by region
  const verifiedIssues = filteredIssuesByRegion.filter(i => i.status === IssueStatus.VERIFIED);
  const assignedIssues = filteredIssuesByRegion.filter(i => i.status === IssueStatus.ASSIGNED);
  const inProgressIssues = filteredIssuesByRegion.filter(i => i.status === IssueStatus.IN_PROGRESS);
  const resolvedIssues = filteredIssuesByRegion.filter(i => i.status === IssueStatus.RESOLVED);

  const selectedIssue = selectedIssueId ? issues[selectedIssueId] : null;

  const handleAssign = async () => {
    if (!selectedIssueId || !selectedIssue) return;
    setIsSubmitting(true);
    setError(null);
    setSuccessMsg(null);
    try {
      // Direct blockchain status update integration
      const response = await fetch('/api/blockchain/update-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          issueId: selectedIssue.id.replace('issue_', ''),
          newStatus: 2 // ASSIGNED
        })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to update status to ASSIGNED on-chain.');
      }

      const resData = await response.json();
      console.log(`[Blockchain] Status updated to ASSIGNED on-chain. Tx: ${resData.txHash}`);

      await assignIssue(selectedIssue.id, assignedToInput, authorityAddress, notesInput || 'Assigned to municipal contractor.');
      setSuccessMsg('Issue assigned successfully on-chain!');
      setNotesInput('');
      fetchIssues();
    } catch (err: any) {
      setError(err.message || 'Assignment failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStartWork = async () => {
    if (!selectedIssueId || !selectedIssue) return;
    setIsSubmitting(true);
    setError(null);
    setSuccessMsg(null);
    try {
      // Direct blockchain status update integration
      const response = await fetch('/api/blockchain/update-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          issueId: selectedIssue.id.replace('issue_', ''),
          newStatus: 3 // IN_PROGRESS
        })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to update status to IN_PROGRESS on-chain.');
      }

      const resData = await response.json();
      console.log(`[Blockchain] Status updated to IN_PROGRESS on-chain. Tx: ${resData.txHash}`);

      await startWork(selectedIssue.id, authorityAddress, 'Contractor has commenced physical excavation and repair.');
      setSuccessMsg('Work progress started and updated on-chain!');
      fetchIssues();
    } catch (err: any) {
      setError(err.message || 'Failed to start work');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResolve = async () => {
    if (!selectedIssueId || !selectedIssue) return;
    if (!resolutionNotes.trim()) {
      setError('Please provide detailed resolution notes.');
      return;
    }
    if (!resolutionImage) {
      setError('A photographic evidence of the resolved issue is required.');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setSuccessMsg(null);

    try {
      // 1. Upload image to Pinata
      // 2. Create resolution metadata
      // 3. Upload metadata
      // The server `/api/ipfs/upload-resolution` endpoint performs steps 1, 2, and 3 securely.
      const ipfsResponse = await fetch('/api/ipfs/upload-resolution', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: resolutionImage,
          notes: resolutionNotes,
          resolverAddress: authorityAddress
        })
      });

      if (!ipfsResponse.ok) {
        const errData = await ipfsResponse.json();
        throw new Error(errData.error || 'Failed to upload resolution proof to IPFS via Pinata.');
      }

      const { imageCID, resolutionCID } = await ipfsResponse.json();
      console.log(`[IPFS] Resolution uploaded. Image CID: ${imageCID}, Metadata CID: ${resolutionCID}`);

      // 4. Call attachResolution() on blockchain
      const attachResponse = await fetch('/api/blockchain/attach-resolution', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          issueId: selectedIssue.id.replace('issue_', ''),
          resolutionCID
        })
      });

      if (!attachResponse.ok) {
        const errData = await attachResponse.json();
        throw new Error(errData.error || 'Failed to attach resolution to the smart contract.');
      }

      const attachData = await attachResponse.json();
      console.log(`[Blockchain] Attached resolution on-chain. Tx: ${attachData.txHash}`);

      // 5. Call updateStatus() to mark as RESOLVED on blockchain (redundant but kept safe)
      try {
        const statusResponse = await fetch('/api/blockchain/update-status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            issueId: selectedIssue.id.replace('issue_', ''),
            newStatus: 4 // RESOLVED
          })
        });

        if (statusResponse.ok) {
          const statusData = await statusResponse.json();
          console.log(`[Blockchain] Status marked as RESOLVED on-chain. Tx: ${statusData.txHash}`);
        } else {
          const errData = await statusResponse.json();
          console.warn('[Blockchain] Non-blocking status update notice:', errData.error);
        }
      } catch (statusErr) {
        console.warn('[Blockchain] Redundant status update skipped/failed gracefully:', statusErr);
      }

      // Submit resolution to local state
      await submitResolution(selectedIssue.id, imageCID, resolutionNotes, authorityAddress);

      // Update the local issue with resolution details
      updateIssueStatusLocal(selectedIssue.id, IssueStatus.RESOLVED, {
        resolutionCid: resolutionCID,
        resolution: {
          notes: resolutionNotes,
          imageCid: imageCID,
          resolvedAt: new Date().toISOString(),
          resolverAddress: authorityAddress
        }
      });

      setSuccessMsg('Resolution proofs published on IPFS and registered on-chain successfully!');
      setResolutionNotes('');
      setResolutionImage(undefined);
      fetchIssues();
    } catch (err: any) {
      console.error('[Resolution Error]', err);
      setError(err.message || 'Failed to submit resolution.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const renderIssueCard = (issue: Issue) => {
    const isSelected = selectedIssueId === issue.id;
    return (
      <div
        key={issue.id}
        onClick={() => setSelectedIssueId(issue.id)}
        className={`group p-4 bg-white border rounded-xl hover:border-zinc-400 hover:shadow-sm cursor-pointer transition-all duration-200 text-left space-y-3 ${
          isSelected ? 'ring-2 ring-zinc-900 border-transparent bg-zinc-50/10' : 'border-zinc-200'
        }`}
      >
        <div className="flex items-start justify-between gap-2">
          <span className="text-[10px] font-bold font-mono bg-zinc-100 text-zinc-700 px-2 py-0.5 rounded-md uppercase tracking-wider">
            {issue.category.replace('_', ' ')}
          </span>
          <span className="text-[10px] font-semibold text-zinc-500 font-mono">
            {issue.locality}
          </span>
        </div>

        <h4 className="font-bold text-zinc-900 text-xs leading-snug group-hover:text-zinc-950 transition-colors line-clamp-2">
          {issue.title}
        </h4>

        <div className="flex items-center justify-between border-t border-zinc-100 pt-2.5 text-[10px] text-zinc-400 font-medium">
          <span className="flex items-center gap-1">
            <Calendar className="w-3 h-3 text-zinc-300" />
            {formatDate(issue.createdAt)}
          </span>
          <span className="flex items-center gap-1 font-semibold text-zinc-600">
            <ThumbsUp className="w-3 h-3 text-zinc-400" />
            {issue.supportCount} Support
          </span>
        </div>
      </div>
    );
  };

  const stages = [
    { key: IssueStatus.VERIFIED, label: 'Verified', color: 'border-t-amber-500 bg-amber-50/20 text-amber-900', list: verifiedIssues },
    { key: IssueStatus.ASSIGNED, label: 'Assigned', color: 'border-t-indigo-500 bg-indigo-50/20 text-indigo-900', list: assignedIssues },
    { key: IssueStatus.IN_PROGRESS, label: 'In Progress', color: 'border-t-purple-500 bg-purple-50/20 text-purple-900', list: inProgressIssues },
    { key: IssueStatus.RESOLVED, label: 'Resolved', color: 'border-t-emerald-500 bg-emerald-50/20 text-emerald-900', list: resolvedIssues },
  ];

  return (
    <div className="space-y-6">
      
      {/* 1. Header & Authority Context */}
      <div className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h3 className="font-bold text-zinc-900 text-sm flex items-center gap-2">
            <Building2 className="w-4 h-4 text-zinc-800" />
            MUNICIPAL AUTHORITY MANAGEMENT
          </h3>
          <p className="text-xs text-zinc-500 mt-0.5">
            Advance verified reports through repairs and publish resolution proofs for community audits.
          </p>
        </div>
        {currentUser?.subscribedLocalities && currentUser.subscribedLocalities.length > 0 && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50/60 border border-emerald-200 rounded-xl text-emerald-800 shrink-0 self-start sm:self-center">
            <MapPin className="w-4 h-4 text-emerald-600 shrink-0" />
            <div className="text-left">
              <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">Managing Region</div>
              <div className="text-xs font-bold text-emerald-950">
                {currentUser.subscribedLocalities[0].name}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 2. Main Layout splits stages grid and detail console */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        
        {/* Stages columns (3 cols) */}
        <div className={`lg:col-span-3 transition-all duration-300`}>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {stages.map((stage) => (
              <div 
                key={stage.key}
                className="bg-zinc-50/50 border border-zinc-200/80 rounded-2xl p-3 flex flex-col min-h-[400px]"
              >
                {/* Column header */}
                <div className="flex items-center justify-between mb-3 pb-2 border-b border-zinc-200/60">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-zinc-900" />
                    <h4 className="font-bold text-xs uppercase text-zinc-700 tracking-wider">
                      {stage.label}
                    </h4>
                  </div>
                  <span className="text-[10px] font-bold bg-zinc-200/80 text-zinc-600 px-2 py-0.5 rounded-full font-mono">
                    {stage.list.length}
                  </span>
                </div>

                {/* Cards Container */}
                <div className="flex-1 space-y-3 overflow-y-auto max-h-[550px] p-1.5">
                  {stage.list.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center p-4 py-12 border-2 border-dashed border-zinc-200 rounded-xl bg-white/50">
                      <Inbox className="w-6 h-6 text-zinc-300 mb-2" />
                      <p className="text-[10px] font-medium text-zinc-400 uppercase tracking-wider">Empty stage</p>
                    </div>
                  ) : (
                    stage.list.map(renderIssueCard)
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Selected Issue Detail & Control Panel (2 cols) */}
        <div className="lg:col-span-2">
          {selectedIssue ? (
            <div className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-xs space-y-5 relative animate-in fade-in slide-in-from-right-4 duration-200">
              
              {/* Close Button to Deselect */}
              <button
                onClick={() => setSelectedIssueId(null)}
                className="absolute top-4 right-4 p-1 rounded-full text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 transition-colors cursor-pointer"
                title="Deselect issue"
              >
                <X className="w-4.5 h-4.5" />
              </button>

              {/* Header Info */}
              <div className="border-b border-zinc-100 pb-3.5 pr-6">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full ${
                    selectedIssue.status === IssueStatus.VERIFIED ? 'bg-amber-100 text-amber-800 border border-amber-200' :
                    selectedIssue.status === IssueStatus.ASSIGNED ? 'bg-indigo-100 text-indigo-800 border border-indigo-200' :
                    selectedIssue.status === IssueStatus.IN_PROGRESS ? 'bg-purple-100 text-purple-800 border border-purple-200' :
                    'bg-emerald-100 text-emerald-800 border border-emerald-200'
                  }`}>
                    {selectedIssue.status}
                  </span>
                  <span className="text-[10px] bg-zinc-100 text-zinc-500 px-2 py-0.5 rounded font-mono font-bold">
                    ID: {selectedIssue.id}
                  </span>
                </div>
                <h3 className="font-bold text-zinc-900 text-base mt-2.5 leading-tight">{selectedIssue.title}</h3>
                <p className="text-xs text-zinc-500 mt-1.5 leading-relaxed">{selectedIssue.description}</p>
                <div className="mt-3 flex items-center gap-3 text-[10px] text-zinc-400 font-medium">
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-zinc-300" />
                    {selectedIssue.locality}
                  </span>
                  <span>•</span>
                  <span>Reported {formatDate(selectedIssue.createdAt)}</span>
                </div>
              </div>

              {/* Action Console Card */}
              <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-5 space-y-4">
                <div className="flex items-center gap-1.5 text-xs font-bold text-zinc-700 uppercase border-b border-zinc-200 pb-2.5">
                  <Wrench className="w-4 h-4 text-zinc-600" />
                  LIFECYCLE OPERATIONS
                </div>

                {error && (
                  <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg text-xs font-medium flex items-start gap-2 animate-in fade-in">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    <span>{error}</span>
                  </div>
                )}

                {successMsg && (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs font-semibold flex items-start gap-2 animate-in fade-in">
                    <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>{successMsg}</span>
                  </div>
                )}

                {/* 1. VERIFIED -> ASSIGNED */}
                {selectedIssue.status === IssueStatus.VERIFIED && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider">
                        Assign Contractor Wallet Address
                      </label>
                      <input
                        type="text"
                        value={assignedToInput}
                        onChange={(e) => setAssignedToInput(e.target.value)}
                        className="w-full text-xs font-mono bg-white border border-zinc-200 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900 transition-all"
                        placeholder="0xContractorAddress..."
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider">
                        Assignment notes / directives
                      </label>
                      <textarea
                        value={notesInput}
                        onChange={(e) => setNotesInput(e.target.value)}
                        className="w-full text-xs bg-white border border-zinc-200 rounded-lg p-2.5 h-16 resize-none focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900 transition-all"
                        placeholder="Define work directives, repair standards, or contractor instructions..."
                      />
                    </div>
                    <button
                      onClick={handleAssign}
                      disabled={isSubmitting}
                      className="w-full py-3 bg-zinc-950 text-white hover:bg-zinc-800 active:scale-98 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:scale-100"
                    >
                      {isSubmitting ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <UserCheck className="w-4 h-4" />
                      )}
                      AUTHORIZE CONTRACTOR & ASSIGN ISSUE
                    </button>
                  </div>
                )}

                {/* 2. ASSIGNED -> IN_PROGRESS */}
                {selectedIssue.status === IssueStatus.ASSIGNED && (
                  <div className="space-y-4 text-center py-2">
                    <div className="p-3 bg-white border border-zinc-200 rounded-xl space-y-1 text-left">
                      <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Assigned Contractor</p>
                      <p className="text-xs font-mono font-bold text-zinc-800 break-all">{selectedIssue.assignedTo || 'Assigned Department'}</p>
                    </div>

                    <p className="text-xs text-zinc-500 leading-relaxed max-w-sm mx-auto">
                      Acknowledge physical contractor mobilization and transition the lifecycle to actively undergoing repair.
                    </p>

                    <button
                      onClick={handleStartWork}
                      disabled={isSubmitting}
                      className="w-full py-3 bg-zinc-950 text-white hover:bg-zinc-800 active:scale-98 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:scale-100"
                    >
                      {isSubmitting ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Wrench className="w-4 h-4" />
                      )}
                      CONFIRM WORK START (MARK IN PROGRESS)
                    </button>
                  </div>
                )}

                {/* 3. IN_PROGRESS -> RESOLVED */}
                {selectedIssue.status === IssueStatus.IN_PROGRESS && (
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider">
                        Upload Resolution Image Proof
                      </label>
                      <ImageUploader
                        previewUrl={resolutionImage}
                        onChange={(val) => setResolutionImage(val)}
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider">
                        Resolution Explanation Notes
                      </label>
                      <textarea
                        value={resolutionNotes}
                        onChange={(e) => setResolutionNotes(e.target.value)}
                        className="w-full text-xs bg-white border border-zinc-200 rounded-lg p-2.5 h-20 resize-none focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900 transition-all"
                        placeholder="Detail materials used, construction details, and physical resolution state..."
                      />
                    </div>

                    <button
                      onClick={handleResolve}
                      disabled={isSubmitting}
                      className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:scale-100 shadow-sm"
                    >
                      {isSubmitting ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <UploadCloud className="w-4 h-4" />
                      )}
                      MARK AS RESOLVED
                    </button>
                  </div>
                )}

                {/* 4. RESOLVED */}
                {selectedIssue.status === IssueStatus.RESOLVED && (
                  <div className="space-y-3.5 text-center py-6 bg-white border border-zinc-200/60 rounded-xl">
                    <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
                      <FileCheck2 className="w-5 h-5" />
                    </div>
                    <div className="space-y-1">
                      <h4 className="font-bold text-xs uppercase tracking-wider text-zinc-800">
                        Waiting for Community Verification
                      </h4>
                      <p className="text-[11px] text-zinc-400 leading-relaxed max-w-xs mx-auto">
                        This issue resolution is undergoing citizen consensus auditing. Local residents must review and verify the site repairs.
                      </p>
                    </div>
                  </div>
                )}

              </div>

              {/* Historical Log Audit Trail */}
              {(() => {
                const issueActions = actions[selectedIssue.id] || [];
                return (
                  <div className="space-y-2 border-t border-zinc-100 pt-4">
                    <h5 className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                      Audit Trail & Operations Logs
                    </h5>
                    {issueActions.length === 0 ? (
                      <p className="text-[10px] text-zinc-400 italic">No operations logged for this issue yet.</p>
                    ) : (
                      <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
                        {issueActions.map((act) => (
                          <div key={act.id} className="bg-zinc-50 border border-zinc-200/50 p-3 rounded-xl space-y-1 text-[11px]">
                            <div className="flex justify-between items-center text-[10px]">
                              <span className="font-bold text-zinc-700 flex items-center gap-1 font-mono text-[9px] bg-zinc-200/60 px-1.5 py-0.5 rounded">
                                {act.statusTransition.from} → {act.statusTransition.to}
                              </span>
                              <span className="text-zinc-400 font-medium">{new Date(act.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                            <p className="text-zinc-600 font-medium leading-normal">&ldquo;{act.notes}&rdquo;</p>
                            <p className="text-[9px] text-zinc-400 font-mono flex items-center gap-1 mt-0.5">
                              By: {act.authorityAddress.substring(0, 10)}...{act.authorityAddress.slice(-4)}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}

            </div>
          ) : (
            <div className="bg-white border border-zinc-200 rounded-2xl p-12 text-center shadow-xs flex flex-col justify-center items-center min-h-[400px]">
              <Building2 className="w-12 h-12 text-zinc-300 mb-4 animate-pulse" />
              <h3 className="font-bold text-zinc-800 text-sm">Select Municipal Task</h3>
              <p className="text-xs text-zinc-400 mt-1 max-w-xs leading-relaxed">
                Choose an active task from any stage of the lifecycle grid to authorize contractors, manage progress, and register resolution evidence on-chain.
              </p>
            </div>
          )}
        </div>

      </div>

    </div>
  );
}
