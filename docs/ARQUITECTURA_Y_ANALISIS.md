# 📘 Análisis Técnico y Arquitectura del Sistema
## NEXUS Retail - Punto de Venta (POS) e Inventario

---

### 1. Resumen Ejecutivo del Software

**NEXUS Retail** es una solución integral de punto de venta y gestión de existencias diseñada para comercios minoristas, abarrotes y mini-súpers. Su arquitectura híbrida combina una aplicación web responsiva de alto rendimiento (HTML5, CSS3, JavaScript Vanilla) con sincronización en tiempo real hacia una base de datos relacional en la nube (**Supabase / PostgreSQL**) y soporte móvil nativo para dispositivos y terminales táctiles Android mediante **Capacitor**.

---

### 2. Flujo Completo de Operación del Programa

```
                     ┌──────────────────────────────────────────┐
                     │          PANTALLA DE ACCESO              │
                     └────────────────────┬─────────────────────┘
                                          │
                   ┌──────────────────────┴──────────────────────┐
                   │                                             │
          [ Rol: Cajero ]                               [ Rol: Administrador ]
          (Sin contraseña)                              (PIN: 1234 o 'admin')
                   │                                             │
                   ▼                                             ▼
        ┌──────────────────────┐                     ┌───────────────────────┐
        │ SOLO PUNTO DE VENTA  │                     │ ACCESO TOTAL A:       │
        │ - Escaneo / Búsqueda │                     │ - Punto de Venta (POS)│
        │ - Cobro y Tickets    │                     │ - Inventario & Kardex │
        │ - Servicios Rápidos  │                     │ - Historial & Cancel. │
        └──────────────────────┘                     │ - Corte de Caja       │
                                                     └───────────────────────┘
```

#### A. Módulo de Autenticación y Control de Accesos (RBAC)
- **Perfil Cajero**: Acceso rápido sin fricción para turnos de alta afluencia. Restringe la barra de navegación lateral impidiendo alterar inventarios o revisar balances monetarios reservados para gerencia.
- **Perfil Administrador**: Protegido por PIN. Habilita acceso irrestricto a los módulos de Catálogo, Entradas de Mercancía, Ajustes de Merma, Cancelación de Tickets y Reporte de Corte de Caja.
- **Modal de Autorización en Caliente**: Si un cajero requiere cancelar una venta o acceder a una función gerencial, el sistema despliega un modal de PIN administrativo sin cerrar la sesión en curso.

#### B. Módulo de Punto de Venta (POS)
1. **Identificación de Productos**:
   - Escaneo por código de barras o código SKU.
   - Búsqueda predictiva por nombre o descripción.
   - Búsqueda con selector de accesos directos rápidos para productos de alta rotación (Leche, Refresco, Huevo, Pan).
2. **Motor de Reglas Promocionales**:
   - Soporte para reglas de descuento por paquete/volumen (ejemplo: *Coca-Cola 600ml - Promo 3x$45*).
   - Cálculo dinámico automático en tiempo real al acumular las piezas requeridas en el carrito.
3. **Servicios Rápidos**:
   - Pago de servicios (luz, agua, teléfono) y tiempo aire con comisiones configurables.
4. **Calculadora de Efectivo y Cambio**:
   - Modalidad de cobro con botones de denominaciones rápidas ($250, $300, $500, Exacto).
   - Cálculo instantáneo del cambio a entregar al cliente.
5. **Múltiples Formas de Pago**:
   - Efectivo (`cash`).
   - Tarjeta bancaria crédito/débito (`card`).
   - Código QR dinámico (`qr`).
   - CoDi / Transferencia bancaria (`codi`).
6. **Emisión de Tickets**:
   - Generación de folio único correlativo (`#44939`, etc.).
   - Impresión térmica con formato optimizado para impresoras POS de 58mm y 80mm.

#### C. Módulo de Inventario y Control de Stock
1. **Catálogo Maestro**:
   - Campos: Código de barras, SKU, Nombre, Categoría, Costo de adquisición, Precio público, Stock actual y Stock mínimo.
   - Indicadores visuales de estado: *Óptimo* (> 5 uds), *Stock Bajo* (1 a 5 uds), *Agotado* (0 uds).
2. **Entradas de Compra (Reabastecimiento)**:
   - Registro de nuevas compras a proveedores, actualizando stock físico y actualizando el costo unitario de compra más reciente.
3. **Ajustes de Merma**:
   - Deducciones justificadas de inventario por avería/daño, caducidad o merma desconocida (robo).
4. **Kardex Automático**:
   - Registro cronológico inmutable de cada entrada, salida por venta o ajuste con cantidades anteriores y posteriores.
5. **Exportación**:
   - Descarga de inventario en formato CSV compatible con Microsoft Excel.

#### D. Módulo de Historial de Ventas
1. **Auditoría de Transacciones**:
   - Listado en tiempo real con fecha, hora, terminal (`C1`, `C2`), cajero responsable, resumen de items, importe total y estado.
2. **Visualización y Reimpresión de Tickets**:
   - Modal con renderizado térmico fiel para re-imprimir recibos pasados.
3. **Cancelación de Tickets**:
   - Requiere PIN de administrador.
   - Al cancelarse, los triggers de la base de datos revierten automáticamente el stock al almacén.

#### E. Módulo de Arqueo y Corte de Caja (Turnos)
1. **Fórmulas de Balance**:
   $$\text{Efectivo Esperado} = \text{Fondo Inicial} + \text{Ventas en Efectivo} + \text{Entradas Extraordinarias} - \text{Salidas / Gastos} - \text{Pago a Proveedores}$$
2. **Confronta Físico vs Sistema**:
   - El cajero ingresa el efectivo contado físico en caja.
   - El sistema calcula la diferencia exacta ($\text{Contado} - \text{Esperado}$), alertando si existe sobrante o faltante de dinero.
3. **Cierre de Turno**:
   - Genera el reporte de Corte X / Corte Z y lo persiste en la tabla `cash_cuts`.

---

### 3. Diccionario de Datos (Modelo Entidad-Relación en Supabase)

| Tabla | Propósito | Llaves Principales / Relaciones |
| :--- | :--- | :--- |
| `store_settings` | Datos fiscales y comerciales de la sucursal | `id (UUID)` |
| `terminals` | Registro de cajas o terminales físicas | `id (UUID)`, `code (UNIQUE)` |
| `users` | Usuarios, cajeros y administradores | `id (UUID)`, `username (UNIQUE)` |
| `categories` | Categorías de productos del catálogo | `id (UUID)`, `name (UNIQUE)` |
| `products` | Catálogo de productos y existencias | `id (BIGINT)`, `barcode (UNIQUE)` |
| `quick_services` | Servicios de recargas y comisiones | `id (VARCHAR)` |
| `sales` | Encabezado de transacciones de venta | `id (BIGINT)`, `folio (UNIQUE)` |
| `sale_items` | Detalle producto por producto vendido | `id (BIGINT)`, `sale_id -> sales.id` |
| `inventory_movements` | Kardex auditor de movimientos de almacén | `id (BIGINT)`, `product_id -> products.id` |
| `cash_cuts` | Cortes y arqueos de caja por turno | `id (BIGINT)` |

---

### 4. Automatizaciones en la Base de Datos (Triggers)

1. **`trg_deduct_stock_on_sale_item`**:
   - **Evento**: `AFTER INSERT ON sale_items`
   - **Acción**: Resta la cantidad vendida al producto en `products` y genera automáticamente la fila correspondiente en `inventory_movements` tipo `'sale'`.
2. **`trg_restore_stock_on_cancel`**:
   - **Evento**: `AFTER UPDATE ON sales (WHEN OLD.status = 'completed' AND NEW.status = 'cancelled')`
   - **Acción**: Recorre los artículos del ticket y reingresa el stock a `products`, registrando el movimiento de `'sale_cancellation'`.
3. **`trg_products_updated_at`**:
   - **Evento**: `BEFORE UPDATE ON products`
   - **Acción**: Actualiza el campo `updated_at` con la marca de tiempo UTC actual.
