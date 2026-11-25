package entity

import "time"

type Product struct {
	ID             int
	SKU            string
	Name           string
	Price          int // IDR, integer
	Stock          int
	IsActive       bool
	CreatedAt      time.Time
	LastMovementAt *time.Time
}

func (p Product) ValidateCreate() error {
	fields := map[string]string{}
	if p.SKU == "" {
		fields["sku"] = "sku is required"
	}
	if p.Name == "" {
		fields["name"] = "name is required"
	}
	if p.Price < 0 {
		fields["price"] = "price must be >= 0"
	}
	if len(fields) > 0 {
		return ValidationError{Fields: fields}
	}
	return nil
}

func (p Product) ValidateUpdate() error {
	fields := map[string]string{}
	if p.Name == "" {
		fields["name"] = "name is required"
	}
	if p.Price < 0 {
		fields["price"] = "price must be >= 0"
	}
	if len(fields) > 0 {
		return ValidationError{Fields: fields}
	}
	return nil
}
