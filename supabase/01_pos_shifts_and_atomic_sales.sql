-- =============================================================================
-- MIGRACIÓN 01: TURNOS, CORTES DE CAJA PERSISTENTES Y VENTA ATÓMICA CONCURRENTE
-- =============================================================================

-- 1. Ampliar tabla sales con soporte de turnos y desglose de métodos de pago
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS cash_cut_id BIGINT;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS cash_amount NUMERIC(12, 2) DEFAULT 0.00;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS card_amount NUMERIC(12, 2) DEFAULT 0.00;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS transfer_amount NUMERIC(12, 2) DEFAULT 0.00;

-- Permitir 'transfer' en el check constraint de payment_method
ALTER TABLE public.sales DROP CONSTRAINT IF EXISTS sales_payment_method_check;
ALTER TABLE public.sales ADD CONSTRAINT sales_payment_method_check 
  CHECK (payment_method IN ('cash', 'card', 'qr', 'codi', 'mixed', 'transfer'));

CREATE INDEX IF NOT EXISTS idx_sales_cash_cut_id ON public.sales(cash_cut_id);
CREATE INDEX IF NOT EXISTS idx_sales_terminal_code ON public.sales(terminal_code);

-- 2. Ampliar tabla cash_cuts con soporte de transferencias y pagos mixtos
ALTER TABLE public.cash_cuts ADD COLUMN IF NOT EXISTS transfer_sales NUMERIC(12, 2) NOT NULL DEFAULT 0.00;
ALTER TABLE public.cash_cuts ADD COLUMN IF NOT EXISTS mixed_sales NUMERIC(12, 2) NOT NULL DEFAULT 0.00;

-- Asegurar que sólo haya UN turno abierto por caja de manera concurrente
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_open_shift_per_terminal 
  ON public.cash_cuts(terminal_code) 
  WHERE (status = 'open');

CREATE INDEX IF NOT EXISTS idx_cash_cuts_terminal_opened 
  ON public.cash_cuts(terminal_code, opened_at DESC);

-- Asegurar terminales C1 y C2
INSERT INTO public.terminals (code, name, is_active) VALUES 
  ('C1', 'Caja 1', true),
  ('C2', 'Caja 2', true)
ON CONFLICT (code) DO UPDATE SET is_active = true, name = EXCLUDED.name;

-- 3. FUNCIÓN: Obtener estado de turno activo por terminal
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
BEGIN
    SELECT * INTO v_shift
    FROM public.cash_cuts
    WHERE terminal_code = p_terminal_code AND status = 'open'
    ORDER BY opened_at DESC
    LIMIT 1;

    IF v_shift.id IS NULL THEN
        -- Retornar último turno cerrado para referencia
        SELECT * INTO v_shift
        FROM public.cash_cuts
        WHERE terminal_code = p_terminal_code
        ORDER BY created_at DESC
        LIMIT 1;

        RETURN jsonb_build_object(
            'is_open', false,
            'terminal_code', p_terminal_code,
            'last_shift', to_jsonb(v_shift)
        );
    END IF;

    -- Calcular acumulado en vivo del turno abierto
    SELECT 
        COUNT(*),
        COALESCE(SUM(total_net), 0.00),
        COALESCE(SUM(CASE 
            WHEN payment_method IN ('cash', 'efectivo') THEN total_net 
            WHEN payment_method = 'mixed' THEN COALESCE(cash_amount, 0)
            ELSE 0 
        END), 0.00),
        COALESCE(SUM(CASE 
            WHEN payment_method IN ('card', 'tarjeta') THEN total_net 
            WHEN payment_method = 'mixed' THEN COALESCE(card_amount, 0)
            ELSE 0 
        END), 0.00),
        COALESCE(SUM(CASE 
            WHEN payment_method IN ('transfer', 'qr', 'codi', 'transferencia') THEN total_net 
            WHEN payment_method = 'mixed' THEN COALESCE(transfer_amount, 0)
            ELSE 0 
        END), 0.00),
        COALESCE(SUM(CASE WHEN payment_method = 'mixed' THEN total_net ELSE 0 END), 0.00)
    INTO 
        v_sales_count, v_sales_total, v_cash_sales, v_card_sales, v_transfer_sales, v_mixed_sales
    FROM public.sales
    WHERE terminal_code = p_terminal_code 
      AND status = 'completed'
      AND (cash_cut_id = v_shift.id OR (cash_cut_id IS NULL AND created_at >= v_shift.opened_at));

    RETURN jsonb_build_object(
        'is_open', true,
        'terminal_code', p_terminal_code,
        'shift', to_jsonb(v_shift),
        'live_totals', jsonb_build_object(
            'total_sales_count', v_sales_count,
            'total_sales_amount', v_sales_total,
            'cash_sales', v_cash_sales,
            'card_sales', v_card_sales,
            'transfer_sales', v_transfer_sales,
            'mixed_sales', v_mixed_sales,
            'expected_cash', (v_shift.initial_fund + v_cash_sales + v_shift.cash_inflows - v_shift.cash_outflows - v_shift.supplier_payouts)
        )
    );
END;
$$;

-- 4. FUNCIÓN: Abrir nuevo turno de caja
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
    -- Validar si ya existe un turno abierto para esta caja
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

    -- Insertar nuevo turno
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
        qr_sales,
        codi_sales,
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

-- 5. FUNCIÓN: Cerrar turno y generar corte de caja persistente
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
    -- Localizar el turno abierto bloqueándolo para evitar cortes simultáneos
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
            'error', 'No existe un turno abierto para ' || p_terminal_code || ' o ya fue cerrado previamente.'
        );
    END IF;

    -- Asignar ventas del periodo a este turno
    UPDATE public.sales
    SET cash_cut_id = v_shift.id
    WHERE terminal_code = p_terminal_code
      AND created_at >= v_shift.opened_at
      AND (cash_cut_id IS NULL OR cash_cut_id = v_shift.id);

    -- Calcular importes reales de ventas completadas
    SELECT 
        COUNT(*),
        COALESCE(SUM(total_net), 0.00),
        COALESCE(SUM(CASE 
            WHEN payment_method IN ('cash', 'efectivo') THEN total_net 
            WHEN payment_method = 'mixed' THEN COALESCE(cash_amount, 0)
            ELSE 0 
        END), 0.00),
        COALESCE(SUM(CASE 
            WHEN payment_method IN ('card', 'tarjeta') THEN total_net 
            WHEN payment_method = 'mixed' THEN COALESCE(card_amount, 0)
            ELSE 0 
        END), 0.00),
        COALESCE(SUM(CASE 
            WHEN payment_method IN ('transfer', 'qr', 'codi', 'transferencia') THEN total_net 
            WHEN payment_method = 'mixed' THEN COALESCE(transfer_amount, 0)
            ELSE 0 
        END), 0.00),
        COALESCE(SUM(CASE WHEN payment_method = 'mixed' THEN total_net ELSE 0 END), 0.00)
    INTO 
        v_sales_count, v_sales_total, v_cash_sales, v_card_sales, v_transfer_sales, v_mixed_sales
    FROM public.sales
    WHERE cash_cut_id = v_shift.id AND status = 'completed';

    -- Calcular efectivo esperado y diferencia
    v_expected_cash := v_shift.initial_fund + v_cash_sales 
                       + COALESCE(p_cash_inflows, v_shift.cash_inflows) 
                       - COALESCE(p_cash_outflows, v_shift.cash_outflows) 
                       - COALESCE(p_supplier_payouts, v_shift.supplier_payouts);

    v_difference := COALESCE(p_counted_cash, v_expected_cash) - v_expected_cash;

    -- Actualizar el corte de caja marcándolo como CERRADO
    UPDATE public.cash_cuts
    SET 
        closed_at = timezone('utc'::text, now()),
        total_sales_amount = v_sales_total,
        total_sales_count = v_sales_count,
        cash_sales = v_cash_sales,
        card_sales = v_card_sales,
        transfer_sales = v_transfer_sales,
        mixed_sales = v_mixed_sales,
        qr_sales = v_transfer_sales, -- Compatibilidad con columnas existentes
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

-- 6. FUNCIÓN ATÓMICA: Registrar venta con validación de turno, stock y prevención de duplicados
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
    -- A) IDEMPOTENCIA: Verificar si la venta con este folio ya existe
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

    -- B) VALIDACIÓN DE BLOQUEO: La caja DEBE tener un turno abierto
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

    -- C) VALIDACIÓN DE STOCK CONCURRENTE (FOR UPDATE para evitar sobreventas entre cajas)
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
        v_item_qty := COALESCE((v_item.value->>'quantity')::INTEGER, 1);
        v_total_pieces := v_total_pieces + v_item_qty;
        v_total_items := v_total_items + 1;

        -- Intentar resolver product_id
        IF v_item.value ? 'id' AND (v_item.value->>'id') ~ '^[0-9]+$' THEN
            v_item_prod_id := (v_item.value->>'id')::BIGINT;
        ELSE
            SELECT id INTO v_item_prod_id 
            FROM public.products 
            WHERE barcode = (v_item.value->>'barcode') 
               OR sku = (v_item.value->>'barcode')
            LIMIT 1;
        END IF;

        IF v_item_prod_id IS NOT NULL THEN
            -- Bloqueo de fila para atomicidad
            SELECT id, name, stock INTO v_prod
            FROM public.products
            WHERE id = v_item_prod_id
            FOR UPDATE;

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
        END IF;
    END LOOP;

    -- D) INSERTAR VENTA EN TABLA sales ASOCIADA AL TURNO
    INSERT INTO public.sales (
        folio,
        terminal_code,
        terminal_name,
        cashier_name,
        total_items,
        total_pieces,
        subtotal,
        discount,
        total_net,
        payment_method,
        cash_received,
        cash_change,
        cash_amount,
        card_amount,
        transfer_amount,
        cash_cut_id,
        status,
        created_at
    ) VALUES (
        p_folio,
        p_terminal_code,
        COALESCE(p_terminal_name, 'Caja 1'),
        COALESCE(p_cashier_name, 'Cajero'),
        GREATEST(1, v_total_items),
        GREATEST(1, v_total_pieces),
        p_subtotal,
        COALESCE(p_discount, 0.00),
        p_total_net,
        p_payment_method,
        p_cash_received,
        p_cash_change,
        COALESCE(p_cash_amount, CASE WHEN p_payment_method IN ('cash', 'efectivo') THEN p_total_net ELSE 0.00 END),
        COALESCE(p_card_amount, CASE WHEN p_payment_method IN ('card', 'tarjeta') THEN p_total_net ELSE 0.00 END),
        COALESCE(p_transfer_amount, CASE WHEN p_payment_method IN ('transfer', 'qr', 'codi', 'transferencia') THEN p_total_net ELSE 0.00 END),
        v_shift.id,
        'completed',
        timezone('utc'::text, now())
    )
    RETURNING id INTO v_sale_id;

    -- E) INSERTAR DETALLE DE ARTÍCULOS (El trigger trg_deduct_stock_on_sale_item descuenta y registra en Kardex)
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
        v_item_qty := COALESCE((v_item.value->>'quantity')::INTEGER, 1);
        v_item_price := COALESCE((v_item.value->>'unitPrice')::NUMERIC, (v_item.value->>'price')::NUMERIC, 0.00);
        v_item_discount := COALESCE((v_item.value->>'discount')::NUMERIC, 0.00);
        v_item_subtotal := COALESCE((v_item.value->>'subtotal')::NUMERIC, (v_item_price * v_item_qty) - v_item_discount);

        v_item_prod_id := NULL;
        IF v_item.value ? 'id' AND (v_item.value->>'id') ~ '^[0-9]+$' THEN
            v_item_prod_id := (v_item.value->>'id')::BIGINT;
        ELSE
            SELECT id INTO v_item_prod_id 
            FROM public.products 
            WHERE barcode = (v_item.value->>'barcode') 
               OR sku = (v_item.value->>'barcode')
            LIMIT 1;
        END IF;

        INSERT INTO public.sale_items (
            sale_id,
            product_id,
            barcode,
            sku,
            product_name,
            unit_price,
            quantity,
            discount,
            subtotal,
            promo_applied,
            created_at
        ) VALUES (
            v_sale_id,
            v_item_prod_id,
            v_item.value->>'barcode',
            v_item.value->>'sku',
            COALESCE(v_item.value->>'name', 'Artículo'),
            v_item_price,
            v_item_qty,
            v_item_discount,
            v_item_subtotal,
            v_item.value->>'promo_applied',
            timezone('utc'::text, now())
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

-- 7. PERMISOS Y RLS
GRANT EXECUTE ON FUNCTION public.get_terminal_shift(VARCHAR) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.open_terminal_shift(VARCHAR, VARCHAR, VARCHAR, NUMERIC) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.close_terminal_shift(VARCHAR, NUMERIC, TEXT, NUMERIC, NUMERIC, NUMERIC) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.register_sale_atomic(VARCHAR, VARCHAR, VARCHAR, VARCHAR, NUMERIC, NUMERIC, NUMERIC, VARCHAR, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, JSONB) TO anon, authenticated, service_role;
