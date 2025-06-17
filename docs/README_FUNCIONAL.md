# Sistema de Gestión de Reservas y Calendario

## 📋 Descripción General

Sistema completo de reservas y gestión de calendario que permite a usuarios crear eventos/servicios reservables y gestionar su disponibilidad. La plataforma conecta expertos/consultores con clientes a través de un sistema de reservas automatizado con integraciones externas.

**✅ FUNCIONALIDAD ACTUAL v2.0-beta**: Soporte básico para calendarios específicos de Google Calendar, permitiendo crear eventos en calendarios dedicados y gestionar reuniones en el calendario correcto.

## 🏗️ Arquitectura del Sistema

El sistema está compuesto por **cuatro servicios principales** que trabajan de manera integrada:

1. **[Servicio de Autenticación](#-servicio-de-autenticación)** - Registro y login de usuarios
2. **[Servicio de Disponibilidad](#-servicio-de-disponibilidad)** - Gestión de horarios disponibles  
3. **[Servicio de Eventos](#-servicio-de-gestión-de-eventos)** - Creación y gestión de servicios reservables
4. **[Servicio de Integraciones](#-servicio-de-integraciones)** - Conexiones con servicios externos

## 🔄 Flujo de Usuario Actual

```
REGISTRO → CONFIGURAR DISPONIBILIDAD → CONECTAR GOOGLE → CREAR EVENTOS CON CALENDARIO → RECIBIR RESERVAS
```

---

## 🔐 Servicio de Autenticación

### Descripción
Maneja el registro y autenticación de usuarios con configuración automática de disponibilidad predeterminada.

### Funcionalidades Principales

#### Registro de Usuarios (`registerService`)
- **Auto-configuración inteligente**: Crea disponibilidad L-V 9AM-5PM automáticamente
- **Username único**: Genera automáticamente desde el nombre (ej: "juanperez123abc")
- **Seguridad**: Contraseñas hasheadas, validación de emails duplicados

#### Autenticación (`loginService`)
- **JWT tokens**: Generación de tokens seguros con expiración
- **Validación robusta**: Verificación de credenciales con errores genéricos
- **Sesiones seguras**: Retorna usuario sin contraseña + token de acceso

### Flujo Funcional
1. **Registro**: Usuario proporciona datos → Sistema genera username único → Crea disponibilidad predeterminada
2. **Login**: Usuario ingresa credenciales → Validación → Generación token JWT → Sesión activa

### Características Destacadas
- **UX sin fricción**: Usuario obtiene configuración útil inmediatamente
- **Seguridad empresarial**: Manejo profesional de tokens y contraseñas
- **Escalabilidad**: Username generation con 17.5M combinaciones posibles

---

## ⏰ Servicio de Disponibilidad (✅ CON SOPORTE TIMEZONE)

### Descripción
Gestiona horarios de disponibilidad de usuarios y genera slots de tiempo disponibles para eventos públicos, considerando reuniones existentes, **✅ con soporte para diferentes zonas horarias y fechas específicas**.

### Funcionalidades Principales

#### Gestión Personal
- **Consulta disponibilidad** (`getUserAvailabilityService`): 
  - Obtiene configuración actual del usuario
  - **✅ Convierte UTC a zona horaria solicitada para visualización**
  
- **Actualización horarios** (`updateAvailabilityService`): 
  - Modifica días y horarios disponibles
  - **✅ Convierte input de usuario a UTC para almacenamiento**

#### Disponibilidad Pública
- **Slots para eventos** (`getAvailabilityForPublicEventService`): Genera horarios reservables considerando:
  - Horarios de disponibilidad configurados
  - Reuniones ya programadas en Google Calendar
  - Duración del evento
  - Intervalos entre citas (timeGap)
  - **✅ Zona horaria del usuario (visualización ajustada)**
  - **✅ Fecha específica solicitada (filtrado inteligente)**

### ✅ Mejoras Implementadas

#### Almacenamiento Normalizado
- **Formato UTC en base de datos**: Todos los horarios ahora se almacenan en UTC
- **Consistencia de datos**: Comparaciones precisas entre reuniones y disponibilidad
- **Independencia de zona**: Sistema funcional para usuarios globales

#### Visualización Adaptativa
- **Parámetro timezone**: Endpoints aceptan zona horaria del usuario
- **Conversión automática**: Slots mostrados en el horario local del usuario
- **Validación de formato**: Verificación de zonas horarias IANA válidas

#### Filtrado por Fecha
- **Parámetro date**: Permite solicitar disponibilidad para un día específico
- **Optimización de consultas**: Solo procesa el día solicitado
- **Formato estandarizado**: Usa YYYY-MM-DD para fechas

### Algoritmos Inteligentes

#### Generación de Slots
1. Para cada día de la semana calcula la próxima fecha
2. Divide horario disponible en intervalos según duración del evento
3. Consulta reuniones existentes en Google Calendar
4. Excluye slots con conflictos de reuniones existentes
5. Filtra horarios en el pasado (no permite reservar atrás en el tiempo)

#### Prevención de Conflictos
- **Validación de Google Calendar**: Detecta conflictos en tiempo real
- **Tiempo real**: No muestra slots ya pasados si es el día actual
- **Flexibilidad**: Configurable por usuario (horarios, días, intervalos)

---

## 📅 Servicio de Gestión de Eventos (✅ CON SOPORTE BÁSICO DE CALENDARIOS)

### Descripción
Maneja el ciclo completo de eventos/servicios reservables con sistema de URLs públicas, control de privacidad y **✅ asignación básica de calendarios específicos**.

### Funcionalidades Principales

#### Gestión de Eventos con Calendarios
- **Creación con calendario** (`createEventService`): 
  - ✅ Crea eventos con slug automático y validación
  - **✅ Acepta calendar_id y calendar_name específicos**
  - **✅ Usa calendario 'primary' por defecto si no se especifica**
- **Privacidad** (`toggleEventPrivacyService`): Cambia visibilidad público/privado
- **Consulta personal** (`getUserEventsService`): Lista eventos ✅ con información de calendario
- **Eliminación inteligente** (`deleteEventService`): Borra eventos ✅ y cancela reuniones automáticamente

#### Acceso Público
- **Descubrimiento** (`getPublicEventsByUsernameService`): Lista eventos públicos
- **Detalle** (`getPublicEventByUsernameAndSlugService`): Evento específico para reservar

### ✅ Casos de Uso Actuales

#### Configuración Médico Básica
```
Dr. García puede:
1. Crear evento "Consulta General" → Calendario "consultorio@gmail.com"
2. Crear evento "Teleconsulta" → Calendario principal 
3. Pacientes reservan → Van al calendario correcto automáticamente

BENEFICIO ACTUAL:
✅ Eventos organizados por calendario específico
✅ Reuniones van al calendario configurado
✅ No se mezclan con calendario personal
```

#### Configuración Consultor Básica
```
María Consultora puede:
1. Crear evento "Asesoría Empresarial" → Calendario "trabajo@gmail.com"
2. Crear evento "Mentoría Personal" → Calendario principal
3. Clientes reservan → Cada tipo va a su calendario

BENEFICIOS ACTUALES:
✅ Separación básica trabajo/personal
✅ Reuniones organizadas por tipo
✅ Enlaces Meet desde calendario correcto
```

### Arquitectura de URLs Públicas

#### Sistema SEO-Friendly
```
PATRÓN: /[username]/[event-slug]
EJEMPLO: /dr.garcia123/consulta-general

BENEFICIOS:
✅ URLs memorables y legibles
✅ Optimización para motores de búsqueda  
✅ Identificación única global de eventos
✅ Estructura escalable
```

### Integración con Calendarios

#### Flujo de Creación de Evento
```
1. Usuario especifica calendar_id al crear evento
2. Evento guardado con referencia al calendario
3. Futuras reservas van automáticamente al calendario correcto
4. Enlaces Meet generados desde calendario específico
```

#### Validación y Seguridad
- **Validación de propiedad**: Solo el dueño puede modificar/eliminar eventos
- **Datos filtrados**: Consultas públicas excluyen información sensible
- **✅ Fallback inteligente**: Usa 'primary' si calendar_id no válido

---

## 🔗 Servicio de Integraciones (✅ SCOPE AMPLIADO)

### Descripción
Gestiona conexiones OAuth con servicios externos con **✅ scope ampliado** para soporte de calendarios específicos.

### Funcionalidades Principales

#### Gestión de Conexiones
- **Estado completo** (`getUserIntegrationsService`): Lista integraciones activas
- **Verificación rápida** (`checkIntegrationService`): Confirma si integración está activa
- **Conexión OAuth ampliada** (`connectAppService`): 
  - ✅ Inicia proceso de autorización con proveedores
  - **✅ Incluye scope para calendarios específicos**
  - **✅ Solicita permisos para calendar + calendar.events**
- **Persistencia** (`createIntegrationService`): Guarda tokens tras autorización exitosa

#### Gestión de Tokens
- **Validación automática** (`validateGoogleToken`): Renueva tokens de Google automáticamente
- **✅ Scope management**: Gestiona permisos para eventos y calendarios
- **Seguridad OAuth**: Estado codificado, scopes mínimos, almacenamiento seguro

### Integraciones Soportadas

#### Google Meet & Calendar (✅ Funcionando)
- **Funcionalidad básica**: Crea eventos en Google Calendar + enlaces Meet automáticos
- **✅ Calendarios específicos**: Puede crear eventos en calendarios dedicados
- **Scopes actuales**: 
  - `calendar` (acceso completo a calendarios)
  - `calendar.events` (lectura/escritura de eventos)
- **Renovación**: Tokens se renuevan automáticamente sin intervención del usuario

#### Zoom Meeting (Preparado)
- **Estado**: Estructura configurada, implementación OAuth pendiente
- **Funcionalidad planeada**: Rooms y calendarios Zoom

#### Outlook Calendar (Preparado)  
- **Estado**: Configuración lista, integración OAuth pendiente
- **Funcionalidad planeada**: Carpetas/calendarios Outlook

### Flujo OAuth Actual
```
1. Usuario selecciona "Conectar Google Calendar"
2. Sistema genera URL OAuth con scopes ampliados
3. Usuario autoriza permisos de calendarios + eventos
4. Google retorna código + estado
5. Sistema intercambia código por tokens
6. Tokens guardados en BD de forma segura
7. ✅ Usuario puede especificar calendar_id en eventos
```

---

## 🤝 Servicio de Reuniones (✅ CALENDARIO CORRECTO)

### Descripción
Gestiona el ciclo completo de reuniones entre organizadores e invitados con **✅ creación en calendario específico** y cancelación inteligente.

### Funcionalidades Principales

#### Creación de Reuniones
- **Reserva pública** (`createMeetBookingForGuestService`):
  - ✅ Obtiene calendar_id desde el evento
  - ✅ Crea reunión en calendario específico (no 'primary')
  - ✅ Genera enlace Google Meet automáticamente
  - ✅ Guarda referencia de calendario para cancelaciones

#### Gestión de Reuniones
- **Consulta de usuario** (`getUserMeetingsService`): Lista con filtros (próximas, pasadas, canceladas)
- **Cancelación inteligente** (`cancelMeetingService`):
  - ✅ Cancela del calendario específico donde se creó
  - ✅ Busca integración del usuario correcto
  - ✅ Elimina evento de Google Calendar
  - ✅ Actualiza estado en base de datos

### ✅ Flujos Actuales

#### Flujo de Reserva Mejorado
```
Cliente visita → /usuario123abc/consulta-medica
    ↓
Sistema consulta evento → Obtiene calendar_id: "consultorio@gmail.com"
    ↓
Consulta disponibilidad → Considera reuniones existentes
    ↓
Muestra slots libres → Excluye conflictos
    ↓
Cliente selecciona horario → Reserva confirmada
    ↓
✅ Reunión creada en calendario específico
    ↓
Meeting.calendarEventId guardado → Para cancelaciones futuras
    ↓
Invitación enviada desde calendario correcto
```

#### Flujo de Cancelación Inteligente
```
Usuario cancela reunión → Sistema busca meeting
    ↓
Identifica calendar_id → Del evento original
    ↓
✅ Cancela del calendario específico
    ↓
Elimina de Google Calendar → No afecta otros calendarios
    ↓
Actualiza estado en BD → CANCELLED
```

---

## 🔄 Integración Entre Servicios (Estado Actual)

### Dependencias Entre Servicios

#### Servicio de Eventos → Integraciones
- Los eventos almacenan `calendar_id` específico del calendario deseado
- ✅ Fallback a 'primary' si calendar_id no especificado
- Validación de que la integración Google está activa

#### Servicio de Reuniones → Eventos
- Al crear reunión, obtiene `calendar_id` desde el evento
- ✅ Crea reunión en calendario específico, no en 'primary'
- Guarda referencia para cancelaciones futuras

#### Integraciones → Google Calendar API
- OAuth con scopes ampliados para acceso a calendarios específicos
- ✅ Tokens válidos para crear eventos en cualquier calendario del usuario
- Renovación automática mantiene acceso

#### Disponibilidad → Google Calendar
- Al generar slots, consulta reuniones existentes
- ✅ Considera todas las reuniones del usuario
- Evita conflictos automáticamente

### ✅ Flujos de Funcionamiento Actual

#### Flujo Completo de Usuario
```
1. Registro → Username automático + Disponibilidad L-V 9AM-5PM
2. Login → JWT token generado
3. Conectar Google Calendar → OAuth con scopes ampliados
4. Crear evento "Consultoría" → calendar_id: "trabajo@gmail.com"
5. Hacer evento público → URL: /usuario123abc/consultoria
6. Cliente reserva → Reunión va a "trabajo@gmail.com"
7. Cancelación → Desde calendario correcto
```

#### Flujo de Reserva Real
```
1. Cliente visita URL pública
2. Sistema consulta evento y obtiene calendar_id
3. Consulta disponibilidad considerando reuniones existentes
4. Cliente reserva slot
5. ✅ Reunión creada en calendario específico del evento
6. Invitación enviada desde calendario correcto
```

---

## 📊 Métricas y Monitoreo (Estado Actual)

### Métricas por Servicio

#### Autenticación
- Registros exitosos vs fallidos
- Intentos de login y tasas de éxito
- Generación de usernames únicos

#### Disponibilidad
- Slots generados por evento
- Conflictos detectados con reuniones existentes
- Modificaciones de horarios por usuario

#### Eventos (✅ Con información de calendario)
- Eventos creados públicos vs privados ✅ por calendar_id
- Cambios de privacidad
- Accesos a URLs públicas
- ✅ Uso de calendarios específicos vs 'primary'

#### Integraciones (✅ Scope ampliado)
- Conexiones OAuth exitosas ✅ con scope ampliado
- Renovaciones de tokens automáticas
- Errores de integración por proveedor

#### Reuniones (✅ Calendario correcto)
- Reuniones creadas ✅ por calendar_id específico
- Cancelaciones ✅ del calendario correcto
- Errores de creación por tipo de calendario
- Performance de creación por calendario

---

## 🛣️ Roadmap y Próximas Funcionalidades

### ✅ Completado en v2.0-beta
- OAuth con scopes ampliados
- Eventos en calendarios específicos (no más 'primary' hardcodeado)
- Reuniones en calendario correcto
- Cancelación inteligente del calendario específico
- Eliminación en cascada (Event Types → Meetings → Google Calendar)

### 🚧 En Desarrollo (v2.0-full)
- **Cache automático de calendarios**: Sincronización automática desde Google Calendar API
- **Endpoints /api/calendars**: CRUD completo para gestión de calendarios
- **Reasignación de calendario**: Cambiar calendario de eventos existentes
- **Sincronización bidireccional**: Cambios en Google reflejados automáticamente

### 📋 Funcionalidades Futuras (v2.1+)
- **Dashboard multi-calendario**: Vista unificada de todos los calendarios
- **Analytics por calendario**: Métricas específicas por calendario
- **Políticas por calendario**: Diferentes reglas de cancelación/modificación
- **Templates de calendario**: Configuraciones predefinidas por industria

### Integraciones Adicionales Planeadas
- **Microsoft Teams**: Video conferencing con calendario Exchange
- **Apple Calendar**: Sincronización móvil nativa
- **Stripe**: Pagos para eventos premium con facturación por calendario
- **Webhooks**: Notificaciones en tiempo real de cambios

---

## 🔧 Configuración y Deployment

### Variables de Entorno Requeridas
```env
# Base
DATABASE_URL=postgresql://...
JWT_SECRET=your-jwt-secret

# Google OAuth (✅ SCOPE AMPLIADO)
GOOGLE_CLIENT_ID=your-google-client-id  
GOOGLE_CLIENT_SECRET=your-google-client-secret
REDIRECT_URI=https://yourdomain.com/oauth/callback
```

### Dependencias Principales
- **TypeORM**: ORM para base de datos con entidades actualizadas
- **Google APIs**: OAuth y Calendar integration ✅ con scope ampliado
- **JWT**: Manejo de tokens de autenticación
- **date-fns**: Manipulación de fechas y horarios

---

## 📞 Soporte y Contacto

### Para problemas con calendarios específicos:

1. **Eventos van a calendario incorrecto**:
   - Verificar calendar_id en evento
   - Confirmar scope OAuth ampliado
   - Revisar logs de creación

2. **Reuniones no aparecen en Google Calendar**:
   - Verificar tokens de Google válidos
   - Confirmar permisos de calendario
   - Revisar calendar_id del evento

3. **Errores de cancelación**:
   - Verificar que meeting tiene calendarEventId
   - Confirmar integración Google activa
   - Revisar permisos de calendario

### Soporte General

Para preguntas técnicas, reportes de bugs o solicitudes de nuevas funcionalidades:

1. **Revisa la documentación**: Busca en este README primero
2. **Consulta logs**: Los servicios incluyen logging detallado ✅ incluyendo calendar_id
3. **Reporta issues**: Incluye pasos para reproducir y logs relevantes
4. **Solicita features**: Describe el caso de uso y beneficio esperado

### Testing con Postman

- **Requests actualizados**: Con soporte para calendar_id en eventos
- **Scripts automáticos**: Captura variables automáticamente
- **Debugging**: Logs específicos de operaciones de calendario

---

**✅ Versión 2.0-beta**: Soporte básico para calendarios específicos  
**Última actualización**: Junio 2025  
**Estado actual**: Funcionalidad core completada, extensiones en desarrollo  
**Próximo milestone**: Cache automático y endpoints completos de calendarios