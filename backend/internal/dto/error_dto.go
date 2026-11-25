package dto

type ErrorEnvelope struct {
	Error ErrorDetail `json:"error"`
}

type ErrorDetail struct {
	Code      string            `json:"code"`
	Message   string            `json:"message"`
	SKU       string            `json:"sku,omitempty"`
	Available int               `json:"available,omitempty"`
	Fields    map[string]string `json:"fields,omitempty"`
}
