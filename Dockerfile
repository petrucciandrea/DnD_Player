# syntax=docker/dockerfile:1
# API (apps/api). Lo stage di produzione è l'ultimo: Render costruisce il Dockerfile senza --target.
#   docker build --target dev -t dnd-api-dev .   ambiente di sviluppo (tsx watch)
#   docker build -t dnd-api .                     immagine di produzione

# --- Dipendenze di tutti i workspace (servono i manifest di tutti per npm ci) ---
FROM node:24-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/regole/package.json packages/regole/
RUN npm ci --no-audit --no-fund

# --- Sviluppo: sorgenti montati o copiati, ricarica automatica ---
FROM deps AS dev
COPY . .
EXPOSE 3100
CMD ["npm", "run", "dev", "-w", "@dnd/api"]

# --- Bundle dell'API con esbuild (@dnd/regole incluso) ---
FROM deps AS build
COPY packages/regole packages/regole
COPY apps/api apps/api
RUN npm run build -w @dnd/api

# --- Produzione: solo il bundle e le dipendenze di runtime dell'API ---
FROM node:24-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/regole/package.json packages/regole/
RUN npm ci --omit=dev --workspace @dnd/api --include-workspace-root=false --no-audit --no-fund && npm cache clean --force
COPY --from=build /app/apps/api/dist apps/api/dist
WORKDIR /app/apps/api
USER node
# Render imposta PORT; il server ascolta su 0.0.0.0.
ENV PORT=10000
EXPOSE 10000
CMD ["node", "--enable-source-maps", "dist/principale.mjs"]
