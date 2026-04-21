(function () {
  const BACKUP_VERSION = 1;
  const THEME_STORAGE_KEY = "production_minutes_theme_v1";
  const LEGACY_KEYS = {
    opDatabase: "opDatabase",
    atasHistory: "atasHistory"
  };

  function parseStoredValue(rawValue) {
    if (typeof rawValue !== "string") {
      return null;
    }

    try {
      return JSON.parse(rawValue);
    } catch (error) {
      return rawValue;
    }
  }

  function getManagedStorageKeys() {
    const prefixedKeys = Object.keys(localStorage).filter((key) => key.startsWith("production_minutes_"));

    return [...new Set([
      ...prefixedKeys,
      THEME_STORAGE_KEY,
      LEGACY_KEYS.opDatabase,
      LEGACY_KEYS.atasHistory
    ])];
  }

  function collectStorageData() {
    const storage = {};

    getManagedStorageKeys().forEach((key) => {
      const rawValue = localStorage.getItem(key);
      if (rawValue === null) {
        return;
      }

      storage[key] = parseStoredValue(rawValue);
    });

    return storage;
  }

  function normalizeBackupPayload(backup) {
    const storage = backup && backup.data && typeof backup.data.storage === "object" && backup.data.storage
      ? { ...backup.data.storage }
      : {};

    if (!(LEGACY_KEYS.opDatabase in storage)) {
      storage[LEGACY_KEYS.opDatabase] = backup?.data?.opDatabase ?? {};
    }

    if (!(StorageService.STORAGE_KEYS.minutes in storage)) {
      storage[StorageService.STORAGE_KEYS.minutes] = backup?.data?.atasHistory ?? [];
    }

    if (!(StorageService.STORAGE_KEYS.participants in storage)) {
      storage[StorageService.STORAGE_KEYS.participants] = backup?.data?.participantsCatalog ?? [];
    }

    if (!(THEME_STORAGE_KEY in storage)) {
      storage[THEME_STORAGE_KEY] = backup?.data?.theme ?? "light";
    }

    return {
      version: Number(backup?.version || BACKUP_VERSION),
      exportedAt: backup?.exportedAt || new Date().toISOString(),
      data: {
        opDatabase: backup?.data?.opDatabase ?? storage[LEGACY_KEYS.opDatabase] ?? {},
        atasHistory: backup?.data?.atasHistory ?? storage[StorageService.STORAGE_KEYS.minutes] ?? [],
        participantsCatalog: backup?.data?.participantsCatalog ?? storage[StorageService.STORAGE_KEYS.participants] ?? [],
        theme: backup?.data?.theme ?? storage[THEME_STORAGE_KEY] ?? "light",
        storage
      }
    };
  }

  function exportBackup() {
    const storage = collectStorageData();

    return {
      version: BACKUP_VERSION,
      exportedAt: new Date().toISOString(),
      data: {
        opDatabase: storage[LEGACY_KEYS.opDatabase] ?? {},
        atasHistory: storage[StorageService.STORAGE_KEYS.minutes] ?? [],
        participantsCatalog: storage[StorageService.STORAGE_KEYS.participants] ?? [],
        theme: storage[THEME_STORAGE_KEY] ?? "light",
        storage
      }
    };
  }

  function validateBackup(data) {
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      throw new Error("Arquivo de backup inválido.");
    }

    if (Number(data.version) < 1) {
      throw new Error("Versão de backup inválida.");
    }

    if (!data.data || typeof data.data !== "object" || Array.isArray(data.data)) {
      throw new Error("Estrutura de backup inválida.");
    }

    const normalized = normalizeBackupPayload(data);

    if (!Array.isArray(normalized.data.atasHistory)) {
      throw new Error("O histórico de atas do backup é inválido.");
    }

    if (!Array.isArray(normalized.data.participantsCatalog)) {
      throw new Error("O cadastro de participantes do backup é inválido.");
    }

    if (!normalized.data.storage || typeof normalized.data.storage !== "object" || Array.isArray(normalized.data.storage)) {
      throw new Error("Os dados persistidos do backup são inválidos.");
    }

    return normalized;
  }

  function writeStorageValue(key, value) {
    if (typeof value === "string") {
      localStorage.setItem(key, value);
      return;
    }

    localStorage.setItem(key, JSON.stringify(value ?? null));
  }

  function restoreBackup(data) {
    const normalized = validateBackup(data);

    getManagedStorageKeys().forEach((key) => {
      localStorage.removeItem(key);
    });

    Object.entries(normalized.data.storage).forEach(([key, value]) => {
      writeStorageValue(key, value);
    });

    return normalized;
  }

  function downloadJSON(filename, object) {
    const blob = new Blob([JSON.stringify(object, null, 2)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  async function importBackup(file) {
    if (!file) {
      throw new Error("Selecione um arquivo de backup.");
    }

    const fileName = String(file.name || "").toLowerCase();
    if (!fileName.endsWith(".json")) {
      throw new Error("Selecione um arquivo .json válido.");
    }

    let parsed;

    try {
      parsed = JSON.parse(await file.text());
    } catch (error) {
      throw new Error("Arquivo de backup inválido.");
    }

    return validateBackup(parsed);
  }

  window.BackupService = {
    BACKUP_VERSION,
    exportBackup,
    importBackup,
    validateBackup,
    restoreBackup,
    downloadJSON
  };
})();
