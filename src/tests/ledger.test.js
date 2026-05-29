import { describe, it, expect } from 'vitest'
import { ledger as _ledger, ACCOUNT_TYPE, ACCOUNTS } from '../lib/ledger'

describe('ACCOUNT_TYPE', () => {
  it('covers all expected accounts', () => {
    expect(ACCOUNT_TYPE.wallet_pool).toBe('ASSET')
    expect(ACCOUNT_TYPE.fraud_hold).toBe('LIABILITY')
    expect(ACCOUNT_TYPE.platform_fee).toBe('REVENUE')
    expect(ACCOUNT_TYPE.logistics_cost).toBe('EXPENSE')
  })

  it('ACCOUNTS list matches ACCOUNT_TYPE keys', () => {
    expect(ACCOUNTS).toEqual(Object.keys(ACCOUNT_TYPE))
  })
})

describe('ledger seed state', () => {
  it('has entries after seed', () => {
    expect(_ledger.entryCount).toBeGreaterThan(0)
  })

  it('trial balance is balanced after seed', () => {
    const tb = _ledger.trialBalance()
    expect(tb.balanced).toBe(true)
    expect(Math.abs(tb.totalDebit - tb.totalCredit)).toBeLessThan(0.01)
  })

  it('float_reserve balance is positive', () => {
    expect(_ledger.balance('float_reserve')).toBeGreaterThan(0)
  })
})

describe('ledger.post()', () => {
  it('throws on unbalanced entry', () => {
    expect(() => _ledger.post({
      description: 'bad',
      lines: [
        { account: 'float_reserve', side: 'debit', amount: 100 },
        { account: 'platform_fee',  side: 'credit', amount: 99 },
      ],
    })).toThrow('Unbalanced')
  })

  it('throws on unknown account', () => {
    expect(() => _ledger.post({
      description: 'bad',
      lines: [
        { account: 'unknown_acct', side: 'debit',  amount: 50 },
        { account: 'platform_fee', side: 'credit', amount: 50 },
      ],
    })).toThrow('Unknown account')
  })

  it('throws on non-positive amount', () => {
    expect(() => _ledger.post({
      description: 'bad',
      lines: [
        { account: 'float_reserve', side: 'debit',  amount: 0 },
        { account: 'platform_fee',  side: 'credit', amount: 0 },
      ],
    })).toThrow('Amount must be positive')
  })

  it('posts a valid balanced entry and returns a JE id', () => {
    const id = _ledger.post({
      description: 'test entry',
      lines: [
        { account: 'float_reserve', side: 'debit',  amount: 10 },
        { account: 'platform_fee',  side: 'credit', amount: 10 },
      ],
    })
    expect(id).toMatch(/^JE-\d{6}$/)
  })
})

describe('ledger.balance()', () => {
  it('throws on unknown account', () => {
    expect(() => _ledger.balance('nope')).toThrow('Unknown account')
  })

  it('returns a number', () => {
    expect(typeof _ledger.balance('wallet_pool')).toBe('number')
  })
})

describe('ledger.reconcile()', () => {
  it('returns an object with status field', () => {
    const r = _ledger.reconcile()
    expect(['clean', 'warning', 'critical']).toContain(r.status)
  })

  it('trial_balance is included in result', () => {
    const r = _ledger.reconcile()
    expect(r.trial_balance).toBeDefined()
    expect(r.trial_balance.balanced).toBe(true)
  })
})

describe('ledger.recordDeposit()', () => {
  it('posts a balanced deposit entry', () => {
    const before = _ledger.entryCount
    const id = _ledger.recordDeposit({ userId: 'USR-TEST', grossAud: 10, platformFeeAud: 1 })
    expect(id).toMatch(/^JE-/)
    expect(_ledger.entryCount).toBe(before + 1)
  })
})

describe('ledger.recordPlatformRevenue()', () => {
  it('posts without throwing', () => {
    const id = _ledger.recordPlatformRevenue({ grossAud: 100, platformFeeAud: 15, operatorNetAud: 85, reference: 'TEST-REF' })
    expect(id).toMatch(/^JE-/)
  })
})

describe('ledger.recordFraudHold() / recordFraudRelease()', () => {
  it('round-trips a fraud hold', () => {
    const before = _ledger.balance('fraud_hold')
    _ledger.recordFraudHold({ amount: 50, entityId: 'USR-HOLD' })
    expect(_ledger.balance('fraud_hold')).toBeCloseTo(before + 50, 2)
    _ledger.recordFraudRelease({ amount: 50, entityId: 'USR-HOLD' })
    expect(_ledger.balance('fraud_hold')).toBeCloseTo(before, 2)
  })
})

describe('ledger.statement()', () => {
  it('returns array with running balance', () => {
    const rows = _ledger.statement('platform_fee', 5)
    expect(Array.isArray(rows)).toBe(true)
    if (rows.length > 0) {
      expect(rows[0]).toHaveProperty('balance')
    }
  })
})
