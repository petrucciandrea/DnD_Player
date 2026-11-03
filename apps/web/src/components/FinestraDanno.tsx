import { useState } from "react";
import { Plus, ShieldHalf, Swords, Trash2, X } from "lucide-react";
import type { Derivate } from "@dnd/regole/regole.ts";
import { FISICI, TIPI_DANNO, calcolaDanno, type TipoDanno } from "@dnd/regole/dati/danni.ts";

interface Props {
  d: Derivate;
  quantitaIniziale: number;
  onApplica: (totale: number, riepilogo: string) => void;
  onAnnulla: () => void;
}

interface Riga {
  quantita: string;
  tipo: TipoDanno | "";
}

const campo = "bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-sm text-slate-200 outline-none focus:border-indigo-500";
const casella = "flex items-center gap-2 text-sm text-slate-300 cursor-pointer";

// Danno subito: quantità e tipo di ogni parte; resistenze, immunità e vulnerabilità si applicano da sole.
export default function FinestraDanno({ d, quantitaIniziale, onApplica, onAnnulla }: Props) {
  const [righe, setRighe] = useState<Riga[]>([{ quantita: quantitaIniziale > 0 ? String(quantitaIniziale) : "", tipo: "" }]);
  const [magico, setMagico] = useState(false);
  const [incantesimo, setIncantesimo] = useState(false);
  const [schivata, setSchivata] = useState(false);

  // Esito di ogni riga (null finché manca il tipo): ogni parte si calcola da sola.
  const esitiRighe = righe.map(r => (r.tipo
    ? calcolaDanno(d.difese, [{ quantita: parseInt(r.quantita) || 0, tipo: r.tipo, magico, incantesimo }], { dimezza: schivata }).parti[0]
    : null));
  const totale = esitiRighe.reduce((acc, e) => acc + (e?.finale ?? 0), 0);
  const note = esitiRighe.flatMap(e => e?.note ?? []);
  const completo = righe.every(r => r.tipo !== "" && (parseInt(r.quantita) || 0) > 0);

  // Le caselle compaiono solo se qualche difesa del personaggio ne dipende.
  const chiedeMagico = d.difese.some(x => x.soloNonMagiche) && righe.some(r => r.tipo !== "" && FISICI.includes(r.tipo));
  const chiedeIncantesimo = d.difese.some(x => x.soloIncantesimi || x.soloNonMagiche);

  const cambia = (i: number, modifica: Partial<Riga>) =>
    setRighe(prev => prev.map((r, j) => (j === i ? { ...r, ...modifica } : r)));

  const applica = () => {
    if (!completo) return;
    const dettaglio = righe.map((r, i) => `${esitiRighe[i]?.finale ?? 0} ${r.tipo}`).join(" + ");
    const riepilogo = note.length > 0
      ? `Danni subiti: ${totale} (${dettaglio}). ${note.join("; ")}.`
      : `Danni subiti: ${totale} (${dettaglio}).`;
    onApplica(totale, riepilogo);
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-md max-h-[90vh] overflow-y-auto bg-slate-900 border border-slate-700 rounded-2xl p-5 shadow-2xl space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            <Swords className="w-5 h-5 text-rose-400" /> Danno subito
          </h2>
          <button onClick={onAnnulla} title="Annulla" className="text-slate-500 hover:text-slate-200 p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-2">
          {righe.map((r, i) => {
            const e = esitiRighe[i];
            return (
              <div key={i} className="space-y-1">
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    autoFocus={i === 0}
                    placeholder="0"
                    value={r.quantita}
                    onChange={ev => cambia(i, { quantita: ev.target.value })}
                    onKeyDown={ev => ev.key === "Enter" && applica()}
                    className={`${campo} w-20 text-center`}
                  />
                  <select
                    value={r.tipo}
                    onChange={ev => cambia(i, { tipo: ev.target.value as TipoDanno | "" })}
                    className={`${campo} flex-1 ${r.tipo === "" ? "text-slate-500" : ""}`}
                  >
                    <option value="">Tipo di danno…</option>
                    {TIPI_DANNO.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
                  </select>
                  {righe.length > 1 && (
                    <button onClick={() => setRighe(prev => prev.filter((_, j) => j !== i))} title="Togli questa parte"
                      className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-400">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
                {e && e.note.length > 0 && (
                  <div className="text-xs text-amber-300 pl-1">{e.note.join(" · ")}</div>
                )}
              </div>
            );
          })}
          <button onClick={() => setRighe(prev => [...prev, { quantita: "", tipo: "" }])}
            className="flex items-center gap-1 text-xs text-indigo-300 hover:text-indigo-200">
            <Plus className="w-3.5 h-3.5" /> Aggiungi un altro tipo di danno
          </button>
        </div>

        {(chiedeMagico || chiedeIncantesimo || d.schivataProdigiosa) && (
          <div className="space-y-2 bg-slate-950/60 border border-slate-800 rounded-xl p-3">
            {chiedeIncantesimo && (
              <label className={casella}>
                <input type="checkbox" checked={incantesimo} onChange={ev => setIncantesimo(ev.target.checked)} />
                Danno di un incantesimo
              </label>
            )}
            {chiedeMagico && (
              <label className={casella}>
                <input type="checkbox" checked={magico} onChange={ev => setMagico(ev.target.checked)} />
                Attacco con un'arma magica
              </label>
            )}
            {d.schivataProdigiosa && (
              <label className={casella} title="Con una reazione dimezza i danni di un attacco di un nemico che puoi vedere.">
                <input type="checkbox" checked={schivata} onChange={ev => setSchivata(ev.target.checked)} />
                Schivata Prodigiosa (reazione: danni di un attacco dimezzati)
              </label>
            )}
          </div>
        )}

        {d.difese.length > 0 && (
          <div className="text-xs text-slate-500 flex items-start gap-1.5">
            <ShieldHalf className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            Le resistenze, le immunità e le vulnerabilità della scheda si applicano da sole.
          </div>
        )}

        <div className="flex items-center justify-between gap-3 pt-1">
          <div className="text-sm text-slate-400">
            Totale: <strong className="text-xl text-rose-300">{totale}</strong>
          </div>
          <div className="flex gap-2">
            <button onClick={onAnnulla} className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-sm font-semibold">
              Annulla
            </button>
            <button onClick={applica} disabled={!completo}
              className="px-4 py-2 rounded-xl bg-rose-700 hover:bg-rose-600 text-white text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed">
              Applica
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
