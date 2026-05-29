# Base image
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Enable production environment variables during build
ENV NODE_ENV=production

# Copy configuration files
COPY package*.json ./
COPY tsconfig.json ./
COPY vite.config.ts ./
COPY firebase-applet-config.json* ./

# Install dependencies (include devDependencies for building)
RUN npm install

# Copy application source code
COPY . .

# Build frontend and compile backend entry server.ts
RUN npm run build

# Expose required port 3000
EXPOSE 3000

# Start custom Express backend server
CMD ["npm", "run", "start"]
