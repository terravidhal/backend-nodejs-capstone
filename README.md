## SecondChance – Application Full‑Stack (Frontend React + Backend Node.js)

### Aperçu
SecondChance est une application web permettant de publier et rechercher des objets d’occasion (meubles, matériel, etc.).
- Backend: Node.js/Express + MongoDB
- Frontend: React (create‑react‑app)
- Journalisation: Pino
- Authentification: JWT
- Import initial des données: seed automatique au démarrage du backend


### Arborescence
- `secondChance-backend/`: API REST (Express) + import Mongo initial + ressources statiques
- `secondChance-frontend/`: SPA React (pages: accueil, items, détail, login/register, profil)
- `sentiment/`: micro‑service Node d’analyse de sentiment (facultatif pour ce projet principal)

### Prérequis
- Node.js 18+
- MongoDB accessible via une URI (cloud ou locale)
- npm 8+

### Variables d’environnement (Backend)
Créer un fichier `.env` dans `secondChance-backend/` avec au minimum:
```
MONGO_URL=<votre_uri_mongodb>
JWT_SECRET=<votre_secret_jwt>
PORT=3060
```
Notes:
- Le backend écoute par défaut sur le port 3060.
- L’import initial appelle automatiquement `loadData()`: si la collection est vide, les items de démonstration sont insérés.

### Installation et démarrage (local)
1) Backend
```
cd secondChance-backend
npm install
node app.js
```
Le serveur démarre sur `http://localhost:3060`.

2) Frontend
```
cd secondChance-frontend
npm install
npm start
```
L’UI démarre sur `http://localhost:3000` et consomme l’API du backend.

### Endpoints principaux (Backend)
Base URL par défaut: `http://localhost:3060`

- Authentification (`/api/auth`)
  - POST `/register` – inscription
    - body: `{ email, firstName, lastName, password }`
    - réponse: `{ authtoken, email }`
  - POST `/login` – connexion
    - body: `{ email, password }`
    - réponse: `{ authtoken, userName, userEmail }`
  - PUT `/update` – mise à jour du profil
    - headers: `email: <email_utilisateur>`
    - body: `{ name }` (met à jour `firstName`)

- Items (`/api/secondchance/items`)
  - GET `/` – liste des items
  - GET `/:id` – détail d’un item par `id`
  - POST `/` – création d’un item (multipart/form‑data avec image)
    - form‑data: `file` (image), autres champs de l’item
    - Remarques: taille max 5MB, images uniquement; champ enregistré sous `imagePath`
  - PUT `/:id` – mise à jour d’un item
  - DELETE `/:id` – suppression d’un item

- Recherche (`/api/secondchance/search`)
  - Voir `secondChance-backend/routes/searchRoutes.js`

### Exemples rapides (cURL)
- Register
```
curl -X POST http://localhost:3060/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","firstName":"Jane","lastName":"Doe","password":"Passw0rd!"}'
```
- Login
```
curl -X POST http://localhost:3060/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"Passw0rd!"}'
```
- Créer un item avec image
```
curl -X POST http://localhost:3060/api/secondchance/items \
  -H "Accept: application/json" \
  -F file=@./path/to/image.jpg \
  -F name="Bureau" -F description="Bureau en bon état"
```

### Notes de déploiement
- Kubernetes (Frontend): l’URL publique pointe sur l’UI React. Configurer les variables d’environnement du frontend si besoin pour l’URL d’API.
- Code Engine (Backend): exposer le service, définir `MONGO_URL` et `JWT_SECRET` en variables d’environnement. Le seed initial s’exécute à chaque démarrage.

### Développement
- Logs: Pino est utilisé (middleware `pino-http` + logger applicatif)
- Statics: `secondChance-backend/public/` est servi par Express (`/public`)
- Upload d’images: stockées dans `secondChance-backend/public/images`

### Licence
Voir `LICENSE`.
