// Costumes du coach, gagnés dans le mode histoire : une couleur de tenue (filtre) et/ou un accessoire dessiné
// (tête, torse, ou dans le dos). Coordonnées du format des personnages (60 × 80, tête vers x 30, y 2 à 27).
export const COSTUMES = {
  bandeau: { name: "Bandeau du guerrier", desc: "Noué serré, prêt pour le combat.",
    head: `<path d="M18.2 10.6 Q30 5.6 41.8 10.6 L41.8 13.6 Q30 8.8 18.2 13.6 Z" fill="#e8283b"/><path d="M41.4 11.4 l6.6 -2.4 -1.6 3.8 3.2 2.8 -7.6 -.8 z" fill="#b8101f"/>` },
  neon: { name: "Tenue néon", desc: "Visible de l'autre bout de la salle.", filter: "hue-rotate(150deg) saturate(1.6) brightness(1.1)" },
  lunettes: { name: "Lunettes de star", desc: "Le regard du champion.",
    head: `<rect x="19.4" y="11.6" width="9.2" height="5.4" rx="2.4" fill="#101018"/><rect x="31.4" y="11.6" width="9.2" height="5.4" rx="2.4" fill="#101018"/><path d="M28.6 13.6 h2.8" stroke="#101018" stroke-width="1.4"/><path d="M21 13 h3.4 M33 13 h3.4" stroke="#fff" stroke-opacity=".55" stroke-width=".8" stroke-linecap="round"/>` },
  glace: { name: "Tenue glace", desc: "Calme et précis, même sous la barre.", filter: "hue-rotate(190deg) saturate(.7) brightness(1.25)" },
  casquette: { name: "Casquette du coach", desc: "Le style des vrais entraîneurs.",
    head: `<path d="M18.4 8.6 Q30 -2.6 41.6 8.6 Z" fill="#3466ff"/><path d="M18.4 8.4 Q31 6.6 51 9.6 Q45 12.2 18.4 10.4 Z" fill="#1a3bb0"/><circle cx="30" cy="1.8" r="1.1" fill="#fff"/>` },
  feu: { name: "Tenue de feu", desc: "Pour les séances qui brûlent.", filter: "hue-rotate(-28deg) saturate(1.9) brightness(1.05)" },
  cape: { name: "Cape de héros", desc: "Un vrai héros a une cape.",
    back: `<path d="M19.5 26.5 Q30 22.5 40.5 26.5 L47 63 Q30 69 13 63 Z" fill="#7a0012"/><path d="M19.5 26.5 Q30 22.5 40.5 26.5 L41.5 31 Q30 27.5 18.5 31 Z" fill="#a8001a"/>` },
  symbiote: { name: "Tenue symbiote", desc: "Le côté sombre de la force.", filter: "grayscale(1) brightness(.55) contrast(1.6)" },
  medaille: { name: "Médaille d'or", desc: "Gagnée au tournoi.",
    torso: `<path d="M26.6 25.5 L30 33 L33.4 25.5" stroke="#3466ff" stroke-width="2.2" fill="none" stroke-linejoin="round"/><circle cx="30" cy="35.6" r="3.6" fill="#f5c542" stroke="#b8860b" stroke-width=".8"/><path d="M30 33.6 l.7 1.4 1.5.2 -1.1 1 .3 1.5 -1.4 -.7 -1.4 .7 .3 -1.5 -1.1 -1 1.5 -.2z" fill="#fff6c8"/>` },
  couronne: { name: "Couronne de légende", desc: "Le sommet est à toi.",
    head: `<path d="M20.4 6.4 L22.4 -.4 L26.4 4 L30 -2.6 L33.6 4 L37.6 -.4 L39.6 6.4 Z" fill="#f5c542" stroke="#b8860b" stroke-width=".7" stroke-linejoin="round"/><circle cx="30" cy="2" r="1.2" fill="#e8283b"/><circle cx="24.6" cy="3.6" r=".8" fill="#3466ff"/><circle cx="35.4" cy="3.6" r=".8" fill="#3466ff"/>` },
  or: { name: "Tenue en or", desc: "Réservée aux légendes.", filter: "sepia(1) saturate(2.6) hue-rotate(-12deg) brightness(1.08)" },
};
export const costumeOf = id => (id && COSTUMES[id]) || null;
