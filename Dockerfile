# Dockerfile root — context = repo root (.), agar frontend ikut ter-bundle ke /app/frontend
# (render.yaml dockerContext = "." ; tanpa ini server crash ENOENT scandir '/frontend')
FROM ghcr.io/puppeteer/puppeteer:23.0.0

ENV NODE_ENV=production
ENV PORT=3000

USER root
WORKDIR /app
RUN chown -R pptruser:pptruser /app
USER pptruser

# Backend deps
COPY --chown=pptruser:pptruser backend/package*.json ./backend/
WORKDIR /app/backend
RUN npm install --omit=dev

# Kode backend + frontend (frontend jadi sibling /app/frontend)
COPY --chown=pptruser:pptruser backend/ ./backend/
COPY --chown=pptruser:pptruser frontend/ ./frontend/

WORKDIR /app/backend
CMD ["node", "server.js"]
