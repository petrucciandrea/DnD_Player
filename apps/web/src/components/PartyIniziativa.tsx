import { useCallback, useState, type FormEvent } from "react";
import {
  ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Dices, Eye, EyeOff, Heart, LoaderCircle, Plus, Shield, Skull, Square, Swords, Trash2,
} from "lucide-react";
import type { Combattimento, MembroParty, RiepilogoPersonaggioParty, RuoloParty, VoceIniziativa } from "@dnd/regole/api.ts";
import { CONDIZIONI, condizione } from "@dnd/regole/dati/condizioni.ts";
import { segno, type StatoSalute } from "@dnd/regole/regole.ts";
import {
  aggiungiVoceIniziativa, avanzaTurno, avviaCombattimento, leggiCombattimento, mandaIniziativa, modificaVoceIniziativa,
  terminaCombattimento, togliVoceIniziativa, type ControllaEsito, type DatiVoceIniziativa, type EsitoParty,
} from "../party";
import { useRichiestaTiro } from "../tiroDadi";
import { usePolling } from "../usePolling";
import DialogoTiro from "./DialogoTiro";

interface Props {
  partyId: number;
  ruolo: RuoloParty;
  mio: RiepilogoPersonaggioParty | null; // il personaggio dell'utente (null per il Master)
  membri: MembroParty[]; // per mostrare al Master CA, PF e condizioni dei personaggi
  riuscito: ControllaEsito;
}

const AGGIORNAMENTO = 4_000; // ms
const campo = "bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-sm text-slate-100 outline-none focus:border-indigo-500";
const pulsanteNeutro = "flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700 disabled:opacity-50";

const STATI: Record<StatoSalute, { testo: string; colore: string }> = {
  illeso: { testo: "Illeso", colore: "bg-emerald-600/20 text-emerald-300 border-emerald-500/30" },
  ferito: { testo: "Ferito", colore: "bg-amber-600/20 text-amber-300 border-amber-500/30" },
  "gravemente ferito": { testo: "Gravemente ferito", colore: "bg-rose-600/20 text-rose-300 border-rose-500/30" },
  sconfitto: { testo: "Sconfitto", colore: "bg-slate-700/60 text-slate-300 border-slate-600" },
};

const intero = (v: string) => (v.trim() !== "" && Number.isInteger(Number(v)) ? Number(v) : null);

// Ordine d'iniziativa dello scontro in corso. Il Master avvia, aggiunge mostri con CA, PF, condizioni e note
// e fa avanzare i turni; ogni giocatore tira (o inserisce) l'iniziativa del suo personaggio e dei mostri
// vede solo il nome e lo stato di salute.
export default function PartyIniziativa({ partyId, ruolo, mio, membri, riuscito }: Props) {
  const [comb, setComb] = useState<Combattimento | null>(null);
  const [inCorso, setInCorso] = useState(false);
  const [valoreMio, setValoreMio] = useState("");
  const [mostro, setMostro] = useState({ nome: "", valore: "", bonus: "", ca: "", pf: "", nascosto: false });
  const { richiesta, chiediD20, rispondi } = useRichiestaTiro();
  const master = ruolo === "master";

  const carica = useCallback(async () => {
    const esito = await leggiCombattimento(partyId);
    if (riuscito(esito)) setComb(esito.dati);
  }, [partyId, riuscito]);
  usePolling(carica, AGGIORNAMENTO);

  const esegui = async (azione: () => Promise<EsitoParty<unknown>>) => {
    setInCorso(true);
    const ok = riuscito(await azione());
    if (ok) await carica();
    setInCorso(false);
    return ok;
  };

  const tiraMia = async () => {
    if (!mio) return;
    const { bonus, modalita, note } = mio.iniziativa;
    const r = await chiediD20({ titolo: "Iniziativa", tipo: "prova", bonus, modalita, descrizione: note.join(" ") || undefined });
    if (r) await esegui(() => mandaIniziativa(partyId, r.risultato + bonus));
  };

  const inviaMia = async (e: FormEvent) => {
    e.preventDefault();
    const v = intero(valoreMio);
    if (v === null) return;
    if (await esegui(() => mandaIniziativa(partyId, v))) setValoreMio("");
  };

  const bonusMostro = intero(mostro.bonus) ?? 0;
  const aggiungiMostro = async (valore: number) => {
    const pf = intero(mostro.pf);
    const ok = await esegui(() => aggiungiVoceIniziativa(partyId, {
      nome: mostro.nome.trim(), valore, bonus: bonusMostro, nascosto: mostro.nascosto,
      ...(intero(mostro.ca) !== null ? { ca: intero(mostro.ca) } : {}),
      ...(pf !== null && pf > 0 ? { pfMassimi: pf } : {}),
    }));
    if (ok) setMostro(m => ({ ...m, nome: "", valore: "" }));
  };

  const inviaMostro = (e: FormEvent) => {
    e.preventDefault();
    const v = intero(mostro.valore);
    if (mostro.nome.trim() && v !== null) void aggiungiMostro(v);
  };

  const tiraMostro = async () => {
    if (!mostro.nome.trim()) return;
    const r = await chiediD20({ titolo: `Iniziativa: ${mostro.nome.trim()}`, bonus: bonusMostro });
    if (r) await aggiungiMostro(r.risultato + bonusMostro);
  };

  const termina = () => {
    if (confirm("Terminare lo scontro? L'ordine d'iniziativa verrà cancellato.")) void esegui(() => terminaCombattimento(partyId));
  };

  if (!comb) return <div className="flex justify-center py-8"><LoaderCircle className="w-5 h-5 text-indigo-400 animate-spin" /></div>;

  const dialogo = richiesta && <DialogoTiro key={richiesta.id} richiesta={richiesta} onRisposta={rispondi} />;

  if (!comb.attivo) {
    return (
      <div className="bg-slate-900 border border-dashed border-slate-700 rounded-xl p-6 text-center space-y-3">
        <Swords className="w-8 h-8 text-slate-600 mx-auto" />
        <p className="text-sm text-slate-400">
          {master ? "Nessuno scontro in corso. Avvialo quando si tira l'iniziativa." : "Nessuno scontro in corso: il Master lo avvierà quando si combatte."}
        </p>
        {master && (
          <button onClick={() => esegui(() => avviaCombattimento(partyId))} disabled={inCorso}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white text-sm font-semibold">
            <Swords className="w-4 h-4" /> Avvia combattimento
          </button>
        )}
        {dialogo}
      </div>
    );
  }

  const mia = mio ? comb.voci.find(v => v.personaggioId === mio.id) : undefined;
  const diTurno = comb.voci.find(v => v.id === comb.diTurno);
  const schedaDi = (v: VoceIniziativa) => (v.personaggioId === null ? null : membri.find(m => m.personaggio?.id === v.personaggioId)?.personaggio ?? null);

  return (
    <div className="space-y-3">
      <div className="bg-slate-900 border border-rose-500/30 rounded-xl p-3 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Swords className="w-5 h-5 text-rose-400" />
          <div>
            <div className="text-sm font-bold text-slate-100">Round {comb.round}</div>
            <div className="text-xs text-slate-400">
              {diTurno ? <>Di turno: <span className="text-amber-300 font-semibold">{diTurno.nome}</span></> : "Il primo turno non è ancora iniziato"}
            </div>
          </div>
        </div>
        {master && (
          <div className="flex gap-2 ml-auto">
            <button onClick={() => esegui(() => avanzaTurno(partyId, -1))} disabled={inCorso} title="Turno precedente" className={pulsanteNeutro}>
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button onClick={() => esegui(() => avanzaTurno(partyId, 1))} disabled={inCorso || comb.voci.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold">
              {diTurno ? "Turno successivo" : "Inizia"} <ChevronRight className="w-4 h-4" />
            </button>
            <button onClick={termina} disabled={inCorso} title="Termina lo scontro" className={`${pulsanteNeutro} hover:text-rose-300`}>
              <Square className="w-3.5 h-3.5" /> Termina
            </button>
          </div>
        )}
      </div>

      {mio && (
        <form onSubmit={inviaMia} className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex flex-wrap items-center gap-2">
          <span className="text-sm text-slate-300">
            {mia ? <>La tua iniziativa: <span className="font-black text-white">{mia.valore}</span></> : "Tira l'iniziativa"}
            <span className="text-xs text-slate-500"> (modificatore {segno(mio.iniziativa.bonus)})</span>
          </span>
          <div className="flex gap-2 ml-auto">
            <button type="button" onClick={tiraMia} disabled={inCorso}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold">
              <Dices className="w-4 h-4" /> {mia ? "Ritira" : "Tira"}
            </button>
            <input type="number" value={valoreMio} onChange={e => setValoreMio(e.target.value)} placeholder="Totale" className={`${campo} w-20`} />
            <button type="submit" disabled={inCorso || intero(valoreMio) === null} className={pulsanteNeutro}>Inserisci</button>
          </div>
        </form>
      )}

      <ol className="space-y-1.5">
        {comb.voci.map((v, i) => (
          <RigaIniziativa key={v.id} voce={v} posizione={i + 1} diTurno={v.id === comb.diTurno} mia={v.id === mia?.id}
            master={master} inCorso={inCorso} scheda={schedaDi(v)}
            onModifica={dati => esegui(() => modificaVoceIniziativa(partyId, v.id, dati))}
            onTogli={() => { if (confirm(`Togliere ${v.nome} dall'iniziativa?`)) void esegui(() => togliVoceIniziativa(partyId, v.id)); }}
          />
        ))}
        {comb.voci.length === 0 && (
          <li className="text-sm text-slate-500 text-center py-4">Ancora nessuno: i giocatori tirano l'iniziativa, il Master aggiunge i mostri.</li>
        )}
      </ol>

      {master && (
        <form onSubmit={inviaMostro} className="bg-slate-900 border border-slate-800 rounded-xl p-3 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Skull className="w-4 h-4 text-slate-500" />
            <input value={mostro.nome} onChange={e => setMostro(m => ({ ...m, nome: e.target.value }))} maxLength={60}
              placeholder="Mostro o PNG" className={`${campo} flex-1 min-w-32`} />
            <input type="number" min={0} value={mostro.ca} onChange={e => setMostro(m => ({ ...m, ca: e.target.value }))}
              placeholder="CA" title="Classe Armatura" className={`${campo} w-16`} />
            <input type="number" min={1} value={mostro.pf} onChange={e => setMostro(m => ({ ...m, pf: e.target.value }))}
              placeholder="PF" title="Punti ferita massimi" className={`${campo} w-16`} />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input type="number" value={mostro.bonus} onChange={e => setMostro(m => ({ ...m, bonus: e.target.value }))}
              placeholder="Mod. iniz." title="Modificatore d'iniziativa" className={`${campo} w-24`} />
            <button type="button" onClick={tiraMostro} disabled={inCorso || !mostro.nome.trim()} title="Tira l'iniziativa del mostro" className={pulsanteNeutro}>
              <Dices className="w-4 h-4" /> Tira
            </button>
            <input type="number" value={mostro.valore} onChange={e => setMostro(m => ({ ...m, valore: e.target.value }))}
              placeholder="Iniziativa" className={`${campo} w-24`} />
            <label className="flex items-center gap-1 text-xs text-slate-400" title="I giocatori non lo vedono finché non lo mostri">
              <input type="checkbox" checked={mostro.nascosto} onChange={e => setMostro(m => ({ ...m, nascosto: e.target.checked }))} className="accent-indigo-500" />
              Nascosto
            </label>
            <button type="submit" disabled={inCorso || !mostro.nome.trim() || intero(mostro.valore) === null} className={`${pulsanteNeutro} ml-auto`}>
              <Plus className="w-4 h-4" /> Aggiungi
            </button>
          </div>
          <p className="text-[11px] text-slate-500">
            CA, PF, condizioni e note li vedi solo tu; ai giocatori arrivano il nome e uno stato (Illeso, Ferito, Gravemente ferito, Sconfitto).
          </p>
        </form>
      )}
      {dialogo}
    </div>
  );
}

const ChipStato = ({ stato }: { stato: StatoSalute }) => (
  <span className={`px-1.5 py-0.5 rounded border text-[10px] font-semibold ${STATI[stato].colore}`}>{STATI[stato].testo}</span>
);

function BarraPf({ pf, massimi, temporanei = 0 }: { pf: number; massimi: number; temporanei?: number }) {
  const quota = massimi > 0 ? Math.min(1, pf / massimi) : 0;
  const colore = pf === 0 ? "bg-slate-600" : quota <= 0.25 ? "bg-rose-500" : quota <= 0.5 ? "bg-amber-500" : "bg-emerald-500";
  return (
    <div className="flex items-center gap-1.5 text-xs">
      <Heart className="w-3.5 h-3.5 text-rose-400" />
      <span className="font-semibold text-slate-200 tabular-nums">{pf}/{massimi}{temporanei > 0 && <span className="text-sky-400"> +{temporanei}</span>}</span>
      <div className="w-16 h-1.5 rounded-full bg-slate-800 overflow-hidden"><div className={`h-full ${colore}`} style={{ width: `${quota * 100}%` }} /></div>
    </div>
  );
}

function RigaIniziativa({ voce, posizione, diTurno, mia, master, inCorso, scheda, onModifica, onTogli }: {
  voce: VoceIniziativa; posizione: number; diTurno: boolean; mia: boolean; master: boolean; inCorso: boolean;
  scheda: RiepilogoPersonaggioParty | null; // la voce è di un personaggio del party
  onModifica: (dati: DatiVoceIniziativa) => void; onTogli: () => void;
}) {
  const [valore, setValore] = useState(String(voce.valore));
  const [ultimo, setUltimo] = useState(voce.valore);
  const [aperta, setAperta] = useState(false);
  const [quantita, setQuantita] = useState("");
  // Il valore arrivato dal server (un altro l'ha cambiato) sostituisce quello nel campo.
  if (ultimo !== voce.valore) {
    setUltimo(voce.valore);
    setValore(String(voce.valore));
  }
  const salvaValore = () => {
    const v = intero(valore);
    if (v !== null && v !== voce.valore) onModifica({ valore: v });
    else setValore(String(voce.valore));
  };

  const mostro = voce.personaggioId === null;
  const sconfitto = voce.stato === "sconfitto";
  const n = intero(quantita);
  const cambiaPf = (segnoDelta: 1 | -1) => {
    if (n === null || n <= 0 || voce.pf === null || voce.pfMassimi === null) return;
    onModifica({ pf: Math.max(0, Math.min(voce.pfMassimi, voce.pf + segnoDelta * n)) });
    setQuantita("");
  };
  const condizioni = mostro ? voce.condizioni : scheda?.condizioni ?? [];

  return (
    <li className={`rounded-xl border px-3 py-2 space-y-2 ${diTurno
      ? "bg-amber-500/10 border-amber-500/50" : mia ? "bg-indigo-500/10 border-indigo-500/40" : "bg-slate-900 border-slate-800"} ${voce.nascosto || sconfitto ? "opacity-60" : ""}`}>
      <div className="flex items-center gap-3">
        <span className="w-5 text-xs text-slate-500 text-right">{posizione}</span>
        {master ? (
          <input type="number" value={valore} onChange={e => setValore(e.target.value)} onBlur={salvaValore}
            onKeyDown={e => { if (e.key === "Enter") e.currentTarget.blur(); }} disabled={inCorso} title="Iniziativa"
            className="w-14 bg-slate-950 border border-slate-800 rounded-lg px-1 py-1 text-center font-black text-white outline-none focus:border-indigo-500" />
        ) : (
          <span className="w-10 text-center text-lg font-black text-white">{voce.valore}</span>
        )}
        <div className="flex-1 min-w-0">
          <div className={`font-semibold truncate ${mostro ? "text-rose-200" : "text-slate-100"} ${sconfitto ? "line-through" : ""}`}>
            {mostro && <Skull className="w-3.5 h-3.5 inline mr-1 text-rose-400" />}
            {voce.nome}{mia && <span className="text-indigo-300 font-normal text-xs"> (tu)</span>}
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {diTurno && <span className="text-[11px] text-amber-300 font-semibold">{mia ? "Tocca a te!" : "Di turno"}</span>}
            {voce.stato && (!master || sconfitto) && <ChipStato stato={voce.stato} />}
            {master && (mostro ? voce.ca : scheda?.ca) != null && (
              <span className="flex items-center gap-1 text-xs text-indigo-200" title="Classe Armatura">
                <Shield className="w-3.5 h-3.5 text-indigo-400" /> {mostro ? voce.ca : scheda?.ca}
              </span>
            )}
            {master && mostro && voce.pf !== null && voce.pfMassimi !== null && <BarraPf pf={voce.pf} massimi={voce.pfMassimi} />}
            {master && scheda && <BarraPf pf={scheda.pf} massimi={scheda.pfMassimi} temporanei={scheda.pfTemporanei} />}
          </div>
        </div>
        <span className="text-[11px] text-slate-500" title="Modificatore d'iniziativa">{segno(voce.bonus)}</span>
        {master && (
          <>
            <button onClick={() => onModifica({ nascosto: !voce.nascosto })} disabled={inCorso}
              title={voce.nascosto ? "Mostra ai giocatori" : "Nascondi ai giocatori"} className="p-1 text-slate-500 hover:text-slate-200">
              {voce.nascosto ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
            {mostro && (
              <button onClick={() => setAperta(a => !a)} title={aperta ? "Chiudi i dettagli" : "Dettagli del mostro"} className="p-1 text-slate-500 hover:text-slate-200">
                {aperta ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            )}
            <button onClick={onTogli} disabled={inCorso} title="Togli" className="p-1 text-slate-500 hover:text-rose-300"><Trash2 className="w-4 h-4" /></button>
          </>
        )}
      </div>

      {master && (condizioni.length > 0 || (mostro && voce.pf !== null)) && (
        <div className="flex flex-wrap items-center gap-1.5 pl-8">
          {mostro && voce.pf !== null && (
            <div className="flex items-center gap-1 mr-2">
              <input type="number" min={1} value={quantita} onChange={e => setQuantita(e.target.value)} placeholder="PF"
                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); cambiaPf(-1); } }}
                className="w-14 bg-slate-950 border border-slate-800 rounded-lg px-1 py-0.5 text-center text-xs text-slate-100 outline-none focus:border-indigo-500" />
              <button onClick={() => cambiaPf(-1)} disabled={inCorso || n === null || n <= 0} title="Danno (Invio)"
                className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-rose-600/20 text-rose-300 border border-rose-500/30 hover:bg-rose-600/30 disabled:opacity-50">
                Danno
              </button>
              <button onClick={() => cambiaPf(1)} disabled={inCorso || n === null || n <= 0} title="Cura"
                className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-600/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-600/30 disabled:opacity-50">
                Cura
              </button>
            </div>
          )}
          {condizioni.map(id => (
            <button key={id} disabled={!mostro || inCorso} title={mostro ? "Togli la condizione" : "Dalla scheda del personaggio"}
              onClick={() => onModifica({ condizioni: voce.condizioni.filter(c => c !== id) })}
              className="px-2 py-0.5 rounded-full text-[11px] bg-amber-500/15 text-amber-300 border border-amber-500/30 enabled:hover:line-through">
              {condizione(id)?.nome ?? id}
            </button>
          ))}
        </div>
      )}

      {master && mostro && aperta && <DettagliMostro voce={voce} inCorso={inCorso} onModifica={onModifica} />}
    </li>
  );
}

// Dati del mostro che il Master modifica di rado: nome, CA, PF massimi, condizioni e note.
function DettagliMostro({ voce, inCorso, onModifica }: { voce: VoceIniziativa; inCorso: boolean; onModifica: (dati: DatiVoceIniziativa) => void }) {
  const [nome, setNome] = useState(voce.nome);
  const [ca, setCa] = useState(voce.ca === null ? "" : String(voce.ca));
  const [pfMassimi, setPfMassimi] = useState(voce.pfMassimi === null ? "" : String(voce.pfMassimi));
  const [note, setNote] = useState(voce.note);

  const salva = (e: FormEvent) => {
    e.preventDefault();
    const nuoviMassimi = intero(pfMassimi);
    const massimiValidi = nuoviMassimi !== null && nuoviMassimi > 0 ? nuoviMassimi : null;
    onModifica({
      ...(nome.trim() && nome.trim() !== voce.nome ? { nome: nome.trim() } : {}),
      ca: intero(ca),
      pfMassimi: massimiValidi,
      // Con i PF massimi messi per la prima volta il mostro parte illeso.
      ...(massimiValidi !== null && voce.pfMassimi === null ? { pf: massimiValidi } : {}),
      ...(massimiValidi === null ? { pf: null } : {}),
      note,
    });
  };

  const aggiungiCondizione = (id: string) => {
    if (id && !voce.condizioni.includes(id)) onModifica({ condizioni: [...voce.condizioni, id] });
  };

  return (
    <form onSubmit={salva} className="pl-8 space-y-2 border-t border-slate-800 pt-2">
      <div className="flex flex-wrap items-center gap-2">
        <input value={nome} onChange={e => setNome(e.target.value)} maxLength={60} title="Nome" className={`${campo} flex-1 min-w-32`} />
        <label className="flex items-center gap-1 text-xs text-slate-400">CA
          <input type="number" min={0} value={ca} onChange={e => setCa(e.target.value)} className={`${campo} w-16`} />
        </label>
        <label className="flex items-center gap-1 text-xs text-slate-400">PF max
          <input type="number" min={1} value={pfMassimi} onChange={e => setPfMassimi(e.target.value)} className={`${campo} w-20`} />
        </label>
        <select value="" onChange={e => aggiungiCondizione(e.target.value)} disabled={inCorso} className={campo}>
          <option value="">+ Condizione…</option>
          {CONDIZIONI.filter(c => !voce.condizioni.includes(c.id)).map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </select>
      </div>
      <textarea value={note} onChange={e => setNote(e.target.value)} maxLength={2000} rows={3}
        placeholder="Attacchi, CD, resistenze, tattiche…" className={`${campo} w-full resize-y`} />
      <div className="flex justify-end">
        <button type="submit" disabled={inCorso} className={pulsanteNeutro}>Salva i dettagli</button>
      </div>
    </form>
  );
}
