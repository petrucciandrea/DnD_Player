import { useState, type FormEvent } from "react";
import { LoaderCircle, Lock, LogIn, Sparkles, User, UserPlus } from "lucide-react";
import { accedi, registra, type Utente } from "../accesso";

interface Props {
  onAccesso: (utente: Utente) => void;
  avviso?: string | null; // per esempio "sessione scaduta" o "archivio non raggiungibile"
}

type Modalita = "accesso" | "registrazione";

export default function SchermataAccesso({ onAccesso, avviso }: Props) {
  const [modalita, setModalita] = useState<Modalita>("accesso");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [conferma, setConferma] = useState("");
  const [errore, setErrore] = useState<string | null>(null);
  const [inCorso, setInCorso] = useState(false);

  const registrazione = modalita === "registrazione";
  const completo = username.trim() !== "" && password !== "" && (!registrazione || conferma !== "");

  const cambiaModalita = () => {
    setModalita(registrazione ? "accesso" : "registrazione");
    setErrore(null);
    setPassword("");
    setConferma("");
  };

  const invia = async (e: FormEvent) => {
    e.preventDefault();
    if (!completo) return;
    if (registrazione && password !== conferma) return setErrore("Le due password non coincidono.");
    setInCorso(true);
    setErrore(null);
    const esito = registrazione ? await registra(username, password) : await accedi(username, password);
    setInCorso(false);
    if ("utente" in esito) {
      onAccesso(esito.utente);
    } else {
      setErrore(esito.errore);
      if (!registrazione) setPassword("");
    }
  };

  const messaggio = errore ?? avviso;
  const campo = "w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-sm text-slate-100 outline-none focus:border-indigo-500 transition";
  const etichetta = "text-xs text-slate-400 font-semibold uppercase tracking-wider";
  const icona = "w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2";

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4 font-sans">
      <form onSubmit={invia} className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-2xl space-y-4">
        <div className="text-center space-y-1">
          <Sparkles className="w-8 h-8 text-indigo-400 mx-auto" />
          <h1 className="text-xl font-black text-white">Scheda Personaggio</h1>
          <p className="text-sm text-slate-400">
            {registrazione ? "Crea un account per salvare i tuoi personaggi." : "Accedi per aprire i tuoi personaggi."}
          </p>
        </div>

        <label className="block space-y-1">
          <span className={etichetta}>Username</span>
          <span className="relative block">
            <User className={icona} />
            <input
              value={username}
              onChange={e => setUsername(e.target.value)}
              autoComplete="username"
              autoCapitalize="none"
              autoFocus
              className={campo}
            />
          </span>
          {registrazione && <span className="block text-xs text-slate-500">Da 3 a 30 caratteri: lettere, numeri, punto, trattini.</span>}
        </label>

        <label className="block space-y-1">
          <span className={etichetta}>Password</span>
          <span className="relative block">
            <Lock className={icona} />
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete={registrazione ? "new-password" : "current-password"}
              className={campo}
            />
          </span>
          {registrazione && <span className="block text-xs text-slate-500">Almeno 8 caratteri.</span>}
        </label>

        {registrazione && (
          <label className="block space-y-1">
            <span className={etichetta}>Conferma password</span>
            <span className="relative block">
              <Lock className={icona} />
              <input
                type="password"
                value={conferma}
                onChange={e => setConferma(e.target.value)}
                autoComplete="new-password"
                className={campo}
              />
            </span>
          </label>
        )}

        {messaggio && (
          <p role="alert" className="text-sm text-rose-300 bg-rose-950/40 border border-rose-900/60 rounded-lg px-3 py-2">{messaggio}</p>
        )}

        <button
          type="submit"
          disabled={inCorso || !completo}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:hover:bg-indigo-600 text-white text-sm font-semibold transition"
        >
          {inCorso
            ? <LoaderCircle className="w-4 h-4 animate-spin" />
            : registrazione ? <UserPlus className="w-4 h-4" /> : <LogIn className="w-4 h-4" />}
          {registrazione ? "Crea account" : "Accedi"}
        </button>

        <p className="text-center text-sm text-slate-400">
          {registrazione ? "Hai già un account?" : "Non hai un account?"}{" "}
          <button type="button" onClick={cambiaModalita} className="text-indigo-300 hover:text-indigo-200 font-semibold">
            {registrazione ? "Accedi" : "Registrati"}
          </button>
        </p>
      </form>
    </div>
  );
}
