# Coach Timer

Prototype des phases 1 à 4 : moteur de timer indépendant du DOM, écran de lecture mobile-first, gestion locale des routines et signaux audio.

## Lancer l'application

Servir le dossier avec un serveur HTTP statique, par exemple :

```sh
python3 -m http.server 8000
```

Puis ouvrir `http://localhost:8000`.

Au premier lancement, trois routines courtes permettent de vérifier les transitions automatique, manuelle et temporisée. Elles sont ensuite enregistrées dans le navigateur avec les routines créées dans l'éditeur.

## Gérer les routines

Depuis « Mes routines », il est possible de :

- créer une routine composée de blocs répétables et d'étapes ;
- modifier son nom, sa transition par défaut, ses blocs et ses étapes ;
- définir des transitions automatique, manuelle ou avec délai ;
- lancer, dupliquer ou supprimer une routine.

Les données restent dans `localStorage`, sans compte ni serveur.

## Sons

Le lecteur émet des signaux à 3, 2 et 1 seconde, puis des sons distincts à la fin d'une étape et de la séance. Le bouton « Son activé / désactivé » mémorise ce réglage localement. Certains navigateurs demandent une première interaction avec le lecteur avant d'autoriser le son.

## Tester le moteur

```sh
npm test
```

## Modèle de données

Une routine contient des blocs répétables. `defaultTransition` reste `null` tant que l'utilisateur n'a pas choisi de transition. Une étape avec `transition: null` hérite de la transition par défaut ; elle ne porte une valeur `auto`, `manual` ou `delay` que si l'utilisateur la surcharge explicitement :

```js
{
  id: "routine-id",
  name: "Nom",
  defaultTransition: null,
  blocks: [{
    id: "block-id",
    repeat: 3,
    steps: [{
      id: "step-id",
      label: "Travail",
      duration: 20,
      type: "work",
      transition: null
    }]
  }]
}
```

La transition effective d'une étape est résolue au lancement : la surcharge de l'étape si elle existe, sinon `routine.defaultTransition`. L'enregistrement et le lancement sont refusés si une étape héritée ne peut pas résoudre sa transition. `type` est normalisé vers `"other"` lorsqu'il est absent. Les anciennes données sans `defaultTransition` sont migrées vers `{ mode: "auto" }`. Les durées sont exprimées en secondes dans les routines et en millisecondes dans le moteur.
