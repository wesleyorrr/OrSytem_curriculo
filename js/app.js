/* OR System — Etapa 1: navegação, painel inicial e configurações */
(function () {
  'use strict';

  const U = window.ORUtil;
  const S = window.ORStorage;

  const TITLES = {
    painel: 'Painel inicial',
    criar: 'Criar meu currículo',
    diagnostico: 'Diagnóstico do Currículo',
    vaga: 'Analisar uma vaga',
    modelos: 'Modelos de currículo',
    meus: 'Meus currículos',
    config: 'Configurações e privacidade'
  };

  /* ================= Navegação ================= */

  function navigate(view) {
    if (!TITLES[view]) view = 'painel';

    document.querySelectorAll('.view').forEach(v => {
      v.classList.toggle('is-active', v.id === 'view-' + view);
    });
    document.querySelectorAll('.nav-item').forEach(b => {
      b.classList.toggle('is-active', b.dataset.view === view);
    });
    document.getElementById('topbarTitle').textContent = TITLES[view];

    if (location.hash !== '#' + view) history.replaceState(null, '', '#' + view);

    if (view === 'painel') renderDashboard();
    closeSidebar();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function openSidebar() {
    document.getElementById('sidebar').classList.add('is-open');
    const ov = document.getElementById('overlay');
    ov.hidden = false;
    document.getElementById('menuBtn').setAttribute('aria-expanded', 'true');
  }
  function closeSidebar() {
    document.getElementById('sidebar').classList.remove('is-open');
    document.getElementById('overlay').hidden = true;
    document.getElementById('menuBtn').setAttribute('aria-expanded', 'false');
  }

  /* ================= Painel inicial ================= */

  function renderDashboard() {
    const s = S.get();
    const p = s.profile;
    const has = S.hasContent();

    document.getElementById('welcomeEmpty').hidden = has;
    document.getElementById('dashboard').hidden = !has;

    if (!has) return;

    /* Saudação */
    const primeiroNome = (p.personal.fullName || '').trim().split(/\s+/)[0];
    const alvo = p.personal.targetRole ? ` rumo à vaga de ${p.personal.targetRole}` : '';
    document.getElementById('dashGreeting').textContent =
      primeiroNome ? `Olá, ${primeiroNome}!` : 'Olá!';
    document.getElementById('dashSubtitle').textContent =
      `Este é o resumo real do seu currículo${alvo}. Continue de onde parou ou avance para o diagnóstico.`;

    /* Estatísticas reais */
    const stats = [
      { num: p.experiences.length, lbl: 'Experiências cadastradas' },
      { num: p.education.length, lbl: 'Formações acadêmicas' },
      { num: p.courses.length, lbl: 'Cursos e certificações' },
      { num: (p.skills.technical.length + p.skills.tools.length + p.skills.soft.length), lbl: 'Competências' },
      { num: p.projects.length, lbl: 'Projetos' },
      { num: p.skills.languages.length, lbl: 'Idiomas' }
    ];
    document.getElementById('dashStats').innerHTML = stats.map(st =>
      `<div class="stat"><div class="num">${st.num}</div><div class="lbl">${U.esc(st.lbl)}</div></div>`
    ).join('');

    /* Pendências calculadas a partir do conteúdo real */
    const pend = buildPending(p);
    const ul = document.getElementById('dashPending');
    if (!pend.length) {
      ul.innerHTML = `<li><span class="dot green"></span><span class="ok-text">Nenhuma pendência estrutural identificada nas informações atuais.</span></li>`;
    } else {
      ul.innerHTML = pend.map(item =>
        `<li><span class="dot ${item.level}"></span><span>${U.esc(item.text)}</span></li>`
      ).join('');
    }

    /* Metadados */
    const meta = [
      ['Última atualização', U.fmtDateTime(s.meta.updatedAt)],
      ['Criado em', U.fmtDateTime(s.meta.createdAt)],
      ['Cargo desejado', p.personal.targetRole || 'não definido'],
      ['Arquivo de backup', 'disponível em Configurações']
    ];
    document.getElementById('dashMeta').innerHTML = meta.map(([k, v]) =>
      `<li><span>${U.esc(k)}</span><span>${U.esc(v)}</span></li>`
    ).join('');
  }

  /**
   * Verificações estruturais simples, derivadas do conteúdo real.
   * Não é o diagnóstico completo (Etapa 7) — apenas pendências objetivas.
   */
  function buildPending(p) {
    const out = [];

    if (!p.personal.phone && !p.personal.email) {
      out.push({ level: 'red', text: 'Nenhum contato profissional informado. Recrutadores precisam de e-mail ou telefone.' });
    } else if (!p.personal.phone) {
      out.push({ level: 'yellow', text: 'Telefone não informado. Muitas empresas ainda usam o telefone para o primeiro contato.' });
    }

    if (!p.personal.targetRole) {
      out.push({ level: 'yellow', text: 'Cargo desejado não definido. Isso dificulta personalizar o currículo.' });
    }

    const sum = (p.summary || '').trim();
    if (!sum) {
      out.push({ level: 'red', text: 'Resumo profissional vazio. É a primeira coisa que o recrutador lê.' });
    } else if (sum.length < 200) {
      out.push({ level: 'yellow', text: `Resumo profissional curto (${sum.length} caracteres). O ideal costuma ser entre 300 e 700.` });
    }

    const semAtividades = p.experiences.filter(e => !(e.activities || '').trim());
    if (semAtividades.length) {
      out.push({ level: 'red', text: `${semAtividades.length} experiência(s) sem descrição de atividades realizadas.` });
    }

    const semDatas = p.experiences.filter(e => !e.start);
    if (semDatas.length) {
      out.push({ level: 'yellow', text: `${semDatas.length} experiência(s) sem data de início.` });
    }

    if (!p.experiences.length && !p.projects.length && !p.courses.length) {
      out.push({ level: 'red', text: 'Nenhuma experiência, projeto ou curso cadastrado. O currículo fica sem evidências de competência.' });
    }

    if (!p.education.length) {
      out.push({ level: 'yellow', text: 'Formação acadêmica não informada.' });
    }

    if (!p.skills.technical.length && !p.skills.tools.length) {
      out.push({ level: 'yellow', text: 'Nenhuma competência técnica ou ferramenta cadastrada.' });
    }

    if (!p.personal.linkedin) {
      out.push({ level: 'opcional', text: 'LinkedIn não informado (opcional, mas ajuda o recrutador a confirmar seu perfil).', level: 'green' });
    }

    // ordena: crítico -> atenção -> opcional
    const peso = { red: 0, yellow: 1, green: 2 };
    return out.sort((a, b) => peso[a.level] - peso[b.level]);
  }

  /* ================= Configurações ================= */

  function initConfig() {
    const exp = document.getElementById('exportJson');
    const impBtn = document.getElementById('importJsonBtn');
    const impFile = document.getElementById('importJson');
    const wipe = document.getElementById('wipeData');

    exp.addEventListener('click', () => {
      const blob = new Blob([S.exportJSON()], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `or-system-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast('Backup baixado.');
    });

    impBtn.addEventListener('click', () => impFile.click());

    impFile.addEventListener('change', () => {
      const file = impFile.files && impFile.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          S.importJSON(String(reader.result));
          toast('Backup restaurado com sucesso.');
          renderDashboard();
        } catch (e) {
          console.error(e);
          toast('Arquivo inválido. Use um backup gerado por este sistema.', true);
        }
        impFile.value = '';
      };
      reader.readAsText(file);
    });

    wipe.addEventListener('click', () => {
      const ok = confirm(
        'Isso remove PERMANENTEMENTE todos os dados do currículo salvos neste navegador.\n\n' +
        'Recomendamos baixar um backup antes. Deseja continuar?'
      );
      if (!ok) return;
      S.clear();
      toast('Todos os dados locais foram excluídos.');
      renderDashboard();
    });
  }

  /* ================= Toast global ================= */

  function toast(msg, isError) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.toggle('err', !!isError);
    t.hidden = false;
    clearTimeout(toast._t);
    toast._t = setTimeout(() => { t.hidden = true; }, 3600);
  }
  window.ORToast = toast;

  /* ================= Boot ================= */

  function boot() {
    // Navegação lateral
    document.getElementById('nav').addEventListener('click', e => {
      const btn = e.target.closest('.nav-item');
      if (btn) navigate(btn.dataset.view);
    });

    // Botões "ir para"
    document.body.addEventListener('click', e => {
      const g = e.target.closest('[data-goto]');
      if (g) { navigate(g.dataset.goto); }
    });

    // Menu mobile
    document.getElementById('menuBtn').addEventListener('click', () => {
      const open = document.getElementById('sidebar').classList.contains('is-open');
      open ? closeSidebar() : openSidebar();
    });
    document.getElementById('overlay').addEventListener('click', closeSidebar);
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeSidebar(); });

    // Módulos
    ORProfile.init();
    initConfig();

    // Rota inicial pela hash
    const initial = (location.hash || '').replace('#', '') || 'painel';
    navigate(initial);

    // Re-renderiza o painel quando os dados mudam
    S.onChange(() => {
      if (document.getElementById('view-painel').classList.contains('is-active')) renderDashboard();
    });

    // Aviso de privacidade no primeiro uso
    if (!localStorage.getItem('orsystem.aviso.privacidade')) {
      setTimeout(() => {
        toast('Seus dados ficam apenas neste navegador. Faça backup em Configurações.');
        try { localStorage.setItem('orsystem.aviso.privacidade', '1'); } catch (e) {}
      }, 900);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();