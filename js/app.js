(function () {
  const CRITICAL_RULES = {
    attentionDaysBeforeDue: 5
  };
  const THEME_STORAGE_KEY = "production_minutes_theme_v1";

  const state = {
    records: [],
    fileName: "",
    currentMinuteId: null,
    selectedHistoryId: null,
    filters: {
      client: "",
      criticality: "",
      mode: "all",
      search: "",
      deliveryDate: ""
    },
    meeting: {
      subject: "",
      meetingDate: new Date().toISOString().slice(0, 10),
      participants: "",
      owner: "",
      startTime: "",
      endTime: ""
    },
    attendance: [],
    participantCatalog: [],
    exportActionsOnly: true,
    generalPendings: [],
    alerts: []
  };

  const elements = {};

  function createEmptyPending() {
    return {
      id: `pending-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
      acao: "",
      responsavel: "",
      prazo: "",
      status: "pendente"
    };
  }

  function createAttendanceParticipant(name, role) {
    return {
      id: `participant-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
      name: String(name || "").trim(),
      role: String(role || "").trim(),
      present: false,
      arrivalTime: ""
    };
  }

  function getCurrentTimeString() {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, "0");
    const minutes = String(now.getMinutes()).padStart(2, "0");
    return `${hours}:${minutes}`;
  }

  function initializeElements() {
    elements.alertContainer = document.getElementById("alert-container");
    elements.fileInput = document.getElementById("spreadsheet-input");
    elements.fileName = document.getElementById("current-file-name");
    elements.recordCount = document.getElementById("current-record-count");
    elements.meetingForm = document.getElementById("meeting-form");
    elements.participantNameInput = document.getElementById("participant-name-input");
    elements.participantRoleInput = document.getElementById("participant-role-input");
    elements.addParticipantBtn = document.getElementById("add-participant-btn");
    elements.attendanceTbody = document.getElementById("attendance-tbody");
    elements.ownerOptions = document.getElementById("owner-options");
    elements.filterClient = document.getElementById("filter-client");
    elements.filterCriticality = document.getElementById("filter-criticality");
    elements.filterMode = document.getElementById("filter-mode");
    elements.filterSearch = document.getElementById("filter-search");
    elements.filterDeliveryDate = document.getElementById("filter-delivery-date");
    elements.summaryCards = document.getElementById("summary-cards");
    elements.recordsTbody = document.getElementById("records-tbody");
    elements.generalPendingTbody = document.getElementById("general-pending-tbody");
    elements.previewRoot = document.getElementById("preview-root");
    elements.recordsTableBody = document.getElementById("records-table-body");
    elements.recordsHeaderTable = document.querySelector(".records-header-table");
    elements.historyList = document.getElementById("history-list");
    elements.detailsRoot = document.getElementById("details-root");
    elements.detailsLoadBtn = document.getElementById("details-load-btn");
    elements.detailsExportBtn = document.getElementById("details-export-btn");
    elements.historyFilterSubject = document.getElementById("history-filter-subject");
    elements.historyFilterOwner = document.getElementById("history-filter-owner");
    elements.historyFilterDate = document.getElementById("history-filter-date");
    elements.historyFilterClient = document.getElementById("history-filter-client");
    elements.exportActionsOnly = document.getElementById("export-actions-only");
    elements.themeToggleBtn = document.getElementById("theme-toggle-btn");
    elements.backupExportBtn = document.getElementById("backup-export-btn");
    elements.backupFileInput = document.getElementById("backup-file-input");
    elements.backupFileName = document.getElementById("backup-file-name");
    elements.backupImportBtn = document.getElementById("backup-import-btn");
  }

  function applyTheme(theme) {
    const resolvedTheme = theme === "dark" ? "dark" : "light";
    document.body.classList.toggle("dark-theme", resolvedTheme === "dark");
    if (elements.themeToggleBtn) {
      elements.themeToggleBtn.textContent = resolvedTheme === "dark" ? "Modo claro" : "Modo escuro";
    }
    localStorage.setItem(THEME_STORAGE_KEY, resolvedTheme);
  }

  function syncParticipantsField() {
    const presentNames = state.attendance
      .filter((participant) => participant.present)
      .map((participant) => participant.name.trim())
      .filter(Boolean);

    state.meeting.participants = presentNames.join(", ");
    const participantsField = elements.meetingForm.elements.namedItem("participants");
    if (participantsField) {
      participantsField.value = state.meeting.participants;
    }
  }

  function normalizeParticipantName(name) {
    return String(name || "").trim().toLowerCase();
  }

  function persistParticipantCatalog() {
    StorageService.saveParticipants(state.participantCatalog);
  }

  function buildAttendanceFromCatalog(existingAttendance) {
    const currentAttendance = Array.isArray(existingAttendance) ? existingAttendance : state.attendance;

    return state.participantCatalog.map((participant) => {
      const existingParticipant = currentAttendance.find((item) => item.id === participant.id);

      return {
        ...participant,
        present: existingParticipant ? Boolean(existingParticipant.present) : false,
        arrivalTime: existingParticipant ? existingParticipant.arrivalTime || "" : ""
      };
    });
  }

  function renderOwnerOptions() {
    elements.ownerOptions.innerHTML = state.participantCatalog
      .map((participant) => {
        const label = participant.role
          ? `${UiService.escapeHtml(participant.name)} - ${UiService.escapeHtml(participant.role)}`
          : UiService.escapeHtml(participant.name);
        return `<option value="${UiService.escapeHtml(participant.name)}">${label}</option>`;
      })
      .join("");
  }

  function showAlert(message, type) {
    state.alerts.unshift({
      id: Date.now(),
      message,
      type
    });
    state.alerts = state.alerts.slice(0, 3);
    renderAlerts();
    window.setTimeout(() => {
      state.alerts = state.alerts.filter((alert) => alert.message !== message);
      renderAlerts();
    }, 4000);
  }

  function renderAlerts() {
    elements.alertContainer.innerHTML = state.alerts
      .map((alert) => `<div class="alert alert-${alert.type}">${UiService.escapeHtml(alert.message)}</div>`)
      .join("");
  }

  function classifyCriticality(item) {
    const meetingDate = ExcelService.parseDate(state.meeting.meetingDate);
    const deliveryDate = ExcelService.parseDate(item.entrega);

    if (item.antecipacaoCliente) {
      return "critico";
    }

    if (!meetingDate || !deliveryDate) {
      return "normal";
    }

    const meetingDateObject = new Date(`${meetingDate}T00:00:00`);
    const deliveryDateObject = new Date(`${deliveryDate}T00:00:00`);
    const diffInDays = Math.floor((deliveryDateObject - meetingDateObject) / 86400000);

    if (diffInDays <= 0) {
      return "critico";
    }

    if (diffInDays <= CRITICAL_RULES.attentionDaysBeforeDue) {
      return "atencao";
    }

    return "normal";
  }

  function applyRecordDefaults(records) {
    return records.map((record) => ({
      ...record,
      antecipacaoCliente: Boolean(record.antecipacaoCliente),
      criticidade: classifyCriticality(record)
    }));
  }

  function mergeOPMemory(record, opDatabase) {
    const producao = String(record.producao || "").trim();
    if (!producao) {
      return { ...record };
    }

    const opData = opDatabase && typeof opDatabase === "object" ? opDatabase[producao] : null;
    if (!opData) {
      return { ...record };
    }

    return {
      ...record,
      planoAcao: opData.planoAcao ?? record.planoAcao ?? "",
      responsavel: opData.responsavel ?? record.responsavel ?? "",
      prazo: opData.prazo ?? record.prazo ?? "",
      replanejadoQuantidade: opData.replanejadoQuantidade ?? record.replanejadoQuantidade ?? "",
      prazoReplanejado: opData.prazoReplanejado ?? record.prazoReplanejado ?? "",
      statusAcao: opData.statusAcao ?? record.statusAcao ?? "",
      dataUltimaAtualizacao: opData.dataUltimaAtualizacao ?? record.dataUltimaAtualizacao ?? ""
    };
  }

  function applyOPMemory(records) {
    const opDatabase = StorageService.loadOPDatabase();
    return records.map((record) => mergeOPMemory(record, opDatabase));
  }

  function persistOPMemory(records) {
    const opDatabase = StorageService.loadOPDatabase();
    const today = new Date().toISOString().slice(0, 10);

    records.forEach((record) => {
      const producao = String(record.producao || "").trim();
      if (!producao) {
        return;
      }

      opDatabase[producao] = {
        planoAcao: String(record.planoAcao || "").trim(),
        responsavel: String(record.responsavel || "").trim(),
        prazo: String(record.prazo || "").trim(),
        replanejadoQuantidade: record.replanejadoQuantidade ?? "",
        prazoReplanejado: String(record.prazoReplanejado || "").trim(),
        statusAcao: String(record.statusAcao || "").trim(),
        dataUltimaAtualizacao: today
      };
    });

    StorageService.saveOPDatabase(opDatabase);
  }

  function refreshCriticalities() {
    state.records = state.records.map((record) => ({
      ...record,
      criticidade: classifyCriticality(record)
    }));
  }

  function getFilteredRecords() {
    return state.records.filter((record) => {
      if (state.filters.client && record.cliente !== state.filters.client) {
        return false;
      }
      if (state.filters.criticality && record.criticidade !== state.filters.criticality) {
        return false;
      }
      if (state.filters.mode === "critical-only" && record.criticidade !== "critico") {
        return false;
      }
      if (state.filters.deliveryDate && record.entrega !== state.filters.deliveryDate) {
        return false;
      }
      if (state.filters.search) {
        const target = `${record.produto} ${record.descricao}`.toLowerCase();
        if (!target.includes(state.filters.search.toLowerCase())) {
          return false;
        }
      }
      return true;
    });
  }

  function renderSummary() {
    const records = getFilteredRecords();
    const totals = records.reduce(
      (accumulator, item) => {
        accumulator[item.criticidade] += 1;
        accumulator.total += 1;
        return accumulator;
      },
      { critico: 0, atencao: 0, normal: 0, total: 0 }
    );

    elements.summaryCards.innerHTML = [
      UiService.summaryCard("Itens críticos", String(totals.critico), "is-critical"),
      UiService.summaryCard("Itens em atenção", String(totals.atencao), "is-attention"),
      UiService.summaryCard("Itens normais", String(totals.normal), "is-normal"),
      UiService.summaryCard("Total filtrado", String(totals.total), "is-total")
    ].join("");
  }

  function renderClientFilterOptions() {
    const clients = [...new Set(state.records.map((record) => record.cliente).filter(Boolean))].sort();
    elements.filterClient.innerHTML = ['<option value="">Todos</option>']
      .concat(clients.map((client) => `<option value="${UiService.escapeHtml(client)}">${UiService.escapeHtml(client)}</option>`))
      .join("");
    elements.filterClient.value = state.filters.client;
  }

  function renderRecordsTable() {
    const records = getFilteredRecords();

    if (!records.length) {
      elements.recordsTbody.innerHTML = '<tr><td colspan="13" class="empty-state-cell">Nenhum registro encontrado para os filtros atuais.</td></tr>';
      return;
    }

    elements.recordsTbody.innerHTML = records.map((record) => `
      <tr class="row-${record.criticidade}">
        <td>${UiService.escapeHtml(record.cliente || "-")}</td>
        <td>${UiService.escapeHtml(record.producao || "-")}</td>
        <td>${UiService.escapeHtml(record.produto || "-")}</td>
        <td>${UiService.escapeHtml(record.descricao || "-")}</td>
        <td>${UiService.escapeHtml(ExcelService.formatDateDisplay(record.entrega))}</td>
        <td>${UiService.escapeHtml(ExcelService.formatNumber(record.saldo))}</td>
        <td>${UiService.escapeHtml(ExcelService.formatPercent(record.percentual))}</td>
        <td>
          <input
            class="presence-check"
            data-record-id="${record.id}"
            data-field="antecipacaoCliente"
            type="checkbox"
            ${record.antecipacaoCliente ? "checked" : ""}
          >
        </td>
        <td><span class="criticality-badge ${UiService.criticalityBadgeClass(record.criticidade)}">${UiService.escapeHtml(UiService.criticalityLabel(record.criticidade))}</span></td>
        <td><textarea class="editable-textarea" data-record-id="${record.id}" data-field="planoAcao" rows="2">${UiService.escapeHtml(record.planoAcao)}</textarea></td>
        <td><input class="editable-input" data-record-id="${record.id}" data-field="responsavel" type="text" value="${UiService.escapeHtml(record.responsavel)}"></td>
        <td><input class="editable-input" data-record-id="${record.id}" data-field="prazo" type="date" value="${UiService.escapeHtml(record.prazo)}"></td>
        <td>
          <select class="editable-select" data-record-id="${record.id}" data-field="statusAcao">
            <option value="" ${record.statusAcao === "" ? "selected" : ""}>Sem ação</option>
            <option value="pendente" ${record.statusAcao === "pendente" ? "selected" : ""}>Pendente</option>
            <option value="em_andamento" ${record.statusAcao === "em_andamento" ? "selected" : ""}>Em andamento</option>
            <option value="concluido" ${record.statusAcao === "concluido" ? "selected" : ""}>Concluído</option>
          </select>
        </td>
      </tr>
    `).join("");
  }

  function renderGeneralPendings() {
    if (!state.generalPendings.length) {
      state.generalPendings = [createEmptyPending()];
    }

    elements.generalPendingTbody.innerHTML = state.generalPendings.map((pending) => `
      <tr>
        <td><textarea class="editable-textarea" data-pending-id="${pending.id}" data-field="acao" rows="2">${UiService.escapeHtml(pending.acao)}</textarea></td>
        <td><input class="editable-input" data-pending-id="${pending.id}" data-field="responsavel" type="text" value="${UiService.escapeHtml(pending.responsavel)}"></td>
        <td><input class="editable-input" data-pending-id="${pending.id}" data-field="prazo" type="date" value="${UiService.escapeHtml(pending.prazo)}"></td>
        <td>
          <select class="editable-select" data-pending-id="${pending.id}" data-field="status">
            <option value="pendente" ${pending.status === "pendente" ? "selected" : ""}>Pendente</option>
            <option value="em_andamento" ${pending.status === "em_andamento" ? "selected" : ""}>Em andamento</option>
            <option value="concluido" ${pending.status === "concluido" ? "selected" : ""}>Concluído</option>
          </select>
        </td>
        <td><button class="btn btn-ghost" data-remove-pending="${pending.id}" type="button">Remover</button></td>
      </tr>
    `).join("");
  }

  function renderAttendance() {
    if (!state.attendance.length) {
      elements.attendanceTbody.innerHTML = '<tr><td colspan="5" class="empty-state-cell">Adicione participantes para iniciar a chamada.</td></tr>';
      syncParticipantsField();
      return;
    }

    elements.attendanceTbody.innerHTML = state.attendance.map((participant) => `
      <tr>
        <td><span class="attendance-name">${UiService.escapeHtml(participant.name || "-")}</span></td>
        <td><span class="attendance-role-text">${UiService.escapeHtml(participant.role || "-")}</span></td>
        <td>
          <input
            class="presence-check"
            data-attendance-id="${participant.id}"
            data-field="present"
            type="checkbox"
            ${participant.present ? "checked" : ""}
          >
        </td>
        <td><span class="arrival-time">${UiService.escapeHtml(participant.arrivalTime || "--:--")}</span></td>
        <td><button class="btn btn-ghost" data-remove-attendance="${participant.id}" type="button">Remover</button></td>
      </tr>
    `).join("");

    syncParticipantsField();
  }

  function buildCurrentSnapshot() {
    const now = new Date().toISOString();
    const existing = state.currentMinuteId ? StorageService.getMinuteById(state.currentMinuteId) : null;
    return {
      id: state.currentMinuteId || `minute-${Date.now()}`,
      subject: state.meeting.subject,
      meetingDate: state.meeting.meetingDate,
      participants: state.meeting.participants,
      owner: state.meeting.owner,
      startTime: state.meeting.startTime,
      endTime: state.meeting.endTime,
      fileName: state.fileName,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
      attendance: state.attendance,
      items: state.records,
      generalPendings: state.generalPendings
    };
  }

  function buildExportSnapshot(snapshot, actionsOnly) {
    const filteredItems = actionsOnly
      ? (snapshot.items || []).filter((item) => String(item.planoAcao || "").trim())
      : (snapshot.items || []);

    return {
      ...snapshot,
      items: filteredItems,
      exportModeLabel: actionsOnly
        ? "Somente itens com plano de ação preenchido e pendências gerais"
        : "Ata completa"
    };
  }

  function renderPreview(snapshot) {
    elements.previewRoot.innerHTML = UiService.buildPreviewMarkup(snapshot);
  }

  function renderHistoryList() {
    const filters = {
      subject: elements.historyFilterSubject.value.toLowerCase(),
      owner: elements.historyFilterOwner.value.toLowerCase(),
      date: elements.historyFilterDate.value,
      client: elements.historyFilterClient.value.toLowerCase()
    };

    const minutes = StorageService.loadMinutes().filter((minute) => {
      if (filters.subject && !String(minute.subject || "").toLowerCase().includes(filters.subject)) {
        return false;
      }
      if (filters.owner && !String(minute.owner || "").toLowerCase().includes(filters.owner)) {
        return false;
      }
      if (filters.date && minute.meetingDate !== filters.date) {
        return false;
      }
      if (filters.client) {
        const clients = [...new Set((minute.items || []).map((item) => item.cliente).filter(Boolean))].join(" ").toLowerCase();
        if (!clients.includes(filters.client)) {
          return false;
        }
      }
      return true;
    });

    if (!minutes.length) {
      elements.historyList.innerHTML = '<div class="empty-state-card">Nenhuma ata salva encontrada com os filtros atuais.</div>';
      return;
    }

    elements.historyList.innerHTML = minutes.map((minute) => {
      const clients = [...new Set((minute.items || []).map((item) => item.cliente).filter(Boolean))].slice(0, 3);
      return `
        <article class="history-card">
          <div class="history-meta">
            <span>Assunto</span>
            <strong>${UiService.escapeHtml(minute.subject || "Sem assunto")}</strong>
            <span>Data da reunião: ${UiService.escapeHtml(ExcelService.formatDateDisplay(minute.meetingDate))}</span>
            <span>Responsável: ${UiService.escapeHtml(minute.owner || "-")}</span>
            <span>Itens: ${UiService.escapeHtml(String((minute.items || []).length))}</span>
            <span>Criada em: ${UiService.escapeHtml(new Date(minute.createdAt).toLocaleString("pt-BR"))}</span>
            <p class="client-inline-list">Clientes: ${UiService.escapeHtml(clients.join(", ") || "-")}</p>
          </div>
          <div class="history-actions">
            <button class="btn btn-secondary" data-history-open="${minute.id}" type="button">Abrir detalhes</button>
            <button class="btn btn-ghost" data-history-load="${minute.id}" type="button">Carregar para edição</button>
            <button class="btn btn-primary" data-history-export="${minute.id}" type="button">Exportar PDF</button>
            <button class="btn danger-btn" data-history-delete="${minute.id}" type="button">Excluir</button>
          </div>
        </article>
      `;
    }).join("");
  }

  function renderDetails(minute) {
    state.selectedHistoryId = minute ? minute.id : null;
    elements.detailsLoadBtn.disabled = !minute;
    elements.detailsExportBtn.disabled = !minute;

    if (!minute) {
      elements.detailsRoot.classList.add("empty-details");
      elements.detailsRoot.textContent = "Selecione uma ata no histórico para visualizar os detalhes completos.";
      return;
    }

    elements.detailsRoot.classList.remove("empty-details");
    elements.detailsRoot.innerHTML = UiService.buildPreviewMarkup(minute);
  }

  function resetBackupSelection() {
    if (elements.backupFileInput) {
      elements.backupFileInput.value = "";
    }

    if (elements.backupFileName) {
      elements.backupFileName.textContent = "Nenhum arquivo selecionado.";
    }

    if (elements.backupImportBtn) {
      elements.backupImportBtn.disabled = true;
    }
  }

  function rerenderWorkspace() {
    elements.fileName.textContent = state.fileName || "Nenhum arquivo importado";
    elements.recordCount.textContent = String(state.records.length);
    renderAttendance();
    renderClientFilterOptions();
    renderSummary();
    renderRecordsTable();
    renderGeneralPendings();
    renderPreview(buildCurrentSnapshot());
  }

  function syncMeetingForm() {
    Object.entries(state.meeting).forEach(([key, value]) => {
      const input = elements.meetingForm.elements.namedItem(key);
      if (input) {
        input.value = value || "";
      }
    });
  }

  function handleRecordEdit(target) {
    const recordId = target.dataset.recordId;
    const field = target.dataset.field;
    if (!recordId || !field) {
      return;
    }

      const record = state.records.find((item) => item.id === recordId);
      if (!record) {
        return;
      }

      record[field] = field === "antecipacaoCliente" ? target.checked : target.value;
      record.criticidade = classifyCriticality(record);

      const shouldRerenderTable = field === "antecipacaoCliente";

      renderSummary();

      if (shouldRerenderTable) {
        renderRecordsTable();
      }

      renderPreview(buildCurrentSnapshot());
    }

  function handlePendingEdit(target) {
    const pendingId = target.dataset.pendingId;
    const field = target.dataset.field;
    if (!pendingId || !field) {
      return;
    }

    const pending = state.generalPendings.find((item) => item.id === pendingId);
    if (!pending) {
      return;
    }

    pending[field] = target.value;
    renderPreview(buildCurrentSnapshot());
  }

  function addAttendanceParticipant() {
    const name = String(elements.participantNameInput.value || "").trim();
    const role = String(elements.participantRoleInput.value || "").trim();
    if (!name) {
      showAlert("Digite o nome do participante antes de adicionar.", "error");
      return;
    }

    if (!role) {
      showAlert("Informe o cargo do participante antes de adicionar.", "error");
      return;
    }

    const normalizedName = normalizeParticipantName(name);
    const alreadyExists = state.participantCatalog.some(
      (participant) => normalizeParticipantName(participant.name) === normalizedName
    );

    if (alreadyExists) {
      showAlert("Esse participante já existe no cadastro.", "error");
      return;
    }

    const participant = createAttendanceParticipant(name, role);
    state.participantCatalog.push({
      id: participant.id,
      name: participant.name,
      role: participant.role
    });
    persistParticipantCatalog();
    state.attendance = buildAttendanceFromCatalog(state.attendance);
    elements.participantNameInput.value = "";
    elements.participantRoleInput.value = "";
    renderOwnerOptions();
    renderAttendance();
    renderPreview(buildCurrentSnapshot());
  }

  async function handleFileUpload(event) {
    const [file] = event.target.files || [];
    if (!file) {
      return;
    }

    if (!file.name.toLowerCase().endsWith(".xlsx")) {
      showAlert("Selecione um arquivo com extensão .xlsx.", "error");
      event.target.value = "";
      return;
    }

    try {
      const parsed = await ExcelService.parseSpreadsheet(file);
      state.records = applyRecordDefaults(applyOPMemory(parsed.records));
      state.fileName = file.name;
      state.currentMinuteId = null;
      state.filters.client = "";
      state.filters.criticality = "";
      state.filters.mode = "all";
      state.filters.search = "";
      state.filters.deliveryDate = "";
      state.attendance = buildAttendanceFromCatalog();
      state.generalPendings = [createEmptyPending()];
      elements.filterCriticality.value = "";
      elements.filterMode.value = "all";
      elements.filterSearch.value = "";
      elements.filterDeliveryDate.value = "";
      showAlert("Planilha importada com sucesso.", "success");
      rerenderWorkspace();
    } catch (error) {
      showAlert(error.message || "Falha ao importar a planilha.", "error");
    }
  }

  function saveCurrentMinute() {
    if (!state.records.length) {
      showAlert("Importe uma planilha antes de salvar a ata.", "error");
      return;
    }

    const snapshot = buildCurrentSnapshot();
    persistOPMemory(state.records);
    StorageService.saveMinute(snapshot);
    state.currentMinuteId = snapshot.id;
    renderHistoryList();
    renderDetails(snapshot);
    showAlert("Ata salva no histórico local.", "success");
  }

  async function exportCurrentPreview() {
    const snapshot = buildCurrentSnapshot();
    renderPreview(snapshot);
    const exportSnapshot = buildExportSnapshot(snapshot, state.exportActionsOnly);
    await PdfService.exportSnapshotToPdf(
      exportSnapshot,
      exportSnapshot.subject || "ata-reuniao"
    );
  }

  function exportBackupData() {
    const now = new Date();
    const fileDate = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, "0"),
      String(now.getDate()).padStart(2, "0")
    ].join("-");
    const backup = BackupService.exportBackup();
    const minutes = Array.isArray(backup.data?.atasHistory) ? backup.data.atasHistory.length : 0;
    const participants = Array.isArray(backup.data?.participantsCatalog) ? backup.data.participantsCatalog.length : 0;
    const opEntries = backup.data?.opDatabase && typeof backup.data.opDatabase === "object"
      ? Object.keys(backup.data.opDatabase).length
      : 0;

    BackupService.downloadJSON(`backup-ata-${fileDate}.json`, backup);

    if (!minutes && !participants && !opEntries) {
      showAlert("Backup exportado, mas sem atas salvas, participantes cadastrados ou memoria por OP no momento.", "success");
      return;
    }

    showAlert("Backup exportado com sucesso.", "success");
  }

  async function importBackupData() {
    const [file] = elements.backupFileInput.files || [];
    if (!file) {
      showAlert("Selecione um arquivo de backup antes de importar.", "error");
      return;
    }

    try {
      const backup = await BackupService.importBackup(file);
      const confirmed = window.confirm(
        "Importar este backup vai substituir os dados atuais salvos neste navegador. Deseja continuar?"
      );

      if (!confirmed) {
        return;
      }

      BackupService.restoreBackup(backup);
      showAlert("Backup importado com sucesso. A pagina sera recarregada.", "success");
      resetBackupSelection();
      window.setTimeout(() => window.location.reload(), 700);
    } catch (error) {
      showAlert(error.message || "Nao foi possivel importar os dados.", "error");
    }
  }

  function loadMinuteIntoWorkspace(minute) {
    state.currentMinuteId = minute.id;
    state.fileName = minute.fileName || "";
    state.attendance = (minute.attendance || []).length
      ? minute.attendance.map((participant) => ({
        role: "",
        ...participant
      }))
      : buildAttendanceFromCatalog();
    state.records = applyRecordDefaults((minute.items || []).map((item) => ({
      ...ExcelService.createEditableFields(),
      ...item
    })));
    state.generalPendings = (minute.generalPendings || []).length
      ? minute.generalPendings.map((pending) => ({ ...pending }))
      : [createEmptyPending()];
    state.meeting = {
      subject: minute.subject || "",
      meetingDate: minute.meetingDate || new Date().toISOString().slice(0, 10),
      participants: minute.participants || "",
      owner: minute.owner || "",
      startTime: minute.startTime || "",
      endTime: minute.endTime || ""
    };
    syncMeetingForm();
    rerenderWorkspace();
    switchSection("workspace-section");
    showAlert("Ata carregada novamente para edição.", "success");
  }

  function switchSection(sectionId) {
    document.querySelectorAll(".page-section").forEach((section) => {
      section.classList.toggle("is-visible", section.id === sectionId);
    });
    document.querySelectorAll(".nav-link").forEach((button) => {
      button.classList.toggle("is-active", button.dataset.target === sectionId);
    });
  }

  function attachEvents() {
    elements.fileInput.addEventListener("change", handleFileUpload);

    elements.addParticipantBtn.addEventListener("click", addAttendanceParticipant);
    elements.participantNameInput.addEventListener("keydown", function (event) {
      if (event.key === "Enter") {
        event.preventDefault();
        addAttendanceParticipant();
      }
    });

    elements.attendanceTbody.addEventListener("change", function (event) {
      const checkbox = event.target.closest("[data-attendance-id][data-field='present']");
      if (!checkbox) {
        return;
      }

      const participant = state.attendance.find((item) => item.id === checkbox.dataset.attendanceId);
      if (!participant) {
        return;
      }

      participant.present = checkbox.checked;
      participant.arrivalTime = checkbox.checked ? (participant.arrivalTime || getCurrentTimeString()) : "";
      renderAttendance();
      renderPreview(buildCurrentSnapshot());
    });

    elements.attendanceTbody.addEventListener("click", function (event) {
      const button = event.target.closest("[data-remove-attendance]");
      if (!button) {
        return;
      }

      state.participantCatalog = state.participantCatalog.filter(
        (participant) => participant.id !== button.dataset.removeAttendance
      );
      persistParticipantCatalog();
      state.attendance = buildAttendanceFromCatalog(state.attendance);
      renderOwnerOptions();
      renderAttendance();
      renderPreview(buildCurrentSnapshot());
    });

    elements.meetingForm.addEventListener("input", function (event) {
      const target = event.target;
      if (!target.name) {
        return;
      }
      state.meeting[target.name] = target.value;
      if (target.name === "meetingDate") {
        refreshCriticalities();
        renderSummary();
        renderRecordsTable();
      }
      renderPreview(buildCurrentSnapshot());
    });

    [
      ["change", elements.filterClient, "client"],
      ["change", elements.filterCriticality, "criticality"],
      ["change", elements.filterMode, "mode"],
      ["input", elements.filterSearch, "search"],
      ["change", elements.filterDeliveryDate, "deliveryDate"]
    ].forEach(([eventName, element, key]) => {
      element.addEventListener(eventName, function () {
        state.filters[key] = element.value;
        renderSummary();
        renderRecordsTable();
      });
    });

    document.getElementById("clear-filters-btn").addEventListener("click", function () {
      state.filters = { client: "", criticality: "", mode: "all", search: "", deliveryDate: "" };
      elements.filterClient.value = "";
      elements.filterCriticality.value = "";
      elements.filterMode.value = "all";
      elements.filterSearch.value = "";
      elements.filterDeliveryDate.value = "";
      renderSummary();
      renderRecordsTable();
    });

    elements.recordsTbody.addEventListener("input", function (event) {
      handleRecordEdit(event.target);
    });
    elements.recordsTbody.addEventListener("change", function (event) {
      handleRecordEdit(event.target);
    });

    elements.generalPendingTbody.addEventListener("input", function (event) {
      handlePendingEdit(event.target);
    });
    elements.generalPendingTbody.addEventListener("change", function (event) {
      handlePendingEdit(event.target);
    });
    elements.generalPendingTbody.addEventListener("click", function (event) {
      const button = event.target.closest("[data-remove-pending]");
      if (!button) {
        return;
      }
      const pendingId = button.dataset.removePending;
      state.generalPendings = state.generalPendings.filter((pending) => pending.id !== pendingId);
      renderGeneralPendings();
      renderPreview(buildCurrentSnapshot());
    });

    document.getElementById("add-pending-btn").addEventListener("click", function () {
      state.generalPendings.push(createEmptyPending());
      renderGeneralPendings();
      renderPreview(buildCurrentSnapshot());
    });

    document.getElementById("save-minute-btn").addEventListener("click", saveCurrentMinute);
    elements.exportActionsOnly.addEventListener("change", function () {
      state.exportActionsOnly = elements.exportActionsOnly.checked;
    });
    elements.backupExportBtn.addEventListener("click", exportBackupData);
    elements.backupFileInput.addEventListener("change", function () {
      const [file] = elements.backupFileInput.files || [];
      elements.backupFileName.textContent = file ? file.name : "Nenhum arquivo selecionado.";
      elements.backupImportBtn.disabled = !file;
    });
    elements.backupImportBtn.addEventListener("click", importBackupData);
    elements.recordsTableBody.addEventListener("scroll", function () {
      elements.recordsHeaderTable.style.transform = `translateX(-${elements.recordsTableBody.scrollLeft}px)`;
    });
    elements.themeToggleBtn.addEventListener("click", function () {
      applyTheme(document.body.classList.contains("dark-theme") ? "light" : "dark");
    });
    document.getElementById("export-pdf-btn").addEventListener("click", async function () {
      try {
        await exportCurrentPreview();
      } catch (error) {
        showAlert("Não foi possível exportar o PDF.", "error");
      }
    });

    document.querySelectorAll(".nav-link").forEach((button) => {
      button.addEventListener("click", function () {
        switchSection(button.dataset.target);
      });
    });

    [
      elements.historyFilterSubject,
      elements.historyFilterOwner,
      elements.historyFilterDate,
      elements.historyFilterClient
    ].forEach((input) => {
      input.addEventListener("input", renderHistoryList);
      input.addEventListener("change", renderHistoryList);
    });

    elements.historyList.addEventListener("click", async function (event) {
      const openButton = event.target.closest("[data-history-open]");
      const loadButton = event.target.closest("[data-history-load]");
      const exportButton = event.target.closest("[data-history-export]");
      const deleteButton = event.target.closest("[data-history-delete]");

      if (openButton) {
        const minute = StorageService.getMinuteById(openButton.dataset.historyOpen);
        renderDetails(minute);
        switchSection("details-section");
      }

      if (loadButton) {
        const minute = StorageService.getMinuteById(loadButton.dataset.historyLoad);
        if (minute) {
          loadMinuteIntoWorkspace(minute);
        }
      }

      if (exportButton) {
        const minute = StorageService.getMinuteById(exportButton.dataset.historyExport);
        if (minute) {
          renderDetails(minute);
          switchSection("details-section");
          try {
            const exportSnapshot = buildExportSnapshot(minute, state.exportActionsOnly);
            await PdfService.exportSnapshotToPdf(
              exportSnapshot,
              exportSnapshot.subject || "ata-reuniao"
            );
          } catch (error) {
            showAlert("Não foi possível exportar o PDF da ata selecionada.", "error");
          }
        }
      }

      if (deleteButton) {
        const minuteId = deleteButton.dataset.historyDelete;
        if (window.confirm("Deseja realmente excluir esta ata do histórico local?")) {
          StorageService.deleteMinute(minuteId);
          if (state.selectedHistoryId === minuteId) {
            renderDetails(null);
          }
          renderHistoryList();
          showAlert("Ata removida do histórico.", "success");
        }
      }
    });

    elements.detailsLoadBtn.addEventListener("click", function () {
      const minute = StorageService.getMinuteById(state.selectedHistoryId);
      if (minute) {
        loadMinuteIntoWorkspace(minute);
      }
    });

    elements.detailsExportBtn.addEventListener("click", async function () {
      const minute = StorageService.getMinuteById(state.selectedHistoryId);
      if (!minute) {
        return;
      }
      try {
        const exportSnapshot = buildExportSnapshot(minute, state.exportActionsOnly);
        await PdfService.exportSnapshotToPdf(
          exportSnapshot,
          exportSnapshot.subject || "ata-reuniao"
        );
      } catch (error) {
        showAlert("Não foi possível exportar o PDF da visualização.", "error");
      }
    });
  }

  function bootstrap() {
    initializeElements();
    state.participantCatalog = StorageService.loadParticipants().map((participant) => ({
      id: participant.id || `participant-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
      name: String(participant.name || "").trim(),
      role: String(participant.role || "").trim()
    })).filter((participant) => participant.name);
    state.attendance = buildAttendanceFromCatalog();
    state.generalPendings = [createEmptyPending()];
    applyTheme(localStorage.getItem(THEME_STORAGE_KEY) || "light");
    syncMeetingForm();
    renderOwnerOptions();
    resetBackupSelection();
    attachEvents();
    rerenderWorkspace();
    renderHistoryList();
    renderDetails(null);
  }

  document.addEventListener("DOMContentLoaded", bootstrap);
})();
