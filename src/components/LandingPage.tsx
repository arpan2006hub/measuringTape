/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useUserStore } from '@/measuringTape/src/store/useUserStore';
import { UserRole } from '@/measuringTape/src/types/user';
import { Locality } from '@/measuringTape/src/types/locality';
import LocationSearchAndSubscribe from './LocationSearchAndSubscribe';
import { ShieldCheck, User, Building2, KeyRound, UserPlus, MapPin, Eye, EyeOff, Sparkles, LogIn, Loader2, Search } from 'lucide-react';
import { CITIES, City } from '../utils/cities';

export default function LandingPage() {
  const { signup, login, error, clearError, isLoading } = useUserStore();

  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [role, setRole] = useState<UserRole>(UserRole.CITIZEN);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [walletAddress, setWalletAddress] = useState('');
  const [subscribedLocalities, setSubscribedLocalities] = useState<Locality[]>([]);
  const [localError, setLocalError] = useState<string | null>(null);

  // States for searchable city dropdown (Municipality registration)
  const [selectedCity, setSelectedCity] = useState<City | null>(null);
  const [citySearch, setCitySearch] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // Filter cities based on search
  const filteredCities = CITIES.filter(city => 
    city.name.toLowerCase().includes(citySearch.toLowerCase()) || 
    city.state.toLowerCase().includes(citySearch.toLowerCase())
  );

  // Helper to generate a random mock Web3 Address for the user's identity
  const handleGenerateWallet = () => {
    const chars = '0123456789abcdef';
    let hex = '0x';
    for (let i = 0; i < 40; i++) {
      hex += chars[Math.floor(Math.random() * chars.length)];
    }
    setWalletAddress(hex);
  };

  // When signup mode is toggled, generate initial mock wallet if empty
  const handleToggleMode = (newMode: 'signin' | 'signup') => {
    clearError();
    setLocalError(null);
    setMode(newMode);
    if (newMode === 'signup' && !walletAddress) {
      handleGenerateWallet();
    }
  };

  const handleSubscribeDuringSignup = (locality: Locality) => {
    // Check if already subscribed
    if (subscribedLocalities.some(l => l.name.toLowerCase() === locality.name.toLowerCase())) {
      setLocalError('You are already subscribed to this location.');
      return;
    }
    setSubscribedLocalities([...subscribedLocalities, locality]);
    setLocalError(null);
  };

  const handleRemoveSubscription = (idxToRemove: number) => {
    setSubscribedLocalities(subscribedLocalities.filter((_, idx) => idx !== idxToRemove));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    clearError();

    if (!username.trim() || !password.trim()) {
      setLocalError('Please fill out all fields.');
      return;
    }

    try {
      if (mode === 'signup') {
        if (!walletAddress.trim()) {
          setLocalError('A cryptographic wallet address is required.');
          return;
        }
        
        let finalSubscriptions = subscribedLocalities;
        if (role === UserRole.AUTHORITY) {
          if (!selectedCity) {
            setLocalError('Please select your city.');
            return;
          }
          // Build single locality subscription matching the selected city for municipality account
          const authorityLocality: Locality = {
            id: `city_${selectedCity.name.toLowerCase().replace(/\s+/g, '_')}`,
            name: `${selectedCity.name} Municipal Area`,
            centerLocation: {
              latitude: selectedCity.latitude,
              longitude: selectedCity.longitude
            },
            boundaryRadiusMeters: 50000, // 50km boundary radius (extend to include outskirts)
            activeIssueCount: 0,
            subscriberCount: 1,
            createdAt: new Date().toISOString()
          };
          finalSubscriptions = [authorityLocality];
        } else if (role === UserRole.CITIZEN && subscribedLocalities.length === 0) {
          setLocalError('You must subscribe to at least 1 ward/location to start.');
          return;
        }
        
        await signup(
          username,
          password,
          role,
          finalSubscriptions,
          walletAddress
        );
      } else {
        await login(username, password);
      }
    } catch (err: any) {
      // Error handled by store
    }
  };

  return (
    <div className="w-full min-h-[calc(100vh-140px)] flex flex-col lg:flex-row items-center lg:items-start justify-center gap-12 py-8 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      
      {/* Left Column: Vision, Agenda, Project Description */}
      <div className="flex-1 text-center lg:text-left max-w-2xl">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-50 border border-amber-200/50 rounded-full text-amber-800 text-xs font-semibold mb-6 shadow-xs">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Transparent Civic Issue Management</span>
        </div>
        
        <h2 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-zinc-950 leading-tight mb-4 font-sans">
          Report Local Issues. 
          <br />
          Track Every Resolution.
        </h2>
        
        <p className="text-base sm:text-lg text-zinc-600 leading-relaxed mb-8">
          A collaborative platform where citizens report infrastructure issues, nearby residents verify them, and authorities track every action transparently where every milestone is permanently recorded on the blockchain for public accountability.
        </p>

        {/* Feature grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-left">
          <div className="flex gap-3">
            <div className="w-10 h-10 rounded-lg bg-zinc-100 flex items-center justify-center text-zinc-800 shrink-0 border border-zinc-200/55">
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-zinc-900">Local Community Verification</h4>
              <p className="text-xs text-zinc-500 mt-0.5">Residents subscribed to nearby localities can verify reported issues, improving accuracy and trust.</p>
            </div>
          </div>

          <div className="flex gap-3">
            <div className="w-10 h-10 rounded-lg bg-zinc-100 flex items-center justify-center text-zinc-800 shrink-0 border border-zinc-200/55">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-zinc-900">Transparent Audit Trail</h4>
              <p className="text-xs text-zinc-500 mt-0.5">Every report, verification, and status update is securely recorded on the blockchain for public accountability.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Right Column: Dynamic Form Box */}
      <div className="w-full max-w-lg shrink-0">
        <div className="bg-white border border-zinc-200 rounded-2xl shadow-xl overflow-hidden">
          
          {/* Header tabs toggle */}
          <div className="flex border-b border-zinc-100 bg-zinc-50">
            <button
              onClick={() => handleToggleMode('signin')}
              className={`flex-1 py-4 text-sm font-semibold transition-colors flex items-center justify-center gap-2 cursor-pointer ${
                mode === 'signin'
                  ? 'bg-white text-zinc-900 border-t-2 border-zinc-900'
                  : 'text-zinc-400 hover:text-zinc-600'
              }`}
            >
              <LogIn className="w-4 h-4" /> Sign In
            </button>
            <button
              onClick={() => handleToggleMode('signup')}
              className={`flex-1 py-4 text-sm font-semibold transition-colors flex items-center justify-center gap-2 cursor-pointer ${
                mode === 'signup'
                  ? 'bg-white text-zinc-900 border-t-2 border-zinc-900'
                  : 'text-zinc-400 hover:text-zinc-600'
              }`}
            >
              <UserPlus className="w-4 h-4" /> Register
            </button>
          </div>

          <div className="p-6 sm:p-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              
              {/* Errors Container */}
              {(localError || error) && (
                <div className="p-3 bg-rose-50 border border-rose-200/60 rounded-xl text-rose-700 text-xs font-medium leading-relaxed">
                  {localError || error}
                </div>
              )}

              {mode === 'signup' && (
                <div className="space-y-5">
                  
                  {/* Role selection cards */}
                  <div>
                    <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">
                      Choose Your Account Role
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          setRole(UserRole.CITIZEN);
                          setLocalError(null);
                        }}
                        className={`p-3.5 border rounded-xl text-left flex flex-col gap-1 transition-all cursor-pointer ${
                          role === UserRole.CITIZEN
                            ? 'border-blue-600 bg-blue-50/40 text-blue-900 ring-1 ring-blue-500/20'
                            : 'border-zinc-200 hover:border-zinc-300 text-zinc-600'
                        }`}
                      >
                        <User className={`w-5 h-5 ${role === UserRole.CITIZEN ? 'text-blue-600' : 'text-zinc-400'}`} />
                        <span className="text-sm font-bold mt-1">Citizen</span>
                        <span className="text-[10px] text-zinc-500 leading-snug">Report and audit local issues.</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setRole(UserRole.AUTHORITY);
                          setLocalError(null);
                        }}
                        className={`p-3.5 border rounded-xl text-left flex flex-col gap-1 transition-all cursor-pointer ${
                          role === UserRole.AUTHORITY
                            ? 'border-emerald-600 bg-emerald-50/40 text-emerald-900 ring-1 ring-emerald-500/20'
                            : 'border-zinc-200 hover:border-zinc-300 text-zinc-600'
                        }`}
                      >
                        <Building2 className={`w-5 h-5 ${role === UserRole.AUTHORITY ? 'text-emerald-600' : 'text-zinc-400'}`} />
                        <span className="text-sm font-bold mt-1">Municipality</span>
                        <span className="text-[10px] text-zinc-500 leading-snug">Assign repairs & upload resolutions.</span>
                      </button>
                    </div>
                  </div>

                  {/* Cryptographic Address Generator */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center">
                      <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider">
                        Generated Cryptographic Address
                      </label>
                      <button
                        type="button"
                        onClick={handleGenerateWallet}
                        className="text-[10px] text-zinc-600 hover:text-zinc-900 font-bold underline"
                      >
                        Generate New
                      </button>
                    </div>
                    <div className="relative">
                      <input
                        type="text"
                        value={walletAddress}
                        onChange={(e) => setWalletAddress(e.target.value)}
                        className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-mono text-zinc-600 focus:outline-none"
                        placeholder="0x..."
                      />
                      <KeyRound className="absolute right-3.5 top-3 w-4 h-4 text-zinc-400" />
                    </div>
                  </div>

                  {/* Select your city dropdown */}
                  {role === UserRole.AUTHORITY && (
                    <div className="space-y-1.5 relative">
                      <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider">
                        Select Your City
                      </label>
                      <button
                        type="button"
                        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                        className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-left text-xs font-medium text-zinc-700 focus:outline-none flex justify-between items-center cursor-pointer"
                      >
                        {selectedCity ? (
                          <span className="font-semibold text-zinc-950">{selectedCity.name} ({selectedCity.state})</span>
                        ) : (
                          <span className="text-zinc-400">Search & select city...</span>
                        )}
                        <MapPin className="w-4 h-4 text-zinc-400" />
                      </button>

                      {isDropdownOpen && (
                        <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-zinc-200 rounded-xl shadow-xl overflow-hidden flex flex-col max-h-[180px]">
                          <div className="p-2 border-b border-zinc-100 bg-zinc-50 flex items-center gap-1.5">
                            <Search className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                            <input
                              type="text"
                              value={citySearch}
                              onChange={(e) => setCitySearch(e.target.value)}
                              placeholder="Search city..."
                              className="w-full bg-transparent border-0 focus:outline-none focus:ring-0 text-xs text-zinc-800 p-0 focus-visible:outline-none"
                              autoFocus
                              onClick={(e) => e.stopPropagation()}
                            />
                          </div>
                          <div className="overflow-y-auto flex-1 divide-y divide-zinc-50 max-h-[140px]">
                            {filteredCities.length === 0 ? (
                              <div className="p-3 text-center text-xs text-zinc-400">No cities found</div>
                            ) : (
                              filteredCities.map((city) => (
                                <button
                                  key={`${city.name}-${city.state}`}
                                  type="button"
                                  onClick={() => {
                                    setSelectedCity(city);
                                    setCitySearch('');
                                    setIsDropdownOpen(false);
                                    setLocalError(null);
                                  }}
                                  className={`w-full text-left px-3.5 py-2 text-xs hover:bg-zinc-50 transition-colors flex justify-between items-center ${
                                    selectedCity?.name === city.name && selectedCity?.state === city.state ? 'bg-zinc-50 text-zinc-950 font-bold' : 'text-zinc-600'
                                  }`}
                                >
                                  <span>{city.name}</span>
                                  <span className="text-[10px] text-zinc-400 uppercase tracking-wider">{city.state}</span>
                                </button>
                              ))
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                </div>
              )}

              {/* Username & Password */}
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider">
                    Username
                  </label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500"
                    placeholder="e.g. janesmith"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500"
                      placeholder="••••••••"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-3 text-zinc-400 hover:text-zinc-600 cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Subscription Map Step (Citizens only, signup only) */}
              {mode === 'signup' && role === UserRole.CITIZEN && (
                <div className="space-y-3 pt-3 border-t border-zinc-100">
                  <div className="flex justify-between items-center">
                    <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider">
                      Locality Subscription (Min. 1)
                    </label>
                    <span className="text-[10px] font-bold text-zinc-500">
                      {subscribedLocalities.length} subscribed
                    </span>
                  </div>

                  {subscribedLocalities.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 p-3 bg-zinc-50 border border-zinc-200/50 rounded-xl max-h-[80px] overflow-y-auto">
                      {subscribedLocalities.map((loc, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 border border-blue-100 rounded-full text-blue-800 text-[11px] font-semibold"
                        >
                          {loc.name}
                          <button
                            type="button"
                            onClick={() => handleRemoveSubscription(idx)}
                            className="text-blue-500 hover:text-blue-800 font-bold ml-1 cursor-pointer"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="bg-zinc-50/50 p-3.5 border border-zinc-200/50 rounded-xl">
                    <LocationSearchAndSubscribe
                      onSubscribe={handleSubscribeDuringSignup}
                      buttonText="Add Subscription"
                    />
                  </div>
                </div>
              )}

              {/* Submit Action */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3.5 px-4 bg-zinc-950 text-white font-semibold rounded-xl hover:bg-zinc-900 active:bg-black disabled:bg-zinc-300 transition-colors flex items-center justify-center gap-2 shadow-lg shadow-zinc-950/10 cursor-pointer"
              >
                {isLoading ? (
                  <Loader2 className="w-4.5 h-4.5 animate-spin" />
                ) : mode === 'signup' ? (
                  <>Register & Connect Ledger</>
                ) : (
                  <>Sign In</>
                )}
              </button>
            </form>
          </div>

        </div>
      </div>

    </div>
  );
}
