// Controlador de Gráficos de Rendimiento y Peso - FitActive

let weightChartInstance = null;
let strengthChartInstance = null;
let volumeChartInstance = null;

// Configuración común de estilos para Chart.js (tema claro)
const chartStyles = {
  fontFamily: "'Inter', sans-serif",
  gridColor: 'rgba(15, 23, 42, 0.07)',
  textColor: '#64748b',
  tooltipBg: '#ffffff',
  tooltipBorder: 'rgba(15, 23, 42, 0.12)',
  tooltipTitle: '#0f172a',
  tooltipBody: '#334155'
};

// En móvil se ocultan leyenda y títulos de eje: el título de la tarjeta ya
// dice qué se muestra y así el gráfico aprovecha todo el ancho.
function isNarrowScreen() {
  return window.innerWidth <= 768;
}

/**
 * Convierte color hex en formato rgba
 */
function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Renderiza el gráfico de evolución de composición corporal (Peso, Grasa, Músculo, etc.)
 * @param {HTMLCanvasElement} canvas - Canvas element
 * @param {Array} history - Array de objetos de báscula
 * @param {string} selectedMetric - Métrica activa a graficar
 */
function renderWeightChart(canvas, history, selectedMetric = 'weight') {
  if (!canvas) return;
  
  // Destruir instancia previa si existe
  if (weightChartInstance) {
    weightChartInstance.destroy();
  }

  // Ordenar historial por fecha de forma ascendente
  const sortedHistory = [...history].sort((a, b) => new Date(a.date) - new Date(b.date));
  
  const labels = sortedHistory.map(item => formatDateString(item.date));
  
  // Configuración por métrica
  const metricConfigs = {
    weight: { label: 'Peso Corporal (kg)', color: '#2563eb', key: 'weight' },
    fat: { label: 'Grasa Corporal (%)', color: '#f59e0b', key: 'fat' },
    bmi: { label: 'Índice de Masa Corporal (IMC)', color: '#ef4444', key: 'bmi' },
    muscle: { label: 'Masa Muscular (kg)', color: '#10b981', key: 'muscle' },
    leanMass: { label: 'Masa Corporal Magra (kg)', color: '#0d9488', key: 'leanMass' },
    visceral: { label: 'Grasa Visceral (Índice)', color: '#be123c', key: 'visceral' },
    water: { label: 'Agua Corporal (%)', color: '#0ea5e9', key: 'water' },
    bodyAge: { label: 'Edad Corporal (años)', color: '#7c3aed', key: 'bodyAge' }
  };

  const config = metricConfigs[selectedMetric] || metricConfigs.weight;
  const dataPoints = sortedHistory.map(item => item[config.key] || null);

  const ctx = canvas.getContext('2d');
  
  // Crear degradado
  const gradient = ctx.createLinearGradient(0, 0, 0, 300);
  gradient.addColorStop(0, hexToRgba(config.color, 0.25));
  gradient.addColorStop(1, hexToRgba(config.color, 0.0));

  weightChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [
        {
          label: config.label,
          data: dataPoints,
          borderColor: config.color,
          backgroundColor: gradient,
          borderWidth: 3,
          fill: true,
          tension: 0.3,
          pointBackgroundColor: config.color,
          pointBorderColor: '#ffffff',
          pointHoverRadius: 7,
          pointRadius: 5
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: !isNarrowScreen(),
          labels: {
            color: chartStyles.textColor,
            font: { family: chartStyles.fontFamily, size: 12 }
          }
        },
        tooltip: {
          backgroundColor: chartStyles.tooltipBg,
          borderColor: chartStyles.tooltipBorder,
          borderWidth: 1,
          titleColor: chartStyles.tooltipTitle,
          bodyColor: chartStyles.tooltipBody,
          titleFont: { family: chartStyles.fontFamily, weight: 'bold' },
          bodyFont: { family: chartStyles.fontFamily }
        }
      },
      scales: {
        x: {
          grid: { color: chartStyles.gridColor },
          ticks: { color: chartStyles.textColor, font: { family: chartStyles.fontFamily } }
        },
        y: {
          grid: { color: chartStyles.gridColor },
          ticks: { color: chartStyles.textColor, font: { family: chartStyles.fontFamily } },
          title: {
            display: !isNarrowScreen(),
            text: config.label,
            color: chartStyles.textColor,
            font: { family: chartStyles.fontFamily, weight: 'bold' }
          }
        }
      }
    }
  });
}

/**
 * Renderiza el gráfico de evolución de fuerza (Peso Máximo) de un ejercicio
 * @param {HTMLCanvasElement} canvas - Canvas element
 * @param {Array} history - Array de logs de entrenamiento
 * @param {string} exerciseName - Nombre del ejercicio
 */
function renderStrengthChart(canvas, history, exerciseName) {
  if (!canvas) return;
  
  if (strengthChartInstance) {
    strengthChartInstance.destroy();
  }

  // Agrupar por fecha y obtener el peso máximo
  const maxWeightPerDate = {};
  history.forEach(log => {
    if (!maxWeightPerDate[log.date] || log.weight > maxWeightPerDate[log.date]) {
      maxWeightPerDate[log.date] = log.weight;
    }
  });

  const sortedDates = Object.keys(maxWeightPerDate).sort((a, b) => new Date(a) - new Date(b));
  const labels = sortedDates.map(date => formatDateString(date));
  const weights = sortedDates.map(date => maxWeightPerDate[date]);

  const ctx = canvas.getContext('2d');
  
  const strengthGrad = ctx.createLinearGradient(0, 0, 0, 300);
  strengthGrad.addColorStop(0, 'rgba(37, 99, 235, 0.22)');
  strengthGrad.addColorStop(1, 'rgba(37, 99, 235, 0.0)');

  strengthChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [
        {
          label: `Peso Máximo (${exerciseName})`,
          data: weights,
          borderColor: '#2563eb',
          backgroundColor: strengthGrad,
          borderWidth: 3,
          fill: true,
          tension: 0.2,
          pointBackgroundColor: '#2563eb',
          pointBorderColor: '#ffffff',
          pointHoverRadius: 7,
          pointRadius: 5
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: !isNarrowScreen(),
          labels: {
            color: chartStyles.textColor,
            font: { family: chartStyles.fontFamily }
          }
        },
        tooltip: {
          backgroundColor: chartStyles.tooltipBg,
          borderColor: chartStyles.tooltipBorder,
          borderWidth: 1
        }
      },
      scales: {
        x: {
          grid: { color: chartStyles.gridColor },
          ticks: { color: chartStyles.textColor, font: { family: chartStyles.fontFamily } }
        },
        y: {
          grid: { color: chartStyles.gridColor },
          ticks: { color: chartStyles.textColor, font: { family: chartStyles.fontFamily } },
          title: {
            display: !isNarrowScreen(),
            text: 'Peso Levantado (kg)',
            color: chartStyles.textColor,
            font: { family: chartStyles.fontFamily, weight: 'bold' }
          }
        }
      }
    }
  });
}

/**
 * Renderiza el volumen total levantado por semana
 * @param {HTMLCanvasElement} canvas - Canvas element
 * @param {Array} history - Historial de entrenamientos
 */
function renderVolumeChart(canvas, history) {
  if (!canvas) return;

  if (volumeChartInstance) {
    volumeChartInstance.destroy();
  }

  // Agrupar por semana
  const volumePerWeek = {};
  
  // Clave "AAAA-SS" con ceros para que el orden alfabético sea cronológico
  const weekLabels = {};
  history.forEach(log => {
    const dateObj = new Date(log.date);
    const weekNum = getWeekNumber(dateObj);
    const weekKey = `${dateObj.getFullYear()}-${String(weekNum).padStart(2, '0')}`;
    weekLabels[weekKey] = `Sem ${weekNum}`;
    
    const repsNum = parseInt(log.reps) || 0;
    const weightNum = parseFloat(log.weight) || 0;
    const volume = repsNum * weightNum;

    if (!volumePerWeek[weekKey]) {
      volumePerWeek[weekKey] = 0;
    }
    volumePerWeek[weekKey] += volume;
  });

  const sortedWeeks = Object.keys(volumePerWeek).sort();
  const labels = sortedWeeks.map(week => weekLabels[week]);
  const volumes = sortedWeeks.map(week => volumePerWeek[week]);

  const ctx = canvas.getContext('2d');

  volumeChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Volumen Levantado (kg total)',
          data: volumes,
          backgroundColor: 'rgba(16, 185, 129, 0.35)',
          borderColor: '#10b981',
          borderWidth: 2,
          borderRadius: 6,
          hoverBackgroundColor: '#10b981'
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: !isNarrowScreen(),
          labels: {
            color: chartStyles.textColor,
            font: { family: chartStyles.fontFamily }
          }
        },
        tooltip: {
          backgroundColor: chartStyles.tooltipBg,
          borderColor: chartStyles.tooltipBorder,
          borderWidth: 1
        }
      },
      scales: {
        x: {
          grid: { color: 'transparent' },
          ticks: { color: chartStyles.textColor, font: { family: chartStyles.fontFamily } }
        },
        y: {
          grid: { color: chartStyles.gridColor },
          ticks: { color: chartStyles.textColor, font: { family: chartStyles.fontFamily } },
          title: {
            display: !isNarrowScreen(),
            text: 'Tonelaje total (kg)',
            color: chartStyles.textColor,
            font: { family: chartStyles.fontFamily, weight: 'bold' }
          }
        }
      }
    }
  });
}

// Funciones Auxiliares para fechas

function formatDateString(dateStr) {
  const dateObj = new Date(dateStr);
  if (isNaN(dateObj)) return dateStr;
  return dateObj.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
}

function getWeekNumber(d) {
  d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return weekNo;
}
