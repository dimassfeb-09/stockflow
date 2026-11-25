package entity

import "context"

type Repositories struct {
	Products  ProductRepository
	Movements MovementRepository
	Orders    OrderRepository
}

type TransactionManager interface {
	RunInTx(ctx context.Context, fn func(Repositories) error) error
}

type ProductRepository interface {
	Create(ctx context.Context, p Product) (Product, error)
	GetByID(ctx context.Context, id int) (Product, error)
	GetByIDForUpdate(ctx context.Context, id int) (Product, error)
	GetBySKU(ctx context.Context, sku string) (Product, error)
	List(ctx context.Context, search string, status string, lowStock bool, page, limit int) ([]Product, int, error)
	Update(ctx context.Context, p Product) (Product, error)
	Delete(ctx context.Context, id int) error
	HasHistory(ctx context.Context, id int) (bool, error)
	LockBySKUs(ctx context.Context, skus []string) ([]Product, error)
	DecrementStock(ctx context.Context, id, qty int) error
	IncrementStock(ctx context.Context, id, qty int) error
}

type MovementRepository interface {
	Create(ctx context.Context, m StockMovement) (StockMovement, error)
	ListByProduct(ctx context.Context, productID int) ([]StockMovement, error)
}

type OrderRepository interface {
	Create(ctx context.Context, order SalesOrder, items []SalesOrderItem) (SalesOrder, error)
	GetByID(ctx context.Context, id int) (SalesOrder, error)
	MarkCancelled(ctx context.Context, id int) (SalesOrder, error)
	GetByIdempotencyKey(ctx context.Context, key string) (SalesOrder, error)
	SaveIdempotencyKey(ctx context.Context, key string, orderID int) error
	DailySales(ctx context.Context, date string) (int, int, error)
}
