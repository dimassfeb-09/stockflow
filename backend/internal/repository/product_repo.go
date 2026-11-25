package repository

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"

	"stockflow/internal/entity"
)

type ProductRepo struct {
	db DBTX
}

func NewProductRepo(db DBTX) *ProductRepo {
	return &ProductRepo{db: db}
}

func (r *ProductRepo) Create(ctx context.Context, p entity.Product) (entity.Product, error) {
	row := r.db.QueryRow(ctx, `
		INSERT INTO products (sku, name, price, stock, is_active)
		VALUES ($1,$2,$3,$4,$5)
		RETURNING id, sku, name, price, stock, is_active, created_at
	`, p.SKU, p.Name, p.Price, p.Stock, p.IsActive)
	var out entity.Product
	err := row.Scan(&out.ID, &out.SKU, &out.Name, &out.Price, &out.Stock, &out.IsActive, &out.CreatedAt)
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			return entity.Product{}, entity.ErrDuplicateSKU
		}
		return entity.Product{}, fmt.Errorf("productRepo.Create: %w", err)
	}
	return out, nil
}

func (r *ProductRepo) GetByID(ctx context.Context, id int) (entity.Product, error) {
	row := r.db.QueryRow(ctx, `
		SELECT id, sku, name, price, stock, is_active, created_at,
		       (SELECT MAX(sm.created_at) FROM stock_movements sm WHERE sm.product_id = products.id)
		FROM products WHERE id = $1
	`, id)
	p, err := scanProduct(row)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return entity.Product{}, entity.ErrNotFound
		}
		return entity.Product{}, fmt.Errorf("productRepo.GetByID: %w", err)
	}
	return p, nil
}

func (r *ProductRepo) GetByIDForUpdate(ctx context.Context, id int) (entity.Product, error) {
	row := r.db.QueryRow(ctx, `
		SELECT id, sku, name, price, stock, is_active, created_at,
		       (SELECT MAX(sm.created_at) FROM stock_movements sm WHERE sm.product_id = products.id)
		FROM products WHERE id = $1 FOR UPDATE
	`, id)
	p, err := scanProduct(row)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return entity.Product{}, entity.ErrNotFound
		}
		return entity.Product{}, fmt.Errorf("productRepo.GetByIDForUpdate: %w", err)
	}
	return p, nil
}

func (r *ProductRepo) GetBySKU(ctx context.Context, sku string) (entity.Product, error) {
	row := r.db.QueryRow(ctx, `
		SELECT id, sku, name, price, stock, is_active, created_at,
		       (SELECT MAX(sm.created_at) FROM stock_movements sm WHERE sm.product_id = products.id)
		FROM products WHERE sku = $1
	`, sku)
	p, err := scanProduct(row)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return entity.Product{}, entity.ErrNotFound
		}
		return entity.Product{}, fmt.Errorf("productRepo.GetBySKU: %w", err)
	}
	return p, nil
}

func (r *ProductRepo) List(ctx context.Context, search string, status string, lowStock bool, page, limit int) ([]entity.Product, int, error) {
	if page < 1 {
		page = 1
	}
	if limit < 1 {
		limit = 20
	}
	offset := (page - 1) * limit

	where := "WHERE ($1 = '' OR sku ILIKE '%' || $1 || '%' OR name ILIKE '%' || $1 || '%')"
	if status == "active" {
		where += " AND is_active = TRUE"
	} else if status == "inactive" {
		where += " AND is_active = FALSE"
	}
	if lowStock {
		where += " AND stock <= 10"
	}

	var total int
	err := r.db.QueryRow(ctx, "SELECT COUNT(*) FROM products "+where, search).Scan(&total)
	if err != nil {
		return nil, 0, fmt.Errorf("productRepo.List count: %w", err)
	}

	rows, err := r.db.Query(ctx, `
		SELECT id, sku, name, price, stock, is_active, created_at,
		       (SELECT MAX(sm.created_at) FROM stock_movements sm WHERE sm.product_id = products.id)
		FROM products `+where+`
		ORDER BY id
		LIMIT $2 OFFSET $3
	`, search, limit, offset)
	if err != nil {
		return nil, 0, fmt.Errorf("productRepo.List query: %w", err)
	}
	defer rows.Close()

	var out []entity.Product
	for rows.Next() {
		p, err := scanProduct(rows)
		if err != nil {
			return nil, 0, fmt.Errorf("productRepo.List scan: %w", err)
		}
		out = append(out, p)
	}
	if err := rows.Err(); err != nil {
		return nil, 0, fmt.Errorf("productRepo.List rows: %w", err)
	}
	return out, total, nil
}

func (r *ProductRepo) Update(ctx context.Context, p entity.Product) (entity.Product, error) {
	row := r.db.QueryRow(ctx, `
		UPDATE products SET name=$2, price=$3, is_active=$4 WHERE id=$1
		RETURNING id, sku, name, price, stock, is_active, created_at
	`, p.ID, p.Name, p.Price, p.IsActive)
	var out entity.Product
	err := row.Scan(&out.ID, &out.SKU, &out.Name, &out.Price, &out.Stock, &out.IsActive, &out.CreatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return entity.Product{}, entity.ErrNotFound
		}
		return entity.Product{}, fmt.Errorf("productRepo.Update: %w", err)
	}
	full, err := r.GetByID(ctx, out.ID)
	if err != nil {
		return out, nil
	}
	return full, nil
}

func (r *ProductRepo) Delete(ctx context.Context, id int) error {
	tag, err := r.db.Exec(ctx, `DELETE FROM products WHERE id=$1`, id)
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23503" {
			return entity.ErrProductHasHistory
		}
		return fmt.Errorf("productRepo.Delete: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return entity.ErrNotFound
	}
	return nil
}

func (r *ProductRepo) HasHistory(ctx context.Context, id int) (bool, error) {
	var exists bool
	err := r.db.QueryRow(ctx, `SELECT EXISTS (SELECT 1 FROM stock_movements WHERE product_id=$1)`, id).Scan(&exists)
	if err != nil {
		return false, fmt.Errorf("productRepo.HasHistory: %w", err)
	}
	return exists, nil
}

func (r *ProductRepo) LockBySKUs(ctx context.Context, skus []string) ([]entity.Product, error) {
	if len(skus) == 0 {
		return nil, nil
	}
	rows, err := r.db.Query(ctx, `
		SELECT id, sku, name, price, stock, is_active, created_at,
		       (SELECT MAX(sm.created_at) FROM stock_movements sm WHERE sm.product_id = products.id)
		FROM products WHERE sku = ANY($1)
		ORDER BY sku
		FOR UPDATE
	`, skus)
	if err != nil {
		return nil, fmt.Errorf("productRepo.LockBySKUs: %w", err)
	}
	defer rows.Close()
	var out []entity.Product
	for rows.Next() {
		p, err := scanProduct(rows)
		if err != nil {
			return nil, fmt.Errorf("productRepo.LockBySKUs scan: %w", err)
		}
		out = append(out, p)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("productRepo.LockBySKUs rows: %w", err)
	}
	return out, nil
}

func (r *ProductRepo) DecrementStock(ctx context.Context, id, qty int) error {
	tag, err := r.db.Exec(ctx, `
		UPDATE products SET stock = stock - $2 WHERE id = $1 AND stock >= $2
	`, id, qty)
	if err != nil {
		return fmt.Errorf("productRepo.DecrementStock: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return entity.InsufficientStockError{SKU: "", Available: 0}
	}
	return nil
}

func (r *ProductRepo) IncrementStock(ctx context.Context, id, qty int) error {
	_, err := r.db.Exec(ctx, `UPDATE products SET stock = stock + $2 WHERE id = $1`, id, qty)
	if err != nil {
		return fmt.Errorf("productRepo.IncrementStock: %w", err)
	}
	return nil
}

func scanProduct(row pgx.Row) (entity.Product, error) {
	var p entity.Product
	var last *time.Time
	err := row.Scan(&p.ID, &p.SKU, &p.Name, &p.Price, &p.Stock, &p.IsActive, &p.CreatedAt, &last)
	if err != nil {
		return entity.Product{}, err
	}
	p.LastMovementAt = last
	return p, nil
}
