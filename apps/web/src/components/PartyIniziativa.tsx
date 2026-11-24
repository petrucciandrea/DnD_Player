import { useCallback, useState, type FormEvent } from "react";
import { ChevronLeft, ChevronRight, Dices, Eye, EyeOff, LoaderCircle, Plus, Skull, Square, Swords, Trash2 } from "lucide-react";
import type { Combattimento, RiepilogoPersonaggioParty, RuoloParty, VoceIniziativa } from "@dnd/regole/api.ts";
import { segno } from "@dnd/regole/regole.ts";
import {
  aggiungiVoceIniziativa, avanzaTurno, avviaCombattimento, leggiCombattimento, mandaIniziativa, modificaVoceIniziativa,
  terminaCombattimento, togliVoceIniziativa, type ControllaEsito, type EsitoParty,
} from "../party";
import { useRichiestaTiro } from "../tiroDadi";
import { usePolling } from "../usePolling";
import DialogoTiro from "./DialogoTiro";

interface Props {
  partyId: number;
  ruolo: RuoloParty;
  mio: RiepilogoPersonaggioParty | null; // il personaggio dell'utente (null per il Master)
  riuscito: ControllaEsito;
}

const AGGIORNAMENTO = 4_000; // ms
const campo = "bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-sm text-slate-100 outline-none focus:border-indigo-500";
const pulsanteNeutro = "flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700 disabled:opacity-50";

// Ordine d'iniziativa dello scontro in corso. Il Master avvia, aggiunge mostri e fa avanzare i turni;
// ogni giocatore tira (o inserisce) l'iniziativa del suo personaggio.
export default function PartyIniziativa({ partyId, ruolo, mio, riuscito }: Props) {
  const [comb, setComb] = useState<Combattimento | null>(null);
  const [inCorso, setInCorso] = useState(false);
  const [valoreMio, setValoreMio] = useState("");
  const [mostro, setMostro] = useState({ nome: "", valore: "", bonus: "", nascosto: false });
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
    const v = Number(valoreMio);
    if (valoreMio.trim() === "" || !Number.isInteger(v)) return;
    if (await esegui(() => mandaIniziativa(partyId, v))) setValoreMio("");
  };

  const bonusMostro = Number(mostro.bonus) || 0;
  const aggiungiMostro = async (valore: number) => {
    const ok = await esegui(() => aggiungiVoceIniziativa(partyId, {
      nome: mostro.nome.trim(), valore, bonus: bonusMostro, nascosto: mostro.nascosto,
    }));
    if (ok) setMostro(m => ({ ...m, nome: "", valore: "" }));
  };

  const inviaMostro = (e: FormEvent) => {
    e.preventDefault();
    const v = Number(mostro.valore);
    if (mostro.nome.trim() && mostro.valore.trim() !== "" && Number.isInteger(v)) void aggiungiMostro(v);
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
            <button type="submit" disabled={inCorso || valoreMio.trim() === ""} className={pulsanteNeutro}>Inserisci</button>
          </div>
        </form>
      )}

      <ol className="space-y-1.5">
        {comb.voci.map((v, i) => (
          <RigaIniziativa key={v.id} voce={v} posizione={i + 1} diTurno={v.id === comb.diTurno} mia={v.id === mia?.id}
            master={master} inCorso={inCorso}
            onModifica={dati => esegui(() => modificaVoceIniziativa(partyId, v.id, dati))}
            onTogli={() => { if (confirm(`Togliere ${v.nome} dall'iniziativa?`)) void esegui(() => togliVoceIniziativa(partyId, v.id)); }}
          />
        ))}
        {comb.voci.length === 0 && (
          <li className="text-sm text-slate-500 text-center py-4">Ancora nessuno: i giocatori tirano l'iniziativa, il Master aggiunge i mostri.</li>
        )}
      </ol>

      {master && (
        <form onSubmit={inviaMostro} className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex flex-wrap items-center gap-2">
          <Skull className="w-4 h-4 text-slate-500" />
          <input value={mostro.nome} onChange={e => setMostro(m => ({ ...m, nome: e.target.value }))} maxLength={60}
            placeholder="Mostro o PNG" className={`${campo} flex-1 min-w-32`} />
          <input type="number" value={mostro.bonus} onChange={e => setMostro(m => ({ ...m, bonus: e.target.value }))}
            placeholder="Mod." title="Modificatore d'iniziativa" className={`${campo} w-16`} />
          <button type="button" onClick={tiraMostro} disabled={inCorso || !mostro.nome.trim()} title="Tira l'iniziativa del mostro" className={pulsanteNeutro}>
            <Dices className="w-4 h-4" />
          </button>
          <input type="number" value={mostro.valore} onChange={e => setMostro(m => ({ ...m, valore: e.target.value }))}
            placeholder="Totale" className={`${campo} w-20`} />
          <label className="flex items-center gap-1 text-xs text-slate-400" title="I giocatori non lo vedono finché non lo mostri">
            <input type="checkbox" checked={mostro.nascosto} onChange={e => setMostro(m => ({ ...m, nascosto: e.target.checked }))} className="accent-indigo-500" />
            Nascosto
          </label>
          <button type="submit" disabled={inCorso || !mostro.nome.trim() || mostro.valore.trim() === ""} className={pulsanteNeutro}>
            <Plus className="w-4 h-4" /> Aggiungi
          </button>
        </form>
      )}
      {dialogo}
    </div>
  );
}

function RigaIniziativa({ voce, posizione, diTurno, mia, master, inCorso, onModifica, onTogli }: {
  voce: VoceIniziativa; posizione: number; diTurno: boolean; mia: boolean; master: boolean; inCorso: boolean;
  onModifica: (dati: { valore?: number; nascosto?: boolean }) => void; onTogli: () => void;
}) {
  const [valore, setValore] = useState(String(voce.valore));
  const [ultimo, setUltimo] = useState(voce.valore);
  // Il valore arrivato dal server (un altro l'ha cambiato) sostituisce quello nel campo.
  if (ultimo !== voce.valore) {
    setUltimo(voce.valore);
    setValore(String(voce.valore));
  }
  const salva = () => {
    const v = Number(valore);
    if (Number.isInteger(v) && v !== voce.valore && valore.trim() !== "") onModifica({ valore: v });
    else setValore(String(voce.valore));
  };

  return (
    <li className={`flex items-center gap-3 rounded-xl border px-3 py-2 ${diTurno
      ? "bg-amber-500/10 border-amber-500/50" : mia ? "bg-indigo-500/10 border-indigo-500/40" : "bg-slate-900 border-slate-800"} ${voce.nascosto ? "opacity-60" : ""}`}>
      <span className="w-5 text-xs text-slate-500 text-right">{posizione}</span>
      {master ? (
        <input type="number" value={valore} onChange={e => setValore(e.target.value)} onBlur={salva}
          onKeyDown={e => { if (e.key === "Enter") e.currentTarget.blur(); }} disabled={inCorso}
          className="w-14 bg-slate-950 border border-slate-800 rounded-lg px-1 py-1 text-center font-black text-white outline-none focus:border-indigo-500" />
      ) : (
        <span className="w-10 text-center text-lg font-black text-white">{voce.valore}</span>
      )}
      <div className="flex-1 min-w-0">
        <div className={`font-semibold truncate ${voce.personaggioId === null ? "text-rose-200" : "text-slate-100"}`}>
          {voce.personaggioId === null && <Skull className="w-3.5 h-3.5 inline mr-1 text-rose-400" />}
          {voce.nome}{mia && <span className="text-indigo-300 font-normal text-xs"> (tu)</span>}
        </div>
        {diTurno && <div className="text-[11px] text-amber-300 font-semibold">{mia ? "Tocca a te!" : "Di turno"}</div>}
      </div>
      <span className="text-[11px] text-slate-500" title="Modificatore d'iniziativa">{segno(voce.bonus)}</span>
      {master && (
        <>
          <button onClick={() => onModifica({ nascosto: !voce.nascosto })} disabled={inCorso}
            title={voce.nascosto ? "Mostra ai giocatori" : "Nascondi ai giocatori"} className="p-1 text-slate-500 hover:text-slate-200">
            {voce.nascosto ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
          <button onClick={onTogli} disabled={inCorso} title="Togli" className="p-1 text-slate-500 hover:text-rose-300"><Trash2 className="w-4 h-4" /></button>
        </>
      )}
    </li>
  );
}
