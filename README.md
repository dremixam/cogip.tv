# COGIP.TV

Site de la communauté COGIP — met en avant les streamers, affiche leurs streams en direct et leurs réseaux sociaux.

## Architecture

```
index.html                  ← Page principale
style.css                   ← Styles (thème rétro gaming)
app.js                      ← Logique front-end
live-status.json            ← Statut des streams (mis à jour automatiquement)
scripts/
  update_live_status.py     ← Script Python qui interroge l'API Twitch
.github/
  workflows/
    update-live-status.yml  ← GitHub Action (toutes les 5 min)
```

## Fonctionnement

1. **`app.js`** récupère les profils depuis `https://linkstack.cogip.tv/api/profiles`.
2. Il lit `live-status.json` pour savoir qui est en stream.
3. Les streamers en direct sont affichés en premier avec l'embed Twitch intégré.
4. Les autres streamers apparaissent en dessous dans un ordre **aléatoire** à chaque chargement.

`live-status.json` est régénéré toutes les 5 minutes par la GitHub Action `update-live-status`, qui appelle l'API Helix de Twitch puis commit le fichier mis à jour.

## Mise en place

### 1. Créer une application Twitch

1. Connecte-toi sur <https://dev.twitch.tv/console>
2. **Enregistrer une application** → nom libre, URL de redirection `http://localhost`, catégorie *Website Integration*
3. Note le **Client ID** et génère un **Client Secret**

### 2. Ajouter les secrets GitHub

Dans le dépôt → *Settings → Secrets and variables → Actions → New repository secret* :

| Nom                    | Valeur                       |
|------------------------|------------------------------|
| `TWITCH_CLIENT_ID`     | Client ID de ton application |
| `TWITCH_CLIENT_SECRET` | Client Secret                |

### 3. Activer GitHub Pages

Dans *Settings → Pages* :
- Source : **Deploy from a branch**
- Branche : `main` / `(root)`

Le site sera accessible sur `https://<compte>.github.io/<repo>/`.

> Pour un domaine personnalisé (ex. `cogip.tv`), ajoute un fichier `CNAME` contenant le domaine à la racine du repo et configure ton DNS en conséquence.

### 4. Tester en local

```bash
python3 -m http.server 8080
# puis ouvre http://localhost:8080
```

L'embed Twitch détecte automatiquement `localhost` comme `parent`.

