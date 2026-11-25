import { Routes, Route, Navigate } from 'react-router-dom'
import { ProductsPage } from './pages/ProductsPage'
import { OrderDetailPage } from './pages/OrderDetailPage'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<ProductsPage />} />
      <Route path="/orders/:id" element={<OrderDetailPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
