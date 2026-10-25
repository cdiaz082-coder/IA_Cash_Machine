# Cash Machine — proxy seguro Netlify

## Qué corrige
- Retira el código de acceso de prueba y cualquier clave OpenRouter del navegador.
- Mantiene las ocho etapas y el guardado local del diagnóstico.
- La página de acceso solicita código y usa una sesión firmada HttpOnly/SameSite=Strict.
- Una función Netlify autentica en el servidor y llama exclusivamente a OpenRouter gratuito.
- index.html y su enlace Flow no cambian.

## Activación
En Netlify > cashmachine20 > Project configuration > Environment variables, definir como secretos (Functions, Production):

| Variable | Valor |
|---|---|
| CASHMACHINE_ACCESS_CODE | Código nuevo aleatorio de 18+ caracteres; no reutilizar el código antiguo. |
| CASHMACHINE_SESSION_SECRET | Secreto aleatorio privado de 32+ caracteres. |
| CASHMACHINE_OPENROUTER_KEY | Clave nueva exclusiva de Cash Machine, con límite externo de gasto US$0. |

Para generar localmente en PowerShell: python -c "import secrets; print('CASHMACHINE_ACCESS_CODE:', secrets.token_urlsafe(24)); print('CASHMACHINE_SESSION_SECRET:', secrets.token_urlsafe(48))"

Copiar los valores únicamente en Netlify. Nunca publicarlos en GitHub ni pegarlos en el chat. No usar la clave revocada ni la clave de la secretaria.

NO fusionar esta rama a main antes de configurar las tres variables. Las actualizaciones de variables Netlify requieren redeploy. El enlace GitHub-Netlify desplegará automáticamente el commit de main.

## Pruebas
node --test tests/cash-machine.test.mjs

Tras desplegar: acceso deniega un código erróneo; código nuevo habilita ocho etapas; generación devuelve resultado o error claro; navegador no ve API key ni llama directo a OpenRouter. Verificar en la consola que el proveedor solo usa modelos gratuitos. Probar Flow con una compra de prueba autorizada.

## Límites
El botón Flow no entrega automáticamente accesos. La entrega del código sigue siendo manual hasta implementar webhook Flow verificado y accesos individuales. No presentar el cobro como activación instantánea comprobada. El código actual es compartido, no una licencia individual. Falta un limitador distribuido y revocación por comprador para funcionamiento comercial automático. Las cuotas gratuitas pueden agotarse.
