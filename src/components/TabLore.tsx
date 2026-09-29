import type { CharacterData } from "../tipi";

const TRATTI: { k: keyof CharacterData["lore"]; titolo: string }[] = [
  { k: "tratti", titolo: "Tratti Caratteriali" },
  { k: "ideali", titolo: "Ideali" },
  { k: "legami", titolo: "Legami" },
  { k: "difetti", titolo: "Difetti" },
];

export default function TabLore({ char }: { char: CharacterData }) {
  const { info } = char;
  const dettagli = [
    ["Età", `${info.eta} anni`],
    ["Altezza", info.altezza],
    ["Peso", info.peso],
    ["Occhi", info.occhi],
    ["Capelli", info.capelli],
    ["Carnagione", info.carnagione],
    ["Giocatore", info.giocatore],
  ];

  return (
    <div className="space-y-6 text-sm">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          {TRATTI.map(t => (
            <div key={t.k} className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
              <h3 className="text-xs font-bold text-indigo-400 uppercase tracking-wider mb-1">{t.titolo}</h3>
              <p className="text-slate-300 leading-relaxed">{char.lore[t.k]}</p>
            </div>
          ))}
        </div>

        <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl space-y-3 h-fit">
          <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider">Biografia & Spedizione Underdark</h3>
          <p className="text-slate-300 leading-relaxed text-xs sm:text-sm">{char.lore.backgroundBio}</p>
          <div className="pt-4 border-t border-slate-800 grid grid-cols-2 gap-2 text-xs text-slate-400">
            {dettagli.map(([etichetta, valore]) => (
              <div key={etichetta}>{etichetta}: <strong className="text-slate-200">{valore}</strong></div>
            ))}
          </div>
        </div>
      </div>

      <div>
        <h2 className="text-lg font-bold text-slate-200 mb-3">Privilegi di Razza, Classe e Background</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {char.privilegi.map(p => (
            <div key={p.nome} className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
              <div className="flex items-center justify-between gap-2 mb-1">
                <h3 className="font-bold text-slate-200">{p.nome}</h3>
                <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 whitespace-nowrap">
                  {p.fonte}
                </span>
              </div>
              <p className="text-slate-400 text-xs leading-relaxed">{p.descrizione}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
