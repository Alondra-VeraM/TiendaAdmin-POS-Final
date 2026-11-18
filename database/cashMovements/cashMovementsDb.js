/**
 * ==============================================================================
 * MÓDULO LOCAL DB: MOVIMIENTOS DE CAJA (INGRESOS Y EGRESOS)
 * ==============================================================================
 * Responsabilidades extraídas de database/localDb.js:
 * 1. Consulta de movimientos con filtros (terminal, turno, límite)
 * 2. Registro de movimientos económicos (inflow/outflow) con validación de efectivo físico
 * 3. Eliminación de movimientos
 * 4. Registro atómico dentro de turnos activos con recálculo de esperados
 * ==============================================================================
 */

const CASH_MOVEMENTS_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS cash_movements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cash_cut_id INTEGER REFERENCES cash_cuts(id),
  terminal_code TEXT NOT NULL CHECK (terminal_code IN ('C1','C2')),
  terminal_name TEXT NOT NULL,
  user_id INTEGER REFERENCES users(id),
  user_name TEXT NOT NULL DEFAULT 'Administrador',
  movement_type TEXT NOT NULL CHECK (movement_type IN ('inflow','outflow')),
  concept TEXT NOT NULL,
  category TEXT NOT NULL,
  amount REAL NOT NULL CHECK (amount > 0),
  payment_method TEXT NOT NULL DEFAULT 'cash' CHECK (payment_method IN ('cash','card','transfer')),
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
`;

function createCashMovementsModule({
  initLocalDatabase,
  terminalCode,
  TERMINALS,
  toCents,
  num,
  str,
  PosError,
  getOpenCut,
  computeShiftTotals,
  createLocalSnapshot,
  tx,
  nowIso
}) {
  /**
   * Registra un movimiento extraordinario en un turno activo (validando efectivo físico disponible)
   */
  function registerCashMovement(code, type, amount, concept, user) {
    const tc = terminalCode(code);
    const rawType = String(type).toLowerCase();
    const normalizedType = (rawType === 'income' || rawType === 'inflow') ? 'inflow' : 'outflow';
    const amt = num(amount, { name: 'Monto', min: 0.01, max: 500000 });
    return tx((d) => {
      const cut = getOpenCut(d, tc);
      if (!cut) throw new PosError('SHIFT_CLOSED', `${TERMINALS[tc]} no tiene un turno abierto.`, 409);
      if (normalizedType !== 'inflow') {
        const t = computeShiftTotals(d, cut);
        if (toCents(amt) > toCents(t.expected_cash)) {
          throw new PosError('INSUFFICIENT_CASH', `No hay suficiente efectivo en caja. Disponible: $${t.expected_cash.toFixed(2)}.`, 409);
        }
      }
      const info = d.prepare(`
        INSERT INTO cash_movements (
          cash_cut_id, terminal_code, terminal_name, user_id, user_name,
          movement_type, concept, category, amount, payment_method, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        cut.id,
        tc,
        TERMINALS[tc],
        user?.id || null,
        user?.full_name || 'Cajero',
        normalizedType,
        concept ? String(concept).slice(0, 150) : 'Movimiento de efectivo',
        normalizedType === 'inflow' ? 'Otros ingresos' : 'Otros gastos',
        amt,
        'cash',
        null
      );
      try { createLocalSnapshot('movimiento_caja'); } catch (_) {}
      return {
        ok: true,
        movement_id: Number(info.lastInsertRowid),
        totals: computeShiftTotals(d, cut)
      };
    });
  }

  /**
   * Consulta movimientos de caja locales (ingresos y egresos)
   */
  function getCashMovements(options = {}) {
    const d = initLocalDatabase();
    let query = 'SELECT * FROM cash_movements';
    const where = [];
    const params = [];

    if (options.terminal && options.terminal !== 'all') {
      where.push('terminal_code = ?');
      params.push(terminalCode(options.terminal));
    }
    if (options.cash_cut_id) {
      where.push('cash_cut_id = ?');
      params.push(Number(options.cash_cut_id));
    }

    if (where.length > 0) {
      query += ' WHERE ' + where.join(' AND ');
    }

    query += ' ORDER BY created_at DESC, id DESC';

    if (options.limit) {
      query += ' LIMIT ?';
      params.push(Number(options.limit));
    }

    return d.prepare(query).all(...params);
  }

  /**
   * Guarda un movimiento económico (inflow / outflow) proveniente del modal o de sincronización
   */
  function saveCashMovement(mov, user) {
    const d = initLocalDatabase();
    const tc = terminalCode(mov.terminal_code || 'C1');
    const tName = mov.terminal_name || TERMINALS[tc] || 'Caja 1';
    const rawType = String(mov.movement_type || mov.type || '').toLowerCase();
    const type = (rawType === 'income' || rawType === 'inflow') ? 'inflow' : 'outflow';
    const amt = num(mov.amount, { name: 'Monto', min: 0.01, max: 500000 });
    const concept = str(mov.concept, { name: 'Concepto', min: 1, max: 255 });
    const category = String(mov.category || 'Otros').trim() || 'Otros';
    const method = ['cash', 'card', 'transfer'].includes(mov.payment_method) ? mov.payment_method : 'cash';
    const notes = mov.notes ? String(mov.notes).slice(0, 300) : null;
    const userName = (user && (user.full_name || user.name)) || mov.user_name || 'Administrador';
    const userId = (user && user.id) || mov.user_id || null;

    // Asociar con el turno actualmente abierto en la terminal si no se envió cash_cut_id
    let cutId = mov.cash_cut_id ? Number(mov.cash_cut_id) : null;
    if (!cutId) {
      const openCut = getOpenCut(d, tc);
      if (openCut) cutId = openCut.id;
    }

    // Si es un egreso en efectivo y hay turno abierto, validar que haya suficiente efectivo esperado
    if (type === 'outflow' && method === 'cash' && cutId) {
      const cut = d.prepare('SELECT * FROM cash_cuts WHERE id = ?').get(cutId);
      if (cut) {
        const totals = computeShiftTotals(d, cut);
        if (toCents(amt) > toCents(totals.expected_cash)) {
          throw new PosError('INSUFFICIENT_CASH', `No hay suficiente efectivo en caja. Disponible: $${totals.expected_cash.toFixed(2)}.`, 409);
        }
      }
    }

    const createdAt = mov.created_at || nowIso();

    const info = d.prepare(`
      INSERT INTO cash_movements (
        cash_cut_id, terminal_code, terminal_name, user_id, user_name,
        movement_type, concept, category, amount, payment_method, notes, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(cutId, tc, tName, userId, userName, type, concept, category, amt, method, notes, createdAt);

    try { createLocalSnapshot('movimiento_caja'); } catch (_) {}
    const inserted = d.prepare('SELECT * FROM cash_movements WHERE id = ?').get(Number(info.lastInsertRowid));
    return { ok: true, id: Number(info.lastInsertRowid), movement: inserted };
  }

  /**
   * Elimina un movimiento económico por ID
   */
  function deleteCashMovement(id) {
    const d = initLocalDatabase();
    const targetId = Number(id);
    const mov = d.prepare('SELECT * FROM cash_movements WHERE id = ?').get(targetId);
    if (!mov) {
      return { ok: true, notFound: true };
    }
    d.prepare('DELETE FROM cash_movements WHERE id = ?').run(targetId);
    try { createLocalSnapshot('movimiento_caja'); } catch (_) {}
    return { ok: true, deleted: mov };
  }

  return {
    registerCashMovement,
    getCashMovements,
    saveCashMovement,
    deleteCashMovement
  };
}

module.exports = {
  CASH_MOVEMENTS_TABLE_SQL,
  createCashMovementsModule
};
