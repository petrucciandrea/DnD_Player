import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { ChevronRight, LoaderCircle, LogOut, Sparkles, Upload, UserCog, UserPlus } from "lucide-react";
import { elencoPersonaggi, importaPersonaggio, type RiassuntoPersonaggio, type Utente } from "../accesso";
import { daJSON } from "@dnd/regole/scheda.ts";
import Avatar from "./Avatar";

const pulsanteNeutro = "flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700";

interface Props {
  utente: Utente;
  avviso?: string | null;
  onScegli: (id: number) => Promise<void>;
  onCrea: () => void;
  onAccount: () => void;
  onEsci: () => void;
  onSessioneScaduta: () => void;
}

export default function SchermataPersonaggi({ utente, avviso, onScegli, onCrea, onAccount, onEsci, onSessioneScaduta }: Props) {
  const [elenco, setElenco] = useState<RiassuntoPersonaggio[] | "caricamento" | "offline">("caricamento");
  const [inApertura, setInApertura] = useState<number | null>(null);
  const [errore, setErrore] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let attivo = true;
    elencoPersonaggi().then(r => {
      if (!attivo) return;
      if (r === "sessione scaduta") return onSessioneScaduta();
      setElenco(r);
    });
    return () => { attivo = false; };
  }, [onSessioneScaduta]);

  const apri = async (id: number) => {
    setInApertura(id);
    await onScegli(id);
    setInApertura(null);
  };

  const importa = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setErrore(null);
    try {
      const scheda = daJSON(JSON.parse(await file.text()));
      const esito = await importaPersonaggio(scheda);
      if ("errore" in esito) return setErrore(esito.errore);
      await apri(esito.id);
    } catch (err) {
      setErrore(`Importazione non riuscita: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const messaggio = errore ?? avviso;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-6 font-sans">
      <div className="max-w-3xl mx-auto space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-black text-white flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-indigo-400" /> I tuoi personaggi
            </h1>
            <p className="text-sm text-slate-400 mt-0.5">Scegli la scheda da aprire.</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onAccount} title="Account: username e password" className={pulsanteNeutro}>
              <UserCog className="w-3.5 h-3.5" /> {utente.username}
            </button>
            <button onClick={onEsci} title="Esci" className={`${pulsanteNeutro} hover:text-rose-300`}>
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </header>

        {messaggio && (
          <p role="alert" className="text-sm text-rose-300 bg-rose-950/40 border border-rose-900/60 rounded-lg px-3 py-2">{messaggio}</p>
        )}

        {elenco === "caricamento" && (
          <div className="flex justify-center py-10"><LoaderCircle className="w-6 h-6 text-indigo-400 animate-spin" /></div>
        )}
        {elenco === "offline" && (
          <p className="text-sm text-amber-300 bg-amber-950/30 border border-amber-900/50 rounded-lg px-3 py-2">
            Archivio non raggiungibile: controlla che il server sia avviato e ricarica la pagina.
          </p>
        )}

        {Array.isArray(elenco) && (
          <div className="grid gap-3 sm:grid-cols-2">
            {elenco.map(p => (
              <button
                key={p.id}
                onClick={() => apri(p.id)}
                disabled={inApertura !== null}
                className="group text-left bg-slate-900 border border-slate-800 hover:border-indigo-500/60 rounded-xl p-4 transition disabled:opacity-60 flex items-center gap-3"
              >
                <Avatar avatar={p.avatar ?? ""} nome={p.nome} dimensione="piccola" />
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-slate-100 truncate">{p.nome || "Senza nome"}</div>
                  <div className="text-xs text-slate-400 truncate">
                    {[p.razza, p.classe && `${p.classe} Liv. ${p.livello}`, p.sottoclasse].filter(Boolean).join(" • ")}
                  </div>
                </div>
                {inApertura === p.id
                  ? <LoaderCircle className="w-4 h-4 text-indigo-400 animate-spin" />
                  : <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-indigo-300" />}
              </button>
            ))}

            {elenco.length === 0 && (
              <div className="sm:col-span-2 bg-slate-900 border border-dashed border-slate-700 rounded-xl p-6 text-center space-y-1">
                <p className="text-slate-300 font-semibold">Non hai ancora personaggi.</p>
                <p className="text-sm text-slate-400">
                  Creane uno con la procedura guidata, oppure importa una scheda esportata in JSON.
                </p>
              </div>
            )}
          </div>
        )}

        {Array.isArray(elenco) && (
          <div className="flex flex-wrap gap-2">
            <button
              onClick={onCrea}
              disabled={inApertura !== null}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-semibold transition"
            >
              <UserPlus className="w-4 h-4" /> Crea personaggio
            </button>
            <button
              onClick={() => fileInput.current?.click()}
              disabled={inApertura !== null}
              className={`${pulsanteNeutro} px-4 py-2 text-sm`}
            >
              <Upload className="w-4 h-4" /> Importa personaggio (JSON)
            </button>
            <input ref={fileInput} type="file" accept="application/json,.json" onChange={importa} className="hidden" />
          </div>
        )}
      </div>
    </div>
  );
}
