# PingAM Analytics Dashboard - Power Platform (ppc64le) Compliant Dockerfile
# Multi-stage build for optimized production image

# =============================================================================
# Stage 1: Build Stage
# =============================================================================
FROM --platform=linux/ppc64le registry.access.redhat.com/ubi8/nodejs-18:latest AS builder

# Set working directory
WORKDIR /opt/app-root/src

# Switch to root to install build dependencies
USER root

# Install build tools needed for native modules (better-sqlite3)
RUN yum install -y python3 make gcc gcc-c++ ca-certificates && \
    yum clean all && \
    rm -rf /var/cache/yum

# Copy package files
COPY package*.json ./
# Install dependencies
RUN npm install --omit=dev && \
    npm cache clean --force

# Copy server source code
COPY server/ ./server/

# Copy client and build
COPY client/package*.json ./client/
WORKDIR /opt/app-root/src/client
RUN npm install && npm cache clean --force

COPY client/ ./
RUN npm run build

# =============================================================================
# Stage 2: Production Stage
# =============================================================================
FROM --platform=linux/ppc64le registry.access.redhat.com/ubi8/nodejs-18-minimal:latest AS production

# Labels for OpenShift
LABEL name="ah-pingam-rp" \
      version="1.0.0" \
      description="PingAM Analytics and Reporting Dashboard" \
      maintainer="AH Team" \
      io.k8s.description="PingAM Analytics and Reporting Dashboard" \
      io.k8s.display-name="PingAM Analytics" \
      io.openshift.expose-services="3001:http" \
      io.openshift.tags="nodejs,analytics,dashboard"

# Set working directory
WORKDIR /opt/app-root/src

# Create data directory for SQLite
RUN mkdir -p /opt/app-root/src/data && \
    chown -R 1001:0 /opt/app-root/src && \
    chmod -R g=u /opt/app-root/src

# Copy built application from builder stage
COPY --from=builder --chown=1001:0 /opt/app-root/src/node_modules ./node_modules
COPY --from=builder --chown=1001:0 /opt/app-root/src/server ./server
COPY --from=builder --chown=1001:0 /opt/app-root/src/client/build ./client/build
COPY --chown=1001:0 package*.json ./

# Set environment variables
ENV NODE_ENV=production \
    PORT=3001 \
    DB_PATH=/opt/app-root/src/data \
    LOG_PATH=/var/log/app

# Switch to root to create log directory
USER root

# Create log directory
RUN mkdir -p /var/log/app && \
    chown -R 1001:0 /var/log/app && \
    chmod -R g=u /var/log/app


# Switch to non-root user (required for OpenShift)
USER 1001

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3001/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1); }).on('error', () => process.exit(1));"

# Start application
CMD ["node", "server/index.js"]
