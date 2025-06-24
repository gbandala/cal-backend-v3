
CREATE TYPE public.day_availability_day_enum AS ENUM (
    'SUNDAY',
    'MONDAY',
    'TUESDAY',
    'WEDNESDAY',
    'THURSDAY',
    'FRIDAY',
    'SATURDAY'
);


ALTER TYPE public.day_availability_day_enum OWNER TO cal_app_user;


CREATE TYPE public.events_locationtype_enum AS ENUM (
    'GOOGLE_MEET_AND_CALENDAR',
    'ZOOM_MEETING',
    'OUTLOOK_WITH_ZOOM'
);


ALTER TYPE public.events_locationtype_enum OWNER TO cal_app_user;

CREATE TYPE public.integrations_app_type_enum AS ENUM (
    'GOOGLE_MEET_AND_CALENDAR',
    'ZOOM_MEETING',
    'OUTLOOK_CALENDAR',
    'ZOOM_GOOGLE_CALENDAR'
);


ALTER TYPE public.integrations_app_type_enum OWNER TO cal_app_user;

CREATE TYPE public.integrations_category_enum AS ENUM (
    'CALENDAR_AND_VIDEO_CONFERENCING',
    'VIDEO_CONFERENCING',
    'CALENDAR'
);


ALTER TYPE public.integrations_category_enum OWNER TO cal_app_user;

CREATE TYPE public.integrations_provider_enum AS ENUM (
    'GOOGLE',
    'ZOOM',
    'MICROSOFT'
);


ALTER TYPE public.integrations_provider_enum OWNER TO cal_app_user;

CREATE TYPE public.meetings_status_enum AS ENUM (
    'SCHEDULED',
    'CANCELLED'
);


ALTER TYPE public.meetings_status_enum OWNER TO cal_app_user;

SET default_tablespace = '';

SET default_table_access_method = heap;

CREATE TABLE public.availability (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "timeGap" integer DEFAULT 30 NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.availability OWNER TO cal_app_user;

CREATE TABLE public.day_availability (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    day public.day_availability_day_enum NOT NULL,
    "startTime" time without time zone NOT NULL,
    "endTime" time without time zone NOT NULL,
    "isAvailable" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL,
    "availabilityId" uuid
);


ALTER TABLE public.day_availability OWNER TO cal_app_user;

CREATE TABLE public.events (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    title character varying NOT NULL,
    description character varying,
    duration integer DEFAULT 30 NOT NULL,
    slug character varying NOT NULL,
    "isPrivate" boolean DEFAULT false NOT NULL,
    "locationType" public.events_locationtype_enum NOT NULL,
    calendar_id character varying,
    calendar_name character varying,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL,
    "userId" uuid
);


ALTER TABLE public.events OWNER TO cal_app_user;

COMMENT ON COLUMN public.events.calendar_id IS 'ID del calendario de Google (solo para Google Meet/Calendar). NULL para Zoom.';

COMMENT ON COLUMN public.events.calendar_name IS 'Nombre del calendario (solo para Google Meet/Calendar). NULL para Zoom.';

CREATE TABLE public.integrations (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    provider public.integrations_provider_enum NOT NULL,
    category public.integrations_category_enum NOT NULL,
    app_type public.integrations_app_type_enum NOT NULL,
    access_token character varying NOT NULL,
    refresh_token character varying,
    expiry_date bigint,
    metadata json NOT NULL,
    "isConnected" boolean DEFAULT true NOT NULL,
    calendar_id character varying,
    calendar_name character varying,
    "userId" uuid NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL,
    zoom_user_id character varying,
    zoom_account_id character varying,
    outlook_calendar_id character varying,
    outlook_calendar_name character varying,
    CONSTRAINT "CHK_integrations_provider_logic" CHECK ((((provider = 'GOOGLE'::public.integrations_provider_enum) AND (calendar_id IS NOT NULL) AND (zoom_user_id IS NULL) AND (outlook_calendar_id IS NULL)) OR ((provider = 'ZOOM'::public.integrations_provider_enum) AND (calendar_id IS NULL) AND (zoom_user_id IS NOT NULL) AND (outlook_calendar_id IS NULL)) OR ((provider = 'MICROSOFT'::public.integrations_provider_enum) AND (calendar_id IS NULL) AND (zoom_user_id IS NULL) AND (outlook_calendar_id IS NOT NULL))))
);


ALTER TABLE public.integrations OWNER TO cal_app_user;

COMMENT ON COLUMN public.integrations.calendar_id IS 'Calendario por defecto (solo Google). NULL para otros proveedores.';

COMMENT ON COLUMN public.integrations.calendar_name IS 'Nombre del calendario por defecto';

COMMENT ON COLUMN public.integrations.zoom_user_id IS 'ID de usuario en Zoom (solo para integraciones Zoom)';

COMMENT ON COLUMN public.integrations.zoom_account_id IS 'ID de cuenta Zoom (para integraciones empresariales)';

CREATE TABLE public.meetings (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "guestName" character varying NOT NULL,
    "guestEmail" character varying NOT NULL,
    "additionalInfo" character varying,
    "startTime" timestamp without time zone NOT NULL,
    "endTime" timestamp without time zone NOT NULL,
    "meetLink" character varying NOT NULL,
    "calendarEventId" character varying NOT NULL,
    "calendarAppType" character varying NOT NULL,
    calendar_id character varying,
    status public.meetings_status_enum DEFAULT 'SCHEDULED'::public.meetings_status_enum NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL,
    "userId" uuid,
    "eventId" uuid,
    zoom_meeting_id bigint,
    zoom_join_url character varying,
    zoom_start_url character varying,
    CONSTRAINT "CHK_meetings_platform_logic" CHECK ((((("calendarAppType")::text = 'GOOGLE_MEET_AND_CALENDAR'::text) AND (calendar_id IS NOT NULL) AND (zoom_meeting_id IS NULL)) OR ((("calendarAppType")::text = 'ZOOM_MEETING'::text) AND (calendar_id IS NULL) AND (zoom_meeting_id IS NOT NULL)) OR ((("calendarAppType")::text = 'ZOOM_GOOGLE_CALENDAR'::text) AND (calendar_id IS NOT NULL) AND (zoom_meeting_id IS NOT NULL)) OR ((("calendarAppType")::text = 'OUTLOOK_WITH_ZOOM'::text) AND (calendar_id IS NOT NULL) AND (zoom_meeting_id IS NOT NULL))))
);


ALTER TABLE public.meetings OWNER TO cal_app_user;

COMMENT ON COLUMN public.meetings.calendar_id IS 'ID del calendario Google (solo para Google Meet). NULL para Zoom.';

COMMENT ON COLUMN public.meetings.zoom_meeting_id IS 'ID numérico del meeting de Zoom (solo para Zoom). NULL para Google.';

COMMENT ON COLUMN public.meetings.zoom_join_url IS 'URL para que invitados se unan al meeting de Zoom';

COMMENT ON COLUMN public.meetings.zoom_start_url IS 'URL para que el host inicie el meeting de Zoom';

CREATE TABLE public.user_calendars (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    calendar_id character varying NOT NULL,
    calendar_name character varying NOT NULL,
    is_primary boolean DEFAULT false,
    access_role character varying,
    background_color character varying,
    is_active boolean DEFAULT true,
    last_synced timestamp without time zone DEFAULT now(),
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.user_calendars OWNER TO cal_app_user;

COMMENT ON TABLE public.user_calendars IS 'Cache de calendarios disponibles por usuario para mejorar performance';

CREATE TABLE public.users (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying NOT NULL,
    username character varying NOT NULL,
    email character varying NOT NULL,
    password character varying NOT NULL,
    "imageUrl" character varying,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL,
    "availabilityId" uuid,
    timezone character varying
);

ALTER TABLE public.users OWNER TO cal_app_user;

ALTER TABLE ONLY public.availability
    ADD CONSTRAINT "PK_05a8158cf1112294b1c86e7f1d3" PRIMARY KEY (id);

ALTER TABLE ONLY public.events
    ADD CONSTRAINT "PK_40731c7151fe4be3116e45ddf73" PRIMARY KEY (id);


ALTER TABLE ONLY public.integrations
    ADD CONSTRAINT "PK_9adcdc6d6f3922535361ce641e8" PRIMARY KEY (id);


ALTER TABLE ONLY public.users
    ADD CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY (id);


ALTER TABLE ONLY public.meetings
    ADD CONSTRAINT "PK_aa73be861afa77eb4ed31f3ed57" PRIMARY KEY (id);

ALTER TABLE ONLY public.day_availability
    ADD CONSTRAINT "PK_dfce5f014ac44f7335585f7d002" PRIMARY KEY (id);

ALTER TABLE ONLY public.user_calendars
    ADD CONSTRAINT "PK_user_calendars" PRIMARY KEY (id);

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "REL_19bdac20a255ec8d172c129158" UNIQUE ("availabilityId");

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE (email);

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "UQ_fe0bb3f6520ee0469504521e710" UNIQUE (username);

ALTER TABLE ONLY public.user_calendars
    ADD CONSTRAINT "UQ_user_calendar" UNIQUE (user_id, calendar_id);

CREATE INDEX "IDX_day_availability_availabilityId" ON public.day_availability USING btree ("availabilityId");

CREATE INDEX "IDX_events_calendar_id" ON public.events USING btree (calendar_id);

CREATE INDEX "IDX_events_slug" ON public.events USING btree (slug);

CREATE INDEX "IDX_events_userId" ON public.events USING btree ("userId");

CREATE INDEX "IDX_events_userId_calendar_id" ON public.events USING btree ("userId", calendar_id);

CREATE INDEX "IDX_integrations_calendar_id" ON public.integrations USING btree (calendar_id);

CREATE INDEX "IDX_integrations_userId" ON public.integrations USING btree ("userId");

CREATE INDEX "IDX_integrations_zoom_user_id" ON public.integrations USING btree (zoom_user_id);

CREATE INDEX "IDX_meetings_app_type_platform" ON public.meetings USING btree ("calendarAppType", calendar_id, zoom_meeting_id);

CREATE INDEX "IDX_meetings_calendar_id" ON public.meetings USING btree (calendar_id);

CREATE INDEX "IDX_meetings_eventId" ON public.meetings USING btree ("eventId");

CREATE INDEX "IDX_meetings_status" ON public.meetings USING btree (status);

CREATE INDEX "IDX_meetings_status_calendar_id" ON public.meetings USING btree (status, calendar_id);

CREATE INDEX "IDX_meetings_userId" ON public.meetings USING btree ("userId");

CREATE INDEX "IDX_meetings_zoom_meeting_id" ON public.meetings USING btree (zoom_meeting_id);

CREATE INDEX "IDX_user_calendars_calendar_id" ON public.user_calendars USING btree (calendar_id);

CREATE INDEX "IDX_user_calendars_is_active" ON public.user_calendars USING btree (is_active);

CREATE INDEX "IDX_user_calendars_user_id" ON public.user_calendars USING btree (user_id);

CREATE INDEX "IDX_users_email" ON public.users USING btree (email);

CREATE INDEX "IDX_users_username" ON public.users USING btree (username);

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "FK_19bdac20a255ec8d172c1291584" FOREIGN KEY ("availabilityId") REFERENCES public.availability(id);

ALTER TABLE ONLY public.meetings
    ADD CONSTRAINT "FK_2e6f88379a7a198af6c0ba2ca02" FOREIGN KEY ("eventId") REFERENCES public.events(id);

ALTER TABLE ONLY public.meetings
    ADD CONSTRAINT "FK_4b70ab8832f1d7f9a7387d14307" FOREIGN KEY ("userId") REFERENCES public.users(id);

ALTER TABLE ONLY public.day_availability
    ADD CONSTRAINT "FK_6cf863b682dbf962dec56b3fb37" FOREIGN KEY ("availabilityId") REFERENCES public.availability(id);

ALTER TABLE ONLY public.events
    ADD CONSTRAINT "FK_9929fa8516afa13f87b41abb263" FOREIGN KEY ("userId") REFERENCES public.users(id);

ALTER TABLE ONLY public.integrations
    ADD CONSTRAINT "FK_c32758a01d05d0d1da56fa46ae1" FOREIGN KEY ("userId") REFERENCES public.users(id);


ALTER TABLE ONLY public.user_calendars
    ADD CONSTRAINT "FK_user_calendars_user" FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


-- Completed on 2025-06-24 08:05:26

--
-- PostgreSQL database dump complete
--

