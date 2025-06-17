# 📋 Registro de Cambios - Cal Backend V2

Todos los cambios notables de este proyecto serán documentados en este archivo.

El formato está basado en [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
y este proyecto adhiere a [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Agregado
- Cache de calendarios para sincronización automática desde Google
- Endpoints CRUD completos para gestión de calendarios
- Reasignación de calendarios para eventos existentes
- Dashboard multi-calendario con vista unificada
- Analytics por calendario con métricas específicas

### En Desarrollo
- Soporte para Microsoft Calendar API
- Integración con Zoom para videoconferencias
- Sistema de notificaciones push
- Webhooks para eventos de calendario

---

## [2.0.0] - 2025-06-10 🎉

### 🎯 Funcionalidades Principales

#### Agregado
- **Soporte completo para calendarios específicos**
  - Eventos pueden crearse en calendarios particulares de Google Calendar
  - OAuth con scopes ampliados para acceso a calendarios específicos
  - Reuniones se crean en el calendario configurado del evento (no más "primary" hardcodeado)
  - Cancelación inteligente desde el calendario correcto

- **Manejo avanzado de fechas y zonas horarias**
  - Soporte completo para zonas horarias IANA
  - Tratamiento optimizado de fechas UTC/Local para frontend
  - Conversión automática de fechas sin 'Z' para interpretación local
  - Parámetros de zona horaria en todos los endpoints relevantes

- **Eliminación en cascada inteligente**
  - Al eliminar un evento, se cancelan automáticamente todas las reuniones asociadas
  - Eliminación correcta de eventos de Google Calendar usando calendar_id específico
  - Prevención de errores de integridad referencial

- **Gestión mejorada de tokens OAuth**
  - Refresh automático de tokens de Google
  - Validación de conexiones activas
  - Manejo robusto de errores de autenticación

#### Modificado
- **Modelo de datos actualizado**
  - `Event.calendar_id`: Campo para especificar calendario (default: 'primary')
  - `Event.calendar_name`: Nombre descriptivo del calendario (opcional)
  - Validación de ownership para modificaciones de eventos

- **Servicios refactorizados**
  - `getUserMeetingsService`: Optimizado manejo de fechas para frontend
  - `createMeetingService`: Usa calendar_id del evento para crear reuniones
  - `cancelMeetingService`: Cancela desde el calendario correcto
  - `deleteEventService`: Implementa eliminación en cascada

- **API endpoints mejorados**
  - Todos los endpoints de disponibilidad soportan parámetro `timezone`
  - Filtros mejorados para reuniones: `upcoming`, `past`, `cancelled`, `all`
  - Respuestas consistentes con información de calendario

### 🔧 Correcciones

#### Corregido
- **Google Calendar Integration**
  - Scope OAuth ampliado para acceso completo a calendarios
  - Redirect URI configurado correctamente para callbacks
  - Manejo de errores mejorado para tokens expirados

- **Manejo de fechas**
  - Conversión correcta de UTC a tiempo local para frontend
  - Eliminación de 'Z' en fechas para evitar problemas de zona horaria
  - Validación de formato de fechas en DTOs

- **Base de datos**
  - Foreign key constraints corregidas
  - Relaciones de cascada configuradas correctamente
  - Índices optimizados para consultas frecuentes

- **Validación de datos**
  - DTOs actualizados con nuevos campos de calendario
  - Validación de ownership para operaciones de modificación
  - Manejo consistente de errores de validación

### 🏗️ Arquitectura

#### Refactorizado
- **Separation of concerns mejorada**
  - Cada servicio maneja su dominio específico
  - Utilities de fecha extraídas a módulo separado
  - Middlewares de autenticación optimizados

- **Error handling centralizado**
  - Respuestas de error consistentes en toda la API
  - Logging estructurado con niveles apropiados
  - Tracking de calendar_id en operaciones importantes

### 📚 Documentación

#### Agregado
- Documentación completa de API con ejemplos de calendario específico
- Guía de instalación detallada paso a paso
- Guía de contribución con estándares de código
- Diagramas de flujo para operaciones principales
- Testing de calendarios específicos en colección Postman

#### Actualizado
- README principal con nuevas funcionalidades destacadas
- Ejemplos de uso con calendar_id específico
- Configuración de Google Cloud Console con scopes ampliados

---

## [1.5.2] - 2025-06-05

### Corregido
- Error en validación de emails únicos durante registro
- Problema con generación de usernames cuando hay conflictos
- Escape de caracteres especiales en passwords con bcrypt

### Cambiado
- Mejorado logging de errores de base de datos
- Optimizada consulta de disponibilidad para eventos

---

## [1.5.1] - 2025-06-02

### Corregido
- Bug en conversión de zonas horarias para eventos públicos
- Error 500 cuando no hay integraciones configuradas
- Problema con refresh tokens de Google caducados

### Agregado
- Validación adicional para parámetros de fecha en endpoints

---

## [1.5.0] - 2025-05-28

### Agregado
- **Sistema de disponibilidad avanzado**
  - Configuración por día de la semana
  - Intervalos personalizables entre reuniones
  - Consulta pública de slots disponibles

- **Mejoras en autenticación**
  - Middleware de autenticación con Passport JWT
  - Generación automática de usernames únicos
  - Hash seguro con bcrypt y salt rounds

### Cambiado
- Estructura de base de datos optimizada para disponibilidad
- DTOs actualizados para nuevos campos de configuración

---

## [1.4.0] - 2025-05-20

### Agregado
- **Integración básica con Google Calendar**
  - OAuth2 flow implementado
  - Creación de eventos en Google Calendar
  - Generación automática de enlaces Google Meet

- **Estados de reunión**
  - Programada, cancelada, completada
  - Filtros por estado en endpoints

### Corregido
- Validación de formato de email mejorada
- Manejo de errores en creación de eventos

---

## [1.3.0] - 2025-05-15

### Agregado
- **Sistema de eventos completo**
  - Creación de eventos con título, descripción y duración
  - URLs amigables con slugs únicos
  - Toggle de privacidad para eventos
  - Tipos de ubicación (Google Meet, Zoom, etc.)

- **API RESTful estructurada**
  - Controllers organizados por funcionalidad
  - DTOs para validación de entrada
  - Responses estructuradas y consistentes

### Cambiado
- Arquitectura refactorizada en capas
- Middlewares centralizados

---

## [1.2.0] - 2025-05-10

### Agregado
- **Programación básica de reuniones**
  - Creación de reuniones por invitados
  - Información de contacto para invitados
  - Campos adicionales personalizables

- **Base de datos relacional**
  - Entidades con TypeORM
  - Relaciones User → Events → Meetings
  - Migraciones automáticas en desarrollo

### Corregido
- Sincronización de esquema de base de datos
- Validación de tipos en DTOs

---

## [1.1.0] - 2025-05-05

### Agregado
- **Autenticación básica JWT**
  - Registro de usuarios con validación
  - Login con tokens JWT
  - Middleware de protección de rutas

- **Configuración de entorno**
  - Variables de entorno estructuradas
  - Configuración de CORS
  - Logging básico de aplicación

### Cambiado
- Estructura de proyecto organizada en módulos
- Configuración de TypeScript optimizada

---

## [1.0.0] - 2025-05-01

### Agregado
- **Proyecto inicial**
  - Setup básico con Node.js + TypeScript + Express
  - Configuración de PostgreSQL con TypeORM
  - Estructura de carpetas básica
  - Scripts de desarrollo y producción

- **Modelos de datos fundamentales**
  - Entidad User básica
  - Configuración de base de datos
  - Health check endpoint

### Configuración
- Configuración inicial de repositorio Git
- README básico con instrucciones
- Configuración de ESLint y Prettier
- Scripts npm para desarrollo

---

## 🎯 Roadmap Futuro

### v2.1.0 (Próximo Release)
- [ ] **Sistema de cache avanzado**
  - Cache de calendarios Google con Redis
  - Sincronización automática en background
  - Invalidación inteligente de cache

- [ ] **Endpoints de gestión de calendarios**
  - CRUD completo para calendarios
  - Listado de calendarios disponibles
  - Sincronización manual de calendarios

### v2.2.0
- [ ] **Integraciones adicionales**
  - Microsoft Calendar/Outlook
  - Zoom para videoconferencias
  - Apple Calendar (iCal)

- [ ] **Analytics y métricas**
  - Dashboard multi-calendario
  - Métricas por calendario
  - Reportes de uso

### v2.3.0
- [ ] **Funcionalidades avanzadas**
  - Reuniones recurrentes
  - Templates de eventos
  - Automatización con Zapier/webhooks

### v3.0.0 (Mayor)
- [ ] **Arquitectura de microservicios**
  - Separación en servicios independientes
  - Event sourcing para auditoría
  - API GraphQL opcional

---

## 📝 Notas de Migración

### Migración de v1.x a v2.0

#### Cambios Breaking
- **Campo `calendar_id` agregado a Event**: Eventos existentes tendrán `calendar_id = 'primary'` por defecto
- **Manejo de fechas cambiado**: Las fechas ahora se devuelven sin 'Z' para tiempo local
- **Scopes OAuth ampliados**: Necesario reautorizar integraciones de Google

#### Pasos de migración
1. Ejecutar migraciones de base de datos: `npm run db:migration:run`
2. Actualizar configuración OAuth en Google Cloud Console
3. Solicitar a usuarios reautorizar integraciones de Google
4. Verificar que aplicaciones frontend manejen formato de fecha sin 'Z'

### Para Desarrolladores

#### APIs Deprecadas
- ❌ `GET /api/events/all` (sin información de calendario) → ✅ `GET /api/event/all` (con calendar info)
- ❌ Fechas con 'Z' en responses → ✅ Fechas sin 'Z' para tiempo local

#### Nuevas Dependencias
```json
{
  "date-fns": "^2.29.3",    // Manejo avanzado de fechas
  "date-fns-tz": "^2.0.0"   // Soporte zonas horarias
}
```

---

## 👥 Contribuyentes

### v2.0.0
- **gbandala** - Implementación de calendarios específicos y manejo de fechas
- **Community** - Reporte de bugs y feedback invaluable

### Todos los Contribuyentes
Un agradecimiento especial a todos los que han contribuido al proyecto:
- Issues reportados: 25+
- Pull requests: 15+
- Líneas de código agregadas: 10,000+

---

**Tipos de cambios:**
- `Agregado` para nuevas funcionalidades
- `Cambiado` para cambios en funcionalidad existente
- `Deprecado` para funcionalidades que serán removidas pronto
- `Removido` para funcionalidades removidas
- `Corregido` para cualquier corrección de bug
- `Seguridad` en caso de vulnerabilidades