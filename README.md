# AH-PingAM-RP - PingAM Analytics and Reporting Dashboard

[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org)
[![Platform](https://img.shields.io/badge/platform-ppc64le%20%7C%20Power-blue)](https://www.ibm.com/power)
[![OpenShift](https://img.shields.io/badge/OpenShift-4.x-red)](https://www.openshift.com)

A comprehensive analytics and reporting dashboard for PingAM (Ping Access Management) authentication events. Built with Node.js/Express backend, React frontend, and SQLite database, optimized for deployment on IBM Power Platform (ppc64le) with OpenShift.

## 📋 Table of Contents

- [Features](#-features)
- [Architecture](#-architecture)
- [Prerequisites](#-prerequisites)
- [Quick Start](#-quick-start)
- [Development](#-development)
- [Testing](#-testing)
- [Deployment](#-deployment)
- [API Documentation](#-api-documentation)
- [Configuration](#-configuration)
- [Project Structure](#-project-structure)

## ✨ Features

### Dashboard
- Real-time authentication metrics overview
- Success/failure rate visualization
- Active sessions monitoring
- Alert management with severity levels

### Authentication Events
- Comprehensive event logging
- Filtering by status, event type, user, and date range
- Bulk event ingestion support
- Detailed event timeline

### Session Management
- Active session tracking
- Session statistics and duration analysis
- Manual session termination
- Session-by-realm breakdown

### Alerts
- Multi-severity alert system (critical, warning, info)
- Alert acknowledgment workflow
- Resolution tracking
- Customizable alert types

### Reports
- Summary reports with configurable periods
- Security analysis (suspicious IPs, failed attempts)
- Export to CSV/JSON formats
- Application and realm breakdowns

## 🏗 Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    OpenShift Platform (ppc64le)             │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────┐    │
│  │                   Route (TLS)                        │    │
│  └─────────────────────────────────────────────────────┘    │
│                           │                                  │
│  ┌─────────────────────────────────────────────────────┐    │
│  │                   Service                            │    │
│  └─────────────────────────────────────────────────────┘    │
│                           │                                  │
│  ┌─────────────────────────────────────────────────────┐    │
│  │              Deployment (2 replicas)                 │    │
│  │  ┌───────────────────────────────────────────────┐  │    │
│  │  │            Container (Node.js)                 │  │    │
│  │  │  ┌─────────────┐    ┌─────────────────────┐   │  │    │
│  │  │  │   Express   │    │   React (static)    │   │  │    │
│  │  │  │   API       │    │   Frontend          │   │  │    │
│  │  │  └─────────────┘    └─────────────────────┘   │  │    │
│  │  │         │                                      │  │    │
│  │  │  ┌─────────────────────────────────────────┐  │  │    │
│  │  │  │         SQLite Database                  │  │  │    │
│  │  │  │         (Persistent Volume)              │  │  │    │
│  │  │  └─────────────────────────────────────────┘  │  │    │
│  │  └───────────────────────────────────────────────┘  │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

## 📦 Prerequisites

- **Node.js** >= 18.0.0
- **npm** >= 9.0.0
- **Docker** with buildx support (for multi-arch builds)
- **OpenShift CLI** (oc) for deployment
- Access to IBM Power Platform (ppc64le) OpenShift cluster

## 🚀 Quick Start

### Local Development

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd ah-pingam-rp
   ```

2. **Install dependencies**
   ```bash
   # Install server dependencies
   npm install
   
   # Install client dependencies
   cd client && npm install && cd ..
   ```

3. **Configure environment**
   ```bash
   cp .env.example .env
   # Edit .env with your settings
   ```

4. **Start development servers**
   ```bash
   npm run dev
   ```
   - Backend: http://localhost:3001
   - Frontend: http://localhost:3000

## 💻 Development

### Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start both backend and frontend in development mode |
| `npm run server:dev` | Start backend with hot reload |
| `npm run client:dev` | Start React development server |
| `npm run build` | Build frontend for production |
| `npm start` | Start production server |
| `npm test` | Run all tests with coverage |
| `npm run test:server` | Run server tests only |
| `npm run test:client` | Run client tests only |
| `npm run lint` | Run ESLint |
| `npm run db:init` | Initialize database |

### Code Structure

```
├── server/               # Backend (Node.js/Express)
│   ├── index.js          # Application entry point
│   ├── routes/           # API route handlers
│   ├── database/         # Database initialization
│   ├── middleware/       # Express middleware
│   ├── utils/            # Utility functions
│   └── tests/            # Server tests
├── client/               # Frontend (React)
│   ├── public/           # Static assets
│   └── src/
│       ├── components/   # React components
│       ├── pages/        # Page components
│       └── services/     # API service layer
├── openshift/            # OpenShift configurations
└── data/                 # SQLite database (gitignored)
```

## 🧪 Testing

### Run All Tests
```bash
npm test
```

### Run with Coverage
```bash
npm run test -- --coverage
```

### Server Tests Only
```bash
npm run test:server
```

### Client Tests Only
```bash
cd client && npm test
```

### Test Coverage Requirements
- Minimum 50% coverage for branches, functions, lines, and statements

## 🚢 Deployment

### Building for Power Platform (ppc64le)

1. **Build Docker image**
   ```bash
   # For local ppc64le system
   docker build -t ah-pingam-rp:latest .
   
   # For cross-platform build (from x86)
   docker buildx build --platform linux/ppc64le \
     -t ah-pingam-rp:latest-ppc64le .
   ```

2. **Push to registry**
   ```bash
   docker tag ah-pingam-rp:latest <registry>/pingam/ah-pingam-rp:latest
   docker push <registry>/pingam/ah-pingam-rp:latest
   ```

### OpenShift Deployment

1. **Create project**
   ```bash
   oc new-project pingam-analytics
   ```

2. **Apply configurations**
   ```bash
   # Create ConfigMap
   oc apply -f openshift/configmap.yaml
   
   # Create PersistentVolumeClaim
   oc apply -f openshift/pvc.yaml
   
   # Deploy application
   oc apply -f openshift/deployment.yaml
   
   # Create service
   oc apply -f openshift/service.yaml
   
   # Create route
   oc apply -f openshift/route.yaml
   ```

3. **Verify deployment**
   ```bash
   oc get pods
   oc get routes
   ```

### Power Platform Considerations

- All container images use UBI8 base images compatible with ppc64le
- Native Node.js modules (better-sqlite3) are compiled for ppc64le
- Node selector ensures pods run on Power nodes:
  ```yaml
  nodeSelector:
    kubernetes.io/arch: ppc64le
  ```

## 📚 API Documentation

### Base URL
```
/api/v1
```

### Endpoints

#### Authentication Events
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/auth-events` | List events with pagination |
| GET | `/auth-events/:id` | Get single event |
| POST | `/auth-events` | Create event |
| POST | `/auth-events/bulk` | Bulk create events |

#### Sessions
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/sessions` | List sessions |
| GET | `/sessions/active` | Get active sessions |
| GET | `/sessions/stats` | Get statistics |
| POST | `/sessions` | Create session |
| PATCH | `/sessions/:id/end` | End session |

#### Metrics
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/metrics/overview` | Dashboard overview |
| GET | `/metrics/auth-trends` | Authentication trends |
| GET | `/metrics/top-users` | Top users by activity |
| GET | `/metrics/by-application` | Metrics by application |
| GET | `/metrics/failure-analysis` | Failure analysis |

#### Alerts
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/alerts` | List alerts |
| GET | `/alerts/active` | Active alerts summary |
| POST | `/alerts` | Create alert |
| PATCH | `/alerts/:id/acknowledge` | Acknowledge alert |
| PATCH | `/alerts/:id/resolve` | Resolve alert |

#### Reports
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/reports/summary` | Summary report |
| GET | `/reports/security` | Security report |
| GET | `/reports/export` | Export data |

### Health Endpoints
| Endpoint | Description |
|----------|-------------|
| `/health` | Liveness probe |
| `/ready` | Readiness probe |

## ⚙️ Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `NODE_ENV` | development | Environment mode |
| `PORT` | 3001 | Server port |
| `DB_PATH` | ./data | SQLite database path |
| `CORS_ORIGIN` | http://localhost:3000 | CORS allowed origin |
| `LOG_LEVEL` | info | Winston log level |
| `LOG_PATH` | /var/log/app | Log file directory |

### OpenShift ConfigMap

Edit `openshift/configmap.yaml` to customize:
- Log levels
- CORS origins
- Other runtime configurations

## 🔒 Security Features

- **Helmet.js** for HTTP security headers
- **Rate limiting** on API endpoints
- **Input validation** using express-validator
- **Non-root container** execution
- **TLS termination** at OpenShift route
- **Security context** constraints

## 📊 Database Schema

### Tables
- `auth_events` - Authentication event logs
- `sessions` - User sessions
- `api_access_logs` - API access audit logs
- `metrics_hourly` - Aggregated hourly metrics
- `alerts` - System alerts
- `dashboard_configs` - Dashboard configurations

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

ISC License - see LICENSE file for details.

## 🆘 Support

For issues and feature requests, please create an issue in the repository.
