import { rm } from 'node:fs/promises'

await rm('lib/types', { recursive: true, force: true })
