import { useState } from "react";
import type { Danni, DannoExtra } from "../regole";
import { dannoCritico, dannoPunizione, testoDanni } from "../regole";

export interface OpzioneDanno {
  etichetta: string;
  danni: Danni;
}

interface Props {
  opzioni: OpzioneDanno[]; // una mano / due mani
  extra: DannoExtra[]; // Attacco Furtivo, Punizione Divina...
  critico: boolean;
  dadiCriticoBrutale: number;
  vantaggio: boolean; // il tiro per colpire aveva vantaggio: l'Attacco Furtivo è preselezionato
  slotDisponibili: number[]; // livelli di slot liberi per la Punizione Divina
  onTira: (etichetta: string, parti: Danni[], slotSpeso: number | null) => void;
}

// Dopo un tiro per colpire: i danni extra da applicare e i pulsanti per tirare i danni.
export default function OpzioniDanno({ opzioni, extra, critico, dadiCriticoBrutale, vantaggio, slotDisponibili, onTira }: Props) {
  const [scelti, setScelti] = useState<string[]>(() => (vantaggio ? extra.filter(e => e.id === "attacco-furtivo").map(e => e.id) : []));
  const [slot, setSlot] = useState(slotDisponibili[0] ?? 1);
  const [controImmondi, setControImmondi] = useState(false);

  const facoltativi = extra.filter(e => e.facoltativa);
  const scelto = (e: DannoExtra) => !e.facoltativa || scelti.includes(e.id);
  const inverti = (id: string) => setScelti(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));
  const puntaSlot = extra.some(e => e.slot && scelto(e));

  const parti = (base: Danni): Danni[] => {
    const tutte = [base, ...extra.filter(scelto).map(e => (e.slot ? dannoPunizione(slot, controImmondi) : e.danni))];
    return critico ? dannoCritico(tutte, dadiCriticoBrutale) : tutte;
  };

  return (
    <div className="mt-2 flex flex-col gap-1.5">
      {facoltativi.length > 0 && (
        <div className="p-2 rounded-lg border border-slate-800 bg-slate-950/60 space-y-1.5 text-xs text-slate-300">
          {facoltativi.map(e => (
            <div key={e.id} className="space-y-1">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={scelti.includes(e.id)} onChange={() => inverti(e.id)} className="accent-indigo-500" />
                <span className="font-semibold">{e.etichetta}</span>
                {!e.slot && <span className="font-mono text-slate-400">+{testoDanni(e.danni)}</span>}
              </label>
              {e.nota && <p className="pl-6 text-[11px] text-slate-500">{e.nota}</p>}
              {e.slot && scelti.includes(e.id) && (
                <div className="pl-6 flex flex-wrap items-center gap-3">
                  <label className="flex items-center gap-1.5">
                    Slot
                    <select
                      value={slot}
                      onChange={ev => setSlot(Number(ev.target.value))}
                      className="bg-slate-900 border border-slate-800 rounded px-1.5 py-0.5 text-xs text-slate-200 outline-none focus:border-indigo-500"
                    >
                      {slotDisponibili.map(l => <option key={l} value={l}>{l}°</option>)}
                    </select>
                  </label>
                  <label className="flex items-center gap-1.5">
                    <input type="checkbox" checked={controImmondi} onChange={ev => setControImmondi(ev.target.checked)} className="accent-indigo-500" />
                    Immondo o non morto
                  </label>
                  <span className="font-mono text-slate-400">+{testoDanni(dannoPunizione(slot, controImmondi))}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {opzioni.map(o => (
        <button
          key={o.etichetta}
          onClick={() => onTira(o.etichetta, parti(o.danni), puntaSlot ? slot : null)}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold border text-left transition ${
            critico
              ? "bg-amber-500/20 border-amber-500/40 text-amber-200 hover:bg-amber-500/30"
              : "bg-slate-950 border-slate-800 text-slate-300 hover:border-indigo-500/50"
          }`}
        >
          {critico ? "Danni critici" : "Danni"}{o.etichetta.includes("(") && ` ${o.etichetta.slice(o.etichetta.indexOf("("))}`}:{" "}
          <span className="font-mono">{testoDanni(parti(o.danni))}</span>
        </button>
      ))}
    </div>
  );
}
