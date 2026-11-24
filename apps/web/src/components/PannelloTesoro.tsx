import { useCallback, useState, type FormEvent } from "react";
import { Coins, Gem, History, LoaderCircle, Minus, PackagePlus, Plus, Trash2 } from "lucide-react";
import type { Monete, Tesoro } from "@dnd/regole/api.ts";
import type { CharacterData } from "@dnd/regole/tipi.ts";
import { cambiaMonete, mettiNelloZaino, togliDalloZaino } from "@dnd/regole/regole.ts";
import type { SetChar } from "../stato.ts";
import {
  cambiaMoneteTesoro, leggiTesoro, mettiNelTesoro, prendiDalTesoro, togliDalTesoro, type EsitoParty,
} from "../party";
import { usePolling } from "../usePolling";

interface Props {
  partyId: number;
  master: boolean;
  // Con la scheda del personaggio: si prende e si mette dallo Zaino e dalla borsa.
  scambi?: { char: CharacterData; setChar: SetChar };
}

const AGGIORNAMENTO = 8_000; // ms
const TAGLI: { k: keyof Monete; nome: string; colore: string }[] = [
  { k: "mp", nome: "mp", colore: "text-cyan-300" },
  { k: "mo", nome: "mo", colore: "text-amber-400" },
  { k: "me", nome: "me", colore: "text-teal-400" },
  { k: "ma", nome: "ma", colore: "text-slate-300" },
  { k: "mr", nome: "mr", colore: "text-orange-400" },
];
const campo = "bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-sm text-slate-100 outline-none focus:border-indigo-500";
const pulsanteNeutro = "flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700 disabled:opacity-50";

const quando = (iso: string) => new Date(iso).toLocaleString("it-IT", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

// Tesoro comune del party. La scheda cambia solo dopo la risposta positiva del server:
// se la chiamata fallisce non si duplicano né si perdono oggetti o monete.
export default function PannelloTesoro({ partyId, master, scambi }: Props) {
  const [tesoro, setTesoro] = useState<Tesoro | null>(null);
  const [messaggio, setMessaggio] = useState<string | null>(null);
  const [inCorso, setInCorso] = useState(false);
  const [moneta, setMoneta] = useState<{ k: keyof Monete; n: string }>({ k: "mo", n: "" });
  const [prelievo, setPrelievo] = useState<Record<number, string>>({});
  const [deposito, setDeposito] = useState<{ id: number | null; qta: string }>({ id: null, qta: "1" });
  const [bottino, setBottino] = useState({ nome: "", qta: "1", peso: "0" });
  const [tuttiMovimenti, setTuttiMovimenti] = useState(false);

  const carica = useCallback(async () => {
    const esito = await leggiTesoro(partyId);
    if (esito !== "sessione scaduta" && "dati" in esito) setTesoro(esito.dati);
  }, [partyId]);
  usePolling(carica, AGGIORNAMENTO);

  // Esegue la chiamata; se va a buon fine applica `poi` (alla scheda) e ricarica il tesoro.
  const esegui = async <T,>(azione: () => Promise<EsitoParty<T>>, poi?: (dati: T) => void) => {
    setInCorso(true);
    setMessaggio(null);
    const esito = await azione();
    setInCorso(false);
    if (esito === "sessione scaduta") return setMessaggio("Sessione scaduta: accedi di nuovo.");
    if ("errore" in esito) {
      setMessaggio(esito.errore);
      return void carica();
    }
    poi?.(esito.dati);
    await carica();
  };

  const n = Number(moneta.n);
  const moneteValide = Number.isInteger(n) && n > 0;
  const borsa = scambi?.char.monete[moneta.k] ?? 0;

  const metti = (e: FormEvent) => {
    e.preventDefault();
    if (!moneteValide) return;
    if (scambi && n > borsa) return setMessaggio(`Nella borsa hai solo ${borsa} ${moneta.k}.`);
    void esegui(() => cambiaMoneteTesoro(partyId, { [moneta.k]: n }), () => {
      scambi?.setChar(prev => cambiaMonete(prev, { [moneta.k]: -n }));
      setMoneta(m => ({ ...m, n: "" }));
    });
  };

  const prendi = () => {
    if (!moneteValide) return;
    void esegui(() => cambiaMoneteTesoro(partyId, { [moneta.k]: -n }), () => {
      scambi?.setChar(prev => cambiaMonete(prev, { [moneta.k]: n }));
      setMoneta(m => ({ ...m, n: "" }));
    });
  };

  const prendiOggetto = (id: number, disponibili: number) => {
    const qta = Math.min(disponibili, Math.max(1, Math.floor(Number(prelievo[id] ?? 1)) || 1));
    void esegui(() => prendiDalTesoro(partyId, id, qta), oggetto => {
      scambi?.setChar(prev => mettiNelloZaino(prev, oggetto, Date.now()));
      setPrelievo(p => ({ ...p, [id]: "1" }));
    });
  };

  const togliOggetto = (id: number, nome: string) => {
    if (confirm(`Togliere ${nome} dal tesoro (venduto, perso, usato…)?`)) void esegui(() => togliDalTesoro(partyId, id));
  };

  const mioOggetto = scambi?.char.inventario.find(i => i.id === deposito.id) ?? null;
  const deposita = (e: FormEvent) => {
    e.preventDefault();
    if (!mioOggetto) return;
    const qta = Math.floor(Number(deposito.qta));
    if (!(qta >= 1 && qta <= mioOggetto.qta)) return setMessaggio(`Puoi mettere da 1 a ${mioOggetto.qta} ${mioOggetto.nome}.`);
    const { id, ...campi } = mioOggetto;
    void esegui(() => mettiNelTesoro(partyId, { ...campi, qta }), () => {
      scambi?.setChar(prev => togliDalloZaino(prev, id, qta));
      setDeposito({ id: null, qta: "1" });
    });
  };

  const aggiungiBottino = (e: FormEvent) => {
    e.preventDefault();
    const qta = Math.floor(Number(bottino.qta));
    const peso = Number(bottino.peso.replace(",", "."));
    if (!bottino.nome.trim() || !(qta >= 1) || !(peso >= 0)) return;
    void esegui(() => mettiNelTesoro(partyId, { nome: bottino.nome.trim(), qta, peso }), () => setBottino({ nome: "", qta: "1", peso: "0" }));
  };

  if (!tesoro) return <div className="flex justify-center py-8"><LoaderCircle className="w-5 h-5 text-indigo-400 animate-spin" /></div>;

  const puoPrendere = !!scambi || master;
  const movimenti = tuttiMovimenti ? tesoro.movimenti : tesoro.movimenti.slice(0, 8);
  const depositabili = scambi?.char.inventario.filter(i => i.qta > 0) ?? [];

  return (
    <div className="space-y-3">
      {messaggio && (
        <p role="alert" className="text-sm text-amber-300 bg-amber-950/30 border border-amber-900/50 rounded-lg px-3 py-2">{messaggio}</p>
      )}

      <section className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
        <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2"><Coins className="w-4 h-4 text-amber-400" /> Monete del gruppo</h3>
        <div className="grid grid-cols-5 gap-2">
          {TAGLI.map(t => (
            <div key={t.k} className="bg-slate-950/80 border border-slate-800 rounded-lg p-2 text-center">
              <div className={`text-lg font-black ${t.colore}`}>{tesoro.monete[t.k]}</div>
              <div className="text-[10px] text-slate-500 uppercase">{t.nome}</div>
            </div>
          ))}
        </div>
        {puoPrendere && (
          <form onSubmit={metti} className="flex flex-wrap items-center gap-2">
            <input type="number" min={1} value={moneta.n} onChange={e => setMoneta(m => ({ ...m, n: e.target.value }))} placeholder="Quante" className={`${campo} w-24`} />
            <select value={moneta.k} onChange={e => setMoneta(m => ({ ...m, k: e.target.value as keyof Monete }))} className={campo}>
              {TAGLI.map(t => <option key={t.k} value={t.k}>{t.nome}</option>)}
            </select>
            <button type="submit" disabled={inCorso || !moneteValide} className={pulsanteNeutro}>
              <Plus className="w-3.5 h-3.5" /> {scambi ? "Metti dalla borsa" : "Aggiungi"}
            </button>
            <button type="button" onClick={prendi} disabled={inCorso || !moneteValide || tesoro.monete[moneta.k] < n} className={pulsanteNeutro}>
              <Minus className="w-3.5 h-3.5" /> {scambi ? "Prendi nella borsa" : "Togli"}
            </button>
            {scambi && <span className="text-xs text-slate-500">Nella tua borsa: {borsa} {moneta.k}</span>}
          </form>
        )}
      </section>

      <section className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
        <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2"><Gem className="w-4 h-4 text-violet-400" /> Oggetti del gruppo</h3>
        {tesoro.oggetti.length === 0 && <p className="text-sm text-slate-500">Il tesoro non contiene oggetti.</p>}
        <ul className="space-y-1.5">
          {tesoro.oggetti.map(o => (
            <li key={o.id} className="flex flex-wrap items-center gap-2 text-sm">
              <span className="flex-1 min-w-0 text-slate-200 truncate">
                {o.nome} <span className="text-slate-500">×{o.qta}</span>
                {o.peso > 0 && <span className="text-xs text-slate-500"> • {o.peso} kg</span>}
              </span>
              {scambi && (
                <>
                  {o.qta > 1 && (
                    <input type="number" min={1} max={o.qta} value={prelievo[o.id] ?? "1"}
                      onChange={e => setPrelievo(p => ({ ...p, [o.id]: e.target.value }))} className={`${campo} w-16 py-1`} />
                  )}
                  <button onClick={() => prendiOggetto(o.id, o.qta)} disabled={inCorso} className={pulsanteNeutro}>Prendi</button>
                </>
              )}
              {master && (
                <button onClick={() => togliOggetto(o.id, o.nome)} disabled={inCorso} title="Togli dal tesoro" className="p-1 text-slate-500 hover:text-rose-300">
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </li>
          ))}
        </ul>

        {scambi && depositabili.length > 0 && (
          <form onSubmit={deposita} className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-800">
            <select value={deposito.id ?? ""} onChange={e => setDeposito({ id: e.target.value ? Number(e.target.value) : null, qta: "1" })}
              className={`${campo} flex-1 min-w-40`}>
              <option value="">Metti un oggetto dello Zaino…</option>
              {depositabili.map(i => <option key={i.id} value={i.id}>{i.nome} (×{i.qta})</option>)}
            </select>
            {mioOggetto && mioOggetto.qta > 1 && (
              <input type="number" min={1} max={mioOggetto.qta} value={deposito.qta} onChange={e => setDeposito(d => ({ ...d, qta: e.target.value }))}
                className={`${campo} w-16`} />
            )}
            <button type="submit" disabled={inCorso || !mioOggetto} className={pulsanteNeutro}><PackagePlus className="w-3.5 h-3.5" /> Metti</button>
          </form>
        )}

        {master && !scambi && (
          <form onSubmit={aggiungiBottino} className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-800">
            <input value={bottino.nome} onChange={e => setBottino(b => ({ ...b, nome: e.target.value }))} maxLength={120}
              placeholder="Bottino trovato" className={`${campo} flex-1 min-w-40`} />
            <input type="number" min={1} value={bottino.qta} onChange={e => setBottino(b => ({ ...b, qta: e.target.value }))}
              title="Quantità" className={`${campo} w-16`} />
            <input inputMode="decimal" value={bottino.peso} onChange={e => setBottino(b => ({ ...b, peso: e.target.value }))}
              title="Peso per unità (kg)" className={`${campo} w-16`} />
            <span className="text-xs text-slate-500">kg</span>
            <button type="submit" disabled={inCorso || !bottino.nome.trim()} className={pulsanteNeutro}><PackagePlus className="w-3.5 h-3.5" /> Aggiungi</button>
          </form>
        )}
      </section>

      {tesoro.movimenti.length > 0 && (
        <section className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2">
          <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2"><History className="w-4 h-4 text-slate-400" /> Storico</h3>
          <ul className="space-y-1 text-xs">
            {movimenti.map(m => (
              <li key={m.id} className="flex gap-2">
                <span className="text-slate-500 shrink-0">{quando(m.creato)}</span>
                <span className="text-slate-300"><span className="font-semibold text-slate-100">{m.chi}</span> {m.descrizione}</span>
              </li>
            ))}
          </ul>
          {tesoro.movimenti.length > movimenti.length && (
            <button onClick={() => setTuttiMovimenti(true)} className="text-xs text-slate-400 hover:text-slate-200 underline">Mostra tutto</button>
          )}
        </section>
      )}
    </div>
  );
}
