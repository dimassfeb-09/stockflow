package repository

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"

	"stockflow/internal/entity"
)

type OrderRepo struct {
	db DBTX
}

func NewOrderRepo(db DBTX) *OrderRepo {
	return &OrderRepo{db: db}
}

func (r *OrderRepo) Create(ctx context.Context, order entity.SalesOrder, items []entity.SalesOrderItem) (entity.SalesOrder, error) {
	row := r.db.QueryRow(ctx, `
		INSERT INTO sales_orders (customer, status, total)
		VALUES ($1,$2,$3)
		RETURNING id, customer, status, total, created_at, cancelled_at
	`, order.Customer, order.Status, order.Total)
	var out entity.SalesOrder
	if err := row.Scan(&out.ID, &out.Customer, &out.Status, &out.Total, &out.CreatedAt, &out.CancelledAt); err != nil {
		return entity.SalesOrder{}, fmt.Errorf("orderRepo.Create order: %w", err)
	}
	out.Items = make([]entity.SalesOrderItem, 0, len(items))
	for _, it := range items {
		irow := r.db.QueryRow(ctx, `
			INSERT INTO sales_order_items (order_id, sku, qty, unit_price)
			VALUES ($1,$2,$3,$4)
			RETURNING id, order_id, sku, qty, unit_price
		`, out.ID, it.SKU, it.Qty, it.UnitPrice)
		var item entity.SalesOrderItem
		if err := irow.Scan(&item.ID, &item.OrderID, &item.SKU, &item.Qty, &item.UnitPrice); err != nil {
			return entity.SalesOrder{}, fmt.Errorf("orderRepo.Create item: %w", err)
		}
		out.Items = append(out.Items, item)
	}
	return out, nil
}

func (r *OrderRepo) GetByID(ctx context.Context, id int) (entity.SalesOrder, error) {
	row := r.db.QueryRow(ctx, `
		SELECT id, customer, status, total, created_at, cancelled_at
		FROM sales_orders WHERE id = $1
	`, id)
	var o entity.SalesOrder
	if err := row.Scan(&o.ID, &o.Customer, &o.Status, &o.Total, &o.CreatedAt, &o.CancelledAt); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return entity.SalesOrder{}, entity.ErrNotFound
		}
		return entity.SalesOrder{}, fmt.Errorf("orderRepo.GetByID: %w", err)
	}
	items, err := r.loadItems(ctx, o.ID)
	if err != nil {
		return entity.SalesOrder{}, err
	}
	o.Items = items
	return o, nil
}

func (r *OrderRepo) loadItems(ctx context.Context, orderID int) ([]entity.SalesOrderItem, error) {
	rows, err := r.db.Query(ctx, `
		SELECT id, order_id, sku, qty, unit_price
		FROM sales_order_items WHERE order_id = $1 ORDER BY id
	`, orderID)
	if err != nil {
		return nil, fmt.Errorf("orderRepo.loadItems: %w", err)
	}
	defer rows.Close()
	var out []entity.SalesOrderItem
	for rows.Next() {
		var it entity.SalesOrderItem
		if err := rows.Scan(&it.ID, &it.OrderID, &it.SKU, &it.Qty, &it.UnitPrice); err != nil {
			return nil, fmt.Errorf("orderRepo.loadItems scan: %w", err)
		}
		out = append(out, it)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("orderRepo.loadItems rows: %w", err)
	}
	return out, nil
}

func (r *OrderRepo) MarkCancelled(ctx context.Context, id int) (entity.SalesOrder, error) {
	row := r.db.QueryRow(ctx, `
		UPDATE sales_orders
		SET status = 'CANCELLED', cancelled_at = now()
		WHERE id = $1 AND status = 'CREATED'
		RETURNING id, customer, status, total, created_at, cancelled_at
	`, id)
	var o entity.SalesOrder
	if err := row.Scan(&o.ID, &o.Customer, &o.Status, &o.Total, &o.CreatedAt, &o.CancelledAt); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			// distinguish not found vs already cancelled
			existing, gerr := r.GetByID(ctx, id)
			if gerr != nil {
				return entity.SalesOrder{}, gerr
			}
			if existing.Status == entity.OrderStatusCancelled {
				return entity.SalesOrder{}, entity.ErrAlreadyCancelled
			}
			return entity.SalesOrder{}, entity.ErrNotFound
		}
		return entity.SalesOrder{}, fmt.Errorf("orderRepo.MarkCancelled: %w", err)
	}
	items, err := r.loadItems(ctx, o.ID)
	if err != nil {
		return entity.SalesOrder{}, err
	}
	o.Items = items
	return o, nil
}

func (r *OrderRepo) GetByIdempotencyKey(ctx context.Context, key string) (entity.SalesOrder, error) {
	var orderID int
	err := r.db.QueryRow(ctx, `SELECT order_id FROM idempotency_keys WHERE key = $1`, key).Scan(&orderID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return entity.SalesOrder{}, entity.ErrNotFound
		}
		return entity.SalesOrder{}, fmt.Errorf("orderRepo.GetByIdempotencyKey: %w", err)
	}
	return r.GetByID(ctx, orderID)
}

func (r *OrderRepo) SaveIdempotencyKey(ctx context.Context, key string, orderID int) error {
	_, err := r.db.Exec(ctx, `INSERT INTO idempotency_keys (key, order_id) VALUES ($1,$2) ON CONFLICT (key) DO NOTHING`, key, orderID)
	if err != nil {
		return fmt.Errorf("orderRepo.SaveIdempotencyKey: %w", err)
	}
	return nil
}

func (r *OrderRepo) DailySales(ctx context.Context, date string) (int, int, error) {
	var count int
	var total int
	err := r.db.QueryRow(ctx, `
		SELECT COUNT(*), COALESCE(SUM(total), 0)
		FROM sales_orders
		WHERE created_at::date = $1::date AND status = 'CREATED'
	`, date).Scan(&count, &total)
	if err != nil {
		return 0, 0, fmt.Errorf("orderRepo.DailySales: %w", err)
	}
	return count, total, nil
}
