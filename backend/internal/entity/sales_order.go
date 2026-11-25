package entity

import "time"

type OrderStatus string

const (
	OrderStatusCreated   OrderStatus = "CREATED"
	OrderStatusCancelled OrderStatus = "CANCELLED"
)

type SalesOrder struct {
	ID          int
	Customer    string
	Status      OrderStatus
	Total       int
	CreatedAt   time.Time
	CancelledAt *time.Time
	Items       []SalesOrderItem
}

type SalesOrderItem struct {
	ID        int
	OrderID   int
	SKU       string
	Qty       int
	UnitPrice int
}
