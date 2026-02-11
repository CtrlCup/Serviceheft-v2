# 🚗 Digitales Serviceheft

Ein digitales Fahrzeug-Serviceheft zur Verwaltung von Wartungen, Reparaturen, Tankstopps und mehr – mit Live-Datenübertragung per UDP und optionaler SSO-Anbindung via Authentik.

## ✨ Features

- **Fahrzeugverwaltung** – Stammdaten, Bilder, Kilometerstand, TÜV-Termine
- **Wartungshistorie** – Ölwechsel, Inspektionen, Reparaturen, TÜV, Rechnungen, Tankstopps
- **Farbcodierte Kategorien** – Jede Wartungskategorie hat eine eigene Farbe
- **Kalenderansicht** – Übersicht aller Wartungstermine
- **Live-Daten** – Echtzeit-Fahrzeugdaten via UDP/WebSocket (Motorstatus, Tankstand, Laufzeit)
- **Benachrichtigungen** – E-Mail-Erinnerungen für fällige Wartungen
- **Benutzerverwaltung** – Admin-Panel mit Registrierungssteuerung
- **SSO** – Authentik (OpenID Connect) und Authelia Integration
- **Docker-Ready** – Ein-Klick-Deployment mit Docker Compose + MariaDB

---

## 🚀 Quickstart (Docker Compose)

### 1. Repository klonen

```bash
git clone https://github.com/CtrlCup/Serviceheft-v2.git
cd Serviceheft-v2
```

### 2. Konfigurationsdateien erstellen

```bash
cp .env.example .env
cp config.example.json config.json
```

### 3. `.env` anpassen

Bearbeite die `.env`-Datei und setze sichere Passwörter:

```env
DB_ROOT_PASSWORD=mein_sicheres_root_passwort
DB_PASSWORD=mein_sicheres_db_passwort
```

### 4. `config.json` anpassen

Passe mindestens das JWT-Secret an:

```json
{
  "auth": {
    "jwtSecret": "ein-langer-zufaelliger-string-min-32-zeichen"
  }
}
```

### 5. Starten

```bash
docker compose up -d
```

Die App ist unter **http://localhost:3001** erreichbar.

**Standard-Login:** `admin` / `admin123`

> [!IMPORTANT]
> Ändere das Admin-Passwort nach dem ersten Login!

---

## 🛠️ Manuelle Installation (ohne Docker)

### Voraussetzungen

- Node.js 20+
- MariaDB/MySQL (oder SQLite für Entwicklung)

### Installation

```bash
# Client bauen
cd client && npm install && npm run build && cd ..

# Server starten
cd server && npm install && npm run dev
```

### SQLite verwenden (lokal)

In `config.json` den Datenbanktyp ändern:

```json
{
  "database": {
    "type": "sqlite"  oder  "(mariadb)"
  }
}
```

---

## ⚙️ Konfiguration

### Umgebungsvariablen (`.env`)

| Variable | Beschreibung | Standard |
|---|---|---|
| `DB_ROOT_PASSWORD` | MariaDB Root-Passwort | `rootpassword` |
| `DB_DATABASE` | Datenbankname | `serviceheft` |
| `DB_USER` | Datenbank-Benutzer | `serviceheft` |
| `DB_PASSWORD` | Datenbank-Passwort | `serviceheft` |
| `DB_EXTERNAL_PORT` | Externer MariaDB-Port | `3306` |
| `APP_PORT` | App-Port | `3001` |
| `UDP_PORT` | UDP-Port für Live-Daten | `41234` |

### `config.json` Referenz

| Bereich | Schlüssel | Beschreibung |
|---|---|---|
| `database` | `type` | `sqlite`, `mariadb`, `mysql`, `postgresql` |
| `smtp` | `host`, `port`, `user`, `password`, `from` | E-Mail-Konfiguration |
| `udp` | `port`, `enabled` | Live-Datenempfang |
| `auth.jwtSecret` | – | JWT-Signatur-Schlüssel |
| `auth.authentik` | `enabled`, `issuer`, `clientId`, `clientSecret`, `redirectUri` | Authentik SSO |
| `auth.authelia` | `enabled`, `url` | Authelia Integration |

---

## 🔐 Authentik-Setup

1. In Authentik eine neue **OAuth2/OpenID Connect**-Application anlegen
2. **Client ID** und **Client Secret** kopieren
3. **Redirect URI** setzen: `https://serviceheft.example.com/api/auth/callback/authentik`
4. Die Werte in `config.json` eintragen oder im Admin-Panel unter Konfiguration → Authentik

---

## 🗂️ Projektstruktur

```
├── client/           # React/Vite Frontend
│   ├── src/
│   │   ├── pages/    # Seiten (Dashboard, Vehicle Detail, Admin, Login, Settings)
│   │   ├── components/
│   │   ├── services/ # API-Client
│   │   └── assets/   # Bilder, Platzhalter
│   └── public/       # Favicon, statische Dateien
├── server/           # Express/Node.js Backend
│   ├── src/
│   │   ├── routes/   # API-Endpoints
│   │   ├── database/ # DB-Verbindung, Migrationen
│   │   ├── middleware/
│   │   └── services/ # Benachrichtigungen
│   └── uploads/      # Fahrzeugbilder
├── docker-compose.yml
├── Dockerfile
├── config.json       # Hauptkonfiguration (nicht in Git!)
└── .env              # Umgebungsvariablen (nicht in Git!)
```

---

## 📄 Lizenz

MIT
