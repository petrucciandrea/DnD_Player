import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { Crown, Lock, LoaderCircle, MessagesSquare, Send } from "lucide-react";
import type { MembroParty, MessaggioParty } from "@dnd/regole/api.ts";
import { conversazioneDi, nonLettiPer, type Chat } from "../messaggi";

interface Props {
  io: number;
  membri: MembroParty[];
  chat: Chat;
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
export default function PartyChat({ io, membri, chat }: Props) {
  const [conversazione, setConversazione] = useState(0);
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

      <form onSubmit={invia} className="flex items-end gap-2 p-2 border-t border-slate-800 bg-slate-950/40">
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

function Fumetto({ m, mio, conNome }: { m: MessaggioParty; mio: boolean; conNome: boolean }) {
  return (
    <div className={`flex flex-col ${mio ? "items-end" : "items-start"}`}>
      {conNome && !mio && (
        <span className={`text-[11px] font-semibold px-1 ${m.ruoloAutore === "master" ? "text-amber-300" : "text-indigo-300"}`}>{m.autore}</span>
      )}
      <div className={`max-w-[85%] rounded-2xl px-3 py-1.5 text-sm whitespace-pre-wrap break-words ${mio
        ? "bg-indigo-600 text-white rounded-br-sm" : "bg-slate-800 text-slate-100 rounded-bl-sm"}`}>
        {m.testo}
        <span className={`ml-2 text-[10px] align-bottom ${mio ? "text-indigo-200/80" : "text-slate-500"}`}>{orario(m.creato)}</span>
      </div>
    </div>
  );
}
