# 📱 POS Móvil - Escáner, Inventario y Cobro en Android

Aplicación móvil nativa para Android construida con **HTML5, CSS3, JavaScript nativo y Capacitor**, con sincronización en tiempo real en la nube mediante **Supabase** y almacenamiento local offline.

La aplicación móvil está enfocada en la velocidad y facilidad de uso con solo **3 opciones esenciales** mediante la **cámara del celular como escáner continuo**:

1. 🏷️ **Registrar Nuevo Producto**: Escanea el código de barras y autocompleta instantáneamente con el **mega archivo de códigos de barras comunes de México (+120 productos nacionales de abarrotes)**.
2. 📦 **Agregar Inventario**: Escanea piezas individuales o cajas cerradas de empaque (códigos padre) para sumar stock al instante en Supabase mientras descargan la mercancía.
3. 💳 **Cobrar Producto (POS)**: Escaneo continuo para armar el ticket de venta, calcular cambio en efectivo o cobro digital y descontar stock automáticamente.

---

## 🚀 Cómo abrir y ejecutar en Android Studio

1. **Abrir el proyecto directamente en Android Studio:**
   ```bash
   npm run open:android
   ```
   *(O abre Android Studio manualmente y selecciona la carpeta `POS/android`)*.

2. **Ejecutar la app:**
   - Conecta tu teléfono Android por USB (con depuración USB activada) o selecciona un emulador.
   - Haz clic en el botón verde **"Run 'app'" (Shift + F10)** en Android Studio.
   - La aplicación solicitará permiso de cámara y estará lista para escanear y cobrar.

3. **Sincronizar cambios web si editas algo en `www/`:**
   ```bash
   npm run sync
   ```

---

## 📁 Estructura del Proyecto

```text
POS/
├── android/                   # Proyecto nativo Android (Capacitor / Gradle)
├── docs/                      # Documentación y guías técnicas
│   ├── ARQUITECTURA_Y_ANALISIS.md   # Análisis completo de módulos y reglas
│   └── GUIA_SUPABASE_PASO_A_PASO.md # Guía para crear y conectar Supabase
├── supabase/                  # Scripts de base de datos
│   └── schema.sql             # Tablas, triggers, RLS y catálogo inicial
├── www/                       # Aplicación Web Frontend
│   ├── css/
│   │   └── styles.css         # Estilos visuales del Punto de Venta
│   ├── js/
│   │   ├── config.js          # Configuración de credenciales de Supabase
│   │   ├── supabaseClient.js  # Capa de datos y sincronización Supabase/Local
│   │   └── app.js             # Lógica de venta, inventario y cortes
│   └── index.html             # Interfaz de usuario principal
├── .env.example               # Plantilla de variables de entorno
├── .gitignore                 # Exclusiones de Git
├── capacitor.config.json      # Configuración de Capacitor
└── package.json               # Dependencias y scripts de ejecución
```

---

## ⚡ Guía Rápida de Ejecución

### 1. En el Navegador Web (Computadora / Desktop)
```bash
# Iniciar servidor local de desarrollo
npm start
```
*O simplemente abre el archivo `www/index.html` con doble clic en Google Chrome o Microsoft Edge.*

### 2. En Dispositivos Móviles (Android)
```bash
# Sincronizar cambios de la carpeta www hacia Android
npm run sync

# Abrir el proyecto en Android Studio
npm run open:android
```

---

## 🔑 Credenciales de Acceso por Defecto

| Rol | Contraseña / PIN | Alcance |
| :--- | :--- | :--- |
| **Cajero** | *Sin clave* | Exclusivamente cobro en Punto de Venta (POS) |
| **Administrador** | **`1234`** o **`admin`** | Acceso total: POS, Inventario, Cancelaciones y Cortes de Caja |

---

## ☁️ Conexión con Supabase

1. Crea tu proyecto en [Supabase](https://supabase.com).
2. Ejecuta el script [`supabase/schema.sql`](supabase/schema.sql) en el **SQL Editor** de Supabase.
3. Copia tu `Project URL` y `anon public key` y pégalas en [`www/js/config.js`](www/js/config.js).
4. Consulta los detalles en la [Guía Paso a Paso](docs/GUIA_SUPABASE_PASO_A_PASO.md).

---

## 📄 Licencia y Tecnologías
- **Frontend**: HTML5, Vanilla CSS3, JavaScript ES6+
- **Backend / Cloud DB**: Supabase (PostgreSQL 15+)
- **Mobile Engine**: Capacitor Core / Android
