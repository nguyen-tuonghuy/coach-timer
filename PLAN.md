# Coach Timer — Plan de développement

## 1. Objectif

Créer une application web simple de timer d’intervalles, utilisable à la fois :

- comme timer classique pour un entraînement individuel ;
- comme timer de coaching collectif ;
- avec possibilité de contrôler manuellement certaines transitions entre intervalles.

L’application doit rester volontairement simple, rapide et fiable.

Elle ne doit dépendre d’aucun backend pour sa première version.

L’application doit fonctionner hors ligne après installation en tant que PWA.

---

# 2. Problème principal à résoudre

Les applications classiques de type Interval Timer fonctionnent principalement avec des enchaînements automatiques :

```text
Travail
→ Repos
→ Travail
→ Repos
```

Dans une séance dirigée par un coach, ce comportement n’est pas toujours adapté.

Exemple :

```text
Joueur A travaille pendant 20 secondes
→ changement de joueur
Joueur B travaille pendant 20 secondes
```

Le temps nécessaire pour changer de joueur peut être variable.

Le coach doit pouvoir attendre :

- que les joueurs soient prêts ;
- qu’ils changent de position ;
- qu’il ait donné une correction ;
- qu’il ait expliqué la consigne suivante.

L’application doit donc permettre de choisir le comportement de chaque transition.

---

# 3. Principe fondamental

Une séance est composée de :

```text
Routine
  └── Blocs
        └── Étapes
              └── Transition vers l’étape suivante
```

Une étape possède :

- un nom ;
- une durée ;
- éventuellement un type/catégorie ;
- une transition vers l’étape suivante.

La transition appartient à l’étape qui vient de se terminer.

---

# 4. Types de transitions

Trois modes doivent être supportés.

## 4.1 Automatique

```text
Étape terminée
↓
Étape suivante immédiatement
```

Utilisation typique :

```text
30 s travail
→ auto
30 s repos
→ auto
```

---

## 4.2 Manuelle

```text
Étape terminée
↓
ATTENTE
↓
Le coach appuie sur GO
↓
Étape suivante
```

Il n’y a aucune durée maximale pour cette transition.

Exemple :

```text
Joueur A
20 s

ATTENTE COACH

Joueur B
20 s
```

Le temps passé en attente peut être affiché à titre informatif.

---

## 4.3 Délai chronométré

Une transition possède une durée fixe avant le démarrage automatique de l’étape suivante.

Exemple :

```text
Atelier A
3:00

Transition
0:15

Atelier B
3:00
```

---

# 5. Exemple de routine coach

Routine :

```text
20/20 — Deux joueurs
```

Contenu :

```text
Bloc × 5

Joueur A travaille
20 s
→ transition manuelle

Joueur B travaille
20 s
→ transition manuelle
```

Le déroulement réel est donc :

```text
20 s Joueur A

ATTENTE COACH

GO

20 s Joueur B

ATTENTE COACH

GO

Tour suivant
```

---

# 6. Exemple de routine classique

Routine :

```text
30/30 × 10
```

Contenu :

```text
Travail
30 s
→ auto

Repos
30 s
→ auto

Répéter 10 fois
```

L’application se comporte alors exactement comme un interval timer classique.

---

# 7. Architecture technique

Créer une application légère en :

- HTML ;
- CSS ;
- JavaScript vanilla.

Ne pas utiliser dans la V1 :

- React ;
- Vue ;
- Angular ;
- backend ;
- Supabase ;
- compte utilisateur ;
- authentification.

Architecture recommandée :

```text
coach-timer/
├── index.html
├── css/
│   └── style.css
├── js/
│   ├── app.js
│   ├── timer.js
│   ├── routines.js
│   └── storage.js
├── manifest.json
├── service-worker.js
├── README.md
└── .gitignore
```

Le code doit être suffisamment modulaire pour permettre une évolution ultérieure.

---

# 8. Responsabilités des modules

## timer.js

Contient uniquement la logique du timer.

Responsabilités :

- démarrer une étape ;
- mettre en pause ;
- reprendre ;
- arrêter ;
- terminer une étape ;
- gérer les transitions ;
- passer à l’étape suivante ;
- revenir à l’étape précédente ;
- gérer les répétitions de blocs ;
- calculer le temps restant.

La logique métier du timer ne doit pas dépendre directement du DOM.

---

## routines.js

Responsabilités :

- modèle de données des routines ;
- création ;
- modification ;
- duplication ;
- suppression ;
- validation ;
- expansion des blocs répétables si nécessaire.

---

## storage.js

Responsabilités :

- sauvegarde locale ;
- chargement des routines ;
- migration simple du format de données si nécessaire.

Utiliser dans un premier temps :

```text
localStorage
```

Aucun serveur.

---

## app.js

Responsabilités :

- interface utilisateur ;
- navigation entre écrans ;
- interaction avec timer.js ;
- mise à jour du DOM ;
- gestion des sons ;
- affichage des états.

---

# 9. Modèle de données

Exemple :

```javascript
{
  id: "routine-001",
  name: "20/20 joueurs",
  blocks: [
    {
      id: "block-001",
      repeat: 5,
      steps: [
        {
          id: "step-001",
          label: "Joueur A",
          duration: 20,
          type: "work",
          transition: {
            mode: "manual"
          }
        },
        {
          id: "step-002",
          label: "Joueur B",
          duration: 20,
          type: "work",
          transition: {
            mode: "manual"
          }
        }
      ]
    }
  ]
}
```

Transition automatique :

```javascript
transition: {
  mode: "auto"
}
```

Transition manuelle :

```javascript
transition: {
  mode: "manual"
}
```

Transition temporisée :

```javascript
transition: {
  mode: "delay",
  duration: 10
}
```

---

# 10. Timer : exigence critique

Le chrono ne doit jamais utiliser ce modèle :

```javascript
setInterval(() => {
  remaining--;
}, 1000);
```

Cela provoquerait des dérives, notamment lorsque :

- le navigateur ralentit les timers ;
- le téléphone passe en veille ;
- l’onglet passe en arrière-plan ;
- le processeur est momentanément occupé.

La durée réelle doit reposer sur une référence temporelle absolue.

Exemple conceptuel :

```javascript
endTimestamp = Date.now() + duration * 1000;
```

Puis :

```javascript
remaining = endTimestamp - Date.now();
```

Le timer JavaScript sert uniquement à demander une mise à jour régulière de l’affichage.

La source de vérité est toujours le timestamp.

La même règle doit s’appliquer après pause/reprise.

---

# 11. Machine d’état

Le moteur doit utiliser explicitement un état.

États possibles :

```text
IDLE
RUNNING
PAUSED
WAITING_MANUAL
RUNNING_TRANSITION
FINISHED
```

Exemple :

```text
IDLE
↓
RUNNING
↓
étape terminée
↓
transition.mode ?

auto
→ RUNNING étape suivante

manual
→ WAITING_MANUAL
→ GO
→ RUNNING étape suivante

delay
→ RUNNING_TRANSITION
→ RUNNING étape suivante
```

Éviter de disperser la logique de changement d’état dans plusieurs composants de l’interface.

---

# 12. Écran principal pendant une séance

L’écran doit être utilisable à plusieurs mètres.

Priorités visuelles :

1. temps restant ;
2. nom de l’étape actuelle ;
3. état du timer ;
4. étape suivante ;
5. numéro de répétition.

Exemple :

```text
JOUEUR A

00:20

Tour 2 / 5

Suivant :
Joueur B — 20 s

[ PAUSE ]
```

Le chrono doit occuper une grande partie de l’écran.

---

# 13. Transition manuelle

Lorsque l’étape est terminée :

```text
TERMINÉ

Joueur A

──────

PROCHAIN

Joueur B
20 s

Transition : 00:08

[ GO ]
```

Le bouton GO doit être très grand.

Il doit être possible de déclencher GO immédiatement.

Option à prévoir dans la conception, mais pas nécessairement dans la première implémentation :

```text
GO
```

ou

```text
3
2
1
GO
```

---

# 14. Transition temporisée

Exemple :

```text
TRANSITION

00:08

Prochain :
Atelier B — 3:00
```

À zéro :

```text
Atelier B
```

démarre automatiquement.

---

# 15. Commandes pendant une séance

V1 :

- Pause ;
- Reprendre ;
- Étape suivante ;
- Étape précédente ;
- Recommencer l’étape ;
- Arrêter la séance.

Prévoir également dans l’architecture :

- +10 secondes ;
- +30 secondes.

Ces deux fonctions peuvent être ajoutées après la V1 initiale.

---

# 16. Sons

Prévoir au minimum :

- bip à 3 secondes ;
- bip à 2 secondes ;
- bip à 1 seconde ;
- son distinct de fin d’étape ;
- son distinct de fin de séance.

Les sons doivent pouvoir être :

```text
Activés / Désactivés
```

Les sons ne doivent pas être nécessaires au fonctionnement du timer.

---

# 17. Création d’une routine

L’éditeur doit rester simple.

L’utilisateur crée :

```text
Nom de la routine
```

Puis ajoute un bloc.

Pour chaque bloc :

```text
Nombre de répétitions
```

Puis des étapes.

Pour chaque étape :

```text
Nom
Durée
Transition
```

Transition :

```text
Automatique
Manuelle
Délai
```

Si délai :

```text
Durée de transition
```

---

# 18. Valeur de transition par défaut

Lors de la création d’une routine, permettre de définir :

```text
Transition par défaut :
[ Automatique ▼ ]
```

Les étapes utilisent cette valeur sauf modification explicite.

Objectif :

éviter de devoir configurer manuellement chaque transition dans une routine simple.

---

# 19. Gestion des routines

Écran d’accueil :

```text
Mes routines

30/30 × 10
20/20 joueurs
Circuit physique
Renforcement

[ + Nouvelle routine ]
```

Actions :

- lancer ;
- modifier ;
- dupliquer ;
- supprimer.

---

# 20. Sauvegarde

Les routines doivent être conservées localement entre deux utilisations.

V1 :

```text
localStorage
```

Le modèle doit néanmoins être sérialisable en JSON.

À terme, cela permettra facilement :

- export JSON ;
- import JSON ;
- partage de routines.

Ne pas implémenter ces fonctions avant que le cœur du timer soit stable.

---

# 21. Mobile First

L’application est principalement destinée à être utilisée sur téléphone.

Contraintes :

- gros boutons tactiles ;
- aucun élément nécessitant un hover ;
- interface utilisable à une main ;
- taille de texte suffisante ;
- chrono visible à plusieurs mètres ;
- aucune barre horizontale ;
- fonctionnement portrait prioritaire ;
- paysage supporté.

Les contrôles importants doivent avoir une zone tactile minimale d’environ 44 × 44 px.

---

# 22. PWA

L’application doit pouvoir être installée depuis le navigateur.

Créer :

```text
manifest.json
service-worker.js
```

Objectifs :

- installation sur écran d’accueil ;
- lancement comme application ;
- fonctionnement hors ligne ;
- chargement rapide.

Le service worker ne doit mettre en cache que les ressources statiques nécessaires à l’application.

---

# 23. Écran toujours allumé

Prévoir une abstraction pour utiliser la Wake Lock API lorsque disponible.

Exemple :

```javascript
navigator.wakeLock.request("screen")
```

Ne jamais rendre l’application dépendante de cette API.

Si elle n’est pas disponible :

```text
le timer continue simplement à fonctionner normalement.
```

La perte puis récupération du wake lock doit être gérée proprement.

---

# 24. Reprise après mise en arrière-plan

Cas critique.

Si l’application passe en arrière-plan pendant :

```text
25 secondes
```

et revient ensuite au premier plan, le timer doit immédiatement recalculer sa position réelle à partir du timestamp.

Exemple :

```text
Intervalle initial : 30 s

application masquée à 20 s restantes

retour 15 s plus tard
```

Résultat attendu :

```text
5 s restantes
```

et non :

```text
20 s restantes.
```

---

# 25. Passage de plusieurs étapes pendant l’arrière-plan

Le moteur doit être conçu pour gérer ce cas :

```text
10 s travail
10 s repos
10 s travail
```

Si l’application reste en arrière-plan pendant 25 secondes, elle ne doit pas simplement terminer l’étape courante.

Elle doit pouvoir déterminer quelle étape devrait être active au retour.

Exception :

une transition manuelle ne peut jamais être franchie automatiquement.

Exemple :

```text
20 s Joueur A
→ MANUAL
20 s Joueur B
```

Même si l’application reste en arrière-plan pendant 10 minutes :

```text
elle reste en WAITING_MANUAL.
```

---

# 26. Pause

Lors d’une pause :

```text
remainingTime
```

doit être mémorisé.

Lors de la reprise :

```javascript
endTimestamp = Date.now() + remainingTime;
```

La pause ne doit pas continuer à consommer la durée de l’étape.

---

# 27. Fin de séance

À la fin :

```text
SÉANCE TERMINÉE

Durée chronométrée :
XX:XX

[ RECOMMENCER ]

[ RETOUR AUX ROUTINES ]
```

La durée des pauses manuelles peut éventuellement être affichée séparément dans une évolution future.

---

# 28. Données qui peuvent être utiles ultérieurement

Prévoir sans nécessairement afficher dans la V1 :

```javascript
{
  startedAt,
  completedAt,
  elapsedActiveTime,
  manualTransitionTime
}
```

Ne pas créer de module de statistiques dans la V1.

---

# 29. Accessibilité

Respecter :

- contrastes suffisants ;
- boutons avec labels explicites ;
- utilisation possible au clavier ;
- focus visibles ;
- `aria-live` pour les changements importants si pertinent ;
- ne jamais distinguer deux états uniquement par leur couleur.

---

# 30. Design

Design simple.

Éviter :

- surcharge graphique ;
- animations inutiles ;
- menus complexes ;
- effets visuels décoratifs.

Priorité :

```text
lisibilité
rapidité
simplicité
fiabilité
```

Pendant une séance :

```text
le chrono doit dominer visuellement l’interface.
```

---

# 31. Pas de fonctionnalités inutiles dans la V1

Ne pas ajouter spontanément :

- authentification ;
- profils utilisateurs ;
- cloud ;
- réseau social ;
- partage public ;
- statistiques avancées ;
- recommandations IA ;
- programmes d’entraînement ;
- intégration sportive spécifique ;
- gamification ;
- calories ;
- fréquence cardiaque ;
- GPS.

Coach Timer doit rester un timer généraliste.

---

# 32. Tests fonctionnels minimum

Créer des tests ou au minimum des scénarios reproductibles pour les cas suivants.

## Test 1 — automatique

```text
Étape A : 5 s
auto
Étape B : 5 s
```

Résultat :

```text
A démarre
A se termine
B démarre immédiatement.
```

---

## Test 2 — manuel

```text
A : 5 s
manual
B : 5 s
```

Résultat :

```text
A se termine
WAITING_MANUAL
B ne démarre jamais sans GO.
```

---

## Test 3 — délai

```text
A : 5 s
delay 3 s
B : 5 s
```

Résultat :

```text
A
transition 3 s
B.
```

---

## Test 4 — pause

```text
Étape de 20 s
pause après environ 5 s
```

Attendre.

Résultat :

```text
le temps restant ne doit pas diminuer pendant la pause.
```

---

## Test 5 — arrière-plan

```text
Étape 30 s
```

Masquer l’application pendant environ 10 secondes.

Résultat :

```text
la durée écoulée réelle doit être prise en compte au retour.
```

---

## Test 6 — transition manuelle en arrière-plan

```text
A 5 s
manual
B 5 s
```

Laisser A se terminer puis passer l’application en arrière-plan.

Résultat :

```text
B ne doit jamais démarrer automatiquement.
```

---

## Test 7 — répétition

```text
Bloc × 3

A 2 s
auto

B 2 s
auto
```

Ordre attendu :

```text
A B A B A B
```

puis fin de séance.

---

# 33. Ordre de développement

Ne pas développer toute l’application d’un seul coup.

Procéder dans cet ordre.

## Phase 1 — moteur de timer

Créer et valider :

- modèle de données ;
- machine d’état ;
- calcul des timestamps ;
- auto ;
- manual ;
- delay ;
- répétitions ;
- pause/reprise ;
- suivant/précédent.

Le moteur doit pouvoir fonctionner indépendamment de l’interface finale.

---

## Phase 2 — écran de lecture

Créer l’écran principal :

- chrono ;
- étape actuelle ;
- prochaine étape ;
- numéro du tour ;
- pause ;
- suivant ;
- précédent ;
- GO manuel.

---

## Phase 3 — routines

Créer :

- liste des routines ;
- création ;
- modification ;
- suppression ;
- duplication ;
- localStorage.

---

## Phase 4 — sons et ergonomie

Ajouter :

- 3 / 2 / 1 ;
- signal de fin ;
- paramètres audio ;
- gros contrôles tactiles.

---

## Phase 5 — PWA

Ajouter :

- manifest ;
- service worker ;
- fonctionnement offline ;
- installation ;
- wake lock.

---

## Phase 6 — validation

Tester l’application :

- desktop ;
- mobile étroit ;
- portrait ;
- paysage ;
- background/foreground ;
- sessions longues ;
- routines comprenant plusieurs blocs.

---

# 34. Règles de développement

Chaque phase doit être terminée et fonctionnelle avant de commencer la suivante.

Éviter les grosses réécritures.

Préférer :

- petites fonctions ;
- responsabilités clairement séparées ;
- noms explicites ;
- pas d’état global inutile ;
- commentaires uniquement lorsqu’ils apportent une information utile.

Ne pas dupliquer la logique métier du timer dans l’interface.

---

# 35. Git

Utiliser Git dès le début du projet.

Créer des commits fonctionnels régulièrement.

Exemples :

```text
Initial project structure

Implement timer state machine

Implement automatic transitions

Implement manual transitions

Implement timed transitions

Add routine editor

Add local persistence

Add PWA support
```

Ne pas regrouper toute l’application dans un seul commit.

---

# 36. Critère de réussite de la V1

La V1 est considérée terminée lorsqu’il est possible de créer puis utiliser correctement ces deux routines.

## Routine 1

```text
30/30 × 10

Travail 30 s
→ automatique

Repos 30 s
→ automatique
```

sans intervention utilisateur.

## Routine 2

```text
20/20 joueurs × 5

Joueur A 20 s
→ manuel

Joueur B 20 s
→ manuel
```

avec un bouton GO entre chaque période de travail.

Les deux doivent utiliser exactement le même moteur.

---

# 37. Principe produit à conserver

Le produit ne doit pas être construit comme :

```text
un timer HIIT auquel on ajoute un bouton pause coach.
```

Il doit être construit autour d’un modèle plus général :

```text
une séquence d’étapes chronométrées
reliées par des transitions configurables.
```

Une transition peut être :

```text
automatique
manuelle
temporisée
```

C’est le concept central de Coach Timer.

---

# 38. Première tâche demandée à l’agent

Avant d’implémenter l’interface complète :

1. analyser ce plan ;
2. créer l’architecture du projet ;
3. proposer le modèle de données final ;
4. implémenter le moteur de timer ;
5. créer une interface minimale permettant de tester :
   - transition automatique ;
   - transition manuelle ;
   - transition temporisée ;
6. vérifier les scénarios de test ;
7. seulement ensuite commencer l’éditeur de routines.

Ne pas ajouter de fonctionnalités non prévues au plan sans justification.
