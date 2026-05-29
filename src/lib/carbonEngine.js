// Carbon footprint engine
// Converts material weights recycled into CO₂ savings using published emission factors.

export const CO2_FACTORS = {
  aluminium:     9.5,   // kg CO₂ saved per kg recycled
  pet_plastic:   2.5,
  hdpe:          1.8,
  glass:         0.3,
  steel:         2.3,
  paperboard:    1.1,
  mixed_plastic: 1.5,
}

// ── Equivalence constants ─────────────────────────────────────────────────────
const KG_CO2_PER_TREE_YEAR    = 22    // kg CO₂ absorbed per tree per year
const KG_CO2_PER_KM_DRIVING   = 0.21  // kg CO₂ per km (average petrol car)
const KG_CO2_PER_SYD_MEL_FLT  = 255  // kg CO₂ Sydney ↔ Melbourne flight (one way)

class CarbonEngine {
  /**
   * CO₂ saved from recycling one material.
   * @param {string} material — key from CO2_FACTORS
   * @param {number} weightKg
   * @returns {number} kg CO₂ saved
   */
  computeCO2Saved(material, weightKg) {
    const factor = CO2_FACTORS[material]
    if (factor == null || weightKg <= 0) return 0
    return Math.round(factor * weightKg * 1000) / 1000
  }

  /**
   * Total CO₂ saved across a material breakdown.
   * @param {{ [material]: number }} breakdown  — { aluminium: kg, pet_plastic: kg, ... }
   * @returns {number} total kg CO₂ saved
   */
  getTotalCO2Saved(breakdown) {
    let total = 0
    for (const [material, kg] of Object.entries(breakdown)) {
      total += this.computeCO2Saved(material, kg ?? 0)
    }
    return Math.round(total * 1000) / 1000
  }

  /**
   * Human-scale equivalents for a CO₂ saving.
   * @param {number} co2Kg
   * @returns {{ trees, kmNotDriven, flightsAvoided }}
   */
  getEquivalents(co2Kg) {
    return {
      trees:        Math.round((co2Kg / KG_CO2_PER_TREE_YEAR) * 10) / 10,
      kmNotDriven:  Math.round((co2Kg / KG_CO2_PER_KM_DRIVING) * 10) / 10,
      flightsAvoided: Math.round((co2Kg / KG_CO2_PER_SYD_MEL_FLT) * 100) / 100,
    }
  }

  /**
   * Synthetic 6-month summary of platform-wide CO₂ savings.
   * @returns {Array<{ month, breakdown, totalKgCO2, equivalents }>}
   */
  getMonthlySummary() {
    const months = ['Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May']
    const base = {
      aluminium:     4200, pet_plastic: 3100, hdpe:          2400,
      glass:         5800, steel:       3600, paperboard:    6200,
      mixed_plastic: 2800,
    }
    return months.map((month, i) => {
      const factor = 0.80 + i * 0.04 + (Math.random() * 0.05 - 0.025)
      const breakdown = {}
      for (const [mat, kg] of Object.entries(base)) {
        breakdown[mat] = Math.round(kg * factor)
      }
      const totalKgCO2 = this.getTotalCO2Saved(breakdown)
      return {
        month,
        breakdown,
        totalKgCO2,
        equivalents: this.getEquivalents(totalKgCO2),
      }
    })
  }

  /**
   * Top contributors (synthetic data).
   * @returns {Array<{ rank, id, name, type, totalKgCO2, breakdown }>}
   */
  getTopContributors() {
    return [
      { rank: 1, id: 'ST-006', name: 'Alexandria Depot',     type: 'station', totalKgCO2: 4820 },
      { rank: 2, id: 'ST-001', name: 'Surry Hills Hub',      type: 'station', totalKgCO2: 3910 },
      { rank: 3, id: 'USR-00143', name: 'Sarah M.',          type: 'user',    totalKgCO2: 312  },
      { rank: 4, id: 'ST-002', name: 'Redfern Node',         type: 'station', totalKgCO2: 2780 },
      { rank: 5, id: 'USR-00219', name: 'James T.',          type: 'user',    totalKgCO2: 287  },
      { rank: 6, id: 'ST-004', name: 'Marrickville Hub',     type: 'station', totalKgCO2: 2460 },
      { rank: 7, id: 'USR-00071', name: 'Priya K.',          type: 'user',    totalKgCO2: 241  },
      { rank: 8, id: 'ST-007', name: 'Chippendale Drop',     type: 'station', totalKgCO2: 1890 },
      { rank: 9, id: 'USR-00388', name: 'Marco L.',          type: 'user',    totalKgCO2: 198  },
      { rank: 10, id: 'ST-005', name: 'Glebe Point',         type: 'station', totalKgCO2: 1740 },
    ]
  }
}

export const carbonEngine = new CarbonEngine()
