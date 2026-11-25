package usecase

import (
	"context"
	"fmt"

	"stockflow/internal/entity"
)

type ProductService struct {
	products  entity.ProductRepository
	movements entity.MovementRepository
	tx        entity.TransactionManager
}

func NewProductService(products entity.ProductRepository, movements entity.MovementRepository, tx entity.TransactionManager) *ProductService {
	return &ProductService{products: products, movements: movements, tx: tx}
}

func (s *ProductService) Create(ctx context.Context, sku, name string, price int) (entity.Product, error) {
	p := entity.Product{SKU: sku, Name: name, Price: price, Stock: 0, IsActive: true}
	if err := p.ValidateCreate(); err != nil {
		return entity.Product{}, err
	}
	out, err := s.products.Create(ctx, p)
	if err != nil {
		return entity.Product{}, fmt.Errorf("create product: %w", err)
	}
	return out, nil
}

func (s *ProductService) Update(ctx context.Context, id int, name string, price int, isActive *bool) (entity.Product, error) {
	existing, err := s.products.GetByID(ctx, id)
	if err != nil {
		return entity.Product{}, err
	}
	existing.Name = name
	existing.Price = price
	if isActive != nil {
		existing.IsActive = *isActive
	}
	if err := existing.ValidateUpdate(); err != nil {
		return entity.Product{}, err
	}
	out, err := s.products.Update(ctx, existing)
	if err != nil {
		return entity.Product{}, fmt.Errorf("update product: %w", err)
	}
	return out, nil
}

func (s *ProductService) Delete(ctx context.Context, id int) error {
	has, err := s.products.HasHistory(ctx, id)
	if err != nil {
		return err
	}
	if has {
		return entity.ErrProductHasHistory
	}
	return s.products.Delete(ctx, id)
}

func (s *ProductService) List(ctx context.Context, search string, status string, lowStock bool, page, limit int) ([]entity.Product, int, error) {
	return s.products.List(ctx, search, status, lowStock, page, limit)
}

func (s *ProductService) GetByID(ctx context.Context, id int) (entity.Product, error) {
	return s.products.GetByID(ctx, id)
}

func (s *ProductService) AdjustStock(ctx context.Context, id int, typ entity.MovementType, qty int, note string) (entity.Product, error) {
	if qty <= 0 {
		return entity.Product{}, entity.ValidationError{Fields: map[string]string{"qty": "qty must be > 0"}}
	}
	if typ != entity.MovementIn && typ != entity.MovementOut {
		return entity.Product{}, entity.ValidationError{Fields: map[string]string{"type": "type must be in or out"}}
	}

	err := s.tx.RunInTx(ctx, func(repos entity.Repositories) error {
		p, err := repos.Products.GetByIDForUpdate(ctx, id)
		if err != nil {
			return err
		}
		if typ == entity.MovementOut && p.Stock < qty {
			return entity.InsufficientStockError{SKU: p.SKU, Available: p.Stock}
		}
		if typ == entity.MovementOut {
			if err := repos.Products.DecrementStock(ctx, id, qty); err != nil {
				return err
			}
		} else {
			if err := repos.Products.IncrementStock(ctx, id, qty); err != nil {
				return err
			}
		}
		_, err = repos.Movements.Create(ctx, entity.StockMovement{
			ProductID: id,
			Type:      typ,
			Qty:       qty,
			Note:      note,
		})
		return err
	})
	if err != nil {
		return entity.Product{}, err
	}
	return s.products.GetByID(ctx, id)
}

func (s *ProductService) Movements(ctx context.Context, id int) ([]entity.StockMovement, error) {
	if _, err := s.products.GetByID(ctx, id); err != nil {
		return nil, err
	}
	return s.movements.ListByProduct(ctx, id)
}
