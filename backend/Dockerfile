FROM golang:1.24-alpine AS builder
WORKDIR /app
COPY go.mod ./
RUN go mod download
COPY . .
RUN go mod tidy
RUN CGO_ENABLED=0 go build -o server ./

FROM alpine:3.20
WORKDIR /app
COPY --from=builder /app/server ./server
EXPOSE 8080
ENV PORT=8080
ENTRYPOINT ["./server"]
