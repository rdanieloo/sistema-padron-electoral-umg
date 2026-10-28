'use strict';
const $ = (id) => document.getElementById(id);
const form = $('form');
let lugares = [];

function hoy() { return new Date().toLocaleDateString('en-CA'); }

async function iniciar() {
  $('fecha_emision_dpi').max = hoy();
  try {
    const c = await api('/api/catalogos');
    llenarSelect($('genero_id'), c.generos, 'genero_id', 'descripcion_genero');
    llenarSelect($('afiliacion_id'), c.afiliaciones, 'afiliacion_id', 'descripcion_afiliacion');
    ['id_municipio_vecindad', 'id_municipio_residencia', 'mun_votacion'].forEach((id) =>
      llenarSelect($(id), c.municipios, 'municipio_id', 'nombre_municipio'));
  } catch (e) { mostrarAlerta('danger', 'No se pudieron cargar los catálogos: ' + e.message); }
}

function pintarLugares() {
  const f = $('filtro').value.trim().toUpperCase();
  const lista = lugares.filter((l) => !f || (l.codigo_lugar + ' ' + l.nombre_lugar + ' ' + l.direccion_lugar).toUpperCase().includes(f));
  llenarSelect($('lugar_votacion_id'), lista, 'lugar_votacion_id',
    (l) => `${l.codigo_lugar} · ${l.nombre_lugar} — ${l.direccion_lugar}`,
    lista.length ? `Seleccione… (${lista.length} lugares)` : 'Sin resultados');
}

$('mun_votacion').addEventListener('change', async (e) => {
  lugares = [];
  $('filtro').value = '';
  if (!e.target.value) { pintarLugares(); return; }
  try { lugares = await api('/api/lugares?municipio_id=' + encodeURIComponent(e.target.value)); pintarLugares(); }
  catch (err) { mostrarAlerta('danger', err.message); }
});
$('filtro').addEventListener('input', pintarLugares);
$('id_municipio_residencia').addEventListener('change', (e) => {
  if (!$('mun_votacion').value && e.target.value) { $('mun_votacion').value = e.target.value; $('mun_votacion').dispatchEvent(new Event('change')); }
});
$('cui_dpi').addEventListener('input', (e) => { e.target.value = e.target.value.replace(/\D/g, ''); });

form.addEventListener('submit', async (ev) => {
  ev.preventDefault();
  ocultarAlerta();
  const nac = $('fecha_nacimiento').value, emi = $('fecha_emision_dpi').value;
  $('fecha_nacimiento').setCustomValidity(nac && nac > '2009-01-01' ? 'menor' : '');
  $('fecha_emision_dpi').setCustomValidity(emi && (emi > hoy() || (nac && emi < nac)) ? 'invalida' : '');
  form.classList.add('was-validated');
  if (!form.checkValidity()) { mostrarAlerta('warning', 'Revise los campos marcados en rojo.'); return; }
  const v = (id) => $(id).value.trim();
  const body = {
    cui_dpi: v('cui_dpi'), fecha_emision_dpi: emi, fecha_nacimiento: nac,
    primer_nombre: v('primer_nombre'), segundo_nombre: v('segundo_nombre'),
    primer_apellido: v('primer_apellido'), segundo_apellido: v('segundo_apellido'),
    sabe_leer_escribir: v('sabe_leer_escribir'), vidente: v('vidente'),
    direccion_geoelectoral: v('direccion_geoelectoral'),
    id_municipio_vecindad: v('id_municipio_vecindad'), id_municipio_residencia: v('id_municipio_residencia'),
    genero_id: v('genero_id'), afiliacion_id: v('afiliacion_id'), lugar_votacion_id: v('lugar_votacion_id')
  };
  $('btnGuardar').disabled = true;
  try {
    const r = await api('/api/registro', { method: 'POST', body: JSON.stringify(body) });
    $('noEmp').textContent = r.registro.no_empadronamiento;
    $('exNombre').textContent = r.registro.nombre_completo || '';
    form.classList.add('d-none');
    $('exito').classList.remove('d-none');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } catch (e) { mostrarAlerta('danger', e.message); }
  finally { $('btnGuardar').disabled = false; }
});

$('btnOtro').addEventListener('click', () => {
  form.reset(); form.classList.remove('was-validated', 'd-none');
  $('exito').classList.add('d-none'); lugares = []; pintarLugares(); ocultarAlerta();
});
$('btnLimpiar').addEventListener('click', () => { form.classList.remove('was-validated'); lugares = []; setTimeout(pintarLugares, 0); ocultarAlerta(); });
iniciar();
