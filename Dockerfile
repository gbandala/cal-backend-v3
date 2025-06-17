# FROM node:18-alpine AS builder

# # Crear directorio de la aplicación
# WORKDIR /app

# # Copiar archivos de configuración
# COPY package*.json tsconfig.json ./

# # Instalar dependencias - CAMBIADO: npm install en lugar de npm ci
# RUN npm install

# # Copiar código fuente
# COPY src/ ./src/

# # Construir aplicación
# RUN npm run build

# # Etapa de producción
# FROM node:18-alpine AS production

# # Crear directorio de la aplicación
# WORKDIR /app

# # Copiar archivos de configuración
# COPY package*.json ./

# # Instalar solo dependencias de producción - CAMBIADO: npm install en lugar de npm ci
# RUN npm install --only=production

# # Crear directorios para logs y archivos temporales
# RUN mkdir -p logs tmp
# RUN chmod 777 logs tmp

# # Copiar código compilado
# COPY --from=builder /app/dist ./dist

# # Exponer puerto
# EXPOSE 8000

# # Comando para iniciar la aplicación
# CMD ["node", "dist/index.js"]
# 🏗️ ETAPA DE CONSTRUCCIÓN
FROM node:18-alpine AS builder

# Instalar dependencias del sistema necesarias
RUN apk add --no-cache python3 make g++

# Crear directorio de la aplicación
WORKDIR /app

# Copiar archivos de configuración
COPY package*.json tsconfig.json ./

# 🔧 Instalar TODAS las dependencias (incluyendo devDependencies para build)
RUN npm ci --include=dev

# Copiar código fuente
COPY src/ ./src/

# 🚀 Construir aplicación
RUN npm run build

# Verificar que la construcción fue exitosa
RUN ls -la dist/

# ⚡ ETAPA DE PRODUCCIÓN
FROM node:18-alpine AS production

# Instalar dumb-init para manejo correcto de señales
RUN apk add --no-cache dumb-init

# Crear usuario no-root para seguridad
RUN addgroup -g 1001 -S nodejs
RUN adduser -S backend -u 1001

# Crear directorio de la aplicación
WORKDIR /app

# Cambiar propiedad del directorio
RUN chown -R backend:nodejs /app
USER backend

# Copiar archivos de configuración
COPY --chown=backend:nodejs package*.json ./

# 📦 Instalar SOLO dependencias de producción
RUN npm ci --only=production && npm cache clean --force

# Crear directorios para logs y archivos temporales
RUN mkdir -p logs tmp

# 📁 Copiar código compilado
COPY --from=builder --chown=backend:nodejs /app/dist ./dist

# 🔍 Verificar estructura de archivos
RUN ls -la dist/
RUN ls -la dist/database/entities/ || echo "⚠️ No se encontraron entidades"

# Variables de entorno por defecto
ENV NODE_ENV=production
ENV PORT=8000

# 🔓 Exponer puerto
EXPOSE 8000

# 🎯 Comando para iniciar la aplicación con dumb-init
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/index.js"]

# 🏷️ Etiquetas de metadata
LABEL maintainer="bandala@outlook.com"
LABEL version="1.0.0"
LABEL description="Backend API con TypeORM y PostgreSQL"