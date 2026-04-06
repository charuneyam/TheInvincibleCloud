terraform {
  backend "s3" {
    bucket         = "invincible-cloud-terraform"
    key            = "terraform.tfstate"
    region         = "ap-south-1"
    encrypt        = true
    dynamodb_table = "invincible-cloud-terraform-locks"
  }
}
