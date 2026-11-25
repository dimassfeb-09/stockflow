package handler

import (
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"stockflow/internal/dto"
	"stockflow/internal/entity"
	"stockflow/internal/usecase"
)

type OrderHandler struct {
	svc *usecase.OrderService
}

func NewOrderHandler(svc *usecase.OrderService) *OrderHandler {
	return &OrderHandler{svc: svc}
}

func (h *OrderHandler) Create(w http.ResponseWriter, r *http.Request) {
	var req dto.CreateOrderRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, entity.ValidationError{Fields: map[string]string{"body": "invalid json"}})
		return
	}
	inputs := make([]usecase.OrderItemInput, 0, len(req.Items))
	for _, it := range req.Items {
		inputs = append(inputs, usecase.OrderItemInput{SKU: it.SKU, Qty: it.Qty})
	}
	order, err := h.svc.Create(r.Context(), req.Customer, inputs, r.Header.Get("Idempotency-Key"))
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, dto.ToOrderResponse(order))
}

func (h *OrderHandler) Get(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		writeError(w, entity.ErrNotFound)
		return
	}
	order, err := h.svc.GetByID(r.Context(), id)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, dto.ToOrderResponse(order))
}

func (h *OrderHandler) Cancel(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		writeError(w, entity.ErrNotFound)
		return
	}
	order, err := h.svc.Cancel(r.Context(), id)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, dto.ToOrderResponse(order))
}

func (h *OrderHandler) DailySales(w http.ResponseWriter, r *http.Request) {
	date := r.URL.Query().Get("date")
	if date == "" {
		date = time.Now().UTC().Format("2006-01-02")
	}
	if _, err := time.Parse("2006-01-02", date); err != nil {
		writeError(w, entity.ValidationError{Fields: map[string]string{"date": "invalid date, expected YYYY-MM-DD"}})
		return
	}
	count, total, err := h.svc.DailySales(r.Context(), date)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, dto.DailySalesResponse{
		Date:       date,
		OrderCount: count,
		TotalSales: total,
	})
}
