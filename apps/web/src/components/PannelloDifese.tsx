import { useState } from "react";
import { Plus, ShieldHalf, X } from "lucide-react";
import type { CharacterData, TipoDifesa } from "@dnd/regole/tipi.ts";
import type { SetChar } from "../stato.ts";
import type { Derivate } from "@dnd/regole/regole.ts";
import { TIPI_DANNO, TIPI_DIFESA, nomeTipoDanno, nomeTipoDifesa, testoDifesa, type TipoDanno } from "@dnd/regole/dati/danni.ts";

interface Props {
  char: CharacterData;
  d: Derivate;
  setChar: SetChar;
}

const campo = "bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-xs text-slate-200 outline-none focus:border-indigo-500";
const COLORI: Record<TipoDifesa, string> = {
  resistenza: "text-sky-300",
  immunita: "text-emerald-300",
  vulnerabilita: "text-rose-300",
};

// Resistenze, immunità e vulnerabilità: quelle derivate (razza, classe, condizioni, effetti) in sola lettura,
// quelle personali (oggetti magici, talenti...) si aggiungono e si tolgono qui.
export default function PannelloDifese({ char, d, setChar }: Props) {
  const [tipo, setTipo] = useState<TipoDifesa>("resistenza");
  const [danno, setDanno] = useState<TipoDanno | "">("");
  const [nota, setNota] = useState("");

  const derivate = d.difese.filter(x => !x.personale);
  const giaPresente = danno !== "" && char.difese.some(x => x.tipo === tipo && x.danno === danno);

  const aggiungi = () => {
    if (danno === "" || giaPresente) return;
    setChar(prev => ({ ...prev, difese: [...prev.difese, { tipo, danno, nota: nota.trim() }] }));
    setDanno("");
    setNota("");
  };

  const togli = (i: number) => {
    const x = char.difese[i];
    if (!confirm(`Togliere ${nomeTipoDifesa(x.tipo).toLowerCase()} a ${nomeTipoDanno(x.danno).toLowerCase()}?`)) return;
    setChar(prev => ({ ...prev, difese: prev.difese.filter((_, j) => j !== i) }));
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
      <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
        <ShieldHalf className="w-4 h-4 text-sky-400" /> Resistenze e immunità
      </h3>

      {d.difese.length === 0 && <p className="text-xs text-slate-500">Nessuna resistenza, immunità o vulnerabilità.</p>}

      {derivate.length > 0 && (
        <ul className="space-y-1">
          {derivate.map((x, i) => (
            <li key={i} className="text-xs flex justify-between gap-2">
              <span className={COLORI[x.tipo]}>{testoDifesa(x)}</span>
              <span className="text-slate-500 text-right">{x.fonte}</span>
            </li>
          ))}
        </ul>
      )}

      {char.difese.length > 0 && (
        <ul className="space-y-1">
          {char.difese.map((x, i) => (
            <li key={`${x.tipo}-${x.danno}`} className="text-xs flex items-center justify-between gap-2">
              <span className={COLORI[x.tipo]}>{nomeTipoDifesa(x.tipo)}: {nomeTipoDanno(x.danno).toLowerCase()}</span>
              <span className="flex items-center gap-1 text-slate-500">
                {x.nota || "Personale"}
                <button onClick={() => togli(i)} title="Togli" className="p-0.5 rounded hover:bg-slate-800 hover:text-rose-300">
                  <X className="w-3.5 h-3.5" />
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-slate-800">
        <select value={tipo} onChange={e => setTipo(e.target.value as TipoDifesa)} className={campo}>
          {TIPI_DIFESA.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
        </select>
        <select value={danno} onChange={e => setDanno(e.target.value as TipoDanno | "")} className={campo}>
          <option value="">Danno…</option>
          {TIPI_DANNO.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
        </select>
        <input
          value={nota}
          onChange={e => setNota(e.target.value)}
          onKeyDown={e => e.key === "Enter" && aggiungi()}
          placeholder="Fonte (es. anello)"
          className={`${campo} flex-1 min-w-24`}
        />
        <button onClick={aggiungi} disabled={danno === "" || giaPresente} title="Aggiungi"
          className="p-1.5 rounded bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-30">
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
