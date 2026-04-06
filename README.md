# The-Invincible-Cloud

## Project Overview

**The-Invincible-Cloud** is a multi-cloud infrastructure project designed to eliminate single-provider dependency. By architecting a system that spans **AWS (EKS)** and **GCP (GKE)**, we ensure that even a total regional outage in one cloud does not result in application downtime.

The project demonstrates a **Live-Live (Active-Active)** resilience strategy where traffic is intelligently routed between providers, allowing for instantaneous failover if a cluster is "killed."

---

## Core Architecture and Methodology

The project utilizes an **Active-Active Traffic Proxy** architecture. Key pillars include:

- **Cross-Cloud Provisioning:** Using **Terraform** to simultaneously deploy production-ready Kubernetes clusters on **AWS (EKS)** and **GCP (GKE Autopilot)**.
- **Unified Entry Point:** A centralized **NGINX Reverse Proxy** deployed on an AWS EC2 instance that acts as the "Global Brain," monitoring the health of both clusters.
- **Upstream Failover Logic:** The NGINX configuration maintains a pool of endpoints (AWS ALB Hostname and GCP Load Balancer IP). It performs continuous Layer 7 health checks to ensure traffic only reaches healthy nodes.
- **Zero-Touch Redirection:** If the AWS cluster fails or is manually taken down, the proxy automatically reroutes **100% of traffic** to the GCP cluster without user intervention.

---

## Technical Stack

| **Component** | **Technology** | **Role in Project** |
| :--- | :--- | :--- |
| **Cloud Providers** | **AWS & GCP** | Hosting the multi-cloud infrastructure. |
| **Infrastructure as Code** | **Terraform** | Orchestrating EKS, GKE, and VPC resources via a modular approach. |
| **Orchestration** | **Kubernetes (EKS/GKE)** | Managing containerized application workloads across providers. |
| **Traffic Management** | **NGINX (Reverse Proxy)** | Handling multi-cloud load balancing and automated failover. |
| **App Environment** | **Docker & Node.js** | Deploying a sample application to validate cross-cloud portability. |
| **Resilience Testing** | **Bash / AWS CLI** | Simulating outages via security group manipulation or instance termination. |

---

## Key Project Objectives

1. **Multi-Cloud Orchestration:** Successfully provision and link AWS EKS and GCP GKE using a single Terraform workflow.
2. **Global Load Balancing:** Implement a unified entry point using an NGINX proxy to abstract the underlying cloud providers.
3. **Health-Aware Routing:** Configure automated health checks that detect "Upstream" failures in real-time.
4. **Application Consistency:** Ensure the same Dockerized application functions identically across EKS and GKE namespaces.
5. **Failover Validation:** Demonstrate "The-Invincible-Cloud" by killing the AWS provider and observing seamless traffic migration to GCP with zero downtime.

---

## Verification and Demo

To verify the "Invincible" nature of the architecture, a manual failover is performed by revoking network access to the AWS cluster:

1. **Baseline:** Traffic is balanced between AWS EKS and GCP GKE.
2. **The Kill:** Access to the AWS Load Balancer is revoked via Security Group rules.
3. **The Result:** NGINX identifies the AWS upstream as unhealthy and reroutes all requests to the GKE IP address.
4. **Outcome:** The application remains accessible to the end-user throughout the simulated outage.

> **Note:** This implementation is based on the [Wednesday Solutions Multi-Cloud Module](https://github.com/wednesday-solutions/multi-cloud-terraform-module).
