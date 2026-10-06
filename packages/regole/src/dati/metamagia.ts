// Opzioni di Metamagia dello Stregone (5e 2014): costo in punti stregoneria e promemoria per il lancio.
// Le descrizioni complete stanno nel catalogo (server/semi/opzioni.ts, fonte "Metamagia").

export interface OpzioneMetamagia {
  nome: string;
  costo: (livelloIncantesimo: number) => number;
  nota: string;
}

export const METAMAGIE: OpzioneMetamagia[] = [
  { nome: "Incantesimo Accurato", costo: () => 1,
    nota: "Scegli fino a mod CAR creature: superano automaticamente il TS dell'incantesimo." },
  { nome: "Incantesimo Distante", costo: () => 1,
    nota: "Gittata raddoppiata; a contatto diventa 9 m." },
  { nome: "Incantesimo Esteso", costo: () => 1,
    nota: "Durata raddoppiata, fino a 24 ore." },
  { nome: "Incantesimo Gemello", costo: livello => Math.max(1, livello),
    nota: "Un secondo bersaglio, per un incantesimo che ne ha uno solo e non sé stessi." },
  { nome: "Incantesimo Intensificato", costo: () => 3,
    nota: "Un bersaglio ha svantaggio al primo TS contro l'incantesimo." },
  { nome: "Incantesimo Potenziato", costo: () => 1,
    nota: "Ritira fino a mod CAR dadi di danno (anche insieme a un'altra Metamagia)." },
  { nome: "Incantesimo Rapido", costo: () => 2,
    nota: "Tempo di lancio di 1 azione ridotto a 1 azione bonus." },
  { nome: "Incantesimo Sottile", costo: () => 1,
    nota: "Senza componenti verbali né somatiche." },
];

export const metamagia = (nome: string) => METAMAGIE.find(m => m.nome === nome);

// Fonte di Magia: punti stregoneria per creare uno slot di quel livello (massimo il 5°).
export const COSTO_SLOT_STREGONERIA = [2, 3, 5, 6, 7];
