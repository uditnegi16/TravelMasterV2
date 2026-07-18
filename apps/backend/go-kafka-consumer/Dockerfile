# -----------------------------
# Stage 1 : Build
# -----------------------------
FROM golang:1.24-alpine AS builder

WORKDIR /app

COPY go.mod go.sum ./

RUN go mod download

COPY . .

RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 \
    go build -ldflags="-s -w" -o aggregator .

# -----------------------------
# Stage 2 : Runtime
# -----------------------------
FROM alpine:3.22

RUN apk --no-cache add ca-certificates \
    && addgroup -S app && adduser -S app -G app

WORKDIR /app

COPY --from=builder /app/aggregator .

USER app

EXPOSE 8081
EXPOSE 2112
EXPOSE 6060

ENTRYPOINT ["./aggregator"]