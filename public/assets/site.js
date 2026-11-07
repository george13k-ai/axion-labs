// Site behaviour: menu, header state, lead forms, copy buttons.
(() => {
  const head = document.querySelector('.site-head')
  const menuBtn = document.getElementById('menu-btn')

  // Mobile menu
  if (head && menuBtn) {
    const setOpen = (open) => {
      menuBtn.setAttribute('aria-expanded', String(open))
      if (open) head.dataset.open = ''
      else delete head.dataset.open
    }
    menuBtn.addEventListener('click', () => setOpen(menuBtn.getAttribute('aria-expanded') !== 'true'))
    head.querySelectorAll('.nav a').forEach((a) => a.addEventListener('click', () => setOpen(false)))
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setOpen(false) })
  }

  // Header hairline after scrolling
  const onScroll = () => { if (!head) return; if (window.scrollY > 8) head.dataset.scrolled = ''; else delete head.dataset.scrolled }
  window.addEventListener('scroll', onScroll, { passive: true })
  onScroll()

  // Copy buttons for contacts (shown only when contacts are configured)
  document.querySelectorAll('.copy').forEach((btn) => {
    btn.addEventListener('click', () => {
      const el = document.getElementById(btn.dataset.copy)
      if (!el) return
      const done = () => {
        btn.textContent = 'скопировано'
        btn.dataset.done = ''
        setTimeout(() => { btn.textContent = 'копировать'; delete btn.dataset.done }, 1600)
      }
      const select = () => { const r = document.createRange(); r.selectNodeContents(el); const s = getSelection(); s.removeAllRanges(); s.addRange(r) }
      try { navigator.clipboard.writeText(el.textContent.trim()).then(done, select) } catch { select() }
    })
  })

  // Lead forms
  const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
  const PHONE = /^\+?[\d\s()\-]{10,20}$/
  const params = new URLSearchParams(location.search)

  const check = (form) => {
    const errors = {}
    const v = (n) => (form.elements[n].value || '').trim()
    if (v('name').length < 2) errors.name = 'Укажите имя.'
    const contact = v('contact')
    const digits = contact.replace(/\D/g, '')
    if (!contact) errors.contact = 'Укажите email или телефон, чтобы мы могли ответить.'
    else if (!EMAIL.test(contact) && !(PHONE.test(contact) && digits.length >= 10 && digits.length <= 15)) errors.contact = 'Проверьте email или телефон: например, name@company.ru или +7 900 000-00-00.'
    if (!v('type')) errors.type = 'Выберите тип проекта.'
    const msg = v('message')
    if (msg.length < 10) errors.message = 'Опишите задачу хотя бы в одном предложении.'
    else if (msg.length > 3000) errors.message = 'Слишком длинное описание: сократите до 3000 символов.'
    if (!form.elements.consent.checked) errors.consent = 'Без согласия на обработку данных мы не сможем принять заявку.'
    return errors
  }

  const showErrors = (form, errors) => {
    for (const name of ['name', 'contact', 'type', 'message', 'consent']) {
      const input = form.elements[name]
      const err = document.getElementById(`${input.id}-err`)
      if (errors[name]) {
        input.setAttribute('aria-invalid', 'true')
        input.setAttribute('aria-describedby', err.id)
        err.textContent = errors[name]
      } else {
        input.removeAttribute('aria-invalid')
        input.removeAttribute('aria-describedby')
        err.textContent = ''
      }
    }
  }

  document.querySelectorAll('.lead-form').forEach((form) => {
    const started = Date.now()
    const status = form.querySelector('.form-status')
    const button = form.querySelector('button[type="submit"]')
    const label = button.querySelector('.btn__label')
    const idle = label.textContent

    const preset = form.dataset.preset || params.get('type') || ''
    if (preset && form.elements.type.querySelector(`option[value="${CSS.escape(preset)}"]`)) form.elements.type.value = preset

    const setStatus = (state, text) => { status.dataset.state = state; status.textContent = text }

    // Clear an error as soon as the field is fixed
    form.addEventListener('input', (e) => {
      const t = e.target
      if (t.getAttribute('aria-invalid') === 'true') {
        const errs = check(form)
        if (!errs[t.name]) { t.removeAttribute('aria-invalid'); const el = document.getElementById(`${t.id}-err`); if (el) el.textContent = '' }
      }
    })

    form.addEventListener('submit', async (e) => {
      e.preventDefault()
      if (form.dataset.state === 'loading' || form.dataset.state === 'done') return
      const errors = check(form)
      showErrors(form, errors)
      const first = Object.keys(errors)[0]
      if (first) { form.elements[first].focus(); setStatus('error', 'Проверьте отмеченные поля.'); return }

      const data = {
        name: form.elements.name.value.trim(),
        contact: form.elements.contact.value.trim(),
        type: form.elements.type.value,
        budget: form.elements.budget.value,
        message: form.elements.message.value.trim(),
        consent: form.elements.consent.checked,
        website: form.elements.website.value,
        elapsed: Date.now() - started,
        page: location.pathname,
      }

      form.dataset.state = 'loading'
      button.disabled = true
      label.textContent = 'Отправляем…'
      setStatus('loading', '')

      try {
        const ctrl = new AbortController()
        const timer = setTimeout(() => ctrl.abort(), 15000)
        const res = await fetch('/api/lead', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
          signal: ctrl.signal,
        })
        clearTimeout(timer)
        let body = null
        try { body = await res.json() } catch { body = null }
        if (res.ok && body && body.ok === true) {
          form.dataset.state = 'done'
          label.textContent = 'Заявка отправлена'
          setStatus('ok', 'Спасибо! Заявка получена. Ответим в ближайшее рабочее время.')
          return
        }
        if (body && body.errors) showErrors(form, body.errors)
        const msg = res.status === 429
          ? 'Слишком много попыток. Подождите несколько минут и отправьте снова.'
          : (body && body.message) || 'Не удалось отправить заявку. Попробуйте ещё раз чуть позже.'
        throw new Error(msg)
      } catch (err) {
        delete form.dataset.state
        button.disabled = false
        label.textContent = idle
        const text = err && err.name === 'AbortError'
          ? 'Сервер не ответил вовремя. Проверьте соединение и попробуйте ещё раз.'
          : (err && err.message && !/fetch|network/i.test(err.message) ? err.message : 'Нет соединения с сервером. Проверьте интернет и попробуйте ещё раз.')
        setStatus('error', text)
      }
    })
  })
})()
