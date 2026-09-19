<div align="center">

**Универзитет „Св. Кирил и Методиј“ во Скопје**
<br>
**Факултет за информатички науки и компјутерско инженерство**

Предмет: *Континуирана интеграција и испорака*
<br> Елаборат за проектна задача

## CI/CD Pipeline и Kubernetes оркестрација на SafeChain MK

Студент: **Тамара Стојаноска**, бр. на индекс **231030**
<br> Професор: проф. д-р Панче Рибарски
<br> Асистенти: Стефан Андонов, Дарко Сасански, Димитар Милески

</div>

---

Апликацијата (SafeChain MK — Anti-Phishing Traffic Fine Portal) потекнува од оригиналниот проект: **[github.com/tamara-00/Blockchain-Hackathon-2026](https://github.com/tamara-00/Blockchain-Hackathon-2026)**.

---

# МАКЕДОНСКИ

## За репозиториумот

Ова репо е моја самостојна проектна задача по предметот *Континуирана интеграција и испорака* — целосна докеризација, Kubernetes оркестрација и CI/CD pipeline на постоечката апликација SafeChain MK, плус миграција на бекендот од Supabase на самостојно хостирана MongoDB.

## Од Supabase кон MongoDB

Пред докеризацијата, прво го мигрирав бекендот од Supabase (Postgres + нивен hosted REST/auth слој) на самостојно хостирана MongoDB — потребно за да можам целосно да ја демонстрирам CI/CD → контејнеризација → оркестрација низата, без зависност од трет BaaS сервис за податочниот слој.

| Фајл | Што содржи |
|---|---|
| `backend/src/mongo.js` | Адаптер кој ги заменува старите Supabase повици со Mongoose query-и, со ист интерфејс кон остатокот од бекендот |
| `backend/src/db/connection.js` | Mongoose конекција кон MongoDB (`connectMongo`, `hasMongo`) |
| `backend/src/db/models.js` | Mongoose шеми/модели `Violation` и `Payment` |
| `.env.example` | `MONGODB_URI`, `MONGODB_DB_NAME` наместо старите `SUPABASE_URL`/`SUPABASE_*_KEY` |

## Докеризација — што направив и кои фајлови

| Фајл | Што прави |
|---|---|
| `backend/Dockerfile` | Multi-stage build за Node бекендот (builder стадиум → продукциски стадиум со `node:20-alpine`), вграден `HEALTHCHECK` на `/api/health` |
| `frontend/Dockerfile` | Multi-stage build: Node builder го прави `npm run build`, продукцискиот стадиум е `nginx:1.27-alpine` кој ги сервира статичките фајлови; прима `ARG VITE_THIRDWEB_CLIENT_ID` за да го вгради во build-от (Vite build-time променливи) |
| `frontend/nginx.conf.template` | nginx конфигурација (envsubst темплејт) — сервира статички фајлови на `/` и проксира `/api/*` кон backend контејнерот |
| `.dockerignore`, `backend/.dockerignore` | Исклучуваат `node_modules`, `.env`, `.git` итн. од build контекстот |
| `docker-compose.yml` | Ги орекстрира сите три сервиси (детали подолу) |
| `.env.example` | Сите потребни env променливи документирани (без реални тајни) |

### `docker-compose.yml` — детали

- **Три сервиси**: `frontend`, `backend`, `mongodb`
- **Именуван volume** за MongoDB (`safechain_mongodb_data:/data/db`) — податоците преживуваат `docker compose down` (се бришат само со `-v`)
- **`backend` чека `mongodb` да е healthy** пред да старта (`depends_on: condition: service_healthy`, преку `mongosh --eval "db.adminCommand('ping')"` healthcheck)
- **Сите env вредности од `.env`** — ништо не е hardcode-увано во compose фајлот
- **Сопствена bridge мрежа** (`safechain-network`) со имиња на сервисите за DNS резолуција меѓу контејнерите
- **`restart: unless-stopped`** на сите сервиси
- **Изложен е само `frontend`** (`localhost:8080`) — `backend` и `mongodb` се достапни само внатрешно

```bash
cp .env.example .env
docker compose up --build
docker compose exec backend node src/seed-demo.js   # сидување демо податоци
```

## Kubernetes — што направив и кои фајлови

Сите манифести се во `k8s/`, секој со коментари во самиот фајл зошто е избрана таа конфигурација:

| Фајл | Ресурс | Улога |
|---|---|---|
| `k8s/namespace.yaml` | `Namespace` | `safechain-mk` — изолација на сите ресурси |
| `k8s/mongo-secret.yaml` | `Secret` | MongoDB root credentials |
| `k8s/mongo-configmap.yaml` | `ConfigMap` | Име на база, порт (не-чувствителни вредности) |
| `k8s/mongo-service.yaml` | `Service` (headless) | `clusterIP: None` — стабилно per-pod DNS за StatefulSet-от |
| `k8s/mongo-statefulset.yaml` | `StatefulSet` | MongoDB со `volumeClaimTemplates` (PVC по под), readiness/liveness probes, resource limits |
| `k8s/backend-secret.yaml` | `Secret` | `MONGODB_URI`, `SECURITY_CODE_PEPPER`, `MEMO_ENCRYPTION_KEY`, `ADMIN_TOKEN` |
| `k8s/backend-configmap.yaml` | `ConfigMap` | Порт, `NODE_ENV`, не-чувствителни нагодувања |
| `k8s/backend-deployment.yaml` | `Deployment` | 2 реплики, `envFrom` Secret+ConfigMap, probes на `/api/health` |
| `k8s/backend-service.yaml` | `Service` (ClusterIP) | Само внатрешно достапен |
| `k8s/frontend-deployment.yaml` | `Deployment` | 2 реплики на frontend имиџот |
| `k8s/frontend-service.yaml` | `Service` (ClusterIP) | Само внатрешно достапен |
| `k8s/ingress.yaml` | `Ingress` | `/api` → backend, `/` → frontend |

```bash
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/mongo-secret.yaml -f k8s/mongo-configmap.yaml \
               -f k8s/backend-secret.yaml -f k8s/backend-configmap.yaml
kubectl apply -f k8s/mongo-service.yaml -f k8s/mongo-statefulset.yaml \
               -f k8s/backend-deployment.yaml -f k8s/backend-service.yaml \
               -f k8s/frontend-deployment.yaml -f k8s/frontend-service.yaml
kubectl apply -f k8s/ingress.yaml

kubectl get pods -n safechain-mk
kubectl get pvc -n safechain-mk
```

Тестирано и против Docker Desktop Kubernetes (локално) и против ефемерен `kind` кластер во CI.

## CI/CD Pipeline — што направив

Фајл: `.github/workflows/ci-cd.yml` — два job-а:

1. **`build-and-push`** (matrix: frontend + backend) — checkout, build на секој Docker имиџ со Buildx (GitHub Actions cache за побрзи build-ови), tag со `:latest` и `:<git-sha>` (traceability), push на DockerHub. На `push` кон `main` build-ира и push-ира; на `pull_request` само build-ира (без push).
2. **`deploy-to-kubernetes`** — по успешен push на двата имиџа, крева ефемерен `kind` (Kubernetes-in-Docker) кластер на самиот runner, ги патчира image таговите во `k8s/` манифестите на новиот `:<git-sha>`, ги applly-ира (прво namespace, потоа сè друго), чека StatefulSet + двата Deployment-и да завршат rollout, и на крај прави smoke test на `/api/health` преку Ingress. Секој неуспешен чекор го пропаѓа целиот pipeline со целосен лог.

Потребни GitHub Secrets: `DOCKERHUB_USERNAME`, `DOCKERHUB_TOKEN`, `VITE_THIRDWEB_CLIENT_ID`.

## Проектна структура (докер/k8s/CI делови)

```
docker-compose.yml         Локален 3-контејнерски стек
frontend/Dockerfile        Multi-stage build за frontend
backend/Dockerfile         Multi-stage build за backend
frontend/nginx.conf.template   nginx конфигурација (proxy кон backend)
k8s/                       Kubernetes манифести (namespace, secrets/configmaps,
                            StatefulSet, Deployments, Services, Ingress)
.github/workflows/ci-cd.yml   GitHub Actions CI/CD pipeline
backend/src/mongo.js       MongoDB адаптер (Mongoose)
backend/src/db/            Mongoose конекција + шеми
```

---

# ENGLISH

## What this repository is

This repo is my individual project assignment for the *Continuous Integration and
Delivery* course — full dockerization, Kubernetes orchestration, and a CI/CD
pipeline for the existing SafeChain MK application, plus migrating the backend from
Supabase to a self-hosted MongoDB.

## From Supabase to MongoDB

Before dockerizing, I first migrated the backend from Supabase (Postgres + its
hosted REST/auth layer) to a self-hosted MongoDB — needed so the full
CI/CD → containerization → orchestration pipeline could be demonstrated end to end
without depending on a third-party BaaS for the data layer.

| File | What it contains |
|---|---|
| `backend/src/mongo.js` | Adapter that replaces the old Supabase calls with Mongoose queries, same interface as the rest of the backend |
| `backend/src/db/connection.js` | Mongoose connection to MongoDB (`connectMongo`, `hasMongo`) |
| `backend/src/db/models.js` | Mongoose schemas/models `Violation` and `Payment` |
| `.env.example` | `MONGODB_URI`, `MONGODB_DB_NAME` in place of the old `SUPABASE_URL`/`SUPABASE_*_KEY` |

## Dockerization — what I built and which files

| File | What it does |
|---|---|
| `backend/Dockerfile` | Multi-stage build for the Node backend (builder stage → production stage on `node:20-alpine`), with a built-in `HEALTHCHECK` on `/api/health` |
| `frontend/Dockerfile` | Multi-stage build: a Node builder runs `npm run build`, the production stage is `nginx:1.27-alpine` serving the static files; accepts `ARG VITE_THIRDWEB_CLIENT_ID` to inline it at build time (Vite build-time variable) |
| `frontend/nginx.conf.template` | nginx config (envsubst template) — serves static files at `/` and proxies `/api/*` to the backend container |
| `.dockerignore`, `backend/.dockerignore` | Exclude `node_modules`, `.env`, `.git`, etc. from the build context |
| `docker-compose.yml` | Orchestrates all three services (details below) |
| `.env.example` | Every required env variable documented (no real secrets) |

### `docker-compose.yml` details

- **Three services**: `frontend`, `backend`, `mongodb`
- **Named volume** for MongoDB (`safechain_mongodb_data:/data/db`) — data survives `docker compose down` (only removed with `-v`)
- **`backend` waits for `mongodb` to be healthy** before starting (`depends_on: condition: service_healthy`, via a `mongosh --eval "db.adminCommand('ping')"` healthcheck)
- **All values sourced from `.env`** — nothing hardcoded in the compose file
- **Custom bridge network** (`safechain-network`) with service names for DNS resolution between containers
- **`restart: unless-stopped`** on every service
- **Only `frontend` is exposed** (`localhost:8080`) — `backend` and `mongodb` are internal-only

```bash
cp .env.example .env
docker compose up --build
docker compose exec backend node src/seed-demo.js   # seed demo data
```

## Kubernetes — what I built and which files

All manifests live in `k8s/`, each commented in-file with the reasoning behind that
configuration choice:

| File | Resource | Role |
|---|---|---|
| `k8s/namespace.yaml` | `Namespace` | `safechain-mk` — isolates all resources |
| `k8s/mongo-secret.yaml` | `Secret` | MongoDB root credentials |
| `k8s/mongo-configmap.yaml` | `ConfigMap` | Database name, port (non-sensitive values) |
| `k8s/mongo-service.yaml` | `Service` (headless) | `clusterIP: None` — stable per-pod DNS for the StatefulSet |
| `k8s/mongo-statefulset.yaml` | `StatefulSet` | MongoDB with `volumeClaimTemplates` (a PVC per pod), readiness/liveness probes, resource limits |
| `k8s/backend-secret.yaml` | `Secret` | `MONGODB_URI`, `SECURITY_CODE_PEPPER`, `MEMO_ENCRYPTION_KEY`, `ADMIN_TOKEN` |
| `k8s/backend-configmap.yaml` | `ConfigMap` | Port, `NODE_ENV`, other non-sensitive settings |
| `k8s/backend-deployment.yaml` | `Deployment` | 2 replicas, `envFrom` Secret+ConfigMap, probes on `/api/health` |
| `k8s/backend-service.yaml` | `Service` (ClusterIP) | Internal-only |
| `k8s/frontend-deployment.yaml` | `Deployment` | 2 replicas of the frontend image |
| `k8s/frontend-service.yaml` | `Service` (ClusterIP) | Internal-only |
| `k8s/ingress.yaml` | `Ingress` | `/api` → backend, `/` → frontend |

```bash
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/mongo-secret.yaml -f k8s/mongo-configmap.yaml \
               -f k8s/backend-secret.yaml -f k8s/backend-configmap.yaml
kubectl apply -f k8s/mongo-service.yaml -f k8s/mongo-statefulset.yaml \
               -f k8s/backend-deployment.yaml -f k8s/backend-service.yaml \
               -f k8s/frontend-deployment.yaml -f k8s/frontend-service.yaml
kubectl apply -f k8s/ingress.yaml

kubectl get pods -n safechain-mk
kubectl get pvc -n safechain-mk
```

Tested against both Docker Desktop Kubernetes (local) and a disposable `kind`
cluster in CI.

## CI/CD Pipeline — what I built

File: `.github/workflows/ci-cd.yml` — two jobs:

1. **`build-and-push`** (matrix: frontend + backend) — checks out the code, builds
   each Docker image with Buildx (GitHub Actions cache for faster rebuilds), tags it
   `:latest` and `:<git-sha>` for traceability, and pushes to DockerHub. On a push
   to `main` it builds and pushes; on a pull request it only builds (never pushes).
2. **`deploy-to-kubernetes`** — runs only after both images are pushed
   successfully. Spins up a disposable `kind` (Kubernetes-in-Docker) cluster on the
   runner itself, patches the image tags in the `k8s/` manifests to the freshly
   built `:<git-sha>`, applies them (namespace first, everything else after), waits
   for the MongoDB StatefulSet and both Deployments to report a successful rollout,
   then smoke-tests `/api/health` through the cluster's Ingress. Any failing step
   fails the whole pipeline with full logs.

Required GitHub Secrets: `DOCKERHUB_USERNAME`, `DOCKERHUB_TOKEN`,
`VITE_THIRDWEB_CLIENT_ID`.

## Project structure (Docker/K8s/CI parts)

```
docker-compose.yml         Local 3-container stack
frontend/Dockerfile        Multi-stage build for the frontend
backend/Dockerfile         Multi-stage build for the backend
frontend/nginx.conf.template   nginx config (proxies to the backend)
k8s/                       Kubernetes manifests (namespace, secrets/configmaps,
                            StatefulSet, Deployments, Services, Ingress)
.github/workflows/ci-cd.yml   GitHub Actions CI/CD pipeline
backend/src/mongo.js       MongoDB adapter (Mongoose)
backend/src/db/            Mongoose connection + schemas
```
