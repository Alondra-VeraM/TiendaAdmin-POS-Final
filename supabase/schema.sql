-- =============================================================================
-- ESQUEMA DEFINITIVO PARA SUPABASE (NEXUS RETAIL POS - MULTI-CAJA C1 / C2)
-- Copia de respaldo y sincronización en la nube (Plan Free)
-- Ejecutar en el SQL Editor de tu proyecto Supabase
-- =============================================================================

-- Extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. TABLA: PRODUCTOS
CREATE TABLE IF NOT EXISTS public.products (
    id BIGSERIAL PRIMARY KEY,
    barcode VARCHAR(64) UNIQUE NOT NULL,
    sku VARCHAR(64),
    name VARCHAR(150) NOT NULL,
    brand VARCHAR(80),
    category VARCHAR(80) DEFAULT 'Abarrotes',
    cost NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    price NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
    min_stock INTEGER NOT NULL DEFAULT 5 CHECK (min_stock >= 0),
    icon_type VARCHAR(30) DEFAULT 'bread',
    promo_rule TEXT,
    origin VARCHAR(30) DEFAULT 'manual',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_products_barcode ON public.products(barcode);
CREATE INDEX IF NOT EXISTS idx_products_sku ON public.products(sku);

-- 2. TABLA: USUARIOS (Cajeros y Administradores)
CREATE TABLE IF NOT EXISTS public.users (
    id BIGSERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    role VARCHAR(30) NOT NULL CHECK (role IN ('cajero', 'admin')),
    pin_hash TEXT,
    pin_salt TEXT,
    pin VARCHAR(10),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. TABLA: EMPAQUES Y CAJAS (CÓDIGOS PADRE)
CREATE TABLE IF NOT EXISTS public.product_packages (
    barcode VARCHAR(64) PRIMARY KEY,
    product_id BIGINT NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    units INTEGER NOT NULL CHECK (units > 0),
    description VARCHAR(150),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. TABLA: CORTES DE CAJA Y TURNOS (CAJA 1 Y CAJA 2)
CREATE TABLE IF NOT EXISTS public.cash_cuts (
    id BIGSERIAL PRIMARY KEY,
    terminal_code VARCHAR(10) NOT NULL CHECK (terminal_code IN ('C1', 'C2')),
    terminal_name VARCHAR(50) NOT NULL,
    user_id BIGINT,
    cashier_name VARCHAR(100) NOT NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('open', 'closed')),
    opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    closed_at TIMESTAMPTZ,
    closed_by VARCHAR(100),
    initial_fund NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    total_sales_count INTEGER NOT NULL DEFAULT 0,
    total_sales_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    cash_sales NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    card_sales NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    transfer_sales NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    mixed_sales NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    cash_inflows NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    cash_outflows NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    supplier_payouts NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    expected_cash NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    counted_cash NUMERIC(12, 2),
    difference NUMERIC(12, 2),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_cash_cuts_terminal ON public.cash_cuts(terminal_code, status);

-- 5. TABLA: VENTAS (TICKETS)
CREATE TABLE IF NOT EXISTS public.sales (
    id BIGSERIAL PRIMARY KEY,
    folio VARCHAR(60) UNIQUE NOT NULL,
    cash_cut_id BIGINT REFERENCES public.cash_cuts(id),
    terminal_code VARCHAR(10) NOT NULL CHECK (terminal_code IN ('C1', 'C2')),
    terminal_name VARCHAR(50) NOT NULL,
    user_id BIGINT,
    cashier_name VARCHAR(100) NOT NULL,
    total_items INTEGER NOT NULL CHECK (total_items > 0),
    total_pieces INTEGER NOT NULL CHECK (total_pieces > 0),
    subtotal NUMERIC(12, 2) NOT NULL CHECK (subtotal >= 0),
    discount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    total_net NUMERIC(12, 2) NOT NULL CHECK (total_net >= 0),
    payment_method VARCHAR(20) NOT NULL CHECK (payment_method IN ('cash', 'card', 'transfer', 'mixed')),
    cash_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    card_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    transfer_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    cash_received NUMERIC(12, 2),
    cash_change NUMERIC(12, 2),
    status VARCHAR(20) NOT NULL DEFAULT 'completed' CHECK (status IN ('completed', 'cancelled')),
    cancelled_at TIMESTAMPTZ,
    cancelled_by VARCHAR(100),
    cancellation_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sales_folio ON public.sales(folio);
CREATE INDEX IF NOT EXISTS idx_sales_terminal ON public.sales(terminal_code);
CREATE INDEX IF NOT EXISTS idx_sales_created_at ON public.sales(created_at);

-- 6. TABLA: PARTIDAS DE VENTAS
CREATE TABLE IF NOT EXISTS public.sale_items (
    id BIGSERIAL PRIMARY KEY,
    sale_id BIGINT NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
    product_id BIGINT,
    barcode VARCHAR(64),
    product_name VARCHAR(150) NOT NULL,
    is_service BOOLEAN NOT NULL DEFAULT false,
    unit_price NUMERIC(12, 2) NOT NULL CHECK (unit_price >= 0),
    unit_cost NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    discount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    subtotal NUMERIC(12, 2) NOT NULL CHECK (subtotal >= 0),
    promo_applied TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sale_items_sale_id ON public.sale_items(sale_id);

-- 7. TABLA: MOVIMIENTOS DE EFECTIVO (Módulo separado también en supabase/cashMovements/cash_movements.sql)
CREATE TABLE IF NOT EXISTS public.cash_movements (
    id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    cash_cut_id BIGINT REFERENCES public.cash_cuts(id),
    terminal_code VARCHAR(20) NOT NULL CHECK (terminal_code IN ('C1', 'C2')),
    terminal_name VARCHAR(50) NOT NULL DEFAULT 'Caja 1',
    user_id BIGINT REFERENCES public.users(id),
    user_name VARCHAR(100) NOT NULL DEFAULT 'Administrador',
    movement_type VARCHAR(20) NOT NULL CHECK (movement_type IN ('inflow', 'outflow', 'supplier_payout')),
    concept VARCHAR(255) NOT NULL DEFAULT 'Movimiento de efectivo',
    category VARCHAR(100) NOT NULL DEFAULT 'Otros',
    amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    payment_method VARCHAR(30) NOT NULL DEFAULT 'cash' CHECK (payment_method IN ('cash', 'card', 'transfer')),
    notes TEXT,
    is_voided BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cash_movements_type ON public.cash_movements(movement_type);
CREATE INDEX IF NOT EXISTS idx_cash_movements_date ON public.cash_movements(created_at);
CREATE INDEX IF NOT EXISTS idx_cash_movements_cut ON public.cash_movements(cash_cut_id);
CREATE INDEX IF NOT EXISTS idx_cash_movements_terminal ON public.cash_movements(terminal_code);

-- 8. TABLA: KARDEX / MOVIMIENTOS DE INVENTARIO
CREATE TABLE IF NOT EXISTS public.inventory_movements (
    id BIGSERIAL PRIMARY KEY,
    product_id BIGINT NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    movement_type VARCHAR(30) NOT NULL,
    quantity INTEGER NOT NULL,
    previous_stock INTEGER NOT NULL,
    new_stock INTEGER NOT NULL CHECK (new_stock >= 0),
    unit_cost NUMERIC(12, 2),
    reference VARCHAR(60),
    notes TEXT,
    user_name VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. TABLA: FACTURAS DE PROVEEDORES (CFDI)
CREATE TABLE IF NOT EXISTS public.supplier_invoices (
    uuid VARCHAR(64) PRIMARY KEY,
    supplier_name VARCHAR(150),
    supplier_rfc VARCHAR(20),
    folio VARCHAR(40),
    total NUMERIC(12, 2),
    pieces_added INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- POLÍTICAS DE SEGURIDAD RLS (Permitir lectura y escritura con clave anon para el POS)
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_cuts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pos_allow_products" ON public.products;
CREATE POLICY "pos_allow_products" ON public.products FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "pos_allow_users" ON public.users;
CREATE POLICY "pos_allow_users" ON public.users FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "pos_allow_packages" ON public.product_packages;
CREATE POLICY "pos_allow_packages" ON public.product_packages FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "pos_allow_cash_cuts" ON public.cash_cuts;
CREATE POLICY "pos_allow_cash_cuts" ON public.cash_cuts FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "pos_allow_sales" ON public.sales;
CREATE POLICY "pos_allow_sales" ON public.sales FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "pos_allow_sale_items" ON public.sale_items;
CREATE POLICY "pos_allow_sale_items" ON public.sale_items FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "pos_allow_cash_movements" ON public.cash_movements;
CREATE POLICY "pos_allow_cash_movements" ON public.cash_movements FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "pos_allow_inventory_movements" ON public.inventory_movements;
CREATE POLICY "pos_allow_inventory_movements" ON public.inventory_movements FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "pos_allow_supplier_invoices" ON public.supplier_invoices;
CREATE POLICY "pos_allow_supplier_invoices" ON public.supplier_invoices FOR ALL USING (true) WITH CHECK (true);

-- Insertar usuario inicial de Administrador si no existe
INSERT INTO public.users (username, full_name, role, pin)
VALUES ('admin', 'Administrador', 'admin', '1234')
ON CONFLICT (username) DO NOTHING;

-- Insertar cajeros iniciales
INSERT INTO public.users (username, full_name, role, pin)
VALUES 
    ('elena', 'Elena R.', 'cajero', NULL),
    ('cajero', 'Cajero General', 'cajero', NULL)
ON CONFLICT (username) DO NOTHING;

-- =============================================================================
-- PROCEDIMIENTOS ALMACENADOS / RPC PARA CONTINGENCIA EN SUPABASE
-- =============================================================================

-- 1. FUNCIÓN: Obtener estado de turno activo por terminal (C1 o C2)
CREATE OR REPLACE FUNCTION public.get_terminal_shift(p_terminal_code VARCHAR)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_shift RECORD;
    v_sales_count INTEGER := 0;
    v_sales_total NUMERIC(12,2) := 0.00;
    v_cash_sales NUMERIC(12,2) := 0.00;
    v_card_sales NUMERIC(12,2) := 0.00;
    v_transfer_sales NUMERIC(12,2) := 0.00;
    v_mixed_sales NUMERIC(12,2) := 0.00;
    v_avg_ticket NUMERIC(12,2) := 0.00;
    v_sales_list JSONB := '[]'::jsonb;
BEGIN
    SELECT * INTO v_shift
    FROM public.cash_cuts
    WHERE terminal_code = p_terminal_code AND status = 'open'
    ORDER BY opened_at DESC
    LIMIT 1;

    IF v_shift.id IS NULL THEN
        SELECT * INTO v_shift
        FROM public.cash_cuts
        WHERE terminal_code = p_terminal_code
        ORDER BY created_at DESC
        LIMIT 1;

        RETURN jsonb_build_object(
            'is_open', false,
            'terminal_code', p_terminal_code,
            'last_shift', to_jsonb(v_shift),
            'live_totals', jsonb_build_object(
                'total_sales_count', 0,
                'total_sales_amount', 0.00,
                'avg_ticket', 0.00,
                'cash_sales', 0.00,
                'card_sales', 0.00,
                'transfer_sales', 0.00,
                'mixed_sales', 0.00,
                'expected_cash', COALESCE(v_shift.counted_cash, v_shift.expected_cash, 0.00)
            ),
            'sales', '[]'::jsonb
        );
    END IF;

    SELECT 
        COUNT(*),
        COALESCE(SUM(total_net), 0.00),
        COALESCE(SUM(CASE WHEN payment_method = 'cash' THEN total_net WHEN payment_method = 'mixed' THEN COALESCE(cash_amount, 0) ELSE 0 END), 0.00),
        COALESCE(SUM(CASE WHEN payment_method = 'card' THEN total_net WHEN payment_method = 'mixed' THEN COALESCE(card_amount, 0) ELSE 0 END), 0.00),
        COALESCE(SUM(CASE WHEN payment_method = 'transfer' THEN total_net WHEN payment_method = 'mixed' THEN COALESCE(transfer_amount, 0) ELSE 0 END), 0.00),
        COALESCE(SUM(CASE WHEN payment_method = 'mixed' THEN total_net ELSE 0 END), 0.00)
    INTO 
        v_sales_count, v_sales_total, v_cash_sales, v_card_sales, v_transfer_sales, v_mixed_sales
    FROM public.sales
    WHERE terminal_code = p_terminal_code 
      AND status = 'completed'
      AND cash_cut_id = v_shift.id;

    IF v_sales_count > 0 THEN
        v_avg_ticket := ROUND((v_sales_total / v_sales_count), 2);
    END IF;

    SELECT COALESCE(jsonb_agg(to_jsonb(s.*) || jsonb_build_object('items', COALESCE(items_agg.items, '[]'::jsonb))), '[]'::jsonb)
    INTO v_sales_list
    FROM (
        SELECT *
        FROM public.sales
        WHERE terminal_code = p_terminal_code
          AND status = 'completed'
          AND cash_cut_id = v_shift.id
        ORDER BY created_at DESC
    ) s
    LEFT JOIN LATERAL (
        SELECT jsonb_agg(jsonb_build_object(
            'id', si.id,
            'barcode', si.barcode,
            'name', si.product_name,
            'quantity', si.quantity,
            'unitPrice', si.unit_price,
            'discount', si.discount,
            'subtotal', si.subtotal
        )) AS items
        FROM public.sale_items si
        WHERE si.sale_id = s.id
    ) items_agg ON true;

    RETURN jsonb_build_object(
        'is_open', true,
        'terminal_code', p_terminal_code,
        'shift', to_jsonb(v_shift),
        'live_totals', jsonb_build_object(
            'total_sales_count', v_sales_count,
            'total_sales_amount', v_sales_total,
            'avg_ticket', v_avg_ticket,
            'cash_sales', v_cash_sales,
            'card_sales', v_card_sales,
            'transfer_sales', v_transfer_sales,
            'mixed_sales', v_mixed_sales,
            'expected_cash', (v_shift.initial_fund + v_cash_sales + v_shift.cash_inflows - v_shift.cash_outflows - v_shift.supplier_payouts)
        ),
        'sales', v_sales_list
    );
END;
$$;

-- 2. FUNCIÓN: Abrir nuevo turno de caja
CREATE OR REPLACE FUNCTION public.open_terminal_shift(
    p_terminal_code VARCHAR,
    p_terminal_name VARCHAR DEFAULT 'Caja 1',
    p_cashier_name VARCHAR DEFAULT 'Cajero',
    p_initial_fund NUMERIC DEFAULT 1000.00
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_existing RECORD;
    v_new_shift RECORD;
BEGIN
    SELECT * INTO v_existing
    FROM public.cash_cuts
    WHERE terminal_code = p_terminal_code AND status = 'open'
    ORDER BY opened_at DESC
    LIMIT 1;

    IF v_existing.id IS NOT NULL THEN
        RETURN jsonb_build_object(
            'ok', true,
            'already_open', true,
            'message', 'Ya existía un turno abierto para ' || p_terminal_code,
            'shift', to_jsonb(v_existing)
        );
    END IF;

    INSERT INTO public.cash_cuts (
        terminal_code,
        terminal_name,
        cashier_name,
        opened_at,
        initial_fund,
        total_sales_amount,
        total_sales_count,
        cash_sales,
        card_sales,
        transfer_sales,
        mixed_sales,
        cash_inflows,
        cash_outflows,
        supplier_payouts,
        expected_cash,
        counted_cash,
        difference,
        status,
        created_at
    ) VALUES (
        p_terminal_code,
        p_terminal_name,
        COALESCE(p_cashier_name, 'Cajero'),
        timezone('utc'::text, now()),
        COALESCE(p_initial_fund, 1000.00),
        0.00,
        0,
        0.00,
        0.00,
        0.00,
        0.00,
        0.00,
        0.00,
        0.00,
        COALESCE(p_initial_fund, 1000.00),
        0.00,
        0.00,
        'open',
        timezone('utc'::text, now())
    )
    RETURNING * INTO v_new_shift;

    RETURN jsonb_build_object(
        'ok', true,
        'already_open', false,
        'message', 'Turno abierto exitosamente',
        'shift', to_jsonb(v_new_shift)
    );
END;
$$;

-- 3. FUNCIÓN: Cerrar turno y generar corte de caja
CREATE OR REPLACE FUNCTION public.close_terminal_shift(
    p_terminal_code VARCHAR,
    p_counted_cash NUMERIC,
    p_notes TEXT DEFAULT NULL,
    p_cash_inflows NUMERIC DEFAULT 0.00,
    p_cash_outflows NUMERIC DEFAULT 0.00,
    p_supplier_payouts NUMERIC DEFAULT 0.00
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_shift RECORD;
    v_sales_count INTEGER := 0;
    v_sales_total NUMERIC(12,2) := 0.00;
    v_cash_sales NUMERIC(12,2) := 0.00;
    v_card_sales NUMERIC(12,2) := 0.00;
    v_transfer_sales NUMERIC(12,2) := 0.00;
    v_mixed_sales NUMERIC(12,2) := 0.00;
    v_expected_cash NUMERIC(12,2) := 0.00;
    v_difference NUMERIC(12,2) := 0.00;
    v_closed_shift RECORD;
BEGIN
    SELECT * INTO v_shift
    FROM public.cash_cuts
    WHERE terminal_code = p_terminal_code AND status = 'open'
    ORDER BY opened_at DESC
    LIMIT 1
    FOR UPDATE;

    IF v_shift.id IS NULL THEN
        RETURN jsonb_build_object(
            'ok', false,
            'error_code', 'NO_OPEN_SHIFT',
            'error', 'No existe un turno abierto para ' || p_terminal_code || ' o ya fue cerrado.'
        );
    END IF;

    UPDATE public.sales
    SET cash_cut_id = v_shift.id
    WHERE terminal_code = p_terminal_code
      AND created_at >= v_shift.opened_at
      AND (cash_cut_id IS NULL OR cash_cut_id = v_shift.id);

    SELECT 
        COUNT(*),
        COALESCE(SUM(total_net), 0.00),
        COALESCE(SUM(CASE WHEN payment_method = 'cash' THEN total_net WHEN payment_method = 'mixed' THEN COALESCE(cash_amount, 0) ELSE 0 END), 0.00),
        COALESCE(SUM(CASE WHEN payment_method = 'card' THEN total_net WHEN payment_method = 'mixed' THEN COALESCE(card_amount, 0) ELSE 0 END), 0.00),
        COALESCE(SUM(CASE WHEN payment_method = 'transfer' THEN total_net WHEN payment_method = 'mixed' THEN COALESCE(transfer_amount, 0) ELSE 0 END), 0.00),
        COALESCE(SUM(CASE WHEN payment_method = 'mixed' THEN total_net ELSE 0 END), 0.00)
    INTO 
        v_sales_count, v_sales_total, v_cash_sales, v_card_sales, v_transfer_sales, v_mixed_sales
    FROM public.sales
    WHERE cash_cut_id = v_shift.id AND status = 'completed';

    v_expected_cash := v_shift.initial_fund + v_cash_sales 
                       + COALESCE(p_cash_inflows, v_shift.cash_inflows) 
                       - COALESCE(p_cash_outflows, v_shift.cash_outflows) 
                       - COALESCE(p_supplier_payouts, v_shift.supplier_payouts);

    v_difference := COALESCE(p_counted_cash, v_expected_cash) - v_expected_cash;

    UPDATE public.cash_cuts
    SET 
        closed_at = timezone('utc'::text, now()),
        total_sales_amount = v_sales_total,
        total_sales_count = v_sales_count,
        cash_sales = v_cash_sales,
        card_sales = v_card_sales,
        transfer_sales = v_transfer_sales,
        mixed_sales = v_mixed_sales,
        cash_inflows = COALESCE(p_cash_inflows, cash_inflows),
        cash_outflows = COALESCE(p_cash_outflows, cash_outflows),
        supplier_payouts = COALESCE(p_supplier_payouts, supplier_payouts),
        expected_cash = v_expected_cash,
        counted_cash = COALESCE(p_counted_cash, v_expected_cash),
        difference = v_difference,
        status = 'closed',
        notes = COALESCE(p_notes, notes)
    WHERE id = v_shift.id
    RETURNING * INTO v_closed_shift;

    RETURN jsonb_build_object(
        'ok', true,
        'message', 'Turno cerrado y corte registrado permanentemente',
        'shift', to_jsonb(v_closed_shift)
    );
END;
$$;

-- 4. FUNCIÓN ATÓMICA: Registrar venta directamente en Supabase con bloqueo de fila
CREATE OR REPLACE FUNCTION public.register_sale_atomic(
    p_folio VARCHAR,
    p_terminal_code VARCHAR,
    p_terminal_name VARCHAR DEFAULT 'Caja 1',
    p_cashier_name VARCHAR DEFAULT 'Cajero',
    p_subtotal NUMERIC DEFAULT 0.00,
    p_discount NUMERIC DEFAULT 0.00,
    p_total_net NUMERIC DEFAULT 0.00,
    p_payment_method VARCHAR DEFAULT 'cash',
    p_cash_received NUMERIC DEFAULT NULL,
    p_cash_change NUMERIC DEFAULT NULL,
    p_cash_amount NUMERIC DEFAULT NULL,
    p_card_amount NUMERIC DEFAULT NULL,
    p_transfer_amount NUMERIC DEFAULT NULL,
    p_items JSONB DEFAULT '[]'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_shift RECORD;
    v_existing_sale RECORD;
    v_sale_id BIGINT;
    v_item RECORD;
    v_prod RECORD;
    v_item_prod_id BIGINT;
    v_item_qty INTEGER;
    v_item_price NUMERIC(12,2);
    v_item_subtotal NUMERIC(12,2);
    v_item_discount NUMERIC(12,2);
    v_total_pieces INTEGER := 0;
    v_total_items INTEGER := 0;
BEGIN
    SELECT id, folio, total_net, created_at INTO v_existing_sale
    FROM public.sales
    WHERE folio = p_folio
    LIMIT 1;

    IF v_existing_sale.id IS NOT NULL THEN
        RETURN jsonb_build_object(
            'ok', true,
            'duplicate', true,
            'message', 'Venta ya registrada previamente con este folio',
            'sale_id', v_existing_sale.id,
            'folio', v_existing_sale.folio,
            'total_net', v_existing_sale.total_net
        );
    END IF;

    SELECT * INTO v_shift
    FROM public.cash_cuts
    WHERE terminal_code = p_terminal_code AND status = 'open'
    ORDER BY opened_at DESC
    LIMIT 1;

    IF v_shift.id IS NULL THEN
        RETURN jsonb_build_object(
            'ok', false,
            'error_code', 'SHIFT_CLOSED',
            'error', 'La ' || COALESCE(p_terminal_name, p_terminal_code) || ' está cerrada. Debe abrir un nuevo turno antes de registrar ventas.'
        );
    END IF;

    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
        v_item_qty := COALESCE((v_item.value->>'quantity')::INTEGER, 1);
        v_total_pieces := v_total_pieces + v_item_qty;
        v_total_items := v_total_items + 1;

        v_item_prod_id := NULL;
        IF v_item.value ? 'id' AND (v_item.value->>'id') ~ '^[0-9]+$' AND (v_item.value->>'id')::BIGINT < 1000000000 THEN
            v_item_prod_id := (v_item.value->>'id')::BIGINT;
        END IF;

        IF v_item_prod_id IS NULL AND (v_item.value ? 'barcode') AND (v_item.value->>'barcode') <> '' THEN
            SELECT id INTO v_item_prod_id FROM public.products WHERE barcode = (v_item.value->>'barcode') OR sku = (v_item.value->>'barcode') LIMIT 1;
        END IF;

        IF v_item_prod_id IS NOT NULL THEN
            SELECT id, name, stock INTO v_prod FROM public.products WHERE id = v_item_prod_id FOR UPDATE;
            IF v_prod.id IS NOT NULL AND v_prod.stock < v_item_qty THEN
                RETURN jsonb_build_object(
                    'ok', false,
                    'error_code', 'INSUFFICIENT_STOCK',
                    'error', 'Stock insuficiente para "' || v_prod.name || '". Existencias disponibles: ' || v_prod.stock || ', solicitadas: ' || v_item_qty,
                    'product_id', v_prod.id,
                    'current_stock', v_prod.stock,
                    'requested', v_item_qty
                );
            END IF;
            UPDATE public.products SET stock = stock - v_item_qty WHERE id = v_item_prod_id;
        END IF;
    END LOOP;

    INSERT INTO public.sales (
        folio, terminal_code, terminal_name, cashier_name, total_items, total_pieces,
        subtotal, discount, total_net, payment_method, cash_received, cash_change,
        cash_amount, card_amount, transfer_amount, cash_cut_id, status, created_at
    ) VALUES (
        p_folio, p_terminal_code, COALESCE(p_terminal_name, 'Caja 1'), COALESCE(p_cashier_name, 'Cajero'),
        GREATEST(1, v_total_items), GREATEST(1, v_total_pieces), p_subtotal, COALESCE(p_discount, 0.00),
        p_total_net, p_payment_method, p_cash_received, p_cash_change,
        COALESCE(p_cash_amount, CASE WHEN p_payment_method = 'cash' THEN p_total_net ELSE 0.00 END),
        COALESCE(p_card_amount, CASE WHEN p_payment_method = 'card' THEN p_total_net ELSE 0.00 END),
        COALESCE(p_transfer_amount, CASE WHEN p_payment_method = 'transfer' THEN p_total_net ELSE 0.00 END),
        v_shift.id, 'completed', timezone('utc'::text, now())
    ) RETURNING id INTO v_sale_id;

    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
        v_item_qty := COALESCE((v_item.value->>'quantity')::INTEGER, 1);
        v_item_price := COALESCE((v_item.value->>'unitPrice')::NUMERIC, (v_item.value->>'price')::NUMERIC, 0.00);
        v_item_discount := COALESCE((v_item.value->>'discount')::NUMERIC, 0.00);
        v_item_subtotal := COALESCE((v_item.value->>'subtotal')::NUMERIC, (v_item_price * v_item_qty) - v_item_discount);

        v_item_prod_id := NULL;
        IF v_item.value ? 'id' AND (v_item.value->>'id') ~ '^[0-9]+$' AND (v_item.value->>'id')::BIGINT < 1000000000 THEN
            v_item_prod_id := (v_item.value->>'id')::BIGINT;
        END IF;
        IF v_item_prod_id IS NULL AND (v_item.value ? 'barcode') AND (v_item.value->>'barcode') <> '' THEN
            SELECT id INTO v_item_prod_id FROM public.products WHERE barcode = (v_item.value->>'barcode') OR sku = (v_item.value->>'barcode') LIMIT 1;
        END IF;

        INSERT INTO public.sale_items (
            sale_id, product_id, barcode, product_name, unit_price, quantity, discount, subtotal, promo_applied, created_at
        ) VALUES (
            v_sale_id, v_item_prod_id, v_item.value->>'barcode', COALESCE(v_item.value->>'name', 'Artículo'),
            v_item_price, v_item_qty, v_item_discount, v_item_subtotal, v_item.value->>'promo_applied', timezone('utc'::text, now())
        );
    END LOOP;

    RETURN jsonb_build_object(
        'ok', true,
        'duplicate', false,
        'sale_id', v_sale_id,
        'folio', p_folio,
        'cash_cut_id', v_shift.id,
        'terminal_code', p_terminal_code,
        'total_net', p_total_net,
        'message', 'Venta registrada atómicamente con éxito'
    );
END;
$$;

-- 5. FUNCIÓN: Movimientos extraordinarios de efectivo
CREATE OR REPLACE FUNCTION public.register_cash_movement(
    p_terminal_code VARCHAR,
    p_movement_type VARCHAR,
    p_amount NUMERIC,
    p_concept TEXT DEFAULT '',
    p_category VARCHAR DEFAULT 'Otros',
    p_payment_method VARCHAR DEFAULT 'cash',
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_shift RECORD;
    v_mov_id BIGINT;
    v_term_name VARCHAR(50);
BEGIN
    SELECT * INTO v_shift
    FROM public.cash_cuts
    WHERE terminal_code = p_terminal_code AND status = 'open'
    ORDER BY opened_at DESC
    LIMIT 1;

    IF v_shift.id IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', 'No hay turno abierto para ' || p_terminal_code);
    END IF;

    v_term_name := CASE WHEN p_terminal_code = 'C2' THEN 'Caja 2' ELSE 'Caja 1' END;

    INSERT INTO public.cash_movements (
        cash_cut_id, terminal_code, terminal_name, movement_type, amount,
        concept, category, payment_method, user_name, notes, created_at
    ) VALUES (
        v_shift.id, p_terminal_code, v_term_name, p_movement_type, p_amount,
        COALESCE(p_concept, 'Movimiento de efectivo'), COALESCE(p_category, 'Otros'),
        COALESCE(p_payment_method, 'cash'), v_shift.cashier_name, p_notes, timezone('utc'::text, now())
    ) RETURNING id INTO v_mov_id;

    IF p_movement_type = 'inflow' THEN
        UPDATE public.cash_cuts
        SET cash_inflows = cash_inflows + p_amount,
            expected_cash = CASE WHEN p_payment_method = 'cash' THEN expected_cash + p_amount ELSE expected_cash END
        WHERE id = v_shift.id;
    ELSIF p_movement_type = 'outflow' THEN
        UPDATE public.cash_cuts
        SET cash_outflows = cash_outflows + p_amount,
            expected_cash = CASE WHEN p_payment_method = 'cash' THEN expected_cash - p_amount ELSE expected_cash END
        WHERE id = v_shift.id;
    ELSIF p_movement_type = 'supplier_payout' THEN
        UPDATE public.cash_cuts SET supplier_payouts = supplier_payouts + p_amount, expected_cash = expected_cash - p_amount WHERE id = v_shift.id;
    END IF;

    RETURN jsonb_build_object('ok', true, 'movement_id', v_mov_id);
END;
$$;

-- 6. FUNCIÓN: Resumen de ventas del día
CREATE OR REPLACE FUNCTION public.get_daily_sales_summary(
    p_terminal_code VARCHAR DEFAULT 'all'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_total_sales NUMERIC(12,2) := 0.00;
    v_sales_count INTEGER := 0;
    v_cash NUMERIC(12,2) := 0.00;
    v_card NUMERIC(12,2) := 0.00;
    v_transfer NUMERIC(12,2) := 0.00;
BEGIN
    SELECT 
        COUNT(*),
        COALESCE(SUM(total_net), 0.00),
        COALESCE(SUM(cash_amount), 0.00),
        COALESCE(SUM(card_amount), 0.00),
        COALESCE(SUM(transfer_amount), 0.00)
    INTO 
        v_sales_count, v_total_sales, v_cash, v_card, v_transfer
    FROM public.sales
    WHERE status = 'completed'
      AND date(created_at AT TIME ZONE 'UTC') = current_date
      AND (p_terminal_code = 'all' OR terminal_code = p_terminal_code);

    RETURN jsonb_build_object(
        'ok', true,
        'sales_count', v_sales_count,
        'total_sales', v_total_sales,
        'cash_sales', v_cash,
        'card_sales', v_card,
        'transfer_sales', v_transfer
    );
END;
$$;

-- 7. PERMISOS DE EJECUCIÓN (Permitir llamadas RPC con clave pública anónima)
GRANT EXECUTE ON FUNCTION public.get_terminal_shift(VARCHAR) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.open_terminal_shift(VARCHAR, VARCHAR, VARCHAR, NUMERIC) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.close_terminal_shift(VARCHAR, NUMERIC, TEXT, NUMERIC, NUMERIC, NUMERIC) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.register_sale_atomic(VARCHAR, VARCHAR, VARCHAR, VARCHAR, NUMERIC, NUMERIC, NUMERIC, VARCHAR, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, JSONB) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.register_cash_movement(VARCHAR, VARCHAR, NUMERIC, TEXT, VARCHAR, VARCHAR, TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_daily_sales_summary(VARCHAR) TO anon, authenticated, service_role;

