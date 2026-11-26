package usecase

import (
	"context"
	"errors"
	"fmt"

	"stockflow/internal/entity"
)

type OrderItemInput struct {
	SKU string
	Qty int
}

type OrderService struct {
	products  entity.ProductRepository
	movements entity.MovementRepository
	orders    entity.OrderRepository
	tx        entity.TransactionManager
}

func NewOrderService(products entity.ProductRepository, movements entity.MovementRepository, orders entity.OrderRepository, tx entity.TransactionManager) *OrderService {
	return &OrderService{products: products, movements: movements, orders: orders, tx: tx}
}

func (s *OrderService) Create(ctx context.Context, customer string, inputs []OrderItemInput, idempotencyKey string) (entity.SalesOrder, error) {
	fields := map[string]string{}
	if customer == "" {
		fields["customer"] = "customer is required"
	}
	if len(inputs) == 0 {
		fields["items"] = "items are required"
	}
	seen := map[string]bool{}
	for i, it := range inputs {
		if it.SKU == "" {
			fields[fmt.Sprintf("items.%d.sku", i)] = "sku is required"
		}
		if it.Qty <= 0 {
			fields[fmt.Sprintf("items.%d.qty", i)] = "qty must be > 0"
		}
		if it.SKU != "" && seen[it.SKU] {
			fields[fmt.Sprintf("items.%d.sku", i)] = "duplicate sku in order"
		}
		seen[it.SKU] = true
	}
	if len(fields) > 0 {
		return entity.SalesOrder{}, entity.ValidationError{Fields: fields}
	}

	if idempotencyKey != "" {
		existing, err := s.orders.GetByIdempotencyKey(ctx, idempotencyKey)
		if err == nil {
			return existing, nil
		}
		if !errors.Is(err, entity.ErrNotFound) {
			return entity.SalesOrder{}, err
		}
	}

	skus := make([]string, 0, len(inputs))
	for _, it := range inputs {
		skus = append(skus, it.SKU)
	}

	var created entity.SalesOrder
	err := s.tx.RunInTx(ctx, func(repos entity.Repositories) error {
		locked, err := repos.Products.LockBySKUs(ctx, skus)
		if err != nil {
			return err
		}
		bySKU := map[string]entity.Product{}
		for _, p := range locked {
			bySKU[p.SKU] = p
		}
		for _, in := range inputs {
			p, ok := bySKU[in.SKU]
			if !ok {
				return entity.ValidationError{Fields: map[string]string{"items": "unknown sku: " + in.SKU}}
			}
			if p.Stock < in.Qty {
				return entity.InsufficientStockError{SKU: in.SKU, Available: p.Stock}
			}
		}

		items := make([]entity.SalesOrderItem, 0, len(inputs))
		total := 0
		for _, in := range inputs {
			p := bySKU[in.SKU]
			if err := repos.Products.DecrementStock(ctx, p.ID, in.Qty); err != nil {
				return entity.InsufficientStockError{SKU: in.SKU, Available: p.Stock}
			}
			_, err := repos.Movements.Create(ctx, entity.StockMovement{
				ProductID: p.ID,
				Type:      entity.MovementOut,
				Qty:       in.Qty,
				Note:      "sales order",
			})
			if err != nil {
				return err
			}
			items = append(items, entity.SalesOrderItem{
				SKU:       in.SKU,
				Qty:       in.Qty,
				UnitPrice: p.Price,
			})
			total += p.Price * in.Qty
		}

		order := entity.SalesOrder{
			Customer: customer,
			Status:   entity.OrderStatusCreated,
			Total:    total,
		}
		out, err := repos.Orders.Create(ctx, order, items)
		if err != nil {
			return err
		}
		created = out
		if idempotencyKey != "" {
			if err := repos.Orders.SaveIdempotencyKey(ctx, idempotencyKey, out.ID); err != nil {
				return err
			}
		}
		return nil
	})
	if err != nil {
		return entity.SalesOrder{}, err
	}
	return created, nil
}

func (s *OrderService) GetByID(ctx context.Context, id int) (entity.SalesOrder, error) {
	return s.orders.GetByID(ctx, id)
}

func (s *OrderService) Cancel(ctx context.Context, id int) (entity.SalesOrder, error) {
	var cancelled entity.SalesOrder
	err := s.tx.RunInTx(ctx, func(repos entity.Repositories) error {
		order, err := repos.Orders.GetByID(ctx, id)
		if err != nil {
			return err
		}
		if order.Status == entity.OrderStatusCancelled {
			return entity.ErrAlreadyCancelled
		}

		skus := make([]string, 0, len(order.Items))
		seen := map[string]bool{}
		for _, it := range order.Items {
			if !seen[it.SKU] {
				skus = append(skus, it.SKU)
				seen[it.SKU] = true
			}
		}
		locked, err := repos.Products.LockBySKUs(ctx, skus)
		if err != nil {
			return err
		}
		bySKU := map[string]entity.Product{}
		for _, p := range locked {
			bySKU[p.SKU] = p
		}

		for _, it := range order.Items {
			p := bySKU[it.SKU]
			if err := repos.Products.IncrementStock(ctx, p.ID, it.Qty); err != nil {
				return err
			}
			_, err := repos.Movements.Create(ctx, entity.StockMovement{
				ProductID: p.ID,
				Type:      entity.MovementIn,
				Qty:       it.Qty,
				Note:      "order cancelled",
			})
			if err != nil {
				return err
			}
		}

		out, err := repos.Orders.MarkCancelled(ctx, id)
		if err != nil {
			return err
		}
		cancelled = out
		return nil
	})
	if err != nil {
		return entity.SalesOrder{}, err
	}
	return cancelled, nil
}

func (s *OrderService) DailySales(ctx context.Context, date string) (int, int, error) {
	return s.orders.DailySales(ctx, date)
}
