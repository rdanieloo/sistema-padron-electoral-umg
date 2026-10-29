# Sistema de Registro y Consulta de Padrón Electoral

Aplicación web para registrar empadronamientos y consultar si un ciudadano se encuentra empadronado en el departamento de Jutiapa, Guatemala. Proyecto con fines académicos y datos ficticios, sin relación con instituciones oficiales.

## Características

- **Registro de empadronamiento** con validaciones en pantalla y en la base de datos.
- **Número de empadronamiento** aleatorio, alfanumérico, de 10 caracteres y único.
- **Consulta** por número de empadronamiento o por DPI, con fecha de nacimiento y código de verificación (CAPTCHA).
- **Reglas de negocio en la base de datos**: DPI de 13 dígitos, mayoría de edad al 01/01/2027, géneros permitidos, ubicación limitada a Jutiapa y texto almacenado en mayúsculas.
- La aplicación accede a los datos únicamente mediante procedimientos almacenados.

## Tecnologías

- Node.js 18 o superior
- Express, mssql, helmet y express-rate-limit
- Microsoft SQL Server
- Bootstrap 5 y Bootstrap Icons (instalados localmente, sin necesidad de internet)

## Requisitos

- Node.js 18+
- Microsoft SQL Server con la base de datos del sistema creada
- Un usuario de SQL Server con permiso de ejecución sobre los procedimientos almacenados

## Instalación

1. Clonar el repositorio e ingresar a la carpeta de la aplicación:

   ```bash
   git clone https://github.com/rdanieloo/sistema-padron-electoral-umg.git
   cd sistema-padron-electoral-umg/padron-app
   ```

2. Instalar las dependencias:

   ```bash
   npm install
   ```

3. Crear el archivo de configuración a partir del ejemplo:

   ```bash
   copy .env.example .env      # Windows
   cp .env.example .env        # Linux / macOS
   ```

4. Editar `.env` con los datos de conexión (ver la tabla siguiente).

5. Ejecutar en SQL Server el script `05_parche_procedimientos_app.sql`, que crea los procedimientos almacenados que utiliza la aplicación.

6. Iniciar la aplicación:

   ```bash
   npm start
   ```

7. Abrir `http://localhost:3000` en el navegador.

## Variables de entorno

| Variable | Descripción |
|---|---|
| `PORT` | Puerto de la aplicación (por defecto 3000) |
| `DB_SERVER` | Dirección del servidor SQL Server |
| `DB_PORT` | Puerto TCP de SQL Server (por defecto 1433) |
| `DB_NAME` | Nombre de la base de datos |
| `DB_USER` | Usuario de la aplicación |
| `DB_PASSWORD` | Contraseña del usuario |
| `DB_ENCRYPT` | `true` para cifrar la conexión |
| `DB_TRUST_CERT` | `true` para confiar en el certificado del servidor |

El archivo `.env` contiene credenciales y no debe subirse al repositorio.

## Estructura del proyecto

```
padron-app/
├── server.js                         API, validaciones, CAPTCHA y conexión a la base de datos
├── 05_parche_procedimientos_app.sql  Procedimientos almacenados de la aplicación
├── package.json
├── .env.example
└── public/
    ├── index.html                    Inicio
    ├── registro.html                 Módulo de registro
    ├── consulta.html                 Módulo de consulta
    ├── css/styles.css
    └── js/                           Lógica del navegador
```

## Reglas de negocio

| Regla | Descripción |
|---|---|
| No. de empadronamiento | 10 caracteres alfanuméricos aleatorios, único |
| DPI (CUI) | Exactamente 13 dígitos y único por ciudadano |
| Edad | 18 años cumplidos al 01/01/2027 |
| Género | Solo MASCULINO o FEMENINO |
| Ubicación | Únicamente el departamento de Jutiapa y sus 17 municipios |
| Texto | Todo se almacena en MAYÚSCULAS |

## API

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/catalogos` | Municipios, géneros, afiliaciones y estados |
| GET | `/api/lugares?municipio_id=` | Lugares de votación de un municipio |
| GET | `/api/captcha` | Genera un código de verificación |
| POST | `/api/registro` | Registra un empadronamiento |
| POST | `/api/consulta` | Consulta un empadronamiento |

## Solución de problemas

- **No conecta con SQL Server:** verificar que el servicio esté activo, que el protocolo TCP/IP esté habilitado y que el puerto configurado en `DB_PORT` esté abierto en el firewall. Si se usa una instancia con nombre, se recomienda fijar un puerto TCP estático.
- **No aparecen los iconos o los estilos:** ejecutar `npm install` y recargar la página con `Ctrl + F5`.
- **Error al cargar catálogos o registrar:** confirmar que el script `05_parche_procedimientos_app.sql` se ejecutó completo.

## Aviso

Sistema con fines estrictamente académicos. Todos los datos de prueba deben ser ficticios.