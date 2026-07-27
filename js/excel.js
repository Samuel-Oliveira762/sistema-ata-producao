(function () {
  const REQUIRED_COLUMNS = {
    cliente: ["cliente"],
    producao: ["producao", "produção", "pedido", "ordem de producao", "op"],
    dataEntrada: ["data", "data entrada", "data do pedido", "entrada", "data da entrada do pedido"],
    entrega: ["entrega", "data entrega", "data de entrega"],
    lead: ["lead", "lead time"],
    produto: ["produto", "item", "codigo produto", "código produto"],
    descricao: ["descricao", "descrição", "descricao produto", "descrição produto"],
    planejado: ["planejado", "qtd planejada", "quantidade planejada"],
    realizado: ["realizado", "qtd realizada", "quantidade realizada"],
    saldo: ["saldo", "saldo pendente"],
    percentual: ["%", "percentual", "perc", "porcentagem"],
    setores: ["setores", "operacoes restantes", "operações restantes", "operacoes", "operações"]
  };

  function normalizeHeader(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9%]+/g, " ")
      .trim();
  }

  function normalizeText(value) {
    return String(value || "").trim();
  }

  function parseNumber(value) {
    if (typeof value === "number") {
      return Number.isFinite(value) ? value : 0;
    }

    if (value === null || value === undefined || value === "") {
      return 0;
    }

    const text = String(value).trim();
    if (!text) {
      return 0;
    }

    const hasComma = text.includes(",");
    const sanitized = hasComma
      ? text.replace(/\./g, "").replace(",", ".").replace(/[^\d.-]/g, "")
      : text.replace(/[^\d.-]/g, "");

    const numeric = Number(sanitized);
    return Number.isFinite(numeric) ? numeric : 0;
  }

  function formatNumber(value) {
    return new Intl.NumberFormat("pt-BR", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    }).format(parseNumber(value));
  }

  function excelSerialToDate(serial) {
    if (typeof XLSX === "undefined" || typeof serial !== "number") {
      return "";
    }

    const parsed = XLSX.SSF.parse_date_code(serial);
    if (!parsed) {
      return "";
    }

    const date = new Date(parsed.y, parsed.m - 1, parsed.d);
    return formatDateInput(date);
  }

  function formatDateInput(date) {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
      return "";
    }

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function parseDate(value) {
    if (!value && value !== 0) {
      return "";
    }

    if (value instanceof Date) {
      return formatDateInput(value);
    }

    if (typeof value === "number") {
      return excelSerialToDate(value);
    }

    const text = String(value).trim();
    if (!text) {
      return "";
    }

    if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
      return text;
    }

    const slashMatch = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
    if (slashMatch) {
      const day = slashMatch[1].padStart(2, "0");
      const month = slashMatch[2].padStart(2, "0");
      const year = slashMatch[3].length === 2 ? `20${slashMatch[3]}` : slashMatch[3];
      return `${year}-${month}-${day}`;
    }

    const parsed = new Date(text);
    if (!Number.isNaN(parsed.getTime())) {
      return formatDateInput(parsed);
    }

    return "";
  }

  function formatDateDisplay(value) {
    const normalized = parseDate(value);
    if (!normalized) {
      return "-";
    }

    const [year, month, day] = normalized.split("-");
    return `${day}/${month}/${year}`;
  }

  function parsePercent(value) {
    if (value === null || value === undefined || value === "") {
      return 0;
    }

    if (typeof value === "number") {
      return value <= 1 ? value * 100 : value;
    }

    const text = String(value).trim();
    const numeric = parseNumber(text);
    if (text.includes("%")) {
      return numeric;
    }
    return numeric <= 1 ? numeric * 100 : numeric;
  }

  function formatPercent(value) {
    return `${parsePercent(value).toFixed(1).replace(".", ",")}%`;
  }

  function isEmptyRow(row) {
    return !row || row.every((cell) => String(cell || "").trim() === "");
  }

  function matchColumnKey(headerValue) {
    const normalized = normalizeHeader(headerValue);
    if (!normalized) {
      return null;
    }

    for (const [key, aliases] of Object.entries(REQUIRED_COLUMNS)) {
      if (aliases.some((alias) => normalizeHeader(alias) === normalized)) {
        return key;
      }
    }

    for (const [key, aliases] of Object.entries(REQUIRED_COLUMNS)) {
      if (aliases.some((alias) => normalized.includes(normalizeHeader(alias)))) {
        return key;
      }
    }

    return null;
  }

  function detectHeaderRow(rows) {
    let bestMatch = { index: -1, matches: 0, mapping: {} };

    rows.slice(0, 15).forEach((row, rowIndex) => {
      const mapping = {};
      let matches = 0;

      row.forEach((cell, cellIndex) => {
        const key = matchColumnKey(cell);
        if (key && mapping[key] === undefined) {
          mapping[key] = cellIndex;
          matches += 1;
        }
      });

      if (matches > bestMatch.matches) {
        bestMatch = { index: rowIndex, matches, mapping };
      }
    });

    return bestMatch;
  }

  function buildStableId(base, index) {
    const seed = `${base}-${index}`;
    let hash = 0;
    for (let i = 0; i < seed.length; i += 1) {
      hash = (hash << 5) - hash + seed.charCodeAt(i);
      hash |= 0;
    }
    return `row-${Math.abs(hash)}`;
  }

  function createEditableFields() {
    return {
      planoAcao: "",
      responsavel: "",
      prazo: "",
      replanejadoQuantidade: "",
      prazoReplanejado: "",
      statusAcao: "",
      observacoes: "",
      detalhesAntecipacao: "",
      dataSolicitadaCliente: ""
    };
  }

  function groupByClient(items) {
    return items.reduce((accumulator, item) => {
      const key = item.cliente || "Sem cliente";
      if (!accumulator[key]) {
        accumulator[key] = [];
      }
      accumulator[key].push(item);
      return accumulator;
    }, {});
  }

  function parseSpreadsheet(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = function (event) {
        try {
          const data = new Uint8Array(event.target.result);
          const workbook = XLSX.read(data, {
            type: "array",
            cellDates: true,
            raw: true
          });

          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          const rows = XLSX.utils.sheet_to_json(firstSheet, {
            header: 1,
            raw: true,
            defval: ""
          });

          const headerInfo = detectHeaderRow(rows);
          if (headerInfo.index === -1 || headerInfo.matches < 6) {
            throw new Error("Não foi possível localizar o cabeçalho principal da planilha.");
          }

          const missingColumns = Object.keys(REQUIRED_COLUMNS).filter(
            (column) => headerInfo.mapping[column] === undefined
          );

          if (missingColumns.length) {
            throw new Error(
              `Colunas obrigatórias ausentes: ${missingColumns.join(", ")}.`
            );
          }

          const records = rows
            .slice(headerInfo.index + 1)
            .filter((row) => !isEmptyRow(row))
            .map((row, index) => {
              const cliente = normalizeText(row[headerInfo.mapping.cliente]);
              const producao = normalizeText(row[headerInfo.mapping.producao]);
              const produto = normalizeText(row[headerInfo.mapping.produto]);
              const descricao = normalizeText(row[headerInfo.mapping.descricao]);
              const seed = `${cliente}|${producao}|${produto}|${descricao}`;

              return {
                id: buildStableId(seed, index),
                cliente,
                producao,
                dataEntrada: parseDate(row[headerInfo.mapping.dataEntrada]),
                entrega: parseDate(row[headerInfo.mapping.entrega]),
                lead: normalizeText(row[headerInfo.mapping.lead]),
                produto,
                descricao,
                planejado: parseNumber(row[headerInfo.mapping.planejado]),
                realizado: parseNumber(row[headerInfo.mapping.realizado]),
                saldo: parseNumber(row[headerInfo.mapping.saldo]),
                percentual: parsePercent(row[headerInfo.mapping.percentual]),
                setores: normalizeText(row[headerInfo.mapping.setores]),
                ...createEditableFields()
              };
            })
            .filter((item) => item.cliente || item.producao || item.produto || item.descricao);

          resolve({
            records,
            groupedByClient: groupByClient(records)
          });
        } catch (error) {
          reject(error);
        }
      };

      reader.onerror = function () {
        reject(new Error("Não foi possível ler o arquivo selecionado."));
      };

      reader.readAsArrayBuffer(file);
    });
  }

  window.ExcelService = {
    REQUIRED_COLUMNS,
    normalizeHeader,
    normalizeText,
    parseNumber,
    parseDate,
    parsePercent,
    formatNumber,
    formatDateDisplay,
    formatPercent,
    parseSpreadsheet,
    groupByClient,
    createEditableFields
  };
})();
