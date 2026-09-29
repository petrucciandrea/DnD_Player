import { useEffect, useState, type FormEvent } from "react";
import { Dices, X } from "lucide-react";
import type { Dado, RichiestaTiro, RispostaTiro } from "../tiroDadi";
import type { Modalita } from "../regole";
import { segno, tiraD } from "../regole";

interface Props {
  richiesta: RichiestaTiro;
  onRisposta: (risposta: RispostaTiro | null) => void;
}

const MODALITA: { id: Modalita; label: string }[] = [
  { id: "normale", label: "Normale" },
  { id: "vantaggio", label: "Vantaggio" },
  { id: "svantaggio", label: "Svantaggio" },
];

export default function DialogoTiro({ richiesta, onRisposta }: Props) {
  const [modalita, setModalita] = useState<Modalita>(richiesta.modalita ?? "normale");
  const [valori, setValori] = useState<string[]>([]);
  const [totale, setTotale] = useState("");
  const [errore, setErrore] = useState<string | null>(null);
  const { bonus = 0 } = richiesta;

  // Con vantaggio o svantaggio si tirano due d20.
  const dadi: Dado[] = richiesta.d20 && modalita !== "normale"
    ? [{ etichetta: "Primo d20", facce: 20 }, { etichetta: "Secondo d20", facce: 20 }]
    : richiesta.dadi;
  // Con più dadi si può inserire solo la somma (per i danni, dove conta solo il totale).
  const ammettiTotale = !!richiesta.ammettiTotale && dadi.length > 1;
  const minTotale = dadi.length;
  const maxTotale = dadi.reduce((acc, d) => acc + d.facce, 0);

  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onRisposta(null);
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onRisposta]);

  const confermaManuale = (e: FormEvent) => {
    e.preventDefault();
    if (ammettiTotale && totale.trim() !== "") {
      const t = Number(totale);
      if (!Number.isInteger(t) || t < minTotale || t > maxTotale) {
        setErrore(`Totale: inserisci un numero da ${minTotale} a ${maxTotale}.`);
        return;
      }
      onRisposta({ tiri: [t], modalita });
      return;
    }
    const numeri = dadi.map((_, i) => Number(valori[i] ?? ""));
    const invalido = dadi.findIndex((dado, i) => !Number.isInteger(numeri[i]) || numeri[i] < 1 || numeri[i] > dado.facce);
    if (invalido >= 0) {
      setErrore(`${dadi[invalido].etichetta}: inserisci un numero da 1 a ${dadi[invalido].facce}.`);
      return;
    }
    onRisposta({ tiri: numeri, modalita });
  };

  const tiraApp = () => onRisposta({ tiri: dadi.map(dado => tiraD(dado.facce)), modalita });

  const campo = "w-20 bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-center font-mono text-slate-100 outline-none focus:border-indigo-500";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4"
      onClick={() => onRisposta(null)}
    >
      <form
        noValidate
        onSubmit={confermaManuale}
        onClick={e => e.stopPropagation()}
        className="w-full max-w-sm max-h-[90vh] overflow-y-auto bg-slate-900 border border-slate-700 rounded-2xl p-5 shadow-2xl space-y-4"
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

        {richiesta.d20 && (
          <div className="grid grid-cols-3 gap-1 p-1 bg-slate-950 rounded-xl border border-slate-800">
            {MODALITA.map(m => (
              <button
                key={m.id}
                type="button"
                onClick={() => { setModalita(m.id); setErrore(null); }}
                className={`py-1.5 rounded-lg text-xs font-semibold transition ${
                  modalita === m.id
                    ? m.id === "vantaggio" ? "bg-emerald-600 text-white" : m.id === "svantaggio" ? "bg-rose-600 text-white" : "bg-slate-700 text-white"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        )}

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
            <label key={`${modalita}-${i}`} className="flex items-center justify-between gap-3 text-sm text-slate-300">
              <span>{dado.etichetta} <span className="text-xs text-slate-500">(d{dado.facce})</span></span>
              <input
                type="number"
                min={1}
                max={dado.facce}
                autoFocus={i === 0}
                value={valori[i] ?? ""}
                onChange={e => {
                  const copia = [...valori];
                  copia[i] = e.target.value;
                  setValori(copia);
                  setTotale("");
                  setErrore(null);
                }}
                className={campo}
              />
            </label>
          ))}
          {ammettiTotale && (
            <label className="flex items-center justify-between gap-3 text-sm text-slate-300 pt-2 border-t border-slate-800">
              <span>oppure solo il totale <span className="text-xs text-slate-500">({minTotale}–{maxTotale})</span></span>
              <input
                type="number"
                min={minTotale}
                max={maxTotale}
                value={totale}
                onChange={e => { setTotale(e.target.value); setErrore(null); }}
                className={campo}
              />
            </label>
          )}
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
