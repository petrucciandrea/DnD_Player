import { useEffect, useState, type FormEvent } from "react";
import { CheckCircle2, Circle, AlertCircle, Plus, Trash2, RotateCcw, Search } from "lucide-react";
import type { CharacterData, IncantesimoCatalogo, Spell } from "@dnd/regole/tipi.ts";
import type { SetChar } from "../stato.ts";
import type { ChiediD20, ChiediTiro } from "../tiroDadi";
import { catalogoCreazione } from "../accesso";
import { classeDellaLista } from "@dnd/regole/dati/classi.ts";
import FinestraIncantesimo from "./FinestraIncantesimo";
import RicercaIncantesimi from "./RicercaIncantesimi";
import type { Derivate } from "@dnd/regole/regole.ts";
import { SCUOLE, aggiungiIncantesimi, derivate, incantesimiSottoclasseMancanti, segno } from "@dnd/regole/regole.ts";

interface Props {
  char: CharacterData;
  d: Derivate;
  setChar: SetChar;
  chiediTiro: ChiediTiro;
  chiediD20: ChiediD20;
}

const nomeLivello = (livello: number) => (livello === 0 ? "Trucchetto" : `${livello}° Livello`);

export default function TabGrimorio({ char, d, setChar, chiediTiro, chiediD20 }: Props) {
  const [aperto, setAperto] = useState<number | null>(null); // id dell'incantesimo nella finestra
  const spellAperto = char.incantesimi.find(s => s.id === aperto);
  const [nuovo, setNuovo] = useState({ nome: "", livello: 1, scuola: "Invocazione", tempo: "1 Azione" });
  const [catalogo, setCatalogo] = useState<IncantesimoCatalogo[]>([]);
  const [inRicerca, setInRicerca] = useState(false);

  useEffect(() => {
    let attivo = true;
    catalogoCreazione().then(c => {
      if (attivo && c) setCatalogo(c.incantesimi);
    });
    return () => { attivo = false; };
  }, []);

  const stessoNome = (a: string, b: string) => a.trim().localeCompare(b.trim(), "it", { sensitivity: "accent" }) === 0;
  const spellDaCatalogo = (v: IncantesimoCatalogo): Spell => ({
    id: v.id, nome: v.nome, livello: v.livello, scuola: v.scuola, tempo: v.tempo,
    preparato: v.livello === 0, ...(v.scheda ? { scheda: v.scheda } : {}),
  });

  // Gli incantesimi scelti nella ricerca (le voci già nel grimorio si ignorano).
  const aggiungiDaCatalogo = (scelti: IncantesimoCatalogo[]) => {
    setChar(prev => aggiungiIncantesimi(prev, scelti.map(spellDaCatalogo)));
    setInRicerca(false);
  };

  const spesi = (i: number) => Math.min(char.slotSpesi[i] ?? 0, d.slotMax[i] ?? 0);
  const livelloMaxIncantesimi = d.slotMax.length;

  const toggleSlot = (livelloIdx: number, index: number) =>
    setChar(prev => {
      const attuali = prev.slotSpesi[livelloIdx] ?? 0;
      const slotSpesi = [...prev.slotSpesi];
      slotSpesi[livelloIdx] = index < attuali ? index : index + 1;
      return { ...prev, slotSpesi };
    });

  const togglePreparato = (id: number) =>
    setChar(prev => {
      const { preparatiAttuali, maxPreparabili } = derivate(prev);
      return {
        ...prev,
        incantesimi: prev.incantesimi.map(s => {
          if (s.id !== id || derivate(prev).semprePreparato(s.nome)) return s;
          if (!s.preparato && maxPreparabili !== null && preparatiAttuali >= maxPreparabili) return s;
          return { ...s, preparato: !s.preparato };
        }),
      };
    });

  const aggiungiIncantesimo = (e: FormEvent) => {
    e.preventDefault();
    const nome = nuovo.nome.trim();
    if (!nome) return;
    if (char.incantesimi.some(s => stessoNome(s.nome, nome))) {
      alert(`"${nome}" è già nel grimorio.`);
      return;
    }
    // Con il nome di una voce del catalogo si usa quella; altrimenti diventa una nuova voce del catalogo condiviso al prossimo salvataggio.
    const voceScelta = catalogo.find(v => stessoNome(v.nome, nome));
    if (!voceScelta && !confirm(`"${nome}" non è nel catalogo: verrà aggiunto al catalogo condiviso, senza scheda dettagliata. Continuare?`)) return;
    const spell: Spell = voceScelta
      ? spellDaCatalogo(voceScelta)
      : {
          id: Date.now(),
          nome,
          livello: nuovo.livello,
          scuola: nuovo.scuola,
          tempo: nuovo.tempo.trim() || "1 Azione",
          preparato: nuovo.livello === 0,
        };
    setChar(prev => ({ ...prev, incantesimi: [...prev.incantesimi, spell] }));
    setNuovo(prev => ({ ...prev, nome: "" }));
  };

  const rimuoviIncantesimo = (s: Spell) => {
    if (!confirm(`Rimuovere "${s.nome}" dal grimorio?`)) return;
    setChar(prev => ({ ...prev, incantesimi: prev.incantesimi.filter(x => x.id !== s.id) }));
  };

  // Incantesimi di dominio, giuramento o circolo che mancano al grimorio: si prendono dal catalogo.
  const mancanti = incantesimiSottoclasseMancanti(char);
  const mancantiNelCatalogo = catalogo.filter(v => mancanti.some(n => stessoNome(n, v.nome)));
  const aggiungiMancanti = () =>
    setChar(prev => aggiungiIncantesimi(prev, mancantiNelCatalogo.map(v => ({ ...v, preparato: true }))));

  const incantesimiOrdinati = [...char.incantesimi].sort(
    (a, b) => a.livello - b.livello || a.nome.localeCompare(b.nome, "it"),
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {d.slotMax.map((max, i) => max > 0 && (
          <div key={i} className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-bold text-slate-200">
                {d.pattoMagico ? "Slot del Patto" : "Slot Incantesimi"} di {i + 1}° Livello
              </div>
              <div className="text-xs text-slate-400">Disponibili: {max - spesi(i)} / {max}</div>
            </div>
            <div className="flex flex-wrap gap-2 justify-end">
              {Array.from({ length: max }).map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => toggleSlot(i, idx)}
                  className={`w-7 h-7 rounded-lg border flex items-center justify-center transition ${
                    idx < spesi(i)
                      ? "bg-slate-950 border-slate-800 text-slate-700"
                      : "bg-indigo-600/30 border-indigo-500 text-indigo-300 shadow-sm shadow-indigo-500/20"
                  }`}
                >
                  {idx < spesi(i) ? <Circle className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {d.slotMax.every(n => n === 0) && d.incantatore && (
        <p className="bg-slate-900 border border-slate-800 rounded-xl p-3 text-xs text-slate-400">
          Nessuno slot incantesimo a questo livello: arrivano con i livelli successivi.
        </p>
      )}
      {d.pattoMagico && (
        <p className="bg-slate-900 border border-slate-800 rounded-xl p-3 text-xs text-slate-400">
          Gli slot del patto si recuperano con un riposo breve o lungo.
        </p>
      )}

      {d.haRecuperoArcano && (
        <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-900 border border-slate-800 rounded-xl p-3 text-xs">
          <span className="flex items-center gap-2 text-slate-300">
            <RotateCcw className="w-4 h-4 text-emerald-400" />
            <strong>Recupero Arcano</strong> ({d.budgetRecuperoArcano} livelli di slot, una volta al giorno)
          </span>
          <span className={char.recuperoArcanoUsato ? "text-slate-500" : "text-emerald-400 font-semibold"}>
            {char.recuperoArcanoUsato ? "Già usato: torna con il riposo lungo" : "Disponibile: usalo con il pulsante Riposo Breve"}
          </span>
        </div>
      )}

      {d.incantatore && d.caratteristicaMagica && (
        <div className="flex flex-wrap items-center justify-between gap-2 bg-indigo-950/30 border border-indigo-900/40 p-3 rounded-xl text-xs text-indigo-300">
          <span className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-indigo-400" />
            {d.maxPreparabili !== null ? (
              <>Limite preparazione: <strong>{d.maxPreparabili} incantesimi</strong> ({d.modoIncantesimi === "libro" ? "dal libro" : "dall'intera lista della classe"}, mod {d.caratteristicaMagica} {segno(d.mod(d.caratteristicaMagica))}).</>
            ) : (
              <>Incantesimi conosciuti: <strong>{d.maxConosciuti}</strong> al {char.info.livello}° livello. Si lanciano senza prepararli.</>
            )}
          </span>
          <span className="font-bold">
            {d.maxPreparabili !== null
              ? `${d.preparatiAttuali} / ${d.maxPreparabili} preparati`
              : `${d.conosciutiAttuali} / ${d.maxConosciuti} conosciuti`}
            {" · "}Trucchetti {d.trucchettiAttuali} / {d.maxTrucchetti}
          </span>
        </div>
      )}

      {mancanti.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 bg-amber-950/20 border border-amber-900/50 p-3 rounded-xl text-xs text-amber-200">
          <span>
            Mancano {mancanti.length} incantesimi di {d.fonteIncantesimiSottoclasse?.toLowerCase()} ({mancanti.join(", ")})
            {mancantiNelCatalogo.length < mancanti.length && ": alcuni non sono ancora nel catalogo"}.
          </span>
          {mancantiNelCatalogo.length > 0 && (
            <button onClick={aggiungiMancanti} className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-semibold">
              <Plus className="w-3.5 h-3.5" /> Aggiungi
            </button>
          )}
        </div>
      )}

      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <p className="px-3 py-2 text-xs text-slate-500 border-b border-slate-800">Clicca il nome di un incantesimo per aprirne la scheda e lanciarlo.</p>
        <div className="grid grid-cols-12 bg-slate-950/80 p-3 text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-800">
          <div className="col-span-5 sm:col-span-4">Incantesimo</div>
          <div className="col-span-2">Livello</div>
          <div className="col-span-3">Scuola & Tempo</div>
          <div className="col-span-2 sm:col-span-3 text-right">Preparato</div>
        </div>
        <div className="divide-y divide-slate-800/60 text-sm">
          {incantesimiOrdinati.map(s => (
            <div key={s.id} className="group grid grid-cols-12 p-3 items-center hover:bg-slate-800/30 transition">
              <div className="col-span-5 sm:col-span-4 font-semibold text-slate-200 flex items-center gap-1">
                <button
                  onClick={() => rimuoviIncantesimo(s)}
                  title="Rimuovi dal grimorio"
                  className="text-slate-600 hover:text-rose-400 p-0.5 sm:opacity-0 sm:group-hover:opacity-100 transition"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => setAperto(s.id)} className="text-left hover:text-indigo-300 underline decoration-slate-700 underline-offset-4 hover:decoration-indigo-400">
                  {s.nome}
                </button>
                {s.scheda?.concentrazione && <span title="Concentrazione" className="text-[10px] px-1 rounded bg-amber-500/20 text-amber-300">C</span>}
                {s.scheda?.rituale && <span title="Rituale" className="text-[10px] px-1 rounded bg-sky-500/20 text-sky-300">R</span>}
              </div>
              <div className="col-span-2 text-xs font-mono text-indigo-300">{nomeLivello(s.livello)}</div>
              <div className="col-span-3 text-xs text-slate-400">{s.scuola} • {s.tempo}</div>
              <div className="col-span-2 sm:col-span-3 text-right">
                {s.livello === 0 ? (
                  <span className="text-xs text-emerald-400 font-semibold">Sempre attivo</span>
                ) : d.semprePreparato(s.nome) ? (
                  <span title="Sempre preparato, non conta nel limite" className="text-xs text-amber-300 font-semibold">
                    {d.fonteIncantesimiSottoclasse ?? "Sempre preparato"}
                  </span>
                ) : !d.prepara ? (
                  <span className="text-xs text-emerald-400 font-semibold">Conosciuto</span>
                ) : (
                  <button
                    onClick={() => togglePreparato(s.id)}
                    className={`px-2.5 py-1 text-xs font-bold rounded-lg transition ${
                      s.preparato ? "bg-indigo-600 text-white" : "bg-slate-800 hover:bg-slate-700 text-slate-400"
                    }`}
                  >
                    {s.preparato ? "Preparato" : d.modoIncantesimi === "libro" ? "Nel Grimorio" : "Non preparato"}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-slate-400">Cerca nel catalogo per livello, scuola e classe, e aggiungi più incantesimi in una volta.</p>
          <button
            onClick={() => setInRicerca(true)}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-semibold flex items-center gap-1.5"
          >
            <Search className="w-4 h-4" /> Cerca incantesimi
          </button>
        </div>
        <details className="group">
          <summary className="text-xs text-slate-500 hover:text-slate-300 cursor-pointer select-none">Incantesimo personalizzato (non nel catalogo)</summary>
          <form onSubmit={aggiungiIncantesimo} className="flex flex-wrap gap-2 items-center mt-3">
            <input
              type="text"
              placeholder="Nome..."
              value={nuovo.nome}
              onChange={e => setNuovo(prev => ({ ...prev, nome: e.target.value }))}
              className="flex-1 min-w-40 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 outline-none focus:border-indigo-500"
            />
            <select
              value={nuovo.livello}
              onChange={e => setNuovo(prev => ({ ...prev, livello: Number(e.target.value) }))}
              className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-2 text-sm text-slate-200 outline-none focus:border-indigo-500"
            >
              {Array.from({ length: Math.max(livelloMaxIncantesimi, nuovo.livello) + 1 }, (_, l) => (
                <option key={l} value={l}>{nomeLivello(l)}</option>
              ))}
            </select>
            <select
              value={nuovo.scuola}
              onChange={e => setNuovo(prev => ({ ...prev, scuola: e.target.value }))}
              className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-2 text-sm text-slate-200 outline-none focus:border-indigo-500"
            >
              {SCUOLE.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <input
              type="text"
              placeholder="Tempo di lancio"
              value={nuovo.tempo}
              onChange={e => setNuovo(prev => ({ ...prev, tempo: e.target.value }))}
              className="w-36 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 outline-none focus:border-indigo-500"
            />
            <button type="submit" className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-sm font-semibold flex items-center gap-1">
              <Plus className="w-4 h-4" /> Aggiungi
            </button>
          </form>
        </details>
      </div>

      {inRicerca && (
        <RicercaIncantesimi
          titolo="Cerca incantesimi"
          catalogo={catalogo}
          posseduti={char.incantesimi.map(s => s.nome)}
          classe={d.incantatore ? classeDellaLista(char.info.classe, char.info.sottoclasse) : undefined}
          onConferma={aggiungiDaCatalogo}
          onChiudi={() => setInRicerca(false)}
        />
      )}

      {spellAperto && (
        <FinestraIncantesimo
          key={spellAperto.id}
          spell={spellAperto}
          char={char}
          d={d}
          setChar={setChar}
          chiediTiro={chiediTiro}
          chiediD20={chiediD20}
          onChiudi={() => setAperto(null)}
        />
      )}
    </div>
  );
}
