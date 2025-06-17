# 📅 Cal Backend v3

Una aplicación backend completa para gestión de calendarios y programación de reuniones, inspirada en Calendly. Permite a los usuarios crear eventos, gestionar su disponibilidad e integrar con múltiples servicios de calendario y videoconferencia.

## 🚀 **Características Principales**

### 👤 **Autenticación Segura**
- Registro de usuarios con validación de datos
- Login seguro con JWT tokens
- Generación automática de usernames únicos
- Hash seguro de contraseñas con bcrypt
- Middleware de autenticación con Passport JWT

### 📅 **Gestión de Eventos**
- Crear eventos personalizados con título, descripción y duración
- ✅ **Múltiples tipos de ubicación:**
  - 🔵 **Google Meet + Calendar** - Eventos con Google Meet automático
  - 🟠 **Zoom + Google Calendar** - Reuniones Zoom en calendario Google
  - 🟣 **Outlook + Zoom** - Reuniones Zoom en calendario Outlook
- Eventos públicos/privados con toggle de privacidad
- URLs amigables con slugs únicos
- Eventos públicos accesibles sin autenticación
- Eliminación en cascada - Elimina eventos y cancela reuniones automáticamente

### ⏰ **Gestión de Disponibilidad**
- Configuración de horarios por día de la semana
- Intervalos de tiempo personalizables entre reuniones
- Horarios disponibles/no disponibles por día
- Consulta pública de disponibilidad para eventos
- Slots de tiempo automáticos basados en duración del evento
- Soporte completo para zonas horarias (IANA)

### 🔗 **Integraciones Múltiples**
- ✅ **Google Calendar + Meet** - OAuth2 con scopes ampliados
- ✅ **Zoom Meetings** - API completa de Zoom
- ✅ **Microsoft Outlook + Zoom** - Microsoft Graph API
- Gestión automática de tokens con refresh automático
- Validación de conexiones activas
- URLs de autorización dinámicas

### 🤝 **Programación de Reuniones**
- Programación de reuniones por invitados
- ✅ **Calendario inteligente** - Usa el calendario configurado del evento
- Creación automática en calendarios específicos
- Enlaces automáticos según el tipo de integración
- Estados de reunión (programada, cancelada)
- Filtros por estado (próximas, pasadas, canceladas)
- ✅ **Cancelación inteligente** - Elimina del calendario y plataforma correctos

## 🛠️ **Stack Tecnológico**

### **Backend Core**
- **Node.js** - Runtime de JavaScript
- **TypeScript** - Tipado estático para mayor seguridad
- **Express.js** - Framework web minimalista y flexible
- **TypeORM** - ORM moderno para base de datos
- **PostgreSQL** - Base de datos principal con sincronización automática

### **Seguridad y Autenticación**
- **Passport.js** - Estrategias de autenticación
- **JWT** - JSON Web Tokens para sesiones
- **bcrypt** - Hash seguro de contraseñas
- **CORS** - Cross-Origin Resource Sharing configurado

### **Validación y Transformación**
- **class-validator** - Validación robusta de DTOs
- **class-transformer** - Transformación de objetos

### **Integraciones Externas**
- **Google APIs** - Calendar y Meet
- **Microsoft Graph API** - Outlook Calendar
- **Zoom API** - Meetings y Webinars
- **OAuth2** - Autenticación segura con servicios externos

### **Utilidades**
- **date-fns** - Manejo moderno de fechas y zonas horarias
- **uuid** - Generación de IDs únicos
- **js-base64** - Codificación base64

## 📊 **Modelo de Datos**

### **👤 User**
```typescript
{
  id: UUID,
  name: string,
  username: string (único),
  email: string (único),
  password: string (hasheado),
  imageUrl?: string,
  timezone?: string,
  availability: Availability (1:1),
  events: Event[] (1:N),
  integrations: Integration[] (1:N),
  meetings: Meeting[] (1:N)
}
```

### **📅 Event**
```typescript
{
  id: UUID,
  title: string,
  description?: string,
  duration: number (minutos),
  slug: string (único por usuario),
  isPrivate: boolean,
  locationType: 'GOOGLE_MEET_AND_CALENDAR' | 'ZOOM_MEETING' | 'OUTLOOK_WITH_ZOOM',
  calendar_id: string,
  calendar_name?: string,
  user: User (N:1),
  meetings: Meeting[] (1:N)
}
```

### **⏰ Availability**
```typescript
{
  id: UUID,
  timeGap: number (minutos entre reuniones),
  user: User (1:1),
  days: DayAvailability[] (1:N)
}
```

### **📆 DayAvailability**
```typescript
{
  id: UUID,
  day: 'SUNDAY' | 'MONDAY' | ... | 'SATURDAY',
  startTime: Date,
  endTime: Date,
  isAvailable: boolean,
  availability: Availability (N:1)
}
```

### **🔗 Integration**
```typescript
{
  id: UUID,
  provider: 'GOOGLE' | 'ZOOM' | 'MICROSOFT',
  category: 'CALENDAR_AND_VIDEO_CONFERENCING' | 'VIDEO_CONFERENCING' | 'CALENDAR',
  app_type: 'GOOGLE_MEET_AND_CALENDAR' | 'ZOOM_MEETING' | 'OUTLOOK_CALENDAR' | 'OUTLOOK_WITH_ZOOM',
  access_token: string,
  refresh_token?: string,
  expiry_date?: number,
  metadata: JSON,
  isConnected: boolean,
  // Campos específicos por proveedor
  calendar_id?: string,           // Google
  calendar_name?: string,         // Google
  zoom_user_id?: string,          // Zoom
  zoom_account_id?: string,       // Zoom
  outlook_calendar_id?: string,   // Microsoft
  outlook_calendar_name?: string, // Microsoft
  user: User (N:1)
}
```

### **🤝 Meeting**
```typescript
{
  id: UUID,
  guestName: string,
  guestEmail: string,
  additionalInfo?: string,
  startTime: Date,
  endTime: Date,
  meetLink: string,
  calendarEventId: string,
  calendarAppType: string,
  calendar_id?: string,           // Para Google Meet y Outlook + Zoom
  zoom_meeting_id?: number,       // Para Zoom y Outlook + Zoom
  zoom_join_url?: string,         // Para Zoom y Outlook + Zoom
  zoom_start_url?: string,        // Para Zoom y Outlook + Zoom
  status: 'SCHEDULED' | 'CANCELLED',
  user: User (N:1),
  event: Event (N:1)
}
```

## 🔐 **Seguridad Implementada**

- **Autenticación JWT** con tokens seguros
- **Hash de contraseñas** con bcrypt y salt rounds
- **Validación de entrada** con class-validator
- **Middleware de autenticación** en rutas protegidas
- **Manejo seguro de tokens OAuth** con refresh automático
- **Validación de ownership** - Solo el propietario puede modificar eventos
- **Calendario correcto** - Reuniones solo en calendarios del usuario
- **CORS configurado** para orígenes específicos

## 📁 **Arquitectura del Proyecto**

```
src/
├── @types/              # Tipos TypeScript personalizados
├── config/              # Configuraciones (DB, OAuth, etc.)
├── controllers/         # Controladores de las rutas
├── database/
│   ├── dto/            # Data Transfer Objects
│   └── entities/       # Entidades de TypeORM
├── enums/              # Enumeraciones
├── middlewares/        # Middlewares personalizados
├── routes/             # Definición de rutas
├── services/           # Lógica de negocio
└── utils/              # Utilidades y helpers
```

**Principios de diseño:**
- **Arquitectura en capas** (Controllers → Services → Repository)
- **DTOs para validación** de entrada
- **Entities con TypeORM** para modelado de datos
- **Middlewares** para funcionalidades transversales
- **Error handling centralizado**
- **Separation of concerns** - Cada servicio maneja su dominio

## 🏃‍♂️ **Quick Start**

```bash
# 1. Clonar repositorio
git clone https://github.com/gbandala/cal-backend-v3.git
cd cal-backend-v3

# 2. Instalar dependencias
npm install

# 3. Configurar variables de entorno
cp .env.example .env
# Editar .env con tus configuraciones

# 4. Configurar base de datos
npm run db:setup

# 5. Ejecutar en desarrollo
npm run dev
```

## 📚 **Documentación Completa**

- **[🛠️ Setup y Configuración](./SETUP.md)** - Guía completa de instalación
- **[📋 API Reference](./API.md)** - Documentación de endpoints
- **[⚙️ Funcional](./FUNCTIONAL.md)** - Flujos y casos de uso

## 🔄 **Scripts Disponibles**

```bash
npm run dev          # Desarrollo con hot-reload
npm run build        # Compilar TypeScript
npm start           # Ejecutar en producción
npm run db:setup    # Configurar base de datos
npm test            # Ejecutar tests
```

## 🐛 **Debugging y Logs**

- **Logs de errores** en consola con contexto
- **Información de conexión** a base de datos
- **Tracking de operaciones** de calendar_id
- **Manejo de errores HTTP** estructurado

## ✨ **Estado Actual**

### **✅ Funcionalidades Completadas**
- ✅ **OAuth con múltiples proveedores** - Google, Zoom, Microsoft
- ✅ **Eventos en calendarios específicos** - No más "primary" hardcodeado
- ✅ **Reuniones en calendario correcto** - Usa calendar_id del evento
- ✅ **Cancelación inteligente** - Del calendario específico y plataforma
- ✅ **Eliminación en cascada** - Events → Meetings → Calendars
- ✅ **Gestión de tokens** - Refresh automático funcionando
- ✅ **Soporte completo Outlook + Zoom** - Nueva integración

### **🚧 Roadmap**
- 🚧 **Cache de calendarios** - Sincronización automática desde proveedores
- 🚧 **Endpoints /api/calendars** - CRUD completo de calendarios
- 🚧 **Reasignación de calendarios** - Cambiar calendario de eventos existentes
- 🚧 **Dashboard multi-calendario** - Vista unificada
- 🚧 **Analytics por calendario** - Métricas específicas
- 🚧 **Webhooks** - Notificaciones en tiempo real

## 🤝 **Contribución**

1. Fork el proyecto
2. Crear rama feature (`git checkout -b feature/nueva-funcionalidad`)
3. Commit cambios (`git commit -m 'Add nueva funcionalidad'`)
4. Push a la rama (`git push origin feature/nueva-funcionalidad`)
5. Abrir Pull Request

## 📄 **Licencia**

Este proyecto está bajo la Licencia ISC.

## 👨‍💻 **Autor**

**gbandala** - [GitHub](https://github.com/gbandala)

## 🙏 **Agradecimientos**

- Inspirado en Calendly por la simplicidad y elegancia
- Gracias a la comunidad de TypeScript y Node.js
- Google, Microsoft y Zoom APIs por las integraciones robustas

---

**✅ Versión 3.0** - Soporte completo para múltiples integraciones de calendario y videoconferencia

**Última actualización:** Junio 2025  
**Estado:** Core functionality completada, nuevas integraciones en desarrollo