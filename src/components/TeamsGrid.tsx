import React, { useState } from 'react';
import { SweepstakeState, Team, TeamStats } from '../types';
import { LayoutGrid } from 'lucide-react';

interface TeamsGridProps {
  state: SweepstakeState;
}

export const TeamsGrid: React.FC<TeamsGridProps> = ({ state }) => {
  const { teams, stats, participants, worstTeamId, winnerTeamId, runnerUpTeamId, matches } = state;
  const tournamentStarted = matches.some(m => m.isPlayed);
  const [view, setView] = useState<'groups' | 'players'>('groups');

  const groups = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];

  // Find team owner helper
  const getOwnerName = (teamId: string): string => {
    const owner = participants.find(p => p.assignedTeamIds.includes(teamId));
    return owner ? owner.name : 'Unassigned';
  };

  // Safe fetch stats
  const getTeamStats = (teamId: string): TeamStats => {
    return stats[teamId] || {
      teamId, played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, goalDifference: 0, points: 0, stage: 'groups'
    };
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-display font-black text-white flex items-center gap-2 tracking-tight">
            <LayoutGrid className="h-6 w-6 text-green-400" />
            Teams
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            {view === 'groups' ? 'All 12 groups - track standings and see who owns each nation' : 'Each player and their assigned teams'}
          </p>
        </div>
        <div className="flex gap-1 p-1 bg-[#161b22] rounded-xl border border-white/5 self-start">
          <button
            onClick={() => setView('groups')}
            className={`px-4 py-1.5 rounded-lg text-sm font-display font-semibold transition-all cursor-pointer ${
              view === 'groups' ? 'bg-green-800/60 text-green-300 border border-green-700/40' : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            🌍 Groups
          </button>
          <button
            onClick={() => setView('players')}
            className={`px-4 py-1.5 rounded-lg text-sm font-display font-semibold transition-all cursor-pointer ${
              view === 'players' ? 'bg-green-800/60 text-green-300 border border-green-700/40' : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            👤 Players
          </button>
        </div>
      </div>

      {view === 'players' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {participants.length === 0 ? (
            <div className="col-span-3 text-center text-slate-500 text-sm py-12">No players added yet</div>
          ) : (
            participants.map(p => {
              const assignedTeams = teams.filter(t => p.assignedTeamIds.includes(t.id));
              return (
                <div key={p.id} className="bg-[#161b22] border border-white/5 rounded-2xl p-4">
                  <div className="font-display font-black text-white text-base mb-3 pb-2 border-b border-white/5">
                    {p.name}
                    <span className="ml-2 text-xs text-slate-500 font-semibold">{assignedTeams.length} teams</span>
                  </div>
                  {assignedTeams.length === 0 ? (
                    <p className="text-xs text-slate-600 italic">No teams assigned yet</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {assignedTeams.map(t => {
                        const s = getTeamStats(t.id);
                        const isChamp = winnerTeamId === t.id;
                        const isRunnerUp = runnerUpTeamId === t.id;
                        const isWorst = tournamentStarted && worstTeamId === t.id;
                        const isEliminated = s.stage === 'eliminated';
                        return (
                          <div key={t.id} className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs ${
                            isChamp ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                            : isRunnerUp ? 'bg-sky-500/10 border-sky-500/30 text-sky-300'
                            : isWorst ? 'bg-rose-950/40 border-rose-900/40 text-rose-400'
                            : isEliminated ? 'bg-transparent border-white/5 text-slate-600'
                            : 'bg-white/5 border-white/8 text-slate-300'
                          }`}>
                            <span className="text-base">{t.flag}</span>
                            <div>
                              <div className={`font-display font-bold ${isEliminated ? 'line-through opacity-50' : ''}`}>{t.name}</div>
                              <div className="text-[10px] opacity-60">Grp {t.group} · {s.points}pts</div>
                            </div>
                            {isChamp && <span className="text-[10px] ml-1">🏆</span>}
                            {isWorst && <span className="text-[10px] ml-1">🥄</span>}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {view === 'groups' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {groups.map((g) => {
          const gTeams = teams.filter(t => t.group === g);
          // Sort teams inside group table based on current points -> GD -> GF -> rating
          const sortedGTeams = [...gTeams].sort((t1, t2) => {
            const s1 = getTeamStats(t1.id);
            const s2 = getTeamStats(t2.id);
            if (s1.points !== s2.points) return s2.points - s1.points;
            if (s1.goalDifference !== s2.goalDifference) return s2.goalDifference - s1.goalDifference;
            if (s1.goalsFor !== s2.goalsFor) return s2.goalsFor - s1.goalsFor;
            return t2.rating - t1.rating;
          });

          return (
            <div 
              key={g} 
              className="bg-[#161b22] border border-white/5 rounded-2xl p-5"
            >
              <div className="flex justify-between items-center mb-4 pb-2 border-b border-white/5">
                <span className="font-display font-black text-lg text-white tracking-tight">Group {g}</span>
                <span className="text-xs text-green-400 font-display font-bold bg-green-900/20 border border-green-900/30 px-2 py-0.5 rounded-full">
                  {sortedGTeams.filter(t => getTeamStats(t.id).stage !== 'eliminated').length} / 4 active
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left font-sans text-xs">
                  <thead>
                    <tr className="text-slate-600 font-display font-semibold text-[10px] uppercase tracking-widest border-b border-white/5">
                      <th className="py-2 pr-2">Team</th>
                      <th className="py-2 text-center w-8">P</th>
                      <th className="py-2 text-center w-8 hidden sm:table-cell">W</th>
                      <th className="py-2 text-center w-8 hidden sm:table-cell">D</th>
                      <th className="py-2 text-center w-8 hidden sm:table-cell">L</th>
                      <th className="py-2 text-center w-10">GD</th>
                      <th className="py-2 text-center w-10">Pts</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/20">
                    {sortedGTeams.map((team, idx) => {
                      const tStats = getTeamStats(team.id);
                      const ownerName = getOwnerName(team.id);
                      const isEliminated = tStats.stage === 'eliminated';
                      const isSpecificWorst = tournamentStarted && worstTeamId === team.id;
                      const isWinner = winnerTeamId === team.id;
                      const isRunnerUp = runnerUpTeamId === team.id;

                      return (
                        <tr 
                          key={team.id} 
                          className={`hover:bg-slate-700/10 transition-colors ${
                            isEliminated ? 'opacity-55' : ''
                          }`}
                        >
                          {/* Name + Owner */}
                          <td className="py-2.5 pr-2">
                            <div className="flex items-center gap-2">
                              {/* Position counter */}
                              <span className="font-mono font-medium text-[10px] text-slate-500 w-3 text-center">{idx + 1}</span>
                              <span className="text-xl" title={team.name}>{team.flag}</span>
                              <div className="flex flex-col truncate max-w-[90px] sm:max-w-[140px]">
                                <span className={`font-display font-bold text-sm ${isWinner ? 'text-amber-300' : isRunnerUp ? 'text-slate-300' : 'text-slate-200'}`}>
                                  {team.name}
                                </span>
                                <span className="text-[10px] text-green-500/70 font-semibold">
                                  {ownerName}
                                </span>
                              </div>

                              {/* Small status pills */}
                              {isWinner && (
                                <span className="text-[7.5px] uppercase bg-amber-500/20 text-amber-300 px-1 rounded font-bold animate-pulse">CAMP</span>
                              )}
                              {isSpecificWorst && (
                                <span className="text-[7.5px] uppercase bg-rose-500/20 text-rose-300 px-1 rounded font-medium">🥄</span>
                              )}
                              {!isEliminated && tStats.stage !== 'groups' && tStats.stage !== 'completed' && (
                                <span className="text-[7.5px] uppercase bg-green-900/30 text-green-400 px-1 rounded font-semibold">
                                  {tStats.stage}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Stats parameters */}
                          <td className="py-2.5 text-center font-mono font-medium text-slate-300">
                            {tStats.played}
                          </td>
                          <td className="py-2.5 text-center font-mono text-slate-400 hidden sm:table-cell">
                            {tStats.won}
                          </td>
                          <td className="py-2.5 text-center font-mono text-slate-450 text-slate-500 hidden sm:table-cell">
                            {tStats.drawn}
                          </td>
                          <td className="py-2.5 text-center font-mono text-slate-400 hidden sm:table-cell">
                            {tStats.lost}
                          </td>
                          <td className="py-2.5 text-center font-mono">
                            <span className={tStats.goalDifference > 0 ? 'text-emerald-400' : tStats.goalDifference < 0 ? 'text-rose-400' : 'text-slate-500'}>
                              {tStats.goalDifference > 0 ? `+${tStats.goalDifference}` : tStats.goalDifference}
                            </span>
                          </td>
                          <td className="py-2.5 text-center font-display font-black text-white text-sm">
                            {tStats.points}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
        </div>
      )}
    </div>
  );
};
