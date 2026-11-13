# 🚀 Guía Paso a Paso: Conectar NEXUS POS con Supabase

Esta guía te explica de forma muy sencilla cómo configurar tu base de datos en la nube con **Supabase** y vincularla a este proyecto.

---

### Paso 1: Crear una cuenta y un proyecto en Supabase (Gratuito)

1. Ingresa a [https://supabase.com](https://supabase.com) e inicia sesión (puedes entrar con tu cuenta de GitHub o correo electrónico).
2. Haz clic en el botón verde **"New Project"**.
3. Completa los campos:
   - **Name**: `NEXUS-POS` (o el nombre que prefieras).
   - **Database Password**: Elige una contraseña segura (guárdala bien).
   - **Region**: Selecciona la más cercana a tu país (por ejemplo: *East US / North America*).
   - **Pricing Plan**: Selecciona el plan gratuito (*Free tier*).
4. Haz clic en **"Create new project"** y espera unos 60 segundos mientras Supabase prepara tu servidor.

---

### Paso 2: Ejecutar el Script SQL (`supabase/schema.sql`)

1. En el panel izquierdo de tu proyecto en Supabase, haz clic en el icono **SQL Editor** (o presiona `S` y luego `Q`).
2. Haz clic en **"New query"** (o el botón `+`).
3. Abre el archivo de este proyecto ubicado en:
   📁 [`supabase/schema.sql`](../supabase/schema.sql)
4. Copia **todo el contenido** del archivo `schema.sql` y pégalo en el editor de Supabase.
5. Haz clic en el botón verde **"Run"** (o presiona `Ctrl + Enter`).
6. Verás un mensaje en verde: `Success. No rows returned`.
   *(Esto habrá creado automáticamente todas las 10 tablas, triggers de inventario, políticas de seguridad RLS y el catálogo inicial de productos y ventas).*

---

### Paso 3: Obtener tus Credenciales (URL y Anon Key)

1. En el menú lateral izquierdo de Supabase, haz clic en el icono de engranaje **Project Settings** (abajo a la izquierda).
2. En la lista de opciones, entra a **Data API** (o **API**).
3. Busca la sección **Project URL** y copia la dirección (se ve como: `https://abcdefghijklm.supabase.co`).
4. En la misma pantalla, busca **Project API keys** y copia la clave marcada como `anon` / `public`.

---

### Paso 4: Configurar las Credenciales en la Aplicación

Tienes dos formas sencillas de colocarlas:

#### Opción A (Recomendada): En el archivo `www/js/config.js`
Abre el archivo [www/js/config.js](../www/js/config.js) y pega tus valores entre las comillas:

```javascript
window.ENV_CONFIG = {
  SUPABASE_URL: 'https://tu-proyecto.supabase.co',
  SUPABASE_ANON_KEY: 'tu-clave-anon-publica-aqui',

  STORE_NAME: 'TIENDA ABARROTES NEXUS',
  TERMINAL_CODE: 'C1',
  TERMINAL_NAME: 'Caja 1',
  DEFAULT_ADMIN_PIN: '1234'
};
```

#### Opción B: Desde la Consola del Navegador (Sin editar código)
Abre la aplicación en tu navegador, presiona `F12` para abrir la consola y ejecuta:
```javascript
localStorage.setItem('SUPABASE_URL', 'https://tu-proyecto.supabase.co');
localStorage.setItem('SUPABASE_ANON_KEY', 'tu-clave-anon-publica-aqui');
location.reload();
```

---

### Paso 5: ¿Cómo verificar que está conectado?

1. Abre el Punto de Venta en el navegador (`npm start` o abriendo `www/index.html`).
2. En la parte superior de la pantalla verás la insignia de la terminal:
   - 🟢 **Punto Verde con texto "Sincronizado Supabase"**: Conexión establecida con éxito en la nube.
   - 🟡 **Punto Ámbar con texto "Modo Local"**: Trabajando en modo local (sin conexión a internet o sin credenciales aún).
3. Haz una venta de prueba en el POS o da de alta un producto en Inventario. Ve al **Table Editor** en Supabase y verás cómo los datos aparecen al instante en las tablas `sales`, `sale_items` y `products`.
