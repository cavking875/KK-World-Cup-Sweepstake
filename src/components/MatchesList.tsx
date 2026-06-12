import React, { useState } from 'react';
import { SweepstakeState, Match, Team } from '../types';
import { Radio, Search, Zap } from 'lucide-react';

interface MatchesListProps {
  state: SweepstakeState;
}

// Dates are stored as BST (UTC+1) strings, e.g. 'Thu 11 Jun, 20:00'
// This converts them to the user's local timezone automatically
const MONTH_MAP: Record<string, number> = {
  Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
  Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
};

function formatDateToLocal(dateStr: string): string {
  const match = dateStr.match(/^(\w{3}) (\d{1,2}) (\w{3}), (\d{2}):(\d{2})$/);
  if (!match) return dateStr;

  const [, , dayStr, monthStr, hourStr, minStr] = match;
  const monthIndex = MONTH_MAP[monthStr];
  if (monthIndex === undefined) return dateStr;

  const day = parseInt(dayStr, 10);
  const hour = parseInt(hourStr, 10);
  const min = parseInt(minStr, 10);

  // BST = UTC+1, subtract 1 hour to get UTC
  const utcDate = new Date(Date.UTC(2026, monthIndex, day, hour - 1, min));

  return utcDate.toLocaleString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  });
}

function getMatchTimestamp(dateStr: string): number {
  const match = dateStr.match(/^(\w{3}) (\d{1,2}) (\w{3}), (\d{2}):(\d{2})$/);
  if (!match) return Infinity;
  const [, , dayStr, monthStr, hourStr, minStr] = match;
  const monthIndex = MONTH_MAP[monthStr];
  if (monthIndex === undefined) return Infinity;
  const utcDate = new Date(Date.UTC(2026, monthIndex, parseInt(dayStr, 10), parseInt(hourStr, 10) - 1, parseInt(minStr, 10)));
  return utcDate.getTime();
}

function isMatchDatePast(dateStr: string): boolean {
  const match = dateStr.match(/^(\w{3}) (\d{1,2}) (\w{3}), (\d{2}):(\d{2})$/);
  if (!match) return false;

  const [, , dayStr, monthStr, hourStr, minStr] = match;
  const monthIndex = MONTH_MAP[monthStr];
  if (monthIndex === undefined) return false;

  const day = parseInt(dayStr, 10);
  const hour = parseInt(hourStr, 10);
  const min = parseInt(minStr, 10);

  // BST = UTC+1, subtract 1 hour to get UTC
  const utcDate = new Date(Date.UTC(2026, monthIndex, day, hour - 1, min));
  return utcDate < new Date();
}

export const MatchesList: React.FC<MatchesListProps> = ({ state }) => {
  const { matches, teams, participants } = state;
  const [selectedStage, setSelectedStage] = useState<'all' | 'groups' | 'knockout' | 'final'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Find team helper
  const getTeamObj = (id: string): Team | undefined => teams.find(t => t.id === id);

  // Find team owner helper
  const getOwnerName = (teamId: string): string => {
    const owner = participants.find(p => p.assignedTeamIds.includes(teamId));
    return owner ? owner.name : 'Unassigned';
  };

  // Filtration logic (applied to chronologically sorted matches)
  const filteredMatches = sortedMatches.filter((m) => {
    // Stage toggle
    if (selectedStage === 'groups' && m.stage !== 'groups') return false;
    if (selectedStage === 'knockout' && m.stage === 'groups') return false;
    if (selectedStage === 'final' && m.stage !== 'final') return false;

    // Search query
    if (searchQuery) {
      const hTeam = getTeamObj(m.homeTeamId);
      const aTeam = getTeamObj(m.awayTeamId);
      const q = searchQuery.toLowerCase();
      const matchText = `${hTeam?.name} ${hTeam?.code} ${aTeam?.name} ${aTeam?.code} ${m.stage} ${m.group || ''}`.toLowerCase();
      return matchText.includes(q);
    }

    return true;
  });

  // Sort all matches chronologically
  const sortedMatches = [...matches].sort((a, b) => {
    const ta = a.date ? getMatchTimestamp(a.date) : Infinity;
    const tb = b.date ? getMatchTimestamp(b.date) : Infinity;
    return ta - tb;
  });

  const unplayedMatches = matches.filter(m => !m.isPlayed);
  const playedMatches = matches.filter(m => m.isPlayed);

  // Focus match for the top panel - first unplayed in chronological order
  const currentLiveMatch = sortedMatches.find(m => !m.isPlayed) || sortedMatches[sortedMatches.length - 1];

  const getStageLabel = (stage: string, group?: string) => {
    if (stage === 'groups') return `Group Stage - Group ${group}`;
    if (stage === 'r32') return 'Round of 32';
    if (stage === 'r16') return 'Round of 16';
    if (stage === 'qf') return 'Quarter-Finals';
    if (stage === 'sf') return 'Semi-Finals';
    if (stage === 'final') return 'World Cup Final 🏆';
    return stage;
  };

  return (
    <div className="space-y-5">

      {/* Broadcast control panel */}
      <div className="relative overflow-hidden rounded-2xl border border-green-900/30 p-6"
        style={{ background: 'linear-gradient(135deg, #0f2318 0%, #061410 100%)' }}>
        <div className="absolute inset-0 opacity-10"
          style={{ backgroundImage: 'radial-gradient(circle at 80% 50%, #22c55e 0%, transparent 60%)' }} />
        <div className="relative flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-3">
            <span className="flex h-4 w-4 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 bg-green-400" />
              <span className="relative inline-flex rounded-full h-4 w-4 bg-green-500" />
            </span>
            <div>
              <h2 className="text-xl font-display font-black text-white flex items-center gap-2">
                <Radio className="h-5 w-5 text-green-400" />
                Match Centre
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {unplayedMatches.length} matches remaining
              </p>
            </div>
          </div>
        </div>

        {/* Current match spotlight */}
        {currentLiveMatch && (
            <div className="mt-6 bg-black/30 border border-white/8 rounded-xl p-4">
            <div className="text-center text-[10px] font-display font-bold text-green-400 uppercase tracking-widest mb-1">
              {currentLiveMatch.isPlayed ? 'Last Played' : currentLiveMatch.date && isMatchDatePast(currentLiveMatch.date) ? 'Awaiting Result' : 'Up Next'} - {getStageLabel(currentLiveMatch.stage, currentLiveMatch.group)}
            </div>
            {currentLiveMatch.date && (
              <div className="text-center text-[11px] text-slate-500 font-semibold mb-3">
                {formatDateToLocal(currentLiveMatch.date)}
              </div>
            )}

            <div className="flex items-center justify-center gap-3">
              {/* Home team */}
              <div className="text-right flex-1 min-w-0">
                <div className="text-3xl mb-1">{getTeamObj(currentLiveMatch.homeTeamId)?.flag}</div>
                <div className="font-display font-black text-sm text-white truncate">{getTeamObj(currentLiveMatch.homeTeamId)?.name}</div>
                <div className="text-xs text-slate-500 mt-0.5 truncate">{getOwnerName(currentLiveMatch.homeTeamId)}</div>
              </div>

              {/* Score box */}
              <div className="flex flex-col items-center shrink-0">
                <div className="bg-[#161b22] border border-white/10 rounded-xl px-4 py-2 min-w-[80px] text-center">
                  <span className="font-display font-black text-xl tracking-widest text-white">
                    {currentLiveMatch.isPlayed
                      ? `${currentLiveMatch.homeScore} - ${currentLiveMatch.awayScore}`
                      : 'VS'}
                  </span>
                </div>
                {currentLiveMatch.isPlayed && currentLiveMatch.penaltyWinnerId && (
                  <span className="text-[10px] text-amber-400 font-semibold mt-1 uppercase">
                    {getTeamObj(currentLiveMatch.penaltyWinnerId)?.code} wins on pens
                  </span>
                )}
              </div>

              {/* Away team */}
              <div className="text-left flex-1 min-w-0">
                <div className="text-3xl mb-1">{getTeamObj(currentLiveMatch.awayTeamId)?.flag}</div>
                <div className="font-display font-black text-sm text-white truncate">{getTeamObj(currentLiveMatch.awayTeamId)?.name}</div>
                <div className="text-xs text-slate-500 mt-0.5 truncate">{getOwnerName(currentLiveMatch.awayTeamId)}</div>
              </div>
            </div>

            {currentLiveMatch.isPlayed && currentLiveMatch.commentary && (
              <div className="mt-5 border-t border-white/5 pt-4">
                <div className="flex items-center gap-1.5 text-[10px] text-green-400/80 font-display font-bold uppercase tracking-widest mb-2">
                  <Zap className="h-3 w-3" />
                  Match Commentary
                </div>
                <p className="text-sm text-slate-300 italic leading-relaxed">"{currentLiveMatch.commentary}"</p>
              </div>
            )}

            {!currentLiveMatch.isPlayed && (
              <p className="text-center text-xs text-slate-500 mt-4 italic">Scores update automatically as matches are played</p>
            )}
          </div>
        )}
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-[#161b22] border border-white/5 rounded-xl p-4 text-center">
          <div className="text-2xl font-display font-black text-white">{playedMatches.length}</div>
          <div className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold mt-0.5">Played</div>
        </div>
        <div className="bg-[#161b22] border border-white/5 rounded-xl p-4 text-center">
          <div className="text-2xl font-display font-black text-amber-400">{unplayedMatches.length}</div>
          <div className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold mt-0.5">Remaining</div>
        </div>
        <div className="bg-[#161b22] border border-white/5 rounded-xl p-4 text-center">
          <div className="text-2xl font-display font-black text-green-400">{matches.length}</div>
          <div className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold mt-0.5">Total</div>
        </div>
      </div>

      {/* Filters and search */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-3">
        <div className="flex flex-wrap gap-1 p-1 bg-[#161b22] rounded-xl border border-white/5">
          {(['all', 'groups', 'knockout', 'final'] as const).map((stage) => (
            <button
              key={stage}
              onClick={() => setSelectedStage(stage)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-display font-semibold transition-all cursor-pointer ${
                selectedStage === stage
                  ? 'bg-green-800/60 text-green-300 border border-green-700/40'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              {stage === 'groups' ? 'Groups' : stage === 'knockout' ? 'Knockouts' : stage === 'final' ? 'Final' : 'All'}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-56">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-500" />
          <input
            type="text"
            placeholder="Search team..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#161b22] border border-white/8 rounded-xl pl-8 pr-4 py-2 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-green-700/60"
          />
        </div>
      </div>

      {/* Match grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {filteredMatches.length === 0 ? (
          <div className="col-span-2 bg-[#161b22] border border-white/5 rounded-xl py-12 text-center text-slate-500 text-sm">
            No matches match the current filter.
          </div>
        ) : (
          filteredMatches.map((m) => {
            const hTeam = getTeamObj(m.homeTeamId);
            const aTeam = getTeamObj(m.awayTeamId);
            const isFinal = m.stage === 'final';

            return (
              <div
                key={m.id}
                className={`border rounded-xl p-4 transition-all ${
                  isFinal
                    ? 'border-amber-500/30 bg-[#1a1400]'
                    : m.isPlayed
                    ? 'border-white/5 bg-[#161b22]'
                    : 'border-white/5 bg-[#0d1117] border-dashed'
                }`}
              >
                <div className="flex justify-between items-center mb-1">
                  <span className={`text-[10px] font-display font-bold px-2 py-0.5 rounded-full ${
                    isFinal ? 'bg-amber-500/20 text-amber-400' : 'bg-white/5 text-slate-500'
                  }`}>
                    {getStageLabel(m.stage, m.group)}
                  </span>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                    m.isPlayed ? 'bg-green-900/30 text-green-500' : m.date && isMatchDatePast(m.date) ? 'bg-amber-900/30 text-amber-400' : 'bg-slate-800 text-slate-500'
                  }`}>
                    {m.isPlayed ? 'FT' : m.date && isMatchDatePast(m.date) ? 'Awaiting Result' : 'Upcoming'}
                  </span>
                </div>
                {m.date && (
                  <div className="text-[10px] text-slate-600 font-semibold mb-3">
                    {formatDateToLocal(m.date)}
                  </div>
                )}

                <div className="grid grid-cols-3 items-center gap-2">
                  <div className="text-center">
                    <div className="text-3xl">{hTeam?.flag}</div>
                    <div className="text-xs font-display font-bold text-white mt-1 truncate">{hTeam?.name}</div>
                    <div className="text-[10px] text-slate-500 mt-0.5 truncate">{getOwnerName(m.homeTeamId)}</div>
                  </div>

                  <div className="text-center">
                    <div className={`font-display font-black text-xl ${m.isPlayed ? 'text-white' : 'text-slate-600'}`}>
                      {m.isPlayed ? `${m.homeScore}-${m.awayScore}` : 'vs'}
                    </div>
                    {m.isPlayed && m.penaltyWinnerId && (
                      <div className="text-[9px] text-amber-400 font-semibold mt-1">
                        {getTeamObj(m.penaltyWinnerId)?.code} (P)
                      </div>
                    )}
                  </div>

                  <div className="text-center">
                    <div className="text-3xl">{aTeam?.flag}</div>
                    <div className="text-xs font-display font-bold text-white mt-1 truncate">{aTeam?.name}</div>
                    <div className="text-[10px] text-slate-500 mt-0.5 truncate">{getOwnerName(m.awayTeamId)}</div>
                  </div>
                </div>

                {m.isPlayed && m.commentary && (
                  <p className="mt-3 text-[11px] italic text-slate-500 border-t border-white/5 pt-2 line-clamp-2">
                    "{m.commentary}"
                  </p>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
