# 🔌 API Documentation - Cal Backend v3.0

> **Documentación completa de la API REST**  
> Endpoints modernos con soporte para múltiples proveedores y estrategias

[![API Version](https://img.shields.io/badge/API-v3.0-blue.svg)](https://github.com/gbandala/cal-backend-v3)
[![Response Format](https://img.shields.io/badge/Format-JSON-green.svg)](https://www.json.org/)
[![Authentication](https://img.shields.io/badge/Auth-JWT-orange.svg)](https://jwt.io/)

---

## 📋 Tabla de Contenidos

- [🔐 Autenticación](#-autenticación)
- [👤 Usuarios](#-usuarios)
- [📅 Event Types](#-event-types)
- [🤝 Reuniones](#-reuniones)
- [📆 Calendarios](#-calendarios)
- [⚡ Integraciones](#-integraciones)
- [🔍 Disponibilidad](#-disponibilidad)
- [❌ Manejo de Errores](#-manejo-de-errores)
- [📊 Códigos de Estado](#-códigos-de-estado)

---

## 🌐 Base URL

```
Production: https://api.cal-backend-v3.com
Development: http://localhost:8000
```

## 🔐 Autenticación

Todos los endpoints protegidos requieren un token JWT en el header `Authorization`.

```http
Authorization: Bearer <jwt_token>
```

### **POST** `/api/auth/register`

Registra un nuevo usuario en el sistema.

**Request Body:**
```json
{
  "name": "Juan Pérez",
  "email": "juan@ejemplo.com",
  "password": "password123",
  "timezone": "America/Mexico_City"
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid-123",
      "name": "Juan Pérez",
      "email": "juan@ejemplo.com",
      "username": "juan-perez-1234",
      "timezone": "America/Mexico_City",
      "createdAt": "2025-06-22T10:00:00Z"
    },
    "token": "eyJhbGciOiJIUzI1NiIs..."
  }
}
```

### **POST** `/api/auth/login`

Inicia sesión de usuario existente.

**Request Body:**
```json
{
  "email": "juan@ejemplo.com",
  "password": "password123"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid-123",
      "name": "Juan Pérez",
      "email": "juan@ejemplo.com",
      "username": "juan-perez-1234"
    },
    "token": "eyJhbGciOiJIUzI1NiIs..."
  }
}
```

### **POST** `/api/auth/refresh`

Renueva el token JWT.

**Headers:**
```http
Authorization: Bearer <current_token>
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "expiresAt": "2025-06-23T10:00:00Z"
  }
}
```

---

## 👤 Usuarios

### **GET** `/api/users/profile`

Obtiene el perfil del usuario autenticado.

**Headers:**
```http
Authorization: Bearer <jwt_token>
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "uuid-123",
    "name": "Juan Pérez",
    "email": "juan@ejemplo.com",
    "username": "juan-perez-1234",
    "timezone": "America/Mexico_City",
    "avatar": "https://...",
    "integrations": {
      "google": {
        "connected": true,
        "email": "juan@gmail.com",
        "calendars": ["primary", "work"]
      },
      "outlook": {
        "connected": true,
        "email": "juan@outlook.com",
        "calendars": ["Calendar"]
      },
      "zoom": {
        "connected": true,
        "email": "juan@zoom.us"
      }
    }
  }
}
```

### **PUT** `/api/users/profile`

Actualiza el perfil del usuario.

**Request Body:**
```json
{
  "name": "Juan Carlos Pérez",
  "timezone": "America/Los_Angeles",
  "avatar": "https://example.com/avatar.jpg"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "uuid-123",
    "name": "Juan Carlos Pérez",
    "timezone": "America/Los_Angeles",
    "updatedAt": "2025-06-22T10:30:00Z"
  }
}
```

---

## 📅 Event Types

### **GET** `/api/event-types`

Lista todos los tipos de eventos del usuario.

**Query Parameters:**
- `page` (optional): Número de página (default: 1)
- `limit` (optional): Elementos por página (default: 10)
- `search` (optional): Búsqueda por título
- `status` (optional): `active` | `inactive`

**Response (200):**
```json
{
  "success": true,
  "data": {
    "eventTypes": [
      {
        "id": "uuid-456",
        "title": "Consulta Médica",
        "slug": "consulta-medica",
        "description": "Consulta médica de 30 minutos",
        "duration": 30,
        "status": "active",
        "isPrivate": false,
        "location": {
          "type": "zoom-outlook",
          "calendar": "outlook",
          "meeting": "zoom"
        },
        "availability": {
          "timezone": "America/Mexico_City",
          "schedule": [
            {
              "day": "monday",
              "enabled": true,
              "slots": [
                {"start": "09:00", "end": "17:00"}
              ]
            }
          ]
        },
        "createdAt": "2025-06-22T09:00:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 5,
      "totalPages": 1
    }
  }
}
```

### **POST** `/api/event-types`

Crea un nuevo tipo de evento.

**Request Body:**
```json
{
  "title": "Reunión de Equipo",
  "description": "Reunión semanal del equipo de desarrollo",
  "duration": 60,
  "location": {
    "type": "teams-outlook",
    "calendar": "outlook",
    "meeting": "teams"
  },
  "isPrivate": false,
  "availability": {
    "timezone": "America/Mexico_City",
    "schedule": [
      {
        "day": "monday",
        "enabled": true,
        "slots": [
          {"start": "09:00", "end": "17:00"}
        ]
      },
      {
        "day": "tuesday", 
        "enabled": true,
        "slots": [
          {"start": "10:00", "end": "16:00"}
        ]
      }
    ]
  },
  "bufferTime": {
    "before": 15,
    "after": 15
  }
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "id": "uuid-789",
    "title": "Reunión de Equipo",
    "slug": "reunion-de-equipo",
    "description": "Reunión semanal del equipo de desarrollo",
    "duration": 60,
    "location": {
      "type": "teams-outlook",
      "calendar": "outlook",
      "meeting": "teams"
    },
    "strategy": "teams-outlook-calendar",
    "publicUrl": "https://cal.ejemplo.com/juan-perez-1234/reunion-de-equipo",
    "createdAt": "2025-06-22T10:15:00Z"
  }
}
```

### **GET** `/api/event-types/:id`

Obtiene un tipo de evento específico.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "uuid-456",
    "title": "Consulta Médica",
    "description": "Consulta médica de 30 minutos",
    "duration": 30,
    "location": {
      "type": "zoom-outlook",
      "calendar": "outlook",
      "meeting": "zoom",
      "strategy": "zoom-outlook-calendar"
    },
    "availability": {
      "timezone": "America/Mexico_City",
      "schedule": [...],
      "exceptions": [
        {
          "date": "2025-06-25",
          "reason": "Feriado nacional",
          "unavailable": true
        }
      ]
    },
    "meetings": {
      "total": 45,
      "upcoming": 12,
      "completed": 33
    }
  }
}
```

### **PUT** `/api/event-types/:id`

Actualiza un tipo de evento.

**Request Body:** (Campos opcionales)
```json
{
  "title": "Consulta Médica Actualizada",
  "duration": 45,
  "location": {
    "type": "google-meet",
    "calendar": "google",
    "meeting": "google-meet"
  }
}
```

### **DELETE** `/api/event-types/:id`

Elimina un tipo de evento y todas sus reuniones asociadas.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "deleted": true,
    "meetingsCanceled": 12,
    "message": "Event type and associated meetings deleted successfully"
  }
}
```

---

## 🤝 Reuniones

### **GET** `/api/meetings`

Lista todas las reuniones del usuario.

**Query Parameters:**
- `status` (optional): `upcoming` | `past` | `canceled`
- `eventTypeId` (optional): Filtrar por tipo de evento
- `from` (optional): Fecha desde (ISO 8601)
- `to` (optional): Fecha hasta (ISO 8601)
- `strategy` (optional): `zoom-outlook` | `teams-outlook` | `google-meet`

**Response (200):**
```json
{
  "success": true,
  "data": {
    "meetings": [
      {
        "id": "uuid-meeting-1",
        "title": "Consulta con Dr. Smith",
        "startTime": "2025-06-23T15:00:00Z",
        "endTime": "2025-06-23T15:30:00Z",
        "status": "scheduled",
        "strategy": "zoom-outlook-calendar",
        "attendees": [
          {
            "name": "María García",
            "email": "maria@ejemplo.com",
            "status": "accepted"
          }
        ],
        "meeting": {
          "provider": "zoom",
          "joinUrl": "https://zoom.us/j/123456789",
          "meetingId": "123456789",
          "password": "secret123"
        },
        "calendarEvent": {
          "provider": "outlook",
          "eventId": "outlook-event-123",
          "calendarId": "Calendar"
        },
        "eventType": {
          "id": "uuid-456",
          "title": "Consulta Médica",
          "slug": "consulta-medica"
        }
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 45
    }
  }
}
```

### **POST** `/api/meetings/zoom-outlook`

Crea una reunión usando Zoom + Outlook Calendar.

**Request Body:**
```json
{
  "eventTypeId": "uuid-456",
  "attendee": {
    "name": "María García",
    "email": "maria@ejemplo.com",
    "timezone": "America/Mexico_City"
  },
  "startTime": "2025-06-23T15:00:00Z",
  "notes": "Consulta de seguimiento"
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "id": "uuid-meeting-1",
    "title": "Consulta con Dr. Smith",
    "startTime": "2025-06-23T15:00:00Z",
    "endTime": "2025-06-23T15:30:00Z",
    "status": "scheduled",
    "strategy": "zoom-outlook-calendar",
    "meeting": {
      "provider": "zoom",
      "id": "123456789",
      "joinUrl": "https://zoom.us/j/123456789",
      "hostUrl": "https://zoom.us/s/123456789",
      "password": "secret123",
      "dialIn": "+1-646-558-8656,123456789#"
    },
    "calendarEvent": {
      "provider": "outlook",
      "eventId": "outlook-event-123",
      "calendarId": "Calendar",
      "webLink": "https://outlook.com/calendar/event/123"
    },
    "attendees": [
      {
        "name": "María García",
        "email": "maria@ejemplo.com",
        "status": "pending"
      }
    ],
    "executionTime": "1.8s"
  }
}
```

### **POST** `/api/meetings/teams-outlook`

Crea una reunión usando Teams + Outlook Calendar.

**Request Body:**
```json
{
  "eventTypeId": "uuid-789",
  "attendee": {
    "name": "Carlos López",
    "email": "carlos@empresa.com",
    "timezone": "America/Los_Angeles"
  },
  "startTime": "2025-06-24T14:00:00Z"
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "id": "uuid-meeting-2",
    "strategy": "teams-outlook-calendar",
    "meeting": {
      "provider": "teams",
      "id": "teams-meeting-456",
      "joinUrl": "https://teams.microsoft.com/l/meetup-join/...",
      "conferenceId": "456789123",
      "tollNumber": "+1-323-555-0100",
      "tollFreeNumber": "+1-800-555-0100"
    },
    "calendarEvent": {
      "provider": "outlook",
      "eventId": "outlook-event-456",
      "calendarId": "Calendar"
    },
    "executionTime": "2.1s"
  }
}
```

### **POST** `/api/meetings/google-meet`

Crea una reunión usando Google Calendar + Google Meet.

**Request Body:**
```json
{
  "eventTypeId": "uuid-123",
  "attendee": {
    "name": "Ana Rodríguez",
    "email": "ana@gmail.com"
  },
  "startTime": "2025-06-25T09:00:00Z"
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "strategy": "google-calendar-google-meet",
    "meeting": {
      "provider": "google-meet",
      "joinUrl": "https://meet.google.com/abc-defg-hij",
      "meetingCode": "abc-defg-hij",
      "dialIn": "+1-234-567-8900 PIN: 123456789"
    },
    "calendarEvent": {
      "provider": "google",
      "eventId": "google-event-789",
      "calendarId": "primary"
    },
    "executionTime": "1.2s"
  }
}
```

### **GET** `/api/meetings/:id`

Obtiene detalles de una reunión específica.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "uuid-meeting-1",
    "title": "Consulta con Dr. Smith",
    "startTime": "2025-06-23T15:00:00Z",
    "endTime": "2025-06-23T15:30:00Z",
    "status": "scheduled",
    "strategy": "zoom-outlook-calendar",
    "meeting": {
      "provider": "zoom",
      "joinUrl": "https://zoom.us/j/123456789",
      "hostUrl": "https://zoom.us/s/123456789",
      "password": "secret123",
      "settings": {
        "hostVideo": true,
        "participantVideo": true,
        "waitingRoom": true
      }
    },
    "calendarEvent": {
      "provider": "outlook",
      "eventId": "outlook-event-123",
      "htmlLink": "https://outlook.com/calendar/event/123"
    },
    "attendees": [
      {
        "name": "María García",
        "email": "maria@ejemplo.com",
        "status": "accepted",
        "responseTime": "2025-06-22T16:30:00Z"
      }
    ],
    "notes": "Consulta de seguimiento",
    "createdAt": "2025-06-22T12:00:00Z"
  }
}
```

### **DELETE** `/api/meetings/:id`

Cancela una reunión.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "uuid-meeting-1",
    "status": "canceled",
    "canceledAt": "2025-06-22T18:00:00Z",
    "strategy": "zoom-outlook-calendar",
    "actions": {
      "zoomMeetingDeleted": true,
      "outlookEventDeleted": true,
      "attendeesNotified": true
    }
  }
}
```

---

## 📆 Calendarios

### **GET** `/api/calendars`

Lista todos los calendarios conectados del usuario.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "calendars": [
      {
        "id": "google-primary",
        "provider": "google",
        "name": "Personal",
        "email": "juan@gmail.com",
        "primary": true,
        "accessLevel": "owner",
        "timezone": "America/Mexico_City",
        "color": "#3174ad",
        "connected": true,
        "lastSync": "2025-06-22T18:00:00Z"
      },
      {
        "id": "outlook-calendar",
        "provider": "outlook",
        "name": "Calendar", 
        "email": "juan@outlook.com",
        "primary": true,
        "accessLevel": "owner",
        "timezone": "America/Mexico_City",
        "color": "#0078d4",
        "connected": true,
        "lastSync": "2025-06-22T17:45:00Z"
      }
    ],
    "summary": {
      "total": 2,
      "connected": 2,
      "providers": ["google", "outlook"]
    }
  }
}
```

### **POST** `/api/calendars/sync`

Sincroniza calendarios con los proveedores.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "synced": [
      {
        "provider": "google",
        "calendars": 1,
        "events": 45,
        "duration": "2.3s"
      },
      {
        "provider": "outlook",
        "calendars": 1,
        "events": 23,
        "duration": "1.8s"
      }
    ],
    "totalEvents": 68,
    "syncedAt": "2025-06-22T18:30:00Z"
  }
}
```

---

## ⚡ Integraciones

### **GET** `/api/integrations`

Lista todas las integraciones disponibles y su estado.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "integrations": [
      {
        "provider": "google",
        "name": "Google Calendar + Meet",
        "connected": true,
        "email": "juan@gmail.com",
        "scopes": [
          "https://www.googleapis.com/auth/calendar",
          "https://www.googleapis.com/auth/calendar.events"
        ],
        "connectedAt": "2025-06-20T10:00:00Z",
        "lastUsed": "2025-06-22T15:30:00Z",
        "capabilities": ["calendar", "meeting"]
      },
      {
        "provider": "outlook",
        "name": "Outlook Calendar",
        "connected": true,
        "email": "juan@outlook.com",
        "scopes": [
          "https://graph.microsoft.com/Calendars.ReadWrite",
          "https://graph.microsoft.com/OnlineMeetings.ReadWrite"
        ],
        "connectedAt": "2025-06-21T14:00:00Z",
        "capabilities": ["calendar"]
      },
      {
        "provider": "zoom",
        "name": "Zoom Meetings",
        "connected": true,
        "email": "juan@zoom.us",
        "connectedAt": "2025-06-21T16:00:00Z",
        "capabilities": ["meeting"]
      },
      {
        "provider": "teams",
        "name": "Microsoft Teams",
        "connected": false,
        "capabilities": ["meeting"]
      }
    ],
    "strategies": [
      {
        "name": "google-calendar-google-meet",
        "available": true,
        "description": "Google Calendar + Google Meet"
      },
      {
        "name": "zoom-outlook-calendar", 
        "available": true,
        "description": "Zoom Meetings + Outlook Calendar"
      },
      {
        "name": "teams-outlook-calendar",
        "available": false,
        "description": "Microsoft Teams + Outlook Calendar",
        "reason": "Teams integration not connected"
      }
    ]
  }
}
```

### **POST** `/api/integrations/google/connect`

Inicia el flujo de OAuth para conectar Google.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "authUrl": "https://accounts.google.com/oauth/authorize?client_id=...",
    "state": "random-state-string",
    "expiresIn": 600
  }
}
```

### **POST** `/api/integrations/google/callback`

Completa la conexión con Google OAuth.

**Request Body:**
```json
{
  "code": "oauth-authorization-code",
  "state": "random-state-string"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "provider": "google",
    "connected": true,
    "email": "juan@gmail.com",
    "calendars": [
      {
        "id": "primary",
        "name": "Personal",
        "primary": true
      }
    ]
  }
}
```

### **POST** `/api/integrations/outlook/connect`

Conecta con Microsoft Outlook/Teams.

### **POST** `/api/integrations/zoom/connect`

Conecta con Zoom.

### **DELETE** `/api/integrations/:provider`

Desconecta una integración.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "provider": "zoom",
    "disconnected": true,
    "affectedEventTypes": 3,
    "message": "Zoom integration disconnected. 3 event types updated to use alternative providers."
  }
}
```

---

## 🔍 Disponibilidad

### **GET** `/api/availability/:username/:eventSlug`

Obtiene la disponibilidad pública para un evento.

**Query Parameters:**
- `from` (required): Fecha desde (YYYY-MM-DD)
- `to` (required): Fecha hasta (YYYY-MM-DD)
- `timezone` (optional): Zona horaria del cliente

**Response (200):**
```json
{
  "success": true,
  "data": {
    "eventType": {
      "id": "uuid-456",
      "title": "Consulta Médica",
      "duration": 30,
      "timezone": "America/Mexico_City"
    },
    "availability": [
      {
        "date": "2025-06-23",
        "available": true,
        "slots": [
          {
            "start": "09:00:00",
            "end": "09:30:00",
            "available": true,
            "datetime": "2025-06-23T15:00:00Z"
          },
          {
            "start": "09:30:00", 
            "end": "10:00:00",
            "available": true,
            "datetime": "2025-06-23T15:30:00Z"
          },
          {
            "start": "14:00:00",
            "end": "14:30:00",
            "available": false,
            "reason": "busy",
            "datetime": "2025-06-23T20:00:00Z"
          }
        ]
      },
      {
        "date": "2025-06-24",
        "available": false,
        "reason": "No working hours configured"
      }
    ],
    "timezone": "America/Mexico_City"
  }
}
```

### **POST** `/api/availability/check`

Verifica disponibilidad para múltiples rangos de tiempo.

**Request Body:**
```json
{
  "eventTypeId": "uuid-456",
  "timeSlots": [
    {
      "start": "2025-06-23T15:00:00Z",
      "end": "2025-06-23T15:30:00Z"
    },
    {
      "start": "2025-06-23T16:00:00Z", 
      "end": "2025-06-23T16:30:00Z"
    }
  ]
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "results": [
      {
        "start": "2025-06-23T15:00:00Z",
        "end": "2025-06-23T15:30:00Z",
        "available": true
      },
      {
        "start": "2025-06-23T16:00:00Z",
        "end": "2025-06-23T16:30:00Z", 
        "available": false,
        "reason": "Conflict with existing meeting",
        "conflictingMeeting": {
          "id": "uuid-meeting-5",
          "title": "Team Standup"
        }
      }
    ],
    "checkedAt": "2025-06-22T18:45:00Z"
  }
}
```

---

## 🔍 Health & Monitoring

### **GET** `/api/health`

Verifica el estado general del sistema.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "timestamp": "2025-06-22T19:00:00Z",
    "version": "3.0.0",
    "uptime": "72h 15m 30s",
    "database": {
      "status": "connected",
      "latency": "12ms"
    },
    "services": {
      "total": 5,
      "healthy": 4,
      "degraded": 1,
      "down": 0
    }
  }
}
```

### **GET** `/api/health/providers`

Estado de las integraciones externas.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "providers": [
      {
        "name": "google",
        "status": "healthy",
        "latency": "120ms",
        "lastCheck": "2025-06-22T18:59:30Z",
        "errors24h": 0
      },
      {
        "name": "outlook",
        "status": "healthy", 
        "latency": "200ms",
        "lastCheck": "2025-06-22T18:59:30Z",
        "errors24h": 2
      },
      {
        "name": "zoom",
        "status": "degraded",
        "latency": "800ms",
        "lastCheck": "2025-06-22T18:59:30Z",
        "errors24h": 15,
        "message": "High latency detected"
      }
    ],
    "strategies": [
      {
        "name": "google-calendar-google-meet",
        "available": true,
        "avgExecutionTime": "1.2s"
      },
      {
        "name": "zoom-outlook-calendar",
        "available": true, 
        "avgExecutionTime": "1.8s"
      },
      {
        "name": "teams-outlook-calendar",
        "available": false,
        "reason": "Teams provider not connected"
      }
    ]
  }
}
```

---

## ❌ Manejo de Errores

### **Estructura de Error Estándar**

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Email is required",
    "details": {
      "field": "email",
      "value": null,
      "constraint": "isEmail"
    },
    "timestamp": "2025-06-22T19:15:00Z",
    "path": "/api/auth/register"
  }
}
```

### **Tipos de Errores**

#### **Errores de Validación (400)**
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": [
      {
        "field": "startTime",
        "message": "Start time must be in the future"
      },
      {
        "field": "duration",
        "message": "Duration must be between 15 and 480 minutes"
      }
    ]
  }
}
```

#### **Errores de Autenticación (401)**
```json
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Invalid or expired token"
  }
}
```

#### **Errores de Autorización (403)**
```json
{
  "success": false,
  "error": {
    "code": "FORBIDDEN",
    "message": "You don't have permission to access this resource"
  }
}
```

#### **Errores de Recursos No Encontrados (404)**
```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Event type not found",
    "resource": "eventType",
    "id": "uuid-not-found"
  }
}
```

#### **Errores de Integración (502)**
```json
{
  "success": false,
  "error": {
    "code": "INTEGRATION_ERROR",
    "message": "Failed to create Zoom meeting",
    "provider": "zoom",
    "strategy": "zoom-outlook-calendar",
    "details": {
      "providerError": "Meeting limit exceeded",
      "retryable": true,
      "retryAfter": 300
    }
  }
}
```

#### **Errores de Rate Limiting (429)**
```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many requests",
    "retryAfter": 60,
    "limit": 100,
    "remaining": 0,
    "resetTime": "2025-06-22T20:00:00Z"
  }
}
```

---

## 📊 Códigos de Estado HTTP

| Código | Significado | Cuándo se usa |
|--------|-------------|---------------|
| **200** | OK | Operación exitosa |
| **201** | Created | Recurso creado exitosamente |
| **400** | Bad Request | Error en los datos enviados |
| **401** | Unauthorized | Token inválido o ausente |
| **403** | Forbidden | Sin permisos para el recurso |
| **404** | Not Found | Recurso no encontrado |
| **409** | Conflict | Conflicto de horarios o recursos |
| **422** | Unprocessable Entity | Error de validación |
| **429** | Too Many Requests | Rate limit excedido |
| **500** | Internal Server Error | Error interno del servidor |
| **502** | Bad Gateway | Error de integración externa |
| **503** | Service Unavailable | Servicio temporalmente no disponible |

---

## 🔧 Rate Limits

| Endpoint | Límite | Ventana | Scope |
|----------|--------|---------|--------|
| `/api/auth/*` | 10 requests | 15 minutos | IP |
| `/api/meetings` | 100 requests | 1 hora | Usuario |
| `/api/availability/*` | 1000 requests | 1 hora | IP |
| `/api/integrations/*` | 20 requests | 15 minutos | Usuario |
| **Global** | 1000 requests | 1 hora | Usuario |

---

## 🌐 Headers Importantes

### **Request Headers**
```http
Content-Type: application/json
Authorization: Bearer <jwt_token>
X-Timezone: America/Mexico_City
X-Client-Version: 3.0.0
User-Agent: Cal-Frontend/3.0.0
```

### **Response Headers**
```http
Content-Type: application/json; charset=utf-8
X-API-Version: 3.0.0
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 99
X-RateLimit-Reset: 1687788000
X-Response-Time: 123ms
```

---

## 🎯 Ejemplos de Integración

### **JavaScript/Fetch**
```javascript
// Crear reunión Zoom + Outlook
const response = await fetch('/api/meetings/zoom-outlook', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
    'X-Timezone': 'America/Mexico_City'
  },
  body: JSON.stringify({
    eventTypeId: 'uuid-456',
    attendee: {
      name: 'María García',
      email: 'maria@ejemplo.com'
    },
    startTime: '2025-06-23T15:00:00Z'
  })
});

const meeting = await response.json();
console.log('Reunión creada:', meeting.data.meeting.joinUrl);
```

### **cURL**
```bash
# Obtener disponibilidad
curl -X GET "https://api.cal-backend-v3.com/api/availability/juan-perez/consulta-medica?from=2025-06-23&to=2025-06-30" \
  -H "Content-Type: application/json"

# Crear reunión
curl -X POST "https://api.cal-backend-v3.com/api/meetings/zoom-outlook" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-jwt-token" \
  -d '{
    "eventTypeId": "uuid-456",
    "attendee": {
      "name": "María García", 
      "email": "maria@ejemplo.com"
    },
    "startTime": "2025-06-23T15:00:00Z"
  }'
```

---

## 📝 Notas Importantes

### **Zonas Horarias**
- Todos los timestamps están en **UTC** (ISO 8601)
- Use el header `X-Timezone` para especificar la zona horaria del cliente
- Los slots de disponibilidad se convierten automáticamente

### **Estrategias Disponibles**
- `google-calendar-google-meet` - ✅ Completa
- `zoom-outlook-calendar` - ✅ Completa  
- `teams-outlook-calendar` - 🚧 En desarrollo

### **Limitaciones Actuales**
- Máximo 10 attendees por reunión
- Eventos máximo 8 horas de duración
- 50 event types por usuario
- Sincronización de calendarios cada 15 minutos

---

## 🔗 Enlaces Útiles

- [📖 Guía de Inicio Rápido](/docs/SETUP.md)
- [🏗️ Documentación de Arquitectura](/docs/ARCHITECTURE.md)
- [📋 Registro de Cambios](/docs/CHANGELOG.md)
- [🤝 Guía de Contribución](/docs/CONTRIBUTING.md)
- [⚡ Postman Collection](https://documenter.getpostman.com/cal-backend-v3)

---

**🎯 API Version:** 3.0.0  
**📅 Última actualización:** Junio 22, 2025  
**🔄 Rate Limits:** Aplicados a todos los endpoints  
**🔐 Autenticación:** JWT requerida para endpoints protegidos

---

> 💡 **¿Preguntas?** Abre un issue en [GitHub](https://github.com/gbandala/cal-backend-v3/issues) o consulta la documentación completa.