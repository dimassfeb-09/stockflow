package dto

import (
	"time"

	"stockflow/internal/entity"
)

type OrderItemRequest struct {
	SKU string `json:"sku"`
	Qty int    `json:"qty"`
}

type CreateOrderRequest struct {
	Customer string             `json:"customer"`
	Items    []OrderItemRequest `json:"items"`
}

type OrderItemResponse struct {
	ID        int    `json:"id"`
	OrderID   int    `json:"order_id"`
	SKU       string `json:"sku"`
	Qty       int    `json:"qty"`
	UnitPrice int    `json:"unit_price"`
}

type OrderResponse struct {
	ID          int                 `json:"id"`
	Customer    string              `json:"customer"`
	Status      string              `json:"status"`
	Total       int                 `json:"total"`
	CreatedAt   time.Time           `json:"created_at"`
	CancelledAt *time.Time          `json:"cancelled_at"`
	Items       []OrderItemResponse `json:"items"`
}

func ToOrderResponse(o entity.SalesOrder) OrderResponse {
	items := make([]OrderItemResponse, 0, len(o.Items))
	for _, it := range o.Items {
		items = append(items, OrderItemResponse{
			ID:        it.ID,
			OrderID:   it.OrderID,
			SKU:       it.SKU,
			Qty:       it.Qty,
			UnitPrice: it.UnitPrice,
		})
	}
	return OrderResponse{
		ID:          o.ID,
		Customer:    o.Customer,
		Status:      string(o.Status),
		Total:       o.Total,
		CreatedAt:   o.CreatedAt,
		CancelledAt: o.CancelledAt,
		Items:       items,
	}
}

type DailySalesResponse struct {
	Date       string `json:"date"`
	OrderCount int    `json:"order_count"`
	TotalSales int    `json:"total_sales"`
}
