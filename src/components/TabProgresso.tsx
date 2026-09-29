import { useState, type FormEvent } from "react";
import { Plus, Trash2, ArrowUpCircle } from "lucide-react";
import type { CharacterData, SetChar, XPRecord } from "../tipi";
import type { Derivate } from "../regole";
import { haAumentoCaratteristiche, modificatore, saliDiLivello } from "../regole";

interface Props {
  char: CharacterData;
  d: Derivate;
  setChar: SetChar;
}

export default function TabProgresso({ char, d, setChar }: Props) {
  const [newXpInput, setNewXpInput] = useState({ valore: "", motivo: "" });
  const livello = char.info.livello;

  const aggiungiXp = (e: FormEvent) => {
    e.preventDefault();
    const val = parseInt(newXpInput.valore);
    if (!val || val <= 0) return;
    const record: XPRecord = {
      id: Date.now(),
      data: new Date().toLocaleDateString("it-IT"),
      valore: val,
      motivo: newXpInput.motivo.trim() || "Guadagno generico",
    };
    setChar(prev => ({
      ...prev,
      xp: { totale: prev.xp.totale + val, storico: [record, ...prev.xp.storico] },
    }));
    setNewXpInput({ valore: "", motivo: "" });
  };

  const rimuoviXp = (r: XPRecord) => {
    if (!confirm(`Rimuovere +${r.valore} XP (${r.motivo})?`)) return;
    setChar(prev => ({
      ...prev,
      xp: { totale: Math.max(0, prev.xp.totale - r.valore), storico: prev.xp.storico.filter(x => x.id !== r.id) },
    }));
  };

  const sali = () => {
    const pf = Math.max(1, 4 + modificatore(char.caratteristiche.COS.valore));
    const nuovo = livello + 1;
    const note = [
      `+${pf} PF massimi e +1 Dado Vita.`,
      "Aggiungi 2 incantesimi al grimorio (tab Grimorio).",
      haAumentoCaratteristiche(nuovo) && "Aumento dei punteggi di caratteristica: usa \"Modifica\" nella tab Statistiche.",
      nuovo === 4 || nuovo === 10 ? "Puoi imparare un nuovo trucchetto." : null,
    ].filter(Boolean);
    if (!confirm(`Salire al livello ${nuovo}?\n\n${note.join("\n")}`)) return;
    setChar(saliDiLivello);
  };

  const soglia = d.prossimaSoglia;

  return (
    <div className="space-y-6">
      <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl">
        <div className="flex flex-wrap justify-between items-center gap-2 mb-2">
          <div>
            <h3 className="text-base font-bold text-slate-200">
              {soglia === null ? "Livello massimo raggiunto" : `Avanzamento a Livello ${livello + 1}`}
            </h3>
            {soglia !== null && (
              <p className="text-xs text-slate-400">Soglia successiva: {soglia.toLocaleString("it-IT")} XP ufficiali D&D 5e</p>
            )}
          </div>
          <div className="text-2xl font-black text-indigo-400">
            {char.xp.totale.toLocaleString("it-IT")}{soglia !== null && ` / ${soglia.toLocaleString("it-IT")}`} XP
          </div>
        </div>
        {soglia !== null && (
          <div className="w-full bg-slate-950 rounded-full h-3 overflow-hidden mt-3">
            <div
              className={`h-full transition-all ${d.puoSalire ? "bg-emerald-500" : "bg-indigo-500"}`}
              style={{ width: `${Math.min(100, (char.xp.totale / soglia) * 100)}%` }}
            />
          </div>
        )}
        {d.puoSalire && (
          <button
            onClick={sali}
            className="mt-4 flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold"
          >
            <ArrowUpCircle className="w-4 h-4" /> Sali al livello {livello + 1}
          </button>
        )}
      </div>

      <form onSubmit={aggiungiXp} className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex flex-wrap gap-2">
        <input
          type="number"
          min={1}
          placeholder="XP Guadagnati..."
          value={newXpInput.valore}
          onChange={e => setNewXpInput(prev => ({ ...prev, valore: e.target.value }))}
          className="w-36 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 outline-none focus:border-indigo-500"
        />
        <input
          type="text"
          placeholder="Motivo / Sessione..."
          value={newXpInput.motivo}
          onChange={e => setNewXpInput(prev => ({ ...prev, motivo: e.target.value }))}
          className="flex-1 min-w-40 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 outline-none focus:border-indigo-500"
        />
        <button type="submit" className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-semibold flex items-center gap-1">
          <Plus className="w-4 h-4" /> Registra XP
        </button>
      </form>

      <div className="bg-slate-900 border border-slate-800 rounded-xl divide-y divide-slate-800/60">
        {char.xp.storico.map(entry => (
          <div key={entry.id} className="group p-3 flex justify-between items-center gap-2 text-sm">
            <div>
              <span className="font-semibold text-slate-200">+{entry.valore} XP</span>
              <span className="text-xs text-slate-500 ml-2">({entry.motivo})</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">{entry.data}</span>
              <button
                onClick={() => rimuoviXp(entry)}
                title="Rimuovi voce"
                className="text-slate-600 hover:text-rose-400 p-1 sm:opacity-0 sm:group-hover:opacity-100 transition"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
