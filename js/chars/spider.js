// Personnage de référence pour le format des coachs animés.
//
// FORMAT D'UN PERSONNAGE (tous les coachs suivent ce contrat) — repère SVG 60 × 80 (viewBox "0 0 60 80"),
// vue de face, sol à y = 78. Le moteur (js/spidey.js) assemble les parties dans cet ordre :
//   <g class="sp-body"> back · legL · legR · armL · torso · armR (+ haltère auto à la main) · head · zzz </g>
// et les fait pivoter autour de points FIXES (ne pas les déplacer) :
//   armL : épaule (20, 30) → main ≈ (14.3, 49.5)      armR : épaule (40, 30) → main ≈ (45.7, 49.5)
//   legL : hanche (26, 48) → pied ≈ (23, 76)          legR : hanche (34, 48) → pied ≈ (37, 76)
//   head : cou (30, 26), tête centrée ≈ (30, 14) ; une grosse tête « chibi » peut aller de x 8 à 52 et y -6 à 28
//   body : (30, 76) (respiration, atterrissage)
// La tête doit contenir <g class="sp-eyes"> avec un élément class="sp-eyeL" et un class="sp-eyeR"
// (clignement + humeurs). Elle sert aussi d'avatar (recadrée seule) : elle doit être lisible seule.
// Les id de dégradés / motifs DOIVENT commencer par `${id}-` (plusieurs coachs s'affichent ensemble).
// `css` (facultatif) : petites animations propres au personnage, sélecteurs préfixés par `.ch-${id}`.
//
// Champs :
//   id, name, group ("Héros" | "Manga" | "Mignons" | "Animaux"), bio (1 phrase), persona (voix pour l'IA),
//   travel : "web" (toile) | "fly" (vole) | "hop" (sautille) | "dash" (ninja, très rapide) | "walk"
//   climb : true s'il peut marcher sur les murs et le plafond
//   fx : { color, trail } — trail : "none" | "sparks" | "hearts" | "stars" | "smoke" | "bubbles" | "leaves" | "aura"
//   defs, back?, legL, legR, armL, armR, torso, head, css?
//   lines : { hello: [], tap: [], pr: [], rest: [], sleep: [] } — courtes répliques en français, dans le ton du personnage

export default {
  id: "spider",
  name: "Spider-Man",
  group: "Héros",
  bio: "Le héros du quartier : agile, blagueur et toujours là pour ta série suivante.",
  persona: "Héros de quartier enthousiaste, blagueur et bienveillant, qui glisse des références aux toiles et à la responsabilité.",
  travel: "web",
  climb: true,
  fx: { color: "#ff3b4e", trail: "none" },
  defs: `<linearGradient id="spider-red" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff3b4e"/><stop offset="1" stop-color="#c3001a"/></linearGradient>
    <linearGradient id="spider-blue" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3466ff"/><stop offset="1" stop-color="#1a3bb0"/></linearGradient>
    <pattern id="spider-web" width="4" height="4" patternUnits="userSpaceOnUse"><path d="M0 0H4M0 0V4" stroke="#5a0010" stroke-width=".35" opacity=".55"/></pattern>`,
  legL: `<path d="M26 48 L24 61" stroke="#2549d6" stroke-width="7" stroke-linecap="round"/><path d="M24 61 L24 73" stroke="#dc1428" stroke-width="6.4" stroke-linecap="round"/><ellipse cx="23" cy="75.5" rx="4.2" ry="2.6" fill="#a8001a"/>`,
  legR: `<path d="M34 48 L36 61" stroke="#2549d6" stroke-width="7" stroke-linecap="round"/><path d="M36 61 L36 73" stroke="#dc1428" stroke-width="6.4" stroke-linecap="round"/><ellipse cx="37" cy="75.5" rx="4.2" ry="2.6" fill="#a8001a"/>`,
  armL: `<path d="M20 30 L16 39.5" stroke="#2549d6" stroke-width="5.6" stroke-linecap="round"/><path d="M16 39.5 L14.5 48" stroke="#dc1428" stroke-width="5" stroke-linecap="round"/><circle cx="14.3" cy="49.5" r="3" fill="#d10a22"/>`,
  armR: `<path d="M40 30 L44 39.5" stroke="#2549d6" stroke-width="5.6" stroke-linecap="round"/><path d="M44 39.5 L45.5 48" stroke="#dc1428" stroke-width="5" stroke-linecap="round"/><circle cx="45.7" cy="49.5" r="3" fill="#d10a22"/>`,
  torso: `<path d="M18.5 28 Q30 23.5 41.5 28 L39.5 48.5 Q30 51.5 20.5 48.5 Z" fill="url(#spider-red)"/>
      <path d="M18.5 28 Q30 23.5 41.5 28 L39.5 48.5 Q30 51.5 20.5 48.5 Z" fill="url(#spider-web)"/>
      <path d="M18.6 29 L20.6 48 L23.4 48.8 L22.4 31Z M41.4 29 L39.4 48 L36.6 48.8 L37.6 31Z" fill="url(#spider-blue)"/>
      <path d="M21 46.5 Q30 49.5 39 46.5" stroke="#7a0012" stroke-width="1" fill="none"/>
      <g fill="#0b0b12"><ellipse cx="30" cy="34.5" rx="1.6" ry="2.4"/><circle cx="30" cy="31.4" r="1.1"/>
        <path d="M29 33 L24.5 29.5 M31 33 L35.5 29.5 M29 34.5 L24 34 M31 34.5 L36 34 M29 36 L25 39.5 M31 36 L35 39.5" stroke="#0b0b12" stroke-width=".6"/></g>`,
  head: `<ellipse cx="30" cy="14.5" rx="11.2" ry="12.6" fill="url(#spider-red)"/>
      <g stroke="#6b0012" stroke-width=".45" fill="none" opacity=".75">
        <path d="M30 2 V27"/><path d="M30 13 L19.5 8 M30 13 L40.5 8 M30 15 L19 16 M30 15 L41 16 M30 17 L21.5 23.5 M30 17 L38.5 23.5"/>
        <path d="M24 5.5 Q30 8.5 36 5.5 M21 11 Q30 15 39 11 M20.5 19 Q30 23 39.5 19 M24 25 Q30 27 36 25"/>
      </g>
      <g class="sp-eyes">
        <path class="sp-eyeL" d="M20.3 12.6 Q24.5 7.6 28.6 13.6 Q26.2 18.6 21.4 17.2 Z" fill="#fff" stroke="#0b0b12" stroke-width="1.5" stroke-linejoin="round"/>
        <path class="sp-eyeR" d="M39.7 12.6 Q35.5 7.6 31.4 13.6 Q33.8 18.6 38.6 17.2 Z" fill="#fff" stroke="#0b0b12" stroke-width="1.5" stroke-linejoin="round"/>
      </g>`,
  lines: {
    hello: ["Salut ! Prêt à tisser une belle séance ?", "Ton voisin sympathique est là. On s'entraîne ?"],
    tap: ["Hé, ça chatouille !", "Mon sens d'araignée me dit que c'est l'heure de bouger."],
    pr: ["Nouveau record ! Même moi je suis impressionné.", "Ça, c'est un exploit digne d'un héros !"],
    rest: ["Je pends là pendant ton repos. Respire.", "Repos : je garde un œil sur le chrono."],
    sleep: ["Zzz… réveille-moi pour une séance…"],
  },
};
