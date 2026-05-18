# Menggunakan base image resmi Puppeteer (sudah terinstal Chrome + dependensi Linux lengkap)
FROM ghcr.io/puppeteer/puppeteer:23.0.0

# Set variabel lingkungan produksi
ENV NODE_ENV=production
ENV PORT=3000

# Set direktori kerja di dalam container
WORKDIR /app

# Salin package.json dan package-lock.json terlebih dahulu dengan ownership pptruser
COPY --chown=pptruser:pptruser package*.json ./

# Instal dependensi produksi secara aman
RUN npm install --omit=dev

# Salin seluruh kode backend ke dalam container dengan ownership pptruser
COPY --chown=pptruser:pptruser . .

# Jalankan aplikasi menggunakan user pptruser (aman bawaan Puppeteer image)
CMD ["node", "server.js"]
