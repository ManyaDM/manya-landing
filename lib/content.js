import fs from 'fs'
import path from 'path'

const CONTENT = path.join(process.cwd(), 'content')

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'))
}

function readCollection(dir) {
  const fullDir = path.join(CONTENT, dir)
  return fs
    .readdirSync(fullDir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => readJson(path.join(fullDir, f)))
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
}

export const getHero = () => readJson(path.join(CONTENT, 'hero.json'))
export const getContact = () => readJson(path.join(CONTENT, 'contact.json'))
export const getServices = () => readCollection('services')
export const getTestimonials = () => readCollection('testimonials')
export const getPainCards = () => readCollection('pain-cards')
export const getResultCards = () => readCollection('results')
export const getTechCards = () => readCollection('tech-cards')
export const getSistemaCards = () => readCollection('sistema-cards')
export const getProcesoSteps = () => readCollection('proceso-steps')

/*
 * Para migrar a TinaCloud:
 * 1. Añade NEXT_PUBLIC_TINA_CLIENT_ID y TINA_TOKEN a .env.local
 * 2. Reemplaza cada función con el client generado. Ejemplo:
 *
 * import { client } from '@/tina/__generated__/client'
 *
 * export async function getHero() {
 *   const res = await client.queries.hero({ relativePath: 'hero.json' })
 *   return res.data.hero
 * }
 *
 * export async function getServices() {
 *   const res = await client.queries.serviceConnection()
 *   return res.data.serviceConnection.edges
 *     .map(e => e.node)
 *     .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
 * }
 */
