package usecase

import (
	"context"
	"testing"

	"stockflow/internal/entity"
)

func TestProductService_CreateValidation(t *testing.T) {
	pr := newFakeProductRepo()
	mr := newFakeMovementRepo()
	tx := &fakeTxManager{repos: entity.Repositories{Products: pr, Movements: mr, Orders: newFakeOrderRepo()}}
	svc := NewProductService(pr, mr, tx)

	_, err := svc.Create(context.Background(), "", "Name", 100)
	if err == nil {
		t.Fatal("expected validation error")
	}
	ve, ok := err.(entity.ValidationError)
	if !ok || ve.Fields["sku"] == "" {
		t.Fatalf("expected sku validation, got %v", err)
	}
}

func TestProductService_AdjustStockInsufficient(t *testing.T) {
	pr := newFakeProductRepo()
	p := pr.seed(entity.Product{SKU: "SKU1", Name: "P1", Price: 10, Stock: 2, IsActive: true})
	mr := newFakeMovementRepo()
	tx := &fakeTxManager{repos: entity.Repositories{Products: pr, Movements: mr, Orders: newFakeOrderRepo()}}
	svc := NewProductService(pr, mr, tx)

	_, err := svc.AdjustStock(context.Background(), p.ID, entity.MovementOut, 5, "")
	if err == nil {
		t.Fatal("expected insufficient stock")
	}
	ise, ok := err.(entity.InsufficientStockError)
	if !ok || ise.Available != 2 {
		t.Fatalf("expected available 2, got %v", err)
	}
	// stock unchanged
	got, _ := pr.GetByID(context.Background(), p.ID)
	if got.Stock != 2 {
		t.Fatalf("stock changed: %d", got.Stock)
	}
}

func TestProductService_AdjustStockHappy(t *testing.T) {
	pr := newFakeProductRepo()
	p := pr.seed(entity.Product{SKU: "SKU1", Name: "P1", Price: 10, Stock: 2, IsActive: true})
	mr := newFakeMovementRepo()
	tx := &fakeTxManager{repos: entity.Repositories{Products: pr, Movements: mr, Orders: newFakeOrderRepo()}}
	svc := NewProductService(pr, mr, tx)

	out, err := svc.AdjustStock(context.Background(), p.ID, entity.MovementIn, 3, "restock")
	if err != nil {
		t.Fatal(err)
	}
	if out.Stock != 5 {
		t.Fatalf("stock = %d, want 5", out.Stock)
	}
	movs, _ := svc.Movements(context.Background(), p.ID)
	if len(movs) != 1 {
		t.Fatalf("movements = %d, want 1", len(movs))
	}
}
