# 🔌 Documentación de API - Cal Backend V2

> Documentación completa de todos los endpoints disponibles en Cal Backend V2

## 📋 Índice

- [Autenticación](#-autenticación)
- [Eventos](#-eventos)
- [Disponibilidad](#-disponibilidad)
- [Integraciones](#-integraciones)  
- [Reuniones](#-reuniones)
- [Modelos de Datos](#-modelos-de-datos)
- [Códigos de Error](#-códigos-de-error)

## 🔐 Autenticación

### Base URL
```
http://localhost:8000/api/auth
```

### Registrar Usuario
```http
POST /register
```

**Body:**
```json
{
  "name": "Dr. Juan Pérez",
  "email": "dr.juan@ejemplo.com", 
  "password": "password123"
}
```

**Respuesta exitosa (201):**
```json
{
  "success": true,
  "message": "Usuario registrado exitosamente",
  "data": {
    "user": {
      "id": "uuid-generado",
      "name": "Dr. Juan Pérez",
      "username": "dr-juan-perez-1234",
      "email": "dr.juan@ejemplo.com",
      "imageUrl": null
    },
    "token": "jwt-token-aqui"
  }
}
```

### Iniciar Sesión
```http
POST /login
```

**Body:**
```json
{
  "email": "dr.juan@ejemplo.com",
  "password": "password123"
}
```

**Respuesta exitosa (200):**
```json
{
  "success": true,
  "message": "Login exitoso",
  "data": {
    "user": {
      "id": "uuid-del-usuario",
      "name": "Dr. Juan Pérez",
      "username": "dr-juan-perez-1234",
      "email": "dr.juan@ejemplo.com"
    },
    "token": "jwt-token-aqui"
  }
}
```

## 📅 Eventos

### Base URL
```
http://localhost:8000/api/event
```

### Crear Evento
```http
POST /create
Authorization: Bearer {token}
```

**Body:**
```json
{
  "title": "Consulta Médica - 30 min",
  "description": "Consulta en calendario específico", 
  "duration": 30,
  "locationType": "GOOGLE_MEET_AND_CALENDAR",
  "calendar_id": "consultorio@gmail.com",
  "calendar_name": "Calendario Consultorio"
}
```

**Respuesta exitosa (201):**
```json
{
  "success": true,
  "message": "Evento creado exitosamente",
  "data": {
    "id": "uuid-del-evento",
    "title": "Consulta Médica - 30 min",
    "description": "Consulta en calendario específico",
    "duration": 30,
    "slug": "consulta-medica-30-min-abc123",
    "isPrivate": false,
    "locationType": "GOOGLE_MEET_AND_CALENDAR",
    "calendar_id": "consultorio@gmail.com",
    "calendar_name": "Calendario Consultorio",
    "user": {
      "id": "uuid-del-usuario",
      "username": "dr-juan-perez-1234"
    }
  }
}
```

### Obtener Eventos del Usuario
```http
GET /all
Authorization: Bearer {token}
```

**Respuesta exitosa (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid-del-evento",
      "title": "Consulta Médica - 30 min",
      "description": "Consulta en calendario específico",
      "duration": 30,
      "slug": "consulta-medica-30-min-abc123",
      "isPrivate": false,
      "locationType": "GOOGLE_MEET_AND_CALENDAR",
      "calendar_id": "consultorio@gmail.com",
      "calendar_name": "Calendario Consultorio"
    }
  ]
}
```

### Obtener Eventos Públicos
```http
GET /public/{username}
```

**Respuesta exitosa (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid-del-evento",
      "title": "Consulta Médica - 30 min",
      "duration": 30,
      "slug": "consulta-medica-30-min-abc123",
      "locationType": "GOOGLE_MEET_AND_CALENDAR"
    }
  ]
}
```

### Obtener Evento Público Específico
```http
GET /public/{username}/{slug}
```

### Cambiar Privacidad del Evento
```http
PUT /toggle-privacy
Authorization: Bearer {token}
```

**Body:**
```json
{
  "eventId": "uuid-del-evento"
}
```

### Eliminar Evento
```http
DELETE /{eventId}
Authorization: Bearer {token}
```

## ⏰ Disponibilidad

### Base URL
```
http://localhost:8000/api/availability
```

### Obtener Disponibilidad Personal
```http
GET /me?timezone={timezone}&date={date}
Authorization: Bearer {token}
```

**Parámetros de consulta:**
- `timezone` (opcional): Zona horaria IANA (ej: `America/Mexico_City`)
- `date` (opcional): Fecha específica en formato `YYYY-MM-DD`

**Respuesta exitosa (200):**
```json
{
  "success": true,
  "data": {
    "id": "uuid-availability",
    "timeGap": 15,
    "days": [
      {
        "id": "uuid-day",
        "day": "MONDAY", 
        "startTime": "2025-06-10T09:00:00.000",
        "endTime": "2025-06-10T17:00:00.000",
        "isAvailable": true
      }
    ]
  }
}
```

### Obtener Disponibilidad para Evento Público
```http
GET /public/{eventId}?timezone={timezone}&date={date}
```

**Respuesta exitosa (200):**
```json
{
  "success": true,
  "data": {
    "eventInfo": {
      "title": "Consulta Médica - 30 min",
      "duration": 30,
      "locationType": "GOOGLE_MEET_AND_CALENDAR"
    },
    "availableSlots": [
      {
        "startTime": "2025-06-10T09:00:00.000",
        "endTime": "2025-06-10T09:30:00.000"
      },
      {
        "startTime": "2025-06-10T09:45:00.000", 
        "endTime": "2025-06-10T10:15:00.000"
      }
    ]
  }
}
```

### Actualizar Disponibilidad
```http
PUT /update?timezone={timezone}
Authorization: Bearer {token}
```

**Body:**
```json
{
  "timeGap": 15,
  "days": [
    {
      "day": "MONDAY",
      "startTime": "09:00",
      "endTime": "17:00", 
      "isAvailable": true
    },
    {
      "day": "TUESDAY",
      "startTime": "10:00",
      "endTime": "16:00",
      "isAvailable": true
    }
  ]
}
```

## 🔗 Integraciones

### Base URL
```
http://localhost:8000/api/integration
```

### Obtener Todas las Integraciones
```http
GET /all
Authorization: Bearer {token}
```

**Respuesta exitosa (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid-integration",
      "provider": "GOOGLE",
      "category": "CALENDAR", 
      "app_type": "GOOGLE_CALENDAR_AND_MEET",
      "isConnected": true,
      "metadata": {
        "email": "usuario@gmail.com",
        "calendars": [
          {
            "id": "primary",
            "summary": "usuario@gmail.com"
          },
          {
            "id": "consultorio@gmail.com", 
            "summary": "Calendario Consultorio"
          }
        ]
      }
    }
  ]
}
```

### Verificar Estado de Integración
```http
GET /check/{appType}
Authorization: Bearer {token}
```

**Respuesta exitosa (200):**
```json
{
  "success": true,
  "data": {
    "isConnected": true,
    "provider": "GOOGLE",
    "lastSync": "2025-06-10T14:30:00.000Z"
  }
}
```

### Obtener URL de Conexión OAuth
```http
GET /connect/{appType}
Authorization: Bearer {token}
```

**Respuesta exitosa (200):**
```json
{
  "success": true,
  "data": {
    "authUrl": "https://accounts.google.com/oauth2/auth?client_id=...&scope=https://www.googleapis.com/auth/calendar..."
  }
}
```

### Callback OAuth de Google
```http
GET /google/callback?code={authorization_code}&state={state}
```

## 🤝 Reuniones

### Base URL
```
http://localhost:8000/api/meeting
```

### Obtener Reuniones del Usuario
```http
GET /user/all?filter={filter}
Authorization: Bearer {token}
```

**Parámetros de consulta:**
- `filter`: `upcoming` | `past` | `cancelled` | `all`

**Respuesta exitosa (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid-meeting",
      "guestName": "María García",
      "guestEmail": "maria@ejemplo.com",
      "startTime": "2025-06-15T10:00:00.000",
      "endTime": "2025-06-15T10:30:00.000", 
      "meetLink": "https://meet.google.com/abc-defg-hij",
      "status": "SCHEDULED",
      "additionalInfo": "Primera consulta",
      "event": {
        "title": "Consulta Médica - 30 min",
        "duration": 30
      }
    }
  ]
}
```

### Crear Reunión Pública
```http
POST /public/create
```

**Body:**
```json
{
  "eventId": "uuid-del-evento",
  "startTime": "2025-06-15T10:00:00.000Z",
  "endTime": "2025-06-15T10:30:00.000Z",
  "guestName": "María García",
  "guestEmail": "maria@ejemplo.com", 
  "additionalInfo": "Primera consulta"
}
```

**Respuesta exitosa (201):**
```json
{
  "success": true,
  "message": "Reunión creada exitosamente",
  "data": {
    "id": "uuid-meeting",
    "guestName": "María García",
    "guestEmail": "maria@ejemplo.com",
    "startTime": "2025-06-15T10:00:00.000",
    "endTime": "2025-06-15T10:30:00.000",
    "meetLink": "https://meet.google.com/abc-defg-hij",
    "status": "SCHEDULED",
    "calendarEventId": "google-calendar-event-id"
  }
}
```

### Cancelar Reunión
```http
PUT /cancel/{meetingId}
Authorization: Bearer {token}
```

**Respuesta exitosa (200):**
```json
{
  "success": true,
  "message": "Reunión cancelada exitosamente",
  "data": {
    "id": "uuid-meeting",
    "status": "CANCELLED"
  }
}
```

## 📊 Modelos de Datos

### Usuario
```typescript
interface User {
  id: string;           // UUID
  name: string;         // Nombre completo
  username: string;     // Username único
  email: string;        // Email único
  password: string;     // Hash bcrypt
  imageUrl?: string;    // URL imagen perfil
}
```

### Evento
```typescript
interface Event {
  id: string;           // UUID
  title: string;        // Título del evento
  description?: string; // Descripción opcional
  duration: number;     // Duración en minutos
  slug: string;         // Slug único por usuario
  isPrivate: boolean;   // Privacidad
  locationType: EventLocationEnum;
  calendar_id: string;  // ID calendario específico
  calendar_name?: string; // Nombre calendario
}
```

### Reunión
```typescript
interface Meeting {
  id: string;              // UUID
  guestName: string;       // Nombre invitado
  guestEmail: string;      // Email invitado  
  additionalInfo?: string; // Info adicional
  startTime: Date;         // Fecha/hora inicio
  endTime: Date;           // Fecha/hora fin
  meetLink: string;        // Enlace Meet
  calendarEventId: string; // ID evento Google
  status: MeetingStatus;   // Estado reunión
}
```

### Disponibilidad
```typescript
interface Availability {
  id: string;        // UUID
  timeGap: number;   // Minutos entre reuniones
  days: DayAvailability[];
}

interface DayAvailability {
  id: string;           // UUID
  day: DayOfWeekEnum;   // Día semana
  startTime: Date;      // Hora inicio
  endTime: Date;        // Hora fin  
  isAvailable: boolean; // Disponible
}
```

## ⚠️ Códigos de Error

### Errores de Autenticación
- `401` - Token inválido o expirado
- `403` - Permisos insuficientes  
- `404` - Usuario no encontrado

### Errores de Validación
- `400` - Datos de entrada inválidos
- `409` - Conflicto (email/username duplicado)
- `422` - Error de validación específico

### Errores de Integración
- `502` - Error en servicio externo (Google)
- `503` - Servicio no disponible
- `429` - Límite de requests excedido

### Ejemplo de Respuesta de Error
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Email ya está en uso",
    "details": {
      "field": "email",
      "value": "usuario@ejemplo.com"
    }
  }
}
```

## 🌍 Soporte de Zonas Horarias

Todos los endpoints que manejan fechas soportan el parámetro `timezone`:

```bash
# Ejemplos de zonas horarias válidas
America/Mexico_City
Europe/Madrid  
Asia/Tokyo
America/New_York
UTC
```

**Formato de fechas:**
- **Input**: ISO 8601 con Z (`2025-06-15T10:00:00.000Z`)
- **Output**: ISO 8601 sin Z (`2025-06-15T10:00:00.000`) para horario local

## 📝 Notas Importantes

1. **Autenticación**: Todos los endpoints marcados con 🔒 requieren header `Authorization: Bearer {token}`

2. **Rate Limiting**: Máximo 100 requests por minuto por IP

3. **CORS**: Configurado para `http://localhost:3000` en desarrollo

4. **Fechas**: Siempre usar formato ISO 8601. El backend maneja automáticamente la conversión UTC/Local

5. **Calendarios**: El `calendar_id` debe ser un calendario válido del usuario autenticado

6. **Webhooks**: Disponibles para notificaciones de reuniones (próximamente)

---

Para más información sobre implementación, consulta el [README principal](../README.md) o la [Guía de Configuración](./SETUP.md).