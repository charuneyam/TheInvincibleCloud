provider "aws" {
  profile="account_a"
  region = "us-east-1"
}

provider "aws" {
  alias  = "account_c"
  region = "ap-south-1"
  profile="account_c"
}

provider "google" {
  project = var.gcp_project_id
  region  = "asia-south1"
  zone    = var.gcp_zone
}

