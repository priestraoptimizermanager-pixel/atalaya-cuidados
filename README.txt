ATALAYA CUIDADOS - SERVIDOR

Aplicacion privada instalable para citas medicas y horas de cuidadora.
Preparada para desplegar en el mismo tipo de servidor que Intent Cluster: Docker + Easypanel.

ESTRUCTURA

- docker-compose.yml
- app/Dockerfile
- app/server.py
- app/index.html
- app/app.js
- app/styles.css
- app/manifest.webmanifest
- app/service-worker.js
- app/icon.svg

VARIABLES EN EASYPANEL

- PORT: 8080
- SYNC_TOKEN_HASH: hash SHA-256 del codigo privado de sincronizacion.

El compose incluido ya lleva configurado el hash actual.
El codigo privado en claro esta fuera de esta carpeta, en:
CODIGO_PRIVADO_SINCRONIZACION.txt

PUERTO INTERNO

8080

DOMINIO SUGERIDO

cuidados.atalayalabs.com

En Easypanel, el dominio debe apuntar al servicio atalaya-cuidados y al puerto 8080.

DESPLIEGUE RECOMENDADO

1. Crear un repositorio privado en GitHub llamado atalaya-cuidados.
2. Subir el contenido de esta carpeta server al repositorio.
3. En Easypanel, crear un servicio nuevo desde Git.
4. Seleccionar docker-compose.yml como archivo de despliegue.
5. Confirmar PORT=8080 y SYNC_TOKEN_HASH.
6. Hacer deploy.
7. Abrir el dominio HTTPS.
8. Crear la clave familiar.
9. En Ajustes, dejar Direccion privada de sincronizacion como ./api/sync.
10. Pegar el codigo privado de sincronizacion.
11. Pulsar Sincronizar ahora.

SEGURIDAD

- El servidor solo almacena datos cifrados.
- La clave familiar no se envia al servidor.
- El codigo privado de sincronizacion se comprueba por hash SHA-256.
- El volumen atalaya-cuidados-data conserva los datos entre despliegues.
