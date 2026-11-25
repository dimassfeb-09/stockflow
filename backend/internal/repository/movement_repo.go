package repository

import (
	"context"
	"fmt"

	"stockflow/internal/entity"
)

type MovementRepo struct {
	db DBTX
}

func NewMovementRepo(db DBTX) *MovementRepo {
	return &MovementRepo{db: db}
}

func (r *MovementRepo) Create(ctx context.Context, m entity.StockMovement) (entity.StockMovement, error) {
	row := r.db.QueryRow(ctx, `
		INSERT INTO stock_movements (product_id, type, qty, note)
		VALUES ($1,$2,$3,$4)
		RETURNING id, product_id, type, qty, note, created_at
	`, m.ProductID, m.Type, m.Qty, m.Note)
	var out entity.StockMovement
	err := row.Scan(&out.ID, &out.ProductID, &out.Type, &out.Qty, &out.Note, &out.CreatedAt)
	if err != nil {
		return entity.StockMovement{}, fmt.Errorf("movementRepo.Create: %w", err)
	}
	return out, nil
}

func (r *MovementRepo) ListByProduct(ctx context.Context, productID int) ([]entity.StockMovement, error) {
	rows, err := r.db.Query(ctx, `
		SELECT id, product_id, type, qty, note, created_at
		FROM stock_movements
		WHERE product_id = $1
		ORDER BY created_at DESC, id DESC
	`, productID)
	if err != nil {
		return nil, fmt.Errorf("movementRepo.ListByProduct: %w", err)
	}
	defer rows.Close()
	var out []entity.StockMovement
	for rows.Next() {
		var m entity.StockMovement
		if err := rows.Scan(&m.ID, &m.ProductID, &m.Type, &m.Qty, &m.Note, &m.CreatedAt); err != nil {
			return nil, fmt.Errorf("movementRepo.ListByProduct scan: %w", err)
		}
		out = append(out, m)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("movementRepo.ListByProduct rows: %w", err)
	}
	return out, nil
}
