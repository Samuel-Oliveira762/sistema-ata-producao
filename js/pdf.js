(function () {
  function sanitizeFileName(fileName) {
    const baseName = String(fileName || "ata-reuniao").trim() || "ata-reuniao";
    return baseName
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^\w.-]+/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_+|_+$/g, "");
  }

  function getPrintStyles() {
    return `
      :root {
        --text: #163042;
        --muted: #5f7282;
        --border: #d8e1ea;
        --panel: #f7fafc;
        --critical: #fce6e6;
        --attention: #fff6dc;
        --normal: #edf8f2;
      }

      * { box-sizing: border-box; }

      @page {
        size: A4 portrait;
        margin: 12mm;
      }

      body {
        margin: 0;
        color: var(--text);
        font-family: Arial, Helvetica, sans-serif;
        background: #ffffff;
      }

      .export-shell {
        max-width: 100%;
      }

      .export-minute {
        display: grid;
        gap: 14px;
      }

      .export-header {
        display: flex;
        justify-content: space-between;
        gap: 16px;
        border-bottom: 2px solid var(--border);
        padding-bottom: 10px;
      }

      .export-title {
        font-size: 22px;
        font-weight: 700;
      }

      .export-subtitle {
        margin-top: 4px;
        font-size: 14px;
      }

      .export-meta-side,
      .export-meta-grid,
      .export-grid {
        display: grid;
        gap: 8px;
      }

      .export-meta-side {
        min-width: 220px;
      }

      .export-meta-grid {
        grid-template-columns: repeat(3, minmax(0, 1fr));
      }

      .export-meta-grid > div,
      .export-meta-side > div,
      .export-grid > div {
        border: 1px solid var(--border);
        background: var(--panel);
        border-radius: 8px;
        padding: 8px 10px;
      }

      .export-meta-grid span,
      .export-meta-side span,
      .export-grid span {
        display: block;
        color: var(--muted);
        font-size: 11px;
        margin-bottom: 3px;
      }

      .export-meta-grid strong,
      .export-meta-side strong,
      .export-grid strong {
        font-size: 12px;
        line-height: 1.45;
        word-break: break-word;
      }

      .export-grid {
        grid-template-columns: repeat(4, minmax(0, 1fr));
      }

      .export-mode-note {
        border: 1px solid var(--border);
        background: #eef5fb;
        border-radius: 8px;
        padding: 8px 10px;
        font-size: 12px;
      }

      .export-grid-span {
        grid-column: 1 / -1;
      }

      .export-section-title {
        margin: 6px 0 8px;
        font-size: 15px;
      }

      .export-client-section {
        break-inside: avoid;
        margin-bottom: 12px;
      }

      .export-client-title {
        padding: 8px 10px;
        background: #163042;
        color: #ffffff;
        border-radius: 8px;
        font-size: 13px;
        font-weight: 700;
        margin-bottom: 8px;
      }

      .export-items {
        display: grid;
        gap: 8px;
      }

      .export-item {
        border: 1px solid var(--border);
        border-radius: 10px;
        padding: 10px;
        break-inside: avoid;
      }

      .export-criticality-critico { background: var(--critical); }
      .export-criticality-atencao { background: var(--attention); }
      .export-criticality-normal { background: var(--normal); }

      .export-item-head {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        align-items: flex-start;
        margin-bottom: 8px;
      }

      .export-item-head strong {
        display: block;
        font-size: 13px;
        margin-bottom: 3px;
      }

      .export-item-head div {
        font-size: 12px;
      }

      .export-badges {
        display: flex;
        gap: 6px;
        flex-wrap: wrap;
        justify-content: flex-end;
      }

      .export-pill {
        border: 1px solid rgba(22, 48, 66, 0.18);
        border-radius: 999px;
        padding: 4px 8px;
        font-size: 11px;
        font-weight: 700;
        background: rgba(255, 255, 255, 0.72);
        white-space: nowrap;
      }

      .export-pending-section {
        margin-top: 8px;
      }

      .export-pending-table {
        width: 100%;
        border-collapse: collapse;
        table-layout: fixed;
      }

      .export-pending-table th,
      .export-pending-table td {
        border: 1px solid var(--border);
        padding: 8px;
        text-align: left;
        vertical-align: top;
        font-size: 12px;
        word-break: break-word;
      }

      .export-pending-table th {
        background: var(--panel);
      }

      .export-empty {
        padding: 12px;
        border: 1px solid var(--border);
        border-radius: 8px;
        font-size: 12px;
        color: var(--muted);
      }

      @media print {
        body {
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
      }
    `;
  }

  async function exportSnapshotToPdf(snapshot, fileName) {
    const safeTitle = sanitizeFileName(fileName || snapshot.subject || "ata-reuniao");
    const printWindow = window.open("", "_blank", "width=1200,height=900");

    if (!printWindow) {
      throw new Error("Não foi possível abrir a janela de impressão.");
    }

    const markup = window.UiService.buildExportMarkup(snapshot);

    printWindow.document.open();
    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="pt-BR">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${safeTitle}</title>
          <style>${getPrintStyles()}</style>
        </head>
        <body>
          <div class="export-shell">${markup}</div>
        </body>
      </html>
    `);
    printWindow.document.close();

    await new Promise((resolve) => {
      printWindow.onload = resolve;
      window.setTimeout(resolve, 500);
    });

    printWindow.onafterprint = function () {
      printWindow.close();
    };

    printWindow.focus();
    printWindow.print();
  }

  window.PdfService = {
    exportSnapshotToPdf
  };
})();
