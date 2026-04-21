(function () {
  const STORAGE_KEY = "production_minutes_history_v1";
  const PARTICIPANTS_KEY = "production_minutes_participants_v1";
  const OP_DATABASE_KEY = "opDatabase";
  const STORAGE_KEYS = {
    minutes: STORAGE_KEY,
    participants: PARTICIPANTS_KEY,
    opDatabase: OP_DATABASE_KEY
  };

  function loadMinutes() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      return [];
    }
  }

  function persistMinutes(minutes) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(minutes));
  }

  function saveMinute(minute) {
    const minutes = loadMinutes();
    const index = minutes.findIndex((entry) => entry.id === minute.id);

    if (index >= 0) {
      minutes[index] = minute;
    } else {
      minutes.unshift(minute);
    }

    persistMinutes(minutes);
    return minute;
  }

  function deleteMinute(minuteId) {
    const minutes = loadMinutes().filter((entry) => entry.id !== minuteId);
    persistMinutes(minutes);
  }

  function getMinuteById(minuteId) {
    return loadMinutes().find((entry) => entry.id === minuteId) || null;
  }

  function loadParticipants() {
    try {
      const raw = localStorage.getItem(PARTICIPANTS_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      return [];
    }
  }

  function saveParticipants(participants) {
    localStorage.setItem(PARTICIPANTS_KEY, JSON.stringify(participants));
    return participants;
  }

  function loadOPDatabase() {
    try {
      const raw = localStorage.getItem(OP_DATABASE_KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    } catch (error) {
      return {};
    }
  }

  function saveOPDatabase(database) {
    const safeDatabase = database && typeof database === "object" && !Array.isArray(database) ? database : {};
    localStorage.setItem(OP_DATABASE_KEY, JSON.stringify(safeDatabase));
    return safeDatabase;
  }

  function getOPData(producao) {
    const key = String(producao || "").trim();
    if (!key) {
      return null;
    }

    const database = loadOPDatabase();
    return database[key] || null;
  }

  function updateOPData(producao, dados) {
    const key = String(producao || "").trim();
    if (!key) {
      return null;
    }

    const database = loadOPDatabase();
    database[key] = {
      ...database[key],
      ...dados
    };
    saveOPDatabase(database);
    return database[key];
  }

  window.StorageService = {
    STORAGE_KEYS,
    loadMinutes,
    saveMinute,
    deleteMinute,
    getMinuteById,
    loadParticipants,
    saveParticipants,
    loadOPDatabase,
    saveOPDatabase,
    getOPData,
    updateOPData
  };
})();
