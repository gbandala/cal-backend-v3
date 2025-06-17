-- Script para crear la estructura completa de la base de datos calendars
-- Ejecutar en PostgreSQL
-- VERSIÓN ACTUALIZADA: Incluye soporte para calendarios específicos

-- Primero eliminamos toda la estructura existente si existe (opcional - descomenta si necesitas limpiar)
/*
DROP TABLE IF EXISTS "day_availability" CASCADE;
DROP TABLE IF EXISTS "meetings" CASCADE;
DROP TABLE IF EXISTS "events" CASCADE;
DROP TABLE IF EXISTS "integrations" CASCADE;
DROP TABLE IF EXISTS "users" CASCADE;
DROP TABLE IF EXISTS "availability" CASCADE;

DROP TYPE IF EXISTS "public"."integrations_provider_enum" CASCADE;
DROP TYPE IF EXISTS "public"."integrations_category_enum" CASCADE;
DROP TYPE IF EXISTS "public"."integrations_app_type_enum" CASCADE;
DROP TYPE IF EXISTS "public"."meetings_status_enum" CASCADE;
DROP TYPE IF EXISTS "public"."events_locationtype_enum" CASCADE;
DROP TYPE IF EXISTS "public"."day_availability_day_enum" CASCADE;
*/

-- Habilitar extensión para UUID (si no está habilitada)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Crear tipos ENUM
CREATE TYPE "public"."integrations_provider_enum" AS ENUM('GOOGLE', 'ZOOM', 'MICROSOFT');
CREATE TYPE "public"."integrations_category_enum" AS ENUM('CALENDAR_AND_VIDEO_CONFERENCING', 'VIDEO_CONFERENCING', 'CALENDAR');
CREATE TYPE "public"."integrations_app_type_enum" AS ENUM('GOOGLE_MEET_AND_CALENDAR', 'ZOOM_MEETING', 'OUTLOOK_CALENDAR');
CREATE TYPE "public"."meetings_status_enum" AS ENUM('SCHEDULED', 'CANCELLED');
CREATE TYPE "public"."events_locationtype_enum" AS ENUM('GOOGLE_MEET_AND_CALENDAR', 'ZOOM_MEETING');
CREATE TYPE "public"."day_availability_day_enum" AS ENUM('SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY');

-- Crear tabla availability (primero porque es referenciada por users)
CREATE TABLE "availability" (
    "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
    "timeGap" integer NOT NULL DEFAULT '30',
    "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
    "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
    CONSTRAINT "PK_05a8158cf1112294b1c86e7f1d3" PRIMARY KEY ("id")
);

-- Crear tabla users
CREATE TABLE "users" (
    "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
    "name" character varying NOT NULL,
    "username" character varying NOT NULL,
    "email" character varying NOT NULL,
    "password" character varying NOT NULL,
    "imageUrl" character varying,
    "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
    "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
    "availabilityId" uuid,
    "timezone" character varying,
    CONSTRAINT "UQ_fe0bb3f6520ee0469504521e710" UNIQUE ("username"),
    CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"),
    CONSTRAINT "REL_19bdac20a255ec8d172c129158" UNIQUE ("availabilityId"),
    CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id")
);

-- Crear tabla events (ACTUALIZADA: incluye campos de calendario)
CREATE TABLE "events" (
    "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
    "title" character varying NOT NULL,
    "description" character varying,
    "duration" integer NOT NULL DEFAULT '30',
    "slug" character varying NOT NULL,
    "isPrivate" boolean NOT NULL DEFAULT false,
    "locationType" "public"."events_locationtype_enum" NOT NULL,
    -- *** NUEVOS CAMPOS PARA CALENDARIOS ESPECÍFICOS ***
    "calendar_id" character varying DEFAULT 'primary',
    "calendar_name" character varying,
    -- *** FIN NUEVOS CAMPOS ***
    "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
    "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
    "userId" uuid,
    CONSTRAINT "PK_40731c7151fe4be3116e45ddf73" PRIMARY KEY ("id"),
    -- Restricción para asegurar que calendar_id no esté vacío
    CONSTRAINT "CHK_events_calendar_id_not_empty" 
        CHECK ("calendar_id" IS NOT NULL AND LENGTH(TRIM("calendar_id")) > 0)
);

-- Comentarios para documentar los nuevos campos
COMMENT ON COLUMN "events"."calendar_id" IS 'ID del calendario de Google (ej: primary, consultorio@gmail.com)';
COMMENT ON COLUMN "events"."calendar_name" IS 'Nombre legible del calendario (ej: Citas Consultorio)';

-- Crear tabla integrations (ACTUALIZADA: incluye campos de calendario por defecto)
CREATE TABLE "integrations" (
    "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
    "provider" "public"."integrations_provider_enum" NOT NULL,
    "category" "public"."integrations_category_enum" NOT NULL,
    "app_type" "public"."integrations_app_type_enum" NOT NULL,
    "access_token" character varying NOT NULL,
    "refresh_token" character varying,
    "expiry_date" bigint,
    "metadata" json NOT NULL,
    "isConnected" boolean NOT NULL DEFAULT true,
    -- *** NUEVOS CAMPOS PARA CALENDARIO POR DEFECTO ***
    "calendar_id" character varying DEFAULT 'primary',
    "calendar_name" character varying,
    -- *** FIN NUEVOS CAMPOS ***
    "userId" uuid NOT NULL,
    "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
    "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
    CONSTRAINT "PK_9adcdc6d6f3922535361ce641e8" PRIMARY KEY ("id")
);

-- Comentarios para documentar los campos de integración
COMMENT ON COLUMN "integrations"."calendar_id" IS 'Calendario por defecto para esta integración';
COMMENT ON COLUMN "integrations"."calendar_name" IS 'Nombre del calendario por defecto';

-- Crear tabla meetings (ACTUALIZADA: incluye calendar_id para cancelaciones)
CREATE TABLE "meetings" (
    "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
    "guestName" character varying NOT NULL,
    "guestEmail" character varying NOT NULL,
    "additionalInfo" character varying,
    "startTime" TIMESTAMP NOT NULL,
    "endTime" TIMESTAMP NOT NULL,
    "meetLink" character varying NOT NULL,
    "calendarEventId" character varying NOT NULL,
    "calendarAppType" character varying NOT NULL,
    -- *** NUEVO CAMPO PARA SABER DE QUÉ CALENDARIO ELIMINAR ***
    "calendar_id" character varying DEFAULT 'primary',
    -- *** FIN NUEVO CAMPO ***
    "status" "public"."meetings_status_enum" NOT NULL DEFAULT 'SCHEDULED',
    "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
    "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
    "userId" uuid,
    "eventId" uuid,
    CONSTRAINT "PK_aa73be861afa77eb4ed31f3ed57" PRIMARY KEY ("id"),
    -- Restricción para asegurar que calendar_id no esté vacío
    CONSTRAINT "CHK_meetings_calendar_id_not_empty" 
        CHECK ("calendar_id" IS NOT NULL AND LENGTH(TRIM("calendar_id")) > 0)
);

-- Comentario para documentar el nuevo campo
COMMENT ON COLUMN "meetings"."calendar_id" IS 'ID del calendario donde se creó la reunión (para cancelaciones)';

-- Crear tabla day_availability (sin cambios)
CREATE TABLE "day_availability" (
    "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
    "day" "public"."day_availability_day_enum" NOT NULL,
    "startTime" TIME NOT NULL,
    "endTime" TIME NOT NULL,
    "isAvailable" boolean NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
    "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
    "availabilityId" uuid,
    CONSTRAINT "PK_dfce5f014ac44f7335585f7d002" PRIMARY KEY ("id")
);

-- Agregar Foreign Keys (sin cambios)
ALTER TABLE "users" ADD CONSTRAINT "FK_19bdac20a255ec8d172c1291584" 
    FOREIGN KEY ("availabilityId") REFERENCES "availability"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

ALTER TABLE "events" ADD CONSTRAINT "FK_9929fa8516afa13f87b41abb263" 
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

ALTER TABLE "integrations" ADD CONSTRAINT "FK_c32758a01d05d0d1da56fa46ae1" 
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

ALTER TABLE "meetings" ADD CONSTRAINT "FK_4b70ab8832f1d7f9a7387d14307" 
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

ALTER TABLE "meetings" ADD CONSTRAINT "FK_2e6f88379a7a198af6c0ba2ca02" 
    FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

ALTER TABLE "day_availability" ADD CONSTRAINT "FK_6cf863b682dbf962dec56b3fb37" 
    FOREIGN KEY ("availabilityId") REFERENCES "availability"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- Crear índices para mejorar performance (ACTUALIZADO: incluye índices para calendarios)
-- Índices originales
CREATE INDEX IF NOT EXISTS "IDX_users_email" ON "users"("email");
CREATE INDEX IF NOT EXISTS "IDX_users_username" ON "users"("username");
CREATE INDEX IF NOT EXISTS "IDX_events_slug" ON "events"("slug");
CREATE INDEX IF NOT EXISTS "IDX_events_userId" ON "events"("userId");
CREATE INDEX IF NOT EXISTS "IDX_meetings_userId" ON "meetings"("userId");
CREATE INDEX IF NOT EXISTS "IDX_meetings_eventId" ON "meetings"("eventId");
CREATE INDEX IF NOT EXISTS "IDX_meetings_status" ON "meetings"("status");
CREATE INDEX IF NOT EXISTS "IDX_integrations_userId" ON "integrations"("userId");
CREATE INDEX IF NOT EXISTS "IDX_day_availability_availabilityId" ON "day_availability"("availabilityId");

-- *** NUEVOS ÍNDICES PARA CALENDARIOS ***
CREATE INDEX IF NOT EXISTS "IDX_events_calendar_id" ON "events"("calendar_id");
CREATE INDEX IF NOT EXISTS "IDX_meetings_calendar_id" ON "meetings"("calendar_id");
CREATE INDEX IF NOT EXISTS "IDX_integrations_calendar_id" ON "integrations"("calendar_id");

-- Índices compuestos para búsquedas optimizadas
CREATE INDEX IF NOT EXISTS "IDX_events_userId_calendar_id" ON "events"("userId", "calendar_id");
CREATE INDEX IF NOT EXISTS "IDX_meetings_status_calendar_id" ON "meetings"("status", "calendar_id");

-- TABLA OPCIONAL: Cache de calendarios del usuario (NUEVA)
-- Esta tabla permite guardar la lista de calendarios disponibles por usuario
-- para mejorar performance y evitar llamadas repetidas a la API de Google
CREATE TABLE "user_calendars" (
    "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" uuid NOT NULL,
    "calendar_id" character varying NOT NULL,
    "calendar_name" character varying NOT NULL,
    "is_primary" boolean DEFAULT false,
    "access_role" character varying, -- 'owner', 'writer', 'reader'
    "background_color" character varying,
    "is_active" boolean DEFAULT true,
    "last_synced" TIMESTAMP DEFAULT now(),
    "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
    "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
    CONSTRAINT "PK_user_calendars" PRIMARY KEY ("id"),
    CONSTRAINT "UQ_user_calendar" UNIQUE ("user_id", "calendar_id"),
    CONSTRAINT "FK_user_calendars_user" FOREIGN KEY ("user_id") 
        REFERENCES "users"("id") ON DELETE CASCADE
);

-- Comentario para la tabla de cache
COMMENT ON TABLE "user_calendars" IS 'Cache de calendarios disponibles por usuario para mejorar performance';

-- Índices para la tabla de cache de calendarios
CREATE INDEX IF NOT EXISTS "IDX_user_calendars_user_id" ON "user_calendars"("user_id");
CREATE INDEX IF NOT EXISTS "IDX_user_calendars_calendar_id" ON "user_calendars"("calendar_id");
CREATE INDEX IF NOT EXISTS "IDX_user_calendars_is_active" ON "user_calendars"("is_active");

-- Verificar que las tablas se crearon correctamente (ACTUALIZADO)
SELECT 
    schemaname,
    tablename,
    tableowner
FROM pg_tables 
WHERE schemaname = 'public' 
    AND tablename IN ('users', 'events', 'meetings', 'integrations', 'availability', 'day_availability', 'user_calendars')
ORDER BY tablename;

-- *** SCRIPT DE VERIFICACIÓN DE COLUMNAS NUEVAS ***
-- Verificar que las columnas de calendario se crearon correctamente
SELECT 
    table_name,
    column_name, 
    data_type, 
    column_default,
    is_nullable
FROM information_schema.columns 
WHERE table_name IN ('events', 'meetings', 'integrations')
    AND column_name LIKE '%calendar%'
ORDER BY table_name, column_name;

-- *** DATOS DE EJEMPLO PARA TESTING (OPCIONAL) ***
-- Descomenta para insertar datos de prueba
/*
-- Insertar usuario de ejemplo
INSERT INTO "availability" ("timeGap") VALUES (30);

INSERT INTO "users" (
    "name", 
    "username", 
    "email", 
    "password",
    "availabilityId"
) VALUES (
    'Dr. Juan Pérez',
    'dr.juan',
    'dr.juan@ejemplo.com',
    'password_hash_here',
    (SELECT "id" FROM "availability" LIMIT 1)
);

-- Insertar evento con calendario específico
INSERT INTO "events" (
    "title", 
    "description", 
    "duration", 
    "slug", 
    "locationType", 
    "calendar_id", 
    "calendar_name",
    "userId"
) VALUES (
    'Consulta Médica',
    'Consulta general de 30 minutos',
    30,
    'consulta-medica',
    'GOOGLE_MEET_AND_CALENDAR',
    'consultorio@gmail.com',
    'Calendario Consultorio',
    (SELECT "id" FROM "users" LIMIT 1)
);

-- Insertar calendario de usuario en cache
INSERT INTO "user_calendars" (
    "user_id",
    "calendar_id",
    "calendar_name",
    "is_primary",
    "access_role"
) VALUES 
(
    (SELECT "id" FROM "users" LIMIT 1),
    'primary',
    'Mi Calendario',
    true,
    'owner'
),
(
    (SELECT "id" FROM "users" LIMIT 1),
    'consultorio@gmail.com',
    'Calendario Consultorio',
    false,
    'owner'
);
*/

-- *** CONSULTAS ÚTILES PARA ADMINISTRACIÓN ***
-- Ver eventos por calendario
-- SELECT e."title", e."calendar_name", u."name" as owner 
-- FROM "events" e JOIN "users" u ON e."userId" = u."id";

-- Ver reuniones por calendario
-- SELECT m."guestName", m."calendar_id", e."title" 
-- FROM "meetings" m JOIN "events" e ON m."eventId" = e."id";

-- Ver calendarios por usuario
-- SELECT u."name", uc."calendar_name", uc."is_primary" 
-- FROM "user_calendars" uc JOIN "users" u ON uc."user_id" = u."id";

COMMENT ON DATABASE calendars IS 'Base de datos para sistema de calendarios con soporte para calendarios específicos de Google Calendar';

-- Fin del script

