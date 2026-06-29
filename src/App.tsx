/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { useIssueStore } from '@/measuringTape/src/store/useIssueStore';
import { useUserStore } from '@/measuringTape/src/store/useUserStore';
import { calculateDistance } from '@/measuringTape/src/utils/haversine';
import { IssueStatus } from '@/measuringTape/src/types/issue';
import LandingPage from './components/LandingPage';
import IssueReportForm from './components/IssueReportForm';
import VerificationDashboard from './components/VerificationDashboard';
import AuthorityDashboard from './components/AuthorityDashboard';
import { 
  PlusCircle, 
  MapPin, 
  Database, 
  Info, 
  CheckCircle2, 
  FileJson, 
  User, 
  Compass, 
  AlertCircle,
  Clock,
  Trash2,
  ExternalLink,
  Map as MapIcon,
  ShieldAlert,
  Vote,
  Building2,
  LogOut,
  Sparkles
} from 'lucide-react';

export default function App() {
  const { issues, drafts, fetchIssues, deleteDraft } = useIssueStore();
  const { currentUser, disconnect } = useUserStore();

  const [activeTab, setActiveTab] = useState<'report' | 'verify' | 'authority' | 'zustand'>(() => {
    try {
      const savedTab = localStorage.getItem('mt_active_tab');
      if (savedTab && ['report', 'verify', 'authority', 'zustand'].includes(savedTab)) {
        return savedTab as 'report' | 'verify' | 'authority' | 'zustand';
      }
    } catch (e) {}
    return 'report';
  });
  const [justSubmittedId, setJustSubmittedId] = useState<string | null>(null);

  // Initialize stores
  useEffect(() => {
    fetchIssues();
  }, [fetchIssues]);

  // Persist activeTab when it changes
  useEffect(() => {
    try {
      localStorage.setItem('mt_active_tab', activeTab);
    } catch (e) {}
  }, [activeTab]);

  // Set appropriate default tab based on logged-in role only if not already restored
  useEffect(() => {
    if (currentUser) {
      const savedTab = localStorage.getItem('mt_active_tab');
      if (savedTab && ['report', 'verify', 'authority', 'zustand'].includes(savedTab)) {
        if (currentUser.role === 'AUTHORITY' && savedTab === 'authority') {
          setActiveTab('authority');
          return;
        }
        if (currentUser.role === 'CITIZEN' && savedTab !== 'authority') {
          setActiveTab(savedTab as 'report' | 'verify' | 'zustand');
          return;
        }
      }

      if (currentUser.role === 'AUTHORITY') {
        setActiveTab('authority');
      } else {
        setActiveTab('report');
      }
    }
  }, [currentUser]);

  const handleReportSuccess = (draftId: string) => {
    setJustSubmittedId(draftId);
    setActiveTab('zustand');
    // Clear success message after 5 seconds
    setTimeout(() => {
      setJustSubmittedId(null);
    }, 6000);
  };

  const draftsList = Object.values(drafts).filter(
    (draft) => !currentUser || draft.reporterAddress === currentUser.address
  );
  const filteredDrafts = Object.fromEntries(
    Object.entries(drafts).filter(
      ([_, draft]) => !currentUser || draft.reporterAddress === currentUser.address
    )
  );
  
  const activeIssuesList = Object.values(issues).filter((issue) => {
    // 1. Filter out closed issues
    if (issue.status === IssueStatus.CLOSED) {
      return false;
    }
    // 2. Filter by user's subscribed localities
    if (currentUser && currentUser.subscribedLocalities && currentUser.subscribedLocalities.length > 0) {
      return currentUser.subscribedLocalities.some((loc: any) => {
        if (issue.locality === loc.id) return true;
        try {
          const dist = calculateDistance(issue.location, loc.centerLocation);
          return dist <= loc.boundaryRadiusMeters;
        } catch (err) {
          return false;
        }
      });
    }
    // If not logged in or has no subscriptions, show none
    return false;
  });

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 font-sans antialiased flex flex-col selection:bg-rose-500 selection:text-white">
      
      {/* Dynamic Top Header */}
      <header className="bg-white border-b border-zinc-200 sticky top-0 z-[1010] shadow-xs">
        <div className="bg-[#faca49] max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          
          {/* Logo & Sub-banner */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-zinc-900 text-white flex items-center justify-center font-bold shadow-md shadow-zinc-900/10 tracking-tighter text-lg">
              mT
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-zinc-900">measuringTape</h1>
              <p className="text-xs text-zinc-600">Report. Verify. Resolve. Transparently.</p>
            </div>
          </div>

          {/* User Session HUD */}
          {currentUser && (
            <div className="flex items-center gap-3 bg-white/90 backdrop-blur-xs border border-zinc-200/60 p-2 pl-3 pr-2.5 rounded-xl shadow-xs self-start sm:self-center">
              <div className="flex flex-col text-right">
                <div className="flex items-center gap-1.5 justify-end">
                  <span className="text-[10px] bg-zinc-950 text-white font-extrabold px-1.5 py-0.5 rounded-md uppercase tracking-wider scale-90">
                    {currentUser.role}
                  </span>
                  <span className="text-xs font-bold text-zinc-900">
                    {currentUser.username}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-[10px] font-medium text-zinc-500 mt-0.5">
                  <span className="font-mono">{currentUser.address.substring(0, 6)}...{currentUser.address.substring(34)}</span>
                  {currentUser.role !== 'AUTHORITY' && (
                    <>
                      <span className="text-zinc-300">|</span>
                      <span className="text-zinc-600 font-bold flex items-center gap-0.5">
                        <Sparkles className="w-3 h-3 text-amber-500" /> Rep: {currentUser.reputation.score}
                      </span>
                    </>
                  )}
                </div>
              </div>
              <button
                onClick={disconnect}
                className="p-2 text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 rounded-lg transition-colors cursor-pointer"
                title="Sign Out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}

        </div>
      </header>

      {/* Primary Dashboard Area */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6">

        {!currentUser ? (
          <LandingPage />
        ) : (
          <>
            {/* Dynamic Route/View Navigation Tabs */}
            <div className="flex flex-wrap items-center gap-2 border-b border-zinc-200 mb-6">
              {currentUser.role === 'CITIZEN' && (
                <>
                  <button
                    onClick={() => {
                      setActiveTab('report');
                      setJustSubmittedId(null);
                    }}
                    className={`flex items-center gap-1.5 px-4.5 py-3 text-xs uppercase tracking-wider font-bold transition-all border-b-2 cursor-pointer ${
                      activeTab === 'report'
                        ? 'border-zinc-900 text-zinc-900'
                        : 'border-transparent text-zinc-400 hover:text-zinc-600'
                    }`}
                  >
                    <PlusCircle className="w-3.5 h-3.5" />
                    Report Issue
                  </button>

                  <button
                    onClick={() => {
                      setActiveTab('verify');
                      setJustSubmittedId(null);
                    }}
                    className={`flex items-center gap-1.5 px-4.5 py-3 text-xs uppercase tracking-wider font-bold transition-all border-b-2 cursor-pointer ${
                      activeTab === 'verify'
                        ? 'border-zinc-900 text-zinc-900'
                        : 'border-transparent text-zinc-400 hover:text-zinc-600'
                    }`}
                  >
                    <Vote className="w-3.5 h-3.5" />
                    Verification Dashboard
                  </button>
                </>
              )}

              {currentUser.role === 'AUTHORITY' && (
                <button
                  onClick={() => {
                    setActiveTab('authority');
                    setJustSubmittedId(null);
                  }}
                  className={`flex items-center gap-1.5 px-4.5 py-3 text-xs uppercase tracking-wider font-bold transition-all border-b-2 cursor-pointer ${
                    activeTab === 'authority'
                      ? 'border-zinc-900 text-zinc-900'
                      : 'border-transparent text-zinc-400 hover:text-zinc-600'
                  }`}
                >
                  <Building2 className="w-3.5 h-3.5" />
                  Authority Panel
                </button>
              )}
              
              {currentUser.role !== 'AUTHORITY' && (
                <button
                  onClick={() => {
                    setActiveTab('zustand');
                    setJustSubmittedId(null);
                  }}
                  className={`flex items-center gap-1.5 px-4.5 py-3 text-xs uppercase tracking-wider font-bold transition-all border-b-2 relative cursor-pointer ${
                    activeTab === 'zustand'
                      ? 'border-zinc-900 text-zinc-900'
                      : 'border-transparent text-zinc-400 hover:text-zinc-600'
                  }`}
                >
                  <Database className="w-3.5 h-3.5" />
                  MY REPORTS
                  {draftsList.length > 0 && (
                    <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white shadow-sm">
                      {draftsList.length}
                    </span>
                  )}
                </button>
              )}
            </div>

            {/* Form Submitted Success Toast Banner */}
            {justSubmittedId && (
              <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl flex items-start gap-3 shadow-sm animate-in slide-in-from-top duration-300">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-sm">Issue Draft Created Successfully!</p>
                  <p className="text-xs text-emerald-600 mt-1">
                    Your report draft has been compiled, parsed with Zod, and safely stored in the local Zustand state under ID: <strong className="font-mono">{justSubmittedId}</strong>. Open the MY REPORTS tab to verify.
                  </p>
                </div>
              </div>
            )}

            {activeTab === 'verify' ? (
              <VerificationDashboard />
            ) : activeTab === 'authority' ? (
              <AuthorityDashboard />
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Left Column: Main Active view */}
                <div className={activeTab === 'zustand' ? "lg:col-span-3" : "lg:col-span-2"}>
                  {activeTab === 'report' ? (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <h2 className="text-lg font-bold text-zinc-900 tracking-tight">Submit New Civic Report</h2>
                          <p className="text-xs text-zinc-500">Provide photographic and geographic coordinates of public infrastructure faults</p>
                        </div>
                      </div>
                      
                      {/* Active Form */}
                      <IssueReportForm onSuccess={handleReportSuccess} />
                    </div>
                  ) : (
                    <div className="space-y-6">
                      
                      {/* Visual Drafts List */}
                      <div className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-sm">
                        <div className="flex items-center justify-between border-b border-zinc-100 pb-3 mb-4">
                          <div className="flex items-center gap-2">
                            <FileJson className="w-5 h-5 text-rose-500" />
                            <h3 className="font-bold text-zinc-900 text-sm uppercase tracking-wider">
                              Stored Issue Drafts ({draftsList.length})
                            </h3>
                          </div>
                        </div>

                        {draftsList.length === 0 ? (
                          <div className="text-center py-10">
                            <p className="text-zinc-400 text-sm">No report drafts. [If you can't see your report here check the Verification Dashboard]</p>
                            {currentUser.role === 'CITIZEN' && (
                              <button
                                onClick={() => setActiveTab('report')}
                                className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 bg-zinc-900 text-white font-semibold text-xs rounded-lg hover:bg-zinc-800 transition-colors cursor-pointer"
                              >
                                <PlusCircle className="w-3.5 h-3.5" /> Start Report
                              </button>
                            )}
                          </div>
                        ) : (
                          <div className="divide-y divide-zinc-100">
                            {draftsList.map((draft) => (
                              <div key={draft.id} className="py-4 first:pt-0 last:pb-0 flex flex-col md:flex-row md:items-center justify-between gap-4">
                                <div className="flex items-start gap-3">
                                  {draft.localImagePreview && (
                                    <div className="w-12 h-12 rounded-lg overflow-hidden border border-zinc-200 shrink-0">
                                      <img src={draft.localImagePreview} alt="" className="w-full h-full object-cover" />
                                    </div>
                                  )}
                                  <div>
                                    <h4 className="font-bold text-zinc-900 text-sm">{draft.title}</h4>
                                    <p className="text-xs text-zinc-500 mt-0.5 line-clamp-1">{draft.description}</p>
                                    <div className="flex flex-wrap items-center gap-2 mt-1.5">
                                      <span className="text-[9px] bg-rose-50 text-rose-700 font-bold px-1.5 py-0.5 rounded-md uppercase tracking-wider">
                                        {draft.category.replace('_', ' ')}
                                      </span>
                                      <span className="text-[9px] bg-zinc-100 text-zinc-600 font-medium px-1.5 py-0.5 rounded-md">
                                        {draft.locality}
                                      </span>
                                      <span className="text-[9px] text-zinc-400 font-mono">
                                        GPS: {draft.location.latitude.toFixed(4)}, {draft.location.longitude.toFixed(4)}
                                      </span>
                                      {draft.imageCid && (
                                        <span className="text-[9px] bg-blue-50 text-blue-700 font-semibold px-1.5 py-0.5 rounded-md flex items-center gap-1">
                                          Image IPFS: 
                                          <a 
                                            href={`https://gateway.pinata.cloud/ipfs/${draft.imageCid}`} 
                                            target="_blank" 
                                            rel="noreferrer" 
                                            className="underline hover:text-blue-900 flex items-center gap-0.5"
                                          >
                                            {draft.imageCid.substring(0, 10)}... <ExternalLink className="w-2.5 h-2.5" />
                                          </a>
                                        </span>
                                      )}
                                      {draft.metadataCid && (
                                        <span className="text-[9px] bg-emerald-50 text-emerald-700 font-semibold px-1.5 py-0.5 rounded-md flex items-center gap-1">
                                          Metadata IPFS: 
                                          <a 
                                            href={`https://gateway.pinata.cloud/ipfs/${draft.metadataCid}`} 
                                            target="_blank" 
                                            rel="noreferrer" 
                                            className="underline hover:text-emerald-900 flex items-center gap-0.5"
                                          >
                                            {draft.metadataCid.substring(0, 10)}... <ExternalLink className="w-2.5 h-2.5" />
                                          </a>
                                        </span>
                                      )}
                                      {draft.onChainId !== undefined && (
                                        <span className="text-[9px] bg-indigo-50 text-indigo-700 font-bold px-1.5 py-0.5 rounded-md">
                                          On-Chain ID: #{draft.onChainId}
                                        </span>
                                      )}
                                      {draft.blockchainTxHash && (
                                        <span className="text-[9px] bg-purple-50 text-purple-700 font-semibold px-1.5 py-0.5 rounded-md flex items-center gap-1">
                                          Tx Hash: 
                                          <span className="font-mono text-[8px]" title={draft.blockchainTxHash}>
                                            {draft.blockchainTxHash.substring(0, 10)}...
                                          </span>
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                                
                                <div className="flex items-center gap-2 self-end md:self-center">
                                  <button
                                    onClick={() => deleteDraft(draft.id)}
                                    className="p-1.5 text-zinc-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                    title="Delete Draft"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Raw Store JSON Inspector */}
                      <div className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-sm">
                        <div className="flex items-center gap-2 border-b border-zinc-100 pb-3 mb-4">
                          <Database className="w-5 h-5 text-rose-500" />
                          <h3 className="font-bold text-zinc-900 text-sm uppercase tracking-wider">
                            JSON DRAFT STORE
                          </h3>
                        </div>
                        
                        <p className="text-xs text-zinc-500 leading-relaxed mb-4">
                          This represents the exact structural state currently synchronized in the Zustand virtual client space. It stores full `IssueDraft` objects containing localized coordinates and base64 preview values.
                        </p>

                        <div className="p-4 bg-zinc-900 text-zinc-100 rounded-xl overflow-x-auto max-h-[300px]">
                          <pre className="font-mono text-xs text-emerald-400">
                            {JSON.stringify(filteredDrafts, null, 2)}
                          </pre>
                        </div>
                      </div>

                    </div>
                  )}
                </div>

                {/* Right Column: Sidebar metadata & contextual logs */}
                {activeTab !== 'zustand' && (
                  <div className={`space-y-6 ${activeTab === 'report' ? 'lg:pt-14' : ''}`}>

                    {/* Ward Centers (GPS Coordinates) */}
                    {currentUser.subscribedLocalities && currentUser.subscribedLocalities.length > 0 && (
                      <div className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-sm space-y-4">
                        <div className="flex items-center gap-2 text-zinc-800 pb-3 border-b border-zinc-100">
                          <MapPin className="w-4 h-4 text-rose-500" />
                          <h3 className="font-bold text-xs uppercase tracking-wider">
                            Subscribed Ward Centers (GPS)
                          </h3>
                        </div>

                        <div className="space-y-3 font-mono text-[11px] text-zinc-600">
                          {currentUser.subscribedLocalities.map((loc) => (
                            <div key={loc.id} className="flex justify-between items-center bg-zinc-50/50 p-2 border border-zinc-100 rounded-lg">
                              <span className="font-sans font-medium text-zinc-700">{loc.name}</span>
                              <span className="text-zinc-500">
                                {loc.centerLocation.latitude.toFixed(4)}, {loc.centerLocation.longitude.toFixed(4)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Active Reported Issues List */}
                    <div className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-sm space-y-4">
                      <div className="flex items-center gap-2 text-zinc-800 pb-3 border-b border-zinc-100">
                        <Clock className="w-4 h-4 text-rose-500" />
                        <h3 className="font-bold text-xs uppercase tracking-wider">
                          Active Civic Incidents ({activeIssuesList.length})
                        </h3>
                      </div>

                      <div className="space-y-3">
                        {activeIssuesList.length === 0 ? (
                          <p className="text-zinc-400 text-xs text-center py-4">No active civic incidents reported yet.</p>
                        ) : (
                          activeIssuesList.map((issue) => (
                            <div key={issue.id} className="p-3 bg-zinc-50 rounded-xl border border-zinc-200 text-xs">
                              <div className="flex items-center justify-between mb-1.5">
                                <span className="font-semibold text-rose-600">
                                  {issue.category.replace('_', ' ')}
                                </span>
                                <span className="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded-full font-bold">
                                  {issue.status}
                                </span>
                              </div>
                              <h4 className="font-bold text-zinc-800 leading-tight mb-1">{issue.title}</h4>
                              <p className="text-[11px] text-zinc-500 line-clamp-1">{issue.description}</p>
                              <div className="flex justify-between items-center mt-3 pt-2 border-t border-zinc-200/50 text-[10px] text-zinc-500 font-semibold">
                                <span className="flex items-center gap-1">
                                  <MapPin className="w-3 h-3" /> {issue.locality}
                                </span>
                                <span>Votes: {issue.supportCount}</span>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                  </div>
                )}

              </div>
            )}
          </>
        )}

      </main>

      {/* Modern minimal footer */}
      <footer className="bg-black border-t border-zinc-800 mt-12 py-10">
  <div className="max-w-5xl mx-auto text-center px-6">

    <h3 className="text-lg font-bold text-white">
      measuringTape
    </h3>

    <p className="mt-3 text-sm text-zinc-300 max-w-2xl mx-auto leading-relaxed">
      Building trust in civic issue resolution through community verification
      and transparent blockchain records.
    </p>

    <div className="mt-6 flex flex-wrap justify-center gap-8 text-sm font-medium text-white">
      <span>📍 Community Verified</span>
      <span>🔒 Blockchain Secured</span>
      <span>⚡ Real-Time Tracking</span>
    </div>

    <div className="mt-6 text-sm text-zinc-300">
      Built with{" "}
      <span className="font-semibold text-white">Next.js</span> •{" "}
      <span className="font-semibold text-white">Ethereum Sepolia</span> •{" "}
      <span className="font-semibold text-white">IPFS</span> •{" "}
      <span className="font-semibold text-white">OpenStreetMap</span>
    </div>

    <div className="mt-4 text-xs text-zinc-400">
      © 2026 measuringTape. All rights reserved.
    </div>

  </div>
</footer>

    </div>
  );
}
