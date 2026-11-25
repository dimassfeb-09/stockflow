package usecase

import (
	"context"
	"testing"

	"stockflow/internal/entity"
)

func TestOrderService_Validation(t *testing.T) {
	pr := newFakeProductRepo()
	pr.seed(entity.Product{SKU: "SKU1", Name: "P1", Price: 10, Stock: 5, IsActive: true})
	mr := newFakeMovementRepo()
	or := newFakeOrderRepo()
	tx := &fakeTxManager{repos: entity.Repositories{Products: pr, Movements: mr, Orders: or}}
	svc := NewOrderService(pr, mr, or, tx)

	// empty items
	_, err := svc.Create(context.Background(), "Cust", nil, "")
	if err == nil {
		t.Fatal("expected validation error")
	}
	// duplicate sku
	_, err = svc.Create(context.Background(), "Cust", []OrderItemInput{{SKU: "SKU1", Qty: 1}, {SKU: "SKU1", Qty: 1}}, "")
	if err == nil {
		t.Fatal("expected duplicate sku error")
	}
	// qty <=0
	_, err = svc.Create(context.Background(), "Cust", []OrderItemInput{{SKU: "SKU1", Qty: 0}}, "")
	if err == nil {
		t.Fatal("expected qty validation")
	}
}

func TestOrderService_UnknownSKU(t *testing.T) {
	pr := newFakeProductRepo()
	pr.seed(entity.Product{SKU: "SKU1", Name: "P1", Price: 10, Stock: 5, IsActive: true})
	mr := newFakeMovementRepo()
	or := newFakeOrderRepo()
	tx := &fakeTxManager{repos: entity.Repositories{Products: pr, Movements: mr, Orders: or}}
	svc := NewOrderService(pr, mr, or, tx)

	_, err := svc.Create(context.Background(), "Cust", []OrderItemInput{{SKU: "NOPE", Qty: 1}}, "")
	if err == nil {
		t.Fatal("expected unknown sku error")
	}
	ve, ok := err.(entity.ValidationError)
	if !ok || ve.Fields["items"] == "" {
		t.Fatalf("expected validation error, got %v", err)
	}
}

func TestOrderService_InsufficientStock(t *testing.T) {
	pr := newFakeProductRepo()
	pr.seed(entity.Product{SKU: "SKU1", Name: "P1", Price: 10, Stock: 2, IsActive: true})
	mr := newFakeMovementRepo()
	or := newFakeOrderRepo()
	tx := &fakeTxManager{repos: entity.Repositories{Products: pr, Movements: mr, Orders: or}}
	svc := NewOrderService(pr, mr, or, tx)

	_, err := svc.Create(context.Background(), "Cust", []OrderItemInput{{SKU: "SKU1", Qty: 5}}, "")
	if err == nil {
		t.Fatal("expected insufficient stock")
	}
	ise, ok := err.(entity.InsufficientStockError)
	if !ok || ise.SKU != "SKU1" || ise.Available != 2 {
		t.Fatalf("got %v", err)
	}
	// no order created
	orders := or.orders
	if len(orders) != 0 {
		t.Fatalf("order created despite insufficient stock")
	}
	// stock unchanged
	got, _ := pr.GetBySKU(context.Background(), "SKU1")
	if got.Stock != 2 {
		t.Fatalf("stock changed: %d", got.Stock)
	}
}

func TestOrderService_HappyPath(t *testing.T) {
	pr := newFakeProductRepo()
	pr.seed(entity.Product{SKU: "SKU1", Name: "P1", Price: 10, Stock: 5, IsActive: true})
	pr.seed(entity.Product{SKU: "SKU2", Name: "P2", Price: 20, Stock: 5, IsActive: true})
	mr := newFakeMovementRepo()
	or := newFakeOrderRepo()
	tx := &fakeTxManager{repos: entity.Repositories{Products: pr, Movements: mr, Orders: or}}
	svc := NewOrderService(pr, mr, or, tx)

	order, err := svc.Create(context.Background(), "Cust", []OrderItemInput{{SKU: "SKU1", Qty: 2}, {SKU: "SKU2", Qty: 1}}, "")
	if err != nil {
		t.Fatal(err)
	}
	if order.Total != 10*2+20*1 {
		t.Fatalf("total = %d", order.Total)
	}
	if len(order.Items) != 2 {
		t.Fatalf("items = %d", len(order.Items))
	}
	p1, _ := pr.GetBySKU(context.Background(), "SKU1")
	if p1.Stock != 3 {
		t.Fatalf("stock1 = %d", p1.Stock)
	}
	if len(mr.movements) != 2 {
		t.Fatalf("movements = %d", len(mr.movements))
	}
}

func TestOrderService_CancelRestoresStock(t *testing.T) {
	pr := newFakeProductRepo()
	pr.seed(entity.Product{SKU: "SKU1", Name: "P1", Price: 10, Stock: 5, IsActive: true})
	mr := newFakeMovementRepo()
	or := newFakeOrderRepo()
	tx := &fakeTxManager{repos: entity.Repositories{Products: pr, Movements: mr, Orders: or}}
	svc := NewOrderService(pr, mr, or, tx)

	order, err := svc.Create(context.Background(), "Cust", []OrderItemInput{{SKU: "SKU1", Qty: 2}}, "")
	if err != nil {
		t.Fatal(err)
	}
	cancelled, err := svc.Cancel(context.Background(), order.ID)
	if err != nil {
		t.Fatal(err)
	}
	if cancelled.Status != entity.OrderStatusCancelled {
		t.Fatalf("status = %s", cancelled.Status)
	}
	p, _ := pr.GetBySKU(context.Background(), "SKU1")
	if p.Stock != 5 {
		t.Fatalf("stock = %d, want 5", p.Stock)
	}
	// already cancelled
	_, err = svc.Cancel(context.Background(), order.ID)
	if err != entity.ErrAlreadyCancelled {
		t.Fatalf("expected already cancelled, got %v", err)
	}
}


