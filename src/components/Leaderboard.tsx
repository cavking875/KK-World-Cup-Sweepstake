import React from 'react';
import { SweepstakeState, Participant, Team, TeamStats, LeaderboardRow, Match } from '../types';
import { Medal, Shield, Crown, TrendingUp, Info } from 'lucide-react';

interface LeaderboardProps {
  state: SweepstakeState;
}

// Helper to evaluate a team's sweepstake progression stats
export function getTeamSweepstakeStats(
  teamId: string, 
  stats: Record<string, TeamStats>, 
  matches: Match[], 
  winnerTeamId?: string, 
  runnerUpTeamId?: string
) {
  const tStats = stats[teamId];
  if (!tStats) return { points: 0, bonus: 0, total: 0, stage: 'groups' };

  let stage = tStats.stage;
  let bonus = 0;

  // Check if champion or runner up
  if (winnerTeamId === teamId) {
    bonus = 45;
    stage = 'completed';
  } else if (runnerUpTeamId === teamId) {
    bonus = 30;
    stage = 'final';
  } else {
    // Check match history for knockouts
    const finalMatch = matches.find(m => m.stage === 'final' && (m.homeTeamId === teamId || m.awayTeamId === teamId));
    const sfMatch = matches.find(m => m.stage === 'sf' && (m.homeTeamId === teamId || m.awayTeamId === teamId));
    const qfMatch = matches.find(m => m.stage === 'qf' && (m.homeTeamId === teamId || m.awayTeamId === teamId));
    const r16Match = matches.find(m => m.stage === 'r16' && (m.homeTeamId === teamId || m.awayTeamId === teamId));
    const r32Match = matches.find(m => m.stage === 'r32' && (m.homeTeamId === teamId || m.awayTeamId === teamId));

    if (finalMatch) {
      bonus = 30;
      stage = 'final';
    } else if (sfMatch) {
      bonus = 20;
      stage = 'sf';
    } else if (qfMatch) {
      bonus = 12;
      stage = 'qf';
    } else if (r16Match) {
      bonus = 5;
      stage = 'r16';
    } else if (r32Match) {
      bonus = 2;
      stage = 'r32';
    }
  }

  return {
    points: tStats.points,
    bonus,
    total: tStats.points + bonus,
    stage
  };
}

export const Leaderboard: React.FC<LeaderboardProps> = ({ state }) => {
  const { participants, stats, teams, collectiv, winnerTeamId, runnerUpTeamId, worstTeamId } = state;
  const tournamentStarted = state.matches.some(m => m.isPlayed);

  // Let's build rows based on each participant's best-scoring team progress
  const rows: LeaderboardRow[] = participants.map((p) => {
    const teamStatsList = p.assignedTeamIds.map((tid) => {
      const team = teams.find(t => t.id === tid);
      const contribution = getTeamSweepstakeStats(tid, stats, state.matches, winnerTeamId, runnerUpTeamId);
      const tStats = stats[tid];

      return {
        teamId: tid,
        teamName: team?.name || 'Unknown',
        teamCode: team?.code || 'UNK',
        flag: team?.flag || '🏳️',
        points: contribution.total, // Individual Sweepstake score for this team (raw group pts + stage progression bonus)
        groupPoints: contribution.points, // Raw group points
        goalDifference: tStats?.goalDifference || 0,
        stage: contribution.stage,
        isEliminated: tStats?.stage === 'eliminated'
      };
    });

    // Determine the participant's leading (best) team
    // If they have no teams assigned (should not happen after draft), fallback gracefully
    const bestTeam = teamStatsList.reduce((best, curr) => {
      if (!best) return curr;
      // Primary: compare overall sweepstake score (pts + stage bonus)
      if (curr.points !== best.points) {
        return curr.points > best.points ? curr : best;
      }
      // Since "Only worst team will be judged on goal difference",
      // we break ties for top/middle teams using raw group points, but NOT goal difference!
      if (curr.groupPoints !== best.groupPoints) {
        return curr.groupPoints > best.groupPoints ? curr : best;
      }
      return curr;
    }, teamStatsList[0] || null);

    return {
      participantId: p.id,
      participantName: p.name,
      hasPaid: p.hasPaid,
      teamsCount: p.assignedTeamIds.length,
      teamStatsList,
      // Store best team metrics in the row properties
      totalPoints: bestTeam ? bestTeam.points : 0,
      totalGoalDifference: bestTeam ? bestTeam.goalDifference : 0,
      bestTeamId: bestTeam ? (bestTeam as any).teamId : '',
      status: 'normal'
    };
  });

  // Sort rows: Best Team Points DESC, then Best Team Raw Group Points DESC, then Alphabetical.
  // Goal Difference is NOT used here because only the worst team is judged on goal difference!
  const sortedRows = [...rows].sort((r1, r2) => {
    if (r1.totalPoints !== r2.totalPoints) {
      return r2.totalPoints - r1.totalPoints;
    }
    
    // Fallback: compare raw points of best team
    const r1BestId = (r1 as any).bestTeamId;
    const r2BestId = (r2 as any).bestTeamId;
    const r1Raw = r1BestId ? (stats[r1BestId]?.points || 0) : 0;
    const r2Raw = r2BestId ? (stats[r2BestId]?.points || 0) : 0;
    if (r2Raw !== r1Raw) {
      return r2Raw - r1Raw;
    }

    // Alphabetical fallback
    return r1.participantName.localeCompare(r2.participantName);
  });

  // Assign sweepstake prizes (Winner, Runner-up, Worst team) dynamically based on the active state
  sortedRows.forEach(r => r.status = 'normal');

  if (sortedRows.length > 0) {
    if (winnerTeamId) {
      // Find the participant who owns winnerTeamId
      const winnerRow = sortedRows.find(r => r.teamStatsList.some(t => (t as any).teamId === winnerTeamId));
      if (winnerRow) winnerRow.status = 'top';
    } else {
      // Fallback: whoever is currently in first place is leading candidate
      sortedRows[0].status = 'top';
    }

    if (runnerUpTeamId) {
      // Find the participant who owns runnerUpTeamId
      const runnerRow = sortedRows.find(r => r.teamStatsList.some(t => (t as any).teamId === runnerUpTeamId));
      if (runnerRow) runnerRow.status = 'runnerup';
    } else if (sortedRows.length > 1) {
      // Fallback: whoever is currently in second place is runner up candidate
      sortedRows[1].status = 'runnerup';
    }

    if (worstTeamId) {
      // Find the participant who owns the worst team
      const worstRow = sortedRows.find(r => r.teamStatsList.some(t => (t as any).teamId === worstTeamId));
      // Even if they won the tournament with another team, we mark them with worst status for design, 
      // but in the UI we will show both awards clearly!
      if (worstRow && worstRow.status === 'normal') {
        worstRow.status = 'worst';
      }
    }
  }

  // Value formatting
  const formatMoney = (val: number) => {
    const symbolMap: Record<string, string> = { USD: '$', GBP: '£', EUR: '€', CAD: 'CA$', AUD: 'AU$' };
    const sym = symbolMap[collectiv.currency] || '£';
    return `${sym}${val.toFixed(2)}`;
  };

  const prizePool = state.participants.length * collectiv.entryFee;
  const firstPrize = prizePool * 0.60;
  const secondPrize = prizePool * 0.25;
  const lastPrize = prizePool * 0.15;

  return (
    <div className="space-y-5">
      {/* Header row */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-display font-black text-white flex items-center gap-2 tracking-tight">
            <Medal className="h-6 w-6 text-amber-400" />
            Leaderboard
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Ranked by your best single team's progress through the World Cup
          </p>
        </div>
        {prizePool > 0 && (
          <div className="bg-[#161b22] border border-amber-900/30 rounded-xl px-5 py-3 text-right">
            <div className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold">Total Pot</div>
            <div className="text-2xl font-display font-black text-amber-400">{formatMoney(prizePool)}</div>
          </div>
        )}
      </div>

      {/* Leaderboard table */}
      <div className="bg-[#161b22] border border-white/5 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/5 text-slate-500 text-xs uppercase tracking-wider font-semibold">
                <th className="py-3 px-3 text-center w-12">#</th>
                <th className="py-3 px-4">Player</th>
                <th className="py-3 px-4 hidden sm:table-cell">Teams</th>
                <th className="py-3 px-3 text-center w-16 hidden sm:table-cell">GD</th>
                <th className="py-3 px-3 text-center w-20 border-l border-white/5">Score</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {sortedRows.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-12 text-center text-slate-500 text-sm">
                    No participants yet - head to the Admin tab to get started
                  </td>
                </tr>
              ) : (
                sortedRows.map((row, index) => {
                  const isWinnerPrize = row.status === 'top';
                  const isWorstPrize = row.status === 'worst';
                  const holdsWorstTeam = tournamentStarted && worstTeamId && row.teamStatsList.some(t => (t as any).teamId === worstTeamId);

                  return (
                    <tr
                      key={row.participantId}
                      className={`transition-colors hover:bg-white/3 ${
                        isWinnerPrize ? 'bg-amber-500/5' : isWorstPrize ? 'bg-rose-500/5' : ''
                      }`}
                    >
                      {/* Position badge */}
                      <td className="py-4 px-3 text-center">
                        {index === 0 ? (
                          <span className="inline-flex items-center justify-center h-7 w-7 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/40 text-sm font-display font-bold">1</span>
                        ) : index === 1 ? (
                          <span className="inline-flex items-center justify-center h-7 w-7 rounded-lg bg-sky-500/20 text-sky-300 border border-sky-500/40 text-sm font-display font-bold">2</span>
                        ) : holdsWorstTeam ? (
                          <span className="text-lg leading-none">🥄</span>
                        ) : (
                          <span className="text-slate-500 text-sm font-semibold">{index + 1}</span>
                        )}
                      </td>

                      {/* Player name + teams on mobile */}
                      <td className="py-3 px-4">
                        <div className="flex flex-col gap-1">
                          <span className="font-display font-bold text-white text-base flex items-center gap-1.5">
                            {row.participantName}
                            {isWinnerPrize && <Crown className="h-3.5 w-3.5 text-amber-400 fill-amber-400/30" />}
                          </span>
                          {holdsWorstTeam && (
                            <span className="text-[10px] text-rose-400 font-semibold">🥄 Wooden Spoon</span>
                          )}
                          {/* Teams shown inline on mobile */}
                          {row.teamStatsList.length > 0 && (
                            <div className="flex flex-wrap gap-1 sm:hidden">
                              {row.teamStatsList.map((t, tid) => {
                                const isChampTeam = t.stage === 'completed';
                                const isSpecificWorst = worstTeamId && (t as any).teamId === worstTeamId;
                                const isBestTeam = tournamentStarted && (row as any).bestTeamId === (t as any).teamId;
                                return (
                                  <span key={tid} className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold border ${`
                                    isChampTeam ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                                    : isSpecificWorst ? 'bg-rose-950/50 border-rose-900/50 text-rose-400'
                                    : t.isEliminated ? 'bg-transparent border-white/5 text-slate-600'
                                    : isBestTeam ? 'bg-green-900/40 border-green-700/40 text-green-300'
                                    : 'bg-white/5 border-white/8 text-slate-300'
                                  }`}>
                                    <span>{(t as any).flag}</span>
                                    <span className={t.isEliminated ? 'line-through opacity-50' : ''}>{t.teamCode}</span>
                                  </span>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Teams - hidden on mobile */}
                      <td className="py-4 px-4 hidden sm:table-cell">
                        <div className="flex flex-wrap gap-1.5">
                          {row.teamStatsList.length === 0 ? (
                            <span className="text-xs text-slate-500 italic">No teams drawn yet</span>
                          ) : (
                            row.teamStatsList.map((t, tid) => {
                              const isChampTeam = t.stage === 'completed';
                              const isSpecificWorst = worstTeamId && (t as any).teamId === worstTeamId;
                              const isBestTeam = tournamentStarted && (row as any).bestTeamId === (t as any).teamId;
                              return (
                                <span
                                  key={tid}
                                  className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold border ${
                                    isChampTeam
                                      ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                                      : isSpecificWorst
                                      ? 'bg-rose-950/50 border-rose-900/50 text-rose-400'
                                      : t.isEliminated
                                      ? 'bg-transparent border-white/5 text-slate-600'
                                      : isBestTeam
                                      ? 'bg-green-900/40 border-green-700/40 text-green-300'
                                      : 'bg-white/5 border-white/8 text-slate-300'
                                  }`}
                                >
                                  <span>{(t as any).flag}</span>
                                  <span className={t.isEliminated ? 'line-through opacity-50' : ''}>{t.teamCode}</span>
                                  {!t.isEliminated && t.stage !== 'groups' && (
                                    <span className="text-[9px] uppercase bg-white/10 px-1 rounded font-bold">
                                      {t.stage === 'completed' ? 'WC' : t.stage}
                                    </span>
                                  )}
                                </span>
                              );
                            })
                          )}
                        </div>
                      </td>

                      {/* Score */}
                      <td className="py-4 px-3 text-center font-mono text-sm font-bold hidden sm:table-cell">
                        <span className={row.totalGoalDifference > 0 ? 'text-green-400' : row.totalGoalDifference < 0 ? 'text-rose-400' : 'text-slate-500'}>
                          {row.totalGoalDifference > 0 ? `+${row.totalGoalDifference}` : row.totalGoalDifference}
                        </span>
                      </td>

                      {/* Score */}
                      <td className="py-4 px-3 text-center border-l border-white/5">
                        <span className={`text-xl font-display font-black ${isWinnerPrize ? 'text-amber-300' : 'text-white'}`}>
                          {row.totalPoints}
                        </span>
                        <div className="text-[10px] text-slate-600 font-semibold uppercase tracking-wide">pts</div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Rules section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">

        {/* Scoring rules */}
        <div className="bg-[#161b22] border border-white/5 rounded-xl p-4 flex gap-3 text-xs">
          <Info className="h-4 w-4 text-green-600 shrink-0 mt-0.5" />
          <div className="space-y-2">
            <p className="font-display font-bold text-slate-300">How your score is calculated</p>
            <p className="text-slate-500">Your leaderboard rank is based on your <span className="text-white font-semibold">single best team's</span> progress through the tournament. Score = group stage points + knockout bonus.</p>
            <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1 font-mono text-[10px] text-slate-500">
              <span>R32: <b className="text-slate-300">+2</b></span>
              <span>R16: <b className="text-slate-300">+5</b></span>
              <span>QF: <b className="text-slate-300">+12</b></span>
              <span>SF: <b className="text-slate-300">+20</b></span>
              <span>Runner-up: <b className="text-slate-300">+30</b></span>
              <span>Champion: <b className="text-amber-400">+45</b></span>
            </div>
            <p className="text-slate-500 pt-1">
              <span className="text-white font-semibold">1st prize (60%)</span> goes to whoever owns the World Cup winning team.{' '}
              <span className="text-slate-300 font-semibold">Runner-up prize (25%)</span> goes to whoever owns the losing finalist.
            </p>
            <div className="bg-green-950/40 border border-green-900/30 rounded-lg px-3 py-2 mt-1 space-y-1">
              <p className="text-green-400 font-semibold font-display">Why the winner always finishes 1st</p>
              <p className="text-slate-500">The Champion bonus (+45) is designed so that even a winner with 0 group points scores 45 total - which beats the absolute maximum any runner-up can ever score (9 group pts + 30 = 39). The prizes are mathematically guaranteed to go to the right person - no luck of the draw on the day.</p>
            </div>
          </div>
        </div>

        {/* Wooden spoon rules */}
        <div className="bg-[#161b22] border border-rose-900/20 rounded-xl p-4 flex gap-3 text-xs">
          <span className="text-lg shrink-0 leading-none mt-0.5">🥄</span>
          <div className="space-y-2">
            <p className="font-display font-bold text-slate-300">How the Wooden Spoon works</p>
            <p className="text-slate-500">
              The spoon goes to whoever owns the <span className="text-rose-400 font-semibold">worst-performing team</span> that only played in the group stage - teams that reach the Round of 32 or beyond are automatically disqualified from the spoon.
            </p>
            <p className="text-slate-500 pt-1 font-semibold text-slate-400">Tiebreaker order:</p>
            <ol className="text-slate-500 space-y-0.5 list-decimal list-inside">
              <li>Fewest group stage points</li>
              <li>Worst goal difference</li>
              <li>Fewest goals scored</li>
              <li>Lowest FIFA team rating</li>
            </ol>
            <p className="text-slate-600 pt-1 italic">The spoon updates live as group games are played - watch the race to the bottom!</p>
          </div>
        </div>

      </div>

      {/* Prize breakdown */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="relative overflow-hidden rounded-2xl border border-amber-500/30 p-5"
          style={{ background: 'linear-gradient(135deg, #2d1a00 0%, #1a1100 100%)' }}>
          <div className="absolute top-0 right-0 text-6xl opacity-10 leading-none select-none">🥇</div>
          <div className="relative">
            <div className="text-3xl mb-2">🥇</div>
            <div className="text-xs text-amber-400/70 uppercase tracking-widest font-semibold mb-0.5">Winner - 60%</div>
            <div className="text-2xl font-display font-black text-amber-300">{formatMoney(firstPrize)}</div>
            <div className="text-xs text-slate-500 mt-1">Team that wins the World Cup final</div>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-2xl border border-slate-600/30 p-5 bg-[#161b22]">
          <div className="absolute top-0 right-0 text-6xl opacity-10 leading-none select-none">🥈</div>
          <div className="relative">
            <div className="text-3xl mb-2">🥈</div>
            <div className="text-xs text-slate-400 uppercase tracking-widest font-semibold mb-0.5">Runner-Up - 25%</div>
            <div className="text-2xl font-display font-black text-slate-200">{formatMoney(secondPrize)}</div>
            <div className="text-xs text-slate-500 mt-1">Team that loses the World Cup final</div>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-2xl border border-rose-900/40 p-5"
          style={{ background: 'linear-gradient(135deg, #1a0808 0%, #0d0606 100%)' }}>
          <div className="absolute top-0 right-0 text-6xl opacity-10 leading-none select-none">🥄</div>
          <div className="relative">
            <div className="text-3xl mb-2">🥄</div>
            <div className="text-xs text-rose-400/70 uppercase tracking-widest font-semibold mb-0.5">Wooden Spoon - 15%</div>
            <div className="text-2xl font-display font-black text-rose-400">{formatMoney(lastPrize)}</div>
            <div className="text-xs text-slate-500 mt-1">Worst team by points and goal difference</div>
          </div>
        </div>
      </div>
    </div>
  );
};
