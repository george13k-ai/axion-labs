// Builds the pages.
//   npm run build        → ../public, for the Node server (form on, %SITE_URL% filled in by the server)
//   npm run build:pages  → ../dist, a fully static copy for GitHub Pages (form off, links under PAGES_BASE)
import { mkdirSync, writeFileSync, readFileSync, cpSync, rmSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { BRAND, CONTACTS, PRICE_NOTE, SERVICES, PACKAGES, STEPS, FAQ, PROJECT_TYPES, BUDGETS, DEMOS, PAGES_SITE_URL, PAGES_BASE } from './content.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'public')
const STATIC = process.argv.includes('--pages')
const outRoot = STATIC ? join(root, '..', 'dist') : root
// On GitHub Pages there is no server, so the form is replaced by contacts
const FORM = !STATIC

// Cache-busting versions for the stylesheet and script
const ver = (f) => createHash('sha1').update(readFileSync(join(root, 'assets', f))).digest('hex').slice(0, 8)
const CSS_V = ver('site.css')
const JS_V = ver('site.js')

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const arrow = '<svg class="arr" width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><path d="M4 9h10M10 5l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>'

const NAV = [
  ['/#services', 'Услуги'],
  ['/#prices', 'Цены'],
  ['/partners', 'Партнёрам'],
  ['/#process', 'Как работаем'],
  ['/#faq', 'Вопросы'],
]

function layout({ path, title, description, body, active = '' }) {
  const url = `%SITE_URL%${path}`
  const fullTitle = path === '/' ? `${title} — ${BRAND}` : `${title} — ${BRAND}`
  return `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(fullTitle)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${url}">
<meta property="og:type" content="website">
<meta property="og:locale" content="ru_RU">
<meta property="og:site_name" content="${esc(BRAND)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="%SITE_URL%/assets/og.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#f1f0ee" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#121110" media="(prefers-color-scheme: dark)">
<link rel="icon" href="/assets/favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Unbounded:wght@300;400;500&family=Onest:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap">
<link rel="stylesheet" href="/assets/site.css?v=${CSS_V}">
<script src="/assets/site.js?v=${JS_V}" defer></script>
</head>
<body>
<a class="skip" href="#main">Перейти к содержанию</a>
<div class="progress" aria-hidden="true"></div>
${header(active)}
<main id="main">
${body}
</main>
${footer()}
</body>
</html>
`
}

function header(active) {
  return `<header class="site-head">
  <div class="sheet site-head__in">
    <a class="brand" href="/">${esc(BRAND)}</a>
    <nav class="nav" id="site-nav" aria-label="Основное меню">
      ${NAV.map(([href, label]) => `<a href="${href}"${active === href ? ' aria-current="page"' : ''}>${label}</a>`).join('\n      ')}
      <a class="btn btn--primary btn--sm nav__cta" href="/#contact">Обсудить проект</a>
    </nav>
    <button class="menu-btn" type="button" aria-expanded="false" aria-controls="site-nav" id="menu-btn"><span class="menu-btn__bars" aria-hidden="true"></span><span class="sr">Меню</span></button>
  </div>
</header>`
}

function footer() {
  return `<footer class="site-foot">
  <div class="sheet">
    <div class="site-foot__grid">
      <div class="site-foot__brand">
        <span class="brand">${esc(BRAND)}</span>
        <p>Заказная разработка программного обеспечения для бизнеса и технический субподряд для IT-студий.</p>
      </div>
      <nav class="site-foot__nav" aria-label="Услуги">
        <span class="label mono">услуги</span>
        ${SERVICES.map((s) => `<a href="/services/${s.slug}">${esc(s.title)}</a>`).join('\n        ')}
      </nav>
      <nav class="site-foot__nav" aria-label="Разделы">
        <span class="label mono">разделы</span>
        <a href="/#prices">Форматы сотрудничества</a>
        <a href="/partners">Партнёрам</a>
        <a href="/#process">Как работаем</a>
        <a href="/#demos">Демонстрационные решения</a>
        <a href="/#faq">Вопросы</a>
        <a href="/#contact">Контакты</a>
      </nav>
    </div>
    <div class="site-foot__bottom mono">
      <span>© 2026 ${esc(BRAND)}</span>
      ${FORM ? '<a href="/privacy">Политика обработки персональных данных</a>' : ''}
    </div>
  </div>
</footer>`
}

function contacts() {
  if (!CONTACTS.length) return ''
  return `<div class="ways">${CONTACTS.map((c, i) => `
        <div class="way">
          <span class="label mono">${esc(c.label)}</span>
          <div class="row"><a class="val" id="contact-${i}" href="${esc(c.href)}">${esc(c.value)}</a><button class="copy" type="button" data-copy="contact-${i}" id="copy-${i}">копировать</button></div>
        </div>`).join('')}
      </div>`
}

function form({ id, preset = '', heading, sub, button = 'Отправить заявку' }) {
  if (!FORM) {
    return `<section class="contact grid" id="${id}" aria-labelledby="${id}-title">
    <div class="contact__intro">
      <h2 class="say" id="${id}-title">${heading}</h2>
      ${CONTACTS.length ? `<p class="contact__sub">Напишите нам — ответим, уточним детали и предложим следующий шаг.</p>${contacts()}` : '<p class="contact__sub">Контакты для связи скоро появятся на этой странице.</p>'}
    </div>
  </section>`
  }
  return `<section class="contact grid" id="${id}" aria-labelledby="${id}-title">
    <div class="contact__intro">
      <h2 class="say" id="${id}-title">${heading}</h2>
      <p class="contact__sub">${sub}</p>
      ${contacts()}
    </div>
    <form class="lead-form" novalidate data-preset="${preset}" id="${id}-form">
      <div class="field">
        <label for="${id}-name">Имя</label>
        <input id="${id}-name" name="name" type="text" autocomplete="name" maxlength="100" required>
        <span class="field__err" id="${id}-name-err"></span>
      </div>
      <div class="field">
        <label for="${id}-contact">Рабочий email или телефон</label>
        <input id="${id}-contact" name="contact" type="text" autocomplete="email" inputmode="email" maxlength="120" required>
        <span class="field__err" id="${id}-contact-err"></span>
      </div>
      <div class="field">
        <label for="${id}-type">Тип проекта</label>
        <select id="${id}-type" name="type" required>
          <option value="">Выберите</option>
          ${PROJECT_TYPES.map(([v, l]) => `<option value="${v}">${esc(l)}</option>`).join('\n          ')}
        </select>
        <span class="field__err" id="${id}-type-err"></span>
      </div>
      <div class="field">
        <label for="${id}-budget">Бюджет <span class="opt">необязательно</span></label>
        <select id="${id}-budget" name="budget">
          <option value="">Не указывать</option>
          ${BUDGETS.map((b) => `<option value="${esc(b)}">${esc(b)}</option>`).join('\n          ')}
        </select>
      </div>
      <div class="field field--wide">
        <label for="${id}-message">Краткое описание задачи</label>
        <textarea id="${id}-message" name="message" rows="5" minlength="10" maxlength="3000" required></textarea>
        <span class="field__err" id="${id}-message-err"></span>
      </div>
      <div class="hp" aria-hidden="true">
        <label for="${id}-website">Сайт компании</label>
        <input id="${id}-website" name="website" type="text" tabindex="-1" autocomplete="off">
      </div>
      <div class="field field--wide field--check">
        <input id="${id}-consent" name="consent" type="checkbox" required>
        <label for="${id}-consent">Я согласен на обработку персональных данных в соответствии с <a href="/privacy" target="_blank" rel="noopener">политикой обработки персональных данных</a>.</label>
        <span class="field__err" id="${id}-consent-err"></span>
      </div>
      <div class="form-foot field--wide">
        <button class="btn btn--primary btn--lg" type="submit"><span class="btn__label">${button}</span><span class="spin" aria-hidden="true"></span></button>
        <p class="form-status" role="status" aria-live="polite"></p>
      </div>
    </form>
  </section>`
}

function heroVisual() {
  // An illustrative interface: no product data, only structure. Statuses cycle.
  return `<div class="hv" aria-hidden="true">
      <div class="hv-win">
        <div class="hv-bar"><i></i><i></i><i></i><span class="hv-title">Заявки</span></div>
        <div class="hv-body">
          <div class="hv-side">${[56, 44, 62, 38].map((w, i) => `<span class="hv-nav${i === 0 ? ' on' : ''}"><b></b><em style="width:${w}%"></em></span>`).join('')}</div>
          <div class="hv-main">
            <div class="hv-head"><span class="hv-h">Сегодня</span><span class="hv-chip">Все этапы</span></div>
            ${[['Новая', 'n', 70], ['В работе', 'w', 54], ['Согласование', 'a', 64], ['Готово', 'd', 48], ['В работе', 'w', 58]].map(([s, k, w], i) => `<div class="hv-row" style="--i:${i}"><span class="hv-av"></span><span class="hv-lines"><em style="width:${w}%"></em><em style="width:${w - 22}%"></em></span><span class="hv-st" data-k="${k}">${s}</span></div>`).join('\n            ')}
          </div>
        </div>
      </div>
      <div class="hv-phone">
        <span class="hv-island"></span>
        <span class="hv-ph-t">Запись</span>
        <div class="hv-days">${['Пн', 'Вт', 'Ср', 'Чт', 'Пт'].map((d, i) => `<span class="${i === 2 ? 'on' : ''}">${d}</span>`).join('')}</div>
        ${['10:00', '11:30', '14:00', '16:30'].map((t, i) => `<span class="hv-slot${i === 2 ? ' on' : ''}">${t}</span>`).join('')}
        <span class="hv-ph-btn">Записаться</span>
      </div>
    </div>`
}

const DIRECTIONS = ['Десктопные приложения', 'Мобильные приложения', 'Веб-системы', 'Автоматизация', 'AI-интеграции', 'Доработка ПО', 'Субподряд для IT-студий']
const ticker = () => `<div class="ticker mono" aria-hidden="true">
  <div class="ticker__track">
    ${[0, 1].map(() => `<div class="ticker__set">${DIRECTIONS.map((d) => `<span>${d}</span>`).join('')}</div>`).join('\n    ')}
  </div>
</div>`

function servicesGrid(exclude) {
  return SERVICES.filter((s) => s.slug !== exclude).map((s, i) => `
      <a class="svc" href="/services/${s.slug}" style="--d:${i}">
        <span class="label mono">${s.label}</span>
        <span class="svc__title">${esc(s.title)}</span>
        <span class="svc__text">${esc(s.short)}</span>
        <span class="svc__meta mono"><span>${s.price}</span><span>${s.time}</span></span>
        ${arrow}
      </a>`).join('')
}

// ——— Pages ———

function home() {
  const body = `
<div class="sheet">
  <section class="hero grid" aria-labelledby="hero-title">
    <h1 id="hero-title"><span class="w">Разрабатываем</span> <span class="w">программное обеспечение</span> <span class="w">под задачи <em>вашего бизнеса</em></span></h1>
    <div class="hero__side">
      <p class="lead">Десктопные и мобильные приложения, корпоративные веб-системы, автоматизация и AI-интеграции. От идеи и прототипа до рабочего программного продукта.</p>
      <div class="cta-row">
        <a class="btn btn--primary btn--lg" href="#contact">Обсудить проект</a>
        <a class="btn btn--ghost btn--lg" href="#services">Услуги и цены</a>
      </div>
    </div>
    ${heroVisual()}
  </section>
</div>

${ticker()}

<div class="sheet">
  <section class="services" id="services" aria-labelledby="services-title">
    <div class="sec-head">
      <span class="label mono">услуги</span>
      <h2 class="sec-title" id="services-title">Что разрабатываем</h2>
    </div>
    <div class="svc-grid">${servicesGrid()}
    </div>
  </section>

  <section class="prices" id="prices" aria-labelledby="prices-title">
    <div class="sec-head">
      <span class="label mono">цены</span>
      <h2 class="sec-title" id="prices-title">Форматы сотрудничества</h2>
    </div>
    <div class="pkg-grid">
      ${PACKAGES.map((p) => `<div class="pkg${p.lead ? ' pkg--lead' : ''}">
        <span class="pkg__name">${esc(p.name)}</span>
        <span class="pkg__price">${p.price}</span>
        <p>${esc(p.text)}</p>
        <span class="pkg__time mono">срок индивидуально</span>
        <a class="btn ${p.lead ? 'btn--primary' : 'btn--ghost'}" href="#contact">Обсудить</a>
      </div>`).join('\n      ')}
    </div>
    <p class="price-note">${PRICE_NOTE}</p>
  </section>

  <section class="process" id="process" aria-labelledby="process-title">
    <div class="sec-head">
      <span class="label mono">процесс</span>
      <h2 class="sec-title" id="process-title">Как мы работаем</h2>
    </div>
    <ol class="steps">
      ${STEPS.map(([t, d], i) => `<li class="step" style="--i:${i}"><span class="v">${i + 1}</span><h3>${t}</h3><p>${d}</p></li>`).join('\n      ')}
    </ol>
  </section>

  <section class="partners-teaser grid" aria-labelledby="pt-title">
    <span class="label mono">партнёрам</span>
    <h2 class="sec-title" id="pt-title">Технический субподряд для IT-студий и digital-агентств</h2>
    <p>Подключаемся к отдельным задачам: интерфейсы, API, внутренние инструменты, интеграции, MVP и автоматизация. Работаем по согласованному техническому заданию.</p>
    <a class="btn btn--ghost btn--lg" href="/partners">Условия для партнёров ${arrow}</a>
  </section>

  <section class="demos" id="demos" aria-labelledby="demos-title">
    <div class="sec-head">
      <span class="label mono">демо</span>
      <h2 class="sec-title" id="demos-title">Демонстрационные решения</h2>
    </div>
    <p class="demos__note">Концепты интерфейсов мобильных приложений: показывают, как мы подходим к дизайну и структуре экранов. Это не клиентские проекты, названия продуктов вымышлены.</p>
    <div class="works">
      ${DEMOS.map((d, i) => `<article class="work grid w${i + 1}">
        <figure><img src="/img/${d.img}.webp" width="1800" height="1108" loading="lazy" decoding="async" alt="${esc(d.alt)}"></figure>
        <div class="cap">
          <span class="label mono">${d.label}</span>
          <span class="name">${esc(d.name)}</span>
          <p>${esc(d.text)}</p>
          <span class="kind mono">концепт интерфейса</span>
        </div>
      </article>`).join('\n      ')}
    </div>
  </section>

  <section class="faq" id="faq" aria-labelledby="faq-title">
    <div class="sec-head">
      <span class="label mono">вопросы</span>
      <h2 class="sec-title" id="faq-title">Частые вопросы</h2>
    </div>
    <div class="faq__list">
      ${FAQ.map(([q, a], i) => `<details class="qa" id="faq-${i + 1}"><summary>${esc(q)}<span class="qa__icon" aria-hidden="true"></span></summary><div class="qa__a"><p>${esc(a).replace('Подробности на странице «Партнёрам».', 'Подробности на странице <a href="/partners">«Партнёрам»</a>.')}</p></div></details>`).join('\n      ')}
    </div>
  </section>

  ${form({ id: 'contact', heading: '<span class="w">Расскажите</span> <span class="w">о&nbsp;проекте</span>', sub: 'Опишите задачу в двух-трёх предложениях. Ответим, уточним детали и предложим следующий шаг.' })}
</div>`
  return layout({
    path: '/',
    title: 'Разработка программного обеспечения для бизнеса',
    description: 'Заказная разработка ПО: десктопные и мобильные приложения, корпоративные веб-системы, автоматизация и AI-интеграции. Технический субподряд для IT-студий.',
    body,
  })
}

function servicePage(s) {
  const body = `
<div class="sheet">
  <nav class="crumbs mono" aria-label="Навигация по разделу"><a href="/">Главная</a><span aria-hidden="true">/</span><a href="/#services">Услуги</a><span aria-hidden="true">/</span><span aria-current="page">${esc(s.title)}</span></nav>
  <section class="svc-hero grid" aria-labelledby="svc-title">
    <h1 id="svc-title"><span class="w">${esc(s.title)}</span></h1>
    <p class="lead">${esc(s.short)}</p>
    <dl class="svc-facts">
      <div><dt class="mono">ориентир стоимости</dt><dd>${s.price}${s.priceSuffix ? ` <span>${s.priceSuffix}</span>` : ''}</dd></div>
      <div><dt class="mono">ориентир срока</dt><dd>${s.time}</dd></div>
    </dl>
    <div class="cta-row">
      <a class="btn btn--primary btn--lg" href="/?type=${s.slug}#contact">Обсудить проект</a>
      <a class="btn btn--ghost btn--lg" href="/#prices">Форматы сотрудничества</a>
    </div>
  </section>

  <section class="examples grid" aria-labelledby="ex-title">
    <span class="label mono">примеры задач</span>
    <h2 class="sec-title" id="ex-title">Что можно сделать</h2>
    <ul class="ex-list">
      ${s.examples.map((e) => `<li>${esc(e)}</li>`).join('\n      ')}
    </ul>
  </section>

  <section class="svc-start grid" aria-labelledby="start-title">
    <span class="label mono">с чего начать</span>
    <h2 class="sec-title" id="start-title">Как начинается работа</h2>
    <ol class="mini-steps">
      ${STEPS.slice(0, 3).map(([t, d], i) => `<li><span class="v">${i + 1}</span><h3>${t}</h3><p>${d}</p></li>`).join('\n      ')}
    </ol>
  </section>

  <section class="svc-note" aria-label="Условия">
    ${s.extra ? `<p class="svc-note__extra">${esc(s.extra)}</p>` : ''}
    <p class="price-note">${PRICE_NOTE}</p>
  </section>

  <section class="other" aria-labelledby="other-title">
    <div class="sec-head">
      <span class="label mono">другие услуги</span>
      <h2 class="sec-title" id="other-title">Ещё направления</h2>
    </div>
    <div class="svc-grid svc-grid--compact">${servicesGrid(s.slug)}
    </div>
  </section>
</div>`
  return layout({ path: `/services/${s.slug}`, title: s.title, description: s.seo, body })
}

function partners() {
  const perks = [
    'Возможность выполнения отдельных технических модулей.',
    'Поэтапная сдача работ.',
    'Согласование сроков и стоимости до начала разработки.',
    'Передача исходного кода по условиям договора.',
    'Возможность работы под брендом партнёра по отдельной договорённости.',
  ]
  const body = `
<div class="sheet">
  <nav class="crumbs mono" aria-label="Навигация по разделу"><a href="/">Главная</a><span aria-hidden="true">/</span><span aria-current="page">Партнёрам</span></nav>
  <section class="svc-hero grid" aria-labelledby="p-title">
    <h1 id="p-title"><span class="w">Технический субподряд</span> <span class="w">для IT-студий и <em>digital-агентств</em></span></h1>
    <p class="lead">Подключаемся к отдельным задачам разработки: интерфейсы, API, внутренние инструменты, интеграции, MVP и автоматизация. Работаем по согласованному техническому заданию, с понятными этапами и передачей результатов.</p>
    <div class="cta-row">
      <a class="btn btn--primary btn--lg" href="#partner">Предложить сотрудничество</a>
    </div>
  </section>

  <section class="perks grid" aria-labelledby="perks-title">
    <span class="label mono">условия</span>
    <h2 class="sec-title" id="perks-title">Как строим работу с партнёрами</h2>
    <ul class="perk-list">
      ${perks.map((p) => `<li>${p}</li>`).join('\n      ')}
    </ul>
  </section>

  <section class="process" aria-labelledby="pp-title">
    <div class="sec-head">
      <span class="label mono">процесс</span>
      <h2 class="sec-title" id="pp-title">Этапы работы</h2>
    </div>
    <ol class="steps">
      ${STEPS.map(([t, d], i) => `<li class="step" style="--i:${i}"><span class="v">${i + 1}</span><h3>${t}</h3><p>${d}</p></li>`).join('\n      ')}
    </ol>
    <p class="price-note">${PRICE_NOTE}</p>
  </section>

  ${form({ id: 'partner', preset: 'partner', heading: '<span class="w">Предложите</span> <span class="w">сотрудничество</span>', sub: 'Расскажите о студии и задаче: какой модуль нужен, есть ли ТЗ и желаемые сроки.', button: 'Предложить сотрудничество' })}
</div>`
  return layout({
    path: '/partners',
    title: 'Технический субподряд для IT-студий',
    description: 'Технический субподряд для IT-студий и digital-агентств: интерфейсы, API, внутренние инструменты, интеграции, MVP и автоматизация по согласованному ТЗ.',
    body,
    active: '/partners',
  })
}

function privacy() {
  const body = `
<div class="sheet">
  <nav class="crumbs mono" aria-label="Навигация по разделу"><a href="/">Главная</a><span aria-hidden="true">/</span><span aria-current="page">Политика обработки персональных данных</span></nav>
  <article class="doc">
    <h1>Политика обработки персональных данных</h1>
    <p class="doc__draft">Черновик. Перед публикацией сайта заполните поля в квадратных скобках и согласуйте текст с юристом.</p>

    <h2>1. Оператор</h2>
    <p>Оператор персональных данных: [полное наименование или ФИО индивидуального предпринимателя или самозанятого], [ИНН], [ОГРН/ОГРНИП, если есть], адрес: [адрес]. Контакт для обращений по вопросам персональных данных: [email].</p>

    <h2>2. Какие данные мы получаем</h2>
    <p>Через форму заявки на сайте: имя, рабочий email или номер телефона, тип проекта, описание задачи и, если вы его указали, ориентир бюджета. Технические данные: IP-адрес, который используется только для защиты формы от спама и не сохраняется.</p>

    <h2>3. Цели обработки</h2>
    <p>Связаться с вами по заявке, уточнить требования, подготовить оценку проекта и заключить договор.</p>

    <h2>4. Основание</h2>
    <p>Ваше согласие, которое вы даёте, отмечая соответствующий пункт в форме перед отправкой заявки.</p>

    <h2>5. Как данные обрабатываются и передаются</h2>
    <p>Заявка передаётся сотрудникам [через какой канал: например, Telegram-бот или корпоративную почту]. [Если сервис хранит данные за пределами России, укажите это и условия трансграничной передачи.] Данные не продаются и не передаются третьим лицам для рекламы.</p>

    <h2>6. Срок хранения</h2>
    <p>[Срок хранения, например: до окончания переговоров или в течение срока действия договора и установленного законом срока после него.] После этого данные удаляются.</p>

    <h2>7. Ваши права</h2>
    <p>Вы можете запросить сведения о ваших данных, их уточнение или удаление, а также отозвать согласие, написав на [email]. Мы ответим в сроки, установленные Федеральным законом № 152-ФЗ «О персональных данных».</p>

    <p class="doc__date mono">Редакция от [дата]</p>
  </article>
</div>`
  return layout({ path: '/privacy', title: 'Политика обработки персональных данных', description: 'Как мы обрабатываем персональные данные, отправленные через форму заявки на сайте.', body })
}

function notFound() {
  const body = `
<div class="sheet">
  <section class="nf">
    <span class="nf__code">404</span>
    <h1>Страница не найдена</h1>
    <p>Возможно, ссылка устарела. Начните с главной или посмотрите услуги.</p>
    <div class="cta-row"><a class="btn btn--primary btn--lg" href="/">На главную</a><a class="btn btn--ghost btn--lg" href="/#services">Услуги</a></div>
  </section>
</div>`
  return layout({ path: '/404', title: 'Страница не найдена', description: 'Страница не найдена.', body }).replace('<link rel="canonical"', '<meta name="robots" content="noindex">\n<link rel="canonical"')
}

// Static build: absolute links get the Pages base path, %SITE_URL% is filled in
const finish = (html) => !STATIC ? html : html
  .replaceAll('%SITE_URL%', PAGES_SITE_URL)
  .replace(/(href|src)="\/(?!\/)/g, `$1="${PAGES_BASE}/`)

function out(file, html) {
  const p = join(outRoot, file)
  mkdirSync(dirname(p), { recursive: true })
  writeFileSync(p, finish(html))
  console.log('built', STATIC ? `dist/${file}` : file)
}

if (STATIC) {
  rmSync(outRoot, { recursive: true, force: true })
  cpSync(join(root, 'assets'), join(outRoot, 'assets'), { recursive: true })
  cpSync(join(root, 'img'), join(outRoot, 'img'), { recursive: true })
}

const PAGE_PATHS = ['/', ...SERVICES.map((s) => `/services/${s.slug}`), '/partners', ...(FORM ? ['/privacy'] : [])]
out('index.html', home())
for (const s of SERVICES) out(`services/${s.slug}.html`, servicePage(s))
out('partners.html', partners())
if (FORM) out('privacy.html', privacy())
out('404.html', notFound())

if (STATIC) {
  writeFileSync(join(outRoot, '.nojekyll'), '')
  writeFileSync(join(outRoot, 'robots.txt'), `User-agent: *
Allow: /
Sitemap: ${PAGES_SITE_URL}/sitemap.xml
`)
  writeFileSync(join(outRoot, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${PAGE_PATHS.map((p) => `  <url><loc>${PAGES_SITE_URL}${p}</loc></url>`).join('\n')}
</urlset>
`)
  console.log('built dist/robots.txt, dist/sitemap.xml')
}
