import { useState, type FormEvent } from "react";
import { Plus, Minus, Trash2 } from "lucide-react";
import type { CharacterData, InventoryItem, SetChar } from "../tipi";
import type { Derivate } from "../regole";

interface Props {
  char: CharacterData;
  d: Derivate;
  setChar: SetChar;
}

const MONETE: { k: keyof CharacterData["monete"]; label: string; color: string }[] = [
  { k: "mo", label: "Oro (MO)", color: "text-amber-400" },
  { k: "ma", label: "Argento (MA)", color: "text-slate-300" },
  { k: "mr", label: "Rame (MR)", color: "text-orange-400" },
  { k: "me", label: "Electrum (ME)", color: "text-teal-400" },
  { k: "mp", label: "Platino (MP)", color: "text-cyan-300" },
];

const arrotonda = (n: number) => Number(n.toFixed(2));

export default function TabZaino({ char, d, setChar }: Props) {
  const [newItemInput, setNewItemInput] = useState({ nome: "", qta: 1, peso: 1 });

  const impostaMonete = (k: keyof CharacterData["monete"], valore: number) =>
    setChar(prev => ({ ...prev, monete: { ...prev.monete, [k]: Math.max(0, Math.floor(valore) || 0) } }));

  const aggiungiOggetto = (e: FormEvent) => {
    e.preventDefault();
    if (!newItemInput.nome.trim()) return;
    const item: InventoryItem = {
      id: Date.now(),
      nome: newItemInput.nome.trim(),
      qta: Math.max(1, Number(newItemInput.qta) || 1),
      peso: Math.max(0, Number(newItemInput.peso) || 0),
    };
    setChar(prev => ({ ...prev, inventario: [item, ...prev.inventario] }));
    setNewItemInput({ nome: "", qta: 1, peso: 1 });
  };

  const cambiaQta = (id: number, delta: number) =>
    setChar(prev => ({
      ...prev,
      inventario: prev.inventario.map(i => (i.id === id ? { ...i, qta: Math.max(1, i.qta + delta) } : i)),
    }));

  const rimuoviOggetto = (id: number) =>
    setChar(prev => ({ ...prev, inventario: prev.inventario.filter(i => i.id !== id) }));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {MONETE.map(c => (
          <label key={c.k} className="bg-slate-900 border border-slate-800 p-3 rounded-xl text-center block">
            <span className="text-xs text-slate-400 font-semibold">{c.label}</span>
            <input
              type="number"
              min={0}
              value={char.monete[c.k]}
              onChange={e => impostaMonete(c.k, Number(e.target.value))}
              className={`w-full bg-transparent text-center text-xl font-black mt-0.5 outline-none rounded focus:bg-slate-950 ${c.color}`}
            />
          </label>
        ))}
      </div>

      <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
        <div className="flex justify-between text-xs font-bold text-slate-400 mb-2">
          <span>Capacità di Trasporto (FOR × 15 lb)</span>
          <span>{d.pesoTotale.toFixed(1)} / {d.capacitaCarico} lb</span>
        </div>
        <div className="w-full bg-slate-950 rounded-full h-2.5 overflow-hidden">
          <div
            className={`h-full transition-all ${d.pesoTotale > d.capacitaCarico ? "bg-rose-500" : "bg-indigo-500"}`}
            style={{ width: `${Math.min(100, (d.pesoTotale / d.capacitaCarico) * 100)}%` }}
          />
        </div>
      </div>

      <form onSubmit={aggiungiOggetto} className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex flex-wrap gap-2 items-center">
        <input
          type="text"
          placeholder="Nome oggetto..."
          value={newItemInput.nome}
          onChange={e => setNewItemInput(prev => ({ ...prev, nome: e.target.value }))}
          className="flex-1 min-w-40 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 outline-none focus:border-indigo-500"
        />
        <input
          type="number"
          placeholder="Q.tà"
          min={1}
          value={newItemInput.qta}
          onChange={e => setNewItemInput(prev => ({ ...prev, qta: Number(e.target.value) }))}
          className="w-16 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 outline-none focus:border-indigo-500"
        />
        <input
          type="number"
          placeholder="Peso (lb)"
          min={0}
          step="any"
          value={newItemInput.peso}
          onChange={e => setNewItemInput(prev => ({ ...prev, peso: Number(e.target.value) }))}
          className="w-20 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 outline-none focus:border-indigo-500"
        />
        <button type="submit" className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-semibold flex items-center gap-1">
          <Plus className="w-4 h-4" /> Aggiungi
        </button>
      </form>

      <div className="bg-slate-900 border border-slate-800 rounded-xl divide-y divide-slate-800/60">
        {char.inventario.map(it => (
          <div key={it.id} className="p-3 flex justify-between items-center gap-2 hover:bg-slate-800/30 transition text-sm">
            <div>
              <span className="font-semibold text-slate-200">{it.nome}</span>
              <span className="text-xs text-slate-500 ml-2">{arrotonda(it.peso * it.qta)} lb</span>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button onClick={() => cambiaQta(it.id, -1)} disabled={it.qta <= 1} className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-30">
                <Minus className="w-3 h-3" />
              </button>
              <span className="w-7 text-center text-xs font-mono text-slate-300">{it.qta}</span>
              <button onClick={() => cambiaQta(it.id, 1)} className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300">
                <Plus className="w-3 h-3" />
              </button>
              <button onClick={() => rimuoviOggetto(it.id)} className="text-slate-500 hover:text-rose-400 p-1 ml-2">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
