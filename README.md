# Coach Timer

Prototype des phases 1 et 2 : moteur de timer indépendant du DOM et écran de lecture mobile-first.

## Lancer l'application

Servir le dossier avec un serveur HTTP statique, par exemple :

```sh
python3 -m http.server 8000
```

Puis ouvrir `http://localhost:8000`.

Trois routines courtes permettent de vérifier les transitions automatique, manuelle et temporisée.

## Tester le moteur

```sh
npm test
```

## Modèle de données

Une routine contient des blocs répétables. Chaque étape porte la transition qui sera appliquée à sa fin :

```js
{
  id: "routine-id",
  name: "Nom",
  defaultTransition: { mode: "auto" },
  blocks: [{
    id: "block-id",
    repeat: 3,
    steps: [{
      id: "step-id",
      label: "Travail",
      duration: 20,
      type: "work",
      transition: { mode: "delay", duration: 5 }
    }]
  }]
}
```

`defaultTransition` et `type` sont normalisés respectivement vers `{ mode: "auto" }` et `"other"` lorsqu'ils sont absents. Les durées sont exprimées en secondes dans les routines et en millisecondes dans le moteur.
