package dto

import (
	"time"

	"stockflow/internal/entity"
)

type CreateProductRequest struct {
	SKU   string `json:"sku"`
	Name  string `json:"name"`
	Price int    `json:"price"`
}

type UpdateProductRequest struct {
	Name     string `json:"name"`
	Price    int    `json:"price"`
	IsActive *bool  `json:"is_active"`
}

type AdjustStockRequest struct {
	Type MovementType `json:"type"`
	Qty  int          `json:"qty"`
	Note string       `json:"note"`
}

type MovementType string

const (
	MovementIn  MovementType = "in"
	MovementOut MovementType = "out"
)

type ProductResponse struct {
	ID             int        `json:"id"`
	SKU            string     `json:"sku"`
	Name           string     `json:"name"`
	Price          int        `json:"price"`
	Stock          int        `json:"stock"`
	IsActive       bool       `json:"is_active"`
	CreatedAt      time.Time  `json:"created_at"`
	LastMovementAt *time.Time `json:"last_movement_at"`
}

type MovementResponse struct {
	ID        int       `json:"id"`
	ProductID int       `json:"product_id"`
	Type      string    `json:"type"`
	Qty       int       `json:"qty"`
	Note      string    `json:"note"`
	CreatedAt time.Time `json:"created_at"`
}

type ListProductsResponse struct {
	Data  []ProductResponse `json:"data"`
	Page  int               `json:"page"`
	Limit int               `json:"limit"`
	Total int               `json:"total"`
}

type MovementsResponse struct {
	Data []MovementResponse `json:"data"`
}

func ToProductResponse(p entity.Product) ProductResponse {
	return ProductResponse{
		ID:             p.ID,
		SKU:            p.SKU,
		Name:           p.Name,
		Price:          p.Price,
		Stock:          p.Stock,
		IsActive:       p.IsActive,
		CreatedAt:      p.CreatedAt,
		LastMovementAt: p.LastMovementAt,
	}
}

func ToMovementResponse(m entity.StockMovement) MovementResponse {
	return MovementResponse{
		ID:        m.ID,
		ProductID: m.ProductID,
		Type:      string(m.Type),
		Qty:       m.Qty,
		Note:      m.Note,
		CreatedAt: m.CreatedAt,
	}
}
