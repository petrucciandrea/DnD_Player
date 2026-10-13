import { useEffect, useState, type FormEvent } from "react";
import { Plus, Minus, Trash2, Shield, Utensils, Package, PackageOpen, Sunrise } from "lucide-react";
import type { Armatura, CharacterData, InventoryItem } from "@dnd/regole/tipi.ts";
import type { SetChar } from "../stato.ts";
import type { Derivate } from "@dnd/regole/regole.ts";
import {
  PESO_SCUDO, PROVVISTE_COMUNI, cambiaQuantita, dotazioneScomponibile, giorniRimasti, impostaConsumabile, impostaConsumoGiornaliero, passaGiorni, scomponiDotazione, segno,
} from "@dnd/regole/regole.ts";
import { catalogoCreazione } from "../accesso";

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
  const [newItemInput, setNewItemInput] = useState({ nome: "", qta: 1, peso: 1, consumabile: false, consumo: 0 });
  const [messaggio, setMessaggio] = useState<string | null>(null);
  const [armature, setArmature] = useState<Armatura[]>([]);

  useEffect(() => {
    let attivo = true;
    catalogoCreazione().then(c => {
      if (attivo && c) setArmature(c.armature);
    });
    return () => { attivo = false; };
  }, []);

  // L'armatura attuale resta tra le opzioni anche se il catalogo non è raggiungibile.
  const opzioniArmatura = char.armatura && !armature.some(a => a.nome === char.armatura?.nome)
    ? [char.armatura, ...armature]
    : armature;

  const indossa = (nome: string) =>
    setChar(prev => ({ ...prev, armatura: opzioniArmatura.find(a => a.nome === nome) ?? null }));

  const descriviArmatura = (a: Armatura) =>
    `${a.nome} (CA ${a.ca}${a.maxDes === null ? " + DES" : a.maxDes > 0 ? ` + DES max ${segno(a.maxDes)}` : ""}, ${a.categoria})`;

  const impostaMonete = (k: keyof CharacterData["monete"], valore: number) =>
    setChar(prev => ({ ...prev, monete: { ...prev.monete, [k]: Math.max(0, Math.floor(valore) || 0) } }));

  const aggiungiOggetto = (e: FormEvent) => {
    e.preventDefault();
    if (!newItemInput.nome.trim()) return;
    const consumabile = newItemInput.consumabile;
    const item: InventoryItem = {
      id: Date.now(),
      nome: newItemInput.nome.trim(),
      qta: Math.max(consumabile ? 0 : 1, Math.floor(Number(newItemInput.qta)) || (consumabile ? 0 : 1)),
      peso: Math.max(0, Number(newItemInput.peso) || 0),
      ...(consumabile && { consumabile: true, consumoGiornaliero: Math.max(0, Number(newItemInput.consumo) || 0) }),
    };
    setChar(prev => ({ ...prev, inventario: [item, ...prev.inventario] }));
    setNewItemInput(prev => ({ ...prev, nome: "", qta: 1, peso: 1, consumo: 0 }));
  };

  // Aggiunge una provvista comune; se c'è già (stesso nome) ne aumenta la quantità.
  const aggiungiComune = (comune: (typeof PROVVISTE_COMUNI)[number]) =>
    setChar(prev => {
      const esistente = prev.inventario.find(i => i.consumabile && i.nome.toLowerCase() === comune.nome.toLowerCase());
      return esistente
        ? cambiaQuantita(prev, esistente.id, comune.qta)
        : { ...prev, inventario: [{ ...comune, id: Date.now() }, ...prev.inventario] };
    });

  const cambiaQta = (id: number, delta: number) => setChar(prev => cambiaQuantita(prev, id, delta));

  const impostaQta = (id: number, valore: number) =>
    setChar(prev => cambiaQuantita(prev, id, (Math.floor(valore) || 0) - (prev.inventario.find(i => i.id === id)?.qta ?? 0)));

  const rimuoviOggetto = (id: number) =>
    setChar(prev => ({ ...prev, inventario: prev.inventario.filter(i => i.id !== id) }));

  const provviste = char.inventario.filter(i => i.consumabile);
  const oggetti = char.inventario.filter(i => !i.consumabile);
  const conConsumo = provviste.filter(i => (i.consumoGiornaliero ?? 0) > 0);
  // L'autonomia è quella della provvista che finisce per prima.
  const autonomia = conConsumo.length
    ? conConsumo.reduce((peggiore, i) => ((giorniRimasti(i) ?? 0) < (giorniRimasti(peggiore) ?? 0) ? i : peggiore))
    : null;

  const passaGiorno = () => {
    const { esaurite } = passaGiorni(char);
    setChar(prev => passaGiorni(prev).personaggio);
    setMessaggio(esaurite.length ? `Provviste insufficienti: ${esaurite.join(", ")}.` : "Un giorno è passato: provviste aggiornate.");
  };

  const scomponi = (it: InventoryItem) => {
    const dopo = scomponiDotazione(char, it.id);
    const peso = (c: CharacterData) => arrotonda(c.inventario.reduce((t, i) => t + i.peso * i.qta, 0));
    setChar(prev => scomponiDotazione(prev, it.id));
    setMessaggio(`${it.nome.split(" (")[0]} scomposta in ${dopo.inventario.length - char.inventario.length + 1} oggetti. Peso dello zaino: ${peso(char)} → ${peso(dopo)} kg.`);
  };

  const pulsanteQta = "p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-30";
  const campo = "bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 outline-none focus:border-indigo-500";

  const riga = (it: InventoryItem) => {
    const giorni = giorniRimasti(it);
    const finita = it.consumabile && it.qta === 0;
    return (
      <div key={it.id} className="p-3 flex flex-wrap justify-between items-center gap-2 hover:bg-slate-800/30 transition text-sm">
        <div>
          <span className={`font-semibold ${finita ? "text-rose-400" : "text-slate-200"}`}>{it.nome}</span>
          <span className="text-xs text-slate-500 ml-2">{arrotonda(it.peso * it.qta)} kg</span>
          {giorni !== null && (
            <span className={`text-xs ml-2 ${giorni === 0 ? "text-rose-400" : giorni <= 2 ? "text-amber-300" : "text-slate-400"}`}>
              {giorni === 0 ? "non basta per un giorno" : `${giorni} ${giorni === 1 ? "giorno" : "giorni"}`}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {it.consumabile && (
            <label className="flex items-center gap-1 text-xs text-slate-500 mr-2" title="Unità consumate da «Passa un giorno»">
              al giorno
              <input
                type="number"
                min={0}
                step="any"
                value={it.consumoGiornaliero ?? 0}
                onChange={e => setChar(prev => impostaConsumoGiornaliero(prev, it.id, Number(e.target.value)))}
                className="w-12 bg-slate-950 border border-slate-800 rounded px-1 py-0.5 text-center text-slate-300 outline-none focus:border-indigo-500"
              />
            </label>
          )}
          <button onClick={() => cambiaQta(it.id, -1)} disabled={it.qta <= (it.consumabile ? 0 : 1)} className={pulsanteQta} aria-label="Diminuisci">
            <Minus className="w-3 h-3" />
          </button>
          <input
            type="number"
            min={it.consumabile ? 0 : 1}
            value={it.qta}
            onChange={e => impostaQta(it.id, Number(e.target.value))}
            aria-label={`Quantità di ${it.nome}`}
            className="w-10 text-center text-xs font-mono text-slate-300 bg-transparent outline-none rounded focus:bg-slate-950"
          />
          <button onClick={() => cambiaQta(it.id, 1)} className={pulsanteQta} aria-label="Aumenta">
            <Plus className="w-3 h-3" />
          </button>
          {dotazioneScomponibile(it) && (
            <button onClick={() => scomponi(it)} title="Scomponi negli oggetti che contiene" className="text-slate-500 hover:text-emerald-400 p-1 ml-2">
              <PackageOpen className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={() => setChar(prev => impostaConsumabile(prev, it.id, !it.consumabile))}
            title={it.consumabile ? "Sposta tra gli oggetti" : "Segna come provvista"}
            className="text-slate-500 hover:text-indigo-400 p-1 ml-2"
          >
            {it.consumabile ? <Package className="w-4 h-4" /> : <Utensils className="w-4 h-4" />}
          </button>
          <button onClick={() => rimuoviOggetto(it.id)} className="text-slate-500 hover:text-rose-400 p-1" aria-label="Rimuovi">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  };

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

      <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-3">
        <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
          <Shield className="w-4 h-4 text-amber-400" /> Armatura indossata
        </h3>
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={char.armatura?.nome ?? ""}
            onChange={e => indossa(e.target.value)}
            className="flex-1 min-w-48 bg-slate-950 border border-slate-800 rounded-lg px-2 py-2 text-sm text-slate-200 outline-none focus:border-indigo-500"
          >
            <option value="">Nessuna armatura</option>
            {opzioniArmatura.map(a => <option key={a.nome} value={a.nome}>{descriviArmatura(a)}</option>)}
          </select>
          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={char.scudo}
              onChange={e => setChar(prev => ({ ...prev, scudo: e.target.checked }))}
              className="accent-indigo-500"
            />
            Scudo (+2 CA, {PESO_SCUDO} kg)
          </label>
          <span className="text-sm text-slate-400">CA: <strong className="text-amber-400">{d.ca}</strong> <span className="text-xs">({d.notaCA})</span></span>
        </div>
        {d.avvisiArmatura.map(a => <p key={a} className="text-xs text-amber-300">{a}</p>)}
      </div>

      <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
        <div className="flex justify-between text-xs font-bold text-slate-400 mb-2">
          <span>Capacità di Trasporto (FOR × 7,5 kg)</span>
          <span>{d.pesoTotale.toFixed(1)} / {d.capacitaCarico} kg</span>
        </div>
        <div className="w-full bg-slate-950 rounded-full h-2.5 overflow-hidden">
          <div
            className={`h-full transition-all ${d.pesoTotale > d.capacitaCarico ? "bg-rose-500" : "bg-indigo-500"}`}
            style={{ width: `${Math.min(100, (d.pesoTotale / d.capacitaCarico) * 100)}%` }}
          />
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
            <Utensils className="w-4 h-4 text-emerald-400" /> Provviste
          </h3>
          <button
            onClick={passaGiorno}
            disabled={conConsumo.length === 0}
            title={conConsumo.length === 0 ? "Imposta un consumo giornaliero su almeno una provvista" : "Consuma il fabbisogno di un giorno"}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 rounded-lg text-xs font-semibold flex items-center gap-1"
          >
            <Sunrise className="w-3.5 h-3.5 text-amber-400" /> Passa un giorno
          </button>
        </div>
        {autonomia && (
          <p className={`text-xs ${(giorniRimasti(autonomia) ?? 0) === 0 ? "text-rose-400" : "text-slate-400"}`}>
            Autonomia: <strong className="text-slate-200">{giorniRimasti(autonomia)} {giorniRimasti(autonomia) === 1 ? "giorno" : "giorni"}</strong>{" "}
            (limitata da {autonomia.nome})
          </p>
        )}
        {messaggio && <p role="status" className="text-xs text-amber-300">{messaggio}</p>}
        <div className="flex flex-wrap gap-1.5">
          {PROVVISTE_COMUNI.map(c => (
            <button
              key={c.nome}
              onClick={() => { setMessaggio(null); aggiungiComune(c); }}
              className="px-2 py-1 text-xs rounded-lg bg-slate-950 border border-slate-800 hover:border-emerald-500/60 text-slate-300 flex items-center gap-1"
            >
              <Plus className="w-3 h-3 text-emerald-400" /> {c.nome} ×{c.qta}
            </button>
          ))}
        </div>
        {provviste.length > 0 ? (
          <div className="bg-slate-950/40 border border-slate-800 rounded-lg divide-y divide-slate-800/60">{provviste.map(riga)}</div>
        ) : (
          <p className="text-xs text-slate-500">Nessuna provvista: aggiungi razioni, acqua, olio o torce con i pulsanti qui sopra.</p>
        )}
      </div>

      <form onSubmit={aggiungiOggetto} className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex flex-wrap gap-2 items-center">
        <input
          type="text"
          placeholder="Nome oggetto..."
          value={newItemInput.nome}
          onChange={e => setNewItemInput(prev => ({ ...prev, nome: e.target.value }))}
          className={`flex-1 min-w-40 ${campo}`}
        />
        <input
          type="number"
          placeholder="Q.tà"
          min={newItemInput.consumabile ? 0 : 1}
          value={newItemInput.qta}
          onChange={e => setNewItemInput(prev => ({ ...prev, qta: Number(e.target.value) }))}
          className={`w-16 ${campo}`}
        />
        <input
          type="number"
          placeholder="Peso (kg)"
          min={0}
          step="any"
          value={newItemInput.peso}
          onChange={e => setNewItemInput(prev => ({ ...prev, peso: Number(e.target.value) }))}
          className={`w-20 ${campo}`}
        />
        <label className="flex items-center gap-1.5 text-xs text-slate-300">
          <input
            type="checkbox"
            checked={newItemInput.consumabile}
            onChange={e => setNewItemInput(prev => ({ ...prev, consumabile: e.target.checked }))}
            className="accent-emerald-500"
          />
          Provvista
        </label>
        {newItemInput.consumabile && (
          <input
            type="number"
            placeholder="Al giorno"
            title="Unità consumate ogni giorno"
            min={0}
            step="any"
            value={newItemInput.consumo}
            onChange={e => setNewItemInput(prev => ({ ...prev, consumo: Number(e.target.value) }))}
            className={`w-24 ${campo}`}
          />
        )}
        <button type="submit" className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-semibold flex items-center gap-1">
          <Plus className="w-4 h-4" /> Aggiungi
        </button>
      </form>

      <div className="bg-slate-900 border border-slate-800 rounded-xl divide-y divide-slate-800/60">
        {oggetti.map(riga)}
      </div>
    </div>
  );
}
