import React, { useState, useEffect, useRef } from 'react';
import { SweepstakeState, Team } from '../types';
import { Shuffle, ChevronRight, UserPlus, X, Zap, Trophy } from 'lucide-react';

interface LiveDrawProps {
  state: SweepstakeState;
  onStartDraw: () => Promise<SweepstakeState | null>;
  onUpdateParticipants: (action: 'add' | 'edit' | 'delete', participant: any) => Promise<void>;
  loading: boolean;
}

type Phase = 'setup' | 'name-announce' | 'reveal' | 'player-done' | 'complete';

export const LiveDraw: React.FC<LiveDrawProps> = ({ state, onStartDraw, onUpdateParticipants, loading }) => {
  const [phase, setPhase] = useState<Phase>('setup');
  const [drawnState, setDrawnState] = useState<SweepstakeState | null>(null);
  const [playerIdx, setPlayerIdx] = useState(0);
  const [revealedCount, setRevealedCount] = useState(0);
  const [spinningSlot, setSpinningSlot] = useState<number | null>(null);
  const [spinFlag, setSpinFlag] = useState('');
  const [newName, setNewName] = useState('');
  const spinRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const liveData = drawnState || state;
  const { teams, participants } = liveData;
  const currentPlayer = participants[playerIdx];

  const teamsAllocated = participants.some(p => p.assignedTeamIds.length > 0);
  const tournamentActive = state.status === 'active' || state.status === 'completed';
  const drawLocked = teamsAllocated || tournamentActive;

  const getTeam = (id: string): Team | undefined => teams.find(t => t.id === id);

  // Auto-advance name announce -> reveal after 2s
  useEffect(() => {
    if (phase !== 'name-announce') return;
    const t = setTimeout(() => setPhase('reveal'), 2000);
    return () => clearTimeout(t);
  }, [phase, playerIdx]);

  // Auto-advance to player-done when all 3 teams revealed
  useEffect(() => {
    if (phase === 'reveal' && revealedCount >= 3) {
      const t = setTimeout(() => setPhase('player-done'), 700);
      return () => clearTimeout(t);
    }
  }, [revealedCount, phase]);

  // Cleanup spinner on unmount
  useEffect(() => () => { if (spinRef.current) clearInterval(spinRef.current); }, []);

  const handleStartDraw = async () => {
    const result = await onStartDraw();
    if (!result) return;
    setDrawnState(result);
    setPlayerIdx(0);
    setRevealedCount(0);
    setPhase('name-announce');
  };

  const handleReveal = () => {
    if (spinningSlot !== null || revealedCount >= 3) return;
    const slot = revealedCount;
    setSpinningSlot(slot);

    let ticks = 0;
    spinRef.current = setInterval(() => {
      const rnd = teams[Math.floor(Math.random() * teams.length)];
      setSpinFlag(rnd.flag);
      ticks++;
      if (ticks >= 18) {
        clearInterval(spinRef.current!);
        setSpinningSlot(null);
        setSpinFlag('');
        setRevealedCount(prev => prev + 1);
      }
    }, 85);
  };

  const handleNextPlayer = () => {
    if (playerIdx >= participants.length - 1) {
      setPhase('complete');
    } else {
      setPlayerIdx(prev => prev + 1);
      setRevealedCount(0);
      setPhase('name-announce');
    }
  };

  const handleAddName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    await onUpdateParticipants('add', { name: newName.trim() });
    setNewName('');
  };

  const handleRemove = async (p: any) => {
    await onUpdateParticipants('delete', p);
  };

  // ==================== SETUP PHASE ====================
  if (phase === 'setup') {
    return (
      <div className="space-y-6 max-w-3xl mx-auto">

        {/* Header */}
        <div className="text-center py-6">
          <div className="text-7xl mb-4 select-none">🎰</div>
          <h2 className="text-4xl md:text-5xl font-display font-black text-white tracking-tight leading-none">
            Live Team Draw
          </h2>
          <p className="text-slate-400 mt-3 text-base">
            Add all your players, then hit the button to start the live draw on stream
          </p>
          <p className="text-slate-600 text-sm mt-1">
            16 players · 48 teams · 3 teams each - randomly assigned
          </p>
        </div>

        {/* Locked banner */}
        {drawLocked && (
          <div className="flex items-start gap-3 bg-amber-950/30 border border-amber-700/30 rounded-2xl px-4 py-3 text-sm text-amber-300">
            <span className="text-xl leading-none mt-0.5">🔒</span>
            <div>
              <div className="font-display font-black">Draw is locked</div>
              <div className="text-amber-400/70 text-xs mt-0.5">
                {tournamentActive
                  ? 'The tournament is already underway.'
                  : 'Teams have already been allocated.'}{' '}
                Reset the sweepstake in Admin to start over.
              </div>
            </div>
          </div>
        )}

        {/* Add player form */}
        <form onSubmit={handleAddName} className={`flex gap-2 ${drawLocked ? 'opacity-40 pointer-events-none select-none' : ''}`}>
          <input
            type="text"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder="Enter player name..."
            maxLength={30}
            className="flex-1 bg-[#161b22] border border-white/10 rounded-xl px-4 py-3 text-white font-display font-bold text-lg focus:outline-none focus:border-green-700 placeholder-slate-600"
          />
          <button
            type="submit"
            disabled={!newName.trim() || loading}
            className="bg-green-700 hover:bg-green-600 text-white px-5 py-3 rounded-xl font-display font-black text-lg transition-all cursor-pointer disabled:opacity-40 flex items-center gap-2"
          >
            <UserPlus className="h-5 w-5" />
            Add
          </button>
        </form>

        {/* Player grid with empty slots */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {participants.map((p, i) => (
            <div key={p.id} className="bg-[#161b22] border border-green-900/30 rounded-xl p-3 flex items-center justify-between gap-2 group">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-xs font-mono text-green-500/50 font-bold w-5 shrink-0 text-right">{i + 1}</span>
                <span className="text-sm font-display font-bold text-white truncate">{p.name}</span>
              </div>
              <button
                onClick={() => handleRemove(p)}
                disabled={drawLocked}
                className={`text-slate-700 hover:text-rose-400 transition-colors shrink-0 cursor-pointer opacity-0 group-hover:opacity-100 ${drawLocked ? 'hidden' : ''}`}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          {Array.from({ length: Math.max(0, 16 - participants.length) }).map((_, i) => (
            <div key={`empty-${i}`} className="bg-[#0d1117] border border-dashed border-white/5 rounded-xl p-3 flex items-center gap-2">
              <span className="text-xs font-mono text-slate-700 font-bold w-5 text-right">{participants.length + i + 1}</span>
              <span className="text-sm text-slate-700 font-display italic">Empty</span>
            </div>
          ))}
        </div>

        {/* Player count + start */}
        <div className="text-center space-y-4 pt-2">
          <div className="text-sm text-slate-500">
            <span className={participants.length === 16 ? 'text-green-400 font-bold' : 'text-slate-500'}>
              {participants.length}
            </span>
            <span className="text-slate-600"> / 16 players added</span>
            {participants.length > 0 && participants.length < 16 && (
              <span className="text-slate-600"> - {16 - participants.length} more to go</span>
            )}
            {participants.length === 16 && <span className="text-green-400 font-bold"> - Ready!</span>}
          </div>

          <button
            onClick={handleStartDraw}
            disabled={loading || participants.length === 0 || drawLocked}
            className="bg-gradient-to-r from-green-700 to-emerald-500 hover:from-green-600 hover:to-emerald-400 text-white text-2xl md:text-3xl font-display font-black px-12 py-5 rounded-2xl transition-all shadow-2xl shadow-green-900/40 disabled:opacity-40 cursor-pointer transform hover:scale-105 active:scale-95 disabled:hover:scale-100"
          >
            🎰 START THE DRAW!
          </button>

          {participants.length > 0 && participants.length !== 16 && (
            <p className="text-amber-500/60 text-xs">
              You can start with any number of players - each gets 3 teams
            </p>
          )}
        </div>
      </div>
    );
  }

  // ==================== NAME ANNOUNCE PHASE ====================
  if (phase === 'name-announce') {
    return (
      <div className="min-h-[400px] sm:min-h-[70vh] flex flex-col items-center justify-center text-center space-y-8 select-none">
        <div className="text-slate-500 text-sm font-display font-bold uppercase tracking-widest">
          Player {playerIdx + 1} of {participants.length}
        </div>

        <div className="space-y-2">
          <div className="text-slate-400 text-2xl font-display font-bold animate-pulse">
            Next up...
          </div>
          <div className="text-7xl md:text-9xl font-display font-black text-white animate-bounce leading-none tracking-tight px-4">
            {currentPlayer?.name}
          </div>
        </div>

        <div className="flex gap-4">
          {[0, 1, 2].map(i => (
            <div
              key={i}
              className="w-20 h-24 md:w-28 md:h-36 bg-[#161b22] border-2 border-white/10 rounded-2xl flex items-center justify-center text-4xl text-slate-600 animate-pulse"
              style={{ animationDelay: `${i * 0.15}s` }}
            >
              ?
            </div>
          ))}
        </div>

        <p className="text-slate-700 text-xs tracking-widest uppercase animate-pulse">Drawing teams...</p>
      </div>
    );
  }

  // ==================== REVEAL PHASE ====================
  if (phase === 'reveal') {
    return (
      <div className="min-h-[400px] sm:min-h-[70vh] flex flex-col items-center justify-center text-center space-y-8 select-none">

        {/* Progress */}
        <div className="flex items-center gap-3">
          {participants.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 w-6 rounded-full transition-all ${i < playerIdx ? 'bg-green-600' : i === playerIdx ? 'bg-amber-400' : 'bg-white/10'}`}
            />
          ))}
        </div>

        {/* Player name */}
        <div className="text-5xl md:text-6xl font-display font-black text-white leading-none tracking-tight">
          {currentPlayer?.name}
        </div>

        {/* Team slots */}
        <div className="flex gap-4 md:gap-6">
          {[0, 1, 2].map(slotIdx => {
            const isRevealed = slotIdx < revealedCount;
            const isSpinning = spinningSlot === slotIdx;
            const team = isRevealed ? getTeam(currentPlayer?.assignedTeamIds[slotIdx] || '') : null;

            return (
              <div
                key={slotIdx}
                className={`w-28 h-40 md:w-36 md:h-48 rounded-2xl border-2 flex flex-col items-center justify-center transition-all duration-300 ${
                  isRevealed
                    ? 'bg-gradient-to-b from-[#0f2318] to-[#061410] border-green-600/60 shadow-xl shadow-green-900/30 scale-105'
                    : isSpinning
                    ? 'bg-[#1a1400] border-amber-400/60 shadow-xl shadow-amber-900/30'
                    : 'bg-[#161b22] border-white/8'
                }`}
              >
                {isRevealed && team ? (
                  <div className="space-y-1 px-2 animate-[fadeIn_0.3s_ease-out]">
                    <div className="text-5xl md:text-6xl">{team.flag}</div>
                    <div className="text-xs md:text-sm font-display font-black text-white text-center leading-tight mt-2">
                      {team.name}
                    </div>
                    <div className="text-[10px] text-green-400/70 font-bold uppercase tracking-widest text-center">
                      {team.code}
                    </div>
                  </div>
                ) : isSpinning ? (
                  <div className="text-5xl md:text-6xl animate-pulse">{spinFlag || '⚽'}</div>
                ) : (
                  <div className="text-5xl text-slate-700 font-display font-black">?</div>
                )}

                {/* Slot label */}
                <div className={`absolute bottom-2 text-[9px] uppercase tracking-widest font-bold ${
                  isRevealed ? 'text-green-500/50' : 'text-slate-700'
                }`}>
                  Team {slotIdx + 1}
                </div>
              </div>
            );
          })}
        </div>

        {/* Reveal button / spinning indicator */}
        {spinningSlot !== null ? (
          <div className="text-amber-400 font-display font-black text-2xl animate-pulse flex items-center gap-2">
            <Zap className="h-6 w-6" />
            Drawing...
          </div>
        ) : revealedCount < 3 ? (
          <button
            onClick={handleReveal}
            className="bg-amber-500 hover:bg-amber-400 text-black text-xl md:text-2xl font-display font-black px-10 md:px-14 py-4 md:py-5 rounded-2xl transition-all shadow-2xl shadow-amber-500/30 cursor-pointer transform hover:scale-105 active:scale-95 flex items-center gap-2"
          >
            <Zap className="h-6 w-6" />
            REVEAL TEAM {revealedCount + 1}
          </button>
        ) : null}

        <div className="text-slate-700 text-xs uppercase tracking-widest">
          {revealedCount}/3 revealed · Player {playerIdx + 1}/{participants.length}
        </div>
      </div>
    );
  }

  // ==================== PLAYER DONE PHASE ====================
  if (phase === 'player-done') {
    const assignedTeams = (currentPlayer?.assignedTeamIds || [])
      .map(id => getTeam(id))
      .filter(Boolean) as Team[];

    return (
      <div className="min-h-[400px] sm:min-h-[70vh] flex flex-col items-center justify-center text-center space-y-7 select-none">

        <div className="text-6xl animate-bounce">🎉</div>

        <div>
          <div className="text-slate-400 font-display font-bold text-lg uppercase tracking-widest mb-2">
            {currentPlayer?.name} draws...
          </div>
          <div className="flex gap-4 md:gap-6 justify-center">
            {assignedTeams.map((team, i) => (
              <div
                key={team.id}
                className="w-28 h-40 md:w-36 md:h-48 rounded-2xl border-2 bg-gradient-to-b from-[#0f2318] to-[#061410] border-green-600/60 flex flex-col items-center justify-center shadow-xl shadow-green-900/30"
                style={{ animationDelay: `${i * 0.1}s` }}
              >
                <div className="text-5xl md:text-6xl">{team.flag}</div>
                <div className="text-xs md:text-sm font-display font-black text-white mt-2 px-2 text-center leading-tight">
                  {team.name}
                </div>
                <div className="text-[10px] text-green-400/70 font-bold uppercase tracking-widest mt-1">
                  {team.code}
                </div>
              </div>
            ))}
          </div>
        </div>

        <button
          onClick={handleNextPlayer}
          className="bg-green-700 hover:bg-green-600 text-white text-xl font-display font-black px-10 py-4 rounded-2xl transition-all cursor-pointer transform hover:scale-105 active:scale-95 flex items-center gap-2 shadow-lg"
        >
          {playerIdx >= participants.length - 1 ? (
            <><Trophy className="h-5 w-5" /> See All Results</>
          ) : (
            <>Next Player <ChevronRight className="h-6 w-6" /></>
          )}
        </button>

        <div className="text-slate-600 text-xs uppercase tracking-widest">
          {playerIdx + 1} / {participants.length} players drawn
        </div>
      </div>
    );
  }

  // ==================== COMPLETE PHASE ====================
  if (phase === 'complete') {
    return (
      <div className="space-y-6">
        <div className="text-center py-6">
          <div className="text-6xl mb-3">🏆</div>
          <h2 className="text-4xl font-display font-black text-white tracking-tight">Draw Complete!</h2>
          <p className="text-slate-400 mt-2">All {participants.length} players have been assigned their 3 teams. Good luck everyone!</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {participants.map((p, idx) => {
            const assignedTeams = p.assignedTeamIds.map(id => getTeam(id)).filter(Boolean) as Team[];
            return (
              <div key={p.id} className="bg-[#161b22] border border-green-900/20 rounded-xl p-4">
                <div className="font-display font-black text-white text-sm mb-3 flex items-center gap-2">
                  <span className="text-xs text-green-500/50 font-bold tabular-nums w-5 shrink-0">{idx + 1}</span>
                  <span className="truncate">{p.name}</span>
                </div>
                <div className="flex gap-1.5">
                  {assignedTeams.map(team => (
                    <div key={team.id} className="flex-1 bg-[#0d1117] border border-white/5 rounded-lg p-2 text-center">
                      <div className="text-2xl">{team.flag}</div>
                      <div className="text-[9px] font-display font-bold text-slate-500 mt-1 leading-tight">{team.code}</div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <div className="text-center pt-2">
          <button
            onClick={() => { setPhase('setup'); setDrawnState(null); setPlayerIdx(0); setRevealedCount(0); }}
            className="bg-white/5 hover:bg-white/10 border border-white/8 text-slate-300 text-sm font-display font-bold px-6 py-3 rounded-xl transition-all cursor-pointer inline-flex items-center gap-2"
          >
            <Shuffle className="h-4 w-4" />
            Redo the Draw
          </button>
        </div>
      </div>
    );
  }

  return null;
};
