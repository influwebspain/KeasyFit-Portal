// Controlador Principal de la Aplicación - FitActive

// Estado global de la aplicación
let state = {
  routines: [],
  history: [],
  weightHistory: [],
  deleted: { weight: {}, history: {} }, // registros borrados (ver mergeDeleted)
  settings: {
    scheduleDays: [1, 3, 5], // 1=Lunes, 3=Miércoles, 5=Viernes
    notifyTime: "19:00",
    notificationsEnabled: false,
    soundEnabled: true
  },
  currentWorkout: null,
  activeTab: 'dashboard'
};

// AudioContext para sintetizar sonido de aviso sin depender de archivos de audio externos
let audioCtx = null;

// Fecha local en formato YYYY-MM-DD. toISOString() devuelve UTC y desfasa el
// día cerca de medianoche, así que se ajusta restando el offset de la zona.
function getLocalDateString(date = new Date()) {
  const d = new Date(date.getTime());
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().split('T')[0];
}

// Inicialización de la aplicación
document.addEventListener('DOMContentLoaded', () => {
  initApp();
});

async function initApp() {
  // CRÍTICO: Configurar navegación PRIMERO para que nunca quede inactiva
  // incluso si la carga de datos falla por cualquier motivo.
  setupNavigation();

  // PASO 1: Cargar INMEDIATAMENTE desde localStorage (< 1ms)
  // Esto garantiza que las rutinas se muestran al instante sin esperar red.
  try {
    loadStateFromLocalStorage();
  } catch (err) {
    console.error('Error cargando datos locales:', err);
    if (!state.routines || state.routines.length === 0) {
      state.routines = typeof INITIAL_ROUTINES !== 'undefined' ? INITIAL_ROUTINES : [];
    }
  }

  // Configurar listeners generales del DOM
  try { setupEventListeners(); } catch(e) { console.error('Error en setupEventListeners:', e); }

  // Configurar listeners del escáner OCR
  try { setupOCREventListeners(); } catch(e) { console.error('Error en setupOCREventListeners:', e); }

  // Iniciar temporizador para comprobar alertas cada minuto
  setInterval(checkTrainingNotification, 60000);

  // Mostrar la pestaña inicial (Dashboard)
  switchTab(state.activeTab);

  // Actualizar dashboard y widgets
  try { updateDashboard(); } catch(e) { console.error('Error en updateDashboard:', e); }

  // Pre-renderizar el panel de entrenamientos para que esté listo
  try { renderWorkoutsList(); } catch(e) { console.error('Error pre-renderizando workouts:', e); }

  // ¿Quedó un entreno a medias (pestaña cerrada por el móvil)?
  try { offerResumeWorkout(); } catch(e) { console.error('Error comprobando entreno a medias:', e); }

  // PASO 2: Sincronizar desde Firebase EN SEGUNDO PLANO (no bloquea UI)
  syncFromFirebaseInBackground();
}

// CARGA RÁPIDA: Solo localStorage (síncrono, < 1ms)
function loadStateFromLocalStorage() {
  let savedRoutines = localStorage.getItem('kf_routines');
  let savedHistory = localStorage.getItem('kf_history');
  let savedWeight = localStorage.getItem('kf_weight');
  let savedSettings = localStorage.getItem('kf_settings');

  // Parsear con protección contra JSON corrupto
  try { if (typeof savedRoutines === 'string') savedRoutines = JSON.parse(savedRoutines); } catch(e) { console.error('Rutinas corruptas en localStorage:', e); savedRoutines = null; }
  try { if (typeof savedHistory === 'string') savedHistory = JSON.parse(savedHistory); } catch(e) { console.error('Historial corrupto en localStorage:', e); savedHistory = null; }
  try { if (typeof savedWeight === 'string') savedWeight = JSON.parse(savedWeight); } catch(e) { console.error('Peso corrupto en localStorage:', e); savedWeight = null; }
  try { if (typeof savedSettings === 'string') savedSettings = JSON.parse(savedSettings); } catch(e) { console.error('Configuración corrupta en localStorage:', e); savedSettings = null; }

  // Inicializar rutinas
  if (savedRoutines && savedRoutines.length > 0) {
    state.routines = savedRoutines;
  } else {
    state.routines = INITIAL_ROUTINES;
    saveLocalStorageOnly('routines');
  }

  // Inicializar historial de entrenamiento
  if (savedHistory) {
    state.history = savedHistory;
  } else {
    state.history = [];
  }

  // Inicializar historial de peso con los registros de la báscula InBody
  if (savedWeight) {
    state.weightHistory = savedWeight;
    
    // Limpieza automática de datos ficticios previos
    const originalLength = state.weightHistory.length;
    state.weightHistory = state.weightHistory.filter(w => !FAKE_WEIGHT_DATES.includes(w.date));
    
    if (state.weightHistory.length !== originalLength) {
      saveLocalStorageOnly('weight');
    }
  } else {
    state.weightHistory = INITIAL_WEIGHT_HISTORY;
    saveLocalStorageOnly('weight');
  }

  // Inicializar configuración
  if (savedSettings) {
    state.settings = savedSettings;
  }

  // Registros borrados (para que la sincronización no los resucite)
  try {
    state.deleted = mergeDeleted(JSON.parse(localStorage.getItem('kf_deleted')), null);
  } catch (e) {
    console.error('Borrados corruptos en localStorage:', e);
    state.deleted = emptyDeleted();
  }

  // Migración del plan de entrenamiento: al cambiar ROUTINES_VERSION se
  // sustituyen las rutinas guardadas (local y, después, en Firebase).
  if (state.settings.routinesVersion !== ROUTINES_VERSION) {
    state.routines = JSON.parse(JSON.stringify(INITIAL_ROUTINES));
    state.settings.routinesVersion = ROUTINES_VERSION;
    saveLocalStorageOnly('routines');
    saveLocalStorageOnly('settings');
  }
}

// Guardar solo en localStorage (sin red, para la carga inicial rápida).
// Las series de un entrenamiento en curso (_sessionPending) no se persisten
// hasta terminarlo, para que abortar o recargar no deje datos a medias.
function saveLocalStorageOnly(key) {
  if (key === 'routines' || !key) localStorage.setItem('kf_routines', JSON.stringify(state.routines));
  if (key === 'history' || !key) localStorage.setItem('kf_history', JSON.stringify(state.history.filter(l => !l._sessionPending)));
  if (key === 'weight' || !key) localStorage.setItem('kf_weight', JSON.stringify(state.weightHistory));
  if (key === 'settings' || !key) localStorage.setItem('kf_settings', JSON.stringify(state.settings));
  if (key === 'history' || key === 'weight' || !key) localStorage.setItem('kf_deleted', JSON.stringify(state.deleted));
}

// ==========================================
// SINCRONIZACIÓN CON FIREBASE (fusión, nunca sobrescritura)
// ==========================================

// Registros de báscula ficticios de versiones antiguas: se descartan siempre
const FAKE_WEIGHT_DATES = ["2026-04-27", "2026-05-11", "2026-05-25", "2026-06-08", "2026-06-22"];

// Identidad de una serie registrada: la misma serie en dos dispositivos
// produce la misma clave, así que la unión no duplica nada.
function historyLogKey(log) {
  return [log.sessionId || '', (log.date || '').slice(0, 10), log.routineId || '', log.exerciseId || '', log.setIndex || ''].join('|');
}

// Borrados: { weight: {fecha: momento}, history: {clave de serie: momento} }.
// Se sincronizan con la nube; sin ellos, la unión con la nube o con otro
// dispositivo volvería a traer lo que borraste.
function emptyDeleted() {
  return { weight: {}, history: {} };
}

function mergeDeleted(a, b) {
  const out = emptyDeleted();
  [a, b].forEach(src => ['weight', 'history'].forEach(kind => {
    Object.entries((src && src[kind]) || {}).forEach(([k, at]) => {
      if (!(out[kind][k] >= at)) out[kind][k] = at;
    });
  }));
  return out;
}

// Un registro sigue vivo si se guardó o se editó después de borrarlo
// (p. ej. vuelves a meter la báscula de un día que habías borrado)
function isAlive(deletedAt, rec) {
  return !(deletedAt >= (rec.updatedAt || 0));
}

// Une dos listas por clave: en un mismo registro gana el editado más tarde
// (updatedAt) y, si empatan, `primary`. Quita los borrados.
function mergeByKey(primary, secondary, keyOf, deletedMap) {
  const byKey = new Map();
  [...(secondary || []), ...(primary || [])].forEach(rec => {
    const key = keyOf(rec);
    if (key === null) return;
    const current = byKey.get(key);
    if (!current || (rec.updatedAt || 0) >= (current.updatedAt || 0)) byKey.set(key, rec);
  });
  return [...byKey.entries()]
    .filter(([key, rec]) => isAlive((deletedMap || {})[key], rec))
    .map(([, rec]) => rec);
}

// Une dos historiales de entrenamiento sin perder sesiones de ninguno
function mergeHistory(primary, secondary, deleted = state.deleted) {
  return mergeByKey(primary, secondary,
    log => (!log || log._sessionPending) ? null : historyLogKey(log),
    deleted && deleted.history)
    .sort((a, b) => (a.date || '').localeCompare(b.date || ''));
}

// Une dos historiales de báscula por fecha
function mergeWeightHistory(primary, secondary, deleted = state.deleted) {
  return mergeByKey(primary, secondary,
    rec => (!rec || !rec.date || FAKE_WEIGHT_DATES.includes(rec.date)) ? null : rec.date,
    deleted && deleted.weight)
    .sort((a, b) => a.date.localeCompare(b.date));
}

// Marca de "hay cambios locales sin subir": una corrección o un borrado hecho
// sin conexión no cambia cuántos registros hay, así que la sincronización no
// lo notaría solo comparando tamaños. Lleva la hora para no borrar la marca de
// un cambio posterior que aún no ha subido.
const CLOUD_DIRTY_KEY = 'kf_cloud_dirty';

function markCloudDirty() {
  localStorage.setItem(CLOUD_DIRTY_KEY, String(Date.now()));
}

function clearCloudDirty(mark) {
  if (localStorage.getItem(CLOUD_DIRTY_KEY) === mark) localStorage.removeItem(CLOUD_DIRTY_KEY);
}

// Último "Restablecer datos de fábrica" que este dispositivo ya ha aplicado
const RESET_SEEN_KEY = 'kf_reset_seen';

// Si los datos se restablecieron desde otro dispositivo (la nube lleva un
// resetAt más nuevo), vaciar el historial local antes de fusionar; si no, la
// fusión volvería a subir lo borrado. Devuelve true si ha vaciado algo.
function applyCloudReset(cloud) {
  const resetAt = Number(cloud && cloud.resetAt) || 0;
  const seen = Number(localStorage.getItem(RESET_SEEN_KEY)) || 0;
  if (resetAt <= seen) return false;
  state.history = state.history.filter(l => l._sessionPending);
  state.weightHistory = [];
  state.deleted = emptyDeleted();
  localStorage.setItem(RESET_SEEN_KEY, String(resetAt));
  return true;
}

// Estado de la sincronización, visible en Ajustes
let syncStatus = 'checking';

function setSyncStatus(status) {
  syncStatus = status;
  try { renderAccountPanel(); } catch (e) {}
}

function handleSyncError(error, context) {
  console.error(`Error de sincronización (${context}):`, error);
  setSyncStatus(error && error.code === 'permission-denied' ? 'needs-login' : 'error');
}

// Espera a que Firebase (y el estado de la sesión de Google) estén listos
async function waitForFirebase() {
  let retries = 0;
  while (!window.firebaseDb && retries < 30) {
    await new Promise(r => setTimeout(r, 100));
    retries++;
  }
  if (!window.firebaseDb) return false;
  if (window.firebaseAuthReady) {
    // Sin red, la sesión puede tardar: no bloquear más de 4 s
    await Promise.race([window.firebaseAuthReady, new Promise(r => setTimeout(r, 4000))]);
  }
  return true;
}

function getCloudDocRef() {
  return window.firebaseDoc(window.firebaseDb, "users", "defaultUser");
}

// SINCRONIZACIÓN EN SEGUNDO PLANO: Descarga datos de Firebase sin bloquear UI
async function syncFromFirebaseInBackground() {
  try {
    if (!(await waitForFirebase())) {
      console.log('Firebase no disponible, usando solo datos locales.');
      setSyncStatus('offline');
      return;
    }

    const docRef = getCloudDocRef();
    const docSnap = await window.firebaseGetDoc(docRef);

    if (!docSnap.exists()) {
      // Primera vez: no existe documento en la nube → publicar todo lo local
      await saveStateToStorage();
      return;
    }

    const data = docSnap.data();
    let needsRefresh = applyCloudReset(data);
    const cloudVersion = (data.settings && data.settings.routinesVersion) || 0;
    const localVersion = state.settings.routinesVersion || 0;

    // Rutinas: gana el plan de versión más alta. Si el local es más nuevo
    // (p. ej. tras una actualización del plan), se sube a la nube.
    if (cloudVersion > localVersion) {
      if (data.routines && data.routines.length > 0) {
        state.routines = data.routines;
        saveLocalStorageOnly('routines');
        needsRefresh = true;
      }
      if (data.settings) {
        // Adoptar el plan de la nube, pero conservar las preferencias locales
        // (sonido, alertas, altura son propias de cada dispositivo) y fijar la
        // versión de la nube para no volver a subir el plan antiguo.
        state.settings = Object.assign({}, data.settings, state.settings, {
          routinesVersion: cloudVersion
        });
        saveLocalStorageOnly('settings');
      }
    } else if (data.settings) {
      // Misma versión o local más nueva: conservar preferencias locales
      state.settings = Object.assign({}, data.settings, state.settings);
      saveLocalStorageOnly('settings');
    }

    // Historial y báscula: unión de nube + dispositivo (nunca "gana el más
    // largo"), respetando lo borrado en cualquiera de los dos
    state.deleted = mergeDeleted(state.deleted, data.deleted);
    const pending = state.history.filter(l => l._sessionPending);
    const localHistory = state.history.filter(l => !l._sessionPending);
    const mergedHistory = mergeHistory(localHistory, data.history);
    const mergedWeight = mergeWeightHistory(state.weightHistory, data.weight);

    if (JSON.stringify(mergedHistory) !== JSON.stringify(localHistory)) needsRefresh = true;
    if (JSON.stringify(mergedWeight) !== JSON.stringify(state.weightHistory)) needsRefresh = true;

    state.history = mergedHistory.concat(pending);
    state.weightHistory = mergedWeight;
    saveLocalStorageOnly('history');
    saveLocalStorageOnly('weight');

    // Si este dispositivo tenía algo que la nube no (o cambios sin subir), subirlo
    const dirtyMark = localStorage.getItem(CLOUD_DIRTY_KEY);
    const cloudMissingData =
      !!dirtyMark ||
      mergedHistory.length !== (data.history || []).length ||
      mergedWeight.length !== (data.weight || []).length ||
      cloudVersion < localVersion;
    if (cloudMissingData) {
      await window.firebaseSetDoc(docRef, {
        routines: state.routines,
        history: mergedHistory,
        weight: mergedWeight,
        settings: state.settings,
        deleted: state.deleted
      }, { merge: true });
      clearCloudDirty(dirtyMark);
    }

    setSyncStatus('synced');

    // Si hubo cambios desde Firebase, re-renderizar las vistas silenciosamente
    if (needsRefresh) {
      console.log('Datos actualizados desde Firebase en segundo plano.');
      try { renderWorkoutsList(); } catch(e) {}
      try { updateDashboard(); } catch(e) {}
      try { if (state.activeTab !== 'dashboard' && state.activeTab !== 'workouts') switchTab(state.activeTab); } catch(e) {}
    }
  } catch (error) {
    handleSyncError(error, 'descarga');
  }
}

// Guardado de datos: local inmediato y, en la nube, fusionando con lo que ya
// haya allí (otro dispositivo puede haber guardado sesiones mientras tanto).
async function saveStateToStorage(key) {
  saveLocalStorageOnly(key);
  markCloudDirty();
  const dirtyMark = localStorage.getItem(CLOUD_DIRTY_KEY);

  try {
    if (!window.firebaseDb) return;
    const docRef = getCloudDocRef();
    const snap = await window.firebaseGetDoc(docRef);
    const cloud = snap.exists() ? snap.data() : {};
    applyCloudReset(cloud);

    state.deleted = mergeDeleted(state.deleted, cloud.deleted);
    const pending = state.history.filter(l => l._sessionPending);
    const history = mergeHistory(state.history, cloud.history);
    const weight = mergeWeightHistory(state.weightHistory, cloud.weight);

    state.history = history.concat(pending);
    state.weightHistory = weight;
    saveLocalStorageOnly('history');
    saveLocalStorageOnly('weight');

    await window.firebaseSetDoc(docRef, {
      routines: state.routines,
      history,
      weight,
      settings: state.settings,
      deleted: state.deleted
    }, { merge: true });
    clearCloudDirty(dirtyMark);
    setSyncStatus('synced');
  } catch (error) {
    handleSyncError(error, 'guardado');
  }
}

// Configuración de la navegación (SPA)
function setupNavigation() {
  const navButtons = document.querySelectorAll('.nav-item button, .mobile-nav-item');
  
  navButtons.forEach(btn => {
    // Handler compartido para click y touchend
    const handleNavAction = (e) => {
      e.preventDefault();
      e.stopPropagation();
      const tabId = btn.getAttribute('data-tab');
      if (tabId) {
        switchTab(tabId);
      }
    };

    btn.addEventListener('click', handleNavAction);
  });
}

function switchTab(tabId) {
  state.activeTab = tabId;
  
  // Actualizar clases activas en navegación lateral
  document.querySelectorAll('.nav-item').forEach(li => {
    const btn = li.querySelector('button');
    if (btn && btn.getAttribute('data-tab') === tabId) {
      li.classList.add('active');
    } else {
      li.classList.remove('active');
    }
  });

  // Actualizar navegación móvil
  document.querySelectorAll('.mobile-nav-item').forEach(btn => {
    if (btn.getAttribute('data-tab') === tabId) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  // Alternar visibilidad de las vistas
  document.querySelectorAll('.page-view').forEach(view => {
    if (view.id === `${tabId}-view`) {
      view.classList.add('active');
    } else {
      view.classList.remove('active');
    }
  });

  // Scroll al inicio de la página (importante para móvil)
  try {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    // También desplazar el contenedor principal si existe
    const mainContent = document.querySelector('.main-content');
    if (mainContent && typeof mainContent.scrollTo === 'function') {
      mainContent.scrollTo({ top: 0, behavior: 'smooth' });
    }
  } catch(e) {
    // Fallback para navegadores móviles antiguos (ej. iOS Safari antiguo)
    window.scrollTo(0, 0);
  }

  // Cargar lógica específica de cada vista — con protección contra errores
  // para que un fallo en un panel nunca bloquee la navegación
  try {
    if (tabId === 'dashboard') {
      updateDashboard();
    } else if (tabId === 'workouts') {
      renderWorkoutsList();
    } else if (tabId === 'metrics') {
      renderMetricsPanel();
    } else if (tabId === 'reports') {
      renderReportsPanel();
    } else if (tabId === 'settings') {
      renderSettingsPanel();
    } else if (tabId === 'calendar') { renderCalendar(); }
  } catch (err) {
    console.error(`Error al renderizar la vista '${tabId}':`, err);
  }
}

// Configurar listeners de clicks y envíos de formularios generales
function setupEventListeners() {
  const prevBtn = document.getElementById('cal-prev-month');
  const nextBtn = document.getElementById('cal-next-month');
  if (prevBtn) prevBtn.addEventListener('click', () => {
    currentMonth--;
    if (currentMonth < 0) { currentMonth = 11; currentYear--; }
    renderCalendar();
  });
  if (nextBtn) nextBtn.addEventListener('click', () => {
    currentMonth++;
    if (currentMonth > 11) { currentMonth = 0; currentYear++; }
    renderCalendar();
  });
  // Guardar Peso Corporal e InBody
  const weightForm = document.getElementById('weight-logger-form');
  if (weightForm) {
    weightForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const weightVal = parseFloat(document.getElementById('input-body-weight').value);
      const fatVal = parseFloat(document.getElementById('input-body-fat').value) || null;
      const bmiVal = parseFloat(document.getElementById('input-body-bmi').value) || null;
      const muscleVal = parseFloat(document.getElementById('input-body-muscle').value) || null;
      const leanVal = parseFloat(document.getElementById('input-body-lean').value) || null;
      const visceralVal = parseInt(document.getElementById('input-body-visceral').value) || null;
      const waterVal = parseFloat(document.getElementById('input-body-water').value) || null;
      const ageVal = parseInt(document.getElementById('input-body-age').value) || null;
      const dateVal = document.getElementById('input-weight-date').value;

      if (weightVal && dateVal) {
        addWeightRecord(dateVal, weightVal, fatVal, bmiVal, muscleVal, leanVal, visceralVal, waterVal, ageVal);
        // Si al editar cambiaste la fecha, el registro de la fecha antigua sobra
        if (editingWeightDate && editingWeightDate !== dateVal) deleteWeightRecord(editingWeightDate, false);
        cancelWeightEdit();
        renderMetricsPanel();
        updateDashboard();
      }
    });
  }

  // Notificaciones Test
  const testNotifyBtn = document.getElementById('btn-test-notification');
  if (testNotifyBtn) {
    testNotifyBtn.addEventListener('click', () => {
      requestAndTestNotifications();
    });
  }

  // Configuración Guardar
  const settingsForm = document.getElementById('settings-form');
  if (settingsForm) {
    settingsForm.addEventListener('submit', (e) => {
      e.preventDefault();
      saveAppSettings();
    });
  }

  // Exportación CSV
  const btnExport = document.getElementById('btn-export-csv');
  if (btnExport) {
    btnExport.addEventListener('click', () => {
      exportDataToCSV();
    });
  }
}

// ==========================================
// 1. LÓGICA DEL DASHBOARD
// ==========================================

function updateDashboard() {
  // 1. Racha de entrenamientos (workouts en días seguidos)
  const streak = calculateWorkoutStreak();
  document.getElementById('widget-streak').textContent = `${streak.weeks} ${streak.weeks === 1 ? 'semana' : 'semanas'}`;
  document.getElementById('widget-streak-sub').textContent = `Esta semana: ${streak.thisWeekDays}/${streak.target} días`;

  // 2. Entrenamientos completados totales
  const totalCompleted = calculateTotalWorkouts();
  document.getElementById('widget-total-workouts').textContent = totalCompleted;

  // 3. Peso actual vs Peso inicial
  const weightStats = getWeightStats();
  const weightDiff = weightStats.start - weightStats.current;
  
  document.getElementById('widget-current-weight').textContent = `${weightStats.current.toFixed(1)} kg`;
  
  const lossIndicator = document.getElementById('weight-loss-indicator');
  if (weightDiff > 0) {
    lossIndicator.innerHTML = `⬇️ Has bajado <span class="accent-color" style="color: var(--primary); font-weight: bold;">${weightDiff.toFixed(1)} kg</span>`;
  } else if (weightDiff < 0) {
    lossIndicator.innerHTML = `⚠️ Variación de +${Math.abs(weightDiff).toFixed(1)} kg`;
  } else {
    lossIndicator.textContent = `Punto de partida registrado.`;
  }

  // 4. Frase motivadora diaria
  const quoteIndex = new Date().getDate() % GYM_MOTIVATIONS.length;
  document.getElementById('quote-text').textContent = `"${GYM_MOTIVATIONS[quoteIndex]}"`;

  // 5. Comparativa motivacional InBody
  updateInBodyMotivation(weightDiff);

  // 6. Siguiente entrenamiento
  setupNextWorkoutCard();
}

// Clave "AAAA-MM-DD" del lunes de la semana de una fecha
function getWeekStartKey(dateStr) {
  const [y, m, d] = String(dateStr).slice(0, 10).split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() - ((dt.getDay() + 6) % 7));
  return getLocalDateString(dt);
}

function shiftWeekKey(weekKey, weeks) {
  const [y, m, d] = weekKey.split('-').map(Number);
  return getLocalDateString(new Date(y, m - 1, d + 7 * weeks));
}

// Racha en semanas: cuenta semanas seguidas en las que cumpliste tus días de
// entrenamiento (Ajustes). La semana en curso no rompe la racha hasta que acabe.
function calculateWorkoutStreak() {
  const target = Math.max(1, (state.settings.scheduleDays || []).length);
  const perWeek = {};
  new Set(state.history.filter(h => !isExtraCardio(h)).map(h => (h.date || '').slice(0, 10)).filter(Boolean)).forEach(day => {
    const key = getWeekStartKey(day);
    perWeek[key] = (perWeek[key] || 0) + 1;
  });

  const thisWeek = getWeekStartKey(getLocalDateString());
  const thisWeekDays = perWeek[thisWeek] || 0;
  let cursor = thisWeekDays >= target ? thisWeek : shiftWeekKey(thisWeek, -1);
  let weeks = 0;
  while ((perWeek[cursor] || 0) >= target) {
    weeks++;
    cursor = shiftWeekKey(cursor, -1);
  }
  return { weeks, thisWeekDays, target };
}

// Inicio del plan actual: la fecha puesta en Ajustes o, si no hay, el primer
// entreno registrado desde que el plan llegó a la app (PLAN_RELEASE_DATE).
// Se calcula del historial en vez de guardarse, para que los entrenos del
// plan antiguo no adelanten las semanas.
function getPlanStartDate() {
  if (state.settings.planStart) return state.settings.planStart;
  return state.history
    .filter(h => !isExtraCardio(h) && !h._sessionPending)
    .map(h => (h.date || '').slice(0, 10))
    .filter(d => d >= PLAN_RELEASE_DATE)
    .sort()[0] || null;
}

// Semanas completas desde el inicio del plan actual (para pasar a 3 series)
function weeksSincePlanStart() {
  const start = getPlanStartDate();
  if (!start) return 0;
  const days = (Date.parse(getLocalDateString()) - Date.parse(start)) / 86400000;
  return Math.max(0, Math.floor(days / 7));
}

function calculateTotalWorkouts() {
  // Cada sesión completada lleva su propio sessionId, así que dos sesiones el
  // mismo día (mismo routineId) cuentan como dos entrenamientos. Los registros
  // antiguos, sin sessionId, se agrupan por fecha + rutina como antes.
  const uniqueWorkouts = {};
  state.history.filter(log => !isExtraCardio(log)).forEach(log => {
    const key = log.sessionId
      ? `s_${log.sessionId}`
      : `${log.date}_${log.routineId || 'default'}`;
    uniqueWorkouts[key] = true;
  });
  return Object.keys(uniqueWorkouts).length;
}

function getWeightStats() {
  if (state.weightHistory.length === 0) {
    return { start: 148.0, current: 148.0 };
  }
  
  const sorted = [...state.weightHistory].sort((a,b) => new Date(a.date) - new Date(b.date));
  const start = sorted[0].weight;
  const current = sorted[sorted.length - 1].weight;
  
  return { start, current };
}

function updateInBodyMotivation(weightDiff) {
  const container = document.getElementById('motivation-card-container');
  if (!container) return;

  if (weightDiff <= 0) {
    container.innerHTML = `
      <div class="motivation-desc">
        <strong>Punto de partida: 148 kg.</strong> La báscula no define quién eres, sino desde dónde empiezas. Tu entrenamiento de hoy te ayudará a ganar movilidad y fuerza. ¡Vence a la pereza!
      </div>
    `;
    return;
  }

  // Buscar el hito más cercano superado
  let milestone = WEIGHT_LOSS_MILESTONES[0];
  for (let i = WEIGHT_LOSS_MILESTONES.length - 1; i >= 0; i--) {
    if (weightDiff >= WEIGHT_LOSS_MILESTONES[i].loss) {
      milestone = WEIGHT_LOSS_MILESTONES[i];
      break;
    }
  }

  container.innerHTML = `
    <div class="motivation-content">
      <h3>🚀 Hito de Peso Superado (-${weightDiff.toFixed(1)} kg)</h3>
      <p class="motivation-desc">${milestone.desc}</p>
    </div>
  `;
}

function setupNextWorkoutCard() {
  const cardTitle = document.getElementById('next-workout-title');
  const cardDetails = document.getElementById('next-workout-details');
  const cardBtn = document.getElementById('next-workout-btn');

  if (state.routines.length === 0) {
    cardTitle.textContent = "Sin Rutinas";
    cardDetails.textContent = "Crea una rutina en el panel de configuración.";
    cardBtn.style.display = 'none';
    return;
  }

  // Determinar cuál es el siguiente día a entrenar basado en el historial
  // Si el último completado fue Día 1, toca el Día 2. Si fue el Día 2, toca el Día 3, etc.
  let nextRoutine = state.routines[0];
  
  const workoutLogs = state.history.filter(l => !isExtraCardio(l));
  if (workoutLogs.length > 0) {
    // Buscar el último log
    const lastLogs = [...workoutLogs].sort((a, b) => new Date(b.date) - new Date(a.date));
    const lastRoutineId = lastLogs[0].routineId;
    const currentIndex = state.routines.findIndex(r => r.id === lastRoutineId);
    
    if (currentIndex !== -1 && currentIndex < state.routines.length - 1) {
      nextRoutine = state.routines[currentIndex + 1];
    } else {
      nextRoutine = state.routines[0];
    }
  }

  cardTitle.textContent = nextRoutine.name;
  cardDetails.innerHTML = `
    <div>Enfoque: ${nextRoutine.muscles}</div>
    <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 0.3rem;">Consta de ${nextRoutine.exercises.length} ejercicios</div>
  `;

  // Cambiar acción del botón
  cardBtn.onclick = () => {
    startWorkoutSession(nextRoutine.id);
  };
}

// ==========================================
// 2. MÓDULO RUTA DE ENTRENAMIENTOS (VISTA DE RUTINA)
// ==========================================

function renderWorkoutsList() {
  const container = document.getElementById('routines-cards-container');
  if (!container) return;

  // Restaurar visibilidad si no hay entrenamiento activo
  if (!state.currentWorkout) {
    const selArea = document.getElementById('routines-selection-area');
    const focArea = document.getElementById('workout-focus-area');
    if(selArea) selArea.style.display = 'block';
    if(focArea) focArea.style.display = 'none';
  }

  container.innerHTML = '';
  
  state.routines.forEach(routine => {
    const card = document.createElement('div');
    card.className = 'card routine-card';
    
    const exercisesList = routine.exercises.slice(0, 4).map(e => `<li>${e.name} (${e.sets}x${e.reps})</li>`).join('');
    const extraCount = routine.exercises.length - 4;
    const extraText = extraCount > 0 ? `<li>Y ${extraCount} ejercicios más...</li>` : '';

    card.innerHTML = `
      <div class="today-workout-header">
        <h3 class="workout-name">${routine.name}</h3>
        <div class="workout-stats-short">💪 ${routine.muscles}</div>
      </div>
      <ul class="routine-exercises-preview">
        ${exercisesList}
        ${extraText}
      </ul>
      <div style="margin-top: 1.5rem;">
        <button class="btn btn-primary" onclick="startWorkoutSession('${routine.id}')" style="width: 100%;">
          <svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg> Empezar Entrenamiento
        </button>
      </div>
    `;
    container.appendChild(card);
  });
}

// ==========================================
// 3. MODO ENTRENAMIENTO ACTIVO (MODO ENFOQUE)
// ==========================================

function startWorkoutSession(routineId) {
  const routine = state.routines.find(r => r.id === routineId);
  if (!routine) return;

  // Un entreno a medias (en pantalla o guardado) se descarta antes de empezar
  // otro; si no, sus series pendientes acabarían dentro de la sesión nueva.
  if (state.currentWorkout || loadSavedWorkout()) {
    if (!confirm('Tienes un entrenamiento a medias. ¿Descartarlo y empezar este?')) return;
    discardSavedWorkout();
  }

  // Inicializar estado del entrenamiento actual
  state.currentWorkout = {
    routineId: routineId,
    routineName: routine.name,
    sessionId: Date.now(),
    exercises: JSON.parse(JSON.stringify(routine.exercises)), // copia profunda
    currentIndex: 0
  };

  // Ejercicios principales: 3 series a partir de la semana 3 del plan (PDF)
  if (weeksSincePlanStart() >= 2) {
    state.currentWorkout.exercises.forEach(e => { if (e.maxSets) e.sets = e.maxSets; });
  }

  showWorkoutFocusArea();
  renderActiveExercise();
  acquireWakeLock();
}

// Cambia a la vista de entrenar con el panel del ejercicio en curso
function showWorkoutFocusArea() {
  switchTab('workouts');
  document.getElementById('routines-selection-area').style.display = 'none';
  document.getElementById('workout-focus-area').style.display = 'block';
}

// ==========================================
// ENTRENO EN CURSO: se guarda aparte para poder reanudarlo
// ==========================================
// Si el móvil cierra la pestaña a mitad del entreno (pasa al cambiar de app o
// con la pantalla bloqueada), se recupera el punto exacto: ejercicio, series ya
// hechas y lo que llevabas escrito. Va en una clave propia y no en kf_history
// para que abortar no deje series a medias en el historial.
const ACTIVE_WORKOUT_KEY = 'kf_active_workout';

// Valores escritos en las series del ejercicio en pantalla
function readSetDraft() {
  const rows = Array.from(document.querySelectorAll('#active-sets-grid .set-row'));
  return {
    exerciseIndex: state.currentWorkout ? state.currentWorkout.currentIndex : -1,
    sets: rows.map(r => ({
      weight: r.querySelector('.weight-input').value,
      reps: r.querySelector('.reps-input').value,
      done: r.querySelector('.set-checkbox').checked
    })),
    difficulty: document.querySelector('.difficulty-btn.selected')?.getAttribute('data-diff') || 'adecuado'
  };
}

function applySetDraft(draft) {
  if (!draft || !state.currentWorkout || draft.exerciseIndex !== state.currentWorkout.currentIndex) return;
  const rows = Array.from(document.querySelectorAll('#active-sets-grid .set-row'));
  (draft.sets || []).forEach((s, i) => {
    const row = rows[i];
    if (!row) return;
    row.querySelector('.weight-input').value = s.weight;
    row.querySelector('.reps-input').value = s.reps;
    row.querySelector('.set-checkbox').checked = !!s.done;
    row.classList.toggle('completed', !!s.done);
  });
  rows.forEach(r => r.classList.remove('active'));
  const next = rows.find(r => !r.classList.contains('completed'));
  if (next) next.classList.add('active');
  if (['facil', 'adecuado', 'duro'].includes(draft.difficulty)) selectDifficulty(draft.difficulty);
}

function persistActiveWorkout() {
  if (!state.currentWorkout) return;
  try {
    localStorage.setItem(ACTIVE_WORKOUT_KEY, JSON.stringify({
      workout: state.currentWorkout,
      pending: state.history.filter(l => l._sessionPending),
      draft: readSetDraft(),
      savedAt: Date.now()
    }));
  } catch (e) {
    console.error('No se pudo guardar el entreno en curso:', e);
  }
}

function loadSavedWorkout() {
  try {
    const saved = JSON.parse(localStorage.getItem(ACTIVE_WORKOUT_KEY));
    return saved && saved.workout && Array.isArray(saved.workout.exercises) ? saved : null;
  } catch (e) {
    return null;
  }
}

function clearSavedWorkout() {
  localStorage.removeItem(ACTIVE_WORKOUT_KEY);
}

function hideResumeBar() {
  const bar = document.getElementById('resume-bar');
  if (bar) bar.style.display = 'none';
}

// Al abrir la app: si quedó un entreno a medias, ofrecer reanudarlo
function offerResumeWorkout() {
  const saved = loadSavedWorkout();
  const bar = document.getElementById('resume-bar');
  const text = document.getElementById('resume-bar-text');
  if (!saved || !bar || !text || state.currentWorkout) return;

  const w = saved.workout;
  const savedDay = getLocalDateString(new Date(saved.savedAt || Date.now()));
  const when = savedDay === getLocalDateString() ? '' : ` (del ${formatDateString(savedDay)})`;
  text.textContent = `⏸️ Tienes a medias «${w.routineName}»${when}: ejercicio ${w.currentIndex + 1} de ${w.exercises.length}.`;
  bar.style.display = 'flex';
}

function resumeSavedWorkout() {
  const saved = loadSavedWorkout();
  hideResumeBar();
  if (!saved) return;

  state.currentWorkout = saved.workout;
  state.history = state.history
    .filter(l => !l._sessionPending)
    .concat((saved.pending || []).map(l => Object.assign({}, l, { _sessionPending: true })));

  showWorkoutFocusArea();
  renderActiveExercise();
  applySetDraft(saved.draft);
  persistActiveWorkout();
  acquireWakeLock();
}

// Tira el entreno a medias (series pendientes incluidas)
function discardSavedWorkout() {
  state.history = state.history.filter(l => !l._sessionPending);
  state.currentWorkout = null;
  clearSavedWorkout();
  hideResumeBar();
  stopRestTimer();
  releaseWakeLock();
}

function discardSavedWorkoutFromBar() {
  if (!confirm('¿Descartar el entreno a medias? Se perderán las series de esa sesión.')) return;
  discardSavedWorkout();
}

// Pantalla encendida durante el entreno (el navegador la suelta al ocultar la
// pestaña, así que se vuelve a pedir al volver a ella)
let wakeLock = null;

async function acquireWakeLock() {
  if (!('wakeLock' in navigator) || !state.currentWorkout) return;
  try {
    wakeLock = await navigator.wakeLock.request('screen');
  } catch (e) {
    console.warn('No se pudo mantener la pantalla encendida:', e);
  }
}

function releaseWakeLock() {
  if (wakeLock) {
    wakeLock.release().catch(() => {});
    wakeLock = null;
  }
}

document.addEventListener('visibilitychange', () => {
  if (!state.currentWorkout) return;
  if (document.visibilityState === 'hidden') persistActiveWorkout();
  else acquireWakeLock();
});

function renderActiveExercise() {
  const workout = state.currentWorkout;
  const exercise = workout.exercises[workout.currentIndex];
  
  // Actualizar barra de progreso
  const progressPercent = (workout.currentIndex / workout.exercises.length) * 100;
  document.getElementById('workout-active-progress').style.width = `${progressPercent}%`;

  // Encabezados
  document.getElementById('active-routine-name').textContent = workout.routineName;
  document.getElementById('active-exercise-title').textContent = exercise.name;
  
  const muscleNames = {
    'back': 'Espalda',
    'biceps': 'Bíceps',
    'triceps': 'Tríceps',
    'chest': 'Pectoral',
    'shoulders': 'Hombros',
    'legs': 'Piernas',
    'cardio': 'Cardio'
  };
  const muscleSpan = `<span class="muscle-badge-${exercise.muscle}" style="margin-left:0.5rem; font-size:0.75rem; text-transform:uppercase; padding:0.15rem 0.5rem; border-radius:4px; font-weight:700;">${muscleNames[exercise.muscle] || exercise.muscle}</span>`;
  
  document.getElementById('active-exercise-meta').innerHTML = `
    Ejercicio ${workout.currentIndex + 1} de ${workout.exercises.length} &bull; ${exercise.sets} Series de ${exercise.reps} Reps &bull; ${muscleSpan}
  `;

  const targetRepsEl = document.getElementById('exercise-target-reps');
  if (targetRepsEl) {
    targetRepsEl.textContent = `Meta: ${exercise.sets} × ${exercise.reps}`;
  }

  // Cargar animación deportiva (GIF) que demuestra los pasos del movimiento en tiempo real
  const videoWrapper = document.getElementById('active-video-container');
  
  const illustrations = {
    // Día 1
    'jalon_nuca': 'https://cdn.jsdelivr.net/gh/JahelCuadrado/ExerciseGymGifsDB@v1.1.0/lats/cable-pulldown.gif',
    'biceps_polea': 'https://cdn.jsdelivr.net/gh/JahelCuadrado/ExerciseGymGifsDB@v1.1.0/biceps/cable-curl.gif',
    'curl_martillo': 'https://cdn.jsdelivr.net/gh/JahelCuadrado/ExerciseGymGifsDB@v1.1.0/biceps/dumbbell-hammer-curl.gif',
    'remo_polea': 'https://cdn.jsdelivr.net/gh/JahelCuadrado/ExerciseGymGifsDB@v1.1.0/upper-back/cable-seated-row.gif',
    'extension_cuadriceps': 'https://cdn.jsdelivr.net/gh/JahelCuadrado/ExerciseGymGifsDB@v1.1.0/quads/lever-leg-extension.gif',
    
    // Día 2
    'press_pecho': 'https://cdn.jsdelivr.net/gh/JahelCuadrado/ExerciseGymGifsDB@v1.1.0/pectorals/lever-chest-press.gif',
    'triceps_polea': 'https://cdn.jsdelivr.net/gh/JahelCuadrado/ExerciseGymGifsDB@v1.1.0/triceps/cable-pushdown.gif',
    'jalon_pecho': 'https://cdn.jsdelivr.net/gh/JahelCuadrado/ExerciseGymGifsDB@v1.1.0/lats/cable-pulldown.gif',
    'curl_piernas': 'https://cdn.jsdelivr.net/gh/JahelCuadrado/ExerciseGymGifsDB@v1.1.0/hamstrings/lever-lying-leg-curl.gif',
    
    // Día 3
    'press_hombros': 'https://cdn.jsdelivr.net/gh/JahelCuadrado/ExerciseGymGifsDB@v1.1.0/delts/dumbbell-seated-shoulder-press.gif',
    'elevaciones_laterales': 'https://cdn.jsdelivr.net/gh/JahelCuadrado/ExerciseGymGifsDB@v1.1.0/delts/dumbbell-lateral-raise.gif',
    'aductores': 'https://cdn.jsdelivr.net/gh/JahelCuadrado/ExerciseGymGifsDB@v1.1.0/adductors/lever-seated-hip-adduction.gif',
    'abductores': 'https://cdn.jsdelivr.net/gh/JahelCuadrado/ExerciseGymGifsDB@v1.1.0/abductors/lever-seated-hip-abduction.gif',

    // Plan de retorno al entrenamiento (Joel Cabado)
    'prensa_piernas': 'https://cdn.jsdelivr.net/gh/JahelCuadrado/ExerciseGymGifsDB@v1.1.0/quads/lever-alternate-leg-press.gif',
    'remo_sentado_maquina': 'https://cdn.jsdelivr.net/gh/JahelCuadrado/ExerciseGymGifsDB@v1.1.0/upper-back/lever-seated-row.gif',
    'press_pecho_maquina': 'https://cdn.jsdelivr.net/gh/JahelCuadrado/ExerciseGymGifsDB@v1.1.0/pectorals/lever-chest-press.gif',
    'curl_femoral': 'https://cdn.jsdelivr.net/gh/JahelCuadrado/ExerciseGymGifsDB@v1.1.0/hamstrings/lever-seated-leg-curl.gif',
    'jalon_neutro': 'https://cdn.jsdelivr.net/gh/JahelCuadrado/ExerciseGymGifsDB@v1.1.0/lats/twin-handle-parallel-grip-lat-pulldown.gif',
    'abduccion_cadera': 'https://cdn.jsdelivr.net/gh/JahelCuadrado/ExerciseGymGifsDB@v1.1.0/abductors/lever-seated-hip-abduction.gif',
    'extension_rodilla': 'https://cdn.jsdelivr.net/gh/JahelCuadrado/ExerciseGymGifsDB@v1.1.0/quads/lever-leg-extension.gif',
    'press_inclinado_maquina': 'https://cdn.jsdelivr.net/gh/JahelCuadrado/ExerciseGymGifsDB@v1.1.0/pectorals/lever-incline-chest-press.gif',
    'remo_apoyo_pecho': 'https://cdn.jsdelivr.net/gh/JahelCuadrado/ExerciseGymGifsDB@v1.1.0/upper-back/lever-high-row.gif',
    'biceps_polea': 'https://cdn.jsdelivr.net/gh/JahelCuadrado/ExerciseGymGifsDB@v1.1.0/biceps/cable-curl.gif',
    'triceps_polea': 'https://cdn.jsdelivr.net/gh/JahelCuadrado/ExerciseGymGifsDB@v1.1.0/triceps/cable-pushdown.gif',
    'extension_cadera': 'https://cdn.jsdelivr.net/gh/JahelCuadrado/ExerciseGymGifsDB@v1.1.0/glutes/lever-hip-extension-v-2.gif',
    'face_pull': 'https://cdn.jsdelivr.net/gh/JahelCuadrado/ExerciseGymGifsDB@v1.1.0/delts/cable-rear-delt-row-with-rope.gif',
    'gemelos_maquina': 'https://cdn.jsdelivr.net/gh/JahelCuadrado/ExerciseGymGifsDB@v1.1.0/calves/lever-seated-calf-raise.gif',
    'cardio_bici': 'https://cdn.jsdelivr.net/gh/JahelCuadrado/ExerciseGymGifsDB@v1.1.0/cardio/stationary-bike-walk.gif',
    'cardio_cinta': 'https://cdn.jsdelivr.net/gh/JahelCuadrado/ExerciseGymGifsDB@v1.1.0/cardio/walking-on-incline-treadmill.gif',
    // Variantes de día (mismo ejercicio, progresión independiente por sesión)
    'prensa_piernas_dia3': 'https://cdn.jsdelivr.net/gh/JahelCuadrado/ExerciseGymGifsDB@v1.1.0/quads/lever-alternate-leg-press.gif',
    'jalon_neutro_dia3': 'https://cdn.jsdelivr.net/gh/JahelCuadrado/ExerciseGymGifsDB@v1.1.0/lats/twin-handle-parallel-grip-lat-pulldown.gif',
    'press_pecho_maquina_dia3': 'https://cdn.jsdelivr.net/gh/JahelCuadrado/ExerciseGymGifsDB@v1.1.0/pectorals/lever-chest-press.gif',
    'curl_femoral_dia2': 'https://cdn.jsdelivr.net/gh/JahelCuadrado/ExerciseGymGifsDB@v1.1.0/hamstrings/lever-seated-leg-curl.gif',
    'cardio_bici_dia2': 'https://cdn.jsdelivr.net/gh/JahelCuadrado/ExerciseGymGifsDB@v1.1.0/cardio/stationary-bike-walk.gif',

    // Fallbacks por grupos musculares
    'back': 'https://cdn.jsdelivr.net/gh/JahelCuadrado/ExerciseGymGifsDB@v1.1.0/upper-back/cable-seated-row.gif',
    'biceps': 'https://cdn.jsdelivr.net/gh/JahelCuadrado/ExerciseGymGifsDB@v1.1.0/biceps/dumbbell-biceps-curl.gif',
    'triceps': 'https://cdn.jsdelivr.net/gh/JahelCuadrado/ExerciseGymGifsDB@v1.1.0/triceps/cable-pushdown.gif',
    'chest': 'https://cdn.jsdelivr.net/gh/JahelCuadrado/ExerciseGymGifsDB@v1.1.0/pectorals/barbell-bench-press.gif',
    'shoulders': 'https://cdn.jsdelivr.net/gh/JahelCuadrado/ExerciseGymGifsDB@v1.1.0/delts/dumbbell-lateral-raise.gif',
    'legs': 'https://cdn.jsdelivr.net/gh/JahelCuadrado/ExerciseGymGifsDB@v1.1.0/quads/lever-leg-extension.gif',
    'cardio': 'https://cdn.jsdelivr.net/gh/JahelCuadrado/ExerciseGymGifsDB@v1.1.0/cardio/walking-on-incline-treadmill.gif'
  };

  const gifUrl = illustrations[exercise.id] || illustrations[exercise.muscle] || '';

  // Configurar imágenes de respaldo en Unsplash adaptadas a cada grupo muscular
  const muscleImages = {
    'back': 'https://images.unsplash.com/photo-1605296867304-46d5465a25f1?q=80&w=600&auto=format&fit=crop',
    'biceps': 'https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?q=80&w=600&auto=format&fit=crop',
    'triceps': 'https://images.unsplash.com/photo-1530822847156-5df684ec5ee1?q=80&w=600&auto=format&fit=crop',
    'chest': 'https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?q=80&w=600&auto=format&fit=crop',
    'shoulders': 'https://images.unsplash.com/photo-1541534741688-6078c6bfb5c5?q=80&w=600&auto=format&fit=crop',
    'legs': 'https://images.unsplash.com/photo-1574680096145-d05b474e2155?q=80&w=600&auto=format&fit=crop',
    'cardio': 'https://images.unsplash.com/photo-1538805060514-97d9cc17730c?q=80&w=600&auto=format&fit=crop'
  };
  const fallbackUrl = muscleImages[exercise.muscle] || 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?q=80&w=600&auto=format&fit=crop';

  if (gifUrl) {
    videoWrapper.innerHTML = `
      <div class="video-cover-card" style="cursor: default; padding: 0; background: #ffffff; border: 1px solid var(--border-color);">
        <img src="${gifUrl}" alt="${exercise.name}" style="width:100%; height:100%; object-fit:contain;" onerror="this.onerror=null; this.src='${fallbackUrl}';">
        <div style="position: absolute; bottom: 0; left: 0; right: 0; background: linear-gradient(0deg, rgba(255,255,255,0.97) 0%, rgba(255,255,255,0) 100%); padding: 1.5rem 1rem 0.8rem; border-radius: 0 0 12px 12px; text-align: center; z-index: 5;">
          <div class="video-cover-text">${exercise.name}</div>
          <div class="video-cover-sub">Ilustración de Movimiento (Pasos)</div>
        </div>
      </div>
    `;
  } else {
    videoWrapper.innerHTML = `
      <div class="video-cover-card" style="background-image: linear-gradient(180deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.85) 100%), url('${fallbackUrl}'); cursor: default;">
        <div class="video-cover-text">${exercise.name}</div>
        <div class="video-cover-sub">Ilustración Guía de Técnica</div>
      </div>
    `;
  }

  // Recomendación del Entrenador Personal e Historial
  const recommendationBox = document.getElementById('coach-recommendation');
  const recommendation = suggestNextLoad(exercise);
  const suggestedWeight = recommendation.weight;
  const suggestedReps = recommendation.reps;
  const coachMessage = recommendation.message;
  const unitW = exercise.muscle === 'cardio' ? (exercise.intensityUnit || 'nivel') : 'kg';
  const unitR = exercise.muscle === 'cardio' ? 'min' : 'reps';

  recommendationBox.innerHTML = `
    <div class="coach-avatar">P</div>
    <div class="coach-text">${coachMessage}</div>
  `;

  // Cargar filas de inputs para las Series con Checkbox
  const loggerGrid = document.getElementById('active-sets-grid');
  loggerGrid.innerHTML = '';

  const setsCount = parseInt(exercise.sets) || 1;
  for (let i = 1; i <= setsCount; i++) {
    const row = document.createElement('div');
    row.className = `set-row ${i === 1 ? 'active' : ''}`;
    row.innerHTML = `
      <label class="set-check-label" title="Marcar como completada">
        <input type="checkbox" class="set-checkbox" onchange="toggleSetCompletion(this)">
        <span class="set-check-custom"></span>
      </label>
      <div class="set-label">SERIE ${i}</div>
      <div class="set-input-group">
        <input type="number" class="form-input weight-input" data-set="${i}" value="${suggestedWeight}" step="0.5" min="0">
        <span>${unitW}</span>
      </div>
      <div class="set-input-group">
        <input type="number" class="form-input reps-input" data-set="${i}" value="${suggestedReps}" min="1">
        <span>${unitR}</span>
      </div>
    `;
    loggerGrid.appendChild(row);
  }

  // Activar fila cuando el usuario hace focus
  loggerGrid.querySelectorAll('.form-input').forEach(input => {
    input.addEventListener('focus', () => {
      // Ignorar si la fila ya está completada
      const row = input.closest('.set-row');
      if (row.classList.contains('completed')) return;
      
      loggerGrid.querySelectorAll('.set-row').forEach(r => r.classList.remove('active'));
      row.classList.add('active');
    });
  });

  // Guardar lo que vas escribiendo o marcando, por si se cierra la pestaña
  loggerGrid.oninput = persistActiveWorkout;
  loggerGrid.onchange = persistActiveWorkout;

  // Reset de la selección de dificultad
  document.querySelectorAll('.difficulty-btn').forEach(btn => {
    btn.classList.remove('selected');
  });
  
  // Seleccionar por defecto la dificultad "adecuado"
  const defaultDiffBtn = document.querySelector('.difficulty-btn[data-diff="adecuado"]');
  if (defaultDiffBtn) defaultDiffBtn.classList.add('selected');

  // Resaltar visualmente los músculos activos en el SVG de anatomía
  highlightActiveMuscle(exercise.muscle);

  // Instrucciones del ejercicio y patología
  document.getElementById('active-instructions').innerHTML = `
    <div class="instructions-title">
      <svg viewBox="0 0 24 24" style="width:16px;height:16px;fill:currentColor;"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg> 
      Pasos para la técnica correcta:
    </div>
    <p>${exercise.notes}</p>
    <div class="instructions-danger">
      <strong>Guía de cuidado articular:</strong> ${exercise.patologyNotes}
    </div>
  `;

  // Cambiar botón de Siguiente / Terminar
  const nextBtn = document.getElementById('btn-next-exercise');
  if (workout.currentIndex === workout.exercises.length - 1) {
    nextBtn.innerHTML = `
      <svg viewBox="0 0 24 24"><path d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z"/></svg> Terminar Entrenamiento
    `;
  } else {
    nextBtn.innerHTML = `
      Siguiente Ejercicio <svg viewBox="0 0 24 24"><path d="M5 13h11.86l-5.43 5.43 1.42 1.42L21 12l-8.15-8.15-1.42 1.42L16.86 11H5v2z"/></svg>
    `;
  }

  persistActiveWorkout();
}

// Resalta visualmente el músculo en los diagramas SVG
function highlightActiveMuscle(muscleId) {
  // Limpiar clases previas
  document.querySelectorAll('.muscle-group path').forEach(path => {
    path.removeAttribute('class');
  });

  // Mapeo de identificador de base de datos a IDs del diagrama SVG
  const muscleMapping = {
    'back': ['espalda'],
    'biceps': ['biceps'],
    'triceps': ['triceps'],
    'chest': ['pecho'],
    'shoulders': ['hombros-front', 'hombros-tras'],
    'legs': ['cuadriceps', 'isquios'],
    'cardio': []
  };

  const targetIds = muscleMapping[muscleId] || [];
  
  targetIds.forEach(id => {
    const group = document.getElementById(`muscle-${id}`);
    if (group) {
      group.querySelectorAll('path').forEach(path => {
        path.setAttribute('class', 'active-muscle');
      });
    }
  });
}

function toggleSetCompletion(checkbox) {
  const row = checkbox.closest('.set-row');
  if (checkbox.checked) {
    row.classList.add('completed');
    row.classList.remove('active');
    
    // Auto-enfocar la siguiente serie incompleta
    const allRows = Array.from(row.parentNode.querySelectorAll('.set-row'));
    const nextIncompleteRow = allRows.find(r => !r.classList.contains('completed'));
    if (nextIncompleteRow) {
      allRows.forEach(r => r.classList.remove('active'));
      nextIncompleteRow.classList.add('active');
      const input = nextIncompleteRow.querySelector('.weight-input');
      if (input) {
        input.focus();
        input.select();
      }

      // Iniciar temporizador de descanso entre series
      const workout = state.currentWorkout;
      if (workout) {
        const exercise = workout.exercises[workout.currentIndex];
        const restTime = exercise.rest || 60;
        if (restTime > 0) {
          startRestTimer(restTime, () => {
            if (input) {
              input.focus();
              input.select();
            }
          });
        }
      }
    }
  } else {
    row.classList.remove('completed');
    // Si no hay ninguna fila activa, hacer esta activa
    const activeRow = row.parentNode.querySelector('.set-row.active');
    if (!activeRow) {
      row.classList.add('active');
    }
  }
}

function selectDifficulty(diff) {
  document.querySelectorAll('.difficulty-btn').forEach(btn => {
    btn.classList.remove('selected');
  });
  document.querySelector(`.difficulty-btn[data-diff="${diff}"]`).classList.add('selected');
  persistActiveWorkout();
}

// Rango de repeticiones del plan: "10-12" → {min: 10, max: 12}; "12" → {12, 12}
function parseRepRange(reps) {
  const nums = String(reps).match(/\d+/g);
  if (!nums) return null;
  return { min: Number(nums[0]), max: Number(nums[nums.length - 1]) };
}

// Series de la sesión más reciente de un ejercicio
function getLastSessionLogs(exerciseId) {
  const logs = state.history.filter(l => l.exerciseId === exerciseId && !l._sessionPending);
  if (logs.length === 0) return [];
  const latest = logs.reduce((a, b) => ((b.date || '') > (a.date || '') ? b : a));
  return logs.filter(l => latest.sessionId
    ? l.sessionId === latest.sessionId
    : (l.date || '').slice(0, 10) === (latest.date || '').slice(0, 10));
}

// Cardio (bici/cinta): primero se sube la duración hasta 30 min y después la intensidad
function suggestCardioLoad(ex, last) {
  const unit = ex.intensityUnit || 'nivel';
  const step = unit === 'km/h' ? 0.5 : 1;
  const defaultMin = parseInt(ex.reps) || 10;

  if (last.length === 0) {
    return {
      weight: ex.startWeight,
      reps: defaultMin,
      message: `Empieza con <strong>${defaultMin} min</strong> a <strong>${ex.startWeight} ${unit}</strong>, en un ritmo en el que puedas hablar en frases.`
    };
  }

  const minutes = Math.max(...last.map(l => parseInt(l.reps) || 0));
  const intensity = Math.max(...last.map(l => parseFloat(l.weight) || 0));

  if (minutes < 30) {
    const next = Math.min(30, minutes + 5);
    return {
      weight: intensity,
      reps: next,
      message: `Último: <strong>${minutes} min</strong> a ${intensity} ${unit}. Primero sube la duración: hoy <strong>${next} min</strong> a la misma intensidad.`
    };
  }

  const newIntensity = Math.round((intensity + step) * 10) / 10;
  return {
    weight: newIntensity,
    reps: 30,
    message: `Ya llegas a 30 min cómodos. Puedes probar <strong>${newIntensity} ${unit}</strong> manteniendo los 30 min, sin HIIT.`
  };
}

// Doble progresión: primero se suben las repeticiones dentro del rango del plan;
// cuando se alcanza el tope en todas las series, se sube la carga.
// Devuelve { weight, reps, message } para la siguiente sesión.
function suggestNextLoad(ex) {
  const last = getLastSessionLogs(ex.id);
  if (ex.muscle === 'cardio') return suggestCardioLoad(ex, last);

  const startWeight = calculateDynamicStartWeight(ex.startWeight, ex.muscle);
  const range = parseRepRange(ex.reps) || { min: 10, max: 12 };

  if (last.length === 0) {
    return {
      weight: startWeight,
      reps: range.min,
      message: `¡Primera vez con este ejercicio! Empieza con <strong>${startWeight} kg</strong> y busca <strong>${range.min} reps</strong> en todas las series. Técnica lenta.`
    };
  }

  const lastWeight = Math.max(...last.map(l => parseFloat(l.weight) || 0));
  const minReps = Math.min(...last.map(l => parseInt(l.reps) || 0));
  const hardest = last.some(l => l.difficulty === 'duro');
  const step = (ex.muscle === 'biceps' || ex.muscle === 'shoulders') ? 1 : 2.5;

  if (minReps >= range.max && !hardest) {
    const weight = lastWeight + step;
    return {
      weight,
      reps: range.min,
      message: `Completaste <strong>${range.max} reps</strong> en todas las series con ${lastWeight} kg. Hoy sube a <strong>${weight} kg</strong> y empieza en ${range.min} reps.`
    };
  }

  if (hardest && minReps < range.min) {
    const weight = Math.max(0, lastWeight - 2.5);
    return {
      weight,
      reps: range.min,
      message: `Con ${lastWeight} kg no llegaste a ${range.min} reps y fue muy duro. Baja a <strong>${weight} kg</strong> para cuidar la técnica.`
    };
  }

  const reps = Math.min(range.max, Math.max(range.min, minReps + 1));
  return {
    weight: lastWeight,
    reps,
    message: `Mantén <strong>${lastWeight} kg</strong> y busca <strong>${reps} reps</strong> en todas las series. Cuando llegues a ${range.max} en todas, subes carga.`
  };
}

let lastNextClickAt = 0;

function handleNextExerciseClick() {
  const workout = state.currentWorkout;
  if (!workout) return;

  // Doble toque: el segundo caería ya en el ejercicio siguiente
  const now = Date.now();
  if (now - lastNextClickAt < 800) return;
  lastNextClickAt = now;

  const exercise = workout.exercises[workout.currentIndex];

  // Solo cuentan las series marcadas como hechas: las demás llevan los valores
  // sugeridos y falsearían la progresión de cargas
  const rows = Array.from(document.querySelectorAll('#active-sets-grid .set-row'));
  const doneRows = rows.filter(r => r.querySelector('.set-checkbox').checked);
  if (doneRows.length === 0 &&
      !confirm(`No has marcado ninguna serie de «${exercise.name}».\n\nSolo se guardan las series marcadas con ✓. ¿Pasar al siguiente sin registrar este ejercicio?`)) {
    return;
  }

  const difficulty = document.querySelector('.difficulty-btn.selected')?.getAttribute('data-diff') || 'adecuado';
  const todayStr = getLocalDateString();

  doneRows.forEach(row => {
    const weightInput = row.querySelector('.weight-input');
    state.history.push({
      date: todayStr,
      routineId: workout.routineId,
      sessionId: workout.sessionId,
      exerciseId: exercise.id,
      exerciseName: exercise.name,
      setIndex: parseInt(weightInput.dataset.set),
      reps: parseInt(row.querySelector('.reps-input').value) || 0,
      weight: parseFloat(weightInput.value) || 0,
      difficulty: difficulty,
      // Sesión en curso: no entra en kf_history hasta terminar el entreno
      // (mientras tanto va en kf_active_workout)
      _sessionPending: true
    });
  });

  // Si es el último ejercicio del entrenamiento
  if (workout.currentIndex === workout.exercises.length - 1) {
    completeWorkoutSession();
    return;
  }

  // Se pasa ya al siguiente ejercicio y el descanso corre mientras lo ves
  // (así preparas la máquina). Al acabar el descanso solo suena el aviso.
  advanceExercise();
  const restTime = exercise.rest || 0;
  if (restTime > 0) startRestTimer(restTime);
}

function advanceExercise() {
  stopRestTimer();
  state.currentWorkout.currentIndex++;
  renderActiveExercise();
}

function completeWorkoutSession() {
  // Confirmar todas las entradas pendientes de esta sesión
  state.history.forEach(entry => {
    if (entry._sessionPending) delete entry._sessionPending;
  });

  // AHORA sí persistir todo el historial en localStorage
  saveStateToStorage('history');
  clearSavedWorkout();
  stopRestTimer();
  releaseWakeLock();

  // Ocultar área de reproducción
  document.getElementById('workout-focus-area').style.display = 'none';
  document.getElementById('routines-selection-area').style.display = 'block';

  // Mostrar mensaje de éxito y confetti
  triggerConfettiSuccess();

  state.currentWorkout = null;
  switchTab('dashboard');
  
  // Actualizar dashboard
  updateDashboard();
}

// Abortar entrenamiento: eliminar entradas no confirmadas y recargar
function abortWorkout() {
  if (!confirm('¿Seguro que deseas abortar el entrenamiento actual? No se guardarán los datos.')) return;
  
  // Eliminar todas las entradas pendientes de esta sesión del historial en memoria
  state.history = state.history.filter(entry => !entry._sessionPending);
  
  // Restaurar el historial original en localStorage (sin los datos de esta sesión)
  saveStateToStorage('history');
  clearSavedWorkout();

  // Recargar la página limpia
  location.reload();
}

// Disparador de confeti (Canvas-Confetti cargado por CDN en index.html)
function triggerConfettiSuccess() {
  if (typeof confetti === 'function') {
    confetti({
      particleCount: 150,
      spread: 80,
      origin: { y: 0.6 }
    });
  } else {
    alert("¡Entrenamiento completado! Excelente trabajo hoy.");
  }
}

// ==========================================
// 4. TEMPORIZADOR DE DESCANSO CON WEB AUDIO API
// ==========================================

let timerInterval = null;
let currentTimerCallback = null;

function startRestTimer(seconds, onComplete) {
  stopRestTimer();
  currentTimerCallback = onComplete || null;
  const overlay = document.getElementById('rest-timer-overlay');
  const timerNum = document.getElementById('timer-number');
  const timerCircle = document.getElementById('timer-ring-circle');

  overlay.classList.add('active');

  // Se cuenta contra la hora de fin, no restando 1 en cada intervalo: con la
  // pantalla apagada o la app en segundo plano el móvil retrasa los intervalos
  // y el contador se quedaría atrás
  const endAt = Date.now() + seconds * 1000;
  let lastBeep = null;

  const tick = () => {
    const timeLeft = Math.max(0, Math.ceil((endAt - Date.now()) / 1000));
    timerNum.textContent = timeLeft;

    // Anillo SVG (dasharray es 100)
    if (timerCircle) timerCircle.style.strokeDashoffset = 100 - (timeLeft / seconds) * 100;

    // Micro-bip en los últimos 3 segundos (uno por segundo)
    if (timeLeft <= 3 && timeLeft > 0 && lastBeep !== timeLeft) {
      lastBeep = timeLeft;
      playSynthBeep(440, 0.1);
    }

    if (timeLeft <= 0) {
      const callback = currentTimerCallback;
      // Si el descanso acabó hace rato (app en segundo plano), no pitar tarde
      const late = Date.now() - endAt > 5000;
      stopRestTimer();
      if (!late) {
        playSynthBeep(880, 0.5); // Bip largo al terminar
        vibrateDevice([300, 150, 300]);
      }
      if (callback) callback();
    }
  };

  tick();
  timerInterval = setInterval(tick, 250);
}

// Vibración al acabar el descanso (en el gimnasio a veces no se oye el pitido).
// Va con el mismo ajuste que el sonido.
function vibrateDevice(pattern) {
  if (!state.settings.soundEnabled || !navigator.vibrate) return;
  try { navigator.vibrate(pattern); } catch (e) {}
}

function skipRestTimer() {
  const callback = currentTimerCallback;
  stopRestTimer();
  if (callback) callback();
}

// Para el descanso sin ejecutar su aviso (al cambiar de ejercicio o terminar)
function stopRestTimer() {
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = null;
  currentTimerCallback = null;
  const overlay = document.getElementById('rest-timer-overlay');
  if (overlay) overlay.classList.remove('active');
}

// Sintetizar sonido nativo (Evita problemas de carga de archivos mp3)
function playSynthBeep(frequency, duration) {
  if (!state.settings.soundEnabled) return;

  try {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    // El móvil puede dejar el audio en pausa (p. ej. tras bloquear la pantalla)
    if (audioCtx.state === 'suspended') audioCtx.resume();

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = 'sine';
    osc.frequency.value = frequency;
    
    gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);

    osc.connect(gain);
    gain.connect(audioCtx.destination);

    osc.start();
    osc.stop(audioCtx.currentTime + duration);
  } catch (error) {
    console.error("Audio Synthesis error: ", error);
  }
}

// ==========================================
// 5. REGISTRO DE PESO E INBODY (MÉTRICAS)
// ==========================================

function renderMetricsPanel() {
  renderCardioGoal();
  // Renderizar gráfico con la métrica seleccionada
  const canvas = document.getElementById('weight-chart');
  const selectedMetric = document.getElementById('metrics-chart-select')?.value || 'weight';
  // Si el gráfico falla (p. ej. Chart.js no cargó sin conexión), que no se
  // quede sin pintar la tabla ni la lista de registros
  try {
    if (canvas && typeof renderWeightChart === 'function') {
      renderWeightChart(canvas, state.weightHistory, selectedMetric);
    }
  } catch (e) {
    console.error('No se pudo dibujar el gráfico de métricas:', e);
  }

  // Renderizar la tabla comparativa de las últimas 5 mediciones e inicio
  renderInBodyComparisonTable();
  renderWeightRecordsList();
}

function renderInBodyComparisonTable() {
  const container1 = document.getElementById('metrics-comparison-table-container');
  const container2 = document.getElementById('reports-inbody-comparison-container');
  
  if (!container1 && !container2) return;

  if (state.weightHistory.length === 0) {
    const emptyMsg = `<div style="color:var(--text-muted);padding:1rem;text-align:center;">No hay registros de báscula guardados.</div>`;
    if (container1) container1.innerHTML = emptyMsg;
    if (container2) container2.innerHTML = emptyMsg;
    return;
  }

  // Ordenar historial por fecha de forma ascendente
  const sorted = [...state.weightHistory].sort((a,b) => new Date(a.date) - new Date(b.date));
  
  // La primera medición en la base de datos es la base (Start)
  const base = sorted[0];
  
  // Las últimas 4 mediciones (además de la base) para comparar
  const compareList = sorted.slice(1).slice(-4);
  const latestItem = compareList.length > 0 ? compareList[compareList.length - 1] : base;

  // key: propiedad, label: nombre fila (tabla), short: nombre en tarjeta (móvil),
  // better: 'lower' o 'higher'
  const rowSchema = [
    { key: 'weight', label: 'Peso Corporal', short: 'Peso', unit: 'kg', better: 'lower' },
    { key: 'fat', label: 'Grasa Corporal', short: 'Grasa', unit: '%', better: 'lower' },
    { key: 'muscle', label: 'Masa Muscular', short: 'Músculo', unit: 'kg', better: 'higher' },
    { key: 'bmi', label: 'IMC', short: 'IMC', unit: '', better: 'lower' },
    { key: 'leanMass', label: 'Masa Magra', short: 'Masa magra', unit: 'kg', better: 'higher' },
    { key: 'visceral', label: 'Grasa Visceral', short: 'G. visceral', unit: '', better: 'lower' },
    { key: 'water', label: 'Agua / Humedad', short: 'Agua', unit: '%', better: 'higher' },
    { key: 'bodyAge', label: 'Edad Corporal', short: 'Edad corporal', unit: 'años', better: 'lower' }
  ];

  const hasValue = v => v !== undefined && v !== null;

  // Diferencia último vs base, con su clase de color (mejora / retroceso)
  const deltaFor = row => {
    const baseVal = base[row.key];
    const latestVal = latestItem[row.key];
    if (!hasValue(baseVal) || !hasValue(latestVal)) return null;
    const diff = latestVal - baseVal;
    if (diff === 0) return { text: '0.0', cls: 'neutral-stable' };
    const isImprovement = (row.better === 'lower' && diff < 0) || (row.better === 'higher' && diff > 0);
    return {
      text: `${diff > 0 ? '+' : ''}${diff.toFixed(1)} ${row.unit}`.trim(),
      cls: isImprovement ? 'positive-improvement' : 'negative-regression'
    };
  };

  // Tabla completa (escritorio y PDF)
  let html = `
    <table class="comparison-table">
      <thead>
        <tr>
          <th>Variable InBody</th>
          <th>Base (${formatDateString(base.date)})</th>
          ${compareList.map(item => `<th>${formatDateString(item.date)}</th>`).join('')}
          <th>Evolución Global</th>
        </tr>
      </thead>
      <tbody>
  `;

  rowSchema.forEach(row => {
    const fmt = v => hasValue(v) ? `${v} ${row.unit}` : '-';
    const delta = deltaFor(row);
    html += `
      <tr>
        <td class="metric-label-col">${row.label}</td>
        <td style="font-weight:600;">${fmt(base[row.key])}</td>
        ${compareList.map(item => `<td>${fmt(item[row.key])}</td>`).join('')}
        <td style="background:rgba(15,23,42,0.02);">${delta ? `<span class="delta-cell ${delta.cls}">${delta.text}</span>` : '-'}</td>
      </tr>
    `;
  });

  html += `
      </tbody>
    </table>
  `;

  // Tarjetas compactas (móvil): valor actual + cambio desde la base
  html += `<div class="inbody-tiles">`;
  rowSchema.forEach(row => {
    const latestVal = latestItem[row.key];
    if (!hasValue(latestVal)) return;
    const delta = deltaFor(row);
    html += `
      <div class="inbody-tile">
        <span class="inbody-tile-label">${row.short}</span>
        <span class="inbody-tile-value">${latestVal}<small>${row.unit}</small></span>
        ${delta && sorted.length > 1 ? `<span class="delta-cell ${delta.cls}">${delta.text}</span>` : '<span class="inbody-tile-base">Medición base</span>'}
      </div>
    `;
  });
  html += `</div>
    <div class="inbody-tiles-foot">Base: ${formatDateString(base.date)} · Último: ${formatDateString(latestItem.date)} · ${sorted.length} registros</div>`;

  if (container1) container1.innerHTML = html;
  if (container2) container2.innerHTML = html;
}

function addWeightRecord(date, weight, fat, bmi, muscle, leanMass, visceral, water, bodyAge) {
  // Validar si la fecha ya existe, si es así sobrescribirla, si no añadir nueva
  const index = state.weightHistory.findIndex(w => w.date === date);
  const record = {
    date,
    weight,
    fat: fat || null,
    bmi: bmi || null,
    muscle: muscle || null,
    leanMass: leanMass || null,
    visceral: visceral || null,
    water: water || null,
    bodyAge: bodyAge || null,
    updatedAt: Date.now() // en la sincronización gana la versión más reciente
  };

  if (index !== -1) {
    state.weightHistory[index] = record;
  } else {
    state.weightHistory.push(record);
  }

  saveStateToStorage('weight');
}

// Fecha "AAAA-MM-DD" legible, con año (p. ej. "19 oct 2026")
function formatDateWithYear(dateStr, opts = { day: '2-digit', month: 'short', year: 'numeric' }) {
  const [y, m, d] = String(dateStr).slice(0, 10).split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return isNaN(dt) ? dateStr : dt.toLocaleDateString('es-ES', opts);
}

// Lista de todos los registros de báscula, con Editar y Borrar
function renderWeightRecordsList() {
  const el = document.getElementById('weight-records-list');
  if (!el) return;

  const records = [...state.weightHistory].sort((a, b) => b.date.localeCompare(a.date));
  if (records.length === 0) {
    el.innerHTML = '<div class="records-empty">Aún no hay registros de báscula.</div>';
    return;
  }

  el.innerHTML = records.map(r => {
    const extras = [
      r.fat != null ? `${r.fat} % grasa` : '',
      r.muscle != null ? `${r.muscle} kg músculo` : ''
    ].filter(Boolean).join(' · ');
    return `
      <div class="record-row${r.date === editingWeightDate ? ' editing' : ''}">
        <span class="record-date">${formatDateWithYear(r.date)}</span>
        <span class="record-main"><strong>${r.weight} kg</strong>${extras ? `<small>${extras}</small>` : ''}</span>
        <span class="record-actions">
          <button type="button" class="btn btn-secondary btn-sm" data-edit-weight="${r.date}">Editar</button>
          <button type="button" class="btn btn-secondary btn-sm btn-danger-soft" data-delete-weight="${r.date}">Borrar</button>
        </span>
      </div>`;
  }).join('');

  el.onclick = (e) => {
    const edit = e.target.closest('[data-edit-weight]');
    if (edit) return startWeightEdit(edit.dataset.editWeight);
    const del = e.target.closest('[data-delete-weight]');
    if (del) deleteWeightRecord(del.dataset.deleteWeight);
  };
}

// Registro de báscula que se está corrigiendo en el formulario (fecha) o null
let editingWeightDate = null;

const WEIGHT_FORM_FIELDS = {
  weight: 'input-body-weight', fat: 'input-body-fat', bmi: 'input-body-bmi',
  muscle: 'input-body-muscle', leanMass: 'input-body-lean', visceral: 'input-body-visceral',
  water: 'input-body-water', bodyAge: 'input-body-age'
};

function startWeightEdit(date) {
  const rec = state.weightHistory.find(w => w.date === date);
  if (!rec) return;
  editingWeightDate = date;
  Object.entries(WEIGHT_FORM_FIELDS).forEach(([key, id]) => {
    document.getElementById(id).value = rec[key] ?? '';
  });
  document.getElementById('input-weight-date').value = rec.date;
  document.getElementById('btn-save-weight').textContent = 'Guardar cambios';
  document.getElementById('btn-cancel-weight-edit').style.display = 'block';
  renderWeightRecordsList();
  document.getElementById('weight-logger-form').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function cancelWeightEdit() {
  editingWeightDate = null;
  document.getElementById('weight-logger-form').reset();
  document.getElementById('input-weight-date').value = getLocalDateString();
  document.getElementById('btn-save-weight').textContent = 'Guardar Registro';
  document.getElementById('btn-cancel-weight-edit').style.display = 'none';
  renderWeightRecordsList();
}

function deleteWeightRecord(date, ask = true) {
  if (ask && !confirm(`¿Borrar el registro de báscula del ${formatDateWithYear(date)}?`)) return;
  state.weightHistory = state.weightHistory.filter(w => w.date !== date);
  state.deleted.weight[date] = Date.now();
  saveStateToStorage('weight');
  if (ask) {
    if (editingWeightDate === date) cancelWeightEdit();
    renderMetricsPanel();
    updateDashboard();
  }
}

// ==========================================
// 6. INFORMES Y ESTADÍSTICAS
// ==========================================

// Etiqueta el nombre del ejercicio con su día cuando el mismo nombre aparece
// en varios días (p. ej. "Prensa de piernas · Día C"), para que dos
// progresiones independientes no parezcan duplicadas al usuario.
function getExerciseDisplayName(exerciseId) {
  let target = null;
  let dayName = '';
  const nameCounts = {};

  state.routines.forEach(routine => {
    routine.exercises.forEach(ex => {
      nameCounts[ex.name] = (nameCounts[ex.name] || 0) + 1;
      if (ex.id === exerciseId) {
        target = ex;
        dayName = routine.name.split(':')[0];
      }
    });
  });

  if (!target) return '';
  if ((nameCounts[target.name] || 0) < 2) return target.name;
  return `${target.name} · ${dayName}`;
}

const MUSCLE_LABELS = {
  legs: 'Piernas', back: 'Espalda', chest: 'Pecho', biceps: 'Bíceps',
  triceps: 'Tríceps', shoulders: 'Hombros', cardio: 'Cardio'
};

// Día de rutina seleccionado en "Progreso de fuerza" (se mantiene entre renders)
let activeStrengthDayId = null;

function renderReportsPanel() {
  const volumeCanvas = document.getElementById('volume-chart');
  const strengthCanvas = document.getElementById('strength-chart');
  const exerciseSelect = document.getElementById('report-exercise-select');

  if (!volumeCanvas || !strengthCanvas || !exerciseSelect) return;

  // 1. Resumen y progreso por ejercicio (fija también el día activo)
  renderReportKpis();
  renderStrengthProgress();

  // 2. Selector de ejercicios del gráfico de fuerza
  exerciseSelect.innerHTML = '';
  const addedExercises = {};

  state.routines.forEach(routine => {
    routine.exercises.forEach(ex => {
      if (!addedExercises[ex.id]) {
        const option = document.createElement('option');
        option.value = ex.id;
        option.textContent = getExerciseDisplayName(ex.id);
        exerciseSelect.appendChild(option);
        addedExercises[ex.id] = getExerciseDisplayName(ex.id);
      }
    });
  });

  // Mostrar de inicio el primer ejercicio con registros del día activo
  const activeRoutine = state.routines.find(r => r.id === activeStrengthDayId);
  const firstWithData = activeRoutine && activeRoutine.exercises.find(ex =>
    ex.muscle !== 'cardio' && state.history.some(log => log.exerciseId === ex.id));
  if (firstWithData) exerciseSelect.value = firstWithData.id;

  // 3. Dibujar volumen de trabajo
  if (typeof renderVolumeChart === 'function') {
    renderVolumeChart(volumeCanvas, strengthLogsOnly());
  }

  // 4. Dibujar fuerza al cambiar de ejercicio
  const updateStrength = () => {
    const exerciseId = exerciseSelect.value;
    if (!exerciseId) return;

    const exerciseLogs = state.history.filter(log => log.exerciseId === exerciseId);
    const exerciseName = addedExercises[exerciseId];

    if (typeof renderStrengthChart === 'function') {
      renderStrengthChart(strengthCanvas, exerciseLogs, exerciseName);
    }
  };

  exerciseSelect.onchange = updateStrength;
  updateStrength(); // Carga inicial de fuerza

  // 5. Composición corporal
  renderInBodyComparisonTable();
}

// Cardio libre (caminar, etc.) añadido a mano en Métricas
function isExtraCardio(log) {
  return log.exerciseId === 'cardio_extra';
}

// Objetivo semanal de cardio en minutos (orientativo: 150 min/semana)
function cardioGoal() {
  const g = Number(state.settings.cardioGoalMin);
  return g > 0 ? g : 150;
}

// Minutos de cardio de la semana actual: rutina + cardio libre
function cardioMinutesThisWeek() {
  const cardioIds = new Set(state.routines.flatMap(r => r.exercises.filter(e => e.muscle === 'cardio').map(e => e.id)));
  const thisWeek = getWeekStartKey(getLocalDateString());
  return state.history
    .filter(l => l.date && (cardioIds.has(l.exerciseId) || isExtraCardio(l)) && getWeekStartKey(l.date) === thisWeek)
    .reduce((sum, l) => sum + (parseInt(l.reps) || 0), 0);
}

function renderCardioGoal() {
  const valueEl = document.getElementById('cardio-week-value');
  if (!valueEl) return;
  const goal = cardioGoal();
  const done = cardioMinutesThisWeek();
  valueEl.textContent = `${done} / ${goal} min`;
  document.getElementById('cardio-bar-fill').style.width = `${Math.min(100, (done / goal) * 100)}%`;
  const goalInput = document.getElementById('input-cardio-goal');
  if (goalInput && document.activeElement !== goalInput) goalInput.value = goal;
}

function saveCardioGoal(value) {
  const g = parseInt(value);
  state.settings.cardioGoalMin = g > 0 ? g : 150;
  saveStateToStorage('settings');
  renderCardioGoal();
}

function addExtraCardioFromInput() {
  const input = document.getElementById('input-extra-cardio');
  const minutes = parseInt(input.value);
  if (!(minutes > 0)) {
    alert('Introduce los minutos de cardio que has hecho.');
    return;
  }
  state.history.push({
    date: getLocalDateString(),
    routineId: 'libre',
    sessionId: Date.now(),
    exerciseId: 'cardio_extra',
    exerciseName: 'Cardio libre',
    setIndex: 1,
    reps: minutes,
    weight: 0,
    difficulty: 'facil'
  });
  saveStateToStorage('history');
  input.value = '';
  renderCardioGoal();
  updateDashboard();
}

// Registros de fuerza (sin cardio)
function strengthLogsOnly() {
  const cardioIds = new Set(state.routines.flatMap(r => r.exercises.filter(e => e.muscle === 'cardio').map(e => e.id)));
  return state.history.filter(log => !cardioIds.has(log.exerciseId) && !isExtraCardio(log));
}

// Calcula la progresión de un ejercicio a partir del historial
function getExerciseProgress(ex) {
  const startWeight = calculateDynamicStartWeight(ex.startWeight, ex.muscle);
  const exerciseLogs = state.history.filter(log => log.exerciseId === ex.id);

  // Peso máximo por día de entrenamiento (para la minigráfica)
  const maxPerDay = {};
  exerciseLogs.forEach(log => {
    const day = (log.date || '').slice(0, 10);
    const weight = parseFloat(log.weight) || 0;
    if (!(day in maxPerDay) || weight > maxPerDay[day]) maxPerDay[day] = weight;
  });
  const days = Object.keys(maxPerDay).sort();
  const series = days.map(d => maxPerDay[d]);
  const maxWeight = series.length > 0 ? Math.max(...series) : 0;

  let lastDifficulty = null;
  if (exerciseLogs.length > 0) {
    const newest = [...exerciseLogs].sort((a, b) => new Date(b.date) - new Date(a.date))[0];
    lastDifficulty = newest.difficulty || 'adecuado';
  }
  const recommendedWeight = suggestNextLoad(ex).weight;

  return {
    startWeight,
    series,
    sessions: days.length,
    maxWeight,
    progress: maxWeight > 0 ? maxWeight - startWeight : null,
    lastDifficulty,
    recommendedWeight
  };
}

// Minutos acumulados de un ejercicio de cardio
function totalMinutes(exerciseId) {
  return state.history.filter(l => l.exerciseId === exerciseId).reduce((sum, l) => sum + (parseInt(l.reps) || 0), 0);
}

// Minigráfica SVG con la evolución del peso máximo por sesión
function sparklineSvg(values) {
  if (values.length < 2) return '';
  const w = 64, h = 24, pad = 3;
  const min = Math.min(...values);
  const range = Math.max(...values) - min;
  const points = values.map((v, i) => [
    pad + i * (w - 2 * pad) / (values.length - 1),
    range === 0 ? h / 2 : h - pad - (v - min) / range * (h - 2 * pad)
  ]);
  const [lastX, lastY] = points[points.length - 1];
  return `<svg class="sparkline" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-hidden="true">
    <polyline points="${points.map(p => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ')}" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
    <circle cx="${lastX.toFixed(1)}" cy="${lastY.toFixed(1)}" r="2.6" fill="currentColor"/>
  </svg>`;
}

function renderReportKpis() {
  const container = document.getElementById('report-kpis');
  if (!container) return;

  const trainingDays = [...new Set(strengthLogsOnly().map(log => (log.date || '').slice(0, 10)).filter(Boolean))];
  const monthPrefix = getLocalDateString().slice(0, 7);
  const thisMonth = trainingDays.filter(d => d.startsWith(monthPrefix)).length;

  const tonnage = strengthLogsOnly().reduce((sum, log) => sum + (parseInt(log.reps) || 0) * (parseFloat(log.weight) || 0), 0);
  const tonnageText = tonnage >= 1000 ? `${(tonnage / 1000).toFixed(1)} t` : `${Math.round(tonnage)} kg`;

  // Ejercicios de fuerza con registros y cuántos superan su carga inicial
  let withData = 0;
  let improved = 0;
  const seen = new Set();
  state.routines.forEach(routine => routine.exercises.forEach(ex => {
    if (seen.has(ex.id) || ex.muscle === 'cardio') return;
    seen.add(ex.id);
    const p = getExerciseProgress(ex);
    if (p.sessions > 0) {
      withData++;
      if (p.progress > 0) improved++;
    }
  }));

  const weights = [...state.weightHistory].sort((a,b) => new Date(a.date) - new Date(b.date));
  let weightValue = '—';
  let weightSub = 'Sin registros';
  if (weights.length > 0) {
    const latest = weights[weights.length - 1].weight;
    const diff = latest - weights[0].weight;
    weightValue = `${latest} kg`;
    weightSub = weights.length > 1
      ? `${diff > 0 ? '+' : ''}${diff.toFixed(1)} kg desde el inicio`
      : 'Medición base';
  }

  const tiles = [
    { label: 'Sesiones', value: calculateTotalWorkouts(), sub: `${thisMonth} días este mes` },
    { label: 'Tonelaje total', value: tonnageText, sub: 'reps × peso acumulado' },
    { label: 'Mejoras', value: `${improved}/${withData}`, sub: 'ejercicios con más carga' },
    { label: 'Peso corporal', value: weightValue, sub: weightSub }
  ];

  container.innerHTML = tiles.map(t => `
    <div class="card kpi-tile">
      <span class="kpi-label">${t.label}</span>
      <span class="kpi-value">${t.value}</span>
      <span class="kpi-sub">${t.sub}</span>
    </div>
  `).join('');
}

function renderStrengthProgress() {
  const tabsEl = document.getElementById('strength-day-tabs');
  const listEl = document.getElementById('strength-progress-list');
  if (!tabsEl || !listEl) return;

  const routines = state.routines;
  if (routines.length === 0) {
    tabsEl.innerHTML = '';
    listEl.innerHTML = `<div class="strength-empty">No hay ejercicios en tus rutinas.</div>`;
    return;
  }

  // Día activo por defecto: el del último entrenamiento registrado
  if (!routines.some(r => r.id === activeStrengthDayId)) {
    const lastLog = [...state.history].sort((a,b) => new Date(b.date) - new Date(a.date))[0];
    activeStrengthDayId = lastLog && routines.some(r => r.id === lastLog.routineId)
      ? lastLog.routineId
      : routines[0].id;
  }

  tabsEl.innerHTML = routines.map(r => {
    const active = r.id === activeStrengthDayId;
    return `<button type="button" class="day-tab${active ? ' active' : ''}" data-day="${r.id}" role="tab" aria-selected="${active}">${r.name.split(':')[0]}</button>`;
  }).join('');

  const difficultyLabels = { facil: '😊 Fácil', adecuado: '⚡ Bien', duro: '🥵 Duro' };

  listEl.innerHTML = routines.map(routine => {
    const rows = routine.exercises.map(ex => {
      const p = getExerciseProgress(ex);
      const muscleBadge = `<span class="muscle-badge muscle-badge-${ex.muscle}">${MUSCLE_LABELS[ex.muscle] || ex.muscle}</span>`;
      const effort = p.lastDifficulty
        ? `<span class="difficulty-badge ${p.lastDifficulty}">${difficultyLabels[p.lastDifficulty] || p.lastDifficulty}</span>`
        : '';

      // El cardio no tiene progresión de carga: solo se cuentan sesiones
      if (ex.muscle === 'cardio') {
        return `
          <div class="strength-row is-cardio">
            <span class="strength-name">${ex.name}</span>
            <span class="strength-delta neutral-stable">${totalMinutes(ex.id)} min</span>
            <span class="strength-meta">${muscleBadge}</span>
          </div>`;
      }

      let deltaHtml = '<span class="strength-delta neutral-stable">—</span>';
      if (p.progress !== null) {
        const cls = p.progress > 0 ? 'positive-improvement' : p.progress < 0 ? 'negative-regression' : 'neutral-stable';
        deltaHtml = `<span class="strength-delta delta-cell ${cls}">${p.progress > 0 ? '+' : ''}${p.progress.toFixed(1)} kg</span>`;
      }

      const loads = p.sessions > 0
        ? `${p.startWeight} → <strong>${p.maxWeight} kg</strong>`
        : `Sin registros · empieza con ${p.startWeight} kg`;

      return `
        <button type="button" class="strength-row${p.sessions === 0 ? ' no-data' : ''}" data-exercise="${ex.id}">
          <span class="strength-name">${ex.name}</span>
          <span class="strength-spark">${sparklineSvg(p.series)}</span>
          ${deltaHtml}
          <span class="strength-meta">
            ${muscleBadge}
            <span>${loads}</span>
            <span class="strength-next">Próx. <strong>${p.recommendedWeight} kg</strong></span>
            ${effort}
          </span>
        </button>`;
    }).join('');

    return `
      <div class="strength-group${routine.id === activeStrengthDayId ? ' active' : ''}" data-day="${routine.id}">
        <h4 class="strength-group-title">${routine.name}</h4>
        ${rows}
      </div>`;
  }).join('');

  tabsEl.onclick = (e) => {
    const tab = e.target.closest('.day-tab');
    if (!tab) return;
    activeStrengthDayId = tab.dataset.day;
    renderStrengthProgress();
  };

  // Tocar un ejercicio lo muestra en el gráfico de fuerza
  listEl.onclick = (e) => {
    const row = e.target.closest('.strength-row[data-exercise]');
    const select = document.getElementById('report-exercise-select');
    if (!row || !select) return;
    select.value = row.dataset.exercise;
    if (typeof select.onchange === 'function') select.onchange();
    document.getElementById('strength-chart-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
}

// Exportación del Historial Completo a CSV
function exportDataToCSV() {
  if (state.history.length === 0 && state.weightHistory.length === 0) {
    alert("No hay datos para exportar.");
    return;
  }

  // Formato de Excel en español: separador ";", coma decimal y BOM UTF-8.
  // Con "," Excel lo mete todo en una columna; sin BOM rompe los acentos; y
  // con punto decimal leería "147.7" como 1477.
  const cell = v => {
    if (v === null || v === undefined) return '';
    if (typeof v === 'number' || /^-?\d+\.\d+$/.test(String(v))) return String(v).replace('.', ',');
    const s = String(v);
    // Comillas si hace falta, y nada que empiece por "=" "+" "-" "@" (Excel lo tomaría por fórmula)
    const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
    return /[";\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  };
  const row = values => values.map(cell).join(';');
  const routineName = id => (state.routines.find(r => r.id === id) || {}).name || id || '';
  const difficultyLabels = { facil: 'Fácil', adecuado: 'Adecuado', duro: 'Muy duro' };

  const lines = [];

  // 1. Registros de báscula
  lines.push(row(['REGISTROS DE COMPOSICIÓN CORPORAL']));
  lines.push(row(['Fecha', 'Peso (kg)', 'Grasa (%)', 'IMC', 'Masa muscular (kg)', 'Masa magra (kg)', 'Grasa visceral', 'Agua (%)', 'Edad corporal']));
  [...state.weightHistory].sort((a, b) => a.date.localeCompare(b.date)).forEach(item => {
    lines.push(row([item.date, item.weight, item.fat, item.bmi, item.muscle, item.leanMass, item.visceral, item.water, item.bodyAge]));
  });

  lines.push('');

  // 2. Historial de entrenamiento (en cardio: reps = minutos, peso = intensidad)
  lines.push(row(['HISTORIAL DE ENTRENAMIENTOS']));
  lines.push(row(['Fecha', 'Rutina', 'Ejercicio', 'Serie', 'Repeticiones / min', 'Peso (kg) / intensidad', 'Dificultad percibida']));
  state.history.filter(log => !log._sessionPending).forEach(log => {
    lines.push(row([
      (log.date || '').slice(0, 10),
      isExtraCardio(log) ? 'Cardio libre' : routineName(log.routineId),
      log.exerciseName || log.exerciseId,
      log.setIndex,
      log.reps,
      log.weight,
      difficultyLabels[log.difficulty] || log.difficulty || ''
    ]));
  });

  const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `FitActive_Reporte_Rafael_${getLocalDateString()}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ==========================================
// 8. CONFIGURACIÓN Y NOTIFICACIONES PUSH
// ==========================================

// Muestra en Ajustes si los datos se están guardando también en la nube
function renderAccountPanel() {
  const el = document.getElementById('sync-status');
  if (!el) return;
  const texts = {
    checking: 'Comprobando sincronización…',
    synced: 'Sincronizado con la nube: tus datos se guardan también en Firebase.',
    offline: 'Sin conexión a la nube: los datos se guardan solo en este dispositivo.',
    'needs-login': 'La nube rechaza el acceso (revisa las reglas de Firestore). Tus datos siguen guardados en este dispositivo.',
    error: 'Error de sincronización: los datos siguen guardados en este dispositivo.'
  };
  el.textContent = texts[syncStatus] || texts.error;
}

function renderSettingsPanel() {
  renderAccountPanel();
  // 1. Seleccionar checkboxes de días
  state.settings.scheduleDays.forEach(day => {
    const cb = document.querySelector(`.day-checkbox-label input[value="${day}"]`);
    if (cb) cb.checked = true;
  });

  // 2. Cargar hora
  document.getElementById('input-alert-time').value = state.settings.notifyTime;
  if (document.getElementById('input-user-height')) document.getElementById('input-user-height').value = state.settings.userHeight || 174;
  if (document.getElementById('input-user-age')) document.getElementById('input-user-age').value = state.settings.userAge || '';
  renderPlanStartField();

  // 3. Cargar toggles de audio/alerta
  document.getElementById('toggle-sound').checked = state.settings.soundEnabled;
  document.getElementById('toggle-push').checked = state.settings.notificationsEnabled;
}

// Campo "Inicio del plan actual" y en qué semana del plan vas
function renderPlanStartField() {
  const input = document.getElementById('input-plan-start');
  const help = document.getElementById('plan-start-help');
  if (!input || !help) return;
  input.value = state.settings.planStart || '';
  const start = getPlanStartDate();
  const week = weeksSincePlanStart() + 1;
  const sets = week >= 3 ? '3 series en los principales' : '2 series';
  const origin = state.settings.planStart ? 'Fecha puesta a mano' : 'Vacío = desde tu primer entreno con este plan';
  help.textContent = start
    ? `${origin} · Inicio: ${formatDateString(start)} · Semana ${week}: ${sets}.`
    : `${origin} (aún no hay ninguno) · Semana 1: 2 series.`;
}

function saveAppSettings() {
  const selectedDays = [];
  document.querySelectorAll('.day-checkbox-label input:checked').forEach(cb => {
    selectedDays.push(parseInt(cb.value));
  });

  const userHeight = parseInt(document.getElementById('input-user-height').value) || 174;
  const userAge = parseInt(document.getElementById('input-user-age').value) || null;
  // null (no borrar la clave): la nube fusiona los ajustes y la recuperaría
  const planStart = document.getElementById('input-plan-start').value || null;
  const notifyTime = document.getElementById('input-alert-time').value;
  const soundEnabled = document.getElementById('toggle-sound').checked;
  const notificationsEnabled = document.getElementById('toggle-push').checked;

  state.settings.scheduleDays = selectedDays;
  state.settings.userHeight = userHeight;
  state.settings.userAge = userAge;
  state.settings.planStart = planStart;
  state.settings.notifyTime = notifyTime;
  state.settings.soundEnabled = soundEnabled;
  state.settings.notificationsEnabled = notificationsEnabled;

  saveStateToStorage('settings');
  renderPlanStartField();
  updateDashboard();

  // Activar el aviso sin permiso del navegador no serviría de nada: pedirlo ya
  if (notificationsEnabled && "Notification" in window && Notification.permission !== "granted") {
    requestAndTestNotifications();
    return;
  }
  alert("Configuración guardada correctamente.");
}

// Muestra una notificación del sistema. En Android, Chrome no permite
// `new Notification()` (lanza "Illegal constructor"): hay que mostrarla desde
// el service worker. El constructor queda solo para escritorio sin service worker.
async function showAppNotification(title, options = {}) {
  const opts = Object.assign({ icon: 'icon-512.png' }, options);
  const reg = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration() : null;
  if (reg) return reg.showNotification(title, opts);
  new Notification(title, opts);
}

// "Ahora no" en la barra de alertas: no volver a mostrarla en este dispositivo
// (se pueden activar igualmente desde Ajustes)
function dismissPermissionBar() {
  const bar = document.getElementById('alert-permission-bar');
  if (bar) bar.style.display = 'none';
  try { localStorage.setItem('kf_alert_bar_dismissed', '1'); } catch (e) {}
}

// Solicitar permisos de notificación nativos y enviar notificación de prueba
async function requestAndTestNotifications() {
  if (!("Notification" in window)) {
    alert("Este navegador no soporta notificaciones.");
    return;
  }

  const permission = await Notification.requestPermission();
  const bar = document.getElementById('alert-permission-bar');
  if (bar && permission !== 'default') bar.style.display = 'none';

  if (permission !== "granted") {
    alert(permission === "denied"
      ? "Las notificaciones están bloqueadas para esta web. Actívalas en los ajustes del navegador (icono junto a la dirección)."
      : "No se ha concedido el permiso de notificaciones.");
    return;
  }

  state.settings.notificationsEnabled = true;
  const toggle = document.getElementById('toggle-push');
  if (toggle) toggle.checked = true;
  saveStateToStorage('settings');

  try {
    await showAppNotification("🏋️‍♂️ FitActive activado", {
      body: "¡Hola Rafael! Te avisaré a la hora de entreno los días que tengas marcados."
    });
  } catch (err) {
    console.error('No se pudo mostrar la notificación:', err);
    alert("Permiso concedido, pero el navegador no dejó mostrar la notificación de prueba.");
  }
}

// Comprueba si toca avisar de entreno. Se llama cada minuto, pero en segundo
// plano el móvil retrasa ese intervalo, así que no se exige el minuto exacto:
// se avisa una vez al día, hasta 30 min después de la hora fijada.
function checkTrainingNotification() {
  if (!state.settings.notificationsEnabled) return;
  if (!("Notification" in window) || Notification.permission !== "granted") return;

  const now = new Date();
  if (!(state.settings.scheduleDays || []).includes(now.getDay())) return;

  const [targetHour, targetMin] = String(state.settings.notifyTime || '').split(':').map(Number);
  if (isNaN(targetHour)) return;
  const minutesLate = (now.getHours() * 60 + now.getMinutes()) - (targetHour * 60 + (targetMin || 0));
  if (minutesLate < 0 || minutesLate > 30) return;

  const today = getLocalDateString(now);
  if (localStorage.getItem('kf_last_reminder') === today) return;
  // Si ya estás entrenando o ya has entrenado hoy, no hace falta avisar
  const trainedToday = state.history.some(l => !isExtraCardio(l) && (l.date || '').slice(0, 10) === today);
  if (state.currentWorkout || trainedToday) return;

  localStorage.setItem('kf_last_reminder', today);
  showAppNotification("🏋️‍♂️ ¡Hora de entrenar, Rafael!", {
    body: "Es hora de tu rutina de FitActive. ¡Ponte las zapatillas y a por ello!",
    tag: 'fitactive-reminder',
    requireInteraction: true
  }).catch(err => console.error('No se pudo mostrar el aviso de entreno:', err));
}

// Restablecer datos de fábrica: borra el historial aquí, en la nube y (al
// sincronizar) en los demás dispositivos. Sin borrar la nube no sirve: al
// recargar, la sincronización volvería a descargarlo todo.
async function resetAllApplicationData() {
  if (!confirm("🚨 Esto borra TODO tu historial de entrenos y de báscula: en este dispositivo, en la nube y en tus otros dispositivos. No se puede deshacer.\n\nSi quieres guardar una copia, exporta antes el CSV en Informes.\n\n¿Continuar?")) return;
  const typed = prompt('Para confirmar, escribe BORRAR');
  if ((typed || '').trim().toUpperCase() !== 'BORRAR') return;

  const resetAt = Date.now();

  if (window.firebaseDb) {
    try {
      const docRef = getCloudDocRef();
      // Sin conexión, getDoc falla enseguida; setDoc se quedaría esperando
      await window.firebaseGetDoc(docRef);
      // Sin merge: sustituye el documento entero
      await window.firebaseSetDoc(docRef, {
        routines: INITIAL_ROUTINES,
        history: [],
        weight: [],
        settings: { routinesVersion: ROUTINES_VERSION },
        resetAt
      });
    } catch (error) {
      console.error('No se pudo borrar la copia de la nube:', error);
      alert("No se pudo borrar la copia de la nube (¿sin conexión?). No se ha borrado nada: inténtalo de nuevo con internet.");
      return;
    }
  } else if (!confirm("No hay conexión con la nube: solo se borrará este dispositivo, y la copia de la nube volverá a descargarse al sincronizar. ¿Borrar solo este dispositivo?")) {
    return;
  }

  localStorage.clear();
  localStorage.setItem(RESET_SEEN_KEY, String(resetAt));
  location.reload();
}

// ==========================================
// 9. ESCÁNER OCR DE CAPTURAS DE PANTALLA
// ==========================================

function setupOCREventListeners() {
  const dropZone = document.getElementById('ocr-drop-zone');
  const fileInput = document.getElementById('ocr-file-input');

  if (!dropZone || !fileInput) return;

  // Al hacer clic en la zona, activar el selector de archivos
  dropZone.addEventListener('click', () => {
    fileInput.click();
  });

  // Eventos de arrastrar y soltar
  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('dragover');
  });

  dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('dragover');
  });

  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      processOCRImage(files[0]);
    }
  });

  // Evento al elegir archivo manualmente
  fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      processOCRImage(e.target.files[0]);
    }
  });
}

function processOCRImage(file) {
  if (!file.type.startsWith('image/')) {
    alert('Por favor, sube únicamente archivos de imagen (PNG, JPG, JPEG).');
    return;
  }

  const reader = new FileReader();
  reader.readAsDataURL(file);
  reader.onload = () => {
    const dataUrl = reader.result;
    runTesseractOCR(dataUrl);
  };
}

function runTesseractOCR(imageSrc) {
  const progressContainer = document.getElementById('ocr-progress-container');
  const statusLabel = document.getElementById('ocr-progress-status');
  const percentLabel = document.getElementById('ocr-progress-percent');
  const barFill = document.getElementById('ocr-progress-bar-fill');
  const dropZone = document.getElementById('ocr-drop-zone');

  if (!progressContainer || !statusLabel || !percentLabel || !barFill || !dropZone) return;

  // Ocultar zona de carga y mostrar cargador neón
  dropZone.style.display = 'none';
  progressContainer.style.display = 'block';

  statusLabel.textContent = 'Inicializando escáner...';
  percentLabel.textContent = '0%';
  barFill.style.width = '0%';

  // Carga bajo demanda de Tesseract.js (solo cuando se necesita, ahorra ~4MB en la carga inicial)
  const startOCR = () => {
    Tesseract.recognize(
      imageSrc,
      'spa', // Idioma español para las etiquetas de composición corporal
    {
      logger: m => {
        if (m && m.status === 'recognizing text') {
          const percent = Math.round(m.progress * 100);
          statusLabel.textContent = 'Analizando captura de pantalla...';
          percentLabel.textContent = `${percent}%`;
          barFill.style.width = `${percent}%`;
        } else if (m && m.status) {
          const statusTranslations = {
            'loading tesseract core': 'Inicializando núcleo de escaneo...',
            'initializing api': 'Iniciando módulo de lectura...',
            'recognizing text': 'Analizando captura de pantalla...'
          };
          statusLabel.textContent = statusTranslations[m.status] || 'Escaneando...';
        }
      }
    }
  ).then(async ({ data: { text } }) => {
    console.log("=== TEXTO EXTRAÍDO POR OCR ===\n", text);
    
    // Analizar el texto con expresiones regulares
    const heightCm = state.settings.userHeight || null;
    const parsedMetrics = parseAiLinkText(text, heightCm);

    // Si falta la grasa visceral, se relee solo la tabla «Otros indicadores»
    if (parsedMetrics.visceral === null) {
      try {
        statusLabel.textContent = 'Revisando tabla de indicadores...';
        const cropUrl = await cropImageRegion(imageSrc, 0.69, 0.88);
        const { data: { text: tableText } } = await Tesseract.recognize(cropUrl, 'spa');
        console.log("=== TEXTO TABLA INDICADORES ===\n", tableText);
        const extra = parseAiLinkText(tableText, heightCm);
        if (extra.visceral !== null) parsedMetrics.visceral = extra.visceral;
      } catch (e) {
        console.warn('No se pudo releer la tabla de indicadores:', e);
      }
    }
    
    // Inyectar en formulario con efectos visuales
    injectParsedMetrics(parsedMetrics);
    
    // Ocultar cargador y restaurar zona
    progressContainer.style.display = 'none';
    dropZone.style.display = 'flex';
  }).catch(err => {
    console.error("Error en lectura OCR: ", err);
    alert("Error al escanear la imagen de forma local. Por favor, asegúrate de que la captura de pantalla de tu báscula sea nítida e introduce los datos a mano si persiste.");
    progressContainer.style.display = 'none';
    dropZone.style.display = 'flex';
  });
  }; // fin de startOCR

  // Si Tesseract.js ya está cargado, ejecutar directamente
  if (typeof Tesseract !== 'undefined') {
    startOCR();
  } else {
    // Cargar Tesseract.js dinámicamente bajo demanda
    statusLabel.textContent = 'Descargando módulo de escaneo...';
    const script = document.createElement('script');
    // Versión exacta: "@5" bajaría cualquier 5.x nueva sin probar
    script.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';
    script.onload = () => {
      startOCR();
    };
    script.onerror = () => {
      alert('Error descargando el módulo de escaneo OCR. Comprueba tu conexión a internet.');
      progressContainer.style.display = 'none';
      dropZone.style.display = 'flex';
    };
    document.head.appendChild(script);
  }
}

function parseAiLinkText(text, heightCm) {
  const result = {
    weight: null,
    bmi: null,
    fat: null,
    muscle: null,
    leanMass: null,
    visceral: null,
    water: null,
    bodyAge: null
  };

  // Minúsculas, espacios normalizados y sin acentos (el OCR a veces los pierde)
  const cleanText = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ');

  // Cada campo: lista de patrones en orden de preferencia. La etiqueta debe ir
  // seguida de su valor (como mucho 12 caracteres que no sean dígitos), y el
  // valor se valida con un rango razonable para no coger otros números.
  const fields = {
    weight: { re: [/peso actual[^0-9]{0,12}(\d{2,3}[.,]\d)/, /peso(?! est)[^0-9]{0,12}(\d{2,3}[.,]\d)/], min: 30, max: 250 },
    bmi: { re: [/\bimc[^0-9]{0,12}(\d{1,2}[.,]\d)/], min: 10, max: 80 },
    // Porcentaje de grasa: exige "%" para no confundir con "Grasa corporal 60.9kg" (kilos)
    fat: { re: [/porcentaje de grasa[^0-9]{0,20}(\d{1,2}[.,]\d)\s*%/, /grasa corporal[^0-9]{0,12}(\d{1,2}[.,]\d)\s*%/, /porcentaje de grasa[^0-9]{0,20}(\d{1,2}[.,]\d)/], min: 3, max: 70 },
    muscle: { re: [/masa muscular[^0-9]{0,12}(\d{2,3}[.,]\d)/], min: 5, max: 200 },
    leanMass: { re: [/masa corporal magra[^0-9]{0,12}(\d{2,3}[.,]\d)/, /masa magra[^0-9]{0,12}(\d{2,3}[.,]\d)/], min: 10, max: 200 },
    // Grasa visceral: entero, sin decimales (evita "20.0" de la grasa subcutánea)
    visceral: { re: [/grasa visceral[^0-9]{0,12}(\d{1,2})(?![.,]\d)/, /visceral[^0-9]{0,12}(\d{1,2})(?![.,]\d)/], min: 1, max: 60 },
    water: { re: [/humedad[^0-9]{0,12}(\d{1,2}[.,]\d)/, /agua[^0-9]{0,12}(\d{1,2}[.,]\d)/], min: 10, max: 80 },
    // Edad corporal (metabólica), NO la edad real que aparece en la cabecera
    bodyAge: { re: [/edad del cuerpo[^0-9]{0,12}(\d{2})(?!\d)/, /edad corporal[^0-9]{0,12}(\d{2})(?!\d)/], min: 10, max: 99 }
  };

  for (const [key, def] of Object.entries(fields)) {
    for (const re of def.re) {
      const m = cleanText.match(re);
      if (!m) continue;
      const value = parseFloat(m[1].replace(',', '.'));
      if (value >= def.min && value <= def.max) {
        result[key] = key === 'visceral' || key === 'bodyAge' ? Math.round(value) : value;
        break;
      }
    }
  }

  // Respaldos cuando el OCR no lee el valor:
  // - Grasa %: en la báscula, peso = masa magra + grasa (no depende de leer el %)
  if (result.fat === null && result.weight && result.leanMass) {
    const fat = ((result.weight - result.leanMass) / result.weight) * 100;
    if (fat >= 3 && fat <= 70) result.fat = Math.round(fat * 10) / 10;
  }
  // - IMC: peso / altura² (solo si la altura está en Ajustes)
  if (result.bmi === null && result.weight && heightCm) {
    const bmi = result.weight / Math.pow(heightCm / 100, 2);
    if (bmi >= 10 && bmi <= 80) result.bmi = Math.round(bmi * 10) / 10;
  }
  // - Grasa visceral: en la tabla "Otros indicadores", solo esta fila lleva "<N" como referencia
  if (result.visceral === null) {
    const ref = cleanText.match(/(\d{1,2})\s*<\s*\d{1,2}/);
    if (ref) {
      const v = parseInt(ref[1]);
      if (v >= 1 && v <= 60) result.visceral = v;
    }
  }

  return result;
}

// Recorta una franja vertical de la imagen y la amplía (mejor lectura de tablas pequeñas)
function cropImageRegion(src, yFrom, yTo) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const sy = Math.round(img.naturalHeight * yFrom);
      const sh = Math.round(img.naturalHeight * (yTo - yFrom));
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth * 2;
      canvas.height = sh * 2;
      const ctx = canvas.getContext('2d');
      ctx.filter = 'grayscale(100%)';
      ctx.drawImage(img, 0, sy, img.naturalWidth, sh, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = reject;
    img.src = src;
  });
}

function injectParsedMetrics(metrics) {
  const mapping = {
    weight: 'input-body-weight',
    fat: 'input-body-fat',
    bmi: 'input-body-bmi',
    muscle: 'input-body-muscle',
    leanMass: 'input-body-lean',
    visceral: 'input-body-visceral',
    water: 'input-body-water',
    bodyAge: 'input-body-age'
  };

  let count = 0;

  for (const [key, elementId] of Object.entries(mapping)) {
    const val = metrics[key];
    const input = document.getElementById(elementId);
    
    if (input && val !== null && val !== undefined && !isNaN(val)) {
      input.value = val;
      count++;
      
      // Ejecutar animación de parpadeo neón
      input.classList.remove('flash-success-neon');
      void input.offsetWidth; // Recarga de diseño para forzar reinicio CSS
      input.classList.add('flash-success-neon');
      
      // Retirar clase tras terminar animación
      setTimeout(() => {
        input.classList.remove('flash-success-neon');
      }, 2000);
    }
  }

  if (count > 0) {
    alert(`🎉 ¡Lectura local completada! Se han auto-rellenado ${count} datos de tu báscula. Por favor, revisa que los números coincidan con tu captura y pulsa "Guardar Registro".`);
  } else {
    alert(`⚠️ No logramos detectar números legibles que coincidan con las variables de composición corporal. Comprueba que la captura de pantalla sea nítida e introduce los datos a mano.`);
  }
}


// ==========================================
// CÁLCULOS DINÁMICOS Y CALENDARIO
// ==========================================

function calculateDynamicStartWeight(baseWeight, muscle) {
  const latestWeightRecord = state.weightHistory.length > 0 ? state.weightHistory[state.weightHistory.length - 1] : null;
  const userHeight = state.settings.userHeight || 174;
  
  if (!latestWeightRecord) return baseWeight;

  const currentWeight = latestWeightRecord.weight || 148;
  // Edad real (Ajustes). No se usa la «edad corporal» del InBody. Sin dato: 40 = sin corrección
  const age = state.settings.userAge || 40;
  const bodyFat = latestWeightRecord.fat || 40; 

  const lbm = currentWeight * (1 - (bodyFat / 100));
  const ageFactor = age > 40 ? 1 - ((age - 40) * 0.01) : 1;
  const bmi = currentWeight / Math.pow(userHeight / 100, 2);
  const sizeFactor = bmi > 30 ? 1.2 : 1; 

  let multiplier = 1.0;
  switch (muscle) {
    case 'legs': multiplier = lbm * 0.4; break;
    case 'chest':
    case 'back': multiplier = lbm * 0.25; break;
    case 'shoulders': multiplier = lbm * 0.15; break;
    case 'biceps':
    case 'triceps': multiplier = lbm * 0.10; break;
    case 'cardio': return baseWeight; 
    default: multiplier = baseWeight; break;
  }

  let dynamicWeight = multiplier * 0.1 * ageFactor * sizeFactor;
  if (dynamicWeight < baseWeight) dynamicWeight = baseWeight;
  return Math.max(baseWeight, Math.round(dynamicWeight * 2) / 2);
}

// Día tocado en el calendario ("AAAA-MM-DD") o null
let selectedCalendarDate = null;

// Series de un día del calendario, agrupadas por sesión, con peso y
// repeticiones editables y botones para borrar una serie o la sesión entera
function renderCalendarDayDetail() {
  const el = document.getElementById('calendar-day-detail');
  if (!el) return;
  if (!selectedCalendarDate) {
    el.style.display = 'none';
    el.innerHTML = '';
    return;
  }

  const logs = state.history.filter(l => !l._sessionPending && (l.date || '').slice(0, 10) === selectedCalendarDate);
  const head = `
    <div class="day-detail-head">
      <h4>${formatDateWithYear(selectedCalendarDate, { weekday: 'long', day: 'numeric', month: 'long' })}</h4>
      <button type="button" class="btn-icon" data-close-detail aria-label="Cerrar">✕</button>
    </div>`;
  el.style.display = 'block';

  if (logs.length === 0) {
    el.innerHTML = head + '<div class="records-empty">Sin series registradas este día.</div>';
  } else {
    const exercisesById = {};
    state.routines.forEach(r => r.exercises.forEach((ex, i) => { exercisesById[ex.id] = { ex, order: i }; }));

    const sessions = new Map();
    logs.forEach(l => {
      const sid = String(l.sessionId || l.routineId || 'sesion');
      if (!sessions.has(sid)) sessions.set(sid, []);
      sessions.get(sid).push(l);
    });

    el.innerHTML = head + [...sessions.entries()].map(([sid, list]) => {
      const first = list[0];
      const routine = state.routines.find(r => r.id === first.routineId);
      const title = isExtraCardio(first) ? 'Cardio libre' : (routine ? routine.name : (first.routineId || 'Entreno'));
      const orderOf = l => (exercisesById[l.exerciseId] ? exercisesById[l.exerciseId].order : 99);
      const rows = list
        .sort((a, b) => orderOf(a) - orderOf(b) || (a.setIndex || 0) - (b.setIndex || 0))
        .map(l => {
          const ex = exercisesById[l.exerciseId] && exercisesById[l.exerciseId].ex;
          const cardio = isExtraCardio(l) || (ex && ex.muscle === 'cardio');
          const weightField = isExtraCardio(l) ? '' : `
            <label class="day-set-field"><input type="number" step="0.5" min="0" value="${l.weight}" data-field="weight" aria-label="Peso"> ${cardio ? ((ex && ex.intensityUnit) || 'nivel') : 'kg'}</label>`;
          return `
            <div class="day-set-row" data-key="${historyLogKey(l)}">
              <span class="day-set-name">${l.exerciseName || l.exerciseId}<small>Serie ${l.setIndex || 1}</small></span>
              ${weightField}
              <label class="day-set-field"><input type="number" min="0" value="${l.reps}" data-field="reps" aria-label="${cardio ? 'Minutos' : 'Repeticiones'}"> ${cardio ? 'min' : 'reps'}</label>
              <button type="button" class="btn-icon day-set-delete" data-delete-log aria-label="Borrar serie">🗑</button>
            </div>`;
        }).join('');
      return `
        <div class="day-session">
          <div class="day-session-head">
            <strong>${title}</strong>
            <button type="button" class="btn btn-secondary btn-sm btn-danger-soft" data-delete-session="${sid}">Borrar sesión</button>
          </div>
          ${rows}
        </div>`;
    }).join('');
  }

  const findLog = node => {
    const row = node.closest('[data-key]');
    return row ? state.history.find(l => !l._sessionPending && historyLogKey(l) === row.dataset.key) : null;
  };

  // Corregir peso o repeticiones de una serie
  el.onchange = (e) => {
    const input = e.target.closest('input[data-field]');
    if (!input) return;
    const log = findLog(input);
    if (!log) return;
    const field = input.dataset.field;
    const value = field === 'reps' ? parseInt(input.value) : parseFloat(input.value);
    if (!(value >= 0)) {
      input.value = log[field];
      return;
    }
    log[field] = value;
    log.updatedAt = Date.now(); // en la sincronización gana la versión más reciente
    saveStateToStorage('history');
  };

  el.onclick = (e) => {
    if (e.target.closest('[data-close-detail]')) {
      selectedCalendarDate = null;
      renderCalendar();
      return;
    }
    const delLog = e.target.closest('[data-delete-log]');
    if (delLog) {
      const log = findLog(delLog);
      if (log && confirm(`¿Borrar la serie ${log.setIndex || 1} de «${log.exerciseName || log.exerciseId}»?`)) deleteHistoryLogs([log]);
      return;
    }
    const delSession = e.target.closest('[data-delete-session]');
    if (delSession) {
      const sid = delSession.dataset.deleteSession;
      const list = logs.filter(l => String(l.sessionId || l.routineId || 'sesion') === sid);
      if (list.length && confirm(`¿Borrar la sesión entera (${list.length} ${list.length === 1 ? 'serie' : 'series'})? No se puede deshacer.`)) deleteHistoryLogs(list);
    }
  };
}

// Borra series del historial dejando constancia, para que la sincronización
// no las vuelva a traer de la nube o de otro dispositivo
function deleteHistoryLogs(logs) {
  const now = Date.now();
  const keys = new Set(logs.map(historyLogKey));
  keys.forEach(k => { state.deleted.history[k] = now; });
  state.history = state.history.filter(l => l._sessionPending || !keys.has(historyLogKey(l)));
  saveStateToStorage('history');
  renderCalendar();
  updateDashboard();
}

let currentDate = new Date();
let currentMonth = currentDate.getMonth();
let currentYear = currentDate.getFullYear();

function renderCalendar() {
  const monthYearEl = document.getElementById('calendar-month-year');
  const daysEl = document.getElementById('calendar-days');
  const summaryEl = document.getElementById('calendar-summary');
  if (!monthYearEl || !daysEl) return;

  const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  monthYearEl.textContent = months[currentMonth] + ' ' + currentYear;

  const monthPrefix = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
  const todayStr = getLocalDateString();
  const scheduleDays = (state.settings && state.settings.scheduleDays || []).map(Number);

  // Letra de rutina ("A", "B"...) a partir del nombre "Día A: ..."
  const routineLetter = {};
  state.routines.forEach(r => {
    routineLetter[r.id] = r.name.split(':')[0].replace(/^D[ií]a\s*/i, '').trim();
  });

  // Rutinas hechas cada día del mes visible
  const workoutsByDay = {};
  state.history.filter(h => !isExtraCardio(h)).forEach(h => {
    const day = (h.date || '').slice(0, 10);
    if (!day.startsWith(monthPrefix)) return;
    if (!workoutsByDay[day]) workoutsByDay[day] = new Set();
    if (h.routineId) workoutsByDay[day].add(h.routineId);
  });

  const firstDay = new Date(currentYear, currentMonth, 1).getDay();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const startDay = firstDay === 0 ? 6 : firstDay - 1;

  let html = '<div class="cal-day empty"></div>'.repeat(startDay);

  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${monthPrefix}-${String(day).padStart(2, '0')}`;
    const routinesDone = workoutsByDay[dateStr];
    const classes = ['cal-day'];
    let tag = '';

    if (routinesDone) {
      classes.push('workout-day');
      tag = [...routinesDone].map(id => routineLetter[id] || '').join('');
    } else if (dateStr > todayStr && scheduleDays.includes(new Date(currentYear, currentMonth, day).getDay())) {
      classes.push('planned');
    }
    if (dateStr === todayStr) classes.push('today');
    if (dateStr === selectedCalendarDate) classes.push('selected');

    html += `<button type="button" class="${classes.join(' ')}" data-date="${dateStr}" aria-label="${formatDateWithYear(dateStr, { day: 'numeric', month: 'long' })}"><span class="cal-num">${day}</span>${tag ? `<span class="cal-tag">${tag}</span>` : ''}</button>`;
  }

  daysEl.innerHTML = html;

  // Tocar un día muestra sus series (para corregirlas o borrarlas)
  daysEl.onclick = (e) => {
    const cell = e.target.closest('.cal-day[data-date]');
    if (!cell) return;
    selectedCalendarDate = selectedCalendarDate === cell.dataset.date ? null : cell.dataset.date;
    renderCalendar();
  };
  if (selectedCalendarDate && !selectedCalendarDate.startsWith(monthPrefix)) selectedCalendarDate = null;
  renderCalendarDayDetail();

  // Resumen del mes: días entrenados y reparto por rutina
  if (summaryEl) {
    const trainedDays = Object.keys(workoutsByDay).length;
    const perRoutine = {};
    Object.values(workoutsByDay).forEach(set => set.forEach(id => {
      perRoutine[id] = (perRoutine[id] || 0) + 1;
    }));
    const routineChips = state.routines
      .filter(r => perRoutine[r.id])
      .map(r => `<span class="cal-chip">Día ${routineLetter[r.id]} <strong>×${perRoutine[r.id]}</strong></span>`)
      .join('');

    summaryEl.innerHTML = `
      <div class="cal-stat"><strong>${trainedDays}</strong> ${trainedDays === 1 ? 'día entrenado' : 'días entrenados'} en ${months[currentMonth].toLowerCase()}</div>
      ${routineChips ? `<div class="cal-chips">${routineChips}</div>` : ''}
    `;
  }
}
