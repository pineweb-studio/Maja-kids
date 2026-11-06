// Lista de brinquedos que o painel aceita. O id é o nome usado no banco e NÃO deve mudar.
// Precisa bater com a lista `brinquedos` do public/index.html (site).
export const BRINQUEDOS = [
  { id: "toboga", nome: "Tobogã Premium 2x1", cat: "Infláveis" },
  { id: "futebol-sabao", nome: "Futebol de Sabão", cat: "Infláveis" },
  { id: "guerra-cotonete", nome: "Guerra de Cotonete", cat: "Infláveis" },
  { id: "multiplay", nome: "Multiplay 3x1", cat: "Infláveis" },
  { id: "bolao-futebol", nome: "Bolão de Futebol Inflável", cat: "Infláveis" },
  { id: "cama-elastica", nome: "Cama Elástica", cat: "Playground" },
  { id: "piscina-bolinhas", nome: "Piscina de Bolinhas", cat: "Playground" },
  { id: "mini-escorregador", nome: "Mini Escorregador", cat: "Playground" },
  { id: "pebolim", nome: "Mesa de Pebolim", cat: "Jogos" },
  { id: "aero-hockey", nome: "Mesa de Aero Hockey", cat: "Jogos" },
  { id: "basquete", nome: "Basquete Infantil Eletrônico", cat: "Jogos" },
  { id: "algodao-doce", nome: "Máquina de Algodão Doce", cat: "Extras" },
  { id: "maquina-espuma", nome: "Máquina de Espuma", cat: "Extras" },
  { id: "maquina-bolha", nome: "Máquina de Bolha de Sabão", cat: "Extras" }
];
export const IDS = new Set(BRINQUEDOS.map(b => b.id));
export const nomeDo = id => (BRINQUEDOS.find(b => b.id === id) || {}).nome || id;
