# Menggunakan base image resmi Puppeteer (sudah terinstal Chrome + dependensi Linux lengkap)
FROM ghcr.io/puppeteer/puppeteer:23.0.0

# Set variabel lingkungan produksi
ENV NODE_ENV=production
ENV PORT=3000

# WORKDIR dibuat root saat build → chown dulu agar pptruser bisa npm install
USER root
WORKDIR /app
RUN chown -R pptruser:pptruser /app
USER pptruser

# Salin package.json dan package-lock.json terlebih dahulu dengan ownership pptruser
COPY --chown=pptruser:pptruser package*.json ./

# Instal dependensi produksi secara aman
RUN npm install --omit=dev

# Salin seluruh kode backend ke dalam container dengan ownership pptruser
COPY --chown=pptruser:pptruser . .

# Jalankan aplikasi menggunakan user pptruser (aman bawaan Puppeteer image)
CMD ["node", "server.js"]
