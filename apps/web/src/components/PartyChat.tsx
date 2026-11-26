import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { Crown, Dices, Eye, Lock, LoaderCircle, MessagesSquare, Send } from "lucide-react";
import { esitoTiroCondiviso, formulaTiro, segno } from "@dnd/regole/regole.ts";
import type { MembroParty, MessaggioParty } from "@dnd/regole/api.ts";
import { conversazioneDi, nonLettiPer, type Chat } from "../messaggi";
import { inviaTiro, type ControllaEsito } from "../party";
import {
  condivisioneSalvata, salvaCondivisione, useRichiestaTiro, type Condivisione, type Dado, type RispostaTiro,
} from "../tiroDadi";
import DialogoTiro from "./DialogoTiro";

interface Props {
  partyId: number;
  io: number;
  master: boolean;
  membri: MembroParty[];
  chat: Chat;
  riuscito: ControllaEsito;
}

const LUNGHEZZA_MASSIMA = 2000;

const nomeMembro = (m: MembroParty) => (m.ruolo === "master" ? "Master" : m.personaggio?.nome || m.username);

function orario(iso: string) {
  const data = new Date(iso);
  const oggi = new Date().toDateString() === data.toDateString();
  return data.toLocaleString("it-IT", oggi
    ? { hour: "2-digit", minute: "2-digit" }
    : { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

// Chat del party: la conversazione di gruppo e una privata con ogni altro membro.
export default function PartyChat({ partyId, io, master, membri, chat, riuscito }: Props) {
  const [conversazione, setConversazione] = useState(0);
  const [dadi, setDadi] = useState(false); // barra dei tiri liberi aperta
  const [testo, setTesto] = useState("");
  const [inInvio, setInInvio] = useState(false);
  const [inCaricamento, setInCaricamento] = useState(false);
  const elenco = useRef<HTMLDivElement>(null);

  const altri = membri.filter(m => m.utenteId !== io);
  const conversazioni = [{ id: 0, nome: "Gruppo", master: false }, ...altri.map(m => ({ id: m.utenteId, nome: nomeMembro(m), master: m.ruolo === "master" }))];
  // Se l'altro membro esce dal party si torna al gruppo.
  const attuale = conversazioni.some(c => c.id === conversazione) ? conversazione : 0;
  const messaggi = chat.messaggi;
  const visibili = useMemo(() => (messaggi ?? []).filter(m => conversazioneDi(m, io) === attuale), [messaggi, io, attuale]);
  const nonLetti = nonLettiPer(messaggi ?? [], chat.letture, io);
  const ultimoVisibile = visibili.at(-1)?.id;

  // La conversazione aperta si considera letta fino all'ultimo messaggio.
  const { segna } = chat;
  useEffect(() => {
    if (ultimoVisibile !== undefined) void segna(attuale, ultimoVisibile);
  }, [segna, attuale, ultimoVisibile]);

  // A ogni messaggio nuovo (non caricando i precedenti) si scende in fondo.
  useEffect(() => {
    const el = elenco.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [ultimoVisibile, attuale]);

  const invia = async (e?: FormEvent) => {
    e?.preventDefault();
    const pulito = testo.trim();
    if (!pulito || inInvio) return;
    setInInvio(true);
    const ok = await chat.invia(pulito, attuale === 0 ? null : attuale);
    setInInvio(false);
    if (ok) setTesto("");
  };

  const tasto = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      void invia();
    }
  };

  const caricaPrecedenti = async () => {
    setInCaricamento(true);
    await chat.precedenti();
    setInCaricamento(false);
  };

  const destinatario = conversazioni.find(c => c.id === attuale)!;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden flex flex-col h-[70vh] min-h-96">
      <div className="flex gap-1 overflow-x-auto p-2 border-b border-slate-800 bg-slate-950/40">
        {conversazioni.map(c => (
          <button
            key={c.id}
            onClick={() => setConversazione(c.id)}
            className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${attuale === c.id
              ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"}`}
          >
            {c.id === 0 ? <MessagesSquare className="w-3.5 h-3.5" /> : c.master ? <Crown className="w-3.5 h-3.5" /> : <Lock className="w-3 h-3" />}
            {c.nome}
            {(nonLetti[c.id] ?? 0) > 0 && (
              <span className="min-w-4 px-1 rounded-full bg-rose-500 text-white text-[10px] leading-4 text-center">{nonLetti[c.id]}</span>
            )}
          </button>
        ))}
      </div>

      <div ref={elenco} className="flex-1 overflow-y-auto p-3 space-y-2">
        {messaggi === null && <div className="flex justify-center py-6"><LoaderCircle className="w-5 h-5 text-indigo-400 animate-spin" /></div>}
        {messaggi !== null && !chat.finiti && (
          <div className="flex justify-center">
            <button onClick={caricaPrecedenti} disabled={inCaricamento} className="text-xs text-slate-400 hover:text-slate-200 underline disabled:opacity-50">
              Messaggi precedenti
            </button>
          </div>
        )}
        {attuale !== 0 && (
          <p className="text-center text-[11px] text-slate-500 flex items-center justify-center gap-1">
            <Lock className="w-3 h-3" /> Messaggi privati con {destinatario.nome}: li vedete solo voi due.
          </p>
        )}
        {messaggi !== null && visibili.length === 0 && (
          <p className="text-center text-sm text-slate-500 py-6">Ancora nessun messaggio.</p>
        )}
        {visibili.map((m, i) => <Fumetto key={m.id} m={m} mio={m.autoreId === io} conNome={visibili[i - 1]?.autoreId !== m.autoreId} />)}
      </div>

      {dadi && <TiroLibero partyId={partyId} master={master} riuscito={riuscito} onInviato={chat.aggiorna} />}

      <form onSubmit={invia} className="flex items-end gap-2 p-2 border-t border-slate-800 bg-slate-950/40">
        <button type="button" onClick={() => setDadi(a => !a)} aria-pressed={dadi} title={dadi ? "Chiudi i dadi" : "Tira dei dadi"}
          className={`p-2.5 rounded-lg border transition ${dadi ? "bg-amber-500/20 border-amber-500/40 text-amber-300" : "bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200"}`}>
          <Dices className="w-4 h-4" />
        </button>
        <textarea
          value={testo}
          onChange={e => setTesto(e.target.value)}
          onKeyDown={tasto}
          maxLength={LUNGHEZZA_MASSIMA}
          rows={Math.min(4, Math.max(1, testo.split("\n").length))}
          placeholder={attuale === 0 ? "Scrivi al gruppo…" : `Scrivi a ${destinatario.nome}…`}
          className="flex-1 resize-none bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 outline-none focus:border-indigo-500"
        />
        <button type="submit" disabled={inInvio || !testo.trim()} title="Invia (Invio)"
          className="p-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white transition">
          {inInvio ? <LoaderCircle className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </button>
      </form>
    </div>
  );
}

const DADI_RAPIDI = [4, 6, 8, 10, 12, 20, 100];

// Tiro libero (dadi rapidi o una formula come "2d6+3"), soprattutto per il Master, che non ha una scheda.
// Passa dal dialogo di tutti i tiri; il risultato si pubblica nella chat (al gruppo o, per un giocatore, solo al Master).
function TiroLibero({ partyId, master, riuscito, onInviato }: {
  partyId: number; master: boolean; riuscito: ControllaEsito; onInviato: () => Promise<void>;
}) {
  const [formula, setFormula] = useState("");
  const [titolo, setTitolo] = useState("");
  const [ultimo, setUltimo] = useState<string | null>(null);
  const [condivisione, setCondivisione] = useState<Condivisione>(() => {
    const c = condivisioneSalvata();
    return master && c === "master" ? "gruppo" : c;
  });
  const { richiesta, chiediTiro, chiediD20, rispondi } = useRichiestaTiro();
  const letta = formulaTiro(formula);

  const tira = (testo: string) => {
    const f = formulaTiro(testo);
    if (!f) return;
    const nome = titolo.trim() || `Tiro ${testo.replace(/\s+/g, "")}`;
    // Un solo d20: con vantaggio o svantaggio.
    if (f.dadi.length === 1 && f.dadi[0].numero === 1 && f.dadi[0].facce === 20) {
      void chiediD20({ titolo: nome, bonus: f.bonus });
      return;
    }
    const quanti = f.dadi.reduce((acc, d) => acc + d.numero, 0);
    let n = 0;
    const elenco: Dado[] = f.dadi.flatMap(d => Array.from({ length: d.numero }, () => {
      n += 1;
      return { etichetta: quanti === 1 ? "Risultato" : `${n}° dado`, facce: d.facce };
    }));
    void chiediTiro({ titolo: nome, dadi: elenco, bonus: f.bonus, ammettiTotale: true });
  };

  const rispondiTiro = (risposta: RispostaTiro | null) => {
    if (risposta && richiesta) {
      const tiro = esitoTiroCondiviso(richiesta, risposta);
      setUltimo(`${tiro.titolo}: ${tiro.totale}${tiro.tiri.length > 1 || tiro.bonus !== 0 ? ` (${tiro.tiri.join(" + ")}${tiro.bonus !== 0 ? ` ${segno(tiro.bonus)}` : ""})` : ""}`);
      if (condivisione !== "no") {
        void inviaTiro(partyId, tiro, condivisione === "master").then(async esito => {
          if (riuscito(esito)) await onInviato();
        });
      }
    }
    rispondi(risposta);
  };

  const scegli = (c: Condivisione) => {
    setCondivisione(c);
    salvaCondivisione(c);
  };

  const campo = "bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-sm text-slate-100 outline-none focus:border-indigo-500";
  return (
    <div className="p-2 border-t border-slate-800 bg-slate-950/60 space-y-2">
      <div className="flex flex-wrap gap-1">
        {DADI_RAPIDI.map(f => (
          <button key={f} type="button" onClick={() => tira(`1d${f}`)}
            className="px-2 py-1 rounded-md bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-mono font-semibold text-slate-200">
            d{f}
          </button>
        ))}
      </div>
      <form onSubmit={e => { e.preventDefault(); tira(formula); }} className="flex flex-wrap gap-2">
        <input value={formula} onChange={e => setFormula(e.target.value)} placeholder="2d6+3" aria-label="Formula del tiro"
          className={`${campo} w-28 font-mono ${formula && !letta ? "border-rose-700" : ""}`} />
        <input value={titolo} onChange={e => setTitolo(e.target.value)} maxLength={100} placeholder="Per cosa? (facoltativo)"
          className={`${campo} flex-1 min-w-32`} />
        <button type="submit" disabled={!letta}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold">
          <Dices className="w-4 h-4" /> Tira
        </button>
      </form>
      {ultimo && <p className="text-xs text-slate-400">Ultimo tiro: <span className="text-slate-200 font-semibold">{ultimo}</span></p>}
      {richiesta && (
        <DialogoTiro key={richiesta.id} richiesta={richiesta} onRisposta={rispondiTiro}
          condivisione={{ scelta: condivisione, onScelta: scegli, ...(master ? { opzioni: ["no", "gruppo"] as Condivisione[] } : {}) }} />
      )}
    </div>
  );
}

function Fumetto({ m, mio, conNome }: { m: MessaggioParty; mio: boolean; conNome: boolean }) {
  return (
    <div className={`flex flex-col ${mio ? "items-end" : "items-start"}`}>
      {conNome && !mio && (
        <span className={`text-[11px] font-semibold px-1 ${m.ruoloAutore === "master" ? "text-amber-300" : "text-indigo-300"}`}>{m.autore}</span>
      )}
      {m.tiro ? <CartaTiro m={m} mio={mio} /> : <div className={`max-w-[85%] rounded-2xl px-3 py-1.5 text-sm whitespace-pre-wrap break-words ${mio
        ? "bg-indigo-600 text-white rounded-br-sm" : "bg-slate-800 text-slate-100 rounded-bl-sm"}`}>
        {m.testo}
        <span className={`ml-2 text-[10px] align-bottom ${mio ? "text-indigo-200/80" : "text-slate-500"}`}>{orario(m.creato)}</span>
      </div>}
    </div>
  );
}

const ETICHETTE_MODALITA = { normale: null, vantaggio: "Vantaggio", svantaggio: "Svantaggio" } as const;

// Un tiro di dadi pubblicato: dadi, modalità, bonus e il totale in grande. Segreto se è privato (solo al Master).
function CartaTiro({ m, mio }: { m: MessaggioParty; mio: boolean }) {
  const t = m.tiro!;
  const modalita = ETICHETTE_MODALITA[t.modalita];
  // Con vantaggio o svantaggio uno dei due d20 non conta.
  const scartato = modalita ? t.tiri.indexOf(t.modalita === "vantaggio" ? Math.min(...t.tiri) : Math.max(...t.tiri)) : -1;
  const critico = t.dadi.every(d => d.facce === 20) && t.totale - t.bonus === 20;
  const fallimento = t.dadi.every(d => d.facce === 20) && t.totale - t.bonus === 1;
  return (
    <div className={`w-64 max-w-[85%] rounded-2xl border px-3 py-2 space-y-1.5 ${mio ? "bg-indigo-950/60 border-indigo-500/40" : "bg-slate-800/80 border-slate-700"}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="text-sm font-bold text-slate-100 flex items-center gap-1.5 min-w-0">
          <Dices className="w-4 h-4 text-amber-400 shrink-0" /> <span className="truncate">{t.titolo}</span>
        </div>
        <span className="text-[10px] text-slate-500 shrink-0">{orario(m.creato)}</span>
      </div>
      {t.descrizione && <p className="text-[11px] text-slate-400">{t.descrizione}</p>}
      <div className="flex items-end justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1 text-xs">
          {t.tiri.map((n, i) => (
            <span key={i} title={t.dadi[i] ? `d${t.dadi[i].facce}` : undefined}
              className={`px-1.5 py-0.5 rounded-md border font-mono ${i === scartato ? "border-slate-700 text-slate-500 line-through" : "border-slate-600 text-slate-200"}`}>
              {n}
            </span>
          ))}
          {t.bonus !== 0 && <span className="text-slate-400 font-mono">{segno(t.bonus)}</span>}
        </div>
        <div className={`text-3xl font-black leading-none ${critico ? "text-emerald-400" : fallimento ? "text-rose-400" : "text-white"}`}>{t.totale}</div>
      </div>
      <div className="flex flex-wrap gap-1">
        {modalita && (
          <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${t.modalita === "vantaggio" ? "bg-emerald-600/20 text-emerald-300" : "bg-rose-600/20 text-rose-300"}`}>
            {modalita}
          </span>
        )}
        {t.presagio && <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-indigo-600/20 text-indigo-300 flex items-center gap-1"><Eye className="w-3 h-3" /> Presagio</span>}
        {critico && <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-600/20 text-emerald-300">20 naturale</span>}
        {fallimento && <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-rose-600/20 text-rose-300">1 naturale</span>}
        {m.destinatarioId !== null && (
          <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-600/20 text-amber-300 flex items-center gap-1"><Lock className="w-3 h-3" /> Segreto</span>
        )}
      </div>
    </div>
  );
}
