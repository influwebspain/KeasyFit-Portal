# 🏋️‍♂️ KeasyFit Portal - Mi Entrenador Personal

¡Bienvenido a **KeasyFit Portal**! Esta es una aplicación web interactiva de alto rendimiento diseñada específicamente para **Rafael Carcel**. Permite realizar un seguimiento diario de entrenamiento, monitorizar el peso corporal con gráficos InBody motivadores, registrar cargas progresivas y recibir alertas de entreno.

El diseño está optimizado tanto para ordenadores como para **móviles**, permitiéndote llevar el control directamente desde tu teléfono mientras estás en el gimnasio.

---

## ⚡ Características Principales

1. **Dashboard Motivador**: Racha de entrenamientos, peso actual vs peso inicial de InBody (148 kg) con indicadores de pérdida y equivalencias motivacionales del mundo real.
2. **Entrenamiento Interactivo (Modo Enfoque)**:
   - Panel paso a paso con vídeos embebidos explicativos e instrucciones técnicas de articulaciones.
   - Registro de pesos y repeticiones serie por serie en tiempo real.
   - **Asistente de Carga Inteligente (Entrenador Virtual)**: Ajusta y te sugiere el peso de la siguiente sesión según la dificultad percibida ("Fácil", "Adecuado", "Muy duro").
   - Temporizador de descanso de 60 segundos con alertas sonoras integradas.
   - Animación de éxito con confeti al completar el entrenamiento.
3. **Músculos Activos**: Diagramas SVG interactivos de la anatomía humana que destacan automáticamente qué músculos se trabajan en cada ejercicio.
4. **Registro de Métricas**: Historial de peso y % de grasa corporal con gráficos interactivos que muestran la curva descendente.
5. **Gráficos e Informes**:
   - Evolución del peso y masa grasa.
   - Volumen de carga de trabajo total semanal (Series x Reps x Peso).
   - Progresión de fuerza (peso máximo levantado) para cada ejercicio individual.
   - **Exportación en CSV**: Descarga tu historial completo para abrirlo en Excel.
6. **Planificador y Alertas**: Configuración de los días que entrenas y la hora de aviso para recibir notificaciones push en el navegador.
7. **Editor de Rutinas Completo**: CRUD visual para añadir, eliminar o reordenar ejercicios cada 4 semanas para adaptar tu entrenamiento.

---

## 💻 Cómo Usar Localmente

La aplicación está construida usando tecnologías web estándar nativas. No requiere instalaciones ni servidores de base de datos.
1. Haz doble clic en el archivo [index.html](file:///h:/Mi%20unidad/RutinaGYM/index.html) para abrirlo directamente en cualquier navegador web (Chrome, Edge, Firefox, Safari).
2. ¡Empieza a registrar tus entrenamientos y pesos!

---

## 🚀 Despliegue en GitHub y Vercel

Sigue estos pasos para subir tu portal a GitHub y desplegarlo de forma gratuita en Vercel para poder usarlo en tu móvil desde el gimnasio.

### Paso 1: Subir a GitHub
1. Abre tu terminal de comandos en la carpeta de la aplicación (`h:\Mi unidad\RutinaGYM`).
2. Inicializa Git y crea el primer commit:
   ```bash
   git init
   git add .
   git commit -m "Commit inicial: KeasyFit Portal"
   ```
3. Ve a [GitHub](https://github.com), crea un nuevo repositorio vacío llamado `KeasyFit-Portal` (déjalo público o privado).
4. Vincula tu repositorio local con GitHub y sube los archivos (reemplaza `<TU_USUARIO>` con tu nombre de usuario de GitHub):
   ```bash
   git remote add origin https://github.com/<TU_USUARIO>/KeasyFit-Portal.git
   git branch -M main
   git push -u origin main
   ```

### Paso 2: Desplegar en Vercel (Gratis)
1. Crea una cuenta gratuita en [Vercel](https://vercel.com) iniciando sesión con tu cuenta de GitHub.
2. Haz clic en **"Add New..."** y luego en **"Project"**.
3. Vercel te mostrará tu lista de repositorios de GitHub. Busca `KeasyFit-Portal` y haz clic en **"Import"**.
4. En la configuración del proyecto, Vercel detectará automáticamente que es un proyecto HTML/CSS/JS estático. **No necesitas tocar ninguna configuración de compilación (Build & Development Settings)**.
5. Haz clic en **"Deploy"**.
6. En unos 10 segundos, Vercel te dará una URL pública del tipo `https://keasyfit-portal.vercel.app`. ¡Ábrela en tu móvil y añádela a la pantalla de inicio!

---

## 💾 Nota Importante sobre los Datos
La aplicación guarda todos los datos localmente en el almacenamiento del navegador (`localStorage`).
* **Privacidad total**: Tus datos nunca se envían a ningún servidor de terceros.
* **Sincronización**: Dado que los datos viven en el navegador del dispositivo que estés usando, si cambias de dispositivo (de ordenador a móvil), puedes usar la función **"Exportar a CSV"** en el panel de informes para descargar tus datos.
