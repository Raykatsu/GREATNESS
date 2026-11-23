// Les recettes des repas du plan composé par l'app (mealplan.js) : les étapes de préparation et le temps, pour chaque
// repas simple. Les repas composés par l'IA ont leurs propres étapes ; tes repas à toi, celles que tu écris.
// Logique pure, testée dans Node.
export const RECIPES = {
  // Petits-déjeuners
  "Porridge banane": [5, ["Fais chauffer le lait avec les flocons d'avoine 3 à 4 min, en remuant.", "Ajoute la banane coupée en rondelles.", "Sers avec le skyr, à côté ou mélangé."]],
  "Œufs et tartines": [10, ["Cuis les œufs : 9 min dans l'eau bouillante pour des œufs durs, ou brouillés à la poêle.", "Fais griller le pain.", "Sers avec le fromage blanc et le kiwi coupé."]],
  "Bol yaourt grec, muesli et fraises": [3, ["Verse le yaourt dans un bol.", "Ajoute le muesli, les fraises coupées et les amandes."]],
  "Tartines beurre de cacahuète": [4, ["Fais griller le pain et tartine le beurre de cacahuète.", "Ajoute la banane en rondelles.", "Un verre de lait à côté."]],
  // Déjeuners
  "Poulet, riz et brocoli": [20, ["Fais cuire le riz 10 à 12 min et le brocoli 6 min à la vapeur.", "Coupe le poulet en morceaux et fais-le dorer 6 à 8 min à la poêle avec l'huile.", "Assaisonne (sel, poivre, paprika) et sers."]],
  "Saumon, pâtes complètes et haricots verts": [20, ["Fais cuire les pâtes 10 min et les haricots verts 8 min.", "Cuis le saumon 4 min par face à la poêle, ou 12 min au four à 200 °C.", "Arrose d'un filet d'huile d'olive et de citron."]],
  "Bowl lentilles, riz et œufs": [15, ["Réchauffe les lentilles et le riz (cuits la veille, ou en sachet).", "Cuis les œufs 7 min pour un jaune mollet.", "Râpe la carotte, assemble le bol et arrose d'huile."]],
  "Dinde, quinoa et courgettes": [20, ["Rince le quinoa et fais-le cuire 12 min.", "Coupe les courgettes en dés et fais-les sauter 8 min.", "Fais dorer la dinde 4 min par face, puis assaisonne."]],
  "Tofu sauté, nouilles et légumes": [15, ["Coupe le tofu en cubes et fais-le dorer 8 min dans l'huile.", "Ajoute le poivron et le brocoli émincés, 5 min à feu vif.", "Ajoute les nouilles cuites et la sauce soja, mélange 2 min."]],
  "Steak haché, pommes de terre et salade": [25, ["Fais cuire les pommes de terre 20 min à l'eau, ou en quartiers au four.", "Cuis le steak 2 à 3 min par face.", "Sers avec la salade et la vinaigrette."]],
  "Wrap thon crudités": [5, ["Mélange le thon égoutté avec le fromage blanc.", "Étale sur le wrap avec la tomate et la salade.", "Roule bien serré et coupe en deux."]],
  // Dîners
  "Cabillaud, patate douce et épinards": [25, ["Coupe la patate douce en cubes et rôtis-la 20 min au four à 200 °C.", "Cuis le cabillaud 10 à 12 min au four, ou 3 min par face à la poêle.", "Fais tomber les épinards 2 min à la poêle avec l'huile."]],
  "Omelette, pain et salade": [10, ["Bats les œufs avec le fromage râpé, du sel et du poivre.", "Cuis l'omelette 3 à 4 min à feu moyen.", "Sers avec le pain et la salade assaisonnée."]],
  "Poulet au curry maison et riz": [25, ["Fais revenir l'oignon et le poivron émincés 5 min.", "Ajoute le poulet en morceaux et une cuillère à café de curry, 6 min.", "Verse le lait de coco, laisse mijoter 8 min et sers avec le riz."]],
  "Chili sin carne": [20, ["Fais revenir l'oignon émincé 3 min.", "Ajoute les haricots rouges, la sauce tomate, le maïs, du cumin et du piment : 10 min à feu doux.", "Sers sur le riz avec l'avocat en dés."]],
  "Pâtes bolognaise maison": [20, ["Fais dorer la viande hachée 5 min.", "Ajoute la sauce tomate et laisse mijoter 10 min.", "Sers sur les pâtes avec le fromage râpé, la salade à côté."]],
  "Dal de lentilles et riz": [25, ["Fais revenir l'oignon avec du curry et du cumin 3 min.", "Ajoute les lentilles, la tomate en dés et le lait de coco : 10 min à feu doux.", "Sers avec le riz complet."]],
  "Saumon, riz et haricots verts": [20, ["Fais cuire le riz 10 à 12 min et les haricots verts 8 min.", "Cuis le saumon 4 min par face à la poêle.", "Un filet de citron, et c'est prêt."]],
  // Collations
  "Skyr et pomme": [2, ["Coupe la pomme en quartiers et sers avec le skyr."]],
  "Amandes et banane": [1, ["Une poignée d'amandes et une banane : prêt."]],
  "Fromage blanc et myrtilles": [2, ["Verse le fromage blanc et ajoute les myrtilles."]],
  "Galettes de riz et beurre de cacahuète": [2, ["Tartine le beurre de cacahuète sur les galettes, la pomme à côté."]],
  "Shake protéiné": [2, ["Mélange la whey et le lait 20 secondes au shaker."]],
};

// La recette d'un repas simple (par son nom d'origine) : { time (min), steps } ou null
export function recipeOf(name) {
  const r = RECIPES[name];
  return r ? { time: r[0], steps: [...r[1]] } : null;
}

// Étapes écrites par l'utilisateur ou l'IA → une étape par ligne, sans numéros ni puces, 8 au plus
export function cleanSteps(text) {
  const lines = Array.isArray(text) ? text : String(text || "").split(/\n+/);
  return lines.map(s => String(s).replace(/^\s*(\d+[.)]|[-•*])\s*/, "").replace(/\s+/g, " ").trim().slice(0, 200)).filter(Boolean).slice(0, 8);
}
