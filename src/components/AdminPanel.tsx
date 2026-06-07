import React, { useState } from 'react';
import { SweepstakeState, Participant, Match, Team } from '../types';
import { Users, UserPlus, Trash, Edit, RefreshCw, AlertTriangle, ShieldCheck, PlayCircle, Trophy, PiggyBank } from 'lucide-react';

interface AdminPanelProps {
  state: SweepstakeState;
  onUpdateParticipants: (action: 'add' | 'edit' | 'delete', participant: any) => Promise<void>;
  onRedraft: () => Promise<void>;
  onOverrideMatch: (matchId: string, homeScore: number, awayScore: number, penaltyWinnerId?: string) => Promise<void>;
  onStartCampaign: () => Promise<void>;
  onResetTournament: () => Promise<void>;
  onUpdateCollectiv: (entryFee: number, link: string, currency: string) => Promise<void>;
  loading: boolean;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({
  state,
  onUpdateParticipants,
  onRedraft,
  onOverrideMatch,
  onStartCampaign,
  onResetTournament,
  onUpdateCollectiv,
  loading
}) => {
  const { participants, teams, matches, status } = state;

  // Once any participant has teams assigned, the draw is locked
  const teamsAllocated = participants.some(p => p.assignedTeamIds.length > 0);

  const [newName, setNewName] = useState('');

  // Editing state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  // Match override state
  const [selectedMatchId, setSelectedMatchId] = useState('');
  const [overrideH, setOverrideH] = useState('0');
  const [overrideA, setOverrideA] = useState('0');
  const [overridePenWinner, setOverridePenWinner] = useState('');

  const handleAddParticipant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    await onUpdateParticipants('add', { name: newName.trim() });
    setNewName('');
  };

  const handleSaveEdit = async (pId: string) => {
    const original = participants.find(p => p.id === pId);
    if (!original || !editName.trim()) return;
    await onUpdateParticipants('edit', { ...original, name: editName.trim() });
    setEditingId(null);
  };

  const startEdit = (p: Participant) => {
    setEditingId(p.id);
    setEditName(p.name);
  };

  const handleMatchOverrideSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMatchId) return;
    await onOverrideMatch(selectedMatchId, Number(overrideH), Number(overrideA), overridePenWinner || undefined);
    setSelectedMatchId('');
  };

  const selectedMatchObj = matches.find(m => m.id === selectedMatchId);
  const hTeam = selectedMatchObj ? teams.find(t => t.id === selectedMatchObj.homeTeamId) : null;
  const aTeam = selectedMatchObj ? teams.find(t => t.id === selectedMatchObj.awayTeamId) : null;

  // Pot settings state
  const [potFee, setPotFee] = useState(state.collectiv.entryFee.toString());
  const [potUrl, setPotUrl] = useState(state.collectiv.link);
  const [potCurrency, setPotCurrency] = useState(state.collectiv.currency);
  const [potSaved, setPotSaved] = useState(false);

  const handlePotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onUpdateCollectiv(Number(potFee) || 0, potUrl, potCurrency);
    setPotSaved(true);
    setTimeout(() => setPotSaved(false), 2000);
  };

  return (
    <div className="space-y-5">
      {/* Info banner */}
      <div className="bg-[#161b22] border border-white/5 rounded-2xl p-5">
        <h3 className="text-lg font-display font-black text-white mb-1 flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-green-400" />
          Admin Control Room
        </h3>
        <p className="text-xs text-slate-400">
          Manage players, run the team draw, enter real match scores, or reset the tournament. Redrafting randomly reallocates all 48 teams.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Participants Management Column */}
        <div className="bg-[#161b22] border border-white/5 rounded-2xl p-5 space-y-5">
          <div className="flex justify-between items-center pb-2 border-b border-white/5">
            <h4 className="font-display font-black text-white flex items-center gap-2 text-sm">
              <Users className="h-4 w-4 text-green-400" />
              Players ({participants.length}/16)
            </h4>
          </div>

          {/* Lock notice when teams have been allocated */}
          {teamsAllocated && (
            <div className="flex items-start gap-2 bg-amber-950/30 border border-amber-700/30 rounded-xl px-3 py-2.5 text-xs text-amber-300">
              <span className="text-base leading-none mt-0.5">🔒</span>
              <span className="font-semibold">Teams have been allocated - player list is now locked. Reset the sweepstake to make changes.</span>
            </div>
          )}

          {/* Add participant Form */}
          <form onSubmit={handleAddParticipant} className={`grid grid-cols-1 sm:grid-cols-2 gap-2 ${teamsAllocated ? 'opacity-40 pointer-events-none select-none' : ''}`}>
            <input
              type="text"
              placeholder="Name (e.g. Dan)"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="bg-[#0d1117] border border-white/8 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-green-700"
            />
            <button
              type="submit"
              disabled={loading || !newName.trim()}
              className="bg-green-700 hover:bg-green-600 text-white text-sm font-display font-bold px-4 py-2 rounded-xl transition-all flex items-center justify-center gap-1.5 disabled:opacity-40 cursor-pointer"
            >
              <UserPlus className="h-3.5 w-3.5" />
              Add Player
            </button>
          </form>
          {/* List of members */}
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {participants.map((p) => {
              const isEditing = editingId === p.id;
              return (
                <div
                  key={p.id}
                  className="bg-black/20 border border-white/5 rounded-xl p-3 flex justify-between items-center gap-4 hover:border-white/10"
                >
                  {isEditing ? (
                    <div className="flex flex-1 gap-2">
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="bg-[#0d1117] border border-white/10 rounded-lg px-2.5 py-1 text-sm text-white focus:outline-none focus:border-green-700"
                      />
                    </div>
                  ) : (
                    <div className="truncate">
                      <div className="text-sm font-display font-bold text-white">{p.name}</div>
                      <div className="text-[10px] text-slate-500 mt-1">
                        {p.assignedTeamIds.length} teams assigned
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-1 shrink-0">
                    {!isEditing && (
                      <button
                        onClick={() => onUpdateParticipants('edit', { ...p, hasPaid: !p.hasPaid })}
                        className={`text-xs font-bold px-2 py-1 rounded-lg transition-all cursor-pointer ${
                          p.hasPaid
                            ? 'bg-green-800/40 text-green-300 hover:bg-rose-900/40 hover:text-rose-300'
                            : 'bg-white/5 text-slate-500 hover:bg-green-800/40 hover:text-green-300'
                        }`}
                        title="Toggle payment status"
                      >
                        {p.hasPaid ? '£ Paid' : 'Unpaid'}
                      </button>
                    )}
                    {isEditing ? (
                      <button
                        onClick={() => handleSaveEdit(p.id)}
                        className="text-emerald-400 hover:text-emerald-300 text-xs px-2 py-1 font-semibold"
                      >
                        Save
                      </button>
                    ) : (
                      <button
                        onClick={() => !teamsAllocated && startEdit(p)}
                        disabled={teamsAllocated}
                        className={`text-slate-400 hover:text-slate-200 p-1.5 ${teamsAllocated ? 'opacity-30 cursor-not-allowed' : ''}`}
                        title="Edit member"
                      >
                        <Edit className="h-3.5 w-3.5" />
                      </button>
                    )}

                    <button
                      onClick={() => !teamsAllocated && onUpdateParticipants('delete', p)}
                      disabled={teamsAllocated}
                      className={`text-rose-500 hover:text-rose-400 p-1.5 ${teamsAllocated ? 'opacity-30 cursor-not-allowed' : ''}`}
                      title="Delete member and redistribute teams"
                    >
                      <Trash className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="border-t border-white/5 pt-4 flex gap-2">
            <button
              onClick={onRedraft}
              disabled={teamsAllocated || loading}
              title={teamsAllocated ? 'Teams are locked after allocation' : undefined}
              className={`flex-1 bg-white/5 hover:bg-white/10 border border-white/8 text-slate-200 hover:text-white py-2.5 px-4 rounded-xl text-sm font-display font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${teamsAllocated ? 'opacity-40 cursor-not-allowed' : ''}`}
            >
              <RefreshCw className="h-4 w-4" />
              Random Team Draw
            </button>

            {status === 'setup' && (
              <button
                onClick={onStartCampaign}
                className="flex-1 bg-green-700 hover:bg-green-600 text-white py-2.5 px-4 rounded-xl text-sm font-display font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              >
                <PlayCircle className="h-4 w-4" />
                Start Tournament!
              </button>
            )}
          </div>
        </div>

        {/* Override results column */}
          <div className="space-y-5">
            <div className="bg-[#161b22] border border-white/5 rounded-2xl p-5">
              <h4 className="font-display font-black text-white flex items-center gap-2 text-sm pb-2 border-b border-white/5 mb-4">
                <Trophy className="h-4 w-4 text-amber-400" />
                Enter Real Match Scores
              </h4>

            <form onSubmit={handleMatchOverrideSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-display font-semibold text-slate-400 uppercase tracking-widest mb-1">
                  Select Match
                </label>
                <select
                  value={selectedMatchId}
                  onChange={(e) => {
                    setSelectedMatchId(e.target.value);
                    const match = matches.find(m => m.id === e.target.value);
                    if (match) {
                      setOverrideH((match.homeScore || 0).toString());
                      setOverrideA((match.awayScore || 0).toString());
                    }
                  }}
                  className="w-full bg-[#0d1117] border border-white/8 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-green-700"
                >
                  <option value="">-- Choose unplayed or played match --</option>
                  {matches.map((m) => {
                    const home = teams.find(t => t.id === m.homeTeamId);
                    const away = teams.find(t => t.id === m.awayTeamId);
                    return (
                      <option key={m.id} value={m.id}>
                        [{m.group ? `Group ${m.group}` : m.stage.toUpperCase()}] {home?.name} vs {away?.name} {m.isPlayed ? `(${m.homeScore}-${m.awayScore})` : '(unplayed)'}
                      </option>
                    );
                  })}
                </select>
              </div>

              {selectedMatchId && selectedMatchObj && (
                <div className="bg-black/30 p-4 border border-white/8 rounded-xl space-y-4">
                  <div className="flex justify-between items-center text-center font-semibold text-xs text-slate-300">
                    <span className="w-1/3 truncate">{hTeam?.flag} {hTeam?.name}</span>
                    <span className="text-[10px] text-slate-500 font-mono">VS</span>
                    <span className="w-1/3 truncate text-right">{aTeam?.name} {aTeam?.flag}</span>
                  </div>

                  <div className="flex justify-center items-center gap-4">
                    <div className="flex flex-col items-center">
                      <span className="text-[10px] text-slate-500 mb-1 font-display font-semibold uppercase">Home Score</span>
                      <input
                        type="number"
                        min="0"
                        value={overrideH}
                        onChange={(e) => setOverrideH(e.target.value)}
                        className="w-16 bg-[#0d1117] border border-white/10 text-center rounded-lg px-2 py-1.5 text-sm text-white font-mono focus:outline-none focus:border-green-700"
                      />
                    </div>

                    <div className="flex flex-col items-center">
                      <span className="text-[10px] text-slate-500 mb-1 font-display font-semibold uppercase">Away Score</span>
                      <input
                        type="number"
                        min="0"
                        value={overrideA}
                        onChange={(e) => setOverrideA(e.target.value)}
                        className="w-16 bg-[#0d1117] border border-white/10 text-center rounded-lg px-2 py-1.5 text-sm text-white font-mono focus:outline-none focus:border-green-700"
                      />
                    </div>
                  </div>

                  {/* Knockout penalty resolution tie breaker */}
                  {selectedMatchObj.stage !== 'groups' && overrideH === overrideA && (
                    <div className="border-t border-white/5 pt-3 flex flex-col items-center">
                      <label className="text-[10px] text-slate-400 mb-1 font-display font-semibold uppercase tracking-widest">
                        Penalty Winner
                      </label>
                      <select
                        value={overridePenWinner}
                        onChange={(e) => setOverridePenWinner(e.target.value)}
                        className="bg-[#0d1117] border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-green-700"
                        required
                      >
                        <option value="">-- Choose penalty winner --</option>
                        <option value={selectedMatchObj.homeTeamId}>{hTeam?.name} wins</option>
                        <option value={selectedMatchObj.awayTeamId}>{aTeam?.name} wins</option>
                      </select>
                    </div>
                  )}

                  <button
                    type="submit"
                    className="w-full bg-green-700 hover:bg-green-600 text-white text-sm font-display font-bold py-2.5 rounded-xl transition-all cursor-pointer"
                  >
                    Apply Score
                  </button>
                </div>
              )}
            </form>
          </div>

          {/* Pot settings */}
          <div className="bg-[#161b22] border border-white/5 rounded-2xl p-5">
            <h4 className="font-display font-black text-white flex items-center gap-2 text-sm pb-3 border-b border-white/5 mb-4">
              <PiggyBank className="h-4 w-4 text-green-400" />
              Pot Settings
            </h4>
            <form onSubmit={handlePotSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-display font-semibold text-slate-400 uppercase tracking-widest mb-1">Currency</label>
                <select
                  value={potCurrency}
                  onChange={(e) => setPotCurrency(e.target.value)}
                  className="w-full bg-[#0d1117] border border-white/8 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-green-700"
                >
                  <option value="GBP">GBP (£)</option>
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="CAD">CAD (CA$)</option>
                  <option value="AUD">AUD (AU$)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-display font-semibold text-slate-400 uppercase tracking-widest mb-1">Entry Fee (per person)</label>
                <input
                  type="number"
                  value={potFee}
                  onChange={(e) => setPotFee(e.target.value)}
                  min="0"
                  className="w-full bg-[#0d1117] border border-white/8 rounded-xl px-3 py-2 text-sm text-slate-200 font-mono focus:outline-none focus:border-green-700"
                />
              </div>
              <div>
                <label className="block text-xs font-display font-semibold text-slate-400 uppercase tracking-widest mb-1">Collectiv Payment URL</label>
                <input
                  type="url"
                  value={potUrl}
                  onChange={(e) => setPotUrl(e.target.value)}
                  placeholder="https://pay.collctiv.com/..."
                  className="w-full bg-[#0d1117] border border-white/8 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-green-700"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-green-700 hover:bg-green-600 text-white text-sm font-display font-bold py-2.5 rounded-xl transition-all cursor-pointer disabled:opacity-50"
              >
                {potSaved ? 'Saved ✓' : 'Save Pot Settings'}
              </button>
            </form>
          </div>

          <div className="bg-[#130808] border border-rose-900/30 border-dashed rounded-2xl p-5 space-y-3">
              <h4 className="font-display font-black text-rose-400 flex items-center gap-2 text-sm">
                <AlertTriangle className="h-4 w-4" />
                Danger Zone
              </h4>
              <p className="text-xs text-slate-500">
                Resets all simulated results, clears knockout stages, and returns to setup status.
            </p>

            <button
              onClick={() => {
                if(confirm("Reset the World Cup sweepstake? This deletes all results!")) {
                  onResetTournament();
                }
              }}
              className="bg-transparent hover:bg-rose-950/30 text-rose-500 border border-rose-900/50 font-display font-bold text-sm py-2 px-4 rounded-xl transition-all cursor-pointer"
            >
              Reset Sweepstake
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
