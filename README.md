# 🎟️ Smart Queue & Token Management DevOps System

A production-grade, full-stack **Queue & Token Management System** engineered with an enterprise DevOps pipeline. This project fulfills all 9 DevOps architecture requirements:

---

## 📋 DevOps Architecture Matrix

| # | Technology / Tool | Role in this Project | Implementation Details |
|---|-------------------|----------------------|------------------------|
| **1** | **VS Code** | Write project code | Clean MVC/Service architecture with Express, REST APIs, and UI assets |
| **2** | **Node.js + npm** | Run the backend | Express.js runtime, asynchronous controllers, Mongoose ODM, and Jest test runner |
| **3** | **Git** | Track code changes | Clean commits, branch strategies, and strict `.gitignore` |
| **4** | **GitHub account** | Store code & trigger CI/CD | Remote repository host with continuous automation hooks |
| **5** | **Docker Desktop** | Containerize application | Multi-stage unprivileged Alpine `Dockerfile` & `docker-compose.yml` with healthchecks |
| **6** | **MongoDB Atlas** | Store queue & token details | Cloud NoSQL cluster storing tickets, priorities, counters, and wait times |
| **7** | **Render account** | Deploy application online | Blueprint infrastructure-as-code (`render.yaml`) for automated zero-downtime hosting |
| **8** | **GitHub Actions** | Automate CI/CD pipeline | `.github/workflows/ci-cd.yml` multi-version Node tests, Docker image verification & Render deploy hook |
| **9** | **Web browser** | Run & test application | Responsive interactive UI: Customer Kiosk, Live TV Display, and Counter Officer Desks |

---

## 🚀 Quick Start (Local Node.js)

### 1. Prerequisites
- **Node.js**: v18.x, v20.x, or v24.x
- **npm**: v9.x or higher

### 2. Installation & Run
```bash
# Clone or open the project folder
cd "devops cat"

# Install dependencies
npm install

# Run automated Jest unit tests
npm test

# Start the server locally
npm start
```

Open your browser to:
- 🌐 **Web Application**: [http://localhost:3000](http://localhost:3000)
- 🩺 **Health Check**: [http://localhost:3000/api/health](http://localhost:3000/api/health)

---

## 🍃 MongoDB Atlas Configuration

1. Create a free account at [MongoDB Atlas](https://www.mongodb.com/cloud/atlas).
2. Create an **M0 Free Tier Cluster**.
3. Under **Database Access**, create a user with a secure password (e.g., `queue_admin`).
4. Under **Network Access**, add IP `0.0.0.0/0` (Allow Access from Anywhere).
5. Click **Connect** → **Drivers** (Node.js) → copy the connection string.
6. Create a `.env` file in the project root:
   ```env
   PORT=3000
   NODE_ENV=production
   MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.mongodb.net/queue_db?retryWrites=true&w=majority
   ```
> 💡 *Note: If no Atlas URI is provided, the application automatically runs in an in-memory resilient fallback mode so you can run and demo without interruptions!*

---

## 🐳 Docker Desktop Execution

### Build and Run with Docker
```bash
# Build the Docker image
docker build -t queue-token-system:latest .

# Run the container
docker run -d -p 3000:3000 --name queue-app queue-token-system:latest
```

### Run Multi-Container Stack (App + MongoDB) with Docker Compose
```bash
docker compose up -d
```
Stop the containers:
```bash
docker compose down
```

---

## ⚙️ GitHub Actions CI/CD Pipeline

The automated workflow located in [`.github/workflows/ci-cd.yml`](.github/workflows/ci-cd.yml) executes on every `push` and `pull_request` to `main`:

1. **Stage 1 (Test)**: Sets up Node 18, 20, and 22, installs dependencies, and runs Jest tests.
2. **Stage 2 (Docker Build)**: Verifies that the production `Dockerfile` builds cleanly.
3. **Stage 3 (Deploy)**: Triggers Render Deploy Webhook if `RENDER_DEPLOY_HOOK_URL` secret is configured.

### Setting up on GitHub:
```bash
git remote add origin https://github.com/<your-username>/<your-repo-name>.git
git branch -M main
git push -u origin main
```

---

## ☁️ Deploying Online on Render

### Option A: Using Blueprint (`render.yaml`)
1. Log into [Render Dashboard](https://dashboard.render.com).
2. Click **New +** → **Blueprint**.
3. Connect your GitHub repository.
4. Render automatically reads `render.yaml`, configures Node.js, and builds the app.
5. In the Render Environment tab, add `MONGODB_URI` with your MongoDB Atlas string.

### Option B: Manual Web Service
1. Click **New +** → **Web Service**.
2. Connect your repository.
3. Settings:
   - **Environment**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Health Check Path**: `/api/health`
4. Add Environment Variable:
   - `MONGODB_URI` = your Atlas connection string.

---

## 📡 REST API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/health` | Service health status and database connectivity |
| `POST` | `/api/tokens` | Issue new token (`service`, `customerName`, `priority`) |
| `GET` | `/api/tokens/waiting` | List of queued tickets in FIFO/priority order |
| `GET` | `/api/tokens/serving` | Currently active tokens at counters |
| `GET` | `/api/counters` | List status of all 4 service counters |
| `POST` | `/api/counters/:id/call-next` | Counter agent calls the next ticket |
| `POST` | `/api/counters/:id/complete` | Mark current ticket completed |
| `POST` | `/api/counters/:id/skip` | Mark customer skipped/no-show |
| `GET` | `/api/queue/stats` | Queue metrics (waiting, serving, average wait time) |
| `POST` | `/api/queue/reset` | Clear queue and reset shift counters |

---

## 🎯 Features & Browser UI Highlights

- **Kiosk Token Generator**: Instant token slip generation with department selection (A, B, C, T, VIP).
- **TV Display Board ("Now Serving")**: High-contrast airport/hospital style display with audio arrival chimes and speech synthesis.
- **Officer Desks**: 4 independent desks to Call Next, Recall Chime, Finish Service, or Skip.
- **Live Queue Ticker**: Real-time ticker showing upcoming customers in line.
