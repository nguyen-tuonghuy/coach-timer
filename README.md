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

Le lecteur utilise quatre signaux distincts : un bip court identique à 3, 2 et 1 seconde, une tonalité longue à la fin d'un intervalle, un double bip ascendant au départ après GO ou une transition temporisée, puis un motif de trois notes pour la fin de séance. Le bouton « Son activé / désactivé » mémorise ce réglage localement. Certains navigateurs demandent une première interaction avec le lecteur avant d'autoriser le son.

## PWA

Coach Timer peut être installé depuis le navigateur et se lance en mode autonome sur Android et iOS. Après le premier chargement, le service worker conserve l'application et ses ressources statiques pour une utilisation hors ligne. L’interface respecte les zones sûres des téléphones à encoche. Pendant une étape, une transition chronométrée ou une attente manuelle, l'application demande un Wake Lock lorsque le navigateur le permet; il est relâché en pause, à la fin et à la sortie du lecteur. Le timer reste utilisable si cette API est indisponible ou refusée.

## Tester le moteur

```sh
npm test
```

## Modèle de données

Une routine contient des blocs répétables. `defaultTransition` reste `null` tant que l'utilisateur n'a pas choisi de transition. Il sert uniquement à pré-sélectionner les nouvelles étapes. Chaque étape enregistrable porte sa transition effective :

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
      transition: { mode: "manual" }
    }]
  }]
}
```

Lors du premier choix d'un défaut, les étapes encore vides reçoivent une copie de cette transition. Les changements ultérieurs du défaut n'affectent jamais les étapes déjà définies. L'enregistrement et le lancement sont refusés si une étape reste sans transition. `type` est normalisé vers `"other"` lorsqu'il est absent. Les données héritées des versions précédentes sont migrées vers des transitions explicites. Les durées sont exprimées en secondes dans les routines et en millisecondes dans le moteur.
