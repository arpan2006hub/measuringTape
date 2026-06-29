/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { useIssueStore } from '@/measuringTape/src/store/useIssueStore';
import { useVerificationStore } from '@/measuringTape/src/store/useVerificationStore';
import { useUserStore } from '@/measuringTape/src/store/useUserStore';
import { VERIFICATION_RULES, RESOLUTION_RULES } from '@/measuringTape/src/constants';
import { IssueStatus, Issue, IssueCategory } from '@/measuringTape/src/types/issue';
import { VerificationChoice, ResolutionChoice, VerificationVote, ResolutionVote } from '@/measuringTape/src/types/vote';
import { calculateVerificationConsensus, calculateResolutionConsensus } from '@/measuringTape/src/utils/consensus';
import { calculateDistance } from '@/measuringTape/src/utils/haversine';
import LocationSearchAndSubscribe from './LocationSearchAndSubscribe';
import { 
  MapPin, 
  Map as MapIcon, 
  Vote, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  Clock, 
  Award,
  ChevronRight,
  Shield,
  ThumbsUp,
  Inbox,
  User,
  Zap,
  Check,
  X,
  RefreshCw,
  ExternalLink,
  Plus,
  X as CloseIcon
} from 'lucide-react';

export default function VerificationDashboard() {
  const { issues, fetchIssues } = useIssueStore();
  const { 
    verificationVotes, 
    resolutionVotes, 
    fetchVotesForIssue, 
    submitVerificationVote, 
    submitResolutionVote 
  } = useVerificationStore();
  
  const { currentUser, subscribeToLocality, unsubscribeFromLocality } = useUserStore();

  const [activeSubTab, setActiveSubTab] = useState<'existence' | 'resolution'>('existence');
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);
  const [votingError, setVotingError] = useState<string | null>(null);
  const [votingSuccess, setVotingSuccess] = useState<string | null>(null);
  const [isSubmittingVote, setIsSubmittingVote] = useState(false);
  const [showAddMap, setShowAddMap] = useState(false);

  // Load issues and votes
  useEffect(() => {
    fetchIssues();
  }, [fetchIssues]);

  // Load votes whenever selected issue changes
  useEffect(() => {
    if (selectedIssueId) {
      fetchVotesForIssue(selectedIssueId);
    }
    setVotingError(null);
    setVotingSuccess(null);
  }, [selectedIssueId, fetchVotesForIssue]);

  if (!currentUser) {
    return (
      <div className="bg-white border border-zinc-200 rounded-2xl p-8 text-center shadow-xs">
        <Shield className="w-12 h-12 text-zinc-400 mx-auto mb-4" />
        <h3 className="font-bold text-zinc-900 text-lg">No Wallet Connected</h3>
        <p className="text-sm text-zinc-500 mt-1 max-w-sm mx-auto">
          Please simulate a citizen wallet session in the header bar to view your reputation, subscribe to localities, and participate in consensus auditing.
        </p>
      </div>
    );
  }

  // Locality Subscriptions Helper
  const isSubscribed = (localityId: string) => {
    return currentUser.subscribedLocalities.some(l => l.id === localityId);
  };

  // Helper to check if an issue belongs to a locality (either via direct ID or via spatial overlap/proximity)
  const isIssueInLocality = (issue: Issue, loc: any) => {
    if (issue.locality === loc.id) return true;
    try {
      const dist = calculateDistance(issue.location, loc.centerLocation);
      return dist <= loc.boundaryRadiusMeters;
    } catch (err) {
      console.warn('[isIssueInLocality] spatial error:', err);
      return false;
    }
  };

  const handleToggleSubscription = async (localityId: string) => {
    if (isSubscribed(localityId)) {
      await unsubscribeFromLocality(localityId);
    }
  };

  // Filter issues based on subscribed localities (using both direct ID match and spatial match)
  const allIssues = Object.values(issues);
  const subscribedIssues = allIssues.filter(issue => 
    currentUser.subscribedLocalities.some(l => isIssueInLocality(issue, l))
  );

  // Divide issues into Existence (REPORTED) vs Resolution (RESOLVED)
  const existenceIssues = subscribedIssues.filter(issue => issue.status === IssueStatus.REPORTED);
  const resolutionIssues = subscribedIssues.filter(issue => issue.status === IssueStatus.RESOLVED);

  const selectedIssue = selectedIssueId ? issues[selectedIssueId] : null;

  // Handle Voting
  const handleVoteExistence = async (choice: VerificationChoice) => {
    if (!selectedIssueId || !currentUser) return;
    setIsSubmittingVote(true);
    setVotingError(null);
    setVotingSuccess(null);

    try {
      // Direct integration with backend blockchain endpoint for audit proof
      let blockchainTxHash = "";
      try {
        const response = await fetch('/api/blockchain/verify-issue', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            issueId: selectedIssue.id.replace('issue_', ''),
            verifierAddress: currentUser.address,
            accepted: choice === VerificationChoice.EXISTS
          })
        });
        if (response.ok) {
          const resData = await response.json();
          blockchainTxHash = resData.txHash;
        }
      } catch (bcError) {
        console.warn("[Blockchain API] Failed to submit vote on-chain, using sandbox:", bcError);
      }

      await submitVerificationVote({
        issueId: selectedIssueId,
        voterAddress: currentUser.address,
        choice,
        reputationWeight: currentUser.reputation.votingWeight,
        blockchainTxHash: blockchainTxHash || undefined
      });

      setVotingSuccess(`Your verification vote ("${choice.replace('_', ' ')}") has been successfully processed!`);
      fetchIssues(); // Reload issue list to reflect any status change
    } catch (err: any) {
      setVotingError(err.message || 'Failed to submit vote');
    } finally {
      setIsSubmittingVote(false);
    }
  };

  const handleVoteResolution = async (choice: ResolutionChoice) => {
    if (!selectedIssueId || !currentUser) return;
    setIsSubmittingVote(true);
    setVotingError(null);
    setVotingSuccess(null);

    try {
      // Direct integration with backend blockchain endpoint
      let blockchainTxHash = "";
      try {
        const response = await fetch('/api/blockchain/verify-resolution', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            issueId: selectedIssue.id.replace('issue_', ''),
            verifierAddress: currentUser.address,
            resolved: choice === ResolutionChoice.RESOLVED
          })
        });
        if (response.ok) {
          const resData = await response.json();
          blockchainTxHash = resData.txHash;
        }
      } catch (bcError) {
        console.warn("[Blockchain API] Failed to submit vote on-chain, using sandbox:", bcError);
      }

      await submitResolutionVote({
        issueId: selectedIssueId,
        voterAddress: currentUser.address,
        choice,
        reputationWeight: currentUser.reputation.votingWeight,
        blockchainTxHash: blockchainTxHash || undefined
      });

      setVotingSuccess(`Your resolution audit vote ("${choice.replace('_', ' ')}") has been successfully processed!`);
      fetchIssues(); // Reload issue list
    } catch (err: any) {
      setVotingError(err.message || 'Failed to submit vote');
    } finally {
      setIsSubmittingVote(false);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* 1. LOCALITY SUBSCRIPTION PANEL */}
      <div className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-100 pb-4 mb-4">
          <div>
            <h3 className="font-bold text-zinc-900 text-sm flex items-center gap-2">
              <MapIcon className="w-4 h-4 text-rose-500" />
              WARD SUBSCRIPTIONS
            </h3>
            <p className="text-xs text-zinc-500 mt-0.5">
              Subscribe to municipal localities to enable community-based spatial verification.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs text-zinc-500 bg-zinc-50 border border-zinc-200/60 rounded-lg px-2.5 py-1 font-medium font-mono">
              Active Subscriptions: <span className="font-bold text-rose-600">{currentUser.subscribedLocalities.length}</span>
            </div>
            <button
              type="button"
              onClick={() => setShowAddMap(true)}
              className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer shadow-sm shadow-blue-500/10"
            >
              <Plus className="w-3.5 h-3.5" /> Add new location
            </button>
          </div>
        </div>

        {currentUser.subscribedLocalities.length === 0 ? (
          <div className="text-center py-8 bg-zinc-50/50 border border-dashed border-zinc-200 rounded-xl">
            <p className="text-zinc-400 text-xs font-medium">You have no active ward subscriptions.</p>
            <button
              type="button"
              onClick={() => setShowAddMap(true)}
              className="mt-2 inline-flex items-center gap-1 px-3 py-1.5 bg-zinc-950 text-white text-[11px] font-bold rounded-lg hover:bg-zinc-900 transition-colors cursor-pointer"
            >
              <Plus className="w-3 h-3" /> Subscribe to your first location
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            {currentUser.subscribedLocalities.map((loc) => {
              const locIssues = allIssues.filter(i => isIssueInLocality(i, loc));
              const reportedCount = locIssues.filter(i => i.status === IssueStatus.REPORTED).length;
              const resolvedCount = locIssues.filter(i => i.status === IssueStatus.RESOLVED).length;

              return (
                <div 
                  key={loc.id} 
                  className="border border-zinc-950 bg-zinc-50/50 shadow-xs rounded-xl p-3 transition-all duration-200 flex flex-col justify-between gap-3"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-bold text-xs text-zinc-900 line-clamp-1">{loc.name}</span>
                      <span className="text-[9px] bg-zinc-900 text-white font-bold px-1.5 py-0.5 rounded-md uppercase tracking-wider scale-90 shrink-0">
                        Subbed
                      </span>
                    </div>
                    <p className="text-[10px] text-zinc-400 mt-1 font-mono">Radius: {(loc.boundaryRadiusMeters / 1000).toFixed(1)} km</p>
                  </div>

                  <div className="flex items-center justify-between border-t border-zinc-100 pt-2 text-[10px]">
                    <div className="flex gap-2 text-zinc-500 font-semibold">
                      <span className="text-amber-600" title="Existence votes pending">
                        {reportedCount} reported
                      </span>
                      <span className="text-emerald-600" title="Resolution audits pending">
                        {resolvedCount} resolved
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleToggleSubscription(loc.id)}
                      className="px-2 py-1 text-[9px] font-bold rounded-md bg-rose-50 text-rose-700 hover:bg-rose-100 hover:text-rose-800 transition-colors cursor-pointer uppercase"
                    >
                      Leave
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add New Location Map Modal Overlay */}
      {showAddMap && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-zinc-200 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center px-6 py-4 border-b border-zinc-100">
              <div>
                <h3 className="font-extrabold text-zinc-900 text-base flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-blue-600" /> Subscribe to New Ward
                </h3>
                <p className="text-xs text-zinc-500">Search OSM Nominatim, position on map, and name your custom verification region.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddMap(false)}
                className="p-1.5 text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 rounded-lg transition-colors cursor-pointer"
              >
                <CloseIcon className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6">
              <LocationSearchAndSubscribe
                onSubscribe={async (locality) => {
                  await subscribeToLocality(locality);
                  setShowAddMap(false);
                }}
                buttonText="Confirm & Subscribe"
              />
            </div>
          </div>
        </div>
      )}

      {/* 2. MAIN VERIFICATION INTERFACE CONTAINER */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        
        {/* Left Column: Filtered List of Audits (2 Cols) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white border border-zinc-200 rounded-2xl shadow-xs overflow-hidden">
            
            {/* Sub-tabs Selection */}
            <div className="flex border-b border-zinc-200 bg-zinc-50/50">
              <button
                onClick={() => {
                  setActiveSubTab('existence');
                  setSelectedIssueId(null);
                }}
                className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider transition-all border-b-2 flex items-center justify-center gap-1.5 cursor-pointer ${
                  activeSubTab === 'existence'
                    ? 'border-zinc-900 text-zinc-900 bg-white'
                    : 'border-transparent text-zinc-400 hover:text-zinc-600'
                }`}
              >
                <AlertCircle className="w-3.5 h-3.5" />
                Existence ({existenceIssues.length})
              </button>
              <button
                onClick={() => {
                  setActiveSubTab('resolution');
                  setSelectedIssueId(null);
                }}
                className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider transition-all border-b-2 flex items-center justify-center gap-1.5 cursor-pointer ${
                  activeSubTab === 'resolution'
                    ? 'border-zinc-900 text-zinc-900 bg-white'
                    : 'border-transparent text-zinc-400 hover:text-zinc-600'
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                Resolution ({resolutionIssues.length})
              </button>
            </div>

            {/* List Body */}
            <div className="divide-y divide-zinc-100 max-h-[500px] overflow-y-auto">
              
              {activeSubTab === 'existence' ? (
                existenceIssues.length === 0 ? (
                  <div className="text-center py-12 px-4">
                    <Inbox className="w-8 h-8 text-zinc-300 mx-auto mb-2" />
                    <p className="font-bold text-zinc-800 text-sm">No Pending Reports</p>
                    <p className="text-xs text-zinc-400 mt-1">
                      All reports in your subscribed wards are audited, or you haven't subscribed to wards with open reports.
                    </p>
                  </div>
                ) : (
                  existenceIssues.map((issue) => (
                    <button
                      key={issue.id}
                      onClick={() => setSelectedIssueId(issue.id)}
                      className={`w-full text-left p-4 hover:bg-zinc-50 transition-colors flex items-start gap-3 border-l-4 cursor-pointer ${
                        selectedIssueId === issue.id 
                          ? 'border-rose-500 bg-rose-50/10' 
                          : 'border-transparent'
                      }`}
                    >
                      <div className="w-10 h-10 rounded-lg overflow-hidden border border-zinc-200 shrink-0 bg-zinc-100 flex items-center justify-center">
                        {issue.imageCid ? (
                          <img 
                            src={`https://gateway.pinata.cloud/ipfs/${issue.imageCid}`} 
                            alt="" 
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              // If gateway fails, show placeholder or fallback symbol
                              e.currentTarget.style.display = 'none';
                            }}
                          />
                        ) : null}
                        <AlertCircle className="w-4 h-4 text-zinc-400 absolute" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] text-rose-600 font-bold uppercase tracking-wider">{issue.category.replace('_', ' ')}</span>
                          <span className="text-[9px] bg-zinc-100 text-zinc-500 font-bold px-1 rounded-sm uppercase">{issue.locality}</span>
                        </div>
                        <h4 className="font-bold text-zinc-900 text-xs mt-0.5 truncate">{issue.title}</h4>
                        <p className="text-[10px] text-zinc-400 mt-0.5 line-clamp-1">{issue.description}</p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-zinc-400 shrink-0 self-center" />
                    </button>
                  ))
                )
              ) : (
                resolutionIssues.length === 0 ? (
                  <div className="text-center py-12 px-4">
                    <Inbox className="w-8 h-8 text-zinc-300 mx-auto mb-2" />
                    <p className="font-bold text-zinc-800 text-sm">No Pending Resolution Audits</p>
                    <p className="text-xs text-zinc-400 mt-1">
                      No resolved issues require community auditing inside your subscribed localities right now.
                    </p>
                  </div>
                ) : (
                  resolutionIssues.map((issue) => (
                    <button
                      key={issue.id}
                      onClick={() => setSelectedIssueId(issue.id)}
                      className={`w-full text-left p-4 hover:bg-zinc-50 transition-colors flex items-start gap-3 border-l-4 cursor-pointer ${
                        selectedIssueId === issue.id 
                          ? 'border-emerald-500 bg-emerald-50/10' 
                          : 'border-transparent'
                      }`}
                    >
                      <div className="w-10 h-10 rounded-lg overflow-hidden border border-zinc-200 shrink-0 bg-zinc-100 flex items-center justify-center">
                        {issue.resolution?.imageCid ? (
                          <img 
                            src={`https://gateway.pinata.cloud/ipfs/${issue.resolution.imageCid}`} 
                            alt="" 
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                            }}
                          />
                        ) : null}
                        <CheckCircle2 className="w-4 h-4 text-zinc-400 absolute" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider">{issue.category.replace('_', ' ')}</span>
                          <span className="text-[9px] bg-zinc-100 text-zinc-500 font-bold px-1 rounded-sm uppercase">{issue.locality}</span>
                        </div>
                        <h4 className="font-bold text-zinc-900 text-xs mt-0.5 truncate">{issue.title}</h4>
                        <p className="text-[10px] text-zinc-400 mt-0.5 line-clamp-1">Resolution notes: {issue.resolution?.notes}</p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-zinc-400 shrink-0 self-center" />
                    </button>
                  ))
                )
              )}

            </div>
          </div>
        </div>

        {/* Right Column: Active Audit Details & Voting Console (3 Cols) */}
        <div className="lg:col-span-3">
          {selectedIssue ? (
            <div className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-xs space-y-6">
              
              {/* Header Info */}
              <div className="border-b border-zinc-100 pb-4">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                    activeSubTab === 'existence' 
                      ? 'bg-rose-50 text-rose-700 border border-rose-100' 
                      : 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                  }`}>
                    {activeSubTab === 'existence' ? 'Existence Verification' : 'Resolution Audit'}
                  </span>
                  <span className="text-[10px] bg-zinc-100 text-zinc-600 px-2 py-0.5 rounded-full font-bold">
                    Locality: {selectedIssue.locality}
                  </span>
                </div>
                <h3 className="text-base font-bold text-zinc-900 mt-2">{selectedIssue.title}</h3>
                <p className="text-xs text-zinc-500 mt-1">{selectedIssue.description}</p>
                <p className="text-[10px] text-zinc-400 font-mono mt-1 flex items-center gap-1">
                  <User className="w-3 h-3 text-zinc-300" /> Reporter: {selectedIssue.reporterAddress}
                </p>
              </div>

              {/* Evidence Panel (Double Columns for Resolution Verification) */}
              <div className={`grid grid-cols-1 gap-4 ${activeSubTab === 'resolution' ? 'md:grid-cols-2' : ''}`}>
                
                {/* 1. Report Evidence */}
                <div className="space-y-1.5">
                  <h4 className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5 text-rose-500" />
                    Original Evidence
                  </h4>
                  <div className="border border-zinc-200 rounded-xl overflow-hidden aspect-video relative bg-zinc-50 flex items-center justify-center">
                    {selectedIssue.imageCid ? (
                      <img 
                        src={`https://gateway.pinata.cloud/ipfs/${selectedIssue.imageCid}`} 
                        alt="Evidence" 
                        className="w-full h-full object-cover" 
                      />
                    ) : (
                      <div className="text-center p-3 text-zinc-400 text-xs">No photographic evidence attached.</div>
                    )}
                  </div>
                </div>

                {/* 2. Resolution Proof (Only for Resolution verification) */}
                {activeSubTab === 'resolution' && (
                  <div className="space-y-1.5">
                    <h4 className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                      Authority Resolution Proof
                    </h4>
                    <div className="border border-zinc-200 rounded-xl overflow-hidden aspect-video relative bg-zinc-50 flex items-center justify-center">
                      {selectedIssue.resolution?.imageCid ? (
                        <img 
                          src={`https://gateway.pinata.cloud/ipfs/${selectedIssue.resolution.imageCid}`} 
                          alt="Resolution Proof" 
                          className="w-full h-full object-cover" 
                        />
                      ) : (
                        <div className="text-center p-3 text-zinc-400 text-xs">No resolution image proof attached.</div>
                      )}
                    </div>
                    {selectedIssue.resolution?.notes && (
                      <p className="text-[11px] text-zinc-600 bg-zinc-50 border border-zinc-200 p-2 rounded-lg leading-relaxed italic mt-1.5">
                        &ldquo;{selectedIssue.resolution.notes}&rdquo;
                      </p>
                    )}
                  </div>
                )}

              </div>

              {/* 3. CONSENSUS ENGINE: REAL-TIME STATISTICS AGGREGATION */}
              {(() => {
                const votesList = activeSubTab === 'existence'
                  ? (verificationVotes[selectedIssue.id] || [])
                  : (resolutionVotes[selectedIssue.id] || []);

                const consensusOutcome = activeSubTab === 'existence'
                  ? calculateVerificationConsensus(votesList as any)
                  : calculateResolutionConsensus(votesList as any);

                const minVotes = activeSubTab === 'existence'
                  ? VERIFICATION_RULES.MIN_VOTES_REQUIRED
                  : RESOLUTION_RULES.MIN_VOTES_REQUIRED;

                const agreementThreshold = activeSubTab === 'existence'
                  ? VERIFICATION_RULES.CONSENSUS_THRESHOLD_PERCENT
                  : RESOLUTION_RULES.CONSENSUS_THRESHOLD_PERCENT;

                const votesCount = votesList.length;
                const votesProgressPercent = Math.min(100, (votesCount / minVotes) * 100);

                const hasVoted = votesList.some(v => v.voterAddress.toLowerCase() === currentUser.address.toLowerCase());

                // Calculate vote distribution details
                let option1Count = 0; // EXISTS or RESOLVED
                let option2Count = 0; // DOES_NOT_EXIST or NOT_RESOLVED
                let option1Weight = 0;
                let option2Weight = 0;

                for (const vote of votesList) {
                  if (vote.choice === VerificationChoice.EXISTS || vote.choice === ResolutionChoice.RESOLVED) {
                    option1Count++;
                    option1Weight += vote.reputationWeight;
                  } else {
                    option2Count++;
                    option2Weight += vote.reputationWeight;
                  }
                }

                const totalWeight = option1Weight + option2Weight;
                const option1Ratio = totalWeight > 0 ? Math.round((option1Weight / totalWeight) * 100) : 0;
                const option2Ratio = totalWeight > 0 ? Math.round((option2Weight / totalWeight) * 100) : 0;

                return (
                  <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-5 space-y-4">
                    <div className="flex items-center gap-2 border-b border-zinc-200 pb-2.5">
                      <Shield className="w-4 h-4 text-zinc-600" />
                      <h4 className="font-bold text-xs uppercase tracking-wider text-zinc-700">
                        Consensus Engine Status
                      </h4>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      
                      {/* Meter 1: Vote Aggregation Count (Requires 5) */}
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-xs">
                          <span className="text-zinc-500 font-semibold">Total Votes Received</span>
                          <span className="font-bold text-zinc-900">{votesCount} / {minVotes}</span>
                        </div>
                        <div className="h-2 bg-zinc-200 rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full transition-all duration-300 ${
                              votesCount >= minVotes ? 'bg-zinc-900' : 'bg-amber-500'
                            }`}
                            style={{ width: `${votesProgressPercent}%` }}
                          />
                        </div>
                        <p className="text-[10px] text-zinc-400 mt-1 leading-normal">
                          {votesCount >= minVotes 
                            ? '✓ Minimum quota achieved. Consensus eligible.' 
                            : `Requires ${minVotes - votesCount} more voter participation to trigger consensus calculation.`}
                        </p>
                      </div>

                      {/* Meter 2: Agreement Percentage (Requires 70%) */}
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-xs">
                          <span className="text-zinc-500 font-semibold">Leading Choice Weight</span>
                          <span className="font-bold text-zinc-900">
                            {Math.max(option1Ratio, option2Ratio)}% / {agreementThreshold}%
                          </span>
                        </div>
                        <div className="h-2 bg-zinc-200 rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full transition-all duration-300 ${
                              Math.max(option1Ratio, option2Ratio) >= agreementThreshold ? 'bg-emerald-500' : 'bg-rose-500'
                            }`}
                            style={{ width: `${Math.max(option1Ratio, option2Ratio)}%` }}
                          />
                        </div>
                        <p className="text-[10px] text-zinc-400 mt-1 leading-normal">
                          Agreement threshold must hit <strong>70%</strong> to lock consensus status.
                        </p>
                      </div>

                    </div>

                    {/* Vote Allocation Breakdown */}
                    <div className="border-t border-zinc-200/50 pt-3 flex flex-col sm:flex-row justify-between gap-3 text-xs">
                      <div className="flex gap-4">
                        <div className="flex items-center gap-1.5 font-medium">
                          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                          <span>{activeSubTab === 'existence' ? 'Exists' : 'Resolved'}:</span>
                          <strong className="text-zinc-800">{option1Count} votes</strong>
                          <span className="text-zinc-400 font-mono text-[11px]">({option1Ratio}%)</span>
                        </div>
                        <div className="flex items-center gap-1.5 font-medium">
                          <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                          <span>{activeSubTab === 'existence' ? 'Does Not Exist' : 'Not Resolved'}:</span>
                          <strong className="text-zinc-800">{option2Count} votes</strong>
                          <span className="text-zinc-400 font-mono text-[11px]">({option2Ratio}%)</span>
                        </div>
                      </div>
                      
                      {consensusOutcome.isResolved ? (
                        <div className="text-[10px] bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded font-bold uppercase tracking-wider flex items-center gap-1">
                          <Check className="w-3.5 h-3.5" />
                          Consensus Locked: {consensusOutcome.decision}
                        </div>
                      ) : (
                        <div className="text-[10px] bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded font-bold uppercase tracking-wider flex items-center gap-1">
                          <RefreshCw className="w-3 h-3 animate-spin shrink-0" />
                          Consensus In Progress
                        </div>
                      )}
                    </div>

                    {/* VOTING CONSOLE BUTTONS */}
                    <div className="border-t border-zinc-200/50 pt-4 space-y-3">
                      <div className="flex justify-between items-center flex-wrap gap-2">
                        <div>
                          <p className="text-xs font-bold text-zinc-800 uppercase flex items-center gap-1">
                            <Vote className="w-3.5 h-3.5 text-rose-500" /> CAST COMMUNITY AUDIT BALLOT
                          </p>
                          <p className="text-[10px] text-zinc-500">
                            Your ballot weight: <strong className="text-zinc-800 font-bold">{currentUser.reputation.votingWeight} Unit(s)</strong> (Reputation: {currentUser.reputation.score} PTS)
                          </p>
                        </div>
                        
                        {hasVoted && (
                          <span className="text-[10px] bg-amber-50 text-amber-700 border border-amber-200 font-bold px-2.5 py-1 rounded-lg">
                            ✓ Already Voted
                          </span>
                        )}
                      </div>

                      {votingError && (
                        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg text-xs font-medium">
                          Error: {votingError}
                        </div>
                      )}

                      {votingSuccess && (
                        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs font-semibold">
                          Success: {votingSuccess}
                        </div>
                      )}

                      {!hasVoted && !consensusOutcome.isResolved && (
                        <div className="grid grid-cols-2 gap-3 pt-1">
                          {activeSubTab === 'existence' ? (
                            <>
                              <button
                                onClick={() => handleVoteExistence(VerificationChoice.EXISTS)}
                                disabled={isSubmittingVote}
                                className="py-3 px-4 bg-emerald-600 text-white font-bold text-xs rounded-xl hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                              >
                                <Check className="w-4 h-4" /> CONFIRM EXISTS
                              </button>
                              <button
                                onClick={() => handleVoteExistence(VerificationChoice.DOES_NOT_EXIST)}
                                disabled={isSubmittingVote}
                                className="py-3 px-4 bg-rose-600 text-white font-bold text-xs rounded-xl hover:bg-rose-700 transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                              >
                                <X className="w-4 h-4" /> CONFIRM NOT EXISTS
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => handleVoteResolution(ResolutionChoice.RESOLVED)}
                                disabled={isSubmittingVote}
                                className="py-3 px-4 bg-emerald-600 text-white font-bold text-xs rounded-xl hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                              >
                                <Check className="w-4 h-4" /> CONFIRM RESOLVED
                              </button>
                              <button
                                onClick={() => handleVoteResolution(ResolutionChoice.NOT_RESOLVED)}
                                disabled={isSubmittingVote}
                                className="py-3 px-4 bg-rose-600 text-white font-bold text-xs rounded-xl hover:bg-rose-700 transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                              >
                                <X className="w-4 h-4" /> CONFIRM NOT RESOLVED
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Historical Votes Audit Log */}
                    <div className="border-t border-zinc-200/50 pt-3 space-y-2">
                      <h5 className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                        Voter Log ({votesList.length})
                      </h5>
                      {votesList.length === 0 ? (
                        <p className="text-[10px] text-zinc-400 italic">No votes logged yet.</p>
                      ) : (
                        <div className="space-y-1.5 max-h-[120px] overflow-y-auto pr-1">
                          {votesList.map((vote, idx) => (
                            <div key={vote.id || idx} className="flex justify-between items-center text-[10px] bg-white border border-zinc-200/40 p-1.5 rounded-md">
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono text-zinc-500 font-medium">
                                  {vote.voterAddress.substring(0, 8)}...{vote.voterAddress.slice(-4)}
                                </span>
                                <span className="text-[9px] bg-zinc-100 text-zinc-600 px-1 rounded-sm">
                                  W: {vote.reputationWeight}
                                </span>
                                {vote.blockchainTxHash && (
                                  <span className="text-[8px] text-purple-600 font-mono bg-purple-50 px-1 rounded flex items-center gap-0.5">
                                    Tx: {vote.blockchainTxHash.substring(0, 8)}...
                                  </span>
                                )}
                              </div>
                              <span className={`font-bold px-1.5 rounded ${
                                vote.choice === VerificationChoice.EXISTS || vote.choice === ResolutionChoice.RESOLVED
                                  ? 'text-emerald-700 bg-emerald-50'
                                  : 'text-rose-700 bg-rose-50'
                              }`}>
                                {vote.choice.replace('_', ' ')}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                  </div>
                );
              })()}

            </div>
          ) : (
            <div className="bg-white border border-zinc-200 rounded-2xl p-12 text-center shadow-xs flex flex-col justify-center items-center min-h-[400px]">
              <Vote className="w-16 h-16 text-zinc-300 mb-4 animate-pulse" />
              <h3 className="font-bold text-zinc-800 text-base">Select an Incident for Auditing</h3>
              <p className="text-xs text-zinc-400 mt-1 max-w-sm">
                Choose an open civic report from the left sidebar to load its evidence, monitor the consensus engine in real-time, and submit your ballot.
              </p>
            </div>
          )}
        </div>

      </div>

    </div>
  );
}
