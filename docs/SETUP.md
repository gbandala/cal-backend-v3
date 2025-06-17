# 🛠️ Guía de Configuración - Cal Backend V2

> Guía completa paso a paso para configurar y ejecutar Cal Backend V2 en tu entorno local

## 📋 Índice

- [Prerrequisitos](#-prerrequisitos)
- [Instalación](#-instalación)
- [Configuración de Google Cloud](#-configuración-de-google-cloud)
- [Configuración de Base de Datos](#-configuración-de-base-de-datos)
- [Variables de Entorno](#-variables-de-entorno)
- [Ejecución](#-ejecución)
- [Verificación](#-verificación)
- [Solución de Problemas](#-solución-de-problemas)

## 🔧 Prerrequisitos

### Software Requerido

| Software | Versión Mínima | Comando de Verificación |
|----------|----------------|-------------------------|
| **Node.js** | v16.0.0 | `node --version` |
| **npm** | v8.0.0 | `npm --version` |
| **PostgreSQL** | v14.0.0 | `psql --version` |
| **Git** | v2.30.0 | `git --version` |

### Instalación de Prerrequisitos

#### 🟢 Node.js y npm

**Opción 1: Descarga Oficial**
```bash
# Visita https://nodejs.org y descarga la versión LTS
# O usa el instalador de tu sistema operativo
```

**Opción 2: Usando nvm (Recomendado)**
```bash
# Instalar nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

# Reiniciar terminal o ejecutar:
source ~/.bashrc

# Instalar Node.js LTS
nvm install --lts
nvm use --lts
```

#### 🐘 PostgreSQL

**macOS (Homebrew):**
```bash
brew install postgresql@14
brew services start postgresql@14
```

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install postgresql-14 postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

**Windows:**
```bash
# Descargar desde https://www.postgresql.org/download/windows/
# O usar chocolatey:
choco install postgresql14
```

### Verificación de Instalación

```bash
# Verificar Node.js
node --version  # Debe mostrar v16.x.x o superior

# Verificar npm
npm --version   # Debe mostrar v8.x.x o superior

# Verificar PostgreSQL
psql --version  # Debe mostrar 14.x o superior

# Probar conexión a PostgreSQL
sudo -u postgres psql -c "SELECT version();"
```

## 📥 Instalación

### 1. Clonar el Repositorio

```bash
# Clonar el proyecto
git clone https://github.com/gbandala/cal-backend-v2.git

# Navegar al directorio
cd cal-backend-v2

# Verificar que estás en la rama correcta
git branch
```

### 2. Instalar Dependencias

```bash
# Instalar dependencias del proyecto
npm install

# Verificar instalación
npm list --depth=0
```

**Dependencias principales instaladas:**
- express: Framework web
- typeorm: ORM para base de datos
- passport: Autenticación
- bcryptjs: Hash de contraseñas
- jsonwebtoken: JWT tokens
- google-apis: Integración Google
- class-validator: Validación de datos

## ☁️ Configuración de Google Cloud

### 1. Crear Proyecto en Google Cloud Console

1. **Acceder a Google Cloud Console:**
   - Ir a [https://console.cloud.google.com/](https://console.cloud.google.com/)
   - Iniciar sesión con tu cuenta de Google

2. **Crear Nuevo Proyecto:**
   ```
   - Clic en el selector de proyectos (esquina superior izquierda)
   - Clic en "Nuevo Proyecto"
   - Nombre: "Cal Backend V2" (o el que prefieras)
   - Clic en "Crear"
   ```

### 2. Habilitar APIs Necesarias

```bash
# APIs requeridas para el proyecto:
```

1. **Google Calendar API:**
   - Ir a "APIs y servicios" > "Biblioteca"
   - Buscar "Google Calendar API"
   - Clic en "Habilitar"

2. **Google Meet API** (opcional pero recomendado):
   - Buscar "Google Meet API"
   - Clic en "Habilitar"

### 3. Configurar OAuth 2.0

1. **Ir a Credenciales:**
   - "APIs y servicios" > "Credenciales"
   - Clic en "+ CREAR CREDENCIALES"
   - Seleccionar "ID de cliente OAuth 2.0"

2. **Configurar Pantalla de Consentimiento:**
   ```
   - Ir a "Pantalla de consentimiento OAuth"
   - Seleccionar "Externa" (para desarrollo)
   - Completar información básica:
     * Nombre de la aplicación: "Cal Backend V2"
     * Email de soporte: tu-email@ejemplo.com
     * Dominios autorizados: localhost
   ```

3. **Crear Credenciales OAuth:**
   ```
   Tipo de aplicación: Aplicación web
   Nombre: Cal Backend OAuth
   
   URIs de origen autorizados:
   - http://localhost:8000
   
   URIs de redirección autorizados:
   - http://localhost:8000/api/integration/google/callback
   ```

4. **Configurar Scopes:**
   ```
   Scopes necesarios:
   - https://www.googleapis.com/auth/calendar
   - https://www.googleapis.com/auth/calendar.events
   - https://www.googleapis.com/auth/userinfo.email
   - https://www.googleapis.com/auth/userinfo.profile
   ```

5. **Descargar Credenciales:**
   - Clic en el ícono de descarga de las credenciales creadas
   - Guardar el JSON con los Client ID y Client Secret

## 🗄️ Configuración de Base de Datos

### 1. Configurar PostgreSQL

```bash
# Conectar como usuario postgres
sudo -u postgres psql

# Crear usuario para la aplicación
CREATE USER cal_user WITH PASSWORD 'tu_password_seguro';

# Crear base de datos
CREATE DATABASE cal_backend_v2 OWNER cal_user;

# Otorgar privilegios
GRANT ALL PRIVILEGES ON DATABASE cal_backend_v2 TO cal_user;

# Salir de psql
\q
```

### 2. Verificar Conexión

```bash
# Probar conexión con el nuevo usuario
psql -h localhost -U cal_user -d cal_backend_v2

# Si funciona, ver las tablas (debe estar vacío)
\dt

# Salir
\q
```

### 3. Configurar Acceso (si es necesario)

Editar archivo de configuración PostgreSQL:

```bash
# Ubicación típica del archivo pg_hba.conf:
# Ubuntu/Debian: /etc/postgresql/14/main/pg_hba.conf
# macOS (Homebrew): /opt/homebrew/var/postgresql@14/pg_hba.conf

# Agregar línea para acceso local:
local   cal_backend_v2  cal_user                md5
host    cal_backend_v2  cal_user    127.0.0.1/32    md5
```

Reiniciar PostgreSQL:
```bash
# Ubuntu/Debian
sudo systemctl restart postgresql

# macOS (Homebrew)
brew services restart postgresql@14
```

## 🔐 Variables de Entorno

### 1. Crear Archivo .env

```bash
# Copiar template de ejemplo
cp .env.example .env

# O crear manualmente
touch .env
```

### 2. Configurar Variables

Editar el archivo `.env` con tu editor favorito:

```bash
# Configuración del servidor
PORT=8000
NODE_ENV=development
BASE_PATH=/api

# Base de datos PostgreSQL
DATABASE_URL=postgresql://cal_user:tu_password_seguro@localhost:5432/cal_backend_v2

# JWT Configuration
JWT_SECRET=tu_jwt_secret_muy_muy_seguro_min_32_caracteres
JWT_EXPIRES_IN=1d

# Google OAuth (obtenido de Google Cloud Console)
GOOGLE_CLIENT_ID=123456789-abcdefghijklmnop.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-tu_client_secret_aqui
GOOGLE_REDIRECT_URI=http://localhost:8000/api/integration/google/callback

# Frontend Configuration (para CORS)
FRONTEND_ORIGIN=http://localhost:3000
FRONTEND_INTEGRATION_URL=http://localhost:3000/integrations

# Logging (opcional)
LOG_LEVEL=debug
```

### 3. Validar Variables

```bash
# Verificar que las variables se carguen correctamente
node -e "require('dotenv').config(); console.log('PORT:', process.env.PORT);"
```

## 🚀 Ejecución

### 1. Configurar Base de Datos

```bash
# Ejecutar migraciones (crear tablas)
npm run db:migration:run

# O si no existe el script, usar TypeORM directamente:
npx typeorm migration:run -d src/config/database.ts
```

### 2. Poblar Datos Iniciales (Opcional)

```bash
# Si existen seeders
npm run db:seed

# O crear manualmente algunos datos de prueba
```

### 3. Ejecutar en Desarrollo

```bash
# Modo desarrollo con hot-reload
npm run dev

# Debería mostrar algo como:
# 🚀 Server running on http://localhost:8000
# 📊 Database connected successfully
# ✅ Google OAuth configured
```

### 4. Ejecutar en Producción

```bash
# Compilar TypeScript
npm run build

# Ejecutar aplicación compilada
npm start
```

## ✅ Verificación

### 1. Verificar Servidor

```bash
# Probar endpoint de salud
curl http://localhost:8000/api/health

# Respuesta esperada:
# {"success": true, "message": "Server is running", "timestamp": "..."}
```

### 2. Verificar Base de Datos

```bash
# Conectar a la base de datos
psql -h localhost -U cal_user -d cal_backend_v2

# Ver tablas creadas
\dt

# Debería mostrar: users, events, meetings, etc.
```

### 3. Verificar Autenticación

```bash
# Registrar usuario de prueba
curl -X POST http://localhost:8000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Usuario Prueba",
    "email": "prueba@ejemplo.com", 
    "password": "password123"
  }'

# Debería devolver token JWT
```

### 4. Verificar Integración Google

```bash
# Obtener URL de autorización
curl -X GET http://localhost:8000/api/integration/connect/GOOGLE_CALENDAR_AND_MEET \
  -H "Authorization: Bearer TU_TOKEN_AQUI"

# Debería devolver URL de Google OAuth
```

## 🔧 Solución de Problemas

### Error: "database does not exist"

```bash
# Crear base de datos manualmente
sudo -u postgres createdb -O cal_user cal_backend_v2
```

### Error: "JWT malformed"

```bash
# Verificar que JWT_SECRET tenga al menos 32 caracteres
echo $JWT_SECRET | wc -c
```

### Error: "Google OAuth invalid_client"

```bash
# Verificar configuración en Google Cloud Console:
# 1. Client ID y Secret correctos en .env
# 2. Redirect URI exactamente igual
# 3. APIs habilitadas
```

### Error: "Port already in use"

```bash
# Verificar qué proceso usa el puerto
lsof -i :8000

# Matar proceso si es necesario
kill -9 PID_DEL_PROCESO

# O cambiar puerto en .env
PORT=8001
```

### Error: "Cannot connect to database"

```bash
# Verificar que PostgreSQL esté corriendo
sudo systemctl status postgresql

# Verificar credenciales
psql postgresql://cal_user:password@localhost:5432/cal_backend_v2 -c "SELECT 1;"
```

### Error: "Module not found"

```bash
# Limpiar caché de node
npm cache clean --force

# Reinstalar dependencias
rm -rf node_modules package-lock.json
npm install
```

## 📝 Scripts Disponibles

```bash
# Desarrollo
npm run dev           # Ejecutar en modo desarrollo
npm run build         # Compilar TypeScript
npm start            # Ejecutar en producción

# Base de datos
npm run db:migration:run     # Ejecutar migraciones
npm run db:migration:revert  # Revertir última migración
npm run db:seed             # Poblar datos iniciales

# Testing
npm test             # Ejecutar tests
npm run test:watch   # Tests en modo watch
npm run test:coverage # Coverage de código

# Linting
npm run lint         # Verificar código
npm run lint:fix     # Corregir automáticamente
```

## 🎯 Próximos Pasos

1. **Configurar Frontend**: Conectar con la aplicación frontend React/Vue
2. **Configurar SSL**: Para producción con certificados HTTPS  
3. **Configurar PM2**: Para gestión de procesos en producción
4. **Configurar Nginx**: Como proxy reverso
5. **Configurar Monitoring**: Logs y métricas de aplicación

---

¿Problemas durante la instalación? Crea un [issue en GitHub](https://github.com/gbandala/cal-backend-v2/issues) con los detalles del error.