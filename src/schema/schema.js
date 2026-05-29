// Normalized relational database schema definition for the EcoBin platform.
// This is a schema description object — not an ORM, not executable DDL.
// It serves as the single source of truth for table structure, constraints, and behaviour flags.

export const SCHEMA = {

  users: {
    description: 'Consumer, merchant, operator, and admin accounts. Central identity table.',
    immutable: false,
    soft_delete: true,
    audit_all: false,
    fields: {
      id:               { type: 'uuid',        primary: true, default: 'gen_random_uuid()' },
      email:            { type: 'text',        nullable: false, unique: true },
      phone:            { type: 'text',        nullable: true },
      password_hash:    { type: 'text',        nullable: false },
      role:             { type: 'text',        nullable: false, enum: ['consumer','merchant','operator','admin','super_admin'] },
      kyc_status:       { type: 'text',        nullable: false, default: "'pending'", enum: ['pending','approved','rejected'] },
      tier:             { type: 'text',        nullable: false, default: "'bronze'", enum: ['bronze','silver','gold','platinum'] },
      lifetime_points:  { type: 'bigint',      nullable: false, default: '0' },
      wallet_balance_pts: { type: 'bigint',    nullable: false, default: '0' },
      referral_code:    { type: 'text',        nullable: true, unique: true },
      referred_by:      { type: 'uuid',        nullable: true },
      created_at:       { type: 'timestamptz', nullable: false, default: 'now()' },
      updated_at:       { type: 'timestamptz', nullable: false, default: 'now()' },
      deleted_at:       { type: 'timestamptz', nullable: true },
    },
    indices: [
      { fields: ['email'],        unique: true },
      { fields: ['phone'],        unique: false },
      { fields: ['referral_code'], unique: true },
      { fields: ['role'],         unique: false },
      { fields: ['kyc_status'],   unique: false },
      { fields: ['created_at'],   unique: false },
    ],
    constraints: [
      { type: 'check', expr: "role IN ('consumer','merchant','operator','admin','super_admin')", name: 'chk_users_role' },
      { type: 'check', expr: "kyc_status IN ('pending','approved','rejected')",                 name: 'chk_users_kyc_status' },
      { type: 'check', expr: "tier IN ('bronze','silver','gold','platinum')",                   name: 'chk_users_tier' },
      { type: 'check', expr: 'lifetime_points >= 0',                                            name: 'chk_users_lifetime_points_positive' },
      { type: 'check', expr: 'wallet_balance_pts >= 0',                                         name: 'chk_users_wallet_balance_positive' },
      { type: 'foreign_key', from: 'referred_by', to: 'users.id', on_delete: 'set null' },
    ],
    references: [],
  },

  kyc_documents: {
    description: 'Immutable records of identity documents submitted for KYC verification.',
    immutable: true,
    soft_delete: false,
    audit_all: false,
    fields: {
      id:           { type: 'uuid',        primary: true, default: 'gen_random_uuid()' },
      user_id:      { type: 'uuid',        nullable: false },
      doc_type:     { type: 'text',        nullable: false, enum: ['passport','drivers_licence','national_id','utility_bill'] },
      doc_hash:     { type: 'text',        nullable: false },
      status:       { type: 'text',        nullable: false, default: "'pending'", enum: ['pending','approved','rejected'] },
      reviewed_by:  { type: 'uuid',        nullable: true },
      reviewed_at:  { type: 'timestamptz', nullable: true },
      created_at:   { type: 'timestamptz', nullable: false, default: 'now()' },
    },
    indices: [
      { fields: ['user_id'],    unique: false },
      { fields: ['status'],     unique: false },
      { fields: ['reviewed_by'], unique: false },
    ],
    constraints: [
      { type: 'check', expr: "doc_type IN ('passport','drivers_licence','national_id','utility_bill')", name: 'chk_kyc_doc_type' },
      { type: 'check', expr: "status IN ('pending','approved','rejected')",                            name: 'chk_kyc_status' },
      { type: 'foreign_key', from: 'user_id',     to: 'users.id', on_delete: 'restrict' },
      { type: 'foreign_key', from: 'reviewed_by', to: 'users.id', on_delete: 'set null' },
    ],
    references: ['users'],
  },

  deposits: {
    description: 'Each recycling deposit event — scan, weight, composition, and reward outcome.',
    immutable: false,
    soft_delete: false,
    audit_all: true,
    fields: {
      id:                 { type: 'uuid',        primary: true, default: 'gen_random_uuid()' },
      user_id:            { type: 'uuid',        nullable: false },
      operator_id:        { type: 'uuid',        nullable: false },
      zone_id:            { type: 'uuid',        nullable: true },
      item_type:          { type: 'text',        nullable: false, enum: ['copper','aluminium','steel','pcb','battery'] },
      weight_kg:          { type: 'numeric(10,3)', nullable: false },
      declared_weight_kg: { type: 'numeric(10,3)', nullable: true },
      points_awarded:     { type: 'bigint',      nullable: false, default: '0' },
      status:             { type: 'text',        nullable: false, default: "'pending'", enum: ['pending','approved','rejected','flagged'] },
      scan_lat:           { type: 'numeric(9,6)',  nullable: true },
      scan_lng:           { type: 'numeric(9,6)',  nullable: true },
      barcode:            { type: 'text',        nullable: true },
      composition_score:  { type: 'numeric(5,2)', nullable: true },
      created_at:         { type: 'timestamptz', nullable: false, default: 'now()' },
      updated_at:         { type: 'timestamptz', nullable: false, default: 'now()' },
    },
    indices: [
      { fields: ['user_id'],     unique: false },
      { fields: ['operator_id'], unique: false },
      { fields: ['zone_id'],     unique: false },
      { fields: ['status'],      unique: false },
      { fields: ['barcode'],     unique: false },
      { fields: ['created_at'],  unique: false },
    ],
    constraints: [
      { type: 'check', expr: "status IN ('pending','approved','rejected','flagged')",               name: 'chk_deposits_status' },
      { type: 'check', expr: "item_type IN ('copper','aluminium','steel','pcb','battery')",         name: 'chk_deposits_item_type' },
      { type: 'check', expr: 'weight_kg > 0',                                                       name: 'chk_deposits_weight_positive' },
      { type: 'check', expr: 'points_awarded >= 0',                                                 name: 'chk_deposits_points_positive' },
      { type: 'check', expr: 'composition_score IS NULL OR (composition_score >= 0 AND composition_score <= 100)', name: 'chk_deposits_composition_score' },
      { type: 'foreign_key', from: 'user_id',     to: 'users.id', on_delete: 'restrict' },
      { type: 'foreign_key', from: 'operator_id', to: 'users.id', on_delete: 'restrict' },
    ],
    references: ['users'],
  },

  ledger_entries: {
    description: 'Append-only double-entry ledger. Every point movement is recorded here with a hash chain.',
    immutable: true,
    soft_delete: false,
    audit_all: false,
    fields: {
      id:            { type: 'uuid',        primary: true, default: 'gen_random_uuid()' },
      entity_id:     { type: 'uuid',        nullable: false },
      entity_type:   { type: 'text',        nullable: false, enum: ['user','operator','merchant'] },
      amount_pts:    { type: 'bigint',      nullable: false },
      direction:     { type: 'text',        nullable: false, enum: ['credit','debit'] },
      type:          { type: 'text',        nullable: false, enum: ['deposit','payout','bonus','referral','redemption','adjustment'] },
      ref_id:        { type: 'uuid',        nullable: true },
      ref_type:      { type: 'text',        nullable: true },
      balance_after: { type: 'bigint',      nullable: false },
      prev_hash:     { type: 'text',        nullable: false },
      hash:          { type: 'text',        nullable: false, unique: true },
      created_at:    { type: 'timestamptz', nullable: false, default: 'now()' },
    },
    indices: [
      { fields: ['entity_id', 'entity_type'], unique: false },
      { fields: ['type'],      unique: false },
      { fields: ['ref_id'],    unique: false },
      { fields: ['created_at'], unique: false },
      { fields: ['hash'],      unique: true },
    ],
    constraints: [
      { type: 'check', expr: "entity_type IN ('user','operator','merchant')",                                         name: 'chk_ledger_entity_type' },
      { type: 'check', expr: "direction IN ('credit','debit')",                                                       name: 'chk_ledger_direction' },
      { type: 'check', expr: "type IN ('deposit','payout','bonus','referral','redemption','adjustment')",             name: 'chk_ledger_type' },
      { type: 'check', expr: 'amount_pts > 0',                                                                        name: 'chk_ledger_amount_positive' },
    ],
    references: [],
  },

  payout_requests: {
    description: 'Cash-out requests from users, tracked through approval and release lifecycle.',
    immutable: false,
    soft_delete: false,
    audit_all: true,
    fields: {
      id:               { type: 'uuid',        primary: true, default: 'gen_random_uuid()' },
      user_id:          { type: 'uuid',        nullable: false },
      amount_pts:       { type: 'bigint',      nullable: false },
      amount_aud:       { type: 'numeric(12,2)', nullable: false },
      status:           { type: 'text',        nullable: false, default: "'pending'", enum: ['pending','held','approved','released','rejected'] },
      idempotency_key:  { type: 'text',        nullable: false, unique: true },
      hold_reason:      { type: 'text',        nullable: true },
      held_at:          { type: 'timestamptz', nullable: true },
      approved_by:      { type: 'uuid',        nullable: true },
      approved_at:      { type: 'timestamptz', nullable: true },
      released_at:      { type: 'timestamptz', nullable: true },
      rejected_at:      { type: 'timestamptz', nullable: true },
      rejection_reason: { type: 'text',        nullable: true },
      bsb_hash:         { type: 'text',        nullable: true },
      account_hash:     { type: 'text',        nullable: true },
      created_at:       { type: 'timestamptz', nullable: false, default: 'now()' },
      updated_at:       { type: 'timestamptz', nullable: false, default: 'now()' },
    },
    indices: [
      { fields: ['user_id'],         unique: false },
      { fields: ['status'],          unique: false },
      { fields: ['idempotency_key'], unique: true },
      { fields: ['created_at'],      unique: false },
    ],
    constraints: [
      { type: 'check', expr: "status IN ('pending','held','approved','released','rejected')", name: 'chk_payout_status' },
      { type: 'check', expr: 'amount_pts > 0',                                               name: 'chk_payout_amount_pts_positive' },
      { type: 'check', expr: 'amount_aud > 0',                                               name: 'chk_payout_amount_aud_positive' },
      { type: 'foreign_key', from: 'user_id',     to: 'users.id', on_delete: 'restrict' },
      { type: 'foreign_key', from: 'approved_by', to: 'users.id', on_delete: 'set null' },
    ],
    references: ['users'],
  },

  fraud_signals: {
    description: 'Immutable record of every fraud signal raised against any entity.',
    immutable: true,
    soft_delete: false,
    audit_all: false,
    fields: {
      id:          { type: 'uuid',        primary: true, default: 'gen_random_uuid()' },
      entity_id:   { type: 'uuid',        nullable: false },
      entity_type: { type: 'text',        nullable: false, enum: ['user','operator','merchant','deposit'] },
      signal_type: { type: 'text',        nullable: false },
      severity:    { type: 'text',        nullable: false, enum: ['low','medium','high','critical'] },
      rule_id:     { type: 'text',        nullable: false },
      detail_json: { type: 'jsonb',       nullable: true },
      created_at:  { type: 'timestamptz', nullable: false, default: 'now()' },
    },
    indices: [
      { fields: ['entity_id', 'entity_type'], unique: false },
      { fields: ['signal_type'], unique: false },
      { fields: ['severity'],    unique: false },
      { fields: ['rule_id'],     unique: false },
      { fields: ['created_at'],  unique: false },
    ],
    constraints: [
      { type: 'check', expr: "entity_type IN ('user','operator','merchant','deposit')", name: 'chk_fraud_signal_entity_type' },
      { type: 'check', expr: "severity IN ('low','medium','high','critical')",          name: 'chk_fraud_signal_severity' },
    ],
    references: [],
  },

  fraud_cases: {
    description: 'Active investigation cases aggregating signals against a single entity.',
    immutable: false,
    soft_delete: false,
    audit_all: false,
    fields: {
      id:                { type: 'uuid',        primary: true, default: 'gen_random_uuid()' },
      entity_id:         { type: 'uuid',        nullable: false },
      entity_type:       { type: 'text',        nullable: false, enum: ['user','operator','merchant'] },
      risk_score:        { type: 'integer',     nullable: false, default: '0' },
      primary_signal:    { type: 'text',        nullable: false },
      status:            { type: 'text',        nullable: false, default: "'open'", enum: ['open','suspended','resolved'] },
      assigned_to:       { type: 'uuid',        nullable: true },
      amount_at_risk_aud: { type: 'numeric(12,2)', nullable: true },
      opened_at:         { type: 'timestamptz', nullable: false, default: 'now()' },
      resolved_at:       { type: 'timestamptz', nullable: true },
      created_at:        { type: 'timestamptz', nullable: false, default: 'now()' },
      updated_at:        { type: 'timestamptz', nullable: false, default: 'now()' },
    },
    indices: [
      { fields: ['entity_id', 'entity_type'], unique: false },
      { fields: ['status'],      unique: false },
      { fields: ['assigned_to'], unique: false },
      { fields: ['opened_at'],   unique: false },
    ],
    constraints: [
      { type: 'check', expr: "entity_type IN ('user','operator','merchant')",   name: 'chk_fraud_case_entity_type' },
      { type: 'check', expr: "status IN ('open','suspended','resolved')",        name: 'chk_fraud_case_status' },
      { type: 'check', expr: 'risk_score >= 0 AND risk_score <= 100',           name: 'chk_fraud_case_risk_score_range' },
      { type: 'check', expr: 'amount_at_risk_aud IS NULL OR amount_at_risk_aud >= 0', name: 'chk_fraud_case_amount_positive' },
      { type: 'foreign_key', from: 'assigned_to', to: 'users.id', on_delete: 'set null' },
    ],
    references: ['users'],
  },

  fraud_actions: {
    description: 'Immutable log of every action taken on a fraud case.',
    immutable: true,
    soft_delete: false,
    audit_all: false,
    fields: {
      id:         { type: 'uuid',        primary: true, default: 'gen_random_uuid()' },
      case_id:    { type: 'uuid',        nullable: false },
      action:     { type: 'text',        nullable: false, enum: ['hold_payout','manual_review','reject','suspend'] },
      actor:      { type: 'uuid',        nullable: false },
      reason:     { type: 'text',        nullable: false },
      created_at: { type: 'timestamptz', nullable: false, default: 'now()' },
    },
    indices: [
      { fields: ['case_id'],    unique: false },
      { fields: ['actor'],      unique: false },
      { fields: ['created_at'], unique: false },
    ],
    constraints: [
      { type: 'check', expr: "action IN ('hold_payout','manual_review','reject','suspend')", name: 'chk_fraud_action_type' },
      { type: 'foreign_key', from: 'case_id', to: 'fraud_cases.id', on_delete: 'restrict' },
      { type: 'foreign_key', from: 'actor',   to: 'users.id',       on_delete: 'restrict' },
    ],
    references: ['fraud_cases', 'users'],
  },

  pricing_overrides: {
    description: 'Immutable audit trail of every manual commodity price override.',
    immutable: true,
    soft_delete: false,
    audit_all: false,
    fields: {
      id:             { type: 'uuid',        primary: true, default: 'gen_random_uuid()' },
      commodity_id:   { type: 'text',        nullable: false, enum: ['copper','aluminium','steel','pcb','battery'] },
      override_value: { type: 'numeric(10,4)', nullable: false },
      previous_value: { type: 'numeric(10,4)', nullable: false },
      reason:         { type: 'text',        nullable: false },
      actor:          { type: 'uuid',        nullable: false },
      approved_by:    { type: 'uuid',        nullable: true },
      approved_at:    { type: 'timestamptz', nullable: true },
      expires_at:     { type: 'timestamptz', nullable: true },
      created_at:     { type: 'timestamptz', nullable: false, default: 'now()' },
    },
    indices: [
      { fields: ['commodity_id'], unique: false },
      { fields: ['actor'],        unique: false },
      { fields: ['created_at'],   unique: false },
      { fields: ['expires_at'],   unique: false },
    ],
    constraints: [
      { type: 'check', expr: "commodity_id IN ('copper','aluminium','steel','pcb','battery')", name: 'chk_pricing_commodity' },
      { type: 'check', expr: 'override_value > 0',                                            name: 'chk_pricing_override_positive' },
      { type: 'check', expr: 'previous_value >= 0',                                           name: 'chk_pricing_previous_positive' },
      { type: 'foreign_key', from: 'actor',       to: 'users.id', on_delete: 'restrict' },
      { type: 'foreign_key', from: 'approved_by', to: 'users.id', on_delete: 'set null' },
    ],
    references: ['users'],
  },

  settlements: {
    description: 'Operator settlement batches — aggregated payment runs covering a billing period.',
    immutable: false,
    soft_delete: false,
    audit_all: false,
    fields: {
      id:           { type: 'uuid',        primary: true, default: 'gen_random_uuid()' },
      operator_id:  { type: 'uuid',        nullable: false },
      batch_id:     { type: 'text',        nullable: false, unique: true },
      period_start: { type: 'timestamptz', nullable: false },
      period_end:   { type: 'timestamptz', nullable: false },
      gross_aud:    { type: 'numeric(14,2)', nullable: false, default: '0' },
      fee_aud:      { type: 'numeric(14,2)', nullable: false, default: '0' },
      net_aud:      { type: 'numeric(14,2)', nullable: false, default: '0' },
      status:       { type: 'text',        nullable: false, default: "'pending'", enum: ['pending','approved','processing','completed','failed','held'] },
      processed_at: { type: 'timestamptz', nullable: true },
      created_at:   { type: 'timestamptz', nullable: false, default: 'now()' },
      updated_at:   { type: 'timestamptz', nullable: false, default: 'now()' },
    },
    indices: [
      { fields: ['operator_id'],              unique: false },
      { fields: ['batch_id'],                 unique: true },
      { fields: ['status'],                   unique: false },
      { fields: ['period_start', 'period_end'], unique: false },
    ],
    constraints: [
      { type: 'check', expr: "status IN ('pending','approved','processing','completed','failed','held')", name: 'chk_settlement_status' },
      { type: 'check', expr: 'gross_aud >= 0',                                                           name: 'chk_settlement_gross_positive' },
      { type: 'check', expr: 'fee_aud >= 0',                                                             name: 'chk_settlement_fee_positive' },
      { type: 'check', expr: 'net_aud >= 0',                                                             name: 'chk_settlement_net_positive' },
      { type: 'check', expr: 'period_end > period_start',                                                name: 'chk_settlement_period_valid' },
      { type: 'foreign_key', from: 'operator_id', to: 'users.id', on_delete: 'restrict' },
    ],
    references: ['users'],
  },

  webhook_endpoints: {
    description: 'Registered webhook destinations for operators and merchants.',
    immutable: false,
    soft_delete: false,
    audit_all: false,
    fields: {
      id:               { type: 'uuid',        primary: true, default: 'gen_random_uuid()' },
      entity_id:        { type: 'uuid',        nullable: false },
      entity_type:      { type: 'text',        nullable: false, enum: ['operator','merchant'] },
      url:              { type: 'text',        nullable: false },
      events:           { type: 'text[]',      nullable: false },
      secret_hash:      { type: 'text',        nullable: false },
      active:           { type: 'boolean',     nullable: false, default: 'true' },
      last_delivery_at: { type: 'timestamptz', nullable: true },
      failure_count:    { type: 'integer',     nullable: false, default: '0' },
      created_at:       { type: 'timestamptz', nullable: false, default: 'now()' },
      updated_at:       { type: 'timestamptz', nullable: false, default: 'now()' },
    },
    indices: [
      { fields: ['entity_id', 'entity_type'], unique: false },
      { fields: ['active'],    unique: false },
    ],
    constraints: [
      { type: 'check', expr: "entity_type IN ('operator','merchant')",  name: 'chk_webhook_entity_type' },
      { type: 'check', expr: "url LIKE 'https://%'",                    name: 'chk_webhook_url_https' },
      { type: 'check', expr: 'failure_count >= 0',                      name: 'chk_webhook_failure_count_positive' },
    ],
    references: [],
  },

  webhook_deliveries: {
    description: 'Immutable record of every webhook dispatch attempt.',
    immutable: true,
    soft_delete: false,
    audit_all: false,
    fields: {
      id:              { type: 'uuid',        primary: true, default: 'gen_random_uuid()' },
      endpoint_id:     { type: 'uuid',        nullable: false },
      event:           { type: 'text',        nullable: false },
      payload_hash:    { type: 'text',        nullable: false },
      status:          { type: 'text',        nullable: false, enum: ['success','failed','retrying'] },
      attempt:         { type: 'integer',     nullable: false, default: '1' },
      response_status: { type: 'integer',     nullable: true },
      delivered_at:    { type: 'timestamptz', nullable: false, default: 'now()' },
    },
    indices: [
      { fields: ['endpoint_id'],  unique: false },
      { fields: ['event'],        unique: false },
      { fields: ['status'],       unique: false },
      { fields: ['delivered_at'], unique: false },
    ],
    constraints: [
      { type: 'check', expr: "status IN ('success','failed','retrying')", name: 'chk_webhook_delivery_status' },
      { type: 'check', expr: 'attempt >= 1',                              name: 'chk_webhook_delivery_attempt_min' },
      { type: 'foreign_key', from: 'endpoint_id', to: 'webhook_endpoints.id', on_delete: 'restrict' },
    ],
    references: ['webhook_endpoints'],
  },

  api_tokens: {
    description: 'API tokens for machine-to-machine access by operators and merchants.',
    immutable: false,
    soft_delete: true,
    audit_all: false,
    fields: {
      id:           { type: 'uuid',        primary: true, default: 'gen_random_uuid()' },
      entity_id:    { type: 'uuid',        nullable: false },
      entity_type:  { type: 'text',        nullable: false, enum: ['operator','merchant','admin'] },
      token_hash:   { type: 'text',        nullable: false, unique: true },
      label:        { type: 'text',        nullable: false },
      permissions:  { type: 'text[]',      nullable: false, default: "'{}'" },
      last_used_at: { type: 'timestamptz', nullable: true },
      expires_at:   { type: 'timestamptz', nullable: true },
      revoked_at:   { type: 'timestamptz', nullable: true },
      created_at:   { type: 'timestamptz', nullable: false, default: 'now()' },
      updated_at:   { type: 'timestamptz', nullable: false, default: 'now()' },
      deleted_at:   { type: 'timestamptz', nullable: true },
    },
    indices: [
      { fields: ['entity_id', 'entity_type'], unique: false },
      { fields: ['token_hash'],  unique: true },
      { fields: ['expires_at'],  unique: false },
      { fields: ['revoked_at'],  unique: false },
    ],
    constraints: [
      { type: 'check', expr: "entity_type IN ('operator','merchant','admin')", name: 'chk_api_token_entity_type' },
    ],
    references: [],
  },

  audit_log: {
    description: 'Immutable append-only audit log with SHA-256 hash chain for tamper detection.',
    immutable: true,
    soft_delete: false,
    audit_all: false,
    fields: {
      id:          { type: 'uuid',        primary: true, default: 'gen_random_uuid()' },
      sequence:    { type: 'bigint',      nullable: false, unique: true },
      action:      { type: 'text',        nullable: false },
      actor:       { type: 'text',        nullable: false },
      entity_id:   { type: 'uuid',        nullable: true },
      entity_type: { type: 'text',        nullable: true },
      before_json: { type: 'jsonb',       nullable: true },
      after_json:  { type: 'jsonb',       nullable: true },
      meta_json:   { type: 'jsonb',       nullable: true },
      prev_hash:   { type: 'text',        nullable: false },
      hash:        { type: 'text',        nullable: false, unique: true },
      ts:          { type: 'timestamptz', nullable: false, default: 'now()' },
    },
    indices: [
      { fields: ['sequence'],               unique: true },
      { fields: ['action'],                 unique: false },
      { fields: ['actor'],                  unique: false },
      { fields: ['entity_id', 'entity_type'], unique: false },
      { fields: ['ts'],                     unique: false },
      { fields: ['hash'],                   unique: true },
    ],
    constraints: [
      { type: 'check', expr: 'sequence > 0', name: 'chk_audit_sequence_positive' },
    ],
    references: [],
  },
}

export const IMMUTABLE_TABLES = Object.entries(SCHEMA)
  .filter(([, t]) => t.immutable)
  .map(([name]) => name)

export const SOFT_DELETE_TABLES = Object.entries(SCHEMA)
  .filter(([, t]) => t.soft_delete)
  .map(([name]) => name)

export const AUDIT_ALL_TABLES = Object.entries(SCHEMA)
  .filter(([, t]) => t.audit_all)
  .map(([name]) => name)

export function validateWrite(tableName, operation) {
  const table = SCHEMA[tableName]
  if (!table) throw new Error(`Unknown table: ${tableName}`)

  const op = operation.toUpperCase()

  if (table.immutable && (op === 'UPDATE' || op === 'DELETE')) {
    throw new Error(
      `Table '${tableName}' is immutable — ${op} is not allowed. Write a new row instead.`
    )
  }

  if (table.soft_delete && op === 'DELETE') {
    throw new Error(
      `Table '${tableName}' uses soft deletes — use UPDATE SET deleted_at = now() instead of DELETE.`
    )
  }
}
