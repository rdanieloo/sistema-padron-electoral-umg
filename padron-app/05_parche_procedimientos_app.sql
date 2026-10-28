/* =====================================================================
   PARCHE DE PROCEDIMIENTOS PARA LA APLICACION (Integrante 4 -> coordinar con Integrante 3)
   Ejecutar DESPUES del script PFBD.sql. Probar en SSMS antes de la demo.
   - La app solo usa EXECUTE (minimo privilegio).
   - Mensajes de error claros desde la base de datos (THROW 501xx).
   - Numero de empadronamiento: 10 caracteres A-Z / 0-9 (36 simbolos) con control de colision.
   - RN-6: se convierte a MAYUSCULAS en el SP y el trigger TR_Ciudadano_Mayusculas queda como respaldo.
   ===================================================================== */
USE [Registro_y_Consulta_Padrón_Electoral_DB];
GO

/* ---------- Catalogos ---------- */
CREATE OR ALTER PROCEDURE dbo.usp_ListarMunicipios
AS
BEGIN
    SET NOCOUNT ON;
    SELECT M.municipio_id, M.nombre_municipio
    FROM dbo.Municipio AS M
    INNER JOIN dbo.Departamento AS D ON D.departamento_id = M.departamento_id
    WHERE D.nombre_departamento = 'JUTIAPA'
    ORDER BY M.nombre_municipio;
END;
GO
CREATE OR ALTER PROCEDURE dbo.usp_ListarGeneros
AS
BEGIN
    SET NOCOUNT ON;
    SELECT genero_id, descripcion_genero FROM dbo.Genero ORDER BY descripcion_genero;
END;
GO
CREATE OR ALTER PROCEDURE dbo.usp_ListarAfiliaciones
AS
BEGIN
    SET NOCOUNT ON;
    SELECT afiliacion_id, descripcion_afiliacion FROM dbo.Afiliacion ORDER BY descripcion_afiliacion;
END;
GO
CREATE OR ALTER PROCEDURE dbo.usp_ListarLugaresVotacion
    @municipio_id INT
AS
BEGIN
    SET NOCOUNT ON;
    SELECT lugar_votacion_id, codigo_lugar, nombre_lugar, direccion_lugar
    FROM dbo.LugarVotacion
    WHERE municipio_id = @municipio_id
    ORDER BY nombre_lugar, codigo_lugar;
END;
GO

/* ---------- Registro ---------- */
CREATE OR ALTER PROCEDURE dbo.usp_RegistrarCiudadano
    @cui_dpi VARCHAR(13),
    @fecha_emision_dpi DATE,
    @fecha_nacimiento DATE,
    @primer_nombre VARCHAR(100),
    @segundo_nombre VARCHAR(100) = NULL,
    @primer_apellido VARCHAR(100),
    @segundo_apellido VARCHAR(100) = NULL,
    @sabe_leer_escribir VARCHAR(2),
    @vidente VARCHAR(2),
    @direccion_geoelectoral VARCHAR(2),
    @id_municipio_vecindad INT,
    @id_municipio_residencia INT,
    @genero_id INT,
    @afiliacion_id INT,
    @lugar_votacion_id INT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    /* Normalizacion (RN-6) */
    SET @cui_dpi            = LTRIM(RTRIM(@cui_dpi));
    SET @primer_nombre      = UPPER(LTRIM(RTRIM(@primer_nombre)));
    SET @segundo_nombre     = NULLIF(UPPER(LTRIM(RTRIM(@segundo_nombre))), '');
    SET @primer_apellido    = UPPER(LTRIM(RTRIM(@primer_apellido)));
    SET @segundo_apellido   = NULLIF(UPPER(LTRIM(RTRIM(@segundo_apellido))), '');
    SET @sabe_leer_escribir = UPPER(LTRIM(RTRIM(@sabe_leer_escribir)));
    SET @vidente            = UPPER(LTRIM(RTRIM(@vidente)));
    SET @direccion_geoelectoral = UPPER(LTRIM(RTRIM(@direccion_geoelectoral)));

    /* Validaciones con mensajes claros */
    IF @cui_dpi IS NULL OR LEN(@cui_dpi) <> 13 OR @cui_dpi LIKE '%[^0-9]%'
    BEGIN THROW 50101, 'El DPI (CUI) debe tener exactamente 13 dígitos numéricos.', 1; END;

    IF @fecha_nacimiento > '20090101'
    BEGIN THROW 50102, 'La persona debe tener 18 años cumplidos al 01/01/2027.', 1; END;

    IF @fecha_emision_dpi > CONVERT(DATE, GETDATE())
    BEGIN THROW 50103, 'La fecha de emisión del DPI no puede ser posterior a la fecha de registro.', 1; END;

    IF @fecha_emision_dpi < @fecha_nacimiento
    BEGIN THROW 50104, 'La fecha de emisión del DPI no puede ser anterior a la fecha de nacimiento.', 1; END;

    IF @primer_nombre = '' OR @primer_apellido = ''
    BEGIN THROW 50105, 'El primer nombre y el primer apellido son obligatorios.', 1; END;

    IF @sabe_leer_escribir NOT IN ('SI','NO') OR @vidente NOT IN ('SI','NO') OR @direccion_geoelectoral NOT IN ('SI','NO')
    BEGIN THROW 50106, 'Los campos Lee y escribe, Vidente y Dirección geoelectoral solo admiten SI o NO.', 1; END;

    IF EXISTS (SELECT 1 FROM dbo.Ciudadano WHERE cui_dpi = @cui_dpi)
    BEGIN THROW 50107, 'Ya existe un ciudadano empadronado con ese DPI.', 1; END;

    IF NOT EXISTS (SELECT 1 FROM dbo.Municipio WHERE municipio_id = @id_municipio_vecindad)
       OR NOT EXISTS (SELECT 1 FROM dbo.Municipio WHERE municipio_id = @id_municipio_residencia)
    BEGIN THROW 50108, 'El municipio seleccionado no pertenece al departamento de Jutiapa.', 1; END;

    IF NOT EXISTS (SELECT 1 FROM dbo.Genero WHERE genero_id = @genero_id)
    BEGIN THROW 50109, 'El género seleccionado no es válido (solo MASCULINO o FEMENINO).', 1; END;

    IF NOT EXISTS (SELECT 1 FROM dbo.Afiliacion WHERE afiliacion_id = @afiliacion_id)
    BEGIN THROW 50110, 'La afiliación seleccionada no es válida.', 1; END;

    IF NOT EXISTS (SELECT 1 FROM dbo.LugarVotacion WHERE lugar_votacion_id = @lugar_votacion_id)
    BEGIN THROW 50111, 'El lugar de votación seleccionado no existe en el catálogo.', 1; END;

    /* Generacion del No. de empadronamiento (RN-1): aleatorio, alfanumerico, 10 caracteres, sin repetir */
    DECLARE @no VARCHAR(10), @i INT, @chars CHAR(36) = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    DECLARE @id INT;

    BEGIN TRY
        WHILE 1 = 1
        BEGIN
            SET @no = ''; SET @i = 0;
            WHILE @i < 10
            BEGIN
                SET @no = @no + SUBSTRING(@chars, ((CHECKSUM(NEWID()) & 2147483647) % 36) + 1, 1);
                SET @i += 1;
            END;
            IF NOT EXISTS (SELECT 1 FROM dbo.Ciudadano WHERE no_empadronamiento = @no) BREAK;
        END;

        INSERT INTO dbo.Ciudadano
        (
            no_empadronamiento, cui_dpi, fecha_emision_dpi, fecha_nacimiento,
            primer_nombre, segundo_nombre, primer_apellido, segundo_apellido,
            sabe_leer_escribir, vidente, direccion_geoelectoral,
            id_municipio_vecindad, id_municipio_residencia,
            genero_id, afiliacion_id, lugar_votacion_id
        )
        VALUES
        (
            @no, @cui_dpi, @fecha_emision_dpi, @fecha_nacimiento,
            @primer_nombre, @segundo_nombre, @primer_apellido, @segundo_apellido,
            @sabe_leer_escribir, @vidente, @direccion_geoelectoral,
            @id_municipio_vecindad, @id_municipio_residencia,
            @genero_id, @afiliacion_id, @lugar_votacion_id
        );
        SET @id = CONVERT(INT, SCOPE_IDENTITY());
    END TRY
    BEGIN CATCH
        IF ERROR_NUMBER() IN (2601, 2627)
        BEGIN THROW 50120, 'No fue posible registrar: DPI o número de empadronamiento duplicado. Intente nuevamente.', 1; END;
        THROW;
    END CATCH;

    SELECT C.no_empadronamiento,
           C.cui_dpi,
           CONCAT_WS(' ', C.primer_nombre, C.segundo_nombre, C.primer_apellido, C.segundo_apellido) AS nombre_completo
    FROM dbo.Ciudadano AS C
    WHERE C.ciudadano_id = @id;
END;
GO

/* ---------- Consulta ---------- */
CREATE OR ALTER PROCEDURE dbo.usp_ConsultarCiudadano
    @tipo_documento VARCHAR(20),
    @numero_documento VARCHAR(13),
    @fecha_nacimiento DATE
AS
BEGIN
    SET NOCOUNT ON;
    SET @tipo_documento   = UPPER(LTRIM(RTRIM(@tipo_documento)));
    SET @numero_documento = UPPER(LTRIM(RTRIM(@numero_documento)));

    IF @tipo_documento NOT IN ('DPI', 'EMPADRONAMIENTO')
    BEGIN THROW 50010, 'Tipo de documento no válido.', 1; END;

    SELECT
        C.no_empadronamiento,
        C.cui_dpi,
        CONVERT(CHAR(10), C.fecha_emision_dpi, 103) AS fecha_emision_dpi,
        CONCAT_WS(' ', C.primer_nombre, C.segundo_nombre, C.primer_apellido, C.segundo_apellido) AS nombre_completo,
        G.descripcion_genero  AS genero,
        C.sabe_leer_escribir,
        C.vidente,
        DV.nombre_departamento AS departamento_vecindad,
        MV.nombre_municipio    AS municipio_vecindad,
        DR.nombre_departamento AS departamento_residencia,
        MR.nombre_municipio    AS municipio_residencia,
        C.direccion_geoelectoral,
        LV.codigo_lugar,
        LV.nombre_lugar,
        LV.direccion_lugar,
        A.descripcion_afiliacion AS afiliacion,
        E.descripcion_estado     AS estado
    FROM dbo.Ciudadano AS C
    INNER JOIN dbo.Genero       AS G  ON G.genero_id = C.genero_id
    INNER JOIN dbo.Municipio    AS MV ON MV.municipio_id = C.id_municipio_vecindad
    INNER JOIN dbo.Departamento AS DV ON DV.departamento_id = MV.departamento_id
    INNER JOIN dbo.Municipio    AS MR ON MR.municipio_id = C.id_municipio_residencia
    INNER JOIN dbo.Departamento AS DR ON DR.departamento_id = MR.departamento_id
    INNER JOIN dbo.LugarVotacion AS LV ON LV.lugar_votacion_id = C.lugar_votacion_id
    INNER JOIN dbo.Afiliacion   AS A  ON A.afiliacion_id = C.afiliacion_id
    INNER JOIN dbo.Estado       AS E  ON E.estado_id = C.estado_id
    WHERE C.fecha_nacimiento = @fecha_nacimiento
      AND ( (@tipo_documento = 'DPI' AND C.cui_dpi = @numero_documento)
         OR (@tipo_documento = 'EMPADRONAMIENTO' AND C.no_empadronamiento = @numero_documento) );
END;
GO

/* ---------- Permisos (minimo privilegio) ---------- */
-- Si el rol aun no existe en tu BD, ejecutar antes: CREATE ROLE rol_padron_app;
GRANT EXECUTE ON SCHEMA::dbo TO rol_padron_app;
-- Recomendado: quitar acceso directo a tablas; la app solo debe ejecutar SPs
REVOKE SELECT, INSERT ON SCHEMA::dbo FROM rol_padron_app;
GO

/* ---------- Pruebas rapidas (datos ficticios) ---------- */
-- EXEC dbo.usp_RegistrarCiudadano @cui_dpi='2999000010101', @fecha_emision_dpi='2021-03-10', @fecha_nacimiento='1995-07-14',
--      @primer_nombre='maria', @segundo_nombre='luisa', @primer_apellido='gomez', @segundo_apellido=NULL,
--      @sabe_leer_escribir='si', @vidente='si', @direccion_geoelectoral='si',
--      @id_municipio_vecindad=1, @id_municipio_residencia=1, @genero_id=2, @afiliacion_id=2, @lugar_votacion_id=1;
