import { useEffect, useState, type FormEvent } from "react";
import { Dices, X } from "lucide-react";
import type { RichiestaTiro } from "../tiroDadi";
import { segno, tiraD } from "../regole";

interface Props {
  richiesta: RichiestaTiro;
  onRisposta: (risultati: number[] | null) => void;
}

export default function DialogoTiro({ richiesta, onRisposta }: Props) {
  const [valori, setValori] = useState<string[]>(() => richiesta.dadi.map(() => ""));
  const [errore, setErrore] = useState<string | null>(null);
  const { dadi, bonus = 0 } = richiesta;

  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onRisposta(null);
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onRisposta]);

  const confermaManuale = (e: FormEvent) => {
    e.preventDefault();
    const numeri = valori.map(v => Number(v));
    const invalido = dadi.findIndex((dado, i) => !Number.isInteger(numeri[i]) || numeri[i] < 1 || numeri[i] > dado.facce);
    if (invalido >= 0) {
      setErrore(`${dadi[invalido].etichetta}: inserisci un numero da 1 a ${dadi[invalido].facce}.`);
      return;
    }
    onRisposta(numeri);
  };

  const tiraApp = () => onRisposta(dadi.map(dado => tiraD(dado.facce)));

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4"
      onClick={() => onRisposta(null)}
    >
      <form
        noValidate
        onSubmit={confermaManuale}
        onClick={e => e.stopPropagation()}
        className="w-full max-w-sm bg-slate-900 border border-slate-700 rounded-2xl p-5 shadow-2xl space-y-4"
      >
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
              <Dices className="w-5 h-5 text-amber-400" /> {richiesta.titolo}
            </h2>
            {richiesta.descrizione && <p className="text-xs text-slate-400 mt-1">{richiesta.descrizione}</p>}
          </div>
          <button type="button" onClick={() => onRisposta(null)} title="Annulla" className="text-slate-500 hover:text-slate-200 p-1">
            <X className="w-4 h-4" />
          </button>
        </div>

        <button
          type="button"
          onClick={tiraApp}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold"
        >
          <Dices className="w-4 h-4" /> Tira l'app
        </button>

        <div className="flex items-center gap-3 text-[11px] uppercase tracking-wider text-slate-500">
          <span className="flex-1 border-t border-slate-800" /> oppure inserisci i tuoi dadi <span className="flex-1 border-t border-slate-800" />
        </div>

        <div className="space-y-2">
          {dadi.map((dado, i) => (
            <label key={i} className="flex items-center justify-between gap-3 text-sm text-slate-300">
              <span>{dado.etichetta} <span className="text-xs text-slate-500">(d{dado.facce})</span></span>
              <input
                type="number"
                min={1}
                max={dado.facce}
                autoFocus={i === 0}
                value={valori[i]}
                onChange={e => {
                  const copia = [...valori];
                  copia[i] = e.target.value;
                  setValori(copia);
                  setErrore(null);
                }}
                className="w-20 bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-center font-mono text-slate-100 outline-none focus:border-indigo-500"
              />
            </label>
          ))}
          {bonus !== 0 && (
            <p className="text-xs text-slate-500">Il modificatore {segno(bonus)} viene aggiunto automaticamente.</p>
          )}
          {errore && <p className="text-xs text-rose-400">{errore}</p>}
        </div>

        <button
          type="submit"
          className="w-full px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-sm font-semibold"
        >
          Usa i miei risultati
        </button>
      </form>
    </div>
  );
}
