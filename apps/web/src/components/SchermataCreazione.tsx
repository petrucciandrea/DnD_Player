import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ArrowLeft, ArrowRight, Check, Dices, LoaderCircle, RotateCcw, Sparkles, X } from "lucide-react";
import type { Caratteristica, CatalogoCreazione } from "@dnd/regole/tipi.ts";
import { ABILITA, CARATTERISTICHE, derivate, modificatore, segno } from "@dnd/regole/regole.ts";
import { CLASSI, incantesimiIniziali, LINGUE, NOMI_CLASSI, type NomeClasse } from "@dnd/regole/dati/classi.ts";
import {
  abilitaDoppie, abilitaPrimaDelBackground, ALLINEAMENTI, armiDisponibili, bonusRazziali, incantesimiDellaClasse,
  listaAbilitaClasse, mancaNelPasso, numeroTrucchettiIniziali, PASSI, personaggioIniziale, punteggiFinali, razzaCompleta,
  scelteIniziali, scelteVuote, sommaMigliori3, sottorazzeDi, strumentiTra, type SceltePersonaggio,
} from "@dnd/regole/creazione.ts";
import { catalogoCreazione, importaPersonaggio } from "../accesso";
import { useRichiestaTiro } from "../tiroDadi";
import DialogoTiro from "./DialogoTiro";
import Avatar from "./Avatar";
import ScegliMolti from "./ScegliMolti";

interface Props {
  giocatore: string; // proposto nel campo "Giocatore"
  onCreato: (id: number) => void;
  onAnnulla: () => void;
}

const nomeAbilita = (id: string) => ABILITA.find(a => a.id === id)?.nome ?? id;
const testoBonus = (b: Partial<Record<Caratteristica, number>>) =>
  Object.entries(b).map(([k, v]) => `${k} ${segno(v)}`).join(", ");

const card = "bg-slate-900 border border-slate-800 rounded-xl p-4";
const etichetta = "text-xs text-slate-400 font-semibold uppercase tracking-wider";
const campo = "w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-sm text-slate-200 outline-none focus:border-indigo-500";

// Scheda selezionabile (razza, classe, background...).
function Opzione({ scelta, onClick, titolo, sotto, children }: {
  scelta: boolean; onClick: () => void; titolo: string; sotto?: string; children?: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-left rounded-xl border p-3 transition ${scelta
        ? "bg-indigo-950/50 border-indigo-500 shadow-md shadow-indigo-500/10"
        : "bg-slate-900 border-slate-800 hover:border-slate-600"}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-bold text-slate-100">{titolo}</span>
        {scelta && <Check className="w-4 h-4 text-indigo-300 shrink-0" />}
      </div>
      {sotto && <div className="text-xs text-slate-400 mt-0.5">{sotto}</div>}
      {children}
    </button>
  );
}

// N menu a tendina per scelte singole ripetute (lingue, strumenti...).
function ScegliN({ titolo, n, opzioni, valori, onCambia }: {
  titolo: string; n: number; opzioni: string[]; valori: string[]; onCambia: (v: string[]) => void;
}) {
  if (n <= 0) return null;
  return (
    <div className="space-y-1">
      <div className={etichetta}>{titolo}</div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {Array.from({ length: n }, (_, i) => (
          <select
            key={i}
            value={valori[i] ?? ""}
            onChange={e => { const v = [...valori]; v[i] = e.target.value; onCambia(v); }}
            className={campo}
          >
            <option value="">Scegli...</option>
            {opzioni.filter(o => o === valori[i] || !valori.includes(o)).map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        ))}
      </div>
    </div>
  );
}

const ElencoPrivilegi = ({ privilegi }: { privilegi: { nome: string; descrizione: string }[] }) => (
  <ul className="space-y-1">
    {privilegi.map(p => (
      <li key={p.nome} className="text-xs text-slate-400"><strong className="text-slate-200">{p.nome}.</strong> {p.descrizione}</li>
    ))}
  </ul>
);

export default function SchermataCreazione({ giocatore, onCreato, onAnnulla }: Props) {
  const [catalogo, setCatalogo] = useState<CatalogoCreazione | null | "offline">(null);
  const [s, setS] = useState<SceltePersonaggio>(() => {
    const vuote = scelteVuote();
    return { ...vuote, dettagli: { ...vuote.dettagli, giocatore } };
  });
  const [passo, setPasso] = useState(0);
  const [errore, setErrore] = useState<string | null>(null);
  const [inCreazione, setInCreazione] = useState(false);
  const { richiesta, chiediTiro, rispondi } = useRichiestaTiro();

  useEffect(() => {
    let attivo = true;
    catalogoCreazione().then(c => { if (attivo) setCatalogo(c ?? "offline"); });
    return () => { attivo = false; };
  }, []);

  const cat = catalogo && catalogo !== "offline" ? catalogo : null;
  const razza = cat ? razzaCompleta(cat, s.razza, s.sottorazza) : null;
  const regole = s.classe ? CLASSI[s.classe] : null;
  const bg = cat?.background.find(b => b.nome === s.background) ?? null;
  const cambia = (parziale: Partial<SceltePersonaggio>) => setS(prev => ({ ...prev, ...parziale }));

  // Anteprima della scheda, appena le scelte bastano a costruirla.
  const anteprima = useMemo(() => {
    if (!cat) return null;
    try {
      const c = personaggioIniziale({ ...s, dettagli: { ...s.dettagli, nome: s.dettagli.nome || "?" } }, cat);
      return { c, d: derivate(c) };
    } catch {
      return null;
    }
  }, [s, cat]);

  if (catalogo === null) {
    return <div className="min-h-screen bg-slate-950 flex items-center justify-center"><LoaderCircle className="w-6 h-6 text-indigo-400 animate-spin" /></div>;
  }
  if (!cat) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
        <div className={`${card} max-w-md space-y-3`}>
          <p className="text-amber-300 text-sm">Catalogo non raggiungibile: controlla la connessione e riprova.</p>
          <button onClick={onAnnulla} className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-sm text-slate-200">Torna all'elenco</button>
        </div>
      </div>
    );
  }

  const idPasso = PASSI[passo].id;
  const manca = mancaNelPasso(idPasso, s, cat);
  const ultimo = passo === PASSI.length - 1;

  const tira4d6 = async () => {
    const tiri = await chiediTiro({
      titolo: `Caratteristica ${s.tiri.length + 1} di 6`,
      descrizione: "4d6: si scarta il dado più basso.",
      dadi: Array.from({ length: 4 }, (_, i) => ({ etichetta: `d6 n. ${i + 1}`, facce: 6 })),
    });
    if (tiri) setS(prev => ({ ...prev, tiri: [...prev.tiri, tiri].slice(0, 6) }));
  };

  const crea = async () => {
    setErrore(null);
    let c;
    try {
      c = personaggioIniziale(s, cat);
    } catch (e) {
      setErrore(e instanceof Error ? e.message : String(e));
      return;
    }
    setInCreazione(true);
    const esito = await importaPersonaggio(c);
    setInCreazione(false);
    if ("errore" in esito) setErrore(esito.errore);
    else onCreato(esito.id);
  };

  // --- Passi ---

  const passoRazza = () => {
    const madri = cat.razze.filter(r => r.madre === null);
    const sottorazze = sottorazzeDi(cat, s.razza);
    const trucchettiMago = incantesimiDellaClasse(cat, "Mago", 0).map(i => i.nome);
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {madri.map(r => (
            <Opzione
              key={r.nome}
              scelta={s.razza === r.nome}
              onClick={() => cambia({ razza: r.nome, sottorazza: "", bonusAScelta: [], abilitaRazza: [], lingueRazza: [], strumentoRazza: "", trucchettoRazza: "" })}
              titolo={r.nome}
              sotto={`${testoBonus(r.bonus)}${r.bonusAScelta ? `, +1 a ${r.bonusAScelta} a scelta` : ""} · ${r.velocita} · ${r.taglia}`}
            />
          ))}
        </div>
        {sottorazze.length > 0 && (
          <div className="space-y-2">
            <div className={etichetta}>{s.razza === "Dragonide" ? "Antenato draconico" : "Sottorazza"}</div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {sottorazze.map(r => (
                <Opzione
                  key={r.nome}
                  scelta={s.sottorazza === r.nome}
                  onClick={() => cambia({ sottorazza: r.nome, trucchettoRazza: "", lingueRazza: [] })}
                  titolo={r.nome.replace(/^Dragonide \((.*)\)$/, "$1")}
                  sotto={testoBonus(r.bonus) || r.privilegi[0]?.descrizione}
                />
              ))}
            </div>
          </div>
        )}
        {razza && (
          <div className={`${card} space-y-4`}>
            {razza.bonusAScelta > 0 && (
              <ScegliMolti
                titolo="+1 a scelta"
                opzioni={CARATTERISTICHE.filter(k => !razza.bonus[k])}
                scelte={s.bonusAScelta}
                massimo={razza.bonusAScelta}
                onCambia={v => cambia({ bonusAScelta: v as Caratteristica[] })}
              />
            )}
            {razza.abilitaAScelta > 0 && (
              <ScegliMolti
                titolo="Abilità a scelta"
                opzioni={ABILITA.map(a => a.id)}
                scelte={s.abilitaRazza}
                massimo={razza.abilitaAScelta}
                onCambia={v => cambia({ abilitaRazza: v })}
                nome={nomeAbilita}
              />
            )}
            <ScegliN
              titolo="Lingue a scelta"
              n={razza.lingueAScelta}
              opzioni={LINGUE.filter(l => !razza.lingue.includes(l))}
              valori={s.lingueRazza}
              onCambia={v => cambia({ lingueRazza: v })}
            />
            {razza.strumentiAScelta.length > 0 && (
              <ScegliN titolo="Strumento" n={1} opzioni={razza.strumentiAScelta} valori={[s.strumentoRazza]} onCambia={v => cambia({ strumentoRazza: v[0] ?? "" })} />
            )}
            {razza.trucchetto === "*" && (
              <ScegliN titolo="Trucchetto da mago" n={1} opzioni={trucchettiMago} valori={[s.trucchettoRazza]} onCambia={v => cambia({ trucchettoRazza: v[0] ?? "" })} />
            )}
            <div className="space-y-1">
              <div className={etichetta}>Tratti</div>
              <p className="text-xs text-slate-400">Lingue: {razza.lingue.join(", ")}{razza.abilita.length > 0 && ` · Abilità: ${razza.abilita.map(nomeAbilita).join(", ")}`}</p>
              <ElencoPrivilegi privilegi={razza.privilegi} />
            </div>
          </div>
        )}
      </div>
    );
  };

  const passoClasse = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {NOMI_CLASSI.map(nome => {
          const r = CLASSI[nome];
          const magia = r.incantatore ? ` · incantesimi (${r.incantatore.caratteristica})` : "";
          return (
            <Opzione
              key={nome}
              scelta={s.classe === nome}
              onClick={() => cambia({ classe: nome as NomeClasse, sottoclasse: "", abilitaClasse: [], strumentiClasse: [], scelteClasse: {}, equipaggiamento: [], trucchetti: [], incantesimi: [] })}
              titolo={nome}
              sotto={`d${r.dadoVita} · TS ${r.tiriSalvezza.join(", ")}${magia}`}
            />
          );
        })}
      </div>
      {regole && s.classe && (
        <div className={`${card} space-y-4`}>
          {regole.livelloSottoclasse === 1 && (
            <ScegliN titolo="Sottoclasse" n={1} opzioni={regole.sottoclassi} valori={[s.sottoclasse]} onCambia={v => cambia({ sottoclasse: v[0] ?? "" })} />
          )}
          <ScegliMolti
            titolo="Abilità"
            opzioni={listaAbilitaClasse(regole)}
            scelte={s.abilitaClasse}
            massimo={regole.abilita.numero}
            onCambia={v => cambia({ abilitaClasse: v })}
            nome={nomeAbilita}
          />
          {regole.strumentiAScelta && (
            <ScegliN
              titolo="Strumenti"
              n={regole.strumentiAScelta.numero}
              opzioni={strumentiTra(regole.strumentiAScelta.tra)}
              valori={s.strumentiClasse}
              onCambia={v => cambia({ strumentiClasse: v })}
            />
          )}
          {scelteIniziali(s, cat).map(({ scelta, numero, opzioni }) => (
            <ScegliMolti
              key={scelta.id}
              titolo={scelta.nome}
              opzioni={opzioni.map(o => o.nome)}
              scelte={s.scelteClasse[scelta.id] ?? []}
              massimo={numero}
              onCambia={v => cambia({ scelteClasse: { ...s.scelteClasse, [scelta.id]: v } })}
              suggerimento={v => opzioni.find(o => o.nome === v)?.descrizione}
            />
          ))}
          <p className="text-xs text-slate-400">
            Armature: {regole.armature.join(", ") || "nessuna"} · Armi: {regole.armi.join(", ")}
            {regole.strumenti.length > 0 && ` · Strumenti: ${regole.strumenti.join(", ")}`}
          </p>
          <div className="space-y-1">
            <div className={etichetta}>Privilegi di 1° livello</div>
            <ElencoPrivilegi
              privilegi={cat.privilegiClasse
                .filter(p => p.classe === s.classe && (p.sottoclasse === null || p.sottoclasse === s.sottoclasse))
                .map(p => p.privilegio)}
            />
            {regole.livelloSottoclasse > 1 && (
              <p className="text-xs text-slate-500">La sottoclasse si sceglie al {regole.livelloSottoclasse}° livello.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );

  const passoCaratteristiche = () => {
    const bonus = bonusRazziali(razza, s.bonusAScelta);
    const usati = new Set(Object.values(s.assegnazione));
    const finali = punteggiFinali(s, razza);
    return (
      <div className="space-y-4">
        <div className={`${card} space-y-3`}>
          <p className="text-sm text-slate-300">Tira 4d6 sei volte: per ogni tiro si scarta il dado più basso. Puoi usare i tuoi dadi o far tirare l'app.</p>
          <div className="flex flex-wrap gap-2">
            {s.tiri.map((t, i) => {
              const minimo = t.indexOf(Math.min(...t));
              return (
                <span key={i} className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-sm font-mono">
                  {t.map((v, j) => <span key={j} className={j === minimo ? "text-slate-600 line-through mr-1" : "text-slate-300 mr-1"}>{v}</span>)}
                  = <strong className="text-amber-400">{sommaMigliori3(t)}</strong>
                </span>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-2">
            {s.tiri.length < 6 && (
              <button onClick={tira4d6} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold">
                <Dices className="w-4 h-4" /> Tira 4d6 ({s.tiri.length + 1}/6)
              </button>
            )}
            {s.tiri.length > 0 && (
              <button
                onClick={() => confirm("Rifare tutti i tiri?") && cambia({ tiri: [], assegnazione: {} })}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm"
              >
                <RotateCcw className="w-4 h-4" /> Ricomincia
              </button>
            )}
          </div>
        </div>
        {s.tiri.length === 6 && (
          <div className={`${card} space-y-2`}>
            <div className={etichetta}>Assegna i tiri</div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {CARATTERISTICHE.map(k => {
                const i = s.assegnazione[k];
                return (
                  <label key={k} className="bg-slate-950/60 border border-slate-800 rounded-lg p-2 space-y-1">
                    <span className="text-xs font-bold text-slate-300">{k}</span>
                    <select
                      value={i ?? ""}
                      onChange={e => cambia({ assegnazione: { ...s.assegnazione, [k]: e.target.value === "" ? undefined : Number(e.target.value) } })}
                      className={campo}
                    >
                      <option value="">—</option>
                      {s.tiri.map((t, j) => (!usati.has(j) || j === i) && <option key={j} value={j}>{sommaMigliori3(t)}</option>)}
                    </select>
                    <span className="block text-xs text-slate-400">
                      {bonus[k] !== 0 && `razza ${segno(bonus[k])} · `}
                      {finali ? <>totale <strong className="text-slate-100">{finali[k]}</strong> ({segno(modificatore(finali[k]))})</> : " "}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  };

  const passoBackground = () => {
    const doppie = abilitaDoppie(s, razza, bg);
    const gia = abilitaPrimaDelBackground(s, razza);
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {cat.background.map(b => (
            <Opzione
              key={b.nome}
              scelta={s.background === b.nome}
              onClick={() => cambia({ background: b.nome, abilitaSostitutive: [], lingueBackground: [], strumentoBackground: "" })}
              titolo={b.nome}
              sotto={b.abilita.map(nomeAbilita).join(", ")}
            />
          ))}
        </div>
        {bg && (
          <div className={`${card} space-y-4`}>
            {doppie.length > 0 && (
              <ScegliN
                titolo={`Abilità già possedute (${doppie.map(nomeAbilita).join(", ")}): scegline altre`}
                n={doppie.length}
                opzioni={ABILITA.map(a => a.id).filter(a => !gia.includes(a) && !bg.abilita.includes(a)).map(nomeAbilita)}
                valori={s.abilitaSostitutive.map(nomeAbilita)}
                onCambia={v => cambia({ abilitaSostitutive: v.map(n => ABILITA.find(a => a.nome === n)?.id ?? "") })}
              />
            )}
            <ScegliN
              titolo="Lingue a scelta"
              n={bg.lingueAScelta}
              opzioni={LINGUE.filter(l => !razza?.lingue.includes(l) && !s.lingueRazza.includes(l))}
              valori={s.lingueBackground}
              onCambia={v => cambia({ lingueBackground: v })}
            />
            {bg.strumentiAScelta && (
              <ScegliN titolo="Strumento" n={1} opzioni={strumentiTra(bg.strumentiAScelta)} valori={[s.strumentoBackground]} onCambia={v => cambia({ strumentoBackground: v[0] ?? "" })} />
            )}
            <p className="text-xs text-slate-400">
              Abilità: {bg.abilita.map(nomeAbilita).join(", ")}
              {bg.strumenti.length > 0 && ` · Strumenti: ${bg.strumenti.join(", ")}`} · {bg.mo} mo
            </p>
            <ElencoPrivilegi privilegi={[bg.privilegio]} />
          </div>
        )}
      </div>
    );
  };

  const passoEquipaggiamento = () => {
    if (!regole) return null;
    const scegli = (g: number, parziale: Partial<{ opzione: number; armi: string[] }>) => {
      const eq = [...s.equipaggiamento];
      eq[g] = { ...(eq[g] ?? { opzione: 0, armi: [] }), ...parziale };
      cambia({ equipaggiamento: eq });
    };
    return (
      <div className="space-y-3">
        {regole.equipaggiamento.map((gruppo, g) => {
          const sceltaGruppo = s.equipaggiamento[g];
          const indice = gruppo.length === 1 ? 0 : sceltaGruppo?.opzione ?? -1;
          const opzione = gruppo[indice];
          const armiAScelta = opzione?.voci.filter(v => v.tipo === "armaAScelta") ?? [];
          return (
            <div key={g} className={`${card} space-y-2`}>
              {gruppo.length === 1 ? (
                <p className="text-sm text-slate-300">{gruppo[0].voci.map(v => ("nome" in v ? `${v.nome}${"qta" in v && v.qta && v.qta > 1 ? ` ×${v.qta}` : ""}` : "un'arma a scelta")).join(", ")}</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {gruppo.map((o, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => scegli(g, { opzione: i, armi: [] })}
                      className={`px-3 py-1.5 rounded-lg border text-sm transition ${indice === i
                        ? "bg-indigo-600 border-indigo-500 text-white"
                        : "bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-600"}`}
                    >
                      {o.etichetta}
                    </button>
                  ))}
                </div>
              )}
              {armiAScelta.map((v, j) => v.tipo === "armaAScelta" && (
                <select
                  key={j}
                  value={sceltaGruppo?.armi[j] ?? ""}
                  onChange={e => { const armi = [...(sceltaGruppo?.armi ?? [])]; armi[j] = e.target.value; scegli(g, { opzione: indice, armi }); }}
                  className={campo}
                >
                  <option value="">Scegli un'arma {v.categoria === "guerra" ? "da guerra" : "semplice"}{v.soloMischia ? " da mischia" : ""}...</option>
                  {armiDisponibili(cat, v).map(a => <option key={a.nome} value={a.nome}>{a.nome} ({a.dado} {a.tipoDanno.toLowerCase()})</option>)}
                </select>
              ))}
            </div>
          );
        })}
        {bg && (
          <div className={card}>
            <div className={etichetta}>Dal background ({bg.nome})</div>
            <p className="text-sm text-slate-300 mt-1">{bg.equipaggiamento.map(o => o.qta > 1 ? `${o.nome} ×${o.qta}` : o.nome).join(", ")} · {bg.mo} mo</p>
          </div>
        )}
      </div>
    );
  };

  const passoIncantesimi = () => {
    const inc = regole?.incantatore;
    if (!regole || !inc) {
      return <p className={`${card} text-sm text-slate-300`}>{s.classe || "Questa classe"} non lancia incantesimi al 1° livello.</p>;
    }
    const trucchetti = incantesimiDellaClasse(cat, s.classe, 0);
    const primo = incantesimiDellaClasse(cat, s.classe, 1);
    const nTrucchetti = Math.min(numeroTrucchettiIniziali(s.classe), trucchetti.length);
    const nIncantesimi = Math.min(incantesimiIniziali(s.classe), primo.length);
    const pochi = trucchetti.length < numeroTrucchettiIniziali(s.classe) || primo.length < incantesimiIniziali(s.classe);
    return (
      <div className={`${card} space-y-4`}>
        {nTrucchetti > 0 && (
          <ScegliMolti titolo="Trucchetti" opzioni={trucchetti.map(i => i.nome)} scelte={s.trucchetti} massimo={nTrucchetti} onCambia={v => cambia({ trucchetti: v })} />
        )}
        {nIncantesimi > 0 && (
          <ScegliMolti
            titolo={inc.modo === "libro" ? "Incantesimi nel libro" : "Incantesimi conosciuti"}
            opzioni={primo.map(i => i.nome)}
            scelte={s.incantesimi}
            massimo={nIncantesimi}
            onCambia={v => cambia({ incantesimi: v })}
          />
        )}
        {inc.modo === "preparati" && (
          <p className="text-xs text-slate-400">
            Il {s.classe.toLowerCase()} prepara ogni giorno gli incantesimi dall'intera lista della classe: riceverà tutti quelli
            di 1° livello presenti nel catalogo ({primo.map(i => i.nome).join(", ") || "nessuno per ora"}).
          </p>
        )}
        {pochi && (
          <p className="text-xs text-amber-300">
            Il catalogo contiene ancora pochi incantesimi per questa classe: potrai aggiungerne altri dal Grimorio.
          </p>
        )}
      </div>
    );
  };

  const passoDettagli = () => {
    const d = s.dettagli;
    const imposta = (parziale: Partial<SceltePersonaggio["dettagli"]>) => cambia({ dettagli: { ...d, ...parziale } });
    const testo = (k: "nome" | "giocatore" | "altezza" | "peso" | "occhi" | "capelli" | "carnagione", titolo: string) => (
      <label key={k} className="block space-y-1">
        <span className={etichetta}>{titolo}</span>
        <input value={d[k]} onChange={e => imposta({ [k]: e.target.value })} className={campo} />
      </label>
    );
    const area = (k: keyof SceltePersonaggio["dettagli"] & ("tratti" | "ideali" | "legami" | "difetti" | "backgroundBio"), titolo: string) => (
      <label key={k} className="block space-y-1">
        <span className={etichetta}>{titolo}</span>
        <textarea value={d[k]} onChange={e => imposta({ [k]: e.target.value })} rows={k === "backgroundBio" ? 4 : 2} className={campo} />
      </label>
    );
    return (
      <div className={`${card} space-y-4`}>
        <div className="flex items-center gap-3">
          <Avatar avatar={d.avatar} nome={d.nome} onCambia={avatar => imposta({ avatar })} />
          <p className="text-xs text-slate-400">Immagine del personaggio (facoltativa): clicca per sceglierla.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {testo("nome", "Nome del personaggio")}
          <label className="block space-y-1">
            <span className={etichetta}>Allineamento</span>
            <select value={d.allineamento} onChange={e => imposta({ allineamento: e.target.value })} className={campo}>
              <option value="">—</option>
              {ALLINEAMENTI.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </label>
          {testo("giocatore", "Giocatore")}
          <label className="block space-y-1">
            <span className={etichetta}>Età</span>
            <input type="number" min={0} value={d.eta || ""} onChange={e => imposta({ eta: Math.max(0, Number(e.target.value) || 0) })} className={campo} />
          </label>
          {testo("altezza", "Altezza")}
          {testo("peso", "Peso")}
          {testo("occhi", "Occhi")}
          {testo("capelli", "Capelli")}
          {testo("carnagione", "Carnagione")}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {area("tratti", "Tratti caratteriali")}
          {area("ideali", "Ideali")}
          {area("legami", "Legami")}
          {area("difetti", "Difetti")}
        </div>
        {area("backgroundBio", "Storia")}
      </div>
    );
  };

  const contenuto = {
    razza: passoRazza, classe: passoClasse, caratteristiche: passoCaratteristiche, background: passoBackground,
    equipaggiamento: passoEquipaggiamento, incantesimi: passoIncantesimi, dettagli: passoDettagli,
  }[idPasso]();

  const riepilogo = [
    ["Razza", razza?.nome],
    ["Classe", s.classe && `${s.classe}${s.sottoclasse ? ` (${s.sottoclasse})` : ""}`],
    ["Background", s.background],
  ] as const;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-3 sm:p-6 font-sans">
      <div className="max-w-6xl mx-auto space-y-5">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-black text-white flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-indigo-400" /> Nuovo personaggio
          </h1>
          <button onClick={() => confirm("Annullare la creazione? Le scelte andranno perse.") && onAnnulla()} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700">
            <X className="w-3.5 h-3.5" /> Annulla
          </button>
        </header>

        <nav className="flex flex-wrap gap-1.5">
          {PASSI.map((p, i) => {
            const completo = mancaNelPasso(p.id, s, cat) === null;
            const raggiungibile = PASSI.slice(0, i).every(q => mancaNelPasso(q.id, s, cat) === null);
            return (
              <button
                key={p.id}
                onClick={() => raggiungibile && setPasso(i)}
                disabled={!raggiungibile}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition disabled:opacity-40 ${i === passo
                  ? "bg-indigo-600 border-indigo-500 text-white"
                  : completo ? "bg-emerald-950/40 border-emerald-900/60 text-emerald-300" : "bg-slate-900 border-slate-800 text-slate-400"}`}
              >
                {i + 1}. {p.titolo}
              </button>
            );
          })}
        </nav>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <main className="lg:col-span-2 space-y-4">
            {contenuto}
            {errore && <p role="alert" className="text-sm text-rose-300 bg-rose-950/40 border border-rose-900/60 rounded-lg px-3 py-2">{errore}</p>}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <button
                onClick={() => setPasso(p => Math.max(0, p - 1))}
                disabled={passo === 0}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-sm text-slate-200"
              >
                <ArrowLeft className="w-4 h-4" /> Indietro
              </button>
              <span className="text-xs text-amber-300">{manca}</span>
              {ultimo ? (
                <button
                  onClick={crea}
                  disabled={manca !== null || inCreazione}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-semibold"
                >
                  {inCreazione ? <LoaderCircle className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Crea personaggio
                </button>
              ) : (
                <button
                  onClick={() => setPasso(p => p + 1)}
                  disabled={manca !== null}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-semibold"
                >
                  Avanti <ArrowRight className="w-4 h-4" />
                </button>
              )}
            </div>
          </main>

          <aside className={`${card} h-fit space-y-3 text-sm`}>
            <h2 className="font-bold text-slate-200">{s.dettagli.nome || "Riepilogo"}</h2>
            <dl className="space-y-1">
              {riepilogo.map(([k, v]) => (
                <div key={k} className="flex justify-between gap-2"><dt className="text-slate-500">{k}</dt><dd className="text-slate-200 text-right">{v || "—"}</dd></div>
              ))}
            </dl>
            {anteprima && (
              <>
                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-800">
                  {CARATTERISTICHE.map(k => (
                    <div key={k} className="bg-slate-950/60 rounded-lg p-1.5 text-center">
                      <div className="text-[10px] text-slate-500">{k}</div>
                      <div className="font-bold text-slate-100">{anteprima.c.caratteristiche[k].valore}</div>
                      <div className="text-xs text-slate-400">{segno(anteprima.d.mod(k))}</div>
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div><div className="text-[10px] text-slate-500">PF</div><div className="font-bold text-emerald-400">{anteprima.c.combattimento.pfMassimi}</div></div>
                  <div><div className="text-[10px] text-slate-500">CA</div><div className="font-bold text-amber-400">{anteprima.d.ca}</div></div>
                  <div><div className="text-[10px] text-slate-500">Velocità</div><div className="font-bold text-indigo-300">{anteprima.c.info.velocita}</div></div>
                </div>
                <p className="text-xs text-slate-400">
                  Abilità: {anteprima.c.competenzeAbilita.map(nomeAbilita).join(", ") || "—"}
                </p>
              </>
            )}
          </aside>
        </div>
      </div>
      {richiesta && <DialogoTiro key={richiesta.id} richiesta={richiesta} onRisposta={rispondi} />}
    </div>
  );
}
