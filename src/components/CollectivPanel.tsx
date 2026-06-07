import React, { useState } from 'react';
import { SweepstakeState } from '../types';
import { Link, Copy, Check, PiggyBank, Award, Users } from 'lucide-react';

interface CollectivPanelProps {
  state: SweepstakeState;
  onTogglePayment: (id: string, currentStatus: boolean) => void;
}

export const CollectivPanel: React.FC<CollectivPanelProps> = ({ state, onTogglePayment }) => {
  const { collectiv, participants } = state;
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(collectiv.link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatMoney = (val: number) => {
    const symbolMap: Record<string, string> = { USD: '$', GBP: '£', EUR: '€', CAD: 'CA$', AUD: 'AU$' };
    const sym = symbolMap[collectiv.currency] || '£';
    return `${sym}${val.toFixed(2)}`;
  };

  const totalPotValue = participants.length * collectiv.entryFee;
  const winnerPayout = totalPotValue * 0.60;
  const runnerUpPayout = totalPotValue * 0.25;
  const woodenSpoonPayout = totalPotValue * 0.15;
  const paidCount = participants.filter(p => p.hasPaid).length;

  return (
    <div className="space-y-5">

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-[#161b22] border border-white/5 rounded-2xl p-4 text-center">
          <div className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold mb-1">Entry Fee</div>
          <div className="text-2xl font-display font-black text-white">{formatMoney(collectiv.entryFee)}</div>
        </div>
        <div className="bg-[#161b22] border border-white/5 rounded-2xl p-4 text-center">
          <div className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold mb-1">Players</div>
          <div className="text-2xl font-display font-black text-white">{participants.length}</div>
        </div>
        <div className="bg-[#161b22] border border-amber-900/20 rounded-2xl p-4 text-center">
          <div className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold mb-1">Total Pot</div>
          <div className="text-2xl font-display font-black text-amber-400">{formatMoney(totalPotValue)}</div>
        </div>
        <div className="bg-[#161b22] border border-green-900/20 rounded-2xl p-4 text-center">
          <div className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold mb-1">Collected</div>
          <div className="text-2xl font-display font-black text-green-400">{formatMoney(paidCount * collectiv.entryFee)}</div>
          <div className="text-[10px] text-slate-500 mt-0.5">{paidCount} of {participants.length} paid</div>
        </div>
      </div>

      {/* Prize breakdown */}
      <div className="bg-[#161b22] border border-white/5 rounded-2xl p-6">
        <h3 className="text-lg font-display font-black text-white mb-5 flex items-center gap-2">
          <Award className="h-5 w-5 text-amber-400" />
          Prize Breakdown
        </h3>
        <div className="space-y-3">
          <div className="flex justify-between items-center bg-[#1a1100] border border-amber-900/30 p-4 rounded-xl">
            <div className="flex items-center gap-3">
              <div className="text-2xl">🥇</div>
              <div>
                <span className="text-slate-200 font-display font-bold text-sm">Winner (60%)</span>
                <p className="text-xs text-slate-500 mt-0.5">Player who owns the World Cup winning team</p>
              </div>
            </div>
            <span className="text-xl font-display font-black text-amber-300 shrink-0">{formatMoney(winnerPayout)}</span>
          </div>

          <div className="flex justify-between items-center bg-[#161b22] border border-white/5 p-4 rounded-xl">
            <div className="flex items-center gap-3">
              <div className="text-2xl">🥈</div>
              <div>
                <span className="text-slate-200 font-display font-bold text-sm">Runner-Up (25%)</span>
                <p className="text-xs text-slate-500 mt-0.5">Player who owns the losing finalist team</p>
              </div>
            </div>
            <span className="text-xl font-display font-black text-slate-300 shrink-0">{formatMoney(runnerUpPayout)}</span>
          </div>

          <div className="flex justify-between items-center bg-[#130808] border border-rose-900/30 p-4 rounded-xl">
            <div className="flex items-center gap-3">
              <div className="text-2xl">🥄</div>
              <div>
                <span className="text-slate-200 font-display font-bold text-sm">Wooden Spoon (15%)</span>
                <p className="text-xs text-slate-500 mt-0.5">Worst group-stage-only team by points and goal difference</p>
              </div>
            </div>
            <span className="text-xl font-display font-black text-rose-400 shrink-0">{formatMoney(woodenSpoonPayout)}</span>
          </div>
        </div>
      </div>

      {/* Payment link */}
      {collectiv.link && (
        <div className="bg-[#161b22] border border-white/5 rounded-2xl p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="space-y-1 min-w-0">
            <span className="text-[10px] uppercase font-display font-bold text-green-400 tracking-widest">Pay your entry fee</span>
            <p className="text-sm font-display font-bold text-white flex items-center gap-2">
              <PiggyBank className="h-4 w-4 text-green-500" />
              Collectiv Payment Link
            </p>
            <p className="text-xs text-slate-400 font-mono select-all truncate bg-black/40 px-3 py-1.5 rounded-lg border border-white/8">
              {collectiv.link}
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <button
              onClick={handleCopy}
              className="bg-white/8 hover:bg-white/12 border border-white/10 text-slate-200 px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
            >
              {copied ? <Check className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
              {copied ? 'Copied!' : 'Copy Link'}
            </button>
            <a
              href={collectiv.link}
              target="_blank"
              rel="noreferrer noopener"
              className="bg-green-700 hover:bg-green-600 text-white font-display font-bold px-4 py-2 rounded-xl text-sm flex items-center gap-1.5 transition-all"
            >
              <Link className="h-4 w-4" />
              Pay Now
            </a>
          </div>
        </div>
      )}

      {/* Payment tracker */}
      <div className="bg-[#161b22] border border-white/5 rounded-2xl p-5">
        <h3 className="text-base font-display font-black text-white mb-4 flex items-center gap-2">
          <Users className="h-4 w-4 text-green-400" />
          Payment Tracker
          <span className="ml-auto text-xs font-semibold text-slate-500">{paidCount}/{participants.length} paid</span>
        </h3>
        {participants.length === 0 ? (
          <p className="text-sm text-slate-500 text-center py-4">No players added yet</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {participants.map(p => (
              <div key={p.id} className={`flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl border transition-all ${
                p.hasPaid ? 'bg-green-950/20 border-green-900/30' : 'bg-black/20 border-white/5'
              }`}>
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`h-2 w-2 rounded-full shrink-0 ${p.hasPaid ? 'bg-green-400' : 'bg-rose-400'}`} />
                  <span className="text-sm font-display font-bold text-white truncate">{p.name}</span>
                </div>
                <button
                  onClick={() => onTogglePayment(p.id, p.hasPaid)}
                  className={`text-xs font-display font-bold px-3 py-1 rounded-lg transition-all shrink-0 cursor-pointer ${
                    p.hasPaid
                      ? 'bg-green-800/40 text-green-300 hover:bg-rose-900/40 hover:text-rose-300'
                      : 'bg-white/5 text-slate-400 hover:bg-green-800/40 hover:text-green-300'
                  }`}
                >
                  {p.hasPaid ? `${formatMoney(collectiv.entryFee)} Paid` : 'Unpaid'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
