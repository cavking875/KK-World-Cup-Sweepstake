import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import * as dotenv from "dotenv";
import { SweepstakeState, Participant, Team, TeamStats, Match, LeaderboardRow } from "./src/types";
import { WORLD_CUP_TEAMS } from "./src/teamsData";
import { hasExistingState, loadState as dbLoadState, saveState as dbSaveState } from "./database";

dotenv.config();

const PORT = 3000;

// ---------- Live score sync via football-data.org ----------
// Sign up free at https://www.football-data.org/ to get an API key.
// Set FOOTBALL_DATA_API_KEY in your .env or environment variables.
// The sync runs automatically every 2 minutes while the server is running.
const FOOTBALL_DATA_API_KEY = process.env.FOOTBALL_DATA_API_KEY || "";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin";
const FOOTBALL_DATA_WC_URL = "https://api.football-data.org/v4/competitions/WC/matches";

// Maps football-data.org team names -> our internal team IDs
const API_TEAM_NAME_MAP: Record<string, string> = {
  "Mexico": "mex",
  "South Africa": "rsa",
  "Korea Republic": "kor",
  "Czech Republic": "cze",
  "Czechia": "cze",
  "Canada": "can",
  "Bosnia-Herzegovina": "bih",
  "Bosnia and Herzegovina": "bih",
  "Qatar": "qat",
  "Switzerland": "sui",
  "Brazil": "bra",
  "Morocco": "mar",
  "Haiti": "hai",
  "Scotland": "sco",
  "USA": "usa",
  "United States": "usa",
  "Paraguay": "par",
  "Australia": "aus",
  "Turkey": "tur",
  "Türkiye": "tur",
  "Germany": "ger",
  "Curaçao": "cur",
  "Curacao": "cur",
  "Ivory Coast": "civ",
  "Côte d'Ivoire": "civ",
  "Ecuador": "ecu",
  "Netherlands": "ned",
  "Japan": "jpn",
  "Sweden": "swe",
  "Tunisia": "tun",
  "Belgium": "bel",
  "Egypt": "egy",
  "Iran": "irn",
  "IR Iran": "irn",
  "New Zealand": "nzl",
  "Spain": "esp",
  "Cape Verde": "cpv",
  "Saudi Arabia": "ksa",
  "Uruguay": "uru",
  "France": "fra",
  "Senegal": "sen",
  "Iraq": "irq",
  "Norway": "nor",
  "Argentina": "arg",
  "Algeria": "alg",
  "Austria": "aut",
  "Jordan": "jor",
  "Portugal": "por",
  "DR Congo": "cod",
  "Congo DR": "cod",
  "Uzbekistan": "uzb",
  "Colombia": "col",
  "England": "eng",
  "Croatia": "cro",
  "Ghana": "gha",
  "Panama": "pan",
};

// Sync state metadata
let lastSyncTime: Date | null = null;
let lastSyncStatus: "ok" | "error" | "no_key" | "idle" = "idle";
let lastSyncMessage = "";
let syncIntervalHandle: ReturnType<typeof setInterval> | null = null;

async function syncLiveScores(): Promise<{ updated: number; message: string }> {
  if (!FOOTBALL_DATA_API_KEY) {
    lastSyncStatus = "no_key";
    lastSyncMessage = "No API key set";
    return { updated: 0, message: "No FOOTBALL_DATA_API_KEY set" };
  }

  try {
    const response = await fetch(FOOTBALL_DATA_WC_URL, {
      headers: { "X-Auth-Token": FOOTBALL_DATA_API_KEY }
    });

    if (!response.ok) {
      throw new Error(`API responded with status ${response.status}`);
    }

    const data = await response.json() as any;
    const apiMatches: any[] = data.matches || [];

    const state = loadState();
    if (state.status === 'setup') {
      lastSyncStatus = "ok";
      lastSyncMessage = "Tournament not started yet";
      lastSyncTime = new Date();
      return { updated: 0, message: "Tournament not started" };
    }

    let updatedCount = 0;

    for (const apiMatch of apiMatches) {
      // Only process finished matches
      if (apiMatch.status !== "FINISHED") continue;

      const homeId = API_TEAM_NAME_MAP[apiMatch.homeTeam?.name];
      const awayId = API_TEAM_NAME_MAP[apiMatch.awayTeam?.name];
      if (!homeId || !awayId) continue;

      const homeScore = apiMatch.score?.fullTime?.home;
      const awayScore = apiMatch.score?.fullTime?.away;
      if (homeScore == null || awayScore == null) continue;

      // Find the matching sweepstake match (not yet played, same teams)
      const match = state.matches.find(m =>
        !m.isPlayed &&
        ((m.homeTeamId === homeId && m.awayTeamId === awayId) ||
         (m.homeTeamId === awayId && m.awayTeamId === homeId))
      );

      if (!match) continue;

      // Handle home/away flip if API has teams reversed
      const isFlipped = match.homeTeamId === awayId;
      match.homeScore = isFlipped ? awayScore : homeScore;
      match.awayScore = isFlipped ? homeScore : awayScore;
      match.isPlayed = true;

      // Handle knockout penalty winner
      if (match.stage !== "groups" && match.homeScore === match.awayScore) {
        const penWinnerApiName = apiMatch.score?.winner === "HOME_TEAM"
          ? apiMatch.homeTeam?.name
          : apiMatch.awayTeam?.name;
        const penWinnerId = penWinnerApiName ? API_TEAM_NAME_MAP[penWinnerApiName] : undefined;
        if (penWinnerId) match.penaltyWinnerId = penWinnerId;
      }

      match.commentary = `Live result synced from football-data.org: ${match.homeScore} - ${match.awayScore}`;
      updatedCount++;
    }

    if (updatedCount > 0) {
      reconcileStagesAndAdvance(state);
      saveState(state);
    }

    lastSyncTime = new Date();
    lastSyncStatus = "ok";
    lastSyncMessage = updatedCount > 0
      ? `Synced ${updatedCount} new result${updatedCount > 1 ? "s" : ""}`
      : "No new results";

    return { updated: updatedCount, message: lastSyncMessage };

  } catch (err: any) {
    lastSyncStatus = "error";
    lastSyncMessage = err?.message || "Unknown error";
    lastSyncTime = new Date();
    console.error("[LiveSync] Error:", err?.message);
    return { updated: 0, message: lastSyncMessage };
  }
}

// Helper to generate group matches
// Real 2026 World Cup group stage schedule (all times BST, source: BBC Sport)
// Order: [r1m1, r1m2, r2m1, r2m2, r3m1, r3m2]
const GROUP_SCHEDULE: Record<string, [string, string, string, string, string, string]> = {
  'A': ['Thu 11 Jun, 20:00', 'Fri 12 Jun, 03:00', 'Fri 19 Jun, 02:00', 'Thu 18 Jun, 17:00', 'Thu 25 Jun, 02:00', 'Thu 25 Jun, 02:00'],
  'B': ['Fri 12 Jun, 20:00', 'Sat 13 Jun, 20:00', 'Thu 18 Jun, 23:00', 'Thu 18 Jun, 20:00', 'Wed 24 Jun, 20:00', 'Wed 24 Jun, 20:00'],
  'C': ['Sat 13 Jun, 23:00', 'Sun 14 Jun, 02:00', 'Sat 20 Jun, 01:30', 'Fri 19 Jun, 23:00', 'Wed 24 Jun, 23:00', 'Wed 24 Jun, 23:00'],
  'D': ['Sat 13 Jun, 02:00', 'Sun 14 Jun, 05:00', 'Fri 19 Jun, 20:00', 'Sat 20 Jun, 04:00', 'Fri 26 Jun, 03:00', 'Fri 26 Jun, 03:00'],
  'E': ['Sun 14 Jun, 18:00', 'Mon 15 Jun, 00:00', 'Sat 20 Jun, 21:00', 'Sun 21 Jun, 01:00', 'Thu 25 Jun, 21:00', 'Thu 25 Jun, 21:00'],
  'F': ['Sun 14 Jun, 21:00', 'Mon 15 Jun, 03:00', 'Sat 20 Jun, 18:00', 'Sun 21 Jun, 05:00', 'Fri 26 Jun, 00:00', 'Fri 26 Jun, 00:00'],
  'G': ['Mon 15 Jun, 20:00', 'Tue 16 Jun, 02:00', 'Sun 21 Jun, 20:00', 'Mon 22 Jun, 02:00', 'Sat 27 Jun, 04:00', 'Sat 27 Jun, 04:00'],
  'H': ['Mon 15 Jun, 17:00', 'Mon 15 Jun, 23:00', 'Sun 21 Jun, 17:00', 'Sun 21 Jun, 23:00', 'Sat 27 Jun, 01:00', 'Sat 27 Jun, 01:00'],
  'I': ['Tue 16 Jun, 20:00', 'Tue 16 Jun, 23:00', 'Mon 22 Jun, 22:00', 'Tue 23 Jun, 01:00', 'Fri 26 Jun, 20:00', 'Fri 26 Jun, 20:00'],
  'J': ['Wed 17 Jun, 02:00', 'Wed 17 Jun, 05:00', 'Mon 22 Jun, 18:00', 'Tue 23 Jun, 04:00', 'Sun 28 Jun, 03:00', 'Sun 28 Jun, 03:00'],
  'K': ['Wed 17 Jun, 18:00', 'Thu 18 Jun, 03:00', 'Tue 23 Jun, 18:00', 'Wed 24 Jun, 03:00', 'Sun 28 Jun, 00:30', 'Sun 28 Jun, 00:30'],
  'L': ['Wed 17 Jun, 21:00', 'Thu 18 Jun, 00:00', 'Tue 23 Jun, 21:00', 'Wed 24 Jun, 00:00', 'Sat 27 Jun, 22:00', 'Sat 27 Jun, 22:00'],
};

function createGroupMatches(teams: Team[]): Match[] {
  const matches: Match[] = [];
  const groups = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];

  groups.forEach((g) => {
    const gTeams = teams.filter(t => t.group === g);
    if (gTeams.length < 4) return;
    
    const sched = GROUP_SCHEDULE[g] || ['TBC', 'TBC', 'TBC', 'TBC', 'TBC', 'TBC'];

    // Seed matches cleanly across 3 rounds
    // Round 1
    matches.push({
      id: `g-${g}-r1-m1`,
      stage: 'groups',
      group: g,
      homeTeamId: gTeams[0].id,
      awayTeamId: gTeams[1].id,
      isPlayed: false,
      roundIndex: 1,
      date: sched[0]
    });
    matches.push({
      id: `g-${g}-r1-m2`,
      stage: 'groups',
      group: g,
      homeTeamId: gTeams[2].id,
      awayTeamId: gTeams[3].id,
      isPlayed: false,
      roundIndex: 1,
      date: sched[1]
    });

    // Round 2
    matches.push({
      id: `g-${g}-r2-m1`,
      stage: 'groups',
      group: g,
      homeTeamId: gTeams[0].id,
      awayTeamId: gTeams[2].id,
      isPlayed: false,
      roundIndex: 2,
      date: sched[2]
    });
    matches.push({
      id: `g-${g}-r2-m2`,
      stage: 'groups',
      group: g,
      homeTeamId: gTeams[1].id,
      awayTeamId: gTeams[3].id,
      isPlayed: false,
      roundIndex: 2,
      date: sched[3]
    });

    // Round 3
    matches.push({
      id: `g-${g}-r3-m1`,
      stage: 'groups',
      group: g,
      homeTeamId: gTeams[3].id,
      awayTeamId: gTeams[0].id,
      isPlayed: false,
      roundIndex: 3,
      date: sched[4]
    });
    matches.push({
      id: `g-${g}-r3-m2`,
      stage: 'groups',
      group: g,
      homeTeamId: gTeams[1].id,
      awayTeamId: gTeams[2].id,
      isPlayed: false,
      roundIndex: 3,
      date: sched[5]
    });
  });

  return matches;
}

// Generate the initial clean stats for all 32 teams
function createInitialStats(teams: Team[]): Record<string, TeamStats> {
  const stats: Record<string, TeamStats> = {};
  teams.forEach((t) => {
    stats[t.id] = {
      teamId: t.id,
      played: 0,
      won: 0,
      drawn: 0,
      lost: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      goalDifference: 0,
      points: 0,
      stage: 'groups'
    };
  });
  return stats;
}

// Initial state builder
function buildInitialState(): SweepstakeState {
  const state: SweepstakeState = {
    status: 'setup',
    participants: [],
    teams: WORLD_CUP_TEAMS,
    stats: createInitialStats(WORLD_CUP_TEAMS),
    matches: createGroupMatches(WORLD_CUP_TEAMS),
    collectiv: {
      entryFee: 5,
      potType: 'dynamic',
      totalPotValue: 80, // 16 participants * 5
      currency: 'GBP',
      link: 'https://pay.collctiv.com/keyboard-kelly-world-cup-sweepstake-79163'
    },
    currentMatchIndex: 0
  };

  return state;
}

// Random draft/draw logic
function autoDraftTeams(state: SweepstakeState) {
  if (state.participants.length === 0) return;
  
  // Clear any existing assignments
  state.participants.forEach(p => p.assignedTeamIds = []);
  
  const shuffledTeams = [...state.teams].sort(() => Math.random() - 0.5);
  const partCount = state.participants.length;

  // Let's divide standard teams (32 teams) among participants evenly
  shuffledTeams.forEach((team, idx) => {
    const pIdx = idx % partCount;
    state.participants[pIdx].assignedTeamIds.push(team.id);
  });
}

// Load and Save Persistent state
function loadState(): SweepstakeState {
  try {
    if (hasExistingState()) {
      return dbLoadState();
    }
  } catch (error) {
    console.error("Failed to load state from database, creating fresh initial state:", error);
  }
  const fresh = buildInitialState();
  saveState(fresh);
  return fresh;
}

function saveState(state: SweepstakeState) {
  try {
    dbSaveState(state);
  } catch (error) {
    console.error("Failed to save state to database:", error);
  }
}

// Initialize Gemini SDK if available
const ai = process.env.GEMINI_API_KEY
  ? new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    })
  : null;

// Re-calculate team standings and prizes
function updateGroupStandingsAndPrizes(state: SweepstakeState) {
  // Clear stats first to re-compute all matches faithfully
  state.stats = createInitialStats(state.teams);

  // Group stage calculations
  const groupMatches = state.matches.filter(m => m.stage === 'groups');
  groupMatches.forEach((m) => {
    if (!m.isPlayed || m.homeScore === undefined || m.awayScore === undefined) return;

    const hs = state.stats[m.homeTeamId];
    const as = state.stats[m.awayTeamId];

    if (!hs || !as) return;

    hs.played += 1;
    as.played += 1;
    hs.goalsFor += m.homeScore;
    hs.goalsAgainst += m.awayScore;
    as.goalsFor += m.awayScore;
    as.goalsAgainst += m.homeScore;

    if (m.homeScore > m.awayScore) {
      hs.won += 1;
      hs.points += 3;
      as.lost += 1;
    } else if (m.homeScore < m.awayScore) {
      as.won += 1;
      as.points += 3;
      hs.lost += 1;
    } else {
      hs.drawn += 1;
      as.drawn += 1;
      hs.points += 1;
      as.points += 1;
    }

    hs.goalDifference = hs.goalsFor - hs.goalsAgainst;
    as.goalDifference = as.goalsFor - as.goalsAgainst;
  });

  // Calculate qualified teams if all group matches are done, or to show current projections
  // Sort teams inside groups to see rankings
  const groups = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];
  const allGroupStagesCompleted = groupMatches.every(m => m.isPlayed);
  const thirdPlaceTeams: { teamId: string; points: number; goalDifference: number; goalsFor: number; rating: number }[] = [];

  groups.forEach((g) => {
    const gTeams = state.teams.filter(t => t.group === g);
    const sorted = [...gTeams].sort((t1, t2) => {
      const s1 = state.stats[t1.id];
      const s2 = state.stats[t2.id];
      if (!s1 || !s2) return 0;
      if (s1.points !== s2.points) return s2.points - s1.points;
      if (s1.goalDifference !== s2.goalDifference) return s2.goalDifference - s1.goalDifference;
      if (s1.goalsFor !== s2.goalsFor) return s2.goalsFor - s1.goalsFor;
      return t2.rating - t1.rating; // fallback to rating
    });

    const groupPlayedCount = groupMatches.filter(m => m.group === g && m.isPlayed).length;
    if (groupPlayedCount === 6) {
      if (state.stats[sorted[0].id]) state.stats[sorted[0].id].stage = 'r32';
      if (state.stats[sorted[1].id]) state.stats[sorted[1].id].stage = 'r32';
      if (state.stats[sorted[3].id]) state.stats[sorted[3].id].stage = 'eliminated';
      
      const s3 = state.stats[sorted[2].id];
      if (s3) {
        thirdPlaceTeams.push({
          teamId: sorted[2].id,
          points: s3.points,
          goalDifference: s3.goalDifference,
          goalsFor: s3.goalsFor,
          rating: sorted[2].rating
        });
      }
    } else {
      sorted.forEach((team) => {
        if (state.stats[team.id] && state.stats[team.id].stage === 'eliminated') {
          state.stats[team.id].stage = 'groups';
        }
      });
    }
  });

  // Handle the 12 third-place candidates
  if (allGroupStagesCompleted && thirdPlaceTeams.length === 12) {
    const sortedThirds = [...thirdPlaceTeams].sort((a, b) => {
      if (a.points !== b.points) return b.points - a.points;
      if (a.goalDifference !== b.goalDifference) return b.goalDifference - a.goalDifference;
      if (a.goalsFor !== b.goalsFor) return b.goalsFor - a.goalsFor;
      return b.rating - a.rating;
    });

    sortedThirds.forEach((t, idx) => {
      if (state.stats[t.teamId]) {
        state.stats[t.teamId].stage = idx < 8 ? 'r32' : 'eliminated';
      }
    });
  } else {
    // If not all groups are completed, we provisionally treat 3rd place teams as active in groups stage
    thirdPlaceTeams.forEach((t) => {
      if (state.stats[t.teamId]) {
        state.stats[t.teamId].stage = 'groups';
      }
    });
  }

  // Process knockout matches
  const knockouts = state.matches.filter(m => m.stage !== 'groups');
  knockouts.forEach((m) => {
    if (!m.isPlayed || m.homeScore === undefined || m.awayScore === undefined) return;

    const winnerId = m.homeScore > m.awayScore ? m.homeTeamId : 
                     m.homeScore < m.awayScore ? m.awayTeamId : m.penaltyWinnerId;

    const loserId = winnerId === m.homeTeamId ? m.awayTeamId : m.homeTeamId;

    if (winnerId && state.stats[winnerId]) {
      // Set winner stage to the next stage
      const nextStages: Record<string, 'r16' | 'qf' | 'sf' | 'final' | 'completed'> = {
        'r32': 'r16',
        'r16': 'qf',
        'qf': 'sf',
        'sf': 'final',
        'final': 'completed'
      };
      const currentLabel = m.stage as string;
      const nextLabel = nextStages[currentLabel];
      if (nextLabel) {
        state.stats[winnerId].stage = nextLabel === 'completed' ? 'completed' : nextLabel;
      }
    }

    if (loserId && state.stats[loserId]) {
      state.stats[loserId].stage = 'eliminated';
    }
  });

  // Determine current World Cup Winner and Runner up
  const finalMatch = state.matches.find(m => m.stage === 'final');
  if (finalMatch && finalMatch.isPlayed) {
    const winner = finalMatch.homeScore! > finalMatch.awayScore! ? finalMatch.homeTeamId : 
                   finalMatch.homeScore! < finalMatch.awayScore! ? finalMatch.awayTeamId : finalMatch.penaltyWinnerId;
    const runnerUp = winner === finalMatch.homeTeamId ? finalMatch.awayTeamId : finalMatch.homeTeamId;
    
    state.winnerTeamId = winner;
    state.runnerUpTeamId = runnerUp;
    state.status = 'completed';
  } else {
    state.winnerTeamId = undefined;
    state.runnerUpTeamId = undefined;
  }

  // Calculate the "worst team with the worst goal difference"
  // Per requirements, only the worst team overall (wooden spoon) is judged based on tournament points and goal difference.
  // A team is eligible to be the worst team ONLY if they never progressed to the knockout matches.
  const eligibleWorstTeams = state.teams.filter(t => {
    const s = state.stats[t.id];
    if (!s) return false;
    // They are ineligible if they participated in any match that was a knockout stage
    const hasPlayedKnockout = state.matches.some(m => m.stage !== 'groups' && (m.homeTeamId === t.id || m.awayTeamId === t.id));
    return !hasPlayedKnockout;
  });

  let worstTeamId = "";
  let worstPoints = Infinity;
  let worstGD = Infinity;
  let worstGF = Infinity;

  eligibleWorstTeams.forEach((t) => {
    const s = state.stats[t.id];
    if (!s) return;
    
    if (s.points < worstPoints) {
      worstPoints = s.points;
      worstGD = s.goalDifference;
      worstGF = s.goalsFor;
      worstTeamId = t.id;
    } else if (s.points === worstPoints) {
      if (s.goalDifference < worstGD) {
        worstGD = s.goalDifference;
        worstGF = s.goalsFor;
        worstTeamId = t.id;
      } else if (s.goalDifference === worstGD) {
        if (s.goalsFor < worstGF) {
          worstGF = s.goalsFor;
          worstTeamId = t.id;
        } else if (s.goalsFor === worstGF) {
          // If points, GD and GF are all tied, judge worst team based on FIFA Rating (lower is worst)
          const currentWorstTeam = state.teams.find(team => team.id === worstTeamId);
          if (!currentWorstTeam || t.rating < currentWorstTeam.rating) {
            worstTeamId = t.id;
          }
        }
      }
    }
  });

  state.worstTeamId = worstTeamId;
}

// Generate next knockout bracket stage once group stage is done
function buildRoundOf32Stage(state: SweepstakeState) {
  // Check if we already have the Round of 32 matches built
  if (state.matches.some(m => m.stage === 'r32')) return;

  const groups = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];
  const groupWinners: string[] = [];
  const groupRunners: string[] = [];
  const groupThirds: { teamId: string; points: number; goalDifference: number; goalsFor: number; rating: number }[] = [];

  groups.forEach((g) => {
    const gTeams = state.teams.filter(t => t.group === g);
    const sorted = [...gTeams].sort((t1, t2) => {
      const s1 = state.stats[t1.id];
      const s2 = state.stats[t2.id];
      if (!s1 || !s2) return 0;
      if (s1.points !== s2.points) return s2.points - s1.points;
      if (s1.goalDifference !== s2.goalDifference) return s2.goalDifference - s1.goalDifference;
      if (s1.goalsFor !== s2.goalsFor) return s2.goalsFor - s1.goalsFor;
      return t2.rating - t1.rating;
    });

    groupWinners.push(sorted[0].id);
    groupRunners.push(sorted[1].id);
    
    const s3 = state.stats[sorted[2].id];
    if (s3) {
      groupThirds.push({
        teamId: sorted[2].id,
        points: s3.points,
        goalDifference: s3.goalDifference,
        goalsFor: s3.goalsFor,
        rating: sorted[2].rating
      });
    }
  });

  const sortedThirds = [...groupThirds].sort((a, b) => {
    if (a.points !== b.points) return b.points - a.points;
    if (a.goalDifference !== b.goalDifference) return b.goalDifference - a.goalDifference;
    if (a.goalsFor !== b.goalsFor) return b.goalsFor - a.goalsFor;
    return b.rating - a.rating;
  });

  const qualifiedThirds = sortedThirds.slice(0, 8).map(t => t.teamId);

  const rankedRunners = [...groupRunners].map(tid => {
    const s = state.stats[tid];
    const originalTeam = state.teams.find(t => t.id === tid);
    return {
      teamId: tid,
      points: s?.points || 0,
      goalDifference: s?.goalDifference || 0,
      goalsFor: s?.goalsFor || 0,
      rating: originalTeam?.rating || 0
    };
  }).sort((a, b) => {
    if (a.points !== b.points) return b.points - a.points;
    if (a.goalDifference !== b.goalDifference) return b.goalDifference - a.goalDifference;
    if (a.goalsFor !== b.goalsFor) return b.goalsFor - a.goalsFor;
    return b.rating - a.rating;
  });

  const best4Runners = rankedRunners.slice(0, 4).map(t => t.teamId);
  const other8Runners = rankedRunners.slice(4).map(t => t.teamId);

  const seeded = [...groupWinners, ...best4Runners]; // 16 teams
  const unseeded = [...other8Runners, ...qualifiedThirds]; // 16 teams

  for (let i = 0; i < 16; i++) {
    const ht = seeded[i];
    const at = unseeded[(i + 5) % 16];
    
    state.matches.push({
      id: `r32-m${i + 1}`,
      stage: 'r32',
      homeTeamId: ht,
      awayTeamId: at,
      isPlayed: false,
      date: `June 24-26, R32 - Match ${i + 1}`,
      roundIndex: 4
    });
  }
}

// Generate Round of 16 bracket if Round of 32 is fully played
function buildRoundOf16Stage(state: SweepstakeState) {
  if (state.matches.some(m => m.stage === 'r16')) return;

  const r32Matches = state.matches.filter(m => m.stage === 'r32');
  if (r32Matches.length < 16 || r32Matches.some(m => !m.isPlayed)) return;

  const winners: string[] = r32Matches.map(m => {
    if (m.homeScore! > m.awayScore!) return m.homeTeamId;
    if (m.homeScore! < m.awayScore!) return m.awayTeamId;
    return m.penaltyWinnerId!;
  });

  for (let i = 0; i < 8; i++) {
    state.matches.push({
      id: `r16-m${i + 1}`,
      stage: 'r16',
      homeTeamId: winners[i * 2],
      awayTeamId: winners[i * 2 + 1],
      isPlayed: false,
      date: `June 28-30, R16 - Match ${i + 1}`,
      roundIndex: 5
    });
  }
}

// Generate Quarterfinals bracket if Round of 16 is fully played
function buildQuarterfinalsStage(state: SweepstakeState) {
  if (state.matches.some(m => m.stage === 'qf')) return;

  const r16Matches = state.matches.filter(m => m.stage === 'r16');
  if (r16Matches.length < 8 || r16Matches.some(m => !m.isPlayed)) return;

  const winners: string[] = r16Matches.map(m => {
    if (m.homeScore! > m.awayScore!) return m.homeTeamId;
    if (m.homeScore! < m.awayScore!) return m.awayTeamId;
    return m.penaltyWinnerId!;
  });

  const qfFixtures = [
    [winners[0], winners[1]],
    [winners[2], winners[3]],
    [winners[4], winners[5]],
    [winners[6], winners[7]],
  ];

  qfFixtures.forEach(([ht, at], idx) => {
    state.matches.push({
      id: `qf-m${idx+1}`,
      stage: 'qf',
      homeTeamId: ht,
      awayTeamId: at,
      isPlayed: false,
      date: `July 3-4, QF ${idx + 1}`,
      roundIndex: 6
    });
  });
}

// Generate Semifinals bracket if Quarterfinals are done
function buildSemifinalsStage(state: SweepstakeState) {
  if (state.matches.some(m => m.stage === 'sf')) return;

  const qfMatches = state.matches.filter(m => m.stage === 'qf');
  if (qfMatches.length < 4 || qfMatches.some(m => !m.isPlayed)) return;

  const winners: string[] = qfMatches.map(m => {
    if (m.homeScore! > m.awayScore!) return m.homeTeamId;
    if (m.homeScore! < m.awayScore!) return m.awayTeamId;
    return m.penaltyWinnerId!;
  });

  const sfFixtures = [
    [winners[0], winners[1]],
    [winners[2], winners[3]],
  ];

  sfFixtures.forEach(([ht, at], idx) => {
    state.matches.push({
      id: `sf-m${idx+1}`,
      stage: 'sf',
      homeTeamId: ht,
      awayTeamId: at,
      isPlayed: false,
      date: `July 7-8, Semifinal ${idx + 1}`,
      roundIndex: 7
    });
  });
}

// Generate Final if Semifinals are done
function buildFinalsStage(state: SweepstakeState) {
  if (state.matches.some(m => m.stage === 'final')) return;

  const sfMatches = state.matches.filter(m => m.stage === 'sf');
  if (sfMatches.length < 2 || sfMatches.some(m => !m.isPlayed)) return;

  const winners: string[] = sfMatches.map(m => {
    if (m.homeScore! > m.awayScore!) return m.homeTeamId;
    if (m.homeScore! < m.awayScore!) return m.awayTeamId;
    return m.penaltyWinnerId!;
  });

  state.matches.push({
    id: 'final-m1',
    stage: 'final',
    homeTeamId: winners[0],
    awayTeamId: winners[1],
    isPlayed: false,
    date: `July 12, World Cup Final 🏆`,
    roundIndex: 8
  });
}

// Check if current active stage is completed and queue up brackets
function reconcileStagesAndAdvance(state: SweepstakeState) {
  const unplayedGroupCount = state.matches.filter(m => m.stage === 'groups' && !m.isPlayed).length;
  
  if (unplayedGroupCount === 0) {
    // All groups are done, build Round of 32
    buildRoundOf32Stage(state);
    
    // Check if R32 is completed
    const r32Matches = state.matches.filter(m => m.stage === 'r32');
    const r32Unplayed = r32Matches.filter(m => !m.isPlayed).length;
    if (r32Matches.length === 16 && r32Unplayed === 0) {
      buildRoundOf16Stage(state);
      
      const r16Matches = state.matches.filter(m => m.stage === 'r16');
      const r16Unplayed = r16Matches.filter(m => !m.isPlayed).length;
      if (r16Matches.length === 8 && r16Unplayed === 0) {
        buildQuarterfinalsStage(state);
        
        const qfMatches = state.matches.filter(m => m.stage === 'qf');
        const qfUnplayed = qfMatches.filter(m => !m.isPlayed).length;
        if (qfMatches.length === 4 && qfUnplayed === 0) {
          buildSemifinalsStage(state);
          
          const sfMatches = state.matches.filter(m => m.stage === 'sf');
          const sfUnplayed = sfMatches.filter(m => !m.isPlayed).length;
          if (sfMatches.length === 2 && sfUnplayed === 0) {
            buildFinalsStage(state);
          }
        }
      }
    }
  }

  updateGroupStandingsAndPrizes(state);
}

// Fallback rating-based simulation logic if no Gemini API key is configured
function simulateGameLocally(home: Team, away: Team, isKnockout: boolean): { homeScore: number, awayScore: number, penaltyWinnerId?: string, commentary: string } {
  // Home advantage + random rating adjustment
  const hRating = home.rating + 3;
  const aRating = away.rating;

  // Let's set some score ranges based on relative strength
  const diff = hRating - aRating;
  let muHome = 1.3 + (diff * 0.04);
  let muAway = 1.3 - (diff * 0.04);

  muHome = Math.max(0.4, Math.min(3.5, muHome));
  muAway = Math.max(0.4, Math.min(3.5, muAway));

  // Poisson-like score generation
  const homeScoreVal = Math.floor(Math.random() * (muHome + 1.5));
  const awayScoreVal = Math.floor(Math.random() * (muAway + 1.5));

  let penWinner: string | undefined;
  let commentary = "";

  if (isKnockout && homeScoreVal === awayScoreVal) {
    const homePenBonus = Math.random() > 0.5 ? 1 : 0;
    penWinner = homePenBonus === 1 ? home.id : away.id;
    const teamWonFlag = penWinner === home.id ? home.name : away.name;
    commentary = `A spectacular knockout defensive showcase ends ${homeScoreVal}-${awayScoreVal}. Extra time cannot separate them, and ${teamWonFlag} edge it on penalties!`;
  } else {
    const winnerName = homeScoreVal > awayScoreVal ? home.name : away.name;
    const loserName = homeScoreVal > awayScoreVal ? away.name : home.name;
    const highscore = Math.max(homeScoreVal, awayScoreVal);
    const lowscore = Math.min(homeScoreVal, awayScoreVal);

    if (homeScoreVal === awayScoreVal) {
      if (highscore === 0) {
        commentary = `A defensive gridlock! Both ${home.name} and ${away.name} nullify each other's attacking lines in a tight 0-0 encounter, yielding single points on the table.`;
      } else {
        commentary = `End-to-end action! A hard-fought ${homeScoreVal}-${awayScoreVal} draw as ${home.name} equalizes late to split the points. Fans are going ballistic!`;
      }
    } else {
      if (highscore - lowscore >= 3) {
        commentary = `Complete domination! ${winnerName} dismantle ${loserName} in a high-octane ${highscore}-${lowscore} sweep. Standard class play on full display.`;
      } else {
        commentary = `What a screamer! ${winnerName} edge past ${loserName} in an intense ${highscore}-${lowscore} battle with brilliant tactical composure near the whistle.`;
      }
    }
  }

  return {
    homeScore: homeScoreVal,
    awayScore: awayScoreVal,
    penaltyWinnerId: penWinner,
    commentary
  };
}

// Start API config and Router helpers
async function startServer() {
  const app = express();
  app.use(express.json());

  // SSE/Websocket setup could be done but a frequent poll is highly robust and operates on standard Express
  app.get("/api/sweepstake/state", (req, res) => {
    let state = loadState();
    reconcileStagesAndAdvance(state);
    saveState(state);
    res.json(state);
  });

  app.post("/api/sweepstake/reset", (req, res) => {
    const cleanState = buildInitialState();
    saveState(cleanState);
    res.json(cleanState);
  });

  app.post("/api/sweepstake/participants", (req, res) => {
    const state = loadState();
    const { action, participant } = req.body;

    if (action === "add" && participant) {
      const newPart: Participant = {
        id: "p_" + Date.now(),
        name: participant.name,
        assignedTeamIds: [],
        hasPaid: false
      };
      state.participants.push(newPart);
    } else if (action === "edit" && participant) {
      const idx = state.participants.findIndex(p => p.id === participant.id);
      if (idx !== -1) {
        state.participants[idx].name = participant.name;
        state.participants[idx].hasPaid = participant.hasPaid;
      }
    } else if (action === "delete" && participant) {
      state.participants = state.participants.filter(p => p.id !== participant.id);
    }

    reconcileStagesAndAdvance(state);
    saveState(state);
    res.json(state);
  });

  app.post("/api/sweepstake/collectiv", (req, res) => {
    const state = loadState();
    const { entryFee, link, currency } = req.body;

    state.collectiv.entryFee = Number(entryFee) || 10;
    state.collectiv.link = link || "";
    state.collectiv.currency = currency || "GBP";
    state.collectiv.totalPotValue = state.participants.length * state.collectiv.entryFee;

    saveState(state);
    res.json(state);
  });

  app.post("/api/sweepstake/payment-status", (req, res) => {
    const state = loadState();
    const { participantId, hasPaid } = req.body;

    const idx = state.participants.findIndex(p => p.id === participantId);
    if (idx !== -1) {
      state.participants[idx].hasPaid = !!hasPaid;
    }

    saveState(state);
    res.json(state);
  });

  app.post("/api/sweepstake/admin-auth", (req, res) => {
    const { password } = req.body;
    if (typeof password === 'string' && password === ADMIN_PASSWORD) {
      res.json({ ok: true });
    } else {
      res.status(401).json({ ok: false, message: 'Incorrect password' });
    }
  });

  app.post("/api/sweepstake/redraft", (req, res) => {
    const state = loadState();
    autoDraftTeams(state);
    saveState(state);
    res.json(state);
  });

  app.post("/api/sweepstake/start-competition", (req, res) => {
    const state = loadState();
    state.status = 'active';
    saveState(state);
    res.json(state);
  });

  // Manual Override match scores
  app.post("/api/sweepstake/match-override", (req, res) => {
    const state = loadState();
    const { matchId, homeScore, awayScore, penaltyWinnerId } = req.body;

    const match = state.matches.find(m => m.id === matchId);
    if (match) {
      match.homeScore = Number(homeScore);
      match.awayScore = Number(awayScore);
      match.isPlayed = true;
      if (match.homeScore === match.awayScore && match.stage !== 'groups') {
        match.penaltyWinnerId = penaltyWinnerId;
      }
      match.commentary = `Match scores populated manually by Admin: ${match.homeScore} - ${match.awayScore}`;
    }

    reconcileStagesAndAdvance(state);
    saveState(state);
    res.json(state);
  });

  // Simulate Next Match (either single, round, or bulk)
  app.post("/api/sweepstake/simulate", async (req, res) => {
    const state = loadState();
    const { mode } = req.body; // 'next', 'round', 'all'

    // Get unplayed matches
    // Note we must simulate matches in sequential chronological order!
    // Group rounds must be simulated, then r16 fixtures created, then r16 matches, etc.
    reconcileStagesAndAdvance(state);

    let unplayed = state.matches.filter(m => !m.isPlayed);

    if (unplayed.length === 0) {
      return res.json(state);
    }

    let toSimulate: Match[] = [];
    if (mode === 'next') {
      toSimulate = [unplayed[0]];
    } else if (mode === 'round') {
      // Find the stage and round index of the first unplayed match, simulate all in that same stage / round index
      const targetStage = unplayed[0].stage;
      const targetRound = unplayed[0].roundIndex;
      toSimulate = unplayed.filter(m => m.stage === targetStage && m.roundIndex === targetRound);
    } else {
      // mode === 'all'
      // Just simulate ALL unplayed matches in the current active phase.
      const currentLabel = unplayed[0].stage;
      toSimulate = unplayed.filter(m => m.stage === currentLabel);
    }

    for (const match of toSimulate) {
      const homeTeam = state.teams.find(t => t.id === match.homeTeamId);
      const awayTeam = state.teams.find(t => t.id === match.awayTeamId);

      if (!homeTeam || !awayTeam) continue;

      const isKnockout = match.stage !== 'groups';
      let simResult;

      if (ai) {
        try {
          // Instruct Gemini to be a dramatic World Cup sweepstake sportscaster
          const prompt = `Simulate a football match for the World Cup between ${homeTeam.name} (flag: ${homeTeam.flag}, FIFA strength rating: ${homeTeam.rating}/100) and ${awayTeam.name} (flag: ${awayTeam.flag}, FIFA strength rating: ${awayTeam.rating}/100).
This is for a cozy Discord Sweepstake group. 
Is this a knockout match? ${isKnockout ? 'Yes, draw is impossible. If the score is even after 90 minutes, select a penalty shootout winner.' : 'No, group stage matches can end in a draw.'}

Generate a JSON response of the following model schema:
{
  "homeScore": number,
  "awayScore": number,
  "penaltyWinnerId": string (MUST be "${homeTeam.id}" or "${awayTeam.id}" if homeScore equals awayScore and isKnockout is true, otherwise empty/null),
  "commentary": "A dramatic 1-2 sentence match summary reporting the details, key goals or scorers, and some fun football narrative!"
}`;

          const response = await ai.models.generateContent({
            model: "gemini-3.5-flash",
            contents: prompt,
            config: {
              responseMimeType: "application/json",
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  homeScore: { type: Type.INTEGER },
                  awayScore: { type: Type.INTEGER },
                  penaltyWinnerId: { type: Type.STRING },
                  commentary: { type: Type.STRING }
                },
                required: ["homeScore", "awayScore", "commentary"]
              },
              systemInstruction: "You are the ultimate World Cup television broadcaster for a friendly Discord community's sweepstake box league. Write exciting, concise match reports capturing pure sport intensity."
            }
          });

          const data = JSON.parse(response.text.trim());
          simResult = {
            homeScore: Number(data.homeScore),
            awayScore: Number(data.awayScore),
            penaltyWinnerId: data.penaltyWinnerId || undefined,
            commentary: data.commentary
          };

          // Sanitize knockout draws
          if (isKnockout && simResult.homeScore === simResult.awayScore && !simResult.penaltyWinnerId) {
            simResult.penaltyWinnerId = Math.random() > 0.5 ? homeTeam.id : awayTeam.id;
          }

        } catch (err) {
          console.error("Gemini simulation failed, running local simulator fallback:", err);
          simResult = simulateGameLocally(homeTeam, awayTeam, isKnockout);
        }
      } else {
        // Run rating-based localized computation
        simResult = simulateGameLocally(homeTeam, awayTeam, isKnockout);
      }

      // Update match record
      const record = state.matches.find(m => m.id === match.id);
      if (record) {
        record.homeScore = simResult.homeScore;
        record.awayScore = simResult.awayScore;
        record.penaltyWinnerId = simResult.penaltyWinnerId;
        record.commentary = simResult.commentary;
        record.isPlayed = true;

        // Perform small middle stage advance in loop to allow progressive knockouts to populate
        reconcileStagesAndAdvance(state);
      }
    }

    reconcileStagesAndAdvance(state);
    saveState(state);
    res.json(state);
  });

  // Manual sync trigger + sync status endpoint
  app.post("/api/sweepstake/sync-scores", async (req, res) => {
    const result = await syncLiveScores();
    res.json({
      ...result,
      lastSyncTime: lastSyncTime?.toISOString() ?? null,
      lastSyncStatus,
      lastSyncMessage,
    });
  });

  app.get("/api/sweepstake/sync-status", (req, res) => {
    res.json({
      lastSyncTime: lastSyncTime?.toISOString() ?? null,
      lastSyncStatus,
      lastSyncMessage,
      apiKeyConfigured: !!FOOTBALL_DATA_API_KEY,
    });
  });

  // Load UI assets
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`World Cup Sweepstake server running on port ${PORT}`);

    // Start live score sync - runs every 2 minutes
    if (FOOTBALL_DATA_API_KEY) {
      console.log("[LiveSync] Football-data.org API key found - live score sync enabled (every 2 min)");
      syncLiveScores(); // run once immediately on startup
      syncIntervalHandle = setInterval(syncLiveScores, 2 * 60 * 1000);
    } else {
      console.log("[LiveSync] No FOOTBALL_DATA_API_KEY set - live sync disabled. Set the env var to enable.");
    }
  });
}

startServer();
