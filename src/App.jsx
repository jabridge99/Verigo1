import React from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'

import MarketingLayout    from './layouts/MarketingLayout'
import OnboardingLayout   from './layouts/OnboardingLayout'
import ConsumerLayout     from './layouts/ConsumerLayout'
import OperatorLayout     from './layouts/OperatorLayout'
import LogisticsLayout    from './layouts/LogisticsLayout'
import AdminLayout        from './layouts/AdminLayout'

import Landing            from './pages/Landing'
import Onboarding         from './pages/Onboarding'
import OperatorEOI        from './pages/marketing/OperatorEOI'

import ConsumerDashboard  from './pages/consumer/Dashboard'
import FindBin            from './pages/consumer/FindBin'
import BookPickup         from './pages/consumer/BookPickup'
import Scan               from './pages/consumer/Scan'
import Wallet             from './pages/consumer/Wallet'
import EcoRewards         from './pages/consumer/EcoRewards'
import Earnings           from './pages/consumer/Earnings'
import HouseholdCircle    from './pages/consumer/HouseholdCircle'
import Referral           from './pages/consumer/Referral'
import Transactions       from './pages/consumer/Transactions'
import Notifications      from './pages/consumer/Notifications'
import Support            from './pages/consumer/Support'
import KYC               from './pages/consumer/KYC'

import OperatorDashboard  from './pages/operator/Dashboard'
import OperatorStations   from './pages/operator/Stations'
import OperatorLogistics  from './pages/operator/Logistics'
import OperatorPricing    from './pages/operator/Pricing'
import OperatorEarnings   from './pages/operator/Earnings'

import LogisticsDashboard        from './pages/logistics/Dashboard'
import LogisticsRoutes            from './pages/logistics/Routes'
import LogisticsJobs              from './pages/logistics/Jobs'
import ContractorMarketplace      from './pages/logistics/ContractorMarketplace'
import PickupProof                from './pages/logistics/PickupProof'

import AdminDashboard       from './pages/admin/Dashboard'
import CommodityPricing     from './pages/admin/CommodityPricing'
import AdminPartners        from './pages/admin/Partners'
import AdminSettlement      from './pages/admin/Settlement'
import AdminStations        from './pages/admin/Stations'
import WomsDashboard        from './pages/admin/WomsDashboard'
import Weighbridge          from './pages/admin/Weighbridge'
import ChainOfCustody       from './pages/admin/ChainOfCustody'
import WarehouseInventory   from './pages/admin/WarehouseInventory'
import RecyclerSettlement   from './pages/admin/RecyclerSettlement'
import TreasuryDashboard    from './pages/admin/TreasuryDashboard'
import Ledger               from './pages/admin/Ledger'
import PayoutApprovals      from './pages/admin/PayoutApprovals'
import ReconciliationEngine from './pages/admin/ReconciliationEngine'
import SettlementBatching   from './pages/admin/SettlementBatching'
import TraderDashboard      from './pages/admin/TraderDashboard'
import MarketIngestion      from './pages/admin/MarketIngestion'
import ScrapPricing         from './pages/admin/ScrapPricing'
import CompetitorIntelligence from './pages/admin/CompetitorIntelligence'
import SentimentEngine      from './pages/admin/SentimentEngine'
import MaterialComposition  from './pages/admin/MaterialComposition'
import DynamicPricing       from './pages/admin/DynamicPricing'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Marketing */}
        <Route element={<MarketingLayout />}>
          <Route path="/"            element={<Landing />} />
          <Route path="/partner/eoi" element={<OperatorEOI />} />
        </Route>

        {/* Onboarding (full-screen, no sidebar) */}
        <Route element={<OnboardingLayout />}>
          <Route path="/onboarding" element={<Onboarding />} />
        </Route>

        {/* Consumer portal */}
        <Route path="/consumer" element={<ConsumerLayout />}>
          <Route index element={<ConsumerDashboard />} />
          <Route path="find"          element={<FindBin />} />
          <Route path="book"          element={<BookPickup />} />
          <Route path="scan"          element={<Scan />} />
          <Route path="wallet"        element={<Wallet />} />
          <Route path="rewards"       element={<EcoRewards />} />
          <Route path="earnings"      element={<Earnings />} />
          <Route path="circle"        element={<HouseholdCircle />} />
          <Route path="referral"      element={<Referral />} />
          <Route path="transactions"  element={<Transactions />} />
          <Route path="notifications" element={<Notifications />} />
          <Route path="support"       element={<Support />} />
          <Route path="kyc"           element={<KYC />} />
        </Route>

        {/* Operator portal */}
        <Route path="/operator" element={<OperatorLayout />}>
          <Route index element={<OperatorDashboard />} />
          <Route path="stations"  element={<OperatorStations />} />
          <Route path="logistics" element={<OperatorLogistics />} />
          <Route path="pricing"   element={<OperatorPricing />} />
          <Route path="earnings"  element={<OperatorEarnings />} />
        </Route>

        {/* Logistics portal — Recovery Logistics Network */}
        <Route path="/logistics" element={<LogisticsLayout />}>
          <Route index element={<LogisticsDashboard />} />
          <Route path="jobs"         element={<LogisticsJobs />} />
          <Route path="routes"       element={<LogisticsRoutes />} />
          <Route path="proof"        element={<PickupProof />} />
          <Route path="contractors"  element={<ContractorMarketplace />} />
        </Route>

        {/* Admin portal — WOMS + network */}
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<AdminDashboard />} />
          <Route path="woms"                element={<WomsDashboard />} />
          <Route path="weighbridge"         element={<Weighbridge />} />
          <Route path="custody"             element={<ChainOfCustody />} />
          <Route path="warehouse"           element={<WarehouseInventory />} />
          <Route path="recycler-settlement" element={<RecyclerSettlement />} />
          <Route path="treasury"            element={<TreasuryDashboard />} />
          <Route path="ledger"              element={<Ledger />} />
          <Route path="payout-approvals"   element={<PayoutApprovals />} />
          <Route path="reconciliation"      element={<ReconciliationEngine />} />
          <Route path="settlement"          element={<SettlementBatching />} />
          <Route path="trader"              element={<TraderDashboard />} />
          <Route path="market-ingestion"    element={<MarketIngestion />} />
          <Route path="scrap-pricing"       element={<ScrapPricing />} />
          <Route path="competitor-intel"    element={<CompetitorIntelligence />} />
          <Route path="sentiment"           element={<SentimentEngine />} />
          <Route path="composition"         element={<MaterialComposition />} />
          <Route path="pricing-engine"      element={<DynamicPricing />} />
          <Route path="stations"            element={<AdminStations />} />
          <Route path="pricing"             element={<CommodityPricing />} />
          <Route path="partners"            element={<AdminPartners />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
