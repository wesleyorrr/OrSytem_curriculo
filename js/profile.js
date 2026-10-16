/* OR System — Etapa 2: cadastro profissional completo */
window.ORProfile = (function () {
  'use strict';

  const U = window.ORUtil;

  let form, draft, currentStep = 1;
  const TOTAL_STEPS = 7;

  /* ---------- Definição dos campos dinâmicos por lista ---------- */
  const SCHEMAS = {
    experiences: {
      label: 'Experiência',
      title: r => r.role || r.company || 'Nova experiência',
      fields: [
        { f: 'company', label: 'Empresa', type: 'text', ph: 'Ex.: Acme Ltda.' },
        { f: 'role', label: 'Cargo', type: 'text', ph: 'Ex.: Analista de Dados' },
        { f: 'start', label: 'Início', type: 'month' },
        { f: 'end', label: 'Término', type: 'month', hideWhen: 'current' },
        { f: 'current', label: 'Trabalho atualmente nesta empresa', type: 'checkbox' },
        { f: 'activities', label: 'Atividades realizadas', type: 'textarea',
          ph: 'Descreva o que você fazia no dia a dia.' },
        { f: 'results', label: 'Resultados alcançados (opcional, apenas se você tiver os dados)',
          type: 'textarea', ph: 'Ex.: reduzi o tempo de fechamento mensal em 30%.' }
      ]
    },
    education: {
      label: 'Formação',
      title: r => r.course || r.institution || 'Nova formação',
      fields: [
        { f: 'course', label: 'Curso', type: 'text', ph: 'Ex.: Administração' },
        { f: 'institution', label: 'Instituição', type: 'text', ph: 'Ex.: USP' },
        { f: 'level', label: 'Nível', type: 'select',
          options: ['Fundamental','Médio','Técnico','Tecnólogo','Graduação','Pós-graduação','MBA','Mestrado','Doutorado'] },
        { f: 'start', label: 'Início', type: 'month' },
        { f: 'end', label: 'Conclusão', type: 'month' },
        { f: 'status', label: 'Situação', type: 'select',
          options: ['Concluído','Cursando','Trancado','Incompleto'] }
      ]
    },
    courses: {
      label: 'Curso',
      title: r => r.name || 'Novo curso',
      fields: [
        { f: 'name', label: 'Nome do curso', type: 'text', ph: 'Ex.: Excel Avançado' },
        { f: 'institution', label: 'Instituição', type: 'text', ph: 'Ex.: Fundação Bradesco' },
        { f: 'year', label: 'Ano', type: 'number', ph: '2025' },
        { f: 'certification', label: 'Certificação / código (opcional)', type: 'text' }
      ]
    },
    languages: {
      label: 'Idioma',
      title: r => r.name || 'Novo idioma',
      fields: [
        { f: 'name', label: 'Idioma', type: 'text', ph: 'Ex.: Inglês' },
        { f: 'level', label: 'Nível', type: 'select',
          options: ['Básico','Intermediário','Avançado','Fluente','Nativo'] }
      ]
    },
    projects: {
      label: 'Projeto',
      title: r => r.name || 'Novo projeto',
      fields: [
        { f: 'name', label: 'Nome do projeto', type: 'text' },
        { f: 'description', label: 'Descrição', type: 'textarea', ph: 'O que é, seu papel e o que foi entregue.' },
        { f: 'link', label: 'Link (opcional)', type: 'url', ph: 'https://...' }
      ]
    }
  };

  /* ================= Render ================= */

  function renderStaticFields() {
    form.querySelectorAll('[data-path]').forEach(el => {
      const path = el.dataset.path;
      if (path === 'skills.technical' || path === 'skills.tools' || path === 'skills.soft') {
        el.value = U.joinList(U.getPath(draft, path));
      } else {
        const v = U.getPath(draft, path);
        el.value = v == null ? '' : v;
      }
    });
    updateSummaryCounter();
  }

  function renderList(name) {
    const container = form.querySelector(`[data-list="${name}"]`);
    if (!container) return;
    const schema = SCHEMAS[name];
    const items = draft.skills && name === 'languages' ? draft.skills.languages : draft[name];

    container.innerHTML = '';

    if (!items.length) {
      const p = document.createElement('p');
      p.className = 'empty-msg';
      p.textContent = `Nenhum item adicionado ainda.`;
      container.appendChild(p);
      return;
    }

    items.forEach(item => {
      container.appendChild(buildItemCard(name, item, schema));
    });
  }

  function buildItemCard(name, item, schema) {
    const card = document.createElement('div');
    card.className = 'item-card';
    card.dataset.id = item.id;
    card.dataset.list = name;

    const head = document.createElement('div');
    head.className = 'item-head';
    head.innerHTML =
      `<strong>${U.esc(schema.title(item))}</strong>` +
      `<button type="button" class="btn-icon" data-del="${item.id}" title="Excluir item" aria-label="Excluir">✕</button>`;
    card.appendChild(head);

    const grid = document.createElement('div');
    grid.className = 'grid-2';

    schema.fields.forEach(fd => {
      if (fd.hideWhen && item[fd.hideWhen]) return;

      const wrap = document.createElement('label');
      wrap.className = 'field';
      if (fd.type === 'textarea') wrap.style.gridColumn = '1 / -1';

      if (fd.type === 'checkbox') {
        wrap.classList.add('check-inline');
        wrap.innerHTML =
          `<input type="checkbox" data-f="${fd.f}" ${item[fd.f] ? 'checked' : ''} /> ${U.esc(fd.label)}`;
        grid.appendChild(wrap);
        return;
      }

      const labelText = U.esc(fd.label);
      wrap.innerHTML = `<span>${labelText}</span>`;

      let input;
      if (fd.type === 'select') {
        input = document.createElement('select');
        const opt0 = document.createElement('option');
        opt0.value = '';
        opt0.textContent = 'Selecione…';
        input.appendChild(opt0);
        (fd.options || []).forEach(o => {
          const op = document.createElement('option');
          op.value = o; op.textContent = o;
          if (item[fd.f] === o) op.selected = true;
          input.appendChild(op);
        });
      } else if (fd.type === 'textarea') {
        input = document.createElement('textarea');
        input.rows = 3;
        input.value = item[fd.f] || '';
      } else {
        input = document.createElement('input');
        input.type = fd.type;
        if (fd.ph) input.placeholder = fd.ph;
        input.value = item[fd.f] == null ? '' : item[fd.f];
      }
      input.dataset.f = fd.f;
      wrap.appendChild(input);
      grid.appendChild(wrap);
    });

    card.appendChild(grid);
    return card;
  }

  function renderAll() {
    renderStaticFields();
    Object.keys(SCHEMAS).forEach(renderList);
  }

  /* ================= Helpers de dados ================= */

  function getList(name) {
    return name === 'languages' ? draft.skills.languages : draft[name];
  }

  function newItem(name) {
    const base = { id: U.uid(name.slice(0, 3)) };
    SCHEMAS[name].fields.forEach(fd => {
      base[fd.f] = fd.type === 'checkbox' ? false : '';
    });
    return base;
  }

  function addItem(name) {
    const item = newItem(name);
    if (name === 'languages') draft.skills.languages.push(item);
    else draft[name].push(item);
    renderList(name);
    // foco no primeiro campo do novo item
    const container = form.querySelector(`[data-list="${name}"]`);
    const last = container.querySelector(`.item-card[data-id="${item.id}"] input, .item-card[data-id="${item.id}"] textarea, .item-card[data-id="${item.id}"] select`);
    if (last) last.focus();
  }

  function removeItem(name, id) {
    if (name === 'languages') {
      draft.skills.languages = draft.skills.languages.filter(i => i.id !== id);
    } else {
      draft[name] = draft[name].filter(i => i.id !== id);
    }
    renderList(name);
  }

  /* ================= Eventos ================= */

  function bindOnce() {
    if (form.dataset.bound === '1') return;
    form.dataset.bound = '1';

    /* Campos estáticos */
    form.addEventListener('input', e => {
      const el = e.target;

      // item dinâmico
      const card = el.closest('.item-card');
      if (card && el.dataset.f) {
        const name = card.dataset.list;
        const item = getList(name).find(i => i.id === card.dataset.id);
        if (!item) return;
        const f = el.dataset.f;

        if (el.type === 'checkbox') {
          item[f] = el.checked;
          if (f === 'current' && el.checked) item.end = '';
          renderList(name);
          return;
        }

        item[f] = el.value;
        // atualiza só o título do card, sem re-renderizar tudo (evita perder o foco)
        const strong = card.querySelector('.item-head strong');
        if (strong) strong.textContent = SCHEMAS[name].title(item);
        return;
      }

      // campo estático com data-path
      if (el.dataset.path) {
        const path = el.dataset.path;
        if (path === 'skills.technical' || path === 'skills.tools' || path === 'skills.soft') {
          U.setPath(draft, path, U.parseList(el.value));
        } else {
          U.setPath(draft, path, el.value);
        }
        if (path === 'summary') updateSummaryCounter();
        if (path === 'personal.email') validateEmailField(el);
      }
    });

    /* Cliques: adicionar / excluir / navegar */
    form.addEventListener('click', e => {
      const addBtn = e.target.closest('[data-add]');
      if (addBtn) { addItem(addBtn.dataset.add); return; }

      const delBtn = e.target.closest('[data-del]');
      if (delBtn) {
        const card = delBtn.closest('.item-card');
        const name = card.dataset.list;
        if (confirm('Excluir este item? Esta ação não pode ser desfeita.')) {
          removeItem(name, delBtn.dataset.del);
        }
        return;
      }
    });

    /* Submit */
    form.addEventListener('submit', e => {
      e.preventDefault();
      if (!validateAll()) {
        toast('Verifique os campos destacados antes de salvar.', true);
        return;
      }
      const ok = ORStorage.setProfile(draft);
      if (ok) toast('Progresso salvo neste navegador.');
      else toast('Não foi possível salvar. O armazenamento pode estar cheio ou bloqueado.', true);
    });

    /* Navegação entre passos */
    document.getElementById('nextStep').addEventListener('click', () => goStep(currentStep + 1));
    document.getElementById('prevStep').addEventListener('click', () => goStep(currentStep - 1));

    document.getElementById('steps').addEventListener('click', e => {
      const btn = e.target.closest('.step');
      if (btn) goStep(Number(btn.dataset.step));
    });
  }

  function updateSummaryCounter() {
    const el = document.getElementById('summaryCounter');
    if (!el) return;
    const n = (draft.summary || '').length;
    el.textContent = `${n} caractere${n === 1 ? '' : 's'}.`;
    if (n > 0 && n < 200) el.textContent += ' Um resumo costuma ter entre 300 e 700 caracteres.';
  }

  /* ================= Navegação por passos ================= */

  function goStep(n) {
    if (n < 1 || n > TOTAL_STEPS) return;
    currentStep = n;
    document.querySelectorAll('.step-panel').forEach(p => {
      p.classList.toggle('is-active', Number(p.dataset.step) === n);
    });
    document.querySelectorAll('.step').forEach(s => {
      s.classList.toggle('is-active', Number(s.dataset.step) === n);
    });
    document.getElementById('prevStep').disabled = (n === 1);
    const next = document.getElementById('nextStep');
    next.disabled = (n === TOTAL_STEPS);
    next.style.visibility = (n === TOTAL_STEPS) ? 'hidden' : 'visible';

    const content = document.querySelector('.content');
    if (window.innerWidth <= 860 && content) content.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /* ================= Validação ================= */

  function markError(path, msg) {
    const input = form.querySelector(`[data-path="${path}"]`);
    const err = form.querySelector(`[data-err="${path}"]`);
    if (input) input.classList.toggle('is-invalid', !!msg);
    if (err) err.textContent = msg || '';
  }

  function validateEmailField(el) {
    const v = el.value.trim();
    const msg = (v && !U.isEmail(v)) ? 'Informe um e-mail válido.' : '';
    markError('personal.email', msg);
  }

  function validateAll() {
    let ok = true;
    let firstBad = null;

    // Nome
    if (!draft.personal.fullName.trim()) {
      markError('personal.fullName', 'Informe seu nome completo.');
      firstBad = firstBad || form.querySelector('[data-path="personal.fullName"]');
      ok = false;
    } else markError('personal.fullName', '');

    // E-mail
    if (!draft.personal.email.trim()) {
      markError('personal.email', 'Informe um e-mail de contato.');
      firstBad = firstBad || form.querySelector('[data-path="personal.email"]');
      ok = false;
    } else if (!U.isEmail(draft.personal.email)) {
      markError('personal.email', 'Informe um e-mail válido.');
      firstBad = firstBad || form.querySelector('[data-path="personal.email"]');
      ok = false;
    } else markError('personal.email', '');

    // Datas de experiências
    draft.experiences.forEach(exp => {
      if (!exp.start) return; // opcional, não bloqueia
      if (!exp.current && exp.end && exp.end < exp.start) {
        ok = false;
        toast('Há uma experiência com data de término anterior à data de início.', true);
      }
    });

    if (firstBad) {
      const panel = firstBad.closest('.step-panel');
      if (panel) goStep(Number(panel.dataset.step));
      firstBad.focus();
    }
    return ok;
  }

  /* ================= Toast local ================= */

  function toast(msg, isError) {
    const t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.toggle('err', !!isError);
    t.hidden = false;
    clearTimeout(toast._t);
    toast._t = setTimeout(() => { t.hidden = true; }, 3600);
  }

  /* ================= API pública ================= */

  function init() {
    form = document.getElementById('profileForm');
    if (!form) return;

    draft = U.clone(ORStorage.get().profile);

    renderAll();
    bindOnce();
    goStep(1);

    // recarrega o rascunho se os dados externos mudarem (ex.: restauração de backup)
    ORStorage.onChange(() => {
      const fresh = ORStorage.get().profile;
      if (JSON.stringify(fresh) !== JSON.stringify(draft)) {
        draft = U.clone(fresh);
        renderAll();
      }
    });
  }

  /** Chamado por app.js quando o usuário quer editar um item específico */
  function openStep(step) { goStep(step); }

  return { init, openStep };
})();