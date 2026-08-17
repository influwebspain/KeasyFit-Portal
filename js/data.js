// Datos Iniciales de la Rutina y Asistencias de KeasyFit

const INITIAL_ROUTINES = [
  {
    id: "dia1",
    name: "Día 1: Espalda y Bíceps",
    muscles: "Espalda, Bíceps, Cuádriceps y Cardio",
    exercises: [
      {
        id: "jalon_nuca",
        name: "Jalón a la nuca",
        sets: 4,
        reps: "15",
        rest: 60, // en segundos
        muscle: "back",
        video: "https://www.youtube.com/embed/l3S64-3x00Y",
        startWeight: 15, // peso inicial recomendado en kg
        notes: "Asegúrate de no forzar el cuello hacia adelante. Si sientes molestias en los hombros, realiza el jalón por delante al pecho como alternativa más segura.",
        patologyNotes: "Protección articular: No bajes la barra bruscamente. Controla la subida para evitar tirones en los hombros."
      },
      {
        id: "biceps_polea",
        name: "Bíceps en polea",
        sets: 4,
        reps: "12",
        rest: 60,
        muscle: "biceps",
        video: "https://www.youtube.com/embed/0T26Z6n5B1A",
        startWeight: 5,
        notes: "Mantén los codos pegados a los costados y el abdomen firme para no balancear el cuerpo.",
        patologyNotes: "Estabilidad: Con un peso corporal inicial alto, la estabilidad lumbar es clave. Aprieta glúteos y core."
      },
      {
        id: "curl_martillo",
        name: "Curl de Bíceps Martillo con Mancuerna",
        sets: 4,
        reps: "10",
        rest: 60,
        muscle: "biceps",
        video: "https://www.youtube.com/embed/Pj13iFjM38s",
        startWeight: 4, // 4kg por mancuerna
        notes: "Palmas mirándose entre sí. Haz el movimiento controlado sin prisa.",
        patologyNotes: "Postura: Mantén las rodillas ligeramente flexionadas para proteger la zona lumbar durante el levantamiento."
      },
      {
        id: "remo_polea",
        name: "Remo en polea baja",
        sets: 4,
        reps: "10",
        rest: 60,
        muscle: "back",
        video: "https://www.youtube.com/embed/mKkU95C2gO0",
        startWeight: 15,
        notes: "Lleva el agarre hacia tu abdomen bajo, retrayendo las escápulas (junta los hombros atrás).",
        patologyNotes: "Espalda sana: Evita inclinarte demasiado hacia adelante o atrás. Mantén la columna neutra."
      },
      {
        id: "cuadriceps_maquina",
        name: "Cuádriceps (extensiones en máquina)",
        sets: 4,
        reps: "10",
        rest: 60,
        muscle: "legs",
        video: "https://www.youtube.com/embed/6iO1XyXh2Qo",
        startWeight: 10,
        notes: "Ajusta la máquina para que tu rodilla coincida con el eje de rotación. Sube controlado.",
        patologyNotes: "Rodillas seguras: No bloquees las rodillas arriba de forma brusca. La bajada debe durar 2-3 segundos."
      },
      {
        id: "bici_comun",
        name: "Bicicleta estática (intensidades intercaladas)",
        sets: 1,
        reps: "10 min",
        rest: 0,
        muscle: "cardio",
        video: "https://www.youtube.com/embed/D3eXmQ12w5A",
        startWeight: 1, // Nivel de resistencia
        notes: "Intercala 1 minuto moderado con 30 segundos de mayor intensidad.",
        patologyNotes: "Ajuste de sillín: El sillín debe quedar a la altura de tu cadera al estar de pie, para evitar flexiones excesivas de rodilla."
      }
    ]
  },
  {
    id: "dia2",
    name: "Día 2: Pecho y Tríceps",
    muscles: "Pecho, Tríceps, Isquiotibiales y Cardio",
    exercises: [
      {
        id: "triceps_polea",
        name: "Tríceps en polea alta",
        sets: 4,
        reps: "10",
        rest: 60,
        muscle: "triceps",
        video: "https://www.youtube.com/embed/6xVf958C73w",
        startWeight: 5,
        notes: "Extiende los brazos hacia abajo por completo contrayendo el tríceps. Codos inmóviles.",
        patologyNotes: "Codos protegidos: Evita que los codos se abran hacia afuera o suban más allá del pecho."
      },
      {
        id: "chest_press",
        name: "Máquina Chest Press (pecho)",
        sets: 4,
        reps: "10",
        rest: 60,
        muscle: "chest",
        video: "https://www.youtube.com/embed/uGv23y6m_pQ",
        startWeight: 15,
        notes: "Empuja hacia el frente manteniendo los hombros pegados al respaldo. No despegues la espalda.",
        patologyNotes: "Cuidado de hombros: Ajusta los agarres para que queden a la altura del pecho inferior, no del cuello."
      },
      {
        id: "jalon_pecho",
        name: "Jalón al pecho en polea",
        sets: 4,
        reps: "12",
        rest: 60,
        muscle: "back",
        video: "https://www.youtube.com/embed/V6W3-mX1K6g",
        startWeight: 15,
        notes: "Lleva la barra hacia la parte alta del pecho, inclinando el torso levemente hacia atrás.",
        patologyNotes: "Espalda lumbar: Controla el regreso. Tu core debe estar activado para evitar tirones lumbares."
      },
      {
        id: "isquios_maquina",
        name: "Isquiotibiales en máquina",
        sets: 4,
        reps: "12",
        rest: 60,
        muscle: "legs",
        video: "https://www.youtube.com/embed/Yn1u325w_oY",
        startWeight: 10,
        notes: "Contrae la parte trasera del muslo llevando los talones hacia los glúteos de forma controlada.",
        patologyNotes: "Sin tirones: Controla el peso al estirar las piernas para no forzar los tendones poplíteos."
      },
      {
        id: "triceps_banco",
        name: "Tríceps apoyado en banco",
        sets: 4,
        reps: "10",
        rest: 60,
        muscle: "triceps",
        video: "https://www.youtube.com/embed/d_K6_N22s-g",
        startWeight: 0, // Peso corporal
        notes: "Si es muy pesado, flexiona las rodillas y apoya los pies más cerca del cuerpo. Baja solo hasta que tus codos hagan 90 grados.",
        patologyNotes: "Hombros e impacto: Dado el peso actual, pon tus pies bien cerca del banco para quitarle carga. Si te duele el hombro, cámbialo por extensiones en polea."
      },
      {
        id: "maquina_pectoral",
        name: "Máquina pectoral (Aperturas / Pec Deck)",
        sets: 4,
        reps: "10",
        rest: 60,
        muscle: "chest",
        video: "https://www.youtube.com/embed/G6j56YyNPlU",
        startWeight: 10,
        notes: "Junta los brazos en el centro apretando el pecho. Abre despacio controlando la resistencia.",
        patologyNotes: "Hombro anterior: No dejes que los brazos vayan muy atrás de la línea de tus hombros en la fase de apertura."
      },
      {
        id: "bici_horizontal",
        name: "Bicicleta horizontal (intensidades alternas)",
        sets: 1,
        reps: "15 min",
        rest: 0,
        muscle: "cardio",
        video: "https://www.youtube.com/embed/D3eXmQ12w5A",
        startWeight: 1,
        notes: "Excelente opción cardiovascular que libera la presión sobre la columna y rodillas.",
        patologyNotes: "Amigable con articulaciones: Mantén un pedaleo constante a un nivel de resistencia bajo-medio."
      }
    ]
  },
  {
    id: "dia3",
    name: "Día 3: Hombros, Espalda y Piernas",
    muscles: "Hombros, Espalda, Piernas y Cardio",
    exercises: [
      {
        id: "cinta_correr",
        name: "Cinta de correr (caminar con pendiente)",
        sets: 1,
        reps: "10 min",
        rest: 0,
        muscle: "cardio",
        video: "https://www.youtube.com/embed/g6Wk63yJ4t0",
        startWeight: 3, // Velocidad en km/h
        notes: "Ajusta la velocidad a ritmo de caminata activa (ej. 3.5 a 4.5 km/h) y añade 1-2% de inclinación si te sientes cómodo.",
        patologyNotes: "Cero impacto: CAMINA, no corras. La caminata es excelente para tus articulaciones a 148kg."
      },
      {
        id: "low_row",
        name: "Máquina de espalda (Dorsales - Low Row)",
        sets: 4,
        reps: "15",
        rest: 60,
        muscle: "back",
        video: "https://www.youtube.com/embed/8-9-oNqOq8c",
        startWeight: 15,
        notes: "Tira de los agarres hacia atrás contrayendo la zona dorsal baja. Mantén el pecho firme contra el apoyo.",
        patologyNotes: "Espalda baja: Apoyarse en el rodillo/pecho reduce drásticamente la tensión en la zona lumbar."
      },
      {
        id: "hombros_laterales",
        name: "Hombros laterales con mancuerna",
        sets: 4,
        reps: "8",
        rest: 60,
        muscle: "shoulders",
        video: "https://www.youtube.com/embed/t0mP85hL_iI",
        startWeight: 2, // 2kg o 3kg
        notes: "Eleva los brazos hacia los lados formando una 'T', con los codos ligeramente flexionados.",
        patologyNotes: "Sin impulsos: Si tienes que balancearte, baja el peso. Mantén el cuerpo erguido."
      },
      {
        id: "aductor_maquina",
        name: "Máquina de Aductores",
        sets: 4,
        reps: "12",
        rest: 60,
        muscle: "legs",
        video: "https://www.youtube.com/embed/8kX72k15fsw",
        startWeight: 10,
        notes: "Cierra las piernas de forma controlada apretando la cara interna de los muslos.",
        patologyNotes: "Cadera y pelvis: Evita movimientos explosivos. Cierra suavemente y abre reteniendo el peso."
      },
      {
        id: "hombros_frontales",
        name: "Hombros frontales con polea",
        sets: 4,
        reps: "10",
        rest: 60,
        muscle: "shoulders",
        video: "https://www.youtube.com/embed/g3m7n65Hjic",
        startWeight: 5,
        notes: "Espalda a la polea. Eleva el brazo al frente hasta la altura del hombro de forma controlada.",
        patologyNotes: "Hombro sano: No subas la mano por encima del nivel de los ojos para evitar rozamiento en el tendón del supraespinoso."
      },
      {
        id: "vertical_traction",
        name: "Máquina de espalda (Dorsales - Vertical Traction)",
        sets: 4,
        reps: "12",
        rest: 60,
        muscle: "back",
        video: "https://www.youtube.com/embed/n4sO_3H5k8o",
        startWeight: 15,
        notes: "Tracción vertical guiada. Tira de los agarres hacia abajo sintiendo la contracción del dorsal ancho.",
        patologyNotes: "Movimiento seguro: La máquina guía el recorrido, lo que te ayuda a entrenar de forma muy estable y segura."
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

