# agent-service on Kubernetes

Migrates the RAG/trip-planning service from AWS Lambda to a normal
long-running Kubernetes Deployment - Deployments, Services, ConfigMaps,
and an HPA for autoscaling under variable query load, as opposed to
Lambda's per-invocation scaling.

The Lambda deployment (`apps/backend/agent_service/Dockerfile`,
`samconfig.toml`) is untouched; this is an additional deployment target,
not a replacement.

## What's here

| File | Purpose |
|---|---|
| `namespace.yaml` | `travelguru` namespace |
| `configmap.yaml` | Non-secret env vars (`AGENT_BUS=kafka`, Kafka bootstrap servers, etc.) |
| `secret.example.yaml` | Template listing every secret the service reads via `os.getenv` - **fill and apply, never commit** |
| `deployment.yaml` | 2 replicas, readiness/liveness probes on `GET /`, resource requests/limits |
| `service.yaml` | ClusterIP Service on port 80 -> container port 8000 |
| `hpa.yaml` | Scales 2-8 replicas on CPU (70%) / memory (80%) utilization |

## Building the image

The Lambda `Dockerfile` runs `lambda_handler.handler` on the AWS Lambda
base image, which isn't a normal HTTP server. `Dockerfile.k8s` (in
`apps/backend/agent_service/`) instead runs `uvicorn main:app` on a
regular `python:3.12-slim` base:

```bash
cd apps/backend/agent_service
docker build -f Dockerfile.k8s -t travelguru/agent-service:latest .
```

For a local `kind`/`minikube` cluster, load the image directly instead of
pushing to a registry:

```bash
kind load docker-image travelguru/agent-service:latest
# or: minikube image load travelguru/agent-service:latest
```

## Deploying

```bash
kubectl apply -f k8s/agent-service/namespace.yaml
kubectl apply -f k8s/agent-service/configmap.yaml

cp k8s/agent-service/secret.example.yaml /tmp/secret.yaml
# fill in /tmp/secret.yaml with real values, then:
kubectl apply -f /tmp/secret.yaml
rm /tmp/secret.yaml

kubectl apply -f k8s/agent-service/deployment.yaml
kubectl apply -f k8s/agent-service/service.yaml
kubectl apply -f k8s/agent-service/hpa.yaml
```

Verify:

```bash
kubectl -n travelguru get pods -w
kubectl -n travelguru port-forward svc/agent-service 8000:80
curl localhost:8000/          # {"status": "ok"}
kubectl -n travelguru get hpa
```

## Notes

- `AGENT_BUS=kafka` is set in `configmap.yaml`, so this Deployment
  expects a reachable Kafka broker at `KAFKA_BOOTSTRAP_SERVERS`
  (`kafka.travelguru.svc.cluster.local:9092` by default) - see
  `docs/kafka-architecture.md`. Running Kafka in-cluster (Strimzi
  operator, or a StatefulSet) vs. pointing at a managed broker (MSK,
  Confluent Cloud) is left as a cluster-specific choice; this Deployment
  only assumes *something* is listening on that DNS name.
- WebSocket progress streaming (`/ws/progress/{client_id}`) works behind
  a ClusterIP + Ingress as long as the Ingress controller has WebSocket
  support enabled (true for ingress-nginx by default); no code changes
  needed versus API Gateway's WebSocket API on Lambda.
- The `generated_pdfs/` and `evaluations/` directories currently write to
  local disk (fine for a single Lambda invocation's `/tmp`, not fine
  across multiple long-lived pods). If PDF generation needs to survive
  pod restarts/rescheduling, mount an S3-backed volume or write straight
  to S3 instead of local disk - not yet done here.
