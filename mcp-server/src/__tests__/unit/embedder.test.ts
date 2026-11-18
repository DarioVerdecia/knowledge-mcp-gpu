import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { embedDocuments, embedQuery } from '../../embeddings/embedder.js'

const fetchMock = vi.fn()

function okResponse(embeddings: unknown) {
  return {
    ok: true,
    status: 200,
    json: async () => ({ embeddings }),
    text: async () => '',
  }
}

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('embedDocuments', () => {
  it('envia los textos en modo "document" y devuelve los vectores', async () => {
    fetchMock.mockResolvedValue(okResponse([[0.1, 0.2], [0.3, 0.4]]))

    const result = await embedDocuments(['uno', 'dos'])

    expect(result).toEqual([[0.1, 0.2], [0.3, 0.4]])
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toMatch(/\/embed$/)
    expect(JSON.parse(init.body as string)).toEqual({
      texts: ['uno', 'dos'],
      mode: 'document',
    })
  })

  it('no llama al servidor si la lista esta vacia', async () => {
    const result = await embedDocuments([])

    expect(result).toEqual([])
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('lanza un error si el servidor responde con fallo', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({}),
      text: async () => 'boom',
    })

    await expect(embedDocuments(['x'])).rejects.toThrow(/500.*boom/)
  })

  it('lanza un error si la respuesta no trae "embeddings"', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({}),
      text: async () => '',
    })

    await expect(embedDocuments(['x'])).rejects.toThrow(/invalid embeddings/)
  })
})

describe('embedQuery', () => {
  it('envia la consulta en modo "query" y devuelve un unico vector', async () => {
    fetchMock.mockResolvedValue(okResponse([[0.5, 0.6, 0.7]]))

    const result = await embedQuery('hola')

    expect(result).toEqual([0.5, 0.6, 0.7])
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(JSON.parse(init.body as string)).toEqual({
      texts: ['hola'],
      mode: 'query',
    })
  })

  it('lanza un error si el servidor no devuelve ningun vector', async () => {
    fetchMock.mockResolvedValue(okResponse([]))

    await expect(embedQuery('hola')).rejects.toThrow(/no query embedding/)
  })
})