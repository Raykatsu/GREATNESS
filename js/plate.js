// Ton assiette : ce que le coach pense de ce que tu manges. Chaque aliment reçoit un avis (à privilégier, ça passe,
// à limiter, à éviter au quotidien) d'après les repères de santé publique : OMS (sucres, sel, alcool), PNNS 4 de
// Santé publique France (fruits et légumes, légumineuses, céréales complètes, poisson, viande rouge, charcuterie,
// boissons sucrées), CIRC (viandes transformées), Hall 2019 (ultra-transformés), Parr 2014 (alcool et muscle).
// La journée est passée en revue : ce qui est bien, à réduire, à éviter, ce qui manque, et des échanges simples ; la
// semaine compte la charcuterie, la viande rouge, le poisson, les légumineuses et l'alcool. Logique pure (testée dans
// Node) : l'aliment est reconnu à son nom (français ou anglais), à son Nutri-Score et à ses valeurs (sucres, sel) ;
// les textes sont des gabarits (%n, %s, %f) traduits puis remplis à l'affichage (plate-ui.js).
import { norm } from "./foods.js";

// Les quatre avis
export const TIERS = { top: "À privilégier", ok: "Ça passe", limit: "À limiter", avoid: "À éviter au quotidien" };

// Les familles d'aliments : avis, nom, pourquoi, échange conseillé, réplique du coach taquin (banter.js)
export const GROUPS = {
  veg: { tier: "top", name: "Légumes", quip: "eatVeg", why: "Fibres, vitamines et minéraux pour peu de calories : vise au moins 5 portions de fruits et légumes par jour." },
  fruit: { tier: "top", name: "Fruit", quip: "eatFruit", why: "Fibres, vitamines et potassium : un fruit entier vaut mieux qu'un jus." },
  dried: { tier: "ok", name: "Fruits secs", why: "De bons nutriments, mais très sucrés et denses en calories : une petite poignée (30 g) suffit." },
  legume: { tier: "top", name: "Légumineuses", quip: "eatLegume", why: "Protéines végétales, fibres et fer pour pas cher : au moins 2 fois par semaine." },
  soy: { tier: "top", name: "Protéine végétale", quip: "eatLegume", why: "Riche en protéines, pauvre en graisses saturées : une bonne alternative à la viande." },
  veggie: { tier: "ok", name: "Plat végétal", why: "Une alternative à la viande, mais souvent transformée : regarde le sel et la liste d'ingrédients." },
  nuts: { tier: "top", name: "Oléagineux", quip: "eatNuts", why: "Bonnes graisses, fibres et magnésium : une petite poignée (30 g) par jour, nature et non salée." },
  whole: { tier: "top", name: "Céréale complète", quip: "eatWhole", why: "Plus de fibres et de minéraux que la version raffinée, et plus rassasiante : au moins un féculent complet par jour." },
  starch: { tier: "ok", name: "Féculent", why: "De l'énergie pour tes séances." },
  fatfish: { tier: "top", name: "Poisson gras", quip: "eatFish", why: "Oméga-3 et vitamine D : du poisson 2 fois par semaine, dont un poisson gras." },
  fish: { tier: "top", name: "Poisson", quip: "eatFish", why: "Protéines maigres, iode et sélénium : du poisson 2 fois par semaine." },
  poultry: { tier: "top", name: "Volaille", why: "Des protéines maigres : à privilégier par rapport aux autres viandes." },
  egg: { tier: "top", name: "Œufs", why: "Protéines complètes, vitamines B12 et D, pour pas cher." },
  dairy: { tier: "top", name: "Laitage", why: "Protéines et calcium : 2 produits laitiers par jour, nature de préférence." },
  sweetdairy: { tier: "ok", name: "Laitage sucré", why: "Calcium et protéines, mais du sucre ajouté : environ 3 morceaux par pot.", tip: "Un yaourt nature avec un fruit frais : même plaisir, sans le sucre ajouté." },
  cheese: { tier: "ok", name: "Fromage", why: "Calcium et protéines, mais salé et riche en graisses saturées : une portion de 30 g, ça suffit." },
  redmeat: { tier: "limit", name: "Viande rouge", quip: "eatRedMeat", why: "Bœuf, porc, veau, agneau : pas plus de 500 g par semaine. Au-delà, le risque de cancer colorectal augmente.", tip: "Alterne avec volaille, poisson, œufs ou légumineuses." },
  deli: { tier: "limit", name: "Charcuterie", quip: "eatDeli", why: "Salée et transformée, classée cancérogène par le CIRC : pas plus de 150 g par semaine.", tip: "Blanc de poulet, dinde, œuf ou thon à la place." },
  rich: { tier: "limit", name: "Plat riche", quip: "eatRich", why: "Fromage, crème et charcuterie : un plat de fête, pas de tous les jours.", tip: "Une portion raisonnable, avec une grande salade." },
  fastfood: { tier: "limit", name: "Restauration rapide", quip: "eatFastFood", why: "Dense en calories, en sel et en graisses : les aliments ultra-transformés font manger environ 500 kcal de plus par jour.", tip: "Version maison : pain complet, steak 5 %, crudités." },
  fried: { tier: "limit", name: "Friture", quip: "eatFried", why: "Beaucoup d'huile et de calories pour peu de nutriments.", tip: "Au four ou à l'air fryer : croustillant, avec bien moins d'huile." },
  snack: { tier: "limit", name: "Grignotage salé", quip: "eatSnack", why: "Sel et matières grasses, très peu rassasiant : on finit le paquet sans s'en rendre compte.", tip: "Une poignée d'amandes, des pois chiches grillés ou du pop-corn nature." },
  sweet: { tier: "limit", name: "Produit sucré", quip: "eatSweet", why: "Du sucre ajouté : l'OMS conseille moins de 10 % de tes calories en sucres, idéalement 5 %.", tip: "Un fruit, un yaourt nature, ou 2 carrés de chocolat noir." },
  pastry: { tier: "limit", name: "Viennoiserie", quip: "eatPastry", why: "Beurre, sucre et farine blanche : un dessert déguisé en petit-déjeuner.", tip: "Pain complet avec du beurre de cacahuète, ou un porridge." },
  darkchoc: { tier: "ok", name: "Chocolat noir", why: "Moins sucré que le chocolat au lait et riche en magnésium : 2 carrés, c'est parfait." },
  sweetdrink: { tier: "avoid", name: "Boisson sucrée", quip: "eatSoda", why: "Du sucre liquide qui ne rassasie pas : les boissons sucrées sont à éviter au quotidien.", tip: "Eau pétillante avec du citron, ou la version zéro en dépannage." },
  zerodrink: { tier: "ok", name: "Boisson zéro", why: "Sans sucre, ça dépanne ; l'eau reste la meilleure boisson." },
  energy: { tier: "avoid", name: "Boisson énergisante", quip: "eatEnergy", why: "Sucre et caféine à haute dose : pas un carburant pour l'entraînement.", tip: "Un café ou de l'eau, et une banane avant la séance." },
  juice: { tier: "limit", name: "Jus de fruits", quip: "eatJuice", why: "Les sucres du fruit sans ses fibres : un petit verre par jour au plus.", tip: "Croque le fruit entier : il cale et garde ses fibres." },
  alcohol: { tier: "avoid", name: "Alcool", quip: "eatAlcohol", why: "Freine la récupération et la construction musculaire : au plus 2 verres par jour, 10 par semaine, et pas tous les jours.", tip: "Eau pétillante, bière sans alcool ou cocktail sans alcool." },
  sportdrink: { tier: "ok", name: "Boisson de l'effort", why: "Utile pendant un effort de plus d'une heure ; le reste du temps, c'est surtout du sucre." },
  drink: { tier: "ok", name: "Boisson", why: "Sans sucre ajouté, ça passe." },
  water: { tier: "top", name: "Eau", why: "La seule boisson indispensable." },
  fat: { tier: "limit", name: "Graisses saturées", quip: "eatFat", why: "Beurre, crème, mayonnaise : à doser. Les huiles de colza, de noix et d'olive sont à privilégier.", tip: "Huile d'olive ou de colza, crème légère, fromage blanc." },
  goodfat: { tier: "top", name: "Bonne huile", why: "Graisses insaturées (et oméga-3 pour le colza et la noix) : les matières grasses à privilégier, à doser quand même." },
  oil: { tier: "ok", name: "Huile", why: "À doser : 1 cuillère à soupe, c'est 90 kcal.", tip: "Colza ou olive : de meilleures graisses." },
  salty: { tier: "limit", name: "Très salé", why: "L'OMS conseille moins de 5 g de sel par jour, tout compris : à petite dose.", tip: "Moins de sauce, plus d'épices et d'herbes." },
  sauce: { tier: "ok", name: "Sauce sucrée", why: "Plus de sucre qu'on ne croit : une cuillère, pas la moitié du flacon.", tip: "Moutarde, sauce tomate ou yaourt aux herbes." },
  supplement: { tier: "ok", name: "Complément", why: "Pratique pour atteindre tes protéines, mais ça ne remplace pas de vrais repas." },
  nutriGood: { tier: "top", name: "Nutri-Score A ou B", why: "Un bon profil nutritionnel pour sa catégorie." },
  nutriBad: { tier: "limit", name: "Nutri-Score D ou E", why: "Un produit plutôt trop sucré, trop salé ou trop riche : à garder pour le plaisir.", tip: "Compare avec un produit noté A ou B du même rayon." },
};

// Les règles, dans l'ordre (la première qui reconnaît le nom l'emporte : « jus d'orange » n'est pas un fruit, « pomme
// de terre » pas une pomme, « beurre de cacahuète » pas du beurre…). Options : sf, part des glucides qui sont des
// sucres ajoutés ; sa, sel pour 100 g ; alc, verres standard (10 g d'alcool) pour 100 ml ; share, part de l'aliment
// dans un plat (viande rouge, charcuterie, poisson, légumes, légumineuses) ; refined, féculent raffiné ; tip : échange
// propre à l'aliment. Les règles marquées sweet ne s'appliquent pas à un produit « sans sucre ».
const R = (g, re, o = {}) => ({ g, re, ...o });
const RULES = [
  R(null, /\bnoix de coco\b|^coconut$/),
  R("alcohol", /\beau de vie\b/, { alc: 3.2 }),
  R("drink", /\b(eau de coco|coconut water)\b/),
  R("poultry", /\bcoq au vin\b/),
  R("supplement", /\b(whey|caseine|gainer|creatine|bcaa|proteine en poudre|boisson proteinee|barre proteinee|protein bar|protein shake|shake proteine)\b/),
  R("water", /^(eau|water)\b|\beau (minerale|gazeuse|petillante|plate|de source)\b|\bsparkling water\b/),
  R("zerodrink", /\b(soda|coca|cola|pepsi|limonade|boisson|ice ?tea|the glace|sirop)\b.*\b(zero|light|diet|sans sucres?|max)\b|\b(zero|light|diet)\b.*\b(soda|coca|cola|pepsi)\b/),
  R("energy", /\b(boissons? energisantes?|energy drinks?|red ?bull|monster energy|burn energy)\b/, { sf: 1, sweet: true }),
  R("alcohol", /\b(bieres?|beers?|ipa|lager|panache)\b/, { alc: 0.4 }),
  R("alcohol", /\b(vins?|wines?|champagne|prosecco|cremant|mousseux|sangria|porto|martini)\b/, { alc: 1 }),
  R("alcohol", /\b(cidre|cider)\b/, { alc: 0.36 }),
  R("alcohol", /\b(alcool fort|rhum|rum|vodka|whisky|whiskey|gin|tequila|pastis|cognac|liqueur|calvados|armagnac)\b/, { alc: 3.2 }),
  R("alcohol", /\b(cocktails?|mojitos?|spritz|margarita|pina colada|daiquiri|caipirinha)\b/, { alc: 0.8, sf: 1 }),
  R("sweet", /\b(sirop d'erable|sirop d'agave|maple syrup|sirop de (riz|mais|glucose))\b/, { sf: 1, sweet: true, tip: "À petite dose : une cuillère à café, pas trois." }),
  R("sweet", /\b(fruits? au sirop|au sirop)\b/, { sf: 0.45, sweet: true, tip: "Des fruits frais, ou au naturel." }),
  R("sweetdrink", /\b(sodas?|coca|cola|pepsi|fanta|sprite|orangina|schweppes|dr pepper|limonade|lemonade|ice ?tea|the glace|sirops?|soft drinks?|boissons? sucrees?|boissons? aux fruits)\b/, { sf: 1, sweet: true }),
  R("juice", /\b(jus|juices?|smoothies?|nectars?)\b/, { sf: 1, sweet: true }),
  R("sweet", /\b(lait chocolate|chocolat chaud|hot chocolate|milk ?shakes?|milkshakes?|frappuccino)\b/, { sf: 0.55, sweet: true, tip: "Du lait avec du cacao non sucré, ou un shake protéiné." }),
  R("sportdrink", /\b(isotoniques?|boissons? (sportives?|de l'effort)|gatorade|powerade|sports drinks?)\b/, { sf: 1, sweet: true }),
  R("drink", /^(the|tea)$|^(the|tea) (vert|noir|blanc|matcha|green|black|earl grey|a la menthe|menthe)\b|\b(green tea|tisanes?|infusions?|cafes?|coffee|expresso|espresso|cappuccino|latte|kombucha|boissons? vegetales?|lait (d'|de )(amande|avoine|soja|riz|noisette))\b/),
  // plats et fast-food, avant leurs ingrédients
  R("fried", /\b(fish (and|&|n) chips|calamars (a la romaine|frits)|poissons? panes?|nuggets?|cordon bleu|tenders|poulet (pane|frit)|fried chicken|beignets? de|tempura|onion rings|frites?|fries|chips de legumes|samoussas?|samosas?|bricks?|nems|accras|banane plantain frite|aloco|croquettes?)\b/, { sa: 0.8 }),
  R("fat", /\bsauces? (burger|samourai|algerienne|andalouse|biggy|blanche|kebab|cocktail|bearnaise|hollandaise|tartare|fromagere)\b/, { sa: 1 }),
  R("salty", /\b(ramen|nouilles instantanees|instant noodles)\b/, { sa: 1.4, tip: "Laisse une partie du bouillon : c'est là qu'est le sel." }),
  R("fastfood", /\b(hot ?dogs?)\b/, { share: { deli: 0.35 }, sa: 1.8 }),
  R("fastfood", /\b(croque ?(monsieur|madame))\b/, { share: { deli: 0.15 }, sa: 1.5 }),
  R("fastfood", /\b(burgers?|hamburgers?|cheeseburgers?|big ?macs?|whoppers?|kebabs?)\b(?! (de |au |vegetal|vegan|veggie|poulet|chicken|poisson|fish))/, { share: { red: 0.3 }, sa: 1.3 }),
  R("fastfood", /\b(pizzas?|burgers?|hamburgers?|cheeseburgers?|kebabs?|tacos|paninis?|nachos|quesadillas?|cheese naan|fast ?food|mc ?do|kfc|subway)\b/, { sa: 1.3 }),
  R("deli", /\b(sandwich jambon|jambon beurre)\b/, { share: { deli: 0.25 }, sa: 1.4 }),
  R("cheese", /\braclette \(fromage\)|\bfromage (a|de|pour) raclette\b/, { sa: 1.8 }),
  R("rich", /\b(choucroute)\b/, { share: { deli: 0.35 }, sa: 1.5 }),
  R("rich", /\b(cassoulet)\b/, { share: { deli: 0.25, legume: 0.4 }, sa: 1.2 }),
  R("rich", /\b(raclette)\b/, { share: { deli: 0.25 }, sa: 1.5 }),
  R("rich", /\b(tartiflette|croziflette|tarte flambee|flammekueche|quiches?|carbonara)\b/, { share: { deli: 0.1 }, sa: 1.2 }),
  R("rich", /\b(fondue|aligot|gratin dauphinois|gratin de pates|foie gras|mac and cheese|macaroni (and|&) cheese)\b/, { sa: 1 }),
  // desserts, sucreries et viennoiseries, avant les laitages, les fruits et les féculents
  R("pastry", /\b(croissants?|pains? au chocolat|chocolatines?|pains? aux raisins|brioches?|pains? au lait|chaussons? aux pommes|viennoiseries?|kouign ?amann|palmiers?|danish|galette des rois|frangipane)\b/, { sf: 0.25, sweet: true }),
  R("sweet", /\b(pate a tartiner|nutella|spread)\b/, { sf: 0.95, sweet: true, tip: "Beurre de cacahuète 100 % ou purée d'amandes, sans sucre ajouté." }),
  R("sweet", /\b(confitures?|jams?|marmelades?|gelee de|miel|honey|sucre|sugar|cassonade|caramel|creme de marrons)\b/, { sf: 1, sweet: true, tip: "À petite dose : une cuillère à café, pas trois." }),
  R("sweet", /\b(glaces?|ice ?creams?|sorbets?|esquimau|cornets?|magnum|frozen yogurt)\b/, { sf: 0.85, sweet: true, tip: "Un skyr avec des fruits rouges surgelés : façon glace, riche en protéines." }),
  R("sweet", /\b(cereales (du petit dejeuner|sucrees|chocolatees|fourrees)|corn ?flakes|chocapic|tresor|frosties|coco pops|granola)\b/, { sf: 0.3, sweet: true, tip: "Flocons d'avoine ou muesli sans sucre ajouté." }),
  R("sweet", /\b(barres? de cereales|cereal bars?)\b/, { sf: 0.45, sweet: true, tip: "Une banane et une poignée d'amandes." }),
  R("sweet", /\b(creme dessert|creme brulee|creme caramel|flans?|liegeois|mousse au chocolat|panna cotta|riz au lait|semoule au lait|tiramisu|ile flottante|profiteroles)\b/, { sf: 0.7, sweet: true, tip: "Un yaourt nature ou un fromage blanc, avec un fruit." }),
  R("sweet", /\b(crepes?|pancakes?|gaufres?|waffles?|pain perdu|french toast)\b/, { sf: 0.3, sweet: true, tip: "Avec des fruits et du fromage blanc plutôt qu'avec de la pâte à tartiner." }),
  R("sweet", /\b(gateaux?|cakes?|brownies?|cookies?|biscuits?|sables?|petits? beurres?|speculoos|madeleines?|financiers?|macarons?|muffins?|cupcakes?|donuts?|doughnuts?|beignets?|churros|tartes? (aux|au|a la|a l')|tartelettes?|tarte tatin|eclairs?|mille ?feuilles?|crumble|clafoutis|far breton|fondant|moelleux|pain d'epices|chouquettes?|religieuses?|paris brest|baba|cheesecake|patisseries?|desserts?)\b/, { sf: 0.5, sweet: true, tip: "Un fruit et une poignée d'amandes, ou un yaourt nature." }),
  R("darkchoc", /\b(chocolat noir|dark chocolate|chocolat (a |)(7|8|9)\d ?%|chocolat (a |)(7|8|9)\d\b)/, { sf: 0.7, sweet: true }),
  R("sweet", /\b(bonbons?|candy|candies|haribo|guimauves?|marshmallows?|reglisse|dragees|sucettes?|barres? chocolatees?|chocolate bars?|snickers|twix|kinder|bounty|kit ?kat|m&m'?s|chocolat|chocolate|pralines?|nougat|pates? de fruits)\b/, { sf: 0.85, sweet: true, tip: "Chocolat noir 70 % : moins de sucre, plus de magnésium. Ou un fruit." }),
  // végétal
  R("legume", /\b(falafels?)\b/, { tip: "Au four, c'est encore mieux." }),
  R("legume", /\b(chorba|harira)\b/, { share: { legume: 0.3, veg: 0.3 } }),
  R("redmeat", /\b(chili con carne)\b/, { share: { red: 0.2, legume: 0.25, veg: 0.15 } }),
  R("legume", /\b(lentilles?|lentils?|pois chiches?|chickpeas?|haricots (rouges|blancs|noirs|secs|coco|azuki|mungo)|kidney beans|black beans|baked beans|flageolets?|feves|pois casses|dal|dahl|daal|houmous|hummus|edamame|lupins?|chili sin carne)\b/),
  R("soy", /\b(tofu|tempeh|seitan)\b/),
  R("dairy", /\b(yaourts? (de|au) soja|soy yogh?urt|skyr)\b/),
  R("salty", /\b(sauce soja|soy sauce|nuoc mam|sauce poisson|fish sauce|bouillon cube|cubes? de bouillon|fond de veau)\b/, { sa: 14 }),
  R("veggie", /\b(steaks? vegetaux|steak vegetal|galettes? vegetales?|hache vegetal|saucisses? vegetales?|nuggets? vegetaux|vegan|veggie|vegetariens?|vegetariennes?|plant based)\b/),
  // viandes, poissons, œufs
  R("deli", /\b(jambons?|ham|lardons?|bacon|saucisses?|sausages?|saucissons?|merguez|chipolatas?|chorizo|pate (de campagne|en croute|de foie)|pate \/ terrine|terrines?|rillettes|salami|mortadelle|coppa|pancetta|viande des grisons|bresaola|knackis?|cervelas|boudin|andouillettes?|andouilles?|blanc de (poulet|dinde) en tranches|pastrami|pepperoni|corned beef)\b/, { sa: 2.2 }),
  R("fatfish", /\b(saumons?|salmon|sardines?|maquereaux?|mackerel|harengs?|herring|truites?|trout|anchois|anchov(y|ies)|sprats?|sashimi|thon rouge)\b/),
  R("fish", /\b(sushis?|makis?|california rolls?)\b/, { share: { fish: 0.3 } }),
  R("fish", /\b(poke)\b/, { share: { fish: 0.25, veg: 0.25 } }),
  R("fish", /\b(surimi)\b/, { share: { fish: 0.35 }, sa: 1.8 }),
  R("fish", /\b(thieboudienne|bouillabaisse|paella)\b/, { share: { fish: 0.3 } }),
  R("fish", /\b(poissons?|fish|fruits de mer|seafood|thon|tuna|cabillaud|cod|colin|merlu|lieu|dorade|daurade|loup de mer|sole|limande|merlan|eglefin|haddock|tilapia|panga|lotte|raie|crevettes?|shrimps?|prawns?|gambas|moules?|mussels?|huitres?|oysters?|saint jacques|coquilles|crabe|crab|homard|lobster|langoustines?|calamars?|squid|seiches?|poulpe|octopus)\b/),
  R("poultry", /\b(poulet|chicken|dinde|turkey|volailles?|canard|duck|magret|pintade|caille|lapin|rabbit|aiguillettes|yassa)\b/),
  R("redmeat", /\b(bourguignon|boeuf aux oignons|daube)\b/, { share: { red: 0.5 } }),
  R("redmeat", /\b(pot au feu|blanquette|navarin|osso ?buco)\b/, { share: { red: 0.4, veg: 0.2 } }),
  R("redmeat", /\b(hachis parmentier|moussaka|lasagnes?)\b/, { share: { red: 0.18 } }),
  R("redmeat", /\b(bolognaise|bolognese)\b/, { share: { red: 0.15 } }),
  R("redmeat", /\b(mafe)\b/, { share: { red: 0.4 } }),
  R("redmeat", /\b(keftas?|boulettes?|meatballs?)\b(?! de (poisson|thon|soja|lentilles|legumes))/, { share: { red: 0.8 } }),
  R("redmeat", /\b(boeuf|beef|steaks?|steack|entrecotes?|faux filet|rumsteck|bavette|onglet|cote de boeuf|hampe|veau|veal|agneau|lamb|mouton|gigot|porc|pork|cochon|cotes? de porc|filet mignon|roti de (boeuf|porc|veau)|foie de (veau|boeuf|genisse)|rognons?|abats|viande hachee|hache|tartare de boeuf|carpaccio|cheval)\b/),
  R("egg", /\b(oeufs?|eggs?|omelettes?|blancs? d'oeufs?|chakchouka|shakshuka)\b/),
  // laitages et fromages
  R("sweetdairy", /\b(yaourts? (aux|a la|au) (fruits?|fraises?|framboises?|peches?|vanille|abricots?|cerises?|myrtilles?|citron|coco)|yaourts? a boire|yaourts? sucres?|petits? suisses? aux fruits|fromage blanc aux fruits|danette|yop|actimel)\b/, { sf: 0.6, sweet: true }),
  R("dairy", /\b(fromage blanc|faisselle|cottage|ricotta|quark|petits? suisses?)\b/),
  R("cheese", /\b(roquefort|bleu|gorgonzola|feta|halloumi|parmesan|parmigiano|grana padano|pecorino)\b/, { sa: 2.8 }),
  R("cheese", /\b(mozzarella|burrata|mascarpone|fromage frais|chevre frais|boursin|st moret|saint moret)\b/, { sa: 0.6 }),
  R("cheese", /\b(fromages?|cheese|emmental|comte|camembert|brie|mozzarella|burrata|chevre|raclette|reblochon|gouda|tomme|cheddar|mimolette|cantal|beaufort|saint nectaire|munster|maroilles|coulommiers|boursin|kiri|vache qui rit|mascarpone)\b/, { sa: 1.5 }),
  R("fat", /\b(lait de coco|creme de coco|coconut milk|coconut cream)\b/),
  R("dairy", /\b(lait|milk|yaourts?|yogh?ourts?|yogurts?|kefir|lassi)\b/),
  // matières grasses, oléagineux, sauces, grignotage
  R("nuts", /\b(beurre de cacahuetes?|peanut butter|puree d'(amandes|noisettes|cajou)|tahini|tahin|creme de sesame)\b/),
  R("goodfat", /\b(huiles? (d'olive|de colza|de noix|de lin|de cameline)|olive oil|rapeseed oil|canola)\b/),
  R("oil", /\b(huiles?|oil)\b/),
  R("snack", /\b(chips|crisps|crackers? aperitif|biscuits? aperitif|aperitif|tuc|curly|bretzels?|pretzels?|cacahuetes? salees|doritos|pringles|pop ?corn (sale|sucre|caramel))\b/, { sa: 1.8 }),
  R("fat", /\b(beurre|butter|margarine|creme fraiche|creme epaisse|creme liquide|creme entiere|chantilly|whipped cream|mayonnaise|mayo|aioli|saindoux|ghee|sauce (burger|samourai|algerienne|andalouse|biggy|blanche|kebab|bearnaise|hollandaise|tartare|cocktail|fromagere))\b/, { sa: 0.5 }),
  R("nuts", /\b(amandes?|almonds?|noix|walnuts?|noisettes?|hazelnuts?|cajou|cashews?|pistaches?|pistachios?|cacahuetes?|arachides?|peanuts?|pecans?|macadamia|graines? (de chia|de lin|de courge|de tournesol|de sesame)|chia|oleagineux|trail mix|melange de noix)\b/),
  R("sauce", /\b(ketchup|sauce barbecue|barbecue|bbq|sauce aigre douce|sauce teriyaki|sauce sucree|sauce sweet chili|sweet chili)\b/, { sf: 0.85, sweet: true }),
  R("salty", /\b(cornichons?|olives?|capres|pickles?)\b/, { sa: 3 }),
  // céréales complètes, puis féculents
  R("whole", /\b(complets?|completes?|integral|integrale|integrales|integraux|wholemeal|whole ?wheat|whole ?grain|avoine|oats?|oatmeal|porridge|quinoa|boulgour|bulgur|sarrasin|buckwheat|epeautre|seigle|rye|orge|barley|millet|son d'avoine|muesli|brown rice|pain (aux cereales|nordique|suedois|aux graines))\b/),
  R("starch", /\b(riz|rice|pates|pasta|spaghettis?|tagliatelles?|macaronis?|penne|fusilli|lasagne|nouilles|noodles|ramen|pho|semoule|couscous|ble|polenta|gnocchis?|raviolis?|tortellinis?|pains?|bread|baguettes?|bagels?|pitas?|naans?|wraps?|tortillas?|biscottes?|pains? de mie|toasts?|msemen|taboule|biryani|jollof|cantonais)\b/, { refined: true, tip: "Prends-le complet quand tu peux : plus de fibres, plus rassasiant." }),
  R("starch", /\b(galettes? de riz|pommes? de terre|potato(es)?|puree|patates? douces?|sweet potato(es)?|manioc|cassava|igname|attieke|foutou|fufu|plantain|mais|corn|polenta|pop ?corn)\b/),
  // légumes, puis fruits
  R("dried", /\b(raisins secs|dattes?|dates|pruneaux?|abricots secs|figues sechees|fruits secs|cranberries sechees|dried fruits?)\b/),
  R("fruit", /\b(salade de fruits|fruit salad|compotes?|applesauce)\b/, { sf: 0.25, sweet: true }),
  R("veg", /\b(sauce tomate|coulis de tomates?|tomato sauce|passata)\b/, { share: { veg: 0.6 } }),
  R("veg", /\b(salade composee|curry de legumes|gratin de legumes|soupes?(?! miso)|veloutes?|gaspacho|gazpacho|minestrone|wok de legumes|poelee de legumes|ratatouille|crudites|celeri remoulade)\b/, { share: { veg: 0.7 } }),
  R("veg", /\b(legumes?|vegetables?|veggies|brocolis?|broccoli|haricots verts|green beans|courgettes?|zucchinis?|carottes?|carrots?|tomates?|tomatoes?|salades?|laitue|lettuce|roquette|rocket|mache|epinards?|spinach|concombres?|cucumbers?|poivrons?|peppers?|champignons?|mushrooms?|oignons?|onions?|ail|garlic|echalotes?|petits pois|peas|choux?( fleur| rouge| blanc| de bruxelles)?|cabbage|kale|cauliflower|brussels sprouts|aubergines?|eggplants?|courges?|potirons?|butternut|citrouille|pumpkin|betteraves?|beetroot|asperges?|asparagus|artichauts?|artichokes?|poireaux?|leeks?|fenouil|fennel|navets?|radis|radishes|endives?|celeri|celery|pois gourmands|haricots? mange tout|avocats?|avocados?)\b/),
  R("fruit", /\b(fruits?|bananes?|bananas?|pommes?|apples?|oranges?|kiwis?|fraises?|strawberr(y|ies)|raisins?|grapes?|myrtilles?|blueberr(y|ies)|framboises?|raspberr(y|ies)|mures|cassis|groseilles?|poires?|pears?|mangues?|mangos?|mangoes|ananas|pineapples?|clementines?|mandarines?|peches?|peaches|nectarines?|abricots?|apricots?|melons?|pasteques?|watermelons?|cerises?|cherr(y|ies)|prunes|plums?|figues?|figs?|grenades?|pomegranates?|pamplemousses?|grapefruits?|citrons?|lemons?|limes?|litchis?|lychees?|papayes?|papayas?|fruits? de la passion|passion fruits?|goyaves?|kakis?|compotes?)\b/),
];

// Nutri-Score et valeurs d'un produit (Open Food Facts) quand le nom ne dit rien
const NO_SUGAR = /\b(sans sucres?( ajoutes?)?|sugar ?free|no added sugar|zero sucres?|0 ?% de sucres?)\b/;
function byValues(f) {
  const per = f.per || {};
  if (f.nutri === "d" || f.nutri === "e") return { g: "nutriBad" };
  if (f.nutri === "a" || f.nutri === "b") return { g: "nutriGood" };
  if (per.su >= 22.5) return { g: "sweet", sf: 1 };
  if (per.sa >= 1.5) return { g: "salty" };
  return null;
}

// La règle qui reconnaît un aliment (null : rien à en dire)
export function classify(f) {
  const n = norm(f?.name || ""), noSugar = NO_SUGAR.test(n);
  for (const r of RULES) {
    if (noSugar && r.sweet) continue;
    if (!r.re.test(n)) continue;
    if (!r.g) return null;
    // produit emballé au nom de fruit, vraiment sucré : un laitage aux fruits (« Activia fraise ») ou une sucrerie (« Fraise Tagada »)
    if (r.g === "fruit" && (f.code || f.brand || f.src === "off") && !noSugar && !/\bcompotes?\b/.test(n) && +f.per?.su >= 10)
      return +f.per.p >= 2.5 && +f.per.su < 18 ? { g: "sweetdairy", sf: 0.6, sweet: true } : { g: "sweet", sf: 1, sweet: true };
    return r;
  }
  return f?.per ? byValues(f) : null;
}

const r1 = x => Math.round(x * 10) / 10;
// L'avis sur un aliment, pour g grammes (ou ml) : famille, avis, explication, échange, et les quantités qui comptent
// (sucres ajoutés, sel, verres d'alcool, portions de fruits et légumes, viande rouge, charcuterie, poisson…)
export function judgeFood(f, g = 100) {
  const r = classify(f);
  if (!r) return null;
  const G = GROUPS[r.g], per = f.per || {}, m = Math.max(0, +g || 0) / 100;
  let tier = G.tier;
  // un Nutri-Score D ou E sur un produit « à privilégier » (muesli très sucré, plat cuisiné salé) : il passe, sans plus
  const nutriBad = f.nutri === "d" || f.nutri === "e";
  if (nutriBad && tier === "top") tier = "ok";
  if (r.g === "redmeat" && r.share?.red < 0.3) tier = "ok"; // plat avec un peu de viande (bolognaise, lasagnes) : elle compte dans la semaine
  const sweetish = r.sf != null;
  const sugar = sweetish ? (per.su != null ? per.su : (per.c || 0) * r.sf) * m : 0;
  const sa100 = per.sa != null ? +per.sa : r.sa || 0, salt = sa100 * m;
  const part = (k, own) => (r.share?.[k] != null ? r.share[k] : own.includes(r.g) ? 1 : 0) * (+g || 0);
  const v = {
    group: r.g, tier, name: G.name, why: G.why, tip: r.tip || G.tip || "", quip: G.quip || null, nutriBad,
    sugar: r1(sugar), salt: r1(salt), salty: sa100 >= 1.2, alc: r1((r.alc || 0) * m),
    fv: Math.round(part("veg", ["veg"]) + part("fruit", ["fruit"])), // grammes de fruits et légumes
    red: Math.round(part("red", ["redmeat"])), deli: Math.round(part("deli", ["deli"])),
    fish: Math.round(part("fish", ["fish", "fatfish"])), fatfish: r.g === "fatfish",
    legume: Math.round(part("legume", ["legume", "soy"])),
    whole: r.g === "whole", nuts: r.g === "nuts", refined: !!r.refined,
    fried: r.g === "fried", ml: ["sweetdrink", "juice", "energy", "alcohol", "zerodrink", "drink", "sportdrink", "water"].includes(r.g) ? Math.round(+g || 0) : 0,
  };
  return v;
}

/* ---------- La journée ---------- */
export const PORTION = 80; // une portion de fruits ou de légumes (g)
export const REF = { fv: 5, fiber: 30, salt: 5, deliWeek: 150, redWeek: 500, fishWeek: 2, legumeWeek: 2, alcDay: 2, alcWeek: 10, juice: 200, fat: 30 };
const uniq = a => [...new Set(a.filter(Boolean))];
const list = a => uniq(a).slice(0, 3).join(", ");
const cubes = g => Math.max(1, Math.round(g / 5)); // un morceau de sucre ≈ 5 g

// Totaux d'une journée (pour la journée elle-même ou la semaine)
function tally(items = []) {
  const J = items.map(it => ({ it, v: judgeFood(it, it.g) })).filter(x => x.v);
  const sum = k => J.reduce((a, x) => a + (x.v[k] || 0), 0);
  const of = pred => J.filter(pred);
  return { J, sum, of };
}

// Statistiques de la semaine : 7 journées (tableaux d'aliments), la dernière étant le jour regardé
export function weekStats(days = []) {
  const s = { logged: 0, deli: 0, red: 0, fishDays: 0, fatFishDays: 0, legumeDays: 0, alc: 0, alcDays: 0 };
  for (const items of days) {
    if (!items?.length) continue;
    s.logged++;
    const { sum, of } = tally(items);
    s.deli += sum("deli"); s.red += sum("red"); s.alc += sum("alc");
    if (sum("fish") >= 50) s.fishDays++;
    if (of(x => x.v.fatfish).length) s.fatFishDays++;
    if (sum("legume") >= 50) s.legumeDays++;
    if (sum("alc") > 0) s.alcDays++;
  }
  s.deli = Math.round(s.deli); s.red = Math.round(s.red); s.alc = r1(s.alc);
  return s;
}

// La revue de la journée. kcal : objectif du jour (pour la limite de sucres de l'OMS) ; protein : objectif de
// protéines ; hour : l'heure (24 pour un jour passé : la journée est complète) ; water, waterGoal : verres ; week :
// weekStats(…) des 7 derniers jours. Chaque point : { id, t (gabarit : %n, %s, %f), v (valeurs) }.
export function dayReview(items = [], { kcal = 2000, protein = 0, hour = 24, water = 0, waterGoal = 0, week = null } = {}) {
  const { J, sum, of } = tally(items);
  const names = pred => list(of(pred).map(x => x.it.name));
  const tot = items.reduce((a, it) => { const m = (+it.g || 0) / 100, p = it.per || {}; a.p += (p.p || 0) * m; a.fi += (p.fi || 0) * m; return a; }, { p: 0, fi: 0 });
  const late = hour >= 18, n = items.length;
  const fv = Math.floor((sum("fv") + 10) / PORTION), sugar = Math.round(sum("sugar")), sugarMax = Math.round((kcal * 0.1) / 4);
  const salt = r1(of(x => x.v.salty).reduce((a, x) => a + x.v.salt, 0)), alc = r1(sum("alc")), deli = Math.round(sum("deli")), red = Math.round(sum("red"));
  const juice = of(x => x.v.group === "juice").reduce((a, x) => a + x.v.ml, 0);
  const fat = Math.round(of(x => x.v.group === "fat").reduce((a, x) => a + (+x.it.g || 0), 0));
  const sweetDrinks = of(x => x.v.group === "sweetdrink" || x.v.group === "energy");
  const wk = week && week.logged >= 3 ? week : null;
  const good = [], reduce = [], avoid = [], missing = [];
  const put = (arr, id, t, v = {}) => arr.push({ id, t, v }); // (pas « add » : le traducteur y verrait du code)

  // ce qui est bien
  if (fv >= REF.fv) put(good, "fv", "Fruits et légumes : %n portions, objectif atteint.", { n: fv });
  if (protein && tot.p >= protein * 0.9) put(good, "protein", "Protéines : %n g sur %s g, au rendez-vous.", { n: Math.round(tot.p), s: protein });
  if (tot.fi >= 25) put(good, "fiber", "Fibres : %n g, bien joué (repère : 30 g par jour).", { n: Math.round(tot.fi) });
  if (sum("legume") >= 40) put(good, "legume", "Des légumineuses : %f.", { f: names(x => x.v.legume > 0) });
  if (of(x => x.v.fatfish).length) put(good, "fatfish", "Du poisson gras (%f) : tes oméga-3.", { f: names(x => x.v.fatfish) });
  else if (sum("fish") >= 50) put(good, "fish", "Du poisson : %f.", { f: names(x => x.v.fish > 0) });
  if (of(x => x.v.whole).length) put(good, "whole", "Une céréale complète : %f.", { f: names(x => x.v.whole) });
  if (of(x => x.v.nuts).length) put(good, "nuts", "Des oléagineux : %f, de bonnes graisses.", { f: names(x => x.v.nuts) });
  if (waterGoal && water >= waterGoal) put(good, "water", "Eau : objectif atteint.");

  // à éviter au quotidien
  if (sweetDrinks.length) {
    const sg = Math.round(sweetDrinks.reduce((a, x) => a + x.v.sugar, 0));
    put(avoid, "soda", "Boissons sucrées : %f, soit ≈ %n g de sucre (%s morceaux).", { f: list(sweetDrinks.map(x => x.it.name)), n: sg, s: cubes(sg) });
  }
  if (alc > 0) put(avoid, "alcohol", alc > REF.alcDay ? "Alcool : ≈ %n verres aujourd'hui (%f), au-delà des 2 conseillés au plus." : "Alcool : ≈ %n verre(s) aujourd'hui (%f) ; au plus 2 par jour, et pas tous les jours.", { n: alc, f: names(x => x.v.alc > 0) });
  if (wk && wk.alc > REF.alcWeek) put(avoid, "alcWeek", "Alcool : ≈ %n verres cette semaine, pour 10 au plus.", { n: wk.alc });

  // à réduire
  if (sugar > sugarMax) put(reduce, "sugar", "Sucres ajoutés : ≈ %n g, au-delà des %s g conseillés pour toi (OMS). Surtout : %f.", { n: sugar, s: sugarMax, f: list(J.filter(x => x.v.sugar >= 5).sort((a, b) => b.v.sugar - a.v.sugar).map(x => x.it.name)) });
  if (deli > 0) {
    if (wk) put(reduce, "deli", "Charcuterie : %n g cette semaine (%f), pour 150 g au plus.", { n: wk.deli, f: names(x => x.v.deli > 0) });
    else put(reduce, "deli", "Charcuterie : %n g aujourd'hui (%f) ; repère : 150 g par semaine au plus.", { n: deli, f: names(x => x.v.deli > 0) });
  }
  if (wk && wk.red > REF.redWeek && red > 0) put(reduce, "red", "Viande rouge : %n g cette semaine, pour 500 g au plus.", { n: wk.red });
  else if (red > 250) put(reduce, "red", "Viande rouge : %n g aujourd'hui (%f) ; repère : 500 g par semaine au plus.", { n: red, f: names(x => x.v.red > 0) });
  const processed = of(x => ["fastfood", "fried", "snack", "pastry", "rich", "nutriBad"].includes(x.v.group));
  if (processed.length) put(reduce, "processed", "Ultra-transformé, frit ou très riche : %f.", { f: list(processed.map(x => x.it.name)) });
  if (juice > REF.juice) put(reduce, "juice", "Jus de fruits : %n ml ; un petit verre par jour suffit.", { n: juice });
  if (salt >= 3) put(reduce, "salt", "Aliments très salés : %f, déjà ≈ %n g de sel (OMS : moins de 5 g par jour, tout compris).", { n: salt, f: list(of(x => x.v.salty).sort((a, b) => b.v.salt - a.v.salt).map(x => x.it.name)) });
  if (fat >= REF.fat) put(reduce, "fat", "Beurre, crème, mayonnaise : %n g ; préfère l'huile d'olive ou de colza.", { n: fat });

  // ce qui manque (la journée en cours : seulement le soir, sauf les fruits et légumes, comptés au fil de la journée)
  if (n && fv < REF.fv) {
    const t = late ? (fv > 1 ? "Fruits et légumes : %n portions sur 5. Une crudité, une poêlée ou un fruit, et c'est bon." : "Fruits et légumes : %n portion sur 5. Une crudité, une poêlée ou un fruit, et c'est bon.")
      : fv > 1 ? "Fruits et légumes : %n portions sur 5 pour l'instant." : "Fruits et légumes : %n portion sur 5 pour l'instant.";
    put(missing, "fv", t, { n: fv });
  }
  if (late && n >= 3 && tot.fi < 20) put(missing, "fiber", "Fibres : %n g sur 30 g. Légumes, légumineuses et céréales complètes en apportent.", { n: Math.round(tot.fi) });
  if (late && protein && tot.p < protein * 0.7) put(missing, "protein", "Protéines : %n g sur %s g. Un skyr, des œufs ou du thon pour compléter.", { n: Math.round(tot.p), s: protein });
  if (late && of(x => x.v.refined).length && !of(x => x.v.whole).length) put(missing, "whole", "Pas de céréale complète aujourd'hui : pain complet, riz complet ou flocons d'avoine.");
  if (wk && wk.logged >= 5 && wk.fishDays < REF.fishWeek) put(missing, "fishWeek", "Poisson : %n fois cette semaine ; vise 2 fois, dont un poisson gras.", { n: wk.fishDays });
  if (wk && wk.logged >= 5 && wk.legumeDays < REF.legumeWeek) put(missing, "legumeWeek", "Légumineuses : %n fois cette semaine ; vise au moins 2 fois.", { n: wk.legumeDays });
  if (late && waterGoal && water < waterGoal) put(missing, "water", "Eau : %n verres sur %s.", { n: water, s: waterGoal });

  // échanges conseillés : un par famille à limiter ou à éviter
  const seen = new Set(), swaps = [];
  for (const x of J) {
    if (!["limit", "avoid"].includes(x.v.tier) || !x.v.tip || seen.has(x.v.tip)) continue;
    seen.add(x.v.tip);
    swaps.push({ f: x.it.name, tip: x.v.tip });
  }

  // la note : les bonnes familles, moins ce qui est à limiter ou à éviter
  const limits = J.filter(x => x.v.tier === "limit").length, avoids = sweetDrinks.length + Math.ceil(alc);
  const bonus = good.filter(x => ["legume", "fatfish", "fish", "whole", "nuts"].includes(x.id)).length;
  let score = 50 + Math.min(fv, 5) * 5 + (tot.fi >= 25 ? 8 : tot.fi >= 15 ? 4 : 0) + (protein && tot.p >= protein * 0.9 ? 5 : 0) + Math.min(3, bonus) * 4
    - Math.min(30, limits * 5) - Math.min(30, avoids * 8) - (sugar > sugarMax ? 8 : 0) - (salt >= 5 ? 5 : 0);
  if (!late) score = Math.max(score, 50 + Math.min(fv, 5) * 5 - Math.min(30, limits * 5) - Math.min(30, avoids * 8)); // journée en cours : pas encore notée sur ce qui manque
  score = Math.max(0, Math.min(100, Math.round(score)));
  const grade = !n ? null : score >= 80 ? "great" : score >= 62 ? "good" : score >= 45 ? "meh" : "bad";
  return {
    n, score, grade, good, reduce, avoid, missing, swaps: swaps.slice(0, 4),
    stats: { fv, sugar, sugarMax, salt, alc, deli, red, juice, fat, processed: processed.length, fiber: Math.round(tot.fi), protein: Math.round(tot.p) },
    week: wk, junk: J.filter(x => ["limit", "avoid"].includes(x.v.tier)).map(x => x.it.name),
  };
}

// Le titre de la revue, selon la note
export const GRADES = { great: "Assiette au top", good: "Bonne journée dans l'assiette", meh: "Peut mieux faire", bad: "Journée à rattraper" };

// Mode normal : le conseil du coach pour la journée, poli et concret (ce qui compte le plus maintenant), ou null
export function dayAdvice(rv, hour = 24) {
  if (!rv?.n) return null;
  const late = hour >= 18, s = rv.stats, find = id => [...rv.avoid, ...rv.reduce, ...rv.missing].find(x => x.id === id);
  if (s.alc >= 3) return { t: "Déjà ≈ %n verres d'alcool aujourd'hui : alterne avec de l'eau, ta récupération en dépend.", v: { n: s.alc } };
  const soda = find("soda");
  if (soda) return { t: "Une boisson sucrée aujourd'hui (%f) : la prochaine fois, essaie l'eau pétillante avec du citron.", v: { f: soda.v.f } };
  if (rv.week && rv.week.deli > REF.deliWeek && s.deli > 0) return { t: "Charcuterie : %n g cette semaine, au-delà des 150 g conseillés. Ces prochains jours, préfère volaille, œufs ou poisson.", v: { n: rv.week.deli } };
  if (s.sugar > s.sugarMax) return { t: "Déjà ≈ %n g de sucres ajoutés : pour la suite, un fruit ou un yaourt nature plutôt qu'un produit sucré.", v: { n: s.sugar } };
  if (s.processed >= 2) return { t: "Plusieurs produits ultra-transformés aujourd'hui : au prochain repas, une assiette simple (légumes, féculent complet, protéine) rééquilibre tout." };
  if (late && s.fv < REF.fv) {
    const n = REF.fv - s.fv;
    return { t: n > 1 ? "Il te manque %n portions de fruits et légumes pour arriver à 5 : une crudité, une poêlée ou un fruit ce soir." : "Il te manque %n portion de fruits et légumes pour arriver à 5 : une crudité ou un fruit ce soir.", v: { n } };
  }
  const prot = late ? find("protein") : null;
  if (prot) return { t: prot.t, v: prot.v };
  if (!late && hour >= 12 && s.fv === 0 && rv.n >= 2) return { t: "Pas encore de fruits ni de légumes aujourd'hui : pense à en mettre au prochain repas." };
  if (late && rv.grade === "great") return { t: "Très belle journée dans l'assiette : variée, riche en fibres et en bonnes protéines. Continue comme ça !" };
  return null;
}

// Coach taquin : la situation qui parle le plus dans l'assiette du jour (banter.js), ou null
export function plateSituation(rv, hour = 24) {
  if (!rv?.n) return null;
  if (rv.stats.alc >= 3) return { kind: "plateAlcohol", vals: { n: rv.stats.alc } };
  if (rv.week && rv.week.deli > REF.deliWeek && rv.stats.deli > 0) return { kind: "plateDeli", vals: { n: rv.week.deli } };
  if (rv.grade === "bad" && rv.n >= 3) return { kind: "plateBad" };
  if (hour >= 18 && rv.n >= 3 && rv.stats.fv === 0) return { kind: "plateNoVeg" };
  if (hour >= 18 && rv.grade === "great") return { kind: "plateGreat" };
  return null;
}

// Coach taquin : la réplique au moment de noter un aliment (banter.js) ; null s'il n'y a rien à en dire.
// first : première fois de la journée pour cette famille (on ne félicite pas à chaque blanc de poulet)
export function itemSituation(v, { name = "", first = true, week = null, sugarToday = 0 } = {}) {
  if (!v?.quip) return null;
  if (v.tier === "top" && !first) return null;
  const vals = { f: name, n: 0, s: 0 };
  if (v.group === "sweetdrink" || v.group === "energy") Object.assign(vals, { n: Math.round(v.sugar), s: cubes(v.sugar) });
  else if (v.group === "sweet" || v.group === "pastry") Object.assign(vals, { n: Math.round(sugarToday), s: cubes(v.sugar) });
  else if (v.group === "alcohol") vals.n = v.alc;
  else if (v.group === "deli") vals.n = week?.deli ?? v.deli;
  else if (v.group === "redmeat") vals.n = week?.red ?? v.red;
  return { kind: v.quip, vals };
}

// Une phrase chiffrée sur la portion (sucre, sel, alcool), à côté de l'avis ; null sinon
export function portionFact(v) {
  if (!v) return null;
  if (v.alc >= 0.2) return { t: "Cette portion : ≈ %n verre(s) standard d'alcool.", v: { n: v.alc } };
  if (v.sugar >= 5) return { t: "Cette portion : ≈ %n g de sucres ajoutés, soit %s morceaux de sucre.", v: { n: Math.round(v.sugar), s: cubes(v.sugar) } };
  if (v.salty && v.salt >= 1) return { t: "Cette portion : ≈ %n g de sel, sur moins de 5 g conseillés par jour.", v: { n: v.salt } };
  return null;
}
