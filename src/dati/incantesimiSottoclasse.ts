// Incantesimi concessi dalla sottoclasse (5e 2014). Nomi come nel catalogo `incantesimi`.

// [livello del personaggio da cui si hanno, incantesimi]
export type IncantesimiPerLivello = [number, string[]][];

// Incantesimi del Circolo della Terra, per terreno (scelto come privilegio con fonte "Terreno del Circolo").
export const TERRENI: Record<string, IncantesimiPerLivello> = {
  Artico: [[3, ["Blocca Persone", "Crescita di Spine"]], [5, ["Tempesta di Nevischio", "Lentezza"]], [7, ["Libertà di Movimento", "Tempesta di Ghiaccio"]], [9, ["Comunione con la Natura", "Cono di Freddo"]]],
  Costa: [[3, ["Immagine Speculare", "Passo Velato"]], [5, ["Respirare Sott'Acqua", "Camminare sull'Acqua"]], [7, ["Controllare Acqua", "Libertà di Movimento"]], [9, ["Evocare Elementale", "Scrutare"]]],
  Deserto: [[3, ["Sfocatura", "Silenzio"]], [5, ["Creare Cibo e Acqua", "Protezione dall'Energia"]], [7, ["Avvizzire", "Terreno Illusorio"]], [9, ["Piaga di Insetti", "Muro di Pietra"]]],
  Foresta: [[3, ["Pelle Coriacea", "Movimenti del Ragno"]], [5, ["Invocare il Fulmine", "Crescita Vegetale"]], [7, ["Divinazione", "Libertà di Movimento"]], [9, ["Comunione con la Natura", "Camminare tra gli Alberi"]]],
  Montagna: [[3, ["Movimenti del Ragno", "Crescita di Spine"]], [5, ["Fulmine", "Fondersi nella Pietra"]], [7, ["Scolpire Pietra", "Pelle di Pietra"]], [9, ["Passapareti", "Muro di Pietra"]]],
  Palude: [[3, ["Oscurità", "Freccia Acida di Melf"]], [5, ["Camminare sull'Acqua", "Nube Maleodorante"]], [7, ["Libertà di Movimento", "Localizzare Creatura"]], [9, ["Piaga di Insetti", "Scrutare"]]],
  Prateria: [[3, ["Invisibilità", "Passare Senza Tracce"]], [5, ["Luce Diurna", "Velocità"]], [7, ["Divinazione", "Libertà di Movimento"]], [9, ["Sogno", "Piaga di Insetti"]]],
  Underdark: [[3, ["Movimenti del Ragno", "Ragnatela"]], [5, ["Forma Gassosa", "Nube Maleodorante"]], [7, ["Invisibilità Superiore", "Scolpire Pietra"]], [9, ["Nube Mortale", "Piaga di Insetti"]]],
};
