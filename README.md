# 🏋️‍♂️ FitActive - Mi Entrenador Personal

¡Bienvenido a **FitActive**! Esta es una aplicación web interactiva de alto rendimiento diseñada específicamente para **Rafael Carcel**. Permite realizar un seguimiento diario de entrenamiento, monitorizar el peso corporal con gráficos InBody motivadores, registrar cargas progresivas y recibir alertas de entreno.

El diseño está optimizado tanto para ordenadores como para **móviles**, permitiéndote llevar el control directamente desde tu teléfono mientras estás en el gimnasio.

---

## ⚡ Características Principales

1. **Dashboard Motivador**: Racha de entrenamientos, peso actual vs peso inicial de InBody (148 kg) con indicadores de pérdida y equivalencias motivacionales del mundo real.
2. **Entrenamiento Interactivo (Modo Enfoque)**:
   - Panel paso a paso con animaciones del movimiento e instrucciones técnicas de cuidado articular.
   - Registro de pesos y repeticiones serie por serie. **Solo cuentan las series marcadas con ✓.**
   - **Asistente de carga (doble progresión)**: primero sube las repeticiones dentro del rango del plan y, cuando las completas en todas las series, sube el peso. Si fue "Muy duro" y no llegaste al mínimo, baja la carga.
   - Semanas 1-2 del plan con 2 series y, desde la 3.ª, 3 series en los ejercicios principales. El inicio del plan se puede fijar en Ajustes.
   - Temporizador de descanso de cada ejercicio (pitidos y vibración); corre mientras ves el siguiente ejercicio.
   - El entreno en curso se guarda solo: si el móvil cierra la pestaña, al volver puedes **reanudarlo**. La pantalla se queda encendida mientras entrenas.
   - Animación de éxito con confeti al completar el entrenamiento.
3. **Músculos Activos**: Diagramas SVG de la anatomía humana que destacan qué músculos se trabajan en cada ejercicio.
4. **Registro de Métricas**: Historial de peso y composición corporal (también escaneando la captura de la báscula), con gráfico y comparativa. Los registros se pueden **editar o borrar**.
5. **Gráficos e Informes**:
   - Evolución del peso y masa grasa.
   - Tonelaje semanal (reps × peso).
   - Progresión de fuerza (peso máximo levantado) para cada ejercicio individual.
   - **Exportación en CSV** lista para Excel en español (separador `;` y coma decimal).
6. **Calendario**: días entrenados con la letra de la rutina y días planificados. Toca un día para ver sus series y **corregirlas o borrarlas**.
7. **Aviso de entreno**: días y hora en Ajustes. Solo avisa si la app está abierta a esa hora (el móvil puede pausarla en segundo plano).
8. **Rutinas definidas en código**: el plan vive en `js/data.js`; al cambiarlo se sube `ROUTINES_VERSION` y la app sustituye las rutinas guardadas (local y Firebase). Si es un plan nuevo, actualiza también `PLAN_RELEASE_DATE`.

---

## 💻 Cómo Usar Localmente

La aplicación usa HTML, CSS y JavaScript sin compilación. Para probarla entera (sincronización con Firebase, modo sin conexión y avisos) sírvela con un servidor local desde la carpeta del proyecto:

```bash
npx serve .
# o bien
python -m http.server 8000
```

y abre la dirección que indique (p. ej. `http://localhost:8000`). Abriendo `index.html` con doble clic también funciona, pero el navegador bloquea Firebase y el service worker en `file://`: los datos se quedan solo en ese navegador.

> Al cambiar cualquier archivo de la app, sube `CACHE_NAME` en `sw.js`. Si no, los móviles abren la versión anterior la primera vez.

---

## 🚀 Despliegue en GitHub y Vercel

Sigue estos pasos para subir tu portal a GitHub y desplegarlo de forma gratuita en Vercel para poder usarlo en tu móvil desde el gimnasio.

### Paso 1: Subir a GitHub
1. Abre tu terminal de comandos en la carpeta de la aplicación.
2. Inicializa Git y crea el primer commit:
   ```bash
   git init
   git add .
   git commit -m "Commit inicial: FitActive"
   ```
3. Ve a [GitHub](https://github.com), crea un nuevo repositorio vacío llamado `FitActive` (déjalo público o privado).
4. Vincula tu repositorio local con GitHub y sube los archivos (reemplaza `<TU_USUARIO>` con tu nombre de usuario de GitHub):
   ```bash
   git remote add origin https://github.com/<TU_USUARIO>/FitActive.git
   git branch -M main
   git push -u origin main
   ```

### Paso 2: Desplegar en Vercel (Gratis)
1. Crea una cuenta gratuita en [Vercel](https://vercel.com) iniciando sesión con tu cuenta de GitHub.
2. Haz clic en **"Add New..."** y luego en **"Project"**.
3. Vercel te mostrará tu lista de repositorios de GitHub. Busca `FitActive` y haz clic en **"Import"**.
4. En la configuración del proyecto, Vercel detectará automáticamente que es un proyecto HTML/CSS/JS estático. **No necesitas tocar ninguna configuración de compilación (Build & Development Settings)**.
5. Haz clic en **"Deploy"**.
6. En unos 10 segundos, Vercel te dará una URL pública del tipo `https://fitactive.vercel.app`. ¡Ábrela en tu móvil y añádela a la pantalla de inicio!

---

## 💾 Nota Importante sobre los Datos
* **Dónde se guardan**: en el navegador de cada dispositivo (`localStorage`) y, además, en la nube (Firebase Firestore, documento `users/defaultUser`). Así el móvil y el ordenador comparten historial. En Ajustes se ve si la sincronización funciona.
* **Cómo se sincroniza**: se unen los datos de la nube y del dispositivo; no gana "el más largo". Si corriges un registro, gana la versión más reciente. Si lo borras, el borrado también se sincroniza.
* **Privacidad**: los datos de peso y salud **sí salen del dispositivo** (a Firebase). Ahora mismo no hay inicio de sesión: quién puede leerlos o modificarlos depende de las reglas de Firestore del proyecto. Revísalas en la consola de Firebase; lo recomendable es añadir inicio de sesión con Google y una regla que solo te permita el acceso a ti.
* **Restablecer datos de fábrica** (Ajustes) borra el historial aquí, en la nube y en tus otros dispositivos al sincronizar. Exporta antes el CSV si quieres una copia.
