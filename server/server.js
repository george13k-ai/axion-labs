// Static site + lead endpoint. Node 18+, no dependencies.
//   node server/server.js
// Settings come from environment variables (see .env.example).
'use strict'

const http = require('node:http')
const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')

loadEnv(path.join(__dirname, '..', '.env'))

const PORT = Number(process.env.PORT || 3000)
const HOST = process.env.HOST || '0.0.0.0'
const SITE_URL = (process.env.SITE_URL || `http://localhost:${PORT}`).replace(/\/+$/, '')
const TG_TOKEN = process.env.TELEGRAM_BOT_TOKEN || ''
const TG_CHAT = process.env.TELEGRAM_CHAT_ID || ''
const TG_API = (process.env.TELEGRAM_API_BASE || 'https://api.telegram.org').replace(/\/+$/, '')
const TRUST_PROXY = process.env.TRUST_PROXY === '1'
const PUBLIC = path.join(__dirname, '..', 'public')

const TYPES = {
  desktop: 'Десктопное приложение', mobile: 'Мобильное приложение', web: 'Веб-приложение или внутренняя система',
  automation: 'Автоматизация бизнеса', ai: 'AI-решение или интеграция', support: 'Доработка и поддержка ПО',
  partner: 'Субподряд для IT-студии', other: 'Другое',
}
const BUDGETS = new Set(['', 'до 50 000 ₽', '50 000 – 150 000 ₽', '150 000 – 500 000 ₽', 'более 500 000 ₽', 'пока не знаю'])

const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml; charset=utf-8', '.json': 'application/json; charset=utf-8',
}

const SECURITY = {
  'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; style-src-attr 'unsafe-inline'; font-src https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'self'; object-src 'none'",
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
}

const PAGES = ['index', 'partners', 'privacy', 'services/desktop', 'services/mobile', 'services/web', 'services/automation', 'services/ai', 'services/support']

// ——— Rate limit, in memory only (IP addresses are never written to disk) ———
const hits = new Map()
const WINDOW = 10 * 60 * 1000
const LIMIT = 5
function limited(ip) {
  const now = Date.now()
  const list = (hits.get(ip) || []).filter((t) => now - t < WINDOW)
  list.push(now)
  hits.set(ip, list)
  return list.length > LIMIT
}
setInterval(() => {
  const now = Date.now()
  for (const [ip, list] of hits) if (!list.some((t) => now - t < WINDOW)) hits.delete(ip)
}, WINDOW).unref()

// ——— Helpers ———
function send(res, status, body, headers = {}) {
  res.writeHead(status, { ...SECURITY, ...headers })
  res.end(body)
}
function json(res, status, data) {
  send(res, status, JSON.stringify(data), { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' })
}
function clientIp(req) {
  if (TRUST_PROXY) {
    const fwd = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim()
    if (fwd) return fwd
  }
  return req.socket.remoteAddress || 'unknown'
}
const clean = (v, max) => String(v ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim().slice(0, max)
const escHtml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

function validate(b) {
  const errors = {}
  const name = clean(b.name, 100)
  const contact = clean(b.contact, 120)
  const type = clean(b.type, 20)
  const budget = clean(b.budget, 40)
  const message = clean(b.message, 3000)
  const digits = contact.replace(/\D/g, '')
  const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(contact)
  const isPhone = /^\+?[\d\s()\-]{10,20}$/.test(contact) && digits.length >= 10 && digits.length <= 15
  if (name.length < 2) errors.name = 'Укажите имя.'
  if (!isEmail && !isPhone) errors.contact = 'Проверьте email или телефон.'
  if (!TYPES[type]) errors.type = 'Выберите тип проекта.'
  if (!BUDGETS.has(budget)) errors.budget = 'Выберите бюджет из списка.'
  if (message.length < 10) errors.message = 'Опишите задачу хотя бы в одном предложении.'
  if (b.consent !== true) errors.consent = 'Нужно согласие на обработку персональных данных.'
  return { errors, lead: { name, contact, type, budget, message, page: clean(b.page, 80) } }
}

async function deliver(lead, id) {
  const text = [
    `<b>Новая заявка</b> #${id}`,
    `<b>Имя:</b> ${escHtml(lead.name)}`,
    `<b>Контакт:</b> ${escHtml(lead.contact)}`,
    `<b>Тип:</b> ${escHtml(TYPES[lead.type])}`,
    lead.budget ? `<b>Бюджет:</b> ${escHtml(lead.budget)}` : null,
    `<b>Страница:</b> ${escHtml(lead.page || '/')}`,
    '',
    escHtml(lead.message),
  ].filter((l) => l !== null).join('\n')
  const res = await fetch(`${TG_API}/bot${TG_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: TG_CHAT, text, parse_mode: 'HTML', disable_web_page_preview: true }),
    signal: AbortSignal.timeout(10000),
  })
  const body = await res.json().catch(() => null)
  if (!res.ok || !body || body.ok !== true) throw new Error(`telegram ${res.status}`)
}

function readBody(req, max) {
  return new Promise((resolve, reject) => {
    let size = 0
    const chunks = []
    req.on('data', (c) => {
      size += c.length
      if (size > max) { reject(Object.assign(new Error('too large'), { code: 413 })); req.destroy(); return }
      chunks.push(c)
    })
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

async function handleLead(req, res) {
  if (!String(req.headers['content-type'] || '').startsWith('application/json')) return json(res, 415, { ok: false, message: 'Неверный формат запроса.' })
  const origin = req.headers.origin
  if (origin && process.env.SITE_URL && origin !== new URL(SITE_URL).origin) return json(res, 403, { ok: false, message: 'Запрос отклонён.' })
  if (limited(clientIp(req))) return json(res, 429, { ok: false, message: 'Слишком много попыток. Подождите несколько минут.' })

  let b
  try { b = JSON.parse(await readBody(req, 16 * 1024)) } catch (e) {
    return json(res, e.code === 413 ? 413 : 400, { ok: false, message: 'Не удалось прочитать заявку.' })
  }
  if (!b || typeof b !== 'object') return json(res, 400, { ok: false, message: 'Не удалось прочитать заявку.' })

  // Spam traps: a filled hidden field or a form sent faster than a person could.
  // Bots get a quiet success so they don't adapt; nothing is delivered.
  if (clean(b.website, 200) !== '' || Number(b.elapsed) < 3000) return json(res, 200, { ok: true })

  const { errors, lead } = validate(b)
  if (Object.keys(errors).length) return json(res, 422, { ok: false, errors, message: 'Проверьте отмеченные поля.' })

  if (!TG_TOKEN || !TG_CHAT) {
    console.error('lead rejected: TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID is not set')
    return json(res, 503, { ok: false, message: 'Приём заявок временно не настроен. Попробуйте позже.' })
  }
  const id = crypto.randomBytes(3).toString('hex')
  try {
    await deliver(lead, id)
    console.log(`lead ${id} delivered`)
    return json(res, 200, { ok: true, id })
  } catch (e) {
    console.error(`lead ${id} failed: ${e.message}`)
    return json(res, 502, { ok: false, message: 'Не удалось отправить заявку. Попробуйте ещё раз чуть позже.' })
  }
}

function serveStatic(req, res, url) {
  let p = decodeURIComponent(url.pathname)
  if (p.endsWith('/')) p += 'index'
  if (p === '/index') p = '/index'
  let file = path.normalize(path.join(PUBLIC, p))
  if (!file.startsWith(PUBLIC)) return send(res, 400, 'Bad request')
  if (!path.extname(file)) file += '.html'
  if (file.endsWith(`${path.sep}404.html`)) return notFound(res)
  fs.readFile(file, (err, data) => {
    if (err) return notFound(res)
    const ext = path.extname(file)
    const type = MIME[ext] || 'application/octet-stream'
    if (ext === '.html') {
      data = Buffer.from(data.toString('utf8').replaceAll('%SITE_URL%', SITE_URL))
      return send(res, 200, req.method === 'HEAD' ? '' : data, { 'Content-Type': type, 'Cache-Control': 'no-cache' })
    }
    send(res, 200, req.method === 'HEAD' ? '' : data, { 'Content-Type': type, 'Cache-Control': 'public, max-age=604800' })
  })
}

function notFound(res) {
  fs.readFile(path.join(PUBLIC, '404.html'), 'utf8', (err, html) => {
    send(res, 404, err ? 'Not found' : html.replaceAll('%SITE_URL%', SITE_URL), { 'Content-Type': 'text/html; charset=utf-8' })
  })
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://local')
    if (url.pathname === '/api/lead') {
      if (req.method !== 'POST') return json(res, 405, { ok: false, message: 'Метод не поддерживается.' })
      return await handleLead(req, res)
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Method not allowed')
    if (url.pathname === '/robots.txt') return send(res, 200, `User-agent: *\nAllow: /\nDisallow: /api/\nSitemap: ${SITE_URL}/sitemap.xml\n`, { 'Content-Type': MIME['.txt'] })
    if (url.pathname === '/sitemap.xml') {
      const urls = PAGES.map((p) => `  <url><loc>${SITE_URL}${p === 'index' ? '/' : `/${p}`}</loc></url>`).join('\n')
      return send(res, 200, `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`, { 'Content-Type': MIME['.xml'] })
    }
    if (url.pathname.endsWith('.html')) {
      const clean = url.pathname.replace(/\.html$/, '').replace(/\/index$/, '/')
      return send(res, 301, '', { Location: clean || '/' })
    }
    serveStatic(req, res, url)
  } catch (e) {
    console.error('request failed:', e.message)
    if (!res.headersSent) send(res, 500, 'Server error')
  }
})

server.listen(PORT, HOST, () => {
  console.log(`site on http://localhost:${PORT} (SITE_URL=${SITE_URL})`)
  if (!TG_TOKEN || !TG_CHAT) console.warn('warning: TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID not set — the form will answer with an error')
})

function loadEnv(file) {
  let text
  try { text = fs.readFileSync(file, 'utf8') } catch { return }
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2')
  }
}
