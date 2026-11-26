import { useState, type FormEvent } from "react";
import { Award, Coffee, Crown, Hourglass, RefreshCw, Sun, X } from "lucide-react";
import type { MembroParty, PropostaParty, TipoProposta } from "@dnd/regole/api.ts";
import { chiudiProposta, proponi, testoProposta, type ControllaEsito } from "../party";

interface Props {
  partyId: number;
  membri: MembroParty[];
  proposte: PropostaParty[]; // in sospeso
  riuscito: ControllaEsito;
  onFatto: () => Promise<void>; // ricarica il party
}

const campo = "bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-sm text-slate-100 outline-none focus:border-indigo-500";
const pulsanteNeutro = "flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700 disabled:opacity-50";

// Il Master propone ai personaggi scelti PE (divisi in parti uguali), un riposo o un giorno che passa.
// Ogni giocatore applica la proposta dalla sua scheda (o la rifiuta): finché non risponde resta "in attesa".
export default function AzioniMaster({ partyId, membri, proposte, riuscito, onFatto }: Props) {
  const personaggi = membri.flatMap(m => (m.personaggio ? [m.personaggio] : []));
  const [esclusi, setEsclusi] = useState<number[]>([]);
  const [pe, setPe] = useState("");
  const [motivo, setMotivo] = useState("");
  const [inCorso, setInCorso] = useState(false);
  const [fatto, setFatto] = useState<string | null>(null);

  const scelti = personaggi.filter(p => !esclusi.includes(p.id)).map(p => p.id);
  const totale = Number(pe);
  const peValidi = Number.isInteger(totale) && totale > 0;
  const quota = peValidi && scelti.length > 0 ? Math.floor(totale / scelti.length) : 0;

  const invia = async (tipo: TipoProposta) => {
    if (scelti.length === 0) return;
    setInCorso(true);
    const esito = await proponi(partyId, {
      tipo, personaggi: scelti, ...(tipo === "pe" ? { pe: totale } : {}), ...(motivo.trim() ? { motivo: motivo.trim() } : {}),
    });
    setInCorso(false);
    if (!riuscito(esito)) return;
    const chi = scelti.length === 1 ? "al personaggio" : `ai ${scelti.length} personaggi`;
    setFatto(tipo === "pe"
      ? `Proposti ${esito.dati.quota} PE a testa ${chi}.`
      : `Proposto ${testoProposta({ tipo, pe: null, motivo: "" })} ${chi}.`);
    if (tipo === "pe") setPe("");
    setMotivo("");
    await onFatto();
  };

  const assegnaPe = (e: FormEvent) => {
    e.preventDefault();
    if (peValidi && quota > 0) void invia("pe");
  };

  const ritira = async (p: PropostaParty) => {
    setInCorso(true);
    const esito = await chiudiProposta(partyId, p.id);
    setInCorso(false);
    // 404: il giocatore ha già risposto (non vuol dire che il party non c'è più), basta ricaricare.
    const giaChiusa = esito !== "sessione scaduta" && "errore" in esito && esito.stato === 404;
    if (giaChiusa || riuscito(esito)) await onFatto();
  };

  const alterna = (id: number) => setEsclusi(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));

  const AZIONI: { tipo: TipoProposta; etichetta: string; icona: typeof Coffee }[] = [
    { tipo: "riposo_breve", etichetta: "Riposo breve", icona: Coffee },
    { tipo: "riposo_lungo", etichetta: "Riposo lungo", icona: RefreshCw },
    { tipo: "giorno", etichetta: "Passa un giorno", icona: Sun },
  ];

  return (
    <section className="bg-slate-900 border border-amber-500/30 rounded-xl p-4 space-y-3">
      <h2 className="text-sm font-bold text-amber-200 flex items-center gap-2"><Crown className="w-4 h-4 text-amber-300" /> Azioni del Master</h2>

      <div className="flex flex-wrap gap-1.5">
        {personaggi.map(p => (
          <button key={p.id} onClick={() => alterna(p.id)} aria-pressed={!esclusi.includes(p.id)}
            className={`px-2.5 py-1 rounded-full text-xs font-semibold border transition ${esclusi.includes(p.id)
              ? "bg-slate-950 text-slate-500 border-slate-800 line-through" : "bg-indigo-600/20 text-indigo-200 border-indigo-500/40"}`}>
            {p.nome || "Senza nome"}
          </button>
        ))}
      </div>

      <form onSubmit={assegnaPe} className="flex flex-wrap items-center gap-2">
        <input type="number" min={1} value={pe} onChange={e => setPe(e.target.value)} placeholder="PE totali" className={`${campo} w-28`} />
        <input value={motivo} onChange={e => setMotivo(e.target.value)} maxLength={200} placeholder="Motivo (facoltativo)" className={`${campo} flex-1 min-w-40`} />
        <button type="submit" disabled={inCorso || !peValidi || quota < 1} className={pulsanteNeutro}>
          <Award className="w-3.5 h-3.5 text-amber-300" /> Assegna PE
        </button>
        {peValidi && scelti.length > 0 && (
          <span className="basis-full text-xs text-slate-400">
            {quota < 1 ? "Troppo pochi PE per dividerli." : `${quota} PE a testa${totale % scelti.length ? ` (${totale % scelti.length} restano fuori dalla divisione)` : ""}.`}
          </span>
        )}
      </form>

      <div className="flex flex-wrap gap-2">
        {AZIONI.map(a => (
          <button key={a.tipo} onClick={() => invia(a.tipo)} disabled={inCorso || scelti.length === 0} className={pulsanteNeutro}>
            <a.icona className="w-3.5 h-3.5" /> {a.etichetta}
          </button>
        ))}
      </div>
      <p className="text-[11px] text-slate-500">
        Ogni giocatore riceve la proposta nella sua scheda e la applica (con i suoi tiri: Dadi Vita, Presagio…) o la rifiuta.
        Il giorno che passa consuma le provviste.
      </p>
      {fatto && <p className="text-xs text-emerald-300">{fatto}</p>}

      {proposte.length > 0 && (
        <div className="space-y-1 border-t border-slate-800 pt-2">
          <h3 className="text-xs text-slate-400 font-semibold flex items-center gap-1.5"><Hourglass className="w-3.5 h-3.5" /> In attesa di risposta</h3>
          <ul className="space-y-1">
            {proposte.map(p => (
              <li key={p.id} className="flex items-center gap-2 text-xs text-slate-300">
                <span className="font-semibold text-slate-100">{p.personaggio}</span>: {testoProposta(p)}
                <button onClick={() => ritira(p)} disabled={inCorso} title="Ritira la proposta" className="ml-auto p-1 text-slate-500 hover:text-rose-300">
                  <X className="w-3.5 h-3.5" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
