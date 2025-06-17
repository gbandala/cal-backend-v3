# 🤝 Guía de Contribución - Cal Backend V2

> ¡Gracias por tu interés en contribuir a Cal Backend V2! Esta guía te ayudará a participar de manera efectiva en el proyecto.

## 📋 Índice

- [Código de Conducta](#-código-de-conducta)
- [Formas de Contribuir](#-formas-de-contribuir)
- [Configuración de Desarrollo](#-configuración-de-desarrollo)
- [Proceso de Contribución](#-proceso-de-contribución)
- [Estándares de Código](#-estándares-de-código)
- [Guía de Commits](#-guía-de-commits)
- [Testing](#-testing)
- [Documentación](#-documentación)

## 📜 Código de Conducta

### Nuestro Compromiso

Como contribuyentes y mantenedores de este proyecto, nos comprometemos a hacer de la participación en nuestro proyecto y nuestra comunidad una experiencia libre de acoso para todos.

### Estándares

Ejemplos de comportamiento que contribuyen a crear un ambiente positivo:

✅ **Hacer:**
- Usar lenguaje acogedor e inclusivo
- Ser respetuoso con diferentes puntos de vista y experiencias
- Aceptar críticas constructivas de manera elegante
- Enfocarse en lo que es mejor para la comunidad
- Mostrar empatía hacia otros miembros de la comunidad

❌ **No hacer:**
- Usar lenguaje o imágenes sexualizadas
- Hacer comentarios insultantes o despectivos
- Acosar públicamente o en privado
- Publicar información privada de otros sin permiso
- Cualquier otra conducta que se consideraría inapropiada en un entorno profesional

## 🎯 Formas de Contribuir

### 🐛 Reportar Bugs

**Antes de reportar un bug:**
- Verifica que no exista un issue similar
- Asegúrate de estar usando la última versión
- Prueba en un entorno limpio

**Template para reportar bugs:**
```markdown
## Descripción del Bug
Descripción clara y concisa del problema.

## Pasos para Reproducir
1. Ir a '...'
2. Hacer clic en '...'
3. Scroll hasta '...'
4. Ver error

## Comportamiento Esperado
Descripción clara de lo que esperabas que pasara.

## Comportamiento Actual
Descripción clara de lo que realmente pasa.

## Capturas de Pantalla
Si aplica, agregar capturas para explicar el problema.

## Entorno
- OS: [ej. macOS 12.6]
- Node.js: [ej. v18.12.0]
- PostgreSQL: [ej. v14.5]
- Navegador: [ej. Chrome 108.0]

## Contexto Adicional
Cualquier otra información relevante sobre el problema.
```

### 💡 Sugerir Funcionalidades

**Template para nuevas funcionalidades:**
```markdown
## Descripción de la Funcionalidad
Descripción clara y concisa de la funcionalidad que te gustaría ver.

## Problema que Resuelve
¿Qué problema específico resuelve esta funcionalidad?

## Solución Propuesta
Descripción clara de cómo te gustaría que funcionara.

## Alternativas Consideradas
Otras soluciones o funcionalidades que has considerado.

## Impacto
- ¿A quién beneficia esta funcionalidad?
- ¿Qué tan crítica es?
- ¿Hay workarounds actuales?
```

### 🔧 Contribuir con Código

**Áreas donde necesitamos ayuda:**
- 🔐 Mejoras de seguridad
- 📊 Optimización de base de datos
- 🌐 Nuevas integraciones (Zoom, Microsoft)
- 🎨 Mejoras de API
- 📝 Documentación
- 🧪 Testing
- 🐛 Corrección de bugs

## 🛠️ Configuración de Desarrollo

### 1. Fork y Clone

```bash
# Fork el repositorio en GitHub
# Luego clona tu fork

git clone https://github.com/TU_USERNAME/cal-backend-v2.git
cd cal-backend-v2

# Agregar el repositorio original como upstream
git remote add upstream https://github.com/gbandala/cal-backend-v2.git
```

### 2. Configurar Entorno

```bash
# Instalar dependencias
npm install

# Configurar variables de entorno
cp .env.example .env
# Editar .env con tus configuraciones

# Configurar base de datos de desarrollo
npm run db:setup:dev
```

### 3. Verificar Configuración

```bash
# Ejecutar tests
npm test

# Ejecutar linting
npm run lint

# Ejecutar en modo desarrollo
npm run dev
```

## 🔄 Proceso de Contribución

### 1. Planificación

```bash
# Mantener tu fork actualizado
git checkout main
git pull upstream main
git push origin main

# Crear rama para tu funcionalidad
git checkout -b feature/nombre-descriptivo
# o
git checkout -b fix/descripcion-del-fix
```

### 2. Desarrollo

```bash
# Hacer cambios
# Agregar tests para nueva funcionalidad
# Actualizar documentación si es necesario

# Verificar que todo funciona
npm test
npm run lint
npm run build
```

### 3. Commits

Seguir [Conventional Commits](https://www.conventionalcommits.org/):

```bash
# Ejemplos de commits válidos:
git commit -m "feat: add calendar-specific event creation"
git commit -m "fix: resolve timezone conversion bug"
git commit -m "docs: update API documentation for meetings"
git commit -m "test: add unit tests for date handling"
```

### 4. Pull Request

```bash
# Push a tu fork
git push origin feature/nombre-descriptivo

# Crear Pull Request en GitHub
```

**Template para Pull Request:**
```markdown
## Descripción
Resumen claro de los cambios y qué problema resuelve.

Fixes #(issue_number)

## Tipo de Cambio
- [ ] Bug fix (cambio no-breaking que corrige un issue)
- [ ] Nueva funcionalidad (cambio no-breaking que agrega funcionalidad)
- [ ] Breaking change (fix o funcionalidad que causa que funcionalidad existente no funcione como esperado)
- [ ] Cambio de documentación

## ¿Cómo se ha Probado?
Describe las pruebas que realizaste para verificar tus cambios.

- [ ] Test unitarios
- [ ] Test de integración
- [ ] Test manual
- [ ] Test en diferentes navegadores

## Checklist
- [ ] Mi código sigue las pautas de estilo del proyecto
- [ ] He realizado una auto-revisión de mi código
- [ ] He comentado mi código, particularmente en áreas difíciles de entender
- [ ] He realizado los cambios correspondientes en la documentación
- [ ] Mis cambios no generan nuevas advertencias
- [ ] He agregado tests que prueban que mi fix es efectivo o que mi funcionalidad funciona
- [ ] Tests nuevos y existentes pasan localmente con mis cambios
- [ ] Cualquier cambio dependiente ha sido fusionado y publicado
```

## 📝 Estándares de Código

### TypeScript/JavaScript

```typescript
// ✅ Buenas Prácticas

// 1. Usar tipos explícitos
interface UserCreateRequest {
  name: string;
  email: string;
  password: string;
}

// 2. Manejo de errores consistente
try {
  const user = await userService.createUser(userData);
  return success(user);
} catch (error) {
  logger.error('Error creating user:', error);
  return failure('USER_CREATION_FAILED', error.message);
}

// 3. Validación de entrada
@IsEmail()
@IsNotEmpty()
email: string;

// 4. Nomenclatura clara
const getUserMeetingsService = async (userId: string, filter: MeetingFilterEnum) => {
  // Implementation
};

// 5. Documentación con JSDoc
/**
 * Creates a new meeting in the specified calendar
 * @param eventId - ID of the event to create meeting for
 * @param meetingData - Meeting details
 * @returns Promise<Meeting> - Created meeting with Google Calendar ID
 */
```

### Estructura de Archivos

```
src/
├── controllers/
│   ├── auth.controller.ts      # Lógica de endpoints
│   └── meeting.controller.ts
├── services/
│   ├── auth.service.ts         # Lógica de negocio
│   └── meeting.service.ts
├── database/
│   ├── entities/
│   │   ├── User.ts            # Entidades TypeORM
│   │   └── Meeting.ts
│   └── dto/
│       ├── CreateUserDto.ts   # DTOs de validación
│       └── CreateMeetingDto.ts
├── middlewares/
│   ├── auth.middleware.ts     # Middlewares reutilizables
│   └── validation.middleware.ts
└── utils/
    ├── date.utils.ts          # Utilidades específicas
    └── calendar.utils.ts
```

### Naming Conventions

```typescript
// Variables y funciones: camelCase
const userMeetings = [];
const getCurrentUser = () => {};

// Clases y interfaces: PascalCase
class MeetingService {}
interface UserData {}

// Constantes: SCREAMING_SNAKE_CASE
const MAX_MEETINGS_PER_DAY = 10;
const DEFAULT_MEETING_DURATION = 30;

// Archivos: kebab-case o camelCase
user-service.ts
userService.ts (ambos aceptables)

// Endpoints: kebab-case
/api/user-meetings
/api/calendar-events
```

## 📝 Guía de Commits

### Conventional Commits

Usamos [Conventional Commits](https://www.conventionalcommits.org/) para mantener un historial limpio:

```bash
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

### Tipos de Commit

| Tipo | Descripción | Ejemplo |
|------|-------------|---------|
| `feat` | Nueva funcionalidad | `feat: add calendar-specific meeting creation` |
| `fix` | Corrección de bug | `fix: resolve timezone conversion in date service` |
| `docs` | Cambios en documentación | `docs: update API endpoint documentation` |
| `style` | Formato, punto y coma faltante, etc | `style: fix indentation in user controller` |
| `refactor` | Cambio de código que no corrige bug ni agrega funcionalidad | `refactor: extract date utility functions` |
| `test` | Agregar tests faltantes | `test: add unit tests for meeting service` |
| `chore` | Cambios en build, dependencias, etc | `chore: update TypeORM to latest version` |

### Ejemplos de Buenos Commits

```bash
# Funcionalidad nueva
feat(meetings): add support for recurring meetings
feat(calendar): integrate with Microsoft Calendar API
feat: implement timezone-aware date handling

# Corrección de bugs
fix(auth): resolve JWT token expiration handling
fix(meetings): prevent double-booking in same time slot
fix: correct Google Calendar API scope permissions

# Documentación
docs(api): add examples for meeting endpoints
docs: update installation guide for PostgreSQL 14
docs(readme): fix typos in setup instructions

# Tests
test(services): add integration tests for calendar sync
test: increase coverage for authentication flows
test(utils): add unit tests for date helpers
```

## 🧪 Testing

### Estructura de Tests

```
tests/
├── unit/
│   ├── services/
│   │   ├── auth.service.test.ts
│   │   └── meeting.service.test.ts
│   └── utils/
│       └── date.utils.test.ts
├── integration/
│   ├── auth.integration.test.ts
│   └── meetings.integration.test.ts
└── fixtures/
    ├── users.json
    └── meetings.json
```

### Escribir Tests

```typescript
// ✅ Ejemplo de test unitario
describe('MeetingService', () => {
  describe('createMeeting', () => {
    it('should create meeting in correct calendar', async () => {
      // Arrange
      const eventData = { calendar_id: 'test-calendar' };
      const meetingData = { guestEmail: 'test@test.com' };
      
      // Act
      const result = await meetingService.createMeeting(eventData, meetingData);
      
      // Assert
      expect(result.calendarEventId).toBeDefined();
      expect(googleCalendarMock.createEvent).toHaveBeenCalledWith(
        expect.objectContaining({ calendarId: 'test-calendar' })
      );
    });
  });
});

// ✅ Ejemplo de test de integración
describe('POST /api/meeting/public/create', () => {
  it('should create meeting and return 201', async () => {
    const response = await request(app)
      .post('/api/meeting/public/create')
      .send({
        eventId: testEvent.id,
        guestName: 'Test User',
        guestEmail: 'test@example.com',
        startTime: '2025-06-15T10:00:00.000Z',
        endTime: '2025-06-15T10:30:00.000Z'
      })
      .expect(201);
      
    expect(response.body.success).toBe(true);
    expect(response.body.data.meetLink).toContain('meet.google.com');
  });
});
```

### Ejecutar Tests

```bash
# Todos los tests
npm test

# Tests específicos
npm test -- auth.service.test.ts

# Tests con coverage
npm run test:coverage

# Tests en modo watch
npm run test:watch

# Tests de integración únicamente
npm run test:integration
```

## 📚 Documentación

### Comentarios en Código

```typescript
/**
 * Processes meeting dates to remove timezone information for frontend consumption
 * @param meetings - Array of meetings with UTC dates
 * @returns Array of meetings with local time strings (no 'Z' suffix)
 */
const processedMeetings = meetings.map(meeting => {
  // Convert UTC dates to local time strings for frontend
  const processedMeeting = { ...meeting };
  
  if (processedMeeting.startTime) {
    // Remove 'Z' to indicate local time instead of UTC
    const startTimeStr = processedMeeting.startTime.toISOString();
    processedMeeting.startTime = startTimeStr.replace('Z', '') as any;
  }
  
  return processedMeeting;
});
```

### README de Funcionalidades

Para funcionalidades complejas, crear archivos de documentación específicos:

```
docs/
├── features/
│   ├── calendar-integration.md
│   ├── timezone-handling.md
│   └── meeting-scheduling.md
├── architecture/
│   ├── database-schema.md
│   └── api-design.md
└── deployment/
    ├── production.md
    └── docker.md
```

## 🎉 Reconocimientos

Todos los contribuyentes serán reconocidos en:
- README principal
- Archivo CONTRIBUTORS.md
- Release notes
- Agradecimientos especiales para contribuciones significativas

## 📞 Contacto

¿Tienes preguntas sobre cómo contribuir?

- 🐛 **Issues**: [GitHub Issues](https://github.com/gbandala/cal-backend-v2/issues)
- 💬 **Discusiones**: [GitHub Discussions](https://github.com/gbandala/cal-backend-v2/discussions)
- 📧 **Email**: [gbandala@example.com](mailto:gbandala@example.com)

---

**¡Gracias por contribuir a Cal Backend V2! 🚀**

Tu contribución hace que este proyecto sea mejor para todos. Cada línea de código, cada bug reportado, cada sugerencia cuenta.