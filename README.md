# Knowledge MCP con embeddings acelerados por GPU (OpenVINO)

Extensión para el servidor [`rag-mcp-server`](https://github.com/devsinsight/rag-mcp-server) de devsinsight que sustituye el cálculo de embeddings en CPU (FastEmbed) por un **servicio propio que corre en la GPU integrada de Intel mediante OpenVINO**.

El resultado es una biblioteca de documentos (PDF) con **búsqueda semántica local**, consultable desde cualquier cliente de IA compatible con MCP (Claude Desktop, Claude Code u otros), sin enviar tus documentos a ningún servicio externo.

> **MCP** (Model Context Protocol) es el protocolo que permite a un asistente de IA usar herramientas externas, en este caso buscar dentro de tus documentos.
> **Embedding** es la representación numérica de un texto; textos con significado parecido quedan cerca entre sí, y eso permite buscar por significado y no solo por palabras exactas.

## Qué aporta este repositorio

Este repositorio **no incluye** el código del servidor original. Contiene solo lo que añadí encima:

| Pieza | Qué hace |
|-------|----------|
| `gpu-embedder/gpu_server.py` | Servidor HTTP (Flask) que calcula embeddings con `BAAI/bge-small-en-v1.5` ejecutado por OpenVINO en la GPU. Exporta el modelo una sola vez y lo cachea para los arranques siguientes. |
| `gpu-embedder/start_gpu_server.ps1` | Lo arranca en segundo plano, sin ventana, con registros en `logs/`. |
| `gpu-embedder/install_autostart.ps1` | Registra una tarea programada para que arranque solo al iniciar sesión en Windows. |
| `mcp-server/src/embeddings/embedder.ts` | Reemplaza el módulo de embeddings del servidor original: en vez de calcularlos localmente, llama al servicio de GPU por HTTP. |
| `mcp-server/src/__tests__/unit/embedder.test.ts` | Pruebas unitarias del nuevo módulo (sustituye a las del módulo original). |
| `mcp-server/docker-compose.override.yml` | Indica al contenedor dónde está el servicio de GPU y monta tu carpeta de documentos en solo lectura. |

## Arquitectura

```
  Cliente MCP (Claude Desktop / Claude Code / otro agente)
                      │  HTTP  :38080/mcp
                      ▼
  ┌─────────────────────────────────────────┐
  │ Contenedor: rag-mcp  (servidor MCP)     │
  │  - extrae texto de los PDF y los trocea │
  │  - pide embeddings por HTTP ────────────┼──►  Servicio de GPU en el anfitrión
  └───────────────┬─────────────────────────┘     (Flask + OpenVINO, :8090)
                  │  REST :39333                  modelo BGE-small en la GPU Intel
                  ▼
  ┌─────────────────────────────────────────┐
  │ Contenedor: rag-qdrant (base vectorial) │
  └─────────────────────────────────────────┘
```

El servicio de GPU corre **fuera** de Docker, en el anfitrión, porque Docker Desktop en Windows no expone la GPU integrada al contenedor. El contenedor lo alcanza mediante `host.docker.internal`.

## Requisitos

- Windows 10 u 11 con [Docker Desktop](https://www.docker.com/products/docker-desktop/)
- Python 3.12
- Git
- GPU Intel compatible con OpenVINO (probado en una Intel UHD 620)
- Conexión a internet en el primer arranque, para descargar el modelo

## Instalación

**1. Clona el servidor original y este repositorio**

```powershell
git clone https://github.com/devsinsight/rag-mcp-server.git
git clone https://github.com/DarioVerdecia/knowledge-mcp-gpu.git
```

**2. Copia mis archivos sobre el servidor original**

```powershell
Copy-Item knowledge-mcp-gpu\mcp-server\src\embeddings\embedder.ts rag-mcp-server\src\embeddings\embedder.ts
Copy-Item knowledge-mcp-gpu\mcp-server\src\__tests__\unit\embedder.test.ts rag-mcp-server\src\__tests__\unit\embedder.test.ts
Copy-Item knowledge-mcp-gpu\mcp-server\docker-compose.override.yml rag-mcp-server\
```

**3. Indica dónde están tus documentos**

Crea `rag-mcp-server\.env` (ver `.env.example`):

```
DOCS_PATH=C:/ruta/a/tus/documentos
```

**4. Instala y prueba el servicio de GPU**

```powershell
cd knowledge-mcp-gpu\gpu-embedder
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python gpu_server.py
```

La primera vez exporta el modelo a OpenVINO y lo guarda en `ov_model_cache/` (tarda unos minutos). Cuando veas `GPU Embedder listo.`, comprueba en otra terminal:

```powershell
curl http://localhost:8090/health
```

Debe responder `{"device":"GPU","status":"ok"}`. Cierra el servidor con `Ctrl+C`; lo dejaremos corriendo en segundo plano en el paso 6.

**5. Levanta el servidor MCP y la base vectorial**

```powershell
cd ..\..\rag-mcp-server
docker compose up -d --build
```

El servidor queda en `http://localhost:38080/mcp`. Añádelo a tu cliente, por ejemplo en `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "knowledge": { "type": "http", "url": "http://localhost:38080/mcp" }
  }
}
```

**6. (Opcional) Arranque automático del servicio de GPU**

```powershell
cd ..\knowledge-mcp-gpu\gpu-embedder
.\install_autostart.ps1
```

## Pruebas

Con las dependencias del servidor original instaladas (`npm install`), desde `rag-mcp-server`:

```powershell
npm test
npm run typecheck
```

## Limitaciones conocidas

- **El modelo es en inglés** (`bge-small-en-v1.5`). Con documentos en español la calidad de la búsqueda puede bajar; migrar a un modelo multilingüe es el siguiente paso previsto.
- **El servicio de GPU no tiene autenticación y escucha en todas las interfaces** (`0.0.0.0:8090`). Úsalo solo en redes de confianza o limita el puerto con el cortafuegos.
- Usa el servidor de desarrollo de Flask, suficiente para uso personal pero no para producción.
- El dispositivo está fijado a `"GPU"` en `gpu_server.py`. Si tu equipo no tiene una GPU compatible, cámbialo a `"CPU"` o `"AUTO"`.
- `fastembed` sigue en el `package.json` del servidor original aunque ya no se usa; no estorba, pero se puede retirar.

## Créditos

- Servidor MCP original: [devsinsight/rag-mcp-server](https://github.com/devsinsight/rag-mcp-server). Este repositorio no redistribuye su código y se apoya en él como base.
- Modelo de embeddings: [BAAI/bge-small-en-v1.5](https://huggingface.co/BAAI/bge-small-en-v1.5)
- [OpenVINO](https://github.com/openvinotoolkit/openvino), [Sentence Transformers](https://www.sbert.net/), [Qdrant](https://qdrant.tech)

## Licencia

[MIT](LICENSE) © 2026 Darío Verdecia López. La licencia cubre únicamente el código de este repositorio; el servidor original de devsinsight no se redistribuye aquí y se rige por sus propios términos.