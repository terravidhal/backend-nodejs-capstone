## SecondChance – Déploiement sur IBM Cloud (compte réel)

Ce guide adapte les étapes  pour un déploiement sur un  compte IBM Cloud. Il couvre:
- IBM Cloud Container Registry (ICR)
- IBM Kubernetes Service (IKS) pour le backend et MongoDB
- IBM Code Engine pour le frontend (optionnel) ou déploiement sur IKS

### 1) Pré‑requis
- Compte IBM Cloud avec accès:
  - Container Registry (ICR)
  - IBM Kubernetes Service (IKS) OU Code Engine
- IBM Cloud CLI + plugins
  - `brew install ibmcloud-cli` (macOS) ou suivez la doc IBM
  - `ibmcloud plugin install container-registry`
  - `ibmcloud plugin install kubernetes-service`
  - `ibmcloud plugin install code-engine` (si usage de Code Engine)
- Accès à un cluster IKS (ou créez‑en un) et `kubectl`
- Docker installé pour builder les images localement

### 2) Connexion IBM Cloud et configuration du registre
```bash
# Login
ibmcloud login -r us-south

# (ou via SSO si besoin)
# ibmcloud login --sso -r us-south

# Créer un namespace ICR (une fois)
ibmcloud cr namespace-add <your-namespace>

# Vérifier
ibmcloud cr namespaces
```

Définissez une variable d’environnement locale:
```bash
export MY_NAMESPACE=<your-namespace>
```

### 3) Préparer les images Docker
Depuis la racine du repo, construisez les images pour le backend et (optionnellement) le frontend serveur statique.

#### 3.1 Backend (secondChance-backend)
```bash
cd secondChance-backend

# Créez le .env pour PROD
cat > .env << 'EOF'
MONGO_URL=mongodb://mongodb-service:27017
JWT_SECRET=<set_a_strong_secret>
PORT=3060
EOF

# Construire l'image
docker build -t us.icr.io/$MY_NAMESPACE/secondchanceapp:latest .

# Push dans ICR
ibmcloud cr login
docker push us.icr.io/$MY_NAMESPACE/secondchanceapp:latest
```

#### 3.2 Frontend (option Code Engine ou IKS)
Si vous utilisez Code Engine pour le frontend, préparez une petite app Node statique (comme dans le labo) ou servez le build via un conteneur NGINX.

Exemple (serveur Node simple dans dossier `secondchancewebsite`):
```bash
# Exemple: serveur statique Node (adapté depuis le labo)
mkdir -p secondchancewebsite && cd secondchancewebsite
cat > package.json << 'EOF'
{
  "name": "secondchancewebsite",
  "version": "1.0.0",
  "main": "index.js",
  "license": "MIT",
  "scripts": {"start": "node index.js"},
  "dependencies": {"express": "^4.18.2", "path": "^0.12.7"}
}
EOF
cat > index.js << 'EOF'
const express = require('express');
const path = require('path');
const app = express();
app.use(express.static(path.join(__dirname, 'build')));
app.get('/', (req,res) => res.sendFile(path.join(__dirname, 'build', 'index.html')));
app.get('/app', (req,res) => res.sendFile(path.join(__dirname, 'build', 'index.html')));
app.listen(9000);
EOF

# Copier le build React dans build/
# Dans un autre terminal
# cd secondChance-frontend && npm ci && npm run build
# cp -r secondChance-frontend/build secondchancewebsite/

# Dockerfile
cat > Dockerfile << 'EOF'
FROM node:18.12.1-bullseye-slim
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 9000
CMD ["node", "index.js"]
EOF

# Build & push
docker build -t us.icr.io/$MY_NAMESPACE/secondchancewebsite:latest .
docker push us.icr.io/$MY_NAMESPACE/secondchancewebsite:latest
```

### 4) Déployer MongoDB sur IKS
Créez `deploymongo.yml`:
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: mongodb-deployment
spec:
  replicas: 1
  selector:
    matchLabels:
      app: mongodb
  template:
    metadata:
      labels:
        app: mongodb
    spec:
      containers:
        - name: mongodb
          image: mongo:latest
          ports:
            - containerPort: 27017
---
apiVersion: v1
kind: Service
metadata:
  name: mongodb-service
spec:
  type: ClusterIP
  ports:
    - port: 27017
      targetPort: 27017
  selector:
    app: mongodb
```
Appliquez:
```bash
kubectl apply -f deploymongo.yml
kubectl get pods,svc
```

### 5) Déployer le backend sur IKS
Créez `deployment-backend.yml`:
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: secondchance-backend
  labels:
    app: secondchance-backend
spec:
  replicas: 2
  selector:
    matchLabels:
      app: secondchance-backend
  template:
    metadata:
      labels:
        app: secondchance-backend
    spec:
      containers:
        - name: backend
          image: us.icr.io/<your-namespace>/secondchanceapp:latest
          imagePullPolicy: Always
          env:
            - name: MONGO_URL
              value: mongodb://mongodb-service:27017
            - name: JWT_SECRET
              valueFrom:
                secretKeyRef:
                  name: secondchance-secrets
                  key: jwt_secret
            - name: PORT
              value: "3060"
          ports:
            - containerPort: 3060
---
apiVersion: v1
kind: Service
metadata:
  name: secondchance-backend-svc
spec:
  type: NodePort
  selector:
    app: secondchance-backend
  ports:
    - name: http
      port: 80
      targetPort: 3060
```
Créez un Secret pour le JWT:
```bash
echo -n '<set_a_strong_secret>' | base64  # pour info
kubectl create secret generic secondchance-secrets \
  --from-literal=jwt_secret='<set_a_strong_secret>'

kubectl apply -f deployment-backend.yml
kubectl get pods,svc
```

Option: configurez un Ingress si votre cluster a un Ingress Controller. Sinon, utilisez le `NodePort` exposé par `secondchance-backend-svc`.

### 6) Déployer le frontend
Deux options:

#### Option A – Code Engine (recommandé pour frontend)
```bash
# Créer un projet (une seule fois)
ibmcloud ce project create --name secondchance --region us-south
ibmcloud ce project select --name secondchance

# Déployer l’application frontend
ibmcloud ce application create \
  --name secondchancewebsite \
  --image us.icr.io/$MY_NAMESPACE/secondchancewebsite:latest \
  --registry-secret icr-secret \
  --port 9000

# Récupérer l’URL publique
ibmcloud ce application get --name secondchancewebsite
```
Configurez dans le frontend l’URL du backend (variable `REACT_APP_BACKEND_URL`) avant de builder, ou utilisez une page de configuration.

#### Option B – IKS
Exposez le frontend via un Service + Ingress (similaire au backend). Assurez‐vous que l’UI pointe vers l’URL publique du backend (Ingress ou NodePort).

### 7) Variables d’environnement & configuration
- Backend (`secondChance-backend/.env` pour local; via `env`/`Secret` en cluster):
  - `MONGO_URL=mongodb://mongodb-service:27017`
  - `JWT_SECRET=<secret>`
  - `PORT=3060`
- Frontend: `REACT_APP_BACKEND_URL` (si nécessaire) avant `npm run build`.

### 8) Vérifications & tests
- Backend: `curl http://<EXTERNAL_URL>/api/secondchance/items`
- Auth:
```bash
curl -X POST http://<EXTERNAL_URL>/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","firstName":"Jane","lastName":"Doe","password":"Passw0rd!"}'
```
- Frontend: ouvrez l’URL Code Engine/Ingress.

### 9) Dépannage (FAQ)
- Pods en CrashLoopBackOff: `kubectl logs <pod>`
- 500 sur POST /items avec fichier: vérifiez le `content-type: multipart/form-data`, la taille (<5MB) et le champ `file`.
- Backend ne voit pas Mongo: vérifier `MONGO_URL` et que `mongodb-service` répond (`kubectl get svc`).
- 401/403: vérifier `JWT_SECRET` identique entre build et runtime.
- Images non tirées: vérifier `ibmcloud cr login` et les droits d’accès du cluster à ICR (imagePullSecret si nécessaire).

### 10) Sécurité & bonnes pratiques
- Utiliser des `Secrets` Kubernetes pour les secrets (JWT, credentials DB)
- Versionner les images (`:v1`, `:v2`) au lieu de `latest`
- Activer l’auto‑scaling si nécessaire (HPA sur IKS; autoscale sur Code Engine)
- Journaliser via Pino; agréger avec LogDNA/Monitoring si disponible

---
Avec ces étapes, vous pouvez deployer sur un compte IBM Cloud en production, avec ICR + IKS pour le backend/MongoDB et Code Engine (ou IKS) pour le frontend. Bonne mise en prod ! 
