# Padrón Electoral – Aplicación web (Integrante 4)

Node.js 18+ · Express · mssql (Tedious) · Bootstrap 5. Solo ejecuta procedimientos almacenados.

## 1. Preparar la base de datos (en SSMS, conectado a 172.16.0.100,1433)
1. Ejecutar `PFBD.sql` (script de Integrante 3, con rutas corregidas a Z:\ y Y:\).
2. Ejecutar `05_parche_procedimientos_app.sql`.
3. Verificar que `usr_padron_app` exista, pertenezca a `rol_padron_app` y pueda ejecutar SPs.

## 2. Preparar el servidor SQL (Integrante 1) – punto crítico
La instancia es nombrada (SRVPRJFINAL) y SQL Browser está deshabilitado, por lo que se necesita **puerto TCP estático**:
SQL Server Configuration Manager → SQL Server Network Configuration → Protocols for SRVPRJFINAL → TCP/IP = Enabled →
Properties → IP Addresses → IPAll: *TCP Dynamic Ports* vacío y *TCP Port* = 1433 → reiniciar el servicio.
Verificar desde la PC anfitriona: `Test-NetConnection 172.16.0.100 -Port 1433`.

## 3. Ejecutar la aplicación (en la PC anfitriona, VS Code)
```
npm install
copy .env.example .env      (editar .env con la contraseña real)
npm start
```
Abrir http://localhost:3000

## 4. Estructura
- `server.js` API + validaciones + CAPTCHA + conexión.
- `public/` interfaz (inicio, registro, consulta).
- `05_parche_procedimientos_app.sql` SPs que consume la app.

## 5. Pruebas sugeridas (datos ficticios)
| Caso | Esperado |
|---|---|
| DPI con 12 dígitos o letras | Mensaje de DPI inválido |
| Nacimiento 02/01/2009 | Rechazado (menor de 18 al 01/01/2027) |
| Nacimiento 01/01/2009 | Aceptado |
| Nombre "maría gómez" | Se guarda "MARÍA GÓMEZ" |
| DPI repetido | "Ya existe un ciudadano empadronado con ese DPI" |
| Emisión posterior a hoy | Rechazado |
| Consulta con captcha incorrecto | Mensaje de código incorrecto |
| Consulta con fecha distinta | "No se encontró un empadronamiento…" |
