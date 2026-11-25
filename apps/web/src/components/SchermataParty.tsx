import { useCallback, useState, type FormEvent } from "react";
import {
  ArrowLeft, BookOpen, Check, Copy, Crown, Eye, Gem, LoaderCircle, LogOut, MessagesSquare, Pencil, RefreshCw, Shield, Swords, Trash2, UserCog, UserMinus, Users, X,
} from "lucide-react";
import type { DettaglioParty, MembroParty } from "@dnd/regole/api.ts";
import { condizione } from "@dnd/regole/dati/condizioni.ts";
import type { Utente } from "../accesso";
import { dettaglioParty, type EsitoParty, rigeneraCodice, rinominaParty, sciogliParty, togliMembro } from "../party";
import { usePolling } from "../usePolling";
import { nonLettiPer, useMessaggi } from "../messaggi";
import Avatar from "./Avatar";
import PartyChat from "./PartyChat";
import PartyDiario from "./PartyDiario";
import PartyIniziativa from "./PartyIniziativa";
import PannelloTesoro from "./PannelloTesoro";
import VistaPersonaggio from "./VistaPersonaggio";

interface Props {
  partyId: number;
  utente: Utente;
  onTorna: (messaggio: string | null) => void;
  onApriPersonaggio: (id: number) => void;
  onAccount: () => void;
  onEsci: () => void;
  onSessioneScaduta: () => void;
}

type Sezione = "compagni" | "chat" | "diario" | "iniziativa" | "tesoro";

const AGGIORNAMENTO = 4_000; // ms: con la schermata aperta si vedono presto PF e condizioni dei compagni
const NON_PIU_MEMBRO = "Il party non esiste più oppure non ne fai più parte.";

const pulsanteNeutro = "flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700 disabled:opacity-50";

export default function SchermataParty({ partyId, utente, onTorna, onApriPersonaggio, onAccount, onEsci, onSessioneScaduta }: Props) {
  const [party, setParty] = useState<DettaglioParty | null>(null);
  const [errore, setErrore] = useState<string | null>(null);
  const [nome, setNome] = useState<string | null>(null); // nome in modifica (solo Master)
  const [copiato, setCopiato] = useState(false);
  const [vista, setVista] = useState<number | null>(null); // personaggio aperto in sola lettura
  const [inCorso, setInCorso] = useState(false);

  // Esito di una chiamata: false se non è andata (l'errore è già mostrato o si è lasciata la schermata).
  const riuscito = useCallback(<T,>(esito: EsitoParty<T>): esito is { dati: T } => {
    if (esito === "sessione scaduta") {
      onSessioneScaduta();
      return false;
    }
    if ("errore" in esito) {
      if (esito.stato === 404) onTorna(NON_PIU_MEMBRO);
      else setErrore(esito.errore);
      return false;
    }
    return true;
  }, [onSessioneScaduta, onTorna]);

  const carica = useCallback(async () => {
    const esito = await dettaglioParty(partyId);
    if (!riuscito(esito)) return;
    setParty(esito.dati);
    setErrore(null);
  }, [partyId, riuscito]);

  usePolling(carica, AGGIORNAMENTO);
  const chat = useMessaggi(partyId, riuscito);
  const [sezione, setSezione] = useState<Sezione>("compagni");

  const esegui = async (azione: () => Promise<EsitoParty<unknown>>, dopo?: () => void) => {
    setInCorso(true);
    const ok = riuscito(await azione());
    setInCorso(false);
    if (!ok) return;
    if (dopo) dopo();
    else await carica();
  };

  if (!party) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-3 px-4 text-center">
        {errore
          ? <p role="alert" className="text-sm text-rose-300">{errore}</p>
          : <LoaderCircle className="w-6 h-6 text-indigo-400 animate-spin" />}
        <button onClick={() => onTorna(null)} className={pulsanteNeutro}><ArrowLeft className="w-3.5 h-3.5" /> Indietro</button>
      </div>
    );
  }

  const master = party.io.ruolo === "master";
  const daLeggere = Object.values(nonLettiPer(chat.messaggi ?? [], chat.letture, party.io.utenteId)).reduce((a, b) => a + b, 0);
  const mio = party.membri.find(m => m.utenteId === party.io.utenteId)?.personaggio ?? null;
  const sezioni: { id: Sezione; etichetta: string; icona: typeof Users; badge?: number; nota?: string }[] = [
    { id: "compagni", etichetta: "Compagni", icona: Users },
    { id: "chat", etichetta: "Chat", icona: MessagesSquare, badge: daLeggere },
    { id: "iniziativa", etichetta: "Iniziativa", icona: Swords, ...(party.combattimento ? { nota: `Round ${party.combattimento.round}` } : {}) },
    { id: "diario", etichetta: "Diario", icona: BookOpen },
    { id: "tesoro", etichetta: "Tesoro", icona: Gem },
  ];

  const salvaNome = (e: FormEvent) => {
    e.preventDefault();
    const nuovo = nome?.trim();
    if (!nuovo) return;
    esegui(() => rinominaParty(partyId, nuovo), () => { setNome(null); void carica(); });
  };

  const copia = async () => {
    if (!party.codice) return;
    try {
      await navigator.clipboard.writeText(party.codice);
      setCopiato(true);
      setTimeout(() => setCopiato(false), 2000);
    } catch {
      setErrore("Copia non riuscita: seleziona il codice e copialo a mano.");
    }
  };

  const rigenera = () => {
    if (!confirm("Generare un nuovo codice? Quello attuale smetterà di funzionare (chi è già nel party resta).")) return;
    esegui(() => rigeneraCodice(partyId));
  };

  const espelli = (m: MembroParty) => {
    if (!confirm(`Togliere ${m.personaggio?.nome || m.username} dal party?`)) return;
    esegui(() => togliMembro(partyId, m.utenteId));
  };

  const esci = () => {
    if (!confirm(`Uscire dal party "${party.nome}"? Per rientrare servirà di nuovo il codice.`)) return;
    esegui(() => togliMembro(partyId, party.io.utenteId), () => onTorna(null));
  };

  const sciogli = () => {
    if (!confirm(`Sciogliere il party "${party.nome}"? Il gruppo verrà cancellato per tutti (i personaggi restano ai giocatori).`)) return;
    esegui(() => sciogliParty(partyId), () => onTorna(null));
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-3 sm:p-6 font-sans">
      <div className="max-w-4xl mx-auto space-y-5">
        <header className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <button onClick={() => onTorna(null)} className={pulsanteNeutro}><ArrowLeft className="w-3.5 h-3.5" /> Indietro</button>
            <div className="flex items-center gap-2">
              <button onClick={onAccount} title="Account: username e password" className={pulsanteNeutro}>
                <UserCog className="w-3.5 h-3.5" /> <span className="hidden sm:inline">{utente.username}</span>
              </button>
              <button onClick={onEsci} title="Esci" className={`${pulsanteNeutro} hover:text-rose-300`}><LogOut className="w-3.5 h-3.5" /></button>
            </div>
          </div>

          {nome !== null ? (
            <form onSubmit={salvaNome} className="flex items-center gap-2">
              <input value={nome} onChange={e => setNome(e.target.value)} maxLength={60} autoFocus
                className="flex-1 min-w-0 bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xl font-black text-white outline-none focus:border-indigo-500" />
              <button type="submit" disabled={inCorso || !nome.trim()} title="Salva" className={pulsanteNeutro}><Check className="w-4 h-4" /></button>
              <button type="button" onClick={() => setNome(null)} title="Annulla" className={pulsanteNeutro}><X className="w-4 h-4" /></button>
            </form>
          ) : (
            <div className="flex items-center gap-2 min-w-0">
              <Users className="w-6 h-6 text-indigo-400 shrink-0" />
              <h1 className="text-2xl font-black text-white truncate">{party.nome}</h1>
              {master && (
                <button onClick={() => setNome(party.nome)} title="Rinomina il party" className="text-slate-500 hover:text-slate-200 p-1">
                  <Pencil className="w-4 h-4" />
                </button>
              )}
            </div>
          )}

          {master && party.codice && (
            <div className="flex flex-wrap items-center gap-3 bg-slate-950/60 border border-slate-800 rounded-xl px-3 py-2">
              <div>
                <div className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Codice d'invito</div>
                <div className="font-mono text-xl font-black tracking-widest text-indigo-200 select-all">{party.codice}</div>
              </div>
              <div className="flex gap-2 ml-auto">
                <button onClick={copia} className={pulsanteNeutro}>
                  {copiato ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />} {copiato ? "Copiato" : "Copia"}
                </button>
                <button onClick={rigenera} disabled={inCorso} title="Genera un nuovo codice" className={pulsanteNeutro}>
                  <RefreshCw className="w-3.5 h-3.5" /> Nuovo codice
                </button>
              </div>
              <p className="basis-full text-xs text-slate-500">Dai questo codice ai giocatori: entreranno scegliendo uno dei loro personaggi.</p>
            </div>
          )}
        </header>

        {errore && (
          <p role="alert" className="text-sm text-amber-300 bg-amber-950/30 border border-amber-900/50 rounded-lg px-3 py-2">{errore}</p>
        )}

        <nav className="flex gap-1 overflow-x-auto bg-slate-900 border border-slate-800 rounded-xl p-1">
          {sezioni.map(x => (
            <button
              key={x.id}
              onClick={() => setSezione(x.id)}
              className={`shrink-0 flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition ${sezione === x.id
                ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"}`}
            >
              <x.icona className="w-4 h-4" /> {x.etichetta}
              {x.nota && <span className="px-1.5 rounded-full bg-rose-600/30 text-rose-200 text-[11px] leading-5">{x.nota}</span>}
              {(x.badge ?? 0) > 0 && (
                <span className="min-w-5 px-1 rounded-full bg-rose-500 text-white text-[11px] leading-5 text-center">{x.badge}</span>
              )}
            </button>
          ))}
        </nav>

        {sezione === "chat" && <PartyChat io={party.io.utenteId} membri={party.membri} chat={chat} />}
        {sezione === "iniziativa" && <PartyIniziativa partyId={partyId} ruolo={party.io.ruolo} mio={mio} membri={party.membri} riuscito={riuscito} />}
        {sezione === "tesoro" && (
          <div className="space-y-3">
            {!master && mio && (
              <div className="flex flex-wrap items-center gap-2 text-sm text-slate-400 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2">
                Per prendere o mettere oggetti e monete usa lo Zaino della tua scheda.
                <button onClick={() => onApriPersonaggio(mio.id)} className={`${pulsanteNeutro} ml-auto`}><Eye className="w-3.5 h-3.5" /> Apri la mia scheda</button>
              </div>
            )}
            <PannelloTesoro partyId={partyId} master={master} />
          </div>
        )}
        {sezione === "diario" && <PartyDiario partyId={partyId} io={party.io} versione={party.diarioVersione} riuscito={riuscito} />}

        {sezione === "compagni" && <section className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            {party.membri.map(m => (
              <CartaMembro
                key={m.utenteId}
                membro={m}
                mio={m.utenteId === party.io.utenteId}
                master={master}
                inCorso={inCorso}
                onVedi={setVista}
                onApri={onApriPersonaggio}
                onEspelli={espelli}
              />
            ))}
          </div>
          {party.membri.length === 1 && master && (
            <p className="text-sm text-slate-400">Nessun giocatore per ora: condividi il codice d'invito.</p>
          )}
        </section>}

        <div className="flex justify-end pt-2">
          {master ? (
            <button onClick={sciogli} disabled={inCorso} className={`${pulsanteNeutro} hover:text-rose-300 hover:border-rose-800`}>
              <Trash2 className="w-3.5 h-3.5" /> Sciogli party
            </button>
          ) : (
            <button onClick={esci} disabled={inCorso} className={`${pulsanteNeutro} hover:text-rose-300 hover:border-rose-800`}>
              <LogOut className="w-3.5 h-3.5" /> Esci dal party
            </button>
          )}
        </div>
      </div>

      {vista !== null && (
        <VistaPersonaggio partyId={partyId} personaggioId={vista} onSessioneScaduta={onSessioneScaduta} onChiudi={() => setVista(null)} />
      )}
    </div>
  );
}

interface PropsCarta {
  membro: MembroParty;
  mio: boolean;
  master: boolean; // chi guarda è il Master
  inCorso: boolean;
  onVedi: (personaggioId: number) => void;
  onApri: (personaggioId: number) => void;
  onEspelli: (membro: MembroParty) => void;
}

function CartaMembro({ membro, mio, master, inCorso, onVedi, onApri, onEspelli }: PropsCarta) {
  const p = membro.personaggio;
  if (!p) {
    return (
      <div className="bg-slate-900 border border-amber-500/30 rounded-xl p-4 flex items-center gap-3">
        <div className="w-10 h-10 shrink-0 rounded-full bg-amber-500/15 border border-amber-500/30 flex items-center justify-center">
          <Crown className="w-5 h-5 text-amber-300" />
        </div>
        <div className="min-w-0">
          <div className="font-bold text-slate-100">Master</div>
          <div className="text-xs text-slate-400 truncate">{membro.username}{mio && " (tu)"}</div>
        </div>
      </div>
    );
  }
  const quota = p.pfMassimi > 0 ? Math.min(1, p.pf / p.pfMassimi) : 0;
  const coloreBarra = p.pf === 0 ? "bg-rose-600" : quota <= 0.25 ? "bg-rose-500" : quota <= 0.5 ? "bg-amber-500" : "bg-emerald-500";
  const stati = [
    ...(p.pf === 0 ? ["A terra"] : []),
    ...p.condizioni.map(id => condizione(id)?.nome ?? id),
    ...(p.indebolimento > 0 ? [`Indebolimento ${p.indebolimento}`] : []),
  ];

  return (
    <div className={`bg-slate-900 border rounded-xl p-4 space-y-3 ${mio ? "border-indigo-500/50" : "border-slate-800"}`}>
      <div className="flex items-center gap-3">
        <Avatar avatar={p.avatar ?? ""} nome={p.nome} dimensione="piccola" />
        <div className="min-w-0 flex-1">
          <div className="font-bold text-slate-100 truncate">{p.nome || "Senza nome"}{mio && <span className="text-indigo-300 font-normal text-xs"> (tu)</span>}</div>
          <div className="text-xs text-slate-400 truncate">
            {[p.razza, `${p.classe} Liv. ${p.livello}`, p.sottoclasse].filter(Boolean).join(" • ")}
          </div>
          <div className="text-[11px] text-slate-500 truncate">{membro.username}</div>
        </div>
        <div title="Classe Armatura" className="flex flex-col items-center text-indigo-200">
          <Shield className="w-4 h-4 text-indigo-400" />
          <span className="text-sm font-black">{p.ca}</span>
        </div>
      </div>

      <div>
        <div className="flex justify-between text-xs text-slate-400 mb-1">
          <span>Punti ferita</span>
          <span className="font-semibold text-slate-200">
            {p.pf}/{p.pfMassimi}{p.pfTemporanei > 0 && <span className="text-sky-400"> +{p.pfTemporanei}</span>}
          </span>
        </div>
        <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
          <div className={`h-full ${coloreBarra} transition-all`} style={{ width: `${quota * 100}%` }} />
        </div>
      </div>

      {stati.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {stati.map(s => (
            <span key={s} className="px-2 py-0.5 text-[11px] rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30">{s}</span>
          ))}
        </div>
      )}

      {(mio || master) && (
        <div className="flex flex-wrap gap-2">
          {mio && (
            <button onClick={() => onApri(p.id)} className={pulsanteNeutro}><Eye className="w-3.5 h-3.5" /> Apri la mia scheda</button>
          )}
          {master && (
            <>
              <button onClick={() => onVedi(p.id)} className={pulsanteNeutro}><Eye className="w-3.5 h-3.5" /> Scheda</button>
              <button onClick={() => onEspelli(membro)} disabled={inCorso} className={`${pulsanteNeutro} hover:text-rose-300`}>
                <UserMinus className="w-3.5 h-3.5" /> Espelli
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
