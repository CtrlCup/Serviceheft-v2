#!/usr/bin/env python3
"""
╔══════════════════════════════════════════════════════╗
║  Digitales Serviceheft – Fahrzeug-Simulator          ║
║  Sendet UDP-Pakete an den Server, um ein Auto zu     ║
║  simulieren und Live-Daten zu testen.                ║
╚══════════════════════════════════════════════════════╝

Voraussetzungen:
  - Python 3.6+
  - Ein Fahrzeug mit einem UDP-Token (aus der Fahrzeugdetailseite)

Verwendung:
  python3 vehicle_simulator.py                    # Interaktives Menü
  python3 vehicle_simulator.py --help             # Alle Optionen anzeigen
  python3 vehicle_simulator.py --token TOKEN km 12345
  python3 vehicle_simulator.py --token TOKEN fuel 75
  python3 vehicle_simulator.py --token TOKEN engine running
  python3 vehicle_simulator.py --token TOKEN auto  # Automatische Simulation
"""

import argparse
import json
import socket
import sys
import time
import random


# ─── Standardwerte ───────────────────────────────────
"""
DEFAULT_HOST = "127.0.0.1"
DEFAULT_PORT = 41234
"""
DEFAULT_HOST = "serviceheft.alex-cloud.eu"
DEFAULT_PORT = 41234

def send_udp(host: str, port: int, payload: dict) -> None:
    """Sendet ein JSON-Paket per UDP an den Server."""
    data = json.dumps(payload).encode("utf-8")
    with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as sock:
        sock.sendto(data, (host, port))
    print(f"  ✓ Gesendet: {json.dumps(payload, ensure_ascii=False)}")


def cmd_km(args) -> None:
    """Kilometerstand senden."""
    payload = {"vehicleToken": args.token, "km": args.value}
    send_udp(args.host, args.port, payload)


def cmd_fuel(args) -> None:
    """Tankfüllstand senden (0-100%)."""
    payload = {"vehicleToken": args.token, "fuelLevel": args.value}
    send_udp(args.host, args.port, payload)


def cmd_engine(args) -> None:
    """Motorstatus senden (off/ignition/running)."""
    if args.status not in ("off", "ignition", "running"):
        print("❌ Ungültiger Status. Erlaubt: off, ignition, running")
        return
    payload = {"vehicleToken": args.token, "engineStatus": args.status}
    send_udp(args.host, args.port, payload)


def cmd_runtime(args) -> None:
    """Motor-Laufzeit in Sekunden senden."""
    payload = {"vehicleToken": args.token, "engineRuntime": args.value}
    send_udp(args.host, args.port, payload)


def cmd_fuelstop(args) -> None:
    """Tankstop senden (Liter, Preis/Liter, Kraftstoffart)."""
    payload = {
        "vehicleToken": args.token,
        "km": args.km,
        "fuelStop": {
            "liters": args.liters,
            "pricePerLiter": args.price,
            "fuelType": args.fuel_type,
        },
    }
    send_udp(args.host, args.port, payload)


def cmd_all(args) -> None:
    """Alle Werte auf einmal senden."""
    payload = {
        "vehicleToken": args.token,
        "km": args.km,
        "fuelLevel": args.fuel,
        "engineStatus": args.engine,
        "engineRuntime": args.runtime,
    }
    send_udp(args.host, args.port, payload)


def cmd_auto(args) -> None:
    """Automatische Simulation: Werte ändern sich graduell über Zeit."""
    print(f"\n🚗 Automatische Simulation gestartet")
    print(f"   Server:  {args.host}:{args.port}")
    print(f"   Token:   {args.token}")
    print(f"   Intervall: {args.interval}s")
    print(f"   Drücke Strg+C zum Beenden\n")

    km = args.start_km
    fuel = args.start_fuel
    runtime = 0
    engine_status = "off"
    step = 0

    try:
        while True:
            step += 1

            # Simuliere Motorstart nach ein paar Sekunden
            if step == 2:
                engine_status = "ignition"
                print(f"\n🔑 Motor: Zündung")
            elif step == 3:
                engine_status = "running"
                print(f"\n🚗 Motor: Läuft")

            # Wenn der Motor läuft, Werte ändern
            if engine_status == "running":
                km += random.uniform(0.5, 3.0)  # ~0.5-3 km pro Intervall
                km = round(km, 1)
                fuel -= random.uniform(0.1, 0.5)  # Kraftstoff verbrauchen
                fuel = max(0, round(fuel, 1))
                runtime += args.interval

                # Gelegentlich tanken
                if fuel < 10 and random.random() < 0.3:
                    liters = random.uniform(30, 60)
                    price = random.uniform(1.50, 2.10)
                    fuel_type = random.choice(["Super E10", "Super E5", "Diesel"])
                    tank_payload = {
                        "vehicleToken": args.token,
                        "km": km,
                        "fuelStop": {
                            "liters": round(liters, 2),
                            "pricePerLiter": round(price, 2),
                            "fuelType": fuel_type,
                        },
                    }
                    print(f"\n⛽ Tankstop: {round(liters, 1)}L {fuel_type} @ {round(price, 2)}€/L")
                    send_udp(args.host, args.port, tank_payload)
                    fuel = min(100, fuel + liters * 1.5)  # ~1.5% pro Liter
                    fuel = round(fuel, 1)

            payload = {
                "vehicleToken": args.token,
                "km": km,
                "fuelLevel": fuel,
                "engineStatus": engine_status,
                "engineRuntime": runtime,
            }

            timestamp = time.strftime("%H:%M:%S")
            print(f"  [{timestamp}]  KM: {km:>10.1f}  |  Fuel: {fuel:>5.1f}%  |  Engine: {engine_status:<9}  |  Runtime: {runtime}s")
            send_udp(args.host, args.port, payload)

            time.sleep(args.interval)

    except KeyboardInterrupt:
        # Motor abstellen
        print(f"\n\n🔴 Motor wird abgestellt...")
        payload = {
            "vehicleToken": args.token,
            "km": km,
            "fuelLevel": fuel,
            "engineStatus": "off",
            "engineRuntime": runtime,
        }
        send_udp(args.host, args.port, payload)
        print(f"✅ Simulation beendet. Endstand: {km:.1f} km, {fuel:.1f}% Kraftstoff, {runtime}s Laufzeit\n")


def interactive_menu(args) -> None:
    """Interaktives Menü für manuelles Testen."""
    print(f"""
╔══════════════════════════════════════════════════════╗
║  🚗 Digitales Serviceheft – Fahrzeug-Simulator       ║
╚══════════════════════════════════════════════════════╝

  Server:  {args.host}:{args.port}
  Token:   {args.token or '(nicht gesetzt – bitte mit --token angeben)'}
""")

    if not args.token:
        args.token = input("  Bitte UDP-Token eingeben: ").strip()
        if not args.token:
            print("❌ Kein Token angegeben. Beende.")
            return

    while True:
        print("""
  ┌──────────────────────────────────────┐
  │  1) Kilometerstand senden            │
  │  2) Tankfüllstand senden             │
  │  3) Motorstatus senden               │
  │  4) Motor-Laufzeit senden            │
  │  5) Tankstop senden                  │
  │  6) Alle Werte auf einmal senden     │
  │  7) Automatische Simulation starten  │
  │  0) Beenden                          │
  └──────────────────────────────────────┘""")

        choice = input("\n  Auswahl: ").strip()

        try:
            if choice == "1":
                km = float(input("  Kilometerstand: "))
                send_udp(args.host, args.port, {"vehicleToken": args.token, "km": km})

            elif choice == "2":
                fuel = float(input("  Tankfüllstand (0-100%): "))
                send_udp(args.host, args.port, {"vehicleToken": args.token, "fuelLevel": fuel})

            elif choice == "3":
                print("  Optionen: off, ignition, running")
                status = input("  Motorstatus: ").strip()
                if status in ("off", "ignition", "running"):
                    send_udp(args.host, args.port, {"vehicleToken": args.token, "engineStatus": status})
                else:
                    print("  ❌ Ungültiger Status")

            elif choice == "4":
                runtime = int(input("  Laufzeit (Sekunden): "))
                send_udp(args.host, args.port, {"vehicleToken": args.token, "engineRuntime": runtime})

            elif choice == "5":
                km = float(input("  Aktueller Kilometerstand: "))
                liters = float(input("  Getankte Liter: "))
                price = float(input("  Preis pro Liter (€): "))
                fuel_type = input("  Kraftstoffart (z.B. Super E10): ").strip() or "Super E10"
                payload = {
                    "vehicleToken": args.token,
                    "km": km,
                    "fuelStop": {
                        "liters": liters,
                        "pricePerLiter": price,
                        "fuelType": fuel_type,
                    },
                }
                send_udp(args.host, args.port, payload)

            elif choice == "6":
                km = float(input("  Kilometerstand: "))
                fuel = float(input("  Tankfüllstand (0-100%): "))
                print("  Optionen: off, ignition, running")
                engine = input("  Motorstatus: ").strip()
                runtime = int(input("  Laufzeit (Sekunden): "))
                payload = {
                    "vehicleToken": args.token,
                    "km": km,
                    "fuelLevel": fuel,
                    "engineStatus": engine,
                    "engineRuntime": runtime,
                }
                send_udp(args.host, args.port, payload)

            elif choice == "7":
                args.start_km = float(input("  Start-Kilometerstand [50000]: ") or "50000")
                args.start_fuel = float(input("  Start-Tankfüllstand % [80]: ") or "80")
                args.interval = float(input("  Intervall in Sekunden [3]: ") or "3")
                cmd_auto(args)

            elif choice == "0":
                print("\n  Auf Wiedersehen! 👋\n")
                break

            else:
                print("  ❌ Ungültige Auswahl")

        except ValueError as e:
            print(f"  ❌ Ungültige Eingabe: {e}")
        except KeyboardInterrupt:
            print("\n\n  Auf Wiedersehen! 👋\n")
            break


def main():
    parser = argparse.ArgumentParser(
        description="🚗 Digitales Serviceheft – Fahrzeug-Simulator",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Beispiele:
  %(prog)s                                        # Interaktiver Modus
  %(prog)s --token abc123 km 12345                 # Kilometerstand senden
  %(prog)s --token abc123 fuel 75                  # Tankfüllstand senden
  %(prog)s --token abc123 engine running           # Motor läuft
  %(prog)s --token abc123 engine off               # Motor aus
  %(prog)s --token abc123 runtime 3600             # 1h Laufzeit
  %(prog)s --token abc123 fuelstop 12345 45 1.89   # Tankstop
  %(prog)s --token abc123 auto                     # Auto-Simulation
  %(prog)s --token abc123 auto --interval 5        # Alle 5 Sekunden
        """,
    )

    parser.add_argument("--host", default=DEFAULT_HOST, help=f"Server-Adresse (Standard: {DEFAULT_HOST})")
    parser.add_argument("--port", type=int, default=DEFAULT_PORT, help=f"UDP-Port (Standard: {DEFAULT_PORT})")
    parser.add_argument("--token", help="Fahrzeug-UDP-Token (aus der Fahrzeugdetailseite)")

    subparsers = parser.add_subparsers(dest="command", help="Verfügbare Befehle")

    # km
    p_km = subparsers.add_parser("km", help="Kilometerstand senden")
    p_km.add_argument("value", type=float, help="Kilometerstand")

    # fuel
    p_fuel = subparsers.add_parser("fuel", help="Tankfüllstand senden (0-100)")
    p_fuel.add_argument("value", type=float, help="Tankfüllstand in Prozent")

    # engine
    p_engine = subparsers.add_parser("engine", help="Motorstatus senden")
    p_engine.add_argument("status", choices=["off", "ignition", "running"], help="Motorstatus")

    # runtime
    p_runtime = subparsers.add_parser("runtime", help="Motor-Laufzeit senden (Sekunden)")
    p_runtime.add_argument("value", type=int, help="Laufzeit in Sekunden")

    # fuelstop
    p_fuelstop = subparsers.add_parser("fuelstop", help="Tankstop senden")
    p_fuelstop.add_argument("km", type=float, help="Aktueller Kilometerstand")
    p_fuelstop.add_argument("liters", type=float, help="Getankte Liter")
    p_fuelstop.add_argument("price", type=float, help="Preis pro Liter")
    p_fuelstop.add_argument("--fuel-type", default="Super E10", help="Kraftstoffart (Standard: Super E10)")

    # all
    p_all = subparsers.add_parser("all", help="Alle Werte auf einmal senden")
    p_all.add_argument("km", type=float, help="Kilometerstand")
    p_all.add_argument("fuel", type=float, help="Tankfüllstand (0-100)")
    p_all.add_argument("engine", choices=["off", "ignition", "running"], help="Motorstatus")
    p_all.add_argument("runtime", type=int, help="Laufzeit in Sekunden")

    # auto
    p_auto = subparsers.add_parser("auto", help="Automatische Simulation")
    p_auto.add_argument("--start-km", type=float, default=50000, help="Start-Kilometerstand (Standard: 50000)")
    p_auto.add_argument("--start-fuel", type=float, default=80, help="Start-Tankfüllstand %% (Standard: 80)")
    p_auto.add_argument("--interval", type=float, default=3, help="Intervall in Sekunden (Standard: 3)")

    args = parser.parse_args()

    # Kein Subcommand → interaktives Menü
    if not args.command:
        interactive_menu(args)
        return

    # Token ist für alle Befehle Pflicht
    if not args.token:
        print("❌ --token ist erforderlich. Verwende: --token DEIN_UDP_TOKEN")
        sys.exit(1)

    # Befehl ausführen
    commands = {
        "km": cmd_km,
        "fuel": cmd_fuel,
        "engine": cmd_engine,
        "runtime": cmd_runtime,
        "fuelstop": cmd_fuelstop,
        "all": cmd_all,
        "auto": cmd_auto,
    }

    commands[args.command](args)


if __name__ == "__main__":
    main()
