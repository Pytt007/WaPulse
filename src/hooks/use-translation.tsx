"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";

type Language = "fr" | "en";

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (text: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const localTranslations: Record<Language, Record<string, string>> = {
  fr: {
    "dashboard": "Tableau de bord",
    "inbox": "Boîte de réception",
    "contacts": "Contacts",
    "pipelines": "Pipelines",
    "broadcasts": "Diffusions",
    "automations": "Automatisations",
    "settings": "Paramètres",
    "profile": "Profil",
    "sign out": "Se déconnecter",
    "open": "Ouvert",
    "closed": "Fermé",
    "active conversations": "Conversations actives",
    "new contacts today": "Nouveaux contacts aujourd'hui",
    "new contacts this week": "Nouveaux contacts cette semaine",
    "new contacts this month": "Nouveaux contacts ce mois-ci",
    "open deals value": "Valeur des opportunités ouvertes",
    "messages sent today": "Messages envoyés aujourd'hui",
    "messages sent this week": "Messages envoyés cette semaine",
    "messages sent this month": "Messages envoyés ce mois-ci",
    "live analytics across conversations, contacts, deals, broadcasts, and automations.": "Analyses en temps réel des conversations, contacts, opportunités, diffusions et automatisations.",
    "quick actions": "Actions rapides",
    "conversations chart": "Graphique des conversations",
    "response time": "Temps de réponse",
    "activity feed": "Fil d'activité",
    "product catalog": "Catalogue de produits",
    "order tracking": "Suivi des commandes",
    "new today vs yesterday": "nouveaux aujourd'hui vs hier",
    "new this week vs last week": "nouveaux cette semaine vs la semaine dernière",
    "new this month vs last month": "nouveaux ce mois-ci vs le mois dernier",
    "vs yesterday": "vs hier",
    "vs last week": "vs la semaine dernière",
    "vs last month": "vs le mois dernier",
    "période :": "Période :",
    "jour": "Jour",
    "semaine": "Semaine",
    "mois": "Mois",
    "open deal": "opportunité ouverte",
    "open deals": "opportunités ouvertes",
    "no change": "aucun changement",
    "search...": "Rechercher...",
    "new product": "Nouveau produit",
    "new order": "Nouvelle commande",
    "status": "Statut",
    "price": "Prix",
    "description": "Description",
    "name": "Nom",
    "actions": "Actions",
    "add": "Ajouter",
    "edit": "Modifier",
    "delete": "Supprimer",
    "cancel": "Annuler",
    "save": "Enregistrer",
    "loading...": "Chargement...",
    "currency": "Devise",
    "active": "Actif",
    "inactive": "Inactif",
    "filter by": "Filtrer par",
    "all": "Tous",
    "total": "Total",
    "customer": "Client",
    "date": "Date",
    "details": "Détails",
    "order details": "Détails de la commande",
    "payment method": "Méthode de paiement",
    "activity log": "Historique d'activité",
    "new contacts": "Nouveaux contacts",
    "messages sent": "Messages envoyés",
    "today": "Aujourd'hui",
    "yesterday": "Hier",

    // Settings General
    "manage your profile, whatsapp® integration, message templates, tags, and custom fields.": "Gérez votre profil, l'intégration WhatsApp®, les modèles de messages, les étiquettes et les champs personnalisés.",
    "whatsapp config": "Configuration WhatsApp",
    "templates": "Modèles",
    "tags": "Étiquettes",
    "custom fields": "Champs personnalisés",

    // Profile form
    "how you show up across the app. your avatar and name appear in the header, sidebar, and anywhere your teammates see you.": "Comment vous apparaissez dans l'application. Votre avatar et votre nom s'affichent dans l'en-tête, la barre latérale et partout où vos collaborateurs vous voient.",
    "unsupported image type": "Type d'image non supporté",
    "use png, jpg, webp, or gif.": "Utilisez PNG, JPG, WebP ou GIF.",
    "image is too large": "L'image est trop grande",
    "maximum 2 mb.": "Maximum 2 Mo.",
    "display name is required": "Le nom d'affichage est requis",
    "enter a valid email address": "Entrez une adresse e-mail valide",
    "upload failed": "Échec du téléchargement",
    "save failed": "Échec de l'enregistrement",
    "email change failed": "Échec de la modification de l'e-mail",
    "profile saved": "Profil enregistré",
    "profile saved — check your email to confirm the address change": "Profil enregistré — vérifiez vos e-mails pour confirmer le changement d'adresse",
    "change photo": "Modifier la photo",
    "upload photo": "Télécharger une photo",
    "remove": "Supprimer",
    "png, jpg, webp, or gif. up to 2 mb.": "PNG, JPG, WebP ou GIF. Jusqu'à 2 Mo.",
    "display name": "Nom d'affichage",
    "email": "E-mail",
    "check the inbox for": "Vérifiez la boîte de réception de",
    "and": "et",
    "— both need to confirm before the change takes effect.": "— les deux doivent confirmer avant que le changement ne prenne effet.",
    "account details": "Détails du compte",
    "role": "Rôle",
    "joined": "Rejoint le",
    "user id": "ID Utilisateur",
    "loading your profile…": "Chargement de votre profil…",
    "saving…": "Enregistrement…",
    "save changes": "Enregistrer les modifications",

    // Password form
    "password": "Mot de passe",
    "use at least": "Utilisez au moins",
    "characters. you will stay signed in on this device after changing it.": "caractères. Vous resterez connecté sur cet appareil après l'avoir modifié.",
    "current password": "Mot de passe actuel",
    "new password": "Nouveau mot de passe",
    "confirm new password": "Confirmer le nouveau mot de passe",
    "cannot change password without a current email": "Impossible de modifier le mot de passe sans e-mail actuel",
    "password must be at least": "Le mot de passe doit contenir au moins",
    "characters": "caractères",
    "new password and confirmation do not match": "Le nouveau mot de passe et la confirmation ne correspondent pas",
    "current password is incorrect": "Le mot de passe actuel est incorrect",
    "password update failed": "Échec de la mise à jour du mot de passe",
    "password updated": "Mot de passe mis à jour",
    "updating…": "Mise à jour…",
    "update password": "Modifier le mot de passe",

    // Sessions card
    "active sessions": "Sessions actives",
    "sign out of every device where you're logged in — including this one. useful if you lost a laptop or shared your password.": "Déconnectez-vous de tous les appareils sur lesquels vous êtes connecté — y compris celui-ci. Utile si vous avez perdu un ordinateur ou partagé votre mot de passe.",
    "sign out of all devices": "Se déconnecter de tous les appareils",
    "sign out everywhere?": "Se déconnecter de partout ?",
    "every device logged into this account will be signed out and will need to log in again. you will be redirected to the login page.": "Tous les appareils connectés à ce compte seront déconnectés et devront se reconnecter. Vous serez redirigé vers la page de connexion.",
    "signing out…": "Déconnexion en cours...",
    "sign out everywhere": "Se déconnecter de partout",

    // WhatsApp Config
    "failed to load whatsapp configuration": "Échec du chargement de la configuration WhatsApp",
    "phone number id is required": "L'ID de numéro de téléphone est requis",
    "access token is required for initial setup": "Le jeton d'accès est requis pour la configuration initiale",
    "please re-enter the access token to save changes": "Veuillez saisir à nouveau le jeton d'accès pour enregistrer les modifications",
    "connected to": "Connecté à",
    "configuration saved successfully": "Configuration enregistrée avec succès",
    "failed to save configuration": "Échec de l'enregistrement de la configuration",
    "api connection successful": "Connexion API réussie",
    "api connection failed": "Échec de la connexion API",
    "connection test failed. check network and try again.": "Échec du test de connexion. Vérifiez le réseau et réessayez.",
    "this will delete the current whatsapp config so you can re-enter it. continue?": "Cela supprimera la configuration WhatsApp actuelle afin que vous puissiez la saisir à nouveau. Continuer ?",
    "failed to reset configuration": "Échec de la réinitialisation de la configuration",
    "configuration cleared. you can now re-enter your credentials.": "Configuration effacée. Vous pouvez maintenant saisir à nouveau vos identifiants.",
    "webhook url copied to clipboard": "URL du webhook copiée dans le presse-papiers",
    "stored token can't be decrypted": "Le jeton stocké ne peut pas être décrypté",
    "resetting...": "Réinitialisation...",
    "reset configuration": "Réinitialiser la configuration",
    "connected": "Connecté",
    "not connected": "Non connecté",
    "your whatsapp business api is connected and ready to send/receive messages.": "Votre API WhatsApp Business est connectée et prête à envoyer/recevoir des messages.",
    "configure your meta api credentials below to connect your whatsapp business account.": "Configurez vos identifiants API Meta ci-dessous pour connecter votre compte WhatsApp Business.",
    "api credentials": "Identifiants API",
    "enter your meta whatsapp business api credentials.": "Entrez vos identifiants API WhatsApp Business de Meta.",
    "phone number id": "ID de numéro de téléphone",
    "whatsapp business account id": "ID de compte WhatsApp Business",
    "permanent access token": "Jeton d'accès permanent",
    "enter your access token": "Entrez votre jeton d'accès",
    "token is hidden for security. re-enter it to update configuration.": "Le jeton est masqué pour des raisons de sécurité. Saisissez-le à nouveau pour mettre à jour la configuration.",
    "webhook verify token": "Jeton de vérification du Webhook",
    "create a custom verify token": "Créez un jeton de vérification personnalisé",
    "a custom string you create. must match the token you set in meta webhook settings.": "Une chaîne personnalisée que vous créez. Doit correspondre au jeton défini dans les paramètres du webhook de Meta.",
    "webhook configuration": "Configuration du Webhook",
    "use this url as your webhook callback in the meta app dashboard.": "Utilisez cette URL comme callback de webhook dans le tableau de bord des applications Meta.",
    "webhook callback url": "URL de callback du Webhook",
    "saving...": "Enregistrement en cours...",
    "save configuration": "Enregistrer la configuration",
    "testing...": "Test en cours...",
    "test api connection": "Tester la connexion API",
    "setup instructions": "Instructions de configuration",
    "follow these steps to connect your whatsapp business api.": "Suivez ces étapes pour connecter votre API WhatsApp Business.",
    "create a meta app": "Créer une application Meta",
    "go to": "Allez sur",
    "click \"my apps\" and then \"create app\"": "Cliquez sur \"Mes applications\" puis sur \"Créer une application\"",
    "select \"business\" as the app type": "Sélectionnez \"Entreprise\" comme type d'application",
    "fill in app details and create": "Remplissez les détails de l'application et créez",
    "add whatsapp product": "Ajouter le produit WhatsApp",
    "in your app dashboard, click \"add product\"": "Dans le tableau de bord de votre application, cliquez sur \"Ajouter un produit\"",
    "find \"whatsapp\" and click \"set up\"": "Trouvez \"WhatsApp\" et cliquez sur \"Configurer\"",
    "follow the setup wizard to link your business": "Suivez l'assistant de configuration pour lier votre entreprise",
    "get api credentials": "Obtenir les identifiants API",
    "go to whatsapp > api setup": "Allez dans WhatsApp > Configuration de l'API",
    "copy your": "Copiez votre",
    "generate a": "Générez un",
    "from business settings > system users": "depuis Paramètres de l'entreprise > Utilisateurs système",
    "configure webhooks": "Configurer les Webhooks",
    "go to whatsapp > configuration": "Allez dans WhatsApp > Configuration",
    "click \"edit\" on the webhook section": "Cliquez sur \"Modifier\" dans la section Webhook",
    "paste the": "Collez l'",
    "from above": "ci-dessus",
    "enter the same": "Entrez le même",
    "verify token": "Jeton de vérification",
    "you set here": "que vous avez défini ici",
    "subscribe to \"messages\" webhook field": "Abonnez-vous au champ de webhook \"messages\"",
    "meta whatsapp api documentation": "Documentation de l'API WhatsApp de Meta",

    // Templates Manager
    "message templates": "Modèles de messages",
    "create and manage your whatsapp message templates. meta requires every template to be approved in the whatsapp manager before it can be sent — use \"sync from meta\" to pull your approved list.": "Gérez vos modèles de messages WhatsApp. Meta exige que chaque modèle soit approuvé dans le gestionnaire WhatsApp avant de pouvoir être envoyé — utilisez \"Synchroniser depuis Meta\" pour récupérer votre liste approuvée.",
    "syncing…": "Synchronisation en cours…",
    "sync from meta": "Synchroniser depuis Meta",
    "new template": "Nouveau modèle",
    "no templates yet.": "Aucun modèle pour le moment.",
    "create your first message template to get started.": "Créez votre premier modèle de message pour commencer.",
    "marketing": "Marketing",
    "utility": "Utilitaire",
    "authentication": "Authentification",
    "draft": "Brouillon",
    "pending": "En attente",
    "approved": "Approuvé",
    "rejected": "Rejeté",
    "template deleted": "Modèle supprimé",
    "failed to delete template": "Échec de la suppression du modèle",
    "new message template": "Nouveau modèle de message",
    "create a new whatsapp message template.": "Créez un nouveau modèle de message WhatsApp.",
    "template name": "Nom du modèle",
    "category": "Catégorie",
    "language": "Langue",
    "must match the exact language code the template is approved under on meta — e.g.": "Doit correspondre exactement au code de langue sous lequel le modèle est approuvé sur Meta — ex.",
    "header type": "Type d'en-tête",
    "none": "Aucun",
    "body text": "Texte du corps",
    "enter your template message body. use {{1}}, {{2}} for variables.": "Entrez le corps du message de votre modèle. Utilisez {{1}}, {{2}} pour les variables.",
    "footer text": "Texte de pied de page",
    "optional footer text": "Texte de pied de page optionnel",
    "creating...": "Création en cours...",
    "create template": "Créer le modèle",

    // Tags Manager
    "organize your contacts with color-coded tags.": "Organisez vos contacts avec des étiquettes de couleur.",
    "new tag": "Nouvelle étiquette",
    "no tags yet.": "Aucune étiquette pour le moment.",
    "create tags to categorize your contacts.": "Créez des étiquettes pour catégoriser vos contacts.",
    "tag name": "Nom de l'étiquette",
    "color": "Couleur",
    "preview": "Aperçu",
    "create tag": "Créer l'étiquette",
    "delete tag": "Supprimer l'étiquette",
    "are you sure you want to delete the tag": "Êtes-vous sûr de vouloir supprimer l'étiquette",
    "this will remove it from all contacts. this action cannot be undone.": "Cela la supprimera de tous les contacts. Cette action ne peut pas être annulée.",

    // Custom Fields
    "manage custom fields to qualify your contacts and enrich your crm.": "Gérez les champs personnalisés pour qualifier vos contacts et enrichir votre CRM.",
    "new field": "Nouveau champ",
    "no custom fields yet.": "Aucun champ personnalisé pour le moment.",
    "24-hour session expired. your message will be automatically wrapped in an approved template.": "Session de 24h expirée. Votre message sera automatiquement enveloppé dans un modèle approuvé.",
    "type a message to re-engage...": "Saisissez un message pour réengager...",
    "document": "Document",
    "camera": "Caméra",
    "gallery": "Galerie",
    "audio": "Audio",
    "location": "Localisation",
    "contact": "Contact",
    "cancel recording": "Annuler l'enregistrement",
    "stop recording": "Arrêter l'enregistrement",
    "voice recording": "Enregistrement vocal",
    "click to choose emojis": "Cliquer pour choisir des emojis",
    "click to attach files": "Cliquer pour joindre des fichiers",
    "send message": "Envoyer le message",
    "create fields to store specific information like budget or need.": "Créez des champs pour stocker des informations spécifiques comme le budget ou le besoin.",
    "type:": "Type :",
    "new custom field": "Nouveau champ personnalisé",
    "create a new custom field to qualify your leads.": "Créez un nouveau champ personnalisé pour qualifier vos leads.",
    "field name": "Nom du champ",
    "e.g. budget, need, deadline": "ex. budget, besoin, date limite",
    "create field": "Créer le champ",
    "delete custom field": "Supprimer le champ personnalisé",
    "are you sure you want to delete the custom field": "Êtes-vous sûr de vouloir supprimer le champ personnalisé",
    "this will also delete all associated values from your contacts. this action is irreversible.": "Cela supprimera également toutes les valeurs associées de vos contacts. Cette action est irréversible.",

    // AI Agent Configuration
    "ai agent configuration": "Configuration de l'agent IA",
    "configure the behavior, model, and response rules of your virtual whatsapp agent.": "Configurez le comportement, le modèle et les règles de réponse de votre agent WhatsApp virtuel.",
    "ai agent active": "Agent IA actif",
    "ai disabled": "IA désactivée",
    "general settings": "Paramètres généraux",
    "knowledge base": "Base de connaissances",
    "adjust identity, language model, and creativity parameters.": "Ajustez l'identité, le modèle de langue et les paramètres de créativité.",
    "agent name": "Nom de l'agent",
    "ai sales assistant": "Assistant de vente IA",
    "llm model": "Modèle de LLM",
    "gpt-4o mini (recommended - fast)": "GPT-4o Mini (Recommandé - Rapide)",
    "gpt-4o (creative & accurate)": "GPT-4o (Créatif & Précis)",
    "temperature": "Température",
    "precise vs creative": "Précis vs Créatif",
    "system prompt (instructions)": "Prompt système (Instructions)",
    "ai role": "Rôle de l'IA",
    "you are the virtual sales assistant...": "Vous êtes l'assistant de vente virtuel...",
    "* the product and service catalog is automatically injected into the prompt context so the ai can respond accurately to pricing questions.": "* Le catalogue de produits et services est automatiquement injecté dans le contexte du prompt pour que l'IA puisse répondre précisément aux questions de tarifs.",
    "calendly link (appointment booking)": "Lien Calendly (Prise de rendez-vous)",
    "enable auto replies": "Activer les réponses automatiques",
    "allows the ai to instantly reply to messages received on whatsapp.": "Permet à l'IA de répondre instantanément aux messages reçus sur WhatsApp.",
    "add documents": "Ajouter des documents",
    "enrich your agent's knowledge base for hyper-contextualized answers.": "Enrichissez la base de connaissances de votre agent pour obtenir des réponses hyper-contextualisées.",
    "import a file": "Importer un fichier",
    "drag & drop a .txt or .md file": "Glissez & déposez un fichier .txt ou .md",
    "or click to browse your files": "Ou cliquez pour parcourir vos fichiers",
    "manual entry (faq / instructions)": "Saisie manuelle (FAQ / Instructions)",
    "document title (e.g. return policy)": "Titre du document (ex. Politique de retour)",
    "instructions or faq content...": "Contenu des instructions ou de la FAQ...",
    "add to knowledge": "Ajouter aux connaissances",
    "knowledge documents": "Documents de connaissances",
    "these documents form the active knowledge base queried by rag.": "Ces documents forment la base de connaissances active interrogée par RAG.",
    "no documents in the database": "Aucun document dans la base de données",
    "import a file to start instructing the ai.": "Importez un fichier pour commencer à instruire l'IA.",
    "file": "Fichier",
    "type": "Type",
    "size": "Taille",
    "import date": "Date d'import",
    "test console": "Console de test",
    "simulate a real-time conversation.": "Simulez une conversation en temps réel.",
    "clear": "Effacer",
    "experimentation sandbox": "Bac à sable d'expérimentation",
    "send a message to test the ai agent. for example, ask \"what are your prices?\" or \"how to book an appointment?\".": "Envoyez un message pour tester l'agent IA. Par exemple, demandez \"quels sont vos prix ?\" ou \"comment prendre rendez-vous ?\".",
    "simulation mode active (no api key detected). the ai will respond locally in an intelligent way based on the knowledge base and catalog.": "Mode simulation actif (aucune clé API détectée). L'IA répondra localement de manière intelligente en se basant sur la base de connaissances et le catalogue.",
    "chat with the agent...": "Discuter avec l'agent...",
    "lead qualification (real time)": "Qualification des leads (Temps réel)",
    "contact fields and custom data extracted by ai.": "Champs du contact et données personnalisées extraits par l'IA.",
    "standard profile": "Profil standard",
    "full name": "Nom complet",
    "company": "Entreprise",
    "email address": "Adresse e-mail",
    "unqualified": "Non qualifié",
    "not filled": "Non renseigné",
    "close": "Fermer",
    "import date:": "Date d'import :",

    // Dashboard additional translations
    "new contact": "nouveau contact",
    "new deal": "nouvelle opportunité",
    "new broadcast": "nouvelle diffusion",
    "new automation": "nouvelle automatisation",
    "conversations over time": "Conversations au fil du temps",
    "daily message volume by direction": "Volume de messages quotidien par direction",
    "days": "jours",
    "no message activity in this range": "Aucune activité de message dans cette période",
    "send or receive messages to start populating this chart.": "Envoyez ou recevez des messages pour commencer à remplir ce graphique.",
    "incoming": "Entrant",
    "outgoing": "Sortant",
    "pipeline value": "Valeur du pipeline",
    "open deals by stage": "Opportunités ouvertes par étape",
    "no open deals yet": "Aucune opportunité ouverte pour le moment",
    "create deals in pipelines to see stage breakdowns here.": "Créez des opportunités dans les pipelines pour voir la répartition des étapes ici.",
    "average first response time": "Temps de réponse moyen initial",
    "minutes to reply to a customer's first unreplied message, by weekday": "Minutes pour répondre au premier message non répondu d'un client, par jour de la semaine",
    "this week": "Cette semaine",
    "last week": "Semaine dernière",
    "target": "cible",
    "no replies recorded yet": "Aucune réponse enregistrée pour le moment",
    "this chart fills in as you reply to customer messages.": "Ce graphique se remplit à mesure que vous répondez aux messages des clients.",
    "no samples": "aucun échantillon",
    "min avg": "min en moyenne",
    "sample": "échantillon",
    "samples": "échantillons",
    "recent activity": "Activité récente",
    "view all": "Tout afficher",
    "no activity yet": "Aucune activité pour le moment",
    "activity from messages, deals, broadcasts, and automations will appear here.": "L'activité des messages, opportunités, diffusions et automatisations apparaîtra ici.",
    "showing": "Affichage de",
    "of": "sur",
    "show": "Afficher",
    "s ago": "s",
    "m ago": "m",
    "h ago": "h",
    "d ago": "j",
    "new message from": "Nouveau message de",
    "deal": "Opportunité",
    "deals": "opportunités",
    "in": "dans",
    "updated": "mise à jour",
    "broadcast": "Diffusion",
    "sent to": "envoyée à",
    "recipients": "destinataires",
    "automation": "Automatisation",
    "failed for": "a échoué pour",
    "triggered for": "déclenchée pour",
    "mon": "Lun",
    "tue": "Mar",
    "wed": "Mer",
    "thu": "Jeu",
    "fri": "Ven",
    "sat": "Sam",
    "sun": "Dim",

    // Inbox thread header
    "contact info": "Infos contact",
    "select a conversation": "Sélectionner une conversation",
    "choose a conversation from the left to start messaging": "Choisissez une conversation à gauche pour commencer",
    "no messages yet": "Aucun message pour le moment",
    "send a template to start the conversation": "Envoyez un modèle pour démarrer la conversation",
    "you": "Vous",
    "expired": "Expiré",
    "remaining": "restant",
    "assign": "Assigner",
    "assigned": "Assigné",
    "unassign": "Désassigner",
    "me": "moi",
    "no teammates available": "Aucun coéquipier disponible",
    "wait for the message to finish sending": "Attendez que le message finisse d'être envoyé",
    "reaction failed": "Réaction échouée",
    "failed to update assignment": "Échec de la mise à jour de l'assignation",
    "failed to update ai status": "Échec de la mise à jour du statut IA",
    "ai agent has been paused": "L'agent IA a été mis en pause",
    "ai agent is now active": "L'agent IA est maintenant actif",
    "share a contact": "Partager un contact",
    "search a contact...": "Rechercher un contact...",
    "no contacts found": "Aucun contact trouvé",
  },
  en: {
    "tableau de bord": "Dashboard",
    "boîte de réception": "Inbox",
    "contacts": "Contacts",
    "pipelines": "Pipelines",
    "diffusions": "Broadcasts",
    "automatisations": "Automations",
    "paramètres": "Settings",
    "profil": "Profile",
    "se déconnecter": "Sign out",
    "conversations actives": "Active Conversations",
    "nouveaux contacts aujourd'hui": "New Contacts Today",
    "valeur des opportunités ouvertes": "Open Deals Value",
    "messages envoyés aujourd'hui": "Messages Sent Today",
    "analyses en temps réel des conversations, contacts, opportunités, diffusions et automatisations.": "Live analytics across conversations, contacts, deals, broadcasts, and automations.",
    "actions rapides": "Quick Actions",
    "graphique des conversations": "Conversations Chart",
    "temps de réponse": "Response Time",
    "fil d'activité": "Activity Feed",
    "catalogue de produits": "Product Catalog",
    "suivi des commandes": "Order Tracking",
    "nouveau produit": "New Product",
    "nouvelle commande": "New Order",
    "statut": "Status",
    "prix": "Price",
    "description": "Description",
    "nom": "Name",
    "actions": "Actions",
    "ajouter": "Add",
    "modifier": "Edit",
    "supprimer": "Delete",
    "annuler": "Cancel",
    "enregistrer": "Save",
    "chargement...": "Loading...",
    "devise": "Currency",
    "actif": "Active",
    "inactif": "Inactive",
    "filtrer par": "Filter by",
    "tous": "All",
    "total": "Total",
    "client": "Customer",
    "date": "Date",
    "détails": "Details",
    "détails de la commande": "Order Details",
    "méthode de paiement": "Payment Method",
    "historique d'activité": "Activity Log",
    "nouveaux contacts": "New Contacts",
    "messages envoyés": "Messages Sent",
    "aujourd'hui": "Today",
    "hier": "Yesterday",
    "produits": "Products",
    "commandes": "Orders",
    "agents ia": "AI Agents",
    "ajouter aux connaissances": "Add to Knowledge",

    // English reciprocal keys
    "product catalog": "Product Catalog",
    "order tracking": "Order Tracking",
    "ai agent configuration": "AI Agent Configuration",
    "new contact": "New Contact",
    "new deal": "New Deal",
    "new broadcast": "New Broadcast",
    "new automation": "New Automation",
    "24-hour session expired. your message will be automatically wrapped in an approved template.": "24-hour session expired. Your message will be automatically wrapped in an approved template.",
    "type a message to re-engage...": "Type a message to re-engage...",
    "document": "Document",
    "camera": "Camera",
    "gallery": "Gallery",
    "audio": "Audio",
    "location": "Location",
    "contact": "Contact",
    "cancel recording": "Cancel recording",
    "stop recording": "Stop recording",
    "voice recording": "Voice recording",
    "click to choose emojis": "Click to choose emojis",
    "click to attach files": "Click to attach files",
    "send message": "Send message",
    "conversations over time": "Conversations Over Time",
    "incoming": "Incoming",
    "outgoing": "Outgoing",
    "pipeline value": "Pipeline Value",
    "average first response time": "Average First Response Time",
    "target": "target",
    "no samples": "no samples",
    "min avg": "min avg",
    "sample": "sample",
    "samples": "samples",
    "recent activity": "Recent Activity",
    "view all": "View all",
    "no activity yet": "No activity yet",
    "showing": "Showing",
    "of": "of",
    "show": "Show",
    "s ago": "s ago",
    "m ago": "m ago",
    "h ago": "h ago",
    "d ago": "d ago",
    "new message from": "New message from",
    "deal": "Deal",
    "deals": "Deals",
    "in": "in",
    "updated": "updated",
    "broadcast": "Broadcast",
    "sent to": "sent to",
    "recipients": "recipients",
    "automation": "Automation",
    "failed for": "failed for",
    "triggered for": "triggered for",
    "mon": "Mon",
    "tue": "Tue",
    "wed": "Wed",
    "thu": "Thu",
    "fri": "Fri",
    "sat": "Sat",
    "sun": "Sun",

    // Inbox thread header (English passthrough)
    "contact info": "Contact info",
    "select a conversation": "Select a conversation",
    "choose a conversation from the left to start messaging": "Choose a conversation from the left to start messaging",
    "no messages yet": "No messages yet",
    "send a template to start the conversation": "Send a template to start the conversation",
    "you": "You",
    "expired": "Expired",
    "remaining": "remaining",
    "assign": "Assign",
    "assigned": "Assigned",
    "unassign": "Unassign",
    "me": "me",
    "no teammates available": "No teammates available",
    "wait for the message to finish sending": "Wait for the message to finish sending",
    "reaction failed": "Reaction failed",
    "failed to update assignment": "Failed to update assignment",
    "failed to update ai status": "Failed to update AI status",
    "ai agent has been paused": "AI agent has been paused",
    "ai agent is now active": "AI agent is now active",
    "share a contact": "Share a contact",
    "search a contact...": "Search a contact...",
    "no contacts found": "No contacts found",
  }
};

function matchCasing(original: string, translation: string): string {
  if (!original || !translation) return translation;
  if (original === original.toUpperCase() && original !== original.toLowerCase()) {
    return translation.toUpperCase();
  }
  if (original[0] === original[0].toUpperCase() && original[0] !== original[0].toLowerCase()) {
    return translation.charAt(0).toUpperCase() + translation.slice(1);
  }
  return translation;
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [cache, setCache] = useState<Record<Language, Record<string, string>>>({ fr: {}, en: {} });
  const [language, setLanguageState] = useState<Language>("fr");
  const [mounted, setMounted] = useState(false);
  const pendingRequests = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (typeof window !== "undefined") {
      const storedLang = localStorage.getItem("wapulse_language");
      if (storedLang === "fr" || storedLang === "en") {
        setLanguageState(storedLang as Language);
      }

      const storedCache = localStorage.getItem("wapulse_translations");
      if (storedCache) {
        try {
          const parsed = JSON.parse(storedCache);
          if (parsed && typeof parsed === "object") {
            setCache(parsed);
          }
        } catch (e) {
          console.error("Failed to parse translation cache:", e);
        }
      }

      setMounted(true);
    }
  }, []);

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    if (typeof window !== "undefined") {
      localStorage.setItem("wapulse_language", lang);
    }
  }, []);

  const triggerBackgroundTranslation = useCallback(async (text: string, lang: Language) => {
    const normalized = text.toLowerCase().trim();
    const requestKey = `${lang}:${normalized}`;
    if (pendingRequests.current.has(requestKey)) {
      return;
    }
    pendingRequests.current.add(requestKey);

    try {
      const response = await fetch("/api/translate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text, targetLang: lang }),
      });
      if (response.ok) {
        const data = await response.json() as { translation: string };
        if (data.translation && data.translation !== text) {
          setCache((prev) => {
            const updated = {
              ...prev,
              [lang]: {
                ...prev[lang],
                [normalized]: data.translation,
              },
            };
            if (typeof window !== "undefined") {
              localStorage.setItem("wapulse_translations", JSON.stringify(updated));
            }
            return updated;
          });
        }
      }
    } catch (err) {
      console.error("Failed to translate background text:", text, err);
    } finally {
      pendingRequests.current.delete(requestKey);
    }
  }, []);

  const t = useCallback((text: string): string => {
    if (!text) return "";
    const cleanText = text.trim();
    const normalized = cleanText.toLowerCase();

    // Before mount (SSR / first render), always use 'fr' to match server output
    const activeLang: Language = mounted ? language : "fr";

    // Check if translation is locally hardcoded
    const localTrans = localTranslations[activeLang]?.[normalized];
    if (localTrans) {
      return matchCasing(cleanText, localTrans);
    }

    // Check localStorage cache
    const cachedTrans = cache[activeLang]?.[normalized];
    if (cachedTrans) {
      return matchCasing(cleanText, cachedTrans);
    }

    // In background, fetch the translation (only after mount)
    if (mounted) {
      triggerBackgroundTranslation(cleanText, activeLang);
    }

    return cleanText;
  }, [language, cache, mounted, triggerBackgroundTranslation]);

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useTranslation() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useTranslation must be used within a LanguageProvider");
  }
  return context;
}
