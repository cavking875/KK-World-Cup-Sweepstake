import Database from 'better-sqlite3';
import path from 'path';
import { SweepstakeState, Participant, TeamStats, Match } from './src/types';
import { WORLD_CUP_TEAMS } from './src/teamsData';

// Use /data volume on Railway (persistent), fall back to cwd locally
const DB_DIR = process.env.RAILWAY_VOLUME_MOUNT_PATH || process.cwd();
const DB_PATH = path.join(DB_DIR, 'sweepstake.db');

let db: Database.Database | null = null;

function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initializeSchema(db);
  }
  return db;
}

function initializeSchema(database: Database.Database): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS sweepstake_meta (
      id INTEGER PRIMARY KEY DEFAULT 1,
      status TEXT NOT NULL DEFAULT 'setup',
      winner_team_id TEXT,
      runner_up_team_id TEXT,
      worst_team_id TEXT,
      current_match_index INTEGER DEFAULT 0,
      collectiv_entry_fee REAL DEFAULT 10,
      collectiv_pot_type TEXT DEFAULT 'dynamic',
      collectiv_total_pot_value REAL DEFAULT 0,
      collectiv_currency TEXT DEFAULT 'GBP',
      collectiv_link TEXT DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS participants (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      discord_id TEXT DEFAULT '',
      has_paid INTEGER DEFAULT 0,
      avatar_url TEXT DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS participant_teams (
      participant_id TEXT NOT NULL,
      team_id TEXT NOT NULL,
      PRIMARY KEY (participant_id, team_id),
      FOREIGN KEY (participant_id) REFERENCES participants(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS matches (
      id TEXT PRIMARY KEY,
      stage TEXT NOT NULL,
      group_name TEXT,
      home_team_id TEXT NOT NULL,
      away_team_id TEXT NOT NULL,
      home_score INTEGER,
      away_score INTEGER,
      is_played INTEGER DEFAULT 0,
      commentary TEXT,
      date TEXT,
      round_index INTEGER DEFAULT 0,
      penalty_winner_id TEXT
    );

    CREATE TABLE IF NOT EXISTS team_stats (
      team_id TEXT PRIMARY KEY,
      played INTEGER DEFAULT 0,
      won INTEGER DEFAULT 0,
      drawn INTEGER DEFAULT 0,
      lost INTEGER DEFAULT 0,
      goals_for INTEGER DEFAULT 0,
      goals_against INTEGER DEFAULT 0,
      goal_difference INTEGER DEFAULT 0,
      points INTEGER DEFAULT 0,
      stage TEXT DEFAULT 'groups'
    );
  `);
}

export function hasExistingState(): boolean {
  const database = getDb();
  const row = database.prepare('SELECT id FROM sweepstake_meta WHERE id = 1').get();
  return !!row;
}

export function loadState(): SweepstakeState {
  const database = getDb();

  const meta = database.prepare('SELECT * FROM sweepstake_meta WHERE id = 1').get() as Record<string, unknown>;

  const participantRows = database.prepare('SELECT * FROM participants').all() as Record<string, unknown>[];
  const teamAssignmentRows = database.prepare('SELECT * FROM participant_teams').all() as Record<string, unknown>[];

  const participants: Participant[] = participantRows.map(row => ({
    id: row.id as string,
    name: row.name as string,
    discordId: (row.discord_id as string) || undefined,
    hasPaid: !!(row.has_paid as number),
    avatarUrl: (row.avatar_url as string) || undefined,
    assignedTeamIds: teamAssignmentRows
      .filter(ta => ta.participant_id === row.id)
      .map(ta => ta.team_id as string),
  }));

  const matchRows = database.prepare('SELECT * FROM matches ORDER BY round_index ASC, id ASC').all() as Record<string, unknown>[];
  const matches: Match[] = matchRows.map(row => ({
    id: row.id as string,
    stage: row.stage as Match['stage'],
    group: (row.group_name as string) || undefined,
    homeTeamId: row.home_team_id as string,
    awayTeamId: row.away_team_id as string,
    homeScore: row.home_score !== null ? (row.home_score as number) : undefined,
    awayScore: row.away_score !== null ? (row.away_score as number) : undefined,
    isPlayed: !!(row.is_played as number),
    commentary: (row.commentary as string) || undefined,
    date: row.date as string,
    roundIndex: row.round_index as number,
    penaltyWinnerId: (row.penalty_winner_id as string) || undefined,
  }));

  const statsRows = database.prepare('SELECT * FROM team_stats').all() as Record<string, unknown>[];
  const stats: Record<string, TeamStats> = {};
  statsRows.forEach(row => {
    stats[row.team_id as string] = {
      teamId: row.team_id as string,
      played: row.played as number,
      won: row.won as number,
      drawn: row.drawn as number,
      lost: row.lost as number,
      goalsFor: row.goals_for as number,
      goalsAgainst: row.goals_against as number,
      goalDifference: row.goal_difference as number,
      points: row.points as number,
      stage: row.stage as TeamStats['stage'],
    };
  });

  return {
    status: meta.status as SweepstakeState['status'],
    participants,
    teams: WORLD_CUP_TEAMS,
    stats,
    matches,
    collectiv: {
      entryFee: meta.collectiv_entry_fee as number,
      potType: meta.collectiv_pot_type as 'fixed' | 'dynamic',
      totalPotValue: meta.collectiv_total_pot_value as number,
      currency: meta.collectiv_currency as string,
      link: meta.collectiv_link as string,
    },
    currentMatchIndex: meta.current_match_index as number,
    winnerTeamId: (meta.winner_team_id as string) || undefined,
    runnerUpTeamId: (meta.runner_up_team_id as string) || undefined,
    worstTeamId: (meta.worst_team_id as string) || undefined,
  };
}

export function saveState(state: SweepstakeState): void {
  const database = getDb();

  const transaction = database.transaction(() => {
    // Upsert sweepstake meta row
    database.prepare(`
      INSERT INTO sweepstake_meta (
        id, status, winner_team_id, runner_up_team_id, worst_team_id,
        current_match_index, collectiv_entry_fee, collectiv_pot_type,
        collectiv_total_pot_value, collectiv_currency, collectiv_link
      ) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        status = excluded.status,
        winner_team_id = excluded.winner_team_id,
        runner_up_team_id = excluded.runner_up_team_id,
        worst_team_id = excluded.worst_team_id,
        current_match_index = excluded.current_match_index,
        collectiv_entry_fee = excluded.collectiv_entry_fee,
        collectiv_pot_type = excluded.collectiv_pot_type,
        collectiv_total_pot_value = excluded.collectiv_total_pot_value,
        collectiv_currency = excluded.collectiv_currency,
        collectiv_link = excluded.collectiv_link
    `).run(
      state.status,
      state.winnerTeamId ?? null,
      state.runnerUpTeamId ?? null,
      state.worstTeamId ?? null,
      state.currentMatchIndex ?? 0,
      state.collectiv.entryFee,
      state.collectiv.potType,
      state.collectiv.totalPotValue,
      state.collectiv.currency,
      state.collectiv.link,
    );

    // Participants - full replace to keep assignment data consistent
    database.prepare('DELETE FROM participant_teams').run();
    database.prepare('DELETE FROM participants').run();

    const insertParticipant = database.prepare(`
      INSERT INTO participants (id, name, discord_id, has_paid, avatar_url)
      VALUES (?, ?, ?, ?, ?)
    `);
    const insertTeamAssignment = database.prepare(`
      INSERT INTO participant_teams (participant_id, team_id) VALUES (?, ?)
    `);

    for (const p of state.participants) {
      insertParticipant.run(p.id, p.name, '', p.hasPaid ? 1 : 0, p.avatarUrl ?? '');
      for (const teamId of p.assignedTeamIds) {
        insertTeamAssignment.run(p.id, teamId);
      }
    }

    // Matches - full replace (new knockout matches get appended as tournament progresses)
    database.prepare('DELETE FROM matches').run();
    const insertMatch = database.prepare(`
      INSERT INTO matches (
        id, stage, group_name, home_team_id, away_team_id,
        home_score, away_score, is_played, commentary, date, round_index, penalty_winner_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const m of state.matches) {
      insertMatch.run(
        m.id,
        m.stage,
        m.group ?? null,
        m.homeTeamId,
        m.awayTeamId,
        m.homeScore !== undefined ? m.homeScore : null,
        m.awayScore !== undefined ? m.awayScore : null,
        m.isPlayed ? 1 : 0,
        m.commentary ?? null,
        m.date,
        m.roundIndex,
        m.penaltyWinnerId ?? null,
      );
    }

    // Team stats - full replace
    database.prepare('DELETE FROM team_stats').run();
    const insertStats = database.prepare(`
      INSERT INTO team_stats (
        team_id, played, won, drawn, lost,
        goals_for, goals_against, goal_difference, points, stage
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const s of Object.values(state.stats)) {
      insertStats.run(
        s.teamId, s.played, s.won, s.drawn, s.lost,
        s.goalsFor, s.goalsAgainst, s.goalDifference, s.points, s.stage,
      );
    }
  });

  transaction();
}
