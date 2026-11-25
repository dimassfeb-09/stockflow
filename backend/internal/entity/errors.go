package entity

import "errors"

var (
	ErrNotFound          = errors.New("not found")
	ErrDuplicateSKU      = errors.New("sku already exists")
	ErrProductHasHistory = errors.New("product has movement history")
	ErrAlreadyCancelled  = errors.New("order already cancelled")
)

type InsufficientStockError struct {
	SKU       string
	Available int
}

func (e InsufficientStockError) Error() string {
	return "insufficient stock"
}

type ValidationError struct {
	Fields map[string]string
}

func (e ValidationError) Error() string {
	return "validation error"
}
