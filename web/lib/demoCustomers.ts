// Shared demo customer data used by the Customer list and Customer Detail pages
// until live API endpoints are wired up for every tab.

export interface Customer {
  id: number
  customer_id: string
  full_name: string
  email: string
  nationality: string
  country_of_residence: string
  industry: string
  occupation?: string
  status: string
  risk_level: string
  risk_score: number
  is_pep: number
  created_at?: string
}

export interface CustomerProfile {
  customer: Customer
  alert_count: number
  open_alerts: number
  report_count: number
  open_reports: number
  ecdd_count: number
  transaction_count: number
  total_transacted: number
  last_transaction?: string
  ecdd_recommendation?: string
  kyc_status?: string
}

export const DEMO_CUSTOMERS: Customer[] = [
  { id: 1, customer_id: "CUST-DEMO0001", full_name: "Jane Smith", email: "jane.smith@email.com", nationality: "Australian", country_of_residence: "Australia", industry: "fintech", occupation: "Software Engineer", status: "active", risk_level: "low", risk_score: 12, is_pep: 0, created_at: new Date(Date.now() - 7776000000).toISOString() },
  { id: 2, customer_id: "CUST-DEMO0002", full_name: "Acme Pty Ltd", email: "compliance@acme.com.au", nationality: "Australian", country_of_residence: "Australia", industry: "banking", occupation: "Corporate Entity", status: "active", risk_level: "medium", risk_score: 48, is_pep: 0, created_at: new Date(Date.now() - 5184000000).toISOString() },
  { id: 3, customer_id: "CUST-DEMO0003", full_name: "Ivan Petrov", email: "ivan.petrov@email.ru", nationality: "Russian", country_of_residence: "Russia", industry: "cryptocurrency", occupation: "Trader", status: "suspended", risk_level: "critical", risk_score: 95, is_pep: 0, created_at: new Date(Date.now() - 2592000000).toISOString() },
  { id: 4, customer_id: "CUST-DEMO0004", full_name: "Li Wei", email: "li.wei@email.cn", nationality: "Chinese", country_of_residence: "China", industry: "real_estate", occupation: "Property Investor", status: "kyc_approved", risk_level: "high", risk_score: 72, is_pep: 1, created_at: new Date(Date.now() - 1296000000).toISOString() },
  { id: 5, customer_id: "CUST-DEMO0005", full_name: "Wei Zhang", email: "wei.zhang@email.com", nationality: "Australian", country_of_residence: "Australia", industry: "real_estate", occupation: "Real Estate Agent", status: "active", risk_level: "medium", risk_score: 35, is_pep: 0, created_at: new Date(Date.now() - 864000000).toISOString() },
]

export const DEMO_PROFILES: Record<string, Partial<CustomerProfile>> = {
  "CUST-DEMO0001": { alert_count: 0, open_alerts: 0, report_count: 1, open_reports: 0, ecdd_count: 1, transaction_count: 42, total_transacted: 87400, ecdd_recommendation: "approve", kyc_status: "approved" },
  "CUST-DEMO0002": { alert_count: 3, open_alerts: 1, report_count: 2, open_reports: 1, ecdd_count: 0, transaction_count: 128, total_transacted: 412000, kyc_status: "approved" },
  "CUST-DEMO0003": { alert_count: 5, open_alerts: 3, report_count: 2, open_reports: 2, ecdd_count: 1, transaction_count: 17, total_transacted: 85000, ecdd_recommendation: "reject", kyc_status: "pending" },
  "CUST-DEMO0004": { alert_count: 4, open_alerts: 2, report_count: 1, open_reports: 0, ecdd_count: 2, transaction_count: 8, total_transacted: 320000, ecdd_recommendation: "monitor", kyc_status: "approved" },
  "CUST-DEMO0005": { alert_count: 1, open_alerts: 0, report_count: 1, open_reports: 0, ecdd_count: 0, transaction_count: 63, total_transacted: 148000, kyc_status: "approved" },
}

export function getCustomerProfile(customer: Customer): CustomerProfile {
  const p = DEMO_PROFILES[customer.customer_id] || {}
  return {
    customer,
    alert_count: 0, open_alerts: 0, report_count: 0, open_reports: 0,
    ecdd_count: 0, transaction_count: 0, total_transacted: 0,
    ...p,
  }
}
