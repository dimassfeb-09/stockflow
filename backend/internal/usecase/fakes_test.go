package usecase

import (
	"context"
	"strings"
	"sync"

	"stockflow/internal/entity"
)

type fakeProductRepo struct {
	mu       sync.Mutex
	nextID   int
	products map[int]entity.Product
}

func newFakeProductRepo() *fakeProductRepo {
	return &fakeProductRepo{nextID: 1, products: map[int]entity.Product{}}
}

func (r *fakeProductRepo) seed(p entity.Product) entity.Product {
	r.mu.Lock()
	defer r.mu.Unlock()
	if p.ID == 0 {
		p.ID = r.nextID
		r.nextID++
	}
	r.products[p.ID] = p
	return p
}

func (r *fakeProductRepo) Create(ctx context.Context, p entity.Product) (entity.Product, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	for _, existing := range r.products {
		if existing.SKU == p.SKU {
			return entity.Product{}, entity.ErrDuplicateSKU
		}
	}
	p.ID = r.nextID
	r.nextID++
	r.products[p.ID] = p
	return p, nil
}

func (r *fakeProductRepo) GetByID(ctx context.Context, id int) (entity.Product, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	p, ok := r.products[id]
	if !ok {
		return entity.Product{}, entity.ErrNotFound
	}
	return p, nil
}

func (r *fakeProductRepo) GetByIDForUpdate(ctx context.Context, id int) (entity.Product, error) {
	return r.GetByID(ctx, id)
}

func (r *fakeProductRepo) GetBySKU(ctx context.Context, sku string) (entity.Product, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	for _, p := range r.products {
		if p.SKU == sku {
			return p, nil
		}
	}
	return entity.Product{}, entity.ErrNotFound
}

func (r *fakeProductRepo) List(ctx context.Context, search string, status string, lowStock bool, page, limit int) ([]entity.Product, int, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	var filtered []entity.Product
	for _, p := range r.products {
		if search != "" && !strings.Contains(p.SKU, search) && !strings.Contains(p.Name, search) {
			continue
		}
		if status == "active" && !p.IsActive {
			continue
		}
		if status == "inactive" && p.IsActive {
			continue
		}
		if lowStock && p.Stock > 10 {
			continue
		}
		filtered = append(filtered, p)
	}
	return filtered, len(filtered), nil
}

func (r *fakeProductRepo) Update(ctx context.Context, p entity.Product) (entity.Product, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	if _, ok := r.products[p.ID]; !ok {
		return entity.Product{}, entity.ErrNotFound
	}
	r.products[p.ID] = p
	return p, nil
}

func (r *fakeProductRepo) Delete(ctx context.Context, id int) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	if _, ok := r.products[id]; !ok {
		return entity.ErrNotFound
	}
	delete(r.products, id)
	return nil
}

func (r *fakeProductRepo) HasHistory(ctx context.Context, id int) (bool, error) {
	return false, nil
}

func (r *fakeProductRepo) LockBySKUs(ctx context.Context, skus []string) ([]entity.Product, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	set := map[string]bool{}
	for _, s := range skus {
		set[s] = true
	}
	var out []entity.Product
	for _, p := range r.products {
		if set[p.SKU] {
			out = append(out, p)
		}
	}
	return out, nil
}

func (r *fakeProductRepo) DecrementStock(ctx context.Context, id, qty int) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	p, ok := r.products[id]
	if !ok {
		return entity.ErrNotFound
	}
	if p.Stock < qty {
		return entity.InsufficientStockError{SKU: p.SKU, Available: p.Stock}
	}
	p.Stock -= qty
	r.products[id] = p
	return nil
}

func (r *fakeProductRepo) IncrementStock(ctx context.Context, id, qty int) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	p, ok := r.products[id]
	if !ok {
		return entity.ErrNotFound
	}
	p.Stock += qty
	r.products[id] = p
	return nil
}

type fakeMovementRepo struct {
	mu        sync.Mutex
	nextID    int
	movements []entity.StockMovement
}

func newFakeMovementRepo() *fakeMovementRepo {
	return &fakeMovementRepo{nextID: 1}
}

func (r *fakeMovementRepo) Create(ctx context.Context, m entity.StockMovement) (entity.StockMovement, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	m.ID = r.nextID
	r.nextID++
	r.movements = append(r.movements, m)
	return m, nil
}

func (r *fakeMovementRepo) ListByProduct(ctx context.Context, productID int) ([]entity.StockMovement, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	var out []entity.StockMovement
	for _, m := range r.movements {
		if m.ProductID == productID {
			out = append(out, m)
		}
	}
	return out, nil
}

type fakeOrderRepo struct {
	mu           sync.Mutex
	nextID       int
	orders       map[int]entity.SalesOrder
	idempotency  map[string]int
}

func newFakeOrderRepo() *fakeOrderRepo {
	return &fakeOrderRepo{nextID: 1, orders: map[int]entity.SalesOrder{}, idempotency: map[string]int{}}
}

func (r *fakeOrderRepo) Create(ctx context.Context, order entity.SalesOrder, items []entity.SalesOrderItem) (entity.SalesOrder, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	order.ID = r.nextID
	r.nextID++
	order.Items = make([]entity.SalesOrderItem, len(items))
	copy(order.Items, items)
	for i := range order.Items {
		order.Items[i].ID = i + 1
		order.Items[i].OrderID = order.ID
	}
	r.orders[order.ID] = order
	return order, nil
}

func (r *fakeOrderRepo) GetByID(ctx context.Context, id int) (entity.SalesOrder, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	o, ok := r.orders[id]
	if !ok {
		return entity.SalesOrder{}, entity.ErrNotFound
	}
	return o, nil
}

func (r *fakeOrderRepo) MarkCancelled(ctx context.Context, id int) (entity.SalesOrder, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	o, ok := r.orders[id]
	if !ok {
		return entity.SalesOrder{}, entity.ErrNotFound
	}
	if o.Status == entity.OrderStatusCancelled {
		return entity.SalesOrder{}, entity.ErrAlreadyCancelled
	}
	o.Status = entity.OrderStatusCancelled
	r.orders[id] = o
	return o, nil
}

type fakeTxManager struct {
	repos entity.Repositories
}

func (f *fakeTxManager) RunInTx(ctx context.Context, fn func(entity.Repositories) error) error {
	return fn(f.repos)
}

func (r *fakeOrderRepo) GetByIdempotencyKey(ctx context.Context, key string) (entity.SalesOrder, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	id, ok := r.idempotency[key]
	if !ok {
		return entity.SalesOrder{}, entity.ErrNotFound
	}
	o, ok := r.orders[id]
	if !ok {
		return entity.SalesOrder{}, entity.ErrNotFound
	}
	return o, nil
}

func (r *fakeOrderRepo) SaveIdempotencyKey(ctx context.Context, key string, orderID int) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.idempotency[key] = orderID
	return nil
}

func (r *fakeOrderRepo) DailySales(ctx context.Context, date string) (int, int, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	count := 0
	total := 0
	for _, o := range r.orders {
		if o.Status == entity.OrderStatusCreated {
			count++
			total += o.Total
		}
	}
	return count, total, nil
}
