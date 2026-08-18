# Suivi Patients HDJ

Application web (PWA) de suivi de patients en hôpital de jour, pour kinésithérapeute.
Toutes les données restent **exclusivement sur l'iPhone** (IndexedDB) : aucun serveur,
aucune synchronisation, aucun partage. Le fichier est simplement servi en https:// car
c'est une exigence technique de Safari/iOS pour qu'IndexedDB fonctionne de façon fiable —
aucune donnée patient ne transite par ce serveur.

## Fonctionnalités

- Verrouillage par code PIN, avec verrouillage automatique après inactivité (réglable).
- Liste des patients : recherche par nom, tri par date d'admission ou par nom.
- Fiche patient : identification, antécédents médicaux/chirurgicaux, fragilités
  (dénutrition, risque de chute, troubles cognitifs, autonomie, autres), objectifs de
  rééducation, notes de suivi horodatées.
- Ajout, modification, suppression **définitive** (pas d'archivage).
- Export / import manuel d'une sauvegarde au format JSON (jamais automatique, jamais
  envoyé où que ce soit).
- Fonctionne hors-ligne une fois installée sur l'écran d'accueil (service worker).

## 1. Tester en local sur ce PC (optionnel)

Un petit serveur de test est fourni (`serve.ps1`, sans dépendance).

```bash
powershell -ExecutionPolicy Bypass -File serve.ps1
```

Puis ouvrez `http://localhost:8787` dans un navigateur. Ceci sert uniquement à
vérifier l'app avant de la mettre en ligne — ce n'est pas accessible depuis
votre iPhone (sauf si le PC et l'iPhone sont sur le même réseau, ce qui reste en http,
insuffisant pour un usage réel avec IndexedDB sur iOS).

## 2. Mettre en ligne en https:// (nécessaire pour l'iPhone)

L'option la plus simple et gratuite est **GitHub Pages**. Le dépôt ne contient que le
code de l'application (HTML/CSS/JS) — aucune donnée patient n'y est jamais stockée,
donc un dépôt public ne pose pas de problème de confidentialité.

Depuis ce dossier (`patients-hdj-app`) :

```bash
git init
git add .
git commit -m "Version initiale de l'app de suivi patients HDJ"
```

Créez ensuite un dépôt vide sur GitHub (ex. `suivi-patients-hdj`), puis :

```bash
git remote add origin https://github.com/<votre-utilisateur>/suivi-patients-hdj.git
git branch -M main
git push -u origin main
```

Sur GitHub : **Settings → Pages → Source : branche `main`, dossier `/ (root)`**.
Au bout de quelques minutes, l'app est accessible à une adresse du type :

```
https://<votre-utilisateur>.github.io/suivi-patients-hdj/
```

*Alternative sans ligne de commande :* déposer le contenu de ce dossier par
glisser-déposer sur [Netlify Drop](https://app.netlify.com/drop), qui fournit
immédiatement une adresse https:// (pas besoin de compte GitHub).

## 3. Installer sur l'écran d'accueil de l'iPhone

1. Ouvrir l'adresse https:// de l'app dans **Safari** sur l'iPhone.
2. Créer le code PIN au premier lancement.
3. Appuyer sur le bouton **Partager** (icône carrée avec flèche vers le haut).
4. Choisir **Sur l'écran d'accueil**.
5. L'app apparaît alors comme une icône normale, en plein écran, sans barre Safari.

## 4. Sauvegardes

Dans **Réglages ⚙️ → Sauvegarde**, le bouton *Exporter une sauvegarde* télécharge un
fichier `.json` contenant toutes les fiches patients. À faire par exemple avant de
changer de téléphone, puis *Importer une sauvegarde* sur le nouvel appareil (cela
remplace les données existantes, une confirmation est demandée).

Conservez ce fichier de sauvegarde en lieu sûr (il contient des données de santé) :
ne pas l'envoyer par email non chiffré, ne pas le stocker sur un cloud public.

## 5. Mettre à jour l'app plus tard

Modifiez les fichiers, recommitez et repoussez (`git add . && git commit -m "..." && git push`) :
GitHub Pages republie automatiquement. Sur l'iPhone, l'app se met à jour toute seule au
prochain lancement avec connexion (le service worker recharge les fichiers modifiés).

## Structure du projet

```
patients-hdj-app/
├── index.html          Structure des écrans (verrouillage, liste, fiche, réglages)
├── css/style.css        Style mobile-first
├── js/db.js              Accès IndexedDB (patients, PIN, réglages)
├── js/crypto-utils.js    Hachage du code PIN (PBKDF2 / SubtleCrypto)
├── js/lock.js            Verrouillage / déverrouillage / inactivité
├── js/app.js             Logique applicative et interface
├── manifest.webmanifest  Métadonnées PWA (nom, icônes, couleurs)
├── sw.js                 Service worker (fonctionnement hors-ligne)
├── icons/                Icônes de l'app
└── serve.ps1             Serveur de test local (optionnel)
```
