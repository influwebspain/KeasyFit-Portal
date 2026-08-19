// Controlador Principal de la Aplicación - KeasyFit

// Estado global de la aplicación
let state = {
  routines: [],
  history: [],
  weightHistory: [],
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

  // Pre-renderizar paneles de entrenamientos y editor para que estén listos
  try { renderWorkoutsList(); } catch(e) { console.error('Error pre-renderizando workouts:', e); }
  try { renderEditorPanel(); } catch(e) { console.error('Error pre-renderizando editor:', e); }

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
    const fakeDates = ["2026-04-27", "2026-05-11", "2026-05-25", "2026-06-08", "2026-06-22"];
    const originalLength = state.weightHistory.length;
    state.weightHistory = state.weightHistory.filter(w => !fakeDates.includes(w.date));
    
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
}

// Guardar solo en localStorage (sin red, para la carga inicial rápida)
function saveLocalStorageOnly(key) {
  if (key === 'routines' || !key) localStorage.setItem('kf_routines', JSON.stringify(state.routines));
  if (key === 'history' || !key) localStorage.setItem('kf_history', JSON.stringify(state.history));
  if (key === 'weight' || !key) localStorage.setItem('kf_weight', JSON.stringify(state.weightHistory));
  if (key === 'settings' || !key) localStorage.setItem('kf_settings', JSON.stringify(state.settings));
}

// SINCRONIZACIÓN EN SEGUNDO PLANO: Descarga datos de Firebase sin bloquear UI
async function syncFromFirebaseInBackground() {
  try {
    // Esperar a que Firebase esté listo (máximo 3 segundos, NO bloqueante)
    let retries = 0;
    while (!window.firebaseDb && retries < 30) {
      await new Promise(r => setTimeout(r, 100));
      retries++;
    }

    if (!window.firebaseDb) {
      console.log('Firebase no disponible, usando solo datos locales.');
      return;
    }

    const docRef = window.firebaseDoc(window.firebaseDb, "users", "defaultUser");
    const docSnap = await window.firebaseGetDoc(docRef);
    
    if (docSnap.exists()) {
      const data = docSnap.data();
      let needsRefresh = false;

      // Solo actualizar si Firebase tiene datos más recientes
      if (data.routines && data.routines.length > 0) {
        const localRoutinesStr = JSON.stringify(state.routines);
        const fbRoutinesStr = JSON.stringify(data.routines);
        if (localRoutinesStr !== fbRoutinesStr) {
          state.routines = data.routines;
          localStorage.setItem('kf_routines', JSON.stringify(state.routines));
          needsRefresh = true;
        }
      }

      if (data.history && data.history.length > state.history.length) {
        state.history = data.history;
        localStorage.setItem('kf_history', JSON.stringify(state.history));
        needsRefresh = true;
      }

      if (data.weight && data.weight.length > state.weightHistory.length) {
        state.weightHistory = data.weight;
        localStorage.setItem('kf_weight', JSON.stringify(state.weightHistory));
        needsRefresh = true;
      }

      if (data.settings) {
        state.settings = data.settings;
        localStorage.setItem('kf_settings', JSON.stringify(state.settings));
      }

      // Si hubo cambios desde Firebase, re-renderizar las vistas silenciosamente
      if (needsRefresh) {
        console.log('Datos actualizados desde Firebase en segundo plano.');
        try { renderWorkoutsList(); } catch(e) {}
        try { renderEditorPanel(); } catch(e) {}
        try { updateDashboard(); } catch(e) {}
      }
    }
  } catch (error) {
    console.error('Error sincronizando Firebase en segundo plano:', error);
  }
}

// Guardado de datos asíncrono
async function saveStateToStorage(key) {
  // Guardar en localStorage como backup offline
  if (key === 'routines' || !key) {
    localStorage.setItem('kf_routines', JSON.stringify(state.routines));
  }
  if (key === 'history' || !key) {
    localStorage.setItem('kf_history', JSON.stringify(state.history));
  }
  if (key === 'weight' || !key) {
    localStorage.setItem('kf_weight', JSON.stringify(state.weightHistory));
  }
  if (key === 'settings' || !key) {
    localStorage.setItem('kf_settings', JSON.stringify(state.settings));
  }

  // Guardar en Firebase
  try {
    if (window.firebaseDb) {
      const docRef = window.firebaseDoc(window.firebaseDb, "users", "defaultUser");
      await window.firebaseSetDoc(docRef, {
        routines: state.routines,
        history: state.history,
        weight: state.weightHistory,
        settings: state.settings
      }, { merge: true });
    }
  } catch (error) {
    console.error("Error guardando datos en Firebase:", error);
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
    } else if (tabId === 'editor') {
      renderEditorPanel();
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
        weightForm.reset();
        document.getElementById('input-weight-date').value = new Date().toISOString().split('T')[0];
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

  // Cerrar Modales
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        overlay.classList.remove('active');
      }
    });
  });
}

// ==========================================
// 1. LÓGICA DEL DASHBOARD
// ==========================================

function updateDashboard() {
  // 1. Racha de entrenamientos (workouts en días seguidos)
  const streak = calculateWorkoutStreak();
  document.getElementById('widget-streak').textContent = `${streak} Días`;

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

function calculateWorkoutStreak() {
  if (state.history.length === 0) return 0;
  
  // Obtener fechas de entrenamiento únicas ordenadas
  const dates = [...new Set(state.history.map(h => h.date))].sort((a,b) => new Date(b) - new Date(a));
  
  let streak = 0;
  let today = new Date();
  today.setHours(0,0,0,0);
  
  let currentCheck = today;
  
  // Si no entrenó hoy ni ayer, racha es 0
  const latestWorkoutDate = new Date(dates[0]);
  latestWorkoutDate.setHours(0,0,0,0);
  const diffTime = Math.abs(today - latestWorkoutDate);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays > 1 && dates.length > 0) {
    return 0;
  }

  for (let i = 0; i < dates.length; i++) {
    const workoutDate = new Date(dates[i]);
    workoutDate.setHours(0,0,0,0);
    
    const diff = Math.abs(currentCheck - workoutDate);
    const diffD = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (diffD <= 1) {
      streak++;
      currentCheck = workoutDate;
    } else {
      break;
    }
  }
  
  return streak;
}

function calculateTotalWorkouts() {
  // Contamos entrenamientos únicos completados (agrupados por fecha y rutina)
  const uniqueWorkouts = {};
  state.history.forEach(log => {
    const key = `${log.date}_${log.routineId || 'default'}`;
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
  
  if (state.history.length > 0) {
    // Buscar el último log
    const lastLogs = [...state.history].sort((a, b) => new Date(b.date) - new Date(a.date));
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

  // Inicializar estado del entrenamiento actual
  state.currentWorkout = {
    routineId: routineId,
    routineName: routine.name,
    startTime: new Date(),
    exercises: JSON.parse(JSON.stringify(routine.exercises)), // copia profunda
    currentIndex: 0,
    logs: [] // almacena logs de cada ejercicio completado
  };

  // Cambiar a la vista de entrenar
  switchTab('workouts');
  
  // Ocultar lista de rutinas, mostrar panel de reproducción de ejercicio
  document.getElementById('routines-selection-area').style.display = 'none';
  
  const focusArea = document.getElementById('workout-focus-area');
  focusArea.style.display = 'block';
  
  renderActiveExercise();
}

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
    
    // Fallbacks por grupos musculares
    'back': 'https://cdn.jsdelivr.net/gh/JahelCuadrado/ExerciseGymGifsDB@v1.1.0/upper-back/cable-seated-row.gif',
    'biceps': 'https://cdn.jsdelivr.net/gh/JahelCuadrado/ExerciseGymGifsDB@v1.1.0/biceps/dumbbell-biceps-curl.gif',
    'triceps': 'https://cdn.jsdelivr.net/gh/JahelCuadrado/ExerciseGymGifsDB@v1.1.0/triceps/cable-pushdown.gif',
    'chest': 'https://cdn.jsdelivr.net/gh/JahelCuadrado/ExerciseGymGifsDB@v1.1.0/pectorals/barbell-bench-press.gif',
    'shoulders': 'https://cdn.jsdelivr.net/gh/JahelCuadrado/ExerciseGymGifsDB@v1.1.0/delts/dumbbell-lateral-raise.gif',
    'legs': 'https://cdn.jsdelivr.net/gh/JahelCuadrado/ExerciseGymGifsDB@v1.1.0/quads/lever-leg-extension.gif',
    'cardio': 'https://cdn.jsdelivr.net/gh/JahelCuadrado/ExerciseGymGifsDB@v1.1.0/quads/lever-leg-extension.gif'
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
      <div class="video-cover-card" style="cursor: default; padding: 0; background: #0a0b0e; border: 1px solid rgba(0, 240, 255, 0.1);">
        <img src="${gifUrl}" alt="${exercise.name}" style="width:100%; height:100%; object-fit:contain;" onerror="this.onerror=null; this.src='${fallbackUrl}';">
        <div style="position: absolute; bottom: 0; left: 0; right: 0; background: linear-gradient(0deg, rgba(10,11,14,0.95) 0%, rgba(10,11,14,0) 100%); padding: 1.5rem 1rem 0.8rem; border-radius: 0 0 12px 12px; text-align: center; z-index: 5;">
          <div class="video-cover-text">${exercise.name}</div>
          <div class="video-cover-sub">Ilustración de Movimiento (Pasos)</div>
        </div>
      </div>
    `;
  } else {
    videoWrapper.innerHTML = `
      <div class="video-cover-card" style="background-image: linear-gradient(180deg, rgba(10,11,14,0.1) 0%, rgba(10,11,14,0.85) 100%), url('${fallbackUrl}'); cursor: default;">
        <div class="video-cover-text">${exercise.name}</div>
        <div class="video-cover-sub">Ilustración Guía de Técnica</div>
      </div>
    `;
  }

  // Recomendación del Entrenador Personal e Historial
  const lastLogInfo = getPreviousExerciseLog(exercise.id);
  const recommendationBox = document.getElementById('coach-recommendation');
  
  let suggestedWeight = calculateDynamicStartWeight(exercise.startWeight, exercise.muscle);
  let coachMessage = "";

  if (lastLogInfo) {
    const lastWeight = lastLogInfo.weight;
    const difficulty = lastLogInfo.difficulty;

    if (difficulty === 'facil') {
      // Progresión de carga cautelosa para principiantes
      if (exercise.muscle === 'biceps' || exercise.muscle === 'shoulders') {
        suggestedWeight = lastWeight + 1; // +1kg para mancuernas ligeras
      } else {
        suggestedWeight = lastWeight + 2.5; // +2.5kg para poleas/máquinas
      }
      coachMessage = `¡Excelente entrenamiento anterior! Sentiste los <strong>${lastWeight} kg</strong> muy ligeros. Te recomiendo subir un escalón a <strong>${suggestedWeight} kg</strong> hoy. Mantén el movimiento controlado.`;
    } else if (difficulty === 'duro') {
      suggestedWeight = Math.max(0, lastWeight - 2.5);
      coachMessage = `El entrenamiento anterior con <strong>${lastWeight} kg</strong> estuvo al límite. Para cuidar tus articulaciones y asegurar una técnica perfecta, te aconsejo bajar a <strong>${suggestedWeight} kg</strong> hoy.`;
    } else {
      suggestedWeight = lastWeight;
      coachMessage = `Buen ritmo. Los <strong>${lastWeight} kg</strong> del entreno anterior estuvieron adecuados. Mantén el mismo peso hoy para consolidar la técnica antes de subir.`;
    }
  } else {
    coachMessage = `¡Bienvenido a este ejercicio! Como estamos empezando, te sugiero un peso de partida muy seguro y liviano: <strong>${suggestedWeight} kg</strong>. Concéntrate en la técnica lenta.`;
  }

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
        <span>kg</span>
      </div>
      <div class="set-input-group">
        <input type="number" class="form-input reps-input" data-set="${i}" value="${parseInt(exercise.reps) || 10}" min="1">
        <span>reps</span>
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
}

function getPreviousExerciseLog(exerciseId) {
  // Buscar en el historial de forma inversa (más reciente primero)
  const sortedHistory = [...state.history].sort((a,b) => new Date(b.date) - new Date(a.date));
  return sortedHistory.find(log => log.exerciseId === exerciseId);
}

function handleNextExerciseClick() {
  const workout = state.currentWorkout;
  const exercise = workout.exercises[workout.currentIndex];
  
  // Guardar logs de este ejercicio
  const weightInputs = document.querySelectorAll('.weight-input');
  const repsInputs = document.querySelectorAll('.reps-input');
  const difficulty = document.querySelector('.difficulty-btn.selected').getAttribute('data-diff');
  
  const todayStr = new Date().toISOString().split('T')[0];

  weightInputs.forEach((input, index) => {
    const weightVal = parseFloat(input.value) || 0;
    const repsVal = parseInt(repsInputs[index].value) || 0;
    
    const logEntry = {
      date: todayStr,
      routineId: workout.routineId,
      exerciseId: exercise.id,
      exerciseName: exercise.name,
      setIndex: index + 1,
      reps: repsVal,
      weight: weightVal,
      difficulty: difficulty
    };
    
    state.history.push(logEntry);
    // Marcar como entrada de sesión activa (no confirmada)
    logEntry._sessionPending = true;
  });

  // NO guardar a localStorage todavía — solo se persiste al completar el entrenamiento

  // Si es el último ejercicio del entrenamiento
  if (workout.currentIndex === workout.exercises.length - 1) {
    completeWorkoutSession();
  } else {
    // Iniciar temporizador de descanso si no es cardio (en cardio, rest = 0)
    const restTime = exercise.rest || 0;
    if (restTime > 0) {
      startRestTimer(restTime);
    } else {
      advanceExercise();
    }
  }
}

function advanceExercise() {
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
  currentTimerCallback = onComplete || function() { advanceExercise(); };
  const overlay = document.getElementById('rest-timer-overlay');
  const timerNum = document.getElementById('timer-number');
  const timerCircle = document.getElementById('timer-ring-circle');
  
  overlay.classList.add('active');
  
  let timeLeft = seconds;
  const totalTime = seconds;
  timerNum.textContent = timeLeft;
  if (timerCircle) timerCircle.style.strokeDashoffset = "0";

  if (timerInterval) clearInterval(timerInterval);
  
  timerInterval = setInterval(() => {
    timeLeft--;
    timerNum.textContent = timeLeft;
    
    // Actualizar anillo SVG (dasharray es 100)
    if (timerCircle) {
      const percentage = (timeLeft / totalTime) * 100;
      timerCircle.style.strokeDashoffset = 100 - percentage;
    }
    
    // Reproducir micro-bip en los últimos 3 segundos
    if (timeLeft <= 3 && timeLeft > 0) {
      playSynthBeep(440, 0.1);
    }

    if (timeLeft <= 0) {
      clearInterval(timerInterval);
      playSynthBeep(880, 0.5); // Bip largo al terminar
      
      // Cerrar modal
      overlay.classList.remove('active');
      
      // Ejecutar callback correspondiente
      if (currentTimerCallback) currentTimerCallback();
    }
  }, 1000);
}

function skipRestTimer() {
  if (timerInterval) clearInterval(timerInterval);
  document.getElementById('rest-timer-overlay').classList.remove('active');
  if (currentTimerCallback) currentTimerCallback();
}

// Sintetizar sonido nativo (Evita problemas de carga de archivos mp3)
function playSynthBeep(frequency, duration) {
  if (!state.settings.soundEnabled) return;

  try {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }

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
  // Renderizar gráfico con la métrica seleccionada
  const canvas = document.getElementById('weight-chart');
  const selectedMetric = document.getElementById('metrics-chart-select')?.value || 'weight';
  if (canvas && typeof renderWeightChart === 'function') {
    renderWeightChart(canvas, state.weightHistory, selectedMetric);
  }

  // Renderizar la tabla comparativa de las últimas 5 mediciones e inicio
  renderInBodyComparisonTable();
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
  
  // Tomar las últimas 4 mediciones (además de la base) para comparar.
  // Si hay pocas, simplemente tomamos todas las que existan
  let compareList = [];
  if (sorted.length > 1) {
    // Tomar las últimas 4 (excluyendo la primera si esta es la única, pero si solo hay 2, compareList tiene 1 elemento)
    const lastEntries = sorted.slice(1);
    compareList = lastEntries.slice(-4); // últimos 4 checkups
  }

  // Definición de las filas y sus configuraciones de comparación
  // key: propiedad, label: nombre fila, better: 'lower' o 'higher'
  const rowSchema = [
    { key: 'weight', label: 'Peso Corporal', unit: 'kg', better: 'lower' },
    { key: 'bmi', label: 'IMC', unit: '', better: 'lower' },
    { key: 'fat', label: 'Grasa Corporal', unit: '%', better: 'lower' },
    { key: 'muscle', label: 'Masa Muscular', unit: 'kg', better: 'higher' },
    { key: 'leanMass', label: 'Masa Magra', unit: 'kg', better: 'higher' },
    { key: 'visceral', label: 'Grasa Visceral', unit: '', better: 'lower' },
    { key: 'water', label: 'Agua / Humedad', unit: '%', better: 'higher' },
    { key: 'bodyAge', label: 'Edad Corporal', unit: 'años', better: 'lower' }
  ];

  let html = `
    <table class="comparison-table">
      <thead>
        <tr>
          <th>Variable InBody</th>
          <th>Base (${formatDateString(base.date)})</th>
  `;

  // Añadir cabeceras para las fechas comparadas
  compareList.forEach(item => {
    html += `<th>${formatDateString(item.date)}</th>`;
  });

  html += `
          <th>Evolución Global</th>
        </tr>
      </thead>
      <tbody>
  `;

  // Construir cada fila de métrica
  rowSchema.forEach(row => {
    const baseVal = base[row.key];
    
    html += `
      <tr>
        <td class="metric-label-col">${row.label}</td>
        <td style="font-family:'Orbitron',sans-serif;font-weight:600;">${baseVal !== undefined && baseVal !== null ? `${baseVal} ${row.unit}` : '-'}</td>
    `;

    // Valores intermedios
    compareList.forEach(item => {
      const val = item[row.key];
      html += `<td style="font-family:'Orbitron',sans-serif;">${val !== undefined && val !== null ? `${val} ${row.unit}` : '-'}</td>`;
    });

    // Calcular cambio global (Base vs Último)
    const latestItem = compareList.length > 0 ? compareList[compareList.length - 1] : base;
    const latestVal = latestItem[row.key];
    
    let deltaHtml = '-';
    if (baseVal !== undefined && baseVal !== null && latestVal !== undefined && latestVal !== null) {
      const diff = latestVal - baseVal;
      const formattedDiff = diff > 0 ? `+${diff.toFixed(1)}` : `${diff.toFixed(1)}`;
      
      if (diff === 0) {
        deltaHtml = `<span class="delta-cell neutral-stable">0.0</span>`;
      } else {
        const isImprovement = (row.better === 'lower' && diff < 0) || (row.better === 'higher' && diff > 0);
        const cellClass = isImprovement ? 'positive-improvement' : 'negative-regression';
        deltaHtml = `<span class="delta-cell ${cellClass}">${formattedDiff} ${row.unit}</span>`;
      }
    }

    html += `
        <td style="background:rgba(255,255,255,0.01);">${deltaHtml}</td>
      </tr>
    `;
  });

  html += `
      </tbody>
    </table>
  `;

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
    bodyAge: bodyAge || null
  };
  
  if (index !== -1) {
    state.weightHistory[index] = record;
  } else {
    state.weightHistory.push(record);
  }

  saveStateToStorage('weight');
}

// ==========================================
// 6. INFORMES Y ESTADÍSTICAS
// ==========================================

function renderReportsPanel() {
  const volumeCanvas = document.getElementById('volume-chart');
  const strengthCanvas = document.getElementById('strength-chart');
  const exerciseSelect = document.getElementById('report-exercise-select');

  if (!volumeCanvas || !strengthCanvas || !exerciseSelect) return;

  // 1. Cargar selector de ejercicios basados en las rutinas actuales
  exerciseSelect.innerHTML = '';
  const addedExercises = {};

  state.routines.forEach(routine => {
    routine.exercises.forEach(ex => {
      if (!addedExercises[ex.id]) {
        const option = document.createElement('option');
        option.value = ex.id;
        option.textContent = ex.name;
        exerciseSelect.appendChild(option);
        addedExercises[ex.id] = ex.name;
      }
    });
  });

  // 2. Dibujar volumen de trabajo
  if (typeof renderVolumeChart === 'function') {
    renderVolumeChart(volumeCanvas, state.history);
  }

  // 3. Dibujar fuerza al cambiar de ejercicio
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

  // 4. Generar el Cuadro General de Fuerza y Progresos del Gimnasio
  renderGeneralGymReport();
}

function renderGeneralGymReport() {
  const tbody = document.getElementById('general-gym-report-tbody');
  if (!tbody) return;

  tbody.innerHTML = '';

  // Obtener todos los ejercicios estructurados de las rutinas actuales del usuario
  const allExercises = [];
  state.routines.forEach(routine => {
    routine.exercises.forEach(ex => {
      // Evitar duplicados
      if (!allExercises.some(item => item.id === ex.id)) {
        allExercises.push(ex);
      }
    });
  });

  if (allExercises.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--text-muted);padding:2rem;">No hay ejercicios en tus rutinas.</td></tr>`;
    return;
  }

  allExercises.forEach(ex => {
    // 1. Carga inicial
    const startWeight = calculateDynamicStartWeight(ex.startWeight, ex.muscle);

    // 2. Encontrar peso máximo levantado en el historial
    const exerciseLogs = state.history.filter(log => log.exerciseId === ex.id);
    let maxWeight = 0;
    let lastDifficulty = '-';
    let lastWeightUsed = 0;

    if (exerciseLogs.length > 0) {
      maxWeight = Math.max(...exerciseLogs.map(l => l.weight || 0));
      
      // Ordenar por fecha desc para ver el último log
      const sortedLogs = [...exerciseLogs].sort((a,b) => new Date(b.date) - new Date(a.date));
      lastDifficulty = sortedLogs[0].difficulty || 'adecuado';
      lastWeightUsed = sortedLogs[0].weight || 0;
    }

    // 3. Progreso neto
    const progress = maxWeight > 0 ? maxWeight - startWeight : 0;
    let progressText = '-';
    let progressClass = '';
    
    if (maxWeight > 0) {
      if (progress > 0) {
        progressText = `+${progress.toFixed(1)} kg`;
        progressClass = 'positive-improvement';
      } else if (progress < 0) {
        progressText = `${progress.toFixed(1)} kg`;
        progressClass = 'negative-regression';
      } else {
        progressText = '0.0 kg';
        progressClass = 'neutral-stable';
      }
    }

    // 4. Siguiente sugerencia (algoritmo entrenador virtual)
    let recommendedWeight = startWeight;
    if (lastWeightUsed > 0) {
      if (lastDifficulty === 'facil') {
        recommendedWeight = lastWeightUsed + (ex.muscle === 'biceps' || ex.muscle === 'shoulders' ? 1 : 2.5);
      } else if (lastDifficulty === 'duro') {
        recommendedWeight = Math.max(0, lastWeightUsed - 2.5);
      } else {
        recommendedWeight = lastWeightUsed;
      }
    }

    // Formatear visualmente
    const tr = document.createElement('tr');
    
    const difficultyLabels = {
      'facil': '😊 Fácil',
      'adecuado': '⚡ Adecuado',
      'duro': '🥵 Duro',
      '-': '-'
    };
    const difficultyBadgeText = difficultyLabels[lastDifficulty] || lastDifficulty;

    tr.innerHTML = `
      <td style="font-weight:600;color:var(--text-main);">${ex.name}</td>
      <td class="muscle-badge-col"><span class="muscle-badge-${ex.muscle}">${ex.muscle}</span></td>
      <td style="font-family:'Orbitron',sans-serif;font-weight:600;color:var(--text-muted);">${startWeight} kg</td>
      <td style="font-family:'Orbitron',sans-serif;font-weight:600;color:var(--text-main);">${maxWeight > 0 ? `${maxWeight} kg` : '-'}</td>
      <td style="font-family:'Orbitron',sans-serif;"><span class="delta-cell ${progressClass}">${progressText}</span></td>
      <td>
        ${lastDifficulty !== '-' ? `<span class="difficulty-badge ${lastDifficulty}">${difficultyBadgeText}</span>` : '-'}
      </td>
      <td style="font-family:'Orbitron',sans-serif;font-weight:700;color:var(--primary);">${recommendedWeight} kg</td>
    `;
    tbody.appendChild(tr);
  });
}

// Exportación del Historial Completo a CSV
function exportDataToCSV() {
  if (state.history.length === 0 && state.weightHistory.length === 0) {
    alert("No hay datos para exportar.");
    return;
  }

  let csvContent = "data:text/csv;charset=utf-8,";
  
  // 1. Sección de Historial de Peso corporal InBody ampliado
  csvContent += "=== REGISTROS DE COMPOSICION CORPORAL INBODY ===\n";
  csvContent += "Fecha,Peso (kg),Grasa (%),IMC,Masa Muscular (kg),Masa Magra (kg),Grasa Visceral,Agua (%),Edad Corporal\n";
  state.weightHistory.forEach(item => {
    csvContent += `"${item.date}",${item.weight},${item.fat || ''},${item.bmi || ''},${item.muscle || ''},${item.leanMass || ''},${item.visceral || ''},${item.water || ''},${item.bodyAge || ''}\n`;
  });

  csvContent += "\n";

  // 2. Sección de Historial de Entrenamiento
  csvContent += "=== HISTORIAL DE ENTRENAMIENTOS ===\n";
  csvContent += "Fecha,Rutina ID,Ejercicio,Serie,Repeticiones,Peso Levantado (kg),Dificultad Percibida\n";
  state.history.forEach(log => {
    csvContent += `"${log.date}","${log.routineId || ''}","${log.exerciseName}",${log.setIndex},${log.reps},${log.weight},"${log.difficulty || ''}"\n`;
  });

  // Codificar y descargar
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", `KeasyFit_Reporte_Rafael_${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  
  link.click();
  document.body.removeChild(link);
}

// ==========================================
// 7. GESTOR Y EDITOR DE RUTINAS (CRUD CADA 4 SEMANAS)
// ==========================================

let activeEditorRoutineId = 'dia1';

function renderEditorPanel() {
  const routineSelector = document.getElementById('editor-routine-selector');
  const tableBody = document.getElementById('editor-table-body');
  
  if (!routineSelector || !tableBody) return;

  // Cargar selector de rutinas
  routineSelector.innerHTML = '';
  state.routines.forEach(r => {
    const btn = document.createElement('button');
    btn.className = `btn ${r.id === activeEditorRoutineId ? 'btn-primary' : ''}`;
    btn.textContent = r.name.split(':')[0]; // "Día 1"
    btn.onclick = () => {
      activeEditorRoutineId = r.id;
      renderEditorPanel();
    };
    routineSelector.appendChild(btn);
  });

  // Cargar ejercicios de la rutina activa en la tabla
  tableBody.innerHTML = '';
  const routine = state.routines.find(r => r.id === activeEditorRoutineId);
  if (!routine) return;

  routine.exercises.forEach((ex, index) => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td style="font-weight:600;">${ex.name}</td>
      <td>${ex.sets}</td>
      <td>${ex.reps}</td>
      <td>${ex.rest}s</td>
      <td> kg</td>
      <td>
        <div class="action-buttons">
          <button class="btn-icon" title="Subir" onclick="moveExercise(${index}, -1)">▲</button>
          <button class="btn-icon" title="Bajar" onclick="moveExercise(${index}, 1)">▼</button>
          <button class="btn-icon danger" title="Eliminar" onclick="deleteExercise(${index})">
            <svg viewBox="0 0 24 24" style="width:16px;height:16px;fill:currentColor;"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
          </button>
        </div>
      </td>
    `;
    tableBody.appendChild(row);
  });
}

function moveExercise(index, direction) {
  const routine = state.routines.find(r => r.id === activeEditorRoutineId);
  const targetIndex = index + direction;
  
  if (targetIndex < 0 || targetIndex >= routine.exercises.length) return;

  // Intercambiar
  const temp = routine.exercises[index];
  routine.exercises[index] = routine.exercises[targetIndex];
  routine.exercises[targetIndex] = temp;

  saveStateToStorage('routines');
  renderEditorPanel();
}

function deleteExercise(index) {
  const routine = state.routines.find(r => r.id === activeEditorRoutineId);
  if (confirm(`¿Estás seguro de eliminar "${routine.exercises[index].name}"?`)) {
    routine.exercises.splice(index, 1);
    saveStateToStorage('routines');
    renderEditorPanel();
  }
}

// Abrir Modal de Añadir Ejercicio
function openAddExerciseModal() {
  const modal = document.getElementById('add-exercise-modal');
  modal.classList.add('active');

  // Llenar selector de tipos de músculos
  const select = document.getElementById('modal-exercise-select');
  select.innerHTML = '<option value="custom">-- Ejercicio Personalizado --</option>';

  // Agregar los ejercicios predefinidos del sistema que no estén ya en la rutina
  const routine = state.routines.find(r => r.id === activeEditorRoutineId);
  const currentIds = routine.exercises.map(ex => ex.id);

  // Lista de todos los ejercicios del data.js que se pueden clonar
  const allInitialExercises = INITIAL_ROUTINES.reduce((acc, r) => [...acc, ...r.exercises], []);
  
  allInitialExercises.forEach(ex => {
    if (!currentIds.includes(ex.id)) {
      const option = document.createElement('option');
      option.value = ex.id;
      option.textContent = `${ex.name} (${ex.muscle})`;
      select.appendChild(option);
    }
  });

  // Alternar inputs al elegir personalizado o predefinido
  select.onchange = () => {
    const customFields = document.getElementById('custom-exercise-fields');
    if (select.value === 'custom') {
      customFields.style.display = 'block';
    } else {
      customFields.style.display = 'none';
    }
  };
}

function saveNewExercise() {
  const select = document.getElementById('modal-exercise-select');
  const routine = state.routines.find(r => r.id === activeEditorRoutineId);
  
  let newExercise = null;

  if (select.value === 'custom') {
    const name = document.getElementById('input-ex-name').value;
    const sets = parseInt(document.getElementById('input-ex-sets').value) || 4;
    const reps = document.getElementById('input-ex-reps').value || "10";
    const rest = parseInt(document.getElementById('input-ex-rest').value) || 60;
    const weight = parseFloat(document.getElementById('input-ex-weight').value) || 10;
    const muscle = document.getElementById('input-ex-muscle').value;
    const video = document.getElementById('input-ex-video').value || "";

    if (!name) {
      alert("Por favor introduce un nombre para el ejercicio.");
      return;
    }

    newExercise = {
      id: `custom_${Date.now()}`,
      name,
      sets,
      reps,
      rest,
      muscle,
      video,
      startWeight: weight,
      notes: "Ejercicio personalizado.",
      patologyNotes: "Entrenar con cuidado y técnica controlada."
    };
  } else {
    // Clonar predefinido de la base de datos INITIAL_ROUTINES
    const allInitialExercises = INITIAL_ROUTINES.reduce((acc, r) => [...acc, ...r.exercises], []);
    const template = allInitialExercises.find(ex => ex.id === select.value);
    
    if (template) {
      newExercise = JSON.parse(JSON.stringify(template));
      // Sobrescribir sets/reps si se desea
      newExercise.sets = parseInt(document.getElementById('input-ex-sets').value) || template.sets;
      newExercise.reps = document.getElementById('input-ex-reps').value || template.reps;
    }
  }

  if (newExercise) {
    routine.exercises.push(newExercise);
    saveStateToStorage('routines');
    document.getElementById('add-exercise-modal').classList.remove('active');
    
    // Reset campos
    document.getElementById('add-ex-form').reset();
    renderEditorPanel();
  }
}

// ==========================================
// 8. CONFIGURACIÓN Y NOTIFICACIONES PUSH
// ==========================================

function renderSettingsPanel() {
  // 1. Seleccionar checkboxes de días
  state.settings.scheduleDays.forEach(day => {
    const cb = document.querySelector(`.day-checkbox-label input[value="${day}"]`);
    if (cb) cb.checked = true;
  });

  // 2. Cargar hora
  document.getElementById('input-alert-time').value = state.settings.notifyTime;
  if (document.getElementById('input-user-height')) document.getElementById('input-user-height').value = state.settings.userHeight || 174;

  // 3. Cargar toggles de audio/alerta
  document.getElementById('toggle-sound').checked = state.settings.soundEnabled;
  document.getElementById('toggle-push').checked = state.settings.notificationsEnabled;
}

function saveAppSettings() {
  const selectedDays = [];
  document.querySelectorAll('.day-checkbox-label input:checked').forEach(cb => {
    selectedDays.push(parseInt(cb.value));
  });

  const userHeight = parseInt(document.getElementById('input-user-height').value) || 174;
  const notifyTime = document.getElementById('input-alert-time').value;
  const soundEnabled = document.getElementById('toggle-sound').checked;
  const notificationsEnabled = document.getElementById('toggle-push').checked;

  state.settings.scheduleDays = selectedDays;
  state.settings.userHeight = userHeight;
  state.settings.notifyTime = notifyTime;
  state.settings.soundEnabled = soundEnabled;
  state.settings.notificationsEnabled = notificationsEnabled;

  saveStateToStorage('settings');
  alert("Configuración guardada correctamente.");
  updateDashboard();
}

// Solicitar permisos de notificación nativos y enviar notificación de prueba
function requestAndTestNotifications() {
  if (!("Notification" in window)) {
    alert("Este navegador no soporta notificaciones de escritorio.");
    return;
  }

  Notification.requestPermission().then(permission => {
    if (permission === "granted") {
      new Notification("🏋️‍♂️ KeasyFit Activado", {
        body: "¡Hola Rafael! Las alertas de entrenamiento están configuradas correctamente.",
        icon: "https://cdn-icons-png.flaticon.com/512/3043/3043231.png" // Icono de mancuerna representativo
      });
      state.settings.notificationsEnabled = true;
      document.getElementById('toggle-push').checked = true;
      saveStateToStorage('settings');
    } else {
      alert("Permiso de notificaciones rechazado.");
    }
  });
}

// Comprueba si a la hora actual le toca entrenar y envía la notificación nativa
function checkTrainingNotification() {
  if (!state.settings.notificationsEnabled) return;
  if (!("Notification" in window) || Notification.permission !== "granted") return;

  const now = new Date();
  const currentDay = now.getDay(); // 0=Domingo, 1=Lunes, etc.
  
  // Comprobar si hoy es día de entrenamiento
  if (!state.settings.scheduleDays.includes(currentDay)) return;

  const [targetHour, targetMin] = state.settings.notifyTime.split(':').map(Number);
  const currentHour = now.getHours();
  const currentMin = now.getMinutes();

  // Comprobar si coincide la hora exacta (se ejecuta una vez por minuto)
  if (currentHour === targetHour && currentMin === targetMin) {
    new Notification("🏋️‍♂️ ¡Hora de Entrenar, Rafael!", {
      body: "Es hora de tu rutina de KeasyFit. ¡Ponte tus zapatillas y a por ello!",
      requireInteraction: true
    });
  }
}

// Restablecer datos completos a valores de fábrica
function resetAllApplicationData() {
  if (confirm("🚨 ¿ATENCIÓN: Estás completamente seguro de borrar TODO tu historial de pesos y rutinas? Esta acción no se puede deshacer.")) {
    localStorage.clear();
    location.reload();
  }
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
  ).then(({ data: { text } }) => {
    console.log("=== TEXTO EXTRAÍDO POR OCR ===\n", text);
    
    // Analizar el texto con expresiones regulares
    const parsedMetrics = parseAiLinkText(text);
    
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
    script.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
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

function parseAiLinkText(text) {
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

  // Convertir a minúsculas y normalizar espacios en blanco
  const cleanText = text.toLowerCase().replace(/\s+/g, ' ');

  // 1. Filtrar Peso (busca "peso actual", "peso" o patrón de 3 cifras seguido de kg)
  const weightMatch = cleanText.match(/(?:peso actual|peso|actual)\s*:?\s*(\d{2,3}[\.,]\d)/i) || cleanText.match(/(\d{2,3}[\.,]\d)\s*kg/i);
  if (weightMatch) {
    result.weight = parseFloat(weightMatch[1].replace(',', '.'));
  }

  // 2. Filtrar IMC
  const imcMatch = cleanText.match(/imc\s*:?\s*(\d{2}[\.,]\d)/i);
  if (imcMatch) {
    result.bmi = parseFloat(imcMatch[1].replace(',', '.'));
  }

  // 3. Filtrar Grasa corporal
  const fatMatch = cleanText.match(/(?:porcent|grasa corporal|porcentaje de grasa)\s*:?\s*(\d{2}[\.,]\d)\s*%/i) || cleanText.match(/(?:porcent|grasa corporal|grasa)\s*:?\s*(\d{2}[\.,]\d)/i);
  if (fatMatch) {
    result.fat = parseFloat(fatMatch[1].replace(',', '.'));
  }

  // 4. Filtrar Masa muscular
  const muscleMatch = cleanText.match(/(?:masa muscular|muscular)\s*:?\s*(\d{2,3}[\.,]\d)/i);
  if (muscleMatch) {
    result.muscle = parseFloat(muscleMatch[1].replace(',', '.'));
  }

  // 5. Filtrar Masa corporal magra
  const leanMatch = cleanText.match(/(?:masa corporal magra|magra|corporal magra)\s*:?\s*(\d{2,3}[\.,]\d)/i);
  if (leanMatch) {
    result.leanMass = parseFloat(leanMatch[1].replace(',', '.'));
  }

  // 6. Filtrar Grasa visceral
  const visceralMatch = cleanText.match(/(?:grasa visceral|indice de gr|visceral)\s*:?\s*(\d{1,2})/i);
  if (visceralMatch) {
    result.visceral = parseInt(visceralMatch[1]);
  }

  // 7. Filtrar Agua / Humedad
  const waterMatch = cleanText.match(/(?:humedad|agua)\s*:?\s*(\d{2}[\.,]\d)/i);
  if (waterMatch) {
    result.water = parseFloat(waterMatch[1].replace(',', '.'));
  }

  // 8. Filtrar Edad corporal
  const ageMatch = cleanText.match(/(?:edad del cu|edad corporal|edad del cuerpo|edad)\s*:?\s*(\d{2})/i);
  if (ageMatch) {
    result.bodyAge = parseInt(ageMatch[1]);
  }

  return result;
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
  const age = latestWeightRecord.age || 41;
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

let currentDate = new Date();
let currentMonth = currentDate.getMonth();
let currentYear = currentDate.getFullYear();

function renderCalendar() {
  const monthYearEl = document.getElementById('calendar-month-year');
  const daysEl = document.getElementById('calendar-days');
  if (!monthYearEl || !daysEl) return;

  const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  monthYearEl.textContent = months[currentMonth] + ' ' + currentYear;
  
  daysEl.innerHTML = '';
  
  const firstDay = new Date(currentYear, currentMonth, 1).getDay();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  
  let startDay = firstDay === 0 ? 6 : firstDay - 1;
  
  for (let i = 0; i < startDay; i++) {
    const emptyDiv = document.createElement('div');
    emptyDiv.className = 'cal-day empty';
    daysEl.appendChild(emptyDiv);
  }
  
  for (let day = 1; day <= daysInMonth; day++) {
    const dayDiv = document.createElement('div');
    dayDiv.className = 'cal-day';
    dayDiv.textContent = day;
    
    const fMonth = String(currentMonth + 1).padStart(2, '0');
    const fDay = String(day).padStart(2, '0');
    const dateStr = currentYear + '-' + fMonth + '-' + fDay;
    
    const workedOut = state.history.some(h => h.date && h.date.startsWith(dateStr));
    if (workedOut) {
      dayDiv.classList.add('workout-day');
      dayDiv.style.backgroundColor = 'var(--primary)';
      dayDiv.style.color = '#000';
      dayDiv.style.fontWeight = 'bold';
    }
    
    const today = new Date();
    if (day === today.getDate() && currentMonth === today.getMonth() && currentYear === today.getFullYear()) {
      dayDiv.style.border = '2px solid var(--accent)';
    }
    
    daysEl.appendChild(dayDiv);
  }
}
