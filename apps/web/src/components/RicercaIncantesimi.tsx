import { useEffect, useMemo, useState } from "react";
import { Check, ChevronDown, ChevronRight, Search, Sparkles, X } from "lucide-react";
import type { IncantesimoCatalogo } from "@dnd/regole/tipi.ts";
import { SCUOLE, raggruppaIncantesimi } from "@dnd/regole/regole.ts";

interface Props {
  titolo: string;
  catalogo: IncantesimoCatalogo[];
  posseduti?: string[]; // nomi già nel grimorio: si vedono ma non si scelgono
  massimo?: number; // quante voci si possono scegliere (senza limite se assente)
  iniziali?: number[]; // id già scelti all'apertura
  classe?: string; // filtro di classe preselezionato (l'utente può toglierlo)
  etichettaConferma?: string;
  onConferma: (scelti: IncantesimoCatalogo[]) => void;
  onChiudi: () => void;
}

const nomeLivello = (livello: number) => (livello === 0 ? "Trucchetti" : `${livello}° Livello`);
const chiave = (nome: string) => nome.trim().toLowerCase();

const chip = (attivo: boolean) =>
  `px-2.5 py-1 rounded-lg border text-xs whitespace-nowrap transition ${attivo
    ? "bg-indigo-600 border-indigo-500 text-white"
    : "bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-600"}`;

// Modale di ricerca nel catalogo: filtri per testo, livello, scuola e classe; risultati divisi per livello
// e per scuola; si scelgono una o più voci (fino a `massimo`) e si confermano insieme.
export default function RicercaIncantesimi({
  titolo, catalogo, posseduti = [], massimo = Infinity, iniziali = [], classe, etichettaConferma = "Aggiungi", onConferma, onChiudi,
}: Props) {
  const [testo, setTesto] = useState("");
  const [livello, setLivello] = useState<number | null>(null);
  const [scuola, setScuola] = useState<string | null>(null);
  const [classeFiltro, setClasseFiltro] = useState<string | null>(classe ?? null);
  const [concentrazione, setConcentrazione] = useState(false);
  const [rituale, setRituale] = useState(false);
  const [scelti, setScelti] = useState<number[]>(iniziali);
  const [aperti, setAperti] = useState<number[]>([]); // id con i dettagli espansi

  useEffect(() => {
    const suTasto = (e: KeyboardEvent) => { if (e.key === "Escape") onChiudi(); };
    window.addEventListener("keydown", suTasto);
    return () => window.removeEventListener("keydown", suTasto);
  }, [onChiudi]);

  const nomiPosseduti = useMemo(() => new Set(posseduti.map(chiave)), [posseduti]);
  const livelli = useMemo(() => [...new Set(catalogo.map(v => v.livello))].sort((a, b) => a - b), [catalogo]);
  const scuole = useMemo(() => SCUOLE.filter(s => catalogo.some(v => v.scuola === s)), [catalogo]);
  const classi = useMemo(() => [...new Set(catalogo.flatMap(v => v.classi))].sort((a, b) => a.localeCompare(b, "it")), [catalogo]);
  const gruppi = useMemo(
    () => raggruppaIncantesimi(catalogo, { testo, livello, scuola, classe: classeFiltro, concentrazione, rituale }),
    [catalogo, testo, livello, scuola, classeFiltro, concentrazione, rituale],
  );
  const totale = gruppi.reduce((n, g) => n + g.scuole.reduce((m, s) => m + s.voci.length, 0), 0);
  const pieno = scelti.length >= massimo;

  const scegli = (id: number) => setScelti(prev => (prev.includes(id) ? prev.filter(x => x !== id) : prev.length < massimo ? [...prev, id] : prev));
  const espandi = (id: number) => setAperti(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));
  const azzera = () => { setTesto(""); setLivello(null); setScuola(null); setClasseFiltro(null); setConcentrazione(false); setRituale(false); };
  const filtriAttivi = testo !== "" || livello !== null || scuola !== null || classeFiltro !== null || concentrazione || rituale;

  const conferma = () => onConferma(catalogo.filter(v => scelti.includes(v.id)));

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-2 sm:p-4">
      <div className="w-full max-w-3xl h-[90vh] flex flex-col bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden">
        <div className="p-4 space-y-3 border-b border-slate-800">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-indigo-400" /> {titolo}
            </h2>
            <button onClick={onChiudi} title="Chiudi" className="text-slate-500 hover:text-slate-200 p-1"><X className="w-4 h-4" /></button>
          </div>

          <div className="relative">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              autoFocus
              placeholder={`Cerca tra ${catalogo.length} incantesimi...`}
              value={testo}
              onChange={e => setTesto(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-sm text-slate-200 outline-none focus:border-indigo-500"
            />
          </div>

          <div className="space-y-2">
            <div className="flex gap-1.5 overflow-x-auto pb-1">
              <button onClick={() => setLivello(null)} className={chip(livello === null)}>Tutti i livelli</button>
              {livelli.map(l => (
                <button key={l} onClick={() => setLivello(livello === l ? null : l)} className={chip(livello === l)}>
                  {l === 0 ? "Trucchetti" : `${l}°`}
                </button>
              ))}
            </div>
            <div className="flex gap-1.5 overflow-x-auto pb-1">
              <button onClick={() => setScuola(null)} className={chip(scuola === null)}>Tutte le scuole</button>
              {scuole.map(s => (
                <button key={s} onClick={() => setScuola(scuola === s ? null : s)} className={chip(scuola === s)}>{s}</button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <select
                value={classeFiltro ?? ""}
                onChange={e => setClasseFiltro(e.target.value || null)}
                className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-xs text-slate-200 outline-none focus:border-indigo-500"
              >
                <option value="">Tutte le classi</option>
                {classi.map(c => <option key={c} value={c}>Lista: {c}</option>)}
              </select>
              <button onClick={() => setConcentrazione(!concentrazione)} className={chip(concentrazione)}>Concentrazione</button>
              <button onClick={() => setRituale(!rituale)} className={chip(rituale)}>Rituale</button>
              {filtriAttivi && (
                <button onClick={azzera} className="text-xs text-slate-400 hover:text-slate-200 underline underline-offset-2 px-1">
                  Azzera i filtri
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {catalogo.length === 0 ? (
            <p className="p-6 text-sm text-slate-400 text-center">Il catalogo non è raggiungibile: riprova più tardi.</p>
          ) : totale === 0 ? (
            <p className="p-6 text-sm text-slate-400 text-center">Nessun incantesimo corrisponde ai filtri.</p>
          ) : (
            gruppi.map(g => (
              <section key={g.livello}>
                <h3 className="sticky top-0 z-10 bg-slate-950/95 backdrop-blur px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-indigo-300 border-y border-slate-800">
                  {nomeLivello(g.livello)}
                </h3>
                {g.scuole.map(({ scuola: nomeScuola, voci }) => (
                  <div key={nomeScuola}>
                    <div className="px-4 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">{nomeScuola}</div>
                    <ul className="divide-y divide-slate-800/60">
                      {voci.map(v => {
                        const posseduto = nomiPosseduti.has(chiave(v.nome));
                        const scelto = scelti.includes(v.id);
                        const aperto = aperti.includes(v.id);
                        const bloccato = posseduto || (!scelto && pieno);
                        return (
                          <li key={v.id} className={posseduto ? "opacity-50" : ""}>
                            <div className="flex items-center gap-2 px-4 py-1.5 hover:bg-slate-800/30">
                              <button
                                onClick={() => scegli(v.id)}
                                disabled={bloccato}
                                title={posseduto ? "Già nel grimorio" : scelto ? "Togli dalla scelta" : "Scegli"}
                                className={`w-5 h-5 shrink-0 rounded border flex items-center justify-center transition disabled:cursor-not-allowed ${scelto
                                  ? "bg-indigo-600 border-indigo-500 text-white"
                                  : "bg-slate-950 border-slate-700 hover:border-slate-500"}`}
                              >
                                {scelto && <Check className="w-3.5 h-3.5" />}
                              </button>
                              <button onClick={() => espandi(v.id)} className="flex-1 min-w-0 flex items-center gap-2 text-left text-sm text-slate-200">
                                {aperto ? <ChevronDown className="w-3.5 h-3.5 shrink-0 text-slate-500" /> : <ChevronRight className="w-3.5 h-3.5 shrink-0 text-slate-500" />}
                                <span className="font-semibold truncate">{v.nome}</span>
                                {v.scheda?.concentrazione && <span title="Concentrazione" className="text-[10px] px-1 rounded bg-amber-500/20 text-amber-300">C</span>}
                                {v.scheda?.rituale && <span title="Rituale" className="text-[10px] px-1 rounded bg-sky-500/20 text-sky-300">R</span>}
                                {posseduto && <span className="text-[10px] text-slate-400">già nel grimorio</span>}
                              </button>
                              <span className="hidden sm:block text-xs text-slate-500 shrink-0">{v.tempo}</span>
                            </div>
                            {aperto && (
                              <div className="px-4 pb-3 pl-14 space-y-2 text-xs text-slate-400">
                                <div className="flex flex-wrap gap-x-4 gap-y-0.5">
                                  <span><strong className="text-slate-300">Tempo:</strong> {v.tempo}</span>
                                  {v.scheda && <span><strong className="text-slate-300">Gittata:</strong> {v.scheda.gittata}</span>}
                                  {v.scheda && <span><strong className="text-slate-300">Componenti:</strong> {v.scheda.componenti}</span>}
                                  {v.scheda && <span><strong className="text-slate-300">Durata:</strong> {v.scheda.durata}</span>}
                                </div>
                                {v.scheda ? <p className="whitespace-pre-line">{v.scheda.descrizione}</p> : <p className="italic">Nessuna scheda dettagliata nel catalogo.</p>}
                                {v.classi.length > 0 && <p><strong className="text-slate-300">Liste:</strong> {v.classi.join(", ")}</p>}
                              </div>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </section>
            ))
          )}
        </div>

        <div className="p-3 border-t border-slate-800 flex items-center justify-between gap-2">
          <span className="text-xs text-slate-400">
            {totale} risultati · {scelti.length}{Number.isFinite(massimo) ? ` / ${massimo}` : ""} scelti
          </span>
          <div className="flex gap-2">
            <button onClick={onChiudi} className="px-3 py-2 rounded-xl text-sm font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700">
              Annulla
            </button>
            <button
              onClick={conferma}
              disabled={scelti.length === 0 && iniziali.length === 0}
              className="px-4 py-2 rounded-xl text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {etichettaConferma}{scelti.length > 0 ? ` (${scelti.length})` : ""}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
