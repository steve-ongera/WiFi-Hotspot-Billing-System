#  WifiBill — WiFi Hotspot Billing System

> Production-ready WiFi billing platform built with Django 5, React 19, MikroTik RouterOS, and M-Pesa Daraja API.

---

##  Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Database Design](#database-design)
- [API Endpoints](#api-endpoints)
- [MikroTik Setup](#mikrotik-setup)
- [M-Pesa Integration](#m-pesa-integration)
- [Environment Variables](#environment-variables)
- [Local Development](#local-development)
- [Docker Setup](#docker-setup)
- [Deployment](#deployment)
- [Security](#security)
- [Milestones](#milestones)

---

## Overview

WifiBill is a full-stack WiFi hotspot billing system that allows ISPs and hotspot operators to:

- Sell internet packages (hourly, daily, weekly, monthly) also there are packages that can be hotspot more than 2 users , just one user , 8 users , its a buiness we need profits
- Accept payments via M-Pesa STK Push
- Automatically provision MikroTik hotspot users after payment
- Monitor bandwidth usage, active sessions, and revenue
- Generate vouchers for offline customers
- Provide a captive portal for customer self-service

---

## Architecture

```
                        ┌─────────────────────────────────────────┐
                        │              INTERNET (ISP)              │
                        └────────────────────┬────────────────────┘
                                             │
                        ┌────────────────────▼────────────────────┐
                        │            ISP Modem / ONU              │
                        └────────────────────┬────────────────────┘
                                             │ WAN (ether1)
                        ┌────────────────────▼────────────────────┐
                        │         MikroTik Router (hAP ac²)       │
                        │                                         │
                        │  • Hotspot Server (ether2 / wlan1)      │
                        │  • DHCP Server (192.168.88.0/24)        │
                        │  • Firewall / NAT                       │
                        │  • Queue Trees (speed limits)           │
                        │  • RouterOS API (port 8728)             │
                        └────────────┬───────────────┬────────────┘
                                     │               │
                       ┌─────────────▼──┐      ┌────▼────────────┐
                       │  WiFi AP        │      │  Admin Network  │
                       │  (wlan1)        │      │  (ether2)       │
                       └─────────────┬──┘      └─────────────────┘
                                     │
                       ┌─────────────▼─────────────┐
                       │     Customer Device        │
                       │  Browser opens captive     │
                       │  portal automatically      │
                       └─────────────┬─────────────┘
                                     │ HTTP redirect
                       ┌─────────────▼─────────────┐
                       │   React Frontend (Vite)    │
                       │   localhost:5173 / Vercel  │
                       │                            │
                       │  • Login / Register Page   │
                       │  • Package Selection       │
                       │  • M-Pesa Payment UI       │
                       │  • Customer Dashboard      │
                       └─────────────┬─────────────┘
                                     │ REST API calls (Axios)
                       ┌─────────────▼─────────────┐
                       │   Django API (DRF)         │
                       │   localhost:8000           │
                       │                            │
                       │  • JWT Authentication      │
                       │  • Package Management      │
                       │  • Payment Processing      │
                       │  • MikroTik Service        │
                       │  • M-Pesa Daraja Service   │
                       │  • Celery Task Queue       │
                       └──┬──────────┬──────────┬──┘
                          │          │          │
              ┌───────────▼──┐  ┌────▼───┐  ┌──▼──────────┐
              │  PostgreSQL  │  │ Redis  │  │  MikroTik   │
              │  (Database)  │  │(Cache/ │  │  RouterOS   │
              │              │  │ Queue) │  │  API :8728  │
              └──────────────┘  └────────┘  └─────────────┘
                                                    │
                                     ┌──────────────▼──────────────┐
                                     │    Safaricom Daraja API      │
                                     │    (M-Pesa STK Push)         │
                                     └─────────────────────────────┘
```

### Request Flow — Package Purchase

```
Customer selects package
        │
        ▼
React sends POST /api/payments/initiate/
        │
        ▼
Django calls Daraja STK Push
        │
        ▼
Customer enters M-Pesa PIN on phone
        │
        ▼
Safaricom calls Django /api/payments/mpesa/callback/
        │
        ▼
Django verifies transaction
        │
        ▼
Celery task: activate hotspot user on MikroTik
        │
        ▼
Customer gets internet access
```

---

## Tech Stack

| Layer         | Technology                                        |
|--------------|---------------------------------------------------|
| Backend      | Django 5.0, Django REST Framework 3.15            |
| Auth         | JWT (djangorestframework-simplejwt)               |
| Database     | PostgreSQL 16                                     |
| Cache/Queue  | Redis 7                                           |
| Task Queue   | Celery 5                                          |
| Payments     | Safaricom Daraja API (M-Pesa STK Push)            |
| Network      | MikroTik RouterOS API (routeros-api)              |
| Frontend     | React 19, Vite 5                                  |
| UI Framework | Bootstrap 5.3                                     |
| Charts       | Chart.js 4 + react-chartjs-2                      |
| HTTP Client  | Axios                                             |
| Routing      | React Router v6                                   |
| Deployment   | Ubuntu 22.04, Nginx, Gunicorn, Docker             |

---

## Project Structure

```
wifibill/
│
├──  backend/                          # Django project root
│   ├──  config/                       # Django project settings
│   │   ├── __init__.py
│   │   ├── settings/
│   │   │   ├── __init__.py
│   │   │   ├── base.py                  # Shared settings
│   │   │   ├── development.py           # Dev overrides
│   │   │   └── production.py           # Prod overrides
│   │   ├── urls.py                      # Root URL conf
│   │   ├── wsgi.py
│   │   └── asgi.py
│   │
│   ├──  apps/ ( for appp just one core application to minimize several apps just one is enough for login we will be using email and password or phonenumber either)
│   │   ├──  accounts/                 # User management
│   │   │   ├── __init__.py
│   │   │   ├── apps.py
│   │   │   ├── models.py                # Customer model
│   │   │   ├── serializers.py
│   │   │   ├── views.py                 # Auth endpoints
│   │   │   ├── urls.py
│   │   │   ├── permissions.py
│   │   │   └── admin.py
│   │   │
│   │   ├──  packages/                 # Internet packages
│   │   │   ├── __init__.py
│   │   │   ├── apps.py
│   │   │   ├── models.py                # Package, Voucher models
│   │   │   ├── serializers.py
│   │   │   ├── views.py
│   │   │   ├── urls.py
│   │   │   └── admin.py
│   │   │
│   │   ├──  payments/                 # M-Pesa payments
│   │   │   ├── __init__.py
│   │   │   ├── apps.py
│   │   │   ├── models.py                # Payment, TransactionLog
│   │   │   ├── serializers.py
│   │   │   ├── views.py                 # STK push + callback
│   │   │   ├── urls.py
│   │   │   └── admin.py
│   │   │
│   │   ├──  hotspot/                  # MikroTik integration
│   │   │   ├── __init__.py
│   │   │   ├── apps.py
│   │   │   ├── models.py                # HotspotUser, Session, Bandwidth
│   │   │   ├── serializers.py
│   │   │   ├── views.py
│   │   │   ├── urls.py
│   │   │   └── admin.py
│   │   │
│   │   └──  reports/                  # Analytics & reports
│   │       ├── __init__.py
│   │       ├── apps.py
│   │       ├── views.py
│   │       └── urls.py
│   │
│   ├──  services/                     # External service integrations
│   │   ├── __init__.py
│   │   ├── mikrotik.py                  # MikroTik RouterOS API service
│   │   └── mpesa.py                     # Safaricom Daraja service
│   │
│   ├──  tasks/                        # Celery tasks
│   │   ├── __init__.py
│   │   ├── celery.py                    # Celery app config
│   │   ├── hotspot_tasks.py             # Activate/expire users
│   │   └── payment_tasks.py            # Payment verification
│   │
│   ├──  utils/                        # Helpers & utilities
│   │   ├── __init__.py
│   │   ├── responses.py                 # Standardized API responses
│   │   ├── pagination.py                # Custom pagination
│   │   └── validators.py               # Phone number validators
│   │
│   ├──  templates/                    # Django HTML templates
│   │   └── receipts/
│   │       └── receipt.html             # PDF receipt template
│   │
│   ├──  static/                       # Static files
│   ├──  media/                        # Uploaded files
│   ├── manage.py
│   ├── requirements.txt
│   ├── requirements-dev.txt
│   └── .env.example
│
├──  frontend/                         # React + Vite project
│   ├──  src/
│   │   ├──  assets/                   # Images, icons, fonts
│   │   │
│   │   ├──  components/               # Reusable UI components
│   │   │   ├──  common/
│   │   │   │   ├── Navbar.jsx
│   │   │   │   ├── Sidebar.jsx
│   │   │   │   ├── Footer.jsx
│   │   │   │   ├── LoadingSpinner.jsx
│   │   │   │   ├── ConfirmModal.jsx
│   │   │   │   ├── AlertMessage.jsx
│   │   │   │   └── Pagination.jsx
│   │   │   │
│   │   │   ├──  dashboard/
│   │   │   │   ├── StatCard.jsx
│   │   │   │   ├── RevenueChart.jsx
│   │   │   │   ├── UsersChart.jsx
│   │   │   │   └── RecentPayments.jsx
│   │   │   │
│   │   │   ├──  packages/
│   │   │   │   ├── PackageCard.jsx
│   │   │   │   └── PackageForm.jsx
│   │   │   │
│   │   │   ├──  payments/
│   │   │   │   ├── MpesaModal.jsx
│   │   │   │   ├── PaymentStatusPoller.jsx
│   │   │   │   └── ReceiptDownload.jsx
│   │   │   │
│   │   │   └──  hotspot/
│   │   │       ├── SessionTimer.jsx
│   │   │       ├── DataUsageBar.jsx
│   │   │       └── OnlineUsersList.jsx
│   │   │
│   │   ├──  pages/
│   │   │   ├──  auth/
│   │   │   │   ├── Login.jsx
│   │   │   │   └── Register.jsx
│   │   │   │
│   │   │   ├──  customer/
│   │   │   │   ├── CustomerDashboard.jsx
│   │   │   │   ├── Packages.jsx
│   │   │   │   ├── PurchasePackage.jsx
│   │   │   │   ├── PaymentHistory.jsx
│   │   │   │   └── Profile.jsx
│   │   │   │
│   │   │   └──  admin/
│   │   │       ├── AdminDashboard.jsx
│   │   │       ├── ManageUsers.jsx
│   │   │       ├── ManagePackages.jsx
│   │   │       ├── ManageVouchers.jsx
│   │   │       ├── AllPayments.jsx
│   │   │       ├── BandwidthReports.jsx
│   │   │       ├── RevenueReports.jsx
│   │   │       └── Settings.jsx
│   │   │
│   │   ├──  contexts/
│   │   │   └── AuthContext.jsx          # JWT auth context + provider
│   │   │
│   │   ├──  hooks/
│   │   │   ├── useAuth.js
│   │   │   ├── usePackages.js
│   │   │   ├── usePayments.js
│   │   │   └── useHotspot.js
│   │   │
│   │   ├──  layouts/
│   │   │   ├── CustomerLayout.jsx       # Navbar + footer for customers
│   │   │   └── AdminLayout.jsx          # Sidebar layout for admin
│   │   │
│   │   ├──  services/
│   │   │   └── api.js                   # Axios instance + all API calls
│   │   │
│   │   ├──  utils/
│   │   │   ├── formatters.js            # Currency, date, data formatters
│   │   │   └── validators.js           # Form validators
│   │   │
│   │   ├── App.jsx                      # Root component + routes
│   │   ├── main.jsx
│   │   └── index.css
│   │
│   ├── index.html
│   ├── vite.config.js
│   ├── package.json
│   └── .env.example
│
├──  docker/
│   ├── backend.Dockerfile
│   ├── frontend.Dockerfile
│   ├── nginx/
│   │   ├── nginx.conf                   # Main Nginx config
│   │   └── wifibill.conf               # Site config
│   └── celery.Dockerfile
│
├──  scripts/
│   ├── setup.sh                         # Initial server setup
│   ├── deploy.sh                        # Deployment script
│   └── backup_db.sh                    # DB backup cron script
│
├──  mikrotik/
│   ├── setup_hotspot.rsc               # MikroTik terminal commands
│   ├── captive_portal/
│   │   ├── login.html                   # Custom hotspot login page
│   │   ├── logout.html
│   │   └── alogin.html                  # Auto-login redirect
│   └── README.md                        # Step-by-step MikroTik setup
│
├── docker-compose.yml                   # Full stack compose
├── docker-compose.dev.yml              # Development compose
├── .env.example
├── .gitignore
└── README.md
```

---

## Database Design

### Entity Relationship Diagram

```
┌─────────────────────┐       ┌──────────────────────────┐
│      Customer        │       │         Package           │
├─────────────────────┤       ├──────────────────────────┤
│ id (PK)             │       │ id (PK)                  │
│ user (FK→User)      │       │ name                     │
│ phone_number        │       │ package_type             │
│ id_number           │       │ price (KES)              │
│ is_suspended        │       │ duration_value           │
│ mac_address         │       │ duration_unit            │
│ created_at          │       │ speed_limit_up (Mbps)    │
│ updated_at          │       │ speed_limit_down (Mbps)  │
└──────────┬──────────┘       │ data_limit_mb            │
           │ 1                │ is_active                │
           │                  │ created_at               │
           │ M                └────────────┬─────────────┘
┌──────────▼──────────┐                   │ 1
│      Payment         │                   │
├─────────────────────┤                   │ M
│ id (PK)             │       ┌────────────▼─────────────┐
│ customer (FK)       │       │       HotspotUser         │
│ package (FK)        │       ├──────────────────────────┤
│ amount              │       │ id (PK)                  │
│ phone_number        │       │ customer (FK)            │
│ mpesa_checkout_id   │       │ package (FK)             │
│ mpesa_receipt_no    │       │ payment (FK)             │
│ status              │       │ username                 │
│ payment_method      │       │ password (hashed)        │
│ created_at          │       │ mac_address              │
│ paid_at             │       │ ip_address               │
└──────────┬──────────┘       │ is_active                │
           │ 1                │ activated_at             │
           │                  │ expires_at               │
           │ 1                └────────────┬─────────────┘
           │                               │ 1
┌──────────▼──────────┐                   │
│   TransactionLog    │                   │ M
├─────────────────────┤       ┌────────────▼─────────────┐
│ id (PK)             │       │         Session           │
│ payment (FK)        │       ├──────────────────────────┤
│ event_type          │       │ id (PK)                  │
│ raw_response (JSON) │       │ hotspot_user (FK)        │
│ created_at          │       │ session_id               │
└─────────────────────┘       │ ip_address               │
                               │ mac_address              │
┌─────────────────────┐       │ bytes_in                 │
│       Voucher        │       │ bytes_out                │
├─────────────────────┤       │ started_at               │
│ id (PK)             │       │ ended_at                 │
│ package (FK)        │       └────────────┬─────────────┘
│ code (unique)       │                   │
│ is_used             │                   │ M
│ used_by (FK)        │       ┌────────────▼─────────────┐
│ used_at             │       │    BandwidthUsage         │
│ created_at          │       ├──────────────────────────┤
│ expires_at          │       │ id (PK)                  │
└─────────────────────┘       │ hotspot_user (FK)        │
                               │ bytes_in                 │
                               │ bytes_out                │
                               │ recorded_at              │
                               └──────────────────────────┘
```

### Model Definitions

```python
# apps/accounts/models.py

from django.db import models
from django.contrib.auth.models import AbstractUser

class User(AbstractUser):
    """Extended user with role support"""
    ROLE_CHOICES = [('admin', 'Admin'), ('customer', 'Customer')]
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='customer')
    phone_number = models.CharField(max_length=15, unique=True)

class Customer(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='customer')
    id_number = models.CharField(max_length=20, blank=True)
    mac_address = models.CharField(max_length=17, blank=True)
    is_suspended = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.user.get_full_name()} ({self.user.phone_number})"
```

```python
# apps/packages/models.py

class Package(models.Model):
    TYPE_CHOICES = [
        ('hourly', 'Hourly'),
        ('daily', 'Daily'),
        ('weekly', 'Weekly'),
        ('monthly', 'Monthly'),
        ('custom', 'Custom'),
    ]
    UNIT_CHOICES = [('minutes', 'Minutes'), ('hours', 'Hours'), ('days', 'Days')]

    name = models.CharField(max_length=100)
    package_type = models.CharField(max_length=20, choices=TYPE_CHOICES)
    price = models.DecimalField(max_digits=10, decimal_places=2)
    duration_value = models.PositiveIntegerField()
    duration_unit = models.CharField(max_length=20, choices=UNIT_CHOICES)
    speed_limit_up = models.PositiveIntegerField(help_text='Mbps upload')
    speed_limit_down = models.PositiveIntegerField(help_text='Mbps download')
    data_limit_mb = models.PositiveBigIntegerField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def duration_in_seconds(self):
        multiplier = {'minutes': 60, 'hours': 3600, 'days': 86400}
        return self.duration_value * multiplier[self.duration_unit]

class Voucher(models.Model):
    package = models.ForeignKey(Package, on_delete=models.CASCADE)
    code = models.CharField(max_length=20, unique=True)
    is_used = models.BooleanField(default=False)
    used_by = models.ForeignKey('accounts.Customer', null=True, blank=True, on_delete=models.SET_NULL)
    used_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField(null=True, blank=True)
```

```python
# apps/payments/models.py

class Payment(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('processing', 'Processing'),
        ('completed', 'Completed'),
        ('failed', 'Failed'),
        ('cancelled', 'Cancelled'),
    ]
    METHOD_CHOICES = [('mpesa', 'M-Pesa'), ('voucher', 'Voucher'), ('cash', 'Cash')]

    customer = models.ForeignKey('accounts.Customer', on_delete=models.CASCADE)
    package = models.ForeignKey('packages.Package', on_delete=models.PROTECT)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    phone_number = models.CharField(max_length=15)
    mpesa_checkout_request_id = models.CharField(max_length=100, blank=True)
    mpesa_receipt_number = models.CharField(max_length=50, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    payment_method = models.CharField(max_length=20, choices=METHOD_CHOICES, default='mpesa')
    created_at = models.DateTimeField(auto_now_add=True)
    paid_at = models.DateTimeField(null=True, blank=True)

class TransactionLog(models.Model):
    payment = models.ForeignKey(Payment, on_delete=models.CASCADE, related_name='logs')
    event_type = models.CharField(max_length=50)  # stk_push, callback, activation
    raw_response = models.JSONField()
    created_at = models.DateTimeField(auto_now_add=True)
```

```python
# apps/hotspot/models.py

class HotspotUser(models.Model):
    customer = models.ForeignKey('accounts.Customer', on_delete=models.CASCADE)
    package = models.ForeignKey('packages.Package', on_delete=models.PROTECT)
    payment = models.OneToOneField('payments.Payment', on_delete=models.SET_NULL, null=True)
    username = models.CharField(max_length=100, unique=True)
    password = models.CharField(max_length=100)
    mac_address = models.CharField(max_length=17, blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    is_active = models.BooleanField(default=False)
    mikrotik_synced = models.BooleanField(default=False)
    activated_at = models.DateTimeField(null=True, blank=True)
    expires_at = models.DateTimeField(null=True, blank=True)

class Session(models.Model):
    hotspot_user = models.ForeignKey(HotspotUser, on_delete=models.CASCADE)
    session_id = models.CharField(max_length=100)
    ip_address = models.GenericIPAddressField()
    mac_address = models.CharField(max_length=17)
    bytes_in = models.BigIntegerField(default=0)
    bytes_out = models.BigIntegerField(default=0)
    started_at = models.DateTimeField()
    ended_at = models.DateTimeField(null=True, blank=True)

class BandwidthUsage(models.Model):
    hotspot_user = models.ForeignKey(HotspotUser, on_delete=models.CASCADE)
    bytes_in = models.BigIntegerField(default=0)
    bytes_out = models.BigIntegerField(default=0)
    recorded_at = models.DateTimeField(auto_now_add=True)
```

---

## API Endpoints

### Authentication — `/api/auth/`

| Method | Endpoint                | Description              | Auth     |
|--------|-------------------------|--------------------------|----------|
| POST   | `/api/auth/register/`   | Register new customer    | Public   |
| POST   | `/api/auth/login/`      | Get JWT tokens           | Public   |
| POST   | `/api/auth/refresh/`    | Refresh JWT access token | Public   |
| POST   | `/api/auth/logout/`     | Blacklist refresh token  | Customer |
| GET    | `/api/auth/profile/`    | Get current user profile | Customer |
| PATCH  | `/api/auth/profile/`    | Update profile           | Customer |
| POST   | `/api/auth/change-password/` | Change password     | Customer |

### Packages — `/api/packages/`

| Method | Endpoint                   | Description           | Auth     |
|--------|----------------------------|-----------------------|----------|
| GET    | `/api/packages/`           | List active packages  | Public   |
| POST   | `/api/packages/`           | Create package        | Admin    |
| GET    | `/api/packages/{id}/`      | Package detail        | Public   |
| PUT    | `/api/packages/{id}/`      | Update package        | Admin    |
| DELETE | `/api/packages/{id}/`      | Delete package        | Admin    |

### Payments — `/api/payments/`

| Method | Endpoint                           | Description              | Auth     |
|--------|------------------------------------|--------------------------|----------|
| POST   | `/api/payments/initiate/`          | Initiate M-Pesa STK Push | Customer |
| POST   | `/api/payments/mpesa/callback/`    | Daraja callback (webhook)| Public   |
| GET    | `/api/payments/status/{checkout_id}/` | Poll payment status   | Customer |
| GET    | `/api/payments/history/`           | My payment history       | Customer |
| GET    | `/api/payments/receipt/{id}/`      | Download PDF receipt     | Customer |
| GET    | `/api/payments/`                   | All payments (admin)     | Admin    |
| POST   | `/api/payments/voucher/redeem/`    | Redeem voucher           | Customer |

### Hotspot — `/api/hotspot/`

| Method | Endpoint                       | Description               | Auth     |
|--------|--------------------------------|---------------------------|----------|
| GET    | `/api/hotspot/my-session/`     | Active session + usage    | Customer |
| GET    | `/api/hotspot/online-users/`   | Currently online users    | Admin    |
| POST   | `/api/hotspot/disconnect/{id}/`| Disconnect user           | Admin    |
| POST   | `/api/hotspot/suspend/{id}/`   | Suspend customer          | Admin    |
| POST   | `/api/hotspot/activate/{id}/`  | Activate customer         | Admin    |

### Customers — `/api/customers/`

| Method | Endpoint                  | Description        | Auth  |
|--------|---------------------------|--------------------|-------|
| GET    | `/api/customers/`         | List all customers | Admin |
| GET    | `/api/customers/{id}/`    | Customer detail    | Admin |
| PATCH  | `/api/customers/{id}/`    | Update customer    | Admin |
| DELETE | `/api/customers/{id}/`    | Delete customer    | Admin |

### Vouchers — `/api/vouchers/`

| Method | Endpoint                    | Description         | Auth  |
|--------|-----------------------------|---------------------|-------|
| GET    | `/api/vouchers/`            | List vouchers       | Admin |
| POST   | `/api/vouchers/generate/`   | Generate bulk codes | Admin |
| DELETE | `/api/vouchers/{id}/`       | Delete voucher      | Admin |

### Reports — `/api/reports/`

| Method | Endpoint                        | Description             | Auth  |
|--------|---------------------------------|-------------------------|-------|
| GET    | `/api/reports/revenue/`         | Revenue by date range   | Admin |
| GET    | `/api/reports/bandwidth/`       | Bandwidth usage         | Admin |
| GET    | `/api/reports/active-users/`    | Active user count       | Admin |
| GET    | `/api/reports/dashboard-stats/` | Dashboard summary       | Admin |

---

## MikroTik Setup

### Step 1 — Configure WAN (ether1)

```bash
# Connect to MikroTik via Winbox or SSH
# Set ether1 as WAN from ISP

/interface set ether1 name=WAN comment="ISP Uplink"

/ip dhcp-client add interface=WAN disabled=no comment="Get IP from ISP"
```

### Step 2 — Configure LAN (ether2 / wlan1)

```bash
# Assign static IP to LAN interface
/ip address add address=192.168.88.1/24 interface=ether2 comment="LAN Gateway"

# Assign IP to WiFi interface
/ip address add address=192.168.89.1/24 interface=wlan1 comment="WiFi Gateway"

# Enable WiFi interface
/interface wireless enable wlan1
/interface wireless set wlan1 ssid="WifiBill-Hotspot" mode=ap-bridge band=2ghz-b/g/n
```

### Step 3 — Configure DHCP Server

```bash
# Create DHCP pool
/ip pool add name=dhcp-pool ranges=192.168.88.10-192.168.88.250

# Create DHCP server
/ip dhcp-server add name=dhcp-server interface=ether2 address-pool=dhcp-pool disabled=no

# Set DHCP network
/ip dhcp-server network add address=192.168.88.0/24 gateway=192.168.88.1 dns-server=8.8.8.8,8.8.4.4

# WiFi DHCP pool
/ip pool add name=wifi-pool ranges=192.168.89.10-192.168.89.250
/ip dhcp-server add name=wifi-dhcp interface=wlan1 address-pool=wifi-pool disabled=no
/ip dhcp-server network add address=192.168.89.0/24 gateway=192.168.89.1 dns-server=8.8.8.8,8.8.4.4
```

### Step 4 — Configure DNS & NAT

```bash
# Set DNS
/ip dns set servers=8.8.8.8,8.8.4.4 allow-remote-requests=yes

# Source NAT (masquerade) — allows LAN devices to access internet
/ip firewall nat add chain=srcnat out-interface=WAN action=masquerade comment="NAT to ISP"
```

### Step 5 — Configure Hotspot

```bash
# Set up hotspot on WiFi interface
/ip hotspot setup

# When prompted:
# hotspot interface: wlan1
# local address of network: 192.168.89.1/24
# masquerade network: yes
# address pool of network: 192.168.89.10-192.168.89.250
# certificates: none
# DNS name: hotspot.wifibill.local

# Set hotspot profile
/ip hotspot profile set hsprof1 \
    login-by=mac,http-chap \
    http-proxy=0.0.0.0:8080 \
    html-directory=flash/hotspot \
    use-radius=no

# Set hotspot server name
/ip hotspot set hotspot1 name=wifibill-hotspot
```

### Step 6 — Customize Captive Portal Login Page

```bash
# Copy login page to MikroTik files
# Upload via Winbox Files tab → flash/hotspot/
# OR via FTP to 192.168.88.1

# Login page will redirect to Django API for authentication
# The login form submits to the hotspot's built-in authentication
# which then calls our Django API
```

The custom `login.html` sends credentials to Django API:

```html
<!-- mikrotik/captive_portal/login.html -->
<!DOCTYPE html>
<html>
<head>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>WifiBill — Login</title>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css">
</head>
<body class="bg-primary d-flex align-items-center justify-content-center vh-100">
<div class="card shadow p-4" style="max-width:400px;width:100%">
    <h4 class="text-center fw-bold mb-4">📡 WifiBill Hotspot</h4>
    <!-- MikroTik hotspot variables are injected via $(var) syntax -->
    <form name="sendin" action="$(link-login-only)" method="post">
        <input type="hidden" name="dst" value="$(link-orig)">
        <div class="mb-3">
            <label class="form-label">Phone / Username</label>
            <input type="text" name="username" class="form-control" required>
        </div>
        <div class="mb-3">
            <label class="form-label">Password</label>
            <input type="password" name="password" class="form-control" required>
        </div>
        <button type="submit" class="btn btn-primary w-100">Connect</button>
        <a href="http://192.168.88.1:5173" class="btn btn-outline-secondary w-100 mt-2">
            Buy Package
        </a>
    </form>
</div>
</body>
</html>
```

### Step 7 — Redirect to Django API

```bash
# Allow Django API server (running on admin network) to bypass hotspot
/ip hotspot ip-binding add address=192.168.1.10 type=bypassed comment="Django Server"

# Create hotspot user profile with rate limiting
/ip hotspot user profile add name=default-profile \
    rate-limit="2M/2M" \
    session-timeout=1h \
    idle-timeout=10m

# Allow access to Django API from hotspot network (before login)
/ip firewall filter add chain=forward src-address=192.168.89.0/24 \
    dst-address=YOUR_DJANGO_SERVER_IP action=accept comment="Allow API access"
```

### Step 8 — Enable RouterOS API

```bash
# Enable RouterOS API service (used by Django routeros-api)
/ip service enable api
/ip service set api port=8728 address=192.168.1.0/24

# Create API user for Django
/user add name=django-api password=StrongAPIPassword123 group=full
# Restrict API user to admin network only
/user set django-api address=192.168.1.0/24
```

---

## M-Pesa Integration

### Flow Diagram

```
React → POST /api/payments/initiate/
          │
          ▼
    Django builds STK Push request
          │
          ▼
    POST https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest
          │
          ▼
    Safaricom sends USSD to customer phone
          │
          ▼
    Customer enters M-Pesa PIN
          │
          ▼
    Safaricom POSTs to /api/payments/mpesa/callback/
          │
          ▼
    Django verifies → creates HotspotUser
          │
          ▼
    Celery task → routeros-api → MikroTik
          │
          ▼
    Customer gets internet access 🎉
```

### Daraja API Credentials

```
Register at: https://developer.safaricom.co.ke
Create an app → Get Consumer Key + Consumer Secret

For production:
- Go live approval required from Safaricom
- Callback URL must be HTTPS (use ngrok for dev)
```

### services/mpesa.py — Key Functions

```python
class MpesaService:
    def get_access_token(self) -> str
    def generate_password(self) -> tuple[str, str]       # base64 password, timestamp
    def initiate_stk_push(self, phone, amount, reference) -> dict
    def verify_transaction(self, checkout_request_id) -> dict
    def parse_callback(self, callback_data: dict) -> dict  # Extract receipt, amount
```

### services/mikrotik.py — Key Functions

```python
class MikroTikService:
    def connect(self) -> None
    def disconnect(self) -> None
    def create_hotspot_user(self, username, password, profile, mac=None) -> bool
    def delete_hotspot_user(self, username) -> bool
    def enable_hotspot_user(self, username) -> bool
    def disable_hotspot_user(self, username) -> bool
    def get_online_users(self) -> list[dict]
    def disconnect_active_session(self, username) -> bool
    def create_queue(self, name, target_ip, max_up, max_down) -> bool
    def get_user_traffic(self, username) -> dict
```

---

## Environment Variables

### Backend — `backend/.env`

```env
# Django
SECRET_KEY=your-secret-key-here
DEBUG=False
ALLOWED_HOSTS=your-domain.com,192.168.1.10
DJANGO_SETTINGS_MODULE=config.settings.production

# Database
DB_NAME=wifibill_db
DB_USER=wifibill_user
DB_PASSWORD=strong-db-password
DB_HOST=localhost
DB_PORT=5432

# Redis & Celery
REDIS_URL=redis://localhost:6379/0
CELERY_BROKER_URL=redis://localhost:6379/0
CELERY_RESULT_BACKEND=redis://localhost:6379/1

# JWT
JWT_ACCESS_TOKEN_LIFETIME_MINUTES=60
JWT_REFRESH_TOKEN_LIFETIME_DAYS=7

# M-Pesa Daraja API
MPESA_ENVIRONMENT=sandbox          # sandbox or production
MPESA_CONSUMER_KEY=your-consumer-key
MPESA_CONSUMER_SECRET=your-consumer-secret
MPESA_SHORTCODE=174379             # Use your business shortcode in production
MPESA_PASSKEY=your-lipa-na-mpesa-passkey
MPESA_CALLBACK_URL=https://your-domain.com/api/payments/mpesa/callback/
MPESA_TRANSACTION_TYPE=CustomerPayBillOnline

# MikroTik Router
MIKROTIK_HOST=192.168.88.1
MIKROTIK_PORT=8728
MIKROTIK_USERNAME=django-api
MIKROTIK_PASSWORD=StrongAPIPassword123

# Hotspot Settings
HOTSPOT_DEFAULT_PROFILE=default
HOTSPOT_SERVER_NAME=wifibill-hotspot

# Email (optional)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_HOST_USER=your@gmail.com
EMAIL_HOST_PASSWORD=your-app-password
```

### Frontend — `frontend/.env`

```env
VITE_API_BASE_URL=http://localhost:8000/api
VITE_APP_NAME=WifiBill
VITE_HOTSPOT_REDIRECT_URL=http://192.168.89.1
```

---

## Local Development

### Prerequisites

```
- Python 3.12+
- Node.js 20+
- PostgreSQL 16
- Redis 7
- Docker Desktop (optional but recommended)
```

### Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Copy environment file
cp .env.example .env
# Edit .env with your values

# Run migrations
python manage.py migrate

# Create superuser
python manage.py createsuperuser

# Seed sample packages
python manage.py seed_packages

# Start Django
python manage.py runserver

# In a new terminal — start Celery worker
celery -A tasks.celery worker --loglevel=info

# In another terminal — start Celery beat (scheduled tasks)
celery -A tasks.celery beat --loglevel=info
```

### Frontend Setup

```bash
cd frontend

npm install

cp .env.example .env
# Set VITE_API_BASE_URL=http://localhost:8000/api

npm run dev
# React runs on http://localhost:5173
```

---

## Docker Setup

### `docker-compose.yml`

```yaml
version: "3.9"

services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: ${DB_NAME}
      POSTGRES_USER: ${DB_USER}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

  backend:
    build:
      context: ./backend
      dockerfile: ../docker/backend.Dockerfile
    command: gunicorn config.wsgi:application --bind 0.0.0.0:8000 --workers 3
    volumes:
      - ./backend:/app
      - media_files:/app/media
    ports:
      - "8000:8000"
    env_file:
      - .env
    depends_on:
      - db
      - redis

  celery_worker:
    build:
      context: ./backend
      dockerfile: ../docker/celery.Dockerfile
    command: celery -A tasks.celery worker --loglevel=info
    volumes:
      - ./backend:/app
    env_file:
      - .env
    depends_on:
      - db
      - redis

  celery_beat:
    build:
      context: ./backend
      dockerfile: ../docker/celery.Dockerfile
    command: celery -A tasks.celery beat --loglevel=info
    volumes:
      - ./backend:/app
    env_file:
      - .env
    depends_on:
      - redis

  frontend:
    build:
      context: ./frontend
      dockerfile: ../docker/frontend.Dockerfile
    ports:
      - "5173:80"

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./docker/nginx/nginx.conf:/etc/nginx/nginx.conf
      - ./docker/nginx/wifibill.conf:/etc/nginx/conf.d/default.conf
      - media_files:/var/www/media
      - /etc/letsencrypt:/etc/letsencrypt
    depends_on:
      - backend
      - frontend

volumes:
  postgres_data:
  media_files:
```

### Run with Docker

```bash
# Copy environment file
cp .env.example .env

# Build and start all services
docker compose up --build -d

# Run migrations
docker compose exec backend python manage.py migrate

# Create superuser
docker compose exec backend python manage.py createsuperuser

# Seed packages
docker compose exec backend python manage.py seed_packages

# View logs
docker compose logs -f backend
```

---

## Deployment

### Ubuntu 22.04 Production Setup

```bash
# 1. Update system
sudo apt update && sudo apt upgrade -y

# 2. Install dependencies
sudo apt install -y python3.12 python3.12-venv python3-pip postgresql postgresql-contrib redis-server nginx certbot python3-certbot-nginx

# 3. Create PostgreSQL database
sudo -u postgres psql
CREATE DATABASE wifibill_db;
CREATE USER wifibill_user WITH ENCRYPTED PASSWORD 'strong-password';
GRANT ALL PRIVILEGES ON DATABASE wifibill_db TO wifibill_user;
\q

# 4. Clone repository
git clone https://github.com/yourrepo/wifibill.git /var/www/wifibill

# 5. Setup backend
cd /var/www/wifibill/backend
python3.12 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# 6. Configure .env (copy and edit)
cp .env.example .env

# 7. Run migrations + collect static
python manage.py migrate
python manage.py collectstatic --noinput

# 8. Create systemd service for Gunicorn
sudo nano /etc/systemd/system/wifibill.service
```

```ini
# /etc/systemd/system/wifibill.service
[Unit]
Description=WifiBill Django API
After=network.target

[Service]
User=www-data
Group=www-data
WorkingDirectory=/var/www/wifibill/backend
EnvironmentFile=/var/www/wifibill/backend/.env
ExecStart=/var/www/wifibill/backend/venv/bin/gunicorn \
    config.wsgi:application \
    --bind unix:/run/wifibill.sock \
    --workers 3 \
    --timeout 120
Restart=always

[Install]
WantedBy=multi-user.target
```

```bash
# 9. Nginx config
sudo nano /etc/nginx/sites-available/wifibill
```

```nginx
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name your-domain.com;

    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

    # Django API
    location /api/ {
        proxy_pass http://unix:/run/wifibill.sock;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Django admin
    location /admin/ {
        proxy_pass http://unix:/run/wifibill.sock;
        proxy_set_header Host $host;
    }

    # Static files
    location /static/ {
        alias /var/www/wifibill/backend/staticfiles/;
        expires 30d;
    }

    # Media files
    location /media/ {
        alias /var/www/wifibill/backend/media/;
        expires 7d;
    }

    # React frontend (if served by same Nginx)
    location / {
        root /var/www/wifibill/frontend/dist;
        try_files $uri $uri/ /index.html;
    }
}
```

```bash
# 10. Enable site and SSL
sudo ln -s /etc/nginx/sites-available/wifibill /etc/nginx/sites-enabled/
sudo certbot --nginx -d your-domain.com
sudo systemctl enable wifibill nginx
sudo systemctl start wifibill nginx
```

---

## Security

### Django Security Checklist

```python
# config/settings/production.py

DEBUG = False
SECURE_HSTS_SECONDS = 31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_SSL_REDIRECT = True
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
X_FRAME_OPTIONS = 'DENY'
SECURE_CONTENT_TYPE_NOSNIFF = True

# Rate limiting with django-ratelimit
RATELIMIT_ENABLE = True
RATELIMIT_USE_CACHE = 'default'

# M-Pesa callback IP whitelist
MPESA_ALLOWED_IPS = [
    '196.201.214.200',
    '196.201.214.206',
    '196.201.213.114',
    '196.201.214.207',
    '196.201.214.208',
    '196.201.213.44',
    '196.201.212.127',
    '196.201.212.138',
    '196.201.212.129',
    '196.201.212.136',
    '196.201.212.74',
    '196.201.212.69',
]
```

### MikroTik Security

```bash
# Restrict API access to Django server IP only
/ip service set api address=192.168.1.10/32

# Disable unused services
/ip service disable telnet,ftp,www,api-ssl

# Strong firewall
/ip firewall filter add chain=input protocol=tcp dst-port=8728 \
    src-address=192.168.1.10 action=accept comment="Allow API from Django"

/ip firewall filter add chain=input protocol=tcp dst-port=8728 \
    action=drop comment="Block API from everywhere else"

# Change default admin username
/user add name=myadmin password=VeryStrongPassword group=full
/user remove admin
```

---

## Requirements

### `backend/requirements.txt`

```txt
Django==5.0.7
djangorestframework==3.15.2
djangorestframework-simplejwt==5.3.1
django-cors-headers==4.4.0
django-ratelimit==4.1.0
psycopg2-binary==2.9.9
redis==5.0.8
celery==5.4.0
routeros-api==0.17.0
requests==2.32.3
Pillow==10.4.0
python-dotenv==1.0.1
gunicorn==22.0.0
WeasyPrint==62.3
```

---

## Milestones

### Milestone 1 — MikroTik Hotspot (Week 1)

- [ ] Configure WAN, LAN, DHCP on MikroTik
- [ ] Enable RouterOS API on port 8728
- [ ] Test routeros-api connection from Python
- [ ] Create/delete test hotspot users via Python

### Milestone 2 — Django API (Week 2)

- [ ] Project scaffold + PostgreSQL connection
- [ ] Customer registration + JWT login
- [ ] Package CRUD endpoints
- [ ] MikroTikService class wired up
- [ ] HotspotUser model + activation logic

### Milestone 3 — M-Pesa Integration (Week 3)

- [ ] Daraja sandbox credentials
- [ ] STK Push endpoint
- [ ] Callback URL (test with ngrok)
- [ ] Payment verification
- [ ] Auto-activate hotspot user on payment

### Milestone 4 — React Frontend (Week 4)

- [ ] Auth pages (Login, Register)
- [ ] Package listing page
- [ ] M-Pesa payment modal + polling
- [ ] Customer dashboard (session timer, usage)
- [ ] Payment history + receipt download

### Milestone 5 — Admin Portal (Week 5)

- [ ] Admin dashboard with charts
- [ ] User management (suspend/activate)
- [ ] Package management
- [ ] Voucher generation
- [ ] Revenue & bandwidth reports

### Milestone 6 — Production Deployment (Week 6)

- [ ] Ubuntu 22.04 server setup
- [ ] Nginx + Gunicorn + SSL
- [ ] Celery systemd services
- [ ] Safaricom production go-live
- [ ] MikroTik production router config
- [ ] Monitoring + backup scripts

---

## Development Notes

- For M-Pesa callback testing locally, use **ngrok**: `ngrok http 8000`
- MikroTik hAP ac² or hAP ac³ recommended for development
- Use `docker compose` (V2 syntax, no hyphen) on Windows with Docker Desktop
- Run all Docker commands from the project root (`/d/wifibill/`)
- API responses follow shape: `{ success, message, data, errors }`
- DRF pagination shape: `{ count, results: [] }` — use `toArray()` helper in React

---

*Built by Steve Ongera  / 0757790687 — WifiBill v1.0*