'use strict';
async function api(url, options) {
  const res = await fetch(url, Object.assign({ headers: { 'Content-Type': 'application/json' } }, options));
  let data = null;
  try { data = await res.json(); } catch (e) { /* sin cuerpo */ }
  if (!res.ok) {
    const err = new Error((data && data.mensaje) || 'No fue posible comunicarse con el servidor.');
    err.status = res.status;
    throw err;
  }
  return data;
}
function mostrarAlerta(tipo, texto) {
  const a = document.getElementById('alerta');
  a.className = 'alert alert-' + tipo;
  a.textContent = texto;
  a.scrollIntoView({ behavior: 'smooth', block: 'center' });
}
function ocultarAlerta() { document.getElementById('alerta').className = 'd-none'; }
function llenarSelect(sel, items, valor, texto, placeholder) {
  sel.innerHTML = '';
  const o = document.createElement('option');
  o.value = ''; o.textContent = placeholder || 'Seleccione…';
  sel.appendChild(o);
  items.forEach((i) => {
    const op = document.createElement('option');
    op.value = i[valor]; op.textContent = typeof texto === 'function' ? texto(i) : i[texto];
    sel.appendChild(op);
  });
}
