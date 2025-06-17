# Cal Backend V2 🗓️

> Una aplicación backend completa para gestión de calendarios y programación de reuniones, inspirada en Calendly. Permite a los usuarios crear eventos, gestionar su disponibilidad e integrar con servicios como Google Calendar y Google Meet.

[![Node.js](https://img.shields.io/badge/Node.js-16+-green.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-14+-blue.svg)](https://www.postgresql.org/)
[![License: ISC](https://img.shields.io/badge/License-ISC-yellow.svg)](https://opensource.org/licenses/ISC)

## 🚀 Características Principales

### 🔐 Autenticación Robusta
- Registro de usuarios con validación completa de datos
- Login seguro con JWT tokens
- Generación automática de usernames únicos
- Hash seguro de contraseñas con bcrypt
- Middleware de autenticación con Passport JWT

### 📅 Gestión Avanzada de Eventos
- **Calendarios específicos** - Los eventos pueden crearse en calendarios particulares de Google Calendar
- **Scope OAuth ampliado** - Incluye permisos para calendarios específicos  
- **Reuniones en calendario correcto** - Las citas van al calendario configurado del evento
- **Eliminación inteligente** - Cancelación desde el calendario correcto
- Eventos públicos/privados con toggle de privacidad
- URLs amigables con slugs únicos
- Tipos de ubicación (Google Meet, Zoom, etc.)
- Eliminación en cascada - Elimina eventos y cancela reuniones automáticamente

### ⏰ Sistema de Disponibilidad
- Configuración de horarios por día de la semana
- Intervalos de tiempo personalizables entre reuniones
- Horarios disponibles/no disponibles por día
- Consulta pública de disponibilidad para eventos
- **Manejo inteligente de zonas horarias** - Soporte completo IANA
- Slots de tiempo automáticos basados en duración del evento

### 🔗 Integraciones Potentes
- **OAuth2 con Google** para Calendar y Meet
- **Scope ampliado** - Incluye permisos para calendarios específicos
- Gestión automática de tokens con refresh automático
- Múltiples proveedores (Google configurado, Zoom/Microsoft preparados)
- Validación de conexiones activas
- URLs de autorización dinámicas

### 🤝 Programación de Reuniones
- Programación de reuniones por invitados
- **Calendario inteligente** - Usa el calendario configurado del evento
- Creación automática en Google Calendar
- Enlaces automáticos de Google Meet
- Estados de reunión (programada, cancelada)
- Filtros por estado (próximas, pasadas, canceladas)
- **Cancelación inteligente** - Elimina del calendario correcto
- **Manejo optimizado de fechas** - Tratamiento correcto de UTC/Local

## 🛠️ Stack Tecnológico

### Backend Core
- **Node.js** - Runtime de JavaScript
- **TypeScript** - Tipado estático
- **Express.js** - Framework web
- **TypeORM** - ORM para base de datos
- **PostgreSQL** - Base de datos principal

### Seguridad & Autenticación
- **Passport.js** - Estrategias de autenticación
- **JWT** - JSON Web Tokens
- **bcrypt** - Hash de contraseñas
- **CORS** - Cross-Origin Resource Sharing

### Validación & Transformación
- **class-validator** - Validación de DTOs
- **class-transformer** - Transformación de objetos

### Integraciones & APIs
- **Google APIs** - Calendar y Meet
- **OAuth2** - Autenticación con servicios externos

### Utilidades
- **date-fns** - Manejo avanzado de fechas y zonas horarias
- **uuid** - Generación de IDs únicos
- **js-base64** - Codificación base64

## 📚 Documentación

- **[📖 Guía de Instalación](./docs/SETUP.md)** - Configuración paso a paso
- **[🔌 Documentación de API](./docs/API.md)** - Endpoints y ejemplos
- **[🤝 Guía de Contribución](./docs/CONTRIBUTING.md)** - Cómo contribuir al proyecto
- **[📋 Registro de Cambios](./docs/CHANGELOG.md)** - Historial de versiones

## ⚡ Inicio Rápido

### Prerrequisitos
- Node.js (v16 o superior)
- PostgreSQL (v14 o superior)
- Cuenta de Google Cloud Console

### Instalación

```bash
# Clonar el repositorio
git clone https://github.com/gbandala/cal-backend-v2.git
cd cal-backend-v2

# Instalar dependencias
npm install

# Configurar variables de entorno
cp .env.example .env
# Editar .env con tus configuraciones

# Configurar base de datos
npm run db:setup

# Ejecutar en desarrollo
npm run dev
```

La aplicación estará disponible en `http://localhost:8000`

## 🏗️ Arquitectura

```
src/
├── @types/           # Tipos TypeScript personalizados
├── config/           # Configuraciones (DB, OAuth, etc.)
├── controllers/      # Controladores de las rutas
├── database/
│   ├── dto/         # Data Transfer Objects
│   └── entities/    # Entidades de TypeORM
├── enums/           # Enumeraciones
├── middlewares/     # Middlewares personalizados
├── routes/          # Definición de rutas
├── services/        # Lógica de negocio
└── utils/           # Utilidades y helpers
```

**Principios de diseño:**
- Arquitectura en capas (Controllers → Services → Repository)
- DTOs para validación de entrada
- Entities con TypeORM para modelado de datos
- Separation of concerns - Cada servicio maneja su dominio
- Error handling centralizado

## ✅ Estado del Proyecto

### Funcionalidades Completadas
- ✅ **OAuth con calendarios específicos** - Scopes ampliados funcionando
- ✅ **Eventos en calendarios dedicados** - No más "primary" hardcodeado  
- ✅ **Reuniones en calendario correcto** - Usa calendar_id del evento
- ✅ **Cancelación inteligente** - Del calendario específico, no primary
- ✅ **Eliminación en cascada** - Event Types → Meetings → Google Calendar
- ✅ **Manejo optimizado de fechas** - Tratamiento correcto UTC/Local
- ✅ **Gestión de tokens** - Refresh automático funcionando
- ✅ **Soporte de zonas horarias** - IANA completo

### En Desarrollo
- 🚧 **Cache de calendarios** - Sincronización automática desde Google
- 🚧 **Endpoints /api/calendars** - CRUD completo de calendarios
- 🚧 **Reasignación de calendarios** - Cambiar calendario de eventos existentes
- 🚧 **Dashboard multi-calendario** - Vista unificada
- 🚧 **Analytics por calendario** - Métricas específicas

## 🧪 Testing

```bash
# Ejecutar tests unitarios
npm test

# Ejecutar tests de integración
npm run test:integration

# Coverage de código
npm run test:coverage
```

## 🚀 Despliegue

```bash
# Compilar para producción
npm run build

# Ejecutar en producción
npm start
```

## 🤝 Contribuciones

¡Las contribuciones son bienvenidas! Por favor lee nuestra [Guía de Contribución](./docs/CONTRIBUTING.md) antes de empezar.

1. Fork el proyecto
2. Crear rama feature (`git checkout -b feature/nueva-funcionalidad`)
3. Commit cambios (`git commit -m 'Add nueva funcionalidad'`)
4. Push a la rama (`git push origin feature/nueva-funcionalidad`)
5. Abrir Pull Request

## 📝 Licencia

Este proyecto está bajo la Licencia ISC. Ver [LICENSE](LICENSE) para más detalles.

## 👨‍💻 Autor

**gbandala** - [GitHub](https://github.com/gbandala)

## 🙏 Agradecimientos

- Inspirado en Calendly
- Gracias a la comunidad de TypeScript y Node.js
- Google APIs por las integraciones de calendario

---

✅ **Versión 2.0** - Soporte completo para calendarios específicos y manejo avanzado de fechas

*Última actualización: Junio 2025*