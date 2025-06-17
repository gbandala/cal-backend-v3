# 📖 Guía de Instalación - Cal Backend v3

> **Configuración completa paso a paso para Cal Backend v3**

## 📋 Tabla de Contenidos

1. [Prerrequisitos](#-prerrequisitos)
2. [Configuración del Entorno](#-configuración-del-entorno)
3. [Configuración de Google Cloud Console](#-configuración-de-google-cloud-console)
4. [Configuración de la Base de Datos](#-configuración-de-la-base-de-datos)
5. [Variables de Entorno](#-variables-de-entorno)
6. [Instalación y Ejecución](#-instalación-y-ejecución)
7. [Verificación de la Instalación](#-verificación-de-la-instalación)
8. [Comandos Útiles](#-comandos-útiles)
9. [Solución de Problemas](#-solución-de-problemas)

## 🔧 Prerrequisitos

### Software Requerido

| Software | Versión Mínima | Versión Recomendada | Notas |
|----------|----------------|---------------------|-------|
| **Node.js** | v16.0.0 | v18.x o superior | Runtime de JavaScript |
| **npm** | v8.0.0 | v9.x o superior | Gestor de paquetes |
| **PostgreSQL** | v14.0 | v15.x o superior | Base de datos principal |
| **Git** | v2.20.0 | Última versión | Control de versiones |

### Cuentas Requeridas

- **Google Cloud Console** - Para OAuth2 y APIs de Calendar/Meet
- **GitHub** - Para clonar el repositorio (si es privado)

### Verificación de Prerrequisitos

```bash
# Verificar Node.js
node --version
# Debe mostrar v16.0.0 o superior

# Verificar npm
npm --version
# Debe mostrar v8.0.0 o superior

# Verificar PostgreSQL
psql --version
# Debe mostrar v14.0 o superior

# Verificar Git
git --version
# Debe mostrar v2.20.0 o superior
```

## 🌍 Configuración del Entorno

### 1. Clonar el Repositorio

```bash
# Opción 1: HTTPS
git clone https://github.com/gbandala/cal-backend-v3.git

# Opción 2: SSH (recomendado si tienes configuradas las llaves)
git clone git@github.com:gbandala/cal-backend-v3.git

# Navegar al directorio
cd cal-backend-v3
```

### 2. Instalar Dependencias

```bash
# Instalar todas las dependencias
npm install

# Verificar instalación
npm list --depth=0
```

### 3. Configurar Node.js (Opcional)

Si usas **nvm** para gestionar versiones de Node.js:

```bash
# Usar la versión recomendada
nvm use 18

# O instalar si no la tienes
nvm install 18
nvm use 18
```

## ☁️ Configuración de Google Cloud Console

### 1. Crear Proyecto en Google Cloud

1. Ve a [Google Cloud Console](https://console.cloud.google.com/)
2. Crea un nuevo proyecto o selecciona uno existente
3. Anota el **Project ID** para uso posterior

### 2. Habilitar APIs Necesarias

```bash
# APIs requeridas:
# - Google Calendar API
# - Google Drive API (para Meet)
```

**Pasos en la consola:**
1. Ve a **APIs & Services > Library**
2. Busca y habilita:
   - `Google Calendar API`
   - `Google Drive API`

### 3. Configurar OAuth 2.0

#### Crear Credenciales OAuth

1. Ve a **APIs & Services > Credentials**
2. Clic en **"+ CREATE CREDENTIALS" > OAuth 2.0 Client IDs**
3. Si es la primera vez, configura la **pantalla de consentimiento OAuth**:
   - **User Type**: External
   - **Application name**: Cal Backend v3
   - **Authorized domains**: Tu dominio (ej: `localhost` para desarrollo)

#### Configurar Cliente OAuth

1. **Application type**: Web application
2. **Name**: Cal Backend v3
3. **Authorized JavaScript origins**:
   ```
   http://localhost:8000
   http://localhost:3000
   ```
4. **Authorized redirect URIs**:
   ```
   http://localhost:8000/auth/google/callback
   ```

### 4. Obtener Credenciales

Después de crear el cliente OAuth:
1. Descarga el archivo JSON de credenciales
2. Anota el **Client ID** y **Client Secret**

### 5. Configurar Scopes

Los scopes necesarios para el proyecto:
```
https://www.googleapis.com/auth/calendar
https://www.googleapis.com/auth/calendar.events
```

## 🗄️ Configuración de la Base de Datos

### 1. Instalar PostgreSQL

#### En Ubuntu/Debian:
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
```

#### En macOS (con Homebrew):
```bash
brew install postgresql
brew services start postgresql
```

#### En Windows:
Descarga e instala desde [postgresql.org](https://www.postgresql.org/download/windows/)

### 2. Crear Base de Datos y Usuario

```bash
# Conectar a PostgreSQL como superusuario
sudo -u postgres psql

# En el prompt de PostgreSQL:
CREATE DATABASE cal_backend_v3;
CREATE USER cal_user WITH ENCRYPTED PASSWORD 'tu_password_seguro';
GRANT ALL PRIVILEGES ON DATABASE cal_backend_v3 TO cal_user;
\q
```

### 3. Verificar Conexión

```bash
# Probar conexión con el nuevo usuario
psql -h localhost -U cal_user -d cal_backend_v3
```

## 🔐 Variables de Entorno

### 1. Crear Archivo de Configuración

```bash
# Copiar template de variables de entorno
cp .env.example .env
```

### 2. Configurar Variables

Edita el archivo `.env` con tus valores:

```env
# ================================
# CONFIGURACIÓN DEL SERVIDOR
# ================================
NODE_ENV=development
PORT=8000
API_VERSION=v1

# ================================
# CONFIGURACIÓN DE BASE DE DATOS
# ================================
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=cal_user
DB_PASSWORD=tu_password_seguro
DB_DATABASE=cal_backend_v3

# ================================
# CONFIGURACIÓN JWT
# ================================
JWT_SECRET=tu_jwt_secret_muy_seguro_y_largo_minimo_32_caracteres
JWT_EXPIRES_IN=7d

# ================================
# CONFIGURACIÓN GOOGLE OAUTH
# ================================
GOOGLE_CLIENT_ID=tu_google_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=tu_google_client_secret
GOOGLE_REDIRECT_URI=http://localhost:8000/auth/google/callback

# ================================
# CONFIGURACIÓN DE CORS
# ================================
CORS_ORIGIN=http://localhost:3000

# ================================
# CONFIGURACIÓN DE LOGS
# ================================
LOG_LEVEL=debug

# ================================
# CONFIGURACIÓN DE ZONA HORARIA
# ================================
DEFAULT_TIMEZONE=America/Mexico_City
```

### 3. Generar JWT Secret

```bash
# Generar un secret seguro
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 4. Validar Variables

```bash
# Verificar que todas las variables están configuradas
npm run env:check
```

## 🚀 Instalación y Ejecución

### 1. Configurar Base de Datos

```bash
# Ejecutar migraciones
npm run typeorm:migration:run

# Sincronizar esquema (solo en desarrollo)
npm run db:sync

# Opcional: Insertar datos de prueba
npm run db:seed
```

### 2. Compilar TypeScript

```bash
# Compilar código TypeScript
npm run build

# O compilar en modo watch para desarrollo
npm run build:watch
```

### 3. Ejecutar la Aplicación

#### Modo Desarrollo
```bash
# Ejecutar con hot reload
npm run dev

# O usar nodemon directamente
npm run dev:watch
```

#### Modo Producción
```bash
# Compilar y ejecutar
npm run build
npm start
```

### 4. Verificar que el Servidor Está Funcionando

La aplicación estará disponible en: `http://localhost:8000`

## ✅ Verificación de la Instalación

### 1. Health Check

```bash
# Verificar estado del servidor
curl http://localhost:8000/api/v1/health

# Respuesta esperada:
{
  "status": "ok",
  "timestamp": "2025-06-17T12:00:00.000Z",
  "version": "3.0.0"
}
```

### 2. Verificar Base de Datos

```bash
# Verificar conexión a la base de datos
npm run db:check

# Verificar migraciones
npm run typeorm:migration:show
```

### 3. Verificar OAuth

```bash
# Probar endpoint de autenticación
curl http://localhost:8000/api/v1/auth/google

# Debe redirigir a Google OAuth
```

### 4. Ejecutar Tests

```bash
# Tests unitarios
npm test

# Tests de integración
npm run test:integration

# Coverage
npm run test:coverage
```

## 🛠️ Comandos Útiles

### Gestión de Base de Datos

```bash
# Crear nueva migración
npm run typeorm:migration:create -- -n NombreMigracion

# Ejecutar migraciones pendientes
npm run typeorm:migration:run

# Revertir última migración
npm run typeorm:migration:revert

# Mostrar estado de migraciones
npm run typeorm:migration:show

# Regenerar esquema (¡Cuidado en producción!)
npm run db:schema:drop
npm run db:schema:sync
```

### Desarrollo

```bash
# Ejecutar en modo desarrollo con watch
npm run dev

# Linter
npm run lint
npm run lint:fix

# Formatear código
npm run format

# Verificar tipos de TypeScript
npm run type-check
```

### Producción

```bash
# Build optimizado
npm run build:prod

# Ejecutar en producción
npm run start:prod

# PM2 (recomendado para producción)
npm install -g pm2
pm2 start ecosystem.config.js
```

## 🔧 Solución de Problemas

### Error: "Port 8000 already in use"

```bash
# Encontrar proceso usando el puerto
lsof -i :8000

# Matar proceso
kill -9 <PID>

# O cambiar puerto en .env
PORT=8001
```

### Error: "Database connection failed"

```bash
# Verificar que PostgreSQL está corriendo
sudo systemctl status postgresql

# Reiniciar PostgreSQL
sudo systemctl restart postgresql

# Verificar variables de entorno
echo $DB_HOST $DB_PORT $DB_USERNAME
```

### Error: "Google OAuth failed"

1. Verificar que las APIs están habilitadas en Google Cloud Console
2. Verificar que el **redirect URI** es exacto
3. Verificar que el **Client ID** y **Client Secret** son correctos
4. Verificar que la pantalla de consentimiento está configurada

### Error: "JWT malformed"

```bash
# Regenerar JWT secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Actualizar en .env
JWT_SECRET=nuevo_secret_generado
```

### Error: "TypeORM entities not found"

```bash
# Verificar configuración en ormconfig.ts
# Asegurar que el path de entities es correcto

# Regenerar build
npm run build
```

### Logs de Debug

```bash
# Ejecutar con logs detallados
DEBUG=* npm run dev

# O configurar nivel específico en .env
LOG_LEVEL=debug
```

### Limpiar Cache

```bash
# Limpiar node_modules
rm -rf node_modules package-lock.json
npm install

# Limpiar build
rm -rf dist
npm run build
```

## 📞 Soporte

Si encuentras problemas durante la instalación:

1. Revisa esta guía paso a paso
2. Verifica que todos los prerrequisitos están instalados
3. Consulta los logs de error en detalle
4. Busca en [GitHub Issues](https://github.com/gbandala/cal-backend-v3/issues)
5. Crea un nuevo issue con:
   - Descripción del problema
   - Pasos para reproducir
   - Logs de error
   - Información del sistema (OS, versiones de Node.js, etc.)

---

**✅ ¡Instalación completada!** Tu instancia de Cal Backend v3 debería estar funcionando correctamente.

*Última actualización: Junio 2025*