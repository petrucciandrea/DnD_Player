import { Skull, HeartPulse } from "lucide-react";
import type { CharacterData, SetChar } from "../tipi";
import { esitoTsMorte, statoVita } from "../regole";
import type { ChiediD20 } from "../tiroDadi";

interface Props {
  char: CharacterData;
  setChar: SetChar;
  chiediD20: ChiediD20;
  onMessaggio: (testo: string) => void;
}

// Pallini cliccabili per correggere a mano successi e fallimenti (es. danno critico a 0 PF = 2 fallimenti).
function Pallini({ valore, colore, onCambia }: { valore: number; colore: string; onCambia: (n: number) => void }) {
  return (
    <span className="flex gap-1">
      {[1, 2, 3].map(n => (
        <button
          key={n}
          onClick={() => onCambia(valore === n ? n - 1 : n)}
          className={`w-3.5 h-3.5 rounded-full border ${n <= valore ? colore : "border-slate-600 bg-transparent"}`}
        />
      ))}
    </span>
  );
}

export default function TiriMorte({ char, setChar, chiediD20, onMessaggio }: Props) {
  const stato = statoVita(char);
  const { successi, fallimenti } = char.combattimento.tsMorte;

  const imposta = (campo: "successi" | "fallimenti", n: number) =>
    setChar(prev => ({
      ...prev,
      combattimento: { ...prev.combattimento, tsMorte: { ...prev.combattimento.tsMorte, [campo]: n } },
    }));

  const tira = async () => {
    const r = await chiediD20({ titolo: "Tiro salvezza contro morte", descrizione: "10 o più: successo. 1 naturale: due fallimenti. 20 naturale: torni a 1 PF." });
    if (!r) return;
    const dopo = esitoTsMorte(char, r.risultato);
    setChar(prev => esitoTsMorte(prev, r.risultato));
    const esito = statoVita(dopo);
    onMessaggio(
      esito === "in piedi" ? `TS contro morte: 20 naturale! Torni a 1 PF.`
        : esito === "stabile" ? `TS contro morte: ${r.risultato}. Tre successi: sei stabile.`
        : esito === "morto" ? `TS contro morte: ${r.risultato}. Tre fallimenti: il personaggio muore.`
        : `TS contro morte: ${r.risultato} → ${r.risultato >= 10 ? "successo" : r.risultato === 1 ? "due fallimenti" : "fallimento"}.`,
    );
  };

  if (stato === "morto") {
    return (
      <div className="mt-1 space-y-1">
        <div className="text-xs font-bold uppercase text-rose-400 flex items-center justify-center gap-1">
          <Skull className="w-3.5 h-3.5" /> Morto
        </div>
        <button
          onClick={() => {
            if (!confirm("Riportare in vita il personaggio con 1 PF (es. Rinascita)?")) return;
            setChar(prev => ({
              ...prev,
              combattimento: { ...prev.combattimento, pfAttuali: 1, stabile: false, tsMorte: { successi: 0, fallimenti: 0 } },
            }));
          }}
          className="w-full px-2 py-1 text-[11px] font-semibold rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
        >
          Riporta in vita (1 PF)
        </button>
      </div>
    );
  }
  if (stato === "stabile") {
    return (
      <div className="mt-1 text-[11px] font-semibold text-amber-300 flex items-center justify-center gap-1">
        <HeartPulse className="w-3.5 h-3.5" /> Stabile, privo di sensi
      </div>
    );
  }
  return (
    <div className="mt-1.5 space-y-1.5">
      <div className="flex items-center justify-center gap-3 text-[10px] uppercase font-semibold text-slate-400">
        <span className="flex items-center gap-1">Successi <Pallini valore={successi} colore="bg-emerald-500 border-emerald-400" onCambia={n => imposta("successi", n)} /></span>
        <span className="flex items-center gap-1">Fallimenti <Pallini valore={fallimenti} colore="bg-rose-500 border-rose-400" onCambia={n => imposta("fallimenti", n)} /></span>
      </div>
      <button onClick={tira} className="w-full px-2 py-1 text-xs font-semibold rounded bg-rose-600/30 hover:bg-rose-600/40 text-rose-200 border border-rose-500/40">
        TS contro morte
      </button>
    </div>
  );
}
