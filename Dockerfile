# =========================
# Builder stage
# =========================
FROM node:18-alpine AS builder

WORKDIR /app

# Install only production dependencies
COPY package.json package-lock.json ./
RUN npm ci --only=production

# Copy application source
COPY src ./src


# =========================
# Runtime stage
# =========================
FROM node:18-alpine

WORKDIR /app

# Create non-root user
RUN addgroup -S nodejs -g 1001 && \
    adduser -S nodejs -u 1001 -G nodejs

# Copy dependencies and app
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/src ./src
COPY --from=builder /app/package.json ./package.json

# Switch to non-root user
USER nodejs

# Fly.io internal port
EXPOSE 8080

# Start app
CMD ["node", "src/index.js"]
