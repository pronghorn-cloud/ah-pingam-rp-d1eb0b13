# Deployment Guide

This document provides detailed instructions for deploying the PingAM Analytics Dashboard on OpenShift with IBM Power Platform (ppc64le).

## Table of Contents

- [Prerequisites](#prerequisites)
- [Architecture Overview](#architecture-overview)
- [Local Development Setup](#local-development-setup)
- [Docker Build](#docker-build)
- [OpenShift Deployment](#openshift-deployment)
- [Post-Deployment Configuration](#post-deployment-configuration)
- [Scaling and High Availability](#scaling-and-high-availability)
- [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Development Machine

- **Node.js** >= 18.0.0
- **npm** >= 9.0.0
- **Docker** with buildx support (for multi-arch builds)
- **Git** for version control

### OpenShift Cluster

- OpenShift 4.x cluster
- Access to IBM Power Platform nodes (ppc64le architecture)
- OpenShift CLI (`oc`) installed and configured
- Sufficient permissions to create:
  - Deployments
  - Services
  - Routes
  - ConfigMaps
  - PersistentVolumeClaims
  - ImageStreams
  - BuildConfigs

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    OpenShift Platform (ppc64le)                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────┐                                            │
│  │   Route (TLS)   │◄──── External Traffic (HTTPS)              │
│  └────────┬────────┘                                            │
│           │                                                      │
│  ┌────────▼────────┐                                            │
│  │     Service     │                                            │
│  │  (ClusterIP)    │                                            │
│  └────────┬────────┘                                            │
│           │                                                      │
│  ┌────────▼─────────────────────────────────────┐               │
│  │           Deployment (2 replicas)             │               │
│  │  ┌─────────────────┐  ┌─────────────────┐    │               │
│  │  │     Pod 1       │  │     Pod 2       │    │               │
│  │  │ ┌─────────────┐ │  │ ┌─────────────┐ │    │               │
│  │  │ │  Node.js    │ │  │ │  Node.js    │ │    │               │
│  │  │ │  Express +  │ │  │ │  Express +  │ │    │               │
│  │  │ │  React      │ │  │ │  React      │ │    │               │
│  │  │ └─────────────┘ │  │ └─────────────┘ │    │               │
│  │  └────────┬────────┘  └────────┬────────┘    │               │
│  │           │                    │              │               │
│  │           └────────┬───────────┘              │               │
│  │                    │                          │               │
│  │           ┌────────▼────────┐                │               │
│  │           │   SQLite DB     │                │               │
│  │           │  (Shared PVC)   │                │               │
│  │           └─────────────────┘                │               │
│  └───────────────────────────────────────────────┘               │
│                                                                  │
│  ┌─────────────────────────────────────────────┐                │
│  │         PersistentVolumeClaim               │                │
│  │         (pingam-analytics-data)              │                │
│  │         5Gi - ReadWriteOnce                  │                │
│  └─────────────────────────────────────────────┘                │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Local Development Setup

### 1. Clone Repository

```bash
git clone <repository-url>
cd ah-pingam-rp
```

### 2. Install Dependencies

```bash
# Install server dependencies
npm install

# Install client dependencies
cd client && npm install && cd ..
```

### 3. Configure Environment

```bash
# Copy example environment file
cp .env.example .env

# Edit .env with your configuration
vim .env
```

**Key environment variables:**

| Variable | Default | Description |
|----------|---------|-------------|
| `NODE_ENV` | development | Environment mode |
| `PORT` | 3001 | Server port |
| `DB_PATH` | ./data | SQLite database path |
| `JWT_SECRET` | (random) | Secret for JWT signing |
| `SUPERADMIN_USERNAME` | superadmin | Default superadmin username |
| `SUPERADMIN_PASSWORD` | SuperAdmin@123 | Default superadmin password |

### 4. Start Development Servers

```bash
# Start both backend and frontend
npm run dev

# Or start separately:
npm run server:dev  # Backend on http://localhost:3001
npm run client:dev  # Frontend on http://localhost:3000
```

---

## Docker Build

### Building for Local Architecture

```bash
# Build for current architecture
docker build -t ah-pingam-rp:latest .

# Run locally
docker run -p 3001:3001 \
  -v $(pwd)/data:/opt/app-root/data \
  ah-pingam-rp:latest
```

### Building for Power Platform (ppc64le)

#### Option 1: Build on Power Platform

```bash
# On a ppc64le system
docker build -t ah-pingam-rp:latest-ppc64le .
```

#### Option 2: Cross-Platform Build (from x86)

```bash
# Setup buildx for multi-architecture
docker buildx create --name mybuilder --use
docker buildx inspect --bootstrap

# Build for ppc64le
docker buildx build --platform linux/ppc64le \
  -t ah-pingam-rp:latest-ppc64le \
  --load .
```

### Push to Registry

```bash
# Tag for your registry
docker tag ah-pingam-rp:latest-ppc64le \
  <registry>/pingam/ah-pingam-rp:latest

# Push
docker push <registry>/pingam/ah-pingam-rp:latest
```

---

## OpenShift Deployment

### Step 1: Create Project

```bash
# Create new project
oc new-project pingam-analytics

# Or switch to existing project
oc project pingam-analytics
```

### Step 2: Configure Secrets (Production)

```bash
# Create secret for sensitive environment variables
oc create secret generic pingam-analytics-secrets \
  --from-literal=JWT_SECRET=$(openssl rand -base64 32) \
  --from-literal=SUPERADMIN_PASSWORD='YourSecurePassword123!' \
  --from-literal=PINGAM_ENCRYPTION_KEY=$(openssl rand -base64 32)
```

### Step 3: Create CA Bundle ConfigMap

```bash
# Create ConfigMap for cluster CA injection
oc apply -f openshift/ca-bundle-configmap.yaml

# Verify CA bundle is injected (may take a few seconds)
oc get configmap pingam-analytics-ca-bundle -o yaml
```

### Step 4: Create PersistentVolumeClaim

```bash
# Review and customize storage class if needed
vim openshift/pvc.yaml

# Apply PVC
oc apply -f openshift/pvc.yaml

# Verify PVC is bound
oc get pvc pingam-analytics-data
```

### Step 5: Create ConfigMap

```bash
# Edit configmap with your settings
vim openshift/configmap.yaml

# Apply
oc apply -f openshift/configmap.yaml
```

### Step 6: Deploy Application

#### Using Pre-built Image

```bash
# Update image reference in deployment.yaml
vim openshift/deployment.yaml

# Apply deployment
oc apply -f openshift/deployment.yaml
```

#### Using OpenShift Build (S2I)

```bash
# Create ImageStream
oc apply -f openshift/imagestream.yaml

# Create BuildConfig
oc apply -f openshift/buildconfig.yaml

# Start build
oc start-build ah-pingam-rp --follow

# Deploy after build completes
oc apply -f openshift/deployment.yaml
```

### Step 7: Create Service

```bash
oc apply -f openshift/service.yaml
```

### Step 8: Create Route

```bash
# Edit route hostname
vim openshift/route.yaml

# Apply
oc apply -f openshift/route.yaml

# Get route URL
oc get route pingam-analytics -o jsonpath='{.spec.host}'
```

### Step 9: Verify Deployment

```bash
# Check pods
oc get pods -l app=pingam-analytics

# Check pod logs
oc logs -f deployment/pingam-analytics

# Check events
oc get events --sort-by=.lastTimestamp

# Test health endpoint
curl https://$(oc get route pingam-analytics -o jsonpath='{.spec.host}')/health
```

### Quick Deploy with Kustomize

```bash
# Deploy all resources at once
oc apply -k openshift/
```

---

## Post-Deployment Configuration

### 1. First Login

1. Access the application URL from the route
2. Login with default superadmin credentials:
   - Username: `superadmin` (or value of `SUPERADMIN_USERNAME`)
   - Password: `SuperAdmin@123` (or value of `SUPERADMIN_PASSWORD`)
3. **Immediately change the default password!**

### 2. Configure PingAM Instances

1. Login as superadmin
2. Navigate to Settings > PingAM Instances
3. Add your PingAM server(s):
   - Name: Descriptive name
   - Base URL: `https://your-pingam-server.example.com/openam`
   - Realm: `/alpha` (or your realm)
   - Admin credentials (optional, for admin operations)
   - Test connection

### 3. Configure System Settings

1. Navigate to Settings > System Configuration
2. Configure:
   - Sync intervals
   - Retention policies
   - Notification settings

### 4. Create Additional Users

1. Navigate to Settings > Users
2. Create operator/viewer accounts as needed
3. Assign appropriate roles

---

## Scaling and High Availability

### Horizontal Scaling

```bash
# Scale deployment
oc scale deployment pingam-analytics --replicas=3

# Or use HPA
oc autoscale deployment pingam-analytics \
  --min=2 --max=5 --cpu-percent=70
```

### Database Considerations

SQLite with WAL mode supports concurrent reads but serializes writes. For high-write scenarios:

1. **Single Replica with PVC**: Simplest, suitable for most use cases
2. **Read Replicas**: Multiple read-only pods with single write pod
3. **External Database**: Migrate to PostgreSQL for true horizontal scaling

### Pod Anti-Affinity

The deployment includes pod anti-affinity to spread replicas across nodes:

```yaml
affinity:
  podAntiAffinity:
    preferredDuringSchedulingIgnoredDuringExecution:
      - weight: 100
        podAffinityTerm:
          labelSelector:
            matchLabels:
              app: pingam-analytics
          topologyKey: kubernetes.io/hostname
```

---

## Troubleshooting

### Common Issues

#### Pods Not Starting

```bash
# Check pod status
oc describe pod <pod-name>

# Check events
oc get events --field-selector involvedObject.name=<pod-name>

# Common causes:
# - Image pull errors: Check image reference and registry access
# - PVC not bound: Check storage class and PVC status
# - Resource limits: Increase memory/CPU limits
```

#### Database Errors

```bash
# Check PVC is mounted
oc exec <pod-name> -- ls -la /opt/app-root/data

# Check database file
oc exec <pod-name> -- cat /opt/app-root/data/pingam.db

# Check permissions
oc exec <pod-name> -- touch /opt/app-root/data/test.txt
```

#### Connection Issues

```bash
# Test from within cluster
oc run test-curl --rm -it --image=curlimages/curl -- \
  curl -v http://pingam-analytics:3001/health

# Check route
oc get route pingam-analytics -o yaml

# Check service endpoints
oc get endpoints pingam-analytics
```

#### TLS/Certificate Issues

```bash
# Verify CA bundle is mounted
oc exec <pod-name> -- cat /etc/pki/ca-trust/extracted/pem/tls-ca-bundle.pem

# Check CA bundle configmap
oc get configmap pingam-analytics-ca-bundle -o yaml
```

### Useful Commands

```bash
# View logs
oc logs -f deployment/pingam-analytics

# Exec into pod
oc exec -it deployment/pingam-analytics -- /bin/sh

# Port forward for local debugging
oc port-forward deployment/pingam-analytics 3001:3001

# Restart deployment
oc rollout restart deployment/pingam-analytics

# Check resource usage
oc adm top pods -l app=pingam-analytics
```

---

## Security Considerations

1. **Change default credentials** immediately after deployment
2. **Use secrets** for sensitive configuration (JWT_SECRET, passwords)
3. **Enable TLS** on routes (edge termination)
4. **Configure network policies** to restrict pod communication
5. **Regularly update** base images and dependencies
6. **Enable audit logging** for compliance requirements

---

## Backup and Recovery

### Database Backup

```bash
# Create backup
oc exec deployment/pingam-analytics -- \
  sqlite3 /opt/app-root/data/pingam.db ".backup /tmp/backup.db"

# Copy backup locally
oc cp <pod-name>:/tmp/backup.db ./backup-$(date +%Y%m%d).db
```

### Restore from Backup

```bash
# Scale down deployment
oc scale deployment pingam-analytics --replicas=0

# Copy backup to PVC
oc cp ./backup.db <pod-name>:/opt/app-root/data/pingam.db

# Scale up deployment
oc scale deployment pingam-analytics --replicas=2
```
