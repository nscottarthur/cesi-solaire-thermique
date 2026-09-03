# Solaire thermique — le CESI en action

Prototype interactif remplaçant le module Scenari statique "Solaire thermique"
(GCBD, S. Habiba Lharti). Schéma CESI animé, simulateur de configuration
système/appoint, explorateur d'hystérésis de régulation, quiz d'auto-évaluation,
et assistant IA intégré.

## Structure

```
src/App.jsx    → l'application React (tout le module, y compris l'assistant)
src/main.jsx   → point d'entrée
```

## Assistant IA

Le chat appelle directement le Worker Cloudflare existant `imt-ai-proxy`
(https://imt-ai-proxy.nscottarthur.workers.dev/), qui relaie tel quel toute
requête vers l'API Anthropic en utilisant sa propre clé côté serveur
(`ANTHROPIC_API_KEY`, déjà configurée sur ce Worker). Le prompt système et
l'historique de conversation sont construits côté client dans `App.jsx`
(constante `ASSISTANT_SYSTEM_PROMPT`) et envoyés à chaque appel — la clé API
elle-même ne transite jamais côté navigateur.

Comme ce Worker est mutualisé avec un autre projet (Sarah Aquinta), toute
modification de son code affecte les deux usages : ne pas y toucher sans
vérifier l'impact.

## Développement local

```
npm install
npm run dev
```

## Déploiement sur Cloudflare Pages

1. Créer un projet Cloudflare Pages pointant sur ce dossier.
   - Commande de build : `npm run build`
   - Dossier de sortie : `dist`
2. Déployer — aucune variable d'environnement n'est nécessaire côté Pages
   puisque le Worker existant gère déjà la clé API.

## Notes

- Le contenu pédagogique est une reformulation du support de cours existant
  (Contexte, Principe de fonctionnement, Types de systèmes, Appoint,
  Régulation/Dimensionnement) — à valider avec Habiba avant mise en production.
- L'assistant est scopé au périmètre du CESI via son system prompt
  (voir `functions/api/assistant.js`) : il répond directement aux questions
  factuelles et adopte une approche socratique sur les choix du simulateur.
