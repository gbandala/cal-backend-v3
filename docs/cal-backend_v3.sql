--
-- PostgreSQL database dump
--

-- Dumped from database version 17.4
-- Dumped by pg_dump version 17.4

-- Started on 2025-06-16 07:21:27

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- TOC entry 2 (class 3079 OID 17801)
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;


--
-- TOC entry 4437 (class 0 OID 0)
-- Dependencies: 2
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


--
-- TOC entry 878 (class 1247 OID 17848)
-- Name: day_availability_day_enum; Type: TYPE; Schema: public; Owner: cal_app_user
--

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

--
-- TOC entry 875 (class 1247 OID 17842)
-- Name: events_locationtype_enum; Type: TYPE; Schema: public; Owner: cal_app_user
--

CREATE TYPE public.events_locationtype_enum AS ENUM (
    'GOOGLE_MEET_AND_CALENDAR',
    'ZOOM_MEETING'
);


ALTER TYPE public.events_locationtype_enum OWNER TO cal_app_user;

--
-- TOC entry 869 (class 1247 OID 17828)
-- Name: integrations_app_type_enum; Type: TYPE; Schema: public; Owner: cal_app_user
--

CREATE TYPE public.integrations_app_type_enum AS ENUM (
    'GOOGLE_MEET_AND_CALENDAR',
    'ZOOM_MEETING',
    'OUTLOOK_CALENDAR'
);


ALTER TYPE public.integrations_app_type_enum OWNER TO cal_app_user;

--
-- TOC entry 866 (class 1247 OID 17820)
-- Name: integrations_category_enum; Type: TYPE; Schema: public; Owner: cal_app_user
--

CREATE TYPE public.integrations_category_enum AS ENUM (
    'CALENDAR_AND_VIDEO_CONFERENCING',
    'VIDEO_CONFERENCING',
    'CALENDAR'
);


ALTER TYPE public.integrations_category_enum OWNER TO cal_app_user;

--
-- TOC entry 863 (class 1247 OID 17813)
-- Name: integrations_provider_enum; Type: TYPE; Schema: public; Owner: cal_app_user
--

CREATE TYPE public.integrations_provider_enum AS ENUM (
    'GOOGLE',
    'ZOOM',
    'MICROSOFT'
);


ALTER TYPE public.integrations_provider_enum OWNER TO cal_app_user;

--
-- TOC entry 872 (class 1247 OID 17836)
-- Name: meetings_status_enum; Type: TYPE; Schema: public; Owner: cal_app_user
--

CREATE TYPE public.meetings_status_enum AS ENUM (
    'SCHEDULED',
    'CANCELLED'
);


ALTER TYPE public.meetings_status_enum OWNER TO cal_app_user;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- TOC entry 218 (class 1259 OID 17863)
-- Name: availability; Type: TABLE; Schema: public; Owner: cal_app_user
--

CREATE TABLE public.availability (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "timeGap" integer DEFAULT 30 NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.availability OWNER TO cal_app_user;

--
-- TOC entry 223 (class 1259 OID 17927)
-- Name: day_availability; Type: TABLE; Schema: public; Owner: cal_app_user
--

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

--
-- TOC entry 220 (class 1259 OID 17888)
-- Name: events; Type: TABLE; Schema: public; Owner: cal_app_user
--

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

--
-- TOC entry 4438 (class 0 OID 0)
-- Dependencies: 220
-- Name: COLUMN events.calendar_id; Type: COMMENT; Schema: public; Owner: cal_app_user
--

COMMENT ON COLUMN public.events.calendar_id IS 'ID del calendario de Google (solo para Google Meet/Calendar). NULL para Zoom.';


--
-- TOC entry 4439 (class 0 OID 0)
-- Dependencies: 220
-- Name: COLUMN events.calendar_name; Type: COMMENT; Schema: public; Owner: cal_app_user
--

COMMENT ON COLUMN public.events.calendar_name IS 'Nombre del calendario (solo para Google Meet/Calendar). NULL para Zoom.';


--
-- TOC entry 221 (class 1259 OID 17902)
-- Name: integrations; Type: TABLE; Schema: public; Owner: cal_app_user
--

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
    CONSTRAINT "CHK_integrations_provider_logic" CHECK ((((provider = 'GOOGLE'::public.integrations_provider_enum) AND (calendar_id IS NOT NULL) AND (zoom_user_id IS NULL)) OR ((provider = 'ZOOM'::public.integrations_provider_enum) AND (calendar_id IS NULL) AND (zoom_user_id IS NOT NULL)) OR (provider = 'MICROSOFT'::public.integrations_provider_enum)))
);


ALTER TABLE public.integrations OWNER TO cal_app_user;

--
-- TOC entry 4440 (class 0 OID 0)
-- Dependencies: 221
-- Name: COLUMN integrations.calendar_id; Type: COMMENT; Schema: public; Owner: cal_app_user
--

COMMENT ON COLUMN public.integrations.calendar_id IS 'Calendario por defecto (solo Google). NULL para otros proveedores.';


--
-- TOC entry 4441 (class 0 OID 0)
-- Dependencies: 221
-- Name: COLUMN integrations.calendar_name; Type: COMMENT; Schema: public; Owner: cal_app_user
--

COMMENT ON COLUMN public.integrations.calendar_name IS 'Nombre del calendario por defecto';


--
-- TOC entry 4442 (class 0 OID 0)
-- Dependencies: 221
-- Name: COLUMN integrations.zoom_user_id; Type: COMMENT; Schema: public; Owner: cal_app_user
--

COMMENT ON COLUMN public.integrations.zoom_user_id IS 'ID de usuario en Zoom (solo para integraciones Zoom)';


--
-- TOC entry 4443 (class 0 OID 0)
-- Dependencies: 221
-- Name: COLUMN integrations.zoom_account_id; Type: COMMENT; Schema: public; Owner: cal_app_user
--

COMMENT ON COLUMN public.integrations.zoom_account_id IS 'ID de cuenta Zoom (para integraciones empresariales)';


--
-- TOC entry 222 (class 1259 OID 17914)
-- Name: meetings; Type: TABLE; Schema: public; Owner: cal_app_user
--

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
    CONSTRAINT "CHK_meetings_platform_logic" CHECK ((((("calendarAppType")::text = 'GOOGLE_MEET_AND_CALENDAR'::text) AND (calendar_id IS NOT NULL) AND (zoom_meeting_id IS NULL)) OR ((("calendarAppType")::text = 'ZOOM_MEETING'::text) AND (calendar_id IS NULL) AND (zoom_meeting_id IS NOT NULL))))
);


ALTER TABLE public.meetings OWNER TO cal_app_user;

--
-- TOC entry 4444 (class 0 OID 0)
-- Dependencies: 222
-- Name: COLUMN meetings.calendar_id; Type: COMMENT; Schema: public; Owner: cal_app_user
--

COMMENT ON COLUMN public.meetings.calendar_id IS 'ID del calendario Google (solo para Google Meet). NULL para Zoom.';


--
-- TOC entry 4445 (class 0 OID 0)
-- Dependencies: 222
-- Name: COLUMN meetings.zoom_meeting_id; Type: COMMENT; Schema: public; Owner: cal_app_user
--

COMMENT ON COLUMN public.meetings.zoom_meeting_id IS 'ID numérico del meeting de Zoom (solo para Zoom). NULL para Google.';


--
-- TOC entry 4446 (class 0 OID 0)
-- Dependencies: 222
-- Name: COLUMN meetings.zoom_join_url; Type: COMMENT; Schema: public; Owner: cal_app_user
--

COMMENT ON COLUMN public.meetings.zoom_join_url IS 'URL para que invitados se unan al meeting de Zoom';


--
-- TOC entry 4447 (class 0 OID 0)
-- Dependencies: 222
-- Name: COLUMN meetings.zoom_start_url; Type: COMMENT; Schema: public; Owner: cal_app_user
--

COMMENT ON COLUMN public.meetings.zoom_start_url IS 'URL para que el host inicie el meeting de Zoom';


--
-- TOC entry 224 (class 1259 OID 17980)
-- Name: user_calendars; Type: TABLE; Schema: public; Owner: cal_app_user
--

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

--
-- TOC entry 4448 (class 0 OID 0)
-- Dependencies: 224
-- Name: TABLE user_calendars; Type: COMMENT; Schema: public; Owner: cal_app_user
--

COMMENT ON TABLE public.user_calendars IS 'Cache de calendarios disponibles por usuario para mejorar performance';


--
-- TOC entry 219 (class 1259 OID 17872)
-- Name: users; Type: TABLE; Schema: public; Owner: cal_app_user
--

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



--
-- TOC entry 4232 (class 2606 OID 17871)
-- Name: availability PK_05a8158cf1112294b1c86e7f1d3; Type: CONSTRAINT; Schema: public; Owner: cal_app_user
--

ALTER TABLE ONLY public.availability
    ADD CONSTRAINT "PK_05a8158cf1112294b1c86e7f1d3" PRIMARY KEY (id);


--
-- TOC entry 4248 (class 2606 OID 17901)
-- Name: events PK_40731c7151fe4be3116e45ddf73; Type: CONSTRAINT; Schema: public; Owner: cal_app_user
--

ALTER TABLE ONLY public.events
    ADD CONSTRAINT "PK_40731c7151fe4be3116e45ddf73" PRIMARY KEY (id);


--
-- TOC entry 4253 (class 2606 OID 17913)
-- Name: integrations PK_9adcdc6d6f3922535361ce641e8; Type: CONSTRAINT; Schema: public; Owner: cal_app_user
--

ALTER TABLE ONLY public.integrations
    ADD CONSTRAINT "PK_9adcdc6d6f3922535361ce641e8" PRIMARY KEY (id);


--
-- TOC entry 4236 (class 2606 OID 17881)
-- Name: users PK_a3ffb1c0c8416b9fc6f907b7433; Type: CONSTRAINT; Schema: public; Owner: cal_app_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY (id);


--
-- TOC entry 4262 (class 2606 OID 17926)
-- Name: meetings PK_aa73be861afa77eb4ed31f3ed57; Type: CONSTRAINT; Schema: public; Owner: cal_app_user
--

ALTER TABLE ONLY public.meetings
    ADD CONSTRAINT "PK_aa73be861afa77eb4ed31f3ed57" PRIMARY KEY (id);


--
-- TOC entry 4265 (class 2606 OID 17935)
-- Name: day_availability PK_dfce5f014ac44f7335585f7d002; Type: CONSTRAINT; Schema: public; Owner: cal_app_user
--

ALTER TABLE ONLY public.day_availability
    ADD CONSTRAINT "PK_dfce5f014ac44f7335585f7d002" PRIMARY KEY (id);


--
-- TOC entry 4270 (class 2606 OID 17992)
-- Name: user_calendars PK_user_calendars; Type: CONSTRAINT; Schema: public; Owner: cal_app_user
--

ALTER TABLE ONLY public.user_calendars
    ADD CONSTRAINT "PK_user_calendars" PRIMARY KEY (id);


--
-- TOC entry 4238 (class 2606 OID 17887)
-- Name: users REL_19bdac20a255ec8d172c129158; Type: CONSTRAINT; Schema: public; Owner: cal_app_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "REL_19bdac20a255ec8d172c129158" UNIQUE ("availabilityId");


--
-- TOC entry 4240 (class 2606 OID 17885)
-- Name: users UQ_97672ac88f789774dd47f7c8be3; Type: CONSTRAINT; Schema: public; Owner: cal_app_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE (email);


--
-- TOC entry 4242 (class 2606 OID 17883)
-- Name: users UQ_fe0bb3f6520ee0469504521e710; Type: CONSTRAINT; Schema: public; Owner: cal_app_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "UQ_fe0bb3f6520ee0469504521e710" UNIQUE (username);


--
-- TOC entry 4272 (class 2606 OID 17994)
-- Name: user_calendars UQ_user_calendar; Type: CONSTRAINT; Schema: public; Owner: cal_app_user
--

ALTER TABLE ONLY public.user_calendars
    ADD CONSTRAINT "UQ_user_calendar" UNIQUE (user_id, calendar_id);


--
-- TOC entry 4263 (class 1259 OID 17974)
-- Name: IDX_day_availability_availabilityId; Type: INDEX; Schema: public; Owner: cal_app_user
--

CREATE INDEX "IDX_day_availability_availabilityId" ON public.day_availability USING btree ("availabilityId");


--
-- TOC entry 4243 (class 1259 OID 17975)
-- Name: IDX_events_calendar_id; Type: INDEX; Schema: public; Owner: cal_app_user
--

CREATE INDEX "IDX_events_calendar_id" ON public.events USING btree (calendar_id);


--
-- TOC entry 4244 (class 1259 OID 17968)
-- Name: IDX_events_slug; Type: INDEX; Schema: public; Owner: cal_app_user
--

CREATE INDEX "IDX_events_slug" ON public.events USING btree (slug);


--
-- TOC entry 4245 (class 1259 OID 17969)
-- Name: IDX_events_userId; Type: INDEX; Schema: public; Owner: cal_app_user
--

CREATE INDEX "IDX_events_userId" ON public.events USING btree ("userId");


--
-- TOC entry 4246 (class 1259 OID 17978)
-- Name: IDX_events_userId_calendar_id; Type: INDEX; Schema: public; Owner: cal_app_user
--

CREATE INDEX "IDX_events_userId_calendar_id" ON public.events USING btree ("userId", calendar_id);


--
-- TOC entry 4249 (class 1259 OID 17977)
-- Name: IDX_integrations_calendar_id; Type: INDEX; Schema: public; Owner: cal_app_user
--

CREATE INDEX "IDX_integrations_calendar_id" ON public.integrations USING btree (calendar_id);


--
-- TOC entry 4250 (class 1259 OID 17973)
-- Name: IDX_integrations_userId; Type: INDEX; Schema: public; Owner: cal_app_user
--

CREATE INDEX "IDX_integrations_userId" ON public.integrations USING btree ("userId");


--
-- TOC entry 4251 (class 1259 OID 18008)
-- Name: IDX_integrations_zoom_user_id; Type: INDEX; Schema: public; Owner: cal_app_user
--

CREATE INDEX "IDX_integrations_zoom_user_id" ON public.integrations USING btree (zoom_user_id);


--
-- TOC entry 4254 (class 1259 OID 18009)
-- Name: IDX_meetings_app_type_platform; Type: INDEX; Schema: public; Owner: cal_app_user
--

CREATE INDEX "IDX_meetings_app_type_platform" ON public.meetings USING btree ("calendarAppType", calendar_id, zoom_meeting_id);


--
-- TOC entry 4255 (class 1259 OID 17976)
-- Name: IDX_meetings_calendar_id; Type: INDEX; Schema: public; Owner: cal_app_user
--

CREATE INDEX "IDX_meetings_calendar_id" ON public.meetings USING btree (calendar_id);


--
-- TOC entry 4256 (class 1259 OID 17971)
-- Name: IDX_meetings_eventId; Type: INDEX; Schema: public; Owner: cal_app_user
--

CREATE INDEX "IDX_meetings_eventId" ON public.meetings USING btree ("eventId");


--
-- TOC entry 4257 (class 1259 OID 17972)
-- Name: IDX_meetings_status; Type: INDEX; Schema: public; Owner: cal_app_user
--

CREATE INDEX "IDX_meetings_status" ON public.meetings USING btree (status);


--
-- TOC entry 4258 (class 1259 OID 17979)
-- Name: IDX_meetings_status_calendar_id; Type: INDEX; Schema: public; Owner: cal_app_user
--

CREATE INDEX "IDX_meetings_status_calendar_id" ON public.meetings USING btree (status, calendar_id);


--
-- TOC entry 4259 (class 1259 OID 17970)
-- Name: IDX_meetings_userId; Type: INDEX; Schema: public; Owner: cal_app_user
--

CREATE INDEX "IDX_meetings_userId" ON public.meetings USING btree ("userId");


--
-- TOC entry 4260 (class 1259 OID 18007)
-- Name: IDX_meetings_zoom_meeting_id; Type: INDEX; Schema: public; Owner: cal_app_user
--

CREATE INDEX "IDX_meetings_zoom_meeting_id" ON public.meetings USING btree (zoom_meeting_id);


--
-- TOC entry 4266 (class 1259 OID 18001)
-- Name: IDX_user_calendars_calendar_id; Type: INDEX; Schema: public; Owner: cal_app_user
--

CREATE INDEX "IDX_user_calendars_calendar_id" ON public.user_calendars USING btree (calendar_id);


--
-- TOC entry 4267 (class 1259 OID 18002)
-- Name: IDX_user_calendars_is_active; Type: INDEX; Schema: public; Owner: cal_app_user
--

CREATE INDEX "IDX_user_calendars_is_active" ON public.user_calendars USING btree (is_active);


--
-- TOC entry 4268 (class 1259 OID 18000)
-- Name: IDX_user_calendars_user_id; Type: INDEX; Schema: public; Owner: cal_app_user
--

CREATE INDEX "IDX_user_calendars_user_id" ON public.user_calendars USING btree (user_id);


--
-- TOC entry 4233 (class 1259 OID 17966)
-- Name: IDX_users_email; Type: INDEX; Schema: public; Owner: cal_app_user
--

CREATE INDEX "IDX_users_email" ON public.users USING btree (email);


--
-- TOC entry 4234 (class 1259 OID 17967)
-- Name: IDX_users_username; Type: INDEX; Schema: public; Owner: cal_app_user
--

CREATE INDEX "IDX_users_username" ON public.users USING btree (username);


--
-- TOC entry 4273 (class 2606 OID 17936)
-- Name: users FK_19bdac20a255ec8d172c1291584; Type: FK CONSTRAINT; Schema: public; Owner: cal_app_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "FK_19bdac20a255ec8d172c1291584" FOREIGN KEY ("availabilityId") REFERENCES public.availability(id);


--
-- TOC entry 4276 (class 2606 OID 17956)
-- Name: meetings FK_2e6f88379a7a198af6c0ba2ca02; Type: FK CONSTRAINT; Schema: public; Owner: cal_app_user
--

ALTER TABLE ONLY public.meetings
    ADD CONSTRAINT "FK_2e6f88379a7a198af6c0ba2ca02" FOREIGN KEY ("eventId") REFERENCES public.events(id);


--
-- TOC entry 4277 (class 2606 OID 17951)
-- Name: meetings FK_4b70ab8832f1d7f9a7387d14307; Type: FK CONSTRAINT; Schema: public; Owner: cal_app_user
--

ALTER TABLE ONLY public.meetings
    ADD CONSTRAINT "FK_4b70ab8832f1d7f9a7387d14307" FOREIGN KEY ("userId") REFERENCES public.users(id);


--
-- TOC entry 4278 (class 2606 OID 17961)
-- Name: day_availability FK_6cf863b682dbf962dec56b3fb37; Type: FK CONSTRAINT; Schema: public; Owner: cal_app_user
--

ALTER TABLE ONLY public.day_availability
    ADD CONSTRAINT "FK_6cf863b682dbf962dec56b3fb37" FOREIGN KEY ("availabilityId") REFERENCES public.availability(id);


--
-- TOC entry 4274 (class 2606 OID 17941)
-- Name: events FK_9929fa8516afa13f87b41abb263; Type: FK CONSTRAINT; Schema: public; Owner: cal_app_user
--

ALTER TABLE ONLY public.events
    ADD CONSTRAINT "FK_9929fa8516afa13f87b41abb263" FOREIGN KEY ("userId") REFERENCES public.users(id);


--
-- TOC entry 4275 (class 2606 OID 17946)
-- Name: integrations FK_c32758a01d05d0d1da56fa46ae1; Type: FK CONSTRAINT; Schema: public; Owner: cal_app_user
--

ALTER TABLE ONLY public.integrations
    ADD CONSTRAINT "FK_c32758a01d05d0d1da56fa46ae1" FOREIGN KEY ("userId") REFERENCES public.users(id);


--
-- TOC entry 4279 (class 2606 OID 17995)
-- Name: user_calendars FK_user_calendars_user; Type: FK CONSTRAINT; Schema: public; Owner: cal_app_user
--

ALTER TABLE ONLY public.user_calendars
    ADD CONSTRAINT "FK_user_calendars_user" FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


-- Completed on 2025-06-16 07:21:33

--
-- PostgreSQL database dump complete
--

