# Use Node.js 22 LTS
FROM node:22-slim

# Install OpenSSL for Prisma
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy all files
COPY . .

# Install backend dependencies (include dev for TypeScript)
WORKDIR /app/backend
RUN npm ci --include=dev
RUN npx prisma generate
RUN npx tsc

# Install frontend dependencies and build
WORKDIR /app/frontend
RUN npm ci
RUN npm run build

# Copy frontend build to backend public folder
RUN rm -rf ../backend/public && cp -r www ../backend/public

# Set working directory to backend
WORKDIR /app/backend

# Expose port
EXPOSE 8080

# Start the server
CMD ["npm", "run", "start"]
