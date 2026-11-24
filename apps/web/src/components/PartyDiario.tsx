import { useEffect, useState, type FormEvent } from "react";
import {
  CalendarDays, LoaderCircle, MapPin, Pencil, Pin, PinOff, Plus, Search, StickyNote, Target, Trash2, UserRound, X,
} from "lucide-react";
import type { CategoriaDiario, RuoloParty, VoceDiario } from "@dnd/regole/api.ts";
import { cancellaVoce, creaVoce, modificaVoce, vociDiario, type ControllaEsito, type DatiVoce } from "../party";

interface Props {
  partyId: number;
  io: { utenteId: number; ruolo: RuoloParty };
  versione: string; // diarioVersione del party: quando cambia si ricaricano le voci
  riuscito: ControllaEsito;
}

const CATEGORIE: { id: CategoriaDiario; nome: string; icona: typeof Pin; colore: string }[] = [
  { id: "sessione", nome: "Sessione", icona: CalendarDays, colore: "text-sky-300 bg-sky-500/10 border-sky-500/30" },
  { id: "png", nome: "PNG", icona: UserRound, colore: "text-amber-300 bg-amber-500/10 border-amber-500/30" },
  { id: "luogo", nome: "Luogo", icona: MapPin, colore: "text-emerald-300 bg-emerald-500/10 border-emerald-500/30" },
  { id: "missione", nome: "Missione", icona: Target, colore: "text-rose-300 bg-rose-500/10 border-rose-500/30" },
  { id: "altro", nome: "Altro", icona: StickyNote, colore: "text-slate-300 bg-slate-500/10 border-slate-500/30" },
];
const categoria = (id: CategoriaDiario) => CATEGORIE.find(c => c.id === id) ?? CATEGORIE[4];

const pulsanteNeutro = "flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700 disabled:opacity-50";

const data = (iso: string) => new Date(iso).toLocaleDateString("it-IT", { day: "2-digit", month: "short", year: "numeric" });

// Diario di campagna condiviso: tutti scrivono, il Master fissa le voci importanti in alto.
export default function PartyDiario({ partyId, io, versione, riuscito }: Props) {
  const [voci, setVoci] = useState<VoceDiario[] | null>(null);
  const [giro, setGiro] = useState(0); // si incrementa per ricaricare dopo una modifica
  const [filtro, setFiltro] = useState<CategoriaDiario | null>(null);
  const [ricerca, setRicerca] = useState("");
  const [aperta, setAperta] = useState<number | null>(null);
  const [editor, setEditor] = useState<VoceDiario | "nuova" | null>(null);
  const master = io.ruolo === "master";

  useEffect(() => {
    let attivo = true;
    vociDiario(partyId).then(esito => {
      if (attivo && riuscito(esito)) setVoci(esito.dati);
    });
    return () => { attivo = false; };
  }, [partyId, versione, giro, riuscito]);

  const ricarica = () => setGiro(g => g + 1);

  // true se salvata (o se l'utente ha scelto di tenere la versione dell'altro).
  const salva = async (dati: DatiVoce): Promise<boolean> => {
    if (editor === "nuova") {
      const esito = await creaVoce(partyId, dati);
      if (!riuscito(esito)) return false;
      ricarica();
      return true;
    }
    if (!editor) return false;
    let revisione = editor.revisione;
    for (;;) {
      const esito = await modificaVoce(partyId, editor.id, dati, revisione);
      if (esito !== "sessione scaduta" && "errore" in esito && esito.stato === 409) {
        const attuale = esito.corpo as VoceDiario;
        const sovrascrivi = confirm(
          `"${attuale.titolo}" è stata modificata da ${attuale.aggiornatoDa} mentre la scrivevi.\n\n`
          + "OK: salva la tua versione al posto della sua.\nAnnulla: tieni la sua (le tue modifiche vanno perse).",
        );
        if (!sovrascrivi) {
          ricarica();
          return true;
        }
        revisione = attuale.revisione;
        continue;
      }
      if (!riuscito(esito)) return false;
      ricarica();
      return true;
    }
  };

  const fissa = async (v: VoceDiario) => {
    const esito = await modificaVoce(partyId, v.id, { titolo: v.titolo, testo: v.testo, categoria: v.categoria, fissata: !v.fissata }, v.revisione);
    if (esito !== "sessione scaduta" && "errore" in esito && esito.stato === 409) return ricarica();
    if (riuscito(esito)) ricarica();
  };

  const cancella = async (v: VoceDiario) => {
    if (!confirm(`Cancellare "${v.titolo}" dal diario? Sparirà per tutto il party.`)) return;
    if (riuscito(await cancellaVoce(partyId, v.id))) ricarica();
  };

  const testoRicerca = ricerca.trim().toLowerCase();
  const visibili = (voci ?? []).filter(v => (!filtro || v.categoria === filtro)
    && (!testoRicerca || v.titolo.toLowerCase().includes(testoRicerca) || v.testo.toLowerCase().includes(testoRicerca)));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-48">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input value={ricerca} onChange={e => setRicerca(e.target.value)} placeholder="Cerca nel diario…"
            className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-sm text-slate-100 outline-none focus:border-indigo-500" />
        </div>
        <button onClick={() => setEditor("nuova")}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition">
          <Plus className="w-4 h-4" /> Nuova voce
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        <button onClick={() => setFiltro(null)}
          className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${filtro === null ? "bg-indigo-600 border-indigo-500 text-white" : "border-slate-700 text-slate-400 hover:text-slate-200"}`}>
          Tutte
        </button>
        {CATEGORIE.map(c => (
          <button key={c.id} onClick={() => setFiltro(filtro === c.id ? null : c.id)}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${filtro === c.id ? c.colore : "border-slate-700 text-slate-400 hover:text-slate-200"}`}>
            <c.icona className="w-3 h-3" /> {c.nome}
          </button>
        ))}
      </div>

      {voci === null && <div className="flex justify-center py-8"><LoaderCircle className="w-5 h-5 text-indigo-400 animate-spin" /></div>}
      {voci !== null && visibili.length === 0 && (
        <div className="bg-slate-900 border border-dashed border-slate-700 rounded-xl p-6 text-center text-sm text-slate-400">
          {voci.length === 0
            ? "Il diario è vuoto: annotate sessioni, PNG, luoghi e missioni. Lo vede tutto il party."
            : "Nessuna voce corrisponde alla ricerca."}
        </div>
      )}

      <div className="space-y-2">
        {visibili.map(v => {
          const c = categoria(v.categoria);
          const espansa = aperta === v.id;
          return (
            <article key={v.id} className={`bg-slate-900 border rounded-xl p-4 space-y-2 ${v.fissata ? "border-amber-500/40" : "border-slate-800"}`}>
              <div className="flex items-start gap-2">
                <button onClick={() => setAperta(espansa ? null : v.id)} className="flex-1 min-w-0 text-left space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    {v.fissata && <Pin className="w-3.5 h-3.5 text-amber-300" />}
                    <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${c.colore}`}>
                      <c.icona className="w-3 h-3" /> {c.nome}
                    </span>
                    <h3 className="font-bold text-slate-100">{v.titolo}</h3>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    {v.autore} • {data(v.creato)}
                    {v.revisione > 1 && ` • modificata da ${v.aggiornatoDa} il ${data(v.aggiornato)}`}
                  </p>
                </button>
                <div className="flex gap-1 shrink-0">
                  {master && (
                    <button onClick={() => fissa(v)} title={v.fissata ? "Togli dall'alto" : "Fissa in alto"} className="p-1.5 text-slate-500 hover:text-amber-300">
                      {v.fissata ? <PinOff className="w-4 h-4" /> : <Pin className="w-4 h-4" />}
                    </button>
                  )}
                  <button onClick={() => setEditor(v)} title="Modifica" className="p-1.5 text-slate-500 hover:text-slate-200"><Pencil className="w-4 h-4" /></button>
                  {(master || v.autoreId === io.utenteId) && (
                    <button onClick={() => cancella(v)} title="Cancella" className="p-1.5 text-slate-500 hover:text-rose-300"><Trash2 className="w-4 h-4" /></button>
                  )}
                </div>
              </div>
              {v.testo && (
                <p onClick={() => setAperta(espansa ? null : v.id)}
                  className={`text-sm text-slate-300 whitespace-pre-wrap break-words cursor-pointer ${espansa ? "" : "line-clamp-3"}`}>
                  {v.testo}
                </p>
              )}
            </article>
          );
        })}
      </div>

      {editor && (
        <EditorVoce voce={editor === "nuova" ? null : editor} master={master} onSalva={salva} onChiudi={() => setEditor(null)} />
      )}
    </div>
  );
}

function EditorVoce({ voce, master, onSalva, onChiudi }: {
  voce: VoceDiario | null; master: boolean; onSalva: (dati: DatiVoce) => Promise<boolean>; onChiudi: () => void;
}) {
  const [titolo, setTitolo] = useState(voce?.titolo ?? "");
  const [testo, setTesto] = useState(voce?.testo ?? "");
  const [cat, setCat] = useState<CategoriaDiario>(voce?.categoria ?? "sessione");
  const [fissata, setFissata] = useState(voce?.fissata ?? false);
  const [inCorso, setInCorso] = useState(false);

  const invia = async (e: FormEvent) => {
    e.preventDefault();
    if (!titolo.trim()) return;
    setInCorso(true);
    const ok = await onSalva({ titolo: titolo.trim(), testo, categoria: cat, ...(master ? { fissata } : {}) });
    setInCorso(false);
    if (ok) onChiudi();
  };

  const campo = "w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 outline-none focus:border-indigo-500";

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-2 sm:p-4">
      <form onSubmit={invia} className="w-full max-w-2xl max-h-[92vh] overflow-y-auto bg-slate-900 border border-slate-700 rounded-2xl p-5 shadow-2xl space-y-4">
        <div className="flex items-start justify-between gap-2">
          <h2 className="text-lg font-bold text-slate-100">{voce ? "Modifica la voce" : "Nuova voce del diario"}</h2>
          <button type="button" onClick={onChiudi} title="Chiudi" className="text-slate-500 hover:text-slate-200 p-1"><X className="w-4 h-4" /></button>
        </div>
        <input value={titolo} onChange={e => setTitolo(e.target.value)} maxLength={200} autoFocus placeholder="Titolo" className={`${campo} font-semibold`} />
        <div className="flex flex-wrap gap-1.5">
          {CATEGORIE.map(c => (
            <button key={c.id} type="button" onClick={() => setCat(c.id)}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${cat === c.id ? c.colore : "border-slate-700 text-slate-400 hover:text-slate-200"}`}>
              <c.icona className="w-3 h-3" /> {c.nome}
            </button>
          ))}
        </div>
        <textarea value={testo} onChange={e => setTesto(e.target.value)} maxLength={20_000} rows={12}
          placeholder="Cosa è successo, chi avete incontrato, cosa resta da fare…" className={`${campo} resize-y`} />
        {master && (
          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input type="checkbox" checked={fissata} onChange={e => setFissata(e.target.checked)} className="accent-amber-500" />
            Fissa in alto (la vedranno per prima tutti i giocatori)
          </label>
        )}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onChiudi} className={pulsanteNeutro}>Annulla</button>
          <button type="submit" disabled={inCorso || !titolo.trim()}
            className="flex items-center gap-2 px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-semibold">
            {inCorso && <LoaderCircle className="w-4 h-4 animate-spin" />} Salva
          </button>
        </div>
      </form>
    </div>
  );
}
