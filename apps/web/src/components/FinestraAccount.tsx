import { useState, type FormEvent } from "react";
import { KeyRound, LoaderCircle, Lock, User, UserCog, X } from "lucide-react";
import { cambiaPassword, cambiaUsername, type Utente } from "../accesso";

interface Props {
  utente: Utente;
  onUtenteAggiornato: (utente: Utente) => void;
  onSessioneScaduta: () => void;
  onChiudi: () => void;
}

interface Esito {
  ok: boolean;
  testo: string;
}

const campo = "w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-sm text-slate-100 outline-none focus:border-indigo-500 transition";
const etichetta = "text-xs text-slate-400 font-semibold uppercase tracking-wider";
const icona = "w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2";
const pulsante = "w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:hover:bg-indigo-600 text-white text-sm font-semibold transition";

function Campo({ nome, tipo = "password", valore, onCambia, completamento, Icona = Lock, nota }: {
  nome: string; tipo?: string; valore: string; onCambia: (v: string) => void; completamento: string;
  Icona?: typeof Lock; nota?: string;
}) {
  return (
    <label className="block space-y-1">
      <span className={etichetta}>{nome}</span>
      <span className="relative block">
        <Icona className={icona} />
        <input
          type={tipo}
          value={valore}
          onChange={e => onCambia(e.target.value)}
          autoComplete={completamento}
          autoCapitalize="none"
          className={campo}
        />
      </span>
      {nota && <span className="block text-xs text-slate-500">{nota}</span>}
    </label>
  );
}

const Messaggio = ({ esito }: { esito: Esito | null }) =>
  esito && (
    <p
      role={esito.ok ? "status" : "alert"}
      className={`text-sm rounded-lg px-3 py-2 border ${esito.ok
        ? "text-emerald-300 bg-emerald-950/40 border-emerald-900/60"
        : "text-rose-300 bg-rose-950/40 border-rose-900/60"}`}
    >
      {esito.testo}
    </p>
  );

export default function FinestraAccount({ utente, onUtenteAggiornato, onSessioneScaduta, onChiudi }: Props) {
  const [username, setUsername] = useState(utente.username);
  const [passwordUsername, setPasswordUsername] = useState("");
  const [esitoUsername, setEsitoUsername] = useState<Esito | null>(null);

  const [attuale, setAttuale] = useState("");
  const [nuova, setNuova] = useState("");
  const [conferma, setConferma] = useState("");
  const [esitoPassword, setEsitoPassword] = useState<Esito | null>(null);

  const [inCorso, setInCorso] = useState<"username" | "password" | null>(null);

  const salvaUsername = async (e: FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !passwordUsername) return;
    setInCorso("username");
    setEsitoUsername(null);
    const esito = await cambiaUsername(username, passwordUsername);
    setInCorso(null);
    if (esito === "sessione scaduta") return onSessioneScaduta();
    setPasswordUsername("");
    if ("errore" in esito) return setEsitoUsername({ ok: false, testo: esito.errore });
    setUsername(esito.utente.username);
    onUtenteAggiornato(esito.utente);
    setEsitoUsername({ ok: true, testo: `Username cambiato: ora accedi come "${esito.utente.username}".` });
  };

  const salvaPassword = async (e: FormEvent) => {
    e.preventDefault();
    if (!attuale || !nuova || !conferma) return;
    if (nuova !== conferma) return setEsitoPassword({ ok: false, testo: "Le due password nuove non coincidono." });
    setInCorso("password");
    setEsitoPassword(null);
    const esito = await cambiaPassword(attuale, nuova);
    setInCorso(null);
    if (esito === "sessione scaduta") return onSessioneScaduta();
    if ("errore" in esito) {
      setAttuale("");
      return setEsitoPassword({ ok: false, testo: esito.errore });
    }
    setAttuale("");
    setNuova("");
    setConferma("");
    setEsitoPassword({ ok: true, testo: "Password cambiata. Sugli altri dispositivi bisognerà accedere di nuovo." });
  };

  const usernameInvariato = username.trim().toLowerCase() === utente.username;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-md max-h-[90vh] overflow-y-auto bg-slate-900 border border-slate-700 rounded-2xl p-5 shadow-2xl space-y-5">
        <div className="flex items-start justify-between gap-2">
          <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            <UserCog className="w-5 h-5 text-indigo-400" /> Account
          </h2>
          <button onClick={onChiudi} title="Chiudi" className="text-slate-500 hover:text-slate-200 p-1"><X className="w-4 h-4" /></button>
        </div>

        <form onSubmit={salvaUsername} className="space-y-3 bg-slate-950/40 border border-slate-800 rounded-xl p-4">
          <h3 className="text-sm font-bold text-slate-200">Username</h3>
          <Campo
            nome="Nuovo username" tipo="text" valore={username} onCambia={setUsername} completamento="username" Icona={User}
            nota="Da 3 a 30 caratteri: lettere, numeri, punto, trattini."
          />
          <Campo nome="Password attuale" valore={passwordUsername} onCambia={setPasswordUsername} completamento="current-password" />
          <Messaggio esito={esitoUsername} />
          <button type="submit" disabled={inCorso !== null || usernameInvariato || !username.trim() || !passwordUsername} className={pulsante}>
            {inCorso === "username" ? <LoaderCircle className="w-4 h-4 animate-spin" /> : <User className="w-4 h-4" />} Cambia username
          </button>
        </form>

        <form onSubmit={salvaPassword} className="space-y-3 bg-slate-950/40 border border-slate-800 rounded-xl p-4">
          <h3 className="text-sm font-bold text-slate-200">Password</h3>
          {/* Campo nascosto per i gestori di password, che associano la nuova password all'account giusto. */}
          <input type="text" value={utente.username} autoComplete="username" readOnly hidden />
          <Campo nome="Password attuale" valore={attuale} onCambia={setAttuale} completamento="current-password" />
          <Campo nome="Nuova password" valore={nuova} onCambia={setNuova} completamento="new-password" Icona={KeyRound} nota="Almeno 8 caratteri." />
          <Campo nome="Conferma nuova password" valore={conferma} onCambia={setConferma} completamento="new-password" Icona={KeyRound} />
          <Messaggio esito={esitoPassword} />
          <button type="submit" disabled={inCorso !== null || !attuale || !nuova || !conferma} className={pulsante}>
            {inCorso === "password" ? <LoaderCircle className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />} Cambia password
          </button>
        </form>
      </div>
    </div>
  );
}
