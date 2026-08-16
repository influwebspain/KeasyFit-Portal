// Controlador de Gráficos de Rendimiento y Peso - KeasyFit

let weightChartInstance = null;
let strengthChartInstance = null;
let volumeChartInstance = null;

// Configuración común de estilos para Chart.js
const chartStyles = {
  fontFamily: "'Inter', sans-serif",
  gridColor: 'rgba(255, 255, 255, 0.05)',
  textColor: '#8e9aa8',
  tooltipBg: '#12141a',
  tooltipBorder: 'rgba(255, 255, 255, 0.1)'
};

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
    weight: { label: 'Peso Corporal (kg)', color: '#00f0ff', key: 'weight' },
    fat: { label: 'Grasa Corporal (%)', color: '#ff5a00', key: 'fat' },
    bmi: { label: 'Índice de Masa Corporal (IMC)', color: '#ff3b30', key: 'bmi' },
    muscle: { label: 'Masa Muscular (kg)', color: '#ccff00', key: 'muscle' },
    leanMass: { label: 'Masa Corporal Magra (kg)', color: '#a0aec0', key: 'leanMass' },
    visceral: { label: 'Grasa Visceral (Índice)', color: '#e53e3e', key: 'visceral' },
    water: { label: 'Agua Corporal (%)', color: '#4299e1', key: 'water' },
    bodyAge: { label: 'Edad Corporal (años)', color: '#9f7aea', key: 'bodyAge' }
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
          pointBorderColor: '#08090c',
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
          labels: {
            color: chartStyles.textColor,
            font: { family: chartStyles.fontFamily, size: 12 }
          }
        },
        tooltip: {
          backgroundColor: chartStyles.tooltipBg,
          borderColor: chartStyles.tooltipBorder,
          borderWidth: 1,
          titleColor: '#fff',
          bodyColor: '#e2e8f0',
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
            display: true,
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
  strengthGrad.addColorStop(0, 'rgba(204, 255, 0, 0.25)');
  strengthGrad.addColorStop(1, 'rgba(204, 255, 0, 0.0)');

  strengthChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [
        {
          label: `Peso Máximo (${exerciseName})`,
          data: weights,
          borderColor: '#ccff00',
          backgroundColor: strengthGrad,
          borderWidth: 3,
          fill: true,
          tension: 0.2,
          pointBackgroundColor: '#ccff00',
          pointBorderColor: '#08090c',
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
            display: true,
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
  
  history.forEach(log => {
    const dateObj = new Date(log.date);
    const weekNum = getWeekNumber(dateObj);
    const weekKey = `Semana ${weekNum} (${dateObj.getFullYear()})`;
    
    const repsNum = parseInt(log.reps) || 0;
    const weightNum = parseFloat(log.weight) || 0;
    const volume = repsNum * weightNum;

    if (!volumePerWeek[weekKey]) {
      volumePerWeek[weekKey] = 0;
    }
    volumePerWeek[weekKey] += volume;
  });

  const sortedWeeks = Object.keys(volumePerWeek).sort();
  const labels = sortedWeeks;
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
          backgroundColor: 'rgba(255, 90, 0, 0.4)',
          borderColor: '#ff5a00',
          borderWidth: 2,
          borderRadius: 6,
          hoverBackgroundColor: '#ff5a00'
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
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
            display: true,
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
