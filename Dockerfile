# Single-stage build
FROM node:18-slim

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install ALL dependencies (needed for both build and runtime)
RUN npm install

# Copy source code
COPY . .

# Build frontend
RUN npm run build

# Expose port
EXPOSE 8080

# Start server
CMD ["node", "server.js"]
