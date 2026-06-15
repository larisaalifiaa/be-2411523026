FROM node:18-alpine

WORKDIR /app

# Salin package.json dan package-lock.json
COPY package*.json ./

# Install dependensi produksi saja
RUN npm install --omit=dev

# Salin seluruh kode backend
COPY . .

# Konfigurasi port default
ENV PORT=3001
EXPOSE 3001

# Jalankan server
CMD ["npm", "start"]
