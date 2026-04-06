variable "key_name" {
  description = "EC2"
  type        = string
}

variable "aws_availability_zone" {
  type        = string
  description = "AWS AZ for the public subnet"
  default     = "ap-south-1a"
}

variable "gcp_vpc_cidr" {
  type        = string
  description = "GCP VPC CIDR range used for cross-cloud rules"
  default     = "10.1.0.0/16"
}

variable "gcp_zone" {
  type        = string
  description = "GCP zone"
  default     = "asia-south1-a"
}

variable "ssh_public_key" {
  type        = string
  description = "SSH public key (OpenSSH format) used for both AWS and GCP instances"
}

variable "ssh_username" {
  type        = string
  description = "Username to configure on instances for SSH"
  default     = "ubuntu"
}

variable "allowed_ssh_cidr" {
  type        = string
  description = "CIDR allowed to SSH to instances (tighten this!)"
  default     = "0.0.0.0/0"
}

variable "ipsec_psk" {
  type        = string
  description = "Pre-shared key for StrongSwan (PSK). Use a long random string."
  sensitive   = true
}

# Static private IPs to avoid cross-provider dependency cycles.
variable "aws_vpn_private_ip" {
  type        = string
  description = "Static private IP for the AWS VPN EC2 instance"
  default     = "10.0.1.10"
}

variable "gcp_vpn_private_ip" {
  type        = string
  description = "Static private IP for the GCP VPN VM"
  default     = "10.1.1.10"
}

variable "aws_instance_type" {
  type        = string
  description = "AWS instance type (free tier varies by region/account)"
  default     = "t3.micro"
}

variable "gcp_machine_type" {
  type        = string
  description = "GCP machine type (e2-micro is usually free tier eligible)"
  default     = "e2-micro"
}

variable "gcp_region" {
  type        = string
  description = "GCP region"
  default     = "asia-south1"
}

variable "gcp_project_id" {
  type        = string
  description = "GCP Project ID"
}

variable "db_instance_class" {
  type        = string
  description = "AWS RDS instance class"
  default     = "db.t3.micro"
}

variable "db_allocated_storage" {
  type        = number
  description = "AWS RDS allocated storage in GB"
  default     = 20
}

variable "db_name" {
  type        = string
  description = "Database name"
  default     = "appdb"
}

variable "db_username" {
  type        = string
  description = "Database master username"
  default     = "postgres"
}

variable "db_password" {
  type        = string
  description = "Database master password"
  sensitive   = true
}

variable "gcp_db_password" {
  type        = string
  description = "GCP Cloud SQL master password"
  sensitive   = true
}
