import { useState } from "react";
import { Zap } from "lucide-react";
import type { SetChar } from "../tipi";
import type { Derivate } from "../regole";
import { usaRisorsa } from "../regole";
import type { RisorsaDerivata } from "../dati/risorse";

interface Props {
  d: Derivate;
  setChar: SetChar;
}

const RICARICA = { breve: "riposo breve", lunga: "riposo lungo" };
const MAX_PALLINI = 12;

// Risorse con usi limitati: Ira, Ki, Incanalare Divinità... Un pallino pieno è un uso disponibile.
export default function PannelloRisorse({ d, setChar }: Props) {
  if (d.risorse.length === 0) return null;
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
      <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-3 flex items-center gap-2">
        <Zap className="w-4 h-4 text-amber-400" /> Risorse di classe
      </h3>
      <div className="space-y-3">
        {d.risorse.map(r => <Risorsa key={r.id} risorsa={r} setChar={setChar} />)}
      </div>
    </div>
  );
}

function Risorsa({ risorsa: r, setChar }: { risorsa: RisorsaDerivata; setChar: SetChar }) {
  const [quantita, setQuantita] = useState("1");
  const cambia = (n: number) => setChar(prev => usaRisorsa(prev, r.id, n));
  const n = Math.max(1, parseInt(quantita) || 1);
  const finita = r.rimasti === 0;

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-x-2">
        <span className={`text-sm font-semibold ${finita ? "text-slate-500" : "text-slate-200"}`}>{r.nome}</span>
        <span className="text-[10px] uppercase tracking-wider text-slate-500">{RICARICA[r.ricarica]}</span>
      </div>
      {r.max === null ? (
        <p className="text-xs text-emerald-400">Usi illimitati</p>
      ) : r.max <= MAX_PALLINI ? (
        <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
          {Array.from({ length: r.max }, (_, i) => {
            const disponibile = i < (r.rimasti ?? 0);
            return (
              <button
                key={i}
                onClick={() => cambia(disponibile ? 1 : -1)}
                title={disponibile ? "Spendi un uso" : "Recupera un uso"}
                aria-label={disponibile ? "Spendi un uso" : "Recupera un uso"}
                className={`w-5 h-5 rounded-full border-2 transition ${
                  disponibile ? "bg-amber-400 border-amber-300 hover:bg-amber-300" : "border-slate-600 hover:border-slate-400"
                }`}
              />
            );
          })}
          {r.nota && <span className="text-xs text-slate-400 ml-1">{r.nota}</span>}
        </div>
      ) : (
        <div className="mt-1.5 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-lg font-black font-mono text-amber-300">{r.rimasti}</span>
            <span className="text-xs text-slate-500">/ {r.max} {r.unita ?? "usi"}</span>
            <input
              type="number"
              min={1}
              value={quantita}
              onChange={e => setQuantita(e.target.value)}
              className="w-14 bg-slate-950 border border-slate-800 rounded px-1 py-0.5 text-xs text-center text-slate-200 outline-none focus:border-indigo-500"
            />
            <button onClick={() => cambia(n)} className="px-2 py-0.5 text-xs bg-amber-950 hover:bg-amber-900 text-amber-300 rounded">Spendi</button>
            <button onClick={() => cambia(-n)} className="px-2 py-0.5 text-xs bg-emerald-950 hover:bg-emerald-900 text-emerald-300 rounded">Recupera</button>
          </div>
          {r.nota && <p className="text-xs text-slate-400">{r.nota}</p>}
        </div>
      )}
    </div>
  );
}
