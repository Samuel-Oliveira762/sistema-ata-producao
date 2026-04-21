(function () {
  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function formatStatusLabel(status) {
    const labels = {
      "": "Sem ação",
      pendente: "Pendente",
      em_andamento: "Em andamento",
      concluido: "Concluído"
    };
    return labels[status] || "Sem ação";
  }

  function statusBadgeClass(status, prazo) {
    if (status === "concluido") {
      return "badge-done";
    }
    if (status === "em_andamento") {
      return "badge-progress";
    }
    if (status === "pendente" && prazo && prazo < new Date().toISOString().slice(0, 10)) {
      return "badge-late";
    }
    return "badge-empty";
  }

  function criticalityLabel(level) {
    const labels = {
      critico: "Crítico",
      atencao: "Atenção",
      normal: "Normal"
    };
    return labels[level] || "Normal";
  }

  function criticalityBadgeClass(level) {
    const classes = {
      critico: "badge-critical",
      atencao: "badge-attention",
      normal: "badge-normal"
    };
    return classes[level] || "badge-normal";
  }

  function summaryCard(label, value, modifier) {
    return `
      <article class="summary-card ${modifier}">
        <span>${escapeHtml(label)}</span>
        <strong>${escapeHtml(value)}</strong>
      </article>
    `;
  }

  function buildPreviewMarkup(snapshot) {
    const grouped = ExcelService.groupByClient(snapshot.items || []);
    const attendanceRows = (snapshot.attendance || []).map((participant) => `
      <tr>
        <td>${escapeHtml(participant.name || "-")}</td>
        <td>${escapeHtml(participant.role || "-")}</td>
        <td><span class="status-badge ${participant.present ? "badge-done" : "badge-empty"}">${participant.present ? "Presente" : "Ausente"}</span></td>
        <td>${escapeHtml(participant.arrivalTime || "-")}</td>
      </tr>
    `).join("");
    const clientSections = Object.entries(grouped).map(([client, items]) => `
      <section class="client-block">
        <h4>${escapeHtml(client)}</h4>
        <table class="minute-table">
          <thead>
            <tr>
              <th>Produção</th>
              <th>Data entrada</th>
              <th>Lead</th>
              <th>Entrega</th>
              <th>Produto</th>
              <th>Descrição</th>
              <th>Planejado</th>
              <th>Realizado</th>
              <th>Saldo</th>
              <th>%</th>
              <th>Antecipação</th>
              <th>Operações restantes</th>
              <th>Plano de ação</th>
              <th>Responsável</th>
              <th>Prazo</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${items.map((item) => `
              <tr>
                <td>${escapeHtml(item.producao || "-")}</td>
                <td>${escapeHtml(ExcelService.formatDateDisplay(item.dataEntrada))}</td>
                <td>${escapeHtml(item.lead || "-")}</td>
                <td>${escapeHtml(ExcelService.formatDateDisplay(item.entrega))}</td>
                <td>${escapeHtml(item.produto || "-")}</td>
                <td>${escapeHtml(item.descricao || "-")}</td>
                <td>${escapeHtml(ExcelService.formatNumber(item.planejado))}</td>
                <td>${escapeHtml(ExcelService.formatNumber(item.realizado))}</td>
                <td><span class="criticality-badge ${criticalityBadgeClass(item.criticidade)}">${escapeHtml(ExcelService.formatNumber(item.saldo))}</span></td>
                <td>${escapeHtml(ExcelService.formatPercent(item.percentual))}</td>
                <td>${item.antecipacaoCliente ? "Sim" : "-"}</td>
                <td>${escapeHtml(item.setores || "-")}</td>
                <td>${escapeHtml(item.planoAcao || "-")}</td>
                <td>${escapeHtml(item.responsavel || "-")}</td>
                <td>${escapeHtml(ExcelService.formatDateDisplay(item.prazo))}</td>
                <td><span class="status-badge ${statusBadgeClass(item.statusAcao, item.prazo)}">${escapeHtml(formatStatusLabel(item.statusAcao))}</span></td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </section>
    `).join("");

    const pendingsMarkup = (snapshot.generalPendings || []).map((pending) => `
      <tr>
        <td>${escapeHtml(pending.acao || "-")}</td>
        <td>${escapeHtml(pending.responsavel || "-")}</td>
        <td>${escapeHtml(ExcelService.formatDateDisplay(pending.prazo))}</td>
        <td><span class="status-badge ${statusBadgeClass(pending.status, pending.prazo)}">${escapeHtml(formatStatusLabel(pending.status))}</span></td>
      </tr>
    `).join("");

    return `
      <article class="minute-preview">
        <header class="minute-header">
          <div>
            <div class="minute-title">ATA DE REUNIÃO</div>
            <p><strong>Assunto:</strong> ${escapeHtml(snapshot.subject || "-")}</p>
          </div>
          <div class="history-meta">
            <span><strong>Arquivo:</strong> ${escapeHtml(snapshot.fileName || "-")}</span>
            <span><strong>Gerada em:</strong> ${escapeHtml(new Date(snapshot.updatedAt || snapshot.createdAt || Date.now()).toLocaleString("pt-BR"))}</span>
          </div>
        </header>

        <section class="minute-meta">
          <article class="minute-meta-card"><span>Data da reunião</span><strong>${escapeHtml(ExcelService.formatDateDisplay(snapshot.meetingDate))}</strong></article>
          <article class="minute-meta-card"><span>Responsável geral</span><strong>${escapeHtml(snapshot.owner || "-")}</strong></article>
          <article class="minute-meta-card"><span>Horário</span><strong>${escapeHtml(`${snapshot.startTime || "--:--"} às ${snapshot.endTime || "--:--"}`)}</strong></article>
          <article class="minute-meta-card"><span>Participantes</span><strong>${escapeHtml(snapshot.participants || "-")}</strong></article>
          <article class="minute-meta-card"><span>Presentes</span><strong>${escapeHtml(String((snapshot.attendance || []).filter((participant) => participant.present).length))}</strong></article>
          <article class="minute-meta-card"><span>Total de itens</span><strong>${escapeHtml(String((snapshot.items || []).length))}</strong></article>
          <article class="minute-meta-card"><span>Pendências gerais</span><strong>${escapeHtml(String((snapshot.generalPendings || []).length))}</strong></article>
        </section>

        <section class="pending-card">
          <h3>Chamada de presença</h3>
          <table class="minute-table">
            <thead>
              <tr>
                <th>Participante</th>
                <th>Cargo</th>
                <th>Status</th>
                <th>Chegada</th>
              </tr>
            </thead>
            <tbody>
              ${attendanceRows || '<tr><td colspan="4" class="empty-state-cell">Nenhum participante cadastrado.</td></tr>'}
            </tbody>
          </table>
        </section>

        <section>
          <h3>Itens por cliente</h3>
          ${clientSections || '<div class="empty-state-card">Nenhum item disponível.</div>'}
        </section>

        <section class="pending-card">
          <h3>Pendências gerais da reunião</h3>
          <table class="minute-table">
            <thead>
              <tr>
                <th>Ação</th>
                <th>Responsável</th>
                <th>Prazo</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${pendingsMarkup || '<tr><td colspan="4" class="empty-state-cell">Nenhuma pendência geral registrada.</td></tr>'}
            </tbody>
          </table>
        </section>
      </article>
    `;
  }

  function buildExportMarkup(snapshot) {
    const grouped = ExcelService.groupByClient(snapshot.items || []);
    const attendanceRows = (snapshot.attendance || []).map((participant) => `
      <tr>
        <td>${escapeHtml(participant.name || "-")}</td>
        <td>${escapeHtml(participant.role || "-")}</td>
        <td>${participant.present ? "Presente" : "Ausente"}</td>
        <td>${escapeHtml(participant.arrivalTime || "-")}</td>
      </tr>
    `).join("");
    const clientSections = Object.entries(grouped).map(([client, items]) => `
      <section class="export-client-section">
        <div class="export-client-title">${escapeHtml(client)}</div>
        <div class="export-items">
          ${items.map((item) => `
            <article class="export-item export-criticality-${escapeHtml(item.criticidade || "normal")}">
              <div class="export-item-head">
                <div>
                  <strong>Produção ${escapeHtml(item.producao || "-")}</strong>
                  <div>Produto ${escapeHtml(item.produto || "-")}</div>
                </div>
                <div class="export-badges">
                  <span class="export-pill">${escapeHtml(criticalityLabel(item.criticidade))}</span>
                  <span class="export-pill">${escapeHtml(formatStatusLabel(item.statusAcao))}</span>
                </div>
              </div>

              <div class="export-grid">
                <div><span>Entrada</span><strong>${escapeHtml(ExcelService.formatDateDisplay(item.dataEntrada))}</strong></div>
                <div><span>Entrega</span><strong>${escapeHtml(ExcelService.formatDateDisplay(item.entrega))}</strong></div>
                <div><span>Lead</span><strong>${escapeHtml(item.lead || "-")}</strong></div>
                <div><span>Saldo</span><strong>${escapeHtml(ExcelService.formatNumber(item.saldo))}</strong></div>
                <div><span>Percentual</span><strong>${escapeHtml(ExcelService.formatPercent(item.percentual))}</strong></div>
                <div><span>Antecipação</span><strong>${item.antecipacaoCliente ? "Sim" : "-"}</strong></div>
                <div><span>Planejado</span><strong>${escapeHtml(ExcelService.formatNumber(item.planejado))}</strong></div>
                <div><span>Realizado</span><strong>${escapeHtml(ExcelService.formatNumber(item.realizado))}</strong></div>
                <div><span>Prazo</span><strong>${escapeHtml(ExcelService.formatDateDisplay(item.prazo))}</strong></div>
                <div class="export-grid-span"><span>Descrição</span><strong>${escapeHtml(item.descricao || "-")}</strong></div>
                <div class="export-grid-span"><span>Operações restantes</span><strong>${escapeHtml(item.setores || "-")}</strong></div>
                <div class="export-grid-span"><span>Plano de ação</span><strong>${escapeHtml(item.planoAcao || "-")}</strong></div>
                <div><span>Responsável</span><strong>${escapeHtml(item.responsavel || "-")}</strong></div>
              </div>
            </article>
          `).join("")}
        </div>
      </section>
    `).join("");

    const pendingsMarkup = (snapshot.generalPendings || []).map((pending) => `
      <tr>
        <td>${escapeHtml(pending.acao || "-")}</td>
        <td>${escapeHtml(pending.responsavel || "-")}</td>
        <td>${escapeHtml(ExcelService.formatDateDisplay(pending.prazo))}</td>
        <td>${escapeHtml(formatStatusLabel(pending.status))}</td>
      </tr>
    `).join("");

    return `
      <article class="export-minute">
        <header class="export-header">
          <div>
            <div class="export-title">ATA DE REUNIÃO</div>
            <div class="export-subtitle">${escapeHtml(snapshot.subject || "-")}</div>
          </div>
          <div class="export-meta-side">
            <div><span>Arquivo</span><strong>${escapeHtml(snapshot.fileName || "-")}</strong></div>
            <div><span>Gerada em</span><strong>${escapeHtml(new Date(snapshot.updatedAt || snapshot.createdAt || Date.now()).toLocaleString("pt-BR"))}</strong></div>
          </div>
        </header>

        <section class="export-meta-grid">
          <div><span>Data da reunião</span><strong>${escapeHtml(ExcelService.formatDateDisplay(snapshot.meetingDate))}</strong></div>
          <div><span>Responsável geral</span><strong>${escapeHtml(snapshot.owner || "-")}</strong></div>
          <div><span>Horário</span><strong>${escapeHtml(`${snapshot.startTime || "--:--"} às ${snapshot.endTime || "--:--"}`)}</strong></div>
          <div class="export-grid-span"><span>Participantes</span><strong>${escapeHtml(snapshot.participants || "-")}</strong></div>
        </section>

        ${snapshot.exportModeLabel ? `
          <section class="export-mode-note">
            <strong>Modo do PDF:</strong> ${escapeHtml(snapshot.exportModeLabel)}
          </section>
        ` : ""}

        <section class="export-pending-section">
          <h2 class="export-section-title">Chamada de presença</h2>
          <table class="export-pending-table">
            <thead>
              <tr>
                <th>Participante</th>
                <th>Cargo</th>
                <th>Status</th>
                <th>Chegada</th>
              </tr>
            </thead>
            <tbody>
              ${attendanceRows || '<tr><td colspan="4">Nenhum participante cadastrado.</td></tr>'}
            </tbody>
          </table>
        </section>

        <section>
          <h2 class="export-section-title">Itens por cliente</h2>
          ${clientSections || '<div class="export-empty">Nenhum item disponível.</div>'}
        </section>

        <section class="export-pending-section">
          <h2 class="export-section-title">Pendências gerais da reunião</h2>
          <table class="export-pending-table">
            <thead>
              <tr>
                <th>Ação</th>
                <th>Responsável</th>
                <th>Prazo</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${pendingsMarkup || '<tr><td colspan="4">Nenhuma pendência geral registrada.</td></tr>'}
            </tbody>
          </table>
        </section>
      </article>
    `;
  }

  window.UiService = {
    escapeHtml,
    buildPreviewMarkup,
    buildExportMarkup,
    formatStatusLabel,
    statusBadgeClass,
    criticalityLabel,
    criticalityBadgeClass,
    summaryCard
  };
})();
