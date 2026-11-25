package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"stockflow/internal/config"
	"stockflow/internal/database"
	"stockflow/internal/handler"
	"stockflow/internal/repository"
	"stockflow/internal/usecase"
)

func main() {
	cfg := config.Load()
	ctx := context.Background()

	pool, err := database.NewPool(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("db: %v", err)
	}
	defer pool.Close()

	productRepo := repository.NewProductRepo(pool)
	movementRepo := repository.NewMovementRepo(pool)
	orderRepo := repository.NewOrderRepo(pool)
	txManager := repository.NewTxManager(pool)

	productSvc := usecase.NewProductService(productRepo, movementRepo, txManager)
	orderSvc := usecase.NewOrderService(productRepo, movementRepo, orderRepo, txManager)

	productH := handler.NewProductHandler(productSvc)
	orderH := handler.NewOrderHandler(orderSvc)

	srv := &http.Server{
		Addr:    ":" + cfg.Port,
		Handler: handler.NewRouter(productH, orderH),
	}

	go func() {
		log.Printf("server listening on :%s", cfg.Port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("listen: %v", err)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	log.Println("shutting down...")
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	_ = srv.Shutdown(shutdownCtx)
}
