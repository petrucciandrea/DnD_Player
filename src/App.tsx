import { useCallback, useEffect, useState, useRef, type ChangeEvent } from "react";
import {
  Sparkles, RefreshCw, BookOpen, Backpack, Scroll, Award,
  Download, Upload, RotateCcw, Heart, Star, X, Coffee, Brain, Cloud, CloudCheck, CloudOff, CloudUpload, LoaderCircle, LogOut,
} from "lucide-react";
import type { CharacterData, EsitoRiposoBreve } from "./tipi";
import {
  applicaCura, applicaDanno, cdConcentrazione, derivate, riposoBreve, riposoLungo, segno,
} from "./regole";
import { carica, daJSON, nuovoPersonaggio } from "./salvataggio";
import { useSincronizzazione, type StatoSincronizzazione } from "./sincronizzazione";
import { esci, sessioneAttuale, type Utente } from "./accesso";
import SchermataAccesso from "./components/SchermataAccesso";
import { useRichiestaTiro } from "./tiroDadi";
import DialogoTiro from "./components/DialogoTiro";
import PannelloRiposoBreve from "./components/PannelloRiposoBreve";
import TiriMorte from "./components/TiriMorte";
import TabStatistiche from "./components/TabStatistiche";
import TabGrimorio from "./components/TabGrimorio";
import TabZaino from "./components/TabZaino";
import TabProgresso from "./components/TabProgresso";
import TabLore from "./components/TabLore";

type Tab = "statistiche" | "grimorio" | "zaino" | "xp" | "lore";

const SYNC: Record<StatoSincronizzazione, { icona: typeof Cloud; etichetta: string; descrizione: string; colore: string }> = {
  connessione: { icona: Cloud, etichetta: "Connessione…", descrizione: "Collegamento all'archivio in corso", colore: "text-slate-500" },
  sincronizzato: { icona: CloudCheck, etichetta: "Salvata", descrizione: "Scheda salvata nell'archivio condiviso", colore: "text-emerald-400/80" },
  "in invio": { icona: CloudUpload, etichetta: "Salvataggio…", descrizione: "Invio delle modifiche all'archivio", colore: "text-sky-400" },
  offline: { icona: CloudOff, etichetta: "Offline", descrizione: "Archivio non raggiungibile: la scheda è salvata solo su questo dispositivo e verrà inviata appena possibile", colore: "text-amber-400" },
};

// Prima di mostrare la scheda serve una sessione valida sul server.
export default function App() {
  const [sessione, setSessione] = useState<Utente | null | "verifica">("verifica");
  const [avviso, setAvviso] = useState<string | null>(null);

  useEffect(() => {
    let attivo = true;
    sessioneAttuale().then(s => {
      if (!attivo) return;
      setSessione(s === "offline" ? null : s);
      if (s === "offline") setAvviso("Archivio non raggiungibile: controlla che il server sia avviato.");
    });
    return () => { attivo = false; };
  }, []);

  const sessioneScaduta = useCallback(() => {
    setSessione(null);
    setAvviso("Sessione scaduta: accedi di nuovo. Le modifiche non salvate verranno inviate dopo l'accesso.");
  }, []);

  const uscita = async () => {
    await esci();
    setAvviso(null);
    setSessione(null);
  };

  if (sessione === "verifica") {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <LoaderCircle className="w-6 h-6 text-indigo-400 animate-spin" />
      </div>
    );
  }
  if (!sessione) {
    return <SchermataAccesso avviso={avviso} onAccesso={u => { setAvviso(null); setSessione(u); }} />;
  }
  return <Scheda key={sessione.personaggio} utente={sessione} onEsci={uscita} onSessioneScaduta={sessioneScaduta} />;
}

interface PropsScheda {
  utente: Utente;
  onEsci: () => void;
  onSessioneScaduta: () => void;
}

function Scheda({ utente, onEsci, onSessioneScaduta }: PropsScheda) {
  const [activeTab, setActiveTab] = useState<Tab>("statistiche");
  const [char, setChar] = useState<CharacterData>(() => carica(utente.personaggio));
  const [quantitaPF, setQuantitaPF] = useState("");
  const [messaggio, setMessaggio] = useState<string | null>(null);
  const [riposoBreveAperto, setRiposoBreveAperto] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const { richiesta, chiediTiro, chiediD20, rispondi } = useRichiestaTiro();

  const sync = SYNC[useSincronizzazione(utente.personaggio, char, setChar, onSessioneScaduta)];

  const d = derivate(char);
  const { combattimento: pf } = char;

  // Subire danni mentre ci si concentra richiede un TS su COS (CD 10 o metà del danno).
  const verificaConcentrazione = async (incantesimo: string, danno: number) => {
    const cd = cdConcentrazione(danno);
    const bonus = d.ts("COS");
    const r = await chiediD20({ titolo: `Concentrazione: ${incantesimo}`, descrizione: `Hai subito ${danno} danni: TS su COS con CD ${cd}.`, bonus });
    if (!r) return;
    const totale = r.risultato + bonus;
    if (totale >= cd) {
      setMessaggio(`TS Concentrazione: ${totale} contro CD ${cd}. Mantieni ${incantesimo}.`);
    } else {
      setChar(prev => (prev.concentrazione === incantesimo ? { ...prev, concentrazione: null } : prev));
      setMessaggio(`TS Concentrazione: ${totale} contro CD ${cd}. Concentrazione su ${incantesimo} persa.`);
    }
  };

  // --- Punti ferita (regole in applicaDanno / applicaCura) ---
  const applicaPF = async (tipo: "danno" | "cura" | "temp") => {
    const n = Math.max(0, parseInt(quantitaPF) || 0);
    if (n === 0 && tipo !== "temp") return;
    setQuantitaPF("");
    if (tipo === "temp") {
      setChar(prev => ({ ...prev, combattimento: { ...prev.combattimento, pfTemporanei: n } }));
      return;
    }
    if (tipo === "cura") {
      setChar(prev => applicaCura(prev, n));
      return;
    }
    const dopo = applicaDanno(char, n);
    setChar(prev => applicaDanno(prev, n));
    if (char.concentrazione && !dopo.concentrazione) {
      setMessaggio(`A 0 PF: concentrazione su ${char.concentrazione} persa.`);
    } else if (dopo.concentrazione) {
      await verificaConcentrazione(dopo.concentrazione, n);
    }
  };

  const completaRiposoBreve = (esito: EsitoRiposoBreve, riepilogo: string) => {
    setChar(prev => riposoBreve(prev, esito));
    setRiposoBreveAperto(false);
    setMessaggio(riepilogo);
  };

  // Il dialogo del tiro fa anche da conferma: annullarlo annulla il riposo.
  const eseguiRiposoLungo = async () => {
    if (pf.pfAttuali === 0) {
      alert("Serve almeno 1 PF per iniziare un riposo lungo.");
      return;
    }
    const presagio = await chiediTiro({
      titolo: "Riposo Lungo",
      descrizione: "PF e slot tornano al massimo e si ritirano i dadi del Presagio.",
      dadi: Array.from({ length: d.dadiPresagio }, (_, i) => ({ etichetta: `Presagio ${i + 1}`, facce: 20 })),
    });
    if (!presagio) return;
    setChar(prev => riposoLungo(prev, presagio));
    setMessaggio(`Riposo lungo completato. Nuovo Presagio: ${presagio.join(" e ")}.`);
  };

  const esporta = () => {
    const blob = new Blob([JSON.stringify(char, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${char.info.nome.replace(/\s+/g, "_")}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importa = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const nuovo = daJSON(JSON.parse(await file.text()));
      if (!confirm(`Sostituire la scheda attuale con "${nuovo.info.nome}"?`)) return;
      setChar(nuovo);
      setMessaggio(`Scheda "${nuovo.info.nome}" importata.`);
    } catch (err) {
      alert(`Importazione non riuscita: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const ripristina = () => {
    if (!confirm("Ripristinare la scheda ai dati iniziali? Tutti i progressi salvati andranno persi.")) return;
    setChar(nuovoPersonaggio());
    setMessaggio("Scheda ripristinata ai dati iniziali.");
  };

  const pulsante = "flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition";
  const pulsanteNeutro = `${pulsante} bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700`;

  const statistiche = [
    { label: "Classe Armatura", valore: d.ca, nota: "Senza armatura", colore: "text-amber-400" },
    { label: "Iniziativa", valore: segno(d.iniziativa), nota: "Destrezza", colore: "text-sky-400" },
    { label: "Velocità", valore: char.info.velocita, nota: "Piccola Taglia", colore: "text-indigo-400" },
    { label: "Bonus Comp.", valore: segno(d.comp), nota: `Livello ${char.info.livello}`, colore: "text-purple-400" },
    { label: "CD Magia", valore: d.cdMagia, nota: "8 + Comp + INT", colore: "text-violet-400" },
    { label: "Attacco Magico", valore: segno(d.attaccoMagico), nota: "Comp + INT", colore: "text-cyan-400" },
  ];

  const tabs: { id: Tab; label: string; icon: typeof Sparkles }[] = [
    { id: "statistiche", label: "Statistiche & Presagio", icon: Sparkles },
    { id: "grimorio", label: `Grimorio (${d.preparatiAttuali}/${d.maxPreparabili})`, icon: BookOpen },
    { id: "zaino", label: `Zaino (${d.pesoTotale.toFixed(1)}/${d.capacitaCarico} lb)`, icon: Backpack },
    { id: "xp", label: `Progresso XP (${char.xp.totale})`, icon: Award },
    { id: "lore", label: "Tratti & Background", icon: Scroll },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-3 sm:p-6 font-sans">
      <div className="max-w-6xl mx-auto space-y-6">

        {/* HEADER SCHEDA */}
        <header className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-3xl font-black tracking-tight text-white">{char.info.nome}</h1>
                <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  {char.info.sottoclasse}
                </span>
              </div>
              <p className="text-slate-400 text-sm mt-1">
                {char.info.razza} • {char.info.classe} Liv. {char.info.livello} • {char.info.background} ({char.info.allineamento})
              </p>
            </div>

            <div className="relative flex flex-wrap items-center gap-2">
              <span title={sync.descrizione} className={`flex items-center gap-1.5 px-2 py-1.5 text-xs font-semibold ${sync.colore}`}>
                <sync.icona className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{sync.etichetta}</span>
              </span>
              <button onClick={eseguiRiposoLungo} className={`${pulsante} bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border-emerald-500/30`}>
                <RefreshCw className="w-3.5 h-3.5" /> Riposo Lungo
              </button>
              <button onClick={() => setRiposoBreveAperto(true)} className={`${pulsante} bg-amber-600/15 hover:bg-amber-600/25 text-amber-300 border-amber-500/30`}>
                <Coffee className="w-3.5 h-3.5" /> Riposo Breve
              </button>
              <button onClick={esporta} className={pulsanteNeutro}>
                <Download className="w-3.5 h-3.5" /> Esporta JSON
              </button>
              <button onClick={() => fileInput.current?.click()} className={pulsanteNeutro}>
                <Upload className="w-3.5 h-3.5" /> Importa JSON
              </button>
              <input ref={fileInput} type="file" accept="application/json,.json" onChange={importa} className="hidden" />
              <button onClick={ripristina} title="Ripristina i dati iniziali" className={`${pulsanteNeutro} hover:text-rose-300`}>
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
              <button onClick={onEsci} title={`Esci (${utente.username})`} className={pulsanteNeutro}>
                <LogOut className="w-3.5 h-3.5" /> <span className="hidden sm:inline">{utente.username}</span>
              </button>
            </div>
          </div>

          <div className="relative grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 mt-5">
            <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800 text-center col-span-2">
              <div className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Punti Ferita</div>
              <div className={`text-2xl font-black mt-0.5 ${pf.pfAttuali === 0 ? "text-rose-500" : "text-emerald-400"}`}>
                {pf.pfAttuali} / {pf.pfMassimi}
                {pf.pfTemporanei > 0 && <span className="text-sky-400 text-lg"> +{pf.pfTemporanei}</span>}
              </div>
              {pf.pfAttuali === 0 && <TiriMorte char={char} setChar={setChar} chiediD20={chiediD20} onMessaggio={setMessaggio} />}
              <div className="flex justify-center gap-1 mt-1.5">
                <input
                  type="number"
                  min={0}
                  placeholder="0"
                  value={quantitaPF}
                  onChange={e => setQuantitaPF(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && applicaPF("danno")}
                  className="w-12 bg-slate-900 border border-slate-800 rounded px-1 py-0.5 text-xs text-center text-slate-200 outline-none focus:border-indigo-500"
                />
                <button onClick={() => applicaPF("danno")} className="px-2 py-0.5 text-xs bg-rose-950 hover:bg-rose-900 text-rose-300 rounded">Danno</button>
                <button onClick={() => applicaPF("cura")} className="px-2 py-0.5 text-xs bg-emerald-950 hover:bg-emerald-900 text-emerald-300 rounded">Cura</button>
                <button onClick={() => applicaPF("temp")} title="Imposta i PF temporanei" className="px-2 py-0.5 text-xs bg-sky-950 hover:bg-sky-900 text-sky-300 rounded">Temp</button>
              </div>
            </div>

            {statistiche.map(s => (
              <div key={s.label} className="bg-slate-950/80 p-3 rounded-xl border border-slate-800 text-center">
                <div className="text-xs text-slate-400 font-semibold uppercase tracking-wider">{s.label}</div>
                <div className={`text-2xl font-black mt-0.5 ${s.colore}`}>{s.valore}</div>
                <div className="text-xs text-slate-500">{s.nota}</div>
              </div>
            ))}
          </div>

          <div className="relative flex flex-wrap items-center gap-2 mt-3 text-xs">
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800/60 text-slate-400 border border-slate-800">
              <Heart className="w-3.5 h-3.5 text-rose-400" /> Dadi Vita <strong className="text-slate-200">{pf.dadiVitaRimanenti}/{char.info.livello}</strong> d6
            </span>
            <button
              onClick={() => setChar(prev => ({ ...prev, info: { ...prev.info, ispirazione: !prev.info.ispirazione } }))}
              className={`${pulsante} ${char.info.ispirazione ? "bg-amber-500/20 text-amber-300 border-amber-500/40" : "bg-slate-800 text-slate-500 border-slate-700"}`}
            >
              <Star className="w-3.5 h-3.5" /> Ispirazione
            </button>
            {char.concentrazione && (
              <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/15 text-amber-200 border border-amber-500/40">
                <Brain className="w-3.5 h-3.5" /> Concentrazione: <strong>{char.concentrazione}</strong>
                <button
                  onClick={() => setChar(prev => ({ ...prev, concentrazione: null }))}
                  title="Termina la concentrazione"
                  className="text-amber-400 hover:text-white"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            <span className="px-3 py-1.5 rounded-lg bg-slate-800/60 text-slate-400 border border-slate-800">
              Percezione passiva <strong className="text-slate-200">{d.percezionePassiva}</strong>
            </span>
            {messaggio && (
              <span className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-indigo-950/60 text-indigo-200 border border-indigo-800/60">
                {messaggio}
                <button onClick={() => setMessaggio(null)} className="text-indigo-400 hover:text-white"><X className="w-3 h-3" /></button>
              </span>
            )}
          </div>
        </header>

        {/* TABS */}
        <div className="flex border-b border-slate-800 gap-1 overflow-x-auto pb-1 text-sm font-semibold">
          {tabs.map(t => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl transition whitespace-nowrap ${
                  activeTab === t.id
                    ? "bg-slate-900 text-indigo-400 border-t border-x border-slate-800"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/40"
                }`}
              >
                <Icon className="w-4 h-4" />
                {t.label}
              </button>
            );
          })}
        </div>

        {activeTab === "statistiche" && <TabStatistiche char={char} d={d} setChar={setChar} chiediTiro={chiediTiro} chiediD20={chiediD20} />}
        {activeTab === "grimorio" && <TabGrimorio char={char} d={d} setChar={setChar} chiediTiro={chiediTiro} chiediD20={chiediD20} />}
        {activeTab === "zaino" && <TabZaino char={char} d={d} setChar={setChar} />}
        {activeTab === "xp" && <TabProgresso char={char} d={d} setChar={setChar} />}
        {activeTab === "lore" && <TabLore char={char} />}

      </div>

      {riposoBreveAperto && (
        <PannelloRiposoBreve
          char={char}
          d={d}
          chiediTiro={chiediTiro}
          onConferma={completaRiposoBreve}
          onAnnulla={() => setRiposoBreveAperto(false)}
        />
      )}
      {richiesta && <DialogoTiro key={richiesta.id} richiesta={richiesta} onRisposta={rispondi} />}
    </div>
  );
}
