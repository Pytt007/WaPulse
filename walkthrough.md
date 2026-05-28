# WaPulse Dashboard Enhancements Walkthrough

This document summarizes the changes made to the WaPulse CRM dashboard to support:
1. **Dynamic Multi-Language System** (French and English, with automatic translation fallback via OpenAI and local cache).
2. **Dynamic Currency Switcher System** (XOF, USD, EUR, GBP, with automatic conversion rates and presentation-layer calculations).

---

## 🌎 Translation System Walkthrough

The translation system for the WaPulse CRM dashboard is fully implemented across all sections of the application. Static labels across the entire dashboard (including metrics, catalog, orders, contacts, pipelines, inbox, broadcasts, automations, settings, and AI agent config) toggle dynamically between French and English. New elements are automatically translated asynchronously via OpenAI and cached on the client side to avoid performance latency.

### 🛠️ Changes Implemented (Translation)

#### 1. Translation System & API
- **[MODIFY] Translation API Endpoint**: [route.ts](file:///c:/Users/SUPREME%20COM/Pictures/WaConnect/src/app/api/translate/route.ts)
  - Features an offline dictionary mapping common dashboard keys (e.g. "tableau de bord" ⇆ "dashboard").
  - Falls back to querying `gpt-4o-mini` if a key is not found and the OpenAI API key is set.
- **[MODIFY] Translation Hook & Provider**: [use-translation.tsx](file:///c:/Users/SUPREME%20COM/Pictures/WaConnect/src/hooks/use-translation.tsx)
  - Manages selected language and client-side translation state.
  - Caches translation results in `localStorage` under `wapulse_translations` to avoid repeated API requests.
- **[MODIFY] Layout Wrapper**: [layout.tsx](file:///c:/Users/SUPREME%20COM/Pictures/WaConnect/src/app/layout.tsx)
  - Wraps the root component inside `LanguageProvider`.

#### 2. UI Components & Layouts
- **[MODIFY] Header Switcher**: [header.tsx](file:///c:/Users/SUPREME%20COM/Pictures/WaConnect/src/components/layout/header.tsx)
  - Embedded a language selector button dropdown next to the user avatar.
- **[MODIFY] Sidebar Menu**: [sidebar.tsx](file:///c:/Users/SUPREME%20COM/Pictures/WaConnect/src/components/layout/sidebar.tsx)
  - Translated all static links, profile options, and button items.
- **[MODIFY] Response Time Chart**: [response-time-chart.tsx](file:///c:/Users/SUPREME%20COM/Pictures/WaConnect/src/components/dashboard/response-time-chart.tsx)
  - Translated headings, average labels, target values, weekday names, and tooltip messages.
- **[MODIFY] Activity Feed**: [activity-feed.tsx](file:///c:/Users/SUPREME%20COM/Pictures/WaConnect/src/components/dashboard/activity-feed.tsx)
  - Added translation hook for feed headings, empty states, pagination text, and relative timestamps ("s ago", "m ago", "h ago", "d ago").
  - Implemented dynamic parsing (`translateActivityText`) using Regular Expressions to translate dynamic log events side-by-side with localized keys (e.g. "New message from", "Deal", "Automation failed for") without altering user-generated titles or names.
- **[NEW] Activity Feed Test Suite**: [activity-feed.test.ts](file:///c:/Users/SUPREME%20COM/Pictures/WaConnect/src/components/dashboard/activity-feed.test.ts)
  - Added unit tests for each type of activity feed text translation scenario (message, contact, deal, broadcast, automation trigger and failure).

#### 3. Pages & Components Translated
- **Dashboard Analytics**: [page.tsx](file:///c:/Users/SUPREME%20COM/Pictures/WaConnect/src/app/(dashboard)/dashboard/page.tsx)
- **Product Catalog**: [page.tsx](file:///c:/Users/SUPREME%20COM/Pictures/WaConnect/src/app/(dashboard)/dashboard/products/page.tsx)
- **Orders Tracking**: [page.tsx](file:///c:/Users/SUPREME%20COM/Pictures/WaConnect/src/app/(dashboard)/dashboard/orders/page.tsx)
- **CRM Contacts**: [page.tsx](file:///c:/Users/SUPREME%20COM/Pictures/WaConnect/src/app/(dashboard)/contacts/page.tsx)
- **Sale Pipelines**: [page.tsx](file:///c:/Users/SUPREME%20COM/Pictures/WaConnect/src/app/(dashboard)/pipelines/page.tsx)
- **Shared Inbox**: [page.tsx](file:///c:/Users/SUPREME%20COM/Pictures/WaConnect/src/app/(dashboard)/inbox/page.tsx)
- **Message Broadcasts**: [page.tsx](file:///c:/Users/SUPREME%20COM/Pictures/WaConnect/src/app/(dashboard)/broadcasts/page.tsx)
- **Automations & Rules**: [page.tsx](file:///c:/Users/SUPREME%20COM/Pictures/WaConnect/src/app/(dashboard)/automations/page.tsx)
- **AI Agent Console**: [page.tsx](file:///c:/Users/SUPREME%20COM/Pictures/WaConnect/src/app/(dashboard)/dashboard/agents/page.tsx)
- **Settings Forms**: [page.tsx](file:///c:/Users/SUPREME%20COM/Pictures/WaConnect/src/app/(dashboard)/settings/page.tsx), [profile-form.tsx](file:///c:/Users/SUPREME%20COM/Pictures/WaConnect/src/components/settings/profile-form.tsx), [whatsapp-config.tsx](file:///c:/Users/SUPREME%20COM/Pictures/WaConnect/src/components/settings/whatsapp-config.tsx).

---

## 💱 Currency Switcher Walkthrough

The global dynamic currency switcher changes the currency displayed across all modules. Database records preserve their original currency values, and currency conversions occur on the fly at the presentation/aggregation layer using a fixed-rate model based on the XOF currency.

### 🛠️ Changes Implemented (Currency)

#### 1. Core Library & React Provider
- **[NEW] Currency Helper Library**: [currency.ts](file:///c:/Users/SUPREME%20COM/Pictures/WaConnect/src/lib/currency.ts)
  - Defines supported currencies (`XOF`, `USD`, `EUR`, `GBP`) and their fixed exchange rates relative to `XOF` (1 EUR = 655.957 XOF, 1 USD = 600 XOF, 1 GBP = 760 XOF).
  - Implements the pure helper function `convertCurrency(val, source, target)` to perform conversion math.
- **[NEW] Currency Hook & Context**: [use-currency.tsx](file:///c:/Users/SUPREME%20COM/Pictures/WaConnect/src/hooks/use-currency.tsx)
  - Persists the active currency preference in `localStorage` under `wapulse_currency`.
  - Implements formatting methods using `Intl.NumberFormat` with locale awareness (`fr-FR` / `en-US`) to output clean localized prices.
- **[MODIFY] Layout Wrapper**: [layout.tsx](file:///c:/Users/SUPREME%20COM/Pictures/WaConnect/src/app/layout.tsx)
  - Integrated `CurrencyProvider` at the root layout level.

#### 2. UI Components & Layouts
- **[MODIFY] Header Switcher**: [header.tsx](file:///c:/Users/SUPREME%20COM/Pictures/WaConnect/src/components/layout/header.tsx)
  - Added a dynamic dropdown for currency switcher next to the language switcher in the Header navigation.

#### 3. Presentation & Aggregation Updates
- **[MODIFY] Dashboard Analytics**: [queries.ts](file:///c:/Users/SUPREME%20COM/Pictures/WaConnect/src/lib/dashboard/queries.ts)
  - Queries modified to pull the `currency` field. All metrics aggregate values in baseline `XOF` before displaying the converted sum in the target active currency.
  - [page.tsx](file:///c:/Users/SUPREME%20COM/Pictures/WaConnect/src/app/(dashboard)/dashboard/page.tsx): Updated to format open deal values and metric sums dynamically.
  - [pipeline-donut.tsx](file:///c:/Users/SUPREME%20COM/Pictures/WaConnect/src/components/dashboard/pipeline-donut.tsx): Displays chart slice values using dynamic compact formatting.
- **[MODIFY] Pipelines Board**:
  - [pipeline-board.tsx](file:///c:/Users/SUPREME%20COM/Pictures/WaConnect/src/components/pipelines/pipeline-board.tsx): Deal amounts are baselined to XOF for computing stage totals, formatting them dynamically per column.
  - [pipeline-analytics.tsx](file:///c:/Users/SUPREME%20COM/Pictures/WaConnect/src/components/pipelines/pipeline-analytics.tsx): Converts Mixed deal values to display analytics metrics in the selected global currency.
  - [deal-card.tsx](file:///c:/Users/SUPREME%20COM/Pictures/WaConnect/src/components/pipelines/deal-card.tsx): Card deal values are formatted dynamically based on the global selection.
- **[MODIFY] Product Catalog**: [page.tsx](file:///c:/Users/SUPREME%20COM/Pictures/WaConnect/src/app/(dashboard)/dashboard/products/page.tsx)
  - Formats table pricing and catalog lists dynamically.
- **[MODIFY] Contact Sidebar**: [contact-sidebar.tsx](file:///c:/Users/SUPREME%20COM/Pictures/WaConnect/src/components/inbox/contact-sidebar.tsx)
  - Formats active contact opportunities dynamically in the chat view sidebar.
- **[MODIFY] Orders Manager**: [page.tsx](file:///c:/Users/SUPREME%20COM/Pictures/WaConnect/src/app/(dashboard)/dashboard/orders/page.tsx)
  - Financial KPI totals (`Chiffre d'Affaires`, `Panier Moyen Payé`) convert mixed currencies to XOF before performing aggregation.
  - Orders table totals, itemized rows in the detail dialog, and total sums are converted and formatted dynamically using `useCurrency`.

---

## 🧪 Verification & Tests

### Automated Tests
All tests compile and pass successfully:
```bash
$ npm run test
...
 Test Files  12 passed (12)
      Tests  110 passed (110)
   Start at  13:41:38
   Duration  5.68s
```

Additionally, TypeScript type checking returns zero errors:
```bash
$ npm run typecheck
> tsc --noEmit
# Completed successfully with no errors
```

### Manual Verification
- Setting the global currency in the top-right header header dropdown immediately reflects the prices and totals in XOF, USD, EUR, or GBP across the Dashboard, Orders, Pipelines, Inbox, and Products page.

---

## 💬 Réengagement Automatique WhatsApp (Fenêtre de 24 heures)

Cette fonctionnalité permet de contourner de manière transparente et automatique la restriction Meta des 24 heures (Customer Service Window). Lorsqu'une session de discussion a expiré, l'agent peut continuer à taper et envoyer un message librement. Le système l'enveloppe automatiquement dans un modèle de message (Template) approuvé contenant une seule variable `{{1}}`.

### 🛠️ Modifications Implémentées

#### 1. Backend : Détection d'expiration et Enveloppement Automatique
- **[MODIFY] Endpoint d'envoi**: [route.ts](file:///c:/Users/SUPREME%20COM/Pictures/WaConnect/src/app/api/whatsapp/send/route.ts)
  - Détecte si la session avec le contact est expirée (pas de message client ou dernier message client datant de plus de 24h).
  - Si expirée et que l'agent tente d'envoyer un message texte normal :
    - Recherche un template WhatsApp approuvé (`Approved`) contenant exactement une variable `{{1}}` (et non `{{2}}`).
    - Enveloppe le message de l'agent dans le template (`params: [content_text]`).
    - Enregistre le texte rendu final dans la base de données locale afin de garder un historique exact.
- **[MODIFY] Mock Database Server**: [server.ts](file:///c:/Users/SUPREME%20COM/Pictures/WaConnect/src/lib/supabase/server.ts) et [client.ts](file:///c:/Users/SUPREME%20COM/Pictures/WaConnect/src/lib/supabase/client.ts)
  - Correction de `ServerMockQueryBuilder` et `MockQueryBuilder` pour éviter que l'appel `.select()` n'écrase une action d'insertion (`insert`).
- **[MODIFY] Test Suite**: [send.test.ts](file:///c:/Users/SUPREME%20COM/Pictures/WaConnect/src/app/api/whatsapp/send/send.test.ts)
  - Correction de la réinitialisation de la base de données de test en passant un filtre non-vide.
  - Ajout et validation des cas de tests pour le réengagement automatique.

#### 2. Frontend : Saisie libre et avertissement UX
- **[MODIFY] Zone de saisie (Composer)**: [message-composer.tsx](file:///c:/Users/SUPREME%20COM/Pictures/WaConnect/src/components/inbox/message-composer.tsx)
  - Débloque le composer de messages même si la session a expiré.
  - Affiche un bandeau d'avertissement informatif en jaune expliquant que le message sera automatiquement enveloppé dans un modèle approuvé.
  - Met à jour le texte fictif (placeholder) en `"Saisissez un message pour réengager..."`.

#### 3. Traductions & Localisation
- **[MODIFY] Dictionnaires de Traduction**: [use-translation.tsx](file:///c:/Users/SUPREME%20COM/Pictures/WaConnect/src/hooks/use-translation.tsx) et [route.ts](file:///c:/Users/SUPREME%20COM/Pictures/WaConnect/src/app/api/translate/route.ts)
  - Ajout des traductions en anglais et français pour les nouveaux éléments de l'interface (avertissements, placeholders).

### 🧪 Tests & Vérification
Les tests unitaires passent avec succès (113/113 tests réussis) et la compilation TypeScript ne remonte aucune erreur.

---

## 💬 WhatsApp-style Message Composer Upgrade

The message composer in the Shared Inbox (`message-composer.tsx`) was upgraded to provide a premium WhatsApp Web-like interface and interactive capabilities.

### 🛠️ Changes Implemented

#### 1. Interactive UI Component & Layout
- **[MODIFY] Message Composer Component**: [message-composer.tsx](file:///c:/Users/SUPREME%20COM/Pictures/WaConnect/src/components/inbox/message-composer.tsx)
  - Replaced the basic input area with a WhatsApp Web clone, including emoji popovers, attachment popovers, styling, and animations.
  - Added an inline list of attached files with thumbnail previews and dynamic removal options.
  - Replaced the static send button with a dynamic sender/voice recorder trigger (which shows a microphone when the input is empty and a send arrow when text/media is present).
  - Modified `PopoverTrigger` elements to render directly without `asChild` and nested `<Button>` components to resolve base-ui TypeScript compatibility errors.

#### 2. Advanced Media & Interaction Controls
- **Attachment circular panel**: Added 6 circular attachment buttons:
  - 📄 **Document** (indigo circular icon) — triggers local document file browser.
  - 📷 **Camera** (pink circular icon) — requests microphone/camera capture environment.
  - 🖼️ **Gallery** (purple circular icon) — selects images/videos.
  - 🎧 **Audio** (orange circular icon) — selects pre-recorded audio files.
  - 📍 **Location** (emerald circular icon) — integrates browser geolocation API to share latitude and longitude maps URL, with a fallback to Paris coords.
  - 👤 **Contact** (blue circular icon) — shares a mock contact name and number.
- **Microphone Vocal Recorder**:
  - Seamlessly toggles the composer into "Recording Mode" displaying a flashing indicator, recording duration timer, soundwave pulse animation, a cancel bin button, and a stop/send button.
  - Leverages browser `navigator.mediaDevices.getUserMedia` for real voice recording and falls back gracefully to a silent mock audio simulation if micro permission is blocked or unavailable.

#### 3. Upload & Message Integrations
- **[NEW] Local File Upload Endpoint**: [route.ts](file:///c:/Users/SUPREME%20COM/Pictures/WaConnect/src/app/api/upload/route.ts)
  - Processes file uploads, storing files locally inside `/public/uploads/` and returning `/uploads/<filename>`.
- **[MODIFY] Meta Send API Integration**: [meta-api.ts](file:///c:/Users/SUPREME%20COM/Pictures/WaConnect/src/lib/whatsapp/meta-api.ts)
  - Added `sendMediaMessage` supporting images, videos, audio documents, and locations.
  - Bypasses external APIs if message is tagged as `mock-` token to return successful responses.
- **[MODIFY] Send API Route**: [route.ts](file:///c:/Users/SUPREME%20COM/Pictures/WaConnect/src/app/api/whatsapp/send/route.ts)
  - Handles parsing for incoming media parameters, checking formatting and calling `sendMediaMessage`.
- **[MODIFY] Message Thread Component**: [message-thread.tsx](file:///c:/Users/SUPREME%20COM/Pictures/WaConnect/src/components/inbox/message-thread.tsx)
  - Updated `handleSend` to accept optional `media` payloads.
  - Updated optimistic update state initialization to use `undefined` instead of `null` for `content_text` and `media_url` to match the exact database model types and solve compiler issues.

---

## 🛒 Automatic WhatsApp Order & Catalog Integration

This feature integrates the WhatsApp Cloud API Catalog/Cart checkout webhooks, automatically processing orders in real-time when clients select products and submit cart payloads.

### 🛠️ Changes Implemented

#### 1. Backend Webhook Order Parser & Database Creation
- **[MODIFY] Webhook Receiver Endpoint**: [route.ts](file:///c:/Users/SUPREME%20COM/Pictures/WaConnect/src/app/api/whatsapp/webhook/route.ts)
  - Identifies incoming messages of type `order`.
  - Loops over the items in `message.order.product_items` to retrieve retailer SKUs, quantities, prices, and currencies.
  - Checks if the corresponding product exists in the `products` table. If not, it **automatically creates/inserts the product** in the database.
  - Automatically **inserts a new order** under the `orders` table with a `pending` status and `whatsapp_catalog` payment method, linking it to the client's contact record.
  - Formats and appends a clean user-facing overview in the message body detailing: the list of ordered items, prices, quantities, and the order's grand total.

#### 2. Test Suite
- **[MODIFY] Integration Test Suite**: [webhook-ai.test.ts](file:///c:/Users/SUPREME%20COM/Pictures/WaConnect/src/app/api/whatsapp/webhook/webhook-ai.test.ts)
  - Added the `"automatically parses cart orders and inserts them into the DB"` test case which seeds a simulated WhatsApp order webhook payload, processes it, and asserts that the product, order, and formatted thread message are inserted into the database accurately.

### 🧪 Verification & Type Safety
- **Zero compiler errors**: Running `npm run typecheck` completes cleanly with no warnings or errors.
- **All tests passing**: Running `npm run test` executes successfully, with 114/114 test cases passing (including the new webhook order tracking verification).

---

## 🛒 Liaison Sales Pipeline (Deals) & Suivi de Commandes (Orders)

Cette fonctionnalité permet de connecter le flux de vente (opportunités/deals) et le suivi des commandes physiques (orders).

### 🛠️ Modifications Implémentées

#### 1. Modèles de données & Base de données fictive
- **[MODIFY] Types du projet**: [index.ts](file:///d:/Application/WaPulse/src/types/index.ts)
  - Ajout de `order_id` (UUID) et de la relation facultative `order` dans l'interface `Deal`.
  - Mise à jour de `OrderItem` pour rendre `product_id` optionnel/nullable et ajouter le champ `name` pour soutenir les articles personnalisés sans produit catalogue lié.
- **[MODIFY] Enrichissement Mock DB**: [mock-db-server.ts](file:///d:/Application/WaPulse/src/lib/supabase/mock-db-server.ts)
  - Enrichissement automatique de la relation `deal.order` via `enrichRecord` pour la table `deals`.
- **[NEW] Fichier de Migration**: [011_deals_order_link.sql](file:///d:/Application/WaPulse/supabase/migrations/011_deals_order_link.sql)
  - Migration SQL ajoutant la colonne `order_id` référençant `orders(id) ON DELETE SET NULL` sur la table `deals`.

#### 2. Expérience Utilisateur (UI/UX)
- **[MODIFY] Modale de Deal (DealForm)**: [deal-form.tsx](file:///d:/Application/WaPulse/src/components/pipelines/deal-form.tsx)
  - Lors du clic sur **Mark as Won**, l'agent se voit proposer un panneau de configuration de commande.
  - Possibilité de lier un produit existant du catalogue (calcul automatique de la quantité pour correspondre au montant) ou de créer un article générique reprenant le titre et la valeur du deal.
  - Permet de choisir le moyen de paiement (Carte, Mobile Money, Espèces) et le statut initial de la commande.
  - Si une commande est déjà associée, un lien direct vers la page des commandes s'affiche à côté du statut.
  - La réouverture du deal remet à blanc le lien de commande pour maintenir la cohérence opérationnelle.
- **[MODIFY] Liste Kanban (DealCard)**: [deal-card.tsx](file:///d:/Application/WaPulse/src/components/pipelines/deal-card.tsx)
  - Affiche un badge discret de couleur émeraude avec une icône de caddie 🛒 et le texte "Commande" sur la carte de deal si celui-ci a une commande liée.
- **[MODIFY] Page de Commandes (OrdersPage)**: [page.tsx](file:///d:/Application/WaPulse/src/app/(dashboard)/dashboard/orders/page.tsx)
  - Affiche le nom personnalisé (`item.name`) dans les détails de commande si aucun produit catalogue n'est attaché.
  - Correction d'un problème de typage lors de l'édition d'une commande grâce à un fallback sur le mode de paiement.
- **Centralisation et Limitation des Devises** :
  - **[deal-form.tsx](file:///d:/Application/WaPulse/src/components/pipelines/deal-form.tsx)** & **[products/page.tsx](file:///d:/Application/WaPulse/src/app/(dashboard)/dashboard/products/page.tsx)** : Retrait complet des sélecteurs de devise dans les formulaires d'opportunités (deals) et de produits. La devise de création/modification est maintenant verrouillée de manière transparente sur la devise système globale. Le préfixe de la devise active affiche `"XOF"` au lieu de `"CFA"`.
  - **[currency.ts](file:///d:/Application/WaPulse/src/lib/currency.ts)** : Limitation des devises de l'application à 3 devises seulement : `XOF`, `USD`, et `EUR` (retrait de la devise `GBP`).
  - **[use-currency.tsx](file:///d:/Application/WaPulse/src/hooks/use-currency.tsx)** : Formatage dynamique des montants `XOF` sous la forme `"X XOF"` (ex: `2 951 807 XOF`) pour remplacer l'intitulé navigateur `F CFA` ou `FCFA` dans toute l'application.
  - **[header.tsx](file:///d:/Application/WaPulse/src/components/layout/header.tsx)** : Mise à jour du menu de l'en-tête pour renommer l'option `"FCFA (XOF)"` en `"XOF"` et supprimer l'option GBP.
- **[MODIFY] Requête et déplacement de pipeline**: [page.tsx](file:///d:/Application/WaPulse/src/app/(dashboard)/pipelines/page.tsx)
  - Ajout de la relation `order:orders(*)` au sélecteur de requête dans `loadDeals` pour charger les commandes liées en temps réel.
  - Réouverture automatique des opportunités (statut repasse à `open` et lien `order_id` supprimé) lorsqu'un deal ayant le statut "Won" ou "Lost" est déplacé par glisser-déposer (drag-and-drop) vers une autre étape.
- **[MODIFY] Refactoring de la Vue de Détail de Contact**: [contact-detail-view.tsx](file:///d:/Application/WaPulse/src/components/contacts/contact-detail-view.tsx)
  - Remplacement de la mise en forme de devise brute `Intl.NumberFormat` par l'utilisation centralisée du hook `useCurrency`. Cela garantit que tous les montants saisis ou visualisés en `XOF` s'affichent correctement sous la forme `"X XOF"` à la place du format natif `"F CFA"`.
- **[MODIFY] Nettoyage des commentaires**: [currency.ts](file:///d:/Application/WaPulse/src/lib/currency.ts)
  - Retrait de la référence résiduelle à `"FCFA"` dans la documentation interne.

### 🧪 Tests & Vérification de Type
- **Aucune erreur de compilation** : L'exécution de `npm run typecheck` se termine avec succès.
- **Vérification de la mise en cache** : Après ces corrections, veillez à recharger l'application ou vider le cache du navigateur si des données d'affichage obsolètes (comme `F CFA` dans le tableau de bord ou la pipeline) persistent. La logique de formatage côté client a été entièrement corrigée pour renvoyer uniquement `"XOF"`.

---

## 🌓 Mode Sombre / Mode Clair (Theme Switcher)

Cette fonctionnalité apporte le support complet des modes clair et sombre à travers toute l'application. Elle permet d'adapter l'interface pour plus de lisibilité en plein jour tout en préservant le confort du mode sombre historique.

### 🛠️ Modifications Implémentées

#### 1. Gestion d'État et Persistance
- **[NEW] Hook & Context de Thème**: [use-theme.tsx](file:///d:/Application/WaPulse/src/hooks/use-theme.tsx)
  - Gère l'état actif (`light` | `dark`) et sa persistance locale dans `localStorage` sous la clé `wapulse_theme`.
  - Effectue la synchronisation de la classe `.dark` sur `document.documentElement` pour piloter Tailwind.
- **[MODIFY] Intégration Layout**: [layout.tsx](file:///d:/Application/WaPulse/src/app/layout.tsx)
  - Enveloppement de l'application sous le `ThemeProvider`.
  - Injection d'un script bloquant en ligne tout en haut de la balise `<body>` pour appliquer la classe de thème avant le rendu HTML de React, évitant ainsi le clignotement blanc/noir indésirable (flash de chargement).

#### 2. Système de Couleurs & Design Tokens
- **[MODIFY] Surcharges CSS variables**: [globals.css](file:///d:/Application/WaPulse/src/app/globals.css)
  - Liaison des classes de couleurs de slate standard (`slate-50` jusqu'à `slate-950` et `slate-955` pour la compatibilité) et de `white` à des variables CSS dynamiques dans le bloc `@theme`.
  - Définition d'un thème clair par défaut dans `:root` où les slates sombres deviennent des blancs/gris clairs et inversement.
  - Définition du thème sombre sous `.dark` rétablissant la palette sombre originelle.
  - Ajout de règles d'exception CSS ciblées pour conserver le texte blanc sur les boutons d'action de couleur (ex. boutons violets, rouges, verts de type `bg-violet-600`) et forcer une apparence lisible sur les menus déroulants natifs `select`.

#### 3. Composants et Intégration UI
- **[MODIFY] En-tête de l'application**: [header.tsx](file:///d:/Application/WaPulse/src/components/layout/header.tsx)
  - Import du hook `useTheme` et ajout d'un bouton à bascule interactif Sun ☀️ / Moon 🌙 juste à gauche du sélecteur de devise.
  - La couleur de l'icône s'adapte automatiquement au thème en cours de manière fluide.

### 🧪 Tests & Validation
- **Compilation validée** : L'exécution de `tsc --noEmit` via `npm run typecheck` est un succès.
- **Micro-animations** : Les transitions de hover et les icônes réagissent de façon fluide lors du changement de thème.



