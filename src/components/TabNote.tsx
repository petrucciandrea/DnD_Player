import { useState } from "react";
import { Plus, Trash2, Check } from "lucide-react";
import type { CategoriaNota, CharacterData, NotaSessione, SetChar } from "../tipi";

interface Props {
  char: CharacterData;
  setChar: SetChar;
}

const CATEGORIE: { id: CategoriaNota; etichetta: string; colore: string }[] = [
  { id: "sessione", etichetta: "Sessione", colore: "bg-indigo-500/15 text-indigo-300 border-indigo-500/30" },
  { id: "png", etichetta: "PNG", colore: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" },
  { id: "obiettivo", etichetta: "Obiettivo", colore: "bg-amber-500/15 text-amber-300 border-amber-500/30" },
  { id: "altro", etichetta: "Altro", colore: "bg-slate-500/15 text-slate-300 border-slate-500/30" },
];

const campo = "w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 outline-none focus:border-indigo-500";

// Appunti di sessione, personaggi incontrati e obiettivi. Le modifiche si salvano man mano.
export default function TabNote({ char, setChar }: Props) {
  const [filtro, setFiltro] = useState<CategoriaNota | "tutte">("tutte");
  const [categoria, setCategoria] = useState<CategoriaNota>("sessione");

  const aggiorna = (id: number, modifiche: Partial<NotaSessione>) =>
    setChar(prev => ({ ...prev, note: prev.note.map(n => (n.id === id ? { ...n, ...modifiche } : n)) }));

  const aggiungi = () => {
    const nota: NotaSessione = {
      id: Date.now(), data: new Date().toLocaleDateString("it-IT"), categoria, titolo: "", testo: "", fatto: false,
    };
    setChar(prev => ({ ...prev, note: [nota, ...prev.note] }));
    if (filtro !== "tutte" && filtro !== categoria) setFiltro("tutte");
  };

  const elimina = (n: NotaSessione) => {
    if (!confirm(`Eliminare la nota${n.titolo ? ` "${n.titolo}"` : ""}?`)) return;
    setChar(prev => ({ ...prev, note: prev.note.filter(x => x.id !== n.id) }));
  };

  const visibili = char.note.filter(n => filtro === "tutte" || n.categoria === filtro);
  const conteggio = (id: CategoriaNota) => char.note.filter(n => n.categoria === id).length;

  return (
    <div className="space-y-4">
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-wrap items-center gap-2">
        <select value={categoria} onChange={e => setCategoria(e.target.value as CategoriaNota)} className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-2 text-sm text-slate-200 outline-none focus:border-indigo-500">
          {CATEGORIE.map(c => <option key={c.id} value={c.id}>{c.etichetta}</option>)}
        </select>
        <button onClick={aggiungi} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-semibold flex items-center gap-1">
          <Plus className="w-4 h-4" /> Nuova nota
        </button>
        <div className="flex flex-wrap gap-1 ml-auto text-xs font-semibold">
          {[{ id: "tutte" as const, etichetta: "Tutte", n: char.note.length }, ...CATEGORIE.map(c => ({ id: c.id, etichetta: c.etichetta, n: conteggio(c.id) }))].map(f => (
            <button
              key={f.id}
              onClick={() => setFiltro(f.id)}
              className={`px-2.5 py-1 rounded-lg border transition ${
                filtro === f.id ? "bg-slate-700 border-slate-600 text-white" : "bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200"
              }`}
            >
              {f.etichetta} <span className="text-slate-500">{f.n}</span>
            </button>
          ))}
        </div>
      </div>

      {visibili.length === 0 && (
        <p className="text-sm text-slate-500 text-center py-8">
          {char.note.length === 0 ? "Nessuna nota: aggiungi appunti di sessione, PNG incontrati o obiettivi." : "Nessuna nota in questa categoria."}
        </p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {visibili.map(n => {
          const cat = CATEGORIE.find(c => c.id === n.categoria) ?? CATEGORIE[3];
          return (
            <div key={n.id} className={`bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2 ${n.fatto ? "opacity-60" : ""}`}>
              <div className="flex items-center gap-2">
                {n.categoria === "obiettivo" && (
                  <button
                    onClick={() => aggiorna(n.id, { fatto: !n.fatto })}
                    title={n.fatto ? "Segna come da fare" : "Segna come raggiunto"}
                    className={`w-5 h-5 shrink-0 rounded border flex items-center justify-center ${n.fatto ? "bg-emerald-600 border-emerald-500 text-white" : "border-slate-600 hover:border-slate-400"}`}
                  >
                    {n.fatto && <Check className="w-3.5 h-3.5" />}
                  </button>
                )}
                <input
                  value={n.titolo}
                  onChange={e => aggiorna(n.id, { titolo: e.target.value })}
                  placeholder="Titolo"
                  className={`${campo} font-semibold ${n.fatto ? "line-through" : ""}`}
                />
                <button onClick={() => elimina(n)} title="Elimina nota" className="text-slate-600 hover:text-rose-400 p-1">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <textarea
                value={n.testo}
                onChange={e => aggiorna(n.id, { testo: e.target.value })}
                placeholder="Appunti..."
                rows={5}
                className={`${campo} resize-y leading-relaxed`}
              />
              <div className="flex items-center justify-between gap-2 text-xs">
                <select
                  value={n.categoria}
                  onChange={e => aggiorna(n.id, { categoria: e.target.value as CategoriaNota })}
                  className={`px-2 py-0.5 rounded-full border text-[10px] uppercase tracking-wider font-bold bg-transparent outline-none ${cat.colore}`}
                >
                  {CATEGORIE.map(c => <option key={c.id} value={c.id} className="bg-slate-900 text-slate-200">{c.etichetta}</option>)}
                </select>
                <span className="text-slate-500">{n.data}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
