import { useState, type FormEvent } from "react";
import { LoaderCircle, Lock, LogIn, Sparkles, User } from "lucide-react";
import { accedi, type Utente } from "../accesso";

interface Props {
  onAccesso: (utente: Utente) => void;
  avviso?: string | null; // per esempio "sessione scaduta" o "archivio non raggiungibile"
}

export default function SchermataAccesso({ onAccesso, avviso }: Props) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [errore, setErrore] = useState<string | null>(null);
  const [inCorso, setInCorso] = useState(false);

  const invia = async (e: FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) return;
    setInCorso(true);
    setErrore(null);
    const esito = await accedi(username, password);
    setInCorso(false);
    if ("utente" in esito) {
      onAccesso(esito.utente);
    } else {
      setErrore(esito.errore);
      setPassword("");
    }
  };

  const messaggio = errore ?? avviso;
  const campo = "w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-sm text-slate-100 outline-none focus:border-indigo-500 transition";

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4 font-sans">
      <form onSubmit={invia} className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-2xl space-y-4">
        <div className="text-center space-y-1">
          <Sparkles className="w-8 h-8 text-indigo-400 mx-auto" />
          <h1 className="text-xl font-black text-white">Scheda Personaggio</h1>
          <p className="text-sm text-slate-400">Accedi per aprire il tuo personaggio.</p>
        </div>

        <label className="block space-y-1">
          <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Username</span>
          <span className="relative block">
            <User className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={username}
              onChange={e => setUsername(e.target.value)}
              autoComplete="username"
              autoCapitalize="none"
              autoFocus
              className={campo}
            />
          </span>
        </label>

        <label className="block space-y-1">
          <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Password</span>
          <span className="relative block">
            <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete="current-password"
              className={campo}
            />
          </span>
        </label>

        {messaggio && (
          <p role="alert" className="text-sm text-rose-300 bg-rose-950/40 border border-rose-900/60 rounded-lg px-3 py-2">{messaggio}</p>
        )}

        <button
          type="submit"
          disabled={inCorso || !username.trim() || !password}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:hover:bg-indigo-600 text-white text-sm font-semibold transition"
        >
          {inCorso ? <LoaderCircle className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />} Accedi
        </button>
      </form>
    </div>
  );
}
