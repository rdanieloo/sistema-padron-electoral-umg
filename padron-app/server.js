'use strict';
require('dotenv').config();
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const sql = require('mssql');

const app = express();
app.disable('x-powered-by');
app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: false,
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:'],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"]
    }
  }
}));
app.use(express.json({ limit: '20kb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/vendor/bootstrap', express.static(path.join(__dirname, 'node_modules', 'bootstrap', 'dist')));

/* ------------------------- Conexión a SQL Server ------------------------- */
const dbConfig = {
  server: process.env.DB_SERVER,
  port: Number(process.env.DB_PORT || 1433),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  options: {
    encrypt: process.env.DB_ENCRYPT !== 'false',
    trustServerCertificate: process.env.DB_TRUST_CERT === 'true'
  },
  pool: { max: 10, min: 0, idleTimeoutMillis: 30000 },
  connectionTimeout: 15000,
  requestTimeout: 15000
};
let poolPromise = null;
function getPool() {
  if (!poolPromise) {
    poolPromise = new sql.ConnectionPool(dbConfig).connect().catch((e) => { poolPromise = null; throw e; });
  }
  return poolPromise;
}
const h = (fn) => (req, res, next) => fn(req, res, next).catch(next);

/* ------------------------------ Utilidades ------------------------------- */
const ISO = /^\d{4}-\d{2}-\d{2}$/;
function isoValida(s) {
  if (typeof s !== 'string' || !ISO.test(s)) return false;
  const d = new Date(s + 'T00:00:00Z');
  return !isNaN(d) && d.toISOString().slice(0, 10) === s;
}
function dmyAIso(s) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(s || '').trim());
  if (!m) return null;
  const iso = `${m[3]}-${m[2]}-${m[1]}`;
  return isoValida(iso) ? iso : null;
}
const hoyIso = () => new Date().toLocaleDateString('en-CA');
const NOMBRE = /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ' ]{1,100}$/;
const SINO = new Set(['SI', 'NO']);
const entero = (v) => Number.isInteger(Number(v)) && Number(v) > 0;

/* ------------------------------- Captcha --------------------------------- */
const captchas = new Map();
const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function crearCaptcha() {
  let texto = '';
  for (let i = 0; i < 5; i++) texto += CHARS[crypto.randomInt(CHARS.length)];
  const id = crypto.randomUUID();
  captchas.set(id, { texto, exp: Date.now() + 5 * 60 * 1000 });
  return { id, svg: svgCaptcha(texto) };
}
function svgCaptcha(texto) {
  const r = (a, b) => a + crypto.randomInt(b - a + 1);
  let s = '<svg xmlns="http://www.w3.org/2000/svg" width="180" height="56" viewBox="0 0 180 56" role="img" aria-label="Código de verificación">';
  s += '<rect width="180" height="56" fill="#eef3f8"/>';
  for (let i = 0; i < 6; i++) {
    s += `<line x1="${r(0, 180)}" y1="${r(0, 56)}" x2="${r(0, 180)}" y2="${r(0, 56)}" stroke="#9db4c9" stroke-width="${r(1, 2)}"/>`;
  }
  const colores = ['#1f5f8b', '#b02a30', '#274c66', '#6b2d5c'];
  [...texto].forEach((c, i) => {
    s += `<text x="${18 + i * 32}" y="${r(36, 42)}" font-size="${r(28, 34)}" font-family="Verdana, monospace" font-weight="bold" fill="${colores[r(0, 3)]}" transform="rotate(${r(-18, 18)} ${18 + i * 32} 30)">${c}</text>`;
  });
  for (let i = 0; i < 25; i++) s += `<circle cx="${r(0, 180)}" cy="${r(0, 56)}" r="1" fill="#6b8299"/>`;
  return s + '</svg>';
}
function verificarCaptcha(id, entrada) {
  const c = captchas.get(id);
  captchas.delete(id); // un solo uso
  return !!c && c.exp > Date.now() && String(entrada || '').trim().toUpperCase() === c.texto;
}
setInterval(() => { const t = Date.now(); for (const [k, v] of captchas) if (v.exp < t) captchas.delete(k); }, 60000).unref();

/* -------------------------------- Rutas ---------------------------------- */
app.get('/api/captcha', h(async (req, res) => { res.set('Cache-Control', 'no-store'); res.json(crearCaptcha()); }));

app.get('/api/catalogos', h(async (req, res) => {
  const pool = await getPool();
  const [m, g, a] = await Promise.all([
    pool.request().execute('dbo.usp_ListarMunicipios'),
    pool.request().execute('dbo.usp_ListarGeneros'),
    pool.request().execute('dbo.usp_ListarAfiliaciones')
  ]);
  res.json({ departamento: 'JUTIAPA', municipios: m.recordset, generos: g.recordset, afiliaciones: a.recordset });
}));

app.get('/api/lugares', h(async (req, res) => {
  if (!entero(req.query.municipio_id)) return res.status(400).json({ ok: false, mensaje: 'Municipio no válido.' });
  const pool = await getPool();
  const r = await pool.request().input('municipio_id', sql.Int, Number(req.query.municipio_id)).execute('dbo.usp_ListarLugaresVotacion');
  res.json(r.recordset);
}));

app.post('/api/registro', h(async (req, res) => {
  const b = req.body || {};
  const err = (mensaje) => res.status(400).json({ ok: false, mensaje });
  if (!/^\d{13}$/.test(String(b.cui_dpi || ''))) return err('El DPI (CUI) debe tener exactamente 13 dígitos numéricos.');
  if (!isoValida(b.fecha_nacimiento)) return err('La fecha de nacimiento no es válida.');
  if (b.fecha_nacimiento > '2009-01-01') return err('La persona debe tener 18 años cumplidos al 01/01/2027 (nacida el 01/01/2009 o antes).');
  if (!isoValida(b.fecha_emision_dpi)) return err('La fecha de emisión del DPI no es válida.');
  if (b.fecha_emision_dpi > hoyIso()) return err('La fecha de emisión del DPI no puede ser posterior a la fecha de registro.');
  if (b.fecha_emision_dpi < b.fecha_nacimiento) return err('La fecha de emisión del DPI no puede ser anterior a la fecha de nacimiento.');
  if (!NOMBRE.test(String(b.primer_nombre || '').trim())) return err('El primer nombre es obligatorio y solo admite letras.');
  if (!NOMBRE.test(String(b.primer_apellido || '').trim())) return err('El primer apellido es obligatorio y solo admite letras.');
  for (const k of ['segundo_nombre', 'segundo_apellido']) {
    if (b[k] && !NOMBRE.test(String(b[k]).trim())) return err('Los nombres y apellidos solo admiten letras.');
  }
  for (const k of ['sabe_leer_escribir', 'vidente', 'direccion_geoelectoral']) {
    if (!SINO.has(String(b[k] || '').toUpperCase())) return err('Los campos SI/NO tienen un valor no válido.');
  }
  for (const k of ['id_municipio_vecindad', 'id_municipio_residencia', 'genero_id', 'afiliacion_id', 'lugar_votacion_id']) {
    if (!entero(b[k])) return err('Complete todos los campos de selección obligatorios.');
  }
  const pool = await getPool();
  const r = await pool.request()
    .input('cui_dpi', sql.VarChar(13), String(b.cui_dpi))
    .input('fecha_emision_dpi', sql.VarChar(10), b.fecha_emision_dpi)
    .input('fecha_nacimiento', sql.VarChar(10), b.fecha_nacimiento)
    .input('primer_nombre', sql.VarChar(100), String(b.primer_nombre).trim())
    .input('segundo_nombre', sql.VarChar(100), b.segundo_nombre ? String(b.segundo_nombre).trim() : null)
    .input('primer_apellido', sql.VarChar(100), String(b.primer_apellido).trim())
    .input('segundo_apellido', sql.VarChar(100), b.segundo_apellido ? String(b.segundo_apellido).trim() : null)
    .input('sabe_leer_escribir', sql.VarChar(2), String(b.sabe_leer_escribir))
    .input('vidente', sql.VarChar(2), String(b.vidente))
    .input('direccion_geoelectoral', sql.VarChar(2), String(b.direccion_geoelectoral))
    .input('id_municipio_vecindad', sql.Int, Number(b.id_municipio_vecindad))
    .input('id_municipio_residencia', sql.Int, Number(b.id_municipio_residencia))
    .input('genero_id', sql.Int, Number(b.genero_id))
    .input('afiliacion_id', sql.Int, Number(b.afiliacion_id))
    .input('lugar_votacion_id', sql.Int, Number(b.lugar_votacion_id))
    .execute('dbo.usp_RegistrarCiudadano');
  res.status(201).json({ ok: true, mensaje: 'Empadronamiento registrado correctamente.', registro: r.recordset[0] });
}));

const consultaLimiter = rateLimit({
  windowMs: 60 * 1000, max: 30, standardHeaders: true, legacyHeaders: false,
  message: { ok: false, mensaje: 'Demasiados intentos. Espere un minuto e intente de nuevo.' }
});
app.post('/api/consulta', consultaLimiter, h(async (req, res) => {
  const b = req.body || {};
  const err = (mensaje) => res.status(400).json({ ok: false, mensaje });
  if (!verificarCaptcha(b.captchaId, b.captchaTexto)) return err('El código de verificación es incorrecto o expiró. Intente con uno nuevo.');
  const tipo = String(b.tipo || '').toUpperCase();
  if (!['DPI', 'EMPADRONAMIENTO'].includes(tipo)) return err('Seleccione un tipo de documento válido.');
  const numero = String(b.numero || '').trim().toUpperCase();
  if (tipo === 'DPI' && !/^\d{13}$/.test(numero)) return err('El DPI debe tener 13 dígitos numéricos.');
  if (tipo === 'EMPADRONAMIENTO' && !/^[A-Z0-9]{10}$/.test(numero)) return err('El número de empadronamiento debe tener 10 caracteres alfanuméricos.');
  const fecha = dmyAIso(b.fecha);
  if (!fecha) return err('Ingrese la fecha de nacimiento en formato día/mes/año (ejemplo: 15/03/1985).');
  const pool = await getPool();
  const r = await pool.request()
    .input('tipo_documento', sql.VarChar(20), tipo)
    .input('numero_documento', sql.VarChar(13), numero)
    .input('fecha_nacimiento', sql.VarChar(10), fecha)
    .execute('dbo.usp_ConsultarCiudadano');
  if (!r.recordset.length) {
    return res.status(404).json({ ok: false, mensaje: 'No se encontró un empadronamiento con los datos ingresados.' });
  }
  res.json({ ok: true, resultado: r.recordset[0] });
}));

/* ------------------------- Manejo de errores ----------------------------- */
app.use('/api', (req, res) => res.status(404).json({ ok: false, mensaje: 'Recurso no encontrado.' }));
app.use((e, req, res, next) => { // eslint-disable-line no-unused-vars
  const num = (e && (e.number || (e.originalError && e.originalError.info && e.originalError.info.number))) || 0;
  if (num >= 50000) return res.status(400).json({ ok: false, mensaje: e.message }); // regla de negocio lanzada por la BD
  console.error('[ERROR]', e && (e.code || ''), e && e.message); // sin datos personales
  res.status(500).json({ ok: false, mensaje: 'No fue posible completar la operación. Intente nuevamente o contacte al administrador.' });
});

const PORT = Number(process.env.PORT || 3000);
app.listen(PORT, () => {
  console.log(`Aplicación en http://localhost:${PORT}`);
  getPool().then(() => console.log(`Conectado a SQL Server ${process.env.DB_SERVER}:${process.env.DB_PORT || 1433}`))
    .catch((e) => console.error('No se pudo conectar a SQL Server:', e.message));
});
