const GPU_EMBEDDER_URL =
  process.env['GPU_EMBEDDER_URL'] ?? 'http://host.docker.internal:8090'

type EmbedMode = 'document' | 'query'

async function embed(
  texts: string[],
  mode: EmbedMode,
): Promise<number[][]> {
  if (texts.length === 0) {
    return []
  }

  const response = await fetch(`${GPU_EMBEDDER_URL}/embed`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      texts,
      mode,
    }),
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(
      `GPU embedding server error ${response.status}: ${body}`,
    )
  }

  const data = (await response.json()) as {
    embeddings?: number[][]
  }

  if (!Array.isArray(data.embeddings)) {
    throw new Error('GPU embedding server returned invalid embeddings')
  }

  return data.embeddings
}

/**
 * Generate embeddings for document passages using the OpenVINO
 * GPU server running on the host.
 */
export async function embedDocuments(
  texts: string[],
): Promise<number[][]> {
  return embed(texts, 'document')
}

/**
 * Generate an embedding for a search query using the OpenVINO
 * GPU server running on the host.
 */
export async function embedQuery(text: string): Promise<number[]> {
  const vectors = await embed([text], 'query')

  const vector = vectors[0]

  if (!vector) {
    throw new Error('GPU embedding server returned no query embedding')
  }

  return vector
}
