import React, { useState, useEffect, useCallback, ReactNode } from 'react';
import { SweepstakeState } from './types';
import { Leaderboard } from './components/Leaderboard';
import { MatchesList } from './components/MatchesList';
import { TeamsGrid } from './components/TeamsGrid';
import { CollectivPanel } from './components/CollectivPanel';
import { AdminPanel } from './components/AdminPanel';
import { HelpCircle, RefreshCw, Wifi, WifiOff } from 'lucide-react';
import { LiveDraw } from './components/LiveDraw';

interface SyncStatus {
  lastSyncTime: string | null;
  lastSyncStatus: 'ok' | 'error' | 'no_key' | 'idle';
  lastSyncMessage: string;
  apiKeyConfigured: boolean;
}

export default function App() {
  const [state, setState] = useState<SweepstakeState | null>(null);
  const [activeTab, setActiveTab] = useState<'leaderboard' | 'matches' | 'groups' | 'collectiv' | 'admin' | 'draw'>('leaderboard');
  const [loading, setLoading] = useState(false);
  const [connecting, setConnecting] = useState(true);
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [syncing, setSyncing] = useState(false);

  // Admin auth
  const [adminUnlocked, setAdminUnlocked] = useState(false);
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [adminPasswordInput, setAdminPasswordInput] = useState('');
  const [adminAuthError, setAdminAuthError] = useState('');
  const [adminAuthLoading, setAdminAuthLoading] = useState(false);

  // Core API loader
  const loadState = useCallback(async () => {
    try {
      const res = await fetch("/api/sweepstake/state");
      if (res.ok) {
        const data = await res.json();
        setState(data);
      }
    } catch (err) {
      console.error("Failed to fetch state:", err);
    } finally {
      setConnecting(false);
    }
  }, []);

  const loadSyncStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/sweepstake/sync-status");
      if (res.ok) setSyncStatus(await res.json());
    } catch {/* non-critical */}
  }, []);

  const handleManualSync = useCallback(async () => {
    setSyncing(true);
    try {
      const res = await fetch("/api/sweepstake/sync-scores", { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setSyncStatus(data);
        await loadState(); // refresh state after sync
      }
    } catch (err) {
      console.error("Sync failed:", err);
    } finally {
      setSyncing(false);
    }
  }, [loadState]);

  useEffect(() => {
    loadState();
    loadSyncStatus();
    // Refresh state automatically every 8 seconds
    const pollId = setInterval(loadState, 8000);
    // Check sync status every 30 seconds
    const syncPollId = setInterval(loadSyncStatus, 30000);
    return () => { clearInterval(pollId); clearInterval(syncPollId); };
  }, [loadState]);

  // Handle participant update actions
  const handleUpdateParticipants = async (action: 'add' | 'edit' | 'delete', participant: any) => {
    setLoading(true);
    try {
      const res = await fetch("/api/sweepstake/participants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, participant }),
      });
      if (res.ok) {
        const updated = await res.json();
        setState(updated);
      }
    } catch (err) {
      console.error("Failed to update participants:", err);
    } finally {
      setLoading(false);
    }
  };

  // Handle setting Collectiv configuration
  const handleUpdateCollectiv = async (entryFee: number, link: string, currency: string) => {
    setLoading(true);
    try {
      const res = await fetch("/api/sweepstake/collectiv", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entryFee, link, currency }),
      });
      if (res.ok) {
        const updated = await res.json();
        setState(updated);
      }
    } catch (err) {
      console.error("Failed to update collectiv:", err);
    } finally {
      setLoading(false);
    }
  };

  // Handle toggling payment status
  const handleTogglePayment = async (participantId: string, currentStatus: boolean) => {
    try {
      const res = await fetch("/api/sweepstake/payment-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ participantId, hasPaid: !currentStatus }),
      });
      if (res.ok) {
        const updated = await res.json();
        setState(updated);
      }
    } catch (err) {
      console.error("Failed to toggle payment status:", err);
    }
  };

  // Handle redraft - returns updated state for LiveDraw animation
  const handleRedraft = async (): Promise<SweepstakeState | null> => {
    setLoading(true);
    try {
      const res = await fetch("/api/sweepstake/redraft", { method: "POST" });
      if (res.ok) {
        const updated = await res.json();
        setState(updated);
        return updated;
      }
    } catch (err) {
      console.error("Failed to redraft teams:", err);
    } finally {
      setLoading(false);
    }
    return null;
  };

  // Admin password auth
  const handleAdminAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminAuthLoading(true);
    setAdminAuthError('');
    try {
      const res = await fetch('/api/sweepstake/admin-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: adminPasswordInput }),
      });
      if (res.ok) {
        setAdminUnlocked(true);
        setShowAdminModal(false);
        setAdminPasswordInput('');
        setActiveTab('admin');
      } else {
        setAdminAuthError('Incorrect password. Try again.');
      }
    } catch {
      setAdminAuthError('Connection error. Try again.');
    } finally {
      setAdminAuthLoading(false);
    }
  };

  // Begin tournament
  const handleStartCampaign = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/sweepstake/start-competition", { method: "POST" });
      if (res.ok) {
        const updated = await res.json();
        setState(updated);
        setActiveTab('matches'); // toggle over to playing match ticker
      }
    } catch (err) {
      console.error("Failed to start competition:", err);
    } finally {
      setLoading(false);
    }
  };

  // Override game scores
  const handleOverrideMatch = async (matchId: string, homeScore: number, awayScore: number, penaltyWinnerId?: string) => {
    setLoading(true);
    try {
      const res = await fetch("/api/sweepstake/match-override", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matchId, homeScore, awayScore, penaltyWinnerId }),
      });
      if (res.ok) {
        const updated = await res.json();
        setState(updated);
      }
    } catch (err) {
      console.error("Failed to override match:", err);
    } finally {
      setLoading(false);
    }
  };

  // Simulate updates
  const handleSimulate = async (mode: 'next' | 'round' | 'all') => {
    setLoading(true);
    try {
      const res = await fetch("/api/sweepstake/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode }),
      });
      if (res.ok) {
        const updated = await res.json();
        setState(updated);
      }
    } catch (err) {
      console.error("Failed to run match simulation:", err);
    } finally {
      setLoading(false);
    }
  };

  // Reset tournament back to zero
  const handleResetTournament = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/sweepstake/reset", { method: "POST" });
      if (res.ok) {
        const updated = await res.json();
        setState(updated);
        setAdminUnlocked(false);
        setActiveTab('leaderboard');
      }
    } catch (err) {
      console.error("Failed to reset tournament:", err);
    } finally {
      setLoading(false);
    }
  };

  if (connecting) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#0d1117] text-slate-100 p-6">
        <div className="flex flex-col items-center gap-4">
          <div className="text-5xl animate-pulse">⚽</div>
          <h2 className="text-xl font-display font-bold text-white">Connecting to sweepstake...</h2>
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <RefreshCw className="h-4 w-4 animate-spin" />
            Loading tournament data
          </div>
        </div>
      </div>
    );
  }

  if (!state) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#0d1117] text-slate-100 p-6">
        <div className="bg-[#161b22] border border-red-900/40 rounded-2xl p-8 text-center max-w-md">
          <HelpCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
          <h3 className="text-lg font-display font-bold text-white">Connection error</h3>
          <p className="text-sm text-slate-400 mt-2">
            The server did not respond with tournament data. Restart the dev server or check logs.
          </p>
        </div>
      </div>
    );
  }

  const activeStageLabel = () => {
    if (state.status === 'setup') return 'Draft / Setup';
    const unplayedCount = state.matches.filter(m => !m.isPlayed).length;
    if (state.status === 'completed' || unplayedCount === 0) return 'Tournament Complete';
    const nextUnplayed = state.matches.find(m => !m.isPlayed);
    if (!nextUnplayed) return 'Knockout Stage';
    if (nextUnplayed.stage === 'groups') return `Group Stage`;
    if (nextUnplayed.stage === 'r32') return 'Round of 32';
    if (nextUnplayed.stage === 'r16') return 'Round of 16';
    if (nextUnplayed.stage === 'qf') return 'Quarter-Finals';
    if (nextUnplayed.stage === 'sf') return 'Semi-Finals';
    if (nextUnplayed.stage === 'final') return 'World Cup Final';
    return 'Active Tournament';
  };

  const getWinnerUser = () => {
    if (!state.winnerTeamId) return null;
    const team = state.teams.find(t => t.id === state.winnerTeamId);
    const user = state.participants.find(p => p.assignedTeamIds.includes(state.winnerTeamId || ""));
    return { team, user };
  };

  const winnerData = getWinnerUser();

  const isLive = state.status !== 'setup' && state.status !== 'completed';
  const paidCount = state.participants.filter(p => p.hasPaid).length;

  const tabs: { key: typeof activeTab; label: string; icon: ReactNode; disabled?: boolean; highlight?: boolean }[] = [
    { key: 'leaderboard', label: 'Leaderboard', icon: <span className="text-base leading-none">🏆</span> },
    { key: 'matches', label: 'Matches', icon: <span className="text-base leading-none">⚽</span>, disabled: state.status === 'setup' },
    { key: 'groups', label: 'Teams', icon: <span className="text-base leading-none">🌍</span> },
    { key: 'collectiv', label: 'Pot', icon: <span className="text-base leading-none">💰</span> },
    { key: 'draw', label: 'Live Draw', icon: <span className="text-base leading-none">🎰</span>, highlight: true },
    { key: 'admin', label: 'Admin', icon: <span className="text-base leading-none">⚙️</span> },
  ];

  return (
    <div className="min-h-screen bg-[#0d1117] text-slate-100 flex flex-col antialiased overflow-x-hidden">

      {/* Top bar */}
      <div className="bg-gradient-to-r from-green-950 via-[#0f3d1e] to-green-950 border-b border-green-900/30 py-2 px-4 flex items-center justify-center gap-2 text-xs font-display font-semibold tracking-widest text-green-400 uppercase select-none shrink-0">
        <span>⚽</span>
        <span>FIFA World Cup 2026 - USA · Canada · Mexico</span>
        <span>⚽</span>
      </div>

      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex-1 flex flex-col gap-5 pb-12">

        {/* Header */}
        <header className="relative overflow-hidden rounded-2xl border border-green-900/30 shadow-2xl"
          style={{ background: 'linear-gradient(135deg, #0f2318 0%, #061410 60%, #0a1c10 100%)' }}>
          <div className="absolute inset-0 opacity-10"
            style={{ backgroundImage: 'radial-gradient(circle at 20% 50%, #22c55e 0%, transparent 50%), radial-gradient(circle at 80% 50%, #f5c518 0%, transparent 50%)' }} />
          <div className="relative p-6 flex flex-col md:flex-row items-center md:items-center justify-between gap-5">
            <div className="flex items-center gap-5 w-full md:w-auto justify-center md:justify-start">
              <div className="text-6xl drop-shadow-2xl select-none">🏆</div>
              <div className="text-center md:text-left">
                <h1 className="text-3xl md:text-4xl font-display font-black text-white leading-none tracking-tight">
                  World Cup 2026
                </h1>
                <p className="text-sm font-display font-bold text-green-400 mt-1 tracking-wider uppercase">
                  Sweepstake
                </p>
                <p className="text-xs text-slate-400 mt-1.5">
                  60% Winner · 25% Runner-Up · 15% Wooden Spoon
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <div className="bg-black/40 border border-green-900/40 rounded-xl px-4 py-3 min-w-[90px]">
                <div className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold mb-1">Paid In</div>
                <div className="font-display font-black text-lg text-amber-400 leading-none">
                  {paidCount}<span className="text-slate-500 font-semibold text-sm">/{state.participants.length}</span>
                </div>
              </div>

              {state.collectiv.entryFee > 0 && state.participants.length > 0 && (
                <div className="bg-black/40 border border-amber-900/30 rounded-xl px-4 py-3 min-w-[90px]">
                  <div className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold mb-1">Total Pot</div>
                  <div className="font-display font-black text-lg text-amber-300 leading-none">
                    {state.collectiv.currency}{(state.participants.length * state.collectiv.entryFee).toFixed(0)}
                  </div>
                </div>
              )}

              {/* Live sync status badge */}
              <div className={`bg-black/40 border rounded-xl px-4 py-3 min-w-[110px] ${
                syncStatus?.apiKeyConfigured
                  ? syncStatus.lastSyncStatus === 'ok' ? 'border-green-900/40' : 'border-rose-900/30'
                  : 'border-white/5'
              }`}>
                <div className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold mb-1">Live Scores</div>
                <div className="flex items-center gap-1.5">
                  {syncStatus?.apiKeyConfigured ? (
                    syncStatus.lastSyncStatus === 'ok' ? (
                      <Wifi className="h-3.5 w-3.5 text-green-400 shrink-0" />
                    ) : (
                      <WifiOff className="h-3.5 w-3.5 text-rose-400 shrink-0" />
                    )
                  ) : (
                    <WifiOff className="h-3.5 w-3.5 text-slate-600 shrink-0" />
                  )}
                  <span className={`text-xs font-display font-bold ${
                    syncStatus?.apiKeyConfigured
                      ? syncStatus.lastSyncStatus === 'ok' ? 'text-green-400' : 'text-rose-400'
                      : 'text-slate-600'
                  }`}>
                    {syncStatus?.apiKeyConfigured ? 'Auto-sync' : 'Manual'}
                  </span>
                </div>
                {syncStatus?.apiKeyConfigured && syncStatus.lastSyncTime && (
                  <div className="text-[9px] text-slate-600 mt-0.5">
                    {new Date(syncStatus.lastSyncTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                )}
                {!syncStatus?.apiKeyConfigured && (
                  <button
                    onClick={handleManualSync}
                    disabled={syncing}
                    className="mt-1 text-[9px] text-slate-500 hover:text-slate-300 flex items-center gap-1 cursor-pointer disabled:opacity-40 transition-colors"
                    title="Manually trigger score sync"
                  >
                    <RefreshCw className={`h-2.5 w-2.5 ${syncing ? 'animate-spin' : ''}`} />
                    {syncing ? 'Syncing...' : 'Sync now'}
                  </button>
                )}
              </div>

            </div>
          </div>
        </header>

        {/* Champion banner */}
        {state.status === 'completed' && winnerData?.user && winnerData?.team && (
          <div className="relative overflow-hidden rounded-2xl border border-amber-500/30 text-center p-8"
            style={{ background: 'linear-gradient(135deg, #2d1a00 0%, #1a1000 50%, #2d1a00 100%)' }}>
            <div className="absolute inset-0 opacity-20"
              style={{ backgroundImage: 'radial-gradient(circle at 50% 0%, #f5c518 0%, transparent 60%)' }} />
            <div className="relative">
              <div className="text-5xl mb-3">🏆</div>
              <h2 className="text-3xl font-display font-black text-amber-300 tracking-tight">WORLD CUP CHAMPION!</h2>
              <p className="text-base text-slate-300 mt-2 max-w-2xl mx-auto">
                {winnerData.team.flag} <strong>{winnerData.team.name}</strong> wins the 2026 World Cup!{' '}
                Congratulations to <strong className="text-amber-300 font-display">{winnerData.user.name}</strong> - 60% pot winner!
              </p>
              {state.worstTeamId && (
                <p className="text-xs text-slate-500 mt-3">
                  Wooden Spoon: {state.teams.find(t => t.id === state.worstTeamId)?.flag}{' '}
                  {state.teams.find(t => t.id === state.worstTeamId)?.name} - owned by{' '}
                  {state.participants.find(p => p.assignedTeamIds.includes(state.worstTeamId || ""))?.name}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Tab navigation */}
        <nav className="flex overflow-x-auto gap-1 p-1.5 bg-[#161b22] rounded-xl border border-white/5 shrink-0">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => {
                if (tab.disabled) return;
                if ((tab.key === 'admin' || tab.key === 'draw') && !adminUnlocked) {
                  setShowAdminModal(true);
                  setAdminAuthError('');
                  setAdminPasswordInput('');
                } else {
                  setActiveTab(tab.key);
                }
              }}
              disabled={tab.disabled}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-display font-semibold whitespace-nowrap transition-all duration-150 cursor-pointer ${
                tab.disabled
                  ? 'opacity-40 cursor-not-allowed text-slate-500'
                  : activeTab === tab.key
                  ? tab.highlight
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-lg'
                    : 'bg-green-800/60 text-green-300 border border-green-700/50 shadow-lg'
                  : tab.highlight
                  ? 'text-amber-400/70 hover:text-amber-300 hover:bg-amber-500/10'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              {tab.icon}
              {tab.label}
              {tab.key === 'matches' && isLive && (
                <span className="ml-1 h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />
              )}
              {(tab.key === 'admin' || tab.key === 'draw') && !adminUnlocked && (
                <span className="ml-0.5 text-slate-500">🔒</span>
              )}
            </button>
          ))}
        </nav>

        {/* Tab content */}
        <main className="flex-1">
          {activeTab === 'leaderboard' && (
            <Leaderboard state={state} />
          )}
          {activeTab === 'matches' && (
            <MatchesList state={state} />
          )}
          {activeTab === 'groups' && (
            <TeamsGrid state={state} />
          )}
          {activeTab === 'collectiv' && (
            <CollectivPanel state={state} onTogglePayment={handleTogglePayment} />
          )}
          {activeTab === 'admin' && (
            <AdminPanel
              state={state}
              onUpdateParticipants={handleUpdateParticipants}
              onRedraft={handleRedraft}
              onOverrideMatch={handleOverrideMatch}
              onStartCampaign={handleStartCampaign}
              onResetTournament={handleResetTournament}
              onUpdateCollectiv={handleUpdateCollectiv}
              loading={loading}
            />
          )}
          {activeTab === 'draw' && (
            <LiveDraw
              state={state}
              onStartDraw={handleRedraft}
              onUpdateParticipants={handleUpdateParticipants}
              loading={loading}
            />
          )}
        </main>
      </div>

      {/* Admin password modal */}
      {showAdminModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) { setShowAdminModal(false); setAdminPasswordInput(''); setAdminAuthError(''); } }}
        >
          <div className="bg-[#161b22] border border-white/10 rounded-2xl p-8 w-full max-w-sm shadow-2xl">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-2xl">🔒</span>
              <h2 className="text-xl font-display font-black text-white">Admin Access</h2>
            </div>
            <p className="text-sm text-slate-400 mb-6">Enter the admin password to continue.</p>
            <form onSubmit={handleAdminAuth} className="space-y-4">
              <input
                type="password"
                placeholder="Password"
                value={adminPasswordInput}
                onChange={(e) => { setAdminPasswordInput(e.target.value); setAdminAuthError(''); }}
                autoFocus
                className="w-full bg-[#0d1117] border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-green-600"
              />
              {adminAuthError && (
                <p className="text-xs text-rose-400 font-semibold">{adminAuthError}</p>
              )}
              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => { setShowAdminModal(false); setAdminPasswordInput(''); setAdminAuthError(''); }}
                  className="flex-1 bg-white/5 hover:bg-white/10 border border-white/8 text-slate-300 font-display font-bold text-sm py-2.5 rounded-xl transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={adminAuthLoading || !adminPasswordInput}
                  className="flex-1 bg-green-700 hover:bg-green-600 text-white font-display font-bold text-sm py-2.5 rounded-xl transition-all cursor-pointer disabled:opacity-40"
                >
                  {adminAuthLoading ? 'Checking...' : 'Unlock'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
