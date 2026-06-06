# Build stage
FROM node:20-slim AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install --legacy-peer-deps
COPY . .
RUN npx vite build

# Production stage - lightweight nginx
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html

# SPA routing config
RUN echo 'server { \
    listen 5174; \
    root /usr/share/nginx/html; \
    index index.html; \
    location / { \
        try_files $uri $uri/ /index.html; \
    } \
}' > /etc/nginx/conf.d/default.conf

EXPOSE 5174

HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD wget -q --spider http://localhost:5174 || exit 1

CMD ["nginx", "-g", "daemon off;"]
