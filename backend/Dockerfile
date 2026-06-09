FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
EXPOSE 5000
CMD ["sh", "-c", "node src/config/migrate.js && node src/config/seed.js && node src/index.js"]
