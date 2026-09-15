import { buildApp } from './app.js'

const port = Number(process.env.PORT ?? 3333)
const app = buildApp({ logger: false })

app.listen({ port }, (err, address) => {
  if (err) {
    app.log.error(err)
    process.exit(1)
  }
  app.log.info(`API rodando em ${address}`)
})
