# Contribuer à Valo Atlas

Merci de vouloir aider ! Les deux façons les plus simples de contribuer sont d'**ajouter un lineup** et de **mettre à jour les agents conseillés par map**. Pas besoin de savoir coder : tout se passe dans des fichiers JSON.

## Ajouter un lineup

1. Ouvre la page **Lineups** du site (en ligne, ou en local avec `python -m http.server`).
2. Choisis la map, puis clique sur **+ Proposer un lineup**.
3. Remplis le formulaire : agent, compétence, camp, site, titre et étapes (une par ligne).
4. Clique sur la minimap **une première fois pour ta position**, puis **une deuxième fois pour le point visé**.
5. Copie le JSON généré et colle-le dans la liste `"lineups"` de `data/lineups.json` (n'oublie pas la virgule entre deux entrées).
6. Ouvre une pull request.

Un bon lineup, c'est :

- **testé en jeu** : il marche à chaque fois ;
- **précis** : les étapes disent où se placer, où viser, et comment tirer (charge, rebonds, saut…) ;
- idéalement accompagné d'une **vidéo** (YouTube, Medal, Streamable…) dans le champ `video`.

### Format d'une entrée

```json
{
  "id": "ascent-sova-reco-b-main",
  "map": "Ascent",
  "agent": "Sova",
  "slot": "Ability2",
  "camp": "attaque",
  "site": "B",
  "titre": "Reconnaissance du site B depuis B Main",
  "etapes": ["Se placer…", "Viser…", "Tirer…"],
  "depuis": { "x": 0.405, "y": 0.712 },
  "vers": { "x": 0.285, "y": 0.737 },
  "video": "https://…",
  "auteur": "ton-pseudo-github"
}
```

| Champ | Valeurs possibles |
|---|---|
| `id` | identifiant unique, en minuscules avec des tirets |
| `map`, `agent` | le nom exact du jeu (`KAY/O`, `Ascent`…) |
| `slot` | `Grenade` (C), `Ability1` (Q), `Ability2` (E), `Ultimate` (X) |
| `camp` | `attaque` ou `defense` |
| `site` | `A`, `B`, `C` ou `Mid` |
| `depuis`, `vers` | positions sur la minimap, entre 0 et 1 |

Si ton lineup remplace un des exemples (`"exemple": true`), supprime l'exemple.

## Mettre à jour les agents conseillés par map

Tout est dans `data/meta-maps.json`. Pour chaque map :

```json
"Ascent": {
  "resume": "Une ou deux phrases sur le style de la map.",
  "caracteristiques": ["Mid ouvert", "Portes fermables"],
  "agents": [
    { "nom": "Sova", "pourquoi": "Pourquoi cet agent est bon sur cette map." }
  ],
  "compo": ["Omen", "Sova", "KAY/O", "Killjoy", "Jett"]
}
```

- Conseille **au moins 2 agents par rôle** (contrôleur, initiateur, sentinelle, duelliste). Le script de vérification le contrôle.
- Explique toujours **pourquoi** l'agent est bon sur la map (forme de la map, lignes de vue, nombre de sites…). C'est ce qui rend la page utile.
- Le rôle de l'agent (contrôleur, initiateur…) est récupéré automatiquement : pas besoin de l'écrire.
- La `compo` contient exactement 5 agents.
- Une map absente du fichier s'affiche « À compléter » sur le site.
- Après avoir relu ou corrigé le fichier, mets la date du jour dans `"miseAJour"` (format `AAAA-MM-JJ`). Elle s'affiche sur la page « Agents par map », et le script de vérification rappelle de relire la méta quand elle a plus de 90 jours.
- `"aConfirmer": true` signale une analyse déduite de la forme de la map, pas encore de l'expérience en jeu (c'est le cas de Corrode et Summit). Le site affiche alors « À confirmer ». Si tu joues ces maps et que les conseils te semblent justes, ou après les avoir corrigés, retire cette ligne.

## Vérifier avant d'envoyer

```bash
python scripts/valider_donnees.py
```

Le script signale les erreurs de format, les noms d'agents ou de maps mal orthographiés et les positions hors de la minimap. Il est aussi lancé automatiquement sur chaque pull request.

## Modifier le code

Le site est fait en HTML, CSS et JavaScript (modules ES), sans framework ni étape de compilation. Chaque page a son fichier dans `assets/js/`. Les couleurs sont des variables CSS en haut de `assets/css/style.css`.

Les calculs de la page Armes sont dans `assets/js/calculs-armes.js` et testés dans `tests/`. Lance `npm test` (Node.js 22 ou plus, rien à installer) avant d'envoyer une modification du JavaScript.
