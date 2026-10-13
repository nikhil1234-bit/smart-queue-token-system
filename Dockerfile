# ==========================================
# Production Multi-Stage Dockerfile for
# Smart Queue & Token Management DevOps App
# ==========================================
FROM node:20-alpine AS base

# Install curl for healthchecking if needed
RUN apk add --no-cache curl

# Working Directory
WORKDIR /usr/src/app

# Set Production Environment
ENV NODE_ENV=production
ENV PORT=3000

# Copy package manifests first for optimal caching
COPY package*.json ./

# Install production dependencies only
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

# Copy application source code
COPY . .

# Run as non-root user for DevSecOps best practices
USER node

# Expose default application port
EXPOSE 3000

# Container Healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

# Start the Node.js server
CMD ["node", "server.js"]
