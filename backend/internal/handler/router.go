package handler

import "net/http"

func NewRouter(productH *ProductHandler, orderH *OrderHandler) http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/products", productH.List)
	mux.HandleFunc("POST /api/products", productH.Create)
	mux.HandleFunc("PUT /api/products/{id}", productH.Update)
	mux.HandleFunc("DELETE /api/products/{id}", productH.Delete)
	mux.HandleFunc("POST /api/products/{id}/stock", productH.AdjustStock)
	mux.HandleFunc("GET /api/products/{id}/movements", productH.Movements)

	mux.HandleFunc("POST /api/orders", orderH.Create)
	mux.HandleFunc("GET /api/orders/{id}", orderH.Get)
	mux.HandleFunc("POST /api/orders/{id}/cancel", orderH.Cancel)
	mux.HandleFunc("GET /api/reports/daily-sales", orderH.DailySales)

	return withMiddleware(mux)
}
