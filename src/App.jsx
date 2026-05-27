import React from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'

import MarketingLayout    from './layouts/MarketingLayout'
import ConsumerLayout     from './layouts/ConsumerLayout'
import OperatorLayout     from './layouts/OperatorLayout'
import LogisticsLayout    from './layouts/LogisticsLayout'
import AdminLayout        from './layouts/AdminLayout'

import Landing            from './pages/Landing'

import ConsumerDashboard  from './pages/consumer/Dashboard'
import FindBin            from './pages/consumer/FindBin'
import BookPickup         from './pages/consumer/BookPickup'
import EcoRewards         from './pages/consumer/EcoRewards'
import HouseholdCircle    from './pages/consumer/HouseholdCircle'

import OperatorDashboard  from './pages/operator/Dashboard'
import OperatorStations   from './pages/operator/Stations'
import OperatorLogistics  from './pages/operator/Logistics'
import OperatorPricing    from './pages/operator/Pricing'
import OperatorEarnings   from './pages/operator/Earnings'

import LogisticsDashboard from './pages/logistics/Dashboard'
import LogisticsRoutes    from './pages/logistics/Routes'
import LogisticsJobs      from './pages/logistics/Jobs'

import AdminDashboard     from './pages/admin/Dashboard'
import CommodityPricing   from './pages/admin/CommodityPricing'
import AdminPartners      from './pages/admin/Partners'
import AdminSettlement    from './pages/admin/Settlement'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<MarketingLayout />}>
          <Route path="/" element={<Landing />} />
        </Route>

        <Route path="/consumer" element={<ConsumerLayout />}>
          <Route index element={<ConsumerDashboard />} />
          <Route path="find"    element={<FindBin />} />
          <Route path="book"    element={<BookPickup />} />
          <Route path="rewards" element={<EcoRewards />} />
          <Route path="circle"  element={<HouseholdCircle />} />
        </Route>

        <Route path="/operator" element={<OperatorLayout />}>
          <Route index element={<OperatorDashboard />} />
          <Route path="stations"  element={<OperatorStations />} />
          <Route path="logistics" element={<OperatorLogistics />} />
          <Route path="pricing"   element={<OperatorPricing />} />
          <Route path="earnings"  element={<OperatorEarnings />} />
        </Route>

        <Route path="/logistics" element={<LogisticsLayout />}>
          <Route index element={<LogisticsDashboard />} />
          <Route path="routes" element={<LogisticsRoutes />} />
          <Route path="jobs"   element={<LogisticsJobs />} />
        </Route>

        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<AdminDashboard />} />
          <Route path="pricing"    element={<CommodityPricing />} />
          <Route path="partners"   element={<AdminPartners />} />
          <Route path="settlement" element={<AdminSettlement />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
