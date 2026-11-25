package handler

import (
	"encoding/json"
	"net/http"
	"strconv"

	"stockflow/internal/dto"
	"stockflow/internal/entity"
	"stockflow/internal/usecase"
)

type ProductHandler struct {
	svc *usecase.ProductService
}

func NewProductHandler(svc *usecase.ProductService) *ProductHandler {
	return &ProductHandler{svc: svc}
}

func (h *ProductHandler) List(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	search := q.Get("search")
	status := q.Get("status")
	lowStock := q.Get("low_stock") == "true"

	page := atoi(q.Get("page"), 1)
	limit := atoi(q.Get("limit"), 20)

	products, total, err := h.svc.List(r.Context(), search, status, lowStock, page, limit)
	if err != nil {
		writeError(w, err)
		return
	}
	data := make([]dto.ProductResponse, 0, len(products))
	for _, p := range products {
		data = append(data, dto.ToProductResponse(p))
	}
	writeJSON(w, http.StatusOK, dto.ListProductsResponse{
		Data:  data,
		Page:  page,
		Limit: limit,
		Total: total,
	})
}

func (h *ProductHandler) Create(w http.ResponseWriter, r *http.Request) {
	var req dto.CreateProductRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, entity.ValidationError{Fields: map[string]string{"body": "invalid json"}})
		return
	}
	p, err := h.svc.Create(r.Context(), req.SKU, req.Name, req.Price)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, dto.ToProductResponse(p))
}

func (h *ProductHandler) Update(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		writeError(w, entity.ErrNotFound)
		return
	}
	var req dto.UpdateProductRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, entity.ValidationError{Fields: map[string]string{"body": "invalid json"}})
		return
	}
	p, err := h.svc.Update(r.Context(), id, req.Name, req.Price, req.IsActive)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, dto.ToProductResponse(p))
}

func (h *ProductHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		writeError(w, entity.ErrNotFound)
		return
	}
	if err := h.svc.Delete(r.Context(), id); err != nil {
		writeError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *ProductHandler) AdjustStock(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		writeError(w, entity.ErrNotFound)
		return
	}
	var req dto.AdjustStockRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, entity.ValidationError{Fields: map[string]string{"body": "invalid json"}})
		return
	}
	p, err := h.svc.AdjustStock(r.Context(), id, entity.MovementType(req.Type), req.Qty, req.Note)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, dto.ToProductResponse(p))
}

func (h *ProductHandler) Movements(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		writeError(w, entity.ErrNotFound)
		return
	}
	movs, err := h.svc.Movements(r.Context(), id)
	if err != nil {
		writeError(w, err)
		return
	}
	data := make([]dto.MovementResponse, 0, len(movs))
	for _, m := range movs {
		data = append(data, dto.ToMovementResponse(m))
	}
	writeJSON(w, http.StatusOK, dto.MovementsResponse{Data: data})
}

func atoi(s string, fallback int) int {
	if s == "" {
		return fallback
	}
	n, err := strconv.Atoi(s)
	if err != nil {
		return fallback
	}
	return n
}
