// Datos Iniciales de la Rutina y Asistencias de KeasyFit

// Versión del plan de entrenamiento. Al subirla, la app sustituye las rutinas
// antiguas (local y Firebase) por las de este archivo.
const ROUTINES_VERSION = 2;

// PLAN DE RETORNO AL ENTRENAMIENTO — Joel Cabado (Personal Trainer)
// 3 días/semana, cuerpo completo, máquinas/poleas/cardio.
// Semanas 1-2: 2 series, RPE 5-6. Semanas 3-4: añadir 1 serie si se recupera bien.
// Respetar siempre las indicaciones del fisioterapeuta y del equipo médico.
const INITIAL_ROUTINES = [
  {
    id: "dia1",
    name: "Día A: Cuerpo Completo",
    muscles: "Máquinas, poleas y cardio · Retorno progresivo",
    exercises: [
      {
        id: "prensa_piernas",
        name: "Prensa de piernas",
        sets: 2,
        reps: "10-12",
        rest: 90,
        muscle: "legs",
        startWeight: 20,
        notes: "Recorrido cómodo y controlado. No bloquees las rodillas arriba ni aguantes la respiración.",
        patologyNotes: "Retorno progresivo: empieza ligero y sube la carga solo si completas el rango con técnica limpia. Si notas molestia en rodilla o cadera, reduce el recorrido o la carga."
      },
      {
        id: "remo_sentado_maquina",
        name: "Remo sentado en máquina",
        sets: 2,
        reps: "10-12",
        rest: 90,
        muscle: "back",
        startWeight: 15,
        notes: "Apoyo estable en el pecho. Cuello neutro y hombros lejos de las orejas.",
        patologyNotes: "Latigazo cervical: no adelantes la cabeza al tirar ni encojas los hombros. Si aparece dolor cervical, detén el ejercicio."
      },
      {
        id: "press_pecho_maquina",
        name: "Press de pecho en máquina",
        sets: 2,
        reps: "10-12",
        rest: 90,
        muscle: "chest",
        startWeight: 15,
        notes: "Carga moderada. Evita adelantar la cabeza o tensar el cuello. Empuja sin bloquear del todo los codos.",
        patologyNotes: "Cuello: mantén la nuca apoyada y no empujes con la cabeza. Si la máquina te obliga a sacar el cuello, ajusta el asiento."
      },
      {
        id: "curl_femoral",
        name: "Curl femoral sentado/tumbado",
        sets: 2,
        reps: "10-12",
        rest: 90,
        muscle: "legs",
        startWeight: 10,
        notes: "Movimiento lento y sin rebotes. Controla tanto la flexión como la vuelta.",
        patologyNotes: "Isquiotibiales: evita tirones bruscos al estirar. Si notas calambre, baja la carga."
      },
      {
        id: "jalon_neutro",
        name: "Jalón al pecho agarre neutro",
        sets: 2,
        reps: "10-12",
        rest: 90,
        muscle: "back",
        startWeight: 15,
        notes: "Agarre neutro (palmas enfrentadas). Lleva la barra a la parte alta del pecho con el torso casi vertical.",
        patologyNotes: "Solo si resulta cómodo para el cuello. NUNCA tires detrás de la nuca. Si el cuello se tensa, cambia a máquina dorsal."
      },
      {
        id: "abduccion_cadera",
        name: "Abducción de cadera en máquina",
        sets: 2,
        reps: "12-15",
        rest: 90,
        muscle: "legs",
        startWeight: 15,
        notes: "Controla la ida y la vuelta. No busques cargas máximas.",
        patologyNotes: "Cadera: movimiento suave, sin abrir de golpe. Mantén la espalda apoyada en el respaldo."
      },
      {
        id: "cardio_bici",
        name: "Bicicleta estática (ritmo cómodo)",
        sets: 1,
        reps: "10 min",
        rest: 0,
        muscle: "cardio",
        startWeight: 1,
        notes: "10-20 minutos a ritmo cómodo. Sube primero la duración hasta 25-30 min antes de buscar intensidad. Sin HIIT.",
        patologyNotes: "Con propranolol la frecuencia cardíaca puede responder distinto: guíate por sensaciones (poder hablar en frases, sin mareo). Ajusta el sillín a la altura de la cadera."
      }
    ]
  },
  {
    id: "dia2",
    name: "Día B: Cuerpo Completo",
    muscles: "Máquinas, poleas y cardio · Retorno progresivo",
    exercises: [
      {
        id: "extension_rodilla",
        name: "Extensión de rodilla en máquina",
        sets: 2,
        reps: "10-12",
        rest: 90,
        muscle: "legs",
        startWeight: 10,
        notes: "Carga inicial moderada y movimiento controlado. Ajusta el eje de la máquina a tu rodilla.",
        patologyNotes: "Rodillas: no bloquees la extensión de golpe. La bajada debe durar 2-3 segundos."
      },
      {
        id: "press_inclinado_maquina",
        name: "Press inclinado en máquina",
        sets: 2,
        reps: "10-12",
        rest: 90,
        muscle: "chest",
        startWeight: 10,
        notes: "Cabeza apoyada si la máquina lo permite. Empuje controlado sin despegar la espalda.",
        patologyNotes: "Detén el ejercicio si aumentan los síntomas cervicales. No saques el cuello hacia delante."
      },
      {
        id: "remo_apoyo_pecho",
        name: "Remo con apoyo de pecho",
        sets: 2,
        reps: "10-12",
        rest: 90,
        muscle: "back",
        startWeight: 15,
        notes: "Pecho apoyado en el soporte. Junta las escápulas sin encoger los hombros hacia las orejas.",
        patologyNotes: "Preferible a variantes que exijan estabilizar mucho el tronco o el cuello. Apoyo firme y cuello neutro."
      },
      {
        id: "curl_femoral_dia2",
        name: "Curl femoral",
        sets: 2,
        reps: "10-12",
        rest: 90,
        muscle: "legs",
        startWeight: 10,
        notes: "Sin movimientos bruscos. Controla la vuelta del peso.",
        patologyNotes: "Isquiotibiales: si notas tirón, reduce la carga y el rango."
      },
      {
        id: "biceps_polea",
        name: "Bíceps en polea o máquina",
        sets: 2,
        reps: "10-12",
        rest: 90,
        muscle: "biceps",
        startWeight: 5,
        notes: "Codos estables y postura relajada. Sin balancear el tronco.",
        patologyNotes: "Hombros y cuello: mantén los hombros bajos y el cuello neutro durante todo el recorrido."
      },
      {
        id: "triceps_polea",
        name: "Tríceps en polea",
        sets: 2,
        reps: "10-12",
        rest: 90,
        muscle: "triceps",
        startWeight: 5,
        notes: "Codos pegados al cuerpo. Extiende sin inclinar excesivamente el tronco.",
        patologyNotes: "Sin tensar los cervicales ni encogerte. Si el cuello se carga, baja la carga."
      },
      {
        id: "cardio_bici_dia2",
        name: "Bicicleta estática (ritmo cómodo)",
        sets: 1,
        reps: "10 min",
        rest: 0,
        muscle: "cardio",
        startWeight: 1,
        notes: "10-20 minutos a ritmo cómodo. Prioriza duración antes que intensidad. Sin HIIT.",
        patologyNotes: "Guiate por sensaciones, no solo por pulso (propranolol). Debes poder hablar en frases y no marearte."
      }
    ]
  },
  {
    id: "dia3",
    name: "Día C: Cuerpo Completo",
    muscles: "Máquinas, poleas y cardio · Retorno progresivo",
    exercises: [
      {
        id: "prensa_piernas_dia3",
        name: "Prensa de piernas",
        sets: 2,
        reps: "12",
        rest: 90,
        muscle: "legs",
        startWeight: 15,
        notes: "Carga algo menor que el día A y técnica limpia. Recorrido cómodo.",
        patologyNotes: "Rodillas: sin bloqueos ni rebotes. Si el día A te dejó agujetas fuertes, mantén esta carga más ligera."
      },
      {
        id: "jalon_neutro_dia3",
        name: "Jalón neutro o máquina dorsal",
        sets: 2,
        reps: "10-12",
        rest: 90,
        muscle: "back",
        startWeight: 15,
        notes: "Elige la variante que mejor tolere tu cuello. Movimiento controlado.",
        patologyNotes: "Latigazo cervical: nada de jalón tras nuca. Si el jalón molesta, usa la máquina dorsal."
      },
      {
        id: "press_pecho_maquina_dia3",
        name: "Press de pecho en máquina",
        sets: 2,
        reps: "10-12",
        rest: 90,
        muscle: "chest",
        startWeight: 15,
        notes: "Sin llegar al fallo. Deja 3-4 repeticiones en reserva.",
        patologyNotes: "Cuello y hombros: nuca apoyada, hombros lejos de las orejas."
      },
      {
        id: "extension_cadera",
        name: "Extensión de cadera en máquina/polea",
        sets: 2,
        reps: "10-12 por lado",
        rest: 90,
        muscle: "legs",
        startWeight: 5,
        notes: "Solo si la posición es estable y cómoda. Movimiento corto y controlado.",
        patologyNotes: "Si la postura te obliga a arquear la espalda o tensar el cuello, omite este ejercicio."
      },
      {
        id: "face_pull",
        name: "Face pull muy ligero",
        sets: 2,
        reps: "12-15",
        rest: 90,
        muscle: "shoulders",
        startWeight: 5,
        notes: "Polea alta con cuerda. Tira hacia la cara separando las manos, con carga muy ligera.",
        patologyNotes: "Únicamente si tu fisioterapeuta lo considera compatible con el latigazo cervical. Si duda, omítelo."
      },
      {
        id: "gemelos_maquina",
        name: "Elevación de gemelos en máquina",
        sets: 2,
        reps: "12-15",
        rest: 90,
        muscle: "legs",
        startWeight: 20,
        notes: "Controla la bajada y usa un apoyo estable. Rango completo sin rebotes.",
        patologyNotes: "Tendón de Aquiles: baja despacio. Si notas pinchazo, reduce carga y rango."
      },
      {
        id: "cardio_cinta",
        name: "Cinta de correr (caminar)",
        sets: 1,
        reps: "10 min",
        rest: 0,
        muscle: "cardio",
        startWeight: 3,
        notes: "CAMINA, no corras. Ritmo en el que puedas hablar en frases. Puedes añadir 1-2% de inclinación si es cómodo.",
        patologyNotes: "Guiate por sensaciones (propranolol). Sin mareo ni falta de aire desproporcionada. Detente si aparece dolor torácico."
      }
    ]
  }
];

// Músculos representados en SVG
const MUSCLE_HIGHLIGHTS_SVG = {
  front: `
    <svg viewBox="0 0 200 400" class="muscle-svg">
      <defs>
        <linearGradient id="glow" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#ccff00" stop-opacity="0.8"/>
          <stop offset="100%" stop-color="#ff5a00" stop-opacity="0.8"/>
        </linearGradient>
      </defs>
      <!-- Base Cuerpo Humano Simplificado -->
      <g fill="#1d202b" stroke="#373e51" stroke-width="1.5">
        <!-- Cabeza -->
        <circle cx="100" cy="40" r="18" />
        <!-- Cuello -->
        <rect x="94" y="58" width="12" height="12" />
        <!-- Tronco -->
        <path d="M 65,70 L 135,70 L 125,180 L 75,180 Z" />
        <!-- Brazos -->
        <path d="M 65,70 L 45,150 L 40,210 C 40,220 46,220 46,210 L 52,150 L 65,95" />
        <path d="M 135,70 L 155,150 L 160,210 C 160,220 154,220 154,210 L 148,150 L 135,95" />
        <!-- Piernas -->
        <path d="M 75,180 L 65,280 L 58,370 C 56,380 66,380 66,370 L 82,280 L 98,180" />
        <path d="M 125,180 L 135,280 L 142,370 C 144,380 134,380 134,370 L 118,280 L 102,180" />
      </g>

      <!-- Músculos Activos Frontales -->
      <g id="muscle-pecho" class="muscle-group" fill="none">
        <!-- Pectoral Izq y Der -->
        <path d="M 72,82 C 85,82 95,85 98,98 C 95,115 80,120 72,100 Z" />
        <path d="M 128,82 C 115,82 105,85 102,98 C 105,115 120,120 128,100 Z" />
      </g>
      <g id="muscle-biceps" class="muscle-group" fill="none">
        <!-- Bíceps Izq y Der -->
        <path d="M 52,105 C 47,115 47,130 52,140 C 56,130 56,115 52,105 Z" />
        <path d="M 148,105 C 153,115 153,130 148,140 C 144,130 144,115 148,105 Z" />
      </g>
      <g id="muscle-hombros-front" class="muscle-group" fill="none">
        <!-- Deltoides frontal Izq y Der -->
        <path d="M 60,70 C 52,78 48,90 56,95 C 64,90 64,78 60,70 Z" />
        <path d="M 140,70 C 148,78 152,90 144,95 C 136,90 136,78 140,70 Z" />
      </g>
      <g id="muscle-cuadriceps" class="muscle-group" fill="none">
        <!-- Cuádriceps Izq y Der -->
        <path d="M 68,195 C 62,225 60,250 68,275 C 78,250 78,225 74,195 Z" />
        <path d="M 132,195 C 138,225 140,250 132,275 C 122,250 122,225 126,195 Z" />
      </g>
    </svg>
  `,
  back: `
    <svg viewBox="0 0 200 400" class="muscle-svg">
      <!-- Base Cuerpo Humano Simplificado Vista Trasera -->
      <g fill="#1d202b" stroke="#373e51" stroke-width="1.5">
        <!-- Cabeza -->
        <circle cx="100" cy="40" r="18" />
        <!-- Cuello -->
        <rect x="94" y="58" width="12" height="12" />
        <!-- Tronco -->
        <path d="M 65,70 L 135,70 L 125,180 L 75,180 Z" />
        <!-- Brazos -->
        <path d="M 65,70 L 45,150 L 40,210 C 40,220 46,220 46,210 L 52,150 L 65,95" />
        <path d="M 135,70 L 155,150 L 160,210 C 160,220 154,220 154,210 L 148,150 L 135,95" />
        <!-- Piernas -->
        <path d="M 75,180 L 65,280 L 58,370 C 56,380 66,380 66,370 L 82,280 L 98,180" />
        <path d="M 125,180 L 135,280 L 142,370 C 144,380 134,380 134,370 L 118,280 L 102,180" />
      </g>

      <!-- Músculos Activos Traseros -->
      <g id="muscle-espalda" class="muscle-group" fill="none">
        <!-- Trapecios y Dorsales -->
        <path d="M 70,80 L 100,65 L 130,80 L 122,145 L 100,165 L 78,145 Z" />
      </g>
      <g id="muscle-triceps" class="muscle-group" fill="none">
        <!-- Tríceps Izq y Der -->
        <path d="M 58,98 C 62,110 62,125 58,135 C 54,125 54,110 58,98 Z" />
        <path d="M 142,98 C 138,110 138,125 142,135 C 146,125 146,110 142,98 Z" />
      </g>
      <g id="muscle-hombros-tras" class="muscle-group" fill="none">
        <!-- Deltoides posterior Izq y Der -->
        <path d="M 64,74 C 60,82 58,92 65,96 C 68,90 68,80 64,74 Z" />
        <path d="M 136,74 C 140,82 142,92 135,96 C 132,90 132,80 136,74 Z" />
      </g>
      <g id="muscle-isquios" class="muscle-group" fill="none">
        <!-- Femorales / Isquiotibiales -->
        <path d="M 76,200 C 72,230 70,260 78,280 C 86,260 84,230 80,200 Z" />
        <path d="M 124,200 C 128,230 130,260 122,280 C 114,260 116,230 120,200 Z" />
      </g>
    </svg>
  `
};

// Mensajes motivadores según el peso corporal perdido
const WEIGHT_LOSS_MILESTONES = [
  { loss: 0.5, desc: "¡Buen inicio! Has perdido medio kilo. Esto equivale a un bloque de mantequilla que tu cuerpo ya no tiene que transportar." },
  { loss: 1, desc: "¡Excelente! Has bajado 1 kg. Equivale a un paquete entero de arroz. ¡Menos carga para tus rodillas!" },
  { loss: 2, desc: "¡Wow! 2 kg perdidos. Imagina cargar una botella de agua de 2 litros todo el día. Ya no la necesitas encima." },
  { loss: 3, desc: "¡Increíble! 3 kg menos. Es el peso de tres portátiles medianos. Sigue así." },
  { loss: 5, desc: "¡Hito alcanzado! 5 kg perdidos. Equivale a un saco mediano de patatas. Tus articulaciones te lo están agradeciendo profundamente." },
  { loss: 7, desc: "¡Fantástico! 7 kg eliminados. Esto es el peso promedio de una sandía grande." },
  { loss: 10, desc: "¡ESPECTACULAR! Has bajado 10 kg. Es igual a una maleta de equipaje de mano cargada. Tu corazón bombea con mucha más facilidad." },
  { loss: 15, desc: "¡CAMPEÓN! 15 kg perdidos. Equivale a una bombona de butano. Estás cambiando radicalmente tu salud." },
  { loss: 20, desc: "¡HÉROE! 20 kg menos. Has quitado el peso equivalente a un neumático de coche completo. Eres una inspiración." }
];

// Citas motivadoras diarias de gimnasio
const GYM_MOTIVATIONS = [
  "La constancia vence a la baja forma. Hoy es un día perfecto para ganarle a la pereza.",
  "El peso del gimnasio te hace más fuerte físicamente; el peso que pierdes te hace más libre.",
  "No importa qué tan lento vayas, estás superando a todos los que siguen acostados en el sofá.",
  "Tu cuerpo puede soportarlo casi todo, es tu mente a la que tienes que convencer hoy.",
  "Cada repetición cuenta. Cada gota de sudor te acerca a estar más liviano y ágil.",
  "Hoy empezarás ligero, pero con el tiempo serás imparable. Confía en el proceso.",
  "Recuerda por qué empezaste: salud, agilidad y amor propio. ¡Vamos a darle!"
];

// Historial inicial de báscula corporal de Rafael Carcel
const INITIAL_WEIGHT_HISTORY = [];
