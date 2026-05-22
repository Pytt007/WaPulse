# Plan d'implémentation : Traitement Automatique des Commandes WhatsApp

Ce plan décrit les modifications nécessaires pour intégrer de manière automatique les commandes passées par vos clients depuis votre catalogue WhatsApp Business dans l'onglet **Suivi des Commandes** de WaConnect.

## User Review Required

> [!IMPORTANT]
> - **Création automatique des produits** : Si un client passe commande pour un produit avec un identifiant (SKU) qui n'existe pas encore dans la base de données WaConnect, le webhook créera automatiquement un produit fictif/temporaire actif. Cela évite les erreurs d'intégrité de la base de données.
> - **Affichage dans le fil de discussion** : Le message de type `order` sera traduit dans le chat de discussion sous forme d'un récapitulatif textuel lisible (ex: "🛒 *Nouvelle commande reçue : ...*"), afin que l'agent de support puisse voir le détail directement dans la boîte de réception.
> - **Statut initial** : Toute commande reçue via le catalogue WhatsApp sera initialement créée avec le statut `pending` (En Attente) et la méthode de paiement `whatsapp_catalog`.

---

## Proposed Changes

### 1. Types de données WhatsApp

#### [MODIFY] [index.ts](file:///c:/Users/SUPREME COM/Pictures/WaConnect/src/types/index.ts)
* Mettre à jour l'interface `WhatsAppMessage` pour ajouter le champ facultatif `order` reçu de l'API Meta Cloud :
  ```typescript
  export interface WhatsAppMessage {
    // ... champs existants ...
    order?: {
      catalog_id: string;
      text?: string;
      product_items: Array<{
        product_retailer_id: string;
        quantity: string | number;
        item_price: string | number;
        currency: string;
      }>;
    };
  }
  ```

---

### 2. Gestionnaire Webhook WhatsApp

#### [MODIFY] [route.ts](file:///c:/Users/SUPREME COM/Pictures/WaConnect/src/app/api/whatsapp/webhook/route.ts)

* **Analyseur de message (`parseMessageContent`)** :
  * Ajouter un `case 'order':` qui lit le contenu du panier envoyé par le client (`message.order`).
  * Construire un texte récapitulatif formaté contenant la liste des articles, leurs quantités, les prix unitaires et le montant total calculé.
  * Retourner ce texte récapitulatif pour qu'il soit inséré dans la table `messages` et affiché dans le chat.

* **Traitement de la commande (`processMessage`)** :
  * Intercepter si `message.type === 'order'`.
  * Extraire les articles du panier (`message.order.product_items`).
  * Récupérer les produits existants dans la table `products` pour le compte de l'utilisateur (`user_id`).
  * Pour chaque article du panier :
    * Rechercher un produit existant ayant un `sku` correspondant (insensible à la casse) à `product_retailer_id`.
    * Si le produit n'existe pas, l'insérer automatiquement dans la table `products` (avec `sku`, `name: "Produit (SKU: ...)"`, `price`, `currency` et `active: true`) afin d'obtenir un ID valide.
  * Calculer le montant total cumulé de la commande.
  * Insérer la commande dans la table `orders` avec :
    * `contact_id` du client
    * `user_id` de l'utilisateur CRM
    * `total_amount` calculé
    * `currency` de la commande
    * `status`: `'pending'`
    * `payment_method`: `'whatsapp_catalog'`
    * `items` : tableau JSON associant les ID de produits, les quantités et les prix unitaires.

---

## Verification Plan

### Automated Tests
* Lancer la suite de tests vitest pour s'assurer que le webhook continue de fonctionner parfaitement sans régression sur les messages texte, réactions et médias existants :
  `npm run test`
* Ajouter un test unitaire ou d'intégration dans `route.ts` (ou tester le flux de webhook) pour valider l'insertion des commandes et la création automatique des produits.

### Manual Verification
* Envoyer une requête HTTP POST simulant un webhook Meta avec un payload de type `order`.
* Vérifier que :
  1. Le message apparaît dans l'inbox sous forme de texte récapitulant le panier.
  2. Le produit s'est créé automatiquement dans la table `products` s'il n'existait pas.
  3. Une commande a été créée dans la table `orders` et apparaît en temps réel dans l'onglet **Suivi des Commandes** ([/dashboard/orders](file:///c:/Users/SUPREME%20COM/Pictures/WaConnect/src/app/%28dashboard%29/dashboard/orders/page.tsx)) avec le statut "En Attente" et le bon montant calculé.
