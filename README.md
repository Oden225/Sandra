# Calculette de Sandra

Petite application (PWA) pour la facturation de la clinique : à partir du montant d'un acte
et du taux de prise en charge, elle calcule la **part de l'assurance** et la **part de l'adhérent**, en FCFA.

- **Calcul** : choisir l'assurance (le taux se remplit tout seul, modifiable au cas par cas), saisir le montant, lire les deux parts.
- **Historique** : chaque calcul enregistré est rangé par jour, avec les totaux du jour et le détail par assurance.
- **Assurances** : la liste des assurances de la clinique avec leur taux habituel.

Les données restent dans le téléphone (stockage local du navigateur). L'application marche sans internet une fois ouverte une première fois.

La part assurance est arrondie au franc et la part adhérent est le reste, donc les deux parts font toujours le montant exact.

## Fichiers

| Fichier | Rôle |
|---|---|
| `index.html` | Les trois écrans |
| `style.css` | Mise en page, thème clair et sombre |
| `app.js` | Calculs, historique, assurances, installation |
| `sw.js` | Service worker (fonctionnement hors ligne) |
| `manifest.webmanifest` | Nom, icônes et couleurs de l'application installée |
| `icons/` | Icônes de l'application |

## Mise en ligne avec GitHub Pages

1. Sur GitHub : **Settings → Pages**.
2. *Source* : **Deploy from a branch**, choisir la branche (par exemple `main`) et le dossier `/ (root)`, puis **Save**.
3. Après une minute, l'appli est disponible sur `https://oden225.github.io/sandra/`.

## Installer sur le téléphone

- **Android (Chrome)** : ouvrir l'adresse, puis appuyer sur « Installer l'appli » en haut, ou menu ⋮ → « Installer l'application ».
- **iPhone (Safari)** : bouton Partager → « Sur l'écran d'accueil ».

## Mettre à jour l'application

Après avoir modifié un fichier, changer `VERSION` dans `sw.js` (par exemple `v1` → `v2`) pour que les téléphones récupèrent la nouvelle version.

## Tester en local

```sh
python3 -m http.server 8000
```

puis ouvrir http://localhost:8000.
