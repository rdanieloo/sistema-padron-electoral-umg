'use strict';
const $ = (id) => document.getElementById(id);
let captchaId = null;

async function cargarCaptcha() {
  try {
    const c = await api('/api/captcha');
    captchaId = c.id; $('captcha').innerHTML = c.svg; $('captchaTexto').value = '';
  } catch (e) { mostrarAlerta('danger', e.message); }
}
$('btnCaptcha').addEventListener('click', cargarCaptcha);

$('tipo').addEventListener('change', () => {
  const dpi = $('tipo').value === 'DPI';
  $('numero').maxLength = dpi ? 13 : 10;
  $('numero').placeholder = dpi ? '13 dígitos del CUI' : '10 caracteres alfanuméricos';
  $('numero').value = '';
});
$('tipo').dispatchEvent(new Event('change'));

$('fecha').addEventListener('input', (e) => {
  let d = e.target.value.replace(/\D/g, '').slice(0, 8);
  if (d.length > 4) d = d.slice(0, 2) + '/' + d.slice(2, 4) + '/' + d.slice(4);
  else if (d.length > 2) d = d.slice(0, 2) + '/' + d.slice(2);
  e.target.value = d;
});

function filas(id, pares) {
  const dl = $(id); dl.innerHTML = '';
  pares.forEach(([k, v]) => {
    const col = document.createElement('div'); col.className = 'col-md-6';
    const dt = document.createElement('dt'); dt.textContent = k;
    const dd = document.createElement('dd'); dd.textContent = v == null || v === '' ? '—' : v;
    col.append(dt, dd); dl.appendChild(col);
  });
}

$('form').addEventListener('submit', async (ev) => {
  ev.preventDefault(); ocultarAlerta();
  const tipo = $('tipo').value, numero = $('numero').value.trim(), fecha = $('fecha').value.trim(), cod = $('captchaTexto').value.trim();
  if (!numero || !fecha || !cod) { mostrarAlerta('warning', 'Complete todos los campos, incluido el código de verificación.'); return; }
  if (!/^\d{2}\/\d{2}\/\d{4}$/.test(fecha)) { mostrarAlerta('warning', 'Ingrese la fecha en formato día/mes/año (ejemplo: 15/03/1985).'); return; }
  $('btnBuscar').disabled = true;
  try {
    const r = await api('/api/consulta', { method: 'POST', body: JSON.stringify({ tipo, numero, fecha, captchaId, captchaTexto: cod }) });
    const x = r.resultado;
    const badge = $('estado'); badge.textContent = x.estado;
    badge.className = 'badge fs-6 ' + (x.estado === 'ACTIVO' ? 'text-bg-success' : 'text-bg-warning');
    filas('sec1', [['No. de empadronamiento', x.no_empadronamiento], ['CUI (DPI)', x.cui_dpi], ['Fecha de emisión del DPI', x.fecha_emision_dpi]]);
    filas('sec2', [['Nombre completo', x.nombre_completo], ['Género', x.genero], ['Lee y escribe', x.sabe_leer_escribir], ['Vidente', x.vidente]]);
    filas('sec3', [['Departamento', x.departamento_vecindad], ['Municipio', x.municipio_vecindad]]);
    filas('sec4', [['Departamento de residencia', x.departamento_residencia], ['Municipio de residencia', x.municipio_residencia],
      ['Dirección geoelectoral', x.direccion_geoelectoral], ['Condición de afiliado', x.afiliacion],
      ['Lugar de votación', `${x.nombre_lugar} (${x.codigo_lugar})`], ['Ubicación del lugar de votación', x.direccion_lugar]]);
    $('panelBusqueda').classList.add('d-none'); $('resultado').classList.remove('d-none');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } catch (e) { mostrarAlerta(e.status === 404 ? 'info' : 'danger', e.message); cargarCaptcha(); }
  finally { $('btnBuscar').disabled = false; }
});

$('btnNueva').addEventListener('click', () => {
  $('form').reset(); $('tipo').dispatchEvent(new Event('change'));
  $('resultado').classList.add('d-none'); $('panelBusqueda').classList.remove('d-none'); ocultarAlerta(); cargarCaptcha();
});
cargarCaptcha();
