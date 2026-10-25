import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { handler } from '../netlify/functions/cash-machine.mjs';

const code = 'random-access-code-for-tests-987654';
const key = 'sk-or-only-mock-no-live-calls';
Object.assign(process.env, {
  CASHMACHINE_ACCESS_CODE: code,
  CASHMACHINE_SESSION_SECRET: randomBytes(40).toString('hex'),
  CASHMACHINE_OPENROUTER_KEY: key,
});
const defaultHeaders = {host: 'cashmachine20.netlify.app', origin: 'https://cashmachine20.netlify.app'};
const call = (action, data = {}, headers = {}) => handler({
  httpMethod: 'POST',
  headers: {...defaultHeaders, ...headers},
  body: JSON.stringify({action, ...data}),
});
const diagnostic = {objetivo:{texto:'Negocio B2B'}, recursos:{presupuesto:'bajo'}, mercado:{cliente:'pyme'}};
async function authCookie() {
  const login = await call('login', {code});
  assert.equal(login.statusCode, 200);
  return login.headers['Set-Cookie'].split(';')[0];
}

test('no configura secretos, niega todas las acciones', async () => {
  const saved = process.env.CASHMACHINE_SESSION_SECRET;
  delete process.env.CASHMACHINE_SESSION_SECRET;
  assert.equal((await call('login', {code})).statusCode, 503);
  process.env.CASHMACHINE_SESSION_SECRET = saved;
});
test('rechaza origen ajeno, ausente o HTTP', async () => {
  assert.equal((await call('login',{code},{origin:'https://attacker.example'})).statusCode,403);
  assert.equal((await call('login',{code},{origin:''})).statusCode,403);
  assert.equal((await call('login',{code},{origin:'http://cashmachine20.netlify.app'})).statusCode,403);
});
test('rechaza contraseña incorrecta', async () => {
  assert.equal((await call('login', {code:'incorrecto'})).statusCode,401);
});
test('login seguro da cookie HttpOnly con expiry', async () => {
  const r = await call('login',{code});
  assert.match(r.headers['Set-Cookie'],/HttpOnly/);
  assert.match(r.headers['Set-Cookie'],/SameSite=Strict/);
  assert.match(r.headers['Set-Cookie'],/Secure/);
  assert.match(r.headers['Set-Cookie'],/Max-Age=14400/);
});
test('restringe diagnostico a una sesión real', async () => {
  assert.equal((await call('diagnose',{contexto:diagnostic})).statusCode,401);
  const cookie=await authCookie();
  assert.equal((await call('diagnose',{contexto:diagnostic},{cookie:cookie+'invalid'})).statusCode,401);
});
test('rechaza payloads erróneos antes del proveedor', async () => {
  const cookie=await authCookie();
  assert.equal((await call('diagnose',{contexto:{untrusted:'yes'}},{cookie})).statusCode,422);
  assert.equal((await call('other',{contexto:diagnostic},{cookie})).statusCode,400);
});
test('genera con modelo gratuito fijo sin entregar secreto al cliente', async () => {
  const cookie=await authCookie(); let count=0;
  const original=globalThis.fetch;
  globalThis.fetch=async(url, options)=>{
    count++;
    assert.equal(url,'https://openrouter.ai/api/v1/chat/completions');
    assert.equal(options.redirect,'manual');
    const body=JSON.parse(options.body);
    assert.equal(body.model,'openrouter/free');
    assert.equal(body.messages.length,2);
    assert(!options.body.includes(key));
    return {status:200,ok:true,json:async()=>({choices:[{message:{content:'Una prioridad con validación.'}}]})};
  };
  try {
    const result=await call('diagnose',{contexto:diagnostic},{cookie});
    assert.equal(result.statusCode,200);
    assert.equal(JSON.parse(result.body).answer,'Una prioridad con validación.');
    assert.equal(count,1);
  } finally {globalThis.fetch=original;}
});
test('no sigue redirecciones del proveedor', async () => {
  const cookie=await authCookie();
  const original=globalThis.fetch;
  globalThis.fetch=async()=>({status:302,ok:false});
  try{assert.equal((await call('diagnose',{contexto:diagnostic},{cookie})).statusCode,502)}
  finally{globalThis.fetch=original;}
});
test('HTML sin secretos y con interfaz autenticada',()=>{
  const html=readFileSync(new URL('../acceso.html',import.meta.url),'utf8');
  assert.match(html,/id="cashAccessForm"/);
  assert.match(html,/action,\s*\.\.\.data/);
  assert.match(html,/cashApi\("diagnose"/);
  assert.doesNotMatch(html,/(?:CASHVIP2026|sk-or-v1-|const API_KEY|const PASSWORD|atob\(|openrouter\.ai\/api\/v1)/);
  assert.match(html,/construirContexto\(\)/);
});
