# Pluto Backend — production Docker image
FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --omit=dev

# Copy source and build
COPY . .
RUN npm run build

EXPOSE 5000

# Run compiled app
CMD ["node", "dist/server.js"]
