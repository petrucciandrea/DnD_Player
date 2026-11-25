import { useState, type FormEvent } from "react";
import { Crown, KeyRound, LoaderCircle, LogIn, Users, X } from "lucide-react";
import type { RiassuntoPersonaggio } from "@dnd/regole/api.ts";
import { creaParty, entraNelParty } from "../party";

interface Props {
  modo: "crea" | "entra";
  personaggi: RiassuntoPersonaggio[]; // tutti i personaggi dell'utente: si può entrare solo con quelli senza party
  onFatto: (partyId: number) => void;
  onSessioneScaduta: () => void;
  onChiudi: () => void;
}

const campo = "w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 outline-none focus:border-indigo-500 transition";
const etichetta = "text-xs text-slate-400 font-semibold uppercase tracking-wider";
const pulsante = "w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:hover:bg-indigo-600 text-white text-sm font-semibold transition";

// Crea un party (chi lo crea è il Master) oppure entra in uno con il codice d'invito e un personaggio.
export default function FinestraNuovoParty({ modo: modoIniziale, personaggi, onFatto, onSessioneScaduta, onChiudi }: Props) {
  const [modo, setModo] = useState(modoIniziale);
  const [nome, setNome] = useState("");
  const [codice, setCodice] = useState("");
  const liberi = personaggi.filter(p => !p.party);
  const [personaggio, setPersonaggio] = useState<number | null>(liberi[0]?.id ?? null);
  const [errore, setErrore] = useState<string | null>(null);
  const [inCorso, setInCorso] = useState(false);

  const invia = async (e: FormEvent) => {
    e.preventDefault();
    setErrore(null);
    setInCorso(true);
    const esito = modo === "crea" ? await creaParty(nome.trim()) : await entraNelParty(codice, personaggio!);
    setInCorso(false);
    if (esito === "sessione scaduta") return onSessioneScaduta();
    if ("errore" in esito) return setErrore(esito.errore);
    onFatto(esito.dati.id);
  };

  const scheda = (m: typeof modo, Icona: typeof Crown, testo: string) => (
    <button
      type="button"
      onClick={() => { setModo(m); setErrore(null); }}
      className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${modo === m
        ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-slate-200"}`}
    >
      <Icona className="w-3.5 h-3.5" /> {testo}
    </button>
  );

  const pronto = modo === "crea" ? nome.trim().length > 0 : codice.replace(/[\s-]/g, "").length === 8 && personaggio !== null;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-md max-h-[90vh] overflow-y-auto bg-slate-900 border border-slate-700 rounded-2xl p-5 shadow-2xl space-y-5">
        <div className="flex items-start justify-between gap-2">
          <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-400" /> Party
          </h2>
          <button onClick={onChiudi} title="Chiudi" className="text-slate-500 hover:text-slate-200 p-1"><X className="w-4 h-4" /></button>
        </div>

        <div className="flex gap-1 bg-slate-950/60 border border-slate-800 rounded-xl p-1">
          {scheda("entra", LogIn, "Entra con un codice")}
          {scheda("crea", Crown, "Crea come Master")}
        </div>

        <form onSubmit={invia} className="space-y-4">
          {modo === "crea" ? (
            <>
              <label className="block space-y-1">
                <span className={etichetta}>Nome del party</span>
                <input value={nome} onChange={e => setNome(e.target.value)} maxLength={60} autoFocus className={campo}
                  placeholder="La Compagnia dell'Anello" />
              </label>
              <p className="text-xs text-slate-400">
                Sarai il Master: riceverai un codice da dare ai giocatori, vedrai le schede dei loro personaggi e potrai gestire il gruppo.
              </p>
            </>
          ) : (
            <>
              <label className="block space-y-1">
                <span className={etichetta}>Codice d'invito</span>
                <span className="relative block">
                  <KeyRound className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    value={codice}
                    onChange={e => setCodice(e.target.value.toUpperCase())}
                    maxLength={9}
                    autoFocus
                    autoCapitalize="characters"
                    autoComplete="off"
                    placeholder="ABCD-EFGH"
                    className={`${campo} pl-9 font-mono tracking-widest`}
                  />
                </span>
              </label>
              <label className="block space-y-1">
                <span className={etichetta}>Con quale personaggio</span>
                {liberi.length > 0 ? (
                  <select value={personaggio ?? ""} onChange={e => setPersonaggio(Number(e.target.value))} className={campo}>
                    {liberi.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.nome || "Senza nome"}{p.classe && ` — ${p.classe} Liv. ${p.livello}`}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="block text-sm text-amber-300">
                    Tutti i tuoi personaggi sono già in un party: creane uno nuovo per entrare.
                  </span>
                )}
              </label>
            </>
          )}

          {errore && (
            <p role="alert" className="text-sm text-rose-300 bg-rose-950/40 border border-rose-900/60 rounded-lg px-3 py-2">{errore}</p>
          )}
          <button type="submit" disabled={inCorso || !pronto} className={pulsante}>
            {inCorso ? <LoaderCircle className="w-4 h-4 animate-spin" /> : modo === "crea" ? <Crown className="w-4 h-4" /> : <LogIn className="w-4 h-4" />}
            {modo === "crea" ? "Crea party" : "Entra nel party"}
          </button>
        </form>
      </div>
    </div>
  );
}
