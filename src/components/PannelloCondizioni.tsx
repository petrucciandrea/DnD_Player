import { useState } from "react";
import { Minus, Plus, ShieldAlert, Sparkles, X } from "lucide-react";
import type { CharacterData, SetChar } from "../tipi";
import type { Derivate } from "../regole";
import {
  aggiungiCondizione, attivaEffetto, cambiaConteggioEffetto, impostaIndebolimento, rimuoviCondizione, rimuoviEffetto,
} from "../regole";
import { CONDIZIONI, EFFETTI, LIVELLI_INDEBOLIMENTO, condizione, effetto } from "../dati/condizioni";

interface Props {
  char: CharacterData;
  d: Derivate;
  setChar: SetChar;
}

const piccolo = "p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-30";

// Condizioni, indebolimento ed effetti attivi (Ira, Scudo, Armatura Magica, Immagine Speculare...).
export default function PannelloCondizioni({ char, d, setChar }: Props) {
  const [nuovo, setNuovo] = useState("");

  // Gli effetti di un privilegio di classe si offrono solo a chi lo ha, e solo se c'è un uso libero.
  const attivabili = EFFETTI.filter(e => !char.effetti.some(x => x.id === e.id) && (!e.classe || e.classe === char.info.classe));
  const senzaUsi = (id: string) => {
    const consuma = effetto(id)?.consuma;
    const r = consuma ? d.risorse.find(x => x.id === consuma) : undefined;
    return !!consuma && (!r || r.rimasti === 0);
  };

  const aggiungi = () => {
    if (!nuovo) return;
    setChar(prev => attivaEffetto(prev, nuovo));
    setNuovo("");
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-4">
      <div>
        <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-rose-400" /> Condizioni
        </h3>
        <div className="flex flex-wrap gap-1.5">
          {CONDIZIONI.map(c => {
            const attiva = char.condizioni.includes(c.id);
            return (
              <button
                key={c.id}
                title={c.descrizione}
                onClick={() => setChar(prev => (attiva ? rimuoviCondizione(prev, c.id) : aggiungiCondizione(prev, c.id)))}
                className={`px-2 py-1 rounded-lg text-xs font-semibold border transition ${
                  attiva
                    ? "bg-rose-500/20 border-rose-500/50 text-rose-200"
                    : "bg-slate-950 border-slate-800 text-slate-500 hover:text-slate-300"
                }`}
              >
                {c.nome}
              </button>
            );
          })}
        </div>

        <div className="flex items-center justify-between gap-2 mt-3">
          <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Indebolimento</span>
          <div className="flex items-center gap-2">
            <button onClick={() => setChar(prev => impostaIndebolimento(prev, prev.indebolimento - 1))} disabled={char.indebolimento <= 0} className={piccolo}>
              <Minus className="w-3 h-3" />
            </button>
            <span className={`w-6 text-center font-mono font-bold ${char.indebolimento > 0 ? "text-amber-300" : "text-slate-500"}`}>{char.indebolimento}</span>
            <button onClick={() => setChar(prev => impostaIndebolimento(prev, prev.indebolimento + 1))} disabled={char.indebolimento >= 6} className={piccolo}>
              <Plus className="w-3 h-3" />
            </button>
          </div>
        </div>

        {(char.condizioni.length > 0 || char.indebolimento > 0) && (
          <ul className="mt-3 space-y-1.5 text-xs text-slate-400">
            {char.condizioni.map(id => condizione(id)).filter(c => c !== undefined).map(c => (
              <li key={c.id}><strong className="text-rose-300">{c.nome}.</strong> {c.descrizione}</li>
            ))}
            {char.indebolimento > 0 && (
              <li>
                <strong className="text-amber-300">Indebolimento {char.indebolimento}.</strong>{" "}
                {LIVELLI_INDEBOLIMENTO.slice(0, char.indebolimento).join("; ")}.
                {char.indebolimento >= 4 && char.indebolimento < 6 && ` PF massimi: ${d.pfMassimiEffettivi}.`}
              </li>
            )}
          </ul>
        )}
      </div>

      <div className="border-t border-slate-800 pt-4">
        <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-indigo-400" /> Effetti attivi
        </h3>
        {char.effetti.length === 0 && <p className="text-xs text-slate-500 mb-2">Nessun effetto attivo.</p>}
        <div className="space-y-2">
          {char.effetti.map(a => {
            const def = effetto(a.id);
            if (!def) return null;
            return (
              <div key={a.id} className="bg-indigo-950/30 border border-indigo-900/50 rounded-lg p-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-indigo-200">
                    {def.nome}
                    {def.conteggio !== undefined && <span className="ml-2 font-mono text-amber-300">×{a.valore ?? def.conteggio}</span>}
                  </span>
                  <div className="flex items-center gap-1">
                    {def.conteggio !== undefined && (
                      <button onClick={() => setChar(prev => cambiaConteggioEffetto(prev, a.id, -1))} title="Un duplicato è stato colpito" className={piccolo}>
                        <Minus className="w-3 h-3" />
                      </button>
                    )}
                    <button onClick={() => setChar(prev => rimuoviEffetto(prev, a.id))} title="Termina l'effetto" className={piccolo}>
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                </div>
                <p className="text-xs text-slate-400 mt-1">{def.descrizione}</p>
                <p className="text-[10px] uppercase tracking-wider text-slate-500 mt-1">Durata: {def.durata}</p>
              </div>
            );
          })}
        </div>
        {attivabili.length > 0 && (
          <div className="flex gap-2 mt-3">
            <select
              value={nuovo}
              onChange={e => setNuovo(e.target.value)}
              className="flex-1 min-w-0 bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-slate-200 outline-none focus:border-indigo-500"
            >
              <option value="">Aggiungi effetto...</option>
              {attivabili.map(e => (
                <option key={e.id} value={e.id} disabled={senzaUsi(e.id)}>
                  {e.nome}{senzaUsi(e.id) ? " (nessun uso rimasto)" : ""}
                </option>
              ))}
            </select>
            <button onClick={aggiungi} disabled={!nuovo} className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-xs font-semibold">
              Attiva
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
