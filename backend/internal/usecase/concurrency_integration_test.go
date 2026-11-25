//go:build integration

package usecase

import (
	"context"
	"fmt"
	"sync"
	"testing"

	"stockflow/internal/config"
	"stockflow/internal/database"
	"stockflow/internal/repository"
)

func TestConcurrentOrders_NoNegativeStock_Integration(t *testing.T) {
	cfg := config.Load()
	pool, err := database.NewPool(context.Background(), cfg.DatabaseURL)
	if err != nil {
		t.Skipf("db unavailable: %v", err)
	}
	defer pool.Close()

	// seed product
	_, _ = pool.Exec(context.Background(), `INSERT INTO products (sku,name,price,stock,is_active) VALUES ('CONC-1','Concurrent',10,10,TRUE) ON CONFLICT (sku) DO UPDATE SET stock=10`)

	pr := repository.NewProductRepo(pool)
	mr := repository.NewMovementRepo(pool)
	or := repository.NewOrderRepo(pool)
	tx := repository.NewTxManager(pool)
	svc := NewOrderService(pr, mr, or, tx)

	const workers = 20
	var wg sync.WaitGroup
	errs := make(chan error, workers)
	for i := 0; i < workers; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			_, err := svc.Create(context.Background(), "conc", []OrderItemInput{{SKU: "CONC-1", Qty: 1}}, "")
			errs <- err
		}()
	}
	wg.Wait()
	close(errs)

	success := 0
	for e := range errs {
		if e == nil {
			success++
		}
	}
	if success != 10 {
		t.Fatalf("expected 10 successful orders, got %d", success)
	}
	p, err := pr.GetBySKU(context.Background(), "CONC-1")
	if err != nil {
		t.Fatal(err)
	}
	if p.Stock != 0 {
		t.Fatalf("final stock = %d, want 0", p.Stock)
	}
	fmt.Println("concurrent test done")
}


