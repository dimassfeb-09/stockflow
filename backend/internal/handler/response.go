package handler

import (
	"encoding/json"
	"errors"
	"log"
	"net/http"

	"stockflow/internal/dto"
	"stockflow/internal/entity"
)

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func writeError(w http.ResponseWriter, err error) {
	var ve entity.ValidationError
	if errors.As(err, &ve) {
		writeJSON(w, http.StatusBadRequest, dto.ErrorEnvelope{
			Error: dto.ErrorDetail{
				Code:    "VALIDATION_ERROR",
				Message: "invalid input",
				Fields:  ve.Fields,
			},
		})
		return
	}
	var ise entity.InsufficientStockError
	if errors.As(err, &ise) {
		writeJSON(w, http.StatusConflict, dto.ErrorEnvelope{
			Error: dto.ErrorDetail{
				Code:      "INSUFFICIENT_STOCK",
				Message:   ise.Error(),
				SKU:       ise.SKU,
				Available: ise.Available,
			},
		})
		return
	}
	switch {
	case errors.Is(err, entity.ErrNotFound):
		writeJSON(w, http.StatusNotFound, dto.ErrorEnvelope{Error: dto.ErrorDetail{Code: "NOT_FOUND", Message: err.Error()}})
	case errors.Is(err, entity.ErrDuplicateSKU):
		writeJSON(w, http.StatusConflict, dto.ErrorEnvelope{Error: dto.ErrorDetail{Code: "SKU_EXISTS", Message: err.Error()}})
	case errors.Is(err, entity.ErrProductHasHistory):
		writeJSON(w, http.StatusConflict, dto.ErrorEnvelope{Error: dto.ErrorDetail{Code: "PRODUCT_HAS_HISTORY", Message: err.Error()}})
	case errors.Is(err, entity.ErrAlreadyCancelled):
		writeJSON(w, http.StatusConflict, dto.ErrorEnvelope{Error: dto.ErrorDetail{Code: "ORDER_ALREADY_CANCELLED", Message: err.Error()}})
	default:
		log.Printf("internal error: %v", err)
		writeJSON(w, http.StatusInternalServerError, dto.ErrorEnvelope{Error: dto.ErrorDetail{Code: "INTERNAL_ERROR", Message: "something went wrong"}})
	}
}
