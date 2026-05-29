// Double-entry bookkeeping ledger
// Every financial event posts balanced journal entries (debits = credits).
// Normal balance: ASSET/EXPENSE increase on debit; LIABILITY/EQUITY/REVENUE increase on credit.

import { bus } from './eventBus'
import { audit, AUDIT_ACTIONS } from './audit'

export const ACCOUNT_TYPE = {
  // Assets (normal debit)
  wallet_pool:      'ASSET',
  float_reserve:    'ASSET',
  receivables:      'ASSET',
  // Liabilities (normal credit)
  operator_payable: 'LIABILITY',
  consumer_payable: 'LIABILITY',
  fraud_hold:       'LIABILITY',
  merchant_payable: 'LIABILITY',
  // Revenue (normal credit)
  platform_fee:     'REVENUE',
  marketplace_fee:  'REVENUE',
  // Expense (normal debit)
  logistics_cost:   'EXPENSE',
  processing_cost:  'EXPENSE',
}

export const ACCOUNTS = Object.keys(ACCOUNT_TYPE)

class DoubleEntryLedger {
  #entries = []
  #seq = 0

  // Post a balanced journal entry. Throws if debits ≠ credits.
  post({ description, lines, reference = null, actor = 'system', meta = {} }) {
    const debits  = lines.filter(l => l.side === 'debit').reduce((s, l) => s + l.amount, 0)
    const credits = lines.filter(l => l.side === 'credit').reduce((s, l) => s + l.amount, 0)
    if (Math.abs(debits - credits) > 0.001) {
      throw new Error(`Unbalanced entry: debits ${debits.toFixed(2)} ≠ credits ${credits.toFixed(2)}`)
    }
    for (const l of lines) {
      if (!ACCOUNT_TYPE[l.account]) throw new Error(`Unknown account: ${l.account}`)
      if (l.amount <= 0)           throw new Error(`Amount must be positive: ${l.amount}`)
    }

    const id = `JE-${String(++this.#seq).padStart(6, '0')}`
    const entry = { id, description, lines, reference, actor, meta, timestamp: new Date().toISOString() }
    this.#entries.push(entry)

    void audit(AUDIT_ACTIONS.LEDGER_POSTED, { actor, entityId: id, after: entry })
    return id
  }

  // Running balance for one account (normalised: positive = normal balance side)
  balance(account) {
    const type = ACCOUNT_TYPE[account]
    if (!type) throw new Error(`Unknown account: ${account}`)
    const normalSide = ['ASSET', 'EXPENSE'].includes(type) ? 'debit' : 'credit'
    let bal = 0
    for (const entry of this.#entries) {
      for (const l of entry.lines) {
        if (l.account !== account) continue
        bal += l.side === normalSide ? l.amount : -l.amount
      }
    }
    return Math.round(bal * 100) / 100
  }

  // Trial balance — sum of all debits must equal sum of all credits
  trialBalance() {
    const rows = {}
    for (const entry of this.#entries) {
      for (const l of entry.lines) {
        if (!rows[l.account]) rows[l.account] = { debit: 0, credit: 0 }
        rows[l.account][l.side] += l.amount
      }
    }
    const result = Object.entries(rows).map(([account, { debit, credit }]) => ({
      account, type: ACCOUNT_TYPE[account], debit: Math.round(debit * 100) / 100,
      credit: Math.round(credit * 100) / 100,
    }))
    const totals = result.reduce((acc, r) => ({ debit: acc.debit + r.debit, credit: acc.credit + r.credit }), { debit: 0, credit: 0 })
    return { rows: result, totalDebit: Math.round(totals.debit * 100) / 100, totalCredit: Math.round(totals.credit * 100) / 100, balanced: Math.abs(totals.debit - totals.credit) < 0.01 }
  }

  // Query entries with optional filters
  query({ account, from, to, reference, limit = 100 } = {}) {
    let result = this.#entries
    if (account)   result = result.filter(e => e.lines.some(l => l.account === account))
    if (from)      result = result.filter(e => e.timestamp >= from)
    if (to)        result = result.filter(e => e.timestamp <= to)
    if (reference) result = result.filter(e => e.reference === reference)
    return result.slice(-limit)
  }

  // Running balance column for a statement view
  statement(account, limit = 50) {
    const entries = this.query({ account, limit })
    const type = ACCOUNT_TYPE[account]
    const normalSide = ['ASSET', 'EXPENSE'].includes(type) ? 'debit' : 'credit'
    let running = 0
    return entries.map(e => {
      const line = e.lines.find(l => l.account === account)
      const effect = line.side === normalSide ? line.amount : -line.amount
      running = Math.round((running + effect) * 100) / 100
      return { ...e, lineAmount: line.amount, lineSide: line.side, balance: running }
    })
  }

  // Full reconciliation check
  reconcile() {
    const tb = this.trialBalance()
    const issues = []

    if (!tb.balanced) {
      issues.push({ severity: 'critical', code: 'TRIAL_BALANCE_MISMATCH',
        detail: `Debits ${tb.totalDebit} ≠ credits ${tb.totalCredit}`,
        variance: Math.abs(tb.totalDebit - tb.totalCredit),
        autoFixable: false,
      })
    }

    const floatBal = this.balance('float_reserve')
    if (floatBal < 0) {
      issues.push({ severity: 'critical', code: 'NEGATIVE_FLOAT',
        detail: `Float reserve balance: ${floatBal}`,
        variance: Math.abs(floatBal), autoFixable: false,
      })
    }

    const walletBal    = this.balance('wallet_pool')
    const consumerLiab = this.balance('consumer_payable')
    if (Math.abs(walletBal - consumerLiab) > 1) {
      issues.push({ severity: 'warning', code: 'WALLET_POOL_DRIFT',
        detail: `Wallet pool (${walletBal}) vs consumer_payable (${consumerLiab})`,
        variance: Math.abs(walletBal - consumerLiab), autoFixable: true,
      })
    }

    if (issues.some(i => i.severity === 'critical')) {
      bus.publish('platform.audit.inconsistency', { source: 'ledger', issues })
    }

    return {
      status: issues.length === 0 ? 'clean' : issues.some(i => i.severity === 'critical') ? 'critical' : 'warning',
      issues, trial_balance: tb, checked_at: new Date().toISOString(),
    }
  }

  // ── Convenience factory methods ──────────────────────────────────────────────

  recordDeposit({ userId, grossAud, platformFeeAud, actor = 'system' }) {
    const net = Math.round((grossAud - platformFeeAud) * 100) / 100
    return this.post({
      description: `Consumer deposit — user ${userId}`,
      reference: userId, actor,
      lines: [
        { account: 'float_reserve',    side: 'debit',  amount: grossAud },
        { account: 'platform_fee',     side: 'credit', amount: platformFeeAud },
        { account: 'consumer_payable', side: 'credit', amount: net },
      ],
    })
  }

  recordPlatformRevenue({ grossAud, platformFeeAud, operatorNetAud, reference, actor = 'system' }) {
    return this.post({
      description: `Platform revenue — ${reference}`,
      reference, actor,
      lines: [
        { account: 'float_reserve',   side: 'debit',  amount: grossAud },
        { account: 'platform_fee',    side: 'credit', amount: platformFeeAud },
        { account: 'operator_payable',side: 'credit', amount: operatorNetAud },
      ],
    })
  }

  recordFraudHold({ amount, entityId, actor = 'system' }) {
    return this.post({
      description: `Fraud hold — entity ${entityId}`,
      reference: entityId, actor,
      lines: [
        { account: 'consumer_payable', side: 'debit',  amount },
        { account: 'fraud_hold',       side: 'credit', amount },
      ],
    })
  }

  recordFraudRelease({ amount, entityId, actor = 'system' }) {
    return this.post({
      description: `Fraud hold released — entity ${entityId}`,
      reference: entityId, actor,
      lines: [
        { account: 'fraud_hold',       side: 'debit',  amount },
        { account: 'consumer_payable', side: 'credit', amount },
      ],
    })
  }

  recordOperatorSettlement({ operatorId, amount, actor = 'system' }) {
    return this.post({
      description: `Operator settlement — ${operatorId}`,
      reference: operatorId, actor,
      lines: [
        { account: 'operator_payable', side: 'debit',  amount },
        { account: 'float_reserve',    side: 'credit', amount },
      ],
    })
  }

  get entryCount() { return this.#entries.length }

  // Seed with realistic starting state for demo
  seed() {
    const entries = [
      { description: 'Opening balance — float reserve',     lines: [{ account: 'float_reserve',    side: 'debit',  amount: 250000 }, { account: 'platform_fee', side: 'credit', amount: 250000 }] },
      { description: 'Operator payable balance — May',      lines: [{ account: 'float_reserve',    side: 'debit',  amount: 142840 }, { account: 'operator_payable', side: 'credit', amount: 142840 }] },
      { description: 'Consumer wallet pool — active users', lines: [{ account: 'wallet_pool',       side: 'debit',  amount: 48200  }, { account: 'consumer_payable', side: 'credit', amount: 48200 }] },
      { description: 'Fraud holds — active cases',          lines: [{ account: 'consumer_payable', side: 'debit',  amount: 1840   }, { account: 'fraud_hold',       side: 'credit', amount: 1840 }] },
      { description: 'Marketplace fee income — May MTD',    lines: [{ account: 'float_reserve',    side: 'debit',  amount: 12400  }, { account: 'marketplace_fee',  side: 'credit', amount: 12400 }] },
      { description: 'Logistics payout — May routes',       lines: [{ account: 'logistics_cost',   side: 'debit',  amount: 18600  }, { account: 'float_reserve',    side: 'credit', amount: 18600 }] },
    ]
    for (const e of entries) {
      try { this.post({ ...e, actor: 'seed' }) } catch {}
    }
    return this
  }
}

export const ledger = new DoubleEntryLedger()
ledger.seed()
