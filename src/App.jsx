import React from 'react'
import Navbar from './components/Navbar'
import Footer from './components/Footer'
import Landing from './pages/Landing'

export default function App() {
  return (
    <div className="min-h-screen bg-white">
      <Navbar />
      <Landing />
      <Footer />
    </div>
  )
}
